BEGIN;

CREATE TABLE public.drive_documents (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id uuid NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
    drive_file_id text NOT NULL,
    filename text NOT NULL CHECK (length(btrim(filename)) BETWEEN 1 AND 1024),
    mime_type text NOT NULL CHECK (length(btrim(mime_type)) BETWEEN 1 AND 255),
    drive_modified_at timestamptz,
    content_hash text NOT NULL CHECK (content_hash ~ '^[a-f0-9]{64}$'),
    status text NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'deleted', 'unsupported', 'failed')),
    metadata jsonb NOT NULL DEFAULT '{}' CHECK (jsonb_typeof(metadata) = 'object' AND octet_length(metadata::text) <= 16384),
    last_ingested_at timestamptz,
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now(),
    CONSTRAINT drive_documents_user_file_key UNIQUE (user_id, drive_file_id)
);

CREATE TABLE public.drive_document_chunks (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id uuid NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
    document_id uuid NOT NULL REFERENCES public.drive_documents(id) ON DELETE CASCADE,
    chunk_index integer NOT NULL CHECK (chunk_index >= 0),
    content text NOT NULL CHECK (length(btrim(content)) BETWEEN 1 AND 12000),
    content_hash text NOT NULL CHECK (content_hash ~ '^[a-f0-9]{64}$'),
    embedding_provider text NOT NULL CHECK (length(btrim(embedding_provider)) BETWEEN 1 AND 120),
    embedding_model text NOT NULL CHECK (length(btrim(embedding_model)) BETWEEN 1 AND 200),
    embedding_dimensions integer NOT NULL CHECK (embedding_dimensions > 0),
    -- text-embedding-004 returns 768 dimensions.
    embedding vector(768) NOT NULL,
    metadata jsonb NOT NULL DEFAULT '{}' CHECK (jsonb_typeof(metadata) = 'object' AND octet_length(metadata::text) <= 16384),
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now(),
    CONSTRAINT drive_chunks_user_document_fk FOREIGN KEY (user_id, document_id)
        REFERENCES public.drive_documents(user_id, id) ON DELETE CASCADE,
    CONSTRAINT drive_chunks_document_index_key UNIQUE (document_id, chunk_index),
    CONSTRAINT drive_chunks_embedding_key UNIQUE (document_id, chunk_index, embedding_model)
);

CREATE INDEX drive_documents_user_status_idx ON public.drive_documents (user_id, status, updated_at DESC);
CREATE INDEX drive_documents_file_idx ON public.drive_documents (drive_file_id);
CREATE INDEX drive_chunks_user_document_idx ON public.drive_document_chunks (user_id, document_id, chunk_index);
CREATE INDEX drive_chunks_vector_idx ON public.drive_document_chunks USING hnsw (embedding vector_cosine_ops);

ALTER TABLE public.drive_documents ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.drive_document_chunks ENABLE ROW LEVEL SECURITY;

CREATE POLICY drive_documents_own_data ON public.drive_documents
    FOR ALL TO authenticated
    USING (user_id = (SELECT auth.uid()))
    WITH CHECK (user_id = (SELECT auth.uid()));

CREATE POLICY drive_chunks_own_data ON public.drive_document_chunks
    FOR ALL TO authenticated
    USING (user_id = (SELECT auth.uid()))
    WITH CHECK (user_id = (SELECT auth.uid()));

REVOKE ALL ON public.drive_documents, public.drive_document_chunks
    FROM PUBLIC, anon, authenticated, service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.drive_documents, public.drive_document_chunks
    TO authenticated, service_role;

CREATE TRIGGER drive_documents_set_updated_at
    BEFORE UPDATE ON public.drive_documents
    FOR EACH ROW EXECUTE FUNCTION private.set_updated_at();

CREATE TRIGGER drive_chunks_set_updated_at
    BEFORE UPDATE ON public.drive_document_chunks
    FOR EACH ROW EXECUTE FUNCTION private.set_updated_at();

DO $$
DECLARE
    vector_schema text;
BEGIN
    SELECT n.nspname INTO vector_schema
    FROM pg_extension e
    JOIN pg_namespace n ON n.oid = e.extnamespace
    WHERE e.extname = 'vector';

    EXECUTE format($ddl$
        CREATE OR REPLACE FUNCTION public.match_drive_chunks(
            query_embedding %1$I.vector,
            match_threshold real,
            match_count integer,
            requesting_user_id uuid
        )
        RETURNS TABLE (
            id uuid,
            document_id uuid,
            drive_file_id text,
            filename text,
            mime_type text,
            content text,
            similarity real,
            metadata jsonb
        )
        LANGUAGE sql
        STABLE
        SET search_path = public, %1$I, pg_catalog
        AS $function$
            SELECT
                c.id,
                c.document_id,
                d.drive_file_id,
                d.filename,
                d.mime_type,
                c.content,
                (1 - (c.embedding <=> query_embedding))::real AS similarity,
                c.metadata
            FROM public.drive_document_chunks c
            JOIN public.drive_documents d ON d.id = c.document_id
            WHERE c.user_id = requesting_user_id
              AND d.user_id = requesting_user_id
              AND requesting_user_id = (SELECT auth.uid())
              AND d.status = 'active'
              AND 1 - (c.embedding <=> query_embedding) >= match_threshold
            ORDER BY c.embedding <=> query_embedding
            LIMIT LEAST(match_count, 20);
        $function$;
    $ddl$, vector_schema);
END;
$$;

COMMIT;
