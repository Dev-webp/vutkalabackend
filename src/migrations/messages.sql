DROP TABLE IF EXISTS application_messages;

CREATE TABLE application_messages (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

    application_id UUID NOT NULL,

    sender_id UUID NOT NULL,

    message TEXT NOT NULL,

    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),

    CONSTRAINT application_messages_application_id_fkey
        FOREIGN KEY (application_id)
        REFERENCES applications(id)
        ON DELETE CASCADE,

    CONSTRAINT application_messages_sender_id_fkey
        FOREIGN KEY (sender_id)
        REFERENCES auth_users(id)
        ON DELETE CASCADE
);

ALTER TABLE application_messages
ALTER COLUMN application_id TYPE UUID
USING application_id::UUID;
