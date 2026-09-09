-- ============================================================
-- DOSECERTA - Schema Completo para Sincronização Total
-- Execute TUDO de uma vez no SQL Editor do Supabase
-- ============================================================

-- 1) LIMPA TUDO (seguro)
DROP TABLE IF EXISTS public.ficha_tecnica_itens CASCADE;
DROP TABLE IF EXISTS public.fichas_tecnicas CASCADE;
DROP TABLE IF EXISTS public.alocacoes CASCADE;
DROP TABLE IF EXISTS public.orcamentos CASCADE;
DROP TABLE IF EXISTS public.funcionarios CASCADE;
DROP TABLE IF EXISTS public.transacoes CASCADE;
DROP TABLE IF EXISTS public.fornecedores CASCADE;
DROP TABLE IF EXISTS public.lotes CASCADE;
DROP TABLE IF EXISTS public.produtos CASCADE;
DROP TABLE IF EXISTS public.pacientes CASCADE;
DROP TABLE IF EXISTS public.audit_logs CASCADE;
DROP TABLE IF EXISTS public.users CASCADE;

-- ============================================================
-- 2) TABELAS PRINCIPAIS
-- ============================================================

-- Usuários (auth)
CREATE TABLE public.users (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email TEXT UNIQUE NOT NULL,
  name TEXT NOT NULL,
  role TEXT NOT NULL DEFAULT 'operator',
  is_active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  last_login TIMESTAMPTZ
);

-- Auditoria
CREATE TABLE public.audit_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES public.users(id) ON DELETE SET NULL,
  user_email TEXT NOT NULL,
  action TEXT NOT NULL,
  entity_type TEXT NOT NULL,
  entity_id TEXT,
  old_data JSONB,
  new_data JSONB,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Produtos
CREATE TABLE public.produtos (
  id TEXT PRIMARY KEY,
  sku TEXT NOT NULL,
  nome TEXT NOT NULL,
  unidade TEXT DEFAULT 'un',
  categoria TEXT DEFAULT 'Geral',
  estoque_minimo NUMERIC(10,2) DEFAULT 0,
  estoque_maximo NUMERIC(10,2) DEFAULT 0,
  saldo_atual NUMERIC(10,2) DEFAULT 0,
  preco_medio NUMERIC(12,4) DEFAULT 0,
  tipo TEXT DEFAULT 'INSUMO',
  lead_time_dias INTEGER DEFAULT 7,
  estoque_seguranca NUMERIC(10,2) DEFAULT 0,
  reconstituicao_dias INTEGER,
  refrigerado BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Lotes
CREATE TABLE public.lotes (
  id TEXT PRIMARY KEY,
  id_produto TEXT NOT NULL REFERENCES public.produtos(id) ON DELETE CASCADE,
  numero_lote TEXT NOT NULL,
  data_validade TEXT NOT NULL,
  saldo_fechado NUMERIC(10,2) NOT NULL DEFAULT 0,
  saldo_em_uso NUMERIC(10,2) NOT NULL DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'ATIVO',
  localizacao_fisica TEXT DEFAULT '',
  custo_entrada NUMERIC(12,4) DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Transações Financeiras
CREATE TABLE public.transacoes (
  id TEXT PRIMARY KEY,
  tipo TEXT NOT NULL,
  descricao TEXT NOT NULL,
  categoria TEXT NOT NULL,
  valor NUMERIC(12,2) NOT NULL,
  data TEXT NOT NULL,
  forma_pagamento TEXT DEFAULT 'pix',
  id_cliente TEXT,
  id_produto TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Fornecedores
CREATE TABLE public.fornecedores (
  id TEXT PRIMARY KEY,
  razao_social TEXT NOT NULL,
  cnpj TEXT DEFAULT '',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Funcionários
CREATE TABLE public.funcionarios (
  id TEXT PRIMARY KEY,
  nome TEXT NOT NULL,
  funcao TEXT DEFAULT '',
  tipo_contrato TEXT DEFAULT 'CLT',
  centro_custo TEXT DEFAULT 'OPERACIONAL',
  data_admissao TEXT DEFAULT '',
  status TEXT DEFAULT 'ATIVO',
  salario_base NUMERIC(12,2) DEFAULT 0,
  horas_mensais NUMERIC(5,2) DEFAULT 0,
  ferias_meses INTEGER DEFAULT 0,
  componentes JSONB DEFAULT '[]',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Orçamentos
CREATE TABLE public.orcamentos (
  id TEXT PRIMARY KEY,
  nome_cliente TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'DRAFT',
  materiais JSONB DEFAULT '[]',
  mao_obra JSONB DEFAULT '[]',
  markup_pct NUMERIC(5,2) DEFAULT 0,
  tax_pct NUMERIC(5,2) DEFAULT 0,
  valido_ate TEXT DEFAULT '',
  id_cliente TEXT,
  id_ficha TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Pacientes
CREATE TABLE public.pacientes (
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
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- ============================================================
-- 3) ÍNDICES
-- ============================================================
CREATE INDEX idx_produtos_sku ON public.produtos(sku);
CREATE INDEX idx_lotes_produto ON public.lotes(id_produto);
CREATE INDEX idx_lotes_validade ON public.lotes(data_validade);
CREATE INDEX idx_transacoes_data ON public.transacoes(data);
CREATE INDEX idx_orcamentos_status ON public.orcamentos(status);
CREATE INDEX idx_pacientes_name ON public.pacientes(name);

-- ============================================================
-- 4) TRIGGERS updated_at
-- ============================================================
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_produtos_updated BEFORE UPDATE ON public.produtos FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER trg_lotes_updated BEFORE UPDATE ON public.lotes FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER trg_transacoes_updated BEFORE UPDATE ON public.transacoes FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER trg_fornecedores_updated BEFORE UPDATE ON public.fornecedores FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER trg_funcionarios_updated BEFORE UPDATE ON public.funcionarios FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER trg_orcamentos_updated BEFORE UPDATE ON public.orcamentos FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER trg_pacientes_updated BEFORE UPDATE ON public.pacientes FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- ============================================================
-- 5) ROW LEVEL SECURITY
-- ============================================================
ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.audit_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.produtos ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.lotes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.transacoes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.fornecedores ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.funcionarios ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.orcamentos ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.pacientes ENABLE ROW LEVEL SECURITY;

-- Políticas de acesso total
CREATE POLICY "users_all" ON public.users FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "audit_all" ON public.audit_logs FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "produtos_all" ON public.produtos FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "lotes_all" ON public.lotes FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "transacoes_all" ON public.transacoes FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "fornecedores_all" ON public.fornecedores FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "funcionarios_all" ON public.funcionarios FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "orcamentos_all" ON public.orcamentos FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "pacientes_all" ON public.pacientes FOR ALL USING (true) WITH CHECK (true);

-- ============================================================
-- 6) FUNÇÃO ADMIN
-- ============================================================
CREATE OR REPLACE FUNCTION public.set_first_admin(user_email TEXT)
RETURNS TEXT AS $$
DECLARE
  user_id UUID;
BEGIN
  SELECT id INTO user_id FROM auth.users WHERE email = user_email;
  IF user_id IS NULL THEN
    RAISE EXCEPTION 'Usuário "%" não existe no Authentication!', user_email;
  END IF;
  INSERT INTO public.users (id, email, name, role, is_active)
  VALUES (user_id, user_email, 'Administrador Master', 'admin', true)
  ON CONFLICT (id) DO UPDATE SET role = 'admin', is_active = true;
  RETURN 'Admin configurado: ' || user_email;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================================
-- 7) VINCULA ADMIN AUTOMATICAMENTE
-- ============================================================
DO $$
DECLARE
  user_id UUID;
BEGIN
  SELECT id INTO user_id FROM auth.users WHERE email = 'jonhsonbeckman30@gmail.com';
  IF user_id IS NOT NULL THEN
    INSERT INTO public.users (id, email, name, role, is_active)
    VALUES (user_id, 'jonhsonbeckman30@gmail.com', 'Administrador Master', 'admin', true)
    ON CONFLICT (id) DO UPDATE SET role = 'admin', is_active = true;
  END IF;
END $$;

-- ============================================================
-- 8) VERIFICAÇÃO
-- ============================================================
SELECT '✅ Instalação concluída!' as status;
SELECT tablename FROM pg_tables WHERE schemaname = 'public' ORDER BY tablename;
