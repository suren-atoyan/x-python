import type { PyodideInterface } from 'pyodide';
import type { PyProxy } from 'pyodide/ffi';

import { CommandUniqueId, Callback, ActionCallbacks, JSFunctions, JSCallbacks } from './types';

const WRAPPER_FUNCTION_NAME = 'wrapper';

function converteToJs(result: PyProxy, pyodide: PyodideInterface) {
  const convertedToJs =
    result?.toJs?.({
      dict_converter: Object.fromEntries,
      create_pyproxies: false,
    }) || result;

  const converted =
    convertedToJs instanceof pyodide.ffi.PyProxy ? convertedToJs.toString() : convertedToJs;

  if (ArrayBuffer.isView(converted)) {
    const text = new TextDecoder().decode(converted);
    result.getBuffer().release();
    return text;
  }

  return converted;
}

const extractModuleExecptionLineRegExp = /File "<exec>", line (\d+)($|, in <module>)$/m;
const extractWrapperExecptionLineRegExp = new RegExp(
  `File "<exec>", line (\\d+), in ${WRAPPER_FUNCTION_NAME}`,
  'm',
);
const lineNumberRegExp = /line (\d+)/g;

function replaceLineNumber(messageLine: string): string {
  return messageLine.replace(lineNumberRegExp, (_, lineNumber) => {
    return `line ${+lineNumber - 1}`;
  });
}

function extractMainErrorMessage(message: string) {
  const doesContainModuleExecptionLine = extractModuleExecptionLineRegExp.test(message);
  const doesContainWrapperExecptionLine = extractWrapperExecptionLineRegExp.test(message);

  if (!(doesContainModuleExecptionLine || doesContainWrapperExecptionLine)) return message;

  const errorMessageLines = message.split('\n');

  const firstLineIndex = errorMessageLines.findIndex((line) =>
    doesContainModuleExecptionLine
      ? extractModuleExecptionLineRegExp.test(line)
      : extractWrapperExecptionLineRegExp.test(line),
  );

  // TODO (Suren): this should be removed once we import this file as module
  let skipOtherLines = false;

  return errorMessageLines
    .slice(firstLineIndex)
    .reduce((acc: string[], messageLine) => {
      if (skipOtherLines) {
        acc.push(replaceLineNumber(messageLine));
      } else {
        if (doesContainModuleExecptionLine && !doesContainWrapperExecptionLine) {
          if (extractModuleExecptionLineRegExp.test(messageLine)) {
            skipOtherLines = true;
            acc.push(replaceLineNumber(messageLine).replace(', in <module>', ''));
            return acc;
          }
        }

        if (doesContainWrapperExecptionLine) {
          if (extractWrapperExecptionLineRegExp.test(messageLine)) {
            skipOtherLines = true;
            acc.push(replaceLineNumber(messageLine).replace(`, in ${WRAPPER_FUNCTION_NAME}`, ''));
            return acc;
          }
        }
      }

      return acc;
    }, [])
    .join('\n');
}

function once<T>(fn: () => T) {
  let res: T;

  return () => {
    if (!res) {
      res = fn();
    }

    return res;
  };
}

function ensureCallbackIdExists(id: CommandUniqueId, doesIdExist: boolean) {
  if (!doesIdExist) {
    throw new Error(`a wrong id is provided from worker - callback with ${id} id doesn't exist`);
  }
}

// NOTE: the below utilities will be replaced with immer in the next version
function removeCallback(callbacks: ActionCallbacks, removingId: CommandUniqueId) {
  // eslint-disable-next-line
  const { [removingId]: removingCallback, ...rest } = callbacks;

  return rest;
}

function addCallback<T>(
  callbacks: ActionCallbacks | JSCallbacks,
  id: CommandUniqueId | string,
  callback: Callback<T>,
) {
  return { ...callbacks, [id]: callback };
}

function addJsFunction(
  jsFunctions: JSFunctions,
  id: CommandUniqueId | string,
  // eslint-disable-next-line @typescript-eslint/ban-types
  jsFunction: Function,
) {
  return { ...jsFunctions, [id]: jsFunction };
}

function removeJsFunction(jsFunctions: JSFunctions, fnName: string) {
  // eslint-disable-next-line
  const { [fnName]: removingFunctionName, ...rest } = jsFunctions;

  return rest;
}

export {
  extractMainErrorMessage,
  converteToJs,
  once,
  ensureCallbackIdExists,
  removeCallback,
  addCallback,
  addJsFunction,
  removeJsFunction,
};
