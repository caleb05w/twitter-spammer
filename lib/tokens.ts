import { getDb } from "./mongodb";

// Meta access tokens, stored in the `settings` document so a cron can renew
// them. Env vars are read-only at runtime, which is why the original 60-day
// tokens silently died on 2026-07-31: nothing could write a refreshed one back.
//
// Resolution order is DB first, then env. Paste a freshly minted token into
// Vercel and the refresh cron migrates it into the DB on its next run; from
// then on the DB copy is the live one.

const THREADS_GRAPH = "https://graph.threads.net";
const FB_GRAPH = "https://graph.facebook.com/v21.0";
const TIMEOUT = 15_000;

export type TokenSettings = {
  threads_access_token?: string;
  threads_token_expires_at?: Date;
  threads_token_refreshed_at?: Date;
  ig_access_token?: string;
  // null = a Page token, which never expires.
  ig_token_expires_at?: Date | null;
  ig_token_refreshed_at?: Date;
};

export type RefreshResult =
  | { status: "refreshed"; source: "db" | "env"; expiresAt: Date | null; note?: string }
  | { status: "skipped"; reason: string }
  | { status: "failed"; error: string };

async function tokenSettings(): Promise<TokenSettings> {
  const db = await getDb();
  return ((await db.collection("settings").findOne({ _id: "global" as never })) ?? {}) as TokenSettings;
}

async function saveTokenSettings(update: Partial<TokenSettings>): Promise<void> {
  const db = await getDb();
  await db.collection("settings").updateOne({ _id: "global" as never }, { $set: update }, { upsert: true });
}

export async function getThreadsToken(): Promise<string> {
  const token = (await tokenSettings()).threads_access_token || process.env.THREADS_ACCESS_TOKEN;
  if (!token) throw new Error("No Threads access token: set THREADS_ACCESS_TOKEN");
  return token;
}

export async function getInstagramToken(): Promise<string> {
  const token = (await tokenSettings()).ig_access_token || process.env.IG_ACCESS_TOKEN;
  if (!token) throw new Error("No Instagram access token: set IG_ACCESS_TOKEN");
  return token;
}

type Json = Record<string, unknown> & { data?: any; error?: { code?: number; message?: string } }; // eslint-disable-line @typescript-eslint/no-explicit-any

async function graphGet(url: string): Promise<Json> {
  const res = await fetch(url, { signal: AbortSignal.timeout(TIMEOUT), cache: "no-store" });
  const json = await res.json().catch(() => ({}));
  if (json.error) throw new Error(`code ${json.error.code}: ${json.error.message}`);
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return json;
}

// Threads long-lived tokens last 60 days and can be refreshed any time after
// they are 24h old, as long as they have not expired. Refreshing resets the
// clock to 60 days. An expired token can never be refreshed, only re-minted.
const THREADS_REFRESH_EVERY_MS = 7 * 86_400_000;

export async function refreshThreadsToken(): Promise<RefreshResult> {
  const s = await tokenSettings();
  const refreshedAt = s.threads_token_refreshed_at ? new Date(s.threads_token_refreshed_at) : undefined;
  if (s.threads_access_token && refreshedAt && Date.now() - refreshedAt.getTime() < THREADS_REFRESH_EVERY_MS) {
    return { status: "skipped", reason: `refreshed ${Math.round((Date.now() - refreshedAt.getTime()) / 3_600_000)}h ago` };
  }

  const candidates: { source: "db" | "env"; token: string }[] = [];
  if (s.threads_access_token) candidates.push({ source: "db", token: s.threads_access_token });
  if (process.env.THREADS_ACCESS_TOKEN && process.env.THREADS_ACCESS_TOKEN !== s.threads_access_token)
    candidates.push({ source: "env", token: process.env.THREADS_ACCESS_TOKEN });
  if (candidates.length === 0) return { status: "failed", error: "no Threads token in DB or env" };

  const errors: string[] = [];
  for (const { source, token } of candidates) {
    try {
      const json = await graphGet(
        `${THREADS_GRAPH}/refresh_access_token?grant_type=th_refresh_token&access_token=${encodeURIComponent(token)}`
      );
      const expiresAt = new Date(Date.now() + Number(json.expires_in ?? 60 * 86_400) * 1000);
      await saveTokenSettings({
        threads_access_token: String(json.access_token),
        threads_token_expires_at: expiresAt,
        threads_token_refreshed_at: new Date(),
      });
      return { status: "refreshed", source, expiresAt };
    } catch (e) {
      errors.push(`${source}: ${e instanceof Error ? e.message : String(e)}`);
    }
  }
  return { status: "failed", error: errors.join("; ") };
}

// Instagram posts through the Facebook Graph API, where a Page access token
// derived from a long-lived user token never expires. So instead of refreshing
// on a schedule, swap the user token for the Page token once and be done.
//
// When the Facebook user has no Page linked (this account: /me/accounts is
// empty), fall back to re-exchanging the long-lived user token through
// fb_exchange_token, which needs FB_APP_SECRET and hands back a fresh 60 days.
const IG_REFRESH_EVERY_MS = 7 * 86_400_000;

export async function refreshInstagramToken(): Promise<RefreshResult> {
  const s = await tokenSettings();
  if (s.ig_access_token && s.ig_token_expires_at === null) {
    return { status: "skipped", reason: "stored token is a non-expiring Page token" };
  }
  const igRefreshedAt = s.ig_token_refreshed_at ? new Date(s.ig_token_refreshed_at) : undefined;
  if (s.ig_access_token && igRefreshedAt && Date.now() - igRefreshedAt.getTime() < IG_REFRESH_EVERY_MS) {
    return { status: "skipped", reason: `refreshed ${Math.round((Date.now() - igRefreshedAt.getTime()) / 3_600_000)}h ago` };
  }
  const igUserId = process.env.IG_USER_ID;
  if (!igUserId) return { status: "failed", error: "IG_USER_ID not set" };

  const candidates: { source: "db" | "env"; token: string }[] = [];
  if (s.ig_access_token) candidates.push({ source: "db", token: s.ig_access_token });
  if (process.env.IG_ACCESS_TOKEN && process.env.IG_ACCESS_TOKEN !== s.ig_access_token)
    candidates.push({ source: "env", token: process.env.IG_ACCESS_TOKEN });
  if (candidates.length === 0) return { status: "failed", error: "no Instagram token in DB or env" };

  const errors: string[] = [];
  for (const { source, token } of candidates) {
    try {
      const t = encodeURIComponent(token);
      const debug = await graphGet(`${FB_GRAPH}/debug_token?input_token=${t}&access_token=${t}`);
      if (!debug.data?.is_valid) throw new Error(debug.data?.error?.message ?? "token invalid");

      // Already a Page token that never expires: just adopt it.
      if (debug.data.type === "PAGE" && !debug.data.expires_at) {
        await saveTokenSettings({ ig_access_token: token, ig_token_expires_at: null, ig_token_refreshed_at: new Date() });
        return { status: "refreshed", source, expiresAt: null, note: "adopted existing Page token" };
      }

      const pages = await graphGet(
        `${FB_GRAPH}/me/accounts?fields=id,name,access_token,instagram_business_account&access_token=${t}`
      );
      const list: { id: string; name: string; access_token?: string; instagram_business_account?: { id: string } }[] =
        pages.data ?? [];
      const page = list.find((p) => p.instagram_business_account?.id === igUserId) ?? (list.length === 1 ? list[0] : undefined);
      if (!page?.access_token) {
        const secret = process.env.FB_APP_SECRET;
        const appId = String(debug.data.app_id ?? process.env.FB_APP_ID ?? "");
        if (!secret || !appId) {
          throw new Error(
            `no Page linked to IG user ${igUserId} (pages seen: ${list.map((p) => p.name).join(", ") || "none"}); ` +
              "set FB_APP_SECRET to enable user-token refresh instead"
          );
        }
        const exchanged = await graphGet(
          `${FB_GRAPH}/oauth/access_token?grant_type=fb_exchange_token&client_id=${encodeURIComponent(appId)}` +
            `&client_secret=${encodeURIComponent(secret)}&fb_exchange_token=${t}`
        );
        const expiresAt = exchanged.expires_in
          ? new Date(Date.now() + Number(exchanged.expires_in) * 1000)
          : null;
        await saveTokenSettings({
          ig_access_token: String(exchanged.access_token),
          ig_token_expires_at: expiresAt,
          ig_token_refreshed_at: new Date(),
        });
        return { status: "refreshed", source, expiresAt, note: "re-exchanged long-lived user token (no Page available)" };
      }

      const pt = encodeURIComponent(page.access_token);
      const pageDebug = await graphGet(`${FB_GRAPH}/debug_token?input_token=${pt}&access_token=${pt}`);
      const expiresAt = pageDebug.data?.expires_at ? new Date(pageDebug.data.expires_at * 1000) : null;
      await saveTokenSettings({
        ig_access_token: page.access_token,
        ig_token_expires_at: expiresAt,
        ig_token_refreshed_at: new Date(),
      });
      return {
        status: "refreshed",
        source,
        expiresAt,
        note: expiresAt
          ? `Page "${page.name}" token still expires — user token was short-lived; extend it and re-run`
          : `swapped to non-expiring Page token for "${page.name}"`,
      };
    } catch (e) {
      errors.push(`${source}: ${e instanceof Error ? e.message : String(e)}`);
    }
  }
  return { status: "failed", error: errors.join("; ") };
}
