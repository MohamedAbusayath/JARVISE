"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.getAuthenticatedUser = exports.requireAuth = void 0;
const database_1 = require("../config/database");
const AppError_1 = require("../utils/AppError");
const getBearerToken = (req) => {
    const header = req.header("authorization");
    if (!header || !header.startsWith("Bearer ")) {
        throw new AppError_1.AppError("Authentication token is required", 401, "AUTH_TOKEN_MISSING");
    }
    const token = header.slice("Bearer ".length).trim();
    if (!token) {
        throw new AppError_1.AppError("Authentication token is required", 401, "AUTH_TOKEN_MISSING");
    }
    return token;
};
const requireAuth = async (req, res, next) => {
    try {
        const accessToken = getBearerToken(req);
        const { data: { user }, error } = await (0, database_1.getSupabaseClient)().auth.getUser(accessToken);
        if (error || !user) {
            throw new AppError_1.AppError("Authentication token is invalid or expired", 401, "AUTH_TOKEN_INVALID");
        }
        res.locals.auth = {
            user,
            accessToken
        };
        next();
    }
    catch (error) {
        next(error);
    }
};
exports.requireAuth = requireAuth;
const getAuthenticatedUser = (res) => {
    const auth = res.locals.auth;
    if (!auth) {
        throw new AppError_1.AppError("Authenticated user context is missing", 401, "AUTH_CONTEXT_MISSING");
    }
    return auth;
};
exports.getAuthenticatedUser = getAuthenticatedUser;
//# sourceMappingURL=auth.middleware.js.map