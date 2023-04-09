/**
 * xPython module
 * @module xPython
 */
import state from 'state-local';

import defaultConfig from './config';
import {
  ActionType,
  ChannelSetupStatus,
  CompletePayload,
  CompletionResults,
  ExecPayload,
  ExecReturnValue,
  Response,
  FormatPayload,
  FormatReturnValue,
  InstallReturnValue,
  MainModuleState,
  Payload,
  Context,
  PayloadType,
  JSFnCallPayload,
  CommandUniqueId,
  ChannelTransmitData,
  ActionReturnValue,
} from './types';
import { ensureCallbackIdExists, once, removeCallback, addCallback, addJsFunction } from './utils';

import Worker from './worker?worker&inline';

const hasWorkerSupport = Boolean(globalThis.Worker);

/** the local state of the module */
const [getState, setState] = state.create({
  config: defaultConfig,
  pyodideWorker: null,
  // To avoid chronological mismatches and to support a robust
  // system for non-sequential executions
  // we define an identifier (an incrementing number) for
  // each execution call and we do keep a mapping between ids and callbacks

  // this particular method for handling above described issue
  // was taken from the official pyodide documentation
  // https://pyodide.org/en/stable/usage/webworker.html#the-worker-api
  callbacks: {},
  commandUniqueId: 0,
  jsFunctions: {},
  interruptBuffer: null,
} as MainModuleState);

const channel = {
  async ensureWorkerIsSetup() {
    const { pyodideWorker } = getState() as MainModuleState;

    if (!pyodideWorker) {
      await init();
    }
  },
  async command(data: Payload | ActionReturnValue, action: ActionType, id?: CommandUniqueId) {
    await channel.ensureWorkerIsSetup();
    const { commandUniqueId, pyodideWorker, interruptBuffer } = getState() as MainModuleState;

    // clear interruptBuffer in case it was accidentally left set after previous code completed.
    if (interruptBuffer) interruptBuffer[0] = 0;

    if (!id) {
      setState({ commandUniqueId: commandUniqueId + 1 });
    }

    pyodideWorker?.postMessage({ data, id: id ?? commandUniqueId, action });
  },
};

const init = once<Promise<Worker>>(function init(): Promise<Worker> {
  return new Promise((resolve, reject) => {
    if (!hasWorkerSupport) {
      reject(new Error('your browser does\nt support web workers!'));
    }

    const pyodideWorker: Worker = new Worker();

    pyodideWorker.onmessage = function onmessage(event) {
      if (event.data?.status === ChannelSetupStatus.READY) {
        setState({ pyodideWorker, interruptBuffer: event.data.interruptBuffer });

        pyodideWorker.onmessage = function onmessage(event: MessageEvent<ChannelTransmitData>) {
          const { action, id, data } = event.data;

          // All messages received from the python worker will land here.
          // Here we branch out to two main message types.
          // One is the response to different actions that we sent before from the main thread.
          // We call it `handleActionResponse` - image one called `xPython.exec({ code: '1 + 1' })`;
          // we send `exec` action to the python worker, we receive the result and `handleActionResponse` is for handling that response.
          // Another one is for handling JS function calls that were being called from python environment.
          // This time the initiator is the python worker and in the main thread we just handle that command from
          // python environemnt.
          switch (action) {
            case ActionType.JS_FN_CALL:
              handleJSFnCaLL(id, data as JSFnCallPayload);
              break;
            default:
              handleActionResponse(id, data as Response);
              break;
          }
        };

        resolve(pyodideWorker);
      } else {
        reject(new Error('unexpected error in setup process'));
      }
    };

    pyodideWorker.onerror = function onerror(error: ErrorEvent) {
      reject(error.message);
    };
  });
});

async function exec(payload: ExecPayload): Promise<ExecReturnValue> {
  return new Promise<ExecReturnValue>((resolve, reject) => {
    const { callbacks, commandUniqueId } = getState() as MainModuleState;

    channel.command(sanitizePayload(payload), ActionType.EXEC);

    // TODO (Suren): remove js functions related to this command

    setState({
      callbacks: addCallback<ExecReturnValue>(callbacks, commandUniqueId, { resolve, reject }),
    });
  });
}

const complete = {
  async repl(payload: CompletePayload): Promise<CompletionResults> {
    return new Promise<CompletionResults>((resolve, reject) => {
      const { commandUniqueId, callbacks } = getState() as MainModuleState;

      const { code, line, column } = payload;

      let normalizeLine = line;
      let normalizeColumn = column;

      if (!line) {
        // if line is not provided
        // we will make it so
        // like the cursor on the last line
        normalizeLine = code.split('\n').length;
      }

      if (!normalizeColumn) {
        // if column is not provided
        // we will make it so
        // like the cursor on the last column
        normalizeColumn = code.split('\n')[(normalizeLine as number) - 1].length;
      }

      channel.command({ code, line: normalizeLine, column: normalizeColumn }, ActionType.COMPLETE);

      setState({
        callbacks: addCallback<CompletionResults>(callbacks, commandUniqueId, {
          resolve,
          reject,
        }),
      });
    });
  },
};

async function install(packages: string[]) {
  return new Promise<InstallReturnValue>((resolve, reject) => {
    const { callbacks, commandUniqueId } = getState() as MainModuleState;

    channel.command({ packages }, ActionType.INSTALL);

    setState({
      callbacks: addCallback<InstallReturnValue>(callbacks, commandUniqueId, {
        resolve,
        reject,
      }),
    });
  });
}

async function format(payload: FormatPayload): Promise<FormatReturnValue> {
  return new Promise<FormatReturnValue>((resolve, reject) => {
    const { callbacks, commandUniqueId } = getState() as MainModuleState;

    channel.command(payload, ActionType.FORMAT);

    setState({
      callbacks: addCallback<FormatReturnValue>(callbacks, commandUniqueId, {
        resolve,
        reject,
      }),
    });
  });
}

function interrupt() {
  const { interruptBuffer } = getState() as MainModuleState;

  if (!globalThis.SharedArrayBuffer) {
    throw new Error(`
      \`.interrupt\` method uses SharedArrayBuffer which requires "cross-origin-isolation" to be enabled.
      To enable "cross-origin-isolation" check this article - https://web.dev/cross-origin-isolation-guide/#enable-cross-origin-isolation
    `);
  }

  if (interruptBuffer) interruptBuffer[0] = 2;
}

// * ============== * //

function handleActionResponse(id: CommandUniqueId, data: ActionReturnValue) {
  const { callbacks } = getState() as MainModuleState;

  ensureCallbackIdExists(id, Boolean(callbacks[id]));

  const { resolve, reject } = callbacks[id];

  setState({
    callbacks: removeCallback(callbacks, id),
  });

  if (data.error) {
    reject?.(data.error);
    return;
  }

  resolve(data);
}

async function handleJSFnCaLL(id: CommandUniqueId, { args, name }: JSFnCallPayload) {
  const { jsFunctions } = getState() as MainModuleState;

  let result, error;

  try {
    result = await jsFunctions[name]?.(...args);
  } catch (err) {
    error = err as string;
  }

  channel.command({ result, error }, ActionType.JS_FN_CALL, id);
}

// `context` object will be passed to python through a separate thread/worker.
// When you postMessage a datum from one thread to another
// that datum is being cloned via "structured clone algorithm".
// functions cannot be duplicated by the structured clone algorithm, as well as
// classes, DOM nodes, etc.
// Here we do replace all functions in the context with `ComplexPayload`s.
// `ComplexPayload`s have a "cloneable" structure and can be passed to another thread.
// They will be treated differently before passing to the python environment.
function replaceFunctions(context: Context): Context {
  const { jsFunctions } = getState() as MainModuleState;

  return Object.entries(context).reduce((acc, [key, value]) => {
    if (typeof value === 'function') {
      acc[key] = {
        type: PayloadType.FN,
        name: value.name,
      };

      setState({
        jsFunctions: addJsFunction(jsFunctions, value.name, value),
      });
    } else {
      acc[key] = value;
    }

    return acc;
  }, {} as Context);
}

function sanitizePayload(payload: ExecPayload): ExecPayload {
  if (payload.context) {
    return {
      ...payload,
      context: replaceFunctions(payload.context),
    };
  }

  return payload;
}

export * from './types';
export { init, exec, complete, install, format, interrupt };
