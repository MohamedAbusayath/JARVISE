BEGIN;

ALTER TABLE public.memories
    DROP CONSTRAINT memories_memory_type_check;

UPDATE public.memories
SET memory_type = CASE memory_type
    WHEN 'profile_fact' THEN 'personal_context'
    WHEN 'project_context' THEN 'project'
    WHEN 'conversation_summary' THEN 'important_fact'
    WHEN 'document_knowledge' THEN 'important_fact'
    WHEN 'note' THEN 'important_fact'
    ELSE memory_type
END
WHERE memory_type IN (
    'profile_fact',
    'project_context',
    'conversation_summary',
    'document_knowledge',
    'note'
);

ALTER TABLE public.memories
    ADD CONSTRAINT memories_memory_type_check
    CHECK (memory_type IN (
        'preference',
        'goal',
        'project',
        'learning',
        'personal_context',
        'important_fact',
        'instruction'
    ));

COMMIT;
