-- ============================================================
-- SCHEMA CORPORATIVO - DoseCerta ERP
-- Sistema de controle financeiro com autenticação restrita
-- ============================================================

-- ============================================================
-- 1. TABELA DE USUÁRIOS COM ROLES
-- ============================================================
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

-- ============================================================
-- 2. TABELA DE AUDITORIA (AUDIT TRAIL)
-- ============================================================
CREATE TABLE IF NOT EXISTS public.audit_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES public.users(id) ON DELETE SET NULL,
  user_email TEXT NOT NULL,
  action TEXT NOT NULL CHECK (action IN ('CREATE', 'UPDATE', 'DELETE', 'LOGIN', 'LOGOUT')),
  entity_type TEXT NOT NULL, -- 'patient', 'transaction', 'product', 'user', etc.
  entity_id TEXT,
  old_data JSONB,
  new_data JSONB,
  ip_address TEXT,
  user_agent TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Índice para consultas rápidas de auditoria
CREATE INDEX IF NOT EXISTS idx_audit_logs_user_id ON public.audit_logs(user_id);
CREATE INDEX IF NOT EXISTS idx_audit_logs_entity ON public.audit_logs(entity_type, entity_id);
CREATE INDEX IF NOT EXISTS idx_audit_logs_created_at ON public.audit_logs(created_at DESC);

-- ============================================================
-- 3. TABELAS DO SISTEMA (adaptadas do schema anterior)
-- ============================================================

-- Clientes/Pacientes
CREATE TABLE IF NOT EXISTS public.clients (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES public.users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  phone TEXT,
  cpf TEXT UNIQUE,
  data_nascimento DATE,
  contato_emergencia TEXT,
  profissao TEXT,
  ficha_tecnica_id TEXT,
  product_id TEXT,
  frequency_days INTEGER DEFAULT 7,
  last_application DATE,
  notes TEXT,
  is_active BOOLEAN DEFAULT TRUE,
  since DATE DEFAULT CURRENT_DATE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Produtos
CREATE TABLE IF NOT EXISTS public.products (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES public.users(id) ON DELETE CASCADE,
  sku TEXT NOT NULL,
  name TEXT NOT NULL,
  unit TEXT DEFAULT 'un',
  category TEXT DEFAULT 'Geral',
  min_stock NUMERIC(10,2) DEFAULT 0,
  max_stock NUMERIC(10,2) DEFAULT 0,
  current_stock NUMERIC(10,2) DEFAULT 0,
  average_price NUMERIC(12,4) DEFAULT 0,
  last_purchase DATE,
  type TEXT CHECK (type IN ('FARMACO', 'INSUMO', 'SERVICO')) DEFAULT 'INSUMO',
  lead_time_days INTEGER DEFAULT 7,
  safety_stock NUMERIC(10,2) DEFAULT 0,
  reconstitution_days INTEGER,
  refrigerated BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Transações Financeiras
CREATE TABLE IF NOT EXISTS public.transactions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES public.users(id) ON DELETE CASCADE,
  type TEXT NOT NULL CHECK (type IN ('receita', 'despesa')),
  description TEXT NOT NULL,
  category TEXT NOT NULL,
  amount NUMERIC(12,2) NOT NULL,
  date DATE NOT NULL,
  method TEXT CHECK (method IN ('pix', 'cartao', 'dinheiro', 'boleto')) DEFAULT 'pix',
  client_id UUID REFERENCES public.clients(id) ON DELETE SET NULL,
  product_id UUID REFERENCES public.products(id) ON DELETE SET NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Lotes de Estoque
CREATE TABLE IF NOT EXISTS public.stock_batches (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES public.users(id) ON DELETE CASCADE,
  product_id UUID REFERENCES public.products(id) ON DELETE CASCADE,
  batch_number TEXT NOT NULL,
  expiration_date DATE NOT NULL,
  reconstitution_date DATE,
  post_reconstitution_validity DATE,
  sealed_quantity NUMERIC(10,2) DEFAULT 0,
  in_use_quantity NUMERIC(10,2) DEFAULT 0,
  status TEXT CHECK (status IN ('ATIVO', 'QUARENTENA', 'DESCARTADO')) DEFAULT 'ATIVO',
  physical_location TEXT,
  quarantine_reason TEXT,
  entry_cost NUMERIC(12,4) DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Movimentações de Estoque (Kardex)
CREATE TABLE IF NOT EXISTS public.stock_movements (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES public.users(id) ON DELETE CASCADE,
  product_id UUID REFERENCES public.products(id) ON DELETE CASCADE,
  batch_id UUID REFERENCES public.stock_batches(id) ON DELETE SET NULL,
  type TEXT NOT NULL CHECK (type IN ('E', 'S', 'AJUSTE', 'PERDA')),
  quantity NUMERIC(10,2) NOT NULL,
  unit_price NUMERIC(12,4),
  balance_after NUMERIC(10,2) NOT NULL,
  patient_id UUID REFERENCES public.clients(id) ON DELETE SET NULL,
  professional_id UUID REFERENCES public.users(id) ON DELETE SET NULL,
  document_ref TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- ============================================================
-- 4. ROW LEVEL SECURITY (RLS) - SEGURANÇA POR USUÁRIO
-- ============================================================

-- Habilitar RLS em todas as tabelas
ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.audit_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.clients ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.products ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.transactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.stock_batches ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.stock_movements ENABLE ROW LEVEL SECURITY;

-- ============================================================
-- 5. POLICIES DE ACESSO
-- ============================================================

-- USERS: Admin vê todos, operador vê apenas o próprio
DROP POLICY IF EXISTS "Users can view own profile" ON public.users;
CREATE POLICY "Users can view own profile"
  ON public.users FOR SELECT
  USING (auth.uid() = id OR EXISTS (
    SELECT 1 FROM public.users WHERE id = auth.uid() AND role = 'admin'
  ));

DROP POLICY IF EXISTS "Admin can manage all users" ON public.users;
CREATE POLICY "Admin can manage all users"
  ON public.users FOR ALL
  USING (EXISTS (
    SELECT 1 FROM public.users WHERE id = auth.uid() AND role = 'admin'
  ));

-- AUDIT LOGS: Admin vê todos, operador vê apenas os próprios
DROP POLICY IF EXISTS "Users can view own audit logs" ON public.audit_logs;
CREATE POLICY "Users can view own audit logs"
  ON public.audit_logs FOR SELECT
  USING (user_id = auth.uid() OR EXISTS (
    SELECT 1 FROM public.users WHERE id = auth.uid() AND role = 'admin'
  ));

-- CLIENTS: Admin vê todos, operador vê apenas os próprios
DROP POLICY IF EXISTS "Users can view own clients" ON public.clients;
CREATE POLICY "Users can view own clients"
  ON public.clients FOR SELECT
  USING (user_id = auth.uid() OR EXISTS (
    SELECT 1 FROM public.users WHERE id = auth.uid() AND role = 'admin'
  ));

DROP POLICY IF EXISTS "Users can insert own clients" ON public.clients;
CREATE POLICY "Users can insert own clients"
  ON public.clients FOR INSERT
  WITH CHECK (user_id = auth.uid());

DROP POLICY IF EXISTS "Users can update own clients" ON public.clients;
CREATE POLICY "Users can update own clients"
  ON public.clients FOR UPDATE
  USING (user_id = auth.uid());

DROP POLICY IF EXISTS "Admin can delete any client" ON public.clients;
CREATE POLICY "Admin can delete any client"
  ON public.clients FOR DELETE
  USING (EXISTS (
    SELECT 1 FROM public.users WHERE id = auth.uid() AND role = 'admin'
  ));

-- PRODUCTS: Admin vê todos, operador vê apenas os próprios
DROP POLICY IF EXISTS "Users can view own products" ON public.products;
CREATE POLICY "Users can view own products"
  ON public.products FOR SELECT
  USING (user_id = auth.uid() OR EXISTS (
    SELECT 1 FROM public.users WHERE id = auth.uid() AND role = 'admin'
  ));

DROP POLICY IF EXISTS "Users can manage own products" ON public.products;
CREATE POLICY "Users can manage own products"
  ON public.products FOR ALL
  USING (user_id = auth.uid());

-- TRANSACTIONS: Admin vê todos, operador vê apenas as próprias
-- Operador NÃO pode excluir transações (restrição de segurança)
DROP POLICY IF EXISTS "Users can view own transactions" ON public.transactions;
CREATE POLICY "Users can view own transactions"
  ON public.transactions FOR SELECT
  USING (user_id = auth.uid() OR EXISTS (
    SELECT 1 FROM public.users WHERE id = auth.uid() AND role = 'admin'
  ));

DROP POLICY IF EXISTS "Users can insert own transactions" ON public.transactions;
CREATE POLICY "Users can insert own transactions"
  ON public.transactions FOR INSERT
  WITH CHECK (user_id = auth.uid());

DROP POLICY IF EXISTS "Users can update own transactions" ON public.transactions;
CREATE POLICY "Users can update own transactions"
  ON public.transactions FOR UPDATE
  USING (user_id = auth.uid());

DROP POLICY IF EXISTS "Admin can delete any transaction" ON public.transactions;
CREATE POLICY "Admin can delete any transaction"
  ON public.transactions FOR DELETE
  USING (EXISTS (
    SELECT 1 FROM public.users WHERE id = auth.uid() AND role = 'admin'
  ));

-- STOCK BATCHES: Admin vê todos, operador vê apenas os próprios
DROP POLICY IF EXISTS "Users can view own batches" ON public.stock_batches;
CREATE POLICY "Users can view own batches"
  ON public.stock_batches FOR SELECT
  USING (user_id = auth.uid() OR EXISTS (
    SELECT 1 FROM public.users WHERE id = auth.uid() AND role = 'admin'
  ));

DROP POLICY IF EXISTS "Users can manage own batches" ON public.stock_batches;
CREATE POLICY "Users can manage own batches"
  ON public.stock_batches FOR ALL
  USING (user_id = auth.uid());

-- STOCK MOVEMENTS: Admin vê todos, operador vê apenas os próprios
DROP POLICY IF EXISTS "Users can view own movements" ON public.stock_movements;
CREATE POLICY "Users can view own movements"
  ON public.stock_movements FOR SELECT
  USING (user_id = auth.uid() OR EXISTS (
    SELECT 1 FROM public.users WHERE id = auth.uid() AND role = 'admin'
  ));

DROP POLICY IF EXISTS "Users can insert own movements" ON public.stock_movements;
CREATE POLICY "Users can insert own movements"
  ON public.stock_movements FOR INSERT
  WITH CHECK (user_id = auth.uid());

-- ============================================================
-- 6. FUNÇÕES AUXILIARES
-- ============================================================

-- Função para registrar logs de auditoria automaticamente
CREATE OR REPLACE FUNCTION public.log_audit_action()
RETURNS TRIGGER AS $$
DECLARE
  v_user_email TEXT;
  v_action TEXT;
BEGIN
  -- Determina a ação
  IF TG_OP = 'INSERT' THEN
    v_action := 'CREATE';
  ELSIF TG_OP = 'UPDATE' THEN
    v_action := 'UPDATE';
  ELSIF TG_OP = 'DELETE' THEN
    v_action := 'DELETE';
  END IF;

  -- Busca email do usuário
  SELECT email INTO v_user_email FROM public.users WHERE id = auth.uid();

  -- Registra no audit log
  INSERT INTO public.audit_logs (
    user_id,
    user_email,
    action,
    entity_type,
    entity_id,
    old_data,
    new_data
  ) VALUES (
    auth.uid(),
    v_user_email,
    v_action,
    TG_TABLE_NAME,
    COALESCE(NEW.id::TEXT, OLD.id::TEXT),
    CASE WHEN TG_OP IN ('UPDATE', 'DELETE') THEN to_jsonb(OLD) ELSE NULL END,
    CASE WHEN TG_OP IN ('INSERT', 'UPDATE') THEN to_jsonb(NEW) ELSE NULL END
  );

  RETURN COALESCE(NEW, OLD);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Triggers de auditoria para tabelas críticas
CREATE TRIGGER trigger_audit_clients
  AFTER INSERT OR UPDATE OR DELETE ON public.clients
  FOR EACH ROW EXECUTE FUNCTION public.log_audit_action();

CREATE TRIGGER trigger_audit_transactions
  AFTER INSERT OR UPDATE OR DELETE ON public.transactions
  FOR EACH ROW EXECUTE FUNCTION public.log_audit_action();

CREATE TRIGGER trigger_audit_products
  AFTER INSERT OR UPDATE OR DELETE ON public.products
  FOR EACH ROW EXECUTE FUNCTION public.log_audit_action();

-- ============================================================
-- 7. FUNÇÃO PARA DEFINIR PRIMEIRO ADMIN (MASTER)
-- ============================================================
CREATE OR REPLACE FUNCTION public.set_first_admin(user_email TEXT)
RETURNS VOID AS $$
BEGIN
  -- Verifica se já existe algum admin
  IF NOT EXISTS (SELECT 1 FROM public.users WHERE role = 'admin') THEN
    -- Cria o primeiro admin
    INSERT INTO public.users (id, email, name, role, is_active)
    SELECT id, email, COALESCE(raw_user_meta_data->>'name', split_part(email, '@', 1)), 'admin', TRUE
    FROM auth.users
    WHERE email = user_email
    ON CONFLICT (id) DO UPDATE
    SET role = 'admin',
        updated_at = NOW();
    
    -- Registra no audit log
    INSERT INTO public.audit_logs (user_id, user_email, action, entity_type, entity_id, new_data)
    VALUES (
      (SELECT id FROM auth.users WHERE email = user_email),
      user_email,
      'CREATE',
      'user',
      (SELECT id::TEXT FROM auth.users WHERE email = user_email),
      jsonb_build_object('role', 'admin', 'action', 'set_first_admin')
    );
  ELSE
    RAISE EXCEPTION 'Já existe um administrador no sistema. Use o painel de gestão de usuários.';
  END IF;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================================
-- 8. VIEWS ÚTEIS
-- ============================================================

-- View de usuários ativos
CREATE OR REPLACE VIEW public.active_users AS
SELECT id, email, name, role, is_active, created_at, last_login
FROM public.users
WHERE is_active = TRUE
ORDER BY created_at DESC;

-- View de auditoria formatada
CREATE OR REPLACE VIEW public.audit_logs_formatted AS
SELECT 
  al.id,
  al.user_email,
  al.action,
  al.entity_type,
  al.entity_id,
  al.created_at,
  u.name AS user_name,
  u.role AS user_role
FROM public.audit_logs al
LEFT JOIN public.users u ON al.user_id = u.id
ORDER BY al.created_at DESC;

-- ============================================================
-- 9. COMENTÁRIOS
-- ============================================================
COMMENT ON TABLE public.users IS 'Usuários do sistema com roles (admin/operator)';
COMMENT ON TABLE public.audit_logs IS 'Log de auditoria de todas as ações críticas';
COMMENT ON COLUMN public.users.role IS 'admin: acesso total | operator: acesso restrito';
COMMENT ON COLUMN public.audit_logs.action IS 'CREATE, UPDATE, DELETE, LOGIN, LOGOUT';

-- ============================================================
-- FIM DO SCHEMA
-- ============================================================
