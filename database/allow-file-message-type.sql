-- Allow generic file attachments in chat_messages.message_type

DO $$
DECLARE
  existing_constraint_name TEXT;
BEGIN
  SELECT conname
  INTO existing_constraint_name
  FROM pg_constraint
  WHERE conrelid = 'chat_messages'::regclass
    AND contype = 'c'
    AND pg_get_constraintdef(oid) ILIKE '%message_type%'
  LIMIT 1;

  IF existing_constraint_name IS NOT NULL THEN
    EXECUTE format('ALTER TABLE chat_messages DROP CONSTRAINT %I', existing_constraint_name);
  END IF;
END $$;

ALTER TABLE chat_messages
  ADD CONSTRAINT chat_messages_message_type_check
  CHECK (message_type IN ('text', 'image', 'video', 'file', 'voice', 'mixed'));

COMMENT ON COLUMN chat_messages.message_type IS 'Message type: text, image, video, file, voice, or mixed';
