# Fresh AI trader — focused transport and shared-bot fixes

The existing research scanner, paper lifecycle and evidence gates are retained.
Version: janggo-unified-2026-11-11-history-chain-router-v7.

Changes:
- Historical HTTP 403 rate messages, including “exceeding access rate”, are distinguished from genuine access denial.
- Backoff classification checks rate limiting before generic HTTP 403; old-version failure snapshots do not falsely hold the new transport closed.
- Historical attempts and quote attempts reserve shared broker cadence through the OPTION_CHAIN service. There is no proxy/IP bypass and no repeated retry of genuine access denial.
- Configured broker identity headers override placeholders. Matching-account metadata may be obtained over the signed internal service; mismatched identities are never adopted. API credentials and sessions remain local to this Worker.
- Naive broker candle timestamps are normalized as IST. Sparse spot snapshots remain explicitly NOT candles.
- The existing Telegram webhook remains centralized here, with new /ocstatus /ocscan /ocpause /ocresume /ocreport commands for the separate option-chain project.
- /histprobe nifty|sensex performs one bounded five-minute historical window probe and reports only safe status/coverage metadata.
- /botroute verifies webhook setup. Existing queued updates are preserved.
- keep_vars retains dashboard configuration. Existing secrets are not printed or rewritten.
- Production evidence gates and order-execution restrictions are unchanged.

Before-change backup: backup/before-history-routing-20261111.
Run node --test tests/*.test.mjs. Code fixes do not establish broker permission: an actual ANGEL_ACCESS_DENIED response may still require Angel One to resolve account or source-IP restrictions.
