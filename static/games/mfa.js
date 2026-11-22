/* The MFA Door 多因素驗證門, third version (11/21 night): case file 3 of the Awards Night casebook. Two parts.
   The night, 03:10 to 03:25: you are the IT trainee on call, and your work phone will not stop. Everything is done with
   your hands, the way you would on a real phone and a real console:
   - a sign-in prompt you didn't start is swiped off the screen to the left (the bar on it slides to approve: the trap);
   - a call is answered by sliding, and a caller using the SOC analyst's name wants the code typed on your keypad;
   - you call the SOC yourself by dialling 2199 on the phone (calling back the number that rang you reaches the caller);
   - your own sign-in: type the number your laptop shows into the app on your phone;
   - the Banquet Hall door: hold the radio button on the laptop's door console to tell Security, while the console's
     slide switches unlock the door or unblock Kevin's lost badge (both are traps). The camera shows the crew at the door.
   Three shields. Then you tell the SOC what happened by dragging what you want to say into the call.
   The case board, 07:30 at the Security Policy Board in the corridor: the door controller's log, the posters, the
   sign-in log and the account changes. Which code the crew typed, why the door stayed shut, and how they got in anyway.
   From the knowledge graph: the door code (the password policy's length, then the screen lock's minutes, the same as the
   door in the tour), the procedure for MFA prompts you did not start (its don'ts are the rules of the night), the
   lost-badge procedure and the real cases. Shared helpers: casebook.js. */
"use strict";

Games.mfa = function (d, main, replay) {
  const story = d.story, BOARD = story.board, QS = BOARD.questions || [];
  const sh = Object.assign({ rate: 0.1, idle: 0.25, prompt: 9, shields: 3 }, story.shift || {});
  const T0 = CB.mins(story.start || "03:10"), TEND = CB.mins(story.end || "03:25") - T0;
  const clockAt = (m) => CB.hhmm(T0 + m);
  const EV = story.events.map((e, i) => Object.assign({ i, at: 180 + e.t - T0 }, e));
  const PUSHES = EV.filter((e) => e.kind === "push"), DOORS = EV.filter((e) => e.kind === "door");
  const CALL = EV.find((e) => e.kind === "call"), OWN = EV.find((e) => e.kind === "own");
  const TOTAL = 1 + DOORS.length + 1 + 1 + 1 + QS.length;     // prompts, doors, the call, your sign-in, the report, questions
  const PROC = d.procedures.proc_unexpected_mfa, BADGE = d.procedures.proc_lost_badge;
  const P = { deny: 20, fast: 10, door: 100, back: 150, own: 100, ownWrong: 30, good: 60, bad: 40, reblock: 40 };
  const CON = story.console || {}, BADGE_ID = (CON.badge || {}).id || "#0417";
  // 11/22 review: Kevin's lost badge tapped at the reader after you had unblocked it: the reader takes it (doorFire, doorDone)
  const BD = Object.assign({ en: "Kevin Wu", zh: "吳凱文" }, CON.badge);
  const ACCEPTED = { alert_en: `Banquet Hall door: badge ${BADGE_ID} (${BD.en}) accepted, badge active`, alert_zh: `宴會廳門口：員工證 ${BADGE_ID}（${BD.zh}）通過，這張卡可以使用` };
  const digitsOf = (s) => String(s || "").replace(/\D/g, "");
  // 11/22: an extension in both languages (ext. 2199 分機 2199), and the sign-in app's name with its Chinese
  const numHTML = (s) => { const m = /^ext\.\s*(\d+)$/.exec(String(s || "")); return m ? bi(`ext. ${m[1]}`, `分機 ${m[1]}`) : esc(s); };
  const APP = bi("Lakeside Sign-in", "登入驗證");
  const NUM = Object.fromEntries((story.contacts || []).map((c) => [c.key, digitsOf(c.number)]));
  const FAKE = digitsOf(CALL.number), CODE = digitsOf(CALL.code);
  const HOLD = 700, SWIPE = 90;     // ms the radio button is held to send; px a card travels to count as a swipe
  const cap = (node, id) => { try { node.setPointerCapture(id); } catch { /* not a live pointer */ } };
  const st = CB.stage(main);
  const MENTOR = { svg: CB.mentor(), name: story.mentor.name, name_zh: story.mentor.name_zh, role_en: story.mentor.role_en, role_zh: story.mentor.role_zh };
  const ANALYST = BOARD.analyst;
  let S = null, B = null, H = null;
  const loop = CB.loop(tick);
  window.onresize = () => { if (B) CB.drawStrings(B.strings); };

  const ICON = {
    lake: `<svg viewBox="0 0 24 24" aria-hidden="true"><rect width="24" height="24" rx="6" fill="#0e4a55"/><path d="M5 15c2-1.6 4-1.6 6 0s4 1.6 6 0 2.6-1 2.6-1M7 9.5l2.5-3 2.5 3 2-2 3 3.5" fill="none" stroke="#d8bd77" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"/></svg>`,
    door: `<svg viewBox="0 0 24 24" aria-hidden="true"><rect width="24" height="24" rx="6" fill="#7f6128"/><path d="M8 19V5h8v14M6 19h12" fill="none" stroke="#fff" stroke-width="1.7" stroke-linejoin="round"/><circle cx="14" cy="12.5" r="1" fill="#fff"/></svg>`,
    msg: `<svg viewBox="0 0 24 24" aria-hidden="true"><rect width="24" height="24" rx="6" fill="#2e8b57"/><path d="M6 7h12v8H11l-4 3v-3H6z" fill="#fff"/></svg>`,
    batt: `<svg viewBox="0 0 26 12" aria-hidden="true"><rect x=".5" y=".5" width="22" height="11" rx="2.5" fill="none" stroke="currentColor"/><rect x="2" y="2" width="15" height="8" rx="1.5" fill="currentColor"/><rect x="23.5" y="4" width="2" height="4" rx="1" fill="currentColor"/></svg>`,
    hang: `<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M3 14.5c5-5 13-5 18 0l-2.4 2.4-3.3-1.6v-2.6c-2.1-.7-4.5-.7-6.6 0v2.6l-3.3 1.6z" fill="currentColor"/></svg>`,
    chev: `<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M8 5l7 7-7 7" fill="none" stroke="currentColor" stroke-width="2.8" stroke-linecap="round" stroke-linejoin="round"/></svg>`,
    mic: `<svg viewBox="0 0 24 24" aria-hidden="true"><rect x="9" y="3" width="6" height="11" rx="3" fill="currentColor"/><path d="M5.5 11a6.5 6.5 0 0 0 13 0M12 17.5V21M8.5 21h7" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/></svg>`,
    pad: `<svg viewBox="0 0 24 24" aria-hidden="true">${[5, 12, 19].map((y) => [5, 12, 19].map((x) => `<circle cx="${x}" cy="${y}" r="2.1" fill="currentColor"/>`).join("")).join("")}</svg>`,
    mute: `<svg viewBox="0 0 24 24" aria-hidden="true"><rect x="9" y="3" width="6" height="11" rx="3" fill="currentColor"/><path d="M5.5 11a6.5 6.5 0 0 0 13 0M12 17.5V21M4 4l16 16" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/></svg>`,
    spk: `<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 9h4l5-4v14l-5-4H4z" fill="currentColor"/><path d="M16 8.5a5 5 0 0 1 0 7M18.5 6a8.5 8.5 0 0 1 0 12" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round"/></svg>`,
  };

  /* The door camera: the crew drawn over the night-vision picture. A at the keypad (typing, or holding the badge to the
     reader), B by the door; the dark gap is the door swinging open. viewBox = the picture (16:9). */
  const SCENE = `<svg class="mn-scene" id="mnScene" viewBox="0 0 160 90" preserveAspectRatio="xMidYMid slice" aria-hidden="true">
    <defs><linearGradient id="mnGapG" x1="0" x2="1"><stop offset="0" stop-color="#000"/><stop offset="1" stop-color="#0d160f"/></linearGradient></defs>
    <path class="mn-gap" d="M93.5 0h30v90h-30z" fill="url(#mnGapG)"/>
    <g class="mn-fig mn-fig-b"><circle cx="110" cy="44" r="6.2"/><path d="M97 90l1.6-17c1-7 4.6-11 11.4-11s10.4 4 11.4 11L123 90z"/></g>
    <g class="mn-fig mn-fig-a"><circle cx="17" cy="45" r="9.5"/><path d="M-2 90l1.5-20C1 61 7 56 17 56s16 5 17.5 14L36 90z"/>
      <path class="mn-arm mn-arm-code" d="M27 63c6-3 11-8 18-13" fill="none" stroke-width="5.5" stroke-linecap="round"/>
      <g class="mn-arm mn-arm-badge"><path d="M27 64c10 0 22-2 33-5" fill="none" stroke-width="5.5" stroke-linecap="round"/><rect class="mn-badge-in-hand" x="60.5" y="53.5" width="5" height="7" rx="1"/></g></g>
  </svg>`;

  /* ------------------------------------------------------------------ the briefing: Mei-Ling's message before bed */
  function brief() {
    loop.stop();
    st.scene("mn_room", 0.1);
    G.meter("");
    CB.brief(st, { file: 3, start: story.start, top_en: "Later that night", top_zh: "晚會後的深夜", until_en: `on call until ${story.end}`, until_zh: `值班到 ${story.end}`, person: MENTOR,
      intro_en: story.intro_en, intro_zh: story.intro_zh, rules: story.rules, after_en: story.after_en, after_zh: story.after_zh,
      extra: `<div class="mn-brief-card"><p>${bi("On-call card", "值班卡")}</p>${(story.contacts || []).map((c) => `<span>${bi(c.en, c.zh)} <b>${numHTML(c.number)}</b></span>`).join("")}</div>`,
      button: bi("Go to sleep", "去睡覺"), onStart: startShift });
  }

  /* ------------------------------------------------------------------ the night */
  function startShift() {
    loop.stop();
    S = { clock: 0, over: false, paused: false, hold: 0, fired: {}, res: {}, notifs: [], log: [], shields: sh.shields, points: 0, losses: [],
      approved: 0, call: null, soc: null, reported: null, pwReset: false, own: { state: "idle", tries: 0, left: 0 }, endAt: 0,
      alerts: [], badge: "blocked", app: null, dial: "", recents: [], streak: 0, calledFake: false, via: {} };
    B = null;
    st.scene("mn_room", 0.18);
    H = CB.hud({ pause: true, clock: story.start, clockLabel: bi("on call", "值班中"), shields: sh.shields });
    G.onPause = () => togglePause();
    window.scrollTo({ top: 0 });
    st.body.innerHTML = `<div class="mn-play">
      <div class="rs-side mn-left"><section class="mn-card" aria-label="On-call card">
          <p class="mn-card-title">${bi("On-call card", "值班卡")}</p>
          <ol class="mn-steps">${PROC.steps.filter((s) => s.who === "you").map((s) => `<li>${bi(s.text_en, s.text_zh)}</li>`).join("")}</ol>
          <ul class="mn-donts">${(PROC.dont_en || []).map((t, k) => `<li>${bi(t, (PROC.dont_zh || [])[k] || "")}</li>`).join("")}</ul>
          <ul class="mn-numbers">${(story.contacts || []).map((c) => `<li><span>${bi(c.en, c.zh)}</span><b>${numHTML(c.number)}</b></li>`).join("")}</ul>
          <p class="mn-card-src">${bi(`From “${PROC.name_en}” in the knowledge graph`, `出自知識圖的流程「${PROC.name_zh}」`)}</p></section>
        <section class="rs-notebook mn-log" aria-label="Night log"><h3>${bi("Night log", "值班紀錄")} <b id="mnLogN">0</b></h3><ol id="mnLog"></ol></section></div>
      <div class="mn-phone-wrap"><div class="mn-phone" id="mnPhone"><i class="mn-halo" aria-hidden="true"></i><i class="mn-edge" aria-hidden="true"></i><div class="mn-screen" id="mnScreen">
        <div class="mn-status"><span id="mnTime">${esc(story.start)}</span><span class="mn-bars" aria-hidden="true"><i></i><i></i><i></i><i></i></span>${ICON.batt}</div>
        <div class="mn-lock"><p class="mn-clock" id="mnClock">${esc(story.start)}</p><p class="mn-date">${bi("Sunday, 22 November", "11 月 22 日 星期日")}</p></div>
        <div class="mn-notifs" id="mnNotifs" aria-live="polite"></div>
        <div class="mn-dock"><button type="button" class="mn-app-icon" id="mnPhoneApp">${CB.ICON.phone}<span>${bi("Phone", "電話")}</span></button></div>
        <div class="mn-takeover" id="mnTake" hidden></div></div></div></div>
      <div class="rs-side mn-right"><div class="mn-laptop"><div class="mn-lap-screen">
          <p class="mn-lap-bar"><span>${bi("Lakeside on-call", "值班系統")}</span><span>CAM 3 · ${bi("Banquet Hall door", "宴會廳門口")}</span></p>
          <div class="mn-cam" id="mnCam"><img src="${CB.IMG}mn_cam.jpg" alt="The Banquet Hall door camera at night: the code plates, the badge reader and the door. 宴會廳門口的夜間監視器畫面。">
            ${SCENE}<span class="mn-light" id="mnLight" aria-hidden="true"></span><span class="mn-led" id="mnLed" aria-hidden="true"></span>
            <span class="mn-cam-rec"><i></i>REC <span lang="zh-Hant">錄影中</span></span><span class="mn-cam-ts" id="mnCamTs">${esc(story.start)}:00</span><span class="mn-cam-box" id="mnCamBox" hidden></span>
            <span class="mn-cam-say" id="mnCamSay" hidden></span><i class="mn-cam-bar" id="mnCamBar" hidden><b></b></i></div>
          ${consoleHTML()}
          <div class="mn-portal" id="mnPortal"></div></div><div class="mn-lap-base" aria-hidden="true"></div></div></div>
      </div>`;
    S.pause = CB.pauseLayer(st, () => togglePause(false));
    $("#mnPhoneApp").addEventListener("click", openDialer);
    slideCtl($("#mnCon [data-slide=unlock]"), unlockDoor);
    slideCtl($("#mnCon [data-slide=unblock]"), unblockBadge);
    $("#mnReblock").addEventListener("click", reblock);
    pttCtl($("#mnPtt"));
    if (window.__mnKeys) document.removeEventListener("keydown", window.__mnKeys);
    window.__mnKeys = onKey;
    document.addEventListener("keydown", onKey);
    portal();
    conDraw();
    H.points(0, 0);
    say(bi(story.lines.first.en, story.lines.first.zh));
    // the night opens in the dark: only the phone gives any light
    S.dark = true;
    st.dusk(0.86);
    const play = $(".mn-play");
    play.classList.add("is-dark");
    play.insertAdjacentHTML("beforeend", `<p class="mn-wake" id="mnWake">${bi("03:10. You are asleep. Your work phone lies on the nightstand.", "凌晨三點十分，你睡著了。工作手機放在床頭。")}</p>`);
    play.addEventListener("pointerdown", wake, { once: true, capture: true });
    loop.start();
  }

  /* the lamp goes on: at your first touch or key, or a few seconds after the phone first buzzes */
  function wake() {
    if (!S || !S.dark) return;
    S.dark = false;
    const play = $(".mn-play");
    if (play) play.classList.remove("is-dark");
    const w = $("#mnWake");
    if (w) { w.classList.add("is-gone"); setTimeout(() => w.remove(), 900); }
    CB.SFX.play("tap");
  }

  function say(html) { addLog(null, html); }

  function addLog(t, html, cls) {
    const ol = $("#mnLog");
    if (!ol) return;
    const li = el("li", "is-new " + (cls || ""), `${t ? `<time>${esc(t)}</time>` : ""}<p>${html}</p>`);
    ol.prepend(li);
    S.log.push({ t, html, cls });
    $("#mnLogN").textContent = String(S.log.filter((x) => x.t).length);
  }

  const busy = () => S.notifs.some((n) => n.kind !== "msg") || S.alerts.length || (S.call && S.call.state !== "done") || (S.soc && S.soc.state !== "done")
    || S.own.state === "ready" || S.own.state === "prompt";

  function tick(dt) {
    if (!S || S.over || S.paused || S.hold || document.hidden) return;
    if (S.dark && S.wakeAt && performance.now() >= S.wakeAt) wake();
    const quiet = !S.reported && EV.every((e) => S.fired[e.id] && S.res[e.id]);     // everything has happened; only the call to 2199 is left
    S.clock = Math.min(TEND, S.clock + dt * (busy() ? sh.rate : quiet ? sh.idle * 2 : sh.idle));
    for (const e of EV) if (!S.fired[e.id] && S.clock >= e.at && canFire(e)) fire(e);
    for (const n of S.notifs.slice()) { if (n.kind === "door" || n.kind === "own") continue; n.left -= dt; if (n.left <= 0) expire(n); }
    for (const a of S.alerts.slice()) { a.left -= dt; if (a.left <= 0) doorDone(a, "none"); }
    const c = S.call;
    if (c && c.state === "ringing") {
      c.left -= dt; c.ringT -= dt;
      if (c.ringT <= 0) { c.ringT = 1.8; CB.SFX.play("ring"); buzz(true); }
      if (c.left <= 0) callEnd("missed");
    } else if (c && c.state === "talking") {
      c.talk += dt;
      callPressure();
      if (c.talk >= (CALL.give_up || 26)) callEnd("gaveup");
    }
    if ((S.own.state === "ready" || S.own.state === "prompt") && !["call", "soc", "line"].includes(S.app)) {   // the portal waits while you are on a call
      S.own.left -= dt;
      if (S.own.left <= 0) ownResolve("late");
    }
    drawTimers();
    const t = clockAt(S.clock);
    H.clock(t); $("#mnTime").textContent = t; $("#mnClock").textContent = t;
    $("#mnCamTs").textContent = `${t}:${CB.pad2(Math.floor((S.clock * 60) % 60))}`;
    st.dusk(S.dark ? 0.86 : 0.18 + 0.1 * Math.sin(S.clock));
    const allDone = EV.every((e) => S.fired[e.id] && S.res[e.id]) && !busy() && !S.app && !!S.reported;
    if ((allDone || S.clock >= TEND) && !S.hold) {
      if (!S.endAt) S.endAt = performance.now() + (S.clock >= TEND ? 600 : 2600);
      else if (performance.now() >= S.endAt) endShift();
    } else if (!S.hold) S.endAt = 0;
  }

  function canFire(e) {   // the call waits while you are on the phone yourself; nothing else needs to wait
    if (e.kind === "call") return !(S.soc && S.soc.state !== "done") && S.app !== "line";
    return true;
  }

  function togglePause(force) {
    if (!S || S.over) return;
    S.paused = typeof force === "boolean" ? force : !S.paused;
    S.pause.set(S.paused);
    H.paused(S.paused);
  }

  function buzz(quiet) {
    if (!quiet) CB.SFX.play("buzz");
    const p = $("#mnPhone");
    if (!p || reduceMotion) return;
    p.classList.remove("is-buzz"); void p.offsetWidth; p.classList.add("is-buzz");
  }

  function fire(e) {
    S.fired[e.id] = true;
    if (e.kind === "push") {
      if (S.pwReset) { S.res[e.id] = "stopped"; return; }       // your password was reset: the crew's attempts no longer reach your phone
      addNotif({ id: e.id, e, kind: "push", left: sh.prompt, total: sh.prompt });
      buzz();
      if (S.dark && !S.wakeAt) {
        S.wakeAt = performance.now() + 6500;
        const w = $("#mnWake");
        if (w) w.innerHTML = bi("The phone lights up the room. Something wants you to approve a sign-in.", "手機把房間照亮了，有東西要你核准登入。");
      }
      if (e.msg_en) addNotif({ id: "msg-" + e.id, e: {}, kind: "msg", left: 10, total: 10, from_en: e.msg_from_en, from_zh: e.msg_from_zh, en: e.msg_en, zh: e.msg_zh });   // the trick comes by text, the prompt looks like any other
    } else if (e.kind === "door") doorFire(e);
    else if (e.kind === "call") {
      S.call = { e, state: "ringing", left: e.secs, ringT: 0, talk: 0, typed: "", said: 0, pad: false };
      S.recents.unshift({ num: e.number, en: e.name_en, zh: e.name_zh, t: clockAt(S.clock), dir: "in" });
      take("call");
      callScreen();
    } else if (e.kind === "own") {
      S.own = { state: "ready", tries: 0, left: e.secs, e, typed: "" };
      addNotif({ id: "msg-" + e.id, e, kind: "msg", left: 12, total: 12, from_en: "Security · Hsu", from_zh: "安全室 許志明", en: e.ask_en, zh: e.ask_zh });
      portal();
      buzz();
    }
  }

  /* ------------------------------------------------------------------ the lock screen: cards you swipe away
     Cards are kept and moved, not redrawn, so a card stays under your finger while new ones arrive above it. */
  function addNotif(n) { S.notifs.unshift(n); syncNotifs(); }
  function removeNotif(id) { S.notifs = S.notifs.filter((n) => n.id !== id); syncNotifs(); }

  function syncNotifs() {
    const box = $("#mnNotifs");
    if (!box) return;
    const want = new Set(S.notifs.map((n) => n.id));
    for (const w of $$(".mn-nw", box)) if (!want.has(w.dataset.id) && !w.classList.contains("is-leaving")) w.remove();
    let prev = null;
    for (const n of S.notifs) {
      let w = $$(".mn-nw", box).find((x) => x.dataset.id === n.id && !x.classList.contains("is-leaving"));
      if (!w) w = cardFor(n);
      if (prev) { if (prev.nextElementSibling !== w) prev.after(w); } else if (box.firstElementChild !== w) box.prepend(w);
      prev = w;
    }
    $("#mnScreen").classList.toggle("has-n", S.notifs.length > 0);   // the clock shrinks to make room, like a real lock screen
    const ph = $("#mnPhone"), waiting = S.notifs.filter((n) => n.kind === "push" || n.kind === "msg").length;       // the edge glows red while prompts wait
    if (ph) { ph.classList.toggle("has-n", waiting > 0); if (waiting) ph.dataset.n = String(waiting); else delete ph.dataset.n; }
    drawTimers();
  }

  function cardFor(n) {
    const e = n.e || {};
    let body = "", label = "";
    if (n.kind === "push") {
      label = "Sign-in prompt. Swipe it to the left, or press Delete, to deny it.";
      body = `<p class="mn-n-app">${ICON.lake}<span>${APP}</span><time>${bi("now", "現在")}</time></p>
        <p class="mn-n-title">${bi(e.title_en || "Are you trying to sign in?", e.title_zh || "你正在登入嗎？")}</p>
        <p class="mn-n-where">${bi(e.where_en, e.where_zh)}</p>
        ${slideHTML("approve", bi("Slide to approve", "滑動同意"), "Approve this sign-in: drag the knob to the right")}
        <p class="mn-n-swipe" aria-hidden="true">${bi("Swipe left to deny", "往左滑掉就是拒絕")}</p>`;
    } else if (n.kind === "door") {
      label = "Door system alert. Press Enter to look at the camera on your laptop.";
      body = `<p class="mn-n-app">${ICON.door}<span>${bi("Door system", "門禁系統")}</span><time>${esc(e.cam)}</time></p>
        <p class="mn-n-title">${bi(e.alert_en, e.alert_zh)}</p>
        <p class="mn-n-hint">${bi("The camera and the door console are on your laptop.", "監視器和門禁控制台在你的筆電上。")}</p>`;
    } else if (n.kind === "own") {
      label = "Your own sign-in. Press Enter to open it.";
      body = `<p class="mn-n-app">${ICON.lake}<span>${APP}</span><time>${bi("now", "現在")}</time></p>
        <p class="mn-n-title">${bi("Are you trying to sign in?", "你正在登入嗎？")}</p><p class="mn-n-where">${bi(e.where_en, e.where_zh)}</p>
        <p class="mn-n-hint">${bi("Tap to open it and type the number.", "點開來輸入號碼。")}</p>`;
    } else {
      label = "Message. Tap or swipe it away.";
      body = `<p class="mn-n-app">${ICON.msg}<span>${bi(n.from_en, n.from_zh)}</span><time>${bi("now", "現在")}</time></p><p class="mn-n-text">${bi(n.en, n.zh)}</p>`;
    }
    const deny = n.kind === "push" || n.kind === "own";
    const w = el("div", `mn-nw is-${n.kind}`, `<div class="mn-n-under${deny ? " is-deny" : ""}" aria-hidden="true"><span>${deny ? bi("Deny", "拒絕") : bi("Clear", "移除")}</span></div>
      <article class="mn-n is-${n.kind}${e.trick ? " is-trick" : ""}" tabindex="0" aria-label="${esc(label)}">${body}${n.kind === "push" || n.kind === "door" ? `<i class="mn-n-bar"><b></b></i>` : ""}</article>`);
    w.dataset.id = n.id;
    if (n.kind === "push") {
      swipe(w, { left: () => pushAnswer(n, "deny"), tap: () => wiggle(w) });
      slideCtl($(".mn-slide", w), () => pushAnswer(n, "approve"));
    } else if (n.kind === "door") swipe(w, { left: () => removeNotif(n.id), right: () => removeNotif(n.id), tap: camFocus });
    else if (n.kind === "own") swipe(w, { left: () => ownAnswer("deny"), tap: openAuth });
    else swipe(w, { left: () => removeNotif(n.id), right: () => removeNotif(n.id), tap: () => flyOut(w, 1, () => removeNotif(n.id)) });
    return w;
  }

  /* A card follows your finger sideways; past SWIPE px it flies off. A tap (no movement) is a tap. */
  function swipe(w, o) {
    const card = $(".mn-n", w);
    let p = null;
    card.addEventListener("pointerdown", (ev) => {
      if (ev.button !== 0 || ev.target.closest(".mn-slide, button") || w.classList.contains("is-leaving") || S.over) return;
      p = { x0: ev.clientX, dx: 0, moved: false };
      cap(card, ev.pointerId);
    });
    card.addEventListener("pointermove", (ev) => {
      if (!p) return;
      p.dx = (ev.clientX - p.x0) / G.k();
      if (!p.moved && Math.abs(p.dx) > 6) { p.moved = true; w.classList.add("is-drag"); }
      if (!p.moved) return;
      const dx = o.right ? p.dx : Math.min(28, p.dx);
      card.style.transform = `translateX(${dx}px) rotate(${(dx / 70).toFixed(2)}deg)`;
      w.classList.toggle("is-past", dx < -SWIPE || (!!o.right && dx > SWIPE));
    });
    const end = () => {
      if (!p) return;
      const { dx, moved } = p;
      p = null;
      w.classList.remove("is-drag", "is-past");
      if (!moved) { card.style.transform = ""; if (o.tap) o.tap(); return; }
      if (dx < -SWIPE && o.left) return flyOut(w, -1, o.left);
      if (dx > SWIPE && o.right) return flyOut(w, 1, o.right);
      card.style.transform = "";
    };
    card.addEventListener("pointerup", end);
    card.addEventListener("pointercancel", end);
    card.addEventListener("keydown", (ev) => {
      if (ev.target !== card) return;
      if ((ev.key === "ArrowLeft" || ev.key === "Delete" || ev.key === "Backspace") && o.left) { ev.preventDefault(); flyOut(w, -1, o.left); }
      else if (ev.key === "Enter" && o.tap) { ev.preventDefault(); o.tap(); }
    });
  }

  function flyOut(w, dir, fn) {
    if (w.classList.contains("is-leaving")) return;
    w.classList.add("is-leaving");
    const card = $(".mn-n", w);
    card.style.transform = `translateX(${dir * 125}%) rotate(${dir * 9}deg)`;
    card.style.opacity = "0";
    CB.SFX.play("swipe");
    setTimeout(() => { w.style.height = `${w.offsetHeight}px`; requestAnimationFrame(() => w.classList.add("is-gone")); }, reduceMotion ? 0 : 170);
    setTimeout(() => w.remove(), reduceMotion ? 30 : 480);
    fn();
  }

  function wiggle(w) {   // a tap on a prompt: it shows which way it goes
    const card = $(".mn-n", w);
    card.classList.remove("is-wiggle"); void card.offsetWidth; card.classList.add("is-wiggle");
  }

  const slideHTML = CB.slideHTML, slideCtl = CB.slideCtl;     // the slide switch: casebook.js

  function drawTimers() {
    for (const n of S.notifs) {
      const b = $(`.mn-nw[data-id="${n.id}"] .mn-n-bar b`);
      if (!b) continue;
      const left = n.kind === "door" ? n.alert.left / n.alert.total : n.left / n.total;
      b.style.width = `${Math.max(0, 100 * left)}%`;
      b.parentElement.classList.toggle("is-hot", left < 0.3);
    }
    const a = S.alerts[S.alerts.length - 1], cb = $("#mnCamBar b");
    if (a && cb) { cb.style.width = `${Math.max(0, (100 * a.left) / a.total)}%`; cb.parentElement.classList.toggle("is-hot", a.left < 5); }
    const own = $("#mnOwnBar");
    if (own && S.own.e) own.style.width = `${Math.max(0, (100 * S.own.left) / S.own.e.secs)}%`;
    const ring = $("#mnRingBar");
    if (ring && S.call && S.call.state === "ringing") ring.style.width = `${Math.max(0, (100 * S.call.left) / S.call.e.secs)}%`;
  }

  function expire(n) {
    removeNotif(n.id);
    if (n.kind === "push") { S.res[n.id] = "expired"; S.streak = 0; addLog(clockAt(S.clock), bi(story.lines.expired.en, story.lines.expired.zh), "is-quiet"); }
  }

  /* ------------------------------------------------------------------ deny (swipe) or approve (slide) */
  async function pushAnswer(n, a) {
    if (S.res[n.id] || S.over) return;
    removeNotif(n.id);
    if (a === "deny") {
      S.res[n.id] = "denied";
      S.streak += 1;
      const pts = P.deny + (n.left > n.total - 4 ? P.fast : 0);
      S.points += pts; H.points(S.points, S.streak, pts);
      if ([3, 5, 8].includes(S.streak)) CB.streak(st, S.streak);
      addLog(clockAt(S.clock), bi(`Denied a sign-in prompt: ${n.e.where_en}.`, `拒絕了一則登入通知：${n.e.where_zh}。`), "is-ok");
      return;
    }
    S.res[n.id] = "approved";
    S.streak = 0;
    S.approved += 1;
    CB.SFX.play("bad");
    addLog(clockAt(S.clock), bi("Approved a sign-in you didn't start.", "同意了一則不是你發起的登入。"), "is-bad");
    await breach(story.push_damage, n.e);
  }

  async function breach(dm, e) {
    S.shields -= 1;
    const left = S.shields;   // shields after this slip (another one may come before this cut shows; cuts queue up)
    S.losses.push({ e, dm });
    H.shields(S.shields, sh.shields, true);
    st.hit();
    S.hold += 1;
    await wait(800);
    const base = CB.mins((dm.beats || [])[0] && dm.beats[0].time), now = T0 + S.clock;
    const beats = (dm.beats || []).map((b) => (/^\d+:\d+$/.test(b.time) ? Object.assign({}, b, { time: CB.hhmm(now + CB.mins(b.time) - base) }) : b));
    await st.cut({ scene: dm.scene || "mn_hall", beats, hit_en: dm.hit_en, hit_zh: dm.hit_zh, inset: dm.inset === "signin" ? signinInset() : "", shields: left,
      go: left > 0 ? bi("Back to the phone", "回到手機") : bi("Continue", "繼續") });
    S.hold -= 1;
    if (S.shields <= 0 && !S.hold) gameOver();   // only after the last queued cut
  }

  function signinInset() {
    return `<div class="rs-alert"><p class="rs-alert-app">Lakeside SSO · ${bi("Security alert", "安全通知")}</p>
      <p class="rs-alert-title">${bi("New sign-in to your on-call account", "你的值班帳號有新的登入")}</p>
      <p class="rs-alert-meta">${esc(clockAt(S.clock))} · 203.0.113.45 · ${bi("outside Taiwan", "國外")}</p></div>`;
  }

  /* ------------------------------------------------------------------ the laptop: the door camera and the door console */
  function consoleHTML() {
    const bd = CON.badge || { id: BADGE_ID, en: "Kevin Wu", zh: "吳凱文", blocked: "22:50" };
    return `<div class="mn-con" id="mnCon">
      <div class="mn-ctl"><p class="mn-ctl-h">${bi("Banquet Hall door", "宴會廳門")}</p>
        <p class="mn-lamp" id="mnDoorLamp"><i></i><span></span></p>
        ${slideHTML("unlock", bi("Slide to unlock", "滑動開門"), "Unlock the Banquet Hall door remotely: drag the knob to the right")}</div>
      <div class="mn-ctl"><p class="mn-ctl-h">${bi(`Badge ${bd.id} · ${bd.en}`, `員工證 ${bd.id}・${bd.zh}`)}</p>
        <p class="mn-lamp" id="mnBadgeLamp"><i></i><span></span></p>
        ${slideHTML("unblock", bi("Slide to unblock", "滑動解除停用"), "Unblock this badge: drag the knob to the right")}
        <button type="button" class="mn-reblock" id="mnReblock" hidden>${bi("Block it again", "重新停用")}</button></div>
      <div class="mn-ctl mn-ctl-radio"><p class="mn-ctl-h">${bi("Radio · Security desk", "無線電・安全室")}</p>
        <button type="button" class="mn-ptt" id="mnPtt" aria-label="Radio to the Security desk: hold to talk"><i class="mn-ptt-ring"></i>${ICON.mic}<span class="mn-ptt-wave" aria-hidden="true"><i></i><i></i><i></i><i></i><i></i></span></button>
        <p class="mn-ptt-l">${bi("Hold to talk", "按住說話")}</p></div>
      <div class="mn-radio" id="mnRadio" aria-live="polite"><p class="mn-radio-sys">${bi("Radio quiet. On the Security desk tonight: Hsu.", "無線電很安靜。今晚安全室值班：許志明。")}</p></div>
    </div>`;
  }

  function conDraw() {
    const con = $("#mnCon");
    if (!con || !S) return;
    const bd = CON.badge || {}, live = S.alerts.length > 0, open = con.classList.contains("is-open");
    con.classList.toggle("is-alert", live);
    const dl = $("#mnDoorLamp");
    dl.className = `mn-lamp ${open ? "is-bad" : "is-shut"}`;
    $("span", dl).innerHTML = open ? bi("Unlocked", "已開鎖") : live ? bi("Locked · someone at the door", "上鎖・門口有人") : bi("Locked", "上鎖");
    const un = $("[data-slide=unlock]", con);
    un.classList.toggle("is-off", !live || open);
    if (!open && un.classList.contains("is-done") && un.reset) un.reset();
    const bl = $("#mnBadgeLamp"), active = S.badge === "active";
    bl.className = `mn-lamp ${active ? "is-bad" : "is-shut"}`;
    $("span", bl).innerHTML = active ? bi("Active", "可以使用") : bi(`Blocked ${bd.blocked || ""}, reported lost`, `${bd.blocked || ""} 掛失停用`);
    const ub = $("[data-slide=unblock]", con);
    ub.hidden = active;
    if (!active && ub.classList.contains("is-done") && ub.reset) ub.reset();
    $("#mnReblock").hidden = !active;
    $("#mnPtt").classList.toggle("is-call", live);
  }

  function doorFire(e) {
    const a = { e, left: e.secs, total: e.secs };
    // You unblocked the lost badge earlier: tonight it simply works. 11/22 review: the alert and the camera say the reader
    // accepted it (they said "refused"), the LED no longer flashes red first, and the door log says so too (via "before", doorRows)
    a.doomed = e.box === "reader" && S.badge === "active";
    const show = a.doomed ? Object.assign({}, e, ACCEPTED, { led: "" }) : e;
    S.alerts.push(a);
    addNotif({ id: e.id, e: show, kind: "door", alert: a });
    buzz();
    camEvent(show);
    conDraw();
    if (a.doomed) setTimeout(() => {
      if (!S || S.over || !S.alerts.includes(a)) return;
      if (S.badge === "active") return doorDone(a, "bad", "before");
      // 11/22 review: blocked again during the alarm, so the reader refuses it after all: an ordinary alert again (radio works)
      a.doomed = false;
      const n = S.notifs.find((x) => x.id === e.id), h = $(`.mn-nw[data-id="${e.id}"] .mn-n-title`);
      if (n) n.e = e;
      if (h) h.innerHTML = bi(e.alert_en, e.alert_zh);
      camEvent(e);
    }, reduceMotion ? 100 : 1700);
  }

  async function doorDone(a, how, via) {
    if (!S.alerts.includes(a)) return;
    S.alerts = S.alerts.filter((x) => x !== a);
    const e = a.e, good = e.options.find((o) => o.good), bad = e.options.find((o) => o.bad), idle = e.options.find((o) => !o.good && !o.bad);
    removeNotif(e.id);
    if (how === "good") {
      S.res[e.id] = good.k;
      S.points += P.door; H.points(S.points, S.streak, P.door);
      CB.SFX.play("good");
      addLog(e.cam.slice(0, 5), bi(`${e.alert_en} → told Security on the radio.`, `${e.alert_zh} → 用無線電告訴安全室。`), "is-ok");
      camAway(e, true);
      conDraw();
      return;
    }
    if (how === "bad") {
      S.res[e.id] = bad.k;
      S.via[e.id] = via;      // 11/22: unlocked remotely or the badge unblocked (during the alert, or "before" it), for the door log on the case board (doorRows)
      if (via === "before") S.beforeAt = S.unblockedAt;      // 11/22 review: the unblock that let the badge in; a later unblock must not move it
      const dm = via === "unlock" && e.box === "reader" ? DOORS[0].damage : e.damage;
      const at = (S.beforeAt || "").slice(0, 5);
      addLog(e.cam.slice(0, 5), via === "before" ? bi(`${ACCEPTED.alert_en} → you had unblocked it at ${at}, so the door opened.`, `${ACCEPTED.alert_zh} → 你在 ${at} 就解除了停用，門開了。`)
        : via === "unblock" ? bi(`${e.alert_en} → badge ${BADGE_ID} was unblocked, so the door opened.`, `${e.alert_zh} → 員工證 ${BADGE_ID} 被解除停用，門開了。`)
        : bi(`${e.alert_en} → you unlocked the door remotely.`, `${e.alert_zh} → 你遠端開了門。`), "is-bad");
      camOpen();
      await wait(1500);
      await breach(dm, e);
      if (S.over) return;
      camReset();
      conDraw();
      return;
    }
    S.res[e.id] = "none";
    addLog(e.cam.slice(0, 5), bi(`${e.alert_en}: nobody told Security. ${e.miss_en || (idle && idle.why_en) || ""}`, `${e.alert_zh}：沒有人通知安全室。${e.miss_zh || (idle && idle.why_zh) || ""}`), "is-miss");
    camAway(e, false);
    conDraw();
  }

  function unlockDoor() {
    const a = S.alerts[S.alerts.length - 1];
    if (!a || S.over) return conDraw();
    doorDone(a, "bad", "unlock");
  }

  function unblockBadge() {
    if (S.over) return;
    S.badge = "active";
    S.unblockedAt = `${clockAt(S.clock)}:${CB.pad2(Math.floor((S.clock * 60) % 60))}`;     // 11/22 review: when, for the door log (doorRows)
    conDraw();
    addLog(clockAt(S.clock), bi(`Unblocked badge ${BADGE_ID} (Kevin Wu, reported lost).`, `解除了員工證 ${BADGE_ID}（吳凱文，已掛失）的停用。`), "is-bad");
    const a = S.alerts.find((x) => x.e.box === "reader");
    if (a) return doorDone(a, "bad", "unblock");
    const d3 = DOORS.find((x) => x.box === "reader");
    if (d3 && S.res[d3.id]) {     // the crew is gone, but a lost badge is still a lost badge
      setTimeout(() => {
        if (!S || S.over || S.badge !== "active") return;
        S.badge = "blocked";
        S.points = Math.max(0, S.points - P.reblock); H.points(S.points, S.streak, -P.reblock);
        radioShow(`<p class="mn-radio-them">${bi(CON.reblock_en, CON.reblock_zh)}</p>`);
        CB.SFX.play("static");
        conDraw();
      }, reduceMotion ? 100 : 1800);
    }
  }

  function reblock() {
    S.badge = "blocked";
    CB.SFX.play("clunk");
    addLog(clockAt(S.clock), bi(`Blocked badge ${BADGE_ID} again.`, `重新停用員工證 ${BADGE_ID}。`), "is-quiet");
    conDraw();
  }

  /* The radio: hold the button while you talk (HOLD ms is enough), let go to send. */
  function pttCtl(b) {
    let t0 = 0, timer = null;
    const down = (ev) => {
      if (ev && ev.button !== undefined && ev.button !== 0) return;
      if (t0 || !S || S.over || S.hold || S.paused) return;
      if (ev && ev.pointerId !== undefined) { ev.preventDefault(); cap(b, ev.pointerId); }
      t0 = performance.now();
      b.classList.add("is-holding");
      CB.SFX.play("static");
      timer = setTimeout(() => { b.classList.add("is-ready"); CB.SFX.play("tick"); }, HOLD);
    };
    const up = () => {
      if (!t0) return;
      const held = performance.now() - t0;
      t0 = 0;
      clearTimeout(timer);
      b.classList.remove("is-holding", "is-ready");
      if (held < HOLD) { radioShow(`<p class="mn-radio-sys">${bi("Hold the button down while you talk, then let go.", "說話時要按住按鈕，說完再放開。")}</p>`); return; }
      radioSend();
    };
    b.addEventListener("pointerdown", down);
    b.addEventListener("pointerup", up);
    b.addEventListener("pointercancel", up);
    b.addEventListener("keydown", (ev) => { if ((ev.key === " " || ev.key === "Enter") && !ev.repeat) { ev.preventDefault(); down(); } });
    b.addEventListener("keyup", (ev) => { if (ev.key === " " || ev.key === "Enter") { ev.preventDefault(); up(); } });
  }

  function radioSend() {
    const live = S.alerts.filter((a) => !a.doomed);
    CB.SFX.play("static");
    if (!live.length) {
      radioShow(`<p class="mn-radio-me">${bi(CON.radio_check_en, CON.radio_check_zh)}</p>`);
      setTimeout(() => { if (S && !S.over) { radioShow(`<p class="mn-radio-them">${bi(CON.radio_idle_en, CON.radio_idle_zh)}</p>`, true); CB.SFX.play("static"); } }, reduceMotion ? 100 : 1100);
      return;
    }
    const good = live[live.length - 1].e.options.find((o) => o.good);
    radioShow(`<p class="mn-radio-me">${bi(good.radio_en, good.radio_zh)}</p>`);
    for (const a of live) doorDone(a, "good");
    setTimeout(() => { if (S && !S.over) { radioShow(`<p class="mn-radio-them">${bi(good.reply_en, good.reply_zh)}</p>`, true); CB.SFX.play("static"); } }, reduceMotion ? 100 : 1300);
  }

  function radioShow(html, add) {
    const r = $("#mnRadio");
    if (!r) return;
    if (add) r.insertAdjacentHTML("beforeend", html); else r.innerHTML = html;
    r.scrollTop = r.scrollHeight;
  }

  /* The camera: who is at the door and what they are doing. */
  function camEvent(e) {
    const box = $("#mnCamBox"), sayEl = $("#mnCamSay"), sc = $("#mnScene"), led = $("#mnLed");
    box.hidden = false; box.className = `mn-cam-box is-${e.box}`;
    sayEl.hidden = false; sayEl.innerHTML = bi(e.alert_en, e.alert_zh);
    $("#mnCamBar").hidden = false;
    sc.setAttribute("class", `mn-scene is-a${(e.crew || 1) > 1 ? " is-b" : ""} pose-${e.box === "reader" ? "badge" : "code"}`);
    led.className = "mn-led";
    if (e.led) setTimeout(() => { if (S && !S.over && S.alerts.some((a) => a.e === e)) led.className = `mn-led is-${e.led}`; }, reduceMotion ? 0 : 1300);
    $("#mnCam").classList.add("is-alert");
  }
  function camFocus() { const c = $("#mnCam"); c.classList.remove("is-flash"); void c.offsetWidth; c.classList.add("is-flash"); c.scrollIntoView({ block: "nearest", behavior: reduceMotion ? "auto" : "smooth" }); }
  function camAway(e, good) {
    const sc = $("#mnScene"), led = $("#mnLed");
    if (S.alerts.length) return;
    led.className = "mn-led";
    $("#mnCamBox").hidden = true; $("#mnCamSay").hidden = true; $("#mnCamBar").hidden = true;
    $("#mnCam").classList.remove("is-alert");
    const clear = () => { if (!S.alerts.length) sc.setAttribute("class", "mn-scene"); };
    if (good && e.box === "reader") {     // Security's torch comes down the corridor and the two of them run
      const L = $("#mnLight");
      L.classList.remove("is-on"); void L.offsetWidth; L.classList.add("is-on");
      setTimeout(() => { if (!S.alerts.length) sc.classList.add("is-flee"); }, reduceMotion ? 0 : 1600);
      setTimeout(() => { L.classList.remove("is-on"); clear(); }, reduceMotion ? 50 : 4600);
      return;
    }
    sc.classList.add(good ? "is-flee" : "is-leave");
    setTimeout(clear, reduceMotion ? 50 : 1500);
  }
  function camOpen() {
    $("#mnScene").classList.add("is-open", "is-walkin");
    $("#mnCon").classList.add("is-open");
    $("#mnLed").className = "mn-led is-green";
    CB.SFX.play("creak");
    conDraw();
  }
  function camReset() {
    $("#mnScene").setAttribute("class", "mn-scene");
    $("#mnCon").classList.remove("is-open");
    $("#mnLed").className = "mn-led";
    if (!S.alerts.length) { $("#mnCamBox").hidden = true; $("#mnCamSay").hidden = true; $("#mnCamBar").hidden = true; $("#mnCam").classList.remove("is-alert"); }
  }

  /* ------------------------------------------------------------------ the phone's own screens */
  function take(kind) { S.app = kind; const t = $("#mnTake"); t.hidden = false; t.className = `mn-takeover is-${kind}`; return t; }
  function untake() { if (!S) return; S.app = null; const t = $("#mnTake"); if (!t) return; t.hidden = true; t.innerHTML = ""; t.className = "mn-takeover"; }

  const KEYS = [["1", ""], ["2", "ABC"], ["3", "DEF"], ["4", "GHI"], ["5", "JKL"], ["6", "MNO"], ["7", "PQRS"], ["8", "TUV"], ["9", "WXYZ"], ["*", ""], ["0", "+"], ["#", ""]];
  const keysHTML = (id, keys) => `<div class="mn-keys" id="${id}">${(keys || KEYS).map(([k, s]) => (k ? `<button type="button" data-k="${k}" aria-label="${k === "del" ? "Delete" : k}">${k === "del" ? "⌫" : `<b>${k}</b><small>${s}</small>`}</button>` : "<span></span>")).join("")}</div>`;
  // 11/22 evening: the crew's number is a UK drama number (+44 7700 900417), typed with or without the 00 in front;
  // 11/22 review: grouped that way from 0044 or 44 on while you type (it showed 0044-770-0900 for 8 to 13 digits)
  const shownNum = (s) => { const x = digitsOf(s); if (/^(00)?44/.test(x)) { const y = x.replace(/^(00)?44/, ""); return ["+44", y.slice(0, 4), y.slice(4)].filter(Boolean).join(" "); } return x.length > 7 ? x.replace(/^(\d{4})(\d{3})(\d*)$/, (m, a, b, c) => [a, b, c].filter(Boolean).join("-")) : x; };
  const keyFx = (b) => { if (!b) return; b.classList.remove("is-hit"); void b.offsetWidth; b.classList.add("is-hit"); };

  function onKey(ev) {
    if (S && S.dark && !ev.ctrlKey && !ev.metaKey && !ev.altKey) wake();
    if (!S || S.over || S.paused || !S.app || ev.ctrlKey || ev.metaKey || ev.altKey) return;
    const k = ev.key;
    if (S.app === "dial") {
      if (/^[0-9*#]$/.test(k)) { ev.preventDefault(); dialKey(k); }
      else if (k === "Backspace") { ev.preventDefault(); dialKey("del"); }
      else if (k === "Enter" && !(document.activeElement && document.activeElement.closest("button"))) { ev.preventDefault(); dialOut(); }
      else if (k === "Escape") untake();
    } else if (S.app === "auth") {
      if (/^[0-9]$/.test(k)) { ev.preventDefault(); authKey(k); } else if (k === "Backspace") { ev.preventDefault(); authKey("del"); }
    } else if (S.app === "call" && S.call && S.call.state === "talking" && S.call.pad && /^[0-9*#]$/.test(k)) { ev.preventDefault(); callKey(k); }
  }

  /* The dialler: type a number, or tap a recent call to put its number in. */
  function openDialer() {
    if (!S || S.over || S.app) return;
    take("dial");
    CB.SFX.play("tap");
    drawDialer();
  }
  function drawDialer() {
    const t = $("#mnTake");
    const rec = S.recents.slice(0, 4).map((r) => `<li><button type="button" data-num="${esc(digitsOf(r.num))}" class="${r.dir === "in" ? "is-in" : "is-out"}">
      <span class="mn-rec-dir" aria-hidden="true">${r.dir === "in" ? "↙" : "↗"}</span><span class="mn-rec-who">${r.en ? bi(r.en, r.zh) : esc(shownNum(r.num))}${r.en ? `<small>${esc(r.num)}</small>` : ""}</span><time>${esc(r.t)}</time></button></li>`).join("");
    t.innerHTML = `<div class="mn-app mn-dialer">
      <div class="mn-app-top"><button type="button" class="mn-app-x" data-x>${bi("Close", "關閉")}</button><p>${bi("Phone", "電話")}</p><span></span></div>
      <p class="mn-dial-num" id="mnDialNum"></p>
      ${keysHTML("mnDialKeys")}
      <div class="mn-dial-act"><span></span><button type="button" class="mn-dial-call" id="mnDialCall" aria-label="Call">${CB.ICON.phone}</button><button type="button" class="mn-dial-del" data-k="del" aria-label="Delete">⌫</button></div>
      <div class="mn-recents"><p class="mn-recents-h">${bi("Recent calls", "最近通話")}</p>${rec ? `<ul>${rec}</ul>` : `<p class="mn-recents-none">${bi("No calls tonight yet.", "今晚還沒有通話。")}</p>`}</div></div>`;
    $("[data-x]", t).addEventListener("click", untake);
    $("#mnDialKeys").addEventListener("click", (ev) => { const b = ev.target.closest("[data-k]"); if (b) dialKey(b.dataset.k); });
    $(".mn-dial-del", t).addEventListener("click", () => dialKey("del"));
    $("#mnDialCall").addEventListener("click", dialOut);
    for (const b of $$("[data-num]", t)) b.addEventListener("click", () => { S.dial = b.dataset.num; CB.SFX.play("tap"); dialNum(); });
    dialNum();
  }
  function dialKey(k) {
    if (k === "del") S.dial = S.dial.slice(0, -1);
    else if (S.dial.length < 14) { S.dial += k; CB.SFX.play("dtmf"); keyFx($(`#mnDialKeys [data-k="${k === "#" ? "\\#" : k === "*" ? "\\*" : k}"]`)); }
    dialNum();
  }
  function dialNum() {
    const n = $("#mnDialNum");
    if (n) n.innerHTML = S.dial ? esc(shownNum(S.dial) || S.dial) : `<span class="mn-dial-ph">${bi("Type a number", "輸入號碼")}</span>`;
  }

  function dialOut() {
    const num = digitsOf(S.dial).replace(/^00/, "");
    if (!num || S.app !== "dial") return;
    S.recents.unshift({ num: shownNum(num), t: clockAt(S.clock), dir: "out" });
    S.dial = "";
    if (num === NUM.soc) return callSoc();
    if (num === FAKE && S.fired[CALL.id]) return callFake();     // 11/22 review: a call-back only once that call has rung; before, any unknown number
    lineCall(num);
  }

  function outgoing(t, name, num, av, cls, onEnd) {
    t.innerHTML = `<div class="mn-call is-dialing"><p class="mn-call-label">${bi("Calling", "撥號中")}</p><span class="mn-call-av ${cls || ""}" aria-hidden="true">${esc(av)}</span>
      <p class="mn-call-name">${name}</p><p class="mn-call-num">${numHTML(num)}</p><div class="rs-ring" aria-hidden="true"><i></i><i></i><i></i></div>
      <button type="button" class="mn-end" data-end aria-label="End call">${ICON.hang}</button></div>`;
    $("[data-end]", t).addEventListener("click", () => { if (onEnd) onEnd(); untake(); });
    CB.SFX.play("ring");
  }

  function lineCall(num) {   // Security, the Help Desk, or nobody
    const t = take("line");
    const who = num === NUM.security ? "security" : num === NUM.helpdesk ? "helpdesk" : null;
    const c = who ? story.contacts.find((x) => x.key === who) : null;
    outgoing(t, c ? bi(c.en, c.zh) : esc(shownNum(num)), c ? c.number : shownNum(num), who === "security" ? "SEC" : who === "helpdesk" ? "IT" : "?", "");
    setTimeout(() => {
      if (!S || S.over || S.app !== "line") return;
      const line = (CON.lines || {})[who || "none"] || { en: "", zh: "" };
      t.innerHTML = `<div class="mn-call is-talking"><p class="mn-call-label">${numHTML(c ? c.number : shownNum(num))}${c ? ` · ${bi(c.en, c.zh)}` : ""}</p>
        <div class="mn-talk"><p class="mn-bubble">“${esc(line.en)}”<span lang="zh-Hant">${esc(line.zh)}</span></p></div>
        <button type="button" class="mn-end" data-end aria-label="End call">${ICON.hang}<span>${bi("End call", "掛斷")}</span></button></div>`;
      $("[data-end]", t).addEventListener("click", untake);
    }, reduceMotion ? 150 : 1500);
  }

  /* ------------------------------------------------------------------ the call in Jun-Hao's name */
  function callScreen() {
    const t = $("#mnTake"), c = S.call, e = c.e;
    if (c.state === "ringing") {
      t.innerHTML = `<div class="mn-call is-ringing"><p class="mn-call-label">${bi("Incoming call", "來電")}</p>
        <span class="mn-call-av" aria-hidden="true">JL</span><p class="mn-call-name">${bi(e.name_en, e.name_zh)}</p><p class="mn-call-num">${esc(e.number)}</p>
        <div class="rs-ring" aria-hidden="true"><i></i><i></i><i></i></div><i class="mn-n-bar mn-ring-bar"><b id="mnRingBar"></b></i>
        <div class="mn-call-foot"><button type="button" class="mn-decline" data-c="decline">${ICON.hang}<span>${bi("Decline", "拒接")}</span></button>
          ${slideHTML("answer", bi("Slide to answer", "滑動接聽"), "Answer the call: drag the knob to the right")}</div></div>`;
      $("[data-c]", t).addEventListener("click", () => callEnd("declined"));
      slideCtl($(".mn-slide", t), callAnswer);
      return;
    }
    const open = c.fake ? [e.again_en, e.again_zh] : [e.open_en, e.open_zh];
    t.innerHTML = `<div class="mn-call is-talking is-fake"><p class="mn-call-label">${esc(e.number)} · ${bi(e.name_en, e.name_zh)}<b class="mn-call-time" id="mnCallT">00:00</b></p>
      ${c.pad ? `<p class="mn-sms is-mini">${ICON.lake}<span>${bi(`Code ${e.code} · never share it`, `驗證碼 ${e.code}・不要給任何人`)}</span></p>`
        : `<div class="mn-sms"><p class="mn-n-app">${ICON.lake}<span>${APP}</span><time>${bi("now", "現在")}</time></p>
        <p>${bi(`Your one-time code is ${e.code}. Never share it. The SOC will never ask for it.`, `你的一次性驗證碼是 ${e.code}。不要給任何人，資安監控中心不會跟你要。`)}</p></div>`}
      <div class="mn-talk" id="mnTalk"><p class="mn-bubble">“${esc(open[0])}”<span lang="zh-Hant">${esc(open[1])}</span></p></div>
      <div class="mn-incall" id="mnInCall">${c.pad ? `<p class="mn-typed-row"><span class="mn-typed" id="mnTyped">${esc(c.typed) || "&nbsp;"}</span><button type="button" class="mn-pad-hide" data-ctl="hide">${bi("Hide keypad", "收起鍵盤")}</button></p>${keysHTML("mnCallKeys")}` : `<div class="mn-callctl">
        <button type="button" data-ctl="mute">${ICON.mute}<span>${bi("Mute", "靜音")}</span></button>
        <button type="button" data-ctl="pad">${ICON.pad}<span>${bi("Keypad", "鍵盤")}</span></button>
        <button type="button" data-ctl="spk">${ICON.spk}<span>${bi("Speaker", "擴音")}</span></button></div>`}</div>
      <button type="button" class="mn-end" data-end aria-label="End call">${ICON.hang}<span>${bi("End call", "掛斷")}</span></button></div>`;
    $("[data-end]", t).addEventListener("click", () => callEnd("hang"));
    for (const b of $$("[data-ctl]", t)) b.addEventListener("click", () => {
      if (b.dataset.ctl === "pad" || b.dataset.ctl === "hide") { c.pad = b.dataset.ctl === "pad"; CB.SFX.play("tap"); return callScreen(); }
      b.classList.toggle("is-on"); CB.SFX.play("tap");
    });
    const keys = $("#mnCallKeys");
    if (keys) keys.addEventListener("click", (ev) => { const b = ev.target.closest("[data-k]"); if (b) callKey(b.dataset.k); });
    for (let k = 0; k < c.said; k++) talkLine((CALL.push || [])[k]);
    const box = $("#mnTalk");
    if (box) box.scrollTop = box.scrollHeight;
  }

  function callAnswer() {
    if (!S.call || S.call.state !== "ringing") return;
    S.call.state = "talking";
    S.call.talk = 0;
    CB.SFX.play("open");
    callScreen();
  }

  function talkLine(l, cls) {
    const box = $("#mnTalk");
    if (!box || !l) return;
    box.insertAdjacentHTML("beforeend", `<p class="mn-bubble ${cls || ""}">“${esc(l.en)}”<span lang="zh-Hant">${esc(l.zh)}</span></p>`);
    box.scrollTop = box.scrollHeight;
  }

  function callPressure() {
    const c = S.call, lines = CALL.push || [];
    const due = c.talk >= 14 ? 2 : c.talk >= 7 ? 1 : 0;
    while (c.said < due && c.said < lines.length) { talkLine(lines[c.said]); c.said += 1; }
    const tt = $("#mnCallT");
    if (tt) tt.textContent = `00:${CB.pad2(Math.floor(c.talk))}`;
  }

  async function callKey(k) {   // what you type on the keypad during a call goes down the line as tones
    const c = S.call;
    if (!c || c.state !== "talking") return;
    c.typed += k;
    CB.SFX.play("dtmf");
    keyFx($(`#mnCallKeys [data-k="${k === "#" ? "\\#" : k === "*" ? "\\*" : k}"]`));
    const typed = $("#mnTyped");
    if (typed) typed.textContent = c.typed;
    const ds = digitsOf(c.typed);
    if (ds.length < CODE.length) return;
    if (ds.endsWith(CODE)) {
      talkLine({ en: CALL.got_en, zh: CALL.got_zh });
      c.state = "sending";
      await wait(900);
      return callEnd("read");
    }
    if (ds.length >= CODE.length) { talkLine({ en: CALL.wrong_en, zh: CALL.wrong_zh }); c.typed = ""; if (typed) typed.innerHTML = "&nbsp;"; }
  }

  async function callEnd(k) {
    const c = S.call;
    if (!c || c.state === "done") return;
    if (c.state === "sending") k = "read";     // the six digits already went down the line
    const e = c.e, wasFake = c.fake;
    c.state = "done";
    c.pad = false;
    if (S.app === "call") untake();
    if (k === "read") {
      S.res[e.id] = "read";
      S.approved += 1;
      S.codeGiven = true;
      addLog(clockAt(S.clock), bi(`Typed the code ${e.code} for a caller using Jun-Hao's name (${e.number}).`, `替冒充俊豪的來電（${e.number}）按出了驗證碼 ${e.code}。`), "is-bad");
      return breach(e.damage, e);
    }
    if (wasFake) {
      addLog(clockAt(S.clock), bi(`Called back ${e.number}: the same voice wanted the code again. The number that rang you belongs to the caller, not to the SOC.`,
        `回撥 ${e.number}：同一個聲音又要驗證碼。打來的號碼是那個人的，不是資安監控中心的。`), "is-miss");
      return;
    }
    S.res[e.id] = k;     // missed / declined / hang / gaveup
    const txt = k === "missed" ? bi(`Missed call from ${e.number}.`, `${e.number} 的未接來電。`)
      : k === "declined" ? bi(`Declined a call from ${e.number}.`, `拒接了 ${e.number} 的來電。`)
      : k === "gaveup" ? bi(`"Jun-Hao" (${e.number}) hung up when you didn't type the code.`, `你一直沒按驗證碼，「俊豪」（${e.number}）就掛了。`)
      : bi(`Hung up on "Jun-Hao" (${e.number}).`, `掛掉「俊豪」（${e.number}）的電話。`);
    addLog(clockAt(S.clock), txt, "is-miss");
  }

  function callFake() {   // you rang back the number that called you
    const t = take("call");
    S.calledFake = true;
    outgoing(t, bi(CALL.name_en, CALL.name_zh), CALL.number, "JL", "");
    setTimeout(() => {
      if (!S || S.over || S.app !== "call") return;
      S.call = Object.assign(S.call || { e: CALL, ringT: 0, left: 0 }, { state: "talking", fake: true, talk: 0, typed: "", said: 0, pad: false });
      callScreen();
    }, reduceMotion ? 150 : 1500);
  }

  /* ------------------------------------------------------------------ calling the real SOC: you dialled 2199 */
  function callSoc() {
    const t = take("soc");
    S.soc = { state: "dialing", said: new Set() };
    outgoing(t, bi("SOC", "資安監控中心"), "ext. 2199", "SOC", "is-soc", () => { S.soc = null; });
    setTimeout(() => { if (S && !S.over && S.soc && S.soc.state === "dialing" && S.app === "soc") socTalk(); }, reduceMotion ? 200 : 1500);
  }

  function happened(k) {   // only what has happened by now can be reported
    if (k === "prompts") return PUSHES.some((e) => S.fired[e.id] && S.res[e.id] !== "stopped");
    // 11/22: after a call-back to 2199 the result reads "back"; what you heard still depends on how the call itself ended.
    // Ringing his number back counts too: once that call connects (S.call.fake) he asks for the code again, even after a missed call.
    if (k === "caller") return !!(S.call && S.call.state === "done" && (S.call.fake || !["missed", "declined"].includes(S.res[CALL.id] === "back" ? S.callWas : S.res[CALL.id])));
    if (k === "door") return DOORS.some((e) => e.box === "reader" && S.fired[e.id]);     // the card names Kevin's blocked badge
    if (k === "gave") return S.approved > 0;
    return true;
  }

  function socTalk() {
    // 11/22: a missed call followed by your own call to 2199 counts like the other safe endings (review)
    const k0 = S.res[CALL.id], after = ["hang", "declined", "gaveup", "missed"].includes(k0);
    if (after) {
      S.callWas = k0;
      S.res[CALL.id] = "back";
      S.points += P.back; H.points(S.points, S.streak, P.back);
      addLog(clockAt(S.clock), bi(`Called the SOC yourself on 2199 after the call from ${CALL.number}.`, `接到 ${CALL.number} 的電話之後，自己撥 2199 給資安監控中心。`), "is-ok");
    }
    const t = $("#mnTake");
    const head = `<p class="mn-call-label">${numHTML("ext. 2199")} · ${bi("SOC, Jun-Hao", "資安監控中心 俊豪")}</p>`;
    const opening = (after ? `<p class="mn-bubble is-me">${bi("Did you just call me?", "你剛剛有打給我嗎？")}</p>` : "")
      + `<p class="mn-bubble is-real">“${after ? esc(CALL.right_en) : S.reported ? esc(CON.soc_again_en) : "SOC, Jun-Hao. What's happening?"}”<span lang="zh-Hant">${after ? esc(CALL.right_zh) : S.reported ? esc(CON.soc_again_zh) : "資安監控中心，我是俊豪。發生什麼事？"}</span></p>`;
    if (S.reported) {     // a second call: nothing new to report
      S.soc.state = "done";
      t.innerHTML = `<div class="mn-call is-talking is-soc">${head}<div class="mn-talk">${opening}</div>
        <button type="button" class="mn-end" data-end aria-label="Hang up">${ICON.hang}<span>${bi("Hang up", "掛斷")}</span></button></div>`;
      $("[data-end]", t).addEventListener("click", untake);
      return;
    }
    S.soc.state = "talking";
    S.soc.items = story.report.filter((r) => r.bad || happened(r.k));
    t.innerHTML = `<div class="mn-call is-talking is-soc">${head}
      <div class="mn-talk is-drop" id="mnTalk">${opening}<p class="mn-drop-hint" id="mnDropHint">${bi("Drag what you want to tell him up here", "把要說的話拖上來")}</p></div>
      <div class="mn-deck" id="mnDeck">${S.soc.items.map((r) => `<button type="button" class="mn-line" data-k="${esc(r.k)}">${bi(r.en, r.zh)}</button>`).join("")}</div>
      <div class="mn-soc-foot"><button type="button" class="btn mn-tell" id="mnTell" disabled>${bi("That's everything", "就這些")}</button>
        <button type="button" class="mn-end is-small" data-end aria-label="Hang up">${ICON.hang}</button></div></div>`;
    for (const b of $$(".mn-line", t)) dragSay(b, $("#mnTalk"), () => sayLine(b));
    $("#mnTell").addEventListener("click", reportDone);
    $("[data-end]", t).addEventListener("click", () => { if (S.soc.said.size) reportDone(); else { S.soc = null; untake(); } });
  }

  /* Drag a line into the call to say it (Enter says it from the keyboard). A tap only nudges it up. */
  function dragSay(card, zone, onDrop) {
    let p = null;
    const inside = (ev) => { const r = zone.getBoundingClientRect(); return ev.clientX >= r.left && ev.clientX <= r.right && ev.clientY >= r.top && ev.clientY <= r.bottom; };
    card.addEventListener("pointerdown", (ev) => {
      if (ev.button !== 0 || card.disabled) return;
      ev.preventDefault();
      const r = card.getBoundingClientRect();
      p = { dx: ev.clientX - r.left, dy: ev.clientY - r.top, x0: ev.clientX, y0: ev.clientY, moved: false, ghost: null };
      cap(card, ev.pointerId);
    });
    card.addEventListener("pointermove", (ev) => {
      if (!p) return;
      if (!p.moved && Math.hypot(ev.clientX - p.x0, ev.clientY - p.y0) > 5) {
        p.moved = true;
        const g = card.cloneNode(true);
        g.className = "mn-line mn-line-ghost";
        g.style.width = `${card.getBoundingClientRect().width}px`;
        document.body.appendChild(g);
        p.ghost = g;
        card.classList.add("is-lifted");
        CB.SFX.play("paper");
      }
      if (p.ghost) { p.ghost.style.transform = `translate(${ev.clientX - p.dx}px, ${ev.clientY - p.dy}px) rotate(-2deg)`; zone.classList.toggle("is-target", inside(ev)); }
    });
    const end = (ev) => {
      if (!p) return;
      const { moved, ghost } = p;
      p = null;
      card.classList.remove("is-lifted");
      zone.classList.remove("is-target");
      if (ghost) ghost.remove();
      if (!moved) { card.classList.remove("is-nudge"); void card.offsetWidth; card.classList.add("is-nudge"); return; }
      if (inside(ev)) onDrop();
    };
    card.addEventListener("pointerup", end);
    card.addEventListener("pointercancel", end);
    card.addEventListener("keydown", (ev) => { if (ev.key === "Enter" || ev.key === " ") { ev.preventDefault(); onDrop(); } });
  }

  function sayLine(b) {
    if (!S.soc || S.soc.state !== "talking" || b.disabled) return;
    const r = S.soc.items.find((x) => x.k === b.dataset.k);
    b.disabled = true;
    b.classList.add("is-said");
    setTimeout(() => b.remove(), reduceMotion ? 0 : 240);
    S.soc.said.add(r.k);
    const box = $("#mnTalk"), hint = $("#mnDropHint");
    if (hint) hint.remove();
    box.insertAdjacentHTML("beforeend", `<p class="mn-bubble is-me">${bi(r.en, r.zh)}</p>`);
    box.scrollTop = box.scrollHeight;
    CB.SFX.play("tap");
    const pts = r.good ? P.good : r.bad ? -P.bad : 0;
    S.points = Math.max(0, S.points + pts); H.points(S.points, S.streak, pts || null);
    $("#mnTell").disabled = false;
    setTimeout(() => {
      if (!S || S.over || !S.soc || S.soc.state !== "talking") return;
      const gave = r.k === "caller" && S.res[CALL.id] === "read" && r.ack_gave_en;
      const en = gave ? r.ack_gave_en : r.good ? r.ack_en : r.why_en, zh = gave ? r.ack_gave_zh : r.good ? r.ack_zh : r.why_zh;
      box.insertAdjacentHTML("beforeend", `<p class="mn-bubble is-real${r.bad ? " is-no" : ""}">“${esc(en)}”<span lang="zh-Hant">${esc(zh)}</span></p>`);
      box.scrollTop = box.scrollHeight;
      CB.SFX.play(r.good ? "good" : "bad");
    }, reduceMotion ? 100 : 750);
  }

  function reportDone() {
    if (!S.soc || S.soc.state !== "talking") return;
    const items = S.soc.items, said = S.soc.said;
    const good = items.filter((r) => r.good), bad = items.filter((r) => r.bad);
    const gotGood = good.filter((r) => said.has(r.k)), gotBad = bad.filter((r) => said.has(r.k));
    S.reported = { at: S.clock, good: gotGood.map((r) => r.k), bad: gotBad.map((r) => r.k), allGood: good.length > 0 && gotGood.length === good.length && !gotBad.length,
      missed: good.filter((r) => !said.has(r.k)).map((r) => r.k) };
    S.soc.state = "done";
    S.pwReset = true;
    for (const n of S.notifs.filter((x) => x.kind === "push")) S.res[n.id] = "stopped";
    S.notifs = S.notifs.filter((x) => x.kind !== "push");
    syncNotifs();
    const t = $("#mnTake");
    t.innerHTML = `<div class="mn-call is-talking is-soc"><p class="mn-call-label">${numHTML("ext. 2199")} · ${bi("SOC, Jun-Hao", "資安監控中心 俊豪")}</p>
      <div class="mn-talk"><p class="mn-bubble is-real">“${esc(story.soc_reply_en)}”<span lang="zh-Hant">${esc(story.soc_reply_zh)}</span></p></div>
      ${S.reported.missed.length ? `<p class="mn-miss">${bi("You could also have told him:", "其實還可以告訴他：")}</p><ul class="mn-miss-l">${S.reported.missed.map((k) => { const r = story.report.find((x) => x.k === k); return `<li>${bi(r.en, r.zh)}</li>`; }).join("")}</ul>` : ""}
      <button type="button" class="mn-end" data-end aria-label="Hang up">${ICON.hang}<span>${bi("Hang up", "掛斷")}</span></button></div>`;
    $("[data-end]", t).addEventListener("click", untake);
    addLog(clockAt(S.clock), bi("Called the SOC on 2199 and reported it. Password reset, all sessions signed out.", "撥 2199 回報資安監控中心。密碼已重設，所有工作階段都登出了。"), S.reported.allGood ? "is-ok" : "is-miss");
  }

  /* ------------------------------------------------------------------ your own sign-in: type the number your laptop shows */
  function portal() {
    const box = $("#mnPortal");
    if (!box) return;
    const o = S.own;
    if (o.state === "idle") { box.innerHTML = `<p class="mn-portal-idle">${bi("On-call portal · signed out", "值班入口・未登入")}</p>`; return; }
    if (o.state === "ready") {
      box.innerHTML = `<div class="mn-portal-in"><p class="mn-portal-t">${bi("Sign in to lock the camera clip", "登入後鎖住監視器影片")}</p>
        <p class="mn-portal-d">${o.tries ? bi("The last try was blocked. Sign in again.", "上一次被擋下了，再登入一次。") : bi(o.e.ask_en, o.e.ask_zh)}</p><button type="button" class="btn mn-signin" id="mnSignIn">${bi("Sign in", "登入")}</button><i class="mn-n-bar"><b id="mnOwnBar"></b></i></div>`;
      $("#mnSignIn").addEventListener("click", ownStart);
      return;
    }
    if (o.state === "prompt") {
      box.innerHTML = `<div class="mn-portal-in is-match"><p class="mn-portal-t">${bi("Type this number in the app on your phone", "在手機 App 裡輸入這個號碼")}</p>
        <p class="mn-match">${esc(o.e.match)}</p><p class="mn-portal-d">${bi("Waiting for your phone…", "等你的手機…")}</p><i class="mn-n-bar"><b id="mnOwnBar"></b></i></div>`;
      return;
    }
    const ok = o.state === "ok";
    box.innerHTML = `<div class="mn-portal-in ${ok ? "is-ok" : "is-late"}"><p class="mn-portal-t">${ok ? bi("Signed in. Clip 03:12 to 03:17 locked.", "已登入，03:12 到 03:17 的影片已鎖住。") : bi("The portal timed out. Security kept the clip by hand.", "入口逾時了，安全室手動保存了影片。")}</p></div>`;
  }

  function ownStart() {
    const o = S.own;
    if (o.state !== "ready") return;
    o.state = "prompt";
    o.typed = "";
    o.left = o.e.secs;      // a fresh wait for the number, like a real sign-in page
    CB.SFX.play("tap");
    portal();
    S.notifs = S.notifs.filter((n) => n.id !== "own");
    addNotif({ id: "own", kind: "own", e: o.e });
    buzz();
    if (!S.app) openAuth();
  }

  function openAuth() {
    const o = S.own;
    if (o.state !== "prompt" || (S.app && S.app !== "auth")) return;
    const t = take("auth");
    t.innerHTML = `<div class="mn-app mn-auth"><p class="mn-auth-app">${ICON.lake}<span>${APP}</span></p>
      <p class="mn-auth-q">${bi("Are you trying to sign in?", "你正在登入嗎？")}</p>
      <p class="mn-auth-where">${bi(o.e.where_en, o.e.where_zh)}</p>
      <p class="mn-auth-ask">${bi("Enter the number shown on your screen.", "輸入螢幕上顯示的號碼。")}</p>
      <div class="mn-auth-boxes" id="mnAuthBoxes"><b></b><b></b></div>
      ${keysHTML("mnAuthKeys", [["1", ""], ["2", ""], ["3", ""], ["4", ""], ["5", ""], ["6", ""], ["7", ""], ["8", ""], ["9", ""], ["", ""], ["0", ""], ["del", ""]])}
      <div class="mn-auth-btns"><button type="button" class="mn-auth-no" id="mnAuthNo">${bi("No, it's not me", "不是我")}</button><button type="button" class="mn-auth-yes" id="mnAuthYes" disabled>${bi("Yes", "是我")}</button></div></div>`;
    $("#mnAuthKeys").addEventListener("click", (ev) => { const b = ev.target.closest("[data-k]"); if (b) authKey(b.dataset.k); });
    $("#mnAuthNo").addEventListener("click", () => ownAnswer("deny"));
    $("#mnAuthYes").addEventListener("click", () => ownAnswer(o.typed));
    authDraw();
  }
  function authKey(k) {
    const o = S.own;
    if (o.state !== "prompt" || S.app !== "auth") return;
    if (k === "del") o.typed = o.typed.slice(0, -1);
    else if (o.typed.length < 2) { o.typed += k; CB.SFX.play("dtmf"); keyFx($(`#mnAuthKeys [data-k="${k}"]`)); }
    authDraw();
  }
  function authDraw() {
    const o = S.own, bx = $$("#mnAuthBoxes b");
    bx.forEach((b, i) => { b.textContent = o.typed[i] || ""; b.classList.toggle("is-on", i === o.typed.length); });
    const y = $("#mnAuthYes");
    if (y) y.disabled = o.typed.length < 2;
  }

  function ownAnswer(x) {
    const o = S.own;
    if (o.state !== "prompt") return;
    S.notifs = S.notifs.filter((n) => n.id !== "own");
    syncNotifs();
    if (S.app === "auth") untake();
    if (x === o.e.match) return ownResolve("ok");
    o.tries += 1;
    S.points = Math.max(0, S.points - P.ownWrong); H.points(S.points, S.streak, -P.ownWrong);
    CB.SFX.play("bad");
    addLog(clockAt(S.clock), x === "deny" ? bi("You denied your own sign-in. Try again.", "你拒絕了自己的登入，再試一次。")
      : bi(`Wrong number (${x || "none"}): the sign-in was blocked. Try again.`, `號碼輸入錯誤（${x || "沒有輸入"}），登入被擋下了，再試一次。`), "is-miss");
    o.state = "ready";
    portal();
  }

  function ownResolve(k) {
    const o = S.own;
    S.notifs = S.notifs.filter((n) => n.id !== "own");
    if (S.app === "auth") untake();
    o.state = k;
    S.res[o.e.id] = k === "ok" ? (o.tries ? "ok_late" : "ok") : "late";
    if (k === "ok") {
      const pts = o.tries ? Math.round(P.own / 2) : P.own;
      S.points += pts; H.points(S.points, S.streak, pts);
      CB.SFX.play("good");
      addLog(clockAt(S.clock), bi(`Signed in to the on-call portal (number ${o.e.match}) and locked the camera clip.`, `用號碼 ${o.e.match} 登入值班入口，鎖住了監視器影片。`), "is-ok");
    } else addLog(clockAt(S.clock), bi("The on-call portal timed out before you signed in.", "還沒登入，值班入口就逾時了。"), "is-miss");
    syncNotifs();
    portal();
  }

  /* ------------------------------------------------------------------ 03:25 */
  const right = () => ({
    prompts: S.approved === 0 && S.res[CALL.id] !== "read" ? 1 : 0,
    doors: DOORS.filter((e) => (e.options.find((o) => o.k === S.res[e.id]) || {}).good).length,
    call: S.res[CALL.id] === "back" ? 1 : 0,
    own: S.res[OWN.id] === "ok" ? 1 : 0,
    report: S.reported && S.reported.allGood ? 1 : 0,
  });
  const shiftScore = () => Object.values(right()).reduce((a, b) => a + b, 0);

  async function endShift() {
    if (S.over) return;
    for (const a of S.alerts.slice()) doorDone(a, "none");          // 03:25: whatever is still open ends the way it stands
    if (S.call && S.call.state !== "done" && S.call.state !== "sending") callEnd(S.call.state === "ringing" ? "missed" : "gaveup");
    if (S.own.state === "ready" || S.own.state === "prompt") ownResolve("late");
    if (S.soc && S.soc.state === "talking") reportDone();
    untake();
    S.over = true;
    loop.stop();
    for (const n of S.notifs.slice()) expire(n);
    const from = S.clock;
    for (let k = 1; k <= 8; k++) { S.clock = from + ((TEND - from) * k) / 8; H.clock(clockAt(S.clock)); await wait(60); }
    await wait(300);
    summary();
  }

  function summary() {
    st.scene("mn_room", 0.35);
    const r = right();
    const denied = PUSHES.filter((e) => S.res[e.id] === "denied").length, stopped = PUSHES.filter((e) => S.res[e.id] === "stopped").length;
    st.body.innerHTML = `<section class="rs-dinner mn-sum">
      <p class="rs-kicker">${bi(`${story.end} · quiet again`, `${story.end}・安靜下來了`)}</p>
      <h2 class="rs-dinner-title">${S.shields < sh.shields ? bi(`You made it to morning with ${S.shields} shield${S.shields > 1 ? "s" : ""}.`, `撐到天亮了，還剩 ${S.shields} 面盾牌。`)
        : !denied && !r.doors && !S.reported ? bi("Nothing got through, but nobody was answering the phone.", "歹徒什麼都沒得逞，不過整晚都沒人接手機。")
        : bi("Nothing you didn't start got a yes from you.", "不是你發起的，你一個都沒同意。")}</h2>
      <div class="rx-stats rs-dinner-stats">
        <div><b>${denied}${stopped ? `<small>+${stopped}</small>` : ""}</b><span>${bi(stopped ? "prompts denied, + stopped by your report" : "prompts denied", stopped ? "拒絕的通知，加上回報後停掉的" : "拒絕的通知")}</span></div>
        <div><b>${r.doors}/${DOORS.length}</b><span>${bi("door alerts handled", "門禁通知處理對的")}</span></div>
        <div><b>${r.call ? "✓" : "✗"}</b><span>${bi("the call in Jun-Hao's name", "冒充俊豪的電話")}</span></div>
        <div><b>${r.report ? "✓" : S.reported ? "△" : "✗"}</b><span>${bi("reported to 2199", "打 2199 回報")}</span></div>
        <div><b class="rs-shields-row">${Array.from({ length: sh.shields }, (_, k) => CB.ICON.shield(k < S.shields)).join("")}</b><span>${bi("shields left", "剩下的盾牌")}</span></div></div>
      ${S.reported ? "" : `<p class="mn-late-call">${bi("03:24: the SOC called you. They had seen the prompts on their side and reset your password. Next time, call 2199 the moment it starts.", "03:24 資安監控中心打給你：他們那邊看到了這些通知，已經幫你重設密碼。下次一開始就打 2199。")}</p>`}
      ${CB.personHTML({ svg: CB.analyst(), name: ANALYST.name, name_zh: ANALYST.name_zh, role_en: ANALYST.role_en, role_zh: ANALYST.role_zh },
        bi(`Get some sleep. Security pulled the door log; I'll bring the sign-in logs. 07:30 at the policy board in the corridor.${S.log.length ? " Bring your night log." : ""}`,
          `去睡一下吧。安全室調出了門禁紀錄，我會帶登入紀錄。七點半走廊的政策公告欄見。${S.log.length ? "值班紀錄記得帶著。" : ""}`))}
      <button type="button" class="btn rs-start">${bi("07:30, the corridor", "早上七點半，走廊")}</button></section>`;
    G.meter(`<div class="rx-hud"><div class="rx-hud-clock"><b>${esc(story.end)}</b><span>${bi("on call", "值班")}</span></div><div class="rx-hud-pts"><b>${S.points.toLocaleString("en-US")}</b><span>${bi("points", "分")}</span></div></div>`);
    $(".rs-start", st.body).addEventListener("click", async () => {
      await CB.timeskip(st, { from: story.end, to: BOARD.time, place_en: "The Security Policy Board in the corridor", place_zh: "走廊的資安政策公告欄", day_en: "The morning after", day_zh: "隔天早上" });
      startBoard();
    });
    window.scrollTo({ top: 0, behavior: reduceMotion ? "auto" : "smooth" });
  }

  function gameOver() {
    S.over = true;
    loop.stop();
    st.$rs.classList.remove("is-paused");
    st.scene("mn_hall", 0.15);
    const items = S.losses.map((x) => `<li>${bi(x.dm.hit_en, x.dm.hit_zh)}</li>`).join("");
    const hall = S.losses.some((x) => x.e.kind === "door"), acct = S.losses.some((x) => x.e.kind !== "door");
    const title = hall && acct ? ["The crew is in: your account, and the Banquet Hall.", "歹徒進來了：你的帳號，還有宴會廳。"]
      : hall ? ["The crew is in the Banquet Hall.", "歹徒進了宴會廳。"] : ["The crew is in your account.", "歹徒進了你的帳號。"];
    CB.over(st, { time: clockAt(S.clock), title_en: title[0], title_zh: title[1], items,
      text_en: "Try the night again: swipe away what you didn't start, type no code for a caller, keep the door and the lost badge shut, and dial 2199 yourself.",
      text_zh: "再試一次：不是你發起的就滑掉，驗證碼不幫來電的人按，門和遺失的卡都維持鎖住，然後自己撥 2199。",
      pic: acct ? `<div class="mn-over-phone"><p>${bi("Lakeside SSO · signed in", "Lakeside SSO・已登入")}</p><b>203.0.113.45</b><span>${bi("outside Taiwan · just now", "國外・剛剛")}</span></div>`
        : `<div class="mn-over-phone"><p>${bi("Banquet Hall door · open", "宴會廳門口・門開著")}</p><b>${esc(clockAt(S.clock))}</b><span>${bi("opened from the on-call console", "從值班控制台打開的")}</span></div>`,
      again: () => Games.mfa(d, main, true) });
    G.meter(`<div class="rx-hud"><div class="rx-hud-pts"><b>${S.points.toLocaleString("en-US")}</b><span>${bi("points", "分")}</span></div></div>`);
  }

  /* ------------------------------------------------------------------ the case board at the corridor policy board */
  const ssoRows = () => {
    const rows = BOARD.sso.rows.map((r, k) => Object.assign({ k }, r));
    const n = PUSHES.filter((e) => S.fired[e.id] && S.res[e.id] !== "stopped").length;
    const a = S.approved - (S.codeGiven ? 1 : 0);      // prompts you approved; the code typed for a caller is its own line
    for (const r of rows) if (r.user === "trainee") {
      if (S.reported) r.t = `${story.start}–${clockAt(S.reported.at)}`;      // the attempts stop when your password is reset
      if (a || S.codeGiven) {
        r.kind = "approved"; r.mine = true;
        r.en = CB.fill(a ? r.you_en : r.en, { n, a }); r.zh = CB.fill(a ? r.you_zh : r.zh, { n, a });
        if (S.codeGiven) { r.en += ` · code ${CALL.code} typed for a caller, password reset and signed in`; r.zh += ` · 替來電者按了驗證碼 ${CALL.code}，密碼被重設並登入`; }
      } else { r.en = CB.fill(r.en, { n }); r.zh = CB.fill(r.zh, { n }); }
    }
    return rows;
  };
  // did anyone open the Banquet Hall door from the console last night? (11/21 night: the board used to show a clean night)
  const doorOpened = () => DOORS.some((e) => (e.options.find((o) => o.k === S.res[e.id]) || {}).bad);
  const youSaidYes = () => !!S && S.approved > 0;
  // 11/22 review: Kevin's badge was unblocked before the crew tapped it, so its line on the door log reads "accepted" (doorRows)
  const badgeTaken = () => DOORS.some((e) => e.box === "reader" && S.via[e.id] === "before");
  /* the questions as they read after this particular night */
  const QV = () => QS.map((q) => {
    // 11/22: the door was opened from the console: the how-to line and the hint for a wrong line say so too (review);
    // when the reader took the unblocked badge, the pair that says so (how_accepted, wrong_evidence_accepted in games.yaml)
    if (q.kind === "choose" && q.en_open && S && doorOpened()) {
      const v = badgeTaken() && q.how_accepted_en ? "accepted" : "open";
      return Object.assign({}, q, { en: q.en_open, zh: q.zh_open, solved_en: q.solved_open_en, solved_zh: q.solved_open_zh,
        how_en: q[`how_${v}_en`] || q.how_en, how_zh: q[`how_${v}_zh`] || q.how_zh, wrong_evidence_en: q[`wrong_evidence_${v}_en`] || q.wrong_evidence_en, wrong_evidence_zh: q[`wrong_evidence_${v}_zh`] || q.wrong_evidence_zh });
    }
    if (q.kind === "logs" && q.en_you && youSaidYes()) return Object.assign({}, q, { en: q.en_you, zh: q.zh_you, how_en: q.how_you_en, how_zh: q.how_you_zh, solved_en: q.solved_you_en, solved_zh: q.solved_you_zh });
    return q;
  });
  /* the door log as it happened: remote opens from the console show up, and a door that opened is not "held shut" */
  function doorRows() {
    const rows = BOARD.door_log.rows.map((r) => Object.assign({}, r));
    if (!S) return rows;
    const at = { d1: "03:12:40", d2: "03:15:12", d3: "03:16:52" };      // just after each alert (d1: after the second wrong code)
    let remote = false;
    for (const e of DOORS) {
      const o = e.options.find((x) => x.k === S.res[e.id]) || {};
      if (!o.bad) continue;
      if (e.box === "reader" && S.via[e.id] === "before") {      // 11/22 review: unblocked before the crew tapped it, so the reader took it
        rows.push({ t: S.beforeAt, en: `Badge ${BADGE_ID} unblocked from the on-call console`, zh: `值班控制台解除員工證 ${BADGE_ID} 的停用`, kind: "remote" });
        const bb = rows.find((r) => r.kind === "badge_blocked");     // keeps its kind: question 2's evidence is still this line
        if (bb) Object.assign(bb, { en: `Badge ${BADGE_ID} (${BD.en}) · accepted (unblocked at ${S.beforeAt} from the console)`, zh: `員工證 ${BADGE_ID}（${BD.zh}）· 通過（${S.beforeAt} 已從控制台解除停用）` });
        const al = rows.find((r) => r.kind === "alarm");
        if (al) Object.assign(al, { en: `Door opened with badge ${BADGE_ID}`, zh: `員工證 ${BADGE_ID} 刷卡開門`, kind: "opened" });
      } else if (e.box === "reader" && S.via[e.id] !== "unlock") {      // the lost badge was unblocked (sliding "unlock" at the reader is a remote open)
        rows.push({ t: at[e.id] || e.cam, en: `Badge ${BADGE_ID} unblocked from the on-call console`, zh: `值班控制台解除員工證 ${BADGE_ID} 的停用`, kind: "remote" });
        const al = rows.find((r) => r.kind === "alarm");
        if (al) Object.assign(al, { en: `Door opened with badge ${BADGE_ID} after it was unblocked`, zh: `員工證 ${BADGE_ID} 解除停用後，門打開了`, kind: "opened" });
      } else { rows.push({ t: at[e.id] || e.cam, en: "Unlocked remotely from the on-call console · door open", zh: "值班控制台遠端開門 · 門打開", kind: "remote" }); remote = true; }
    }
    // 11/22: after a remote open the alarm line no longer says the door was held shut (review: it contradicted the line above)
    const al = remote && rows.find((r) => r.kind === "alarm");
    if (al) Object.assign(al, { en: "Door already opened from the console · alarm sent to the Security desk", zh: "門已經從控制台打開過 · 警報送到安全室" });
    return rows.sort((x, y) => (x.t < y.t ? -1 : x.t > y.t ? 1 : 0));
  }

  function startBoard() {
    loop.stop();
    B = { q: 0, wrong: QS.map(() => 0), solved: QS.map(() => false), pts: 0, strings: [], typed: "", step: 0, tried: {}, sel: new Set(), sso: ssoRows() };
    // 11/22: if the door was opened from the console last night, the opening line does not ask why it stayed shut
    const opened = !!S && doorOpened() && !!BOARD.intro_open_en;
    CB.board(st, { scene: BOARD.scene, dusk: 0.05, analyst: ANALYST, intro_en: opened ? BOARD.intro_open_en : BOARD.intro_en, intro_zh: opened ? BOARD.intro_open_zh : BOARD.intro_zh, cls: "mn-board", cork: corkHTML() });
    $("#mnKeys").addEventListener("click", (ev) => { const b = ev.target.closest("[data-k]"); if (b) key(b.dataset.k); });
    $("#mnDoorLog").addEventListener("click", (ev) => { const b = ev.target.closest(".cb-log-row"); if (b) doorRow(b.dataset.kind, b); });
    $("#mnLogsSlot").addEventListener("click", (ev) => { const b = ev.target.closest(".cb-log-row"); if (b) logRow(b.dataset.r); });   // the two logs are pinned after question 2
    boardHud();
    renderQs();
  }

  function boardHud(pop) {
    G.meter(`<div class="rx-hud"><div class="rx-hud-clock"><b>${esc(BOARD.time)}</b><span>${bi("corridor", "走廊")}</span></div>
      <div class="rx-hud-pts"><b id="hudPts">${((S ? S.points : 0) + B.pts).toLocaleString("en-US")}</b><span>${bi("points", "分")}</span></div>
      <div class="rx-hud-qs"><b>${B.solved.filter(Boolean).length}/${QS.length}</b><span>${bi("solved", "破案")}</span></div></div>`);
    if (pop) { const n = el("span", "rx-pop", "+" + pop); $("#hudPts").parentElement.appendChild(n); setTimeout(() => n.remove(), 1200); }
  }

  function posterHTML(p, i) {
    const node = p.node ? d.nodes[p.node] : null;
    const line = node ? bi(node.desc_en.split(";")[0].replace(/\.$/, ""), node.desc_zh.split("；")[0].replace(/。$/, "")) : bi(p.line_en || "", p.line_zh || "");
    return `<div class="mn-poster" id="mnPoster${i}" style="--c:${esc(p.color)};--r:${[-1.5, 1.2, -0.8, 1.6][i % 4]}deg"><i class="cb-pin" aria-hidden="true"></i>
      <p class="mn-poster-t">${bi(p.title_en, p.title_zh)}</p>${p.big ? `<p class="mn-poster-big">${esc(p.big)}</p>`
        : `<svg class="mn-poster-icon" viewBox="0 0 64 34" aria-hidden="true"><circle cx="20" cy="9" r="7" fill="#fff"/><path d="M6 33c0-9 6-14 14-14s14 5 14 14z" fill="#fff"/><circle cx="44" cy="10" r="6.5" fill="#f3c9a2"/><path d="M31 33c0-8 6-13 13-13s13 5 13 13z" fill="#f3c9a2"/><rect x="40" y="25" width="8" height="5" rx="1" fill="#6b3b7a"/></svg>`}
      <p class="mn-poster-line">${line}</p><p class="mn-poster-foot">${bi("Lakeside Resort · IT Security", "湖畔渡假村・資訊安全")}</p></div>`;
  }

  function corkHTML() {
    const L = BOARD.door_log;
    const sign = `<div class="mn-sign" id="mnSign" style="--r:-.6deg"><i class="cb-pin" aria-hidden="true"></i><p>${bi(BOARD.sign.en, BOARD.sign.zh)}</p></div>`;
    const keypad = `<div class="mn-keypad" id="mnKeypad"><i class="cb-pin" aria-hidden="true"></i><p class="mn-kp-t">${bi("Door keypad · test it", "門禁鍵盤・試按")}</p>
      <div class="mn-kp-lcd" id="mnLcd"><span>ENTER CODE<small lang="zh-Hant">請輸入密碼</small></span><b id="mnDigits">_ _ _ _</b></div>
      <div class="mn-kp-keys" id="mnKeys">${["1", "2", "3", "4", "5", "6", "7", "8", "9", "C", "0", "OK"].map((k) => `<button type="button" data-k="${k}" class="${k === "OK" ? "is-ok" : k === "C" ? "is-c" : ""}" aria-label="${k === "C" ? "Clear" : k === "OK" ? "Enter" : k}">${k}</button>`).join("")}</div></div>`;
    const doorLog = `<div class="cb-doc cb-log mn-doorlog is-pinned" id="mnDoorLogDoc"><i class="cb-pin" aria-hidden="true"></i><p class="cb-doc-title">${bi(L.title_en, L.title_zh)}</p>
      <ol class="cb-log-rows" id="mnDoorLog">${doorRows().map((r) => `<li><button type="button" class="cb-log-row mn-row" data-kind="${esc(r.kind)}"><time>${esc(r.t)}</time><span class="cb-log-what">${bi(r.en, r.zh)}</span></button></li>`).join("")}</ol></div>`;
    return `<div class="mn-cork-main">
        <div class="mn-posters">${sign}${BOARD.posters.map(posterHTML).join("")}</div>
        <div class="mn-door-row">${keypad}${doorLog}</div>
        <div id="mnLogsSlot"></div></div>
      <div class="cb-side">
        <div class="cb-crew is-known" id="cbCrew"><i class="cb-pin" aria-hidden="true"></i>
          <svg class="cb-crew-face" viewBox="0 0 60 60" aria-hidden="true"><rect width="60" height="60" rx="4" fill="#2b2421"/><circle cx="30" cy="24" r="11" fill="#5b4f49"/><path d="M10 60c2-14 10-21 20-21s18 7 20 21z" fill="#5b4f49"/>
            <text x="30" y="29" text-anchor="middle" font-size="15" font-weight="700" fill="#d8bd77" font-family="Bahnschrift, Segoe UI, sans-serif">?</text></svg>
          <p class="cb-crew-name">${bi("The crew", "同一夥人")}</p>
          <ul class="cb-crew-facts" id="cbCrewFacts"><li>203.0.113.45</li><li>${bi("Copied the night-shift list at 18:49", "18:49 抄走夜班名單")}</li></ul></div>
        <div class="mn-keeper" style="--r:1.4deg"><i class="cb-pin" aria-hidden="true"></i><p class="mn-keeper-t">${bi("Keeper's Log · the lighthouse", "守燈人日誌・燈塔")}</p>
          <p class="mn-keeper-l"><b>${esc(BOARD.keeper.t)}</b> ${bi(BOARD.keeper.en, BOARD.keeper.zh)} <i>— ${bi(BOARD.keeper.note_en, BOARD.keeper.note_zh)}</i></p></div>
        <div class="cb-doc mn-nightlog" style="transform:rotate(-.6deg)"><i class="cb-pin" aria-hidden="true"></i><p class="cb-doc-title">${bi("Your night log", "你的值班紀錄")}</p>
          <ol class="mn-nl">${S && S.log.filter((x) => x.t).length ? S.log.filter((x) => x.t).map((x) => `<li class="${esc(x.cls || "")}"><time>${esc(x.t)}</time>${x.html}</li>`).join("") : `<li>${bi("Nothing written down last night.", "昨晚什麼都沒記。")}</li>`}</ol></div>
      </div>`;
  }

  function logsHTML() {
    const row = (r, src) => `<li><button type="button" class="cb-log-row mn-row${r.mine ? " is-mine" : ""}" data-r="${src}:${r.k}" aria-pressed="false"><time>${esc(r.t)}</time>
      <span class="mn-row-who">${esc(r.user || r.by)}</span><span class="cb-log-what">${bi(r.en, r.zh)}</span></button></li>`;
    const iam = BOARD.iam.rows.map((r, k) => Object.assign({ k }, r));
    B.iam = iam;
    return `<div class="mn-logs"><div class="cb-doc cb-log is-pinned" id="mnSsoDoc"><i class="cb-pin" aria-hidden="true"></i><p class="cb-doc-title">${bi(BOARD.sso.title_en, BOARD.sso.title_zh)}</p>
        <ol class="cb-log-rows" id="mnSso">${B.sso.map((r) => row(r, "sso")).join("")}</ol></div>
      <div class="cb-doc cb-log is-pinned" id="mnIamDoc"><i class="cb-pin" aria-hidden="true"></i><p class="cb-doc-title">${bi(BOARD.iam.title_en, BOARD.iam.title_zh)}</p>
        <ol class="cb-log-rows" id="mnIam">${iam.map((r) => row(r, "iam")).join("")}</ol></div></div>`;
  }

  function renderQs() {
    const qs = QV(), q0 = qs[B.q];
    if (q0 && q0.pick === "string" && !B.solved[B.q]) B.step = 1;      // no options: the red string goes straight to the evidence
    CB.questions(qs, B, controls);
    const q = qs[B.q];
    $("#cbCork").classList.toggle("is-picking", !!q && !B.solved[B.q] && (q.kind === "logs" || (q.kind === "choose" && B.step === 1)));
    for (const b of $$("#cbQs .cb-opt")) b.addEventListener("click", () => choose(q, b.dataset.k));
    const go = $("#cbGo");
    if (go) go.addEventListener("click", () => checkLogs(q));
    if (q && q.pick === "string" && !B.solved[B.q]) CB.stringFrom($("#cbSpool"), "#mnDoorLog .cb-log-row", (row) => doorRow(row.dataset.kind, row));
  }

  function controls(q) {
    if (q.kind === "code") return `<p class="cb-q-sel">${bi("Use the keypad on the board.", "用板子上的鍵盤輸入。")}</p>`;
    if (q.kind === "choose") {
      if (q.pick === "string") return CB.spoolHTML("Drag the red string to the evidence", "把紅線拖到證據上");
      if (B.step === 1) { const o = q.options.find((x) => x.k === q.answer); return `<p class="cb-q-chosen">${bi(o.en, o.zh)}</p><p class="cb-q-how is-next">${bi(q.evidence_en, q.evidence_zh)}</p>`; }
      return `<div class="cb-opts">${q.options.map((o) => `<button type="button" class="cb-opt${B.tried[o.k] ? " is-tried" : ""}" data-k="${esc(o.k)}"${B.tried[o.k] ? " disabled" : ""}>${bi(o.en, o.zh)}</button>`).join("")}</div>`;
    }
    if (q.kind === "logs") return `<p class="cb-q-sel">${B.sel.size ? bi(`${B.sel.size} line${B.sel.size > 1 ? "s" : ""} marked`, `標了 ${B.sel.size} 行`) : bi("No lines marked yet.", "還沒標任何一行。")}</p>
      <button type="button" class="btn cb-go" id="cbGo"${B.sel.size ? "" : " disabled"}>${bi("This is how they got in", "他們就是這樣進來的")}</button>`;
    return "";
  }

  /* Q1: the keypad */
  function lcd(en, zh, cls) { $("#mnLcd span").innerHTML = `${esc(en)}<small lang="zh-Hant">${esc(zh)}</small>`; $("#mnLcd").className = "mn-kp-lcd " + (cls || ""); }
  function digits() { $("#mnDigits").textContent = [0, 1, 2, 3].map((i) => (B.typed[i] ? B.typed[i] : "_")).join(" "); }

  async function key(k) {
    const q = QV()[B.q];
    if (!q || B.solved[B.q] || q.kind !== "code") { lcd("CASE SOLVED", "已破案"); return; }
    if (k === "C") { B.typed = ""; digits(); lcd("ENTER CODE", "請輸入密碼"); return; }
    if (k !== "OK") { if (B.typed.length < 4) { B.typed += k; digits(); } return; }
    if (B.typed.length < 4) return;
    if (B.typed === d.code) { lcd("CODE OK · TAP BADGE", "密碼正確・請感應員工證", "is-ok"); return solve(q); }
    CB.nope(B);
    lcd("WRONG CODE", "密碼錯誤", "is-bad");
    CB.cbSay(B.wrong[B.q] >= 2 ? bi(q.hint2_en, q.hint2_zh) : bi(q.hint1_en, q.hint1_zh), "is-no");
    await wait(900);
    B.typed = ""; digits(); lcd("ENTER CODE", "請輸入密碼");
  }

  /* Q2: choose, then point at the door log */
  function choose(q, k) {
    if (k === q.answer) { B.step = 1; CB.cbSay(bi(q.evidence_en, q.evidence_zh), "is-good"); return renderQs(); }
    const o = q.options.find((x) => x.k === k);
    B.tried[k] = true;
    CB.nope(B);
    CB.cbSay(bi(o.why_en || "", o.why_zh || ""), "is-no");
    renderQs();
  }

  function doorRow(kind, btn) {
    const q = QV()[B.q];
    if (!q || B.solved[B.q] || q.kind !== "choose" || B.step !== 1) return;
    if (kind === q.evidence) { btn.classList.add("is-ok"); return solve(q, btn); }
    CB.nope(B);
    const o = q.row_hint && q.options.find((x) => x.k === q.row_hint[kind]);
    CB.cbSay(o ? bi(o.why_en, o.why_zh) : bi(q.wrong_evidence_en, q.wrong_evidence_zh), "is-no");
  }

  /* Q3: one line in each log */
  function logRow(id) {
    const q = QV()[B.q];
    if (!q || B.solved[B.q] || q.kind !== "logs") return;
    if (B.sel.has(id)) B.sel.delete(id); else B.sel.add(id);
    const b = $(`.cb-log-row[data-r="${id}"]`);
    b.classList.toggle("is-marked", B.sel.has(id)); b.setAttribute("aria-pressed", String(B.sel.has(id)));
    renderQs();
  }

  const answerRows = () => [...B.sso.filter((r) => r.kind === "approved").map((r) => `sso:${r.k}`), ...B.iam.filter((r) => r.kind === "crew").map((r) => `iam:${r.k}`)];

  function checkLogs(q) {
    const ans = new Set(answerRows()), sel = [...B.sel];
    const bad = sel.filter((x) => !ans.has(x)), miss = [...ans].filter((x) => !B.sel.has(x));
    if (!bad.length && !miss.length) return solve(q);
    CB.nope(B);
    const rowOf = (id) => { const [src, k] = id.split(":"); return (src === "sso" ? B.sso : B.iam)[+k]; };
    let m;
    if (bad.length) {
      const r = rowOf(bad[0]);
      m = r.kind === "denied" ? [q.denied_en, q.denied_zh] : r.kind === "wrong" ? [q.wrong_en, q.wrong_zh] : [q.cleanup_en, q.cleanup_zh];
    } else m = miss.some((x) => x.startsWith("iam")) ? [q.missing_en, q.missing_zh] : [q.denied_en, q.denied_zh];
    CB.cbSay(bi(m[0], m[1]), "is-no");
  }

  function solve(q) {
    const i = B.q;
    B.solved[i] = true;
    const pts = CB.qPoints(B, i);
    B.pts += pts;
    $("#cbCork").classList.add(`is-q${i + 1}`);      // what is solved folds up a little, so the logs pinned next still fit the board
    if (q.kind === "code") {
      $("#mnPoster0").classList.add("is-hit"); $("#mnPoster1").classList.add("is-hit");
      B.strings.push(["#mnPoster0 .cb-pin", "#mnKeypad .cb-pin", true], ["#mnPoster1 .cb-pin", "#mnKeypad .cb-pin", true], ["#mnSign .cb-pin", "#mnKeypad .cb-pin", true]);
      fact(bi(`Read the code ${d.code} off the posters`, `從海報讀出密碼 ${d.code}`));
    } else if (q.kind === "choose") {
      B.strings.push(["#mnDoorLogDoc .cb-pin", "#cbCrew .cb-pin", true]);
      fact(S && doorOpened() ? bi("A blocked badge, but the console let them in", "卡停用了，他們卻從控制台被放了進來") : bi("Stopped by a blocked badge", "被停用的員工證擋下"));
      $("#mnLogsSlot").innerHTML = logsHTML();
    } else if (q.kind === "logs") {
      for (const id of answerRows()) $(`.cb-log-row[data-r="${id}"]`).classList.add("is-ok");
      B.strings.push(["#mnSsoDoc .cb-pin", "#cbCrew .cb-pin", true], ["#mnIamDoc .cb-pin", "#cbCrew .cb-pin", true]);
      fact(bi("In through Yi-Chen's VPN at 03:21", "03:21 從易真的 VPN 進來"));
    }
    boardHud(pts);
    CB.solvedFx();
    CB.cbSay(bi(q.solved_en, q.solved_zh), "is-good");
    B.q = i + 1; B.step = 0;
    renderQs();
    requestAnimationFrame(() => CB.drawStrings(B.strings));
    if (B.solved.every(Boolean)) CB.addClose(wrapUp);
    CB.refocus("#cbQ #cbSpool, #cbQ .cb-opt:not([disabled]), #cbQs .cb-close");      // 11/22: solved with a button the redraw took away
  }

  function fact(html) { $("#cbCrewFacts").insertAdjacentHTML("beforeend", `<li class="is-new">${html}</li>`); }

  /* ------------------------------------------------------------------ case closed, then the results */
  function wrapUp() {
    CB.cbSay(bi("That's the door and the phones. One approval is all they needed, though. Something is already running on the night audit PC.", "門和手機這邊結案了。不過他們只要一次同意就夠了，夜間稽核的電腦上已經有東西在跑。"), "is-good");
    const fix = PROC.steps.find((s) => s.phase === "learn"), prm = d.nodes.phish_resistant_mfa, auth = d.nodes.c_authentication;
    const badge = BADGE.steps.find((s) => s.phase === "analyze");
    CB.closed(st, { wrap_en: youSaidYes() && BOARD.wrap_you_en ? BOARD.wrap_you_en : BOARD.wrap_en, wrap_zh: youSaidYes() && BOARD.wrap_you_zh ? BOARD.wrap_you_zh : BOARD.wrap_zh, cases: d.cases, why: BOARD.case_why,
      body: `<div class="mn-closed">
          <div><h3>${bi(auth.name_en, auth.name_zh)}</h3><p>${bi(auth.desc_en, auth.desc_zh)}</p></div>
          <div><h3>${bi("What changes now", "接下來要改的")}</h3><p>${bi(fix.text_en, fix.text_zh)}</p><p class="mn-closed-d">${bi(prm.desc_en, prm.desc_zh)}</p>
            <p class="mn-closed-d">${bi(`The door code stops coming off the posters. ${badge.text_en}`, `門禁密碼不再用海報上的數字。${badge.text_zh}`)}</p></div></div>
        <p class="cb-proc">${bi(`From “${PROC.name_en}” and “${BADGE.name_en}” in the knowledge graph`, `出自知識圖的流程「${PROC.name_zh}」和「${BADGE.name_zh}」`)}</p>`,
      onResults: finale });
  }

  function finale() {
    const r = right(), firstTry = B.wrong.filter((w, i) => B.solved[i] && w === 0).length;
    const score = shiftScore() + firstTry;
    const denied = PUSHES.filter((e) => S.res[e.id] === "denied").length;
    const clean = !S.approved && !doorOpened();
    CB.finale(st, { file: 3, ranks: clean ? story.ranks : story.ranks.filter((x) => x.key !== "gold"), score, total: TOTAL, scene: BOARD.scene, dusk: 0.3,
      stats: [{ v: (S.points + B.pts).toLocaleString("en-US"), en: "points", zh: "分" }, { v: `${denied}`, en: "prompts denied", zh: "拒絕的通知" },
        { v: `${r.doors}/${DOORS.length}`, en: "door alerts", zh: "門禁通知" }, { v: r.call ? "✓" : "✗", en: "the fake SOC call", zh: "假冒的電話" },
        { v: `${S.shields}/${sh.shields}`, en: "shields left", zh: "剩下的盾牌" }, { v: `${firstTry}/${QS.length}`, en: "solved first try", zh: "一次就解開" }],
      body: S.losses.length ? `<ul class="rx-loss-list">${S.losses.map((x) => `<li>${bi(x.dm.hit_en, x.dm.hit_zh)}</li>`).join("")}</ul>` : "",
      next: { key: BOARD.next, en: BOARD.next_en, zh: BOARD.next_zh }, again: () => Games.mfa(d, main, true) });
    B = null;
  }

  if (replay) startShift();
  else CB.title(st, { file: 3, scene: "mn_room", title_en: "The MFA Door", title_zh: "多因素驗證門", time: story.start,
    place_en: (story.title || {}).place_en, place_zh: (story.title || {}).place_zh, hook_en: (story.title || {}).hook_en, hook_zh: (story.title || {}).hook_zh, onGo: brief });
};
