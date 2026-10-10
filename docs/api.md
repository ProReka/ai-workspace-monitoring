# Collector API

## `GET /api/snapshot`

`{ts, modes{multica,router,ecs}, multica, router, ecs, insights, alerts, notices, meta, cache_age_s, refreshing}`

- `multica.agents[]`: `agent_id/name, avatar, model, runtime_id, daemon_id, runtime_provider,
  runtime_online, concurrency, queued/dispatched/running, pending_total, oldest_pending_s,
  last_status, last_error, stale_runtime, current{status,summary,issue,kind,kind_label,elapsed_s},
  recent[6]{...same minus...}`. Plus `runtimes_known[]`, `runtimes_stale[]`.
- `router.connections[]`: `id, provider, account, isActive, testStatus, last_error, plan,
  windows[{label,used,total,remaining_pct,reset_at,reset_in}], worst_remaining, usage_ok`.
- `router.combos[]`: `name, chain[{link,kind,status,detail}], verdict(ok/degraded/down/unknown)`.
- `router.quotas[]`: flattened `{provider,account,window,used,total,remaining_pct,reset,status,last_error}`.
- `router.endpoint_status`: `{endpoint: http_code}`. `meta`: workspace/ids, router_url+version,
  multica_cli version, ecs cluster/region, refresh_s. No secrets.

## `GET /api/live`

`{ok, models[8]{model,label,provider,requests,req_min,tok_min,cost,last_used},
providers[{provider,requests,share,cost}], totals, dt_s, age_s}`. Rates need 2 polls (>5s apart).

## `GET /api/history?range=day|week|month`

`{agents[{id,name,scores[]}], buckets[ts...], bucket_s, kind}`.
Score = Σ(running×3 + pending). day=24×1h, week=7×1d, month=30×1d.

## `GET /healthz` → `{ok, cache_age_s}`
