# JARVIS Development

## Local Development Setup

Prerequisites:

- Node.js
- npm
- A local copy of the repository

Backend setup:

```bash
cd backend
npm install
```

Start the backend in development mode:

```bash
npm run dev
```

The backend defaults to port `5000` unless `PORT` is set.

Health check:

```bash
curl http://localhost:5000/api/health
```

## Environment Variables

Environment variables are loaded by `src/config/env.ts`.

Expected variables:

```text
PORT=
SUPABASE_URL=
SUPABASE_ANON_KEY=
GEMINI_API_KEY=
GOOGLE_CLIENT_ID=
GOOGLE_CLIENT_SECRET=
```

Use `.env` for local development only. Keep `.env.example` as a safe template with no real secrets.

## npm Commands

Current backend commands:

```bash
npm run dev
npm run build
npm start
npm test
```

Command behavior:

- `npm run dev`: starts the TypeScript server with `ts-node-dev`.
- `npm run build`: compiles TypeScript into `dist/`.
- `npm start`: runs `dist/server.js`.
- `npm test`: currently a placeholder and exits with an error.

## Testing Strategy

Current status:

- No automated tests are implemented yet.
- TypeScript can be checked with the compiler.
- Health and chat endpoints can be smoke tested locally.

Recommended testing direction:

- Add service unit tests for assistant orchestration.
- Add controller tests for validation and response behavior.
- Add integration tests for Express routes.
- Mock external providers such as Gemini, Supabase, and Google Drive.
- Avoid tests that require real secrets or production accounts.

## Build Strategy

The backend uses TypeScript with `rootDir` set to `src` and `outDir` set to `dist`.

Local build:

```bash
npm run build
```

Production start:

```bash
npm start
```

Render should build the backend before running the start command so `dist/server.js` exists.

## Git Workflow

Recommended workflow:

- Work on small branches focused on one change.
- Run TypeScript/build checks before committing.
- Do not commit `.env`, local logs, or generated secrets.
- Keep documentation, backend logic, frontend work, and deployment changes separated where practical.
- Review changes with `git status` and `git diff` before committing.
- Prefer incremental changes over broad rewrites.
