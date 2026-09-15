"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.databaseHealthCheck = exports.healthCheck = void 0;
const database_service_1 = require("../services/database.service");
const apiResponse_1 = require("../utils/apiResponse");
const healthCheck = (req, res) => {
    (0, apiResponse_1.sendSuccess)(res, {
        service: "JARVIS",
        version: "0.1.0",
        status: "ONLINE"
    });
};
exports.healthCheck = healthCheck;
const databaseHealthCheck = async (req, res) => {
    const database = await (0, database_service_1.checkDatabaseHealth)();
    const statusCode = database.status === "ONLINE" ? 200 : 503;
    if (database.status !== "ONLINE") {
        (0, apiResponse_1.sendError)(res, database.error || "Database health check failed", statusCode, {
            service: "JARVIS",
            database
        });
        return;
    }
    (0, apiResponse_1.sendSuccess)(res, {
        service: "JARVIS",
        database
    });
};
exports.databaseHealthCheck = databaseHealthCheck;
//# sourceMappingURL=health.controller.js.map