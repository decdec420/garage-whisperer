
-- Add status column to maintenance_logs
ALTER TABLE public.maintenance_logs 
ADD COLUMN IF NOT EXISTS status text NOT NULL DEFAULT 'logged';

-- Update existing sentinel records from catch-up wizard to needs_attention
UPDATE public.maintenance_logs 
SET status = 'needs_attention' 
WHERE date = '2000-01-01' AND notes LIKE '%Never done%';

-- Update records with future next_due_date to 'scheduled'
UPDATE public.maintenance_logs
SET status = 'scheduled'
WHERE next_due_date IS NOT NULL AND next_due_date > CURRENT_DATE AND date != '2000-01-01';

-- Mark completed records (past date, not sentinel)
UPDATE public.maintenance_logs
SET status = 'completed'
WHERE date != '2000-01-01' AND (next_due_date IS NULL OR next_due_date <= CURRENT_DATE);
