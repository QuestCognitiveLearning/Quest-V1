-- 0004_llm_audit_log.sql — defense against OpenAI key abuse.
--
-- Every successful LLM call appends one row here. Two indexes support the
-- two queries the guard makes on every request:
--   1. per-user daily count   (rate-limit check)
--   2. global daily token sum (circuit-breaker check)
--
-- Service role writes (Edge Functions); no policy = no user access.
-- Retention: rows older than 90 days are pruned by a separate job (TODO).

create table public.llm_audit_log (
  id              bigserial primary key,
  user_id         uuid references auth.users(id) on delete cascade,
  model           varchar not null,
  input_tokens    int not null default 0,
  output_tokens   int not null default 0,
  total_tokens    int generated always as (input_tokens + output_tokens) stored,
  created_at      timestamptz not null default now()
);

-- Index for per-user daily count: WHERE user_id = X AND created_at >= today
create index llm_audit_log_user_day_idx
  on public.llm_audit_log (user_id, created_at);

-- Index for global daily token sum: WHERE created_at >= today
create index llm_audit_log_day_idx
  on public.llm_audit_log (created_at);

-- RLS on. No policies = regular users cannot read or write.
-- Service role (used by Edge Functions) bypasses RLS by default.
alter table public.llm_audit_log enable row level security;
