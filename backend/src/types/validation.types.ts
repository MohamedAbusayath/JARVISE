import { Request } from "express";

export type ValidationResult =
    | {
        valid: true;
    }
    | {
        valid: false;
        message: string;
        details?: unknown;
    };

export type RequestValidator = (req: Request) => ValidationResult;
