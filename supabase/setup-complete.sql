-- ============================================================
-- SCRIPT COMPLETO DE CONFIGURAÇÃO - DOSECERTA ERP
-- Execute este script INTEIRO no SQL Editor do Supabase
-- ============================================================

-- ============================================================
-- 1. VERIFICAR E CRIAR TABELAS NECESSÁRIAS
-- ============================================================

-- Tabela de usuários
CREATE TABLE IF NOT EXISTS public.users (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email TEXT UNIQUE NOT NULL,
  name TEXT NOT NULL,
  role TEXT NOT NULL CHECK (role IN ('admin', 'operator')) DEFAULT 'operator',
  is_active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  last_login TIMESTAMP WITH TIME ZONE
);

-- Tabela de auditoria
CREATE TABLE IF NOT EXISTS public.audit_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES public.users(id) ON DELETE SET NULL,
  user_email TEXT NOT NULL,
  action TEXT NOT NULL CHECK (action IN ('CREATE', 'UPDATE', 'DELETE', 'LOGIN', 'LOGOUT')),
  entity_type TEXT NOT NULL,
  entity_id TEXT,
  old_data JSONB,
  new_data JSONB,
  ip_address TEXT,
  user_agent TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Tabela de pacientes
CREATE TABLE IF NOT EXISTS public.pacientes (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  phone TEXT DEFAULT '',
  cpf TEXT,
  data_nascimento TEXT,
  contato_emergencia TEXT,
  profissao TEXT,
  ficha_tecnica_id TEXT,
  product_id TEXT NOT NULL DEFAULT '',
  frequency_days INTEGER NOT NULL DEFAULT 7,
  last_application TEXT NOT NULL,
  notes TEXT DEFAULT '',
  active BOOLEAN NOT NULL DEFAULT TRUE,
  since TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ============================================================
-- 2. CRIAR ÍNDICES
-- ============================================================

CREATE INDEX IF NOT EXISTS idx_audit_logs_user_id ON public.audit_logs(user_id);
CREATE INDEX IF NOT EXISTS idx_audit_logs_entity ON public.audit_logs(entity_type, entity_id);
CREATE INDEX IF NOT EXISTS idx_audit_logs_created_at ON public.audit_logs(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_pacientes_name ON public.pacientes (name);
CREATE INDEX IF NOT EXISTS idx_pacientes_since ON public.pacientes (since);

-- ============================================================
-- 3. CRIAR TRIGGER PARA ATUALIZAR updated_at
-- ============================================================

CREATE OR REPLACE FUNCTION public.set_pacientes_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_pacientes_updated_at ON public.pacientes;
CREATE TRIGGER trg_pacientes_updated_at
  BEFORE UPDATE ON public.pacientes
  FOR EACH ROW EXECUTE FUNCTION public.set_pacientes_updated_at();

-- ============================================================
-- 4. CONFIGURAR ROW LEVEL SECURITY (RLS)
-- ============================================================

-- Habilitar RLS na tabela pacientes
ALTER TABLE public.pacientes ENABLE ROW LEVEL SECURITY;

-- Políticas para usuários autenticados
DROP POLICY IF EXISTS "pacientes_select_authenticated" ON public.pacientes;
CREATE POLICY "pacientes_select_authenticated"
  ON public.pacientes FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS "pacientes_insert_authenticated" ON public.pacientes;
CREATE POLICY "pacientes_insert_authenticated"
  ON public.pacientes FOR INSERT TO authenticated WITH CHECK (true);

DROP POLICY IF EXISTS "pacientes_update_authenticated" ON public.pacientes;
CREATE POLICY "pacientes_update_authenticated"
  ON public.pacientes FOR UPDATE TO authenticated USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "pacientes_delete_authenticated" ON public.pacientes;
CREATE POLICY "pacientes_delete_authenticated"
  ON public.pacientes FOR DELETE TO authenticated USING (true);

-- Habilitar RLS na tabela users
ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "users_select_authenticated" ON public.users;
CREATE POLICY "users_select_authenticated"
  ON public.users FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS "users_insert_authenticated" ON public.users;
CREATE POLICY "users_insert_authenticated"
  ON public.users FOR INSERT TO authenticated WITH CHECK (true);

DROP POLICY IF EXISTS "users_update_authenticated" ON public.users;
CREATE POLICY "users_update_authenticated"
  ON public.users FOR UPDATE TO authenticated USING (true) WITH CHECK (true);

-- Habilitar RLS na tabela audit_logs
ALTER TABLE public.audit_logs ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "audit_logs_select_authenticated" ON public.audit_logs;
CREATE POLICY "audit_logs_select_authenticated"
  ON public.audit_logs FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS "audit_logs_insert_authenticated" ON public.audit_logs;
CREATE POLICY "audit_logs_insert_authenticated"
  ON public.audit_logs FOR INSERT TO authenticated WITH CHECK (true);

-- ============================================================
-- 5. CRIAR FUNÇÃO PARA DEFINIR PRIMEIRO ADMIN
-- ============================================================

CREATE OR REPLACE FUNCTION public.set_first_admin(user_email TEXT)
RETURNS TEXT AS $$
DECLARE
  user_id UUID;
  result TEXT;
BEGIN
  -- Busca o ID do usuário no auth.users
  SELECT id INTO user_id FROM auth.users WHERE email = user_email;
  
  IF user_id IS NULL THEN
    RAISE EXCEPTION 'Usuário "%" não encontrado no Authentication. Crie o usuário primeiro em Authentication > Users > Add User', user_email;
  END IF;
  
  -- Insere ou atualiza na tabela public.users
  INSERT INTO public.users (id, email, name, role, is_active, created_at, updated_at)
  VALUES (user_id, user_email, 'Administrador Master', 'admin', true, NOW(), NOW())
  ON CONFLICT (id) DO UPDATE 
  SET role = 'admin', 
      is_active = true,
      updated_at = NOW();
  
  result := '✅ Admin configurado com sucesso! Email: ' || user_email;
  RETURN result;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================================
-- 6. VERIFICAÇÃO FINAL
-- ============================================================

-- Mostra status das tabelas
SELECT 
  '✅ Configuração concluída!' as status,
  'Agora execute: SELECT set_first_admin(''SEU_EMAIL_AQUI'')' as proximo_passo;

-- ============================================================
-- INSTRUÇÕES:
-- ============================================================
-- 1. Execute este script INTEIRO no SQL Editor
-- 2. Vá em Authentication > Users > Add User
-- 3. Crie um usuário com email e senha (marque "Auto Confirm User")
-- 4. Copie o email criado
-- 5. Execute: SELECT set_first_admin('email@exemplo.com');
-- 6. Faça login no aplicativo com esse email e senha
-- ============================================================
