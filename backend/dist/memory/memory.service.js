"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.retrieveDriveKnowledge = exports.retrieveSemanticMemories = void 0;
const embedding_service_1 = require("./embedding.service");
const memory_repository_1 = require("./memory.repository");
const memory_repository_2 = require("./memory.repository");
const embeddingProvider = new embedding_service_1.GeminiEmbeddingProvider();
const retrieveSemanticMemories = async (accessToken, userId, query, options) => {
    const embedding = await embeddingProvider.generateEmbedding(query);
    return (0, memory_repository_1.searchMemoryEmbeddings)(accessToken, userId, embedding.vector, options);
};
exports.retrieveSemanticMemories = retrieveSemanticMemories;
const retrieveDriveKnowledge = async (accessToken, userId, query, threshold = 0.72, limit = 5) => {
    const embedding = await embeddingProvider.generateEmbedding(query);
    return (0, memory_repository_2.searchDriveChunks)(accessToken, userId, embedding.vector, threshold, limit);
};
exports.retrieveDriveKnowledge = retrieveDriveKnowledge;
//# sourceMappingURL=memory.service.js.map