# Modular NIFTY paper trading sections

This change prepares a second option analyst and Mistral position reviews. Independent `FAST_PAPER_MONITOR_ENABLED=yes` and `PAPER_AUDIT_ENABLED=yes` enable faster deterministic PAPER protection and persistent audit for the existing strategy, without needing the new analyst account. Turning off one section does not require replacing the other sections. `MODULAR_PAPER_ENABLED` is OFF unless the owner explicitly configures it. No external account, gateway key, paid route or live-order credential is created by the code.

All `signals/sections/` files below belong to the `janggo-cloud` backend. Dashboard history, timeline and export code belongs to `fresh-ai-trader`: `platform-data.mjs`, `platform.mjs`, and `platform-page.mjs`.

## Code ownership map

| Section | File | Responsibility |
|---|---|---|
| Configuration | signals/sections/config.mjs | Explicit activation, model allowlist, free-only acknowledgement |
| Market data | signals/sections/data.mjs | Quote identity/freshness, CE/PE coverage, comparable observations, regime and fresh re-entry evidence |
| Analyst transport | signals/sections/analyst-gateway.mjs | Pinned free model or compatible owner gateway, bounded JSON, timeout, no hidden paid fallback |
| Provider quota | signals/sections/free-quota.mjs | Read actual OpenRouter account free-request limits; no billion-token assumption |
| Session budgets | signals/sections/budget.mjs | Independent analyst calls/tokens and paced Mistral reviews |
| Entry analysis | signals/sections/entry-analysis.mjs | Immutable input snapshot, reason, invalidation, existing risk/price checks |
| Option candles | signals/sections/candle-research.mjs | Actual broker closed option candles, SHADOW ONLY, separate from chain entry decisions |
| Model comparison | signals/sections/comparison.mjs | Optional second pinned model, at most eight shared-budget comparisons/day; no entry authority |
| Mistral review | signals/sections/mistral-monitor.mjs | HOLD, tighter SL or observed paper early exit; never wider risk, more size or longer hold |
| Fast monitoring | signals/sections/exit-monitor.mjs | Held positions only, default 15-second alarms, maximum 1500 extra quote batches/day, minute fallback |
| Audit journal | signals/sections/journal.mjs | Append-only D1 snapshots/events, date and trade queries, cursor paging |
| Dashboard status | signals/sections/status.mjs | Separate readiness and failure state per section |

Current entry/SL/target calculations remain in the existing direct-plan, paper-entry, paper-execution and paper-monitor modules. The normal monitor always runs before an advisory AI review. Fresh full-position bid depth is required. Sampled quotes can still skip intrainterval SL touches; faster sampling does not establish a broker fill.

## Cloudflare-only setup

FreeLLMAPI and OmniRoute are gateways, not token grants. Their full desktop/Node server is not required by this adapter. The prepared direct cloud route is OpenRouter free variants; compatible gateway/service-binding support is available separately if the owner later supplies one.

1. Keep modular mode OFF while creating a free provider account. Do not add billing or paid fallback models.
2. Add `OPENROUTER_API_KEY` as a Secret on personal-ai-trader. Never put the key in Git, logs, Telegram or chat.
3. Set `ANALYST_ROUTE=OPENROUTER_FREE`, `ANALYST_MODEL` and `ANALYST_ALLOWED_MODELS` to explicitly reviewed `:free` model IDs. The current catalog lists `meta-llama/llama-3.3-70b-instruct:free`; account availability and JSON behavior still need a real commissioning test. There is no automatic model substitution.
4. Set `ANALYST_FREE_ONLY_CONFIRMED=yes` only after checking the route/account. Calls use only the pinned free variant. Actual account daily request caps are read before inference and combined with the software cap. Free quotas can change and are shared with other account usage.
5. Optional `ANALYST_CALL_CAP` (default80) and `ANALYST_TOKEN_CAP` (default100000) are software ceilings, not provider grants. Provider caps take precedence. The existing Cloudflare 80-call/8000-estimated-unit guard remains separate and includes earlier same-day usage; it supplies Mistral reviews when this mode is active.
6. Commission transport/JSON, quote identity and one complete PAPER lifecycle before setting `MODULAR_PAPER_ENABLED=yes`. New mode rejects real execution and cannot place live orders. Existing real-order configuration is untouched.
7. Optional comparison requires `PAPER_MODEL_COMPARISON=yes` plus a different, explicitly allowlisted `ANALYST_COMPARISON_MODEL`; it consumes the same analyst quota and never creates an actual paper entry.

## History and retention

Existing `chain_signals` rows are not deleted or migrated away. New `paper_audit_events` has no TTL or scheduled deletion. Stored inputs, requested/served model, full bounded reason, invalidation, rejections, quotes, trailing changes, AI recommendations and exits are private. The dashboard supports a journal date, reasons in CSV and a per-trade audit timeline. Old trades can only display the fields actually stored at the time; missing historical inputs cannot be reconstructed.

Storage is finite. A free account cannot promise infinite retention. Export before reaching the database storage limit; no cleanup silently removes trade records. CSV results are gross sampled PAPER observations, before fees/slippage, not broker fills.

## Verification

Run `node --test tests/*.test.mjs` in each repo. All provider tests use synthetic responses. These tests prove routing, quotas, persistence, identity and monitoring behavior; they do not establish live provider access or profitable performance. To isolate a problem, use the section name and the trade's analysisId in the private timeline. No other project is touched.
