import dotenv from "dotenv";

dotenv.config();

const getEnvValue = (key: string): string => {
    return process.env[key]?.trim() || "";
};

export const env = {
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
