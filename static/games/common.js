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
    // 11/26 (review): a refused save (busy, too many visitors) looked saved; now it says so and is kept for this page
    // 11/26 (regression R09): an answer that comes back after a newer save started (Play again, finished again) is stale
    const ticket = (G.saveN = (G.saveN || 0) + 1);
    try {
      const r = await fetch("/api/games/result", { method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ session: G.session, game: G.name, score, total }) });
      if (!r.ok) throw new Error(String(r.status));
      if (ticket === G.saveN) {   // 11/26 (regression R09): a newer round's note and G.unsaved are not this save's to clear
        G.unsaved = null;
        const old = document.getElementById("gSaveErr"); if (old) old.remove();   // 11/26 (front-end review K23): an earlier failure's note goes
      }
      // 11/26 (front-end review K24): blocked storage (a third-party frame, incognito) must not turn a stored score into "not saved"
      try { localStorage.setItem("lia.gamesUpdated", String(Date.now())); } catch { /* storage blocked; the parent refreshes on game-close */ }   // the assistant page listens for this
      return true;
    } catch {
      if (ticket !== G.saveN) return false;   // 11/26 (regression R09): stale, see above
      G.unsaved = { game: G.name, score, total };
      // 11/26 (front-end review K23): #game is the stage (overflow hidden, filled by .rs), so a note added after it was clipped
      // away. It now goes into the results card itself, and one note is reused when "Play again" fails again.
      let n = document.getElementById("gSaveErr");
      if (!n) { n = el("p", "g-error g-save-err"); n.id = "gSaveErr"; n.setAttribute("role", "alert"); }
      n.innerHTML = bi("Score not saved: the server is busy or off. Try again in a few minutes.", "分數沒有存到：伺服器忙或沒開，過幾分鐘再試一次。");
      // 11/26 (regression R09): only into this round's results card. The #rsBody fallback put a slow failure inside the
      // next shift's canvas after "Play again"; with the card gone the note is skipped (G.unsaved still keeps the score)
      const card = $(".rs-finale .g-end"), row = card && $(".g-end-actions", card);
      if (row) card.insertBefore(n, row);
      else if (n.isConnected) n.remove();
      return false;
    }
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
  // 11/26 (front-end review K25): the floor was 0.3, so a frame narrower than 432 px (a phone) cut the canvas off on both
  // sides; the floor is now only a guard against a zero scale
  const k = Math.max(0.05, Math.min(1.3, sw / FIT.W, sh / ch));
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
// 11/23: our own pages (app.js OURS); the page around the tour may be on another of them (http://localhost:3000)
const OURS_G = [location.origin, "https://lakeside.taila701b6.ts.net", "https://terry0803.github.io", "http://127.0.0.1:8780", "http://localhost:8780", "http://localhost:3000", "http://127.0.0.1:3000"];
window.addEventListener("message", (e) => {
  const d = e.data;
  if (!OURS_G.includes(e.origin) || !d || d.type !== "lakeside:session" || !d.session || d.session === G.session) return;
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
  const BUSY = ".ah-held, .rx-ghost, .ah-ghost, .mn-line-ghost, .ir-ghost, .ir-cc-ghost, .mn-slide.is-drag, .cb-spool.is-pulling, .cb-closed, #gh:not([hidden])";
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

/* ------------------------------------------------------------------ Help 求助 (11/27)
   The user (11/27): 「感覺現在遊戲有點不知道在玩甚麼，都沒說得夠清楚該怎麼玩，並且錯了也不能問小幫手」. A Help button in
   the bar opens a panel over the stage and pauses the game. It shows the goal of this case, what to do on the screen you
   are on (the chapter tells, G.help.setNow), why your last mistake was one (G.help.mistake; the chapter also says it on
   the spot), and the IT Assistant: the same local model and knowledge graph as the assistant page, told what you are
   looking at (POST /api/games/ask, which builds its facts from its own copy of the game, never from text the page sends).
   The panel sits outside the scaled 1440 x 800 canvas, so its text keeps its size. */
G.help = (() => {
  const H = { now: null, mistakes: [], open: false, ours: false, busy: false, opener: null, root: null };
  const QSVG = `<svg viewBox="0 0 20 20" aria-hidden="true"><circle cx="10" cy="10" r="8.2" fill="none" stroke="currentColor" stroke-width="1.6"/><path d="M7.7 7.6a2.4 2.4 0 1 1 3.3 2.3c-.7.3-1 .8-1 1.5v.3" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round"/><circle cx="10" cy="14.3" r="1" fill="currentColor"/></svg>`;
  // the assistant page's language setting (Auto / English / 中文), the same storage key
  const pref = () => { try { const v = JSON.parse(localStorage.getItem("lia.lang") || "null"); return v === "en" || v === "zh" ? v : "auto"; } catch { return "auto"; } };
  const zhFirst = () => pref() === "zh" || (pref() === "auto" && /^zh/i.test(navigator.language || ""));
  const story = () => (G.data && G.data.story) || {};
  const pauseBtn = () => document.querySelector("#meter [data-pause]");
  const paused = () => { const b = pauseBtn(); return !!b && b.getAttribute("aria-pressed") === "true"; };
  const nowInfo = () => { try { return typeof H.now === "function" ? H.now() || null : null; } catch (e) { console.error(e); return null; } };
  const lines = (a) => (a || []).filter((x) => x && (x.en || x.zh));

  function md(s) {   // the assistant page's renderer: bold, numbered and bulleted lists, paragraphs
    const rows = esc(s).replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>").split(/\n/);
    let html = "", list = null;
    for (const raw of rows) {
      const line = raw.trim();
      const ol = line.match(/^(\d+)[.)、]\s+(.*)$/), ul = line.match(/^[-*•]\s+(.*)$/);
      if (ol || ul) {
        const want = ol ? "ol" : "ul";
        if (list !== want) { if (list) html += `</${list}>`; html += `<${want}>`; list = want; }
        html += `<li>${ol ? ol[2] : ul[1]}</li>`;
      } else {
        if (list) { html += `</${list}>`; list = null; }
        if (line) html += `<p>${line}</p>`;
      }
    }
    if (list) html += `</${list}>`;
    return html;
  }

  function build() {
    if (H.root) return H.root;
    const root = el("div", "gh");
    root.id = "gh"; root.hidden = true;
    root.innerHTML = `<div class="gh-shade" data-gh-close></div>
      <aside class="gh-panel" role="dialog" aria-modal="true" aria-labelledby="ghTitle">
        <header class="gh-head"><div><h2 id="ghTitle">${bi("Help", "求助")}</h2><p class="gh-state" id="ghState"></p></div>
          <button type="button" class="gh-x" data-gh-close aria-label="Close help 關閉求助"></button></header>
        <div class="gh-scroll" id="ghScroll"><div id="ghInfo"></div>
          <h3 class="gh-ask-h">${bi("Ask the IT Assistant", "問小幫手")}</h3>
          <p class="gh-ask-note">${bi("It knows which case you are in and what is on your screen.", "它知道你在玩哪一案、畫面上是什麼。")}</p>
          <div class="gh-thread" id="ghThread" aria-live="polite"></div></div>
        <div class="gh-foot"><div class="gh-chips" id="ghChips"></div>
          <form class="gh-form" id="ghForm" autocomplete="off"><label class="gh-sr" for="ghIn">Your question 你的問題</label>
            <input id="ghIn" type="text" maxlength="500" placeholder="Type a question 輸入你的問題">
            <button type="submit" class="btn gh-send">${bi("Ask", "問")}</button></form></div>
      </aside>`;
    document.body.appendChild(root);
    for (const x of $$("[data-gh-close]", root)) x.addEventListener("click", close);
    $("#ghForm", root).addEventListener("submit", (e) => {
      e.preventDefault();
      const inp = $("#ghIn", root), q = inp.value.trim();
      if (!q || H.busy) return;
      inp.value = "";
      ask(q);
    });
    H.root = root;
    return root;
  }

  /* The game's own keys (Delete, arrows, Space, digits, Escape...) listen on the page. While the panel is open every key is
     stopped at the window, before anything else hears it; typing, Enter in the box and buttons still work (those are the
     keys' default actions). 11/27 review: the keys used to be stopped on the panel only, and a click on the panel's text
     dropped the focus to the page, from where Esc twice left the case and digits went into the board's keypad. */
  function keyGuard(e) {
    if (!H.open) return;
    e.stopPropagation();
    if (e.type === "keydown" && e.key === "Escape" && !e.isComposing && e.keyCode !== 229) {
      e.preventDefault();
      close();
      // 11/27 regression review: Esc held down repeats after the panel is gone (mfa closed its phone app, a board its reader)
      const swallow = (k) => { if (k.key === "Escape" && k.repeat) { k.stopPropagation(); k.preventDefault(); } };   // repeats only: a missed keyup can't eat a new press
      const release = (k) => { if (k.key === "Escape") { window.removeEventListener("keydown", swallow, true); window.removeEventListener("keyup", release, true); } };
      window.addEventListener("keydown", swallow, true);
      window.addEventListener("keyup", release, true);
    }
  }
  const KEYS = ["keydown", "keyup", "keypress"];

  function sec(cls, h, body) { return `<section class="gh-sec ${cls}"><h3>${h}</h3>${body}</section>`; }

  function render() {
    const s = story(), n = nowInfo(), m = H.mistakes[0];
    let html = "";
    if (s.goal_en) html += sec("gh-goal", bi("Your goal", "你的任務"), `<p>${bi(s.goal_en, s.goal_zh)}</p>`);
    if (m) {
      const older = H.mistakes.slice(1, 4);
      html += sec("gh-why", bi("Why that went wrong", "剛剛為什麼錯"),
        `<p class="gh-why-t">${m.at ? `<time>${esc(m.at)}</time>` : ""}${bi(m.title_en || "", m.title_zh || "")}</p>
        ${lines(m.why).length ? `<ul>${lines(m.why).map((w) => `<li>${bi(w.en, w.zh)}</li>`).join("")}</ul>` : ""}
        ${older.length ? `<details class="gh-older"><summary>${bi("Earlier mistakes", "之前錯的")}</summary><ul>${older.map((o) => `<li>${o.at ? `<time>${esc(o.at)}</time>` : ""}${bi(o.title_en || "", o.title_zh || "")}${lines(o.why).length ? `<span class="gh-older-why">${lines(o.why).map((w) => bi(w.en, w.zh)).join(" ")}</span>` : ""}</li>`).join("")}</ul></details>` : ""}`);
    }
    if (n && lines(n.steps).length) {
      html += sec("gh-now", bi(n.title_en || "Right now", n.title_zh || "現在要做的事"), `<ol>${lines(n.steps).map((x) => `<li>${bi(x.en, x.zh)}</li>`).join("")}</ol>`);
    }
    const rules = lines(s.rules);
    if (rules.length) {
      html += `<details class="gh-sec gh-rules"${n && lines(n.steps).length ? "" : " open"}><summary>${bi("All the rules of this case", "這一案的全部規則")}</summary><ol>${rules.map((r) => `<li>${bi(r.en, r.zh)}</li>`).join("")}</ol></details>`;
    }
    $("#ghInfo", H.root).innerHTML = html;
    $("#ghState", H.root).innerHTML = H.ours ? bi("The game is paused while this is open.", "這個打開時，遊戲會暫停。") : "";
    renderChips();
  }

  function chipList() {
    const out = [], m = H.mistakes[0], n = nowInfo();
    if (m) {
      out.push({ en: "Why was that wrong?", zh: "剛剛為什麼錯？", ctx: { ...(m.ctx || {}), mistake: true } });
      out.push({ en: "How do I spot it next time?", zh: "下次要怎麼看出來？", ctx: { ...(m.ctx || {}), mistake: true } });
    }
    for (const c of lines(n && n.chips)) out.push(c);
    out.push({ en: "What should I do now?", zh: "我現在該做什麼？" });
    const seen = new Set();
    return out.filter((c) => !seen.has(c.en) && seen.add(c.en)).slice(0, 5);
  }

  function renderChips() {
    const box = $("#ghChips", H.root);
    box.innerHTML = "";
    for (const c of chipList()) {
      const b = el("button", "gh-chip", bi(c.en, c.zh));
      b.type = "button"; b.disabled = H.busy;
      b.addEventListener("click", () => ask(zhFirst() ? c.zh || c.en : c.en || c.zh, c.ctx));
      box.appendChild(b);
    }
  }

  function busy(on) {
    H.busy = on;
    if (!H.root) return;
    for (const b of $$(".gh-chip, .gh-send", H.root)) b.disabled = on;
    $("#ghThread", H.root).setAttribute("aria-busy", on ? "true" : "false");
  }

  function scroll(force) {   // 11/27 review: words streaming in kept pulling a reader who had scrolled up back down
    const sc = $("#ghScroll", H.root);
    if (sc && (force || sc.scrollHeight - sc.scrollTop - sc.clientHeight < 90)) sc.scrollTop = sc.scrollHeight;
  }

  function bubble(cls, html) {
    const d = el("div", "gh-msg " + cls, html);
    $("#ghThread", H.root).appendChild(d);
    scroll(true);
    return d;
  }

  async function ask(text, extra) {
    text = String(text || "").trim().slice(0, 500);
    if (!text) return;
    if (!H.open) open();
    if (H.busy) {   // 11/27 review: a second question while one is answered used to do nothing at all
      // 11/27 regression review: kept with its own ids and sent when this answer ends (put in the box it lost the mistake's ids)
      if (!$(".gh-busy-note", H.root)) bubble("is-bot gh-busy-note", `<p class="gh-wait">${bi("Your next question goes as soon as this answer ends.", "這題回答完，就接著問你的下一題。")}</p>`);
      H.pending = { text, extra };
      return;
    }
    busy(true);
    const old = $(".gh-busy-note", H.root); if (old) old.remove();
    // 11/27 review: a question about a mistake is asked with that mistake's own ids only; merged with the screen's, a mistake
    // without an item took the item on screen (another email, another form) and the assistant explained the wrong one
    const ctx = extra && extra.mistake ? { ...extra } : { ...((nowInfo() || {}).ctx || {}), ...(extra || {}) };
    bubble("is-you", `<p>${esc(text)}</p>`);
    // the answer has its own element, so a late "replace" never wipes the error line under it (11/27 review)
    const bot = bubble("is-bot", `<div class="gh-ans"><p class="gh-wait"><span class="gh-dots" aria-hidden="true"><i></i><i></i><i></i></span>${bi("Looking it up", "查資料中")}</p></div>`);
    const ans = $(".gh-ans", bot);
    let txt = "", finished = false, resp = null, stalled = false, idle = null;
    const ctl = typeof AbortController === "function" ? new AbortController() : null;
    const wake = () => { clearTimeout(idle); idle = setTimeout(() => { stalled = true; if (ctl) ctl.abort(); }, 90000); };
    const errLine = (html) => bot.insertAdjacentHTML("beforeend", `<p class="gh-err">${html}</p>`);
    wake();
    try {
      resp = await fetch("/api/games/ask", { method: "POST", headers: { "Content-Type": "application/json" }, signal: ctl ? ctl.signal : undefined,
        body: JSON.stringify({ session: G.session, game: G.name, lang: pref(), message: text, ctx }) });
      if (!resp.ok) {
        const j = await resp.json().catch(() => ({})), full = resp.status === 429 || resp.status === 503;
        ans.innerHTML = `<p class="gh-err">${j.error ? esc(j.error) : full ? bi("The assistant is busy. Try again in a minute.", "小幫手現在忙不過來，過一分鐘再問。")
          : bi(`The assistant could not answer (error ${resp.status}).`, `小幫手沒辦法回答（錯誤 ${resp.status}）。`)}</p>`;
        finished = true;
        return;
      }
      if (!resp.body) throw new Error("no body");
      const reader = resp.body.getReader(), dec = new TextDecoder();
      let buf = "";
      for (;;) {
        const { value, done } = await reader.read();
        if (done) break;
        wake();
        buf += dec.decode(value, { stream: true });
        let i;
        while ((i = buf.indexOf("\n\n")) >= 0) {
          const chunk = buf.slice(0, i); buf = buf.slice(i + 2);
          let ev = "message", data = "";
          for (const line of chunk.split("\n")) { if (line.startsWith("event: ")) ev = line.slice(7); else if (line.startsWith("data: ")) data += line.slice(6); }
          let d = {};
          try { d = data ? JSON.parse(data) : {}; } catch { continue; }
          if (ev === "token") { txt += d.text || ""; ans.innerHTML = md(txt) + '<span class="gh-caret" aria-hidden="true"></span>'; scroll(); }
          else if (ev === "replace") { txt = d.text || ""; ans.innerHTML = md(txt); }
          else if (ev === "error") { const w = $(".gh-wait", bot); if (w) w.remove(); errLine(esc(d.message || "")); }
          else if (ev === "done") {
            finished = true;
            const a = d.answer || txt;
            if (a) ans.innerHTML = md(a);
            else { const w = $(".gh-wait", bot); if (w) w.remove(); if (!$(".gh-err", bot)) errLine(bi("No answer this time. Ask again.", "這次沒有回答，再問一次。")); }
          }
        }
      }
    } catch {
      if (!resp && !stalled) {
        finished = true;
        ans.innerHTML = `<p class="gh-err">${bi("The assistant could not be reached. The explanations above still work.", "連不到小幫手。上面的說明還是看得到。")}</p>`;
      }
    } finally {
      clearTimeout(idle);
      if (!finished) { ans.innerHTML = md(txt); errLine(bi("The answer stopped before it finished. Ask again.", "回答中途斷了，再問一次。")); }
      busy(false);
      scroll();
      if (H.pending && H.open) { const q = H.pending; H.pending = null; ask(q.text, q.extra); return; }   // else it waits for the next open
      // the keyboard back to the box (Chrome drops the focus from a button that was disabled while the answer came)
      const f = document.activeElement;
      if (H.open && (!f || f === document.body)) $("#ghIn", H.root).focus({ preventScroll: true });
    }
  }

  function open(o) {
    o = o || {};
    build();
    if (!H.open) {
      H.opener = document.activeElement;
      // pause first: the pause card takes the keyboard when it opens, the panel takes it back below
      if (pauseBtn() && !paused() && G.onPause) { G.onPause(); H.ours = paused(); }
      H.open = true;
      for (const k of KEYS) window.addEventListener(k, keyGuard, true);
      H.root.hidden = false;
      for (const x of [$(".g-top"), $("#game")]) if (x) x.inert = true;
      H.root.classList.remove("is-in"); void H.root.offsetWidth; H.root.classList.add("is-in");
    }
    render();
    // a question that waited while the panel was closed goes first (11/27 check: it was lost)
    if (H.pending && !H.busy) { const q = H.pending; H.pending = null; ask(q.text, q.extra); }
    if (o.ask) ask(zhFirst() ? o.ask.zh || o.ask.en : o.ask.en || o.ask.zh, o.ctx);
    const why = o.focus === "why" && $(".gh-why", H.root);
    if (why) why.scrollIntoView({ block: "start" });
    // on a touch screen a question asked from a button keeps the on-screen keyboard down (it covered the answer)
    (o.ask && window.matchMedia("(pointer: coarse)").matches ? $(".gh-x", H.root) : $("#ghIn", H.root)).focus({ preventScroll: true });
  }

  function close() {
    if (!H.open) return;
    H.open = false;
    for (const k of KEYS) window.removeEventListener(k, keyGuard, true);
    for (const x of [$(".g-top"), $("#game")]) if (x) x.inert = false;
    // a hidden button never keeps the keys; the game resumes first (a cut scene's button is hidden while paused, and the
    // chapters' resume puts the keyboard back where it was), then, if nothing took it, a cut scene's button or the control
    // that opened the panel gets it; an opener that was the page itself leaves it there (11/27 checks: Enter re-opened Help)
    if (H.root.contains(document.activeElement)) document.activeElement.blur();
    H.root.hidden = true;
    if (H.ours && paused() && G.onPause) G.onPause();
    H.ours = false;
    const back = H.opener;
    H.opener = null;
    const a = document.activeElement;
    if (!a || a === document.body) {
      const cut = document.querySelector("#rsCut:not([hidden]) .rs-cut-go");
      const to = cut || (back && back !== document.body && back.isConnected && !back.closest("[inert]") ? back : null);
      if (to) to.focus({ preventScroll: true });
    }
  }

  /* A mistake, as the chapter explains it on the spot: m = {at, title_en, title_zh, why: [{en, zh}], ctx}. The Help button
     glows once so the player knows they can ask about it. */
  function mistake(m) {
    if (!m) return;
    H.mistakes.unshift({ ...m });
    H.mistakes.length = Math.min(H.mistakes.length, 6);
    const b = document.getElementById("gHelp");
    if (b && !reduceMotion) { b.classList.remove("is-new"); void b.offsetWidth; b.classList.add("is-new"); setTimeout(() => b.classList.remove("is-new"), 3400); }
    if (H.open) render();
  }

  // the button, in the bar next to Sources (the bar's score area is redrawn by the chapter, so not in there)
  const right = document.querySelector(".g-right");
  if (right && !document.getElementById("gHelp")) {
    const b = el("button", "g-help", `${QSVG}<span>Help <span lang="zh-Hant">求助</span></span>`);
    b.type = "button"; b.id = "gHelp"; b.setAttribute("aria-haspopup", "dialog");
    b.title = "How to play, why something went wrong, ask the IT Assistant 怎麼玩、為什麼錯、問小幫手";
    b.addEventListener("click", () => open());
    right.insertBefore(b, right.firstChild);
  }

  return { open, close, mistake, ask, setNow(fn) { H.now = fn; }, clear() { H.mistakes = []; }, isOpen: () => H.open };
})();

/* 11/22 afternoon: a ripple of light from where a button is pressed (liquid.css). Inside the scaled stage the button's own
   pixels are the canvas pixels, so the pointer position is divided by the stage's scale. */
document.addEventListener("pointerdown", (e) => {
  if (reduceMotion || e.button > 0) return;
  const b = e.target instanceof Element ? e.target.closest(".btn, .g-back, .g-sound, .g-help, .cb-title-go, .rs-next-case, .g-foot summary") : null;
  if (!b || b.disabled) return;
  const r = b.getBoundingClientRect(), k = b.closest(".rs-body") ? G.k() || 1 : 1;
  if (getComputedStyle(b).position === "static") b.style.position = "relative";
  const wrap = document.createElement("span"), w = document.createElement("span");
  wrap.className = "g-ripple-wrap"; w.className = "g-ripple";
  w.style.cssText = `--x:${Math.round((e.clientX - r.left) / k)}px;--y:${Math.round((e.clientY - r.top) / k)}px;--s:${Math.round((Math.max(r.width, r.height) * 2.4) / k)}px`;
  wrap.appendChild(w); b.appendChild(wrap);
  setTimeout(() => wrap.remove(), 650);
}, { passive: true });
