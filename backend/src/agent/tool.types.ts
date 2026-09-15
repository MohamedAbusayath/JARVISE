export type InputSchema<T> = {
    safeParse: (input: unknown) =>
        | { success: true; data: T }
        | { success: false };
};

export type ToolContext = {
    userId: string;
    accessToken: string;
    authorization: ToolAuthorizationContext;
};

export type ToolPermission = "READ" | "WRITE" | "DESTRUCTIVE" | "SENSITIVE";

export type ToolAssuranceLevel = "standard" | "device" | "biometric";

export type ToolAuthorizationContext = {
    confirmedToolNames: ReadonlySet<string>;
    assuranceLevel: ToolAssuranceLevel;
};

export type ToolDefinition<TInput, TResult> = {
    name: string;
    description: string;
    permission: ToolPermission;
    inputSchema: InputSchema<TInput>;
    timeoutMs: number;
    resultValidator?: (result: TResult) => boolean;
    execute: (input: TInput, context: ToolContext) => Promise<TResult>;
};

export type ToolCall = {
    name: string;
    input: Record<string, unknown>;
};

export type ToolResult = {
    name: string;
    result: unknown;
};
