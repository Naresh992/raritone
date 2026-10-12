/* Raritone popup logic */
const $ = (id) => document.getElementById(id);
const msg = (t, cls = "") => { const m = $("msg"); m.textContent = t; m.className = cls; };

function send(type, extra = {}) {
  return new Promise((resolve) => chrome.runtime.sendMessage({ type, ...extra }, resolve));
}

async function refresh() {
  const st = await send("RARITONE_STATUS");
  $("loginView").style.display = st.signedIn ? "none" : "block";
  $("appView").style.display = st.signedIn ? "block" : "none";
  $("apiBase").value = st.apiBase || "";
  $("siteBase").value = st.siteBase || "";
  if (st.signedIn) {
    let usage = "";
    try {
      const u = await send("RARITONE_USAGE");
      if (u.ok) usage = ` · ${u.usage.totalSessions} sessions (quota ${u.usage.quotaPerHour}/hr)`;
    } catch {}
    $("status").textContent = `Signed in as ${st.userName || "you"}${usage}`;
  }
}

$("loginBtn").addEventListener("click", async () => {
  msg("");
  const r = await send("RARITONE_LOGIN", { email: $("email").value.trim(), password: $("password").value });
  if (r.ok) { msg("Signed in — happy trying!", "ok"); refresh(); }
  else msg(r.error || "Sign-in failed", "err");
});

$("logoutBtn").addEventListener("click", async () => { await send("RARITONE_LOGOUT"); refresh(); });

$("tryBtn").addEventListener("click", async () => {
  const url = $("imgUrl").value.trim();
  if (url && !url.startsWith("https://")) { msg("Image URL must start with https://", "err"); return; }
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  let host = "";
  try { host = new URL(tab.url).hostname; } catch {}
  const r = await send("RARITONE_OPEN_LIVE", { imageUrl: url || null, source: host || null });
  if (!r.ok) msg(r.error || "Could not open studio", "err");
  else window.close();
});

$("looksBtn").addEventListener("click", async () => {
  const st = await send("RARITONE_STATUS");
  chrome.tabs.create({ url: `${(st.siteBase || "").replace(/\/$/, "")}/app/looks` });
});

$("saveBtn").addEventListener("click", async () => {
  await chrome.storage.local.set({ apiBase: $("apiBase").value.trim(), siteBase: $("siteBase").value.trim() });
  msg("Settings saved", "ok");
});

refresh();
