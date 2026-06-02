<!-- BEGIN:nextjs-agent-rules -->
# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` before writing any code. Heed deprecation notices.
<!-- END:nextjs-agent-rules -->

# Design Scrape — Agent Context

## Stack

- **Next.js 16** (non-standard version — read `node_modules/next/dist/docs/` before writing any route handler or config)
- **MongoDB** via `lib/mongodb.ts` — promise-based singleton, always use `getDb()`
- **Python** for scraping and scheduled posting (`bot/`)
- **TypeScript** for everything that touches the Next.js runtime, including user-triggered posting

## Architecture decisions

### Two runtimes, strict separation

The scraper is Python because BeautifulSoup is the right tool for HTML scraping. Everything else — API routes, posting to X/Threads/Instagram from the web UI — is TypeScript.

**Never call Python from a Next.js API route via subprocess.** The path was tried (`exec`/`execFile` calling `poster.py`) and caused a cascade of failures: broken env loading, missing Referer headers, silent errors, and no way to surface failures to the user. The fix was rewriting the poster in TypeScript (`lib/poster.ts`).

Exception: `/api/scrape` calls `bot/scraper.py` via `execFile` — that's intentional and the only allowed subprocess call.

If you're tempted to add a new Python script and call it from an API route, stop. Either write it in TypeScript, or have GitHub Actions call it on a schedule.

### Python scripts: always resolve paths relative to `__file__`

```python
_dir = os.path.dirname(os.path.abspath(__file__))
load_dotenv(os.path.join(_dir, "../.env.local"))
```

Never use relative paths like `load_dotenv("../.env")` — the working directory changes depending on how the script is invoked (manually, from GitHub Actions, from Next.js).

### Python posters share a `run_poster()` helper in `bot/utils.py`

All three platform posters (`poster.py`, `poster_threads.py`, `poster_instagram.py`) delegate their scheduling and dispatch logic to `run_poster()` in `bot/utils.py`. This function handles:
- DST-correct PT→UTC time conversion via `zoneinfo.ZoneInfo("America/Los_Angeles")`
- A ±2-minute schedule window (GitHub Actions does not fire at exactly the cron minute)
- The approve queue, auto_run fallback, and DB status update

When adding a new platform poster, call `run_poster(platform_key, default_minutes, post_fn, result_field, post_id)` instead of duplicating the logic.

**All Python poster scripts must `import requests` at the top level**, even if the script delegates HTTP calls to helpers — the helpers reference `requests` from their caller's namespace.

### Schedule times are stored as Pacific-time minutes, converted with DST awareness

Post times in MongoDB settings are stored as minutes from midnight in Pacific Time (PT). The posters convert to UTC using `zoneinfo`, which handles PST (UTC-8) vs PDT (UTC-7) automatically. The settings UI labels these "(PST)" as a convention but the underlying offset is always DST-correct.

**Never hardcode `+8 * 60` to convert PT to UTC** — this breaks every summer when PT is UTC-7.

### Posting to X lives in `lib/poster.ts`

`postById(id: string)` downloads media (with CDN headers), uploads to Twitter v1, creates a tweet via v2, and marks the post as `status: "posted"` in MongoDB. This is the single source of truth for user-triggered X posting.

The GitHub Actions `post.yml` workflow uses `bot/poster.py` for scheduled posting — that's fine because it runs in a controlled environment. But the user-triggered "Post now" path goes through `lib/poster.ts`.

### CDN media requires a Referer header

BunnyCDN (`*.b-cdn.net`) and `details.so` use hotlink protection. Any server-side fetch of their media URLs must include:

```
Referer: https://www.details.so
```

This applies in both `lib/social.ts` (`downloadMedia`) and `app/api/proxy/route.ts`. The proxy route also has a domain allowlist — do not remove it.

### The proxy is not a general-purpose proxy

`/api/proxy` only serves `*.b-cdn.net` and `*.details.so` URLs. The allowlist is in `app/api/proxy/route.ts`. If a new source needs proxying, add its domain there explicitly.

### Settings API only accepts known fields

`/api/settings` PATCH validates and allowlists `scrape_interval_hours`, `post_hours_x`, `post_hours_threads`, `post_hours_instagram`, and `auto_run`. Do not spread raw request bodies into MongoDB `$set`.

### MongoDB ObjectId validation before any DB operation

Always validate that an ID is a 24-char hex string before passing it to `new ObjectId()` or any shell command:

```ts
function isValidObjectId(id: string) {
  return /^[0-9a-f]{24}$/.test(id);
}
```

## Two-step approve / post flow

1. **Approve** (PATCH `/api/posts/[id]`) — sets `status: "approved"`. Does nothing else.
2. **Post now** (POST `/api/posts/[id]`) — calls the appropriate lib poster, sets `status: "posted"`.

Approval never auto-triggers posting. The scheduled GitHub Actions posters handle automated posts; "Post now" is the manual override.

## Sources

| Source | File | Method |
|---|---|---|
| bestdesignsonx | `bot/sources/bestdesignsonx.py` | Supabase REST API |
| details.so | `bot/sources/details_so.py` | HTML scrape + JSON extraction |
| awwwards | `bot/sources/awwwards.py` | HTML scrape |
| craftwork | `bot/sources/craftwork.py` | HTML scrape |

Adding a new source: create `bot/sources/newname.py` with a `scrape(posts_collection)` function that returns a count of new posts inserted. Register it in `SOURCES` in `bot/scraper.py`.

## Environment variables

| Variable | Used by |
|---|---|
| `MONGODB_URI` | `lib/mongodb.ts`, all Python scripts |
| `X_API_KEY` | `lib/poster.ts`, `bot/poster.py` |
| `X_API_SECRET` | `lib/poster.ts`, `bot/poster.py` |
| `X_ACCESS_TOKEN` | `lib/poster.ts`, `bot/poster.py` |
| `X_ACCESS_TOKEN_SECRET` | `lib/poster.ts`, `bot/poster.py` |
| `THREADS_USER_ID` | `lib/threads.ts`, `bot/poster_threads.py` |
| `THREADS_ACCESS_TOKEN` | `lib/threads.ts`, `bot/poster_threads.py` |
| `IG_USER_ID` | `lib/instagram.ts`, `bot/poster_instagram.py` |
| `IG_ACCESS_TOKEN` | `lib/instagram.ts`, `bot/poster_instagram.py` |
| `BESTDESIGNSONX_SUPABASE_KEY` | `bot/sources/bestdesignsonx.py` (falls back to hardcoded anon key) |

All variables live in `.env.local`. Python scripts load them via `load_dotenv` with `__file__`-relative paths (see above).

## What not to do

- Don't call Python from Next.js API routes (exception: `/api/scrape` → `bot/scraper.py`)
- Don't use `exec` with template strings — use `execFile` with array args if you must shell out
- Don't spread raw `req.json()` into MongoDB `$set`
- Don't add new proxy targets without adding them to the allowlist in `app/api/proxy/route.ts`
- Don't optimistically remove UI state before confirming the API call succeeded
- Don't hardcode `+8 * 60` for PT→UTC conversion — use `zoneinfo` via `run_poster()`
- Don't copy the `run()` pattern from old poster scripts — call `run_poster()` from `bot/utils.py` instead
