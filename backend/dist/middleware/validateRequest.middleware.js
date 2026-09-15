"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.validateRequest = void 0;
const AppError_1 = require("../utils/AppError");
const validateRequest = (validator) => {
    return (req, _res, next) => {
        const result = validator(req);
        if (!result.valid) {
            next(new AppError_1.AppError(result.message, 400, "VALIDATION_ERROR", result.details));
            return;
        }
        next();
    };
};
exports.validateRequest = validateRequest;
//# sourceMappingURL=validateRequest.middleware.js.map