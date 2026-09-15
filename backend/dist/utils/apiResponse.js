"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.sendError = exports.sendSuccess = void 0;
const sendSuccess = (res, payload, statusCode = 200) => {
    const response = {
        success: true,
        ...payload
    };
    res.status(statusCode).json(response);
};
exports.sendSuccess = sendSuccess;
const sendError = (res, error, statusCode = 500, details) => {
    const response = {
        ...details,
        success: false,
        error
    };
    res.status(statusCode).json(response);
};
exports.sendError = sendError;
//# sourceMappingURL=apiResponse.js.map