/*
  # Add webhook_url to analyzed_projects

  1. Modified Tables
    - `analyzed_projects`
      - Added `webhook_url` (text, nullable) - URL where the project's analyzer listens for trigger requests
      - Added `last_trigger_at` (timestamptz, nullable) - Timestamp of last manual trigger

  2. Notes
    - webhook_url is optional; projects without it cannot be triggered manually
    - last_trigger_at tracks cooldown to prevent abuse
*/

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public'
    AND table_name = 'analyzed_projects'
    AND column_name = 'webhook_url'
  ) THEN
    ALTER TABLE public.analyzed_projects ADD COLUMN webhook_url text;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public'
    AND table_name = 'analyzed_projects'
    AND column_name = 'last_trigger_at'
  ) THEN
    ALTER TABLE public.analyzed_projects ADD COLUMN last_trigger_at timestamptz;
  END IF;
END $$;
