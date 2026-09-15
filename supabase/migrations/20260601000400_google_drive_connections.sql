BEGIN;

CREATE TABLE private.google_drive_connections (
    user_id uuid PRIMARY KEY REFERENCES public.users(id) ON DELETE CASCADE,
    encrypted_access_token text NOT NULL,
    encrypted_refresh_token text NOT NULL,
    access_token_expires_at timestamptz NOT NULL,
    scopes text[] NOT NULL CHECK (
        scopes <@ ARRAY['https://www.googleapis.com/auth/drive.readonly']::text[]
    ),
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE private.google_drive_connections ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON private.google_drive_connections FROM PUBLIC, anon, authenticated, service_role;
GRANT ALL ON private.google_drive_connections TO service_role;

CREATE TRIGGER google_drive_connections_set_updated_at
    BEFORE UPDATE ON private.google_drive_connections
    FOR EACH ROW EXECUTE FUNCTION private.set_updated_at();

COMMIT;
