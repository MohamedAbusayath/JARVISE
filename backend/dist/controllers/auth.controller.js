"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.logout = exports.login = exports.register = void 0;
const auth_service_1 = require("../services/auth.service");
const auth_middleware_1 = require("../middleware/auth.middleware");
const apiResponse_1 = require("../utils/apiResponse");
const AppError_1 = require("../utils/AppError");
const getCredentials = (req) => {
    const { email, password } = req.body;
    if (typeof email !== "string" ||
        typeof password !== "string" ||
        !email.trim() ||
        !password) {
        throw new AppError_1.AppError("Email and password are required", 400, "AUTH_CREDENTIALS_INVALID");
    }
    return {
        email: email.trim().toLowerCase(),
        password
    };
};
const register = async (req, res) => {
    const result = await (0, auth_service_1.registerUser)(getCredentials(req));
    (0, apiResponse_1.sendSuccess)(res, {
        user: result.user,
        session: result.session
    }, 201);
};
exports.register = register;
const login = async (req, res) => {
    const result = await (0, auth_service_1.loginUser)(getCredentials(req));
    (0, apiResponse_1.sendSuccess)(res, {
        user: result.user,
        session: result.session
    });
};
exports.login = login;
const logout = async (req, res) => {
    const { accessToken } = (0, auth_middleware_1.getAuthenticatedUser)(res);
    await (0, auth_service_1.logoutUser)(accessToken);
    (0, apiResponse_1.sendSuccess)(res, { loggedOut: true });
};
exports.logout = logout;
//# sourceMappingURL=auth.controller.js.map