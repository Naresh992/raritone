/* Raritone extension — background service worker.
 * Owns API calls (login, usage, analytics) + opens the Live Studio with an
 * external garment. Secrets never touch page contexts: the content script
 * only sends image URLs + coarse dimensions.
 */

const DEFAULTS = {
  apiBase: "http://localhost:8000",
  siteBase: "http://localhost:3000",
  token: "",
  userName: "",
};

async function store() {
  const s = await chrome.storage.local.get(Object.keys(DEFAULTS));
  return { ...DEFAULTS, ...s };
}

/* Anonymous activation funnel — fire-and-forget, never blocks UX.
 * Allow-listed server-side (/api/events); no PII, only name + tiny props. */
async function track(name, props = {}) {
  try {
    const s = await store();
    await fetch(s.apiBase.replace(/\/$/, "") + "/api/events", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ events: [{ name, props }] }),
    });
  } catch { /* analytics must never break the product */ }
}

async function api(path, { method = "GET", body = null, auth = true, op = "api" } = {}) {
  const s = await store();
  const headers = {};
  if (body && !(body instanceof FormData)) headers["Content-Type"] = "application/json";
  if (auth && s.token) headers["Authorization"] = `Bearer ${s.token}`;
  try {
    const res = await fetch(s.apiBase.replace(/\/$/, "") + path, {
      method,
      headers,
      body: body ? (typeof body === "string" ? body : JSON.stringify(body)) : undefined,
    });
    const text = await res.text();
    let data = null;
    try { data = text ? JSON.parse(text) : null; } catch { data = text; }
    if (!res.ok) {
      const msg = (data && (data.detail || data.message)) || `Request failed (${res.status})`;
      track("extension_error", { op, status: res.status });
      throw new Error(msg);
    }
    return data;
  } catch (e) {
    if (!(e && e.message && /Request failed|extension_error/.test(e.message))) {
      track("extension_error", { op });
    }
    throw e;
  }
}

async function openLive(imageUrl, source) {
  const s = await store();
  const q = new URLSearchParams();
  if (imageUrl) q.set("img", imageUrl);
  if (source) q.set("src", source);
  const url = `${s.siteBase.replace(/\/$/, "")}/app/live?${q.toString()}`;
  await chrome.tabs.create({ url });
  track("extension_studio_open", { src: source || "" });
}

chrome.runtime.onInstalled.addListener((details) => {
  if (details.reason === "install") track("extension_installed", { ext_version: chrome.runtime.getManifest().version });
});

chrome.runtime.onMessage.addListener((msg, _sender, sendResponse) => {
  (async () => {
    if (msg.type === "RARITONE_LOGIN") {
      const data = await api("/api/auth/email/login", {
        method: "POST",
        body: { email: msg.email, password: msg.password },
        auth: false,
        op: "login",
      });
      await chrome.storage.local.set({ token: data.token, userName: data.user?.name || data.user?.email || "" });
      sendResponse({ ok: true, userName: data.user?.name || data.user?.email || "" });
    } else if (msg.type === "RARITONE_LOGOUT") {
      await chrome.storage.local.set({ token: "", userName: "" });
      sendResponse({ ok: true });
    } else if (msg.type === "RARITONE_STATUS") {
      const s = await store();
      sendResponse({ ok: true, signedIn: !!s.token, userName: s.userName, apiBase: s.apiBase, siteBase: s.siteBase });
    } else if (msg.type === "RARITONE_USAGE") {
      const u = await api("/api/v1/live-vto/usage", { op: "usage" });
      sendResponse({ ok: true, usage: { totalSessions: u.totalSessions, quotaPerHour: u.quotaPerHour } });
    } else if (msg.type === "RARITONE_OPEN_LIVE") {
      await openLive(msg.imageUrl, msg.source);
      sendResponse({ ok: true });
    } else if (msg.type === "RARITONE_TRACK") {
      track(msg.name, msg.props || {});
      sendResponse({ ok: true });
    } else {
      sendResponse({ ok: false, error: "unknown message" });
    }
  })().catch((e) => sendResponse({ ok: false, error: e.message || String(e) }));
  return true; // async response
});
