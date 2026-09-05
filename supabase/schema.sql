-- ============================================================================
-- DoseCerta — Prontuário Eletrônico de Procedimentos Injetáveis
-- Script SQL para Supabase (PostgreSQL)
-- Executar no SQL Editor do Supabase.
-- ============================================================================

-- Extensões úteis
create extension if not exists "uuid-ossp";

-- ============================================================================
-- 1) PACIENTES
-- Cadastro civil do paciente. CPF único para evitar duplicidade de prontuário.
-- ============================================================================
create table if not exists public.pacientes (
  id                  uuid primary key default uuid_generate_v4(),
  created_at          timestamptz not null default now(),
  nome_completo       text        not null check (length(trim(nome_completo)) >= 3),
  cpf                 text        unique,
  data_nascimento     date,
  telefone            text,
  contato_emergencia  text,
  profissao           text
);

comment on table  public.pacientes is 'Cadastro civil do paciente (prontuário). CPF único evita prontuários duplicados.';
create index if not exists idx_pacientes_nome on public.pacientes (nome_completo);

-- ============================================================================
-- 2) ANAMNESES
-- Triagem clínica específica para injetáveis (GLP-1/Tirzepatida, soroterapia,
-- peptídeos). Arrays de alergias e JSONB para triagens metabólica/gastro.
-- ============================================================================
create table if not exists public.anamneses (
  id                        uuid primary key default uuid_generate_v4(),
  paciente_id               uuid not null references public.pacientes(id) on delete cascade,
  created_at                timestamptz not null default now(),
  alergias                  text[]  not null default '{}',
  condicoes_metabolicas     jsonb   not null default '{}',   -- diabetes, hipertensão, tireoide…
  historico_gastrointestinal jsonb  not null default '{}',   -- refluxo, gastroparesia, bariátrica…
  medicamentos_em_uso       text,
  gestante_lactante         boolean not null default false
);

comment on table public.anamneses is 'Anamnese técnica para injetáveis. Condições metabólicas e gastro em JSONB permitem evolução do formulário sem migration.';
create index if not exists idx_anamneses_paciente on public.anamneses (paciente_id, created_at desc);

-- ============================================================================
-- 3) AVALIACOES_FISICAS
-- Antropometria seriada. IMC calculado automaticamente (coluna gerada).
-- ============================================================================
create table if not exists public.avaliacoes_fisicas (
  id                      uuid primary key default uuid_generate_v4(),
  paciente_id             uuid not null references public.pacientes(id) on delete cascade,
  created_at              timestamptz not null default now(),
  peso                    numeric(5,2) not null check (peso > 0),
  altura                  numeric(4,2) not null check (altura > 0),
  imc                     numeric(5,2) generated always as (round(peso / nullif(altura,0) ^ 2, 2)) stored,
  circunferencia_abdominal numeric(5,2),
  prega_cutanea_mm        numeric(5,2)
);

comment on table  public.avaliacoes_fisicas is 'Avaliação física/antropométrica seriada. IMC é coluna gerada: round(peso / altura², 2).';
comment on column public.avaliacoes_fisicas.imc is 'IMC gerado automaticamente a partir de peso e altura.';
create index if not exists idx_avaliacoes_paciente on public.avaliacoes_fisicas (paciente_id, created_at desc);

-- ============================================================================
-- 4) TERMOS_CONSENTIMENTO (TCLE)
-- Termo gerado no app, assinado localmente ou via Gov.br (assinador.iti.br).
-- Guarda a minuta original e o PDF assinado (URLs do Storage).
-- ============================================================================
create table if not exists public.termos_consentimento (
  id                          uuid primary key default uuid_generate_v4(),
  paciente_id                 uuid not null references public.pacientes(id) on delete cascade,
  created_at                  timestamptz not null default now(),
  tipo_protocolo              text not null,
  ip_assinatura               inet,
  assinatura_url              text,                       -- assinatura digital coletada no app
  documento_original_url      text,                       -- minuta PDF (termos-originais/)
  documento_assinado_govbr_url text,                      -- PDF assinado Gov.br (termos-assinados-govbr/)
  metodo_assinatura           text not null default 'local' check (metodo_assinatura in ('local','govbr')),
  status                      text not null default 'pendente_assinatura'
                              check (status in ('pendente_assinatura','assinado_local','assinado_govbr'))
);

comment on table public.termos_consentimento is 'TCLE: ciclo geração → assinatura local ou Gov.br → upload do PDF assinado.';
create index if not exists idx_termos_paciente on public.termos_consentimento (paciente_id, created_at desc);
create index if not exists idx_termos_status   on public.termos_consentimento (status);

-- ============================================================================
-- 5) SESSOES_APLICACAO
-- Registro clínico do momento da aplicação, com rastreabilidade de lote
-- (exigência ANVISA) e substâncias em JSONB.
-- ============================================================================
create table if not exists public.sessoes_aplicacao (
  id                      uuid primary key default uuid_generate_v4(),
  paciente_id             uuid not null references public.pacientes(id) on delete cascade,
  created_at              timestamptz not null default now(),
  protocolo_aplicado      text not null,
  substancias_utilizadas  jsonb not null default '[]',   -- [{nome, dose, lote}]
  local_aplicacao         text,
  lote                    text,
  observacoes             text
);

comment on table public.sessoes_aplicacao is 'Sessão clínica de aplicação: protocolo, substâncias (JSONB), local e lote para rastreabilidade.';
create index if not exists idx_sessoes_paciente on public.sessoes_aplicacao (paciente_id, created_at desc);
create index if not exists idx_sessoes_lote     on public.sessoes_aplicacao (lote);

-- ============================================================================
-- 6) HISTORICO_PACIENTE
-- Linha do tempo clínica: cada aplicação/sessão gera uma entrada aqui
-- (gravação simultânea com sessoes_aplicacao).
-- ============================================================================
create table if not exists public.historico_paciente (
  id                    uuid primary key default uuid_generate_v4(),
  paciente_id           uuid not null references public.pacientes(id) on delete cascade,
  data_horario          timestamptz not null default now(),
  procedimento_realizado text not null,
  protocolo_aplicacao   text,
  medicamento_aplicado  text,
  material_utilizado    text,
  local_aplicacao       text,
  tipo_aplicacao        text check (tipo_aplicacao in ('subcutanea','intravenosa','intramuscular','cutanea','intradermica')),
  evolucao_tratamento   text
);

comment on table public.historico_paciente is 'Linha do tempo do paciente: procedimento, via, lote, material e evolução do tratamento.';
create index if not exists idx_historico_paciente on public.historico_paciente (paciente_id, data_horario desc);

-- ============================================================================
-- ROW LEVEL SECURITY (RLS)
-- Habilita RLS e cria política básica para usuários autenticados.
-- Ajuste as políticas conforme a regra do seu consultório.
-- ============================================================================
alter table public.pacientes            enable row level security;
alter table public.anamneses            enable row level security;
alter table public.avaliacoes_fisicas   enable row level security;
alter table public.termos_consentimento enable row level security;
alter table public.sessoes_aplicacao    enable row level security;
alter table public.historico_paciente   enable row level security;

-- Política de exemplo: profissionais autenticados têm acesso total.
do $$
declare
  t text;
begin
  foreach t in array array['pacientes','anamneses','avaliacoes_fisicas','termos_consentimento','sessoes_aplicacao','historico_paciente']
  loop
    execute format(
      'create policy "acesso_profissional_%s" on public.%I for all to authenticated using (true) with check (true)',
      t, t
    );
  end loop;
end $$;

-- ============================================================================
-- STORAGE — Bucket de documentos dos pacientes
-- Bucket privado com RLS; pastas: termos-originais/ e termos-assinados-govbr/
-- ============================================================================
insert into storage.buckets (id, name, public)
values ('documentos-pacientes', 'documentos-pacientes', false)
on conflict (id) do nothing;

-- Leitura/escrita apenas para usuários autenticados, dentro do próprio bucket.
create policy "documentos_select" on storage.objects
  for select to authenticated
  using (bucket_id = 'documentos-pacientes');

create policy "documentos_insert" on storage.objects
  for insert to authenticated
  with check (bucket_id = 'documentos-pacientes');

create policy "documentos_update" on storage.objects
  for update to authenticated
  using (bucket_id = 'documentos-pacientes');

-- ============================================================================
-- FIM DO SCRIPT
-- Próximos passos: configurar Auth (e-mail/senha ou magic link) e conectar o
-- front-end via supabase-js (@supabase/supabase-js).
-- ============================================================================
