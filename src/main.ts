/**
 * xPython module
 * @module xPython
 */
import produce from 'immer';
import state from 'state-local';

import defaultConfig from './config';
import {
  ActionType,
  ChannelSetupStatus,
  CompleteParams,
  CompletePayload,
  CompletionResults,
  ExecParams,
  ExecPayload,
  ExecReturnValue,
  FormatParams,
  FormatPayload,
  FormatReturnValue,
  InstallParams,
  InstallReturnValue,
  ModuleState,
  Payload,
} from './types';
import { ensureCallbackIdExists, once } from './utils';

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
  execCallbacks: {},
  completeCallbacks: {},
  installCallbacks: {},
  formatCallbacks: {},
  commandUniqueId: 0,
} as ModuleState);

const channel = {
  async ensureWorkerIsSetup() {
    const { pyodideWorker } = getState() as ModuleState;

    if (!pyodideWorker) {
      await init();
    }
  },
  async command(payload: Payload, action: ActionType) {
    await channel.ensureWorkerIsSetup();
    const { commandUniqueId, pyodideWorker } = getState() as ModuleState;

    setState({ commandUniqueId: commandUniqueId + 1 });

    pyodideWorker?.postMessage({ payload, id: commandUniqueId, action });
  },
};

function handleExec({ result, error, id, stderr, stdout }: ExecParams) {
  const { execCallbacks } = getState() as ModuleState;

  ensureCallbackIdExists(id, Boolean(execCallbacks[id]));

  const { resolve } = execCallbacks[id];

  setState({
    execCallbacks: produce(execCallbacks, (draft) => {
      delete draft[id];
    }),
  });

  resolve({ result, error, stderr, stdout });
}

function handleComplete({ result, error, id }: CompleteParams) {
  const { completeCallbacks } = getState() as ModuleState;

  ensureCallbackIdExists(id, Boolean(completeCallbacks[id]));

  const { resolve, reject } = completeCallbacks[id];

  setState({
    completeCallbacks: produce(completeCallbacks, (draft) => {
      delete draft[id];
    }),
  });

  if (error) {
    reject?.(error);
    return;
  }

  resolve(result);
}

function handleInstall({ success, error, id }: InstallParams) {
  const { installCallbacks } = getState() as ModuleState;

  ensureCallbackIdExists(id, Boolean(installCallbacks[id]));

  const { resolve, reject } = installCallbacks[id];

  setState({
    installCallbacks: produce(installCallbacks, (draft) => {
      delete draft[id];
    }),
  });

  if (error) {
    reject?.(error);
    return;
  }

  resolve({ success, error });
}

function handleFormat({ result, error, id }: FormatParams) {
  const { formatCallbacks } = getState() as ModuleState;

  ensureCallbackIdExists(id, Boolean(formatCallbacks[id]));

  const { resolve } = formatCallbacks[id];

  setState({
    formatCallbacks: produce(formatCallbacks, (draft) => {
      delete draft[id];
    }),
  });

  resolve({ result, error });
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
            case ActionType.EXEC:
              handleExec(payload);
              break;
            case ActionType.COMPLETE:
              handleComplete(payload);
              break;
            case ActionType.INSTALL:
              handleInstall(payload);
              break;
            case ActionType.FORMAT:
              handleFormat(payload);
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
  return new Promise<ExecReturnValue>((resolve) => {
    const { execCallbacks, commandUniqueId } = getState() as ModuleState;

    channel.command(payload, ActionType.EXEC);

    setState({
      execCallbacks: produce(execCallbacks, (draft) => {
        draft[commandUniqueId] = { resolve };
      }),
    });
  });
}

const complete = {
  async repl(payload: CompletePayload): Promise<CompletionResults> {
    return new Promise<CompletionResults>((resolve, reject) => {
      const { commandUniqueId, completeCallbacks } = getState() as ModuleState;

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
        completeCallbacks: produce(completeCallbacks, (draft) => {
          draft[commandUniqueId] = { resolve, reject };
        }),
      });
    });
  },
};

async function install(packages: string[]) {
  return new Promise<InstallReturnValue>((resolve, reject) => {
    const { installCallbacks, commandUniqueId } = getState() as ModuleState;

    channel.command({ packages }, ActionType.INSTALL);

    setState({
      installCallbacks: produce(installCallbacks, (draft) => {
        draft[commandUniqueId] = { resolve, reject };
      }),
    });
  });
}

async function format(payload: FormatPayload): Promise<FormatReturnValue> {
  return new Promise<FormatReturnValue>((resolve, reject) => {
    const { formatCallbacks, commandUniqueId } = getState() as ModuleState;

    channel.command(payload, ActionType.FORMAT);

    setState({
      formatCallbacks: produce(formatCallbacks, (draft) => {
        draft[commandUniqueId] = { resolve, reject };
      }),
    });
  });
}

export { init, exec, complete, install, format };
