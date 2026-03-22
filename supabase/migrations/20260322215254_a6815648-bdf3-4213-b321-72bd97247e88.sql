ALTER TABLE public.chat_sessions 
ADD COLUMN project_id uuid REFERENCES public.projects(id) ON DELETE SET NULL;

CREATE INDEX idx_chat_sessions_project_id ON public.chat_sessions(project_id);