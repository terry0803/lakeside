/* Inbox Rush 收件匣大作戰, third version (11/21 afternoon): case file 1 of the Awards Night casebook. Two parts.
   The shift, 16:00 to 19:00 at the cashier laptop in the restaurant: emails land on their own clock and several can burn
   at once. Drag one to the left to report it or to the right to keep it, or open it and look closer. Three calls, one
   hint, three shields; at 18:52 someone calls in a colleague's name.
   The case board, 21:00 at the lighthouse SOC: look up the senders' domains, check the invoice and read the fake pages'
   log to work out who sent tonight's emails and which accounts they now hold.
   The verdicts are unchanged: the server runs the IT Assistant's own email-check rules on each email and adds up the
   PhishingSign weights from the knowledge graph (3 or more = phishing). games.yaml → story holds the plot, the clue data
   and the puzzle answers (the tests check that each answer follows from the clues); the real cases at the end and the
   procedures come from the knowledge graph too. */
"use strict";

Games.phish = function (d, main, replay) {
  const signs = Object.fromEntries(d.signs.map((s) => [s.key, s]));
  const story = d.story || {};
  const mentor = story.mentor || { name: "Mei-Ling Chen", name_zh: "陳美玲", role_en: "IT Help Desk", role_zh: "資訊服務台" };
  const lines = story.lines || {};
  const contacts = story.contacts || [];
  const sh = Object.assign({ rate: 1.6, idle: 9, fuse: [], calls: 3, hints: 1, shields: 3 }, story.shift || {});
  const CALL = story.call || null;
  const BOARD = story.board || {};
  const QS = BOARD.questions || [];
  const P = { tell: 25, right: 100, speed: 2, streak: 20, miss: 5, missCap: 3, verify: 30, falseAlarm: 60, callRight: 150, callDeclined: 60, q: 200, qWrong: 40, qMin: 80 };
  const IMG = "/lakeside/static/games/img/scenes/";
  const TOTAL = d.emails.length + (CALL ? 1 : 0) + QS.length;
  const mins = (t) => { const m = /^(\d+):(\d+)/.exec(t || ""); return m ? +m[1] * 60 + +m[2] : 0; };
  const T0 = mins(story.start || "16:00"), TEND = mins(story.dinner || "19:00") - T0;
  const hhmm = (m) => { const t = Math.floor(T0 + m); return `${Math.floor(t / 60)}:${String(t % 60).padStart(2, "0")}`; };
  const money = (n) => "NT$ " + n.toLocaleString("en-US");
  const fill = (s, map) => String(s || "").replace(/\{(\w+)\}/g, (_, k) => (k in map ? map[k] : ""));
  const domainOf = (addr) => addr.split("@").pop().toLowerCase();
  const plainSubj = (e) => e.subject.replace(/^\[EXTERNAL\]\s*/, "");
  // 11/22: every English line has its Chinese next to it: the subject's Chinese (games.yaml subject_zh), and "ext. 2100" as 分機 2100
  const subjZh = (e, tag) => (e.subject_zh ? `${tag && e.external ? "[外部] " : ""}${e.subject_zh}` : "");
  const extZh = (n) => String(n || "").replace(/^ext\.\s*/, "分機 ");
  const numBi = (n) => (/^ext\./.test(n || "") ? bi(n, extZh(n)) : esc(n));
  const avatarColors = ["#0e4a55", "#7f6128", "#2f6f8f", "#6b3b7a", "#46703f", "#8e4566"];
  const waves = (story.waves || []).map((w) => Object.assign({}, w, { at: mins(w.at) - T0 }));
  const byId = {};
  d.emails.forEach((e, i) => { e.i = i; e.at = mins(e.time) - T0; byId[e.id] = e; });
  const totalTells = d.emails.reduce((n, e) => n + e.signs.length, 0);
  let S = null, B = null, said = 0;
  const pick = (list) => (list && list.length ? list[said++ % list.length] : null);
  const line = (list) => { const l = pick(list); return l ? bi(l.en, l.zh) : ""; };
  // 11/23 review: a colleague who opened it lost their own account, so every later mention says so (not "your mailbox"):
  // the cut scene, the result card when the email is opened again, the lists after three slips and on the results page
  const damageOf = (e) => Object.assign({}, e.damage || {}, S && S.how[e.id] === "opened" && e.damage_opened ? e.damage_opened : {});

  main.classList.add("is-stage");
  main.innerHTML = `<div class="rs" id="rs"><div class="rs-bg" id="rsBg"></div><div class="rs-dusk" id="rsDusk"></div>
    <div class="rs-body" id="rsBody"></div><div class="rs-cut" id="rsCut" hidden></div><div class="rs-toast" id="rsToast" hidden></div></div>`;
  const $rs = $("#rs");
  G.watchFit();
  const setScene = (name, dusk) => {
    $("#rsBg").style.backgroundImage = `url(${IMG}${name}.jpg)`;
    $("#rsDusk").style.opacity = String(dusk || 0);
  };
  const stage = { scene: setScene, $rs, body: $("#rsBody") };     // enough of a casebook stage for the title card and the time skip
  const meter = $("#meter");
  if (!meter.dataset.bound) {      // one listener for the header, whichever round is playing
    meter.dataset.bound = "1";
    meter.addEventListener("click", (ev) => { if (ev.target.closest("[data-pause]") && G.onPause) G.onPause(); });
  }
  G.onPause = () => togglePause();
  window.onresize = () => { if (B) drawStrings(); };

  /* ------------------------------------------------------------------ icons and people */
  const ICON = {
    flag: `<svg viewBox="0 0 20 20" aria-hidden="true"><path d="M4 17V3.5h9l-1.6 3.2L13 10H4" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linejoin="round"/></svg>`,
    keep: `<svg viewBox="0 0 20 20" aria-hidden="true"><path d="M3 6.5 10 11l7-4.5M3.5 5h13v10h-13z" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linejoin="round"/></svg>`,
    phone: `<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M6.6 3.5 9.4 7l-1.8 2.3a12 12 0 0 0 7.1 7.1L17 14.6l3.5 2.8-1.6 3.1c-.4.7-1.2 1.1-2 1C9.4 20.6 3.4 14.6 2.5 7.1c-.1-.8.3-1.6 1-2z" fill="currentColor"/></svg>`,
    pause: `<svg viewBox="0 0 16 16" aria-hidden="true"><path d="M4.5 3h2.4v10H4.5zM9.1 3h2.4v10H9.1z" fill="currentColor"/></svg>`,
    play: `<svg viewBox="0 0 16 16" aria-hidden="true"><path d="M5 3l8 5-8 5z" fill="currentColor"/></svg>`,
    shield: (on) => `<svg viewBox="0 0 24 26" class="${on ? "is-on" : "is-off"}" aria-hidden="true"><path d="M12 1.5 21 5v7.2c0 6-4 10.4-9 12.3C7 22.6 3 18.2 3 12.2V5z" fill="${on ? "currentColor" : "none"}" stroke="currentColor" stroke-width="1.8" stroke-linejoin="round"/>${on ? `<path d="M8 12.6l3 3 5.4-6" fill="none" stroke="#fff" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"/>` : `<path d="M9 9l6 7M15 9l-6 7" stroke="currentColor" stroke-width="1.6" stroke-linecap="round"/>`}</svg>`,
    mail: `<svg viewBox="0 0 64 48" aria-hidden="true"><rect x="3" y="5" width="58" height="38" rx="5" fill="none" stroke="currentColor" stroke-width="2.4"/><path d="M5 8l27 20L59 8" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linejoin="round"/></svg>`,
  };

  function initials(name) {
    const w = name.replace(/[^A-Za-z ]/g, " ").split(/\s+/).filter(Boolean);
    return ((w[0] || "?")[0] + (w[1] ? w[1][0] : "")).toUpperCase();
  }

  function portrait(cls) {   // Mei-Ling Chen, IT Help Desk: flat bust in the resort's colours
    return `<svg class="rs-portrait ${cls || ""}" viewBox="0 0 96 96" aria-hidden="true">
      <circle cx="48" cy="48" r="48" fill="#d8bd77"/>
      <path d="M14 96c2-18 16-28 34-28s32 10 34 28z" fill="#0e4a55"/>
      <path d="M40 66l8 10 8-10" fill="none" stroke="#e2eeec" stroke-width="3"/>
      <rect x="52" y="78" width="12" height="9" rx="1.5" fill="#fff"/><path d="M48 70v9" stroke="#b08a3e" stroke-width="2"/>
      <rect x="42" y="54" width="12" height="13" rx="5" fill="#e9c4a5"/>
      <path d="M26 40c0-15 10-24 22-24s22 9 22 24c0 6-2 11-4 15H30c-2-4-4-9-4-15z" fill="#2b2421"/>
      <ellipse cx="48" cy="42" rx="15" ry="17" fill="#f1d2b6"/>
      <path d="M33 36c4-9 10-12 16-12 7 0 12 4 15 12-6-3-11-7-15-7-5 0-10 4-16 7z" fill="#2b2421"/>
      <circle cx="42" cy="43" r="4.6" fill="none" stroke="#1f2a2e" stroke-width="1.6"/><circle cx="54" cy="43" r="4.6" fill="none" stroke="#1f2a2e" stroke-width="1.6"/>
      <path d="M46.6 43h2.8" stroke="#1f2a2e" stroke-width="1.6"/><circle cx="42" cy="43.5" r="1.3" fill="#1f2a2e"/><circle cx="54" cy="43.5" r="1.3" fill="#1f2a2e"/>
      <path d="M44 52c2.5 2 5.5 2 8 0" fill="none" stroke="#a5523c" stroke-width="1.6" stroke-linecap="round"/></svg>`;
  }

  function analystPortrait() {   // Jun-Hao Lin, SOC analyst: hoodie, lanyard, headset
    return `<svg class="rs-portrait cb-portrait" viewBox="0 0 96 96" aria-hidden="true">
      <circle cx="48" cy="48" r="48" fill="#9cc2c8"/>
      <path d="M12 96c2-19 17-29 36-29s34 10 36 29z" fill="#243447"/>
      <path d="M33 68c5 7 25 7 30 0" fill="none" stroke="#33465c" stroke-width="6" stroke-linecap="round"/>
      <path d="M45 71l-3 17M51 71l3 17" stroke="#b08a3e" stroke-width="2"/><rect x="44" y="84" width="13" height="10" rx="1.5" fill="#fff"/>
      <rect x="42" y="54" width="12" height="13" rx="5" fill="#dcae86"/>
      <ellipse cx="48" cy="42" rx="15" ry="17" fill="#e8bf98"/>
      <path d="M32 40c-1-13 7-21 17-21 9 0 16 6 16 18-4-5-9-8-16-8-8 0-13 4-17 11z" fill="#1d1a19"/>
      <path d="M38 39.5c2-1.4 4.4-1.4 6 0M52 39.5c1.6-1.4 4-1.4 6 0" fill="none" stroke="#1d1a19" stroke-width="1.6" stroke-linecap="round"/>
      <circle cx="42" cy="44" r="1.6" fill="#1f2a2e"/><circle cx="54" cy="44" r="1.6" fill="#1f2a2e"/>
      <path d="M44 52.5c2.4 1.6 5.6 1.6 8 0" fill="none" stroke="#9b4c36" stroke-width="1.6" stroke-linecap="round"/>
      <path d="M31 43a17 18 0 0 1 34 0" fill="none" stroke="#2b2f33" stroke-width="3"/>
      <rect x="27.5" y="39" width="6.5" height="12" rx="3" fill="#2b2f33"/><rect x="62" y="39" width="6.5" height="12" rx="3" fill="#2b2f33"/>
      <path d="M31 50c1 7 5 10 11 10" fill="none" stroke="#2b2f33" stroke-width="2"/><circle cx="43" cy="60" r="2.2" fill="#2b2f33"/></svg>`;
  }

  function mentorHTML(text, big) {
    return `<div class="rs-mentor${big ? " is-big" : ""}">${portrait()}
      <div class="rs-mentor-text"><p class="rx-mentor-name">${esc(mentor.name)} · ${esc(mentor.role_en)} <span lang="zh-Hant">${esc(mentor.role_zh)} ${esc(mentor.name_zh)}</span></p>
      <p class="rx-say rs-say" aria-live="polite">${text}</p></div></div>`;
  }

  function say(html) {
    const b = $(".rs-say");
    if (!b || !html) return;
    b.innerHTML = html;
    b.classList.remove("is-bump"); void b.offsetWidth; b.classList.add("is-bump");
  }

  /* ------------------------------------------------------------------ the briefing */
  function brief() {
    stopLoop();
    setScene("rush_day", 0);
    G.meter("");
    // 11/22: the rule tiles with their icons, the same as CB.brief draws them for the other chapters
    const tiles = (story.rules || []).every((r) => r.icon);
    const rules = (story.rules || []).map((r) => (tiles ? `<li><span class="cb-rule-ic">${CB.RULE[r.icon] || ""}</span><p>${bi(r.en, r.zh)}</p></li>` : `<li>${bi(r.en, r.zh)}</li>`)).join("");
    $("#rsBody").innerHTML = `<section class="rs-brief has-rules">
      <div class="rs-brief-clock" aria-hidden="true"><span>Awards Night <i lang="zh-Hant">頒獎晚會</i></span>
        <b>${esc(story.start || "16:00")}</b><span>Dinner ${esc(story.dinner || "19:00")} <i lang="zh-Hant">開飯</i></span>
        <span class="rs-brief-file">Case file 1 <i lang="zh-Hant">事件簿第一案</i></span></div>
      <div class="rs-brief-main">${mentorHTML(bi(story.intro_en || "", story.intro_zh || ""), true)}
        <p class="rs-brief-after">${bi("After dinner, the SOC will need your notes to work out who sent all this.", "晚宴後，資安監控中心要用你的線索找出這些信是誰寄的。")}</p>
        <button type="button" class="btn rs-start">${bi("Start my shift", "開始值班")}</button></div>
      <div class="rs-brief-rules"><p class="rs-brief-rules-h">${bi("How to play", "怎麼玩")}</p><ol class="${tiles ? "cb-rules" : "rx-rules"}">${rules}</ol></div></section>`;
    $(".rs-start").addEventListener("click", startShift);
  }

  /* ------------------------------------------------------------------ an email on the laptop screen */
  function qr(seed) {   // decorative only: finder squares and a seeded pattern, not a real code
    let x = seed * 9301 + 49297, cells = "";
    const rnd = () => ((x = (x * 9301 + 49297) % 233280) / 233280);
    const finder = (cx, cy) => `<rect x="${cx}" y="${cy}" width="7" height="7" fill="#111"/><rect x="${cx + 1}" y="${cy + 1}" width="5" height="5" fill="#fff"/><rect x="${cx + 2}" y="${cy + 2}" width="3" height="3" fill="#111"/>`;
    for (let r = 0; r < 25; r++) for (let c = 0; c < 25; c++) {
      if ((r < 8 && c < 8) || (r < 8 && c > 16) || (r > 16 && c < 8)) continue;
      if (rnd() < 0.47) cells += `<rect x="${c}" y="${r}" width="1" height="1" fill="#111"/>`;
    }
    return `<svg class="mail-qr" viewBox="-2 -2 29 29" role="img" aria-label="QR code"><rect x="-2" y="-2" width="29" height="29" fill="#fff"/>${cells}${finder(0, 0)}${finder(18, 0)}${finder(0, 18)}</svg>`;
  }

  function body(text, seed) {
    return text.split(/\n{2,}/).map((p) => {
      if (p.trim() === "[[QR]]") return qr(seed);
      const html = esc(p).replace(/\[\[([^\]|]+)\|([^\]]+)\]\]/g, (_, t, u) => `<a href="#" class="mail-link" data-url="${u}">${t}</a>`).replace(/\n/g, "<br>");
      return `<p>${html}</p>`;
    }).join("");
  }

  function preview(e) {   // the grey line under the subject in the inbox, like any mail client
    const paras = e.body.replace(/\[\[QR\]\]/g, "").replace(/\[\[([^\]|]+)\|[^\]]+\]\]/g, "$1").split(/\n{2,}/).map((p) => p.replace(/\s+/g, " ").trim());
    const p = paras.find((x) => x.length > 24) || paras[0] || "";
    return p.length > 96 ? p.slice(0, 94).replace(/\s+\S*$/, "") + "…" : p;
  }

  function mailHTML(e) {
    const col = avatarColors[(e.from_addr.length + e.i) % avatarColors.length];
    const att = e.attachments.map((a) => `<span class="mail-file"><svg viewBox="0 0 16 16" aria-hidden="true"><path d="M4 1.5h5l3 3v10H4z M9 1.5v3h3" fill="none" stroke="currentColor" stroke-width="1.2"/></svg><span>${esc(a)}</span></span>`).join("");
    return `<article class="mail">
      ${e.external ? `<div class="mail-ext">${bi("This message came from outside Lakeside Resort.", "這封信來自渡假村外部。")}</div>` : ""}
      <h2 class="mail-subj">${esc(e.subject)}</h2>${e.subject_zh ? `<p class="mail-subj-zh" lang="zh-Hant">${esc(subjZh(e, true))}</p>` : ""}
      <div class="mail-head">
        <span class="mail-avatar" style="background:${col}" aria-hidden="true">${esc(initials(e.from_name))}</span>
        <div class="mail-who"><p class="mail-from"><b>${esc(e.from_name)}</b> <span class="mail-addr">&lt;${esc(e.from_addr)}&gt;</span></p>
          <p class="mail-to">${bi("To", "收件者")}: ${esc(e.to)}</p></div>
        <time class="mail-time">${esc(e.time)}</time>
      </div>
      <div class="mail-body">${body(e.body, e.i + 3)}</div>
      ${att ? `<div class="mail-att">${att}</div>` : ""}
      <div class="mail-url" aria-hidden="true"></div>
    </article>
    ${e.gist_zh ? `<p class="mail-gist" lang="zh-Hant"><b>中文大意</b>${esc(e.gist_zh)}</p>` : ""}`;
  }

  /* The tells: the words the server found for each warning sign. A link counts by its real address, an attachment by
     its file chip, the QR sign by the picture too. They look like plain text until you click them. */
  function wrapTells(art, e) {
    e.signs.forEach((s, k) => {
      const tag = (node) => { node.classList.add("tell"); node.dataset.k = s.key; node.dataset.n = String(k + 1); };
      // 11/21 night (review): every place the sign shows up counts, not only the first one the rules found
      for (const ev of [s.evidence, ...(s.more || [])].map((x) => x.toLowerCase())) {
        const links = $$(".mail-link", art).filter((a) => !a.dataset.k && (a.dataset.url.toLowerCase() === ev || a.dataset.url.toLowerCase().includes(ev)));
        const files = $$(".mail-file", art).filter((f) => !f.dataset.k && f.textContent.toLowerCase().includes(ev));
        links.forEach(tag); files.forEach(tag);
        if (links.length || files.length) continue;
        if (s.key === "ps_qr") { const q = $(".mail-qr", art); if (q && !q.dataset.k) tag(q); }
        for (const sc of $$(".mail-subj, .mail-from, .mail-body", art)) {
          for (let again = true; again;) {
            again = false;
            const walker = document.createTreeWalker(sc, NodeFilter.SHOW_TEXT, { acceptNode: (t) => (t.parentElement.closest(".tell") ? NodeFilter.FILTER_REJECT : NodeFilter.FILTER_ACCEPT) });
            let t;
            while ((t = walker.nextNode())) {
              const at = t.nodeValue.toLowerCase().indexOf(ev);
              if (at < 0) continue;
              const r = document.createRange(); r.setStart(t, at); r.setEnd(t, at + ev.length);
              const m = el("span"); tag(m); r.surroundContents(m);
              again = true;
              break;
            }
          }
        }
      }
    });
  }

  function links(read) {
    const bar = $(".mail-url", read);
    for (const l of $$(".mail-link", read)) {
      const show = () => { bar.textContent = l.dataset.url; bar.classList.add("show"); };
      const hide = () => bar.classList.remove("show");
      l.addEventListener("mouseenter", show); l.addEventListener("focus", show);
      l.addEventListener("mouseleave", hide); l.addEventListener("blur", hide);
      l.addEventListener("click", (ev) => { ev.preventDefault(); show(); });   // links never open
    }
  }

  /* ------------------------------------------------------------------ the shift: state and clock */
  function startShift() {
    stopLoop();
    S = { clock: 0, over: false, paused: false, hold: 0, timer: null, last: 0, waves: 0, rushAt: 0, justDragged: false,
      arrived: [], fuse: {}, answers: {}, how: {}, gain: {}, found: {}, misses: {}, verified: {}, hinted: {}, seen: {}, notes: [],
      open: null, calls: sh.calls, hints: sh.hints, shields: sh.shields, points: 0, streak: 0, best: 0, losses: [], ntd: 0,
      call: { state: "none", t: 0, result: null, asked: false } };
    B = null;
    setScene("rush_day", 0);
    hudInit();
    window.scrollTo({ top: 0 });
    $("#rsBody").innerHTML = `<div class="rs-play">
      <div class="rs-side rs-side-l">${mentorHTML(bi("Shift's on. Keep an eye on the inbox.", "開始值班，注意收件匣。"))}
        <section class="rs-notebook" aria-label="Notebook"><h3>${bi("Notebook", "線索簿")} <b id="nbCount">0</b></h3><ol id="nbList"></ol></section></div>
      <div class="rs-laptop">
        <div class="rs-screen" id="rsScreen">
          <div class="rs-client">
            <aside class="rs-inbox" aria-label="Inbox"><h2><span>${bi("Restaurant inbox", "餐廳共用信箱")}</span><b id="rxCount" hidden></b></h2><ol id="rxList"></ol>
              <p class="rs-inbox-tip"><span class="is-l">${ICON.flag}<span>${bi("drag left: report", "往左拖：回報")}</span></span><span class="is-r"><span>${bi("drag right: keep", "往右拖：留著")}</span>${ICON.keep}</span></p></aside>
            <section class="rs-read" id="rxRead"></section>
          </div>
        </div>
        <div class="rs-drop" id="rsDrop" hidden aria-hidden="true">
          <div class="rs-drop-zone is-report">${ICON.flag}<b>${bi("Report phishing", "回報釣魚")}</b></div>
          <div class="rs-drop-zone is-keep">${ICON.keep}<b>${bi("Keep it", "留著")}</b></div></div>
        <div class="rs-base" aria-hidden="true"></div>
      </div>
      <div class="rs-side rs-side-r">
        <div class="rs-phone" id="rsPhone"></div>
        <button type="button" class="rs-hint-btn" id="rsHint"></button>
      </div>
      <div class="rs-actions" id="rsActions"></div></div>
      <div class="rs-paused" id="rsPaused" hidden><div><p>${bi("Paused", "暫停中")}</p><button type="button" class="btn" id="rsResume">${ICON.play}${bi("Resume", "繼續")}</button></div></div>`;
    $("#rsHint").addEventListener("click", useHint);
    $("#rsResume").addEventListener("click", () => togglePause(false));
    emptyRead();
    notebook();
    phoneIdle();
    hintBtn();
    loop();
  }

  function loop() {
    stopLoop();
    S.last = performance.now();
    S.timer = setInterval(tick, 100);
  }
  function stopLoop() { if (S && S.timer) { clearInterval(S.timer); S.timer = null; } }

  const pending = () => S.arrived.map((id) => byId[id]).filter((e) => !S.answers[e.id]);
  const callBusy = () => S.call.state === "ringing" || S.call.state === "talking" || S.call.state === "dialing";

  function tick() {
    const t = performance.now(), dt = Math.min(0.5, (t - S.last) / 1000);
    S.last = t;
    if (S.over || S.paused || S.hold || document.hidden) return;
    const wait = pending();
    const rate = wait.length || callBusy() ? sh.rate : sh.idle;
    S.clock = Math.min(TEND, S.clock + dt * rate);
    for (const e of d.emails) if (!S.fuse[e.id] && S.clock >= e.at) arrive(e);
    while (S.waves < waves.length && S.clock >= waves[S.waves].at) banner(waves[S.waves++]);
    if (CALL && S.call.state === "none" && S.clock >= mins(CALL.time) - T0) ring();
    if (S.call.state === "ringing") { S.call.t -= dt; if (S.call.t <= 0) resolveCall("missed"); }
    for (const e of pending()) {
      const f = S.fuse[e.id];
      f.left -= dt;
      if (f.left <= 0) { colleagueOpens(e); if (S.over || S.hold) break; }
    }
    rushCheck();
    drawFuses();
    drawClock();
    maybeEnd();
  }

  function drawClock() {
    const c = $("#hudClock");
    if (c) c.textContent = hhmm(S.clock);
    $("#rsDusk").style.opacity = String(0.62 * (S.clock / TEND));
  }

  function rushCheck() {
    const hot = pending().filter((e) => S.fuse[e.id].left <= 12);
    if (hot.length >= 2 && performance.now() - S.rushAt > 15000) { S.rushAt = performance.now(); say(line(lines.rush)); }
  }

  function banner(w) {
    const b = el("div", "rs-wave", bi(w.en, w.zh));
    $rs.appendChild(b);
    setTimeout(() => b.remove(), reduceMotion ? 2500 : 3800);
  }

  function togglePause(force) {
    if (!S || S.over) return;
    S.paused = typeof force === "boolean" ? force : !S.paused;
    $("#rsPaused").hidden = !S.paused;
    $rs.classList.toggle("is-paused", S.paused);
    const b = $("[data-pause]", meter);
    if (b) { b.setAttribute("aria-pressed", String(S.paused)); b.innerHTML = S.paused ? `${ICON.play}<span>${bi("Resume", "繼續")}</span>` : `${ICON.pause}<span>${bi("Pause", "暫停")}</span>`; }
    // 11/26 (front-end review K32): the overlay only stops the mouse; the inbox behind it is inert so Tab can't reach it either
    // (.rs-paused is its sibling, so Resume stays reachable; a cut scene makes #rsBody inert, a different element)
    const play = $(".rs-play", $("#rsBody"));
    if (play) play.inert = S.paused;
    // 11/26 (front-end review, mfa check): a cut scene makes #rsBody inert, and Resume sits inside it; pausing during a cut
    // lifts that (the inbox stays inert above), Resume puts it back while the cut is still up
    const cut = $("#rsCut");
    if (cut && !cut.hidden && $("#rsBody")) $("#rsBody").inert = !S.paused;
    if (S.paused) $("#rsResume").focus({ preventScroll: true });
    else {
      // 11/26 (front-end review K37): Resume on the overlay hides the button that had the keyboard: hand it back to the inbox
      const a = document.activeElement;
      // 11/26 (regression R08): with a cut up #rsBody is inert again, so the inbox can't take it; the cut's button does
      if (!a || a === document.body || !a.isConnected || a === $("#rsResume")) {
        const go = $("#rsCut:not([hidden]) .rs-cut-go");
        if (go) go.focus({ preventScroll: true }); else inboxFocus();
      }
    }
  }

  // 11/26 (front-end review K37): the keyboard goes back to the open email's row (Enter there only opens the email, so a
  // held Enter can't decide anything), else the first row
  function inboxFocus() {
    const a = (S.open && rowOf(S.open)) || $("#rxList .rx-item");
    if (a) a.focus({ preventScroll: true });
  }

  /* ------------------------------------------------------------------ the score bar in the page header */
  function hudInit() {
    G.meter(`<div class="rx-hud">
      <button type="button" class="rx-pause" data-pause aria-pressed="false">${ICON.pause}<span>${bi("Pause", "暫停")}</span></button>
      <div class="rx-hud-clock"><b id="hudClock">${esc(story.start || "16:00")}</b><span>${bi(`dinner ${story.dinner || "19:00"}`, "開飯")}</span></div>
      <div class="rx-hud-pts"><b id="hudPts">0</b><span>${bi("points", "分")}</span><i class="rx-streak" id="hudStreak" hidden></i></div>
      <div class="rx-hud-shields"><div id="hudShields" role="img"></div><span>${bi("shields", "盾牌")}</span></div></div>`);
    drawShields();
  }

  function drawShields(lost) {
    const box = $("#hudShields");
    if (!box) return;
    box.setAttribute("aria-label", `${S.shields} of ${sh.shields} shields left`);
    box.innerHTML = Array.from({ length: sh.shields }, (_, k) => ICON.shield(k < S.shields)).join("");
    if (lost) { const x = box.children[S.shields]; if (x) x.classList.add("is-break"); }
  }

  function hudPoints(pop) {
    const p = $("#hudPts");
    if (!p) return;
    p.textContent = S.points.toLocaleString("en-US");
    const s = $("#hudStreak");
    s.hidden = S.streak < 2; s.textContent = `×${S.streak}`;
    if (pop) {
      const n = el("span", "rx-pop" + (pop < 0 ? " is-neg" : ""), (pop > 0 ? "+" : "") + pop);
      p.parentElement.appendChild(n);
      setTimeout(() => n.remove(), 1200);
    }
  }

  /* ------------------------------------------------------------------ the inbox */
  function arrive(e) {
    const total = sh.fuse[e.i] || 50;
    S.fuse[e.id] = { left: total, total };
    S.arrived.push(e.id);
    addRow(e);
    countInbox();
    CB.SFX.play("ding");
    if (S.arrived.length === 1) say(line(lines.first));
    if (!S.open || S.answers[S.open]) openMail(e.id);
  }

  function countInbox() {
    const n = pending().length, c = $("#rxCount");
    if (!c) return;
    c.hidden = !n; c.textContent = String(n);
  }

  function addRow(e) {
    const li = el("li");
    const b = el("button", "rx-item is-unread is-new");
    b.type = "button"; b.dataset.id = e.id;
    b.innerHTML = `<span class="rx-from">${esc(e.from_name)}</span><time>${esc(e.time)}</time>
      <span class="rx-subj"><span class="rx-subj-en">${e.external ? `<i class="rx-ext">EXTERNAL <span lang="zh-Hant">外部</span></i>` : ""}${esc(plainSubj(e))}</span>${e.subject_zh ? `<span class="rx-subj-zh" lang="zh-Hant">${esc(subjZh(e))}</span>` : ""}</span>
      <span class="rx-prev">${esc(preview(e))}</span>
      <span class="rx-fuse" aria-hidden="true"><i></i></span><span class="rx-mark"></span>`;
    li.appendChild(b);
    const list = $("#rxList"), firstDone = $$(":scope > li", list).find((x) => x.firstElementChild.classList.contains("is-decided"));
    list.insertBefore(li, firstDone || null);
    dragRow(b, e);
    setTimeout(() => b.classList.remove("is-new"), 900);
  }

  function rowOf(id) { return $(`.rx-item[data-id="${id}"]`, $("#rxList")); }

  function markRow(e) {
    const b = rowOf(e.id);
    if (!b) return;
    const ok = isRight(e);
    b.classList.remove("is-unread", "is-hot");
    b.classList.add("is-decided", ok ? "is-right" : "is-wrong");
    $(".rx-mark", b).innerHTML = markHTML(e);
    const li = b.parentElement, list = li.parentElement;
    const firstDone = $$(":scope > li", list).find((x) => x !== li && x.firstElementChild.classList.contains("is-decided"));
    list.insertBefore(li, firstDone || null);
  }

  function markHTML(e) {
    if (S.how[e.id] === "opened") return bi("Opened by a colleague", "同事點開了");
    return S.answers[e.id] === "report" ? bi("Reported", "已回報") : bi("Kept", "留著");
  }

  const isRight = (e) => !!S.answers[e.id] && S.how[e.id] !== "opened" && S.answers[e.id] === (e.phish ? "report" : "keep");

  function drawFuses() {
    for (const e of pending()) {
      const f = S.fuse[e.id], k = Math.max(0, f.left / f.total), b = rowOf(e.id);
      if (b) { $(".rx-fuse i", b).style.width = `${(100 * k).toFixed(1)}%`; b.classList.toggle("is-hot", f.left <= 12); }
      if (S.open === e.id) {
        const bar = $("#rsFuse");
        if (bar) {
          $("i", bar).style.width = `${(100 * k).toFixed(1)}%`;
          bar.classList.toggle("is-hot", f.left <= 12);
          const s = Math.max(0, Math.ceil(f.left)), mmss = `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;
          $("span", bar).innerHTML = bi(`A colleague opens it in ${mmss}`, `${s} 秒後同事會點開`);
        }
      }
    }
  }

  /* Drag a row to decide straight from the inbox: left half of the screen = report, right half = keep. A click without
     moving opens the email. On a touch screen a sideways swipe drags, an up-and-down swipe still scrolls the list. */
  function dragRow(btn, e) {
    btn.addEventListener("pointerdown", (ev) => {
      if (ev.button !== 0 || S.over || S.answers[e.id]) return;
      const x0 = ev.clientX, y0 = ev.clientY;
      let drag = null;
      const move = (m) => {
        if (!drag) {
          if (Math.hypot(m.clientX - x0, m.clientY - y0) < 8) return;
          if (S.answers[e.id] || S.over) return cleanup();
          drag = startDrag(btn, e, x0, y0);
        }
        moveDrag(drag, m.clientX, m.clientY);
      };
      const up = (u) => {
        cleanup();
        if (!drag) return;
        const zone = endDrag(drag, u.clientX, u.clientY);
        S.justDragged = true; setTimeout(() => { S.justDragged = false; }, 60);
        if (zone && !S.answers[e.id] && !S.over) decide(e, zone, S.seen[e.id] ? "read" : "quick");
      };
      const cancel = () => { cleanup(); if (drag) endDrag(drag, -1, -1); };
      const cleanup = () => {
        window.removeEventListener("pointermove", move);
        window.removeEventListener("pointerup", up);
        window.removeEventListener("pointercancel", cancel);
      };
      window.addEventListener("pointermove", move);
      window.addEventListener("pointerup", up);
      window.addEventListener("pointercancel", cancel);
    });
    btn.addEventListener("click", () => { if (!S.justDragged) openMail(e.id); });
  }

  function startDrag(btn, e, x, y) {
    const r = btn.getBoundingClientRect();
    const ghost = el("div", "rx-ghost", `<b>${esc(e.from_name)}</b><span>${esc(plainSubj(e))}</span>${e.subject_zh ? `<span lang="zh-Hant">${esc(subjZh(e))}</span>` : ""}`);
    ghost.style.width = `${Math.max(220, r.width)}px`;
    document.body.appendChild(ghost);
    btn.classList.add("is-dragging");
    $("#rsDrop").hidden = false;
    CB.SFX.play("paper");
    return { btn, ghost, dx: x - r.left, dy: y - r.top, x0: x, zone: null };
  }

  function moveDrag(g, x, y) {
    const tilt = Math.max(-10, Math.min(10, (x - g.x0) / 18));
    g.ghost.style.transform = `translate(${x - g.dx}px, ${y - g.dy}px) rotate(${tilt}deg)`;
    const dx = x - g.x0;
    g.zone = dx <= -60 ? "report" : dx >= 60 ? "keep" : null;
    const drop = $("#rsDrop");
    drop.classList.toggle("on-report", g.zone === "report");
    drop.classList.toggle("on-keep", g.zone === "keep");
    g.ghost.classList.toggle("on-report", g.zone === "report");
    g.ghost.classList.toggle("on-keep", g.zone === "keep");
  }

  function endDrag(g, x, y) {
    const drop = $("#rsDrop");
    if (x >= 0 && drop) moveDrag(g, x, y);
    g.ghost.remove();
    g.btn.classList.remove("is-dragging");
    // 11/23 review: the shift can end under a drag (the dinner or the end screen replaces the inbox); let go and nothing is left
    if (drop) { drop.hidden = true; drop.classList.remove("on-report", "on-keep"); }
    return x >= 0 && drop ? g.zone : null;
  }

  /* ------------------------------------------------------------------ the reading pane */
  function emptyRead() {
    const read = $("#rxRead");
    read.className = "rs-read is-empty";
    read.innerHTML = `<div class="rs-empty">${ICON.mail}<p>${bi("Nothing open. New emails show up on the left.", "目前沒有打開的信，新信會出現在左邊。")}</p></div>`;
    $("#rsActions").innerHTML = "";
  }

  function openMail(id) {
    const e = byId[id];
    if (!e || S.over) return;
    S.open = id; S.seen[id] = true;
    for (const b of $$(".rx-item", $("#rxList"))) {
      const on = b.dataset.id === id;
      b.classList.toggle("is-current", on);
      if (on) b.setAttribute("aria-current", "true"); else b.removeAttribute("aria-current");
    }
    const live = !S.answers[id];
    const read = $("#rxRead");
    read.className = "rs-read " + (live ? "rx-hunt" : "rx-done");
    read.innerHTML = (live ? `<div class="rs-fuse" id="rsFuse"><i></i><span></span></div>` : "") + mailHTML(e);
    const art = $(".mail", read);
    wrapTells(art, e);
    links(read);
    for (const k of S.found[id] || []) for (const x of $$(`.tell[data-k="${k}"]`, read)) x.classList.add("is-found");
    // 11/26 (front-end review K35): a hinted tell you already found stays red when the email is opened again
    const h = S.hinted[id];
    if (h && !(S.found[id] && S.found[id].has(h))) for (const x of $$(`.tell[data-k="${h}"]`, read)) x.classList.add("is-hinted");
    if (live) {
      art.addEventListener("click", (ev) => inspect(ev, e));
      keyHunt(art, e);
      art.classList.add("is-arriving");
    } else {
      showResult(e, false);
    }
    actions(e);
    phoneIdle();
    hintBtn();
    drawFuses();
    $("#rsScreen").scrollTop = 0;
    read.scrollTop = 0;
  }

  function actions(e) {
    const act = $("#rsActions");
    act.innerHTML = "";
    if (S.answers[e.id]) return;
    act.innerHTML = `<button type="button" class="btn btn-alert" data-a="report">${ICON.flag}${bi("Report phishing", "回報釣魚")}</button>
      <button type="button" class="btn btn-ghost" data-a="keep">${ICON.keep}${bi("Keep it", "留著")}</button>`;
    for (const b of $$("button", act)) b.addEventListener("click", () => decide(e, b.dataset.a, "read"));
  }

  /* ------------------------------------------------------------------ clicking around an open email */
  function inspect(ev, e) {
    if (S.answers[e.id] || S.over) return;
    const t = ev.target.closest(".tell");
    if (t) {
      ev.preventDefault();
      const key = t.dataset.k, found = (S.found[e.id] ||= new Set());
      if (found.has(key)) return;
      found.add(key);
      if (S.hinted[e.id] === key) delete S.hinted[e.id];      // 11/26 (front-end review K35): found, so no longer a hint
      for (const x of $$(`.tell[data-k="${key}"]`, $("#rxRead"))) { x.classList.add("is-found"); x.classList.remove("is-hinted"); }
      S.points += P.tell;
      float(ev.pageX, ev.pageY, `<b>+${P.tell}</b> ${bi(signs[key].en, signs[key].zh)}`, "is-good");
      hudPoints(P.tell);
      notebook(e.id);
      return;
    }
    if (ev.target.closest(".mail-link")) return;                     // looking at a normal link is free
    if (!ev.target.closest(".mail-subj, .mail-head, .mail-body, .mail-att")) return;
    const n = (S.misses[e.id] = (S.misses[e.id] || 0) + 1);
    const cost = n <= P.missCap && S.points >= P.miss ? P.miss : 0;
    S.points -= cost;
    float(ev.pageX, ev.pageY, `${cost ? `<b>−${cost}</b> ` : ""}${bi("Not one of the signs this game counts", "這裡不是這次要找的警訊")}`, "is-miss");
    if (cost) hudPoints(-cost);
  }

  /* 11/26 (front-end review K38): the keyboard way to point at a tell. Making only the tells focusable would let Tab jump
     from answer to answer, so the email is one Tab stop and the arrow keys walk it word by word (every word alike, tell or
     not; the selection shows where you are). Enter or Space on a word is the same as a click there: a tell scores, plain
     text costs the usual miss. */
  function keyHunt(art, e) {
    let units = null, at = -1;
    art.tabIndex = 0;
    art.setAttribute("aria-label", "Email: arrow keys move word by word, Enter points out a sign. 信件：用方向鍵一格一格移，按 Enter 點出可疑的地方。");
    const build = () => {
      const list = [];
      for (const root of $$(".mail-subj, .mail-from, .mail-to, .mail-body", art)) {
        const parts = [];
        let s = "";
        const w = document.createTreeWalker(root, NodeFilter.SHOW_TEXT | NodeFilter.SHOW_ELEMENT,
          { acceptNode: (n) => (n.nodeType === 1 && n.matches(".mail-qr, .mail-file") ? NodeFilter.FILTER_REJECT : NodeFilter.FILTER_ACCEPT) });
        for (let n; (n = w.nextNode());) {
          if (n.nodeType === 1) { if (/^(BR|P|DIV)$/.test(n.tagName)) s += " "; continue; }
          parts.push([n, s.length]); s += n.nodeValue;
        }
        // a word can run across text nodes (a tell inside an address), so the range starts and ends wherever its letters are
        const pos = (i, end) => { for (const [n, o] of parts) { const L = n.nodeValue.length; if (end ? i > o && i <= o + L : i >= o && i < o + L) return [n, i - o]; } return null; };
        for (const m of s.matchAll(/\S+/g)) {
          const a = pos(m.index, false), b = pos(m.index + m[0].length, true);
          if (!a || !b) continue;
          const r = document.createRange(); r.setStart(a[0], a[1]); r.setEnd(b[0], b[1]);
          list.push(r);
        }
      }
      for (const x of $$(".mail-qr, .mail-file", art)) { const r = document.createRange(); r.selectNode(x); list.push(r); }
      return list.sort((x, y) => x.compareBoundaryPoints(Range.START_TO_START, y));
    };
    const nodeOf = (r) => (r.startContainer.nodeType === 1 ? r.startContainer.childNodes[r.startOffset] || r.startContainer : r.startContainer.parentElement);
    const show = () => {
      const r = units[at], sel = getSelection();
      sel.removeAllRanges(); sel.addRange(r.cloneRange());      // 11/26 (front-end review K38, check): a copy, so a mouse selection can't move the stored word
      nodeOf(r).scrollIntoView({ block: "nearest" });
    };
    art.addEventListener("focus", () => {
      if (S.keyTip || !art.matches(":focus-visible")) return;
      S.keyTip = true;
      say(bi("Use the arrow keys to move through the email word by word, and press Enter on anything that looks wrong.", "用方向鍵在信裡一格一格移，看到怪怪的地方就按 Enter。"));
    });
    art.addEventListener("blur", () => { const sel = getSelection(); if (at >= 0 && sel.rangeCount && art.contains(sel.anchorNode)) sel.removeAllRanges(); });
    art.addEventListener("keydown", (ev) => {
      if (ev.target !== art || ev.ctrlKey || ev.altKey || ev.metaKey || ev.shiftKey) return;
      const k = ev.key, step = { ArrowRight: 1, ArrowDown: 1, ArrowLeft: -1, ArrowUp: -1 }[k];
      if (!step && k !== "Home" && k !== "End" && k !== "Enter" && k !== " ") return;
      if (!units) units = build();
      if (!units.length) return;
      ev.preventDefault();
      if (ev.repeat && !step) return;      // 11/26 (front-end review K38, check): a held Enter points once, not a miss per key repeat
      if (step) at = Math.max(0, Math.min(units.length - 1, at + step));
      else if (k === "Home") at = 0;
      else if (k === "End") at = units.length - 1;
      else if (at < 0) at = 0;      // Enter before moving: put the cursor on the first word first
      else {
        const r = units[at], t = $$(".tell", art).find((x) => r.intersectsNode(x)), b = r.getBoundingClientRect();
        inspect({ target: t || nodeOf(r), preventDefault() {}, pageX: b.left + b.width / 2 + window.scrollX, pageY: b.top + window.scrollY }, e);
        return;
      }
      show();
    });
  }

  function float(x, y, html, cls) {
    const f = el("div", "rx-float " + cls, html);
    f.style.left = `${x}px`; f.style.top = `${y}px`;
    document.body.appendChild(f);
    setTimeout(() => f.remove(), reduceMotion ? 900 : 1300);
  }

  function floatAtRow(id, html, cls) {
    const b = rowOf(id);
    if (!b) return;
    const r = b.getBoundingClientRect();
    float(r.left + r.width / 2 + window.scrollX, r.top + window.scrollY + 8, html, cls);
  }

  /* ------------------------------------------------------------------ the notebook: what you found and what people said */
  function notebook(freshId) {
    const list = $("#nbList");
    if (!list) return;
    const rows = [];
    let n = 0;
    for (const id of S.arrived) {
      const f = S.found[id];
      if (!f || !f.size) continue;
      n += f.size;
      const e = byId[id];
      rows.push(`<li class="${id === freshId ? "is-new" : ""}"><p><b>#${e.i + 1}</b> ${esc(e.from_name)}</p>
        <p class="rs-nb-chips">${[...f].map((k) => `<span>${esc(signs[k].en)} <i lang="zh-Hant">${esc(signs[k].zh)}</i></span>`).join("")}</p></li>`);
    }
    for (const note of S.notes) {
      n += 1;
      rows.push(`<li class="is-call${note.fresh ? " is-new" : ""}"><p>${ICON.phone}<b>${esc(note.who)}</b> <i lang="zh-Hant">${esc(note.who_zh)}</i></p><p class="rs-nb-said">${bi(note.en, note.zh)}</p></li>`);
      note.fresh = false;
    }
    list.innerHTML = rows.join("") || `<li class="rs-nb-empty">${bi("Tells you click and what people tell you on the phone go here. The SOC will want them later.", "你點出的線索、電話裡問到的話都記在這裡，等一下資安監控中心會用到。")}</li>`;
    $("#nbCount").textContent = String(n);
  }

  /* ------------------------------------------------------------------ the phone: three calls to check, and the 18:52 call */
  function phoneIdle() {
    document.removeEventListener("keydown", phoneEsc);
    const box = $("#rsPhone");
    if (!box || callBusy() || S.call.dialing) return;
    const e = S.open && !S.answers[S.open] ? byId[S.open] : null;
    const can = !!e && S.calls > 0 && !S.over;
    box.innerHTML = `<button type="button" class="rs-phone-btn" id="rsCallBtn"${can ? "" : " disabled"}>${ICON.phone}
      <span>${bi("Call to check", "打電話確認")}</span><em>${bi(`${S.calls} left`, `剩 ${S.calls} 通`)}</em></button>
      ${!e ? `<p class="rs-phone-note">${bi("Open an email, then call about it.", "先打開一封信，再打電話問。")}</p>` : S.calls ? "" : `<p class="rs-phone-note">${bi("No calls left tonight.", "今晚的電話用完了。")}</p>`}
      ${S.call.done ? S.call.done : ""}`;
    if (can) $("#rsCallBtn").addEventListener("click", () => openPhone(e));
    const ok = $(".rs-call-done button", box);
    if (ok) ok.addEventListener("click", () => { S.call.done = ""; phoneIdle(); });
  }

  function openPhone(e) {
    const box = $("#rsPhone");
    const list = contacts.map((c) => `<li><button type="button" data-k="${esc(c.key)}"><b>${esc(c.en)}</b><span lang="zh-Hant">${esc(c.zh)}</span><i>${numBi(c.number)}</i></button></li>`).join("");
    box.innerHTML = `<div class="rs-handset" role="dialog" aria-label="Phone">
      <div class="rs-handset-top"><b>${bi("Who do you call?", "要打給誰？")}</b><button type="button" class="rs-x" aria-label="Close">×</button></div>
      <p class="rs-handset-about">${bi(`About #${e.i + 1}: ${e.from_name}`, `關於第 ${e.i + 1} 封：${e.from_name}`)}</p>
      <p class="rs-handset-note">${bi("Use a number you already know, never one from the email.", "打你本來就知道的號碼，不要用信裡給的。")}</p>
      <ul class="rs-contacts">${list}</ul></div>`;
    $(".rs-x", box).addEventListener("click", phoneIdle);
    for (const b of $$(".rs-contacts button", box)) b.addEventListener("click", () => call(e, contacts.find((c) => c.key === b.dataset.k)));
    document.addEventListener("keydown", phoneEsc);
  }
  // 11/23 (review G1): Escape closes the list of numbers like its ×, and so doesn't close the game window (common.js)
  function phoneEsc(ev) {
    if (ev.key !== "Escape" || ev.defaultPrevented) return;
    const box = $("#rsPhone");
    if (!S || S.over || !box || !$(".rs-handset .rs-x", box)) return;
    ev.preventDefault();
    phoneIdle();
  }

  async function call(e, c) {
    if (S.answers[e.id] || S.calls <= 0 || callBusy()) return;
    S.calls -= 1;
    S.call.dialing = true;
    const box = $("#rsPhone");
    box.innerHTML = `<div class="rs-handset is-calling" role="dialog" aria-label="Phone call">
      <div class="rs-handset-top"><b>${bi(c.en, c.zh)}</b><span>${numBi(c.number)}</span></div>
      <div class="rs-ring" aria-hidden="true"><i></i><i></i><i></i></div>
      <p class="rs-calling">${bi("Calling…", "撥號中…")}</p></div>`;
    await wait(1400);
    S.call.dialing = false;
    if (callBusy() || !$(".rs-handset.is-calling", box) || S.answers[e.id]) {   // 11/22: interrupted or no longer needed: the call is given back
      S.calls += 1;
      if (!callBusy()) phoneIdle();
      return;
    }
    const ans = (e.calls || {})[c.key] || (c.key === "soc" ? story.soc_line : story.no_idea) || { en: "…", zh: "…" };
    const decisive = !!(e.calls || {})[c.key];
    box.innerHTML = `<div class="rs-handset is-talking" role="dialog" aria-label="Phone call">
      <div class="rs-handset-top"><b>${bi(c.en, c.zh)}</b><span>${numBi(c.number)}</span></div>
      <p class="rs-handset-about">${bi(`About #${e.i + 1}`, `問第 ${e.i + 1} 封`)}</p>
      <p class="rs-callee">${bi(ans.en, ans.zh)}</p>
      <button type="button" class="btn btn-ghost rs-hang">${bi("Hang up", "掛斷")}</button></div>`;
    $(".rs-hang", box).addEventListener("click", phoneIdle);
    if (decisive && !S.verified[e.id]) {
      S.verified[e.id] = c.key;
      S.points += P.verify; hudPoints(P.verify);
      S.notes.push({ email: e.id, contact: c.key, who: c.en, who_zh: c.zh, en: ans.en, zh: ans.zh, fresh: true });
      notebook();
      say(bi("Good move: you checked through a number you already know. It's in your notebook.", "做得好：你打的是本來就知道的號碼，這段話記進線索簿了。"));
    }
  }

  function ring() {
    S.call.state = "ringing"; S.call.t = 15;
    const box = $("#rsPhone");
    box.innerHTML = `<div class="rs-handset rs-incoming" role="dialog" aria-label="Incoming call">
      <p class="rs-in-label">${bi("Incoming call", "來電")}</p>
      <div class="rs-in-who"><span class="rs-in-avatar" aria-hidden="true">${esc(initials(CALL.name_en))}</span>
        <b>${esc(CALL.name_en)}</b><span lang="zh-Hant">${esc(CALL.name_zh)}</span><i>${esc(CALL.number)}</i></div>
      <div class="rs-ring is-in" aria-hidden="true"><i></i><i></i><i></i></div>
      <div class="rs-in-btns"><button type="button" class="rs-decline">${bi("Decline", "拒接")}</button><button type="button" class="rs-answer">${ICON.phone}${bi("Answer", "接聽")}</button></div></div>`;
    $(".rs-decline", box).addEventListener("click", () => resolveCall("declined"));
    $(".rs-answer", box).addEventListener("click", answerCall);
    $rs.classList.add("is-ringing");
    CB.SFX.play("ring");
    hintBtn();
  }

  function answerCall() {
    if (S.call.state !== "ringing") return;
    S.call.state = "talking";
    $rs.classList.remove("is-ringing");
    const box = $("#rsPhone");
    box.innerHTML = `<div class="rs-handset is-talking rs-vish" role="dialog" aria-label="Phone call">
      <div class="rs-handset-top"><b>${bi(CALL.name_en, CALL.name_zh)}</b><span>${esc(CALL.number)}</span></div>
      <div class="rs-sms" id="rsSms" hidden><p class="rs-sms-app">${bi("Messages · now", "簡訊・剛剛")}</p><p>${bi(CALL.sms_en, CALL.sms_zh)}</p></div>
      <p class="rs-callee" id="rsCallee">${bi(CALL.open_en, CALL.open_zh)}</p>
      <div class="rs-opts" id="rsOpts">
        <button type="button" data-o="read">${bi(`Read out the code ${CALL.code}`, "念出驗證碼")}</button>
        <button type="button" data-o="ask">${bi("Ask which ticket this is", "問他是哪張工單")}</button>
        <button type="button" data-o="hang">${bi("Hang up and call the Help Desk yourself (ext. 2100)", "掛掉，自己打服務台（分機 2100）")}</button></div></div>`;
    setTimeout(() => { const s = $("#rsSms"); if (s) s.hidden = false; }, reduceMotion ? 0 : 900);
    for (const b of $$("#rsOpts button", box)) b.addEventListener("click", () => callChoice(b.dataset.o));
  }

  async function callChoice(o) {
    if (S.call.state !== "talking") return;
    if (o === "ask") {
      S.call.asked = true;
      $("#rsCallee").innerHTML = bi(CALL.ask_en, CALL.ask_zh);
      const b = $('#rsOpts [data-o="ask"]'); if (b) b.remove();
      return;
    }
    if (o === "read") return resolveCall("read");
    S.call.state = "dialing";
    const box = $("#rsPhone");
    box.innerHTML = `<div class="rs-handset is-calling" role="dialog" aria-label="Phone call">
      <div class="rs-handset-top"><b>${bi("IT Help Desk", "資訊服務台")}</b><span>${numBi("ext. 2100")}</span></div>
      <div class="rs-ring" aria-hidden="true"><i></i><i></i><i></i></div>
      <p class="rs-calling">${bi("Calling…", "撥號中…")}</p></div>`;
    await wait(1400);
    resolveCall("right");
  }

  /* The 18:52 call ends one of four ways: you hung up and called back (right), declined it, let it ring out, or read the code. */
  async function resolveCall(result) {
    // 11/26 (front-end review K34): reading out the code after the last shield is gone can't take the shields below zero
    if (S.call.state === "done" || S.over || (result === "read" && S.shields <= 0)) return;
    S.call.state = "done"; S.call.result = result;
    $rs.classList.remove("is-ringing");
    const proc = d.procedures[CALL.proc] || {};
    const rule = (proc.dont_en || []).findIndex((x) => /code/i.test(x));
    const why = rule >= 0 ? `<p class="rs-call-rule">${bi(proc.dont_en[rule], proc.dont_zh[rule])}</p><p class="rs-call-src">${bi(`From “${proc.name_en}” in the knowledge graph`, `出自知識圖的流程「${proc.name_zh}」`)}</p>` : "";
    let head = "", gain = 0;
    if (result === "right") {
      S.streak += 1; S.best = Math.max(S.best, S.streak);
      gain = P.callRight; S.points += gain;
      S.notes.push({ email: "call", contact: "it", who: mentor.name, who_zh: mentor.name_zh, en: CALL.right_en, zh: CALL.right_zh, fresh: true });
      head = `<p class="rs-callee">${bi(CALL.right_en, CALL.right_zh)}</p>`;
      say(bi("That's how it's done: hang up, call a number you know.", "就是這樣：掛掉，打你本來就知道的號碼。"));
      notebook();
    } else if (result === "declined") {
      S.streak += 1; S.best = Math.max(S.best, S.streak);
      gain = P.callDeclined; S.points += gain;
      head = `<p class="rs-call-line">${bi(CALL.declined_en, CALL.declined_zh)}</p>`;
    } else if (result === "missed") {
      head = `<p class="rs-call-line">${bi(CALL.missed_en, CALL.missed_zh)}</p>`;
    } else {
      S.streak = 0;
    }
    S.call.done = `<div class="rs-call-done ${result === "read" ? "is-bad" : "is-ok"}">${head}${why}<button type="button" class="btn btn-ghost">${bi("OK", "好")}</button></div>`;
    hudPoints(gain || null);
    phoneIdle();
    hintBtn();
    if (result === "read") {
      S.shields -= 1; drawShields(true); hitFlash();
      const left = S.shields;
      S.losses.push({ id: "call", damage: CALL.damage });
      S.hold += 1;
      await cutScene(CALL.keep || [], CALL.damage || {}, CALL.name_en, left, CALL.name_zh);
      S.hold -= 1; S.last = performance.now();
      if (S.shields <= 0) { if (!S.hold) gameOver(); return; }
    }
  }

  /* ------------------------------------------------------------------ one hint from Mei-Ling */
  function hintBtn() {
    const b = $("#rsHint");
    if (!b) return;
    const e = S.open && !S.answers[S.open] ? byId[S.open] : null;
    b.disabled = !(e && S.hints > 0) || S.over;
    b.innerHTML = `${portrait("is-mini")}<span>${bi("Ask Mei-Ling", "問美玲")}</span><em>${bi(`${S.hints} left`, `剩 ${S.hints} 次`)}</em>`;
  }

  function useHint() {
    const e = S.open ? byId[S.open] : null;
    if (!e || S.answers[e.id] || S.hints <= 0 || S.over || S.paused) return;      // 11/26 (front-end review K32): not while paused
    if (e.phish && e.signs.length) {
      const found = S.found[e.id] || new Set();
      // 11/26 (front-end review K35): every sign already found: say so and keep the hint, don't ring a found tell in amber
      const s = e.signs.filter((x) => !found.has(x.key)).sort((a, b) => b.w - a.w)[0];
      if (!s) return say(bi("You've already found every sign in this one.", "這封的警訊你都找到了，提示先留著。"));
      S.hints -= 1;
      S.hinted[e.id] = s.key;
      const tells = $$(`.tell[data-k="${s.key}"]`, $("#rxRead"));
      for (const x of tells) x.classList.add("is-hinted");
      if (tells[0]) tells[0].scrollIntoView({ block: "center", behavior: reduceMotion ? "auto" : "smooth" });
      say(bi(`Look at the circled part: ${signs[s.key].en}.`, `看我圈起來的地方：${signs[s.key].zh}。`));
    } else {
      S.hints -= 1;
      say(bi((story.hint_real || {}).en || "", (story.hint_real || {}).zh || ""));
    }
    hintBtn();
  }

  /* ------------------------------------------------------------------ the choice and what it leads to */
  function colleagueOpens(e) { decide(e, "keep", "opened"); }

  async function decide(e, a, how) {
    // 11/26 (front-end review K32, K34): nothing is decided while paused (the fuse is frozen, so the speed bonus would be free),
    // and nothing after the last shield is gone (game over is on its way; a second slip took the shields below zero)
    if (S.answers[e.id] || S.over || S.shields <= 0 || (S.paused && how !== "opened")) return;
    S.answers[e.id] = a; S.how[e.id] = how;
    const f = S.fuse[e.id], right = isRight(e), opened = how === "opened";
    let gain = 0;
    if (right) {
      S.streak += 1; S.best = Math.max(S.best, S.streak);
      const speed = P.speed * Math.ceil(Math.max(0, f.left)), streak = P.streak * (S.streak - 1);
      S.gain[e.id] = { right: P.right, speed, streak };
      gain = P.right + speed + streak;
    } else {
      S.streak = 0;
      if (!e.phish && a === "report") { gain = -Math.min(P.falseAlarm, S.points); S.gain[e.id] = { alarm: gain }; }
    }
    S.points += gain;
    CB.SFX.play(right ? "good" : "bad");
    if (right && [3, 5, 8].includes(S.streak)) CB.streak(stage, S.streak);
    const hit = e.phish && a === "keep";
    if (hit) { S.shields -= 1; S.losses.push({ id: e.id, damage: damageOf(e) }); S.ntd += (e.damage && e.damage.ntd) || 0; drawShields(true); hitFlash(); }
    const left = S.shields;   // shields after this slip (cuts queue up if another comes first)
    markRow(e);
    countInbox();
    hudPoints(gain || null);
    const msg = opened ? (e.phish ? bi(story.opened_en || "", story.opened_zh || "") : line(lines.opened_real))
      : e.phish ? (a === "report" ? line(how === "quick" ? lines.quick : lines.caught) : line(lines.missed))
        : (a === "keep" ? line(how === "quick" ? lines.quick : lines.kept) : line(lines.false_alarm));
    say(msg);
    if (S.open === e.id) {
      const read = $("#rxRead");
      read.classList.remove("rx-hunt"); read.classList.add("rx-done");
      const bar = $("#rsFuse"); if (bar) bar.remove();
      $("#rsActions").innerHTML = "";
      stamp(read, true);
      showResult(e, true);
      phoneIdle(); hintBtn();
    } else {
      const label = gain > 0 ? `<b>+${gain}</b> ${a === "report" ? bi("Reported", "已回報") : bi("Kept", "留著")}`
        : hit ? bi("Got through", "被得逞了") : !e.phish && a === "report" ? `${gain < 0 ? `<b>${gain}</b> ` : ""}${bi("False alarm", "誤報")}` : bi("Opened by a colleague", "同事點開了");
      floatAtRow(e.id, label, gain > 0 ? "is-good" : "is-miss");
    }
    if (hit) {
      S.hold += 1;
      await wait(500);
      const theirs = opened && e.keep_opened && e.keep_opened.length;
      await cutScene(theirs ? e.keep_opened : e.keep, damageOf(e), plainSubj(e), left, subjZh(e));
      S.hold -= 1; S.last = performance.now();
      if (S.shields <= 0) { if (!S.hold) gameOver(); return; }
    } else if (e.phish && a === "report") {
      toast();
    }
    if (S.open === e.id) {
      setTimeout(() => {
        if (S.over || S.open !== e.id) return;
        const next = pending().sort((x, y) => S.fuse[x.id].left - S.fuse[y.id].left)[0];
        if (next) openMail(next.id);
      }, reduceMotion ? 600 : 1700);
    }
  }

  function stamp(read, animate) {
    const id = S.open, a = S.answers[id], opened = S.how[id] === "opened";
    const s = el("div", `rx-stamp ${opened ? "is-opened" : a === "report" ? "is-report" : "is-keep"}${animate ? " is-slam" : ""}`,
      opened ? `OPENED<small>被點開了</small>` : a === "report" ? `REPORTED<small>已回報</small>` : `KEPT<small>留著</small>`);
    $(".mail", read).appendChild(s);
    if (animate) CB.SFX.play("stamp");
    if (animate && !reduceMotion) { read.classList.add("is-thud"); setTimeout(() => read.classList.remove("is-thud"), 400); }
  }

  function hitFlash() {
    CB.SFX.play("shield");
    if (reduceMotion) return;
    $rs.classList.remove("is-hit"); void $rs.offsetWidth; $rs.classList.add("is-hit");
    setTimeout(() => $rs.classList.remove("is-hit"), 700);
  }

  function toast() {   // a reported phish goes to the SOC at the lighthouse
    const t = $("#rsToast");
    t.hidden = false;
    t.innerHTML = `<img src="${IMG}rush_soc.jpg" alt=""><p>${bi("SOC at the lighthouse: removed from every mailbox.", "燈塔的資安監控中心：已經從每個信箱拿掉了。")}</p>`;
    t.classList.remove("is-in"); void t.offsetWidth; t.classList.add("is-in");
    clearTimeout(t._h);
    t._h = setTimeout(() => { t.hidden = true; }, 3600);
  }

  /* What an attacker did with something you let through: the tour's own scene, the beats as subtitles, one close-up.
     11/21 night: two slips close together used to draw a second cut over the first, whose button (and done) went away,
     so the shift froze. Cuts now wait their turn; the inbox behind a cut is inert so the keyboard cannot reach it. */
  let cutQ = Promise.resolve();
  function cutScene(keep, dm, subj, left, subjZh2) {
    cutQ = cutQ.then(() => cutOne(keep, dm, subj, left, subjZh2));
    return cutQ;
  }
  function cutOne(keep, dm, subj, left, subjZh2) {
    return new Promise((done) => {
      const cut = $("#rsCut"), body = $("#rsBody");
      // 11/26 (regression R07): a cut that starts while paused (Pause pressed in the wait before it) leaves #rsBody alone,
      // or the pause card's Resume inside it goes dead behind the hidden cut; togglePause(false) makes it inert
      const paused = !!(S && S.paused);
      if (body && !paused) body.inert = true;
      const beats = (keep || []).map((k) => `<li><time>${esc(k.time)}${k.time_zh ? ` <span lang="zh-Hant">${esc(k.time_zh)}</span>` : ""}</time><p>${bi(k.en, k.zh)}</p></li>`).join("");
      cut.hidden = false;
      cut.innerHTML = `<div class="rs-cut-bg" style="background-image:url(${IMG}${esc(dm.scene || "rush_day")}.jpg)"></div><div class="rs-cut-shade"></div>
        <div class="rs-cut-inset">${inset(dm, subj)}</div>
        <div class="rs-cut-text"><p class="rs-cut-kicker">${bi("What happened next", "接下來發生了什麼")}</p>
          <ol class="rx-beats rs-beats">${beats}</ol>
          <p class="rx-hit rs-cut-hit"><span>${bi(dm.en || "", dm.zh || "")}</span>${dm.ntd ? `<b class="rx-ntd" id="rsNtd">NT$ 0</b>` : ""}</p>
          <p class="rs-cut-shield">${ICON.shield(false)}${bi(left > 0 ? `Shield lost. ${left} left.` : "That was your last shield.", left > 0 ? `少了一面盾牌，還剩 ${left} 面。` : "最後一面盾牌也沒了。")}</p>
          <button type="button" class="btn rs-cut-go">${bi(left > 0 ? "Back to the inbox" : "Continue", left > 0 ? "回到收件匣" : "繼續")}</button></div>`;
      cut.classList.remove("is-in"); void cut.offsetWidth; cut.classList.add("is-in");
      if (dm.ntd) setTimeout(() => countUp($("#rsNtd"), dm.ntd), reduceMotion ? 0 : 1300);
      if (dm.inset === "sent") flood($(".rs-sent ol", cut), dm.sent || 200, subj, subjZh2, dm.owner);
      if (!paused) $(".rs-cut-go", cut).focus({ preventScroll: true });   // 11/26 (regression R07): while paused Resume keeps the keyboard
      $(".rs-cut-go", cut).addEventListener("click", () => {
        cut.hidden = true; cut.innerHTML = ""; if (body) body.inert = false;
        // 11/26 (front-end review K37): the focused button just went away; a queued next cut focuses its own button after this
        const a = document.activeElement;
        if (!a || a === document.body || !a.isConnected) inboxFocus();
        done();
      });
    });
  }

  function inset(dm, subj) {
    if (dm.inset === "ransom") return `<img class="rs-ransom" src="/lakeside/static/games/img/ransom.png" alt="Ransom note on the restaurant POS 收銀機上的勒索畫面">`;
    if (dm.inset === "bank") return `<div class="rs-bank"><p class="rs-bank-top">${esc(dm.bank || "Bank")} · ${bi("Online banking", "網路銀行")}</p>
      <p class="rs-bank-ok">✓ ${bi("Transfer completed", "轉帳完成")}</p><p class="rs-bank-amt">${money(dm.ntd || 0)}</p>
      <p class="rs-bank-to">${bi("To account", "轉入帳號")} <b>${esc(dm.account || "")}</b></p></div>`;
    if (dm.inset === "gm") return `<div class="rs-gm"><p>${bi(dm.quote_en || "", dm.quote_zh || "")}</p><span>${bi("General Manager", "總經理")}</span></div>`;
    // 11/23 review: a colleague's account when a colleague opened it (games.yaml damage_opened.signin_en)
    if (dm.inset === "signin") return `<div class="rs-alert"><p class="rs-alert-app">Lakeside SSO · ${bi("Security alert", "安全通知")}</p>
      <p class="rs-alert-title">${bi(dm.signin_en || "New sign-in to your staff account", dm.signin_zh || "你的員工帳號有新的登入")}</p>
      <p class="rs-alert-meta">${bi(dm.when || "", dm.when_zh || "")} · ${esc(dm.ip || "")} · ${bi("outside Taiwan", "國外")}</p></div>`;
    if (dm.inset === "sent") return `<div class="rs-sent"><p class="rs-sent-top">${bi("Sent items", "寄件備份")} · <b id="rsSentN">0</b></p><ol></ol></div>`;
    return "";
  }

  function flood(ol, n, subj, zh, owner) {
    // 11/22: the people's Chinese names as the other chapters write them (the Chinese lines call Wei-Ting at Ocean Fresh by his English name)
    // 11/23: a colleague's mailbox doesn't send to its own owner (games.yaml damage_opened.owner)
    const names = [["Ivy Tsai", "蔡宜芳"], ["Chef Huang", "黃主廚"], ["Pei-Shan", "佩珊"], ["Kevin Wu", "吳凱文"], ["Grace Lin", "林思妤"], ["Front Desk", "櫃台"], ["Bar team", "酒吧組"], ["Night shift", "夜班"], ["Banquet team", "宴會組"], ["Wei-Ting"]]
      .filter(([en]) => en !== owner);
    let k = 0;
    const tick2 = () => {
      if (!ol.isConnected || k >= n) return;
      const step = k < 12 ? 1 : 9;
      for (let j = 0; j < step && k < n; j++, k++) {
        const [en, nz] = names[k % names.length];
        ol.prepend(el("li", "", `<b>${bi(en, nz)}</b> ${bi(subj, zh)}`));
        while (ol.children.length > 9) ol.lastElementChild.remove();
      }
      const c = $("#rsSentN"); if (c) c.textContent = String(k);
      setTimeout(tick2, reduceMotion ? 0 : k < 12 ? 160 : 60);
    };
    setTimeout(tick2, 700);
  }

  function countUp(node, target) {
    if (!node) return;
    if (reduceMotion || !target) { node.textContent = money(target); return; }
    const t0 = performance.now(), dur = 900;
    const step = (t) => { const k = Math.min(1, (t - t0) / dur); node.textContent = money(Math.round(target * (1 - Math.pow(1 - k, 3)))); if (k < 1) requestAnimationFrame(step); };
    requestAnimationFrame(step);
  }

  function showResult(e, animate) {
    const read = $("#rxRead");
    if (!animate) stamp(read, false);
    const out = el("div", "rx-out" + (animate ? " is-in" : ""));
    out.innerHTML = outcome(e) + debrief(e);
    read.appendChild(out);
  }

  function outcome(e) {
    const a = S.answers[e.id], g = S.gain[e.id] || {}, found = S.found[e.id] || new Set();
    const parts = [g.right ? `+${g.right} ${bi("right call", "判斷正確")}` : "", g.speed ? `+${g.speed} ${bi("speed", "速度")}` : "",
      g.streak ? `+${g.streak} ${bi("streak", "連續答對")}` : "", found.size ? `+${found.size * P.tell} ${bi(`${found.size} tells`, `${found.size} 條線索`)}` : "",
      S.verified[e.id] ? `+${P.verify} ${bi("checked by phone", "打電話確認")}` : "", g.alarm ? `${g.alarm} ${bi("false alarm", "誤報")}` : ""].filter(Boolean);
    const pts = parts.length ? `<p class="rx-pts">${parts.join(" · ")}</p>` : "";
    if (e.phish && a === "keep") {
      const dm = damageOf(e);
      return `<section class="rx-incident rs-mini-incident"><h3>${bi("What happened next", "接下來發生了什麼")}</h3>
        <p class="rx-hit"><span>${bi(dm.en || "", dm.zh || "")}</span>${dm.ntd ? `<b class="rx-ntd">${money(dm.ntd)}</b>` : ""}</p></section>`;
    }
    if (!e.phish && a === "report") {
      const r = e.reply || {};
      return `<section class="rx-reply"><p class="rx-reply-head"><span class="rx-avatar is-small" aria-hidden="true">${esc(initials(r.from || "?"))}</span>
        <b>${esc(r.from || "")}</b> <span lang="zh-Hant">${esc(r.from_zh || "")}</span></p>
        <p class="rx-reply-re">Re: ${bi(plainSubj(e), e.subject_zh ? `回覆：${e.subject_zh}` : "")}</p>
        <p class="rx-reply-text">${bi(r.en || "", r.zh || "")}</p>${pts}</section>`;
    }
    const head = S.how[e.id] === "opened" ? bi("A colleague opened it. Luckily it was real.", "同事先點開了，還好是正常的信。")
      : e.phish ? bi("Caught it.", "抓到了。") : bi("A real email, kept.", "正常的信，留著。");
    return `<section class="rx-good"><p class="rx-good-head">${head}</p>${pts}</section>`;
  }

  function debrief(e, open) {
    const found = S.found[e.id] || new Set();
    const total = Math.max(15, e.score + 1);
    const segs = e.signs.map((s, k) => `<span class="vd-seg" style="width:${(100 * s.w) / total}%"><i>${k + 1}</i></span>`).join("");
    const list = e.signs.map((s, k) => {
      const g = signs[s.key], got = found.has(s.key);
      return `<li class="${got ? "is-got" : "is-missed"}"><span class="vd-n">${k + 1}</span><div><p class="vd-name">${bi(g.en, g.zh)}
        <em class="rx-got">${got ? bi("you spotted it", "你找到了") : bi("missed", "沒找到")}</em></p>
        <p class="vd-ev">“${esc(s.evidence)}”</p><p class="vd-d">${bi(g.d_en, g.d_zh)}</p></div><span class="vd-w">+${s.w}</span></li>`;
    }).join("");
    const whoC = Object.keys(e.calls || {}).map((k) => contacts.find((c) => c.key === k)).filter(Boolean);
    const who = whoC.map((c) => `${c.en} (${c.number})`).join(" · "), whoZh = whoC.map((c) => `${c.zh}（${extZh(c.number)}）`).join("、");
    const proc = d.procedures[e.proc];
    const steps = e.phish && proc ? `<div class="vd-todo"><h3>${bi("What to do with it", "收到這種信怎麼辦")}</h3><ol>${proc.steps.slice(0, 2).map((s) => `<li>${bi(s.text_en, s.text_zh)}</li>`).join("")}</ol>
      <p class="vd-src">${bi(`From the procedure “${proc.name_en}” in the knowledge graph`, `出自知識圖的流程「${proc.name_zh}」`)}</p></div>` : "";
    return `<details class="rx-why" ${open || (S.answers[e.id] && !isRight(e)) ? "open" : ""}><summary>${bi("Why", "為什麼")}: ${e.phish ? bi("phishing", "釣魚信") : bi("a real email", "正常的信")}</summary>
      <section class="vd ${e.phish ? "vd-phish" : "vd-real"}">
      <div class="vd-meter" role="img" aria-label="Warning score ${e.score}, threshold ${d.threshold}">
        <div class="vd-bar">${segs}<span class="vd-tick" style="left:${(100 * d.threshold) / total}%"></span></div>
        <p>${bi(`Warning score ${e.score}. ${d.threshold} or more counts as phishing. The signs and their weights are the IT Assistant's, the ones it uses when you paste an email.`, `警訊分數 ${e.score}。${d.threshold} 分以上算釣魚信。警訊和權重跟把信貼給 IT 小幫手檢查時用的是同一套。`)}</p></div>
      ${list ? `<ol class="vd-signs">${list}</ol>` : `<p class="vd-none">${bi("No warning signs: the sender is who it says, the links stay on sites you know, and nobody asks for a password or a payment.", "沒有警訊：寄件者對得上，連結都在認得的網站，也沒有人要你的密碼或要你付錢。")}</p>`}
      ${who ? `<p class="rs-who">${bi(`Who could confirm it: ${who}`, `誰可以確認：${whoZh}`)}</p>` : ""}
      ${e.note_en ? `<p class="vd-note">${bi(e.note_en, e.note_zh)}</p>` : ""}
      ${steps}</section></details>`;
  }

  /* ------------------------------------------------------------------ the end of the shift */
  const rightCount = () => d.emails.filter(isRight).length;
  // one email in the "look at again" lists (dinner and results): the subject and each warning sign in both languages
  const missedLi = (e) => `<li><span class="g-pill">#${e.i + 1}</span> <b>${esc(e.subject)}</b>${e.subject_zh ? ` <span class="ph-subj-zh" lang="zh-Hant">${esc(subjZh(e, true))}</span>` : ""}
      <span class="${e.phish ? "t-much" : "t-ok"}">${e.phish ? bi("phishing", "釣魚信") : bi("a real email", "正常的信")}</span>
      ${e.note_en ? `<p>${bi(e.note_en, e.note_zh)}</p>` : e.signs.length ? `<p>${e.signs.map((s) => `${esc(signs[s.key].en)} <i lang="zh-Hant">${esc(signs[s.key].zh)}</i> “${esc(s.evidence)}”`).join(" · ")}</p>` : ""}</li>`;
  const callRight = () => (["right", "declined", "missed"].includes(S.call.result) ? 1 : 0);   // missed: nothing given away either

  function maybeEnd() {
    if (S.over || S.hold) return;
    if (d.emails.every((e) => S.answers[e.id]) && (!CALL || S.call.state === "done")) endShift();
  }

  async function endShift() {
    S.over = true;
    stopLoop();
    for (const g of $$(".rx-ghost")) g.remove();      // 11/23 review: an email still being dragged when the shift ends
    $rs.classList.remove("is-ringing");
    const from = S.clock;
    for (let k = 1; k <= 10; k++) { S.clock = from + ((TEND - from) * k) / 10; drawClock(); await wait(70); }
    await wait(500);
    dinner();
  }

  function dinner() {
    setScene("rush_stage", 0.2);
    const wrong = d.emails.filter((e) => !isRight(e));
    const left = S.shields;
    const notes = S.notes.length + Object.values(S.found).reduce((n, f) => n + f.size, 0);
    const callTxt = { right: bi("hung up and called back", "掛掉回撥確認"), declined: bi("declined", "拒接"), missed: bi("missed: nothing given away", "沒接到：什麼都沒給出去"), read: bi("read out the code", "念出了驗證碼") }[S.call.result] || "";
    $("#rsBody").innerHTML = `<section class="rs-dinner">
      <p class="rs-kicker">${bi(`${story.dinner || "19:00"} · Awards dinner`, "頒獎晚宴開始")}</p>
      <h2 class="rs-dinner-title">${left === sh.shields ? bi("Not one attack got through.", "沒有一次被歹徒得逞。") : bi(`You made it to dinner with ${left} shield${left > 1 ? "s" : ""}.`, `撐到開飯了，還剩 ${left} 面盾牌。`)}</h2>
      <div class="rx-stats rs-dinner-stats">
        <div><b>${rightCount()}/${d.emails.length}</b><span>${bi("emails right", "判斷正確的信")}</span></div>
        <div><b>${callRight() ? "✓" : "✗"}</b><span>${bi("the 18:52 call", "18:52 的電話")}</span><em class="rs-call-res">${callTxt}</em></div>
        <div><b class="rs-shields-row">${Array.from({ length: sh.shields }, (_, k) => ICON.shield(k < left)).join("")}</b><span>${bi("shields left", "剩下的盾牌")}</span></div>
        <div><b>${S.points.toLocaleString("en-US")}</b><span>${bi("points", "分")}</span></div>
        <div class="${S.ntd ? "is-hit" : ""}"><b>${money(S.ntd)}</b><span>${bi("losses", "損失")}</span></div></div>
      ${wrong.length ? `<details class="rs-dinner-wrong"><summary>${bi(`${wrong.length} email${wrong.length > 1 ? "s" : ""} to look at again`, `再看一次這 ${wrong.length} 封`)}</summary>
        <ul class="ph-missed">${wrong.map(missedLi).join("")}</ul></details>` : ""}
      ${mentorHTML(notes ? bi(`Good work tonight. Jun-Hao from the SOC wants you at the lighthouse at ${BOARD.time || "21:00"}. Bring your notebook: ${notes} entries.`, `今晚辛苦了。資安監控中心的俊豪請你 ${BOARD.time || "21:00"} 到燈塔一趟，線索簿記得帶著，裡面有 ${notes} 筆。`)
        : bi(`Good work tonight. Jun-Hao from the SOC wants you at the lighthouse at ${BOARD.time || "21:00"}. Your notebook is empty, but the SOC has pinned up everything they have.`, `今晚辛苦了。資安監控中心的俊豪請你 ${BOARD.time || "21:00"} 到燈塔一趟。你的線索簿是空的，不過他們已經把手上的資料都釘在板子上了。`))}
      <button type="button" class="btn rs-start rs-to-board">${bi("Go to the lighthouse", "去燈塔")}</button></section>`;
    G.meter(`<div class="rx-hud"><div class="rx-hud-clock"><b>${esc(story.dinner || "19:00")}</b><span>${bi("dinner", "開飯")}</span></div><div class="rx-hud-pts"><b>${S.points.toLocaleString("en-US")}</b><span>${bi("points", "分")}</span></div></div>`);
    $(".rs-to-board").addEventListener("click", async (ev) => {
      // 11/26 (front-end review C01): Enter again during the time skip doesn't start a second skip and a second board
      const b = ev.currentTarget; if (b.disabled) return; b.disabled = true;
      await CB.timeskip(stage, { from: story.dinner || "19:00", to: BOARD.time || "21:00", place_en: "The SOC at the lighthouse", place_zh: "燈塔的資安監控中心", day_en: "Awards Night", day_zh: "頒獎晚會" });
      startBoard();
    });
    window.scrollTo({ top: 0, behavior: reduceMotion ? "auto" : "smooth" });
  }

  function gameOver() {
    S.over = true;
    stopLoop();
    for (const g of $$(".rx-ghost")) g.remove();
    $rs.classList.remove("is-ringing", "is-paused");
    setScene("rush_pos", 0);
    const lost = S.losses.map((x) => `<li>${bi(x.damage.en, x.damage.zh)}${x.damage.ntd ? ` <b>${money(x.damage.ntd)}</b>` : ""}</li>`).join("");
    const pos = S.losses.some((x) => x.damage && x.damage.inset === "ransom");      // only the voucher email leads to the POS
    // 11/26 (front-end review K34): the count comes from the list below it, not a fixed "three"
    const n = S.losses.length, nEn = ["No", "One", "Two", "Three", "Four", "Five"][n] || String(n), nZh = ["零", "一", "兩", "三", "四", "五"][n] || ` ${n} `;
    const gotEn = `${nEn} attack${n === 1 ? "" : "s"} got through.`, gotZh = `被得逞了${nZh}次。`;
    $("#rsBody").innerHTML = `<section class="rs-over">
      ${pos ? `<img class="rs-ransom" src="/lakeside/static/games/img/ransom.png" alt="Ransom note on the restaurant POS 收銀機上的勒索畫面">` : ""}
      <div class="rs-over-text"><p class="rs-over-time">${pos ? "21:58" : esc(hhmm(S.clock))}</p>
        <h2>${pos ? bi(`${gotEn} The restaurant POS shows a ransom note.`, `${gotZh}餐廳收銀機跳出勒索畫面。`) : bi(gotEn, gotZh)}</h2>
        <ul class="rx-loss-list">${lost}</ul>
        <p>${bi("Your shift is over before dinner. Try again: open the risky ones, call when you are unsure, and watch the fuses.", "還沒開飯這班就結束了。再試一次：可疑的先打開看，不確定就打電話，注意導火線。")}</p>
        <div class="g-end-actions"><button type="button" class="btn rs-again">${bi("Try the shift again", "重新值班")}</button>
          <a class="btn btn-ghost" href="${G.backHref}">${bi("Back to the tour", "回到導覽")}</a></div></div></section>`;
    $(".rs-again").addEventListener("click", () => Games.phish(d, main, true));
    $(".rs-over .btn-ghost").addEventListener("click", G.back);
    window.scrollTo({ top: 0, behavior: reduceMotion ? "auto" : "smooth" });
    G.meter(`<div class="rx-hud"><div class="rx-hud-pts"><b>${S.points.toLocaleString("en-US")}</b><span>${bi("points", "分")}</span></div></div>`);
  }

  /* ------------------------------------------------------------------ the case board at the lighthouse */
  function startBoard() {
    B = { looked: new Set(), sel: new Set(), q: 0, wrong: QS.map(() => 0), solved: QS.map(() => false), pts: 0, step: 0, tried: {}, logSel: new Set(), strings: [] };
    setScene(BOARD.scene || "rush_fw", 0.12);
    const an = BOARD.analyst || {};
    $("#rsBody").innerHTML = `<section class="cb">
      <div class="cb-main">
        <div class="cb-frame"><div class="cb-cork" id="cbCork">
          <div class="cb-cards" id="cbCards">${d.emails.map(cardHTML).join("")}</div>
          <div class="cb-side" id="cbSide">${crewHTML()}<div class="cb-notes" id="cbNotes">${notesHTML()}</div><div id="cbLedgerSlot"></div></div>
          <div id="cbLogSlot"></div>
          <svg class="cb-strings" id="cbStrings" aria-hidden="true"></svg>
        </div></div>
        <aside class="cb-right">
          <div class="cb-head">${analystPortrait()}<div class="cb-head-text"><p class="rx-mentor-name">${esc(an.name || "")} · ${esc(an.role_en || "")} <span lang="zh-Hant">${esc(an.role_zh || "")} ${esc(an.name_zh || "")}</span></p>
            <p class="rx-say cb-say" id="cbSay" aria-live="polite">${bi(BOARD.intro_en || "", BOARD.intro_zh || "")}</p></div></div>
          <div class="cb-qs" id="cbQs" aria-label="Case questions"></div></aside>
      </div></section>`;
    $("#cbCards").addEventListener("click", cardClick);
    // 11/22: keyboard players pick a card too: Enter or Space on the card itself (its Read and Look up buttons work as buttons)
    $("#cbCards").addEventListener("keydown", (ev) => {
      if ((ev.key !== "Enter" && ev.key !== " ") || !ev.target.classList || !ev.target.classList.contains("cb-card")) return;
      ev.preventDefault();
      cardClick({ target: ev.target });
    });
    $("#cbNotes").addEventListener("click", (ev) => { const n = ev.target.closest(".cb-note"); if (n) present("note:" + n.dataset.n); });
    boardHud();
    renderQs();
    window.scrollTo({ top: 0, behavior: reduceMotion ? "auto" : "smooth" });
  }

  function boardHud(pop) {
    G.meter(`<div class="rx-hud"><div class="rx-hud-clock"><b>${esc(BOARD.time || "21:00")}</b><span>${bi("lighthouse", "燈塔")}</span></div>
      <div class="rx-hud-pts"><b id="hudPts">${(S.points + B.pts).toLocaleString("en-US")}</b><span>${bi("points", "分")}</span></div>
      <div class="rx-hud-qs"><b>${B.solved.filter(Boolean).length}/${QS.length}</b><span>${bi("solved", "破案")}</span></div></div>`);
    if (pop) { const n = el("span", "rx-pop", "+" + pop); $("#hudPts").parentElement.appendChild(n); setTimeout(() => n.remove(), 1200); }
  }

  function cbSay(html, mood) {
    const b = $("#cbSay");
    if (!b) return;
    b.innerHTML = html;
    b.classList.remove("is-bump", "is-good", "is-no"); void b.offsetWidth;
    b.classList.add("is-bump"); if (mood) b.classList.add(mood);
  }

  function cardHTML(e) {
    const dom = domainOf(e.from_addr), user = e.from_addr.slice(0, e.from_addr.length - dom.length);
    const a = S.answers[e.id], opened = S.how[e.id] === "opened";
    const st = opened ? ["is-opened", "OPENED", "被點開"] : a === "report" ? ["is-report", "REPORTED", "已回報"] : ["is-keep", "KEPT", "留著"];
    const rot = [-1.6, 1.1, -0.6, 1.4, -1.2, 0.7, -0.9, 1.5, -0.4][e.i] || 0;
    // 11/22: the card itself takes the keyboard (Tab to it, Enter or Space = a click on the card), for picking it in a question.
    // It is a group (it holds its own buttons), and the face turned away is inert, so Tab skips that face's buttons (flip()).
    return `<div class="cb-card" data-id="${e.id}" style="--r:${rot}deg" tabindex="0" role="group" aria-label="${esc(`#${e.i + 1} ${e.from_name}: ${plainSubj(e)}`)}">
      <div class="cb-card-in">
        <div class="cb-face cb-front">
          <i class="cb-pin" aria-hidden="true"></i>
          <p class="cb-meta"><b>#${e.i + 1}</b><time>${esc(e.time)}</time><span class="cb-stamp ${st[0]}">${st[1]}<small>${st[2]}</small></span></p>
          <p class="cb-from">${esc(e.from_name)}</p>
          <p class="cb-addr">${esc(user)}<b>${esc(dom)}</b></p>
          <p class="cb-subj">${esc(plainSubj(e))}</p>${e.subject_zh ? `<p class="cb-subj-zh" lang="zh-Hant">${esc(subjZh(e))}</p>` : ""}
          <div class="cb-btns"><button type="button" data-act="read">${bi("Read", "看信")}</button><button type="button" data-act="look">${bi("Look up", "查網域")}</button></div>
        </div>
        <div class="cb-face cb-back" inert><i class="cb-pin" aria-hidden="true"></i>${whoisHTML(dom)}<button type="button" class="cb-flip" data-act="flip">${bi("Flip back", "翻回正面")}</button></div>
      </div></div>`;
  }

  function whoisHTML(dom) {
    const w = (BOARD.whois || {})[dom];
    if (!w) return `<div class="cb-whois"><p class="cb-wdom">${esc(dom)}</p><p>${bi("No record found.", "查不到資料。")}</p></div>`;
    if (w.free) return `<div class="cb-whois is-free"><p class="cb-wdom">${esc(dom)}</p><p class="cb-wfree">${bi(w.en, w.zh)}</p></div>`;
    return `<div class="cb-whois"><p class="cb-wdom">${esc(dom)}</p><dl>
      <dt>${bi("Created", "建立")}</dt><dd>${esc(w.created)}</dd>
      <dt>${bi("Registrant", "註冊人")}</dt><dd>${esc(w.registrant)}${w.registrant_zh ? `<span lang="zh-Hant">${esc(w.registrant_zh)}</span>` : ""}</dd>
      <dt>${bi("Name servers", "名稱伺服器")}</dt><dd>${(w.ns || []).map(esc).join("<br>")}</dd>
      <dt>${bi("Server IP", "伺服器 IP")}</dt><dd class="cb-ip">${esc(w.ip)}</dd></dl></div>`;
  }

  function crewHTML() {
    return `<div class="cb-crew" id="cbCrew"><i class="cb-pin" aria-hidden="true"></i>
      <svg class="cb-crew-face" viewBox="0 0 60 60" aria-hidden="true"><rect width="60" height="60" rx="4" fill="#2b2421"/>
        <circle cx="30" cy="24" r="11" fill="#5b4f49"/><path d="M10 60c2-14 10-21 20-21s18 7 20 21z" fill="#5b4f49"/>
        <text x="30" y="29" text-anchor="middle" font-size="15" font-weight="700" fill="#d8bd77" font-family="Bahnschrift, Segoe UI, sans-serif">?</text></svg>
      <p class="cb-crew-name" id="cbCrewName">${bi("Who sent tonight's emails?", "今晚的信是誰寄的？")}</p>
      <ul class="cb-crew-facts" id="cbCrewFacts"></ul></div>`;
  }

  function crewFact(en, zh) {
    $("#cbCrewName").innerHTML = bi("The crew", "同一夥人");
    $("#cbCrew").classList.add("is-known");
    $("#cbCrewFacts").insertAdjacentHTML("beforeend", `<li class="is-new">${bi(en, zh)}</li>`);
  }

  function notesHTML() {
    if (!S.notes.length) return `<div class="cb-note is-empty" data-n="-1">${bi("No phone notes from tonight.", "今晚沒有電話紀錄。")}</div>`;
    return S.notes.map((n, k) => `<button type="button" class="cb-note" data-n="${k}" style="--r:${[1.8, -2.2, 1.2, -1.4][k % 4]}deg">
      <span class="cb-note-who">${ICON.phone}<span>${bi(n.who, n.who_zh)}</span></span><span class="cb-note-said">“${esc(n.en)}”</span><span class="cb-note-zh" lang="zh-Hant">${esc(n.zh)}</span></button>`).join("");
  }

  function ledgerHTML() {
    const L = BOARD.ledger || {};
    return `<div class="cb-doc cb-ledger is-pinned" id="cbLedger"><i class="cb-pin" aria-hidden="true"></i>
      <p class="cb-doc-title">${bi(L.title_en || "", L.title_zh || "")}<small>${esc(L.printed || "")}${L.printed_zh ? ` <i lang="zh-Hant">${esc(L.printed_zh)}</i>` : ""}</small></p>
      <ul class="cb-ledger-rows">${(L.rows || []).map((r) => `<li data-inv="${esc(r.inv)}"><b>${esc(r.inv)}</b><span class="num">NT$ ${r.amount.toLocaleString("en-US")}</span>
        <i>${esc(r.supplier)} · ${bi(`due ${r.due}`, `${r.due_zh || r.due} 到期`)}</i></li>`).join("")}</ul></div>`;
  }

  /* The log: the base lines plus a line for each trap that got through during the shift. 11/23 review: when a fuse ran out
     and a colleague opened it, the line is the colleague's own account (games.yaml log.opened), so question 3 and the
     closing card's "accounts the crew still holds" include it; when you kept it, the line is yours (log.you). */
  function logRows() {
    const L = BOARD.log || {}, you = L.you || {}, opened = L.opened || {}, rows = (L.rows || []).map((r) => Object.assign({ mine: false }, r));
    for (const id of new Set([...Object.keys(you), ...Object.keys(opened)])) {
      if (id === "call" || S.answers[id] !== "keep") continue;
      const theirs = S.how[id] === "opened", r = theirs ? opened[id] : you[id];
      if (r) rows.push(Object.assign({ mine: !theirs }, r));
    }
    if (you.call && S.call.result === "read") rows.push(Object.assign({ mine: true }, you.call));
    rows.sort((a, b) => mins(a.t) - mins(b.t));
    return rows.map((r, k) => Object.assign(r, { k }));
  }

  function logHTML() {
    const L = BOARD.log || {};
    B.rows = logRows();
    return `<div class="cb-doc cb-log is-pinned" id="cbLog"><i class="cb-pin" aria-hidden="true"></i><i class="cb-pin is-r" aria-hidden="true"></i>
      <p class="cb-doc-title">${bi(L.title_en || "", L.title_zh || "")}</p>
      <ol class="cb-log-rows">${B.rows.map((r) => `<li><button type="button" class="cb-log-row${r.mine ? " is-mine" : ""}" data-k="${r.k}" aria-pressed="false">
        <time>${esc(r.t)}</time><span class="cb-log-site">${esc(r.site)}${r.site_zh ? ` <i lang="zh-Hant">${esc(r.site_zh)}</i>` : ""}</span><span class="cb-log-dev">${bi(r.dev_en, r.dev_zh)}</span>
        <span class="cb-log-what">${bi(r.en, r.zh)}</span></button></li>`).join("")}</ol></div>`;
  }

  function cardClick(ev) {
    const card = ev.target.closest(".cb-card");
    if (!card) return;
    const id = card.dataset.id, actEl = ev.target.closest("[data-act]"), act = actEl && actEl.dataset.act;
    if (act === "look") return flip(card, true);
    if (act === "flip") return flip(card, false);
    if (act === "read") return reader(id);
    const q = QS[B.q];
    if (q && !B.solved[B.q] && q.kind === "cards") return toggleSel(card);
    if (q && !B.solved[B.q] && q.kind === "choose" && B.step === 1) return present(id);
    if (card.classList.contains("is-flipped")) return flip(card, false);
    reader(id);
  }

  function flip(card, on) {
    // 11/22: the face turned away is inert, so Tab skips its buttons; a button that had the keyboard hands it to the other face
    const a = document.activeElement, had = a !== card && card.contains(a);
    card.classList.toggle("is-flipped", on);
    $(".cb-front", card).toggleAttribute("inert", on);
    $(".cb-back", card).toggleAttribute("inert", !on);
    if (had) $(on ? '.cb-back [data-act="flip"]' : '.cb-front [data-act="look"]', card).focus({ preventScroll: true });
    if (on) B.looked.add(card.dataset.id);
    setTimeout(drawStrings, reduceMotion ? 0 : 650);
  }

  function toggleSel(card) {
    const id = card.dataset.id;
    if (B.sel.has(id)) B.sel.delete(id); else B.sel.add(id);
    card.classList.toggle("is-sel", B.sel.has(id));
    renderQs();
  }

  /* The question cards on the right: solved ones get a stamp, the next one opens, the rest wait. */
  function renderQs() {
    const box = $("#cbQs");
    box.innerHTML = `<h2 class="cb-qs-title">${bi("Case questions", "推理題")}</h2>` + QS.map((q, i) => {
      if (B.solved[i]) return `<section class="cb-q is-solved"><p class="cb-q-n">${bi(`Question ${i + 1}`, `第 ${i + 1} 題`)}<span class="cb-q-stamp">SOLVED<small>破案</small></span></p>
        <p class="cb-q-text">${bi(q.en, q.zh)}</p></section>`;
      if (i !== B.q) return `<section class="cb-q is-locked"><p class="cb-q-n">${bi(`Question ${i + 1}`, `第 ${i + 1} 題`)}</p><p class="cb-q-lock">${bi("Opens when the one above is solved.", "解開上一題才會打開。")}</p></section>`;
      return `<section class="cb-q is-active" id="cbQ"><p class="cb-q-n">${bi(`Question ${i + 1}`, `第 ${i + 1} 題`)}</p>
        <p class="cb-q-text">${bi(q.en, q.zh)}</p>${q.how_en ? `<p class="cb-q-how">${bi(q.how_en, q.how_zh)}</p>` : ""}${controls(q)}</section>`;
    }).join("");
    if (QS.length && B.solved.every(Boolean)) CB.addClose(wrapUp);      // 11/26 (front-end review K31): a redraw after the last solve keeps "Close the case"
    const q = QS[B.q];
    if (!q || B.solved[B.q]) return;
    $("#cbCork").classList.toggle("is-picking", q.kind === "cards");
    $("#cbCork").classList.toggle("is-presenting", q.kind === "choose" && B.step === 1);
    if (q.kind === "cards") $("#cbGo").addEventListener("click", () => checkCards(q));
    if (q.kind === "choose") for (const b of $$(".cb-opt", box)) b.addEventListener("click", () => choose(q, b.dataset.k));
    if (q.kind === "log") $("#cbGo").addEventListener("click", () => checkLog(q));
  }

  function controls(q) {
    if (q.kind === "cards") {
      const sel = [...B.sel].map((id) => byId[id]).sort((a, b) => a.i - b.i);
      return `<p class="cb-q-sel">${sel.length ? sel.map((e) => `<span class="g-pill">#${e.i + 1}</span>`).join(" ") : bi("Nothing picked yet.", "還沒選。")}</p>
        <button type="button" class="btn cb-go" id="cbGo"${sel.length >= 2 ? "" : " disabled"}>${bi("Connect them", "把它們連起來")}</button>`;
    }
    if (q.kind === "choose") {
      if (B.step === 1) {
        const o = q.options.find((x) => x.k === q.answer);
        return `<p class="cb-q-chosen">${bi(o.en, o.zh)}</p><p class="cb-q-how is-next">${bi(q.evidence_en, q.evidence_zh)}</p>`;
      }
      return `<div class="cb-opts">${q.options.map((o) => `<button type="button" class="cb-opt${B.tried[o.k] ? " is-tried" : ""}" data-k="${esc(o.k)}"${B.tried[o.k] ? " disabled" : ""}>${bi(o.en, o.zh)}</button>`).join("")}</div>`;
    }
    if (q.kind === "log") {
      return `<p class="cb-q-sel">${B.logSel.size ? bi(`${B.logSel.size} line${B.logSel.size > 1 ? "s" : ""} marked`, `標了 ${B.logSel.size} 行`) : bi("No lines marked yet.", "還沒標任何一行。")}</p>
        <button type="button" class="btn cb-go" id="cbGo"${B.logSel.size ? "" : " disabled"}>${bi("Reset these accounts", "重設這些帳號")}</button>`;
    }
    return "";
  }

  function nope() {
    CB.SFX.play("bad");
    B.wrong[B.q] += 1;
    const q = $("#cbQ");
    if (q && !reduceMotion) { q.classList.remove("is-shake"); void q.offsetWidth; q.classList.add("is-shake"); }
  }

  function checkCards(q) {
    const ans = new Set(q.answer), sel = [...B.sel];
    const extra = sel.filter((x) => !ans.has(x)), missing = q.answer.filter((x) => !B.sel.has(x));
    if (!extra.length && !missing.length) return solve(q);
    nope();
    let m;
    if (B.looked.size < 3) m = [q.unlooked_en, q.unlooked_zh];
    else if (extra.length) {
      const e = byId[extra[0]], w = (BOARD.whois || {})[domainOf(e.from_addr)] || {};
      m = [fill(w.free ? q.free_en : q.legit_en, { n: e.i + 1 }), fill(w.free ? q.free_zh : q.legit_zh, { n: e.i + 1 })];
    } else if (missing.length === 1) {
      const created = (id) => ((BOARD.whois || {})[domainOf(byId[id].from_addr)] || {}).created || "";
      const earliest = q.answer.slice().sort((a, b) => created(a).localeCompare(created(b)))[0];
      m = missing[0] === earliest ? [q.near_en, q.near_zh] : [q.compare_en, q.compare_zh];
    } else m = [q.compare_en, q.compare_zh];
    cbSay(bi(m[0], m[1]), "is-no");
  }

  function choose(q, k) {
    if (k === q.answer) {
      B.step = 1;
      cbSay(bi(q.evidence_en, q.evidence_zh), "is-good");
      renderQs();
      return CB.refocus("#cbCards .cb-card");      // 11/22: the reasons are gone, so the keyboard goes on to the cards (show the proof)
    }
    const o = q.options.find((x) => x.k === k);
    B.tried[k] = true;
    renderQs();          // 11/26 (front-end review K46): re-render first, or the new card replaces the shaking one
    nope();
    cbSay(bi(o.why_en || "", o.why_zh || ""), "is-no");
    CB.refocus("#cbQ .cb-opt:not([disabled])");    // the one just tried is disabled now: the next reason
  }

  function present(what) {
    const q = QS[B.q];
    if (!q || B.solved[B.q] || q.kind !== "choose" || B.step !== 1) return;
    // 11/22: the empty note ("no phone notes from tonight") is not a wrong answer, only a hint
    if (what === "note:-1") return cbSay(bi("That note is empty: you made no calls tonight. Show me a card instead.", "那張便條是空的：今晚沒打過電話。改出示一張卡片。"), "is-no");
    let ok = what === q.evidence;
    if (what.startsWith("note:")) {
      const n = S.notes[+what.slice(5)];
      // only Ocean Fresh can say whether Ocean Fresh sent it; Accounts' answer about #9 proves nothing about their mailbox
      if (n && n.email === q.evidence && n.contact !== "oceanfresh") { nope(); return cbSay(bi("Accounts can't tell whether Ocean Fresh sent it. Only Ocean Fresh can.", "會計沒辦法知道那封是不是 Ocean Fresh 寄的，只有 Ocean Fresh 自己知道。"), "is-no"); }
      ok = !!n && n.email === q.evidence;
    }
    if (ok) return solve(q, what);
    nope();
    cbSay(bi(q.wrong_evidence_en, q.wrong_evidence_zh), "is-no");
  }

  function checkLog(q) {
    const sel = B.rows.filter((r) => B.logSel.has(r.k)), secret = B.rows.filter((r) => r.kind === "secret");
    const bad = sel.filter((r) => r.kind !== "secret"), miss = secret.filter((r) => !B.logSel.has(r.k));
    if (!bad.length && !miss.length) return solve(q);
    nope();
    const m = bad.some((r) => r.kind === "open") ? [q.open_en, q.open_zh] : bad.length ? [q.address_en, q.address_zh] : [q.missing_en, q.missing_zh];
    cbSay(bi(m[0], m[1]), "is-no");
  }

  function solve(q, evidence) {
    const i = B.q;
    B.solved[i] = true;
    CB.solvedFx();
    const pts = Math.max(P.qMin, P.q - P.qWrong * B.wrong[i]);
    B.pts += pts;
    $("#cbCork").classList.remove("is-picking", "is-presenting");
    if (q.kind === "cards") {
      for (const id of q.answer) B.strings.push([`.cb-card[data-id="${id}"] .cb-front .cb-pin`, "#cbCrew .cb-pin", true]);
      for (const c of $$(".cb-card.is-sel")) c.classList.remove("is-sel");
      for (const id of q.answer) $(`.cb-card[data-id="${id}"]`).classList.add("is-crew");
      const w = (BOARD.whois || {})[domainOf(byId[q.answer[0]].from_addr)] || {};
      crewFact(`${q.answer.length} look-alike domains · ${w.ip || ""}`, `${q.answer.length} 個仿冒網域・${w.ip || ""}`);
    } else if (q.kind === "choose") {
      const ev = evidence && evidence.startsWith("note:") ? `.cb-note[data-n="${evidence.slice(5)}"]` : `.cb-card[data-id="${q.evidence}"] .cb-front .cb-pin`;
      B.strings.push([`.cb-card[data-id="e5"] .cb-front .cb-pin`, "#cbLedger .cb-pin", true]);
      B.strings.push([ev, "#cbCrew .cb-pin", true]);
      $(`.cb-card[data-id="${q.evidence}"]`).classList.add("is-crew");
      const inv = ((BOARD.ledger || {}).rows || []).find((r) => q.en.includes(r.inv));
      const row = inv && $(`#cbLedger li[data-inv="${inv.inv}"]`); if (row) row.classList.add("is-hl");
      crewFact("Inside Ocean Fresh's mailbox", "在 Ocean Fresh 的信箱裡");
    } else if (q.kind === "log") {
      for (const r of $$(".cb-log-row")) if (B.logSel.has(+r.dataset.k)) r.classList.add("is-ok");
      B.strings.push(["#cbLog .cb-pin", "#cbCrew .cb-pin", true]);
      const who = [...new Set(B.rows.filter((r) => r.kind === "secret").map((r) => r.who))];
      crewFact(`Now holds ${who.length} accounts`, `手上有 ${who.length} 個帳號`);
    }
    boardHud(pts);
    const n = q.kind === "log" ? new Set(B.rows.filter((r) => r.kind === "secret").map((r) => r.who)).size : 0;
    cbSay(bi(fill(q.solved_en, { n }), fill(q.solved_zh, { n })), "is-good");
    B.q = i + 1; B.step = 0;
    const next = QS[B.q];
    if (next && next.kind === "choose") $("#cbLedgerSlot").innerHTML = ledgerHTML();
    if (next && next.kind === "log") {
      $("#cbLogSlot").innerHTML = logHTML();
      for (const r of $$(".cb-log-row")) r.addEventListener("click", () => {
        const k = +r.dataset.k;
        // 11/26 (front-end review K31): once the log question is solved B.q moves past it, so check the question itself
        const cq = QS[B.q];
        if (!cq || cq.kind !== "log" || B.solved[B.q]) return;
        if (B.logSel.has(k)) B.logSel.delete(k); else B.logSel.add(k);
        r.classList.toggle("is-marked", B.logSel.has(k)); r.setAttribute("aria-pressed", String(B.logSel.has(k)));
        renderQs();
      });
    }
    renderQs();
    requestAnimationFrame(() => drawStrings());
    if (B.solved.every(Boolean)) CB.addClose(wrapUp);      // 11/26 (front-end review K31): renderQs() adds it too, addClose never adds a second one
    CB.refocus("#cbQ .cb-opt:not([disabled]), #cbQs .cb-close");      // 11/22: solved with a button the redraw took away
  }

  /* Red string from pin to pin, sagging a little, drawn in when it is new. */
  function drawStrings() {
    const svg = $("#cbStrings"), cork = $("#cbCork");
    if (!svg || !cork || !B) return;
    const R = cork.getBoundingClientRect(), k = G.k();
    svg.setAttribute("viewBox", `0 0 ${R.width} ${R.height}`);
    svg.setAttribute("width", R.width / k); svg.setAttribute("height", R.height / k);
    const at = (sel) => { const n = $(sel, cork); if (!n) return null; const r = n.getBoundingClientRect(); return { x: r.left + r.width / 2 - R.left, y: r.top + r.height / 2 - R.top }; };
    svg.innerHTML = B.strings.map(([a, b, fresh], k) => {
      const p = at(a), q = at(b);
      if (!p || !q) return "";
      const sag = Math.min(70, Math.hypot(q.x - p.x, q.y - p.y) * 0.12);
      const dd = (o) => `M${(p.x + o).toFixed(1)} ${(p.y + o * 2).toFixed(1)} Q${((p.x + q.x) / 2 + o).toFixed(1)} ${((p.y + q.y) / 2 + sag + o * 2).toFixed(1)} ${(q.x + o).toFixed(1)} ${(q.y + o * 2).toFixed(1)}`;
      return `<path class="cb-str-sh" d="${dd(1)}"/><path class="cb-str${fresh ? " is-fresh" : ""}" data-k="${k}" d="${dd(0)}"/>`;
    }).join("");
    for (const path of $$(".cb-str.is-fresh", svg)) {
      const len = path.getTotalLength();
      if (reduceMotion) continue;
      path.style.strokeDasharray = `${len}`; path.style.strokeDashoffset = `${len}`;
      path.getBoundingClientRect();
      path.style.transition = "stroke-dashoffset 1.1s ease-out"; path.style.strokeDashoffset = "0";
    }
    for (const s of B.strings) s[2] = false;
  }

  /* Read a card in full: the email as it was on the laptop, with the tells you found ringed and the rest dashed. */
  function reader(id) {
    const e = byId[id];
    const back = document.activeElement;      // 11/22: closing gives the keyboard back here (the card's Read button), not to the page
    const box = el("div", "cb-reader");
    box.setAttribute("role", "dialog"); box.setAttribute("aria-label", `Email ${e.i + 1}`);
    box.innerHTML = `<div class="cb-reader-paper rx-done" id="cbPaper"><button type="button" class="rs-x cb-reader-x" aria-label="Close">×</button>
      <p class="cb-reader-n">#${e.i + 1} · ${esc(e.time)}</p>${mailHTML(e)}${debrief(e, false)}</div>`;
    $("#rsBody").appendChild(box);
    const art = $(".mail", box);
    wrapTells(art, e);
    links(box);
    for (const k of S.found[id] || []) for (const x of $$(`.tell[data-k="${k}"]`, box)) x.classList.add("is-found");
    const close = () => {
      box.remove(); document.removeEventListener("keydown", esc2);
      if (back && back !== document.body && back.isConnected) back.focus({ preventScroll: true });
    };
    const esc2 = (ev) => { if (ev.key === "Escape") { ev.preventDefault(); close(); } };      // 11/23: handled here, so it doesn't also close the game window (common.js)
    document.addEventListener("keydown", esc2);
    $(".cb-reader-x", box).addEventListener("click", close);
    box.addEventListener("click", (ev) => { if (ev.target === box) close(); });
    $(".cb-reader-x", box).focus({ preventScroll: true });
  }

  /* ------------------------------------------------------------------ case closed: real cases from the graph, then the results */
  function wrapUp() {
    const why = BOARD.case_why || {};
    const cases = (d.cases || []).map((c) => `<article class="cb-case"><p class="cb-case-year">${esc(c.year || "")}</p>
      <h3>${bi(c.name_en, c.name_zh)}</h3><p class="cb-case-d">${bi(c.desc_en || "", c.desc_zh || "")}</p>
      ${why[c.key] ? `<p class="cb-case-why">${bi(why[c.key].en, why[c.key].zh)}</p>` : ""}
      ${c.lesson_en ? `<p class="cb-case-lesson"><b>${bi("Lesson", "教訓")}</b> ${bi(c.lesson_en, c.lesson_zh)}</p>` : ""}</article>`).join("");
    const who = [...new Set(B.rows.filter((r) => r.kind === "secret").map((r) => r.who))], acc = BOARD.accounts || {};
    const proc = d.procedures.proc_phish_clicked, step = proc ? proc.steps.find((x) => x.who === "helpdesk_technician") : null;
    const box = el("div", "cb-closed");
    box.setAttribute("role", "dialog"); box.setAttribute("aria-label", "Case closed");
    box.innerHTML = `<div class="cb-closed-card"><div class="cb-closed-l"><p class="cb-closed-stamp">CASE CLOSED<small>今晚結案</small></p>
      <p class="cb-closed-wrap">${bi(BOARD.wrap_en || "", BOARD.wrap_zh || "")}</p>
      <h3 class="cb-cases-title">${bi("Accounts the crew still holds", "還在歹徒手上的帳號")}</h3>
      <ul class="cb-accounts is-wide">${who.map((w) => `<li><b>${esc(w)}</b>${acc[w] ? bi(acc[w].en, acc[w].zh) : ""}</li>`).join("")}</ul>
      ${step ? `<p class="cb-proc">${bi(step.text_en, step.text_zh)}<small>${bi(`From “${proc.name_en}” in the knowledge graph`, `出自知識圖的流程「${proc.name_zh}」`)}</small></p>` : ""}</div>
      <div class="cb-closed-r"><h3 class="cb-cases-title">${bi("The same moves in real cases", "真實案例裡的同一招")}<small>${bi("From the knowledge graph", "出自知識圖")}</small></h3>
      <div class="cb-cases">${cases}</div>
      <button type="button" class="btn cb-results">${bi("See my results", "看結果")}</button></div></div>`;
    $("#rsBody").appendChild(box);
    $(".cb-results", box).addEventListener("click", () => { box.remove(); finale(); });
    $(".cb-results", box).focus({ preventScroll: true });
    cbSay(bi("That's the case for tonight. Thanks, partner.", "今晚的案子就到這裡，謝啦，搭檔。"), "is-good");
  }

  function finale() {
    const shiftOk = rightCount(), callOk = callRight(), firstTry = B.wrong.filter((w, i) => B.solved[i] && w === 0).length;
    const score = shiftOk + callOk + firstTry;
    const ranks = (story.ranks || []).slice().sort((x, y) => y.min - x.min);
    const rank = ranks.find((r) => score >= r.min) || { key: "bronze", en: "Trainee", zh: "實習生", line_en: "", line_zh: "" };
    G.save(score, TOTAL);
    const spotted = Object.values(S.found).reduce((n, f) => n + f.size, 0);
    const wrong = d.emails.filter((e) => !isRight(e));
    const missed = wrong.length ? `<h2>${bi("The ones to look at again", "再看一次這幾封")}</h2><ul class="ph-missed">${wrong.map(missedLi).join("")}</ul>` : "";
    const seen = {};
    for (const e of d.emails.filter((x) => x.phish)) for (const s of e.signs) (seen[s.key] ||= []).push(e.i + 1);
    const rows = d.signs.map((g) => `<tr><td>${bi(g.en, g.zh)}</td><td class="num">+${g.w}</td><td>${(seen[g.key] || []).map((n) => `<span class="g-pill">#${n}</span>`).join(" ") || "—"}</td></tr>`).join("");
    const losses = S.losses.length ? `<ul class="rx-loss-list">${S.losses.map((x) => `<li>${bi(x.damage.en, x.damage.zh)}${x.damage.ntd ? ` <b>${money(x.damage.ntd)}</b>` : ""}</li>`).join("")}</ul>` : "";
    const nextName = { access: ["Who May Use What?", "誰能用什麼"], mfa: ["The MFA Door", "多因素驗證門"], ir: ["Incident Response", "事件應變"] }[BOARD.next] || null;
    const box = el("div", "rs-finale");
    box.appendChild(G.done(`<div class="rx-report">
      <div class="rx-medal-wrap">${medal(rank.key)}</div>
      <div><p class="rs-kicker">${bi("Awards Night · case file 1", "頒獎晚會事件簿・第一案")}</p><p class="rx-rank">${bi(rank.en, rank.zh)}</p><p class="g-end-lead">${bi(rank.line_en || "", rank.line_zh || "")}</p></div>
      <div class="rx-score"><b>${score}</b><span>/ ${TOTAL}</span><small>${bi("case score", "本案分數")}</small></div></div>
      <div class="rx-stats">
        <div><b>${(S.points + B.pts).toLocaleString("en-US")}</b><span>${bi("points", "分")}</span></div>
        <div><b>${shiftOk}/${d.emails.length}</b><span>${bi("emails right", "判斷正確的信")}</span></div>
        <div><b>${callOk ? "✓" : "✗"}</b><span>${bi("the 18:52 call", "18:52 的電話")}</span></div>
        <div><b>${S.shields}/${sh.shields}</b><span>${bi("shields left", "剩下的盾牌")}</span></div>
        <div><b>${spotted}/${totalTells}</b><span>${bi("tells spotted", "找到的線索")}</span></div>
        <div><b>${firstTry}/${QS.length}</b><span>${bi("solved first try", "一次就解開")}</span></div>
      </div>
      ${losses}${missed}
      ${nextName ? `<a class="rs-next-case" href="/lakeside/games/${esc(BOARD.next)}"><span class="rs-kicker">${bi("Next case file", "下一個案件")}</span>
        <b>${bi(nextName[0], nextName[1])}</b><span>${bi(BOARD.next_en || "", BOARD.next_zh || "")}</span></a>` : ""}
      <details class="rx-signs-all"><summary>${bi("The warning signs, and where they appeared", "警訊和它們出現在哪幾封信")}</summary>
      <table class="g-table"><thead><tr><th>${bi("Sign", "警訊")}</th><th class="num">${bi("Weight", "權重")}</th><th>${bi("Emails", "信件")}</th></tr></thead><tbody>${rows}</tbody></table></details>`,
      () => Games.phish(d, main, true)));
    B = null;
    $("#rsBody").innerHTML = "";
    $("#rsBody").appendChild(box);
    setScene(BOARD.scene || "rush_fw", 0.35);
    if (rank.key === "gold") confetti();
    G.meter(`<div class="rx-hud"><div class="rx-hud-pts"><b>${score}/${TOTAL}</b><span>${bi("case score", "本案分數")}</span></div></div>`);
    window.scrollTo({ top: 0, behavior: reduceMotion ? "auto" : "smooth" });
  }

  function confetti() {
    if (reduceMotion) return;
    const box = el("div", "rs-confetti");
    const cols = ["#d8bd77", "#b08a3e", "#e2eeec", "#a83a28", "#176473"];
    for (let i = 0; i < 70; i++) {
      const p = el("i");
      p.style.left = `${(i * 37) % 100}%`; p.style.background = cols[i % cols.length];
      p.style.animationDelay = `${(i % 14) * 0.09}s`; p.style.animationDuration = `${2.4 + (i % 5) * 0.35}s`;
      box.appendChild(p);
    }
    $rs.appendChild(box);
    setTimeout(() => box.remove(), 5200);
  }

  function medal(key) {
    const c = { gold: ["#d8bd77", "#b08a3e", "#7f6128"], silver: ["#dfe5e7", "#a9b4b8", "#6f7f83"], bronze: ["#e3b48d", "#b0703e", "#7a4520"] }[key] || ["#dfe5e7", "#a9b4b8", "#6f7f83"];
    return `<svg class="rx-medal" viewBox="0 0 120 150" role="img" aria-label="${esc(key)} medal">
      <path d="M38 4h18l12 46H50z" fill="#0e4a55"/><path d="M64 4h18L70 50H52z" fill="#176473"/>
      <circle cx="60" cy="96" r="44" fill="${c[1]}"/><circle cx="60" cy="96" r="36" fill="${c[0]}" stroke="${c[2]}" stroke-width="2"/>
      <path d="M40 84h40v26H40z M40 84l20 15 20-15" fill="none" stroke="${c[2]}" stroke-width="3.2" stroke-linejoin="round"/>
      <path d="M71 112l8 8 14-16" fill="none" stroke="#0e4a55" stroke-width="4.5" stroke-linecap="round" stroke-linejoin="round"/></svg>`;
  }

  if (replay) startShift();
  else CB.title(stage, { file: 1, scene: "rush_day", title_en: "Inbox Rush", title_zh: "收件匣大作戰", time: story.start || "16:00",
    place_en: (story.title || {}).place_en, place_zh: (story.title || {}).place_zh, hook_en: (story.title || {}).hook_en, hook_zh: (story.title || {}).hook_zh, onGo: brief });
};
