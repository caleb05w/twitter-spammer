<!-- BEGIN:nextjs-agent-rules -->
# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` before writing any code. Heed deprecation notices.
<!-- END:nextjs-agent-rules -->

# Design Scrape — Agent Context

## Stack

- **Next.js 16** (non-standard version — read `node_modules/next/dist/docs/` before writing any route handler or config)
- **MongoDB** via `lib/mongodb.ts` — promise-based singleton, always use `getDb()`
- **Python** for scraping only (`bot/scraper.py`, `bot/sources/`)
- **TypeScript** for everything that touches the Next.js runtime, including posting to X

## Architecture decisions

### Two runtimes, strict separation

The scraper is Python because BeautifulSoup is the right tool for HTML scraping. Everything else — API routes, posting to X, DB writes from the web — is TypeScript.

**Never call Python from a Next.js API route via subprocess.** The path was tried (`exec`/`execFile` calling `poster.py`) and caused a cascade of failures: broken env loading, missing Referer headers, silent errors, and no way to surface failures to the user. The fix was rewriting the poster in TypeScript (`lib/poster.ts`).

If you're tempted to add a new Python script and call it from an API route, stop. Either write it in TypeScript, or have GitHub Actions call it on a schedule.

### Python scripts: always resolve paths relative to `__file__`

```python
_dir = os.path.dirname(os.path.abspath(__file__))
load_dotenv(os.path.join(_dir, "../.env.local"))
```

Never use relative paths like `load_dotenv("../.env")` — the working directory changes depending on how the script is invoked (manually, from GitHub Actions, from Next.js).

### Posting to X lives in `lib/poster.ts`

`postById(id: string)` downloads media (with CDN headers), uploads to Twitter v1, creates a tweet via v2, and marks the post as `status: "posted"` in MongoDB. This is the single source of truth for posting logic.

The GitHub Actions `post.yml` workflow still uses `bot/poster.py` for scheduled posting — that's fine because it runs in a controlled environment. But the user-triggered "Post now" path goes through `lib/poster.ts`.

### CDN media requires a Referer header

BunnyCDN (`*.b-cdn.net`) and `details.so` use hotlink protection. Any server-side fetch of their media URLs must include:

```
Referer: https://www.details.so
```

This applies in both `lib/poster.ts` (downloading for upload to Twitter) and `app/api/proxy/route.ts` (proxying for the browser). The proxy route also has a domain allowlist — do not remove it.

### The proxy is not a general-purpose proxy

`/api/proxy` only serves `*.b-cdn.net` and `*.details.so` URLs. The allowlist is in `app/api/proxy/route.ts`. If a new source needs proxying, add its domain there explicitly.

### Settings API only accepts known fields

`/api/settings` PATCH validates and allowlists `scrape_interval_hours` and `post_hour_pst`. Do not spread raw request bodies into MongoDB `$set`.

### MongoDB ObjectId validation before any DB operation

Always validate that an ID is a 24-char hex string before passing it to `new ObjectId()` or any shell command:

```ts
function isValidObjectId(id: string) {
  return /^[0-9a-f]{24}$/.test(id);
}
```

## Two-step approve / post flow

1. **Approve** (PATCH `/api/posts/[id]`) — sets `status: "approved"`. Does nothing else.
2. **Post now** (POST `/api/posts/[id]`) — calls `lib/poster.ts`, posts to X, sets `status: "posted"`.

Approval never auto-triggers posting. The scheduled GitHub Actions poster handles the daily automated post; "Post now" is the manual override.

## Sources

| Source | File | Method |
|---|---|---|
| bestdesignsonx | `bot/sources/bestdesignsonx.py` | Supabase REST API |
| details.so | `bot/sources/details_so.py` | HTML scrape + JSON extraction |

Adding a new source: create `bot/sources/newname.py` with a `scrape(posts_collection)` function that returns a count of new posts inserted. Register it in `SOURCES` in `bot/scraper.py`.

## Environment variables

| Variable | Used by |
|---|---|
| `MONGODB_URI` | `lib/mongodb.ts`, both Python scripts |
| `X_API_KEY` | `lib/poster.ts`, `bot/poster.py` |
| `X_API_SECRET` | `lib/poster.ts`, `bot/poster.py` |
| `X_ACCESS_TOKEN` | `lib/poster.ts`, `bot/poster.py` |
| `X_ACCESS_TOKEN_SECRET` | `lib/poster.ts`, `bot/poster.py` |
| `BESTDESIGNSONX_SUPABASE_KEY` | `bot/sources/bestdesignsonx.py` (falls back to hardcoded anon key) |

All variables live in `.env.local`. Python scripts load them via `load_dotenv` with `__file__`-relative paths (see above).

## What not to do

- Don't call Python from Next.js API routes
- Don't use `exec` with template strings — use `execFile` with array args if you must shell out
- Don't spread raw `req.json()` into MongoDB `$set`
- Don't add new proxy targets without adding them to the allowlist in `app/api/proxy/route.ts`
- Don't optimistically remove UI state before confirming the API call succeeded
