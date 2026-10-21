-- NNÓS Gestão Financeira — Migração 001: fundação (acesso/auditoria) + Módulo 1 (Gestão de Projetos)
-- Executar no Supabase: SQL Editor > New query > colar > Run.

create extension if not exists pgcrypto;

-- =========================================================
-- 1. FUNDAÇÃO DE ACESSO
-- =========================================================
create table public.perfis (
  id uuid primary key default gen_random_uuid(),
  nome text not null unique,
  descricao text,
  ativo boolean not null default true,
  criado_em timestamptz not null default now()
);

create table public.permissoes (
  id uuid primary key default gen_random_uuid(),
  codigo text not null unique,            -- ex.: 'projetos.ler', 'projetos.editar'
  modulo text not null,
  descricao text
);

create table public.perfil_permissoes (
  perfil_id uuid not null references public.perfis(id) on delete cascade,
  permissao_id uuid not null references public.permissoes(id) on delete cascade,
  primary key (perfil_id, permissao_id)
);

-- Extensão de auth.users (a senha e o hash ficam no Supabase Auth)
create table public.usuarios (
  id uuid primary key references auth.users(id) on delete cascade,
  nome text not null,
  email text not null,
  perfil_id uuid references public.perfis(id),
  ativo boolean not null default true,
  deve_trocar_senha boolean not null default true,
  criado_em timestamptz not null default now()
);

create table public.log_acesso (
  id bigint generated always as identity primary key,
  usuario_id uuid references public.usuarios(id) on delete set null,
  email text,
  evento text not null check (evento in ('login','logout','falha_login','troca_senha','reset_senha')),
  ip inet,
  user_agent text,
  criado_em timestamptz not null default now()
);

create table public.log_auditoria (
  id bigint generated always as identity primary key,
  usuario_id uuid,
  tabela text not null,
  registro_id text,
  acao text not null check (acao in ('INSERT','UPDATE','DELETE')),
  antes jsonb,
  depois jsonb,
  criado_em timestamptz not null default now()
);

-- Configurações globais (regras que estavam em fórmulas da planilha)
create table public.configuracoes (
  chave text primary key,
  valor numeric not null,
  descricao text
);
insert into public.configuracoes (chave, valor, descricao) values
  ('imposto_pct', 12.25, 'Imposto sobre faturamento (%)'),
  ('rateio_pct', 3.00, 'Rateio sobre faturamento (%)'),
  ('fator_compensacao_socio', 0.94, 'Divisor de compensação aplicado ao custo de consultor Sócio'),
  ('horas_por_dia', 8, 'Horas por dia de trabalho'),
  ('prazo_prestacao_contas_dias', 5, 'Dias após data final para prestação de contas');

-- =========================================================
-- 2. MÓDULO 1 — GESTÃO DE PROJETOS
-- =========================================================
create type public.tipo_consultor as enum ('socio','parceiro','funcionario');
create type public.regiao as enum ('BRA','LATAM');
create type public.modalidade as enum ('VIRTUAL','PRESENCIAL');

create table public.areas (
  id uuid primary key default gen_random_uuid(),
  nome text not null unique
);

create table public.lideres (
  id uuid primary key default gen_random_uuid(),
  nome text not null unique,
  usuario_id uuid references public.usuarios(id)   -- vínculo opcional para filtrar por líder
);

create table public.centros_custo (
  id uuid primary key default gen_random_uuid(),
  codigo text not null unique,                      -- ex.: 01.04.011.063
  projeto text not null,
  contrato text,
  area_id uuid references public.areas(id),
  lider_id uuid references public.lideres(id),
  ativo boolean not null default true
);

create table public.projetos (
  id uuid primary key default gen_random_uuid(),
  nome text not null unique,
  centro_custo_id uuid references public.centros_custo(id),
  ativo boolean not null default true
);

create table public.consultores (
  id uuid primary key default gen_random_uuid(),
  nome text not null unique,
  tipo public.tipo_consultor not null,              -- tag da persona
  fornecedor boolean not null default false,
  ativo boolean not null default true
);

create table public.tabela_precos (
  id uuid primary key default gen_random_uuid(),
  projeto_id uuid references public.projetos(id),
  atividade text,
  perfil text,                                      -- JÚNIOR / PLENO / SÊNIOR
  tipo_consultor public.tipo_consultor,
  regiao public.regiao not null default 'BRA',
  valor_hora numeric(14,2),
  valor_dia numeric(14,2)
);

create table public.lancamentos (
  id uuid primary key default gen_random_uuid(),
  competencia date not null check (extract(day from competencia) = 1),  -- 1º dia do mês
  projeto_id uuid not null references public.projetos(id),
  atividade text,
  modalidade public.modalidade,
  local text,                                       -- Concessionária | Cidade | Estado
  regiao public.regiao not null default 'BRA',
  data_inicial date,
  data_final date,
  consultor_id uuid references public.consultores(id),
  perfil text,
  horas numeric(8,2),
  faturar numeric(14,2),
  repasse numeric(14,2),
  custo_consultor numeric(14,2),                    -- manual; se nulo, calcula pela tabela de preços
  logistica numeric(14,2),
  status text,
  precisa_logistica boolean,
  criado_em timestamptz not null default now(),
  atualizado_em timestamptz not null default now()
);
create index on public.lancamentos (competencia);
create index on public.lancamentos (projeto_id);

create table public.viagens (
  id uuid primary key default gen_random_uuid(),
  lancamento_id uuid not null unique references public.lancamentos(id) on delete cascade,
  agencia text,
  custo_1 numeric(14,2) default 0,
  custo_2 numeric(14,2) default 0,
  custo_3 numeric(14,2) default 0,
  custo_4 numeric(14,2) default 0,
  custo_5 numeric(14,2) default 0,
  total numeric(14,2) generated always as
    (coalesce(custo_1,0)+coalesce(custo_2,0)+coalesce(custo_3,0)+coalesce(custo_4,0)+coalesce(custo_5,0)) stored,
  observacao_agencia text
);

create table public.notas_debito (
  id uuid primary key default gen_random_uuid(),
  lancamento_id uuid not null references public.lancamentos(id) on delete cascade,
  destino text not null check (destino in ('agencia','consultor')),
  numero text,
  valor numeric(14,2)
);

-- =========================================================
-- 3. AUDITORIA AUTOMÁTICA
-- =========================================================
create or replace function public.fn_auditoria() returns trigger
language plpgsql security definer as $$
begin
  insert into public.log_auditoria (usuario_id, tabela, registro_id, acao, antes, depois)
  values (
    auth.uid(), tg_table_name,
    coalesce((case when tg_op = 'DELETE' then to_jsonb(old) else to_jsonb(new) end)->>'id', ''),
    tg_op,
    case when tg_op in ('UPDATE','DELETE') then to_jsonb(old) end,
    case when tg_op in ('INSERT','UPDATE') then to_jsonb(new) end
  );
  return coalesce(new, old);
end $$;

create trigger trg_aud_lancamentos after insert or update or delete on public.lancamentos
  for each row execute function public.fn_auditoria();
create trigger trg_aud_tabela_precos after insert or update or delete on public.tabela_precos
  for each row execute function public.fn_auditoria();
create trigger trg_aud_centros_custo after insert or update or delete on public.centros_custo
  for each row execute function public.fn_auditoria();

create or replace function public.fn_atualizado_em() returns trigger
language plpgsql as $$ begin new.atualizado_em = now(); return new; end $$;
create trigger trg_lanc_atualizado before update on public.lancamentos
  for each row execute function public.fn_atualizado_em();

-- =========================================================
-- 4. RLS (seguro por padrão; políticas finas serão definidas com os perfis)
-- =========================================================
do $$
declare t text;
begin
  foreach t in array array[
    'perfis','permissoes','perfil_permissoes','usuarios','log_acesso','log_auditoria','configuracoes',
    'areas','lideres','centros_custo','projetos','consultores','tabela_precos','lancamentos','viagens','notas_debito']
  loop
    execute format('alter table public.%I enable row level security', t);
  end loop;
end $$;

-- Provisório: usuário autenticado lê cadastros e lançamentos. Escrita e granularidade por perfil virão na próxima etapa.
do $$
declare t text;
begin
  foreach t in array array[
    'areas','lideres','centros_custo','projetos','consultores','tabela_precos','lancamentos','viagens','notas_debito','configuracoes']
  loop
    execute format('create policy "leitura_autenticado" on public.%I for select to authenticated using (true)', t);
  end loop;
end $$;

create policy "usuario_le_proprio" on public.usuarios for select to authenticated using (id = auth.uid());
-- log_acesso, log_auditoria, perfis e permissoes: sem política = acesso apenas via service_role (servidor).
