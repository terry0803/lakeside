/* Mini-games: shared helpers. Same session as the assistant page (localStorage "lia.session"), so results show up in its Progress tab. */
"use strict";

const $ = (s, el = document) => el.querySelector(s);
const $$ = (s, el = document) => Array.from(el.querySelectorAll(s));
const esc = (s) => String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
const bi = (en, zh) => `${esc(en)}${zh ? ` <span lang="zh-Hant">${esc(zh)}</span>` : ""}`;
const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
const wait = (ms) => new Promise((r) => setTimeout(r, reduceMotion ? Math.min(ms, 80) : ms));

function el(tag, cls = "", html = "") {
  const e = document.createElement(tag);
  if (cls) e.className = cls;
  if (html) e.innerHTML = html;
  return e;
}

const G = {
  session: (() => {
    let s = null;
    try { s = JSON.parse(localStorage.getItem("lia.session") || "null"); } catch { /* private mode */ }
    if (!s) {
      s = crypto.randomUUID ? crypto.randomUUID().replace(/-/g, "") : String(Date.now()) + Math.random().toString(16).slice(2);
      try { localStorage.setItem("lia.session", JSON.stringify(s)); } catch { /* private mode */ }
    }
    return s;
  })(),
  name: document.body.dataset.game,
  data: null,

  meter(html) { $("#meter").innerHTML = html; },

  async save(score, total) {
    try {
      await fetch("/api/games/result", { method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ session: G.session, game: G.name, score, total }) });
      localStorage.setItem("lia.gamesUpdated", String(Date.now()));   // the assistant page listens for this
    } catch { /* the game still works without the server */ }
  },

  /* "Where the answers come from": the read-only Cypher each game ran, or the content builder when Neo4j is off. */
  foot(d) {
    const f = $("#foot");
    const src = d.source === "neo4j"
      ? bi("Answers read from the Neo4j knowledge graph just now.", "答案剛剛從 Neo4j 知識圖讀出來。")
      // 11/22 evening: the saved copy on GitHub Pages (pages/build_pages.py) read the graph once, on that day
      : d.source === "saved"
        ? bi(`Answers read from the Neo4j knowledge graph on ${d.saved_on} and saved with this copy.`, `答案是 ${d.saved_on} 從 Neo4j 知識圖讀出來、存在這個離線版裡的。`)
        : bi("Neo4j is not running, so the answers come from the same content files that build the graph.", "Neo4j 沒有開，答案改從建知識圖的同一份內容檔讀。");
    // 11/22: the purpose of each query in Chinese too (games.py purpose_zh)
    const rows = (d.queries || []).map((q) => `<li><p>${bi(q.purpose, q.purpose_zh)} · ${q.rows} rows <span lang="zh-Hant">筆</span> · ${q.ms} ms</p><code>${esc(q.cypher)}</code></li>`).join("");
    f.innerHTML = `<details><summary title="Where the answers come from 答案從哪來">Sources <span lang="zh-Hant">來源</span></summary>
      <div class="g-foot-panel"><p>${src}</p><p>${bi(`${d.ms} ms in total.`, `總共 ${d.ms} 毫秒。`)}</p>${rows ? `<ol class="g-q">${rows}</ol>` : ""}</div></details>`;
  },

  /* Back to the tour. The game opens in its own window (the tour's button, or the assistant's Progress tab), so closing
     this window shows the tour again in the room you left. If the browser will not close it (the address was typed in),
     open the assistant with the tour at this game's room instead of starting again at the hot-air balloon. */
  backHref: `/lakeside/?room=${encodeURIComponent(document.body.dataset.room || "")}&back=game`,
  // 11/22 afternoon: opened in the assistant page's own game window (?in=page) instead of a new tab
  // 11/22: the frame tells (our own page, same address); the address parameter alone was lost on "Next case file"
  inPage: (() => { try { return !!window.frameElement && window.frameElement.id === "gameFrame"; } catch { return false; } })(),
  back(e) {
    if (e) e.preventDefault();
    // in the assistant page's game window: ask that page to close the window (the score is already saved)
    if (G.inPage) { try { window.parent.postMessage({ type: "lakeside:game-exit", game: G.name }, location.origin); } catch { /* the page went away */ } return; }
    // 11/21 night: inside iStaging's window (a frame) this page cannot close that window, and going to the assistant page
    // there only stacked a second assistant on top of the tour. Say how to close it instead.
    if (window.self !== window.top) { G.closeHint(e && e.currentTarget); return; }
    window.close();
    setTimeout(() => { if (!window.closed) location.href = G.backHref; }, 300);
  },
  closeHint(near) {
    let n = document.getElementById("gCloseHint");
    if (!n) {
      n = el("div", "g-close-hint", `<p><b>Close this window with the ✕ at the top right</b> to go back to the tour.</p>
        <p lang="zh-Hant">按右上角的 ✕ 關掉這個視窗，就回到導覽。</p>`);
      n.id = "gCloseHint"; n.setAttribute("role", "status");
      document.body.appendChild(n);
    }
    n.classList.remove("is-on"); void n.offsetWidth; n.classList.add("is-on");
    clearTimeout(G._hintT); G._hintT = setTimeout(() => n.classList.remove("is-on"), 6000);
  },

  done(html, again) {
    const box = el("section", "g-end", html);
    const row = el("div", "g-end-actions");
    const a = el("button", "btn", bi("Play again", "再玩一次")); a.type = "button"; a.addEventListener("click", again);
    const b = el("a", "btn btn-ghost", bi("Back to the tour", "回到導覽")); b.href = G.backHref; b.addEventListener("click", G.back);
    row.append(a, b); box.appendChild(row);
    return box;
  },
};

for (const a of $$("[data-back]")) a.addEventListener("click", G.back);

/* One screen, no scrolling (11/21 evening): every game screen sits on a 1440 x 800 canvas (the stage's .rs-body) that is
   scaled to fit the window, like a game. If a screen needs more height the canvas grows and is scaled a little more, so
   nothing is cut off. G.k() is the scale: code that turns pointer movement into CSS pixels inside the canvas divides by it. */
const FIT = { W: 1440, H: 800, k: 1, body: null, obs: null };
G.k = () => FIT.k;
G.fit = function () {
  const rs = $(".rs"), body = rs && $(".rs-body", rs);
  if (!rs || !body) return;
  const sw = rs.clientWidth, sh = rs.clientHeight;
  if (!sw || !sh) return;
  const ch = Math.max(FIT.H, body.offsetHeight);
  const k = Math.max(0.3, Math.min(1.3, sw / FIT.W, sh / ch));
  FIT.k = k;
  const x = Math.round((sw - FIT.W * k) / 2), y = Math.max(0, Math.round((sh - ch * k) / 2));
  body.style.transform = `translate(${x}px, ${y}px) scale(${k})`;
  rs.style.setProperty("--k", String(k));
  document.documentElement.style.setProperty("--k", String(k));
};
G.watchFit = function () {
  document.body.classList.add("is-fit");
  const body = $(".rs-body");
  if (!body) return;
  if (FIT.body !== body) {
    if (FIT.obs) FIT.obs.disconnect();
    FIT.body = body;
    FIT.obs = new ResizeObserver(() => G.fit());
    FIT.obs.observe(body);
    FIT.obs.observe($(".rs"));
  }
  G.fit();
};
window.addEventListener("resize", () => G.fit());

const Games = {};

/* 11/21 night: a game opened from a sign in the tour runs inside iStaging's window. When that tour is itself inside our
   full-screen page, the page's map, buttons and assistant window sat on top of the game. Tell the page around the tour
   that a game is open (and keep saying so every second); it hides them until the messages stop. A page that is not ours
   (iStaging opened directly) ignores the messages. */
/* 11/22: in iStaging's window inside our page the browser keeps this page's storage apart from our page's, so a score
   would go to a new session that our Progress tab never shows. Our page answers "game-open" with its own session. */
window.addEventListener("message", (e) => {
  const d = e.data;
  if (e.origin !== location.origin || !d || d.type !== "lakeside:session" || !d.session || d.session === G.session) return;
  G.session = d.session;
  try { localStorage.setItem("lia.session", JSON.stringify(d.session)); } catch { /* private mode */ }
});

if (window.self !== window.top) {
  const tell = (type) => { try { window.top.postMessage({ type, game: document.body.dataset.game || "" }, "*"); } catch { /* no top */ } };
  tell("lakeside:game-open");
  const beat = setInterval(() => tell("lakeside:game-alive"), 1000);
  window.addEventListener("pagehide", () => { clearInterval(beat); tell("lakeside:game-close"); });
  // 11/22 evening: a link that moves this window to another page (the next case) is not the window closing. Say so first,
  // so the page around the tour keeps its map and buttons away instead of fading them in and straight out again; a real
  // close (iStaging's ✕) then brings them back at once.
  document.addEventListener("click", (e) => {
    const a = e.target instanceof Element ? e.target.closest("a[href]") : null;
    if (!a || e.defaultPrevented || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
    if ((a.target && a.target !== "_self") || a.getAttribute("href").startsWith("#")) return;
    tell("lakeside:game-nav");
    // 11/23 review: in our page's own game window the next case takes this one's place in the history (app.js opens the
    // window with location.replace for the same reason), so the browser's Back button leaves the games instead of walking
    // back through every case. Other links stay as they are.
    if (G.inPage && a.classList.contains("rs-next-case")) { e.preventDefault(); location.replace(a.href); }
  });
}

/* 11/23 (review G1): in our page's own game window the game has the keyboard, so Escape never reached the page around it.
   Here Escape closes the window like the Back button, unless the game used that Escape itself (its pop-ups call
   preventDefault) or something is in the player's hands: a pointer held down (a drag, a slide switch, a pulled string),
   a stamp picked up, a copy being dragged, or the CASE CLOSED card on screen. The listener is on window, so it runs after
   the games' own listeners on the page. */
if (G.inPage) {
  const down = new Set();
  document.addEventListener("pointerdown", (e) => down.add(e.pointerId), true);
  for (const t of ["pointerup", "pointercancel"]) document.addEventListener(t, (e) => down.delete(e.pointerId), true);
  window.addEventListener("blur", () => down.clear());
  const BUSY = ".ah-held, .rx-ghost, .ah-ghost, .mn-line-ghost, .ir-ghost, .ir-cc-ghost, .mn-slide.is-drag, .cb-spool.is-pulling, .cb-closed";
  // Two presses: a player who presses Escape to get rid of a cut scene or a call would otherwise lose the whole shift.
  // The first press only shows a note; a second one within 2.5 s leaves.
  let armed = 0, note = null;
  const hint = () => {
    if (!note) {
      note = document.createElement("div");
      note.setAttribute("role", "status");
      note.style.cssText = "position:fixed;left:50%;top:14px;transform:translateX(-50%);z-index:9999;padding:9px 16px;border-radius:12px;" +
        "background:rgba(13,17,23,.92);border:1px solid rgba(255,255,255,.18);color:#fff;font:600 14px/1.35 system-ui,sans-serif;" +
        "text-align:center;pointer-events:none;transition:opacity .2s";
      note.innerHTML = bi("Press Esc again to leave this case", "再按一次 Esc 離開這個案件");
      document.body.appendChild(note);
    }
    note.style.opacity = "1";
    clearTimeout(hint.t); hint.t = setTimeout(() => { note.style.opacity = "0"; armed = 0; }, 2500);
  };
  window.addEventListener("keydown", (e) => {
    if (e.key !== "Escape" || e.defaultPrevented || e.repeat || e.isComposing || down.size || document.querySelector(BUSY)) return;
    if (armed && performance.now() - armed < 2500) { armed = 0; if (note) note.style.opacity = "0"; G.back(); return; }
    armed = performance.now(); hint();
  });
}

document.addEventListener("DOMContentLoaded", async () => {
  const main = $("#game");
  try {
    const r = await fetch(`/api/games/${G.name}`);
    if (!r.ok) throw new Error(String(r.status));
    G.data = await r.json();
  } catch {
    main.innerHTML = `<p class="g-error">${bi("Could not load the game. Reload this page in a moment.", "讀不到遊戲資料，等一下再重新整理這一頁。")}</p>`;
    return;
  }
  G.foot(G.data);
  main.innerHTML = "";
  Games[G.name](G.data, main);
});

/* 11/22 afternoon: a ripple of light from where a button is pressed (liquid.css). Inside the scaled stage the button's own
   pixels are the canvas pixels, so the pointer position is divided by the stage's scale. */
document.addEventListener("pointerdown", (e) => {
  if (reduceMotion || e.button > 0) return;
  const b = e.target instanceof Element ? e.target.closest(".btn, .g-back, .g-sound, .cb-title-go, .rs-next-case, .g-foot summary") : null;
  if (!b || b.disabled) return;
  const r = b.getBoundingClientRect(), k = b.closest(".rs-body") ? G.k() || 1 : 1;
  if (getComputedStyle(b).position === "static") b.style.position = "relative";
  const wrap = document.createElement("span"), w = document.createElement("span");
  wrap.className = "g-ripple-wrap"; w.className = "g-ripple";
  w.style.cssText = `--x:${Math.round((e.clientX - r.left) / k)}px;--y:${Math.round((e.clientY - r.top) / k)}px;--s:${Math.round((Math.max(r.width, r.height) * 2.4) / k)}px`;
  wrap.appendChild(w); b.appendChild(wrap);
  setTimeout(() => wrap.remove(), 650);
}, { passive: true });
