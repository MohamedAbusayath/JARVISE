"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.errorHandler = void 0;
const AppError_1 = require("../utils/AppError");
const apiResponse_1 = require("../utils/apiResponse");
const errorHandler = (error, req, res, _next) => {
    if (res.headersSent) {
        return;
    }
    if (error instanceof AppError_1.AppError) {
        (0, apiResponse_1.sendError)(res, error.message, error.statusCode, {
            code: error.code || "REQUEST_FAILED"
        });
        return;
    }
    if (error instanceof SyntaxError && "body" in error) {
        (0, apiResponse_1.sendError)(res, "Invalid JSON payload", 400);
        return;
    }
    console.error("Unhandled request error:", {
        method: req.method,
        path: req.path,
        message: error instanceof Error ? error.message : "Unknown error"
    });
    (0, apiResponse_1.sendError)(res, "Internal Server Error", 500);
};
exports.errorHandler = errorHandler;
//# sourceMappingURL=error.middleware.js.map