-- PostgreSQL 15+ / Supabase. Run as the migration owner.
-- REQUIRED before deployment: configure jarvis.embedding_dimensions on the database
-- (or this session). No embedding model or output dimension is silently selected.
BEGIN;

CREATE SCHEMA IF NOT EXISTS extensions;
CREATE EXTENSION IF NOT EXISTS vector WITH SCHEMA extensions;
CREATE SCHEMA IF NOT EXISTS private;
REVOKE ALL ON SCHEMA private FROM PUBLIC, anon, authenticated;

-- Resolve vector through the extension's actual namespace (existing Supabase installs
-- may have installed it outside extensions).
DO $$
DECLARE
    dimensions integer;
    vector_schema text;
BEGIN
    dimensions := nullif(current_setting('jarvis.embedding_dimensions', true), '')::integer;
    IF dimensions IS NULL OR dimensions NOT BETWEEN 1 AND 2000 THEN
        RAISE EXCEPTION 'Set jarvis.embedding_dimensions to the selected model output dimension (1..2000 for vector HNSW) before migrating';
    END IF;
    SELECT n.nspname INTO vector_schema FROM pg_extension e
    JOIN pg_namespace n ON n.oid = e.extnamespace WHERE e.extname = 'vector';
    PERFORM set_config('search_path', format('public, %I, pg_catalog', vector_schema), true);
END;
$$;

CREATE TABLE public.users (
    id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    status text NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'suspended', 'pending_deletion')),
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE OR REPLACE FUNCTION private.handle_new_auth_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_catalog
AS $$
BEGIN
    INSERT INTO public.users (id)
    VALUES (NEW.id)
    ON CONFLICT (id) DO NOTHING;
    RETURN NEW;
END;
$$;

CREATE TRIGGER on_auth_user_created
    AFTER INSERT ON auth.users
    FOR EACH ROW EXECUTE FUNCTION private.handle_new_auth_user();

CREATE TABLE public.user_profiles (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id uuid NOT NULL UNIQUE REFERENCES public.users(id) ON DELETE CASCADE,
    display_name text CHECK (display_name IS NULL OR length(btrim(display_name)) BETWEEN 1 AND 120),
    avatar_storage_path text CHECK (avatar_storage_path IS NULL OR
        (length(btrim(avatar_storage_path)) BETWEEN 1 AND 1024 AND avatar_storage_path !~* '^https?://')),
    bio text CHECK (bio IS NULL OR length(bio) <= 2000),
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE public.conversations (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id uuid NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
    title text CHECK (title IS NULL OR length(btrim(title)) BETWEEN 1 AND 300),
    status text NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'archived')),
    default_provider text CHECK (default_provider IS NULL OR length(btrim(default_provider)) BETWEEN 1 AND 120),
    default_model text CHECK (default_model IS NULL OR length(btrim(default_model)) BETWEEN 1 AND 200),
    metadata jsonb NOT NULL DEFAULT '{}' CHECK (jsonb_typeof(metadata) = 'object' AND octet_length(metadata::text) <= 16384),
    last_message_at timestamptz,
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now(),
    CONSTRAINT conversations_owner_id_key UNIQUE (user_id, id),
    CHECK (default_model IS NULL OR default_provider IS NOT NULL)
);

CREATE TABLE public.messages (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id uuid NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
    conversation_id uuid NOT NULL,
    sequence_no bigint NOT NULL CHECK (sequence_no > 0),
    role text NOT NULL CHECK (role IN ('system', 'user', 'assistant', 'tool')),
    status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'streaming', 'completed', 'failed', 'cancelled')),
    content_text text,
    content_parts jsonb NOT NULL DEFAULT '[]' CHECK (jsonb_typeof(content_parts) = 'array' AND octet_length(content_parts::text) <= 1048576),
    provider text CHECK (provider IS NULL OR length(btrim(provider)) BETWEEN 1 AND 120),
    model_name text CHECK (model_name IS NULL OR length(btrim(model_name)) BETWEEN 1 AND 200),
    provider_response_id text CHECK (provider_response_id IS NULL OR length(btrim(provider_response_id)) BETWEEN 1 AND 512),
    input_tokens bigint CHECK (input_tokens >= 0),
    output_tokens bigint CHECK (output_tokens >= 0),
    total_tokens bigint CHECK (total_tokens >= 0),
    usage_details jsonb NOT NULL DEFAULT '{}' CHECK (jsonb_typeof(usage_details) = 'object' AND octet_length(usage_details::text) <= 16384),
    reply_to_message_id uuid,
    tool_call_id text CHECK (tool_call_id IS NULL OR length(btrim(tool_call_id)) BETWEEN 1 AND 512),
    client_request_id uuid,
    metadata jsonb NOT NULL DEFAULT '{}' CHECK (jsonb_typeof(metadata) = 'object' AND octet_length(metadata::text) <= 16384),
    completed_at timestamptz,
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now(),
    CONSTRAINT messages_conversation_fk FOREIGN KEY (user_id, conversation_id)
        REFERENCES public.conversations(user_id, id) ON DELETE CASCADE,
    CONSTRAINT messages_sequence_key UNIQUE (conversation_id, sequence_no),
    CONSTRAINT messages_owner_conversation_id_key UNIQUE (user_id, conversation_id, id),
    CONSTRAINT messages_reply_fk FOREIGN KEY (user_id, conversation_id, reply_to_message_id)
        REFERENCES public.messages(user_id, conversation_id, id) ON SET NULL (reply_to_message_id),
    CHECK (reply_to_message_id IS NULL OR reply_to_message_id <> id),
    CHECK (role <> 'tool' OR tool_call_id IS NOT NULL),
    CHECK (model_name IS NULL OR provider IS NOT NULL),
    CHECK (status <> 'completed' OR coalesce(length(btrim(content_text)), 0) > 0 OR jsonb_array_length(content_parts) > 0),
    CHECK (completed_at IS NULL OR completed_at >= created_at)
);

CREATE TABLE public.memories (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id uuid NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
    memory_type text NOT NULL CHECK (memory_type IN ('profile_fact', 'preference', 'project_context', 'conversation_summary', 'document_knowledge', 'note')),
    importance smallint NOT NULL DEFAULT 50 CHECK (importance BETWEEN 0 AND 100),
    source text NOT NULL CHECK (source IN ('user', 'conversation', 'document', 'tool', 'import')),
    content text NOT NULL CHECK (length(btrim(content)) BETWEEN 1 AND 65536),
    metadata jsonb NOT NULL DEFAULT '{}' CHECK (jsonb_typeof(metadata) = 'object' AND octet_length(metadata::text) <= 16384),
    source_conversation_id uuid,
    source_message_id uuid,
    source_reference text CHECK (source_reference IS NULL OR
        (length(btrim(source_reference)) BETWEEN 1 AND 1024 AND source_reference !~* '^https?://')),
    content_revision integer NOT NULL DEFAULT 1 CHECK (content_revision > 0),
    expires_at timestamptz,
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now(),
    CONSTRAINT memories_owner_id_key UNIQUE (user_id, id),
    CONSTRAINT memories_source_conversation_fk FOREIGN KEY (user_id, source_conversation_id)
        REFERENCES public.conversations(user_id, id) ON DELETE SET NULL (source_conversation_id, source_message_id),
    CONSTRAINT memories_source_message_fk FOREIGN KEY (user_id, source_conversation_id, source_message_id)
        REFERENCES public.messages(user_id, conversation_id, id) ON DELETE SET NULL (source_message_id),
    CHECK (source_message_id IS NULL OR source_conversation_id IS NOT NULL),
    CHECK (expires_at IS NULL OR expires_at > created_at)
);

-- Fixed vector(D), with D supplied by the deployment, not a provider assumption.
DO $$
DECLARE dimensions integer := current_setting('jarvis.embedding_dimensions')::integer;
BEGIN
    EXECUTE format($ddl$
        CREATE TABLE public.memory_embeddings (
            id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
            user_id uuid NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
            memory_id uuid NOT NULL,
            content_revision integer NOT NULL CHECK (content_revision > 0),
            embedding_provider text NOT NULL CHECK (length(btrim(embedding_provider)) BETWEEN 1 AND 120),
            embedding_model text NOT NULL CHECK (length(btrim(embedding_model)) BETWEEN 1 AND 200),
            embedding_dimensions integer NOT NULL CHECK (embedding_dimensions = %1$s),
            embedding vector(%1$s) NOT NULL,
            created_at timestamptz NOT NULL DEFAULT now(),
            updated_at timestamptz NOT NULL DEFAULT now(),
            CONSTRAINT memory_embeddings_owner_memory_fk FOREIGN KEY (user_id, memory_id)
                REFERENCES public.memories(user_id, id) ON DELETE CASCADE,
            CONSTRAINT memory_embeddings_model_key UNIQUE (memory_id, embedding_provider, embedding_model),
            CHECK (vector_norm(embedding) > 0)
        )
    $ddl$, dimensions);
END;
$$;

CREATE TABLE public.user_preferences (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id uuid NOT NULL UNIQUE REFERENCES public.users(id) ON DELETE CASCADE,
    locale text NOT NULL DEFAULT 'en' CHECK (locale ~ '^[A-Za-z]{2,8}(-[A-Za-z0-9]{1,8})*$' AND length(locale) <= 64),
    timezone text NOT NULL DEFAULT 'UTC' CHECK (length(timezone) BETWEEN 1 AND 100),
    response_style text NOT NULL DEFAULT 'balanced' CHECK (response_style IN ('concise', 'balanced', 'detailed')),
    preferred_provider text CHECK (preferred_provider IS NULL OR length(btrim(preferred_provider)) BETWEEN 1 AND 120),
    preferred_model text CHECK (preferred_model IS NULL OR length(btrim(preferred_model)) BETWEEN 1 AND 200),
    voice_enabled boolean NOT NULL DEFAULT false,
    voice_id text CHECK (voice_id IS NULL OR length(btrim(voice_id)) BETWEEN 1 AND 200),
    memory_enabled boolean NOT NULL DEFAULT false,
    auto_memory_enabled boolean NOT NULL DEFAULT false,
    retain_audio boolean NOT NULL DEFAULT false,
    additional_settings jsonb NOT NULL DEFAULT '{}' CHECK (additional_settings = '{}'::jsonb),
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now(),
    CHECK (NOT auto_memory_enabled OR memory_enabled),
    CHECK (preferred_model IS NULL OR preferred_provider IS NOT NULL)
);

CREATE TABLE private.audit_events (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id uuid REFERENCES public.users(id) ON DELETE SET NULL,
    actor_kind text NOT NULL CHECK (actor_kind IN ('user', 'system', 'anonymous')),
    event_type text NOT NULL CHECK (event_type IN (
        'auth.login', 'auth.logout', 'auth.failure', 'access.denied',
        'account.created', 'account.status_changed', 'account.deletion_requested', 'account.deleted',
        'profile.updated', 'preferences.updated', 'conversation.created', 'conversation.deleted',
        'memory.created', 'memory.updated', 'memory.deleted', 'memory.retrieved',
        'embedding.generated', 'tool.requested', 'tool.completed', 'tool.denied', 'security.alert'
    )),
    outcome text NOT NULL CHECK (outcome IN ('success', 'failure', 'denied')),
    severity text NOT NULL DEFAULT 'info' CHECK (severity IN ('info', 'warning', 'critical')),
    resource_type text CHECK (resource_type IN ('user', 'profile', 'preferences', 'conversation', 'message', 'memory', 'embedding', 'tool', 'session')),
    resource_id uuid,
    request_id uuid,
    details jsonb NOT NULL DEFAULT '{}' CHECK (jsonb_typeof(details) = 'object' AND octet_length(details::text) <= 8192),
    occurred_at timestamptz NOT NULL DEFAULT now(),
    created_at timestamptz NOT NULL DEFAULT now()
);

CREATE OR REPLACE FUNCTION private.set_updated_at()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = pg_catalog
AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$;

CREATE TRIGGER users_set_updated_at
    BEFORE UPDATE ON public.users
    FOR EACH ROW EXECUTE FUNCTION private.set_updated_at();

CREATE TRIGGER user_profiles_set_updated_at
    BEFORE UPDATE ON public.user_profiles
    FOR EACH ROW EXECUTE FUNCTION private.set_updated_at();

CREATE TRIGGER conversations_set_updated_at
    BEFORE UPDATE ON public.conversations
    FOR EACH ROW EXECUTE FUNCTION private.set_updated_at();

CREATE TRIGGER messages_set_updated_at
    BEFORE UPDATE ON public.messages
    FOR EACH ROW EXECUTE FUNCTION private.set_updated_at();

CREATE TRIGGER memories_set_updated_at
    BEFORE UPDATE ON public.memories
    FOR EACH ROW EXECUTE FUNCTION private.set_updated_at();

CREATE TRIGGER memory_embeddings_set_updated_at
    BEFORE UPDATE ON public.memory_embeddings
    FOR EACH ROW EXECUTE FUNCTION private.set_updated_at();

CREATE TRIGGER user_preferences_set_updated_at
    BEFORE UPDATE ON public.user_preferences
    FOR EACH ROW EXECUTE FUNCTION private.set_updated_at();

CREATE INDEX conversations_owner_recent_idx ON public.conversations (user_id, status, last_message_at DESC NULLS LAST, id);
CREATE UNIQUE INDEX messages_client_request_idx ON public.messages (user_id, conversation_id, client_request_id) WHERE client_request_id IS NOT NULL;
CREATE INDEX messages_reply_idx ON public.messages (user_id, conversation_id, reply_to_message_id) WHERE reply_to_message_id IS NOT NULL;
CREATE INDEX memories_owner_type_updated_idx ON public.memories (user_id, memory_type, updated_at DESC, id);
CREATE INDEX memories_owner_importance_idx ON public.memories (user_id, importance DESC, id);
CREATE INDEX memories_expiration_idx ON public.memories (user_id, expires_at) WHERE expires_at IS NOT NULL;
CREATE INDEX memories_source_conversation_idx ON public.memories (user_id, source_conversation_id) WHERE source_conversation_id IS NOT NULL;
CREATE INDEX memories_source_message_idx ON public.memories (user_id, source_conversation_id, source_message_id) WHERE source_message_id IS NOT NULL;
CREATE INDEX memory_embeddings_owner_memory_idx ON public.memory_embeddings (user_id, memory_id);
CREATE INDEX memory_embeddings_cosine_idx ON public.memory_embeddings USING hnsw (embedding vector_cosine_ops);
CREATE INDEX audit_events_owner_time_idx ON private.audit_events (user_id, occurred_at DESC, id);
CREATE INDEX audit_events_type_time_idx ON private.audit_events (event_type, occurred_at DESC);
CREATE INDEX audit_events_request_idx ON private.audit_events (request_id) WHERE request_id IS NOT NULL;
CREATE INDEX audit_events_retention_idx ON private.audit_events (created_at);

-- Enable immediately; no exposed table is ever committed without RLS.
ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.conversations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.memories ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.memory_embeddings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_preferences ENABLE ROW LEVEL SECURITY;
ALTER TABLE private.audit_events ENABLE ROW LEVEL SECURITY;

CREATE POLICY users_own_data ON public.users
    FOR ALL TO authenticated
    USING (id = (SELECT auth.uid()))
    WITH CHECK (id = (SELECT auth.uid()));

CREATE POLICY user_profiles_own_data ON public.user_profiles
    FOR ALL TO authenticated
    USING (user_id = (SELECT auth.uid()))
    WITH CHECK (user_id = (SELECT auth.uid()));

CREATE POLICY conversations_own_data ON public.conversations
    FOR ALL TO authenticated
    USING (user_id = (SELECT auth.uid()))
    WITH CHECK (user_id = (SELECT auth.uid()));

CREATE POLICY messages_own_data ON public.messages
    FOR ALL TO authenticated
    USING (user_id = (SELECT auth.uid()))
    WITH CHECK (user_id = (SELECT auth.uid()));

CREATE POLICY memories_own_data ON public.memories
    FOR ALL TO authenticated
    USING (user_id = (SELECT auth.uid()))
    WITH CHECK (user_id = (SELECT auth.uid()));

CREATE POLICY memory_embeddings_own_data ON public.memory_embeddings
    FOR ALL TO authenticated
    USING (user_id = (SELECT auth.uid()))
    WITH CHECK (user_id = (SELECT auth.uid()));

CREATE POLICY user_preferences_own_data ON public.user_preferences
    FOR ALL TO authenticated
    USING (user_id = (SELECT auth.uid()))
    WITH CHECK (user_id = (SELECT auth.uid()));

-- Audit events are written and read by trusted backend code only.
-- No authenticated or anonymous policy is intentional.
REVOKE ALL ON public.users, public.user_profiles, public.conversations, public.messages,
    public.memories, public.memory_embeddings, public.user_preferences, private.audit_events
    FROM PUBLIC, anon, authenticated, service_role;

GRANT USAGE ON SCHEMA public TO authenticated, service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.users, public.user_profiles,
    public.conversations, public.messages, public.memories, public.memory_embeddings,
    public.user_preferences TO authenticated;
GRANT USAGE ON SCHEMA private TO service_role;
GRANT ALL ON private.audit_events TO service_role;
GRANT ALL ON public.users, public.user_profiles, public.conversations, public.messages,
    public.memories, public.memory_embeddings, public.user_preferences TO service_role;

COMMIT;
