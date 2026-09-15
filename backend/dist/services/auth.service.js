"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.logoutUser = exports.loginUser = exports.registerUser = void 0;
const database_1 = require("../config/database");
const AppError_1 = require("../utils/AppError");
const assertAuthResponse = (response) => {
    if (response.error || !response.data.user || !response.data.session) {
        throw new AppError_1.AppError(response.error?.message || "Authentication request failed", 401, "AUTHENTICATION_FAILED");
    }
    return response.data;
};
const registerUser = async ({ email, password }) => {
    const response = await (0, database_1.getSupabaseClient)().auth.signUp({
        email,
        password
    });
    if (response.error) {
        throw new AppError_1.AppError(response.error.message, response.error.status || 400, "REGISTRATION_FAILED");
    }
    return {
        user: response.data.user,
        session: response.data.session
    };
};
exports.registerUser = registerUser;
const loginUser = async ({ email, password }) => {
    const response = await (0, database_1.getSupabaseClient)().auth.signInWithPassword({
        email,
        password
    });
    return assertAuthResponse(response);
};
exports.loginUser = loginUser;
const logoutUser = async (accessToken) => {
    const { error } = await (0, database_1.getSupabaseClientForAccessToken)(accessToken).auth.signOut();
    if (error) {
        throw new AppError_1.AppError(error.message, 401, "LOGOUT_FAILED");
    }
};
exports.logoutUser = logoutUser;
//# sourceMappingURL=auth.service.js.map