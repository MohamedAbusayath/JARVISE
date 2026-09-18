BEGIN;

CREATE TABLE public.tasks (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id uuid NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
    title text NOT NULL CHECK (length(btrim(title)) BETWEEN 1 AND 300),
    description text CHECK (description IS NULL OR length(description) <= 10000),
    status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'completed')),
    priority text NOT NULL DEFAULT 'MEDIUM' CHECK (priority IN ('LOW', 'MEDIUM', 'HIGH')),
    due_at timestamptz,
    completed_at timestamptz,
    deleted_at timestamptz,
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now(),
    CONSTRAINT tasks_owner_id_key UNIQUE (user_id, id),
    CONSTRAINT tasks_completed_consistency CHECK (
        (status = 'completed' AND completed_at IS NOT NULL)
        OR (status = 'pending' AND completed_at IS NULL)
    )
);

CREATE TRIGGER tasks_set_updated_at
    BEFORE UPDATE ON public.tasks
    FOR EACH ROW EXECUTE FUNCTION private.set_updated_at();

CREATE INDEX tasks_owner_status_idx
    ON public.tasks (user_id, status, updated_at DESC, id);
CREATE INDEX tasks_owner_due_idx
    ON public.tasks (user_id, due_at)
    WHERE due_at IS NOT NULL AND deleted_at IS NULL;
CREATE INDEX tasks_owner_priority_idx
    ON public.tasks (user_id, priority, updated_at DESC);

ALTER TABLE public.tasks ENABLE ROW LEVEL SECURITY;

CREATE POLICY tasks_own_data ON public.tasks
    FOR ALL TO authenticated
    USING (user_id = (SELECT auth.uid()))
    WITH CHECK (user_id = (SELECT auth.uid()));

GRANT SELECT, INSERT, UPDATE, DELETE ON public.tasks TO authenticated;
GRANT ALL ON public.tasks TO service_role;

ALTER TABLE private.audit_events
    DROP CONSTRAINT IF EXISTS audit_events_resource_type_check;

ALTER TABLE private.audit_events
    ADD CONSTRAINT audit_events_resource_type_check CHECK (
        resource_type IN (
            'user', 'profile', 'preferences', 'conversation', 'message',
            'memory', 'embedding', 'tool', 'task', 'session'
        )
    );

COMMIT;
