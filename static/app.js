/* Lakeside IT Assistant: page logic. No external libraries. The tour fills the window (the iframe); the assistant is a
   pop-up window over it, opened from the two buttons at the top left, under the mini map (minimap.js). */
"use strict";

const $ = (s, el = document) => el.querySelector(s);
const esc = (s) => String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
const store = {
  get(k, d) { try { const v = localStorage.getItem("lia." + k); return v === null ? d : JSON.parse(v); } catch { return d; } },
  set(k, v) { try { localStorage.setItem("lia." + k, JSON.stringify(v)); } catch { /* private mode */ } },
};

const S = {
  session: store.get("session", null) || (crypto.randomUUID ? crypto.randomUUID().replace(/-/g, "") : String(Date.now()) + Math.random().toString(16).slice(2)),
  room: null, langPref: store.get("lang", "auto"), model: store.get("model", "qwen3.5:9b"),
  rooms: [], byKey: {}, busy: false, state: null, totalFindings: 17, lastLang: "en",
};
store.set("session", S.session);

// 11/21 night: inside iStaging's pop-up window (or any other frame) the page is only the assistant: no tour inside the
// tour, no map. "Go there" then takes the whole iStaging page to that scene.
const PARAMS = new URLSearchParams(location.search), IN_FRAME = window.self !== window.top;
// ?full=1: the whole page even inside a frame (the buttons in the iStaging tours open it in iStaging's big window)
let EMBED = PARAMS.has("embed") || (IN_FRAME && !PARAMS.has("full"));
if (EMBED) document.documentElement.classList.add("is-embed");
// 11/23 (review): the addresses of our own pages (this one, the fixed address, the GitHub copy, the laptop itself). Only
// they may steer this page by message (open the window, move the tour, keep the column aside); a video or a web page in
// an iStaging pop-up can reach this window too.
const OURS = new Set([location.origin, "https://lakeside.taila701b6.ts.net", "https://terry0803.github.io", "http://127.0.0.1:8780", "http://localhost:8780"]);
// 11/23 (the user: the first frame of iStaging's window flashed dark blue): in iStaging's window the picture of the room
// behind the window starts loading at once (the room is in the address), over a plain dark grey
if (EMBED && PARAMS.get("room")) roomBg(PARAMS.get("room"));

const PIN = '<svg viewBox="0 0 12 12" aria-hidden="true"><path fill="currentColor" d="M6 0a4 4 0 0 0-4 4c0 3 4 8 4 8s4-5 4-8a4 4 0 0 0-4-4zm0 5.6A1.6 1.6 0 1 1 6 2.4a1.6 1.6 0 0 1 0 3.2z"/></svg>';
const LABEL = {
  Room: ["Place", "地點"], Area: ["Area", "區域"], System: ["System", "系統"], DataAsset: ["Data", "資料"], Role: ["Role", "職務"],
  Department: ["Department", "部門"], Threat: ["Threat", "威脅"], Control: ["Control", "防護措施"], Standard: ["Standard", "標準法規"],
  Requirement: ["Clause", "條文"], Procedure: ["Procedure", "流程"], Concept: ["Concept", "概念"], CaseStudy: ["Real case", "真實案例"],
  Risk: ["Risks", "風險"], List: ["List", "清單"], Search: ["Search", "搜尋"], Finding: ["Weakness", "漏洞"],
};
const TOOL = {
  offline: ["Saved copy, the AI is off", "離線版，AI 沒開"],
  room_overview: ["Looking at this place", "查看這個地方"], find_location: ["Finding where it is", "找它在哪裡"], route: ["Planning the route", "規劃路線"],
  next_step: ["Checking your progress", "查看進度"], system_profile: ["Reading the system's profile", "查詢系統資料"],
  data_access: ["Checking who may access the data", "查詢誰能存取"], role_access: ["Checking the role's access", "查詢職務權限"],
  risks: ["Listing the risks", "列出風險"], threat_controls: ["Finding the controls", "查詢防護措施"], compliance: ["Reading the rules", "查詢法規條文"],
  inventory: ["Building the list", "整理清單"], procedure: ["Opening the procedure", "打開處理流程"], explain: ["Looking it up", "查詢說明"],
  check_email: ["Checking the message for warning signs", "檢查信件的警訊"], report_finding: ["Checking your report against the audit list", "對照稽核清單"],
  search: ["Searching the knowledge graph", "搜尋知識圖"], chat: ["Replying", "回覆"],
};
// 11/22 afternoon: the same node-type colours as style.css (--t-*): the cards' dots, the trace graph and its legend
// (third look: light enough to read on the dark glass)
const COLORS = { Room: "#6fd2da", Area: "#6fd2da", System: "#85b9ec", DataAsset: "#c6a0e3", Threat: "#ff9884", Control: "#8ad79e", Role: "#e6bc6c",
  Department: "#a3d1bc", Standard: "#bcc8cd", Requirement: "#ccd5d9", Procedure: "#f4b766", Concept: "#97b8f6", CaseStudy: "#f2a2c5" };
// a card's sections each list one kind of node (tools.py section()); the heading says which
const SEC_TYPE = { "Systems": "System", "Stored in": "System", "Stores": "DataAsset", "Data access": "DataAsset", "Applies to": "DataAsset",
  "Threats": "Threat", "Reduces": "Threat", "Controls": "Control", "Protected by": "Control", "Met by": "Control", "Would have helped": "Control",
  "Prevent": "Control", "Detect": "Control", "Respond & recover": "Control", "Concepts": "Concept", "Procedures": "Procedure", "If it happens": "Procedure",
  "Real cases": "CaseStudy", "Roles": "Role", "Used by": "Role", "Rules": "Standard", "Clauses": "Requirement", "Meets": "Requirement",
  "Exits": "Room", "Rooms": "Room", "In the tour": "Room", "Where to see it": "Room" };
const ARROW = '<svg viewBox="0 0 16 16" aria-hidden="true"><path d="M3 8h9M8.5 4l4 4-4 4" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/></svg>';

// motion: a class that plays the entrance once, then goes, so an element does not replay it when its tab is shown again
const RM = window.matchMedia ? window.matchMedia("(prefers-reduced-motion: reduce)") : { matches: false };
function enter(node, ms = 1100) {
  if (!node) return node;
  node.classList.add("is-in");
  setTimeout(() => node.classList.remove("is-in"), RM.matches ? 0 : ms);
  return node;
}
function bump(node) {
  if (!node || RM.matches) return;
  node.classList.remove("bump"); void node.offsetWidth; node.classList.add("bump");
  setTimeout(() => node.classList.remove("bump"), 700);
}

const zh = () => S.lastLang === "zh";
const t = (en, z) => (zh() ? z : en);
const pick = (o, f = "") => (o ? (zh() ? o[f ? f + "_zh" : "zh"] || o[f ? f + "_en" : "en"] : o[f ? f + "_en" : "en"] || o[f ? f + "_zh" : "zh"]) || "" : "");
// a node's name in the cards' chips and lines: English first, then the Chinese, also after a question in Chinese (11/23
// review: they had turned round after one)
function both(o) {
  if (!o) return "";
  const a = o.en || "", b = o.zh || "";
  if (!a || !b || a === b) return esc(a || b);
  return `${esc(a)} <span class="tag" lang="zh-Hant">${esc(b)}</span>`;
}
// 11/22 afternoon (the user: every English the visitor sees needs its Chinese next to it): fixed text, cards and place names
// are shown in both languages, English first. Only the model's own answer, and the questions sent to it, follow the language
// of the chat (t, pick). L = inline HTML, LB = the Chinese on its own line, LT = plain text (titles, labels).
const L = (en, z) => (!z || z === en ? esc(en || z || "") : `${esc(en || "")} <span class="zl" lang="zh-Hant">${esc(z)}</span>`);
const LB = (en, z) => (!z || z === en ? esc(en || z || "") : `${esc(en || "")}<span class="zh-line" lang="zh-Hant">${esc(z)}</span>`);
const LT = (en, z) => (!z || z === en ? String(en || z || "") : `${en} ${z}`);
const pair = (o, f = "") => (o ? [o[f ? f + "_en" : "en"] || "", o[f ? f + "_zh" : "zh"] || ""] : ["", ""]);
const pL = (o, f = "") => { const [a, b] = pair(o, f); return L(a || b, b); };
const pLB = (o, f = "") => { const [a, b] = pair(o, f); return LB(a || b, b); };
const rnEn = (r) => (r ? r.it_en || r.en || r.name_en || r.base_en || r.key : "");
const rnZh = (r) => (r ? r.it_zh || r.zh || r.name_zh || r.base_zh || "" : "");
const roomNameL = (r) => L(rnEn(r), rnZh(r));
const SEV_ZH = { Critical: "危急", High: "高", Medium: "中", Low: "低" };
// what each read-only query was for, and how a word was matched (server text, English only): their Chinese
const PURPOSE_ZH = {
  "rooms in the area": "這個區域的房間", "everything placed in this room": "這個房間裡的所有東西", "rooms where it can be seen": "看得到它的房間",
  "description": "說明", "shortest path through the hotspots": "經過熱點的最短路線", "story position and findings left here": "劇情進度和這裡還沒找到的漏洞",
  "nearest rooms with weaknesses still to find": "最近還有漏洞的房間", "system profile": "系統資料", "who may access this data, and where it lives": "誰能存取這份資料、資料放在哪",
  "users of the system and access to its data": "系統使用者和資料權限", "what this role may use and see": "這個職務能用什麼、看什麼",
  "threats and the controls against them": "威脅和對應的防護", "controls against the threat": "對付這個威脅的防護",
  "what the clause requires and which controls meet it": "條文要求和符合的措施", "the standard and its clauses used at the resort": "渡假村用到的標準和條文",
  "personal data inventory: systems that store personal data": "個資盤點：存放個資的系統", "all Restricted data": "所有限閱資料", "all procedures": "所有流程",
  "standards and laws": "標準和法規", "all systems": "所有系統", "procedure for this threat": "這個威脅的處理流程", "the procedure with its ordered steps": "流程和步驟",
  "concept, example and where it is taught": "概念、例子和在哪裡教", "real case and its lessons": "真實案例和教訓",
  "control: what it stops and which clauses it meets": "防護措施擋什麼、符合哪些條文", "department, its people and systems": "部門、人員和系統",
  "top hits and their neighbours": "最接近的結果和相鄰節點", "BM25 full-text search": "BM25 全文檢索", "bge-m3 vector search": "bge-m3 向量搜尋",
  "BM25 search over findings": "用 BM25 搜尋漏洞", "vector search over findings": "用向量搜尋漏洞", "phishing warning signs": "釣魚警訊", "what to do next": "接下來怎麼做",
  "candidate findings": "候選漏洞", "number of weaknesses": "漏洞數量", "where the clue for this lock is": "這道鎖的線索在哪裡",
};
const HOW_ZH = {
  "button": "按鈕", "looks like a pasted email (rule)": "看起來是貼上的信（規則判斷）", "model": "模型", "model output was not JSON, fell back to search": "模型輸出不是 JSON，改用搜尋",
  "current room": "目前所在的地方", "previous topic": "上一個話題", "nothing to look up": "沒有要查的", "linked": "已對到", "search": "搜尋",
  "high": "高", "medium": "中", "low": "低", "none": "無", "contact question, person or team preferred": "問聯絡人，優先找人或團隊",
  "same name, concept preferred for 'explain'": "同名時說明優先用概念", "(the pasted message)": "（貼上的信）",
  "rules + model, evidence checked against the text": "規則加模型，引文已和原文核對", "hybrid search over findings + model judgement": "混合搜尋漏洞再由模型判斷",
  "the report does not say what was seen (rule)": "回報沒有說看到什麼（規則判斷）",
};
const zhOf = (map, s) => { if (!s) return ""; if (map[s]) return map[s]; const m = /^redirect:(\w+)$/.exec(s); return m && LABEL[m[1]] ? `轉到${LABEL[m[1]][1]}` : ""; };
const LTm = (map, s) => LT(s || "", zhOf(map, s));

/* ---------------------------------------------------------------- startup */
document.addEventListener("DOMContentLoaded", init);

async function init() {
  bindUi();
  renderEmpty();
  const roomsRes = await fetch("/api/rooms").then((r) => r.json()).catch(() => null);
  if (roomsRes) {
    S.rooms = roomsRes.rooms; S.totalFindings = roomsRes.total_findings || 17;
    for (const r of S.rooms) S.byKey[r.key] = r;
    fillRoomSelect();
  }
  const params = new URLSearchParams(location.search);
  const fromTour = params.get("room");
  const fromGame = params.get("back") === "game";        // a mini-game window could not close itself: reopen at the game's room
  const start = (fromTour && S.byKey[fromTour]) ? fromTour : (store.get("room", "sky") in S.byKey ? store.get("room", "sky") : "sky");
  // 11/22: in iStaging's window this page IS the assistant, also when the tour is inside our own full page. That page only
  // learns where the visitor is and steps aside (map, buttons and its own window) while this window is open, so there is
  // one assistant at a time and nothing reloads. (Before: this window handed over and asked to be closed: two at once.)
  if (IN_FRAME && await probeOurPage(fromTour || start)) { S.inOurPage = true; popupBeat(); }
  goTo(start, { quiet: !fromTour });
  checkHealth();
  renderTasks();
  // 11/23 (the user: "can the assistant start folded? not open by default feels better"): the full page starts with the
  // window shut, also when a tour sign sent the visitor here (?room=: the place is set, nothing is asked until they open
  // it) or it was open last time. Inside iStaging's window the page IS the assistant and opens as before; back from a game
  // it opens on the new score.
  if (fromGame) openDesk("progress");                      // show the new score instead of asking about the room again
  else if (EMBED) {
    // a tour sign's "Ask the IT Assistant" button: the window opens on that place's overview, as before (11/23: the first
    // version of the folded start dropped this too; only the full page should wait for a click)
    $("#desk").classList.add("is-big");      // 11/23: the floating window in iStaging's window is the wide one (style.css .is-embed)
    openDesk("chat");
    if (fromTour && S.byKey[fromTour]) runAction("room_overview", "", t("What is in this place?", "這裡有什麼？"));
  }
  else if (!store.get("seenDock", false)) hintDock();
}

/* ---------------------------------------------------------------- inside our own page (11/21 night)
   A sign in the tour opened the assistant in iStaging's window, but the tour is itself inside our full-screen page: ask
   that page to open its own window at this place. If it answers, say so here (the visitor closes iStaging's window);
   if nothing answers (iStaging is inside somebody else's site), carry on here as usual. The full-screen page also learns
   where the visitor is, which iStaging never tells it. */
// tell every page around this one (a window can always post to its parents, whatever their address)
function askAncestors(msg) {
  let w = window.parent;
  for (let i = 0; i < 6 && w; i++) { try { w.postMessage(msg, "*"); } catch { /* gone */ } if (w === window.top) break; w = w.parent; }
}
function probeOurPage(room) {
  // 11/23 (review): where the browser lists the addresses of the pages around this one (Chrome) and none of them is ours,
  // nobody will answer, so the window opens without the 0.6 s wait. A hidden address ("null") or no list: ask as before.
  try {
    const up = location.ancestorOrigins ? [...location.ancestorOrigins] : null;
    if (up && !up.some((o) => o === "null" || OURS.has(o))) return Promise.resolve(false);
  } catch { /* ask */ }
  return new Promise((resolve) => {
    let done = false;
    const onAck = (e) => {
      if (done || !e.data || e.data.type !== "lakeside:ack" || !OURS.has(e.origin)) return;
      // 11/22: in a frame inside iStaging the browser keeps this page's storage apart from our page around it, so this
      // window would start its own progress; take the session of that page instead (same address only)
      if (e.data.session && e.origin === location.origin) { S.session = e.data.session; store.set("session", S.session); }
      done = true; window.removeEventListener("message", onAck); resolve(true);
    };
    window.addEventListener("message", onAck);
    askAncestors({ type: "lakeside:hello", room });
    setTimeout(() => { if (!done) { done = true; window.removeEventListener("message", onAck); resolve(false); } }, 600);
  });
}
// while this window is open inside our page, say so every second; the page behind keeps its own things out of the way
function popupBeat() {
  const beat = setInterval(() => askAncestors({ type: "lakeside:popup-alive" }), 1000);
  window.addEventListener("pagehide", () => { clearInterval(beat); askAncestors({ type: "lakeside:popup-close" }); });
  // a link that turns this window into a game is not the window closing: say so first (see gameCloseSoon)
  document.addEventListener("click", (e) => {
    const a = e.target instanceof Element ? e.target.closest("a[href]") : null;
    if (!a || e.defaultPrevented || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
    if ((a.target && a.target !== "_self") || a.getAttribute("href").startsWith("#")) return;
    askAncestors({ type: "lakeside:popup-nav" });
  });
}
// 11/21 night: a mini-game opened from a sign runs in iStaging's window inside the tour; while it says it is open
// (every second), the map, the buttons and the assistant window step aside so they do not cover it. 11/22: the same for the
// assistant itself when a sign opens it in iStaging's window.
let gameTimer = null, aside = false, asideAnims = [], navUntil = 0;
// 11/22 evening: each window that says it is open is remembered on its own (two pop-ups can be open: closing one must
// not bring the column back while the other still talks). A removed frame reports closed = true.
const talkers = new Map();
function stillTalking() {
  const now = Date.now();
  for (const [w, t] of talkers) { let gone = true; try { gone = w.closed; } catch { gone = true; } if (gone || now - t > 2600) talkers.delete(w); }
  return talkers.size > 0;
}
// no word from those windows for a while: they are gone, unless one said it was moving to its next page (can be slow);
// a window that said so and was then closed before its next page came is not waited for
let navFrom = null;
function gameQuiet() {
  // 11/23 (review): a tab in the background runs its timers, and the windows in it their heartbeats, only about once a
  // minute; a check then could take a window that still talks for gone. Wait until the tab is in front again.
  if (document.hidden) { gameTimer = setTimeout(gameQuiet, 1000); return; }
  if (navUntil) { let gone = false; try { gone = !navFrom || navFrom.closed; } catch { gone = true; } if (gone) navUntil = 0; }
  if (Date.now() < navUntil || stillTalking()) gameTimer = setTimeout(gameQuiet, 400); else gameOpen(false);
}
// back in front: the windows that were talking start counting again from now (their next heartbeat is a second away)
document.addEventListener("visibilitychange", () => {
  if (document.hidden) return;
  const now = Date.now();
  for (const w of talkers.keys()) talkers.set(w, now);
});
function gameOpen(on) {
  clearTimeout(gameTimer);
  if (on) gameTimer = setTimeout(gameQuiet, 2600);
  if (on === aside) return;                              // the heartbeat: already out of the way (or already back)
  aside = on;
  stepAside(on);
  // back from a game or the assistant in iStaging's window: read the scores and findings again
  if (!on) fetch(`/api/state?session=${encodeURIComponent(S.session)}`).then((r) => r.json()).then(updateState).catch(() => {});
}
// 11/22 evening (the user: closing a game should feel smoother too): the window said "close". If it said just before that it
// is moving to its next page (the next case, a game opened from the assistant), the column stays out of the way until that
// page says "open"; otherwise the window really closed, and the column comes back at once instead of half a second later.
function gameCloseSoon() { clearTimeout(gameTimer); gameTimer = setTimeout(gameQuiet, Date.now() < navUntil ? 400 : 60); }
// 11/22 afternoon: they fade out of the way and fade back in after, instead of vanishing and coming back at once (the user:
// the map and the assistant disappeared suddenly). Hidden, not removed (style.css), so nothing plays its slide-in again.
// Each glass piece fades by itself: fading the whole column would turn their frosted glass clear for that moment.
function stepAside(on) {
  const root = document.documentElement, side = $(".side");
  for (const a of asideAnims) a.cancel();
  asideAnims = [];
  if (RM.matches) { root.classList.toggle("game-open", on); return; }
  if (!on) root.classList.remove("game-open");
  const pieces = [...document.querySelectorAll(".mm-mini, .mm-hide, .mm-pill, .mm-panel, .dock-btn, .dock-tip, #desk")]
    .filter((e) => !e.hidden && e.offsetParent !== null);
  const T = on ? 240 : 340, ease = on ? "ease-in" : "cubic-bezier(.2, .9, .25, 1)";
  const anims = pieces.map((e) => e.animate(on ? [{ opacity: 1 }, { opacity: 0 }] : [{ opacity: 0 }, { opacity: 1 }], { duration: T, easing: ease, fill: on ? "forwards" : "backwards" }));
  if (side) anims.push(side.animate(on ? [{ translate: "0px 0px" }, { translate: "-14px 0px" }] : [{ translate: "-14px 0px" }, { translate: "0px 0px" }], { duration: T, easing: ease, fill: on ? "forwards" : "none" }));
  asideAnims = anims;
  Promise.all(anims.map((a) => a.finished)).then(() => {
    if (asideAnims !== anims) return;
    asideAnims = [];
    if (on) { root.classList.add("game-open"); for (const a of anims) a.cancel(); }
  }).catch(() => { /* turned around halfway */ });
}
window.addEventListener("message", (e) => {          // the other end: our full-screen page
  if (EMBED) return;
  const d = e.data;
  // 11/22 afternoon: our own game window (openGame) already covers everything; only its Back button matters here
  const gf = document.getElementById("gameFrame");
  if (gf && e.source === gf.contentWindow) {
    if (d && d.type === "lakeside:game-exit" && e.origin === location.origin) closeGame();
    return;
  }
  if (!OURS.has(e.origin)) return;                       // 11/23 (review): from our own pages only (OURS)
  if (d && (d.type === "lakeside:game-open" || d.type === "lakeside:game-alive" || d.type === "lakeside:popup-alive")) {
    if (d.type === "lakeside:game-open") navUntil = 0;   // the next page has arrived: a close from now on is a real one
    if (e.source) talkers.set(e.source, Date.now());
    gameOpen(true);
    // 11/22: a game in iStaging's window keeps its storage apart from this page; give it this page's session so its score
    // lands in this Progress tab (our own address only)
    if (d.type !== "lakeside:popup-alive" && e.origin === location.origin) { try { e.source.postMessage({ type: "lakeside:session", session: S.session }, location.origin); } catch { /* gone */ } }
    return;
  }
  if (d && (d.type === "lakeside:game-nav" || d.type === "lakeside:popup-nav")) { navUntil = Date.now() + 4000; navFrom = e.source; return; }
  if (d && (d.type === "lakeside:game-close" || d.type === "lakeside:popup-close")) {
    if (e.source) {
      let removed = false;
      try { removed = e.source.closed; } catch { removed = false; }
      talkers.delete(e.source);
      if (removed) navUntil = 0;                         // the frame itself is gone: no next page is coming
    }
    gameCloseSoon();
    return;
  }
  if (d && d.type === "lakeside:full") {                // the balloon's "Full version" button, pressed in here: this is it
    const toast = $("#tourToast");
    toast.innerHTML = `${PIN}<span>This is the full version: the map and the assistant are at the top left <span lang="zh-Hant">這裡就是完整版：地圖和小幫手都在左上角</span></span>`;
    toast.classList.add("show"); clearTimeout(toastTimer); toastTimer = setTimeout(() => toast.classList.remove("show"), 4200);
    try { e.source.postMessage({ type: "lakeside:ack" }, e.origin); } catch { /* the window went away */ }
    return;
  }
  if (d && d.type === "lakeside:hello") {               // the assistant opened in iStaging's window: where the visitor is, then step aside
    if (S.byKey[d.room]) setHere(d.room);
    navUntil = 0;
    if (e.source) talkers.set(e.source, Date.now());
    gameOpen(true);
    // the answer goes to the address that asked (with the session only to our own address), not to whoever is there now
    try { e.source.postMessage(e.origin === location.origin ? { type: "lakeside:ack", session: S.session } : { type: "lakeside:ack" }, e.origin); } catch { /* the window went away */ }
    return;
  }
  // the map inside iStaging's window, inside this page: a jump, so the tour moves even to the scene it was opened at
  if (d && d.type === "lakeside:goto") { if (S.byKey[d.room]) goTo(d.room, { jump: true }); return; }
  if (!d || d.type !== "lakeside:open") return;
  const r = S.byKey[d.room];
  openDesk(d.tab === "progress" ? "progress" : "chat");
  if (r) {
    setHere(d.room);
    if (d.tab !== "progress" && !runAction("room_overview", "", t("What is in this place?", "這裡有什麼？"))) busyNote($("#askForm"), true);
  }
  try { e.source.postMessage({ type: "lakeside:ack" }, e.origin); } catch { /* the window went away */ }
});
// the visitor is at this place (told by the tour, not chosen here): update everything except the tour itself
// 11/23 (the user: the assistant opened from a pink button looked plain next to the floating window of the full page):
// inside iStaging's window the page shows a soft picture of the room you are in behind the window (web/roombg/<room>.jpg,
// made by pages/make_room_backgrounds.py). The night aurora stays until the picture has loaded, or if it cannot load.
function roomBg(key) {
  if (!EMBED || !key) return;
  const url = `/lakeside/static/roombg/${key}.jpg`, im = new Image();
  im.onload = () => { document.documentElement.style.setProperty("--room-bg", `url("${im.src}")`); document.documentElement.classList.add("has-room-bg"); };
  im.src = url;
}

async function setHere(key) {
  const moved = S.room !== key;
  S.room = key; store.set("room", key);
  roomBg(key);
  $("#roomSelect").value = key;
  if (moved) flashRoom();
  if (typeof Minimap !== "undefined") Minimap.update(key);
  const res = await post("/api/visit", { session: S.session, room: key }).catch(() => null);
  if (res) updateState(res);
}

/* ---------------------------------------------------------------- the pop-up window */
let closeTimer = null, deskFrom = null, deskMorph = null, deskLater = null;      // deskMorph: { anims, end, restore }
/* 11/22 afternoon (the user: when the window shrinks, the other button just appears; let it split into the two buttons):
   closing, the window splits into the IT Assistant and Casebook buttons (foldIntoButtons); opening, only the clicked
   button grows into the window and the other one fades where it is (the user found two shapes growing on top of each
   other strange). The window and the buttons themselves move (splitDesk, foldIntoButtons), so nothing appears or
   vanishes at once. Web Animations; none of it with "reduce motion" or inside iStaging's window. */
function stopDeskMorph() {
  clearTimeout(deskLater); deskLater = null;
  const m = deskMorph; deskMorph = null;
  if (!m) return;
  for (const a of m.anims) a.cancel();
  $("#desk").style.transformOrigin = "";
  if (m.restore) m.restore();
  m.end();
}
const rectOf = (el) => { const r = el.getBoundingClientRect(); return { left: r.left, top: r.top, width: r.width, height: r.height }; };
const pxBox = (r) => ({ left: `${r.left.toFixed(1)}px`, top: `${r.top.toFixed(1)}px`, width: `${r.width.toFixed(1)}px`, height: `${r.height.toFixed(1)}px` });
function splitDesk(opening, end, mainBtn) {
  const d = $("#desk"), btns = [$("#dockChat"), $("#dockGames")];
  if (EMBED || RM.matches || typeof d.animate !== "function" || btns.some((b) => !b || b.offsetParent === null)) return false;
  const main = Math.max(0, btns.indexOf(mainBtn)), btn = btns[main];
  const B = rectOf(btn), D = rectOf(d);
  if (!D.width || !D.height || !B.width || !B.height) return false;
  if (!opening) return foldIntoButtons(d, btns, D, end);
  // 11/22 evening (the user: the window turned all grey before its contents showed, opening and closing): the window
  // itself grows out of the button and shrinks back into it, contents showing all the way, the way the big map grows out
  // of the small one (minimap.js morphMap): scaled to the button's width, moved onto it, cut to its height with the
  // button's corners. Before, an empty glass shape flew instead and the window only showed in the last 30% of the opening.
  const s = B.width / D.width, r = parseFloat(getComputedStyle(btn).borderTopLeftRadius) || 20;
  const cut = Math.max(0, D.height - B.height / s);
  const small = { transform: `translate(${(B.left - D.left).toFixed(1)}px, ${(B.top - D.top).toFixed(1)}px) scale(${s.toFixed(4)})`,
    clipPath: `inset(0px 0px ${cut.toFixed(1)}px 0px round ${(r / s).toFixed(1)}px)` };
  // the open end leaves room for the window's shadow, so nothing changes when the animation lets go
  const big = { transform: "translate(0px, 0px) scale(1)", clipPath: "inset(-60px -60px -60px -60px round 80px)" };
  const T = 560;
  d.style.transformOrigin = "0 0";
  const anims = [d.animate([small, big], { duration: T, easing: "cubic-bezier(.2, .9, .25, 1)", fill: "both" })];
  // the window is already there, small, where the button was; the buttons fade under it
  anims.push(d.animate([{ opacity: 0.4 }, { opacity: 1, offset: 0.3 }, { opacity: 1 }], { duration: T, fill: "both" }));
  btns.forEach((b, i) => anims.push(b.animate([{ opacity: 1 }, { opacity: 0 }], { duration: i === main ? 120 : 200, easing: "ease-out", fill: "forwards" })));
  const mo = { anims, end };
  deskMorph = mo;
  Promise.all(anims.map((x) => x.finished)).then(() => {
    if (deskMorph !== mo) return;
    deskMorph = null;
    end();                                              // the column goes
    for (const x of anims) x.cancel();
    d.style.transformOrigin = "";
  }).catch(() => { /* stopped by the next open or close */ });
  return true;
}
// a cubic-bezier timing curve as a function (for keyframes worked out here: things on one path need the same timing)
function bezier(x1, y1, x2, y2) {
  const cx = 3 * x1, bx = 3 * (x2 - x1) - cx, ax = 1 - cx - bx, cy = 3 * y1, by = 3 * (y2 - y1) - cy, ay = 1 - cy - by;
  const X = (t) => ((ax * t + bx) * t + cx) * t, Y = (t) => ((ay * t + by) * t + cy) * t;
  return (x) => {
    if (x <= 0) return 0;
    if (x >= 1) return 1;
    let lo = 0, hi = 1, t = x;
    for (let i = 0; i < 24; i++) { if (X(t) < x) lo = t; else hi = t; t = (lo + hi) / 2; }
    return Y(t);
  };
}
/* Closing (11/22 night, seventh try). The user, in turn: the shrinking window and the two buttons sat on top of each
   other (ugly), let the window turn into the buttons and split into the two of them; "a hitch at the end" (the lower
   button trailed and then caught up); "not linear enough, and the two landing together is odd"; then "I still like the
   split, but it must be fluid and must not stutter". Now:
   1. the same speed as the small map: the map shrinks back in 0.44 s on cubic-bezier(.4, 0, .2, 1), and so does the
      upper button here (the user: "a bit slow and odd, the speed does not match the small map"; the 0.56 s even curve
      tried before felt sluggish);
   2. the window shrinks towards the buttons and dissolves; the two buttons, as wide as the window, come out of its top
      part (its header becomes the IT Assistant button, the Casebook button appears just under it) and come into focus as
      its glass goes;
   3. they fly apart into their places, the lower one on a slightly longer clock, so it lands 0.06 s after the upper one;
      neither ever waits for or catches up with the other, and they never overlap.
   Only transform and opacity move (the compositor does those by itself): the clip-path cut of the earlier tries made
   the browser paint the window again in every frame, which stutters when the chat is long. */
function foldIntoButtons(d, btns, D, end) {
  const P = btns.map((b) => ({ b, r: rectOf(b) })).sort((p, q) => p.r.top - q.r.top);
  const [A, Z] = P.map((p) => p.r);
  if (!A.width || !A.height || !Z.width || !Z.height) return false;
  const TA = 440, TZ = 500, N = 50;                      // the upper button lands at 0.44 s (as the map does), the lower one at 0.5 s
  const move = bezier(.4, 0, .2, 1);                     // minimap.js morphMap's closing curve
  const lin = (a, b, k) => a + (b - a) * k, cl = (v) => (v < 0 ? 0 : v > 1 ? 1 : v), f = (v) => v.toFixed(2);
  const g0 = D.width / A.width, z0 = D.top + A.height * g0 + 20;   // where the lower one starts: just under the upper one
  const kd = [], k0 = [], k1 = [];
  for (let i = 0; i <= N; i++) {
    const u = i / N, t = u * TZ, ea = move(cl(t / TA)), ez = move(cl(t / TZ));
    const xa = lin(D.left, A.left, ea), ya = lin(D.top, A.top, ea), wa = lin(D.width, A.width, ea);
    const xz = lin(D.left, Z.left, ez), yz = lin(z0, Z.top, ez), wz = lin(D.width, Z.width, ez);
    // the window: its top left corner and width go with the upper button, so its header turns into it; gone by 38%
    kd.push({ offset: u, opacity: 1 - cl((t / TZ - 0.06) / 0.32), transform: `translate(${f(xa - D.left)}px, ${f(ya - D.top)}px) scale(${(wa / D.width).toFixed(4)})` });
    k0.push({ offset: u, opacity: cl((t / TZ - 0.08) / 0.26), transform: `translate(${f(xa - A.left)}px, ${f(ya - A.top)}px) scale(${(wa / A.width).toFixed(4)})` });
    k1.push({ offset: u, opacity: cl((t / TZ - 0.12) / 0.26), transform: `translate(${f(xz - Z.left)}px, ${f(yz - Z.top)}px) scale(${(wz / Z.width).toFixed(4)})` });
  }
  d.style.transformOrigin = "0 0";
  for (const p of P) p.b.style.transformOrigin = "0 0";
  P[0].b.style.zIndex = "2"; P[1].b.style.zIndex = "1";
  const anims = [d.animate(kd, { duration: TZ, fill: "both" }), P[0].b.animate(k0, { duration: TZ, fill: "both" }), P[1].b.animate(k1, { duration: TZ, fill: "both" })];
  const restore = () => { for (const p of P) { p.b.style.transformOrigin = ""; p.b.style.zIndex = ""; } };
  const mo = { anims, end, restore };
  deskMorph = mo;
  Promise.all(anims.map((x) => x.finished)).then(() => {
    if (deskMorph !== mo) return;
    deskMorph = null;
    end();                                              // the window hides, the buttons stay
    for (const x of anims) x.cancel();
    d.style.transformOrigin = "";
    restore();
  }).catch(() => { /* stopped by the next open or close */ });
  return true;
}
function openDesk(tab, fromBtn) {
  const d = $("#desk");
  clearTimeout(closeTimer);
  stopDeskMorph();                                        // a close still running ends at once; then it opens again
  d.classList.remove("is-closing");
  const wasHidden = d.hidden;
  const merge = wasHidden && fromBtn && fromBtn.offsetParent !== null;
  for (const b of document.querySelectorAll(".dock-btn")) b.classList.remove("is-receiving");
  if (wasHidden) d.classList.toggle("is-morph", !!merge);   // merging: no CSS slide-in at all; otherwise the slide-in plays
  if (merge) deskFrom = fromBtn;
  d.hidden = false;
  // 11/22 evening (the user: animations sometimes drop frames): no resize event for the whole page any more. It made the
  // small map draw itself again, up to 90 ms in one frame; now only the tabs are measured again, and the big map only
  // when it is open (its width depends on the window).
  const shown = () => {
    clearTimeout(deskLater); deskLater = null;
    $("#dock").classList.remove("is-opening");
    $("#layout").classList.add("is-desk");
    if (typeof Minimap !== "undefined" && Minimap.state() === "open") window.dispatchEvent(new Event("resize"));
    else { moveInk(true); fitTabs(); }
  };
  if (merge && splitDesk(true, () => { shown(); }, fromBtn)) {
    for (const b of document.querySelectorAll(".dock-btn")) b.classList.add("is-quiet");
    // the column goes when the window has landed (splitDesk calls shown), not 0.22 s in: switching the layout in the
    // middle of the motion was the long frame. Until then the faded buttons ignore clicks.
    $("#dock").classList.add("is-opening");
    deskLater = setTimeout(shown, 1200);                  // a backstop, well after the window has landed
  } else {
    d.classList.remove("is-morph");
    shown();
  }
  requestAnimationFrame(() => { moveInk(true); fitTabs(); });
  for (const b of document.querySelectorAll(".dock-btn")) b.setAttribute("aria-expanded", "true");
  if (tab) showTab(tab);
  if (!EMBED) store.set("seenDock", true);
  const tip = $(".dock-tip"); if (tip) tip.remove();
  if (tab === "chat" || (!tab && !$("#pane-chat").hidden)) setTimeout(() => $("#askInput").focus({ preventScroll: true }), 60);
  // 11/23 (review): opened on another tab, the focus goes to that tab; it stayed on the button, which then went away, and
  // Esc and the keyboard did nothing
  else if (wasHidden) setTimeout(() => { const s = $(".tabs [aria-selected=true]"); if (s && !d.hidden) s.focus({ preventScroll: true }); }, 60);
}
function closeDesk() {
  const d = $("#desk");
  if (EMBED || d.hidden || d.classList.contains("is-closing")) return;   // in iStaging's window the window is the whole page
  clearTimeout(closeTimer);
  stopDeskMorph();
  $("#layout").classList.remove("is-desk");               // the column comes back, so the buttons can be measured
  const btns = [...document.querySelectorAll(".dock-btn")];
  for (const x of btns) x.classList.add("is-quiet", "is-receiving");   // no slide-in; invisible until the two halves land in them
  d.classList.add("is-closing", "is-morph");
  const landed = () => {
    d.classList.remove("is-closing", "is-morph"); d.hidden = true;
    // the window has become the two buttons on the way and they land at rest: nothing more to do (11/22 night, the small
    // settle bounce at the end went with the fifth closing)
    for (const x of btns) x.classList.remove("is-receiving");
  };
  if (!splitDesk(false, landed, deskFrom && deskFrom.isConnected ? deskFrom : $("#dockChat"))) {                        // no buttons to land in (the big map hides them): slide out as before
    for (const x of btns) x.classList.remove("is-receiving");
    d.classList.remove("is-morph");                       // let the CSS slide-out play
    closeTimer = setTimeout(() => { d.classList.remove("is-closing"); d.hidden = true; }, RM.matches ? 0 : 280);
  }
  for (const b of document.querySelectorAll(".dock-btn")) b.setAttribute("aria-expanded", "false");
  // 11/23 (review): the focus goes back to a button that is on the screen (with the big map open the two below are not)
  const back = [deskFrom, $("#dockChat"), $("#dockGames"), $("#mmClose"), $("#mmMini"), $("#mmPill")].find((b) => b && b.isConnected && b.offsetParent !== null);
  if (back) back.focus({ preventScroll: true });
  // 11/22 night (the user: the closing hitched): no resize event for the whole page (the small map drew itself again in
  // the first frame of the closing); only the big map, if it is open, depends on the window's width
  if (typeof Minimap !== "undefined" && Minimap.state() === "open") window.dispatchEvent(new Event("resize"));
}
/* ---------------------------------------------------------------- the game window (11/22 afternoon)
   A mini-game started here (Quick tasks, Progress) opens in a window over the tour, not in a new tab (the user: "why does
   it open a new window"). The game knows it is in here (?in=page) and its Back button asks this page to close the window.
   The game saves its own score; the Progress tab reads the scores again when the window closes. The window grows out of
   the button that opened it. A click outside the game, or Esc, closes it too. */
let gameFrom = null, gameShut = null, gameHref = null, gameAnims = [], gameClosedAt = 0;
// where the closing window goes back to: the link of the game now in it (the next case may have followed), else the link it
// was opened from, else the Casebook button; only one that is on the screen
function onScreen(e) {
  if (!e || !e.isConnected || e.offsetParent === null) return false;
  const r = e.getBoundingClientRect();
  return r.width > 0 && r.bottom > 0 && r.right > 0 && r.top < innerHeight && r.left < innerWidth;
}
function gameBackTarget() {
  const seen = onScreen;
  let key = "";
  try { key = ($("#gameFrame").contentWindow.location.pathname.match(/\/games\/([a-z]+)/) || [])[1] || ""; } catch { key = ""; }
  const links = [...document.querySelectorAll('a[href*="/lakeside/games/"]')].filter((a) => !a.closest("#gameWin"));
  return links.find((a) => key && new RegExp(`/lakeside/games/${key}(/|$|\\?)`).test(a.getAttribute("href")) && seen(a))
    || links.find((a) => gameHref && a.getAttribute("href") === gameHref && seen(a))
    || (seen(gameFrom) ? gameFrom : null) || (seen($("#dockGames")) ? $("#dockGames") : null);
}
function openGame(href, fromEl) {
  let w = $("#gameWin");
  if (!w) {
    w = el("section", "game-win", `<div class="game-frame"><iframe id="gameFrame" title="Casebook 事件簿" allow="autoplay"></iframe></div>`);
    w.id = "gameWin"; w.hidden = true; w.tabIndex = -1;
    w.setAttribute("role", "dialog"); w.setAttribute("aria-modal", "true"); w.setAttribute("aria-label", "Casebook 事件簿");
    w.addEventListener("pointerdown", (e) => { if (e.target === w) closeGame(); });      // Esc: the page's own key handler (bindUi)
    document.body.appendChild(w);
  }
  clearTimeout(gameShut); w.classList.remove("is-closing");
  for (const a of gameAnims) a.cancel();                 // opened again while it was closing: back to full size
  gameAnims = [];
  const frame = $("#gameFrame"), box = $(".game-frame", w);
  const u = new URL(href, location.origin); u.searchParams.set("in", "page");
  // replace, not a new page: the browser's Back button must not walk through old games in this window
  try { frame.contentWindow.location.replace(u.pathname + u.search); } catch { frame.src = u.pathname + u.search; }
  gameFrom = fromEl || null; gameHref = fromEl ? fromEl.getAttribute("href") : null;
  w.hidden = false;
  $("#layout").inert = true;                             // the tour, the map and the assistant wait behind it
  w.focus({ preventScroll: true });
  // grow from the button: the frame's own place comes from offsetLeft/Top, which ignore the grow animation's scale
  const b = fromEl && fromEl.offsetParent !== null ? fromEl.getBoundingClientRect() : null, wr = w.getBoundingClientRect();
  box.style.transformOrigin = b ? `${(b.left + b.width / 2 - wr.left - box.offsetLeft).toFixed(0)}px ${(b.top + b.height / 2 - wr.top - box.offsetTop).toFixed(0)}px` : "50% 50%";
  frame.addEventListener("load", () => {
    if (w.hidden || w.classList.contains("is-closing")) return;
    try { frame.contentWindow.focus(); } catch { /* not ready */ }
  }, { once: true });
}
function closeGame() {
  const w = $("#gameWin");
  if (!w || w.hidden || w.classList.contains("is-closing")) return;
  w.classList.add("is-closing");
  gameClosedAt = performance.now();                      // the window behind ignores a second click for a moment (bindUi)
  const box = $(".game-frame", w), to = gameBackTarget(), toHref = to && to.getAttribute("href");
  const shut = () => {
    clearTimeout(gameShut);
    if (!w.classList.contains("is-closing")) return;     // opened again meanwhile
    for (const a of gameAnims) a.cancel();
    gameAnims = [];
    w.hidden = true; w.classList.remove("is-closing");
    const f = $("#gameFrame");
    try { f.contentWindow.location.replace("about:blank"); } catch { f.src = "about:blank"; }
  };
  // 11/22 evening (the user: the closing animation should be smoother too): the window shrinks back into the link or
  // button it grew out of, the dark backdrop clears at the same time, and that link gives a small bounce as it lands.
  // Before: a 0.23 s fade with a slight shrink in place, so the game seemed to vanish rather than go back.
  // the Progress tab is drawn again with the new score: put the focus back on the same link in the new list
  const refocus = () => {
    const again = gameHref && [...document.querySelectorAll(`a[href="${gameHref}"]`)].find((a) => a.offsetParent !== null);
    const back = again || (gameFrom && gameFrom.isConnected && gameFrom.offsetParent !== null ? gameFrom : null) || $("#dockGames");
    if (back && back.offsetParent !== null) back.focus({ preventScroll: true });
  };
  const refresh = () => fetch(`/api/state?session=${encodeURIComponent(S.session)}`).then((r) => r.json())
    .then((res) => { updateState(res); refocus(); }).catch(() => {});
  if (RM.matches || typeof box.animate !== "function") { shut(); refresh(); }
  else {
    const fr = box.getBoundingClientRect();
    let end = "scale(.92)";
    box.style.transformOrigin = "50% 50%";
    if (to) {
      const r = to.getBoundingClientRect();
      box.style.transformOrigin = `${(r.left + r.width / 2 - fr.left).toFixed(0)}px ${(r.top + r.height / 2 - fr.top).toFixed(0)}px`;
      end = "scale(.12)";
    }
    // 11/22 evening (frame drops): the dark backdrop is its own layer (::before) and fades by opacity; animating the
    // window's background colour painted the whole screen again on every frame
    gameAnims = [
      box.animate([{ transform: "scale(1)", opacity: 1 }, { opacity: 1, offset: 0.4 }, { transform: end, opacity: 0 }],
        { duration: 400, easing: "cubic-bezier(.45, 0, .25, 1)", fill: "forwards" }),
      w.animate([{ opacity: 1 }, { opacity: 0 }], { duration: 340, delay: 60, easing: "ease-out", fill: "forwards", pseudoElement: "::before" }),
    ];
    const mine = gameAnims;
    Promise.all(mine.map((a) => a.finished)).then(async () => {
      if (gameAnims !== mine) return;
      shut();
      // the new score is fetched and the Progress list drawn again only now: during the shrink it cost a long frame.
      // Then the link it landed in (the same link in the new list) gives its small bounce.
      await refresh();
      const land = (toHref && [...document.querySelectorAll("a[href]")].find((a) => a.getAttribute("href") === toHref && onScreen(a))) || (onScreen(to) ? to : null);
      if (land && land.animate) land.animate([{ transform: "scale(.92)" }, { transform: "scale(1.04)", offset: 0.6 }, { transform: "scale(1)" }],
        { duration: 340, easing: "ease-out", composite: "add" });
    }).catch(() => { /* opened again halfway */ });
    gameShut = setTimeout(() => { if (w.classList.contains("is-closing")) { shut(); refresh(); } }, 1200);   // a backstop if the animations never finish
  }
  $("#layout").inert = false;
  refocus();
}

function hintDock() {        // the first visit: a word next to the button, gone after a while or on any click
  const tip = el("div", "dock-tip", `Ask me about anything you see in the tour. <span lang="zh-Hant">導覽裡看到什麼都可以問我。</span>`);
  $("#dock").appendChild(tip);
  setTimeout(() => tip.remove(), 9000);
}

function bindUi() {
  const shut = () => $("#desk").hidden || $("#desk").classList.contains("is-closing");
  $("#dockChat").addEventListener("click", (e) => (shut() ? openDesk("chat", e.currentTarget) : $("#pane-chat").hidden ? showTab("chat") : closeDesk()));
  $("#dockGames").addEventListener("click", (e) => (shut() ? openDesk("progress", e.currentTarget) : $("#pane-progress").hidden ? showTab("progress") : closeDesk()));
  $("#deskClose").addEventListener("click", closeDesk);
  // 11/22 evening (the user: the tab highlight was off after making the window bigger or smaller): the window's width
  // changes over 0.5 s, and the resize event sent at the click measured the tabs before that. The tab row is watched
  // instead (below), so the highlight follows the tabs on every frame of the change.
  const sizeBtn = (big) => {           // 11/23 (review): the button says what a click will do now
    const b = $("#deskBig");
    b.setAttribute("aria-pressed", String(big));
    b.title = big ? "Make the window smaller 縮小視窗" : "Make the window bigger 放大視窗";
    b.setAttribute("aria-label", big ? "Make the window smaller" : "Make the window bigger");
  };
  $("#deskBig").addEventListener("click", () => {
    const big = !$("#desk").classList.contains("is-big");
    $("#desk").classList.toggle("is-big", big); sizeBtn(big); store.set("deskBig", big);
    // the big map beside it gets narrower or wider with it (style.css): draw it again at its new width
    if (typeof Minimap !== "undefined" && Minimap.state() === "open") window.dispatchEvent(new Event("resize"));
  });
  if (store.get("deskBig", false)) { $("#desk").classList.add("is-big"); sizeBtn(true); }
  // 11/22 evening: the settings panel grows open and folds away in CSS (.desk-settings transitions, display allow-discrete)
  $("#deskSet").addEventListener("click", () => { const s = $("#deskSettings"); s.hidden = !s.hidden; $("#deskSet").setAttribute("aria-expanded", String(!s.hidden)); });
  // 11/23 (review): Esc anywhere on the page closes one thing at a time: the game window, then the big map, then this
  // window. It listened on this window only, so it depended on where the focus was, and with the map open it closed both.
  // While the list of places ("You are here") is open, Esc is that list's own.
  document.addEventListener("keydown", (ev) => {
    if (ev.key !== "Escape" || ev.defaultPrevented || ev.isComposing) return;
    let listOpen = false;
    try { listOpen = $("#roomSelect").matches(":open"); } catch { listOpen = false; }      // :open is not known everywhere
    if (listOpen || (ev.target instanceof Element && ev.target.closest("option, optgroup"))) return;
    const gw = $("#gameWin");
    if (gw && !gw.hidden) { ev.preventDefault(); closeGame(); return; }
    if (EMBED) return;
    if (typeof Minimap !== "undefined" && Minimap.state() === "open") { ev.preventDefault(); Minimap.setState("mini"); return; }
    if (!$("#desk").hidden && !$("#desk").classList.contains("is-closing")) { ev.preventDefault(); closeDesk(); }
  });
  // 11/22 night (the user: a click outside the assistant should shrink it back, the way the map does): a clear layer over
  // the tour while the window is open (the tour is in iStaging's frame, so its clicks never reach this page). It sits
  // under the map's layer, so with both open the first click shrinks the map and the next one the window. The small map
  // and the window itself stay clickable. On only once the window has landed (.layout.is-desk), off as soon as it closes.
  if (!EMBED) {
    const ds = document.createElement("div");
    ds.className = "desk-scrim"; ds.id = "deskScrim"; ds.setAttribute("aria-hidden", "true");
    $("#layout").insertBefore(ds, $("#side"));
    ds.addEventListener("pointerdown", (ev) => {
      ev.preventDefault();
      // 11/23 (review): the second click of a double click outside a closing game lands here; it closed this window too
      if (performance.now() - gameClosedAt < 450) return;
      closeDesk();
    });
  }
  for (const b of document.querySelectorAll(".tabs [role=tab]")) b.addEventListener("click", () => showTab(b.id.replace("tab-", "")));
  $("#tabs").addEventListener("scroll", fitTabs, { passive: true });
  window.addEventListener("resize", () => { moveInk(true); fitTabs(); });
  // the tabs themselves are watched too (11/23 review): the Progress badge one digit longer moves the tabs after it, while
  // the row keeps its size
  if ("ResizeObserver" in window) {
    const ro = new ResizeObserver(() => { moveInk(true); fitTabs(); });
    ro.observe($("#tabs"));
    for (const b of document.querySelectorAll(".tabs [role=tab]")) ro.observe(b);
  }
  if (document.fonts && document.fonts.ready) document.fonts.ready.then(() => { moveInk(true); fitTabs(); });
  // 11/23 (review): language and model are two radio groups (role="radio", aria-checked); Tab stops at the chosen one and
  // the arrow keys move the choice
  const check = (sel, on) => {
    const all = [...document.querySelectorAll(sel)], stop = all.includes(on) ? on : all[0];
    for (const x of all) { x.setAttribute("aria-checked", String(x === on)); x.tabIndex = x === stop ? 0 : -1; }
  };
  const langBtns = [...document.querySelectorAll("[data-lang]")], modelBtns = [...document.querySelectorAll("[data-model]")];
  check("[data-lang]", langBtns.find((x) => x.dataset.lang === S.langPref));
  check("[data-model]", modelBtns.find((x) => x.dataset.model === S.model));
  for (const b of langBtns) {
    b.addEventListener("click", () => {
      S.langPref = b.dataset.lang; store.set("lang", S.langPref);
      check("[data-lang]", b);
      if (S.langPref !== "auto") S.lastLang = S.langPref;
    });
  }
  for (const b of modelBtns) {
    b.addEventListener("click", async () => {
      const was = S.model;
      S.model = b.dataset.model; store.set("model", S.model);
      check("[data-model]", b);
      try { await post("/api/settings", { session: S.session, model: S.model }); }
      catch {          // 11/23 (review): the server did not take it: back to the model it still uses, and say so
        S.model = was; store.set("model", was);
        check("[data-model]", modelBtns.find((x) => x.dataset.model === was));
        sayNear(b.closest(".seg"), LB("Could not switch the model. Check that 啟動_AI助理.bat is running.", "換不了模型，請確認 啟動_AI助理.bat 有在執行。"), { err: true });
      }
    });
  }
  for (const g of document.querySelectorAll(".seg[role=radiogroup]")) g.addEventListener("keydown", (e) => {
    const step = { ArrowRight: 1, ArrowDown: 1, ArrowLeft: -1, ArrowUp: -1 }[e.key];
    const all = [...g.querySelectorAll("[role=radio]")], i = all.indexOf(e.target);
    if (!step || i < 0) return;
    e.preventDefault();
    const n = all[(i + step + all.length) % all.length];
    n.focus(); n.click();
  });
  // 11/23 (review): the list is for saying where you are after walking in the tour (its title says so); it moves "you are
  // here" and leaves the tour as it is. Before, it loaded that scene again in the tour.
  $("#roomSelect").addEventListener("change", (e) => setHere(e.target.value));
  // 11/22 afternoon: a game link here opens the game window over the tour (Ctrl, Shift or the middle button still open a tab)
  if (!EMBED) document.addEventListener("click", (e) => {
    const a = e.target instanceof Element ? e.target.closest('a[href^="/lakeside/games/"]') : null;
    if (!a || e.defaultPrevented || e.button !== 0 || e.ctrlKey || e.metaKey || e.shiftKey || e.altKey) return;
    e.preventDefault();
    openGame(a.getAttribute("href"), a);
  });
  window.addEventListener("storage", (e) => {        // a mini-game in another tab saved a result
    if (e.key === "lia.gamesUpdated") fetch(`/api/state?session=${encodeURIComponent(S.session)}`).then((r) => r.json()).then(updateState).catch(() => {});
  });
  $("#askForm").addEventListener("submit", (e) => { e.preventDefault(); ask(); });
  $("#askInput").addEventListener("keydown", (e) => { if (e.key === "Enter" && !e.shiftKey && !e.isComposing) { e.preventDefault(); ask(); } });
  $("#askInput").addEventListener("input", growAsk);       // the box grows with a long question (up to 200 px)
  post("/api/settings", { session: S.session, model: S.model }).then(updateState).catch(() => { /* the status line says the server is down */ });
}

function showTab(name) {
  for (const b of document.querySelectorAll(".tabs [role=tab]")) b.setAttribute("aria-selected", String(b.id === "tab-" + name));
  const order = [...document.querySelectorAll(".tabs [role=tab]")].map((t) => t.id.replace("tab-", ""));
  const was = [...document.querySelectorAll(".pane")].find((p) => !p.hidden);
  const dir = was && order.indexOf(name) < order.indexOf(was.id.replace("pane-", "")) ? "left" : "right";
  for (const p of document.querySelectorAll(".pane")) {
    const show = p.id === "pane-" + name;
    if (show && p.hidden) { p.dataset.dir = dir; enter(p, 460); }
    p.hidden = !show;
  }
  if (name === "progress") renderProgress(true);
  if (name === "how") renderHow();
  if (name === "map" && typeof Minimap !== "undefined") Minimap.refresh();
  moveInk();
  const nav = $("#tabs"), tab = $("#tab-" + name);
  if (nav && tab && nav.scrollWidth > nav.clientWidth) {          // the chosen tab scrolled into view in a narrow window
    const l = tab.offsetLeft - 12, r = tab.offsetLeft + tab.offsetWidth + 12;
    if (l < nav.scrollLeft) nav.scrollTo({ left: l, behavior: RM.matches ? "auto" : "smooth" });
    else if (r > nav.scrollLeft + nav.clientWidth) nav.scrollTo({ left: r - nav.clientWidth, behavior: RM.matches ? "auto" : "smooth" });
  }
}
// the line under the chosen tab slides to it (jump = place it without the slide, e.g. when the window opens)
function moveInk(jump) {
  const ink = $(".tab-ink"), a = $(".tabs [aria-selected=true]");
  if (!ink || !a || !a.offsetWidth) return;
  if (jump) ink.classList.add("no-anim");
  ink.style.width = `${a.offsetWidth}px`;                  // third look: a piece of glass under the whole chosen tab
  ink.style.transform = `translateX(${a.offsetLeft}px)`;
  if (jump) requestAnimationFrame(() => ink.classList.remove("no-anim"));
}
// in a window too narrow for the five tabs the row scrolls sideways and fades at the edge that has more
function fitTabs() {
  const nav = $("#tabs");
  if (!nav) return;
  const over = nav.scrollWidth > nav.clientWidth + 1;
  nav.classList.toggle("is-scroll", over);
  nav.classList.toggle("is-end", over && nav.scrollLeft + nav.clientWidth >= nav.scrollWidth - 2);
}
let flashTimer = null;
function flashRoom() {
  const sel = $("#roomSelect");
  if (!sel || RM.matches) return;
  sel.classList.remove("is-changed"); void sel.offsetWidth; sel.classList.add("is-changed");
  // 11/23 (review): off again once it has played; left on, the gold flash came back every time the window was opened
  clearTimeout(flashTimer); flashTimer = setTimeout(() => sel.classList.remove("is-changed"), 1100);
}

async function post(url, body) {
  const r = await fetch(url, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
  return r.json();
}

let healthTimer = null;
async function checkHealth() {
  clearTimeout(healthTimer);
  const el = $("#status");
  try {
    const h = await fetch("/api/health").then((r) => r.json());
    if (h.offline) {        // 11/22: the saved copy on GitHub Pages (pages/offline.js) while the laptop is off
      el.className = "status offline";
      el.innerHTML = L(`Saved copy from ${h.saved} · the AI is off`, `${h.saved} 存的離線版・AI 沒開`);
      el.title = LT("The AI runs on the presenter's laptop and is not running right now. Saved answers, the map and the casebook still work.", "AI 跑在報告用的筆電上，現在沒開。存好的回答、地圖和事件簿照常能用。");
      return;
    }
    const ok = h.neo4j && h.ollama;
    el.className = "status " + (ok ? "ok" : "bad");
    const n = h.counts ? Object.values(h.counts.nodes || {}).reduce((a, b) => a + b, 0) : 0;
    const loaded = (h.loaded || []).join(", ") || LT("loading models…", "模型載入中…");
    el.innerHTML = ok ? `${L(`Knowledge graph: ${n} nodes`, `知識圖 ${n} 個節點`)} · ${esc(loaded)}`
      : L(`Not ready: ${!h.neo4j ? "Neo4j" : "Ollama"} is not running. Start it with 啟動_AI助理.bat`, `還沒準備好：${!h.neo4j ? "Neo4j" : "Ollama"} 沒有啟動，請執行 啟動_AI助理.bat`);
    el.title = ok ? LT(`Neo4j and the local models are running (${loaded})`, "Neo4j 和本機模型都在運作") : el.textContent;
    // 11/23 (review): not ready yet: look again every 8 s, so the line turns green by itself once Neo4j and Ollama are up
    if (!ok) healthTimer = setTimeout(checkHealth, 8000);
    else if (!(h.loaded || []).length) healthTimer = setTimeout(checkHealth, 4000);
  } catch {
    el.className = "status bad"; el.textContent = "The assistant server is not running. 小幫手的伺服器沒有啟動。";
    healthTimer = setTimeout(checkHealth, 8000);
  }
}

/* ---------------------------------------------------------------- rooms and the tour */
function fillRoomSelect() {
  const sel = $("#roomSelect"); sel.innerHTML = "";
  // 11/22 evening: where a <select> can be styled (style.css, base-select), each place gets two lines and the button shows
  // the first one through <selectedcontent>; elsewhere the options stay plain text
  const rich = !!(window.CSS && CSS.supports("appearance", "base-select"));
  if (rich) { const b = document.createElement("button"); b.type = "button"; b.appendChild(document.createElement("selectedcontent")); sel.appendChild(b); }
  const groups = {};
  for (const r of S.rooms) (groups[r.area_en] ||= { zh: r.area_zh, rooms: [] }).rooms.push(r);
  for (const [en, g] of Object.entries(groups)) {
    const og = document.createElement("optgroup"); og.label = `${en} ${g.zh}`;
    for (const r of g.rooms.sort((a, b) => (a.story || 99) - (b.story || 99) || a.url_index - b.url_index)) {
      const o = document.createElement("option"); o.value = r.key;
      const plain = r.it_en === r.name_en ? `${r.it_en} ${r.it_zh}` : `${r.it_en} ${r.it_zh} (${r.name_en}${r.name_zh ? " " + r.name_zh : ""})`;
      if (rich) {
        o.innerHTML = `<span class="ro-t">${esc(r.it_en)} <span lang="zh-Hant">${esc(r.it_zh)}</span></span>` +
          (r.it_en === r.name_en ? "" : `<span class="ro-s">${esc(r.name_en)}${r.name_zh ? " " + esc(r.name_zh) : ""}</span>`);
      } else o.textContent = plain;
      og.appendChild(o);
    }
    sel.appendChild(og);
  }
}

let toastTimer = null, tourUrl = "";
// 11/23 (review): the tour's address is replaced, not added to the browser's history, so Back does not walk the hidden tour
// through earlier scenes that "you are here" no longer matches. The first scene is the frame's own src.
function showTour(url) {
  const fr = $("#tour");
  tourUrl = url;
  if (!fr.getAttribute("src")) { fr.setAttribute("src", url); return; }
  try { fr.contentWindow.location.replace(url); } catch { fr.setAttribute("src", url); }
}
async function goTo(key, opt = {}) {
  const r = S.byKey[key]; if (!r) return;
  if (EMBED && opt.jump) {         // inside iStaging: take the whole tour to that scene (a new tab if iStaging does not allow it)
    if (S.inOurPage) { askAncestors({ type: "lakeside:goto", room: key }); return; }      // our own page around the tour moves its tour instead
    try { window.top.location.href = r.url; } catch { window.open(r.url, "_blank", "noopener"); }
    return;
  }
  const moved = S.room !== null && S.room !== key;
  S.room = key; store.set("room", key);
  roomBg(key);
  $("#roomSelect").value = key;
  if (moved) flashRoom();
  if (typeof Minimap !== "undefined") Minimap.update(key);      // the mini map at the top left of the tour
  // 11/23 (review): a jump the visitor asked for (the map, a Go to button, the map in iStaging's window) always moves the
  // tour, also to the scene it was last sent to: the visitor may have walked on inside it since, which this page never hears
  if (!EMBED && (opt.jump || tourUrl !== r.url)) showTour(r.url);
  if (!opt.quiet && !EMBED) {
    const toast = $("#tourToast");
    toast.innerHTML = `${PIN}<span>Opening <b>${esc(r.it_en)}</b> in the tour <span lang="zh-Hant">前往${esc(r.it_zh)}</span></span>`;
    toast.classList.add("show"); clearTimeout(toastTimer); toastTimer = setTimeout(() => toast.classList.remove("show"), 3200);
  }
  const res = await post("/api/visit", { session: S.session, room: key }).catch(() => null);
  if (res) updateState(res);
}

function updateState(res) {
  if (!res || !res.state) return;
  const before = S.state;
  S.state = res.state; if (res.session) S.session = res.session;
  if (res.state.total_findings) S.totalFindings = res.state.total_findings;
  $("#progBadge").textContent = `${res.state.found_n || 0}/${S.totalFindings}`;
  const games = res.state.games || {}, played = GAMES.filter((g) => games[g[0]]).length;
  $("#dockGamesN").textContent = `${played}/${GAMES.length}`;
  if (before) {           // a new weakness or a new case played: the number jumps once
    if ((res.state.found_n || 0) > (before.found_n || 0)) bump($("#progBadge"));
    if (played > GAMES.filter((g) => (before.games || {})[g[0]]).length) bump($("#dockGamesN"));
  }
  // 11/22 evening (frame drops): the Progress tab is drawn again only when something it shows has changed
  const shows = (s) => (s ? JSON.stringify([s.found, s.games, s.visited_keys]) : "");
  if (!$("#pane-progress").hidden && shows(before) !== shows(res.state)) renderProgress(false);
}

/* ---------------------------------------------------------------- chat */
function renderEmpty() {
  const th = $("#thread");
  th.innerHTML = `<div class="empty">
    <h2>Your first day in Lakeside Resort's IT team <span lang="zh-Hant">資訊部新人的第一天</span></h2>
    <p>Walk the tour and ask me about any place, system or rule. Every answer comes from the resort's knowledge graph, and you can open “How I found this” to see the query.</p>
    <p lang="zh-Hant">一邊走導覽一邊問我。每個回答都是從渡假村的知識圖查出來的，點「我怎麼查到的」可以看查詢過程。</p>
    <p class="starter-h">Try asking <span lang="zh-Hant">可以這樣問</span></p>
    <div class="starter"></div></div>`;
  const starters = [
    ["What is in this place?", "這裡有什麼？"], ["Who can see guests' passport copies?", "誰可以看客人的護照影本？"],
    ["I clicked a link in an email and typed my password", "我點了信裡的連結還輸入了密碼"], ["What should I do next?", "接下來要去哪？"],
  ];
  const box = $(".starter", th);
  // 11/22 evening (the user: why are they apart?): one button per question with both languages, like the follow-up
  // questions under each answer; it asks in the chat's language (the language button in the settings, or the last
  // question's language). Before, the English and the Chinese question were two buttons side by side.
  starters.forEach(([en, z], i) => {
    const b = document.createElement("button"); b.type = "button"; b.className = "chip"; b.innerHTML = LB(en, z);
    b.style.setProperty("--i", i);
    b.addEventListener("click", () => ask(zh() || S.langPref === "zh" ? z : en, box)); box.appendChild(b);
  });
}

function growAsk() {
  const inp = $("#askInput");
  inp.style.height = "";
  if (inp.value) inp.style.height = `${Math.min(200, inp.scrollHeight + 2)}px`;
}
// near: where to say so if an answer is still coming (the box the button is in; the ask box when typed)
function ask(text, near) {
  const inp = $("#askInput");
  const q = (text ?? inp.value).trim();
  if (!q) return false;
  if (S.busy) { if (near) busyNote(near); else busyNote($("#askForm"), true); return false; }
  inp.value = ""; growAsk();
  stream("/api/chat", { session: S.session, message: q, room: S.room, lang: S.langPref }, q);
  return true;
}

// true when it was sent; false while the last answer is still coming (the caller keeps what was typed and says so)
function runAction(tool, target, label) {
  if (S.busy) return false;
  showTab("chat");
  stream("/api/action", { session: S.session, tool, target, label, room: S.room, lang: S.langPref }, label);
  return true;
}
// 11/23 (review): a short line next to what was pressed, gone after a few seconds. A question while the last answer was
// still coming did nothing at all (and a pasted email was cleared); a failed save said nothing.
function sayNear(at, html, opt = {}) {
  if (!at || !at.isConnected) return;
  const sib = opt.before ? at.previousElementSibling : at.nextElementSibling;
  let n = sib && sib.classList.contains("near-note") ? sib : null;
  if (!n) {
    n = el("p", "near-note");
    n.setAttribute("role", "status");
    if (opt.before) at.before(n); else at.after(n);
  }
  n.classList.toggle("is-err", !!opt.err);
  n.innerHTML = html;
  clearTimeout(n.timer);
  n.timer = setTimeout(() => n.remove(), 4500);
}
const busyNote = (at, before) => sayNear(at, LB("Still answering the last question. Try again when it is done.", "上一題還在回答，等它答完再按一次。"), { before });

async function stream(url, body, shown) {
  S.busy = true; $("#askBtn").disabled = true;
  const th = $("#thread");
  if ($(".empty", th)) th.innerHTML = "";
  th.setAttribute("aria-busy", "true");                     // 11/23 (review): screen readers wait for the whole answer
  const u = document.createElement("div"); u.className = "msg user"; u.innerHTML = `<div class="bubble">${esc(shown)}</div>`; th.appendChild(enter(u));
  const m = document.createElement("div"); m.className = "msg bot";
  m.innerHTML = `<div class="work"><span class="dots" aria-hidden="true"><i></i><i></i><i></i></span><span class="w">${L("Thinking about which tool to use", "判斷要用哪個工具")}</span></div><div class="answer"><span class="caret"></span></div>`;
  th.appendChild(m); setTimeout(() => enter(m), 90); th.scrollTop = th.scrollHeight;
  const ansEl = $(".answer", m), workEl = $(".work", m);
  let text = "", card = null, finished = false, resp = null, stalled = false, idle = null;
  // 11/23 (review): the card comes before the words, so scrolling to the bottom showed the card's lower half while the
  // answer grew above it, out of view. Now the start of this answer comes to the top when the card arrives and at the
  // end, unless the visitor has scrolled the chat in the meantime.
  let own = false;
  const mine = () => { own = true; };
  const mineKey = (e) => { if (/^(Page(Up|Down)|Arrow(Up|Down)|Home|End)$/.test(e.key)) own = true; };
  const mineBar = (e) => { if (e.target === th) own = true; };          // the scroll bar
  th.addEventListener("wheel", mine, { passive: true }); th.addEventListener("touchmove", mine, { passive: true });
  th.addEventListener("keydown", mineKey); th.addEventListener("pointerdown", mineBar);
  const showStart = () => { if (!own) th.scrollTo({ top: Math.max(0, m.offsetTop - th.offsetTop - 12) }); };
  // 11/23 (review): 90 s without a word from the server: stop waiting (a stuck model kept every button dead for up to
  // ten minutes) and say that the answer stopped
  const ctl = typeof AbortController === "function" ? new AbortController() : null;
  const wake = () => { clearTimeout(idle); idle = setTimeout(() => { stalled = true; if (ctl) ctl.abort(); }, 90000); };
  wake();
  try {
    resp = await fetch(url, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body), signal: ctl ? ctl.signal : undefined });
    if (resp.status === 429 || resp.status === 503) {        // visitors through the tunnel: the limits in server.py
      const j = await resp.json().catch(() => ({}));
      ansEl.innerHTML = `<p class="err">${esc(j.error || "Busy. 現在忙不過來。")}</p>`; finished = true; workEl.innerHTML = L("Not now", "稍後再問");
      return;
    }
    if (!resp.ok || !resp.body) throw new Error("HTTP " + resp.status);
    const reader = resp.body.getReader(); const dec = new TextDecoder(); let buf = "";
    for (;;) {
      const { value, done } = await reader.read(); if (done) break;
      wake();
      buf += dec.decode(value, { stream: true });
      let i;
      while ((i = buf.indexOf("\n\n")) >= 0) {
        const chunk = buf.slice(0, i); buf = buf.slice(i + 2);
        let ev = "message", data = "";
        for (const line of chunk.split("\n")) {
          if (line.startsWith("event: ")) ev = line.slice(7); else if (line.startsWith("data: ")) data += line.slice(6);
        }
        const d = data ? JSON.parse(data) : {};
        if (ev === "start") { S.session = d.session; S.lastLang = d.lang; store.set("session", S.session); }
        else if (ev === "route") {
          const w = $(".w", workEl);
          if (w) { w.innerHTML = TOOL[d.tool] ? L(TOOL[d.tool][0] + "…", TOOL[d.tool][1] + "…") : esc(d.tool) + "…"; w.classList.remove("swap"); void w.offsetWidth; w.classList.add("swap"); }
        }
        else if (ev === "card") { card = renderCard(d); m.insertBefore(enter(card, 1400), null); showStart(); }
        else if (ev === "token") { text += d.text; ansEl.innerHTML = md(text) + '<span class="caret"></span>'; }
        else if (ev === "replace") { text = d.text; ansEl.innerHTML = md(text); }
        else if (ev === "error") { const e = document.createElement("p"); e.className = "err"; e.textContent = d.message; if (d.detail) e.title = d.detail; m.appendChild(e); }
        else if (ev === "done") {
          finished = true; ansEl.innerHTML = md(d.answer || text);
          // 11/23 (review): a fault while drawing the rest keeps the answer and adds one line under it (the answer used to
          // be replaced by "could not be reached")
          try { finish(m, d, workEl); } catch (err) { m.appendChild(el("p", "err", LB("Part of this answer could not be shown.", "這個回答有一部分顯示不出來。"))); console.error(err); }
        }
      }
    }
  } catch (e) {
    // 11/23 (review): no answer from the server at all: it could not be reached (the lines below used to write over this
    // at once). Cut off on the way, or 90 s without a word: the lines below say it stopped, with what had come.
    if (!resp && !stalled) {
      finished = true;
      ansEl.innerHTML = `<p class="err">${LB("The assistant could not be reached. Check that 啟動_AI助理.bat is running.", "連不到小幫手的伺服器，請確認 啟動_AI助理.bat 有在執行。")}</p>`;
      workEl.innerHTML = L("Stopped", "已中斷");
    }
  } finally {
    clearTimeout(idle);
    th.removeEventListener("wheel", mine); th.removeEventListener("touchmove", mine);
    th.removeEventListener("keydown", mineKey); th.removeEventListener("pointerdown", mineBar);
    if (!finished) {
      ansEl.innerHTML = md(text) + `<p class="err">${LB("The answer stopped before it finished. Check that 啟動_AI助理.bat is still running, then ask again.", "回答中途斷了。請確認 啟動_AI助理.bat 還在執行，再問一次。")}</p>`;
      workEl.innerHTML = L("Stopped", "已中斷");
    }
    S.busy = false; $("#askBtn").disabled = false; th.removeAttribute("aria-busy");
    showStart();
  }
}

function finish(m, d, workEl) {
  const tr = d.trace || {};
  const used = tr.tool_used || (tr.route || {}).tool;
  // the saved copy's "AI is off" note took no time at all: its label alone (a "· 0 s" looked like a fault)
  workEl.innerHTML = `<span>${TOOL[used] ? L(...TOOL[used]) : esc(used || "")}${tr.offline ? "" : ` · ${(tr.timings || {}).total_s ?? "?"} s`}</span>`;
  workEl.classList.add("is-done");
  let k = 0;                       // the plates, then the follow-up questions, come in one after another
  if (d.go && d.go.length) {
    const g = document.createElement("div"); g.className = "go";
    for (const r of d.go) {
      const b = document.createElement("button"); b.type = "button"; b.className = "plate lg-hi";
      b.innerHTML = `<span class="to">Go to ${esc(rnEn(r))}${rnZh(r) ? `<span class="zh-line" lang="zh-Hant">前往${esc(rnZh(r))}</span>` : ""}</span>${r.why_en ? `<span class="why">${LB(r.why_en, r.why_zh)}</span>` : ""}<span class="arr">${ARROW}</span>`;
      b.style.setProperty("--i", k++);
      b.addEventListener("click", () => goTo(r.key, { jump: true })); g.appendChild(b);
    }
    m.appendChild(enter(g));
  }
  if (d.followups && d.followups.length) {
    const f = document.createElement("div"); f.className = "follow";
    for (const q of d.followups) {
      // 11/22: the server sends each question in both languages; the one in the chat's language is what gets asked
      const asked = typeof q === "string" ? q : q.text || q.en;
      const b = document.createElement("button"); b.type = "button"; b.className = "chip"; b.innerHTML = typeof q === "string" ? esc(q) : L(q.en || q.text, q.zh);
      b.style.setProperty("--i", k++);
      b.addEventListener("click", () => ask(asked, f)); f.appendChild(b);
    }
    m.appendChild(enter(f));
  }
  m.appendChild(renderTrace(tr));
  updateState({ state: d.state });
}

function md(s) {
  const lines = esc(s).replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>").split(/\n/);
  let html = "", list = null;
  for (const raw of lines) {
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

/* ---------------------------------------------------------------- cards */
function el(tag, cls, html) { const e = document.createElement(tag); if (cls) e.className = cls; if (html !== undefined) e.innerHTML = html; return e; }

function head(card, c) {
  const h = el("div", "card-head");
  const lb = LABEL[c.label] ? L(...LABEL[c.label]) : "";
  h.innerHTML = `<h3>${pL(c.title)}</h3>${lb ? `<span class="kind" data-t="${esc(c.label)}">${lb}</span>` : ""}${c.subtitle ? `<span class="sub">${pL(c.subtitle)}</span>` : ""}`;
  card.appendChild(h);
  if (c.text && pick(c.text)) card.appendChild(el("p", "text", pLB(c.text)));
  if (c.note && pick(c.note)) card.appendChild(el("p", "note", pLB(c.note)));
  if (c.badges && c.badges.length) {
    const b = el("div", "badges");
    for (const x of c.badges) b.appendChild(el("span", "badge", pL(x)));
    card.appendChild(b);
  }
}

function entityChip(x) {
  const b = el("button", "chip", both(x) + (x.tag_en ? `<span class="tag">${L(x.tag_en, x.tag_zh)}</span>` : ""));
  b.type = "button";
  if (x.refs && x.refs.length) b.title = x.refs.join(", ");
  b.addEventListener("click", () => { if (!runAction("explain", x.en || x.zh, t(`Tell me about ${x.en}`, `說明${x.zh || x.en}`))) busyNote(b.closest("ul, .items") || b); });
  return b;
}
// an extension number, the same way everywhere (11/23 review): "ext. 3100 分機 3100", as in the mini-games
const extL = (x) => L(`ext. ${x}`, `分機 ${x}`);

// A stop behind a lock the player has to open in the tour: shown, not clickable.
function lockedStop(r) {
  const b = el("span", "roomlink is-locked", PIN + roomNameL(r));
  b.title = LT("Open the lock in the tour to get here", "在導覽裡打開這道鎖才到得了");
  return b;
}

function roomLink(r) {
  const b = el("button", "roomlink", PIN + roomNameL(r));
  b.type = "button"; b.title = LT("Show it in the tour", "在導覽裡打開");
  b.addEventListener("click", () => goTo(r.key, { jump: true }));
  return b;
}

function renderSections(card, secs) {
  let i = 0;
  for (const s of secs || []) {
    const sec = el("div", "sec"); sec.appendChild(el("h4", "", L(s.h_en, s.h_zh)));
    const typ = SEC_TYPE[s.h_en] || (s.kind === "rooms" ? "Room" : "");
    if (typ) sec.dataset.t = typ;                  // the colour of that kind of node, as in the graph
    sec.style.setProperty("--i", Math.min(i++, 8));
    if (s.kind === "rooms") { const w = el("div", "items"); for (const r of s.items) w.appendChild(roomLink(r)); sec.appendChild(w); }
    else if (s.kind === "flows") {
      const ul = el("ul", "flows");
      for (const f of s.items) {
        const li = el("li"); li.innerHTML = `<span class="dir">${f.dir === "out" ? L("to", "送到") : L("from", "來自")}</span>${both(f.other)} <span class="data">(${f.data.map((x) => pL(x)).join(", ")})</span>`;
        ul.appendChild(li);
      }
      sec.appendChild(ul);
    } else if (s.kind === "tree") {
      const ul = el("ul", "tree");
      for (const x of s.items) {
        const li = el("li"); li.appendChild(entityChip(x));
        if (x.sub && x.sub.length) li.appendChild(el("span", "subs", x.sub.map((y) => pL(y)).join(", ")));
        ul.appendChild(li);
      }
      sec.appendChild(ul);
    } else { const w = el("div", "items"); for (const x of s.items) w.appendChild(entityChip(x)); sec.appendChild(w); }
    card.appendChild(sec);
  }
}

function renderCard(c) {
  const card = el("section", "card lg-hi");
  if (c.type === "steps") return stepsCard(card, c);
  if (c.type === "access") return accessCard(card, c);
  if (c.type === "route") return routeCard(card, c);
  if (c.type === "email") return emailCard(card, c);
  if (c.type === "finding") return findingCard(card, c);
  if (c.type === "progress") return progressCard(card, c);
  head(card, c); renderSections(card, c.sections); alternatives(card, c);
  return card;
}

function alternatives(card, c) {
  if (!c.alternatives || !c.alternatives.length) return;
  const sec = el("div", "sec"); sec.appendChild(el("h4", "", L("Did you mean something else?", "是不是在問別的？")));
  const w = el("div", "items"); for (const x of c.alternatives) w.appendChild(entityChip(x)); sec.appendChild(w); card.appendChild(sec);
}

function accessCard(card, c) {
  head(card, c);
  const tb = el("table", "access");
  tb.innerHTML = `<thead><tr><th>${L("Role", "職務")}</th><th>${L("Access", "權限")}</th><th>${L("Condition", "條件")}</th></tr></thead>`;
  const body = el("tbody");
  if (!c.rows.length) body.innerHTML = `<tr><td colspan="3">${LB("Nobody may access or keep it.", "沒有任何職務可以存取或保存。")}</td></tr>`;
  for (const r of c.rows) {
    const tr = el("tr");
    tr.innerHTML = `<td>${both(r.role)}${r.ext ? ` <span class="tag">${extL(r.ext)}</span>` : ""}</td><td><span class="lvl ${esc(r.level)}"><i></i>${L(r.level_en, r.level_zh)}</span></td><td>${LB(r.note_en, r.note_zh)}</td>`;
    body.appendChild(tr);
  }
  tb.appendChild(body); card.appendChild(tb);
  card.appendChild(el("p", "note", LB("Everyone else: no access (least privilege).", "其他人：沒有權限（最小權限）。")));
  renderSections(card, c.sections); alternatives(card, c);
  return card;
}

function stepsCard(card, c) {
  head(card, c);
  const b = el("div", "badges");
  if (c.severity) b.appendChild(el("span", "badge sev-" + c.severity, L(`Severity: ${c.severity}`, `嚴重度：${SEV_ZH[c.severity] || c.severity}`)));
  if (pick(c.time)) b.appendChild(el("span", "badge", pL(c.time)));
  card.appendChild(b);
  const ol = el("ol", "steps");
  for (const [n, s] of c.steps.entries()) {
    const li = el("li");
    li.style.setProperty("--i", Math.min(n, 8));
    li.innerHTML = `<div><div>${LB(s.en, s.zh)}</div><div class="step-meta"><b>${pL(s.who)}</b>${s.ext ? ` · ${extL(s.ext)}` : ""} · ${L(s.phase_en, s.phase_zh)}</div></div>`;
    ol.appendChild(li);
  }
  card.appendChild(ol);
  const dEn = (c.dont && c.dont.en) || [], dZh = (c.dont && c.dont.zh) || [];
  const donts = dEn.length ? dEn.map((x, i) => LB(x, dZh[i])) : dZh.map((x) => esc(x));
  if (donts.length) {
    const d = el("div", "dont"); d.innerHTML = `<h4>${L("Don't", "不要")}</h4><ul>${donts.map((x) => `<li>${x}</li>`).join("")}</ul>`;
    card.appendChild(d);
  }
  if (c.contacts && c.contacts.length) {
    const ct = el("div", "contacts");
    ct.innerHTML = c.contacts.map((r) => `<span>${both(r)}${r.ext ? ` <b>${extL(r.ext)}</b>` : ""}</span>`).join("");
    card.appendChild(ct);
  }
  if (c.refs && c.refs.length) card.appendChild(el("div", "refs", `${L("Based on:", "依據：")} ${c.refs.map((x) => pL(x)).join("; ")}`));
  alternatives(card, c);
  return card;
}

function routeCard(card, c) {
  head(card, c);
  card.appendChild(el("p", "note", L(`${c.clicks} clicks through the hotspots`, `一共要點 ${c.clicks} 次`)));
  const r = el("div", "route");
  c.steps.forEach((s, i) => {
    if (i) { r.appendChild(el("span", "arrow", "›")); if (s.teleport) r.appendChild(el("span", "tele", L("teleport", "傳送點"))); }
    r.appendChild(s.locked ? lockedStop(s) : roomLink(s));      // 11/23: stops behind a lock are not a shortcut past it
  });
  card.appendChild(r);
  return card;
}

function emailCard(card, c) {
  head(card, c);
  const lvl = c.verdict.level;
  card.appendChild(el("p", "result " + (lvl === "none" ? "correct" : lvl === "high" ? "none" : "other_room"), pL(c.verdict) + ` <span class="tag">${L("warning score", "警訊分數")} ${c.score}</span>`));
  const meter = el("div", "meter " + lvl); meter.innerHTML = `<b style="width:${Math.min(100, (c.score / 12) * 100)}%"></b>`; card.appendChild(meter);
  if (c.signs.length) {
    const ul = el("ul", "signs");
    for (const s of c.signs) {
      const li = el("li");
      li.innerHTML = `<b>${pL(s)}</b> <q>${esc(s.evidence)}</q> <span class="by">${s.by === "rule" ? L("found by a rule", "規則找到") : L("found by the model, quote checked", "模型找到，引文已核對")}</span><br><span class="tag">${LB(s.d_en, s.d_zh)}</span>`;
      ul.appendChild(li);
    }
    card.appendChild(ul);
  }
  if (c.rejected && c.rejected.length) card.appendChild(el("p", "refs", LB(`${c.rejected.length} sign(s) suggested by the model were dropped because the quoted words are not in the message.`, `模型另外提出 ${c.rejected.length} 個警訊，但引用的文字不在信裡，已排除。`)));
  if (c.procedure && c.procedure.en) {
    const b = el("button", "chip", L(`Open the procedure: ${c.procedure.en || ""}`, `打開流程：${c.procedure.zh || ""}`)); b.type = "button";
    const w = el("div", "follow");
    b.addEventListener("click", () => { if (!runAction("procedure", c.procedure.en, pick(c.procedure))) busyNote(w); });
    w.appendChild(b); card.appendChild(w);
  }
  return card;
}

function findingCard(card, c) {
  const res = { correct: ["Correct: a real weakness", "答對了：這是真的漏洞"], other_room: ["Correct: a real weakness", "答對了：這是真的漏洞"],
    already: ["Already reported", "已經回報過了"], none: ["Not on tonight's audit list", "不在今晚的稽核清單上"],
    close: ["Close: say what is wrong with it", "很接近了：再說清楚它哪裡有問題"] }[c.result];
  card.appendChild(el("p", "result " + c.result, L(...res)));
  if (c.finding) {
    const f = c.finding;
    const h = el("div", "card-head"); h.innerHTML = `<h3>${L(f.en, f.zh)}</h3><span class="badge sev-${esc(f.severity)}">${L(f.severity, SEV_ZH[f.severity])}</span><span class="sub">${L(`risk ${f.risk}`, `風險 ${f.risk}`)}</span>`;
    card.appendChild(h);
    card.appendChild(el("p", "text", `<b>${L("Why it matters:", "為什麼危險：")}</b> ${LB(f.why_en, f.why_zh)}`));
    card.appendChild(el("p", "text", `<b>${L("Fix:", "怎麼改：")}</b> ${LB(f.fix_en, f.fix_zh)}`));
    if (f.breaks.length) card.appendChild(el("div", "refs", `${L("Breaks:", "違反：")} ${f.breaks.map((x) => pL(x)).join("; ")}`));
    if (f.fixed_by.length) { const w = el("div", "items"); w.style.marginTop = "8px"; for (const x of f.fixed_by) w.appendChild(entityChip(x)); card.appendChild(w); }
  }
  const p = el("div", "sec"); p.innerHTML = `<h4>${L("Weaknesses found", "找到的漏洞")} ${c.found} / ${c.total}</h4><div class="bar"><b style="width:${(100 * c.found) / c.total}%"></b></div>`;
  card.appendChild(p);
  return card;
}

function progressCard(card, c) {
  card.appendChild(el("div", "card-head", `<h3>${L("Your progress", "你的進度")}</h3>`));
  // 11/23: only the places asked about here (or opened from our map) are counted, not the ones walked to in the tour,
  // so no "of 47"
  card.appendChild(el("p", "note", LB(`Weaknesses found: ${c.found} of ${c.total}. Places you asked me about: ${c.visited}.`, `找到的漏洞：${c.found} / ${c.total}。問過小幫手的地方：${c.visited} 個。`)));
  card.appendChild(el("div", "bar", `<b style="width:${(100 * c.found) / Math.max(1, c.total)}%"></b>`));
  return card;
}

/* ---------------------------------------------------------------- how I found this */
function renderTrace(tr) {
  if (tr.offline) return document.createDocumentFragment();      // the saved copy's "AI is off" answer: nothing was looked up
  const d = el("details", "trace");
  d.innerHTML = `<summary>How I found this <span lang="zh-Hant">我怎麼查到的</span></summary>`;
  // the time bar fills when it is opened, not again each time the chat is shown (11/23 review)
  d.addEventListener("toggle", () => { if (d.open) enter(d, 1100); });
  const b = el("div", "trace-body");
  const tm = tr.timings || {};
  // where the time went: one bar in three parts, the same colours as the labels under it
  const parts = [["s-route", L("Choose tool", "選工具"), tm.route_s], ["s-tool", L("Match & query", "比對與查詢"), tm.tool_s], ["s-answer", L("Write answer", "寫回答"), tm.answer_s]];
  const sum = parts.reduce((a, p) => a + (+p[2] || 0), 0) || 1;
  b.innerHTML = `<div class="tl"><div class="tl-bar" role="img" aria-label="${esc(LT("Time spent", "花費時間"))}">${parts.map(([c, , s]) => (+s > 0 ? `<i class="${c}" style="width:${Math.max(0.8, (100 * s) / sum).toFixed(1)}%"></i>` : "")).join("")}</div>
    <div class="tl-legend">${parts.map(([c, l, s]) => `<div class="${c}"><b>${l}</b><span>${s ?? "–"} s</span></div>`).join("")}
    <div class="is-total"><b>${L("Total", "合計")}</b><span>${tm.total_s ?? "–"} s</span></div></div></div>`;
  const r = tr.route || {};
  b.appendChild(el("h5", "", L("1. Tool chosen by the model", "模型選的工具")));
  b.appendChild(el("pre", "", esc(JSON.stringify({ tool: r.tool, target: r.target }, null, 0)) + `\n${esc("how 方式: " + LTm(HOW_ZH, r.how))}` +
    (r.stats ? `\n${esc(`${r.stats.model}: ${r.stats.prompt_tokens} prompt tokens in ${r.stats.prompt_s} s, ${r.stats.gen_tokens} tokens out（輸入 ${r.stats.prompt_tokens} 個 token，花 ${r.stats.prompt_s} 秒，輸出 ${r.stats.gen_tokens} 個）`)}` : "")));
  const lk = tr.link || {};
  if (lk.candidates && lk.candidates.length) {
    b.appendChild(el("h5", "", LB(`2. Matching “${lk.query}” to the graph (alias + BM25 + vector, fused by RRF)`, `把「${lk.query}」對到知識圖（別名＋BM25＋向量，用 RRF 合併）`)));
    const tb = el("table");
    tb.innerHTML = `<thead><tr><th>${L("node", "節點")}</th><th>${L("type", "類型")}</th><th>${L("alias", "別名")}</th><th>BM25</th><th>${L("vector", "向量")}</th><th>RRF</th></tr></thead>`;
    const body = el("tbody");
    const top = Math.max(...lk.candidates.map((c) => c.score || 0), 1e-9);
    for (const c of lk.candidates) {
      const row = el("tr", c.key === lk.chosen ? "chosen" : "");
      const rrf = c.score !== undefined ? `<span class="sbar" aria-hidden="true"><i style="width:${((100 * (c.score || 0)) / top).toFixed(0)}%"></i></span>${c.score.toFixed(3)}` : "";
      row.innerHTML = `<td>${L(c.name_en || c.en || c.key, c.name_zh || c.zh)}</td><td><span class="kind" data-t="${esc(c.label)}">${LABEL[c.label] ? L(...LABEL[c.label]) : esc(c.label)}</span></td><td>${c.alias ? c.alias.toFixed(2) : ""}</td><td>${c.ft_rank ? "#" + c.ft_rank + " " + (c.ft_score ?? 0).toFixed(2) : ""}</td><td>${c.vec_rank ? "#" + c.vec_rank + " " + (c.vec_score ?? 0).toFixed(3) : ""}</td><td>${rrf}</td>`;
      body.appendChild(row);
    }
    tb.appendChild(body); b.appendChild(tb);
    if (lk.how) b.appendChild(el("p", "refs", esc("chosen 選中: " + (lk.chosen || "–") + " (" + LTm(HOW_ZH, lk.how) + (lk.confidence ? ", " + LTm(HOW_ZH, lk.confidence) : "") + ")" + (lk.narrowed_to ? " → " + lk.narrowed_to : ""))));
  } else if (lk.how) {
    b.appendChild(el("h5", "", L("2. What it refers to", "指的是什麼")));
    b.appendChild(el("p", "refs", esc(`${lk.query || ""} → ${lk.chosen || "–"} (${LTm(HOW_ZH, lk.how)})`)));
  }
  if (tr.redirect) b.appendChild(el("p", "refs", esc("redirected 轉給: " + tr.redirect)));
  const qs = tr.queries || [];
  if (qs.length) {
    b.appendChild(el("h5", "", L(`3. Read-only Cypher queries on Neo4j (${qs.length})`, `在 Neo4j 執行的唯讀 Cypher（${qs.length} 個）`)));
    for (const q of qs) {
      b.appendChild(el("div", "q-meta", esc(`${LTm(PURPOSE_ZH, q.purpose)}: ${q.rows} rows 筆, ${q.ms} ms` + (q.params && Object.keys(q.params).length ? `  params 參數 ${JSON.stringify(q.params)}` : ""))));
      b.appendChild(el("pre", "", esc(q.cypher)));
    }
  }
  if (tr.facts) {
    b.appendChild(el("h5", "", L("Facts given to the model (it may use nothing else)", "交給模型的資料（只能用這些）")));
    b.appendChild(el("pre", "facts", esc(tr.facts)));
  }
  const g = tr.graph || {};
  if (g.nodes && g.nodes.length > 1) {
    b.appendChild(el("h5", "", L("The part of the graph that was used", "用到的知識圖片段")));
    b.appendChild(drawGraph(g));
    const types = [...new Set(g.nodes.map((n) => n.label))].filter((l) => COLORS[l]);
    b.appendChild(el("div", "legend", types.map((l) => `<span data-t="${esc(l)}">${LABEL[l] ? L(...LABEL[l]) : esc(l)}</span>`).join("")));
  }
  const a = tr.answer_stats || {};
  if (a.model) b.appendChild(el("p", "refs", esc(`${LT("Answer", "回答")}: ${a.model}, ${a.prompt_tokens} prompt tokens, ${a.gen_tokens} tokens at ${a.tok_per_s} tok/s, first words after ${a.first_token_s} s（輸入 ${a.prompt_tokens} 個 token，輸出 ${a.gen_tokens} 個，每秒 ${a.tok_per_s} 個，${a.first_token_s} 秒後出現第一個字）` + (tr.converted_to_traditional ? " · " + LT("converted to Traditional Chinese", "已轉成繁體") : ""))));
  d.appendChild(b);
  return d;
}

function drawGraph(g) {
  const W = 460, H = 260, ns = g.nodes.map((n, i) => ({ ...n, x: W / 2 + 90 * Math.cos((2 * Math.PI * i) / g.nodes.length), y: H / 2 + 70 * Math.sin((2 * Math.PI * i) / g.nodes.length), vx: 0, vy: 0 }));
  const idx = Object.fromEntries(ns.map((n, i) => [n.key, i]));
  const es = g.edges.filter((e) => e.a in idx && e.b in idx);
  for (let it = 0; it < 260; it++) {
    for (let i = 0; i < ns.length; i++) for (let j = i + 1; j < ns.length; j++) {
      const a = ns[i], b = ns[j]; let dx = a.x - b.x, dy = a.y - b.y; const d2 = Math.max(dx * dx + dy * dy, 30), f = 900 / d2;
      const d = Math.sqrt(d2); dx /= d; dy /= d; a.vx += dx * f; a.vy += dy * f; b.vx -= dx * f; b.vy -= dy * f;
    }
    for (const e of es) {
      const a = ns[idx[e.a]], b = ns[idx[e.b]]; const dx = b.x - a.x, dy = b.y - a.y; const d = Math.sqrt(dx * dx + dy * dy) || 1, f = (d - 85) * 0.02;
      a.vx += (dx / d) * f; a.vy += (dy / d) * f; b.vx -= (dx / d) * f; b.vy -= (dy / d) * f;
    }
    for (const n of ns) { n.vx += (W / 2 - n.x) * 0.004; n.vy += (H / 2 - n.y) * 0.006; n.x += n.vx * 0.5; n.y += n.vy * 0.5; n.vx *= 0.6; n.vy *= 0.6;
      n.x = Math.max(40, Math.min(W - 40, n.x)); n.y = Math.max(14, Math.min(H - 14, n.y)); }
  }
  // 11/22 afternoon: the layout settles into a small knot in the middle; spread it over the box (names go to the right
  // of each dot, so the right margin is wider)
  const xs = ns.map((n) => n.x), ys = ns.map((n) => n.y), x0 = Math.min(...xs), x1 = Math.max(...xs), y0 = Math.min(...ys), y1 = Math.max(...ys);
  const L = 22, R = 128, T = 20, B = 20, kx = Math.min(2.6, (W - L - R) / Math.max(1, x1 - x0)), ky = Math.min(2.6, (H - T - B) / Math.max(1, y1 - y0));
  for (const n of ns) { n.x = L + (W - L - R) / 2 + (n.x - (x0 + x1) / 2) * kx; n.y = T + (H - T - B) / 2 + (n.y - (y0 + y1) / 2) * ky; }
  const NS = "http://www.w3.org/2000/svg";
  const svg = document.createElementNS(NS, "svg"); svg.setAttribute("viewBox", `0 0 ${W} ${H}`); svg.setAttribute("class", "graph"); svg.setAttribute("role", "img");
  svg.setAttribute("aria-label", LT("Relationship graph of the nodes used", "用到的節點關係圖"));
  for (const e of es) {
    const a = ns[idx[e.a]], b = ns[idx[e.b]];
    const ln = document.createElementNS(NS, "line"); ln.setAttribute("x1", a.x); ln.setAttribute("y1", a.y); ln.setAttribute("x2", b.x); ln.setAttribute("y2", b.y); ln.setAttribute("class", "edge");
    const tt = document.createElementNS(NS, "title"); tt.textContent = `${a.en} ${e.t} ${b.en}`; ln.appendChild(tt); svg.appendChild(ln);
    const lb = document.createElementNS(NS, "text"); lb.setAttribute("x", (a.x + b.x) / 2); lb.setAttribute("y", (a.y + b.y) / 2); lb.setAttribute("class", "elabel"); lb.setAttribute("text-anchor", "middle"); lb.textContent = e.t; svg.appendChild(lb);
  }
  for (const n of ns) {
    const c = document.createElementNS(NS, "circle"); c.setAttribute("cx", n.x); c.setAttribute("cy", n.y); c.setAttribute("r", 6); c.setAttribute("fill", COLORS[n.label] || "#6f7f83");
    const tt = document.createElementNS(NS, "title"); tt.textContent = `${n.label}: ${n.en} ${n.zh}`; c.appendChild(tt); svg.appendChild(c);
    const tx = document.createElementNS(NS, "text"); tx.setAttribute("x", n.x + 8); tx.setAttribute("y", n.y + 3.5); tx.textContent = (n.en || n.zh || "").slice(0, 22); svg.appendChild(tx);
    if (n.zh && n.zh !== n.en) { const tz = document.createElementNS(NS, "text"); tz.setAttribute("x", n.x + 8); tz.setAttribute("y", n.y + 14); tz.setAttribute("class", "zh"); tz.textContent = n.zh.slice(0, 12); svg.appendChild(tz); }
  }
  return svg;
}

/* ---------------------------------------------------------------- quick tasks */
const TASKS = [
  { h: ["Something happened", "出事了"], p: ["Step-by-step procedures with who to call.", "照步驟處理，也告訴你該找誰。"], items: [
    ["procedure", "Clicked a phishing link or entered a password", "I clicked a link and typed my password", "我點了連結還輸入了密碼"],
    ["procedure", "Ransomware or encrypted files", "A screen asks for a ransom / files are encrypted", "螢幕跳出勒索訊息、檔案被加密"],
    ["procedure", "Received a suspicious email", "I received a suspicious email", "收到可疑的信"],
    ["procedure", "MFA prompts I did not start", "I keep getting MFA prompts I didn't start", "一直收到不是我自己按的登入驗證"],
    ["procedure", "Lost staff badge", "I lost my staff badge", "員工證不見了"],
    ["procedure", "Lost or stolen laptop or phone", "My laptop or phone is lost or stolen", "筆電或手機不見了"],
    ["procedure", "A card terminal looks tampered with", "A card terminal looks tampered with", "刷卡機好像被動過"],
    ["procedure", "Personal data sent to the wrong person", "I sent personal data to the wrong person", "個資寄錯人了"],
    ["procedure", "Found an unknown USB drive", "I found an unknown USB drive", "撿到來路不明的隨身碟"],
    ["procedure", "The POS is down", "The POS is down", "收銀系統當機"]] },
  { h: ["Requests", "申請"], p: ["The standard process, approvals and legal time limits.", "標準流程、核准和法定時限。"], items: [
    ["procedure", "New employee needs access", "A new employee needs access", "新進人員開帳號"],
    ["procedure", "Employee leaving or changing role", "An employee is leaving or changing role", "員工離職或調職"],
    ["procedure", "A guest asks to see, correct or delete their data", "A guest wants to see or delete their data", "客人要查詢或刪除個資"],
    ["procedure", "A vendor needs remote access", "A vendor needs remote access", "廠商要遠端連線"],
    ["procedure", "A supplier asks to change their bank details", "A supplier wants to change bank details", "供應商要改匯款帳戶"],
    ["procedure", "Making a change to a system", "I need to change a system", "要變更系統"],
    ["procedure", "Password or MFA reset", "Reset a password or MFA", "重設密碼或驗證"],
    ["procedure", "Daily card terminal check", "Daily card terminal check", "每日刷卡機檢查"],
    ["procedure", "Smart room reset at checkout", "Smart room reset at checkout", "退房時重設智慧客房"]] },
  { h: ["Look up", "查詢"], p: ["Lists across the whole resort.", "整個渡假村的清單。"], items: [
    ["room_overview", "", "What is in this place?", "這裡有什麼？"],
    ["next_step", "", "What should I do next?", "接下來要去哪？"],
    ["inventory", "personal data", "Systems that store personal data", "存放個資的系統（個資盤點）"],
    ["inventory", "restricted data", "Restricted data and who may see it", "限閱資料和誰能看"],
    ["inventory", "critical systems", "Business-critical systems", "關鍵系統"],
    ["inventory", "cloud vendor services", "Cloud and vendor services", "雲端與外部服務"],
    ["inventory", "iot devices", "IoT and OT devices", "物聯網與 OT 設備"],
    ["inventory", "standards", "Standards and laws we follow", "遵循的標準和法規"]] },
];

// "Case 1 · Inbox Rush" → ["Case 1", "Inbox Rush"], "第一案：收件匣大作戰" → ["第一案", "收件匣大作戰"]
const caseParts = (en, z) => [en.split(" · ")[0], en.split(" · ").slice(1).join(" · ") || en, (z.split("：")[1] || z), z.split("：")[0]];
function renderTasks() {
  const box = $("#tasks"); box.innerHTML = "";
  const gs = el("section", "task-group");
  gs.innerHTML = `<h2>Casebook <span lang="zh-Hant">事件簿</span></h2><p>The Awards Night casebook: four cases, each a shift and then a case board, about five minutes each. ${EMBED ? "They open in this window." : "They open in a window over the tour."} <span lang="zh-Hant">頒獎晚會事件簿共四案，每案先值班、再整理案情板，一案大約五分鐘，${EMBED ? "會在這個視窗裡打開" : "會在導覽上面開一個視窗"}。</span></p>`;
  const gl = el("div", "task-list");
  for (const [k, en, z] of GAMES) {
    const [no, name, zname, zno] = caseParts(en, z);
    const a = el("a", "task", `<span class="en"><i class="case-no">${esc(no.toUpperCase())} <span lang="zh-Hant">${esc(zno)}</span></i>${esc(name)}</span><span class="zh" lang="zh-Hant">${esc(zname)}</span>`);
    a.href = `/lakeside/games/${k}`; a.target = "_self";            // here: the game window (bindUi); inside iStaging's window: this window
    gl.appendChild(a);
  }
  gs.appendChild(gl);
  for (const g of TASKS) {
    const sec = el("section", "task-group");
    sec.innerHTML = `<h2>${esc(g.h[0])} <span lang="zh-Hant">${esc(g.h[1])}</span></h2><p>${esc(g.p[0])} <span lang="zh-Hant">${esc(g.p[1])}</span></p>`;
    const list = el("div", "task-list");
    for (const [tool, target, en, z] of g.items) {
      const b = el("button", "task", `<span class="en">${esc(en)}</span><span class="zh" lang="zh-Hant">${esc(z)}</span>`); b.type = "button";
      b.addEventListener("click", () => { if (!runAction(tool, target, zh() || S.langPref === "zh" ? z : en)) busyNote(list); });
      list.appendChild(b);
    }
    sec.appendChild(list);
    box.appendChild(sec);
  }
  for (const [tool, en, z, ph] of [
    ["check_email", "Check an email for phishing", "幫我看這封信是不是釣魚", "Paste the email here, including the sender line. 把信貼在這裡，包括寄件者。"],
    ["report_finding", "Report a weakness I found", "回報我發現的漏洞", "Describe what you saw and where. 說說你看到什麼、在哪裡。"]]) {
    const sec = el("section", "task-group");
    sec.innerHTML = `<h2>${esc(en)} <span lang="zh-Hant">${esc(z)}</span></h2>`;
    const f = el("form", "paste"); f.innerHTML = `<textarea aria-label="${esc(en)}" placeholder="${esc(ph)}"></textarea><button type="submit">${tool === "check_email" ? "Check it 檢查" : "Report it 回報"}</button>`;
    // 11/23 (review): cleared only once it has been sent; while the last answer is still coming the text stays, with a note
    f.addEventListener("submit", (e) => {
      e.preventDefault();
      const v = $("textarea", f).value.trim();
      if (!v) return;
      if (runAction(tool, "", v)) $("textarea", f).value = ""; else busyNote($("button", f));
    });
    sec.appendChild(f); box.appendChild(sec);
  }
  box.appendChild(gs);
}

/* ---------------------------------------------------------------- progress */
// 11/22：名稱前面加「第幾案」，跟導覽裡四塊紅色 CASE 看板一樣
const GAMES = [["phish", "Case 1 · Inbox Rush", "第一案：收件匣大作戰", "play"], ["access", "Case 2 · Who May Use What?", "第二案：誰能用什麼", "billiard_near"],
  ["mfa", "Case 3 · The MFA Door", "第三案：多因素驗證門", "door_38d0"], ["ir", "Case 4 · Incident Response", "第四案：事件應變", "lighthouse"]];

let ringWas = 0;
// anim: true when the tab opens (the ring fills from 0), false when the state changes while it is open (from the last value)
function renderProgress(anim = true) {
  const v = $("#progressView"), st = S.state || { found_n: 0, visited: 0, found_items: [], visited_keys: [] };
  v.classList.toggle("no-anim", !anim);
  if (anim) enter(v, 1300);          // the parts rise in once per drawing, not again each time the window is shown (11/23 review)
  const found = st.found_items || [], n = st.found_n || 0, total = Math.max(1, S.totalFindings || 17), GOAL = 10;
  const R = 40, C = 2 * Math.PI * R, off = (x) => (C * (1 - Math.min(1, x / total))).toFixed(1);
  const a = (2 * Math.PI * GOAL) / total, tick = (r) => `${(50 + r * Math.cos(a)).toFixed(1)} ${(50 + r * Math.sin(a)).toFixed(1)}`;
  v.innerHTML = `<section class="prog-top">
      <div class="ring" role="img" aria-label="${n} / ${total}">
        <svg viewBox="0 0 100 100" aria-hidden="true"><circle class="track" cx="50" cy="50" r="${R}"/>
          <circle class="val" cx="50" cy="50" r="${R}" style="stroke-dasharray:${C.toFixed(1)};stroke-dashoffset:${off(anim ? 0 : ringWas)}"/>
          <path class="goal" d="M${tick(33)} L${tick(47)}" stroke-linecap="round"/></svg>
        <div class="ring-n">${n}<small>/ ${total}</small></div></div>
      <div><h2>Security weaknesses found <span lang="zh-Hant">找到的資安漏洞</span></h2>
        <p class="note">${LB("Find 10 to win Security Champion at the awards night in the Lake Pavilion Theater.", "找到 10 個就能在湖心館劇場的頒獎晚會拿到資安新人獎。")}</p>
        <span class="goal-l">${L("10: Security Champion", "10 個：資安新人獎")}</span></div></section>`;
  const ring = $(".ring .val", v);
  requestAnimationFrame(() => requestAnimationFrame(() => { if (ring) ring.style.strokeDashoffset = off(n); }));
  ringWas = n;
  const ul = el("ul", "found-list");
  for (const f of found) {
    const li = el("li"); li.innerHTML = `<span class="badge sev-${esc(f.severity)}">${L(f.severity, SEV_ZH[f.severity])}</span><span>${L(f.en, f.zh)}</span>`;
    const r = S.byKey[f.room]; if (r) li.appendChild(roomLink(r));
    ul.appendChild(li);
  }
  if (!found.length) ul.innerHTML = `<li class="is-none">${LB("None yet. Ask “What should I do next?” for a hint.", "還沒有。問「接下來要去哪？」可以拿到提示。")}</li>`;
  v.appendChild(ul);
  const games = st.games || {};
  const played = GAMES.filter((g) => games[g[0]]).length;
  v.appendChild(el("h2", "", `Casebook <span lang="zh-Hant">事件簿</span> · ${played} / ${GAMES.length}`));
  const cs = el("div", "cases");
  const tgt = "_self";                               // here: the game window (bindUi); inside iStaging's window: this window
  for (const [k, en, z, room] of GAMES) {           // one card per case, numbered like the red CASE boards in the tour
    const r = games[k], [no, name, zname, zno] = caseParts(en, z), c = el("div", "case lg-hi" + (r ? " is-played" : ""));
    c.innerHTML = `<i class="case-no">${esc(no.toUpperCase())} <span lang="zh-Hant">${esc(zno)}</span></i>
      <span class="case-t">${esc(name)}<span lang="zh-Hant">${esc(zname)}</span></span>
      <span class="case-res">${r ? `${L("Best", "最佳")} <b>${r.best}</b> / ${r.total}${r.plays > 1 ? ` · ${L(`${r.plays} plays`, `玩了 ${r.plays} 次`)}` : ""}` : L("Not played yet", "還沒玩")}</span>
      <div class="case-go"><a class="case-play" href="/lakeside/games/${k}" target="${tgt}" rel="noopener"><svg viewBox="0 0 12 12" aria-hidden="true"><path d="M3 1.8v8.4L10 6z" fill="currentColor"/></svg>${r ? L("Play again", "再玩一次") : L("Play", "開始")}</a></div>`;
    if (S.byKey[room]) $(".case-go", c).appendChild(roomLink(S.byKey[room]));
    cs.appendChild(c);
  }
  v.appendChild(cs);
  // 11/23: a place counts when it was asked about here or opened from our map, not when walked to with the tour's own
  // arrows, so the heading says that and has no "of 47" to reach
  const h = el("h2", "", `Places you asked me about <span lang="zh-Hant">問過小幫手的地方</span> · ${st.visited || 0}`); v.appendChild(h);
  const vis = new Set(st.visited_keys || []);
  const areas = el("div", "areas"), groups = {};
  for (const r of S.rooms) (groups[r.area_en] ||= { zh: r.area_zh, rooms: [] }).rooms.push(r);
  for (const [en, g] of Object.entries(groups)) {
    const a = el("div", "area"), seen = g.rooms.filter((r) => vis.has(r.key)).length;
    a.appendChild(el("h3", "", `${esc(en)} <span lang="zh-Hant">${esc(g.zh)}</span> <span>· ${seen} / ${g.rooms.length}</span>`));
    const w = el("div", "items");
    for (const r of g.rooms) { const b = roomLink(r); b.classList.add(vis.has(r.key) ? "visited" : "unvisited"); w.appendChild(b); }
    a.appendChild(w); areas.appendChild(a);
  }
  v.appendChild(areas);
  // 11/23 (review): the progress is kept on the server and cannot come back, so the first click only asks to click again
  // within 3 s
  const reset = el("button", "btn-plain", "Start over 重新開始"); reset.type = "button";
  let armed = null;
  const say = (s) => { reset.firstChild.nodeValue = s; };          // the text only: the press's ripple is a child too
  const disarm = () => { clearTimeout(armed); armed = null; say("Start over 重新開始"); reset.classList.remove("is-armed"); };
  reset.addEventListener("click", async () => {
    if (!armed) {
      say("Click again to clear 再按一次就清除"); reset.classList.add("is-armed");
      armed = setTimeout(disarm, 3000);
      return;
    }
    disarm();
    try { updateState(await post("/api/settings", { session: S.session, reset: true })); renderProgress(true); }
    catch { sayNear(reset, LB("Could not clear the progress. Check that 啟動_AI助理.bat is running.", "清不掉進度，請確認 啟動_AI助理.bat 有在執行。"), { err: true }); }
  });
  v.appendChild(reset);
  [...v.children].forEach((c, i) => c.style.setProperty("--i", Math.min(i, 10)));
}

/* ---------------------------------------------------------------- how it works */
async function renderHow() {
  const v = $("#howView");
  if (v.dataset.done) return;
  v.dataset.done = "1";
  v.innerHTML = `<h2>How the assistant works <span lang="zh-Hant">小幫手怎麼運作</span></h2>
  <p>Everything runs on the presenter's laptop. The page shows the iStaging tour full screen; this window, the casebook and the map open over it. Your question goes to a local language model (Ollama), which only chooses a tool and the words that name what you asked about. The tool matches those words to a node in the Neo4j knowledge graph and runs a fixed, read-only Cypher query. The model then writes the answer from those facts only.</p>
  <p lang="zh-Hant">全部在報告用的筆電上跑。畫面是全螢幕的 iStaging 導覽，這個視窗、事件簿和地圖都疊在上面。你的問題先交給筆電上的語言模型（Ollama），它只負責選工具、抓出你問的是什麼；工具把它對到 Neo4j 知識圖的節點，執行寫好的唯讀 Cypher，模型再只根據查到的資料寫回答。</p>
  <svg class="arch" viewBox="0 0 420 258" role="img" aria-label="Architecture: your question goes to the assistant server, which asks the local model and the Neo4j graph, then gives the answer and a card that can take you to a place in the tour">
    <defs><marker id="archArrow" viewBox="0 0 10 10" refX="8.5" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse"><path d="M0 1 9 5 0 9z" fill="#f1d79a"/></marker></defs>
    <rect x="8" y="12" width="150" height="52" rx="14" fill="rgba(255,255,255,.07)" stroke="rgba(255,255,255,.24)"/>
    <rect x="254" y="12" width="158" height="52" rx="14" fill="rgba(98,210,221,.22)" stroke="rgba(98,210,221,.6)"/>
    <rect x="186" y="104" width="112" height="50" rx="14" fill="rgba(151,184,246,.14)" stroke="rgba(151,184,246,.5)"/>
    <rect x="306" y="104" width="106" height="50" rx="14" fill="rgba(133,185,236,.14)" stroke="rgba(133,185,236,.5)"/>
    <rect x="254" y="196" width="158" height="52" rx="14" fill="rgba(255,255,255,.07)" stroke="rgba(255,255,255,.24)"/>
    <rect x="8" y="196" width="150" height="52" rx="14" fill="rgba(241,215,154,.14)" stroke="rgba(241,215,154,.55)"/>
    <g stroke="#d6ae5f" stroke-width="1.8" fill="none" marker-end="url(#archArrow)">
      <path d="M161 38H250"/><path d="M300 67 256 101"/><path d="M360 67V101"/><path d="M252 157 296 193"/><path d="M360 157V193"/><path d="M251 222H162"/>
    </g>
    <text class="t" x="83" y="35" text-anchor="middle">You ask</text><text x="83" y="53" text-anchor="middle">提問</text>
    <text class="n" x="333" y="35" text-anchor="middle">Assistant (FastAPI)</text><text class="n2" x="333" y="53" text-anchor="middle">小幫手・跑在筆電上</text>
    <text class="t" x="242" y="125" text-anchor="middle">Ollama · qwen3.5</text><text x="242" y="142" text-anchor="middle">選工具・寫回答</text>
    <text class="t" x="359" y="125" text-anchor="middle">Neo4j 2026.10</text><text x="359" y="142" text-anchor="middle">知識圖＋索引</text>
    <text class="t" x="333" y="219" text-anchor="middle">Answer + card</text><text x="333" y="237" text-anchor="middle">回答與資料卡</text>
    <text class="t" x="83" y="219" text-anchor="middle">iStaging tour</text><text x="83" y="237" text-anchor="middle">?index=N 帶你過去</text>
  </svg>
  <h2>Finding what you mean <span lang="zh-Hant">找出你問的是什麼</span></h2>
  <p>Three signals are combined with reciprocal rank fusion: exact names and aliases (English and Chinese), BM25 full-text search in Neo4j (CJK analyzer), and bge-m3 vector search in Neo4j's vector index, so 信用卡 finds “Payment Card Data”.</p>
  <p lang="zh-Hant">用 RRF 合併三種線索：中英文名稱和別名、Neo4j 的 BM25 全文檢索（中日韓分詞），還有 Neo4j 向量索引裡的 bge-m3 向量搜尋。所以打「信用卡」也找得到「Payment Card Data」。</p>
  <h2>Safety of the assistant itself <span lang="zh-Hant">小幫手自己的資安</span></h2>
  <p>Read-only database transactions, parameterised queries, a JSON schema that limits the model to known tools, answers grounded in retrieved facts, quoted evidence checked against your text, no questions sent to outside AI services, and logs kept on the presenter's laptop.</p>
  <p lang="zh-Hant">資料庫只用唯讀交易，查詢一律帶參數。JSON schema 限定模型只能選已知的工具，回答只根據查到的資料，引用的證據會和你貼的原文核對。問題不會送到外面的 AI 服務，紀錄只存在報告用的筆電上。</p>
  <h2>Colours in the cards and the graph <span lang="zh-Hant">卡片和關係圖的顏色</span></h2>
  <p>Each kind of node has one colour, the same in the dots of the cards and in the graph under “How I found this”. <span lang="zh-Hant">每一種節點一個顏色，資料卡的小圓點和「我怎麼查到的」裡的關係圖都一樣。</span></p>
  <div class="legend">${Object.keys(LABEL).filter((l) => COLORS[l] && l !== "Area").map((l) => `<span data-t="${l}">${esc(LABEL[l][0])} <span lang="zh-Hant">${esc(LABEL[l][1])}</span></span>`).join("")}</div>
  <div id="schemaBox"><p>${L("Loading the graph schema…", "讀取知識圖結構中…")}</p></div>`;
  [...v.children].forEach((c, i) => c.style.setProperty("--i", Math.min(i, 12)));
  enter(v, 1300);                  // the parts rise in when the tab is first drawn, not each time it is shown (11/23 review)
  try {
    const s = await fetch("/api/schema").then((r) => r.json());
    const t1 = el("table", "kv"); t1.innerHTML = `<tr><th>${L("Node type", "節點類型")}</th><th>${L("Count", "數量")}</th></tr>` + s.labels.map((x) => `<tr><td>${LABEL[x.l] ? L(x.l, LABEL[x.l][1]) : esc(x.l)}</td><td>${x.c}</td></tr>`).join("");
    const t2 = el("table", "kv"); t2.innerHTML = `<tr><th>${L("Relationship (from → to)", "關係（從 → 到）")}</th><th>${L("Count", "數量")}</th></tr>` + s.pattern.map((x) => `<tr><td>${esc(x.a)} –${esc(x.t)}→ ${esc(x.b)}</td><td>${x.c}</td></tr>`).join("");
    const box = $("#schemaBox");
    box.innerHTML = `<h2>What is in the graph <span lang="zh-Hant">知識圖裡有什麼</span></h2>`;
    box.appendChild(t1); box.appendChild(t2);
  } catch {
    // 11/23 (review): a short note instead of "Loading…" for ever; the tab is drawn again the next time it is opened
    const box = $("#schemaBox");
    if (box) box.innerHTML = `<p class="err">${LB("The graph's structure could not be loaded. Try this tab again in a moment.", "讀不到知識圖的結構，等一下再點一次這個分頁。")}</p>`;
    delete v.dataset.done;
  }
}

/* ---------------------------------------------------------------- liquid glass (11/22 afternoon, third look)
   The light on the glass follows the mouse, small glass things tilt a few degrees toward it, and a press sends a ripple of
   light from that point. One update per frame; nothing of this on touch screens or with "reduce motion".
   11/23 (review, the user had seen dropped frames): the light is a small layer of its own inside each piece of glass
   (span.lg-glow, style.css) moved with transform. Before, --mx/--my were written on the window or the big map itself, and
   on every frame the styles of everything inside them (a long chat) were worked out again and the whole panel painted
   again. Every box is measured first and only then is anything moved: a measure after a change made the browser lay
   the page out again within the same frame. */
(() => {
  const FINE = window.matchMedia ? window.matchMedia("(hover: hover) and (pointer: fine)").matches : false;
  const TILT = ".dock-btn, .mm-mini, .case, .plate";
  const RIPPLE = ".dock-btn, .mm-mini, .mm-pill, .mm-hide, .mm-x, .mm-zoom button, .win-btn, .seg button, .tabs [role=tab], .chip, .roomlink, .plate, " +
    "details.trace summary, .ask button, .task, .paste button, .case-play, .btn-plain";
  let last = null, raf = 0, tilted = null;
  const untilt = () => { if (tilted) { tilted.style.removeProperty("--rx"); tilted.style.removeProperty("--ry"); tilted = null; } };
  // the glass's light, made the first time the pointer comes over it
  const glowOf = (g) => {
    let s = g.querySelector(":scope > .lg-glow");
    if (!s) { s = document.createElement("span"); s.className = "lg-glow"; s.setAttribute("aria-hidden", "true"); g.appendChild(s); }
    return s;
  };
  function frame() {
    raf = 0;
    const ev = last, n = ev && ev.target instanceof Element ? ev.target : null;
    if (!n) return;
    // measure: the glass under the pointer and the panel around it, and the small thing that tilts
    const lit = [];
    for (let g = n.closest(".lg-hi"); g && lit.length < 2; g = g.parentElement ? g.parentElement.closest(".lg-hi") : null) lit.push([g, g.getBoundingClientRect()]);
    const t = n.closest(TILT), tr = t ? t.getBoundingClientRect() : null;
    // then move: the light, and the tilt (a few degrees, back with a spring when the pointer leaves)
    for (const [g, r] of lit) glowOf(g).style.transform = `translate(${Math.round(ev.clientX - r.left)}px, ${Math.round(ev.clientY - r.top)}px)`;
    if (t !== tilted) untilt();
    if (t && tr.width && tr.height) {
      const px = (ev.clientX - tr.left) / tr.width - 0.5, py = (ev.clientY - tr.top) / tr.height - 0.5, deg = t.matches(".case") ? 4 : 6;
      t.style.setProperty("--rx", `${(-py * deg).toFixed(2)}deg`);
      t.style.setProperty("--ry", `${(px * deg).toFixed(2)}deg`);
      tilted = t;
    }
  }
  if (FINE && !RM.matches) {
    document.addEventListener("pointermove", (e) => { last = e; if (!raf) raf = requestAnimationFrame(frame); }, { passive: true });
    document.documentElement.addEventListener("pointerleave", untilt);
  }
  // the release wobbles the glass back like jelly (added on top of its own transform, so a tilt or a CSS entrance keeps going)
  const JELLY = ".dock-btn, .mm-pill, .win-btn, .chip, .roomlink, .plate, .ask button, .case-play, .paste button, .btn-plain, .seg button, " +
    ".tabs [role=tab], .mm-zoom button, .mm-x, details.trace summary";
  document.addEventListener("pointerup", (e) => {
    if (RM.matches || e.button > 0) return;
    const b = e.target instanceof Element ? e.target.closest(JELLY) : null;
    if (!b || b.disabled || typeof b.animate !== "function") return;
    b.animate([{ transform: "scale(.95, .92)" }, { transform: "scale(1.05, .97)", offset: .32 }, { transform: "scale(.98, 1.03)", offset: .56 },
      { transform: "scale(1.012, .993)", offset: .78 }, { transform: "scale(1)" }], { duration: 540, easing: "ease-out", composite: "add" });
  }, { passive: true });
  document.addEventListener("pointerdown", (e) => {
    if (RM.matches || e.button > 0) return;
    const b = e.target instanceof Element ? e.target.closest(RIPPLE) : null;
    if (!b || b.disabled) return;
    const r = b.getBoundingClientRect(), w = document.createElement("span");
    w.className = "ripple";
    w.style.cssText = `--x:${Math.round(e.clientX - r.left)}px;--y:${Math.round(e.clientY - r.top)}px;--s:${Math.round(Math.max(r.width, r.height) * 2.4)}px`;
    b.appendChild(w);
    setTimeout(() => w.remove(), 700);
  }, { passive: true });
})();
