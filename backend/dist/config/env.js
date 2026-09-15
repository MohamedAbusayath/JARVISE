"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.env = void 0;
const dotenv_1 = __importDefault(require("dotenv"));
dotenv_1.default.config();
const getEnvValue = (key) => {
    return process.env[key]?.trim() || "";
};
exports.env = {
    port: Number(process.env.PORT) || 5000,
    supabase: {
        url: getEnvValue("SUPABASE_URL"),
        anonKey: getEnvValue("SUPABASE_ANON_KEY"),
        serviceRoleKey: getEnvValue("SUPABASE_SERVICE_ROLE_KEY")
    },
    gemini: {
        apiKey: getEnvValue("GEMINI_API_KEY"),
        model: getEnvValue("GEMINI_MODEL") || "gemini-2.0-flash",
        embeddingModel: getEnvValue("GEMINI_EMBEDDING_MODEL") || "text-embedding-004",
        timeoutMs: Number(process.env.GEMINI_TIMEOUT_MS) || 15000,
        maxInputCharacters: Number(process.env.GEMINI_MAX_INPUT_CHARACTERS) || 12000,
        maxOutputTokens: Number(process.env.GEMINI_MAX_OUTPUT_TOKENS) || 1024,
        contextMessageLimit: Number(process.env.GEMINI_CONTEXT_MESSAGE_LIMIT) || 20
    },
    memory: {
        semanticThreshold: Number(process.env.MEMORY_SEMANTIC_THRESHOLD) || 0.72,
        semanticLimit: Number(process.env.MEMORY_SEMANTIC_LIMIT) || 5
    },
    google: {
        clientId: getEnvValue("GOOGLE_CLIENT_ID"),
        clientSecret: getEnvValue("GOOGLE_CLIENT_SECRET"),
        redirectUri: getEnvValue("GOOGLE_REDIRECT_URI") || "http://localhost:5000/api/drive/callback",
        tokenEncryptionKey: getEnvValue("GOOGLE_TOKEN_ENCRYPTION_KEY"),
        oauthStateSecret: getEnvValue("GOOGLE_OAUTH_STATE_SECRET")
    }
};
//# sourceMappingURL=env.js.map