"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.notFoundHandler = void 0;
const AppError_1 = require("../utils/AppError");
const notFoundHandler = (req, _res, next) => {
    next(new AppError_1.AppError(`Route not found: ${req.method} ${req.path}`, 404));
};
exports.notFoundHandler = notFoundHandler;
//# sourceMappingURL=notFound.middleware.js.map