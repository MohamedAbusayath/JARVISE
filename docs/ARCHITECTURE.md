# JARVIS Architecture

## 1. Project Vision

JARVIS is a secure, cloud-based personal AI assistant designed to help with everyday planning, memory, files, learning, coding assistance, and future multimodal interaction.

The long-term goal is to support browser, Android, and voice experiences while keeping personal data protected by default. JARVIS should be modular enough to add new AI providers, tools, storage systems, and clients without rewriting the core backend.

Core principles:

- Keep secrets and privileged actions on the backend.
- Treat personal memory as sensitive data.
- Make AI provider usage replaceable.
- Prefer explicit user authorization for tools and file access.
- Separate application logic from external provider integrations.

## 2. System Architecture

High-level target architecture:

```text
Android/Browser
        |
        v
Vercel Frontend
        |
        | HTTPS
        v
Render Node.js + Express + TypeScript
        |
        +---- Supabase PostgreSQL
        |
        +---- Supabase Auth
        |
        +---- pgvector
        |
        +---- Gemini API
        |
        +---- Google Drive
```

The frontend is the user-facing client. The backend is the trusted application layer responsible for authentication checks, authorization, AI orchestration, memory access, file access, and future tool execution.

## 3. Frontend Architecture

The frontend is planned as a React + TypeScript application deployed on Vercel.

Responsibilities:

- Render the chat and assistant interface.
- Send authenticated requests to the backend over HTTPS.
- Display responses, status, errors, and future tool results.
- Implement UI and UX from a future Figma design.
- Avoid direct access to private API keys, service credentials, or privileged storage.

The frontend should not call Gemini, Supabase service APIs, or Google Drive APIs directly with privileged credentials. Those operations should go through the backend.

## 4. Backend Architecture

The backend is a Node.js + Express + TypeScript API planned for deployment on Render.

Current implemented layers:

- `src/server.ts`: starts the HTTP server.
- `src/app.ts`: configures Express middleware and mounts routes.
- `src/routes/`: route definitions.
- `src/controllers/`: request validation and HTTP response handling.
- `src/services/`: business logic and external integration boundaries.
- `src/config/env.ts`: environment variable loading.

Current implemented APIs:

- `GET /api/health`
- `POST /api/chat`

Current chat behavior is a stub implementation in `jarvis.service.ts`. Future AI integration should be added behind a provider abstraction instead of coupling controllers directly to Gemini.

## 5. Database Architecture

Supabase PostgreSQL is the planned primary database.

Expected responsibilities:

- Store users and user-linked application data.
- Store conversations and assistant state as needed.
- Store memory metadata and structured memory records.
- Store file metadata for Google Drive documents when needed.
- Support authorization boundaries between users.

Supabase Auth is planned for identity and session management. Server-side authorization must still be enforced in the backend for all protected resources.

## 6. AI Provider Architecture

Gemini API is the initial planned AI provider.

The backend should use an AI provider abstraction so future providers can be added without changing route and controller code.

Recommended direction:

- Define a provider interface for chat, embeddings, and future multimodal calls.
- Keep provider-specific request and response mapping inside provider services.
- Keep prompt construction and assistant orchestration separate from HTTP controllers.
- Centralize provider error handling, retries, and rate limit behavior.
- Avoid exposing provider API keys to the frontend.

Future providers can be added by implementing the same provider interface and selecting providers through configuration.

## 7. Memory Architecture

Memory is planned to use Supabase PostgreSQL with pgvector for semantic search.

Expected memory types:

- User profile facts.
- Preferences.
- Long-term project context.
- Conversation summaries.
- Document-derived knowledge, only when explicitly allowed.

Memory rules:

- Never store passwords, API keys, OTPs, recovery codes, or secrets as normal memory.
- Associate all memory with a user identity.
- Filter retrieval by user and authorization scope.
- Use embeddings for semantic retrieval through pgvector.
- Keep memory write behavior explicit and auditable.
- Support deletion and correction of stored memory.

## 8. Google Drive Architecture

Google Drive is planned for large personal files and documents.

Expected responsibilities:

- Store or reference large files outside the primary database.
- Use OAuth-based access with user consent.
- Keep file metadata in Supabase when needed.
- Let the backend mediate access between the assistant and Drive.
- Avoid automatically sending sensitive documents to AI providers.

Future document processing should separate file listing, file reading, summarization, embedding, and retrieval so each step can enforce authorization and data minimization.

## 9. Future Agent and Tool Architecture

Future JARVIS capabilities may include calendar access, reminders, notifications, file access, image understanding, coding assistance, and tool execution.

Recommended model:

- Maintain a backend tool registry.
- Give each tool a narrow schema and permission boundary.
- Require server-side authorization before executing tools.
- Log tool calls safely without secrets.
- Add rate limits and confirmation steps for sensitive actions.
- Keep tools independent from the AI provider implementation.

The assistant should propose actions when risk is high and execute only after user confirmation where appropriate.

## 10. Deployment Architecture

Target deployment:

- Frontend: Vercel.
- Backend: Render.
- Database and auth: Supabase.
- AI: Gemini API.
- File storage: Google Drive.

Production expectations:

- Use HTTPS for all client-to-backend traffic.
- Store secrets in platform environment variables.
- Restrict CORS to trusted frontend origins.
- Run backend builds from TypeScript to JavaScript before production start.
- Monitor health through `GET /api/health`.
- Keep deployment configuration separate from application logic.
