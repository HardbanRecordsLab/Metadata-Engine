-- SAFE SQL SETUP (Run this if you get "already exists" errors)

-- 1. Tabela PROFILES (Tworzy tylko jeśli nie istnieje)
CREATE TABLE IF NOT EXISTS public.profiles (
  id UUID REFERENCES auth.users ON DELETE CASCADE PRIMARY KEY,
  email TEXT UNIQUE NOT NULL,
  full_name TEXT,
  tier TEXT DEFAULT 'free',
  credits INTEGER DEFAULT 10,
  test_code_used BOOLEAN DEFAULT false,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- 2. Tabela ANALYSIS_HISTORY (Tworzy tylko jeśli nie istnieje)
CREATE TABLE IF NOT EXISTS public.analysis_history (
  id BIGSERIAL PRIMARY KEY,
  user_id UUID REFERENCES auth.users ON DELETE CASCADE NOT NULL,
  file_name TEXT NOT NULL,
  result JSONB NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- 3. Funkcja RPC do kredytów (OR REPLACE zawsze aktualizuje funkcję)
CREATE OR REPLACE FUNCTION public.decrement_user_credits(user_id_param UUID)
RETURNS INTEGER AS $$
DECLARE
  new_credits INTEGER;
BEGIN
  UPDATE public.profiles
  SET credits = credits - 1
  WHERE id = user_id_param AND credits > 0
  RETURNING credits INTO new_credits;
  
  RETURN new_credits;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 4. Włączenie RLS (Ignoruje błąd jeśli już włączone)
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.analysis_history ENABLE ROW LEVEL SECURITY;

-- 5. Polityki (Używamy DROP/CREATE dla pewności)
DROP POLICY IF EXISTS "Użytkownicy mogą widzieć własne profile" ON public.profiles;
CREATE POLICY "Użytkownicy mogą widzieć własne profile" ON public.profiles FOR SELECT USING (auth.uid() = id);

DROP POLICY IF EXISTS "Użytkownicy mogą aktualizować własne profile" ON public.profiles;
CREATE POLICY "Użytkownicy mogą aktualizować własne profile" ON public.profiles FOR UPDATE USING (auth.uid() = id);

DROP POLICY IF EXISTS "Użytkownicy mogą widzieć własną historię" ON public.analysis_history;
CREATE POLICY "Użytkownicy mogą widzieć własną historię" ON public.analysis_history FOR SELECT USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Użytkownicy mogą dodawać historię do siebie" ON public.analysis_history;
CREATE POLICY "Użytkownicy mogą dodawać historię do siebie" ON public.analysis_history FOR INSERT WITH CHECK (auth.uid() = user_id);

-- 6. Trigger do tworzenia profilu
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.profiles (id, email, full_name, credits)
  VALUES (new.id, new.email, new.raw_user_meta_data->>'full_name', 10)
  ON CONFLICT (id) DO NOTHING;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE PROCEDURE public.handle_new_user();