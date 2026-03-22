
-- Profiles table
CREATE TABLE public.profiles (
  id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  name text,
  email text,
  avatar_url text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own profile" ON public.profiles FOR SELECT TO authenticated USING (auth.uid() = id);
CREATE POLICY "Users can update own profile" ON public.profiles FOR UPDATE TO authenticated USING (auth.uid() = id);
CREATE POLICY "Users can insert own profile" ON public.profiles FOR INSERT TO authenticated WITH CHECK (auth.uid() = id);

-- Auto-create profile on signup
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.profiles (id, name, email)
  VALUES (NEW.id, COALESCE(NEW.raw_user_meta_data->>'name', NEW.raw_user_meta_data->>'full_name', ''), NEW.email);
  RETURN NEW;
END;
$$;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- Vehicles table
CREATE TABLE public.vehicles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  vin text,
  year integer NOT NULL,
  make text NOT NULL,
  model text NOT NULL,
  trim text,
  engine text,
  transmission text,
  drivetrain text,
  body_style text,
  nickname text,
  mileage integer,
  color text,
  purchase_date date,
  license_plate text,
  nhtsa_data jsonb,
  recall_data jsonb,
  last_recall_check timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.vehicles ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can CRUD own vehicles" ON public.vehicles FOR ALL TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

-- Maintenance logs
CREATE TABLE public.maintenance_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  vehicle_id uuid NOT NULL REFERENCES public.vehicles(id) ON DELETE CASCADE,
  service text NOT NULL,
  date date NOT NULL,
  mileage integer,
  cost decimal,
  shop text,
  notes text,
  parts jsonb,
  next_due_date date,
  next_due_mileage integer,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.maintenance_logs ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can CRUD own maintenance logs" ON public.maintenance_logs FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM public.vehicles WHERE vehicles.id = maintenance_logs.vehicle_id AND vehicles.user_id = auth.uid()))
  WITH CHECK (EXISTS (SELECT 1 FROM public.vehicles WHERE vehicles.id = maintenance_logs.vehicle_id AND vehicles.user_id = auth.uid()));

-- Repair logs
CREATE TABLE public.repair_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  vehicle_id uuid NOT NULL REFERENCES public.vehicles(id) ON DELETE CASCADE,
  title text NOT NULL,
  description text,
  date date NOT NULL,
  mileage integer,
  total_cost decimal,
  labor_hours decimal,
  diy_cost decimal,
  shop_quote decimal,
  parts jsonb,
  photo_urls text[],
  notes text,
  difficulty integer,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.repair_logs ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can CRUD own repair logs" ON public.repair_logs FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM public.vehicles WHERE vehicles.id = repair_logs.vehicle_id AND vehicles.user_id = auth.uid()))
  WITH CHECK (EXISTS (SELECT 1 FROM public.vehicles WHERE vehicles.id = repair_logs.vehicle_id AND vehicles.user_id = auth.uid()));

-- Chat sessions
CREATE TABLE public.chat_sessions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  vehicle_id uuid REFERENCES public.vehicles(id) ON DELETE SET NULL,
  title text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.chat_sessions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can CRUD own chat sessions" ON public.chat_sessions FOR ALL TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

-- Chat messages
CREATE TABLE public.chat_messages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id uuid NOT NULL REFERENCES public.chat_sessions(id) ON DELETE CASCADE,
  role text NOT NULL,
  content text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.chat_messages ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can CRUD own chat messages" ON public.chat_messages FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM public.chat_sessions WHERE chat_sessions.id = chat_messages.session_id AND chat_sessions.user_id = auth.uid()))
  WITH CHECK (EXISTS (SELECT 1 FROM public.chat_sessions WHERE chat_sessions.id = chat_messages.session_id AND chat_sessions.user_id = auth.uid()));

-- DTC records
CREATE TABLE public.dtc_records (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  vehicle_id uuid NOT NULL REFERENCES public.vehicles(id) ON DELETE CASCADE,
  code text NOT NULL,
  description text,
  severity text DEFAULT 'low',
  status text NOT NULL DEFAULT 'active',
  read_date timestamptz NOT NULL DEFAULT now(),
  cleared_date timestamptz,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.dtc_records ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can CRUD own dtc records" ON public.dtc_records FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM public.vehicles WHERE vehicles.id = dtc_records.vehicle_id AND vehicles.user_id = auth.uid()))
  WITH CHECK (EXISTS (SELECT 1 FROM public.vehicles WHERE vehicles.id = dtc_records.vehicle_id AND vehicles.user_id = auth.uid()));

-- Storage bucket for repair photos
INSERT INTO storage.buckets (id, name, public) VALUES ('repair-photos', 'repair-photos', true);

CREATE POLICY "Users can upload repair photos" ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'repair-photos' AND (storage.foldername(name))[1] = auth.uid()::text);

CREATE POLICY "Users can view repair photos" ON storage.objects FOR SELECT TO authenticated
  USING (bucket_id = 'repair-photos');

CREATE POLICY "Users can delete own repair photos" ON storage.objects FOR DELETE TO authenticated
  USING (bucket_id = 'repair-photos' AND (storage.foldername(name))[1] = auth.uid()::text);
