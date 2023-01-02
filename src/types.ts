// payloads
type ExecPayload = {
  code: string;
  context?: Context;
};

type Context = Record<string, unknown | ComplexPayload>;

type CompletePayload = {
  code: string;
  line?: number;
  column?: number;
};

type InstallPayload = {
  packages: string[];
};

type FormatPayload = {
  code: string;
};

type Payload = ExecPayload | CompletePayload | InstallPayload | FormatPayload;
// ====== ** ======

// callbacks
type Callback<T> = {
  resolve: (value: T) => void;
  reject: (value: string) => void;
};

type Callbacks<T> = Record<CommandUniqueId, Callback<T>>;

type ActionCallbacks = Callbacks<ActionReturnValue>;
type JSCallbacks = Callbacks<JSFnCallParams>;

type JSFunctions = {
  [fnName: string]: Function;
};
// ====== ** ======

// params
type ExecParams = {
  id: CommandUniqueId;
  error: string | null;
  result: string | null;
  stdout: string | null;
  stderr: string | null;
};

type CompleteParams = {
  result: CompletionResults;
  id: CommandUniqueId;
  error: string | null;
};

type InstallParams = {
  id: CommandUniqueId;
  success: boolean;
  error: string | null;
};

type FormatParams = {
  id: CommandUniqueId;
  result: string | null;
  error: string | null;
};

type JSFnCallParams = {
  id: CommandUniqueId;
  args: unknown[];
  name: string;
};

type Params = ExecParams | CompleteParams | InstallParams | FormatParams;
// ====== ** ======

// return values
type ExecReturnValue = Omit<ExecParams, 'id'>;
type CompleteReturnValue = Omit<CompleteParams, 'id'>;
type InstallReturnValue = Omit<InstallParams, 'id'>;
type FormatReturnValue = Omit<FormatParams, 'id'>;
type ActionReturnValue =
  | ExecReturnValue
  | CompleteReturnValue
  | InstallReturnValue
  | FormatReturnValue;
// ====== ** ======

type ChannelTransmitData = {
  id: string;
  action: ActionType;
  payload: Payload;
};

enum ChannelSetupStatus {
  READY,
}

enum ActionType {
  EXEC,
  COMPLETE,
  INSTALL,
  FORMAT,
  JS_FN_CALL,
}

enum PayloadType {
  FN = '__function__',
}

type CompletionResult = {
  name: string;
  type: string;
  description: string;
  full_name: string;
};

type CompletionMatch = CompletionResult;

type CompletionResults = {
  matches: CompletionMatch[];
};

type CommandUniqueId = string;

type MainModuleState = {
  config: object;
  pyodideWorker: Worker | null;
  callbacks: ActionCallbacks;
  commandUniqueId: CommandUniqueId;
  jsFunctions: JSFunctions;
};

type WorkerModuleState = {
  jsCallbacks: JSCallbacks;
};

type ComplexPayload = {
  type: PayloadType;
  name: string;
};

export { ChannelSetupStatus, ActionType, PayloadType };
export type {
  // payloads
  Payload,
  ExecPayload,
  CompletePayload,
  InstallPayload,
  FormatPayload,
  ComplexPayload,
  Context,
  // ====== ** ======
  // callbacks
  Callback,
  ActionCallbacks,
  JSFunctions,
  // ====== ** ======
  // params
  Params,
  ExecParams,
  CompleteParams,
  InstallParams,
  FormatParams,
  JSFnCallParams,
  // return values
  ActionReturnValue,
  ExecReturnValue,
  CompleteReturnValue,
  InstallReturnValue,
  FormatReturnValue,
  // ====== ** ======
  ChannelTransmitData,
  CompletionResult,
  CompletionResults,
  MainModuleState,
  WorkerModuleState,
  CommandUniqueId,
};
