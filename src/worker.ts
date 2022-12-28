/* eslint-disable no-case-declarations */
import type { PyodideInterface } from 'pyodide';
import { loadPyodide } from 'pyodide';

import config from './config';
import pythonSetupCode from './setup.py?raw';
import type {
  ChannelTransmitData,
  CompletePayload,
  CompleteReturnValue,
  ExecPayload,
  ExecReturnValue,
  FormatPayload,
  FormatReturnValue,
  InstallPayload,
  InstallReturnValue,
} from './types';
import { ActionType, ChannelSetupStatus } from './types';
import { converteToJs, extractMainErrorMessage } from './utils';

async function main() {
  // eslint-disable-next-line no-restricted-globals
  const pyodide: PyodideInterface = await loadPyodide(config.loadPyodideOptions);

  await pyodide.loadPackage('micropip');

  await pyodide.runPythonAsync(pythonSetupCode);

  postMessage(ChannelSetupStatus.READY);

  const actions = {
    [ActionType.EXEC]: async ({ code, context = {} }: ExecPayload): Promise<ExecReturnValue> => {
      // Set context values to global python namespace
      Object.entries(context).forEach(([variableName, value]) => {
        pyodide.globals.set(variableName, pyodide.toPy(value));
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
        // Set context values from global python namespace.
        // NOTE: there is an open issue related to this
        // https://github.com/pyodide/pyodide/issues/703
        // the current open is one suggested way.
        // People were looking for an option like
        // pyodide.globals.clean() or similar.
        // The issue with the implementation of this
        // first of all is the fact that pyodide.globals contains builtins,
        // like '__name__', '__doc__', '__package__', '__loader__', '__spec__', etc.
        // So, currently, we do the "cleanup" process manually.
        Object.entries(context).forEach(([variableName]) => {
          pyodide.globals.set(variableName, pyodide.toPy(null)?.toString());
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

      console.log(converteToJs(installData, pyodide));

      return converteToJs(installData, pyodide);
    },
    [ActionType.FORMAT]: async ({ code }: FormatPayload): Promise<FormatReturnValue> => {
      const formatted = pyodide.globals.get('format_code')(code);

      return { result: converteToJs(formatted, pyodide), error: null };
    },
  };

  onmessage = async function onmessage(event: MessageEvent<ChannelTransmitData>) {
    const { id, action = ActionType.EXEC } = event.data;

    switch (action) {
      case ActionType.EXEC:
        const execData = await actions[ActionType.EXEC](event.data.payload as ExecPayload);

        postMessage({
          ...execData,
          id,
          action,
        });
        break;
      case ActionType.COMPLETE:
        const completeData = await actions[ActionType.COMPLETE](
          event.data.payload as CompletePayload,
        );

        postMessage({
          ...completeData,
          id,
          action,
        });
        break;
      case ActionType.INSTALL:
        const installData = await actions[ActionType.INSTALL](event.data.payload as InstallPayload);

        postMessage({
          ...installData,
          id,
          action,
        });
        break;
      case ActionType.FORMAT:
        const formatData = await actions[ActionType.FORMAT](event.data.payload as FormatPayload);

        postMessage({
          ...formatData,
          id,
          action,
        });
        break;
    }
  };
}

main();
