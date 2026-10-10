# Sources (verified against live systems, 9Router 0.5.95 / Multica CLI 0.6.1)

## 9Router — cookie session, NOT Bearer, for `/api/*`

- `POST /api/auth/login {"password"}` → `Set-Cookie: auth_token` (JWT ~24h).
  Only on missing/expiring cookie or 401 (lockout risk).
- `GET /api/providers/client?page&pagesize=100&accountStatus=all&sort=priority`
  → `{connections[{id,provider,name,email,isActive,testStatus,lastError,...}], pagination}`.
  Loop all pages.
- `GET /api/usage/<connectionId>` → `{plan, quotas: {"label":{used,total,remainingPercentage,resetAt}}}`.
  Only for `isActive`; inactive connections fail/timeout — skip, don't error.
- `GET /api/combos` → `{combos[{name, models[fallback chain]}]}` (nested combos recurse).
- `GET /api/provider-nodes` → `{nodes[{id,name,prefix}]}` (maps `openai-compatible-chat-<uuid>` → Lazio/Gorama).
- `GET /api/usage/stats` → cumulative `{totalRequests, totalPromptTokens, ..., byProvider, byModel{rawModel,provider,lastUsed}}`.
  `/api/usage/stream` (SSE) emits the same totals periodically — no per-request events in 0.5.95.
- `GET /v1/models` (Bearer `NINEROUTER_KEY`) → combos have `owned_by:"combo"`.
- Combo link health: prefix map only `cc→claude`, `oc→opencode`; else provider-nodes,
  else nested combo, else `unknown` (never fake red).

## Multica — CLI, always `--workspace-id`

- `agent list`, `runtime list`, `agent tasks <id>` (all `--output json`).
- Agent: `workspace_id, runtime_id, avatar_url("emoji:X"|url), model, max_concurrent_tasks`.
- Runtime: `id, daemon_id, status(online|offline), provider, workspace_id`.
  Dual registrations per daemon (claude+opencode) — bind by `runtime_id` only.
- Task: `status, trigger_summary, issue_key|issue_id, kind(direct|autopilot|issue|...),
  started_at/created_at/completed_at, error, failure_reason`.
- Mention syntax (render only, from `mention.go`):
  `[@Label](mention://member|agent|squad|issue|all/uuid)` → bold; agent type deep-links
  to our agent modal. External links only to `https://multica.ai` root.
