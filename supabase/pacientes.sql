-- ============================================================
-- DoseCerta · Tabela de Pacientes/Clientes (Supabase/PostgreSQL)
-- Execute este script no SQL Editor do seu projeto Supabase.
-- Colunas em snake_case mapeiam 1:1 o tipo `Client` do app.
-- ============================================================

CREATE TABLE IF NOT EXISTS public.pacientes (
  id                  TEXT PRIMARY KEY,
  name                TEXT NOT NULL,
  phone               TEXT DEFAULT '',
  cpf                 TEXT,
  data_nascimento     TEXT,
  contato_emergencia  TEXT,
  profissao           TEXT,
  ficha_tecnica_id    TEXT,
  product_id          TEXT NOT NULL DEFAULT '',
  frequency_days      INTEGER NOT NULL DEFAULT 7,
  last_application    TEXT NOT NULL,
  notes               TEXT DEFAULT '',
  active              BOOLEAN NOT NULL DEFAULT TRUE,
  since               TEXT NOT NULL,
  created_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at          TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Índice para busca por nome e listagem ordenada
CREATE INDEX IF NOT EXISTS idx_pacientes_name ON public.pacientes (name);
CREATE INDEX IF NOT EXISTS idx_pacientes_since ON public.pacientes (since);

-- Atualiza updated_at automaticamente a cada alteração
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
-- RLS (Row Level Security)
-- Habilitado para proteger a tabela. Ajuste as políticas ao seu
-- modelo de autenticação. Exemplo permissivo para a chave anon:
-- ============================================================
ALTER TABLE public.pacientes ENABLE ROW LEVEL SECURITY;

-- Leitura/escrita para usuários autenticados (recomendado)
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

-- Se preferir acesso pela chave anon (protótipo), descomente:
-- DROP POLICY IF EXISTS "pacientes_anon_all" ON public.pacientes;
-- CREATE POLICY "pacientes_anon_all" ON public.pacientes FOR ALL TO anon USING (true) WITH CHECK (true);
