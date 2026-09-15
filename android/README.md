# JARVISE Android client

This is a secure Android client for the existing JARVISE backend. It intentionally
does not duplicate backend business logic, call Gemini, or perform unrestricted
phone automation.

## Configuration

Set `JARVIS_API_URL` in `local.properties`:

```properties
JARVIS_API_URL=https://your-backend.example.com/api
```

The value is injected as a build-time URL, not as a secret. Backend secrets never
belong in the Android app.

## Responsibilities

- Authenticate through `/api/auth/register`, `/api/auth/login`, and `/api/auth/logout`.
- Keep the backend access token encrypted with Android Keystore.
- Send chat requests to `/api/chat`.
- Provide one-shot speech recognition and text-to-speech.
- Request microphone and notification permissions explicitly.
- Keep camera and location unavailable until a future feature adds permission-gated flows.

## Security boundaries

- The backend remains the source of truth for identity, ownership, tools, memories,
  permissions, and AI decisions.
- No service-role key, Gemini key, Google OAuth secret, or refresh token is bundled
  in resources or source.
- Voice is push-to-talk only. There is no wake-word or always-listening service.
- Device capabilities are not exposed as backend tools by this client.
