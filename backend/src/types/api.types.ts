export type ApiSuccessResponse<TPayload extends Record<string, unknown>> = {
    success: true;
} & TPayload;

export type ApiErrorResponse<TDetails extends Record<string, unknown> = Record<string, never>> = {
    success: false;
    error: string;
} & TDetails;

export type ApiResponse<TPayload extends Record<string, unknown>> =
    | ApiSuccessResponse<TPayload>
    | ApiErrorResponse;
