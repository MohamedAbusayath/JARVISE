# JARVIS Security

JARVIS handles personal data and will eventually access memory, files, calendars, notifications, and AI providers. Security rules should be treated as core product requirements.

## Secrets

- Never commit `.env`.
- Never commit API keys, OAuth secrets, database passwords, tokens, OTPs, or recovery codes.
- Keep real secrets in local environment files or deployment platform secret stores.
- Keep `.env.example` free of real values.

## Frontend Boundaries

- Never expose API keys to the frontend.
- Never call privileged provider APIs directly from browser or Android clients.
- Treat the backend as the trusted boundary for secret-bearing operations.

## Memory Safety

- Never store passwords, API keys, OTPs, recovery codes, private tokens, or similar secrets in normal AI memory.
- Do not automatically store sensitive user content as memory.
- Provide a path to delete or correct stored memory.
- Scope memory retrieval to the authenticated user.

## Authentication and Authorization

- Authentication must be handled securely.
- Authorization must be enforced server-side.
- Never trust client-provided user IDs for protected operations.
- Validate session identity before reading or writing user data.
- Use least-privilege access for database, storage, and provider credentials.

## AI Provider Safety

- Sensitive data must not automatically be sent to AI providers.
- Send only the minimum context needed for a request.
- Avoid sending secrets, private tokens, credentials, or unnecessary personal documents to AI models.
- Keep provider API keys only on the backend.

## Input Validation

- Validate all user input.
- Validate request bodies, query parameters, route parameters, and tool arguments.
- Reject malformed or unexpected input before it reaches business logic.

## Rate Limiting

- Rate limit AI endpoints.
- Add stricter limits for expensive or sensitive operations.
- Protect future tool execution endpoints from abuse.

## Logging

- Log safely without secrets.
- Do not log API keys, tokens, passwords, OTPs, authorization headers, or full sensitive documents.
- Prefer structured logs with redaction for sensitive fields.

## Production Transport

- Use HTTPS in production.
- Restrict CORS to trusted frontend origins.
- Store production secrets in deployment platform environment settings.
- Monitor security-sensitive failures without leaking private data in error responses.
