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
const OURS = new Set([location.origin, "https://lakeside.taila701b6.ts.net", "https://terry0803.github.io", "http://127.0.0.1:8780", "http://localhost:8780", "http://localhost:3000", "http://127.0.0.1:3000"]);
// 11/23: the page on this laptop's http://localhost:3000 asks the fixed address to remember this browser; from then on that
// address sends it here (server.py index), because only here does iStaging say which scene the visitor is in
{ const m = document.querySelector('meta[name="lk-local"]'); if (m && !EMBED) new Image().src = `https://lakeside.taila701b6.ts.net/api/local-mark?t=${encodeURIComponent(m.content)}`; }
// 11/23 (the user: the first frame of iStaging's window flashed dark blue): in iStaging's window the picture of the room
// behind the window starts loading at once (the room is in the address), over a plain dark grey
if (EMBED && PARAMS.get("room")) roomBg(PARAMS.get("room"));

const PIN = '<svg viewBox="0 0 12 12" aria-hidden="true"><path fill="currentColor" d="M6 0a4 4 0 0 0-4 4c0 3 4 8 4 8s4-5 4-8a4 4 0 0 0-4-4zm0 5.6A1.6 1.6 0 1 1 6 2.4a1.6 1.6 0 0 1 0 3.2z"/></svg>';
const LABEL = {
  Room: ["Place", "地點"], Area: ["Area", "區域"], System: ["System", "系統"], DataAsset: ["Data", "資料"], Role: ["Role", "職務"],
  Department: ["Department", "部門"], Threat: ["Threat", "威脅"], Control: ["Control", "防護措施"], Standard: ["Standard", "標準法規"],
  Requirement: ["Clause", "條文"], Procedure: ["Procedure", "流程"], Concept: ["Concept", "概念"], CaseStudy: ["Real case", "真實案例"],
  Risk: ["Risks", "風險"], List: ["List", "清單"], Search: ["Search", "搜尋"], Finding: ["Weakness", "漏洞"],
  Tag: ["Tag", "標籤"], Step: ["Step", "步驟"], PhishingSign: ["Phishing sign", "釣魚警訊"],      // 11/27: the graph map shows every type
};
const TOOL = {
  offline: ["Saved copy, the AI is off", "離線版，AI 沒開"],
  room_overview: ["Looking at this place", "查看這個地方"], find_location: ["Finding where it is", "找它在哪裡"], route: ["Planning the route", "規劃路線"],
  next_step: ["Checking your progress", "查看進度"], system_profile: ["Reading the system's profile", "查詢系統資料"],
  data_access: ["Checking who may access the data", "查詢誰能存取"], role_access: ["Checking the role's access", "查詢職務權限"],
  risks: ["Listing the risks", "列出風險"], threat_controls: ["Finding the controls", "查詢防護措施"], compliance: ["Reading the rules", "查詢法規條文"],
  inventory: ["Building the list", "整理清單"], procedure: ["Opening the procedure", "打開處理流程"], explain: ["Looking it up", "查詢說明"],
  check_email: ["Checking the message for warning signs", "檢查信件的警訊"], report_finding: ["Checking your report", "核對你的回報"],
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
  // 11/26 (front-end review K09): one timer per node, so an entrance played again soon is not cut short by the last one
  clearTimeout(node._enterT);
  node._enterT = setTimeout(() => node.classList.remove("is-in"), RM.matches ? 0 : ms);
  return node;
}
function bump(node) {
  if (!node || RM.matches) return;
  node.classList.remove("bump"); void node.offsetWidth; node.classList.add("bump");
  setTimeout(() => node.classList.remove("bump"), 700);
}
/* 11/28 (the user: 「這個點X沒有動畫效果」, then a review of every thing that was taken away in one frame): the way out.
   A small thing that has done its job fades and shrinks a little, then leaves the page; with "reduce motion", or when it
   is not shown, it simply leaves. The page's folding curve. */
const FOLD_EASE = "cubic-bezier(.4, 0, .2, 1)", UNFOLD_EASE = "cubic-bezier(.2, .9, .2, 1)";
const motionless = (e) => RM.matches || typeof e.animate !== "function" || e.offsetParent === null;
function leave(node, ms = 260, to = "scale(.94)") {
  if (!node || node.classList.contains("is-going")) return;
  if (motionless(node)) { node.remove(); return; }
  node.classList.add("is-going");
  node.animate([{ opacity: 1, transform: "none" }, { opacity: 0, transform: to }], { duration: ms, easing: FOLD_EASE, fill: "forwards" })
    .finished.then(() => node.remove(), () => node.remove());
}
// something comes into a column of things: its height grows from nothing while it fades in, so what is under it is pushed
// down over several frames (a block that takes its place in one frame makes everything under it jump)
const BOX = (c) => ({ height: c.height, marginTop: c.marginTop, marginBottom: c.marginBottom, paddingTop: c.paddingTop, paddingBottom: c.paddingBottom });
const BOX0 = { height: "0px", marginTop: "0px", marginBottom: "0px", paddingTop: "0px", paddingBottom: "0px" };
function unfold(node, ms = 450) {
  if (!node || motionless(node)) return;
  node.animate([{ ...BOX0, opacity: 0, overflow: "hidden" }, { ...BOX(getComputedStyle(node)), opacity: 1, overflow: "hidden" }], { duration: ms, easing: UNFOLD_EASE });
}
// ... and out of the column again: it folds to nothing, then leaves the page, so what is under it comes up over several frames
function fold(node, ms = 380) {
  if (!node || node.classList.contains("is-going")) return;
  if (motionless(node)) { node.remove(); return; }
  node.classList.add("is-going");
  node.animate([{ ...BOX(getComputedStyle(node)), opacity: 1, overflow: "hidden" }, { ...BOX0, opacity: 0, overflow: "hidden" }], { duration: ms, easing: FOLD_EASE, fill: "forwards" })
    .finished.then(() => node.remove(), () => node.remove());
}
// the conversation showed its last line: it keeps showing it, frame by frame, while something grows at its end or over
// the ask box (the thread does not follow by itself: its height changes, its scroll position does not)
function threadAtEnd() { const th = $("#thread"); return !!th && th.scrollHeight - th.scrollTop - th.clientHeight <= 4; }
function holdThreadEnd(ms) {
  const th = $("#thread"), t0 = performance.now();
  if (!th) return;
  const step = () => {
    if (th.scrollHeight - th.scrollTop - th.clientHeight > 80) return;          // scrolled away by hand: leave it
    th.scrollTo({ top: th.scrollHeight, behavior: "instant" });
    if (performance.now() - t0 < ms + 80) requestAnimationFrame(step);
  };
  requestAnimationFrame(step);
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
const QUEST_GOAL = 10;                     // weaknesses for the Security Champion award (assistant/quest.py GOAL)
// what each read-only query was for, and how a word was matched (server text, English only): their Chinese
const PURPOSE_ZH = {
  "vector search skipped (Ollama is not answering)": "略過向量搜尋（Ollama 沒有回應）",
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
  // 11/26 (front-end review K04): purposes the server sends that had no Chinese (tools.py inventory/next_step, feedback.py)
  "systems: critical": "關鍵系統", "systems: cloud": "雲端與外部服務", "systems: iot": "物聯網與 OT 設備",
  "all Confidential and Restricted data": "所有機密和限閱資料", "rooms of the cases not played yet": "還沒玩的案件在哪些房間",
  "weaknesses hidden in the current room": "這個房間裡藏的漏洞", "words for the places of the weaknesses": "漏洞所在地點的名稱",
};
const HOW_ZH = {
  "button": "按鈕", "looks like a pasted email (rule)": "看起來是貼上的信（規則判斷）", "model": "模型", "model output was not JSON, fell back to search": "模型輸出不是 JSON，改用搜尋",
  "current room": "目前所在的地方", "previous topic": "上一個話題", "nothing to look up": "沒有要查的", "linked": "已對到", "search": "搜尋",
  "high": "高", "medium": "中", "low": "低", "none": "無", "contact question, person or team preferred": "問聯絡人，優先找人或團隊",
  "same name, concept preferred for 'explain'": "同名時說明優先用概念", "(the pasted message)": "（貼上的信）",
  "rules + model, evidence checked against the text": "規則加模型，引文已和原文核對", "hybrid search over findings + model judgement": "混合搜尋漏洞再由模型判斷",
  "the report does not say what was seen (rule)": "回報沒有說看到什麼（規則判斷）",
  // 11/26 (front-end review K04): agent.py code-gate rule, feedback.py with the model down
  "asked how to get past a code gate (rule)": "問怎麼通過密碼門（規則判斷）", "rules only (the model is not answering)": "只用規則（模型沒有回應）",
  "picked in the graph map": "在關聯圖上點的",      // 11/27: a name pressed in the graph map (agent.py turn)
};
const zhOf = (map, s) => { if (!s) return ""; if (map[s]) return map[s]; const m = /^redirect:(\w+)$/.exec(s); return m && LABEL[m[1]] ? `轉到${LABEL[m[1]][1]}` : ""; };
const LTm = (map, s) => LT(s || "", zhOf(map, s));
// 11/26 (front-end review K04): the "redirected" line of the trace (tools.py dispatch_entity and data_access, feedback.py)
const REDIRECT_ZH = {
  "data_access → system users (the target is a system)": "資料權限 → 系統使用者（目標是系統）",
  "report_finding -> procedure (no audit finding matched; this sounds like an incident)": "回報漏洞 → 處理流程（清單上沒有這個漏洞，聽起來像資安事件）",
};
const redirectZh = (s) => {
  if (!s) return "";
  if (REDIRECT_ZH[s]) return REDIRECT_ZH[s];
  const m = /^→ (\w+) \(the best match is a (\w+)\)$/.exec(s);
  return m ? `轉給 ${m[1]}（最接近的是${LABEL[m[2]] ? LABEL[m[2]][1] : m[2]}）` : "";
};

/* ---------------------------------------------------------------- startup */
document.addEventListener("DOMContentLoaded", init);

async function init() {
  bindUi();
  renderEmpty();
  const roomsRes = await fetch("/api/rooms").then((r) => r.json()).catch(() => null);
  if (roomsRes) {
    S.rooms = roomsRes.rooms; S.totalFindings = roomsRes.total_findings || 17;
    for (const r of S.rooms) { S.byKey[r.key] = r; if (r.pano) PANO.set(r.pano, r.key); }
    fillRoomSelect();
  }
  const params = new URLSearchParams(location.search);
  const fromTour = params.get("room");
  const fromGame = params.get("back") === "game";        // a mini-game window could not close itself: reopen at the game's room
  const start = (fromTour && S.byKey[fromTour]) ? fromTour : (store.get("room", "sky") in S.byKey ? store.get("room", "sky") : "sky");
  // 11/22: in iStaging's window this page IS the assistant, also when the tour is inside our own full page. That page only
  // learns where the visitor is and steps aside (map, buttons and its own window) while this window is open, so there is
  // one assistant at a time and nothing reloads. (Before: this window handed over and asked to be closed: two at once.)
  if (IN_FRAME && await probeOurPage(fromTour || start)) {
    S.inOurPage = true; popupBeat();
    // 11/26 (review): the progress and the model of our page's session, which this window now uses (the settings answer in
    // bindUi was for this window's own session and is dropped there)
    fetch(`/api/state?session=${encodeURIComponent(S.session)}`).then((r) => r.json()).then(updateState).catch(() => {});
  }
  // 11/26 (review): opening the page is not asking about the place, so it is not sent as a visit ("sky" counted on every load)
  goTo(start, { quiet: !fromTour, record: false });
  Quest.refresh();
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
      // window would start its own progress; take the session of that page instead (our own addresses only, checked above;
      // 11/23: our page on http://localhost:3000 has another address than this window)
      if (e.data.session) { S.session = e.data.session; store.set("session", S.session); }
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
  // 11/23: that window was opened inside the tour, so the tour still has the focus; take it back, or the next walk in the
  // tour gives this page no "left the page" moment and the map would keep calling the old place current (bindUi blur)
  if (!on && document.activeElement === $("#tour")) $("#tour").blur();
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
  // 11/27 night (review): the quest tracker, its first-time note and the journal's window are pieces too (the tracker
  // stayed lit while the others faded, and went out at once at the end)
  const pieces = [...document.querySelectorAll(".mm-mini, .mm-hide, .mm-pill, .mm-panel, .dock-btn, .dock-tip, .quest, .q-coach, #desk, #journalWin")]
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
    // lands in this Progress tab (our own addresses only, OURS above; 11/23: also when this page is on http://localhost:3000)
    if (d.type !== "lakeside:popup-alive") { try { e.source.postMessage({ type: "lakeside:session", session: S.session }, e.origin); } catch { /* gone */ } }
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
    // the answer goes to the address that asked (one of ours, OURS above, with the session), not to whoever is there now
    try { e.source.postMessage({ type: "lakeside:ack", session: S.session }, e.origin); } catch { /* the window went away */ }
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

// opt.record = false: only show it here, do not send it as a visit (see the tour's changePano below)
async function setHere(key, opt = {}) {
  const moved = S.room !== key;
  S.room = key; store.set("room", key);
  roomBg(key);
  $("#roomSelect").value = key;
  if (moved) flashRoom();
  if (typeof Minimap !== "undefined") Minimap.update(key);
  Quest.refresh();                                          // 11/27 evening: the quest tracker follows the place
  if (opt.record === false) return;
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
// A window as it sits in the thing it grows out of (the assistant's in one of the two buttons; the journal's in the quest
// tracker, Quest.openJournal): scaled to that thing's width, moved onto it, cut to its height with its corners. D: the
// window's own box. And the window whole, with room for its shadow, so nothing changes when an animation lets go.
function deskIn(D, from) {
  const B = rectOf(from);
  if (!D.width || !D.height || !B.width || !B.height) return null;
  const s = B.width / D.width, r = Math.min(parseFloat(getComputedStyle(from).borderTopLeftRadius) || 20, B.height / 2);
  const cut = Math.max(0, D.height - B.height / s);
  return { transform: `translate(${(B.left - D.left).toFixed(1)}px, ${(B.top - D.top).toFixed(1)}px) scale(${s.toFixed(4)})`,
    clipPath: `inset(0px 0px ${cut.toFixed(1)}px 0px round ${(r / s).toFixed(1)}px)` };
}
const DESK_WHOLE = { transform: "translate(0px, 0px) scale(1)", clipPath: "inset(-60px -60px -60px -60px round 80px)" };
function splitDesk(opening, end, mainBtn) {
  const d = $("#desk"), btns = [$("#dockChat"), $("#dockGames")];
  if (EMBED || RM.matches || typeof d.animate !== "function" || btns.some((b) => !b || b.offsetParent === null)) return false;
  const main = Math.max(0, btns.indexOf(mainBtn)), btn = btns[main];
  const D = rectOf(d);
  if (!D.width || !D.height) return false;
  if (!opening) return foldIntoButtons(d, btns, D, end);
  // 11/22 evening (the user: the window turned all grey before its contents showed, opening and closing): the window
  // itself grows out of the button and shrinks back into it, contents showing all the way, the way the big map grows out
  // of the small one (minimap.js morphMap): scaled to the button's width, moved onto it, cut to its height with the
  // button's corners. Before, an empty glass shape flew instead and the window only showed in the last 30% of the opening.
  const small = deskIn(D, btn), big = DESK_WHOLE;
  if (!small) return false;
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
  // 11/27 night (the user: going back and coming out can run side by side): the journal's own window, if it is open, goes
  // back into the quest tracker while this one comes out of its button
  if (!EMBED) Quest.closeJournal();
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
    Quest.settle();                                         // 11/27 night: the two buttons are gone; the tracker is already up (Quest.lift)
    if (typeof Minimap !== "undefined" && Minimap.state() === "open") window.dispatchEvent(new Event("resize"));
    else { moveInk(true); fitTabs(); }
  };
  if (merge && splitDesk(true, () => { shown(); }, fromBtn)) {
    for (const b of document.querySelectorAll(".dock-btn")) b.classList.add("is-quiet");
    Quest.lift();                                           // 11/27 night: the quest tracker goes up with the window, not after it
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
  leave($(".dock-tip"));
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
  Quest.settle();                                         // 11/27 night: and the quest tracker comes down as the buttons fly back
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
  // 11/26 (front-end review K03): also gone on the first press anywhere; a click into the tour (another site's frame) only
  // takes the focus away from this page, so a blur counts as a click too
  const off = () => { leave(tip); document.removeEventListener("pointerdown", off, true); window.removeEventListener("blur", off); };
  document.addEventListener("pointerdown", off, true);
  window.addEventListener("blur", off);
  setTimeout(off, 9000);
}

function bindUi() {
  // 11/23: going back into the tour can take the visitor somewhere this page never hears of (iStaging tells no other site),
  // so the map then marks its place as the last one it knows (minimap.js setStale) until a place is set here again
  if (!EMBED) window.addEventListener("blur", () => setTimeout(() => {
    if (tourTalks) return;                                // the tour reports every scene here (http://localhost:3000)
    if (document.activeElement === $("#tour") && typeof Minimap !== "undefined" && Minimap.setStale) Minimap.setStale(true);
  }, 0));
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
    if (Quest.closeJournal()) { ev.preventDefault(); return; }       // 11/27 night: the journal's own window
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
      if (!Quest.closeJournal()) closeDesk();               // 11/27 night: whichever of the two windows is open
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
      catch (err) {          // 11/23 (review): the server did not take it: back to the model it still uses, and say so
        S.model = was; store.set("model", was);
        check("[data-model]", modelBtns.find((x) => x.dataset.model === was));
        // 11/26 (review): a refusal says why in the server's words (already in both languages); no answer at all: the .bat
        sayNear(b.closest(".seg"), err && err.said ? esc(err.said) : LB("Could not switch the model. Check that 啟動_AI助理.bat is running.", "換不了模型，請確認 啟動_AI助理.bat 有在執行。"), { err: true });
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
  // 11/25 (the user: choosing a place in the list did not change the scene, only the map moved): picking a place takes the
  // tour there, like the map and the Go to buttons (on http://localhost:3000 without reloading the tour). The 11/23 review
  // had made it only move "you are here".
  $("#roomSelect").addEventListener("change", (e) => goTo(e.target.value, { jump: true }));
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
  // 11/26 (review): the answer is taken only if this page still uses that session. In iStaging's window probeOurPage may
  // take our full page's session before it comes, and a late answer put this window's own session back.
  const sid = S.session;
  post("/api/settings", { session: sid, model: S.model }).then((res) => { if (S.session === sid) updateState(res); })
    .catch(() => { /* the status line says the server is down */ });
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
  // 11/26 (review): a refusal (429 over the visitor limit, 400, 413) came back as if it had worked, so a model switch the
  // server did not take stayed on screen; now the callers' catch runs, with the server's own words (err.said)
  if (!r.ok) {
    const j = await r.json().catch(() => ({}));
    const err = new Error(j.error || `HTTP ${r.status}`); err.said = j.error || ""; throw err;
  }
  return r.json();
}
// 11/26 (review): the model buttons show the model the server answers this session with (it keeps one per session). In
// iStaging's window the page takes our full page's session, and with it that page's model; not sent back to the server.
function showModel(m) {
  const all = [...document.querySelectorAll("[data-model]")], on = all.find((x) => x.dataset.model === m);
  if (!on || (m === S.model && on.getAttribute("aria-checked") === "true")) return;
  S.model = m; store.set("model", m);
  for (const x of all) { x.setAttribute("aria-checked", String(x === on)); x.tabIndex = x === on ? 0 : -1; }
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
    // 11/23 (checklist A3): the line ended "… · qwe…" in the normal window; now two lines, the graph, then the chat model
    // (every loaded model stays in the tooltip)
    const chat = (h.loaded || []).find((m) => !/embed|bge|nomic|minilm/i.test(m)) || (h.loaded || [])[0] || LT("loading models…", "模型載入中…");
    el.innerHTML = ok ? `${L(`Knowledge graph: ${n} nodes`, `知識圖 ${n} 個節點`)}<br>${L("Local model", "本機模型")}: ${esc(chat)}`
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
// 11/23 (the user: can the map follow me?): iStaging posts {"event":"changePano","panoramaId":…} to the page around the
// tour, and takes {"event":"goToPano"} from it, only for a few addresses (www/dev.gobizevent.com, *.istaging.com and
// http://localhost:3000; it reads the address from the frame's referrer, index.html referrerpolicy). On the presenter's
// laptop the page opened at http://localhost:3000 therefore knows every scene the visitor walks to.
const PANO = new Map();                                   // panorama objectId -> place key (rooms list: pano)
let tourTalks = false, tourNow = null;                    // the tour has spoken; the tour (A/B) it shows now
const TOUR_ORIGIN = "https://livetour.istaging.com";
window.addEventListener("message", (e) => {
  if (EMBED || e.origin !== TOUR_ORIGIN) return;
  const fr = document.getElementById("tour");
  if (!fr || e.source !== fr.contentWindow) return;
  let d = e.data;
  if (typeof d === "string") { try { d = JSON.parse(d); } catch { return; } }
  if (!d || d.event !== "changePano" || !d.panoramaId) return;
  tourTalks = true;
  const key = PANO.get(d.panoramaId);
  if (!key) return;
  tourNow = S.byKey[key].tour;
  // 11/26 (review): a scene walked to with the tour's own arrows moves "you are here" but is not a place asked about (the
  // Progress tab counts only those asked about here or opened from this page: the map, the place list, a Go to button;
  // 11/26 front-end review D01); the server learns the place with the next question, which carries it
  if (key !== S.room) {
    setHere(key, { record: false });
    // 11/26 (second regression pass): the server still learns it was walked, only to know which locks the player got past
    post("/api/visit", { session: S.session, room: key, walk: true }).catch(() => { /* not needed to go on */ });
  }
  else if (typeof Minimap !== "undefined") Minimap.update(key);           // the same place again: no longer "Last"
});
// a place in the tour shown now: iStaging's own goToPano (its usual scene change, no reload); otherwise load that tour
function moveTour(r) {
  const fr = $("#tour");
  if (tourTalks && r.pano && tourNow === r.tour && fr && fr.contentWindow) {
    try { fr.contentWindow.postMessage(JSON.stringify({ event: "goToPano", panoramaId: r.pano }), TOUR_ORIGIN); tourUrl = r.url; return; } catch { /* load it instead */ }
  }
  showTour(r.url);
}
function showTour(url) {
  const fr = $("#tour");
  tourUrl = url;
  // 11/26 (front-end review K01): which tour the frame shows is unknown until the new one reports a scene, so moveTour
  // loads by address until then (a goToPano for the old tour went into the other one and was lost)
  tourNow = null;
  if (!fr.getAttribute("src")) { fr.setAttribute("src", url); return; }
  // 11/26 (front-end review C00): a new frame with the same attributes instead of location.replace. A load started by this
  // page's script takes this page's no-referrer, so iStaging saw no address and stopped talking (changePano, goToPano);
  // a new frame loads through its own src and referrerpolicy="origin". Its first load adds no history entry either.
  try {
    const nf = fr.cloneNode(false);
    nf.setAttribute("src", url);
    fr.replaceWith(nf);
  } catch { try { fr.contentWindow.location.replace(url); } catch { fr.setAttribute("src", url); } }
}
async function goTo(key, opt = {}) {
  const r = S.byKey[key]; if (!r) return;
  if (EMBED && opt.jump) {         // inside iStaging: take the whole tour to that scene (a new tab if iStaging does not allow it)
    // our own page around the tour moves its tour instead. 11/26 (front-end review K00): this window moves to that place too
    // (questions carry it, the room picture); not sent as a visit here, the page around does that with the same session
    if (S.inOurPage) { setHere(key, { record: false }); askAncestors({ type: "lakeside:goto", room: key }); return; }
    try { window.top.location.href = r.url; } catch { window.open(r.url, "_blank", "noopener"); }
    return;
  }
  const moved = S.room !== null && S.room !== key;
  S.room = key; store.set("room", key);
  roomBg(key);
  $("#roomSelect").value = key;
  if (moved) flashRoom();
  if (typeof Minimap !== "undefined") Minimap.update(key);      // the mini map at the top left of the tour
  Quest.refresh();                                              // 11/27 evening: and the quest tracker under it
  // 11/23 (review): a jump the visitor asked for (the map, a Go to button, the map in iStaging's window) always moves the
  // tour, also to the scene it was last sent to: the visitor may have walked on inside it since, which this page never hears
  if (!EMBED && (opt.jump || tourUrl !== r.url)) moveTour(r);
  if (!opt.quiet && !EMBED) {
    const toast = $("#tourToast");
    toast.innerHTML = `${PIN}<span>Opening <b>${esc(r.it_en)}</b> in the tour <span lang="zh-Hant">前往${esc(r.it_zh)}</span></span>`;
    toast.classList.add("show"); clearTimeout(toastTimer); toastTimer = setTimeout(() => toast.classList.remove("show"), 3200);
  }
  if (opt.record === false) return;
  const res = await post("/api/visit", { session: S.session, room: key }).catch(() => null);
  if (res) updateState(res);
}

function updateState(res) {
  if (!res || !res.state) return;
  const before = S.state;
  S.state = res.state; if (res.session) S.session = res.session;
  if (res.state.total_findings) S.totalFindings = res.state.total_findings;
  if (res.state.model) showModel(res.state.model);
  // 11/28 (review: the tab said 0/17, the tracker 0/10, and nothing said how the two go together): the award's ten
  // until they are found, all of them after that, as the tracker counts
  const foundN = res.state.found_n || 0;
  $("#progBadge").textContent = `${foundN}/${foundN >= QUEST_GOAL ? S.totalFindings : QUEST_GOAL}`;
  const games = res.state.games || {}, played = GAMES.filter((g) => games[g[0]]).length;
  $("#dockGamesN").textContent = `${played}/${GAMES.length}`;
  if (before) {           // a new weakness or a new case played: the number jumps once
    if ((res.state.found_n || 0) > (before.found_n || 0)) bump($("#progBadge"));
    if (played > GAMES.filter((g) => (before.games || {})[g[0]]).length) bump($("#dockGamesN"));
  }
  // 11/22 evening (frame drops): the Progress tab is drawn again only when something it shows has changed
  const shows = (s) => (s ? JSON.stringify([s.found, s.games, s.visited_keys]) : "");
  if (!$("#pane-progress").hidden && shows(before) !== shows(res.state)) renderProgress(false);
  Quest.refresh();                          // 11/27 evening: a weakness found or a case played moves the quest on
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
  // 11/27 evening: after "I found it" on the quest tracker, what is typed is a report: sent as one, with no step that
  // guesses what the sentence is about (typed questions keep going the usual way once the report is judged or cancelled)
  if (text === undefined && Quest.reporting()) {
    return runAction("report_finding", q.slice(0, 200), q, () => { if (inp.value.trim() === q) { inp.value = ""; growAsk(); } });
  }
  // 11/26 (front-end review K10): the box is cleared only once the server has taken the question (a refusal, 429/503/413,
  // kept nothing to send again), and only if it still holds that question (a chip does not wipe a draft)
  stream("/api/chat", { session: S.session, message: q, room: S.room, lang: S.langPref }, q,
    () => { if (inp.value.trim() === q) { inp.value = ""; growAsk(); } });
  return true;
}

// true when it was sent; false while the last answer is still coming (the caller keeps what was typed and says so)
// key (11/27): the node meant, for a name pressed in the graph map (two nodes can have the same name)
function runAction(tool, target, label, onSent, key) {
  if (S.busy) return false;
  showTab("chat");
  stream("/api/action", { session: S.session, tool, target, label, room: S.room, lang: S.langPref, ...(key ? { key } : {}) }, label, onSent);
  return true;
}
// 11/23 (review): a short line next to what was pressed, gone after a few seconds. A question while the last answer was
// still coming did nothing at all (and a pasted email was cleared); a failed save said nothing.
function sayNear(at, html, opt = {}) {
  if (!at || !at.isConnected) return;
  const sib = opt.before ? at.previousElementSibling : at.nextElementSibling;
  let n = sib && sib.classList.contains("near-note") && !sib.classList.contains("is-going") ? sib : null;
  const fresh = !n;
  if (!n) {
    n = el("p", "near-note");
    n.setAttribute("role", "status");
    if (opt.before) at.before(n); else at.after(n);
  }
  n.classList.toggle("is-err", !!opt.err);
  n.innerHTML = html;
  // 11/28 (ui review F8): its 44 px were taken in one frame and given back in one frame (the conversation jumped twice)
  if (fresh) { const atEnd = threadAtEnd(); unfold(n, 300); if (atEnd) holdThreadEnd(300); }
  clearTimeout(n.timer);
  n.timer = setTimeout(() => fold(n), 4500);
}
const busyNote = (at, before) => sayNear(at, LB("Still answering the last question. Try again when it is done.", "上一題還在回答，等它答完再按一次。"), { before });

// onSent: called once the server has taken the question (a pasted text is cleared only then)
async function stream(url, body, shown, onSent) {
  S.busy = true; $("#askBtn").disabled = true;
  const th = $("#thread");
  { const em = $(".empty", th); if (em) { if (th.children.length === 1) fold(em, 300); else th.innerHTML = ""; } }     // 11/28 (ui review F19)
  th.setAttribute("aria-busy", "true");                     // 11/23 (review): screen readers wait for the whole answer
  const u = document.createElement("div"); u.className = "msg user"; u.innerHTML = `<div class="bubble">${esc(shown)}</div>`; th.appendChild(enter(u));
  const m = document.createElement("div"); m.className = "msg bot";
  m.innerHTML = `<div class="work"><span class="dots" aria-hidden="true"><i></i><i></i><i></i></span><span class="w">${L("Thinking about which tool to use", "判斷要用哪個工具")}</span></div><div class="answer"><span class="caret"></span></div>`;
  // 11/26 (front-end review K05): the entrance class at once with a delay (it stays hidden until then); added 90 ms later,
  // the row showed in full, vanished and faded in again
  m.style.animationDelay = "90ms"; th.appendChild(enter(m)); th.scrollTop = th.scrollHeight;
  const ansEl = $(".answer", m), workEl = $(".work", m);
  // 11/28 (review, a player whose report's answer stopped half-way: "my sentence is gone from the typing box and there is
  // no 'send again' button"): one press sends the very same thing again
  const retry = () => {
    const b = el("button", "chip", L("Send it again", "再送一次")); b.type = "button";
    b.addEventListener("click", () => { if (S.busy) { busyNote(b); return; } b.disabled = true; stream(url, body, shown, null); });
    const w = el("div", "follow"); w.appendChild(b); m.appendChild(w);
  };
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
    // 429/503: visitors through the tunnel, the limits in server.py. 11/26 (review): every other refusal (413 too large, 400,
    // a proxy's 502) also says what the server said; it used to end as "the answer stopped, check the .bat"
    if (!resp.ok) {
      const j = await resp.json().catch(() => ({})), busy = resp.status === 429 || resp.status === 503;
      ansEl.innerHTML = `<p class="err">${j.error ? esc(j.error) : busy ? "Busy. 現在忙不過來。"
        : LB(`The assistant could not handle this request (error ${resp.status}). Try again in a moment.`, `小幫手沒辦法處理這個要求（錯誤 ${resp.status}），等一下再試一次。`)}</p>`;
      finished = true; workEl.innerHTML = busy ? L("Not now", "稍後再問") : L("Not answered", "沒有回答");
      return;
    }
    // 11/26 (front-end review K22): onSent waits for the first event after "start". The saved copy answers with a 200
    // "the AI is off" note (done with trace.offline): nothing was checked or saved, so a pasted email or question stays.
    let sent = false;
    const taken = () => { if (!sent && onSent) { sent = true; onSent(); } };
    // 11/26 (front-end check of K22): the laptop's server has taken it once it answers 200; its route event comes only after
    // the model picked a tool (seconds), and the typed question sat in the box that long. Only the saved copy waits.
    if (!window.LAKESIDE_OFFLINE) taken();
    if (!resp.body) throw new Error("HTTP " + resp.status);
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
        if (ev !== "start" && !(ev === "done" && d.trace && d.trace.offline)) taken();
        if (ev === "start") { S.session = d.session; S.lastLang = d.lang; store.set("session", S.session); }
        else if (ev === "route") {
          const w = $(".w", workEl);
          // 11/26 (front-end review K06): the new label fades up with the Web Animations API; the CSS .swap class never played
          // because the shimmer rule (style.css .work:not(.is-done) .w) has the same weight, comes later and wins
          if (w) {
            w.innerHTML = TOOL[d.tool] ? L(TOOL[d.tool][0] + "…", TOOL[d.tool][1] + "…") : esc(d.tool) + "…";
            if (!RM.matches && typeof w.animate === "function") w.animate([{ opacity: 0, transform: "translateY(5px)" }, { opacity: 1, transform: "none" }], { duration: 300, easing: "cubic-bezier(.22, .9, .24, 1)" });
          }
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
      // 11/28 (review: "What is 啟動_AI助理.bat? I am a classmate at a browser"): what to do first, then whose laptop it is
      ansEl.innerHTML = `<p class="err">${LB("The IT Assistant could not be reached. Send it again in a moment. If it stays like this, it is not running on the presenter's laptop (啟動_AI助理.bat).", "連不到小幫手，等一下再送一次。一直連不到的話，是簡報電腦上的小幫手沒有在跑（啟動_AI助理.bat）。")}</p>`;
      workEl.innerHTML = L("Stopped", "已中斷");
      retry();
    }
  } finally {
    clearTimeout(idle);
    th.removeEventListener("wheel", mine); th.removeEventListener("touchmove", mine);
    th.removeEventListener("keydown", mineKey); th.removeEventListener("pointerdown", mineBar);
    if (!finished) {
      ansEl.innerHTML = md(text) + `<p class="err">${LB("The answer stopped before it finished. Send it again. If it keeps stopping, the IT Assistant on the presenter's laptop has stopped (啟動_AI助理.bat).", "回答中途斷了，再送一次。一直斷的話，是簡報電腦上的小幫手停了（啟動_AI助理.bat）。")}</p>`;
      workEl.innerHTML = L("Stopped", "已中斷");
      retry();
    }
    S.busy = false; $("#askBtn").disabled = false; th.removeAttribute("aria-busy");
    showStart();
  }
}

function finish(m, d, workEl) {
  const tr = d.trace || {};
  const used = tr.tool_used || (tr.route || {}).tool;
  // the saved copy's "AI is off" note took no time at all: its label alone (a "· 0 s" looked like a fault)
  // 11/26 (review): no tool at all (the model could not be reached to choose one): "Not answered", not " · ? s"
  const total = (tr.timings || {}).total_s;
  workEl.innerHTML = `<span>${!used && !tr.offline ? L("Not answered", "沒有回答") : TOOL[used] ? L(...TOOL[used]) : esc(used || "")}${tr.offline || total == null ? "" : tr.saved ? ` · ${L("saved answer", "存好的回答")}` : ` · ${total} s`}</span>`;   // 11/26 (front-end review D00): the saved copy replays at once; the recorded time stays in How it works
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
  // 11/28 noon: the model writes the resort's name with another character (度假村); the page writes 渡假村 everywhere
  s = String(s ?? "").replace(/度假村/g, "渡假村");
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
  b.dataset.fk = "room:" + r.key;           // 11/26 (front-end review K08): the Progress tab puts the focus back on it after a redraw
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
    if (s.kind === "rooms") { const w = el("div", "items"); for (const r of s.items) w.appendChild(r.locked ? lockedStop(r) : roomLink(r)); sec.appendChild(w); }
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
  card.appendChild(b);
  // 11/26 (front-end review K72): the time limit is a few sentences, so it is a note under the severity pill (inside the
  // pill's round ends the first and last lines ran into the curve)
  if (pick(c.time)) card.appendChild(el("p", "note", pLB(c.time)));
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
  // 11/26 (front-end review K11): "1 click" for the room next door
  card.appendChild(el("p", "note", L(`${c.clicks} click${c.clicks === 1 ? "" : "s"} through the hotspots`, `一共要點 ${c.clicks} 次`)));
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
    // 11/28 (review: "Audit list is the game's word for its 17 answers; nobody told me"): in the words the tracker uses
    already: ["Already reported", "已經回報過了"], none: ["Not one of the hidden weaknesses", "這不是藏起來的漏洞"],
    close: ["Close: say what is wrong with it", "很接近了：再說清楚它哪裡有問題"] }[c.result];
  Quest.reported(c.result);                 // 11/27 evening: a right report ends the tracker's "report" note over the ask box
  card.appendChild(el("p", "result " + c.result, L(...res)));
  if (c.finding) {
    const f = c.finding;
    const h = el("div", "card-head"); h.innerHTML = `<h3>${L(f.en, f.zh)}</h3><span class="badge sev-${esc(f.severity)}">${L(f.severity, SEV_ZH[f.severity])}</span><span class="sub">${L(`risk ${f.risk} of 25`, `風險 ${f.risk}（滿分 25）`)}</span>`;
    card.appendChild(h);
    card.appendChild(el("p", "text", `<b>${L("Why it matters:", "為什麼危險：")}</b> ${LB(f.why_en, f.why_zh)}`));
    card.appendChild(el("p", "text", `<b>${L("Fix:", "怎麼改：")}</b> ${LB(f.fix_en, f.fix_zh)}`));
    if (f.breaks.length) card.appendChild(el("div", "refs", `${L("Breaks:", "違反：")} ${f.breaks.map((x) => pL(x)).join("; ")}`));
    if (f.fixed_by.length) { const w = el("div", "items"); w.style.marginTop = "8px"; for (const x of f.fixed_by) w.appendChild(entityChip(x)); card.appendChild(w); }
  }
  // 11/28 (review, a first-time player: a report that missed got "not on the list" and nothing else, and "Give me a
  // hint" repeated the order after a minute): what is still to find at this place, each with a hint on request
  if (c.again && c.again.length) card.appendChild(Quest.again(c));
  // the count is the tracker's: towards the award's ten, then of all of them (the card said 1 / 17 beside the tracker's 1 / 10)
  const goal = c.goal || QUEST_GOAL, of = c.found >= goal ? c.total : goal;
  const p = el("div", "sec"); p.innerHTML = `<h4>${L("Weaknesses found", "找到的漏洞")} ${c.found} / ${of}</h4><div class="bar"><b style="width:${Math.min(100, (100 * c.found) / of)}%"></b></div>${
    c.found < goal ? `<p class="refs">${LB(`The award needs ${goal} of the resort's ${c.total}.`, `渡假村共有 ${c.total} 個，找到 ${goal} 個就得獎。`)}</p>` : ""}`;
  card.appendChild(p);
  // what to do next, right under the verdict: the tracker's own objective and buttons (the player read the answer on the
  // right while the tracker changed on the far left, and nothing near the answer said what came next)
  if (c.quest && c.quest.now) { card.appendChild(el("h4", "next-h", L("Next", "接下來"))); card.appendChild(Quest.block(c.quest, { wide: true, frozen: true })); }
  return card;
}

function progressCard(card, c) {
  card.appendChild(el("div", "card-head", `<h3>${L("Your progress", "你的進度")}</h3>`));
  // 11/23: only the places asked about here (or opened from our map) are counted, not the ones walked to in the tour,
  // so no "of 47"
  // 11/28 (review: "1 of 17" beside the tracker's 1 / 10; "Places you asked me about: 4. I asked about none"): the
  // award's ten first, and the places are the ones opened with this page's buttons
  const goal = QUEST_GOAL, of = c.found >= goal ? Math.max(1, c.total) : goal;
  card.appendChild(el("p", "note", LB(`Weaknesses found: ${c.found} of ${of}${c.found < goal ? ` (the award needs ${goal} of the resort's ${c.total})` : ""}. Places opened with the buttons here: ${c.visited}.`,
    `找到的漏洞：${c.found} / ${of}${c.found < goal ? `（渡假村共有 ${c.total} 個，找到 ${goal} 個就得獎）` : ""}。用這裡的按鈕去過的地方：${c.visited} 個。`)));
  card.appendChild(el("div", "bar", `<b style="width:${Math.min(100, (100 * c.found) / of)}%"></b>`));
  // 11/27 evening: the quest tracker's objective for the place the question was asked at, with its buttons
  if (c.quest && c.quest.now) card.appendChild(Quest.block(c.quest, { wide: true, frozen: true }));
  return card;
}

/* ---------------------------------------------------------------- how I found this */
function renderTrace(tr) {
  if (tr.offline) return document.createDocumentFragment();      // the saved copy's "AI is off" answer: nothing was looked up
  // 11/26 (review): stopped before a tool was chosen (the model down): nothing was looked up either (it showed "{}")
  if (!tr.route && !tr.tool_used) return document.createDocumentFragment();
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
  if (tr.redirect) b.appendChild(el("p", "refs", esc("redirected 轉給: " + LT(tr.redirect, redirectZh(tr.redirect)))));   // 11/26 (front-end review K04): with its Chinese
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
    // 11/26 (review): at most 6000 characters, like the ask box (the server reads no more; a long raw email went over its
    // 64 KB limit and was refused)
    const f = el("form", "paste"); f.innerHTML = `<textarea maxlength="6000" aria-label="${esc(en)}" placeholder="${esc(ph)}"></textarea><button type="submit">${tool === "check_email" ? L("Check it", "檢查") : L("Report it", "回報")}</button>`;
    // 11/23 (review): cleared only once it has been sent; while the last answer is still coming the text stays, with a note
    // 11/26 (review): and only once the server has taken it (a refusal kept nothing), unless the visitor changed it since
    f.addEventListener("submit", (e) => {
      e.preventDefault();
      const ta = $("textarea", f), v = ta.value.trim();
      if (!v) return;
      if (!runAction(tool, "", v, () => { if (ta.value.trim() === v) ta.value = ""; })) busyNote($("button", f));
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
  // 11/28 noon (a first-time player: "2 / 17" in the ring beside "Progress 2/10" on the tab): the number counts towards
  // the award as the tracker's does, then of all of them; the ring itself stays the whole 17 with its mark at ten
  const of = n >= GOAL ? total : GOAL;
  const R = 40, C = 2 * Math.PI * R, off = (x) => (C * (1 - Math.min(1, x / total))).toFixed(1);
  const a = (2 * Math.PI * GOAL) / total, tick = (r) => `${(50 + r * Math.cos(a)).toFixed(1)} ${(50 + r * Math.sin(a)).toFixed(1)}`;
  // 11/26 (front-end review K08): the view is drawn anew (a place link adds a visit, Start over), which threw away the
  // focused button; remember which one it was (data-fk, and which of the same) to focus its new copy at the end
  const act = document.activeElement, had = act && v.contains && v.contains(act) && act.dataset ? act : null;
  const fk = had ? had.dataset.fk : "";
  const fkAll = () => [...v.querySelectorAll("[data-fk]")].filter((x) => x.dataset.fk === fk);
  const fkNth = fk ? fkAll().indexOf(had) : -1;
  v.innerHTML = `<section class="prog-top">
      <div class="ring" role="img" aria-label="${n} / ${of}">
        <svg viewBox="0 0 100 100" aria-hidden="true"><circle class="track" cx="50" cy="50" r="${R}"/>
          <circle class="val" cx="50" cy="50" r="${R}" style="stroke-dasharray:${C.toFixed(1)};stroke-dashoffset:${off(anim ? 0 : ringWas)}"/>
          <path class="goal" d="M${tick(33)} L${tick(47)}" stroke-linecap="round"/></svg>
        <div class="ring-n">${n}<small>/ ${of}</small></div></div>
      <div><h2>Security weaknesses found <span lang="zh-Hant">找到的資安漏洞</span></h2>
        <p class="note">${LB(`Find 10 of the resort's ${total} to win Security Champion at the awards night in the Lake Pavilion Theater.`, `渡假村藏著 ${total} 個，找到 10 個就能在湖心館劇場的頒獎晚會拿到資安新人獎。`)}</p>
        <span class="goal-l">${L("10: Security Champion", "10 個：資安新人獎")}</span></div></section>`;
  const ring = $(".ring .val", v);
  requestAnimationFrame(() => requestAnimationFrame(() => { if (ring) ring.style.strokeDashoffset = off(n); }));
  ringWas = n;
  // 11/28 (the user: this tab repeats the journal, which has a window of its own now; "what matters here feels like the
  // casebook and the places asked about"): the route is not drawn here any more. One row says the objective and opens
  // the journal's window; the casebook comes right after it, then what was found, then the places. In iStaging's window
  // there is no tracker and no such window, so the journal (11/27 evening) stays in this tab there.
  if (EMBED) { const jr = el("div", "journal"); jr.id = "questJournal"; v.appendChild(jr); Quest.fillJournal(); }
  else v.appendChild(Quest.journalRow());
  const ul = el("ul", "found-list");
  for (const f of found) {
    const li = el("li"); li.innerHTML = `<span class="badge sev-${esc(f.severity)}">${L(f.severity, SEV_ZH[f.severity])}</span><span>${L(f.en, f.zh)}</span>`;
    const r = S.byKey[f.room]; if (r) li.appendChild(roomLink(r));
    ul.appendChild(li);
  }
  if (!found.length) ul.innerHTML = `<li class="is-none">${EMBED ? LB("None yet. Ask “What should I do next?” for a hint.", "還沒有。問「接下來要去哪？」可以拿到提示。")
    : LB("None yet. The quest tracker beside the map says where to look.", "還沒有。地圖旁邊的任務條會說要看哪裡。")}</li>`;
  const games = st.games || {};
  const played = GAMES.filter((g) => games[g[0]]).length;
  v.appendChild(el("h2", "", `Casebook <span lang="zh-Hant">事件簿</span> · ${played} / ${GAMES.length}`));
  const cs = el("div", "cases");
  const tgt = "_self";                               // here: the game window (bindUi); inside iStaging's window: this window
  // 11/26 (front-end review K76): each Play link is described by its case's title (aria-describedby case-t-<game>), so a
  // screen reader's list of links no longer has four plain "Play"
  for (const [k, en, z, room] of GAMES) {           // one card per case, numbered like the red CASE boards in the tour
    const r = games[k], [no, name, zname, zno] = caseParts(en, z), c = el("div", "case lg-hi" + (r ? " is-played" : ""));
    c.innerHTML = `<i class="case-no">${esc(no.toUpperCase())} <span lang="zh-Hant">${esc(zno)}</span></i>
      <span class="case-t" id="case-t-${k}">${esc(name)}<span lang="zh-Hant">${esc(zname)}</span></span>
      <span class="case-res">${r ? `${L("Best", "最佳")} <b>${r.best}</b> / ${r.best_total ?? r.total}${r.plays > 1 ? ` · ${L(`${r.plays} plays`, `玩了 ${r.plays} 次`)}` : ""}` : L("Not played yet", "還沒玩")}</span>
      <div class="case-go"><a class="case-play" data-fk="case:${k}" aria-describedby="case-t-${k}" href="/lakeside/games/${k}" target="${tgt}" rel="noopener"><svg viewBox="0 0 12 12" aria-hidden="true"><path d="M3 1.8v8.4L10 6z" fill="currentColor"/></svg>${r ? L("Play again", "再玩一次") : L("Play", "開始玩")}</a></div>`;
    if (S.byKey[room]) $(".case-go", c).appendChild(roomLink(S.byKey[room]));
    cs.appendChild(c);
  }
  v.appendChild(cs);
  // 11/28: what was found comes after the casebook, under a heading of its own (it sat right under the ring before)
  v.appendChild(el("h2", "", `What you found <span lang="zh-Hant">你找到的漏洞</span> · ${n} / ${total}`));
  v.appendChild(ul);
  // 11/23: a place counts when it was asked about here or opened from our map, not when walked to with the tour's own
  // arrows, so the heading says that and has no "of 47" to reach
  // 11/28 (review, a first-time player: "I asked about no place", seven were green, "I cannot say what turns a pill
  // green"): the title says what is counted, and one line says what is not
  const h = el("h2", "", `Places opened with the buttons here <span lang="zh-Hant">用這裡的按鈕去過的地方</span> · ${st.visited || 0}`); v.appendChild(h);
  v.appendChild(el("p", "note", LB("Green: you went there with the map or a Go button on this page, or asked about it. A place you only walked to inside the tour is not counted.", "綠色：你用這裡的地圖或「帶我去」去過，或問過它。只在導覽裡自己走到的不算。")));
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
  const reset = el("button", "btn-plain", `<span>${L("Start over", "重新開始")}</span>`); reset.type = "button";
  reset.dataset.fk = "reset";                // 11/26 (front-end review K08)
  let armed = null;
  const say = (en, zh) => { reset.firstChild.innerHTML = L(en, zh); };          // the text only: the press's ripple is a child too
  const disarm = () => { clearTimeout(armed); armed = null; say("Start over", "重新開始"); reset.classList.remove("is-armed"); };
  reset.addEventListener("click", async () => {
    if (!armed) {
      say("Click again to clear", "再按一次就清除"); reset.classList.add("is-armed");
      armed = setTimeout(disarm, 3000);
      return;
    }
    disarm();
    try { updateState(await post("/api/settings", { session: S.session, reset: true, ...(store.get("model", null) === S.model ? { model: S.model } : {}) })); renderProgress(true); }
    catch (err) { sayNear(reset, err && err.said ? esc(err.said) : LB("Could not clear the progress. Check that 啟動_AI助理.bat is running.", "清不掉進度，請確認 啟動_AI助理.bat 有在執行。"), { err: true }); }
  });
  v.appendChild(reset);
  [...v.children].forEach((c, i) => c.style.setProperty("--i", Math.min(i, 10)));
  // 11/26 (front-end review K08): the focus back on the new copy of what had it
  if (fk) { const same = fkAll(), to = same[fkNth] || same[0]; if (to) to.focus({ preventScroll: true }); }
}

/* ---------------------------------------------------------------- the graph map (How it works, 11/27)
   The user had looked at the graph in Neo4j Browser, which only opens on the laptop: "put it in the assistant".
   Every type of node is a button in one of two columns, and a curve between two types means they have relationships.
   The curves stay in the channel between the columns, so no line runs behind a button. A pressed type lights its curves
   (an arrowhead sits where a relationship ends) and, under the map, a card says what the type is and lists its
   relationships and what is in it. The numbers are /api/schema's, the same as the two tables below the map. */
const SCHEMA_COLS = [["Area", "Room", "Tag", "Finding", "Department", "Role", "System", "DataAsset"],
  ["Concept", "CaseStudy", "PhishingSign", "Threat", "Control", "Requirement", "Standard", "Procedure", "Step"]];
const SCHEMA_HEAD = [["Tour & organisation", "導覽和組織"], ["Security knowledge", "資安知識"]];
const GMAP_SHOWN = 16;                          // names listed before "Show all"
// the Chinese of every relationship type (the same words as the table of relationships in the report)
const REL_ZH = {
  IN_AREA: "在哪一區", LINKS_TO: "可以走到", CLOSEUP_OF: "近看", NEXT_IN_STORY: "故事下一站", IN_ROOM: "在哪一間", ABOUT: "講的是",
  LOCATED_IN: "放在", SEEN_IN: "看得到", TAUGHT_IN: "教到", SHOWN_IN: "出現在", PRACTISED_IN: "演練地點", BASED_IN: "所在地",
  EXPOSES: "暴露", LEADS_TO: "可能導致", BREAKS: "違反", FIXED_BY: "改善方法", SIGN_OF: "跡象", HAS_STEP: "有步驟", NEXT: "下一步",
  DONE_BY: "由誰做", CONTACT: "聯絡窗口", BASED_ON: "依據", HANDLES: "應對", MEMBER_OF: "隸屬", OWNS: "負責", USES: "使用",
  CAN_ACCESS: "可以存取", STORES: "存放", PROCESSES: "處理", SENDS_TO: "送資料到", HOSTS: "承載", PROTECTS: "保護", MITIGATES: "降低",
  TARGETS: "針對", MEETS: "符合", PART_OF: "屬於", APPLIES_TO: "適用於", RELATED_TO: "相關", INVOLVED: "涉及", LESSON: "教訓", AFFECTED: "影響到",
};
// one line about each type, with examples that are in the graph
const TYPE_INFO = {
  Area: ["A part of the resort, such as the Clubhouse or the Old Town.", "渡假村的一區，例如會館、老城。"],
  Room: ["A place in the 360° tour. Each one is a panorama.", "導覽裡的一個地點，每個地點是一張全景。"],
  Tag: ["A label you click in the tour: a note, a picture, a video or a PDF.", "導覽裡點得到的標籤：便條、照片、影片或 PDF。"],
  Finding: ["A security weakness hidden in a scene for you to find.", "藏在場景裡，等你去找的資安漏洞。"],
  Department: ["A department of the resort, such as the Front Office or Information Technology.", "渡假村的部門，例如櫃台部、資訊部。"],
  Role: ["A job at the resort, such as Front Desk Agent or Accountant.", "渡假村裡的職務，例如櫃台接待、會計。"],
  System: ["A system or a device, such as the PMS, the POS or the door locks.", "系統或設備，例如飯店管理系統（PMS）、收銀系統（POS）、電子門鎖。"],
  DataAsset: ["A kind of data the resort keeps, such as reservation records or payment card data.", "渡假村保管的一種資料，例如訂房紀錄、信用卡卡號。"],
  Threat: ["Something that can go wrong, such as a phishing email or ransomware.", "可能出事的狀況，例如釣魚郵件、勒索軟體。"],
  Control: ["A safeguard that lowers a risk, such as backups or multi-factor authentication.", "降低風險的做法，例如備份、多因素驗證。"],
  Requirement: ["One clause of a standard or a law, such as ISO/IEC 27001 A.5.15.", "標準或法規裡的一條，例如 ISO/IEC 27001 A.5.15。"],
  Standard: ["A standard or a law: ISO/IEC 27001, PCI DSS, NIST CSF, GDPR and Taiwan's Personal Data Protection Act.", "標準或法規：ISO/IEC 27001、PCI DSS、NIST CSF、GDPR、個資法。"],
  Procedure: ["What to do when something happens, such as a lost staff badge or ransomware.", "遇到狀況時怎麼處理，例如員工證遺失、勒索軟體。"],
  Step: ["One step of a procedure, and who does it.", "流程裡的一步，還有由誰來做。"],
  Concept: ["An idea from the IT and security course with an example at the resort, such as Zero Trust.", "資管和資安課的觀念，附渡假村裡的例子，例如零信任。"],
  CaseStudy: ["A real incident and its lesson, such as the Marriott guest database breach.", "真實發生過的事件和教訓，例如 Marriott 訂房資料庫外洩。"],
  PhishingSign: ["A warning sign of a phishing email. The email check and Case 1 score a message with them.", "釣魚信的警訊，查信和第一案都用它們幫信打分數。"],
};
// the types whose nodes the server does not list by name (server.py SCHEMA_NAMED), and what to do instead
const TYPE_UNLISTED = {
  Finding: ["Their names stay hidden until you find them in the tour. The Progress tab shows how many you have found.", "名字要等你在導覽裡找到才會出現，「進度」分頁會顯示你找到幾個。"],
  Tag: ["They are the labels of the two tours. Open the tour and click them there.", "它們是兩個導覽裡的標籤，內容要到導覽裡點開看。"],
  Step: ["Every step belongs to a procedure. Pick Procedure, then a procedure, to read its steps in order.", "每一步都屬於一個流程。選 Procedure 再選一個流程，就能照順序看步驟。"],
};

function drawSchema(box, s) {
  const NS = "http://www.w3.org/2000/svg";
  const labels = s.labels || [], count = Object.fromEntries(labels.map((x) => [x.l, x.c]));
  // the types the graph has, in the two columns; a type added to the graph later goes under the shorter column
  const cols = SCHEMA_COLS.map((c) => c.filter((l) => count[l]));
  for (const l of Object.keys(count)) if (!cols.some((c) => c.includes(l))) cols[cols[0].length <= cols[1].length ? 0 : 1].push(l);
  const side = {};
  cols.forEach((c, i) => c.forEach((l) => { side[l] = i; }));
  const zhName = (l) => (LABEL[l] ? LABEL[l][1] : "");
  const nf = (n) => Number(n || 0).toLocaleString("en-US");
  const total = (xs) => xs.reduce((n, x) => n + (x.c || 0), 0);
  const rows = (s.pattern || []).filter((p) => p.a in side && p.b in side);
  // one curve for each pair of types with relationships between them, whichever way they point
  const pairs = new Map(), nb = {};
  const pk = (a, b) => (a < b ? `${a}|${b}` : `${b}|${a}`);
  for (const p of rows) {
    let q = pairs.get(pk(p.a, p.b));
    if (!q) { const [a, b] = p.a < p.b ? [p.a, p.b] : [p.b, p.a]; pairs.set(pk(a, b), q = { a, b, c: 0, fwd: false, back: false }); }
    q.c += p.c;
    if (p.a === q.a) q.fwd = true; else q.back = true;       // along the curve (from a to b), or against it
    (nb[p.a] = nb[p.a] || new Set()).add(p.b);
    (nb[p.b] = nb[p.b] || new Set()).add(p.a);
  }

  const nTypes = labels.length, nRels = (s.rels || []).length;
  const lead = el("p", "gmap-lead", LB(
    `${nf(total(labels))} nodes of ${nTypes} types and ${nf(total(s.rels || []))} relationships of ${nRels} types. A curve joins two types that have relationships; a thicker curve means more of them.`,
    `${nf(total(labels))} 個節點分成 ${nTypes} 種，${nf(total(s.rels || []))} 條關係分成 ${nRels} 種。兩種節點之間有關係就連一條線，線越粗表示關係越多。`));

  // ---- the map: the curves in one svg under the buttons
  const map = el("div", "gmap");
  map.id = "gmap";
  const mk = (tag, cls) => { const e = document.createElementNS(NS, tag); e.setAttribute("class", cls); return e; };
  const svg = mk("svg", "gmap-links");
  svg.setAttribute("aria-hidden", "true");
  map.appendChild(svg);
  const btn = {}, arrow = {};
  cols.forEach((c, i) => {
    const col = el("div", "gmap-col");
    col.appendChild(el("p", "gmap-h", L(...SCHEMA_HEAD[i])));
    c.forEach((l, j) => {
      const z = zhName(l);
      const b = el("button", "gnode", `<i class="gnode-dot" aria-hidden="true"></i><b class="gnode-en">${esc(l)}</b><span class="gnode-zh" lang="zh-Hant">${esc(z)}</span><em class="gnode-c">${nf(count[l])}</em>`);
      b.type = "button"; b.dataset.t = l;
      b.setAttribute("aria-pressed", "false"); b.setAttribute("aria-controls", "gmapInfo");
      b.setAttribute("aria-label", LT(`${l}, ${count[l]} nodes`, `${z || l}，${count[l]} 個節點`));
      b.style.setProperty("--i", i * 2 + j);
      col.appendChild(b); btn[l] = b;
    });
    map.appendChild(col);
  });
  let n = 0;
  for (const q of pairs.values()) {
    q.g = mk("g", "glink"); q.line = mk("path", "glink-line"); q.flow = mk("path", "glink-flow");
    q.g.style.setProperty("--w", `${(1 + Math.min(1.9, Math.log10(q.c + 1) * 0.85)).toFixed(2)}px`);
    q.g.style.setProperty("--j", n++);
    q.g.appendChild(q.line); q.g.appendChild(q.flow); svg.appendChild(q.g);
  }
  for (const l of Object.keys(btn)) { arrow[l] = mk("path", "garrow"); arrow[l].dataset.t = l; svg.appendChild(arrow[l]); }

  // where the curves run: from the inner edge of one button to the inner edge of the other. Measured with offsetLeft and
  // offsetTop (the map is their offset parent), which a button's own animation or the window's does not change.
  let drawn = false, raf = 0;
  function place() {
    const W = map.clientWidth, H = map.clientHeight;
    if (!W || !H) return;                                    // the tab is not shown; ResizeObserver calls again when it is
    svg.setAttribute("viewBox", `0 0 ${W} ${H}`);
    const at = {};
    for (const l of Object.keys(btn)) {
      const b = btn[l], sg = side[l] ? -1 : 1, x = side[l] ? b.offsetLeft : b.offsetLeft + b.offsetWidth, y = b.offsetTop + b.offsetHeight / 2;
      at[l] = { x, y, sg };
      arrow[l].setAttribute("d", `M${x + sg * 1.5},${y}l${sg * 7},-4.2v8.4z`);
    }
    const lx = cols[0].map((l) => at[l].x), rx = cols[1].map((l) => at[l].x);
    const ch = lx.length && rx.length ? Math.max(40, Math.min(...rx) - Math.max(...lx)) : 100;      // the channel's width
    for (const q of pairs.values()) {
      const A = at[q.a], B = at[q.b];
      let d;
      if (q.a === q.b) d = `M${A.x},${A.y - 7}c${A.sg * 22},-9 ${A.sg * 22},23 0,14`;                // a type related to itself: a small loop
      else if (A.sg === B.sg) { const k = A.sg * Math.min(ch * 0.46, 14 + Math.abs(B.y - A.y) * 0.3); d = `M${A.x},${A.y}C${A.x + k},${A.y} ${B.x + k},${B.y} ${B.x},${B.y}`; }
      else { const k = (B.x - A.x) * 0.5; d = `M${A.x},${A.y}C${A.x + k},${A.y} ${B.x - k},${B.y} ${B.x},${B.y}`; }
      q.line.setAttribute("d", d); q.flow.setAttribute("d", d);
    }
    if (!drawn) {                                            // the first time they are seen, the curves are drawn in
      drawn = true;
      for (const q of pairs.values()) q.line.style.setProperty("--len", Math.ceil(q.line.getTotalLength()) + 1);
      map.classList.add("is-draw");
      setTimeout(() => map.classList.remove("is-draw"), RM.matches ? 0 : 2400);
    }
  }
  const again = () => { if (!raf) raf = requestAnimationFrame(() => { raf = 0; place(); }); };

  // ---- what is lit: the type under the mouse, or else the pressed one
  let sel = null, hov = null;
  function paint() {
    const T = hov || sel, into = new Set();                  // into: the types a lit relationship ends at
    map.classList.toggle("has-on", !!T);
    for (const q of pairs.values()) {
      const hit = !!T && (q.a === T || q.b === T);
      q.g.classList.toggle("is-on", hit);
      q.g.classList.toggle("is-rev", hit && q.back && !q.fwd);
      q.g.classList.toggle("is-both", hit && q.back && q.fwd);
      if (hit) q.g.dataset.t = q.a === T ? q.b : q.a; else delete q.g.dataset.t;      // in the colour of the type at the other end
      if (hit && q.a !== q.b) { if (q.fwd) into.add(q.b); if (q.back) into.add(q.a); }
    }
    // the dots on the lit curves start again from the beginning (they run for four seconds, style.css): the class is taken
    // off every curve, the page is measured once so the browser notes it, then put back on the lit ones
    for (const q of pairs.values()) q.flow.classList.remove("is-go");
    if (T) { void map.offsetWidth; for (const q of pairs.values()) if (q.g.classList.contains("is-on")) q.flow.classList.add("is-go"); }
    for (const l of Object.keys(btn)) {
      const on = l === T, linked = !!T && !on && !!nb[T] && nb[T].has(l);
      btn[l].classList.toggle("is-on", on);
      btn[l].classList.toggle("is-linked", linked);
      btn[l].classList.toggle("is-dim", !!T && !on && !linked);
      btn[l].setAttribute("aria-pressed", String(l === sel));
      arrow[l].classList.toggle("is-on", into.has(l));
    }
  }
  const hot = (a, b, on) => { const q = pairs.get(pk(a, b)); if (q) q.g.classList.toggle("is-hot", on); };
  function pick(l, fromCard) { sel = l; hov = null; paint(); info(l, fromCard); }
  for (const l of Object.keys(btn)) {
    btn[l].addEventListener("click", () => pick(sel === l ? null : l));
    btn[l].addEventListener("pointerenter", (e) => { if (e.pointerType === "mouse") { hov = l; paint(); } });
    btn[l].addEventListener("pointerleave", () => { if (hov) { hov = null; paint(); } });
  }

  // ---- the card under the map
  const infoBox = el("div", "gmap-info");
  infoBox.id = "gmapInfo"; infoBox.setAttribute("aria-live", "polite");
  function info(T, fromCard) {
    for (const q of pairs.values()) q.g.classList.remove("is-hot");
    if (!T) {
      infoBox.replaceChildren(el("p", "gmap-hint", LB("Pick a type. Its relationships light up, and this part lists them and what is in the type.", "點一種節點，它的關係會亮起來，這裡會列出這些關係和裡面有什麼。")));
      return;
    }
    const card = el("section", "card lg-hi gmap-card");
    card.appendChild(el("div", "card-head", `<h3>${L(T, zhName(T))}</h3><span class="kind" data-t="${esc(T)}">${L(`${nf(count[T])} nodes`, `${nf(count[T])} 個節點`)}</span>`));
    if (TYPE_INFO[T]) card.appendChild(el("p", "text", LB(...TYPE_INFO[T])));
    let i = 0;
    const group = (hEn, hZh, list, other, dir) => {
      if (!list.length) return;
      const sec = el("div", "sec");
      sec.style.setProperty("--i", Math.min(i++, 8));
      sec.appendChild(el("h4", "", L(hEn, hZh)));
      const ul = el("ul", "grels");
      for (const p of list.slice().sort((x, y) => y.c - x.c || x.t.localeCompare(y.t))) {
        // a long name may break after an underscore (NEXT_IN_ / STORY), never inside a word
        const o = other(p), li = el("li", "grel", `<span class="grel-n"><b>${esc(p.t).replace(/_/g, "_<wbr>")}</b>${REL_ZH[p.t] ? `<span lang="zh-Hant">${esc(REL_ZH[p.t])}</span>` : ""}</span><span class="grel-d" aria-hidden="true">${dir}</span>`);
        const b = el(o === T ? "span" : "button", o === T ? "chip gtype is-plain" : "chip gtype", L(o, zhName(o)));
        b.dataset.t = o;
        if (o !== T) { b.type = "button"; b.title = LT(`Show ${o}`, `看${zhName(o) || o}`); b.addEventListener("click", () => pick(o, true)); }
        li.appendChild(b);
        li.appendChild(el("em", "grel-c", nf(p.c)));
        li.addEventListener("pointerenter", () => hot(T, o, true));
        li.addEventListener("pointerleave", () => hot(T, o, false));
        ul.appendChild(li);
      }
      sec.appendChild(ul); card.appendChild(sec);
    };
    group("From this type to others", "從這一種連出去", rows.filter((p) => p.a === T && p.b !== T), (p) => p.b, "→");
    group("From others to this type", "從別種連進來", rows.filter((p) => p.b === T && p.a !== T), (p) => p.a, "←");
    group("Between two of this type", "同一種之間", rows.filter((p) => p.a === T && p.b === T), () => T, "→");

    const names = (s.names || {})[T], sec = el("div", "sec");
    sec.dataset.t = T; sec.style.setProperty("--i", Math.min(i++, 8));
    if (names && names.length) {
      // a pressed name asks the assistant about that very node (its key goes along); the saved copy has no AI, and a
      // phishing sign is not something the assistant looks up by name, so there the names are only listed
      const live = !window.LAKESIDE_OFFLINE && T !== "PhishingSign";
      sec.appendChild(el("h4", "", L(`What is in it (${nf(names.length)})`, `裡面有什麼（${nf(names.length)} 個）`)));
      const w = el("div", "items gnames");
      names.forEach((x, k) => {
        // a clause is written with its standard and number in front, once ("ISO/IEC 27001 A.5.15 Access control 存取控制")
        const en = x.pre ? `${x.pre} ${x.en}` : x.en, shown = both({ en, zh: x.zh });
        let c;
        if (live) {
          c = el("button", "chip", shown); c.type = "button";
          // the words in the chat follow the language setting as the starters and the tasks do (11/27 review: after a reload with
          // 中文 chosen the bubble said "Tell me about ..." over a Chinese answer)
          c.addEventListener("click", () => { if (!runAction("explain", en || x.zh, zh() || S.langPref === "zh" ? `說明${x.pre ? x.pre + " " : ""}${x.zh || x.en}` : `Tell me about ${en}`, undefined, x.k)) busyNote(w); });
        } else c = el("span", "chip is-plain", shown);
        if (k >= GMAP_SHOWN) c.classList.add("is-more");
        w.appendChild(c);
      });
      sec.appendChild(w);
      if (names.length > GMAP_SHOWN) {
        const more = el("button", "chip gmore");
        more.type = "button";
        const set = (open) => {
          w.classList.toggle("is-open", open); more.setAttribute("aria-expanded", String(open));
          more.innerHTML = open ? L("Show fewer", "收起來") : L(`Show all ${nf(names.length)}`, `顯示全部 ${nf(names.length)} 個`);
        };
        more.addEventListener("click", () => set(!w.classList.contains("is-open")));
        set(false); sec.appendChild(more);
      }
      if (live) sec.appendChild(el("p", "refs", LB("Press a name and the assistant tells you about it in Chat.", "按名字，小幫手會在「對話」說明它。")));
      else if (window.LAKESIDE_OFFLINE && T !== "PhishingSign") sec.appendChild(el("p", "refs", LB("This is the saved copy and its AI is off, so the names are only listed.", "這是離線版，AI 沒開，名字只能看。")));
      card.appendChild(sec);
    } else if (TYPE_UNLISTED[T]) {
      sec.appendChild(el("h4", "", L("What is in it", "裡面有什麼")));
      sec.appendChild(el("p", "note", LB(...TYPE_UNLISTED[T])));
      card.appendChild(sec);
    }
    infoBox.replaceChildren(enter(card, 900));
    if (fromCard) { card.tabIndex = -1; card.focus({ preventScroll: true }); }      // the pressed button is gone with the old card
  }

  box.appendChild(lead); box.appendChild(map); box.appendChild(infoBox);
  info(null);
  enter(map, 1500);                                          // the buttons rise in once (style.css .gmap.is-in)
  place();
  if (window.ResizeObserver) new ResizeObserver(again).observe(map); else window.addEventListener("resize", again);
}

/* ---------------------------------------------------------------- the quest tracker (11/27 evening)
   The user, with a screenshot of asking "I am here, where is the weakness?" on the patio: 「感覺進度也要像小遊戲那樣有指示，
   就像原神或鳴潮的任務條那樣」「不然我都不知道進度是要怎麼走」. The page only counted (0/17); where to go, what to look at and
   how a weakness is counted at all were only told when asked.
   A tracker under the small map and the two buttons (where those games have theirs) now always shows the ONE thing to do:
   find what is hidden here, take a closer look next door, play the case here, get the code for this door, or go to the
   next stop. It changes with the place, it never blocks ("Skip" is always there), and it ticks off when a report is
   right. The same objective heads the Progress tab, which lists the whole route, and the "what next" answer's card.
   The server works it out (assistant/quest.py, GET /api/quest: no model, no database query); this part writes the words. */
const Quest = (() => {
  const NO = ["", "一", "二", "三", "四"];
  const svg = (d) => `<svg viewBox="0 0 16 16" aria-hidden="true">${d}</svg>`;
  const I = {
    quest: svg('<path d="M8 1.3 14.7 8 8 14.7 1.3 8z" fill="currentColor"/><path d="M8 4.6 11.4 8 8 11.4 4.6 8z" fill="rgba(58,40,3,.55)"/>'),
    look: svg('<circle cx="7" cy="7" r="4.3" fill="none" stroke="currentColor" stroke-width="1.7"/><path d="m10.3 10.3 3.6 3.6" stroke="currentColor" stroke-width="1.9" stroke-linecap="round"/>'),
    go: svg('<path d="M2.5 8h10M8.6 3.9 12.7 8l-4.1 4.1" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/>'),
    case: svg('<path d="M4.6 2.8v10.4L13 8z" fill="currentColor"/>'),
    gate: svg('<rect x="3.2" y="7" width="9.6" height="6.6" rx="1.6" fill="currentColor"/><path d="M5.3 7V5.2a2.7 2.7 0 0 1 5.4 0V7" fill="none" stroke="currentColor" stroke-width="1.6"/>'),
    award: svg('<path d="m8 1.6 1.9 3.9 4.3.6-3.1 3 .7 4.3L8 11.4l-3.8 2 .7-4.3-3.1-3 4.3-.6z" fill="currentColor"/>'),
    done: svg('<path d="m3 8.4 3.2 3.2L13 4.8" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>'),
    book: svg('<path d="M3 3.2h7.2a2 2 0 0 1 2 2v7.6H5a2 2 0 0 1-2-2z" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linejoin="round"/><path d="M5.6 6h4M5.6 8.4h4" stroke="currentColor" stroke-width="1.4" stroke-linecap="round"/>'),
    fold: svg('<path d="m4 6.2 4 4 4-4" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/>'),
  };
  let plan = null, timer = null, seq = 0, wrap = null, box = null, shownKey = "", lastFound = null, winTimer = null, reporting = false;
  const small = () => !!window.matchMedia && window.matchMedia("(max-width: 700px), (max-height: 560px)").matches;
  const caseTitle = (k) => { const g = GAMES.find((x) => x[0] === k) || []; return [(g[1] || "").split(" · ").slice(1).join(" · ") || k, (g[2] || "").split("：")[1] || k]; };
  /* The door's clue (11/28 noon, a first-time player: pressed "Clue" at the door, was taken to the corridor, and there the
     tracker spoke of the Back Office door; "nothing says the numbers are on this board", and the way back was "Skip").
     clueFor: the door the player came from with the clue button, { door, clue, say }. While the player stands at the
     clue's place the objective shown is "read the board, then back to the door"; anywhere else it is forgotten. */
  let clueFor = null;
  const clueOn = (p) => !!(clueFor && p && p.now && p.here === clueFor.clue);
  const nowOf = (p) => (clueOn(p) ? { kind: "clue", room: p.here, door: clueFor.door, say: clueFor.say || (p.tip ? { en: p.tip.en, zh: p.tip.zh } : { en: "", zh: "" }) } : p.now);
  const toClue = (door, clue, say) => { clueFor = { door, clue, say: say || null }; jump(clue); };
  const keyOf = (p) => { const n = p && p.now ? nowOf(p) : null; return n ? [p.here, n.kind, n.why || "", n.room || "", n.n || 0].join("|") : ""; };

  // ---- the words. Places carry the names the page uses everywhere (the map, the "Go to" buttons).
  // what is known about a place, as plain words on one line (11/28 review: as bordered pills they were taken for buttons,
  // and the red one, a magnifier and a number, said nothing without its tooltip)
  const tagWeak = (n) => (n ? ["is-weak", L(`${n} weakness${n === 1 ? "" : "es"} hidden there`, `那裡藏著 ${n} 個漏洞`)] : null);
  const tagFar = (h) => (h == null ? null : h === 0 ? ["", L("you are there", "你就在這裡")] : ["", L(`${h} step${h === 1 ? "" : "s"} away`, `走 ${h} 步就到`)]      /* "2 clicks away" beside Go read as "press twice" (11/28 noon) */);
  /* The tour's own name for a place (the name under its thumbnail in the tour's strip), when the page's name for it, the
     IT topic, does not carry it: "Guest Arrival & Wi-Fi" is "Lakeside Patio" there, "Resort IT Map" is "Hot-Air Balloon"
     (11/28 review, a first-time player: "The tour's strip has no place of that name. Where is it?"). A close-up's name
     says whose close-up it is already. */
  const tourName = (r) => {
    if (!r || !r.name_en || r.kind === "closeup") return null;
    const topic = (r.it_en || "").toLowerCase(), place = r.name_en.toLowerCase();
    return !topic || topic.includes(place) ? null : [r.name_en, r.name_zh || r.name_en];
  };
  const tagPlace = (r) => { const t = tourName(r); return t ? ["is-place", L(`in the tour: ${t[0]}`, `導覽裡叫「${t[1]}」`)] : null; };
  // label: a small line over the name of a place ("Next stop", then where), so a long name keeps the lines to itself
  // the things still to find in a place: sent with the objective, or read from the plan's own lines for that place
  // things still to find in stops of the story the player has already been past (not the one they are in now)
  const leftBehind = (p) => ((p && p.stops) || []).filter((x) => x.seen && x.state !== "here" && x.state !== "locked" && x.weak && x.weak.total > x.weak.found)
    .map((x) => ({ room: x.room, n: x.weak.total - x.weak.found }));
  const thingsAt = (n, p) => (n.hints && n.hints.length ? n.hints
    : [...((p && p.stops) || []), ...((p && p.side_rooms) || [])].flatMap((x) => x.tasks || []).filter((t) => t.kind === "look" && t.room === n.room && !t.found));
  function describe(n, p) {
    const r = S.byKey[n.room], en = rnEn(r) || n.room || "", z = rnZh(r) || en;
    if (n.kind === "look") {
      // 11/28 (the user: players do not know where to look or what to say): the thing to look at, said outright
      const h = (n.hints || [])[0] || {};
      return { icon: "look", label: n.n > 1 ? [`Look at (${n.n} things here)`, `看這個（這裡有 ${n.n} 個）`] : ["Look at", "看這個"], en: cap(h.en) || "What is not safe here", zh: h.zh || "這裡不安全的地方" };
    }
    if (n.kind === "case") {
      const [te, tz] = caseTitle(n.game);
      // what a case is (a first-time player, sent to one under "Security Champion 2/10": "Then it counts?")
      return { icon: "case", label: [`Case ${n.no}`, `第${NO[n.no]}案`], en: `Play ${te}`, zh: `玩「${tz}」`,
        tags: [["is-case", L("the red CASE board here", "這裡的紅色 CASE 看板"), "wide"], ["", L("optional mini-game: not one of the ten", "小遊戲，可玩可不玩，不算在 10 個裡")]] };
    }
    if (n.kind === "gate") return { icon: "gate", en: "This door needs a code", zh: "這道門要密碼", body: [n.lock.en, n.lock.zh] };
    if (n.kind === "clue") return { icon: "gate", en: "The door's code is here", zh: "門的密碼在這裡", body: [n.say.en, n.say.zh] };
    if (n.kind === "award") return { icon: "award", en: "You won Security Champion!", zh: "你拿到資安新人獎了！", tags: [["is-gate", L("fly home when you are ready", "準備好就搭熱氣球回家"), ""]] };
    if (n.kind === "done") return { icon: "done", en: "All done. Well audited.", zh: "全部完成，辛苦了。" };
    const far = [tagPlace(r), tagWeak(n.n), tagFar(n.hops)], at = { icon: "go", en, zh: z, tags: far };
    if (n.why === "closer") {
      // the thing itself, named already here, and the button that goes closer (it said "Closer look: <a close-up's name>")
      const things = thingsAt(n, p), h = things[0];
      if (h && (h.en || h.zh)) return { icon: "look", label: things.length > 1 ? [`Look at (${things.length} things there)`, `看這個（那裡有 ${things.length} 個）`] : ["Look at", "看這個"],
        en: cap(h.en || h.zh), zh: h.zh || h.en, go: ["Go closer", "走近看"], rest: things.slice(1) };
      return { ...at, label: ["Closer look", "走近看"] };
    }
    if (n.why === "case") return { ...at, label: [`Case ${n.no} is at`, `第${NO[n.no]}案在`], tags: [tagPlace(r), tagFar(n.hops)] };
    // "One is at", not "Nearest": the story's places come first, and a place where a report failed gives way to others
    if (n.why === "need") return { ...at, label: [`${n.need} more for the award. One is at`, `還差 ${n.need} 個才能領獎，可以去`] };
    // ten found, the award not collected yet: said outright (it was "Back to the story" or "Next stop")
    if (n.why === "award") return { ...at, icon: "award", label: ["You have your 10. Collect the award at", "找到 10 個了，去領獎"], tags: [tagPlace(r), tagFar(n.hops)] };
    if (n.why === "more") return { ...at, label: ["More to find at", "還有沒找到的在"] };
    if (n.why === "back") return { ...at, label: ["Back to the story", "回主線"], tags: [tagPlace(r), tagFar(n.hops)] };
    return { ...at, label: ["Next stop", "下一站"] };
  }
  const cap = (t) => (t ? t.charAt(0).toUpperCase() + t.slice(1) : "");
  // "Wi-Fi" stays in one piece (the narrow tracker broke it at the hyphen); the text itself is unchanged
  const nbw = (html) => html.replace(/Wi-Fi/g, '<span class="nb">Wi-Fi</span>');
  // how to zoom, said where there is room for it (the journal's card, a chat card): a first-time player, 11/28 noon:
  // "Zoom in" does not say how
  const zoomHow = () => (!window.matchMedia || window.matchMedia("(hover: hover) and (pointer: fine)").matches
    ? ["Zoom in with the mouse wheel", "用滑鼠滾輪放大看"] : ["Zoom in with two fingers", "用兩指放大看"]);
  // the objective in short, for where there is one line of room: English, and the Chinese under it, each cut with its own
  // ellipsis (on one line the Chinese was always the part cut off)
  const oneLine = (d) => `<span class="q-1en">${esc(d.label ? `${d.label[0]}: ${d.en}` : d.en)}</span><span class="q-1zh" lang="zh-Hant">${esc(d.label ? `${d.label[1]}：${d.zh}` : d.zh)}</span>`;

  const btn = (cls, en, zh, fn) => { const b = el("button", ("q-btn " + cls).trim(), L(en, zh)); b.type = "button"; b.addEventListener("click", () => fn(b)); return b; };
  const playLink = (game, main = true) => { const a = el("a", `q-btn${main ? " is-main" : ""}`, `${I.case}${L("Play", "開始玩")}`); a.href = `/lakeside/games/${game}`; a.target = "_self"; a.rel = "noopener"; return a; };
  const jump = (key) => { if (S.byKey[key]) goTo(key, { jump: true }); };
  /* The journal has a window of its own (11/27 night). The user, in four goes: the Journal row opened the assistant's
     window out of the blue IT Assistant button, 「我想要點下去從他自己有展開動畫」; 「如果原本小幫手是打開的，點擊任務日誌要先把
     原本的收回去，再從任務日誌打開，就是把我截圖的這個地方動畫展開出去」; 「就跟小幫手展開會消失透過動畫變大，縮小就回來這樣」;
     and 「原理是對了，但現在太不連貫了…不要小幫手收回來還要卡一下才展出任務條，動畫是可以並行的」「不管是收回還是展開動畫都可以
     併行並且連貫」.
     So the tracker does what the IT Assistant button does: pressed, it goes away into its window, which grows out of it
     (the opening's own shapes, app.js deskIn); closed, the window shrinks back into it (the motion of the assistant's
     window folding into its two buttons, with one thing to land in). And as this window is not the assistant's, the two
     move at the same time: one goes back while the other comes out, both ways, neither waiting for the other.
     (Three tries with ONE window came first: in and out of the pressed row; out of the tracker while the two buttons
     went; one after the other, which waited at the turn.) */
  let jwin = null, jMorph = null, opener = null;           // opener: what had the keyboard when the journal was opened
  function buildWin() {
    jwin = el("section", "desk jwin lg-hi is-morph");
    jwin.id = "journalWin"; jwin.hidden = true; jwin.tabIndex = -1;
    jwin.setAttribute("aria-label", "Quest journal 任務日誌");
    jwin.innerHTML = `<header class="desk-head"><div class="desk-bar">
        <div class="brand"><h1>Quest journal <span lang="zh-Hant">任務日誌</span></h1><p class="status" id="journalSub"></p></div>
        <div class="desk-win"><button type="button" class="win-btn" id="journalClose" title="Close 關閉" aria-label="Close">
          <svg viewBox="0 0 20 20" aria-hidden="true"><path d="M5 5l10 10M15 5 5 15" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/></svg></button></div></div></header>
      <div class="progress-view jwin-body"><div class="journal" id="questJournalWin"></div></div>`;
    const d = $("#desk");
    d.parentNode.insertBefore(jwin, d.nextSibling);
    $("#journalClose", jwin).addEventListener("click", () => closeJournal());
    // 11/28: on a phone-wide screen the journal covers everything, so a button in it that moves the tour changed nothing
    // the player could see ("Did that work?"): there the journal closes after such a press and the place shows
    jwin.addEventListener("click", (e) => {
      const b = e.target.closest ? e.target.closest("button.roomlink, button.q-btn") : null;
      if (b && small() && $("#questJournalWin").contains(b)) setTimeout(() => closeJournal(), 0);
    });
  }
  const journalOpen = () => !!jwin && !jwin.hidden && !jwin.classList.contains("is-closing");
  /* The window's first layout shapes all the journal's text for the first time: 40 ms, against 4 ms for every later one
     (11/28, measured: the first opening started with a long frame once every stop listed its tasks). It is laid out once
     while nothing is happening: displayed but not visible for one moment, never painted. */
  let warmed = false;
  function warm() {
    if (warmed || !jwin || !jwin.hidden || jMorph || !$("#questJournalWin").firstChild) return;
    warmed = true;
    jwin.style.visibility = "hidden";
    jwin.hidden = false;
    void jwin.offsetHeight;
    jwin.hidden = true;
    jwin.style.visibility = "";
    // the assistant's window the same way (11/28, measured: its very first opening held the page 50 to 80 ms in its click
    // and gave a frame of 50 to 100 ms; every later opening takes 8 ms and no long frame)
    const d = $("#desk");
    if (d && d.hidden && !d.classList.contains("is-closing") && !$("#layout").classList.contains("is-desk")) {
      d.style.visibility = "hidden";
      d.hidden = false;
      void d.offsetHeight;
      d.hidden = true;
      d.style.visibility = "";
    }
  }
  function runJ(anims, end, restore, kind) {     // kind: "open" or "close", so the other one can turn it round (turnJ)
    const mo = { anims, end, restore, kind };
    jMorph = mo;
    Promise.all(anims.map((x) => x.finished)).then(() => {
      if (jMorph !== mo) return;
      jMorph = null;
      mo.end();
      for (const x of mo.anims) x.cancel();
      jwin.style.transformOrigin = "";
      if (mo.restore) mo.restore();
    }).catch(() => { /* stopped by the next opening or closing */ });
  }
  /* Turned round mid-way (Esc during the opening, the Journal row during the closing): what is running plays backwards
     from where it is, and ends as the other one would (11/28 code review F8: it jumped to whole, then shrank; or to the
     tracker, then grew). The same promises end it: a running animation keeps its promise when it is reversed. */
  function turnJ(end) {
    const m = jMorph;
    for (const a of m.anims) { try { a.reverse(); } catch { /* nothing left to play */ } }
    m.end = end;
    m.kind = m.kind === "open" ? "close" : "open";
  }
  function stopJ() {
    const m = jMorph; jMorph = null;
    if (!m) return;
    for (const x of m.anims) x.cancel();
    jwin.style.transformOrigin = "";
    if (m.restore) m.restore();
    m.end();
  }
  function openJournal() {
    const desk = $("#desk");
    // iStaging's window has no tracker and no such window: the journal of the Progress tab there
    if (EMBED || !jwin) { if (desk.hidden) openDesk("progress", $("#dockChat")); else showTab("progress"); return; }
    if (journalOpen()) return;                               // open, or on its way out of the tracker
    if (!plan) return;                                       // nothing to show yet (the plan has not come): no empty window
    if (jMorph && jMorph.kind === "close" && !RM.matches) {  // on its way back into the tracker: it turns round where it is
      jwin.classList.remove("is-closing");
      wrap.classList.add("is-going");
      turnJ(() => { $("#layout").classList.add("is-journal"); wrap.classList.remove("is-going"); });
      setTimeout(() => { if (journalOpen()) jwin.focus({ preventScroll: true }); }, 60);
      return;
    }
    stopJ();
    fillJournal();
    // the tracker it grows out of; not on the screen (the big map is over the column): the window simply opens
    const from = box && !wrap.hidden && box.offsetParent !== null ? box : null;
    if (!desk.hidden) closeDesk();                           // at the same time the assistant's window goes back into its buttons
    jwin.classList.remove("is-closing");
    jwin.hidden = false;
    $(".jwin-body", jwin).scrollTop = 0;
    // landed: the tracker gives its place up (style.css .is-journal), and a click outside closes
    const landed = () => { $("#layout").classList.add("is-journal"); wrap.classList.remove("is-going"); };
    setTimeout(() => { if (journalOpen()) jwin.focus({ preventScroll: true }); }, 60);
    opener = document.activeElement && document.activeElement !== document.body ? document.activeElement : null;
    const small = !from || RM.matches || typeof jwin.animate !== "function" ? null : deskIn(rectOf(jwin), from);
    if (!small) {
      // no tracker on the screen to grow out of (the big map is over the column): it fades in; it used to be there in one frame
      if (!RM.matches && typeof jwin.animate === "function") runJ([jwin.animate([{ opacity: 0, transform: "translateY(10px) scale(.97)" }, { opacity: 1, transform: "none" }], { duration: 420, easing: "cubic-bezier(.2, .9, .25, 1)", fill: "both" })], landed, null, "open");
      else landed();
      return;
    }
    jwin.style.transformOrigin = "0 0";
    wrap.classList.add("is-going");                          // fading away: its buttons take no more clicks
    runJ([jwin.animate([small, DESK_WHOLE], { duration: 560, easing: "cubic-bezier(.2, .9, .25, 1)", fill: "both" }),
      jwin.animate([{ opacity: 0.4 }, { opacity: 1, offset: 0.3 }, { opacity: 1 }], { duration: 560, fill: "both" }),
      ...[box, ...wrap.querySelectorAll(".q-coach")].map((e) => e.animate([{ opacity: 1 }, { opacity: 0 }], { duration: 120, easing: "ease-out", fill: "forwards" }))], landed, null, "open");
  }
  // the keyboard after the journal: the tracker's Journal row; the tracker's title when it is folded (the row is inert
  // then); without a tracker on the screen, what opened the journal (it used to be left on the page)
  function backFocus() {
    const row = box.classList.contains("is-fold") ? $("#questFold", box) : $(".q-side", box);
    const to = row && row.offsetParent !== null ? row : opener && opener.isConnected && opener.offsetParent !== null ? opener : $("#mmClose") || $("#dockChat");
    if (to && to.offsetParent !== null) to.focus({ preventScroll: true });
    opener = null;
  }
  // true: it was open and is on its way back now
  function closeJournal() {
    if (!journalOpen()) return false;
    if (jMorph && jMorph.kind === "open" && !RM.matches) {   // still opening: it goes back the way it came, from where it is
      const had0 = document.activeElement === jwin || jwin.contains(document.activeElement);
      jwin.classList.add("is-closing");
      turnJ(() => { jwin.classList.remove("is-closing"); jwin.hidden = true; $("#layout").classList.remove("is-journal"); wrap.classList.remove("is-going"); });
      if (had0) backFocus();
      return true;
    }
    stopJ();
    $("#layout").classList.remove("is-journal");             // the tracker is back in the column, so it can be measured
    wrap.classList.remove("is-going");
    jwin.classList.add("is-closing");
    const had = document.activeElement === jwin || jwin.contains(document.activeElement);
    const landed = () => { jwin.classList.remove("is-closing"); jwin.hidden = true; };
    const A = box.offsetParent !== null ? rectOf(box) : null, D = rectOf(jwin);
    if (RM.matches || typeof jwin.animate !== "function" || !D.width || !D.height) landed();
    else if (!A || !A.width || !A.height) {
      // no tracker to shrink into: it fades out (it was gone in one frame)
      runJ([jwin.animate([{ opacity: 1, transform: "none" }, { opacity: 0, transform: "translateY(8px) scale(.97)" }], { duration: 300, easing: "cubic-bezier(.4, 0, .2, 1)", fill: "both" })], landed, null, "close");
    } else {
      // the assistant's window folding into its buttons (app.js foldIntoButtons), with one thing to land in: 0.44 s on
      // cubic-bezier(.4, 0, .2, 1); the window shrinks towards the tracker and dissolves (gone by 38%); the tracker, as
      // wide as the window at first, comes out of its top left corner (in from 8% to 34%) and shrinks into its place
      const T = 440, N = 44, move = bezier(.4, 0, .2, 1);
      const lin = (x, y, k) => x + (y - x) * k, cl = (v) => (v < 0 ? 0 : v > 1 ? 1 : v), f = (v) => v.toFixed(2);
      const kd = [], k0 = [];
      for (let i = 0; i <= N; i++) {
        const u = i / N, e = move(u), x = lin(D.left, A.left, e), y = lin(D.top, A.top, e), w = lin(D.width, A.width, e);
        kd.push({ offset: u, opacity: 1 - cl((u - 0.06) / 0.32), transform: `translate(${f(x - D.left)}px, ${f(y - D.top)}px) scale(${(w / D.width).toFixed(4)})` });
        k0.push({ offset: u, opacity: cl((u - 0.08) / 0.26), transform: `translate(${f(x - A.left)}px, ${f(y - A.top)}px) scale(${(w / A.width).toFixed(4)})` });
      }
      jwin.style.transformOrigin = "0 0";
      box.style.transformOrigin = "0 0";
      const anims = [jwin.animate(kd, { duration: T, fill: "both" }), box.animate(k0, { duration: T, fill: "both" })];
      for (const co of wrap.querySelectorAll(".q-coach")) anims.push(co.animate([{ opacity: 0 }, { opacity: 0, offset: 0.6 }, { opacity: 1 }], { duration: T, fill: "both" }));
      runJ(anims, landed, () => { box.style.transformOrigin = ""; }, "close");
    }
    // the keyboard goes back to the tracker's row; without a tracker on the screen, to what opened the journal (it was
    // left on the page)
    if (had) backFocus();
    return true;
  }
  /* The Progress tab's one row for the journal (11/28, the user: that tab repeated the journal; "what matters there feels
     like the casebook and the places asked about"). It says the objective and opens the journal's window. */
  function journalRow() {
    const b = el("button", "q-strip journal-row");
    b.type = "button"; b.id = "journalRow"; b.dataset.fk = "journal-row";
    b.title = LT("The whole route", "整條路線");
    b.addEventListener("click", () => openJournal());
    fillRow(b);
    return b;
  }
  function fillRow(b = $("#journalRow")) {
    if (!b) return;
    const p = plan && plan.now ? plan : null;
    b.innerHTML = `<i class="q-ico is-quest">${I.quest}</i><span class="q-strip-t"><b>${L("Quest journal", "任務日誌")}</b>${p ? `<span class="jr-now">${oneLine(describe(nowOf(p), p))}</span>` : ""}</span>`
      + (p ? `<em class="q-count">${p.champion ? `${p.found}<small>/${p.total}</small>` : `${p.found}<small>/${p.goal}</small>`}</em>` : "") + `<i class="q-ico">${I.go}</i>`;
  }
  // a report or a question goes to the assistant: its own window, out of its own button (openDesk sends the journal's
  // window back into the tracker at the same time). Open already: its Chat tab.
  function openChat() {
    const d = $("#desk");
    if (d.hidden || d.classList.contains("is-closing")) { openDesk("chat", $("#dockChat")); return; }
    if ($("#pane-chat").hidden) showTab("chat");
    setTimeout(() => $("#askInput").focus({ preventScroll: true }), 60);
  }

  /* One objective with its buttons: the tracker's (narrow), the journal's and the chat card's (wide). opt.frozen: a card
     in the chat keeps the objective of the moment it was written. */
  function block(p, opt = {}) {
    const n = opt.frozen ? p.now : nowOf(p), d = describe(n, p);      // a card kept in the chat keeps the objective it was written with
    const w = el("div", `q-now is-${n.kind}${d.icon === "look" && n.kind !== "look" ? " is-thing" : ""}${opt.wide ? " is-wide" : ""}`);
    w.innerHTML = `<i class="q-ico">${I[d.icon]}</i><div class="q-text">${d.label ? `<em class="q-label">${L(d.label[0], d.label[1])}</em>` : ""}<b>${nbw(esc(d.en))}</b><span lang="zh-Hant">${nbw(esc(d.zh))}</span></div>`;
    const more = el("div", "q-more"), acts = el("div", "q-acts");
    const facts = (d.tags || []).filter((t) => t && (opt.wide || t[2] !== "wide"));       // a fact marked "wide" is left out of the narrow tracker
    if (facts.length) {
      const t = el("p", "q-tags");
      for (const [cls, html] of facts) t.appendChild(el("span", ("q-fact " + cls).trim(), html));
      more.appendChild(t);
    }
    if (n.kind === "look") {
      // what to do with the thing named above. Narrow: one line. Wide (the journal, a chat card): the other things here,
      // then the two steps with the sentence to say.
      if (opt.wide) {
        for (const x of (n.hints || []).slice(1)) if (x.en || x.zh) more.appendChild(el("p", "q-rest", `${I.look}<span>${LB(`Also here: ${x.en || x.zh}.`, `這裡還有：${x.zh || x.en}。`)}</span>`));
        const z = zoomHow();
        more.appendChild(el("p", "q-say", LB(`${z[0]}, then tell the IT Assistant what you see and what is wrong with it.${n.n > 1 ? " One thing at a time." : ""}`,
          `${z[1]}，再跟小幫手說你看到什麼、哪裡不對。${n.n > 1 ? "一次說一個。" : ""}`)));
      } else more.appendChild(el("p", "q-say", n.n > 1 ? LB("Zoom in. Report one at a time.", "放大看，一次回報一個。") : LB("Zoom in. Report what is wrong.", "放大看，再回報它哪裡不對。")));     // one line each: the button under it is Report
      if (window.LAKESIDE_OFFLINE) more.appendChild(el("p", "q-note", LB("Reports need the live assistant. This is the saved copy.", "回報要等小幫手上線，這裡是離線版。")));
      else acts.appendChild(btn("is-main", opt.wide ? "Report to the IT Assistant" : "Report", opt.wide ? "回報給小幫手" : "回報", () => report()));
    }
    if (n.kind === "go") {
      // the other things in the close-up, in the wide card (as for a thing to look at here)
      if (opt.wide) for (const x of d.rest || []) if (x.en || x.zh) more.appendChild(el("p", "q-rest", `${I.look}<span>${LB(`Also there: ${x.en || x.zh}.`, `那裡還有：${x.zh || x.en}。`)}</span>`));
      // one name for it everywhere ("Go" here, "Go there" in the journal: 11/28 noon); the narrow row has no room for more
      acts.appendChild(btn("is-main", d.go ? d.go[0] : "Go", d.go ? d.go[1] : "帶我去", () => jump(n.room)));
    }
    if (n.kind === "case") acts.appendChild(playLink(n.game));
    if (n.kind === "gate") {
      // how the door opens: one short line in the narrow tracker, the whole of it in the wide ones
      const say = opt.wide || !n.short ? d.body : [n.short.en, n.short.zh];
      more.appendChild(el("p", "q-lock", LB(say[0], say[1])));
      // the gold button is the way to the code (11/28 review: it was "I am in", "the one that says press me. But I am not in")
      // it says that it goes somewhere ("Clue" took the player to the corridor: "I was taken back")
      if (n.clue) acts.appendChild(btn("is-main", "Go to the clue", "去看線索", () => toClue(n.room, n.clue, n.clue_say)));
      if (n.ask && !window.LAKESIDE_OFFLINE) acts.appendChild(btn(n.clue ? "" : "is-main", opt.wide ? "Ask the IT Assistant" : "Ask", "問小幫手", () => { openChat(); ask(zh() || S.langPref === "zh" ? n.ask.zh : n.ask.en); }));
      // the code is picked in the tour itself. http://localhost:3000 hears the tour move on and the door opens here by
      // itself; on every other address the player says so with this quiet button
      if (!tourTalks && !opt.frozen) {                       // not on a card kept in the chat: it would move the player later on
        const b = btn("is-quiet", opt.wide ? "I am through the door" : "I'm through", opt.wide ? "我已經過了這道門" : "我過去了", () => { if (S.byKey[n.through]) setHere(n.through); });
        b.title = LT("Press this once the door has let you in", "門讓你進去以後再按");
        acts.appendChild(b);
      }
    }
    if (n.kind === "clue") {
      // at the clue's place: what to read, and the way back to the door the player came from
      more.appendChild(el("p", "q-lock", LB(d.body[0], d.body[1])));
      acts.appendChild(btn("is-main", "Back to the door", "回門口", () => { const to = n.door; clueFor = null; if (S.byKey[to]) jump(to); else paint(); }));
    }
    if (n.kind !== "clue" && p.skip && S.byKey[p.skip.room]) {
      // back: to the story; next: the next stop; anything else (more, case): simply somewhere else that still has something
      const r = S.byKey[p.skip.room], back = p.skip.why === "back", next = p.skip.why === "next", award = p.skip.why === "award";
      const to = back ? ["Back to the story", "回主線"] : next ? ["Skip to the next stop", "先去下一站"] : award ? ["Collect the award", "先去領獎"] : ["Skip to", "先去"];
      // a neighbouring close-up of this stop is named by the thing in it, as the list names it ("Skip to: Fireplace
      // Close-up · Ordering Tablet" was a name the list does not have)
      const th = p.skip.why === "closer" ? thingsAt(p.skip, p)[0] : null;
      const s = opt.wide ? (th && (th.en || th.zh) ? btn("is-quiet", `Skip to another thing in this stop: ${th.en || th.zh}`, `先看這一站的另一個：${th.zh || th.en}`, () => jump(p.skip.room))
        : btn("is-quiet", `${to[0]}: ${rnEn(r)}`, `${to[1]}：${rnZh(r)}`, () => jump(p.skip.room)))
        : btn("is-quiet", back ? "Back" : "Skip", back ? "回主線" : "先跳過", () => jump(p.skip.room));
      s.title = LT(`${back ? "Back to the story" : next ? "The next stop" : award ? "Collect the award" : "Elsewhere"}: ${rnEn(r)}`, `${back ? "回主線" : next ? "下一站" : award ? "去領獎" : "先去別的地方"}：${rnZh(r)}`);
      acts.appendChild(s);
    }
    if (acts.children.length) more.appendChild(acts);
    if (p.also && n.kind !== "clue") {
      const [te, tz] = caseTitle(p.also.game);
      // narrow: the case's number and its Play button on one row (the whole sentence took a row of its own)
      const a = el("p", "q-also", `<span>${opt.wide ? L(`Also here, a mini-game: Case ${p.also.no}, ${te}`, `這裡還有小遊戲，第${NO[p.also.no]}案：${tz}`) : L("Game", "小遊戲")}</span>`);      /* what it is ("Case 3 ▶ Play" beside the lock read as the way to open the door); "Mini-game" pushed Play to a row of its own */
      if (!opt.wide) a.title = LT(`Also here, a mini-game (optional): Case ${p.also.no}, ${te}`, `這裡還有小遊戲（可玩可不玩），第${NO[p.also.no]}案：${tz}`);
      a.appendChild(playLink(p.also.game, false));         // not gold: the objective above has the gold button
      more.appendChild(a);
    }
    // the note about a door's numbers: not in the narrow tracker while there is something to look at here (the two
    // together were 442 px tall; the journal has it, and the door itself says where the code is)
    // (11/28: nor while the thing to look at is one step closer: the corridor's tracker was 385 px tall with it. The
    // door's own text names the numbers, and its gold Clue button comes here.)
    if (p.tip && n.kind !== "clue" && (opt.wide || (n.kind !== "look" && d.icon !== "look"))) { const t = !opt.wide && p.tip.short ? p.tip.short : p.tip; more.appendChild(el("p", "q-tip", LB(t.en, t.zh))); }
    // in the journal's card: what was skipped on the way, in a sentence (a first-time player, sent on past a stop with
    // three things still to find: "nothing says I left three behind")
    const back = opt.wide && !opt.frozen ? leftBehind(p) : [];
    if (back.length) {
      const k = back.reduce((a, x) => a + x.n, 0);
      const en = back.map((x) => `${rnEn(S.byKey[x.room])} (${x.n})`).join(", "), z = back.map((x) => `${rnZh(S.byKey[x.room])}（${x.n} 個）`).join("、");
      more.appendChild(el("p", "q-back", LB(`Skipped so far: ${k} still to find, at ${en}. The list below keeps them.`, `先跳過的還有 ${k} 個沒找到：${z}。下面的清單裡都在。`)));
    }
    w.appendChild(more);
    // the Progress tab is drawn anew when a visit is counted and gives the keyboard back by data-fk (renderProgress):
    // the main button stays the main button, Skip stays Skip, whatever the new objective is
    w.querySelectorAll(".q-btn").forEach((b, i) => { b.dataset.fk = "quest:" + (b.classList.contains("is-main") ? "main" : b.classList.contains("is-quiet") ? "skip" : i); });
    return w;
  }
  /* Nothing changes its height in one frame (11/27 night: another objective made the tracker 20 px taller at once; the same
     kind of jump as the user's 「完全沒有動畫很生硬」). The page's unfolding time and curve (.q-fold). */
  const UNFOLD = { duration: 450, easing: "cubic-bezier(.2, .9, .2, 1)" };
  const still = (e) => RM.matches || typeof e.animate !== "function" || e.offsetParent === null;
  // another objective in the tracker: its body goes from the height that is seen to the new one
  // ride: a selector for the thing at the bottom of host (the Journal row). It is drawn at its new place at once, so it
  // travels there from where it was seen, on the same clock as the bottom edge (it jumped 10 to 96 px in one frame)
  function fit(host, change, ride) {
    if (still(host)) { change(); return; }
    // the layout's own sizes (offsetHeight, offsetTop): the rectangle on the screen is scaled while the journal's window
    // folds back into the tracker
    const from = host.offsetHeight;
    const r0 = ride ? host.querySelector(ride) : null, y0 = r0 ? r0.offsetTop : 0;
    for (const a of host.getAnimations()) if (a.id === "q-fit") a.cancel();
    change();
    const to = host.offsetHeight;
    if (Math.abs(to - from) < 2) return;
    const r1 = ride ? host.querySelector(ride) : null, d = r0 && r1 ? y0 - r1.offsetTop : 0;
    const clock = to < from ? FOLD : UNFOLD;                 // shrinking is folding: the page's folding time and curve
    const a = host.animate([{ height: `${from}px`, overflow: "hidden" }, { height: `${to}px`, overflow: "hidden" }], clock);
    a.id = "q-fit";
    if (r1 && Math.abs(d) >= 1) r1.animate([{ transform: `translateY(${d}px)` }, { transform: "none" }], clock);
  }
  // which button gets the keyboard after a redraw: the same kind (main, Skip) in any objective, the very same one (Clue)
  // only while the objective is the same; otherwise the main one
  const refocus = (root, fk, sameKey) => {
    const all = [...root.querySelectorAll(".q-btn")];
    return (/^quest:(main|skip)$/.test(fk) || sameKey ? all.find((b) => b.dataset.fk === fk) : null) || all.find((b) => b.classList.contains("is-main")) || all[0] || null;
  };

  // ---- "Report": the next thing typed is a report, sent straight to the judge (no guessing what was meant). The note
  //      over the ask box names the thing being looked at; the box itself shows the sentence to fill in (11/28, the
  //      user: 「也不知道回小幫手甚麼」).
  const SAY = "I see …, and the problem is …  我看到…，問題是…";
  let askWas = null;
  /* The note over the ask box unfolds and folds away (11/28, the user: 「這個點X沒有動畫效果」: the X took it away in one
     frame, and it had come with its whole height in one frame too). Its height, the gap under it, its padding, its
     hairline and its opacity go together and start from what is seen, so a report asked for again while the note folds
     turns it round mid-way. The conversation above keeps its last line in view if it showed it. */
  const NOTE_SHUT = { height: "0px", marginBottom: "0px", paddingTop: "0px", paddingBottom: "0px", borderTopWidth: "0px", borderBottomWidth: "0px", opacity: "0" };
  const FOLD = { duration: 380, easing: "cubic-bezier(.4, 0, .2, 1)" };          // the page's closing curve (the journal, the tracker going up)
  const noteNow = (n) => { const c = getComputedStyle(n);
    return { height: c.height, marginBottom: c.marginBottom, paddingTop: c.paddingTop, paddingBottom: c.paddingBottom,
      borderTopWidth: c.borderTopWidth, borderBottomWidth: c.borderBottomWidth, opacity: c.opacity }; };
  const clipped = (k) => ({ ...k, overflow: "hidden" });
  const stopNote = (n) => { for (const a of n.getAnimations()) if (a.id === "q-note") a.cancel(); };
  let noteGoing = null;                      // the note while it folds away (no id any more: a new report does not find it as the live one)
  let noteRoom = null;                       // the place the note's "You are looking at" line was written for
  // rest: the other things still to find in this view (a first-time player reported the second of two under a note that
  // named only the first, "by guessing")
  const atLine = (h, rest) => (!(h && (h.en || h.zh)) ? "" : rest && rest.length
    ? `<span class="ar-at">${LB(`${rest.length + 1} things here: ${[h, ...rest].map((x) => x.en || x.zh).join("; ")}. Report one at a time.`, `這裡有 ${rest.length + 1} 個：${[h, ...rest].map((x) => x.zh || x.en).join("、")}。一次回報一個。`)}</span>`
    : `<span class="ar-at">${LB(`You are looking at: ${h.en || h.zh}.`, `你在看：${h.zh || h.en}。`)}</span>`);
  // the player moved on with the note up: its line names what the tracker names there, or goes when there is nothing
  // to look at (11/28 code review F3: it still said "the Wi-Fi sign" in the restaurant and in the training room)
  function noteFollows(p) {
    const note = $("#askReport");
    if (!reporting || !note || !p || p.here === noteRoom) return;
    noteRoom = p.here;
    const hs = p.now && p.now.kind === "look" ? p.now.hints || [] : [], h = hs[0] || null;
    fit(note, () => { const old = $(".ar-at", note); if (old) old.remove(); const b = $("b", note); if (b && h) b.insertAdjacentHTML("afterend", atLine(h, hs.slice(1))); });
  }
  // the send button says what it does now: "Report" while a report is on, "Ask" otherwise
  const sendLabel = (on) => { const t = $("#askBtn > span"); if (t) t.innerHTML = on ? `Report <span lang="zh-Hant">回報</span>` : `Ask <span lang="zh-Hant">送出</span>`; };
  function report(thing) {       // thing: { en, zh } of the line whose Report was pressed; without it, the objective's own
    if (window.LAKESIDE_OFFLINE) return;
    reporting = true;
    openChat();
    const form = $("#askForm"), box_ = $("#askInput");
    const atEnd = threadAtEnd();                             // read before the note takes its place
    let note = $("#askReport"), from = NOTE_SHUT;
    if (!note && noteGoing && noteGoing.isConnected) {       // asked for again while it folds: the same note comes back from where it is
      note = noteGoing; note.id = "askReport"; note.classList.remove("is-going"); note.removeAttribute("aria-hidden");
    }
    noteGoing = null;
    if (note) { from = noteNow(note); stopNote(note); }
    else { note = el("div", "ask-report"); note.id = "askReport"; form.parentNode.insertBefore(note, form); }
    // the line whose Report was pressed names its one thing; the tracker's Report, everything still to find in this view
    const all = plan && plan.now && plan.now.kind === "look" ? plan.now.hints || [] : [];
    const own = thing && (thing.en || thing.zh) ? thing : null, h = own || all[0] || null;
    note.innerHTML = `<i class="q-ico">${I.look}</i><div><b>${L("Report to the IT Assistant", "回報給小幫手")}</b>
      ${atLine(h, own ? [] : all.slice(1))}
      <span>${LB("Type one sentence: what you see, and what is wrong with it.", "打一句話：你看到什麼、哪裡不對。")}</span></div>`;
    const x = el("button", "win-btn", `<svg viewBox="0 0 20 20" aria-hidden="true"><path d="M5 5l10 10M15 5 5 15" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/></svg>`);
    x.type = "button"; x.title = LT("Not a report", "不是要回報"); x.setAttribute("aria-label", "Cancel the report");
    x.addEventListener("click", () => {
      // the ask box gets the keyboard back: after a key press, and after a mouse click (the player had to click the box
      // again before typing); not after a tap, which would bring the on-screen keyboard up
      const keys = x.matches(":focus-visible") || (window.matchMedia && window.matchMedia("(hover: hover) and (pointer: fine)").matches);
      endReport();
      if (keys && box_) box_.focus({ preventScroll: true });
    });
    note.appendChild(x);
    if (box_ && askWas === null) { askWas = box_.placeholder; box_.placeholder = SAY; }
    noteRoom = plan ? plan.here : null;
    note.setAttribute("role", "status");                     // announced when it comes (it was a plain block)
    sendLabel(true);
    if (still(note)) {                                       // reduced motion, or the window is not shown: it is simply there
      if (atEnd) $("#thread").scrollTo({ top: $("#thread").scrollHeight, behavior: "instant" });
      return;
    }
    const to = noteNow(note);
    if (Math.abs(parseFloat(to.height) - parseFloat(from.height)) < 1 && parseFloat(from.opacity) > .99) return;   // already up, same size
    if (atEnd) holdThreadEnd(UNFOLD.duration);         // the conversation loses the note's height: its last line stays in view
    note.animate([clipped(from), clipped(to)], UNFOLD).id = "q-note";
  }
  function endReport() {
    reporting = false;
    const box_ = $("#askInput");
    if (box_ && askWas !== null) { box_.placeholder = askWas; askWas = null; }
    sendLabel(false);
    const n = $("#askReport");
    if (!n) return;
    n.removeAttribute("id");                                 // from now on there is no report note: a new report makes (or takes back) one
    if (still(n)) { n.remove(); return; }
    const from = noteNow(n);
    stopNote(n);
    n.classList.add("is-going"); n.setAttribute("aria-hidden", "true");
    noteGoing = n;
    const a = n.animate([clipped(from), clipped(NOTE_SHUT)], { ...FOLD, fill: "forwards" });
    a.id = "q-note";
    a.finished.then(() => { n.remove(); if (noteGoing === n) noteGoing = null; }, () => {});   // cancelled = taken back by a new report
  }
  /* After a report that missed (the card of the answer, app.js findingCard): what is still to find at this place, each
     with a hint, shown when asked for. The hint says which part of the thing to read, never what is wrong with it. It
     unfolds under its line; the button that asked for it goes. */
  function again(c) {
    const box_ = el("div", "again");
    box_.appendChild(el("h4", "", c.result === "close" ? L("Look at it again", "再看一次") : L("Still to find here", "這裡還沒找到的")));
    for (const a of c.again || []) {
      if (!a || !(a.en || a.zh)) continue;
      const row_ = el("div", "again-row");
      row_.innerHTML = `<i class="q-ico">${I.look}</i><span class="again-what">${LB(cap(a.en || a.zh), a.zh || a.en)}</span>`;
      if (a.hint && (a.hint.en || a.hint.zh)) {
        const b = btn("", "Show a hint", "給我提示", () => {
          const h = el("p", "again-hint", `<b>${L("Hint", "提示")}</b>${LB(a.hint.en || a.hint.zh, a.hint.zh || a.hint.en)}`);
          const atEnd = threadAtEnd();
          row_.appendChild(h);
          unfold(h);
          if (atEnd) holdThreadEnd(UNFOLD.duration);
          leave(b, 200);
        });
        row_.appendChild(b);
      }
      box_.appendChild(row_);
    }
    return box_;
  }
  // what the judge said: right (or already counted) ends the report; "close" or "not on the list" leaves the note up for another try
  function reported(result) {
    if (reporting && ["correct", "other_room", "already"].includes(result)) endReport();
    // the tracker ticks as soon as the card says so, not when the whole answer has been written (the server has counted
    // the weakness by then; the state itself comes with the end of the answer)
    if (["correct", "other_room"].includes(result)) refresh();
  }

  // ---- the tracker itself
  function build() {
    wrap = el("div", "quest-wrap");
    box = el("section", "quest lg-hi");
    box.id = "quest";
    box.setAttribute("aria-label", "Quest 任務");
    box.innerHTML = `<header class="q-head">
        <button type="button" class="q-title" id="questFold" aria-expanded="true" aria-controls="questBody" title="Fold or unfold 收起或展開">
          <i class="q-ico is-quest">${I.quest}</i><span class="q-name"><b>Security Champion</b><span lang="zh-Hant">資安新人獎</span></span><i class="q-chev">${I.fold}</i></button>
        <div class="q-prog"><div class="q-bar" id="questBar" role="img"></div><em class="q-count" id="questCount"></em></div>
        <p class="q-short"><span class="q-short-clip"><span class="q-short-in" id="questShort"></span></span></p></header>
      <div class="q-fold"><div class="q-body" id="questBody"><div class="q-body-in" id="questIn"></div></div></div>`;
    wrap.hidden = true;
    wrap.appendChild(box);
    const side = $("#side");
    if (side) side.appendChild(wrap);
    if (side && !EMBED) buildWin();                           // the journal's own window (not in iStaging's window: no tracker there)
    if (side && window.ResizeObserver) new ResizeObserver(() => moved()).observe(side);       // not `moved` itself: the observer's own arguments were read as force and clock
    const stored = store.get("questFold", null);
    // a small screen starts with the tracker folded. A first-time player there gets the note about how the quest works as
    // a card across the bottom of the screen, and the tracker opens when that card goes (coach, letOpen)
    setFold(stored === null ? small() : !!stored, false);
    $("#questFold", box).addEventListener("click", () => setFold(!box.classList.contains("is-fold"), true));
  }
  function setFold(on, keep) {
    box.classList.toggle("is-fold", on);
    wrap.classList.toggle("is-fold", on);
    $("#questBody", box).inert = on;                          // folded away: nothing in it takes the keyboard
    const line = $("#questShort", box).closest(".q-short"); if (line) line.setAttribute("aria-hidden", String(!on));   // the one-line form: only read out when it is what is shown
    $("#questFold", box).setAttribute("aria-expanded", String(!on));
    if (keep) store.set("questFold", on);
  }
  /* Gliding, not jumping (11/27 night, the user: 「點出小幫手之後任務條會往上，完全沒有動畫很生硬」). What is above the
     tracker in the column changes its height: the two buttons go when the assistant window opens and come back when it
     closes, the small map folds to a pill. The tracker then belongs somewhere else at once; it is shown where it was and
     glides to the new place. The place it is SEEN at counts, so a glide that is still running carries on from there.
     When the small map folds, minimap.js foldMini slides the two buttons itself and tells the tracker its clock
     (settle(o)), so the three move as one. (A glide of #dock was here for an evening: the buttons moved twice.)
     layTop: the tracker's place in the column when last measured (offsetTop: transforms do not count). */
  let layTop = null, liftTimer = null;
  const shiftOf = (e) => { try { return new DOMMatrixReadOnly(getComputedStyle(e).transform).m42 || 0; } catch { return 0; } };
  const stopGlide = (e) => { for (const a of e.getAnimations()) if (a.id === "q-glide") a.cancel(); };
  function glide(e, from, o) {    // from: where it is seen now, counted from where it now belongs
    stopGlide(e);
    if (RM.matches || Math.abs(from) < 1.5 || typeof e.animate !== "function") return;
    // o: the clock of what it moves with (the two buttons under the folding map). Without one: coming down, the two
    // buttons are flying back into the column, so their closing curve and time (foldIntoButtons); going up, the page's
    // liquid curve
    const a = e.animate([{ transform: `translateY(${from.toFixed(1)}px)` }, { transform: "translateY(0px)" }],
      o || (from < 0 ? { duration: 470, easing: "cubic-bezier(.4, 0, .2, 1)" } : { duration: 480, easing: "cubic-bezier(.2, .9, .2, 1)" }));
    a.id = "q-glide";
  }
  // when the window itself last changed size. (It was told by comparing with the size at the tracker's last move: a
  // resize that left the column alone was then noticed only at the next real move, which jumped instead of gliding.)
  let sizedAt = -1e9;
  window.addEventListener("resize", () => { sizedAt = performance.now(); });
  function moved(force, o) {
    // the window itself changed size (maximize, a turned phone): the whole page moves at once, nothing trails behind
    const sized = performance.now() - sizedAt < 300;
    if (!wrap || wrap.hidden || wrap.offsetParent === null) { layTop = null; return; }
    const top = wrap.offsetTop;
    if (layTop === null) { layTop = top; return; }
    // the tracker is where it was: going up with the opening window (the column has not changed yet), or only its own
    // height changed. force (settle, the lift's timer): the lift may have to be taken back although nothing moved.
    if (top === layTop && !sized && force !== true) return;
    clearTimeout(liftTimer);
    const from = layTop + shiftOf(wrap) - top;
    layTop = top;
    if (sized) stopGlide(wrap); else glide(wrap, from, o);
  }
  /* The assistant window grows out of one of the two buttons for half a second, and only then do the buttons leave the
     column (openDesk). The tracker goes up WITH the window, into the room the fading buttons leave, instead of after it;
     when the column changes at the end, settle() finds it already in place and only lets go. If the column never changes
     (the window was closed again halfway), drop() or the timer brings it back down. */
  function lift() {
    const dock = $("#dock");
    if (!wrap || wrap.hidden || wrap.offsetParent === null || RM.matches || !dock || dock.offsetParent === null || typeof wrap.animate !== "function") return;
    const up = dock.offsetTop - wrap.offsetTop, at = shiftOf(wrap);
    if (layTop === null) layTop = wrap.offsetTop;
    stopGlide(wrap);
    const a = wrap.animate([{ transform: `translateY(${at.toFixed(1)}px)` }, { transform: `translateY(${up.toFixed(1)}px)` }],
      { duration: 460, delay: 70, easing: "cubic-bezier(.2, .9, .25, 1)", fill: "both" });   // both: during the delay it stays where it is seen
    a.id = "q-glide";
    wrap.classList.add("is-lifted");                         // the note beside it fades as the tracker starts up (it rode up at full strength and was gone in one frame)
    clearTimeout(liftTimer);
    liftTimer = setTimeout(() => { wrap.classList.remove("is-lifted"); moved(true); }, 1500);
  }
  // the column has just changed (the assistant window has landed and the two buttons are gone, or it starts closing and
  // they are back): told at that very moment, so no frame shows the tracker where it does not belong
  // o: the time and curve of what it moves with (minimap.js foldMini: the map folding with the two buttons under it)
  function settle(o) { if (wrap) wrap.classList.remove("is-lifted"); clearTimeout(liftTimer); moved(true, o && o.duration ? { duration: o.duration, easing: o.easing || "ease" } : undefined); }

  // the first time: how a weakness gets counted at all (nothing on the page said so). A note beside the tracker, as the
  // mini-games' first-time guides are; gone with "Got it" or the first weakness found.
  // a note that has done its job fades and shrinks towards where it points from, then leaves the page (it was removed
  // in one frame: the same complaint as the report note's X)
  const away = (e) => leave(e, 260, "translateX(-6px) scale(.94)");
  // the card across the bottom of a small screen goes down, the way it came; the tracker it held folded opens
  const gone = (c) => { if (c.classList.contains("is-sheet")) leave(c, 260, "translateY(10px) scale(.97)"); else away(c); box.classList.remove("is-held"); letOpen(); };
  /* A phone, the first time (11/28, measured at 375 x 667 and 360 x 640): the card across the bottom lay over the lower
     half of the unfolded tracker, its buttons under a note that says what the box is for. The tracker is folded while
     the card is up (build: a small screen starts folded), to its title and bar only (is-held: with its one-line
     objective it still reached 19 px under the card at 360 x 640), and opens as the card goes. That opening is not
     kept as the player's choice, and a fold the player made with the chevron stays. */
  let heldFold = false;
  function letOpen() {
    if (!heldFold) return;
    heldFold = false;
    if (store.get("questFold", null) === null && box.classList.contains("is-fold")) setFold(false, false);
  }
  function coach(p) {
    const old = $(".q-coach:not(.is-going)");               // beside the tracker or, on a small screen, across the bottom of the page
    const want = p.found === 0 && !store.get("questKnown", false);
    if (!want) { if (old) gone(old); return; }
    if (old) return;
    // a bubble beside the tracker; on a phone-wide screen there is no "beside": a card across the bottom of the screen
    // (a first-time player on a phone got no note at all, and the tracker folded: "What is this game?")
    const sheet = small();
    const c = el("div", `q-coach is-new${sheet ? " is-sheet" : ""}`);
    setTimeout(() => c.classList.remove("is-new"), 1600);    // its entrance plays once (left in the style, it replayed, 0.9 s late, whenever the tracker came back)
    c.setAttribute("role", "note");
    // the card is not beside the box it talks about: it names it
    c.innerHTML = `<b>${L("How the quest works", "任務怎麼玩")}</b><ol><li>${sheet ? LB("The Security Champion box above says where to go, and there, which thing to look at. Zoom in on it.", "上面「資安新人獎」那一格會寫要去哪裡，到了再寫要看哪個東西。把它放大看。")
      : LB("This box says where to go, and there, which thing to look at. Zoom in on it.", "這一格會寫要去哪裡，到了再寫要看哪個東西。把它放大看。")}</li>
      <li>${window.LAKESIDE_OFFLINE ? LB("This saved copy shows the way. Reporting needs the live IT Assistant.", "這份離線版會帶路。回報要等小幫手上線。")
        : LB("Press “Report” and tell the IT Assistant what is wrong with it.", "按「回報」，跟小幫手說它哪裡不對。")}</li>
      <li>${LB("If you are right, it counts. 10 win the award.", "說對就算一個，10 個得獎。")}</li></ol>`;
    c.appendChild(btn("is-main", "Got it", "知道了", (b) => {
      store.set("questKnown", true);
      const had = document.activeElement === b;              // pressed with the keyboard: it goes on at the tracker's main button
      gone(c);
      if (had) { const to = box.classList.contains("is-fold") ? $("#questFold", box) : $("#questIn .q-btn.is-main", box) || $(".q-side", box); if (to) to.focus({ preventScroll: true }); }
    }));
    (sheet ? $("#layout") : wrap).appendChild(c);
    heldFold = sheet && store.get("questFold", null) === null && box.classList.contains("is-fold");
    if (sheet) box.classList.add("is-held");
    leave($(".dock-tip"));                                   // one first-visit note at a time
  }

  function paint(celebrate) {
    if (!box) build();
    const p = plan;
    if (!p || !p.now) { wrap.hidden = true; return; }
    wrap.hidden = false;
    // its slide-in plays once: the big map hides the column and shows it again, which started the slide-in anew (the
    // tracker came 0.4 s after the two buttons, which are quiet the same way)
    if (!wrap.dataset.came) { wrap.dataset.came = "1"; setTimeout(() => wrap.classList.add("is-quiet"), 1100); }
    const key = keyOf(p), over = Math.max(0, p.found - p.goal);
    $("#questCount", box).innerHTML = p.champion ? `${I.done}${p.found}<small>/${p.total}</small>` : `${p.found}<small>/${p.goal}</small>`;
    const bar = $("#questBar", box);
    bar.setAttribute("aria-label", LT(`${p.found} of ${p.goal} weaknesses for the award`, `領獎要 ${p.goal} 個漏洞，找到 ${p.found} 個`));
    bar.innerHTML = Array.from({ length: p.goal }, (_, i) => `<i class="${i < p.found ? "is-on" : ""}${celebrate && i === Math.min(p.found, p.goal) - 1 ? " is-new" : ""}"></i>`).join("") + (over ? `<b>+${over}</b>` : "");
    box.classList.toggle("is-champion", !!p.champion);
    const sub = $("#journalSub");
    if (sub) sub.innerHTML = `${L("Security Champion", "資安新人獎")} · ${p.found} / ${p.champion ? p.total : p.goal}`;
    const d = describe(nowOf(p), p);
    $("#questShort", box).innerHTML = `<i class="q-ico">${I[d.icon]}</i><span class="q-short-t">${oneLine(d)}</span>`;
    const body = $("#questIn", box);
    const swap = shownKey && shownKey !== key;
    // drawn again: a button in here that had the keyboard is gone then ("Go" pressed with Enter dropped the keyboard to
    // the page), so its like in the new objective gets it
    const act = document.activeElement, had = act && body.contains(act) ? (act.dataset && act.dataset.fk) || "side" : "";
    let now, s;
    const draw = () => {
      body.innerHTML = "";
      now = block(p);
      if (swap && !RM.matches) enter(now, 600);              // the class goes after its 0.5 s: left on, the entrance replayed whenever the tracker came back on the page
      body.appendChild(now);
      const back = leftBehind(p).reduce((a, x) => a + x.n, 0);
      s = el("button", `q-side${back ? " has-left" : ""}`, `${I.book}<span>${back ? L(`Quest journal · ${back} skipped`, `任務日誌・跳過 ${back} 個`) : L("Quest journal", "任務日誌")}</span><i class="q-ico">${I.go}</i>`);
      s.type = "button"; s.title = back ? LT(`The whole list. ${back} still to find in stops you have passed`, `整份清單。走過的站裡還有 ${back} 個沒找到`) : LT("The whole list", "整份清單");
      s.addEventListener("click", () => openJournal());       // the tracker itself opens into the journal's window
      body.appendChild(s);
    };
    if (swap && !box.classList.contains("is-fold")) fit(body, draw, ".q-side"); else draw();
    if (had) ((had === "side" ? null : refocus(now, had, !swap)) || s).focus({ preventScroll: true });
    coach(p);
    shownKey = key;
  }
  /* Inside iStaging's pop-up window the page is only the assistant: there is no column for the tracker. One slim line over
     the chat says the objective there; a tap opens the journal. */
  function strip(p) {
    if (!EMBED) return;
    let s = $("#questStrip");
    if (!p || !p.now) { if (s) s.remove(); return; }
    if (!s) {
      s = el("button", "q-strip");
      s.id = "questStrip"; s.type = "button"; s.title = LT("The whole route, in the Progress tab", "整條路線，在「進度」分頁");
      s.addEventListener("click", () => { showTab("progress"); const t = $("#tab-progress"); if (t) t.focus({ preventScroll: true }); });   // the line is on the pane that just went: the keyboard goes to its tab
      const pane = $("#pane-chat");
      pane.insertBefore(s, pane.firstChild);
      unfold(s, 300);                                        // it took its 44 px at once and pushed the chat down
    }
    s.innerHTML = `<i class="q-ico is-quest">${I.quest}</i><span class="q-strip-t">${oneLine(describe(nowOf(p), p))}</span>
      <em class="q-count">${p.champion ? `${p.found}<small>/${p.total}</small>` : `${p.found}<small>/${p.goal}</small>`}</em><i class="q-ico">${I.go}</i>`;
  }

  function show(p) {
    // the award objective is up: remembered, so the tracker does not lead back to the awards night again. Fewer than ten
    // (the progress was cleared): forgotten.
    if (p && (p.awarded || !p.champion) && store.get("questAward", false) !== !!p.awarded) store.set("questAward", !!p.awarded);
    const won = lastFound !== null && p && p.found > lastFound;
    // the door the tracker was showing has let the player through
    const opened = !won && plan && plan.now && plan.now.kind === "gate" && p && p.now && p.now.kind !== "gate" && (p.here === plan.now.through || (p.stops || []).some((x) => x.room === plan.now.room && x.gate === false));
    if (clueFor && p && p.here !== clueFor.clue && p.here !== clueFor.door) clueFor = null;
    plan = p;
    if (p) lastFound = p.found;
    const live = (won || opened) && box && !wrap.hidden && !RM.matches && wrap.offsetParent !== null;   // not while it is away in the journal's window
    // counted, but the objective stays (the weakness belongs to another place): the bar lights and the count nods; "Found"
    // is not stamped on what is still to do
    const stays = live && keyOf(p) === shownKey;
    if (live && !stays) {
      // a right report (or a door that opened): the objective that was up is ticked off for a moment, then the next one comes
      clearTimeout(winTimer);
      box.classList.add("is-win");
      if (won) {
        const bar = $("#questBar", box), n = Math.min(p.found, p.goal) - 1;
        if (bar && bar.children[n]) bar.children[n].classList.add("is-on", "is-new");
        $("#questCount", box).innerHTML = p.champion ? `${I.done}${p.found}<small>/${p.total}</small>` : `${p.found}<small>/${p.goal}</small>`;
        bump($("#questCount", box));
      }
      const cur = box.querySelector(".q-now");
      if (cur && !cur.querySelector(".q-won")) cur.appendChild(el("p", "q-won", `${I.done}<span>${won ? L("Found", "找到了") : L("Door open", "門開了")}</span>`));
      winTimer = setTimeout(() => { winTimer = null; box.classList.remove("is-win"); paint(won); fillJournal(); }, 1300);
    } else if (winTimer) {
      // a stamp is up: it stays its time (a second plan, from the tour reporting the scene or the end of the answer, cut
      // it short after half a second); the plan that just came is the one drawn when it ends
    } else {
      if (box) box.classList.remove("is-win");
      paint(stays);
      if (stays) bump($("#questCount", box));
      fillJournal();
    }
    strip(p);
    fillRow();
    noteFollows(p);
    // the Progress tab's count, at the same moment and by the same rule (it waited for the end of the answer: "1" on the
    // tracker and "0" on the tab for 43 s)
    const badge = $("#progBadge"); if (badge && p) badge.textContent = `${p.found}/${p.champion ? p.total : p.goal}`;
    if (!warmed && jwin) (window.requestIdleCallback || ((f) => setTimeout(f, 600)))(warm, { timeout: 2500 });
  }

  /* Asked again whenever the place or the progress changes (a scene change in the tour, a "Go to" button, an answer, a
     game played). One request a moment after the last change; an older answer never replaces a newer one. */
  let tries = 0;
  function refresh(again) {
    if (!S.rooms || !S.rooms.length) return;
    if (again !== true) tries = 0;
    clearTimeout(timer);
    timer = setTimeout(async () => {
      const mine = ++seq;
      let p = null;
      try {
        // awarded: the award objective has been up before (remembered here; the server keeps no word of it over a restart)
        const r = await fetch(`/api/quest?session=${encodeURIComponent(S.session)}&room=${encodeURIComponent(S.room || "")}${store.get("questAward", false) ? "&awarded=1" : ""}`);
        if (!r.ok) throw new Error(String(r.status));
        p = await r.json();
      } catch {
        if (mine !== seq) return;
        // one answer lost (the assistant restarting): what is shown stays, and it is asked again twice, a moment apart;
        // after that every 15 s while there is still no plan at all (the page opened before the assistant was ready:
        // nothing asked again, and there was no tracker until the player changed place)
        if (!plan) show(null);
        if (tries++ < 2) { clearTimeout(timer); timer = setTimeout(() => refresh(true), 2500); }
        else if (!plan && tries < 40) { clearTimeout(timer); timer = setTimeout(() => refresh(true), 15000); }
        return;
      }
      // drawn outside the try: a fault while drawing is a fault to see in the console, not a failed request to ask again
      if (mine === seq) show(p && p.now ? p : null);
    }, 120);
  }

  /* ---- the journal: what to do now, how to score, then every stop with what there is to do in it. 11/28, the user (a
     screenshot of the journal: stops with "0/3" and nothing else): 「現在進度感覺還是不夠明確，玩家會不知道該答甚麼該說甚麼，
     然後這裡面應該要有到小幫手的按鈕來回答才對，最重要的是不夠明確，也不知道要看哪，也不知道回小幫手甚麼」. */
  /* One thing to do in a stop, as one line of a checklist (11/28, the user: 「任務日誌還是有點不夠清楚」: each thing was a
     box of its own, with a sentence and a wide place plate under it): a box that is ticked when it is done, the thing,
     and on the right the one button that does it. here: the place the player is at. */
  const tick = (on, icon) => `<i class="rt-box${on ? " is-on" : ""}">${on ? I.done : icon || ""}</i>`;
  // near: the line belongs to the stop the player is in; gated: its stop has a door that is still shut
  function task(t, here, near, gated) {
    const r = S.byKey[t.room], li = el("li", `rt-task is-${t.kind}`), act = el("span", "rt-act");
    if (t.kind === "look" && t.found) {
      li.classList.add("is-ok");
      li.innerHTML = `${tick(true)}<span class="rt-what">${LB(t.name.en, t.name.zh)}</span>`;
    } else if (t.kind === "look") {
      li.innerHTML = `${tick(false)}<span class="rt-what">${LB(cap(t.en || t.zh), t.zh || t.en)}</span>`;
      // here already: the way to the IT Assistant; elsewhere: the button that takes the tour to the view the thing is in
      if (t.room === here) {
        if (!window.LAKESIDE_OFFLINE) { const b = btn("is-main", "Report", "回報", () => report({ en: t.en, zh: t.zh })); b.dataset.fk = "report:" + t.room; act.appendChild(b); }
      } else if (r) {
        // in the stop the player is in, the thing is one step closer: the tracker's own word for it ("Go there" did what
        // "Go closer" does); anywhere else, the same "Go" as everywhere
        const b = near ? btn("", "Go closer", "走近看", () => jump(t.room)) : btn("", "Go", "帶我去", () => jump(t.room));
        b.dataset.fk = "go:" + t.room; b.title = LT(`Show it in the tour: ${rnEn(r)}`, `在導覽裡打開：${rnZh(r)}`);
        act.appendChild(b);
      }
    } else if (t.kind === "case") {
      const [te, tz] = caseTitle(t.game);
      if (t.played) li.classList.add("is-ok");
      // what a case is, on its line: a first-time player asked whether cases count towards the ten, and whether the case
      // at a locked door was the way to open it
      li.innerHTML = `${tick(t.played, I.case)}<span class="rt-what">${LB(`Case ${t.no}: ${te}`, `第${NO[t.no]}案：${tz}`)}<small class="rt-kind">${
        t.played ? L("Mini-game, played.", "小遊戲，玩過了。") : LB(`A mini-game for the Casebook. Optional: not one of the ten.${gated ? " It does not open the door." : ""}`,
          `事件簿的小遊戲，可玩可不玩，不算在 10 個裡。${gated ? "跟開門無關。" : ""}`)}</small></span>`;
      const a = el("a", `q-btn${t.played ? " is-quiet" : ""}`, t.played ? L("Play again", "再玩一次") : `${I.case}${L("Play", "開始玩")}`);
      a.href = `/lakeside/games/${t.game}`; a.target = "_self"; a.rel = "noopener"; a.dataset.fk = "case:" + t.game;
      act.appendChild(a);
    } else if (t.kind === "gate") {
      if (t.open) li.classList.add("is-ok");
      // where the numbers are, and the way there (the line said which numbers, not where: "at first I could only guess")
      li.innerHTML = `${tick(t.open, I.gate)}<span class="rt-what">${t.open ? LB("The door is open.", "門開了。")
        : LB(`This door needs a code. ${t.en}${t.where ? " " + t.where.en : ""}`, `這道門要密碼。${t.zh}${t.where ? t.where.zh : ""}`)}</span>`;
      if (!t.open && t.clue && S.byKey[t.clue]) { const b = btn("", "Go to the clue", "去看線索", () => toClue(t.room, t.clue, t.clue_say)); b.dataset.fk = "clue:" + t.room; act.appendChild(b); }
    } else if (t.kind === "award") {
      // where the award is given (a first-time player: "do I have to walk to the Theater to win?")
      if (t.done) li.classList.add("is-ok");
      li.innerHTML = `${tick(t.done, I.award)}<span class="rt-what">${t.done ? LB("Security Champion: the award is yours.", "資安新人獎：你領到了。")
        : LB(`The Security Champion award is given here, once you have found ${t.goal || 10}.`, `找到 ${t.goal || 10} 個以後，資安新人獎在這裡領。`)}</span>`;
    }
    if (act.children.length) li.appendChild(act);
    return li;
  }
  // a stop: where it stands on the rail, its name (the plate that takes the tour there, as everywhere on the page), then
  // its lines. A stop behind a shut door is only its name: what is shut is said once, over the first of them (shutLine).
  function row(x, opt = {}, here = "") {
    const r = S.byKey[x.room]; if (!r) return null;
    // a tick means one thing: been there, everything to find there is found, its door open. A case never played
    // (optional) does not keep it away (11/28 review: "I cannot tell what a tick means")
    const state = opt.side ? (x.here ? "here" : x.total && x.found >= x.total ? "done" : "todo")
      : x.state === "here" || x.state === "locked" ? x.state
        : x.seen && x.weak.found >= x.weak.total && !x.gate && !(x.tasks || []).some((t) => t.kind === "award" && !t.done) ? "done" : "todo";
    const li = el("li", `rt-stop is-${state}`);
    li.dataset.room = x.room;
    li.appendChild(el("i", "rt-dot", state === "done" ? I.done : state === "locked" ? I.gate : ""));
    const main = el("div", "rt-main");
    main.appendChild(state === "locked" ? lockedStop(r) : roomLink(r));
    if (state === "here") main.appendChild(el("span", "rt-here", L("You are here", "你在這裡")));
    // what the tick means, in words (11/28 review: "I cannot tell what a tick means")
    if (state === "done") main.appendChild(el("span", "rt-done", (opt.side ? x.total : x.weak.total) ? L("all found", "都找到了") : L("nothing hidden here", "這裡沒有藏東西")));
    const tn = state === "locked" ? null : tourName(r);
    if (tn) main.appendChild(el("span", "rt-place", L(`in the tour: ${tn[0]}`, `導覽裡叫「${tn[1]}」`)));
    const ts = x.tasks || [];
    const gated = ts.some((t) => t.kind === "gate" && !t.open);
    if (ts.length) { const ul = el("ul", "rt-tasks"); for (const t of ts) ul.appendChild(task(t, here, state === "here", gated)); main.appendChild(ul); }
    li.appendChild(main);
    return li;
  }
  // over the first stop behind a shut door: how many stops are behind it, and how many of the weaknesses
  function shutLine(run) {
    const n = run.reduce((a, x) => a + ((x.weak && x.weak.total) || 0), 0), k = run.length;
    const li = el("li", "rt-shutline");
    li.innerHTML = `<i class="rt-ico">${I.gate}</i><span>${LB(
      `Behind the door above: ${k} more stop${k === 1 ? "" : "s"}${n ? `, with ${n} of the weaknesses` : ""}. What to find there shows once that door is open.`,
      `上面那道門後面還有 ${k} 站${n ? `，藏著 ${n} 個漏洞` : ""}。門開了才會列出要找什麼。`)}</span>`;
    return li;
  }
  // the journal is drawn in two places: the Progress tab of the assistant (#questJournal) and the journal's own window
  function fillJournal() { for (const host of document.querySelectorAll("#questJournal, #questJournalWin")) fillOne(host); }
  function fillOne(host) {
    // the plan that is drawn here already: nothing to do (it was drawn again on every refresh; a stop of the route that
    // had the keyboard lost it and the opened how-to closed)
    const sig = plan ? JSON.stringify(plan) : "";
    if (host._sig === sig) return;
    host._sig = sig;
    // drawn again whenever the plan changes: a button in here that had the keyboard is gone then, so the keyboard goes to
    // the new objective's main button (pressing "Go there" in the journal used to drop it to the page)
    const act = document.activeElement, inside = !!act && host.contains(act);
    // 11/28 (ui review F6: drawn again in one frame, the list jumped 40 to 80 px under the pointer): the stop a button was
    // pressed in keeps its place on the screen; a change made from the objective card glides the card's height instead
    const scroller = host.closest(".jwin-body, .progress-view"), shown = host.offsetParent !== null;
    const aStop = inside && act.closest ? act.closest(".rt-stop") : null, aRoom = aStop ? aStop.dataset.room : "", aTop = aStop ? aStop.getBoundingClientRect().top : 0;
    const aLine = aStop && act.closest(".rt-task") ? [...aStop.querySelectorAll(".rt-task")].indexOf(act.closest(".rt-task")) : -1;      // which line of that stop had the keyboard
    const oldCard = shown ? host.querySelector(".q-now.is-wide") : null, oldH = oldCard ? oldCard.getBoundingClientRect().height : 0;
    const had = inside && act.closest(".q-now") ? (act.dataset && act.dataset.fk) || "quest:main" : "";
    // a stop of the route (a place link, data-fk) gets the keyboard back by its place and which of the same it was
    const fk = inside && !had && act.dataset ? act.dataset.fk || "" : "";
    const nth = fk ? [...host.querySelectorAll("[data-fk]")].filter((x) => x.dataset.fk === fk).indexOf(act) : -1;
    const was = host.dataset.key || "";
    host.innerHTML = "";
    const p = plan;
    host.dataset.key = keyOf(p);
    if (!p || !p.now) return;
    const off = !!window.LAKESIDE_OFFLINE;
    // 1. the goal in one sentence, how far it is (the tracker's ten pips), and how a find is made, in three short steps
    const goal = el("section", "q-goal"), over = Math.max(0, p.found - p.goal);
    goal.innerHTML = `<p class="q-goal-t">${p.champion && p.awarded
      ? LB(`You won Security Champion: ${p.found} of the ${p.total} weaknesses found. The rest is optional.`, `你拿到資安新人獎了：${p.total} 個資安漏洞找到 ${p.found} 個。剩下的可做可不做。`)
      : p.champion ? LB(`${p.found} found: enough for Security Champion. The award waits at the awards night in the Lake Pavilion Theater.`, `找到 ${p.found} 個，夠拿資安新人獎了。獎在湖心館劇場的頒獎晚會等你。`)
      : LB(`Find ${p.goal} of the resort's ${p.total} security weaknesses to win Security Champion.`, `渡假村藏著 ${p.total} 個資安漏洞，找到 ${p.goal} 個就拿到資安新人獎。`)}</p>
      <div class="q-prog"><div class="q-bar" role="img" aria-label="${esc(LT(`${p.found} of ${p.goal} found`, `找到 ${p.found} / ${p.goal}`))}">${
        Array.from({ length: p.goal }, (_, i) => `<i class="${i < p.found ? "is-on" : ""}"></i>`).join("")}${over ? `<b>+${over}</b>` : ""}</div>
        <em class="q-count">${p.found}<small>/${p.goal}</small></em><span class="q-goal-n">${p.found < p.goal ? L(`found · ${p.goal - p.found} to go`, `找到・還差 ${p.goal - p.found} 個`) : L("found", "找到")}</span></div>
      <ol class="q-how" aria-label="${esc(LT("How to score", "怎麼得分"))}">
        <li>${LB("Go closer and zoom in on the thing", "走近、放大看那個東西")}</li>
        <li>${off ? LB("Telling it needs the live IT Assistant", "要等小幫手上線才能回報") : LB("Tell the IT Assistant what is wrong", "跟小幫手說哪裡不對")}</li>
        <li>${LB("If you are right, it counts as one", "說對就算一個")}</li></ol>`;
    host.appendChild(goal);
    // 2. the one thing to do now
    host.appendChild(el("h2", "", `What to do now <span lang="zh-Hant">現在要做的事</span>`));
    const cur = block(p, { wide: true });
    host.appendChild(cur);
    if (had) { const to = refocus(cur, had, was === host.dataset.key); if (to) to.focus({ preventScroll: true }); }
    // 4. the main quest as a checklist: every stop, every thing in it, ticked when it is done
    // a list's own count, in words: "2 / 10" here stood under the window's "3 / 10" (one found outside this list)
    const head = (en, zh, f, t) => el("h2", "q-sec", `${en} <span lang="zh-Hant">${zh}</span><em>${L(`${f} of ${t} found`, `${t} 個找到 ${f} 個`)}</em>`);      /* "10 here · 0 found" read as "ten where I stand" (11/28 noon) */
    host.appendChild(head("Main quest", "主線", p.main.found, p.main.total));
    host.appendChild(el("p", "note", LB("The story, stop by stop. Its ten are enough for the award.", "照故事一站一站走，這 10 個找齊就夠領獎。")));
    const ol = el("ol", "route"), stops = p.stops || [];
    stops.forEach((x, i) => {
      if (x.state === "locked" && (i === 0 || stops[i - 1].state !== "locked")) { let j = i; while (j < stops.length && stops[j].state === "locked") j++; ol.appendChild(shutLine(stops.slice(i, j))); }
      const li = row(x, {}, p.here); if (li) ol.appendChild(li);
    });
    host.appendChild(ol);
    // 5. the side quest, the same way
    if ((p.side_rooms || []).length) {
      host.appendChild(head("Side quest", "支線", p.side.found, p.side.total));
      host.appendChild(el("p", "note", LB("Optional: the second tour, across the lake. What you find there counts towards the ten as well.", "可做可不做：湖另一邊的第二個導覽。那裡找到的也算進那 10 個。")));
      const ul = el("ul", "route is-side");
      for (const x of p.side_rooms) { const li = row(x, { side: true }, p.here); if (li) ul.appendChild(li); }
      host.appendChild(ul);
    }
    if (fk) { const same = [...host.querySelectorAll("[data-fk]")].filter((x) => x.dataset.fk === fk), to = same[nth] || same[0]; if (to) to.focus({ preventScroll: true }); }
    const sameStop = aRoom && scroller ? host.querySelector(`.rt-stop[data-room="${aRoom}"]`) : null;
    // the button that was pressed has another name now ("Go there" became "Report"): the keyboard goes to the button of the
    // same line, or to the stop's own name (it fell to the page)
    if (sameStop && inside && !host.contains(document.activeElement)) {
      const line = aLine >= 0 ? sameStop.querySelectorAll(".rt-task")[aLine] : null, to = (line && line.querySelector(".rt-act .q-btn")) || sameStop.querySelector(".roomlink:not(.is-locked)");
      if (to) to.focus({ preventScroll: true });
    }
    if (sameStop) scroller.scrollTop += sameStop.getBoundingClientRect().top - aTop;
    else if (oldH && !still(cur)) {
      const h = cur.getBoundingClientRect().height;
      if (Math.abs(h - oldH) >= 2) cur.animate([{ height: `${oldH.toFixed(1)}px`, overflow: "hidden" }, { height: `${h.toFixed(1)}px`, overflow: "hidden" }], UNFOLD);
    }
  }

  return { refresh, block, again, report, reported, endReport, fillJournal, journalRow, lift, settle, openJournal, closeJournal, reporting: () => reporting, plan: () => plan };
})();

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
    // 11/27: the graph map above the two tables; if it cannot be drawn the tables are still there
    try { drawSchema(box, s); } catch (e) { console.error("graph map:", e); }
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
  const RIPPLE = ".dock-btn, .mm-mini, .mm-pill, .mm-hide, .mm-x, .mm-zoom button, .win-btn, .seg button, .tabs [role=tab], .chip:not(.is-plain), .roomlink, .plate, " +
    "details.trace summary, .ask button, .task, .paste button, .case-play, .btn-plain, .gnode, .q-btn, .q-title";
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
    // 11/26 (front-end review K07): straight from a tilted button into the tour or a game (another page's frame) this page
    // hears no more moves and html no pointerleave, so the tilt stayed; going into a frame or out of the window ends it
    document.addEventListener("pointerout", (e) => {
      const to = e.relatedTarget;
      if (!to || to.tagName === "IFRAME") { last = null; untilt(); }
    }, { passive: true });
  }
  // the release wobbles the glass back like jelly (added on top of its own transform, so a tilt or a CSS entrance keeps going)
  const JELLY = ".dock-btn, .mm-pill, .win-btn, .chip:not(.is-plain), .roomlink, .plate, .ask button, .case-play, .paste button, .btn-plain, .seg button, " +
    ".tabs [role=tab], .mm-zoom button, .mm-x, details.trace summary, .gnode, .q-btn";
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
