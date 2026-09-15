BEGIN;

DO $$
DECLARE
    vector_schema text;
BEGIN
    SELECT n.nspname INTO vector_schema
    FROM pg_extension e
    JOIN pg_namespace n ON n.oid = e.extnamespace
    WHERE e.extname = 'vector';

    EXECUTE format($ddl$
        CREATE OR REPLACE FUNCTION public.match_memories(
            query_embedding %1$I.vector,
            match_threshold real,
            match_count integer,
            requesting_user_id uuid
        )
        RETURNS TABLE (
            id uuid,
            memory_id uuid,
            content text,
            memory_type text,
            importance smallint,
            similarity real,
            expires_at timestamptz
        )
        LANGUAGE sql
        STABLE
        SET search_path = public, %1$I, pg_catalog
        AS $function$
            SELECT
                me.id,
                me.memory_id,
                m.content,
                m.memory_type,
                m.importance,
                (1 - (me.embedding <=> query_embedding))::real AS similarity,
                m.expires_at
            FROM public.memory_embeddings AS me
            JOIN public.memories AS m
                ON m.id = me.memory_id
               AND m.user_id = me.user_id
            WHERE me.user_id = requesting_user_id
              AND requesting_user_id = (SELECT auth.uid())
              AND (m.expires_at IS NULL OR m.expires_at > now())
              AND m.content !~* '(password|passcode|api[[:space:]_-]?key|access[[:space:]_-]?token|refresh[[:space:]_-]?token|otp|cvv|card[[:space:]]+number|private[[:space:]]+key|secret)'
              AND 1 - (me.embedding <=> query_embedding) >= match_threshold
            ORDER BY me.embedding <=> query_embedding
            LIMIT LEAST(match_count, 20);
        $function$;
    $ddl$, vector_schema);

    EXECUTE format(
        'REVOKE ALL ON FUNCTION public.match_memories(%I.vector, real, integer, uuid) FROM PUBLIC, anon, authenticated',
        vector_schema
    );
    EXECUTE format(
        'GRANT EXECUTE ON FUNCTION public.match_memories(%I.vector, real, integer, uuid) TO authenticated',
        vector_schema
    );
END;
$$;

COMMIT;
