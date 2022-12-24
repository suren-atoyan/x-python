// payloads
type ExecPayload = {
  code: string;
  context?: Record<string, unknown>;
};

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
type ExecCallbacks = Record<
  CommandUniqueId,
  {
    resolve: (value: ExecReturnValue) => void;
  }
>;

type CompleteCallbacks = Record<
  CommandUniqueId,
  {
    resolve: (value: CompletionResults) => void;
    reject: (value: string) => void;
  }
>;

type InstallCallbacks = Record<
  CommandUniqueId,
  {
    resolve: (value: InstallReturnValue) => void;
    reject: (value: string) => void;
  }
>;

type FormatCallbacks = Record<
  CommandUniqueId,
  {
    resolve: (value: FormatReturnValue) => void;
    reject: (value: string) => void;
  }
>;
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
// ====== ** ======

// return values
type ExecReturnValue = Omit<ExecParams, 'id'>;
type CompleteReturnValue = Omit<CompleteParams, 'id'>;
type InstallReturnValue = Omit<InstallParams, 'id'>;
type FormatReturnValue = Omit<FormatParams, 'id'>;
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

type ModuleState = {
  config: object;
  pyodideWorker: Worker | null;
  execCallbacks: ExecCallbacks;
  completeCallbacks: CompleteCallbacks;
  installCallbacks: InstallCallbacks;
  formatCallbacks: FormatCallbacks;
  commandUniqueId: CommandUniqueId;
};

export { ChannelSetupStatus, ActionType };
export type {
  // payloads
  Payload,
  ExecPayload,
  CompletePayload,
  InstallPayload,
  FormatPayload,
  // ====== ** ======
  // callbacks
  ExecCallbacks,
  CompleteCallbacks,
  InstallCallbacks,
  FormatCallbacks,
  // ====== ** ======
  // params
  ExecParams,
  CompleteParams,
  InstallParams,
  FormatParams,
  // return values
  ExecReturnValue,
  CompleteReturnValue,
  InstallReturnValue,
  FormatReturnValue,
  // ====== ** ======
  ChannelTransmitData,
  CompletionResult,
  CompletionResults,
  ModuleState,
  CommandUniqueId,
};
