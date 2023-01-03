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

type JSFnCallPayload = {
  args: unknown[];
  name: string;
};

type Payload = ExecPayload | CompletePayload | InstallPayload | FormatPayload | JSFnCallPayload;
// ====== ** ======

// callbacks
type Callback<T> = {
  resolve: (value: T) => void;
  reject: (value: string) => void;
};

type Callbacks<T> = Record<CommandUniqueId, Callback<T>>;

type ActionCallbacks = Callbacks<ActionReturnValue>;
type JSCallbacks = Callbacks<unknown>;

type JSFunctions = {
  // eslint-disable-next-line @typescript-eslint/ban-types
  [name: string]: Function;
};
// ====== ** ======

// params
type ExecResponse = {
  id: CommandUniqueId;
  error: string | null;
  result: string | null;
  stdout: string | null;
  stderr: string | null;
};

type CompleteResponse = {
  result: CompletionResults;
  id: CommandUniqueId;
  error: string | null;
};

type InstallResponse = {
  id: CommandUniqueId;
  success: boolean;
  error: string | null;
};

type FormatResponse = {
  id: CommandUniqueId;
  result: string | null;
  error: string | null;
};

type JSFnCallResponse = {
  id: CommandUniqueId;
  result: unknown;
  error?: string | null;
};

type Response = ExecResponse | CompleteResponse | InstallResponse | FormatResponse;
// ====== ** ======

// return values
type ExecReturnValue = Omit<ExecResponse, 'id'>;
type CompleteReturnValue = Omit<CompleteResponse, 'id'>;
type InstallReturnValue = Omit<InstallResponse, 'id'>;
type FormatReturnValue = Omit<FormatResponse, 'id'>;
type JSFnCallReturnValue = Omit<JSFnCallResponse, 'id'>;
type ActionReturnValue =
  | ExecReturnValue
  | CompleteReturnValue
  | InstallReturnValue
  | FormatReturnValue
  | JSFnCallReturnValue;
// ====== ** ======

type ChannelTransmitData = {
  id: CommandUniqueId;
  action: ActionType;
  data: Payload | Response;
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

type CommandUniqueId = number;

type MainModuleState = {
  config: object;
  pyodideWorker: Worker | null;
  callbacks: ActionCallbacks;
  commandUniqueId: CommandUniqueId;
  jsFunctions: JSFunctions;
};

type CallbackIdsToCleanup = Record<CommandUniqueId, CommandUniqueId[]>;

type WorkerModuleState = {
  callbacks: JSCallbacks;
  commandUniqueId: CommandUniqueId;
  callbackIdsToCleanup: CallbackIdsToCleanup;
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
  JSFnCallPayload,
  Context,
  // ====== ** ======
  // callbacks
  Callback,
  ActionCallbacks,
  JSCallbacks,
  JSFunctions,
  CallbackIdsToCleanup,
  // ====== ** ======
  // params
  Response,
  ExecResponse,
  CompleteResponse,
  InstallResponse,
  FormatResponse,
  JSFnCallResponse,
  // return values
  ActionReturnValue,
  ExecReturnValue,
  CompleteReturnValue,
  InstallReturnValue,
  FormatReturnValue,
  JSFnCallReturnValue,
  // ====== ** ======
  ChannelTransmitData,
  CompletionResult,
  CompletionResults,
  MainModuleState,
  WorkerModuleState,
  CommandUniqueId,
};
