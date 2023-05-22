/* eslint-disable no-case-declarations */
import type { PyodideInterface } from 'pyodide';
import { loadPyodide } from 'pyodide';

import config from './config';
import pythonSetupCode from './setup.py?raw';
import state from 'state-local';
import {
  ChannelTransmitData,
  CompletePayload,
  CompleteReturnValue,
  ComplexPayload,
  ExecPayload,
  ExecReturnValue,
  FormatPayload,
  FormatReturnValue,
  InstallPayload,
  InstallReturnValue,
  PayloadType,
  WorkerModuleState,
  JSFnCallReturnValue,
  CommandUniqueId,
} from './types';
import { ActionType, ChannelSetupStatus } from './types';
import { addCallback, converteToJs, extractMainErrorMessage } from './utils';

/** the local state of the module */
const [getState, setState] = state.create({
  callbacks: {},
  commandUniqueId: 0,
} as WorkerModuleState);

async function main() {
  // eslint-disable-next-line no-restricted-globals
  const pyodide: PyodideInterface = await loadPyodide(config.loadPyodideOptions);

  await pyodide.loadPackage('micropip');
  await pyodide.runPythonAsync(pythonSetupCode);

  let interruptBuffer;

  if (self.SharedArrayBuffer) {
    interruptBuffer = new Uint8Array(new self.SharedArrayBuffer(1));
    pyodide.setInterruptBuffer(interruptBuffer);
  }

  postMessage({
    status: ChannelSetupStatus.READY,
    interruptBuffer,
  });

  const actions = {
    [ActionType.EXEC]: async ({ code, context = {} }: ExecPayload): Promise<ExecReturnValue> => {
      const callbackIdsToCleanUp: CommandUniqueId[] = [];
      // Set context values to global python namespace
      Object.entries(context).forEach(([variableName, value]) => {
        if ((value as ComplexPayload)?.type === PayloadType.FN) {
          pyodide.globals.set(
            variableName,
            generateComplexPayloadHandler(variableName, callbackIdsToCleanUp),
          );
        } else {
          pyodide.globals.set(variableName, pyodide.toPy(value));
        }
      });

      try {
        await pyodide.loadPackagesFromImports(code);
        // clear stdout & stderr before each run
        pyodide.runPython('import sys, io; sys.stdout = io.StringIO(); sys.stderr = io.StringIO()');
        const result = await pyodide.runPythonAsync(code);
        const stdout = pyodide.runPython('import sys; sys.stdout.getvalue()').trim();
        const stderr = pyodide.runPython('import sys; sys.stderr.getvalue()').trim();

        return {
          result: converteToJs(result, pyodide),
          stdout: converteToJs(stdout, pyodide),
          stderr,
          error: null,
        };
      } catch (error) {
        return {
          result: null,
          stdout: null,
          stderr: null,
          error: extractMainErrorMessage((error as Error).message),
        };
      } finally {
        const { callbacks } = getState() as WorkerModuleState;
        // Remove context values from global python namespace.
        // NOTE: there is an open issue related to this
        // https://github.com/pyodide/pyodide/issues/703
        // People were looking for an option like
        // pyodide.globals.clean() or similar.
        // The issue with that is the fact that pyodide.globals contains builtins,
        // like '__name__', '__doc__', '__package__', '__loader__', '__spec__', etc.
        // So, currently, we do the "cleanup" process manually.
        Object.entries(context).forEach(([variableName]) => {
          pyodide.globals.set(variableName, pyodide.toPy(null)?.toString());
        });

        callbackIdsToCleanUp.forEach((id) => {
          delete callbacks[id];
        });
      }
    },
    [ActionType.COMPLETE]: async ({
      code,
      line,
      column,
    }: CompletePayload): Promise<CompleteReturnValue> => {
      await pyodide.loadPackagesFromImports(code);
      const completions = pyodide.globals.get('get_autocompletion')(code, line, column);

      return { result: converteToJs(completions, pyodide), error: null };
    },
    [ActionType.INSTALL]: async ({ packages }: InstallPayload): Promise<InstallReturnValue> => {
      const installData = await pyodide.globals.get('install_pacakge')(packages[0]);

      return converteToJs(installData, pyodide);
    },
    [ActionType.FORMAT]: async ({
      code,
      options = {},
    }: FormatPayload): Promise<FormatReturnValue> => {
      const formatted = pyodide.globals.get('format_code')(code, pyodide.toPy(options));

      return { result: converteToJs(formatted, pyodide), error: null };
    },
  };

  onmessage = async function onmessage(event: MessageEvent<ChannelTransmitData>) {
    const { id, action = ActionType.EXEC, data } = event.data;

    if (action === ActionType.JS_FN_CALL) {
      handleJSFnResponse(data as JSFnCallReturnValue, id);
    } else {
      // TODO (Suren): simplify this
      let result;
      switch (action) {
        case ActionType.EXEC:
          result = await actions[ActionType.EXEC](data as ExecPayload);
          break;
        case ActionType.COMPLETE:
          result = await actions[ActionType.COMPLETE](data as CompletePayload);
          break;
        case ActionType.INSTALL:
          result = await actions[ActionType.INSTALL](data as InstallPayload);
          break;
        case ActionType.FORMAT:
          result = await actions[ActionType.FORMAT](data as FormatPayload);
          break;
      }

      postMessage({
        data: result,
        id,
        action,
      });
    }
  };

  // * ================= * //
  function handleJSFnResponse(data: JSFnCallReturnValue, id: CommandUniqueId) {
    const { result, error } = data;
    const { callbacks } = getState() as WorkerModuleState;

    if (error) {
      callbacks[id].reject(error);
    }

    callbacks[id].resolve(result);
  }

  function generateComplexPayloadHandler(name: string, callbackIdsToCleanUp: CommandUniqueId[]) {
    return async (...args: unknown[]) => {
      return new Promise((resolve, reject) => {
        const { callbacks, commandUniqueId } = getState() as WorkerModuleState;

        postMessage({
          action: ActionType.JS_FN_CALL,
          data: {
            args,
            name,
          },
          id: commandUniqueId,
        });

        callbackIdsToCleanUp.push(commandUniqueId);

        setState({
          callbacks: addCallback<JSFnCallReturnValue>(callbacks, commandUniqueId, {
            resolve,
            reject,
          }),
          commandUniqueId: commandUniqueId + 1,
        });
      });
    };
  }
}

main();
