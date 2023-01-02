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
  Params,
  FormatPayload,
  FormatReturnValue,
  InstallReturnValue,
  MainModuleState,
  Payload,
  Context,
  PayloadType,
  JSFnCallParams,
} from './types';
import { ensureCallbackIdExists, once, removeCallback, addCallback, addJsFunction } from './utils';

import Worker from './worker?worker&inline';

const hasWorkerSupport = Boolean(globalThis.Worker);

/** the local state of the module */
const [getState, setState] = state.create({
  config: defaultConfig,
  pyodideWorker: null,
  // python runner function (runPythonCode) can
  // be called from different places.
  // To avoid chronological mismatches and to support a robust
  // system for non-sequential executions
  // we define an identifier (an incrementing number) for
  // each execution call and we do keep a mapping between ids and callbacks

  // this particular method for handling above described issue
  // was taken from the official pyodide documentation
  // https://pyodide.org/en/stable/usage/webworker.html#the-worker-api
  callbacks: {},
  commandUniqueId: '0',
  jsFunctions: {},
} as MainModuleState);

const channel = {
  async ensureWorkerIsSetup() {
    const { pyodideWorker } = getState() as MainModuleState;

    if (!pyodideWorker) {
      await init();
    }
  },
  async command(payload: Payload, action: ActionType) {
    await channel.ensureWorkerIsSetup();
    const { commandUniqueId, pyodideWorker } = getState() as MainModuleState;

    setState({ commandUniqueId: commandUniqueId + 1 });

    pyodideWorker?.postMessage({ payload, id: commandUniqueId, action });
  },
};

function handleResponse({ id, ...params }: Params) {
  const { callbacks } = getState() as MainModuleState;

  ensureCallbackIdExists(id, Boolean(callbacks[id]));

  const { resolve, reject } = callbacks[id];

  setState({
    callbacks: removeCallback(callbacks, id),
  });

  if (params.error) {
    reject?.(params.error);
    return;
  }

  resolve(params);
}

function handleJSFnCALL({ args, name }: JSFnCallParams) {
  const { jsFunctions } = getState() as MainModuleState;

  jsFunctions[name]?.(...args);
}

const init = once<Promise<Worker>>(function init(): Promise<Worker> {
  return new Promise((resolve, reject) => {
    if (!hasWorkerSupport) {
      reject(new Error('your browser does\nt support web workers!'));
    }

    const pyodideWorker: Worker = new Worker();

    pyodideWorker.onmessage = function onmessage(event) {
      if (event.data === ChannelSetupStatus.READY) {
        setState({ pyodideWorker });

        pyodideWorker.onmessage = function onmessage(event) {
          const { action, ...payload } = event.data;

          switch (action) {
            case ActionType.JS_FN_CALL:
              handleJSFnCALL(payload);
              break;
            default:
              handleResponse(payload);
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
    const { callbacks, commandUniqueId, jsFunctions } = getState() as MainModuleState;

    function replaceFunctions(context: Context): Context {
      return Object.entries(context).reduce((acc, [key, value]) => {
        if (typeof value === 'function') {
          acc[key] = {
            type: PayloadType.FN,
            fnName: value.name,
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

    channel.command(sanitizePayload(payload), ActionType.EXEC);

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

export { init, exec, complete, install, format };
