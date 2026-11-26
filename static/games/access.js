/* Who May Use What? 誰能用什麼, second version (11/21 evening): case file 2 of the Awards Night casebook. Two parts.
   The shift, 21:30 to 22:45 at the IT Help Desk: access requests arrive on their own clock (at the desk, by phone, as
   tickets, by email). Stamp each form with what the job needs: no access, masked, read or edit. Three call-backs on the
   numbers HR has, one hint from Mei-Ling, three shields; two of the requests are the crew using stolen names.
   The case board, 23:00 at the access chart on the Help Desk wall: the data access log of the two accounts the crew
   phished at dinner, tonight's access table as configured, and the policy. Which lines were the crew, which cells let
   them in, and what the same night looks like once the table is fixed.
   The answers are the knowledge graph's CAN_ACCESS relationships (no relationship = no access); impostors get nothing.
   games.yaml → access.story holds the plot, what people say and the clue data. Shared helpers: casebook.js.
   11/27 (the user: 「不知道在玩甚麼…錯了也不能問小幫手」): the Help panel knows each screen (G.help.setNow), a wrong stamp
   says why on the spot and waits for "Next person", the first form of the page is guided step by step (CB.coach), and the
   first caller you can't see gets a note on how to call back. */
"use strict";

Games.access = function (d, main, replay) {
  const story = d.story, people = story.people, lines = story.lines || {};
  const BOARD = story.board, QS = BOARD.questions || [];
  const sh = Object.assign({ rate: 0.4, idle: 3, fuse: [], calls: 3, hints: 1, shields: 3 }, story.shift || {});
  const N = d.names;
  const ORDER = ["none", "masked", "read", "write"];
  const rank = (lv) => ORDER.indexOf(lv);
  const P = { right: 100, speed: 2, streak: 20, much: 40, caught: 50 };
  const TOTAL = d.requests.length + QS.length;
  const T0 = CB.mins(story.start || "21:30"), TEND = CB.mins(story.end || "22:45") - T0;
  const clockAt = (m) => CB.hhmm(T0 + m);
  const waves = (story.waves || []).map((w) => Object.assign({}, w, { at: CB.mins(w.at) - T0 }));
  const byId = {};
  d.requests.forEach((r, i) => { r.i = i; r.at = CB.mins(r.time) - T0; byId[r.id] = r; });
  const st = CB.stage(main);
  const MENTOR = { svg: CB.mentor(), name: story.mentor.name, name_zh: story.mentor.name_zh, role_en: story.mentor.role_en, role_zh: story.mentor.role_zh };
  let S = null, B = null, H = null, said = 0;
  const line = (list) => { const l = list && list.length ? list[said++ % list.length] : null; return l ? bi(l.en, l.zh) : ""; };
  const loop = CB.loop(tick);
  window.onresize = () => { if (B) CB.drawStrings(B.strings); };

  /* ------------------------------------------------------------------ names */
  const nm = (k) => N[k] || { name_en: k, name_zh: "" };
  const who = (r) => people[r.who];
  const VIA = {
    walk: { en: "At the desk", zh: "臨櫃", icon: CB.ICON.walk },
    phone: { en: "Phone call", zh: "電話", icon: CB.ICON.phone },
    ticket: { en: "Ticket", zh: "工單", icon: CB.ICON.ticket },
    email: { en: "Email", zh: "電子郵件", icon: CB.ICON.mail },
  };
  const CLS = { Restricted: ["Restricted", "限閱"], Confidential: ["Confidential", "機密"], Internal: ["Internal", "內部"], Public: ["Public", "公開"] };
  const clsChip = (k) => { const c = nm(k).classification; return c ? `<span class="ag-cls ag-cls-${esc(c)}">${bi(...(CLS[c] || [c, ""]))}</span>` : ""; };
  const STAMP = { none: ["NO ACCESS", "不給"], masked: ["MASKED", "只給遮罩"], read: ["READ", "唯讀"], write: ["EDIT", "可改"] };
  // 11/27: what each stamp means, in the words of the rules (the stamps' tooltips and the Help panel)
  const MEAN = { none: ["Gives nothing", "什麼都不給"], masked: ["Sees the record with the sensitive parts hidden", "看得到資料，但敏感的部分被遮住"],
    read: ["Can look, can't change", "能看不能改"], write: ["Can change", "可以改"] };
  // 11/27 review: English sentence, then the Chinese one ("NO ACCESS: Gives nothing. 不給：什麼都不給。")
  const stampTip = (lv) => `${STAMP[lv][0]}: ${MEAN[lv][0]}. ${STAMP[lv][1]}：${MEAN[lv][1]}。`;
  const LEGEND = { en: "NO ACCESS gives nothing. MASKED shows the record with the sensitive parts hidden. READ can look but not change. EDIT can change.",
    zh: "「不給」什麼都不給；「只給遮罩」看得到資料，但敏感的部分被遮住；「唯讀」能看不能改；「可改」可以改。" };
  const an = (s) => `${/^[aeiou]/i.test(s) ? "an" : "a"} ${s}`;
  // 11/27: the Help panel (common.js); every call goes through these, so a page without it still plays
  const setNow = (fn) => { if (G.help) G.help.setNow(fn); };
  const noteMistake = (m) => { if (G.help) G.help.mistake(m); };
  // the just-in-time notes show once on this page, also after "Play again"
  const SEEN = Games.access.seen || (Games.access.seen = {});
  let guideLeft = !replay;   // the first-time guide: the first form of the first shift on this page
  // who the requester looks like: a walk-up shows their face, the rest show how the request came in
  function avatar(r, cls) {
    if (r.via === "walk") return CB.face(who(r).look, cls);
    return `<span class="ah-av ah-av-${r.via} ${cls || ""}" aria-hidden="true">${VIA[r.via].icon}</span>`;
  }
  const claimed = (r) => who(r).name;
  // 11/22: an extension in both languages (ext. 3100 分機 3100); other numbers and addresses as they are
  const numHTML = (s) => { const m = /^ext\.\s*(\d+)$/.exec(String(s || "")); return m ? bi(`ext. ${m[1]}`, `分機 ${m[1]}`) : esc(s); };
  // 11/22 review: inside a Chinese sentence an extension reads 分機 2105 (as phish.js extZh)
  const extZh = (n) => String(n || "").replace(/^ext\.\s*/, "分機 ");

  /* ------------------------------------------------------------------ the briefing */
  function brief() {
    loop.stop();
    st.scene("ah_desk", 0.12);
    G.meter("");
    CB.brief(st, { file: 2, start: story.start, until_en: `Help Desk until ${story.end}`, until_zh: `服務台值班到 ${story.end}`, person: MENTOR,
      intro_en: story.intro_en, intro_zh: story.intro_zh, rules: story.rules, after_en: story.after_en, after_zh: story.after_zh,
      extra: `<div class="ah-brief-stamps" aria-hidden="true">${ORDER.map((lv) => `<span class="ah-ink is-${lv}" title="${esc(stampTip(lv))}">${STAMP[lv][0]}<small>${STAMP[lv][1]}</small></span>`).join("")}</div>`,
      button: bi("Open the Help Desk", "開始值班"), onStart: startShift });
    setNow(() => ({ title_en: "The briefing", title_zh: "任務說明", ctx: { screen: "brief" }, steps: [
      { en: "Read your goal at the top, then the four rules under How to play.", zh: "先看最上面的任務，再看「怎麼玩」的四條規則。" },
      LEGEND,
      guideLeft ? { en: "Press Open the Help Desk. On the first form the clock waits while you learn how to stamp.", zh: "按「開始值班」。第一張單子會等你學會蓋章，時間才開始走。" }
        : { en: "Press Open the Help Desk to start the shift.", zh: "按「開始值班」開始。" }] }));
  }

  /* ------------------------------------------------------------------ the shift */
  function startShift() {
    loop.stop();
    coachOff();
    // 11/27: guide = a guide note is up and holds the clock; next = {id} of a wrong form that waits for "Next person"
    S = { clock: 0, over: false, paused: false, hold: 0, waves: 0, rushAt: 0, arrived: [], fuse: {}, answers: {}, how: {}, gain: {}, verified: {}, inkPos: {}, dial: "", heard: {},
      calls: sh.calls, hints: sh.hints, shields: sh.shields, points: 0, streak: 0, best: 0, losses: [], notes: [], open: null, hinted: {}, calling: false, guide: false, next: null };
    if (G.help) G.help.clear();   // 11/27: a new shift starts without the last one's mistakes
    setNow(shiftNow);
    B = null;
    st.scene("ah_desk", 0.12);
    H = CB.hud({ pause: true, clock: story.start, clockLabel: bi(`until ${story.end}`, "值班到 " + story.end), shields: sh.shields });
    G.onPause = () => togglePause();
    window.scrollTo({ top: 0 });
    st.body.innerHTML = `<div class="ah-play">
      <div class="rs-side ah-left">${CB.personHTML(MENTOR, bi("Requests will start coming in. Listen to why they need it, then pick up a stamp.", "申請快來了，先聽他們為什麼需要，再拿起印章。"), { id: "ahSay" })}
        <section class="ah-queue" aria-label="Waiting"><h3>${bi("Waiting", "排隊中")} <b id="ahWaitN">0</b></h3><ol id="ahQueue"></ol>
          <h3 class="ah-done-h">${bi("Done", "處理好的")}</h3><ol id="ahDone"></ol></section></div>
      <div class="ah-center"><div class="ah-counter" id="ahCounter" aria-live="polite"></div>
      <div class="ah-desk" id="ahDesk"><div class="ah-paper-wrap" id="ahPaper"></div>
        <div class="ah-stamps" id="ahStamps" role="group" aria-label="Stamp the form">${ORDER.map((lv) => `<button type="button" class="ah-stamp is-${lv}" data-lv="${lv}" title="${esc(stampTip(lv))}" disabled>
          <span class="ah-stamp-knob" aria-hidden="true"></span><span class="ah-stamp-face">${STAMP[lv][0]}<small>${STAMP[lv][1]}</small></span></button>`).join("")}</div></div></div>
      <div class="rs-side ah-right">
        <section class="ah-phone" id="ahPhone"></section>
        <button type="button" class="ah-wall-btn" id="ahWallBtn"><span class="ah-wall-mini" aria-hidden="true">${wallMini()}</span>
          <span>${bi("Walk up to the wall chart", "走到牆上的權限表前")}</span></button>
        <button type="button" class="rs-hint-btn" id="ahHint"></button></div></div>`;
    S.pause = CB.pauseLayer(st, () => togglePause(false));
    // 11/27 review: the reasons box under a wrong stamp is sized again when any column changes (fitReasons): the form's,
    // the phone's (directory, a call's answer) or the queue's. A frame later, so its own change doesn't loop the observer.
    if (centerRO) centerRO.disconnect();
    centerRO = typeof ResizeObserver === "function" ? new ResizeObserver(() => requestAnimationFrame(fitReasons)) : null;
    if (centerRO) for (const c of $$(".ah-left, .ah-center, .ah-right", st.body)) centerRO.observe(c);
    stampHands();
    $("#ahWallBtn").addEventListener("click", wallZoom);
    $("#ahHint").addEventListener("click", useHint);
    $("#ahQueue").addEventListener("click", (ev) => { const b = ev.target.closest("[data-id]"); if (b) openReq(b.dataset.id); });
    $("#ahDone").addEventListener("click", (ev) => { const b = ev.target.closest("[data-id]"); if (b) openReq(b.dataset.id); });
    emptyPaper();
    phone();
    hintBtn();
    H.points(0, 0);
    loop.start();
  }

  const pending = () => S.arrived.map((id) => byId[id]).filter((r) => !S.answers[r.id]);

  function tick(dt) {
    // 11/27: S.guide (a guide note is up) and S.next (a wrong form waits for "Next person") hold the clock and everyone's patience
    if (!S || S.over || S.paused || S.hold || S.guide || S.next || document.hidden) return;
    const wait = pending();
    S.clock = Math.min(TEND, S.clock + dt * (wait.length || S.calling ? sh.rate : sh.idle));
    for (const r of d.requests) if (!S.fuse[r.id] && S.clock >= r.at) arrive(r);
    while (S.waves < waves.length && S.clock >= waves[S.waves].at) st.banner(waves[S.waves++]);
    for (const r of pending()) {
      if (S.guide) break;                        // 11/27 review: a guide note opened on an arrival just now: everyone waits from here
      if (S.calling === r.id) continue;          // nobody walks away while you are on the phone about them
      const f = S.fuse[r.id];
      f.left -= dt;
      if (f.left <= 0) { decide(r, r.ask, "timeout"); if (S.over || S.hold || S.next) break; }
    }
    const hot = pending().filter((r) => S.fuse[r.id].left <= 12);
    if (hot.length >= 2 && performance.now() - S.rushAt > 15000) { S.rushAt = performance.now(); say(line(lines.rush)); }
    drawFuses();
    H.clock(clockAt(S.clock));
    st.dusk(0.12 + 0.4 * (S.clock / TEND));
    if (!S.over && !S.hold && !S.next && d.requests.every((r) => S.answers[r.id])) {   // a moment to read the last result first
      if (!S.endAt) S.endAt = performance.now() + 2600;
      else if (performance.now() >= S.endAt) endShift();
    }
  }

  function togglePause(force) {
    if (!S || S.over) return;
    S.paused = typeof force === "boolean" ? force : !S.paused;
    // 11/26 (front-end review K40): the desk behind the pause layer is inert, so Tab can't reach the stamps, keypad or hint;
    // a stamp still in your hand goes back on the rack. The pause layer is a sibling of .ah-play, so Resume stays reachable.
    if (S.paused) putBack(false);
    S.pause.set(S.paused);
    // 11/26 (front-end review check K40): after pauseLayer.set, so the layer still sees the focused control (Resume gives it back)
    const play = $(".ah-play"); if (play) play.inert = S.paused;
    H.paused(S.paused);
  }

  // 11/26 (front-end review K41): a redraw, a removed row or a disabled button took the keyboard: carry on at sel.
  // Nothing moves while the focus is still on a live control.
  const focusLost = () => { const a = document.activeElement; return !a || a === document.body || !a.isConnected || !!a.disabled; };
  const refocus = (sel) => { if (!focusLost()) return; const n = $(sel); if (n) n.focus({ preventScroll: true }); };

  const say = (html, mood) => CB.say($("#ahSay"), html, mood);

  /* ------------------------------------------------------------------ the guide (11/27)
     The first form of the page is shown step by step (what she needs it for, then drag the stamp), and the first request
     from someone you can't see gets a note on calling back. While a note is up the clock waits (S.guide); the stamp on the
     open form, opening another form nobody has stamped yet, the note's own button or (for the call-back note) using the
     phone lets it go; looking back at a done form does not. Notes hide while the wall chart is open, and while paused. */
  let coachUp = null, coachKind = null, coachFor = null;   // the note, which kind, and the form it is about
  let centerRO = null;                                     // watches the three columns of the desk (fitReasons)
  const live = (sel) => () => (S && !S.over && !S.wall ? $(sel) : null);
  function coachOn(kind, id, o) {
    coachOff();
    if (!S || S.over) return;
    S.guide = true;
    const c = CB.coach(st, Object.assign({}, o, { onOk: () => {
      if (coachUp === c) { coachUp = null; coachKind = null; coachFor = null; if (S) S.guide = false; }
      if (o.onOk) o.onOk();
    } }));
    coachUp = c; coachKind = kind; coachFor = id;
    const layer = $$(".cb-coach", st.$rs).pop();
    // a note to read, not a move to make: no touch point over the words
    if (layer && o.read) { const t = $(".cb-coach-touch", layer); if (t) t.hidden = true; }
    const ok = layer && $(".cb-coach-ok", layer);
    if (ok && focusLost()) ok.focus({ preventScroll: true });
  }
  function coachOff() {
    const c = coachUp;
    coachUp = null; coachKind = null; coachFor = null;
    if (c) c.close();
    if (S) S.guide = false;
  }

  // After "Got it" CB.coach hands the keyboard to focusAfter (11/27 review): the stamps, or the HR directory.
  function guideFirst(r) {
    const step2 = () => {
      if (!S || S.over || S.answers[r.id] || S.open !== r.id) return;
      // 11/27 review: says nothing about one stamp, so it does not give the first form's answer away
      coachOn("first", r.id, { target: live("#ahStamps"), to: live(`.ah-form[data-id="${r.id}"]`), gesture: "drag-to", step_en: "Step 2 of 2", step_zh: "第 2 步，共 2 步",
        en: "Drag the stamp the job needs onto the form (or click a stamp, then the form). What each stamp means is in its tooltip and in Help.",
        zh: "把這份工作需要的章拖到單子上，也可以先點章、再點單子。每個章是什麼意思，滑鼠移到章上會顯示，「求助」裡也有寫。" });
    };
    coachOn("first", r.id, { target: live("#ahCounter .ah-bubble-t"), gesture: "click", read: true, step_en: "Step 1 of 2", step_zh: "第 1 步，共 2 步",
      en: "Read what she needs it for.", zh: "先看她要拿來做什麼。", button: { en: "Got it", zh: "知道了" }, onOk: step2,
      focusAfter: live("#ahStamps .ah-stamp:not(:disabled)") });
  }

  function noteCallback(r) {
    SEEN.callback = true;
    coachOn("callback", r.id, { target: live("#ahPhone .ah-dir"), gesture: "click",
      step_en: r.via === "email" ? "A request by email" : "A request by phone", step_zh: r.via === "email" ? "寄信來的申請" : "打電話來的申請",
      en: "You can't see who this is. Find the person in the HR directory and dial that number yourself, never the number or address they used. Someone who is not who they say gets NO ACCESS.",
      zh: "看不到對方本人。去人資電話簿找這個人，自己撥上面的號碼，不要用對方給的號碼或地址。冒名的人一律蓋「不給」。",
      button: { en: "Got it", zh: "知道了" }, focusAfter: live("#ahPhone .ah-dir summary") });
  }

  /* What the Help panel says on the shift (11/27), read live each time it opens: the form on the desk, the stamps, how to
     stamp and check, what is left, and what costs a shield. The IT Assistant is told which form and, once stamped, what. */
  function shiftNow() {
    if (!S) return null;
    const r = S.open && byId[S.open], steps = [], ctx = { screen: "shift" };
    if (r) {
      const p = who(r), role = nm(p.role), data = nm(r.data), lv = S.answers[r.id];
      ctx.item = r.id;
      if (lv) {
        const timed = S.how[r.id] === "timeout";
        ctx.chosen = timed ? "timeout" : lv;
        steps.push(isRight(r) ? { en: `${p.name}'s form is done: ${STAMP[lv][0]} was right.`, zh: `${p.name_zh}的單子好了，「${STAMP[lv][1]}」是對的。` }
          : { en: `${p.name}'s form is done, but ${timed ? "it waited too long and was approved as asked" : `${STAMP[lv][0]} was wrong`}. Why is under the form.`,
              zh: `${p.name_zh}的單子好了，但${timed ? "等太久，被照申請批了" : `「${STAMP[lv][1]}」蓋錯了`}。原因寫在單子下面。` });
        if (S.next) steps.push({ en: "Press Next person when you have read it. The clock waits until then.", zh: "看完按「下一位」，在那之前時間會停住。" });
      } else {
        steps.push({ en: `${p.name}, ${role.name_en}, asks for ${STAMP[r.ask][0]} on ${data.name_en}.`, zh: `${p.name_zh}（${role.name_zh}）申請「${data.name_zh}」，要「${STAMP[r.ask][1]}」。` });
        steps.push({ en: `What it's for, in their words: “${r.why_en}”`, zh: `對方說要拿來做什麼：「${r.why_zh}」` });
        if (role.desc_en) steps.push({ en: `What ${an(role.name_en)} does: ${role.desc_en}`, zh: `${role.name_zh}的工作：${role.desc_zh || ""}` });
        steps.push({ en: "Stamp the least that still lets them do that. It can be less than the form asks for.", zh: "蓋能讓對方做到這件事的最少權限，可以比單子上要的少。" });
      }
    } else steps.push({ en: "Nobody is at the desk right now. The next person comes soon.", zh: "現在櫃台沒人，下一位很快就來。" });
    steps.push(LEGEND);
    steps.push({ en: "To stamp, drag a stamp onto the form, or click a stamp and then the form.", zh: "蓋章：把章拖到單子上，或先點章，再點單子。" });
    steps.push({ en: "Walk up to the wall chart for part of the policy. The clock keeps running while you look.", zh: "牆上的權限表有一部分規定，可以走過去看，看的時候時間照走。" });
    steps.push({ en: `Can't see them (a call or an email)? Find them in the HR directory and dial that number yourself, never the one they used. Someone who is not who they say gets NO ACCESS. Calls left: ${S.calls}.`,
                 zh: `看不到本人（打電話或寄信來的）？去人資電話簿找這個人，自己撥上面的號碼，不要用對方給的。冒名的人一律「不給」。還能打 ${S.calls} 通。` });
    steps.push(S.hints > 0 ? { en: `Ask Mei-Ling for a tip on the open form. Left: ${S.hints}.`, zh: `按「問美玲」，她會給你這張單子的提示。還能問 ${S.hints} 次。` }
      : { en: "Mei-Ling's tip is used up.", zh: "問美玲的次數用完了。" });
    steps.push({ en: "The ring around each waiting person, and the bar under the form, is their patience. When it runs out, someone else approves exactly what they asked for.",
                 zh: "排隊頭像外面那圈和單子下面的長條是耐心，用完了就會有別人照申請批。" });
    steps.push({ en: "A shield goes when someone who is not who they say gets anything, or when Restricted data gets READ or EDIT beyond the policy. Too much on other data costs points, too little earns nothing.",
                 zh: "冒名的人拿到任何權限，或限閱資料給到唯讀、可改又超過規定，就少一面盾牌。其他資料給太多會扣分，給太少就拿不到分。" });
    return { title_en: "At the Help Desk", title_zh: "在服務台", steps, ctx,
      chips: [{ en: "What does this job need?", zh: "這份工作需要什麼？" }, { en: "How do I check who is asking?", zh: "要怎麼確認是不是本人？" }] };
  }

  function arrive(r) {
    const total = sh.fuse[r.i] || 50;
    S.fuse[r.id] = { left: total, total };
    S.arrived.push(r.id);
    const li = el("li");
    li.innerHTML = `<button type="button" class="ah-q-item is-new" data-id="${r.id}"><span class="ah-q-ring" style="--p:100">${avatar(r, "ah-q-av")}</span>
      <span class="ah-q-name">${esc(claimed(r))}<small>${bi(nm(who(r).role).name_en, nm(who(r).role).name_zh)}</small></span>
      <span class="ah-q-via" title="${esc(`${VIA[r.via].en} ${VIA[r.via].zh}`)}">${VIA[r.via].icon}</span></button>`;
    $("#ahQueue").appendChild(li);
    countQueue();
    if (S.arrived.length === 1) say(line(lines.first));
    // 11/27: a wrong form waiting for "Next person" stays on the desk (the clock waits then, so this is only a guard)
    if (!S.open || (S.answers[S.open] && !S.next)) openReq(r.id);
    if (r.via === "phone") phoneRing();
    phone();
    // 11/27: the first form of the first shift on this page is guided; the clock and patience wait for the first stamp
    if (guideLeft && S.open === r.id && !S.answers[r.id]) { guideLeft = false; guideFirst(r); }
  }

  function countQueue() { $("#ahWaitN").textContent = String(pending().length); }

  function drawFuses() {
    for (const r of pending()) {
      const f = S.fuse[r.id], pct = Math.max(0, (100 * f.left) / f.total), hot = f.left <= 12;
      const q = $(`.ah-q-item[data-id="${r.id}"]`);
      if (q) { $(".ah-q-ring", q).style.setProperty("--p", pct.toFixed(1)); q.classList.toggle("is-hot", hot); }
      if (S.open === r.id) {
        const bar = $("#ahPat");
        if (bar) {
          bar.classList.toggle("is-hot", hot);
          $("i", bar).style.width = `${pct}%`;
          const s = Math.max(0, Math.ceil(f.left)), mmss = `${Math.floor(s / 60)}:${CB.pad2(s % 60)}`;
          $("span", bar).innerHTML = S.calling === r.id ? bi(`${claimed(r)} is on hold while you call`, "回撥中，對方在等") : bi(`${claimed(r)} is waiting · ${mmss}`, `${who(r).name_zh || claimed(r)}在等・${mmss}`);   // 11/26 (front-end review K44): Chinese name in the Chinese half
        }
      }
    }
  }

  /* ------------------------------------------------------------------ the form on the desk */
  function emptyPaper() {
    $("#ahPaper").innerHTML = `<div class="ah-empty">${CB.ICON.ticket}<p>${bi("Nobody at the desk right now.", "現在沒有人在櫃台。")}</p></div>`;
    for (const b of $$(".ah-stamp")) b.disabled = true;
  }

  function formHTML(r) {
    const p = who(r), role = nm(p.role), data = nm(r.data), via = VIA[r.via];
    return `<article class="ah-form${r.impostor && S.verified[r.id] === "exposed" ? " is-fake" : ""}" data-id="${r.id}">
      <header class="ah-form-top"><p class="ah-form-title">${bi("Access request", "權限申請單")}</p><p class="ah-form-no">REQ-${r.time.replace(":", "")} · ${esc(r.time)}</p></header>
      <div class="ah-form-who">${avatar(r, "ah-form-av")}
        <div><p class="ah-name">${esc(p.name)} <span lang="zh-Hant">${esc(p.name_zh)}</span></p>
          <p class="ah-role">${bi(role.name_en, role.name_zh)}</p></div>
        <span class="ah-via is-${r.via}">${via.icon}${bi(via.en, via.zh)}</span></div>
      ${r.from ? `<p class="ah-from"><span>${bi(r.via === "email" ? "From address" : "Caller ID", r.via === "email" ? "寄件地址" : "來電號碼")}</span><b>${numHTML(r.from)}</b></p>` : ""}
      <dl class="ah-fields">
        <dt>${bi("Data", "資料")}</dt><dd><b>${esc(data.name_en)}</b> <span lang="zh-Hant">${esc(data.name_zh)}</span> ${clsChip(r.data)}
          <small>${bi(data.desc_en || "", data.desc_zh || "")}</small></dd>
        <dt>${bi("Asks for", "要求")}</dt><dd class="ah-ask">${CB.lvChip(r.ask, "is-asked")}</dd>
      </dl>
      <p class="ah-sign">${bi("Signed", "申請人簽名")} <i>${esc(p.name)}</i></p>
      ${r.impostor && S.verified[r.id] === "exposed" ? `<p class="ah-fake-tag">${bi(`Not ${p.name}`, "不是本人")}</p>` : ""}
    </article>`;
  }

  /* The counter: who is asking, and what they say. A walk-up stands there; a call comes out of the desk phone, a ticket out of
     the printer, an email onto the monitor. After the stamp the same spot shows their reaction. */
  const DEVICE = {
    phone: `<svg class="ah-dev" viewBox="0 0 120 90" aria-hidden="true"><path d="M14 78h92l-8-34H22z" fill="#2b3136"/><path d="M22 44h76l-6-8H28z" fill="#3a4247"/>
      <path d="M18 30c0-10 12-16 42-16s42 6 42 16v6H82v-6c0-3-9-5-22-5s-22 2-22 5v6H18z" fill="#1f2529"/><g fill="#9fb0ad"><rect x="40" y="52" width="8" height="6" rx="1.5"/><rect x="56" y="52" width="8" height="6" rx="1.5"/><rect x="72" y="52" width="8" height="6" rx="1.5"/>
      <rect x="40" y="62" width="8" height="6" rx="1.5"/><rect x="56" y="62" width="8" height="6" rx="1.5"/><rect x="72" y="62" width="8" height="6" rx="1.5"/></g><rect x="86" y="50" width="12" height="20" rx="2" fill="#7fd1a8" opacity=".85"/></svg>`,
    ticket: `<svg class="ah-dev" viewBox="0 0 120 90" aria-hidden="true"><rect x="16" y="40" width="88" height="38" rx="6" fill="#e9ecee" stroke="#9aa3a8" stroke-width="2"/><rect x="26" y="34" width="68" height="10" rx="3" fill="#6f777b"/>
      <path class="ah-dev-paper" d="M32 34V6h56v28" fill="#fffdf6" stroke="#c9ccd1" stroke-width="1.5"/><path d="M40 14h30M40 20h40M40 26h22" stroke="#b08a3e" stroke-width="2.2" stroke-linecap="round"/><circle cx="92" cy="60" r="4" fill="#46703f"/></svg>`,
    email: `<svg class="ah-dev" viewBox="0 0 120 90" aria-hidden="true"><rect x="12" y="6" width="96" height="62" rx="5" fill="#1c2124"/><rect x="18" y="12" width="84" height="50" rx="2" fill="#eef3f2"/>
      <path d="M30 22h60v30H30z" fill="#fff" stroke="#6b3b7a" stroke-width="2"/><path d="M30 22l30 18 30-18" fill="none" stroke="#6b3b7a" stroke-width="2"/><path d="M52 68h16l4 14H48z" fill="#3a4247"/><rect x="38" y="80" width="44" height="5" rx="2" fill="#2b3136"/></svg>`,
  };

  function counterHTML(r, mood, text, cls) {
    const p = who(r);
    const figure = r.via === "walk"
      ? `<div class="ah-person">${CB.face(Object.assign({}, p.look, { bare: true, mood }), "ah-person-svg")}</div>`
      : `<div class="ah-device is-${r.via}">${DEVICE[r.via]}${r.via === "phone" ? `<span class="ah-ring" aria-hidden="true"><i></i><i></i></span>` : ""}</div>`;
    const tag = r.via === "walk" ? `${esc(p.name)} <span lang="zh-Hant">${esc(p.name_zh)}</span>`
      : r.via === "phone" ? `${CB.ICON.phone}${numHTML(r.from || p.number)} · ${bi(`says it's ${p.name}`, `自稱${p.name_zh}`)}`
      : r.via === "ticket" ? `${CB.ICON.ticket}${bi(`Ticket from ${p.name}`, `${p.name_zh}的工單`)}`
      : `${CB.ICON.mail}${esc(r.from || "")}`;
    return `<div class="ah-visit ${cls || ""}" data-id="${r.id}">${figure}
      <div class="ah-bubble is-${r.via}${mood === "annoyed" || mood === "shocked" ? " is-upset" : ""}"><p class="ah-bubble-who">${tag}</p><p class="ah-bubble-t">${text}</p></div></div>`;
  }

  function showCounter(r, enter) {
    const box = $("#ahCounter");
    if (!box) return;
    const said = `“${esc(r.why_en)}”<span lang="zh-Hant">「${esc(r.why_zh)}」</span>`;
    box.innerHTML = counterHTML(r, r.impostor ? "flat" : "smile", said, enter ? "is-enter" : "");
  }

  function reactCounter(r, html, mood) {
    const box = $("#ahCounter");
    if (!box) return;
    box.innerHTML = counterHTML(r, mood, html, "is-react");
  }

  function openReq(id) {
    const r = byId[id];
    const fresh = S.open !== id;
    // 11/27: opening a form nobody has stamped yet means you moved on: a wrong form's "Next person" wait ends, and a guide
    // note about another form goes. 11/27 review: looking back at a done form keeps both (it shows "Next person" too).
    if (fresh && !S.answers[id]) { S.next = null; if (coachFor !== id) coachOff(); }
    S.open = id;
    // 11/26 (front-end review K45): the call-back answer is no longer cleared here; it carries the id of the form it was
    // about (dial) and phone() shows it only on that form, so it comes back when you come back to that form
    for (const q of $$(".ah-q-item, .ah-done-item")) q.classList.toggle("is-current", q.dataset.id === id);
    const done = !!S.answers[id];
    $("#ahPaper").innerHTML = `<div class="ah-paper${done ? " is-done" : " is-arriving"}">${formHTML(r)}
      ${done ? "" : `<div class="ah-pat" id="ahPat"><i></i><span></span></div>`}<div class="ah-out" id="ahOut"></div></div>`;
    for (const b of $$(".ah-stamp")) b.disabled = done;
    if (done) { inkMark(r, false); outcome(r, false); }
    else { showCounter(r, fresh); if (fresh) CB.SFX.play(r.via === "phone" ? "ring" : r.via === "walk" ? "open" : "paper"); }
    phone();
    hintBtn();
    drawFuses();
    // 11/27: the first request from someone you can't see (a call or an email): how to check who it is, from the rules
    if (!done && (r.via === "phone" || r.via === "email") && !SEEN.callback && !coachUp) noteCallback(r);
  }

  /* The stamps: press one down and drag it onto the form, or click it to pick it up and click the form to stamp. Where you
     let go is where the ink lands. Enter on a focused stamp stamps the form straight away. */
  let held = null;
  function stampHands() {
    for (const b of $$(".ah-stamp")) {
      b.addEventListener("pointerdown", (ev) => { if (ev.button !== 0 || b.disabled) return; ev.preventDefault(); pickUp(b.dataset.lv, ev.clientX, ev.clientY); });
      // 11/26 (front-end review K40): no stamping while paused
      b.addEventListener("keydown", (ev) => {
        if ((ev.key === "Enter" || ev.key === " ") && ev.repeat) { ev.preventDefault(); return; }   // 11/27 regression review: a held key
        if ((ev.key === "Enter" || ev.key === " ") && !b.disabled && !S.paused && S.open && !S.answers[S.open]) { ev.preventDefault(); decide(byId[S.open], b.dataset.lv, "stamp"); }
      });
    }
  }
  function pickUp(lv, x, y) {
    if (!S.open || S.answers[S.open] || S.over || S.hold || S.paused) return;   // 11/26 (front-end review K40): || S.paused
    putBack(false);
    const g = el("div", `ah-held is-${lv}`, `<span class="ah-held-knob"></span><span class="ah-held-face">${STAMP[lv][0]}<small>${STAMP[lv][1]}</small></span>`);
    g.setAttribute("aria-hidden", "true");
    document.body.appendChild(g);
    held = { lv, g, x0: x, y0: y, moved: false, armed: false };
    const src = $(`.ah-stamp.is-${lv}`); if (src) src.classList.add("is-lifted");
    $("#ahPaper").classList.add("is-armed");
    heldAt(x, y);
    CB.SFX.play("tap");
    document.addEventListener("pointermove", heldMove);
    document.addEventListener("pointerup", heldUp);
    document.addEventListener("keydown", heldKey);
  }
  const formRect = () => { const f = $(".ah-form", $("#ahPaper")); return f ? f.getBoundingClientRect() : null; };
  const overForm = (x, y) => { const r = formRect(); return !!r && x >= r.left && x <= r.right && y >= r.top && y <= r.bottom; };
  function heldAt(x, y) {
    held.g.style.transform = `translate(${x}px, ${y}px)`;
    const on = overForm(x, y);
    held.g.classList.toggle("is-over", on);
    $("#ahPaper").classList.toggle("is-target", on);
  }
  function heldMove(ev) { if (!held) return; if (Math.hypot(ev.clientX - held.x0, ev.clientY - held.y0) > 6) held.moved = true; heldAt(ev.clientX, ev.clientY); }
  function heldUp(ev) {
    if (!held) return;
    if (!held.moved && !held.armed) { held.armed = true; return; }          // a click: the stamp stays in your hand until the next click
    if (overForm(ev.clientX, ev.clientY) && S.open && !S.answers[S.open]) {
      const r = formRect(), lv = held.lv, k = G.k(), pos = { x: Math.round((ev.clientX - r.left) / k), y: Math.round((ev.clientY - r.top) / k) };
      putBack(true);
      return decide(byId[S.open], lv, "stamp", pos);
    }
    putBack(false);
  }
  function heldKey(ev) { if (ev.key === "Escape") { ev.preventDefault(); putBack(false); } }      // 11/23: handled here, the game window stays open (common.js)
  function putBack(used) {
    if (!held) return;
    const g = held.g;
    $$(".ah-stamp.is-lifted").forEach((b) => b.classList.remove("is-lifted"));
    const pp = $("#ahPaper"); if (pp) pp.classList.remove("is-armed", "is-target");
    document.removeEventListener("pointermove", heldMove);
    document.removeEventListener("pointerup", heldUp);
    document.removeEventListener("keydown", heldKey);
    held = null;
    if (used || reduceMotion) { g.remove(); return; }
    g.classList.add("is-back"); setTimeout(() => g.remove(), 220);
  }

  function inkMark(r, animate) {
    const lv = S.answers[r.id], timed = S.how[r.id] === "timeout";
    const m = el("div", `ah-inkmark is-${lv}${timed ? " is-timed" : ""}${animate ? " is-slam" : ""}`,
      timed ? `APPROVED AS ASKED<small>${esc(STAMP[lv][1])} · 別人照申請批的</small>` : `${STAMP[lv][0]}<small>${STAMP[lv][1]}</small>`);
    const pos = S.inkPos[r.id];
    if (pos) { m.classList.add("is-placed"); m.style.left = `${pos.x}px`; m.style.top = `${pos.y}px`; m.style.setProperty("--tilt", `${((pos.x * 7 + pos.y * 3) % 15) - 9}deg`); }
    $(".ah-form", $("#ahPaper")).appendChild(m);
    if (animate) {
      CB.SFX.play("stamp");
      if (!reduceMotion) {
        const sp = el("div", `ah-splat is-${lv}`);
        sp.innerHTML = [[-58, -18, 9], [64, -26, 6], [-40, 30, 5], [72, 22, 8], [8, -40, 4], [-74, 6, 4], [40, 40, 5], [-12, 44, 3]].map(([x, y, r]) => `<i style="--x:${x}px;--y:${y}px;--r:${r}px"></i>`).join("");
        m.appendChild(sp);
        const st0 = $(`.ah-stamp.is-${lv}`); if (st0) { st0.classList.remove("is-press"); void st0.offsetWidth; st0.classList.add("is-press"); }
      }
    }
    if (animate && !reduceMotion) { const pp = $(".ah-paper"); pp.classList.add("is-thud"); setTimeout(() => pp.classList.remove("is-thud"), 380); }
  }

  /* ------------------------------------------------------------------ the decision */
  const isRight = (r) => !!S.answers[r.id] && S.how[r.id] !== "timeout" && S.answers[r.id] === r.answer;
  const breachOf = (r, lv) => (r.impostor && lv !== "none") || (r.restricted && !r.impostor && rank(lv) > rank(r.level) && rank(lv) >= rank("read"));

  async function decide(r, lv, how, pos) {
    if (S.answers[r.id]) return;
    // 11/27: the stamp on the form you have open ends a guide note (the first stamp ends the first-time guide) and the clock
    // goes on. 11/27 review: someone else timing out is not your stamp, and must not take away a note that just opened.
    if (r.id === S.open) coachOff();
    // 11/23 review: someone else's patience running out doesn't take the stamp out of your hand; only the form you have open
    if (held && r.id === S.open) putBack(false);
    S.answers[r.id] = lv; S.how[r.id] = how;
    if (pos) S.inkPos[r.id] = pos;
    const left = S.fuse[r.id] ? Math.max(0, S.fuse[r.id].left) : 0;
    const g = {};
    const breach = breachOf(r, lv);
    if (how !== "timeout" && lv === r.answer) {
      S.streak += 1; S.best = Math.max(S.best, S.streak);
      g.right = P.right; g.speed = Math.round(P.speed * left); g.streak = S.streak > 1 ? P.streak * (S.streak - 1) : 0;
      if (r.impostor && S.verified[r.id] === "exposed") g.caught = P.caught;
    } else {
      S.streak = 0;
      if (!breach && rank(lv) > rank(r.answer)) g.much = -Math.min(P.much, S.points);
    }
    S.gain[r.id] = g;
    const sum = Object.values(g).reduce((a, b) => a + b, 0);
    S.points += sum;
    H.points(S.points, S.streak, sum || null);
    if (how !== "timeout") setTimeout(() => CB.SFX.play(g.right ? "good" : "bad"), 260);
    if (g.right) CB.streak(st, S.streak);
    // the queue row moves to the done list
    const q = $(`.ah-q-item[data-id="${r.id}"]`);
    if (q) q.parentElement.remove();
    const li = el("li");
    li.innerHTML = `<button type="button" class="ah-done-item ${isRight(r) ? "is-right" : "is-wrong"}" data-id="${r.id}">${avatar(r, "ah-q-av")}
      <span class="ah-q-name">${esc(claimed(r))}</span><span class="ah-done-mark is-${lv}">${esc(STAMP[lv][0])}<small lang="zh-Hant">${esc(STAMP[lv][1])}</small></span></button>`;
    $("#ahDone").prepend(li);
    countQueue();
    const wasOpen = S.open === r.id;
    // 11/27 (the user: 「錯了…看不懂」): a wrong stamp, or the open form timing out, stays on the desk with its reason until
    // "Next person"; the clock waits until then (S.next, checked in tick). Right stamps still move on by themselves.
    const wrong = !isRight(r);
    if (wrong && wasOpen) S.next = { id: r.id };
    // 11/26 (front-end review K39): S.calling is not cleared here any more. Only dial() ends a call; clearing it while the
    // call still rang put the keypad back over "Calling" and let a second call start.
    if (wasOpen) {
      const pat = $("#ahPat"); if (pat) pat.remove();   // 11/27 review: before outcome(), which sizes the reasons to the column
      inkMark(r, true);
      outcome(r, true);
      for (const b of $$(".ah-stamp")) b.disabled = true;
      phone();
      hintBtn();
      // 11/26 (front-end review K41): the stamp you pressed is disabled now. 11/27: after a wrong stamp, on "Next person"
      refocus(S.next && S.next.id === r.id ? "#ahNext" : `.ah-done-item[data-id="${r.id}"]`);
    } else {   // it timed out while you were on another form: a label floats up from the done list
      st.float($(`.ah-done-item[data-id="${r.id}"]`), `${bi(`${claimed(r)}: approved by someone else`, "別人照申請批了")}`, "is-miss");
      refocus("#ahQueue .ah-q-item, #ahStamps .ah-stamp:not(:disabled)");   // 11/26 (front-end review K41): its queue row is gone
    }
    // 11/27: why it was wrong, built from the game's data, goes into the Help panel; a slip that lets the crew in or
    // Restricted data out says it on its cut scene (st.cut records it there)
    const why = wrong ? whyOf(r, lv, how) : [], at = clockAt(S.clock), ctx = { screen: "shift", item: r.id, chosen: how === "timeout" ? "timeout" : lv };
    if (wrong && !breach) noteMistake(Object.assign({ at, why, ctx }, titleOf(r, lv, how)));
    // the mentor's line. 11/23 review: a timeout gets the timeout line even when it let the crew in; the blame lines are
    // only for stamps you made (someone else approved it as asked)
    if (how === "timeout") say(bi(story.timeout_en, story.timeout_zh));
    else if (breach) say(r.impostor ? bi("You gave access to someone you hadn't verified. Call back the number HR has before you stamp.", "你給了一個沒核實身分的人權限。蓋章前先回撥人資系統裡的號碼。") : line(lines.much));
    else if (r.impostor && lv === "none") say(S.verified[r.id] ? line(lines.caught) : line(lines.refused), "is-good");
    else if (lv === r.answer) say(lv === r.ask ? line(lines.asked) : line(lines.right), "is-good");
    else if (rank(lv) > rank(r.answer)) say(line(lines.much));
    else say(line(lines.little));
    if (breach) {
      S.shields -= 1;
      const left = S.shields;   // shields after this slip (cuts queue up if another comes first)
      S.losses.push(r);
      H.shields(S.shields, sh.shields, true);
      st.hit();
      S.hold += 1;
      await wait(900);
      if (held) putBack(false);      // the cut scene covers the desk: a stamp still in your hand goes back on the rack
      const dm = r.damage || {};
      // the beats keep their spacing but start from when it actually happened
      const base = CB.mins((dm.beats || [])[0] && dm.beats[0].time), now = T0 + S.clock;
      const beats = (dm.beats || []).map((b) => (/^\d+:\d+$/.test(b.time) ? Object.assign({}, b, { time: CB.hhmm(now + 1 + CB.mins(b.time) - base) }) : b));
      await st.cut({ scene: dm.scene || "ah_night", beats, hit_en: dm.hit_en, hit_zh: dm.hit_zh, inset: inset(dm, r), shields: left,
        go: left > 0 ? bi("Back to the desk", "回到櫃台") : bi("Continue", "繼續"), why, ctx, at });
      S.hold -= 1;
      if (S.shields <= 0) { if (!S.hold) gameOver(); return; }   // only after the last queued cut
    }
    if (!wasOpen) return;
    // 11/27: a wrong form waits for "Next person" (the cut scene took the keyboard; give it to that button)
    if (S.next && S.next.id === r.id) { if (S.open === r.id) refocus("#ahNext"); return; }
    await wait(1900);
    if (S.over || S.open !== r.id) return;
    const next = pending().sort((a, b) => S.fuse[a.id].left - S.fuse[b.id].left)[0];
    if (next) {
      openReq(next.id);
      // 11/26 (front-end review K41): the keyboard waited on the done row of the form you stamped; hand it to the stamps
      const a = document.activeElement;
      if (focusLost() || (a && a.matches && a.matches(`.ah-done-item[data-id="${r.id}"]`))) { const s = $("#ahStamps .ah-stamp:not(:disabled)"); if (s) s.focus({ preventScroll: true }); }
    }
  }

  /* What the person says to the stamp, and how they look (11/27: shared by the counter and the reasons below). own = their
     own words from games.yaml, not the line everyone gets. */
  function replyOf(r, lv, how) {
    if (r.impostor) return lv === "none" ? { en: r.right_en, zh: r.right_zh, mood: "annoyed" } : { en: "Thanks! That's all I needed.", zh: "謝啦！這樣就夠了。", mood: "happy" };
    if (lv === r.answer) return how === "timeout" ? { en: "Someone else signed it off for me.", zh: "有別人幫我批了。", mood: "happy" } : { en: r.right_en || "Thanks.", zh: r.right_zh || "謝謝。", mood: "happy" };
    if (rank(lv) > rank(r.answer)) {
      if (breachOf(r, lv) && r.breach_en) return { en: r.breach_en, zh: r.breach_zh, mood: "shocked", own: true };
      return r.much_en ? { en: r.much_en, zh: r.much_zh, mood: "shocked", own: true } : { en: "Oh. That's more than I asked for.", zh: "咦，比我要的還多。", mood: "shocked" };
    }
    if (rank(lv) < rank("read") && r.little_none_en) return { en: r.little_none_en, zh: r.little_none_zh, mood: "annoyed", own: true };
    return r.little_en ? { en: r.little_en, zh: r.little_zh, mood: "annoyed", own: true } : { en: "That's not enough to do my job.", zh: "這樣我工作做不了。", mood: "annoyed" };
  }

  /* ------------------------------------------------------------------ why a stamp was wrong (11/27)
     Only from the game's data: the knowledge graph's level for this job and data, and its note; where there is no note,
     what the job is (the role's description in the graph) and what the person said; for someone who is not who they say,
     the number or address they used against the HR directory, and what the real person says on a call-back; for
     Restricted data, why this stamp cost a shield or only points. */
  const verifyStep = () => { const pr = d.procedures.proc_password_reset; return (pr && pr.steps.find((x) => x.phase === "verify")) || null; };
  const jobLine = (r) => { const role = nm(who(r).role); return role.desc_en ? { en: `What ${an(role.name_en)} does: ${role.desc_en}`, zh: `${role.name_zh}的工作：${role.desc_zh || ""}` } : null; };
  const TIMED_RIGHT = { en: "That was the right level, but someone else signed it, so it earns you nothing.", zh: "等級是對的，但單子是別人批的，你拿不到分數。" };
  function policyLine(r) {
    const role = nm(who(r).role), data = nm(r.data);
    if (r.level === "none") return { en: `Knowledge graph: no CAN_ACCESS from ${role.name_en} to ${data.name_en}, so this job gets NO ACCESS.`, zh: `知識圖裡，${role.name_zh}和「${data.name_zh}」之間沒有 CAN_ACCESS，這份工作就是「不給」。` };
    return { en: `Knowledge graph: ${an(role.name_en)} gets ${STAMP[r.level][0]} on ${data.name_en}.${r.note_en ? ` ${r.note_en}` : ""}`,
             zh: `知識圖裡，${role.name_zh}對「${data.name_zh}」是「${STAMP[r.level][1]}」。${r.note_zh || ""}` };
  }
  function restrictedLine(r, lv) {
    if (!r.restricted || r.impostor || rank(lv) <= rank(r.level)) return null;
    const data = nm(r.data);
    if (breachOf(r, lv)) return { en: `${data.name_en} is Restricted data. READ or EDIT beyond what the policy gives costs a shield.`, zh: `「${data.name_zh}」是限閱資料，給到唯讀或可改又超過規定，就會少一面盾牌。` };
    return { en: `${data.name_en} is Restricted data. ${STAMP[lv][0]} costs points here; READ or EDIT would have cost a shield.`,
             zh: `「${data.name_zh}」是限閱資料。蓋「${STAMP[lv][1]}」會扣分，蓋唯讀或可改就會少一面盾牌。` };
  }
  function whyOf(r, lv, how) {
    const p = who(r), role = nm(p.role), data = nm(r.data), out = [];
    if (how === "timeout") out.push({ en: `${p.name} waited too long, so someone else approved exactly what was asked: ${STAMP[r.ask][0]}.`, zh: `${p.name_zh}等太久，別人照申請批了「${STAMP[r.ask][1]}」。` });
    if (r.impostor) {
      out.push(r.via === "email"
        ? { en: `Not ${p.name}, so NO ACCESS: ${r.from} is one of the three accounts the crew stole before dinner.`, zh: `不是本人，所以「不給」：${r.from} 是晚餐前被歹徒盜走的三個帳號之一。` }
        : { en: `Not ${p.name}, so NO ACCESS: the call came from ${r.from}, and the HR directory has ${p.number}.`, zh: `不是本人，所以「不給」：電話是從 ${r.from} 打來的，人資電話簿裡是${extZh(p.number)}。` });
      if (S.verified[r.id] === "fake") out.push({ en: `You called back ${r.from}, the number the caller gave you, so the crew picked up.`, zh: `你回撥的是對方給的 ${r.from}，接電話的就是歹徒。` });
      if (r.callback_en) out.push({ en: `Dialling ${p.number} from the HR directory reaches the real ${p.name}: “${r.callback_en}”`, zh: `撥人資電話簿裡的${extZh(p.number)}，接的是真的${p.name_zh}：「${r.callback_zh || ""}」` });
      if (r.restricted && r.level === "none") out.push({ en: `${data.name_en} is Restricted, and even the real ${p.name} gets none of it: the knowledge graph gives ${an(role.name_en)} no access.`,
        zh: `「${data.name_zh}」是限閱資料，就算是真的${p.name_zh}也拿不到：知識圖沒有給${role.name_zh}這個權限。` });
      const s = verifyStep(); if (s) out.push({ en: s.text_en, zh: s.text_zh });
      return out;
    }
    out.push(policyLine(r));
    if (!r.note_en) { const j = jobLine(r); if (j) out.push(j); }
    // 11/27 review: the person's own reaction only where it fits the stamp. Not on a timeout (they got what they asked for).
    // A "too much" line is written for one stamp: what they asked for, or, when that ask is itself the right level (r9) or
    // would cost a shield (r6), the one stamp left in between. So r10 READ does not hear about changing staff files.
    const s = replyOf(r, lv, how);
    const much = rank(lv) > rank(r.answer) && !breachOf(r, lv);
    const fits = how !== "timeout" && s.own && (!much || lv === r.ask || r.ask === r.answer || breachOf(r, r.ask));
    if (fits) out.push({ en: `${p.name}: “${s.en}”`, zh: `${p.name_zh}：「${s.zh}」` });
    if (r.answer === "none" && r.right_en) out.push({ en: `With NO ACCESS, ${p.name} says: “${r.right_en}”`, zh: `蓋「不給」的話，${p.name_zh}會說：「${r.right_zh || ""}」` });
    const rs = restrictedLine(r, lv); if (rs) out.push(rs);
    if (how === "timeout" && lv === r.answer) out.push(TIMED_RIGHT);
    return out;
  }
  function titleOf(r, lv, how) {
    const p = who(r), data = nm(r.data);
    if (how === "timeout") return { title_en: `${p.name} waited too long and got what the form asked for`, title_zh: `${p.name_zh}等太久，被照申請批了` };
    return rank(lv) > rank(r.answer)
      ? { title_en: `Too much for ${p.name}: ${STAMP[lv][0]} on ${data.name_en}`, title_zh: `給${p.name_zh}太多了：「${data.name_zh}」蓋了「${STAMP[lv][1]}」` }
      : { title_en: `Too little for ${p.name}: ${STAMP[lv][0]} on ${data.name_en}`, title_zh: `給${p.name_zh}太少了：「${data.name_zh}」蓋了「${STAMP[lv][1]}」` };
  }

  function outcome(r, animate) {
    const lv = S.answers[r.id], g = S.gain[r.id] || {}, how = S.how[r.id], p = who(r);
    const right = isRight(r), breach = breachOf(r, lv);
    const said = replyOf(r, lv, how);
    if (animate || S.open === r.id) reactCounter(r, bi(said.en, said.zh), said.mood);
    const pts = [g.right ? `+${g.right} ${bi("right stamp", "章蓋對了")}` : "", g.speed ? `+${g.speed} ${bi("speed", "速度")}` : "",
      g.streak ? `+${g.streak} ${bi("streak", "連續答對")}` : "", g.caught ? `+${g.caught} ${bi("caught by call-back", "回撥抓到")}` : "",
      g.much ? `${g.much} ${bi("too much", "給太多")}` : ""].filter(Boolean).join(" · ");
    const verdict = right ? ["is-right", bi("Right", "對")] : breach ? ["is-breach", bi(r.impostor ? "The crew got in" : "Restricted data went too far", r.impostor ? "歹徒拿到權限了" : "限閱資料給太多了")]
      : how === "timeout" ? ["is-timed", bi("Approved by someone else, as asked", "別人照申請批了")]
      : rank(lv) > rank(r.answer) ? ["is-much", bi("Too much", "給太多")] : ["is-little", bi("Too little", "給太少")];
    // 11/27: under the knowledge graph's level, its note; after a wrong stamp with no note, what the job is (a right one keeps
    // its old height, so the stage doesn't shrink and grow on every stamp); why Restricted data only cost points (a slip that
    // cost a shield said why on its cut scene), and why a right level that timed out earned nothing. The graph stores EDIT
    // as "write".
    const job = r.note_en ? { en: r.note_en, zh: r.note_zh } : right ? null : jobLine(r);
    const more = right ? [] : [breach ? null : restrictedLine(r, lv), how === "timeout" && lv === r.answer ? TIMED_RIGHT : null].filter(Boolean);
    const src = r.impostor
      ? `${S.verified[r.id] === "fake" ? `<p class="ah-kg-line ah-fake-call">${bi(`You called back ${r.from}, the number the caller gave you, so the crew picked up.`, `你回撥的是對方給的 ${r.from}，接電話的就是歹徒。`)}</p>` : ""}
        <p class="ah-kg-line">${bi(`Not ${p.name}: ${r.via === "email" ? `${r.from} is one of the three accounts the crew stole before dinner` : `the call came from ${r.from}, and HR has ${p.number}`}.`,
          r.via === "email" ? `不是本人：${r.from} 是晚餐前被歹徒盜走的三個帳號之一。` : `不是本人：來電號碼是 ${r.from}，人資系統裡的號碼是${extZh(p.number)}。`)}</p>
        ${procLine()}`
      : `<p class="ah-kg-line">${bi("Knowledge graph", "知識圖")} ${CB.lvChip(r.level)}${r.level === "write" ? ` ${bi("(write in the graph)", "（圖裡寫成 write）")}` : ""} ${job ? `<span class="ah-kg-note">${bi(job.en, job.zh)}</span>` : ""}</p>
        ${more.map((m) => `<p class="ah-kg-line"><span class="ah-kg-note">${bi(m.en, m.zh)}</span></p>`).join("")}
        <p class="g-src">${r.level === "none" ? bi(`No CAN_ACCESS relationship from ${nm(p.role).name_en} to ${nm(r.data).name_en}.`, "知識圖裡這個職務和這份資料之間沒有 CAN_ACCESS 關係。")
          : `(:Role {key:'${esc(p.role)}'})-[:CAN_ACCESS {level:'${esc(r.level)}'}]-&gt;(:DataAsset {key:'${esc(r.data)}'})`}</p>`;
    // 11/27: after a wrong stamp, "Next person" (while the clock waits) and "Ask the IT Assistant" sit with the points.
    // 11/27 review: while the clock waits, any done form you look back at has "Next person" too.
    const hold = !!S.next, ptsHTML = pts ? `<p class="rx-pts">${pts}</p>` : "";
    // 11/23 review: a timed-out form was stamped by someone else, so it doesn't say "your stamp"
    const yours = `<span class="ah-yours">${how === "timeout" ? bi("The stamp", "蓋的是") : bi("Your stamp", "你蓋的")} ${CB.lvChip(lv)}</span>`;
    // 11/27: after a wrong stamp the buttons sit on the verdict's line, so the reasons under it get that room (your stamp is
    // on the form right above; a timed-out form says which stamp someone else used; the points go to the end of the reasons)
    const nextBtn = hold ? `<button type="button" class="btn" id="ahNext">${bi("Next person", "下一位")}</button>` : "";
    const acts = `<span class="ah-acts">${nextBtn}${CB.askHTML("ah-help-ask")}</span>`;
    $("#ahOut").innerHTML = right
      ? `<div class="ah-result ${verdict[0]}${animate ? " is-in" : ""}"><p class="ah-verdict">${verdict[1]}${yours}${nextBtn ? `<span class="ah-acts">${nextBtn}</span>` : ""}</p><div class="ah-src">${src}</div>${ptsHTML}</div>`
      : `<div class="ah-result ${verdict[0]}${animate ? " is-in" : ""}"><p class="ah-verdict">${verdict[1]}${acts}</p>
        <div class="ah-src">${how === "timeout" ? `<p class="ah-kg-line">${yours}</p>` : ""}${src}${ptsHTML}</div></div>`;
    fitReasons();
    const nb = $("#ahNext");
    if (nb) {
      nb.addEventListener("click", nextPerson);
      nb.addEventListener("keydown", (ev) => { if ((ev.key === "Enter" || ev.key === " ") && ev.repeat) ev.preventDefault(); });   // 11/27 regression review
    }
    CB.bindAsk($("#ahOut .ah-help-ask"), { screen: "shift", item: r.id, chosen: how === "timeout" ? "timeout" : lv, mistake: true });
  }

  /* 11/27: the stage keeps its 800 px: the reasons box (.ah-src, liquid.css) gives up what the column with the form would
     add to the stage and scrolls inside, never under 60 px. 11/27 review: measured on that column (the counter, the desk
     and the paper), not the whole stage, so a tall phone (directory open, a call's answer) or a long queue beside it no
     longer squeezes the reasons; while a side column makes the stage taller anyway, the reasons may use that height too.
     A ResizeObserver on the three columns (startShift) sizes it again whenever one of them changes while a reason shows. */
  const STAGE_H = 800;
  function fitReasons() {
    const box = $("#ahOut .ah-src"), center = $(".ah-center"), wrap = $("#ahPaper"), paper = wrap && $(".ah-paper", wrap), body = $(".rs-body");
    if (!box || !center || !paper || !body || !document.body.classList.contains("is-fit")) return;
    const pad = parseFloat(getComputedStyle(body).paddingBottom) || 0, min = parseFloat(getComputedStyle(wrap).minHeight) || 0;
    const side = Math.max(0, ...$$(".ah-left, .ah-right").map((c) => c.offsetTop + c.offsetHeight));
    const room = Math.max(STAGE_H, side + pad);                                   // the stage's height without this column
    const around = center.offsetTop + center.offsetHeight - wrap.offsetHeight;   // above and below the paper in that column
    const rest = paper.offsetHeight - box.offsetHeight;                           // the form and the result without the reasons
    const fits = around + Math.max(min, rest + box.scrollHeight) + pad <= room;
    const want = fits ? "" : `${Math.max(60, Math.floor(room - pad - around - rest) - 1)}px`;
    if (box.style.maxHeight !== want) box.style.maxHeight = want;
  }

  /* 11/27: "Next person" after a wrong stamp: the clock goes on and the desk moves to whoever has the least patience left,
     as it does by itself after a right stamp */
  function nextPerson() {
    if (!S || !S.next || S.over || S.paused || S.hold) return;
    const id = S.next.id;
    S.next = null;
    const nb = $("#ahNext"); if (nb) nb.remove();
    const next = pending().sort((a, b) => S.fuse[a.id].left - S.fuse[b.id].left)[0];
    if (next) {
      openReq(next.id);
      const s = $("#ahStamps .ah-stamp:not(:disabled)"); if (s && focusLost()) s.focus({ preventScroll: true });
    } else refocus(`.ah-done-item[data-id="${S.open || id}"]`);
  }

  function procLine() {
    const pr = d.procedures.proc_password_reset, s = verifyStep();
    return s ? `<p class="ah-proc">${bi(s.text_en, s.text_zh)}<small>${bi(`From “${pr.name_en}” in the knowledge graph`, `出自知識圖的流程「${pr.name_zh}」`)}</small></p>` : "";
  }

  function inset(dm, r) {
    if (dm.inset === "ticket") return `<div class="ah-cut-ticket"><p class="ah-cut-top">ITSM · ${bi("Ticket", "工單")} INC-2241</p>
      <p><b>${bi("Move MFA to a new phone", "多因素驗證換新手機")}</b></p><p>${bi("User: g.lin · Opened by: k.wu", "使用者：g.lin・開單：k.wu")}</p><p class="ah-cut-st">${bi("Approved", "已核准")}</p></div>`;
    if (dm.inset === "payroll") return `<div class="ah-cut-file"><p class="ah-cut-top">${CB.ICON.mail} payroll_2026-11.xlsx</p>
      <table><tr><th>${bi("Name", "姓名")}</th><th>${bi("Bank", "銀行")}</th><th>${bi("Account", "帳號")}</th></tr><tr><td>A. Lin</td><td>812</td><td>•••• 4471</td></tr><tr><td>B. Hsu</td><td>808</td><td>•••• 2093</td></tr><tr><td>C. Chang</td><td>822</td><td>•••• 7710</td></tr></table>
      <p class="ah-cut-n">${bi("212 rows", "212 筆")}</p></div>`;
    if (dm.inset === "payroll_edit") return `<div class="ah-cut-file"><p class="ah-cut-top">${bi("Payroll · where salaries are paid", "薪資・入帳帳戶")}</p>
      <table><tr><th>${bi("Name", "姓名")}</th><th>${bi("Account", "帳號")}</th><th></th></tr>${[["A. Lin", "4471"], ["B. Hsu", "2093"], ["C. Chang", "7710"]].map(([n, a]) => `<tr><td>${n}</td><td>•••• ${a}</td><td>${bi("Edit", "可改")}</td></tr>`).join("")}</table>
      <p class="ah-cut-n">${bi("212 people · editable", "212 人・可以改")}</p></div>`;
    if (dm.inset === "cards") return `<div class="ah-cut-file is-cards"><p class="ah-cut-top">${bi("Bar tablet · tonight's tabs", "酒吧平板・今晚的帳單")}</p>
      <ul><li>4024 0071 5532 1187</li><li>5191 2300 4417 0962</li><li>4532 7718 2093 4410</li><li>…</li></ul><p class="ah-cut-n">${bi("46 cards", "46 張卡")}</p></div>`;
    return "";
  }

  /* ------------------------------------------------------------------ the desk phone: you dial the number yourself
     The HR directory beside it has everyone's real number. The recent-calls list is quicker, and it rings whoever called. */
  const digits = (x) => String(x || "").replace(/\D/g, "");
  // 11/22 evening: the crew's number is a UK drama number (+44 7700 900417), typed with or without the 00 in front
  const intl = (d) => String(d || "").replace(/^00/, "");
  // 11/22 review, the display while you type: 0044 or 44 is that number, grouped as it grows (+44 7700 900417); 1 to 4 digits
  // starting with 1-9 is an extension (none starts with 0); 10 digits is a Taiwan number (0912-345-678); anything else as typed
  const uk = (n) => { const y = n.replace(/^(00)?44/, ""); return ["+44", y.slice(0, 4), y.slice(4)].filter(Boolean).join(" "); };
  const shown = (n) => (/^(00)?44/.test(n) ? uk(n)
    : /^[1-9]\d{0,3}$/.test(n) ? `ext. ${n}` : n.length === 10 ? `${n.slice(0, 4)}-${n.slice(4, 7)}-${n.slice(7)}` : n);
  const BOOK = Object.entries(people).sort((a, b) => a[1].name.localeCompare(b[1].name));

  function phone() {
    const box = $("#ahPhone");
    if (!box || !S) return;
    if (S.calling) return;
    const recent = S.arrived.map((id) => byId[id]).filter((q) => q.via === "phone");
    // 11/26 (front-end review K41): the phone is rebuilt on every key, arrival and form switch. Remember which control had
    // the keyboard (or the Call button, if a call just took it) and how far the HR directory was scrolled, and put them back.
    const a = document.activeElement, mine = !!a && a !== box && box.contains(a);
    const fk = mine ? (a.dataset.k ? `[data-k="${a.dataset.k}"]` : a.dataset.num ? `.ah-recent [data-num="${a.dataset.num}"]` : a.id ? `#${a.id}` : a.matches("summary") ? ".ah-dir summary" : null)
      : S.phoneFocus && focusLost() ? S.phoneFocus : null;
    S.phoneFocus = null;
    keepDirTop();
    // 11/26 (front-end review K45): a call-back answer shows only on the form it was about
    const heard = S.heard.text && (S.heard.id || null) === (S.open || null);
    box.innerHTML = `<p class="ah-phone-top"><b>${bi("Desk phone", "桌上電話")}</b><em>${bi(`${S.calls} call${S.calls === 1 ? "" : "s"} left`, `還能打 ${S.calls} 通`)}</em></p>
      <div class="ah-lcd"><span id="ahNum">${S.dial ? numHTML(shown(S.dial)) : `<i>${bi("dial a number", "撥號碼")}</i>`}</span><button type="button" class="ah-del" data-k="del" aria-label="Delete">⌫</button></div>
      <div class="ah-keys" id="ahKeys">${["1", "2", "3", "4", "5", "6", "7", "8", "9", "*", "0", "#"].map((k) => `<button type="button" data-k="${k}">${k}</button>`).join("")}</div>
      <button type="button" class="ah-call" id="ahCall"${S.calls <= 0 || !S.dial ? " disabled" : ""}>${CB.ICON.phone}${bi("Call", "撥出")}</button>
      ${heard ? `<div class="ah-heard ${S.heard.cls || ""}">${S.heard.face || ""}<p>${S.heard.text}</p></div>` : ""}
      <div class="ah-book"><details class="ah-dir"${S.dirOpen ? " open" : ""}><summary class="ah-book-h">${bi("HR directory · look up a number", "人資電話簿・查號碼")}</summary>
        <ul>${BOOK.map(([k, q]) => `<li><b>${esc(q.name)}</b><span>${bi(nm(q.role).name_en, nm(q.role).name_zh)}</span><i>${numHTML(q.number)}</i></li>`).join("")}</ul></details>
        ${recent.length ? `<p class="ah-book-h">${bi("Recent calls · tap to call back", "最近來電・點一下回撥")}</p><ul class="ah-recent">${recent.map((q) => `<li><button type="button" data-num="${esc(digits(q.from))}">${CB.ICON.phone}<b>${numHTML(q.from)}</b><span>${esc(q.time)}</span></button></li>`).join("")}</ul>` : ""}</div>`;
    $("#ahKeys").addEventListener("click", (ev) => { const b = ev.target.closest("[data-k]"); if (b) key(b.dataset.k); });
    // 11/26 (front-end review K41): a rebuilt <details open> fires toggle by itself; only a real open or close counts (no paper sound each time)
    // 11/27: opening the directory is what the call-back note asked for, so the note goes
    $(".ah-dir", box).addEventListener("toggle", (ev) => { if (ev.target.open === !!S.dirOpen) return; S.dirOpen = ev.target.open; if (S.dirOpen) { CB.SFX.play("paper"); phoneUsed(); } });
    $(".ah-del", box).addEventListener("click", () => key("del"));
    $("#ahCall").addEventListener("click", () => dial(S.dial));
    for (const b of $$(".ah-recent [data-num]", box)) b.addEventListener("click", () => { S.dial = b.dataset.num; CB.SFX.play("tap"); phoneUsed(); phone(); });
    const ul = $(".ah-dir ul", box); if (ul && S.dirTop) ul.scrollTop = S.dirTop;
    if (fk) { const n = $(fk, box), k1 = $('#ahKeys [data-k="1"]', box), to = n && !n.disabled ? n : k1; if (to) to.focus({ preventScroll: true }); }
  }
  // 11/26 (front-end review K41): how far the HR directory list is scrolled, kept across rebuilds of the phone
  function keepDirTop() { const dd = $(".ah-dir", $("#ahPhone")), ul = dd && $("ul", dd); if (ul && dd.open) S.dirTop = ul.scrollTop; }

  // 11/27: the call-back note goes once you use the phone (the clock it held goes on)
  const phoneUsed = () => { if (coachKind === "callback") coachOff(); };

  function key(k) {
    if (S.calling || S.paused) return;   // 11/26 (front-end review K40): || S.paused
    phoneUsed();
    if (k === "del") S.dial = S.dial.slice(0, -1);
    else if (/^\d$/.test(k) && S.dial.length < 14) S.dial += k;
    CB.SFX.play("tick");
    phone();
  }

  // 11/26 (front-end review K47): calling the same person again about the same form adds no second note
  const addNote = (n) => { if (!S.notes.some((o) => o.id === n.id && o.who === n.who && o.fake === n.fake)) S.notes.push(n); };
  // 11/27: a call used up for nothing goes into the Help panel with why. No stamp is in ctx, so the IT Assistant still
  // keeps that form's answer to itself; 11/27 review: ctx.call says which slip it was (fake = the number they called from,
  // walk = someone standing at the desk, other = another person's number, nobody = a number nobody has).
  const callMiss = (call, r, en, zh, why) => noteMistake({ at: clockAt(S.clock), title_en: en, title_zh: zh, why: why.filter(Boolean),
    ctx: r ? { screen: "shift", item: r.id, call } : { screen: "shift", call } });

  /* who answers the number you dialled */
  function answerer(d, r) {
    d = intl(d);
    for (const q of d && S.arrived.map((id) => byId[id]) || []) if (q.impostor && q.via === "phone" && digits(q.from) === d) return { kind: "fake", req: q };
    const owners = BOOK.filter(([, q]) => digits(q.number) === d).map(([k]) => k);
    if (owners.length) return r && owners.includes(r.who) ? { kind: "real", key: r.who } : { kind: "other", key: owners[0] };
    return { kind: "none" };
  }

  // 11/22 review: the number is "num"; it was "d", which hid the game data d (d.requests in the "other" branch threw,
  // and the phone stayed on "Calling")
  async function dial(num) {
    if (!num || S.calls <= 0 || S.calling || S.paused) return;   // 11/26 (front-end review K40): || S.paused
    phoneUsed();
    const r = S.open && byId[S.open];
    S.calls -= 1;
    S.calling = r ? r.id : "x";
    S.heard = {};
    CB.SFX.play("ring");
    const box = $("#ahPhone");
    // 11/26 (front-end review K41): the "Calling" screen takes the Call button away; phone() gives the keyboard back after the call
    S.phoneFocus = box.contains(document.activeElement) ? "#ahCall" : null;
    keepDirTop();
    box.innerHTML = `<p class="ah-phone-top"><b>${bi("Calling", "撥號中")}</b><em>${numHTML(shown(num))}</em></p><div class="rs-ring" aria-hidden="true"><i></i><i></i><i></i></div>`;
    await wait(1500);
    if (!S || S.over) return;
    S.calling = false;
    S.dial = "";
    const a = answerer(num, r);
    const face = (k, mood) => CB.face(Object.assign({}, people[k].look, { mood }), "ah-callee-av");
    if (a.kind === "fake") {                                    // the number the caller gave: he picks up himself
      const q = a.req, p = who(q);
      S.verified[q.id] = S.verified[q.id] || "fake";
      S.heard = { cls: "is-ok", face: `<span class="ah-av ah-av-phone ah-callee-av" aria-hidden="true">${CB.ICON.phone}</span>`, text: bi(q.fake_confirm_en || "Yes, it's me.", q.fake_confirm_zh || "對，是我。") };
      addNote({ id: q.id, who: `${p.name}?`, who_zh: p.name_zh, en: q.fake_confirm_en || "Yes, it's me.", zh: q.fake_confirm_zh || "對，是我。", fake: false, via: shown(num) });   // 11/26 (front-end review K47): one note per call-back, however often it is called
      // 11/27: the trap stays (the call is used up, and the caller says it's him); Mei-Ling says why that checks nothing
      say(bi("That's the number they called from, so whoever called picks up. It proves nothing. Find the person in the HR directory and dial that number.",
        "那是對方打來的號碼，接的當然是打來的人，這樣證明不了什麼。要去人資電話簿找這個人，撥上面的號碼。"), "is-no");
      callMiss("fake", q, "Called back the number they called from", "回撥了對方打來的號碼", [
        { en: `You dialled ${q.from}, the number the call came from, so the same caller answered. That proves nothing about who it is.`, zh: `你撥的 ${q.from} 就是對方打來的號碼，接的還是同一個人，這樣證明不了他是誰。` },
        verifyStep() && { en: verifyStep().text_en, zh: verifyStep().text_zh }]);
    } else if (a.kind === "real") {
      const p = people[a.key];
      if (r.via === "walk") {
        S.heard = { face: face(a.key, "happy"), text: bi(`${p.name}'s phone buzzes in a pocket. “That's me ringing? I'm standing right here!”`, `${p.name_zh}口袋裡的手機響了。「打給我？我就站在你面前耶！」`) };
        // 11/27: a call used up on someone you can see
        say(bi("You can see who is at the desk. Call-backs are for people you can't see: phone calls and emails.", "櫃台前的人你看得到。回撥是給看不到本人的申請用的：打電話或寄信來的。"));
        callMiss("walk", r, `Called ${p.name}, who is standing at the desk`, `打給就站在櫃台前的${p.name_zh}`,
          [{ en: "A call-back checks someone you can't see: a phone call or an email. You can see who is standing at the desk.", zh: "回撥是用來確認看不到的人：打電話或寄信來的。站在櫃台前的人你看得到。" }]);
      } else {
        const fresh = S.answers[r.id] === undefined;      // already stamped: the call-back no longer changes that form
        if (fresh) S.verified[r.id] = r.impostor ? "exposed" : "ok";
        const en = r.callback_en || "Yes, that was me. Thanks for checking.", zh = r.callback_zh || "對，是我，謝謝你確認。";
        S.heard = { cls: r.impostor ? "is-fake" : "is-ok", face: face(a.key, r.impostor ? "shocked" : "smile"), text: `<b>${esc(p.name)}</b> “${esc(en)}”<span lang="zh-Hant">${esc(zh)}</span>` };
        addNote({ id: r.id, who: p.name, who_zh: p.name_zh, en, zh, fake: !!r.impostor });   // 11/26 (front-end review K47)
        if (!fresh) say(r.impostor ? bi(`That wasn't ${p.name}. I'll tell the SOC.`, `那不是${p.name_zh}本人，我來通知資安監控中心。`) : bi(`${p.name} confirms it.`, `${p.name_zh}確認是本人。`), r.impostor ? "is-no" : "");
        // 11/27 (lead): "Stamp it" said which stamp only in the rules; an impostor gets NO ACCESS
        else if (r.impostor) { CB.SFX.play("alarm"); say(bi(`That wasn't ${p.name}. Stamp it NO ACCESS, and I'll tell the SOC.`, `那不是${p.name_zh}本人。蓋「不給」，我來通知資安監控中心。`), "is-no"); st.toast(null, bi(`Call-back: not ${p.name}`, `回撥結果：不是${p.name_zh}本人`)); }
        else say(bi(`${p.name} confirms it. Now: what does the job need?`, `${p.name_zh}確認是本人。接著看工作需要什麼。`));
      }
    } else if (a.kind === "other") {
      const p = people[a.key];
      const came = d.requests.some((q) => q.who === a.key && !q.impostor && S.arrived.includes(q.id));
      S.heard = { face: face(a.key, "flat"), text: came ? bi(`${p.name}: “Hello? I came by the desk earlier, but I haven't asked for anything else.”`, `${p.name_zh}：「喂？我剛剛有去服務台，但沒有再申請別的。」`)
        : bi(`${p.name}: “Hello? I didn't ask for anything tonight.”`, `${p.name_zh}：「喂？我今晚沒有申請什麼啊。」`) };
      if (r) {   // 11/27: a call used up on someone else's number
        const o = who(r);
        say(bi(`That was ${p.name}, not ${o.name}. Find ${o.name} in the HR directory.`, `接的是${p.name_zh}，不是${o.name_zh}。去人資電話簿找${o.name_zh}的號碼。`));
        callMiss("other", r, `Called ${p.name} about ${o.name}'s form`, `為了${o.name_zh}的單子，打給了${p.name_zh}`,
          [{ en: `${p.name} didn't ask for anything. To check ${o.name}, find ${o.name} in the HR directory and dial that number.`, zh: `${p.name_zh}沒有申請東西。要確認${o.name_zh}，就去人資電話簿找${o.name_zh}，撥上面的號碼。` }]);
      }
    } else {
      S.heard = { cls: "is-none", text: bi("“The number you dialled is not in service.”", "「您撥的號碼是空號。」") };
      // 11/27: a call used up on a number nobody has
      say(bi("That number isn't in the HR directory. Look the person up there first.", "這個號碼不在人資電話簿裡，先去電話簿找人。"));
      callMiss("nobody", r, "Called a number that isn't in the HR directory", "撥了人資電話簿裡沒有的號碼",
        [{ en: "Nobody has that number. Find the person in the HR directory and dial the number there.", zh: "這個號碼沒有人用。去人資電話簿找這個人，撥上面的號碼。" }]);
    }
    S.heard.id = r ? r.id : null;   // 11/26 (front-end review K45): the form this call was about (phone() shows the answer there)
    if (S.open && S.answers[S.open] === undefined && r && S.open === r.id && S.verified[r.id]) openReq(r.id); else phone();
  }

  function phoneRing() {
    const b = $("#ahPhone");
    if (!b || reduceMotion) return;
    b.classList.remove("is-ring"); void b.offsetWidth; b.classList.add("is-ring");
  }

  /* ------------------------------------------------------------------ Mei-Ling's hint */
  function hintBtn() {
    const b = $("#ahHint");
    if (!b) return;
    const r = S.open && byId[S.open];
    const can = S.hints > 0 && r && !S.answers[r.id] && !S.hinted[r.id];
    b.disabled = !can;
    b.innerHTML = `${CB.mentor("is-mini")}<span>${bi("Ask Mei-Ling", "問美玲")}</span><em>${S.hints > 0 ? bi(`${S.hints} left`, `還有 ${S.hints} 次`) : bi("used", "用完了")}</em>`;
  }

  function useHint() {
    const r = S.open && byId[S.open];
    if (!r || S.hints <= 0 || S.answers[r.id] || S.paused) return;   // 11/26 (front-end review K40): || S.paused
    S.hints -= 1; S.hinted[r.id] = true;
    const p = who(r);
    if (r.impostor) say(bi(`Hmm, that ${r.via === "email" ? "address belongs to an account the crew stole tonight" : `number isn't ${p.name}'s. HR has ${p.number}`}. Don't give it anything you can't verify.`,
      r.via === "email" ? "嗯，這個信箱是今晚被歹徒盜走的帳號之一。沒辦法確認的，什麼都不要給。" : `嗯，這不是${p.name_zh}的號碼，人資系統裡是${extZh(p.number)}。沒辦法確認的，什麼都不要給。`), "is-no");
    else say(bi(`The policy for ${nm(p.role).name_en} on ${nm(r.data).name_en}: ${CB.LV[r.level].en}.${r.note_en ? ` ${r.note_en}` : ""}`,
      `規定裡${nm(p.role).name_zh}對${nm(r.data).name_zh}是「${CB.LV[r.level].zh}」。${r.note_zh || ""}`), "is-good");
    hintBtn();
    refocus("#ahStamps .ah-stamp:not(:disabled)");   // 11/26 (front-end review K41): the hint button you pressed is disabled now
  }

  /* ------------------------------------------------------------------ the chart on the wall (part of the policy) */
  function wallMini() {
    return d.wall_roles.map((rk) => `<span>${d.wall_data.map((dk) => { const c = d.wall.find((x) => x.role === rk && x.data === dk); return `<i class="is-${c ? c.level : "none"}"></i>`; }).join("")}</span>`).join("");
  }
  function wallZoom() {
    if (!S || S.over || S.paused || S.wall) return;   // 11/26 (front-end review K40, K43): not while paused, and one chart at a time
    CB.SFX.play("paper");
    const { box, close } = st.overlay("ah-wallzoom", `<div class="ah-wallzoom-in"><button type="button" class="rs-x ah-wallzoom-x" data-close aria-label="Close">×</button>${wallHTML()}
      <p class="ah-wallzoom-note">${bi("Only part of the policy is on the wall. For the rest, think about what the job needs. The clock keeps running while you look.", "牆上只有一部分的規定，其他的要想這份工作需要什麼。看表的時候時間照走。")}</p></div>`, "The access chart on the wall");
    // 11/26 (front-end review K43): keep the close handle, so the end of the shift can close the chart (its Escape listener
    // went with it); however the chart closes, the keyboard goes back to the wall chart button if it lost its place
    const s = S;
    s.wall = close;
    const mo = new MutationObserver(() => {
      if (box.isConnected) return;
      mo.disconnect();
      if (s.wall === close) s.wall = null;
      if (s === S && !s.over) refocus("#ahWallBtn");
    });
    mo.observe(box.parentNode, { childList: true });
    $("[data-close]", box).focus({ preventScroll: true });
  }
  function wallHTML() {
    const rows = d.wall_roles.map((rk) => `<tr><th scope="row">${esc(nm(rk).name_en)}<small lang="zh-Hant">${esc(nm(rk).name_zh)}</small></th>${d.wall_data.map((dk) => {
      const c = d.wall.find((x) => x.role === rk && x.data === dk), lv = c ? c.level : "none";
      return `<td><span class="ah-w is-${lv}" title="${esc(`${CB.LV[lv].en} ${CB.LV[lv].zh}`)}">${lv === "none" ? "" : `${esc(lv === "write" ? "edit" : lv)} <span lang="zh-Hant">${esc(CB.LV[lv].zh)}</span>`}</span></td>`;
    }).join("")}</tr>`).join("");
    return `<section class="ah-wall" aria-label="The access chart on the wall"><p class="ah-wall-title">Who May Use What<span lang="zh-Hant">誰能用什麼</span></p>
      <table><thead><tr><th></th>${d.wall_data.map((dk) => `<th scope="col">${esc(nm(dk).name_en)}<small lang="zh-Hant">${esc(nm(dk).name_zh)}</small></th>`).join("")}</tr></thead><tbody>${rows}</tbody></table>
      <p class="ah-wall-foot">${bi("On the Help Desk wall, from the knowledge graph", "服務台牆上那張，照知識圖產生")}</p></section>`;
  }

  /* ------------------------------------------------------------------ the end of the shift */
  const rightCount = () => d.requests.filter(isRight).length;
  const caughtCount = () => d.requests.filter((r) => r.impostor && S.answers[r.id] === "none").length;
  const impostors = () => d.requests.filter((r) => r.impostor).length;

  async function endShift() {
    S.over = true;
    loop.stop();
    coachOff(); S.next = null;   // 11/27: no guide note or "Next person" wait outlives the shift
    if (centerRO) { centerRO.disconnect(); centerRO = null; }
    putBack(false);      // 11/23: nothing left in your hand when the desk closes
    if (S.wall) S.wall();   // 11/26 (front-end review K43): close the wall chart properly, so its Escape listener goes too
    const from = S.clock;
    for (let k = 1; k <= 10; k++) { S.clock = from + ((TEND - from) * k) / 10; H.clock(clockAt(S.clock)); await wait(70); }
    await wait(400);
    summary();
  }

  function summary() {
    st.scene("ah_desk", 0.5);
    const wrong = d.requests.filter((r) => !isRight(r));
    st.body.innerHTML = `<section class="rs-dinner ah-sum">
      <p class="rs-kicker">${bi(`${story.end} · the queue is empty`, `${story.end}・隊伍清空了`)}</p>
      <h2 class="rs-dinner-title">${S.shields === sh.shields ? bi("The crew got nothing from the Help Desk.", "歹徒在服務台什麼都沒拿到。") : bi(`You kept the desk open with ${S.shields} shield${S.shields > 1 ? "s" : ""} left.`, `撐到下班了，還剩 ${S.shields} 面盾牌。`)}</h2>
      <div class="rx-stats rs-dinner-stats">
        <div><b>${rightCount()}/${d.requests.length}</b><span>${bi("stamps right", "章蓋對的")}</span></div>
        <div><b>${caughtCount()}/${impostors()}</b><span>${bi("impostors refused", "擋下假冒的人")}</span></div>
        <div><b class="rs-shields-row">${Array.from({ length: sh.shields }, (_, k) => CB.ICON.shield(k < S.shields)).join("")}</b><span>${bi("shields left", "剩下的盾牌")}</span></div>
        <div><b>${S.notes.length}</b><span>${bi("call-backs", "回撥")}</span></div>
        <div><b>${S.points.toLocaleString("en-US")}</b><span>${bi("points", "分")}</span></div></div>
      ${wrong.length ? `<details class="rs-dinner-wrong"><summary>${bi(`${wrong.length} form${wrong.length > 1 ? "s" : ""} to look at again`, `再看一次這 ${wrong.length} 張`)}</summary>${wrongList(wrong)}</details>` : ""}
      ${CB.personHTML(MENTOR, bi(`Thanks for covering. Jun-Hao is bringing tonight's access log to the wall chart at ${BOARD.time}.${S.notes.length ? ` Bring your call-back notes: ${S.notes.length}.` : ""}`,
        `謝謝你幫忙顧櫃台。俊豪 ${BOARD.time} 會把今晚的存取紀錄帶到牆上那張權限表前。${S.notes.length ? `回撥的紀錄記得帶著，有 ${S.notes.length} 筆。` : ""}`))}
      <button type="button" class="btn rs-start">${bi("Go to the wall chart", "到權限表前")}</button></section>`;
    G.meter(`<div class="rx-hud"><div class="rx-hud-clock"><b>${esc(story.end)}</b><span>${bi("Help Desk", "服務台")}</span></div><div class="rx-hud-pts"><b>${S.points.toLocaleString("en-US")}</b><span>${bi("points", "分")}</span></div></div>`);
    $(".rs-start", st.body).addEventListener("click", async (ev) => {
      // 11/26 (front-end review C01): Enter again during the time skip doesn't start a second skip and a second board
      const b = ev.currentTarget; if (b.disabled) return; b.disabled = true;
      await CB.timeskip(st, { from: story.end, to: BOARD.time, place_en: "The access chart on the Help Desk wall", place_zh: "服務台牆上的權限表", day_en: "Awards Night", day_zh: "頒獎晚會" });
      startBoard();
    });
    window.scrollTo({ top: 0, behavior: reduceMotion ? "auto" : "smooth" });
    setNow(() => ({ title_en: "The shift is over", title_zh: "值班結束", ctx: { screen: "end" }, steps: [
      { en: `${rightCount()} of ${d.requests.length} stamps were right.`, zh: `${d.requests.length} 張單子蓋對 ${rightCount()} 張。` },
      wrong.length ? { en: "Open the list under the numbers to see each form you got wrong and what it needed.", zh: "打開數字下面的清單，看每張蓋錯的單子應該蓋什麼。" } : null,
      { en: "Press Go to the wall chart for the case board.", zh: "按「到權限表前」，開始看案情板。" }].filter(Boolean) }));
  }

  function wrongList(list) {
    return `<ul class="ph-missed ah-missed">${list.map((r) => {
      const p = who(r), lv = S.answers[r.id];
      return `<li><span class="g-pill">${esc(r.time)}</span> <b>${esc(p.name)}</b> · ${bi(nm(r.data).name_en, nm(r.data).name_zh)}
        <p>${S.how[r.id] === "timeout" ? bi("Someone else", "別人") : bi("You", "你")} ${CB.lvChip(lv)}${S.how[r.id] === "timeout" ? ` <i>${bi("(timed out)", "（等太久）")}</i>` : ""} → ${bi("needed", "應該是")} ${CB.lvChip(r.answer)}
        ${r.impostor ? bi(` Not ${p.name}.`, " 不是本人。") : r.note_en ? ` ${bi(r.note_en, r.note_zh)}` : ""}</p></li>`;
    }).join("")}</ul>`;
  }

  function gameOver() {
    S.over = true;
    loop.stop();
    coachOff(); S.next = null;   // 11/27: as in endShift
    if (centerRO) { centerRO.disconnect(); centerRO = null; }
    putBack(false);
    if (S.wall) S.wall();   // 11/26 (front-end review K43): as in endShift
    st.$rs.classList.remove("is-paused");
    st.scene("ah_night", 0.2);
    const items = S.losses.map((r) => `<li>${bi((r.damage || {}).hit_en || "", (r.damage || {}).hit_zh || "")}</li>`).join("");
    CB.over(st, { time: clockAt(S.clock), title_en: "Three times tonight, access went where it shouldn't.", title_zh: "今晚有三次，權限給到了不該給的地方。",
      items, text_en: "The Help Desk is closed for tonight. Try again: read the reason, stamp only what the job needs, and call back anyone you can't see.",
      text_zh: "今晚的服務台就到這裡。再試一次：先看理由，只蓋工作需要的章，看不到本人就回撥。",
      pic: `<div class="ah-leak"><p class="ah-leak-top">${bi("A criminal forum · Monday 09:12", "犯罪論壇・週一 09:12")}</p>
        <h3>${bi("Lakeside Resort · fresh access", "湖畔渡假村・剛到手的權限")}</h3><ul>${S.losses.map((r) => `<li>${bi((r.damage || {}).listing || "", (r.damage || {}).listing_zh || "")}</li>`).join("")}<li>${bi("1,240 guests: phones and emails", "1,240 位客人的電話和 Email")}</li></ul>
        <p class="ah-leak-price">2.5 BTC</p></div>`,
      again: () => Games.access(d, main, true) });
    G.meter(`<div class="rx-hud"><div class="rx-hud-pts"><b>${S.points.toLocaleString("en-US")}</b><span>${bi("points", "分")}</span></div></div>`);
    setNow(() => ({ title_en: "The night is lost", title_zh: "今晚輸了", ctx: { screen: "end" }, steps: [
      { en: "Three times tonight the crew got in or Restricted data went too far. The list says what each one let them do.", zh: "今晚有三次讓歹徒拿到權限，或限閱資料給太多。清單上寫著每一次讓他們做了什麼。" },
      { en: "Press Try the shift again. Read what each person needs it for, stamp only that, and check anyone you can't see on the HR directory number.", zh: "按「重新值班」再來一次。先看每個人要拿來做什麼，只蓋那個需要的章，看不到本人的就撥人資電話簿的號碼確認。" }] }));
  }

  /* ------------------------------------------------------------------ the case board at the wall chart */
  const logRows = BOARD.log.rows.map((r, k) => Object.assign({ k }, r));
  const crewRows = () => logRows.filter((r) => r.ip === BOARD.crew.ip);
  const cellKey = (c) => `${c.role}|${c.data}`;
  const cells = {};
  for (const c of d.table) cells[cellKey(c)] = c;
  const overCells = () => d.table.filter((c) => rank(c.set) > rank(c.policy));

  function startBoard() {
    loop.stop();
    B = { q: 0, wrong: QS.map(() => 0), solved: QS.map(() => false), pts: 0, strings: [], logSel: new Set(), cellSel: new Set(), fix: {}, flipped: false, drilled: false };
    CB.board(st, { scene: BOARD.scene, dusk: 0.18, analyst: BOARD.analyst, intro_en: BOARD.intro_en, intro_zh: BOARD.intro_zh, cls: "ah-board", cork: corkHTML() });
    $("#ahLogRows").addEventListener("click", (ev) => {
      const b = ev.target.closest(".cb-log-row");
      if (!b || (ev.detail && B.painted && performance.now() - B.painted < 600)) return;
      logClick(+b.dataset.k);
    });
    $("#ahIam").addEventListener("click", (ev) => { const b = ev.target.closest(".ah-cell"); if (b) cellClick(b.dataset.c); });
    $("#ahPolicy").addEventListener("click", (ev) => { if (ev.target.closest("[data-act]")) flipPolicy(); });
    boardHands();
    boardHud();
    renderQs();
  }

  /* Hands on the board. Question 1: press the highlighter on a line and sweep it over the others (sweeping a marked line
     wipes it). Question 2: peel a red sticker off the sheet and stick it on a cell; click a cell to peel it off again.
     Question 3: drag a rubber stamp onto a red cell to set its level, then slide to replay tonight. Clicking and Enter
     still work everywhere. */
  function boardHands() {
    const rows = $("#ahLogRows");
    let paint = null;
    rows.addEventListener("pointerdown", (ev) => {
      const q = QS[B.q], b = ev.target.closest(".cb-log-row");
      if (!b || ev.button !== 0 || !q || B.solved[B.q] || q.kind !== "log") return;
      ev.preventDefault();
      paint = { on: !B.logSel.has(+b.dataset.k), seen: new Set() };
      CB.cap(rows, ev.pointerId);
      rows.classList.add("is-painting");
      paintRow(b);
    });
    rows.addEventListener("pointermove", (ev) => {
      if (!paint) return;
      const hit = document.elementFromPoint(ev.clientX, ev.clientY), b = hit && hit.closest(".cb-log-row");
      if (b && rows.contains(b)) paintRow(b);
    });
    const end = () => { if (!paint) return; paint = null; B.painted = performance.now(); rows.classList.remove("is-painting"); renderQs(); };
    rows.addEventListener("pointerup", end);
    rows.addEventListener("pointercancel", end);
    function paintRow(b) {
      const k = +b.dataset.k;
      if (paint.seen.has(k)) return;
      paint.seen.add(k);
      if (B.logSel.has(k) === paint.on) return;
      setMark(k, paint.on);
      CB.SFX.play(paint.on ? "swipe" : "paper");
    }
    $("#cbQs").addEventListener("pointerdown", (ev) => {
      const q = QS[B.q];
      if (!ev.target.closest("#ahSheet") || ev.button !== 0 || !q || B.solved[B.q] || q.kind !== "cells") return;
      dragTo(ev, "is-sticker", "<b>!</b>", (key) => {
        if (B.cellSel.has(key)) return;
        cellClick(key);
        stuck(key, "is-stuck");
        CB.SFX.play("pin");
      });
    });
    $("#cbQs").addEventListener("pointerdown", (ev) => {
      const s = ev.target.closest(".ah-rstamp"), q = QS[B.q];
      if (!s || ev.button !== 0 || !q || B.solved[B.q] || q.kind !== "drill" || B.running) return;
      const lv = s.dataset.lv;
      s.classList.add("is-lifted");
      dragTo(ev, `is-stamp is-${lv}`, rstampFace(lv), (key) => setFix(key, lv), () => s.classList.remove("is-lifted"));
    });
  }

  // something in your hand that lands on a cell of tonight's table
  function dragTo(ev, cls, html, onDrop, onEnd) {
    ev.preventDefault();
    const g = el("div", `ah-ghost ${cls}`, html);
    g.setAttribute("aria-hidden", "true");
    document.body.appendChild(g);
    $("#cbCork").classList.add("is-holding");
    let over = null;
    const at = (x, y) => {
      g.style.left = `${x}px`; g.style.top = `${y}px`;
      const hit = document.elementFromPoint(x, y), c = hit && hit.closest("#ahIam .ah-cell");
      if (over !== c) { if (over) over.classList.remove("is-drop"); over = c; if (over) over.classList.add("is-drop"); }
    };
    const move = (e) => at(e.clientX, e.clientY);
    const up = () => {
      document.removeEventListener("pointermove", move);
      document.removeEventListener("pointerup", up);
      document.removeEventListener("pointercancel", up);
      g.remove();
      $("#cbCork").classList.remove("is-holding");
      if (onEnd) onEnd();
      if (over) { over.classList.remove("is-drop"); onDrop(over.dataset.c); }
    };
    document.addEventListener("pointermove", move);
    document.addEventListener("pointerup", up);
    document.addEventListener("pointercancel", up);
    at(ev.clientX, ev.clientY);
    CB.SFX.play("tap");
  }
  function stuck(key, cls) {
    const c = $(`#ahIam .ah-cell[data-c="${key}"]`);
    if (!c || reduceMotion) return;
    c.classList.add(cls);
    setTimeout(() => c.classList.remove(cls), 650);
  }
  function setMark(k, on) {
    if (on) B.logSel.add(k); else B.logSel.delete(k);
    const b = $(`.cb-log-row[data-k="${k}"]`);
    b.classList.toggle("is-marked", on); b.setAttribute("aria-pressed", String(on));
  }
  function setFix(key, lv) {
    const c = cells[key];
    if (!c || !(rank(c.set) > rank(c.policy))) { CB.cbSay(bi("That cell isn't one of the two the crew used.", "這格不是歹徒用到的那兩格。"), "is-no"); return; }
    B.fix[key] = lv;
    $("#ahIam").innerHTML = tableHTML("set");
    stuck(key, "is-inked");
    CB.SFX.play("stamp");
    renderQs();
    requestAnimationFrame(() => CB.drawStrings(B.strings));
  }

  function boardHud(pop) {
    G.meter(`<div class="rx-hud"><div class="rx-hud-clock"><b>${esc(BOARD.time)}</b><span>${bi("Help Desk", "服務台")}</span></div>
      <div class="rx-hud-pts"><b id="hudPts">${((S ? S.points : 0) + B.pts).toLocaleString("en-US")}</b><span>${bi("points", "分")}</span></div>
      <div class="rx-hud-qs"><b>${B.solved.filter(Boolean).length}/${QS.length}</b><span>${bi("solved", "破案")}</span></div></div>`);
    if (pop) { const n = el("span", "rx-pop", "+" + pop); $("#hudPts").parentElement.appendChild(n); setTimeout(() => n.remove(), 1200); }
  }

  function corkHTML() {
    const acc = BOARD.accounts;
    const accCards = Object.entries(acc).map(([id, a], i) => `<div class="ah-acct" id="ahAcct${i}" data-acct="${esc(id)}" style="--r:${i ? 1.2 : -1.4}deg"><i class="cb-pin" aria-hidden="true"></i>
      <p class="ah-acct-id">${esc(id)}</p><p class="ah-acct-role">${bi(nm(a.role).name_en, nm(a.role).name_zh)}</p>
      <p class="ah-acct-d">${bi(a.en, a.zh)}</p><p class="ah-acct-when">${bi(`phished ${a.phished}`, `${a.phished} 被騙`)}</p></div>`).join("");
    return `<div class="ah-cork-l">
        <div class="ah-top">${accCards}<div class="cb-notes ah-notes" id="cbNotes">${notesHTML()}</div></div>
        <div class="cb-doc cb-log ah-log is-pinned" id="ahLog"><i class="cb-pin" aria-hidden="true"></i><i class="cb-pin is-r" aria-hidden="true"></i>
          <span class="ah-hl" aria-hidden="true">${HL}</span>
          <p class="cb-doc-title">${bi(BOARD.log.title_en, BOARD.log.title_zh)}</p>
          <ol class="cb-log-rows" id="ahLogRows">${logRows.map(logRowHTML).join("")}</ol></div>
      </div>
      <div class="ah-cork-r">
        <div class="cb-crew is-known ah-crew" id="cbCrew"><i class="cb-pin" aria-hidden="true"></i>
          <svg class="cb-crew-face" viewBox="0 0 60 60" aria-hidden="true"><rect width="60" height="60" rx="4" fill="#2b2421"/><circle cx="30" cy="24" r="11" fill="#5b4f49"/><path d="M10 60c2-14 10-21 20-21s18 7 20 21z" fill="#5b4f49"/>
            <text x="30" y="29" text-anchor="middle" font-size="15" font-weight="700" fill="#d8bd77" font-family="Bahnschrift, Segoe UI, sans-serif">?</text></svg>
          <p class="cb-crew-name">${bi("The crew", "同一夥人")}</p>
          <ul class="cb-crew-facts" id="cbCrewFacts">${BOARD.crew.facts.map((f) => `<li>${bi(f.en, f.zh)}</li>`).join("")}</ul></div>
        ${policyHTML()}
        <div id="ahNightSlot"></div>
        <div class="cb-doc ah-iam" id="ahIamDoc"><i class="cb-pin" aria-hidden="true"></i>
          <p class="cb-doc-title">${bi(BOARD.table.title_en, BOARD.table.title_zh)}</p><div id="ahIam">${tableHTML("set")}</div></div>
      </div>`;
  }
  // the highlighter lying on the log, and the small rubber stamps on the table for the drill
  const HL = `<svg viewBox="0 0 92 26"><rect x="16" y="4" width="58" height="18" rx="5" fill="#f2cf1d"/><rect x="16" y="4" width="58" height="7" rx="4" fill="#fff4a8" opacity=".6"/>
    <rect x="30" y="10" width="26" height="6" rx="2" fill="#fffbe0" opacity=".8"/><path d="M74 6h8l6 7-6 7h-8z" fill="#3a3630"/><path d="M4 9l12-4v16L4 17z" fill="#d9b400"/><path d="M1 11.5l3-2.5v8l-3-2.5z" fill="#f7e36a"/></svg>`;
  function rstampFace(lv) { return `<i class="ah-rstamp-knob"></i><b class="ah-rstamp-face">${STAMP[lv][0]}<small>${STAMP[lv][1]}</small></b>`; }

  function logRowHTML(r) {
    const a = BOARD.accounts[r.acct];
    return `<li><button type="button" class="cb-log-row ah-log-row" data-k="${r.k}" aria-pressed="false">
      <time>${esc(r.t)}</time><span class="ah-log-acct">${esc(r.acct)}</span><span class="cb-log-site ah-log-ip">${esc(r.ip)}<small>${bi(r.src_en, r.src_zh)}</small></span>
      <span class="cb-log-what">${bi(r.en, r.zh)}${r.n > 1 ? ` <b class="ah-n">${r.n.toLocaleString("en-US")}</b>` : ""}</span>
      <span class="ah-drill" aria-live="polite"></span></button></li>`;
  }

  // the table's cells say "None" instead of "No access" so every cell keeps to two short lines
  const cellLabel = (lv) => (lv === "none" ? bi("None", "不給") : bi(CB.LV[lv].en, CB.LV[lv].zh));
  function tableHTML(mode) {   // mode "set": tonight's configuration (with your fixes in the drill); "policy": the knowledge graph
    const tb = BOARD.table;
    const head = `<div class="ah-grid" style="grid-template-columns:96px repeat(${tb.data.length},minmax(0,1fr))"><span class="ah-g-corner"></span>
      ${tb.data.map((dk) => `<span class="ah-g-col">${esc(nm(dk).name_en)}<small lang="zh-Hant">${esc(nm(dk).name_zh)}</small></span>`).join("")}`;
    const body = tb.roles.map((rk) => `<span class="ah-g-row">${esc(nm(rk).name_en)}<small lang="zh-Hant">${esc(nm(rk).name_zh)}</small></span>${tb.data.map((dk) => {
      const c = cells[`${rk}|${dk}`];
      const lv = mode === "policy" ? c.policy : (B && B.fix[cellKey(c)]) || c.set;
      if (mode === "policy") return `<span class="ah-cell is-static lv lv-${lv}">${CB.lvIcon(lv)}<span class="lv-t">${cellLabel(lv)}</span></span>`;
      const k = cellKey(c), sel = B && B.cellSel.has(k), fixable = B && B.solved[1] && rank(c.set) > rank(c.policy);
      return `<button type="button" class="ah-cell lv lv-${lv}${sel ? " is-sel" : ""}${fixable ? " is-fix" : ""}${B && B.solved[2] && fixable ? " is-fixed" : ""}" data-c="${esc(k)}" aria-pressed="${sel}">
        ${CB.lvIcon(lv)}<span class="lv-t">${cellLabel(lv)}</span>${fixable ? `<i class="cb-pin ah-cell-pin" aria-hidden="true"></i>` : ""}</button>`;
    }).join("")}`).join("");
    return head + body + `</div>`;
  }

  function policyHTML() {
    return `<div class="cb-card ah-policy" id="ahPolicy" style="--r:.8deg"><div class="cb-card-in">
      <div class="cb-face cb-front"><i class="cb-pin" aria-hidden="true"></i>
        <p class="ah-pol-k">${bi("Policy", "政策")}</p><p class="ah-pol-t">Who May Use What<span lang="zh-Hant">誰能用什麼</span></p>
        <p class="ah-pol-d">${bi("The access the knowledge graph gives each role (CAN_ACCESS).", "知識圖裡每個職務能存取什麼（CAN_ACCESS）。")}</p>
        <div class="cb-btns"><button type="button" data-act="flip">${bi("Look at the policy", "看政策")}</button></div></div>
      <div class="cb-face cb-back" inert><i class="cb-pin" aria-hidden="true"></i><div class="ah-pol-grid">${tableHTML("policy")}</div>
        <button type="button" class="cb-flip" data-act="flip">${bi("Fold it up", "收起來")}</button></div></div></div>`;
  }

  function flipPolicy() {
    // 11/26 (front-end review K42): as phish.js flip(): the face turned away is inert (Tab skips its button), and a button
    // that had the keyboard hands it to the other face. "had" is read before inert blurs it.
    const card = $("#ahPolicy"), a = document.activeElement, had = a !== card && card.contains(a);
    B.flipped = !card.classList.contains("is-flipped");
    card.classList.toggle("is-flipped", B.flipped);
    $(".cb-front", card).toggleAttribute("inert", B.flipped);
    $(".cb-back", card).toggleAttribute("inert", !B.flipped);
    if (had) $(`${B.flipped ? ".cb-back" : ".cb-front"} [data-act="flip"]`, card).focus({ preventScroll: true });
    setTimeout(() => CB.drawStrings(B.strings), reduceMotion ? 0 : 650);
  }

  function notesHTML() {
    if (!S || !S.notes.length) return `<div class="cb-note is-empty">${bi("No call-back notes from tonight.", "今晚沒有回撥紀錄。")}</div>`;
    return S.notes.map((n, k) => `<div class="cb-note${n.fake ? " is-fake" : ""}" style="--r:${[1.8, -2.2, 1.2, -1.4][k % 4]}deg">
      <span class="cb-note-who">${CB.ICON.phone}${esc(n.who)}</span><span class="cb-note-said">“${esc(n.en)}”</span><span class="cb-note-zh" lang="zh-Hant">${esc(n.zh)}</span></div>`).join("");
  }

  /* the question cards */
  function renderQs() {
    CB.questions(QS, B, controls);
    setNow(boardNow);   // 11/27: CB's help for the open question, plus where to look on this one
    const q = QS[B.q];
    $("#cbCork").classList.toggle("is-picking", !!q && !B.solved[B.q] && q.kind === "log");
    $("#cbCork").classList.toggle("is-cells", !!q && !B.solved[B.q] && q.kind === "cells");
    $("#cbCork").classList.toggle("is-drill", !!q && !B.solved[B.q] && q.kind === "drill");
    const go = $("#cbGo");
    if (go) go.addEventListener("click", () => (q.kind === "log" ? checkLog(q) : checkCells(q)));
    const sl = $('#cbQs .mn-slide[data-slide="drill"]');
    if (sl) {
      CB.slideCtl(sl, () => drill(q));
      // 11/27: let go before the end and the knob springs back; it used to do that without a word
      const knob = $(".mn-slide-knob", sl);
      let pressed = false;
      knob.addEventListener("pointerdown", (ev) => { pressed = ev.button === 0; });
      knob.addEventListener("pointerup", () => {
        if (!pressed) return;
        pressed = false;
        if (B && !B.running && sl.isConnected && !sl.classList.contains("is-done")) CB.cbSay(bi("Slide the knob all the way to the right.", "要把滑塊一路滑到最右邊。"));
      });
    }
  }

  /* 11/27: the Help panel on the board is CB's (the question, how to answer, what a wrong try costs), with one more line on
     where to look for this question: the IP address on each line, the policy card and the stickers, the slider. */
  function boardNow() {
    const n = CB.boardNow(QS, B), q = QS[B.q];
    const tip = !q || B.solved[B.q] ? null
      : q.kind === "log" ? { en: "Each line says where it came from: a device and its IP address. The crew card at the top right has the crew's address.", zh: "每一行都寫了從哪裡來：哪台裝置、哪個 IP 位址。右上角「同一夥人」的卡片上有歹徒的位址。" }
      : q.kind === "cells" ? { en: "To flip the policy card, press Look at the policy on it. Clicking a cell also puts a sticker on it; click it again to take it off.", zh: "要翻政策卡，就按卡上的「看政策」。直接點格子也能貼上貼紙，再點一次就撕掉。" }
      : q.kind === "drill" ? { en: "Slide the knob all the way to the right. Let go early and it springs back.", zh: "滑塊要一路滑到最右邊，太早放手會彈回去。" } : null;
    if (tip && n && n.steps) n.steps.splice(Math.min(2, n.steps.length), 0, tip);
    return n;
  }

  // 11/27: a wrong try on the board goes into the Help panel too; Jun-Hao has already said why on the spot
  function boardMiss(said, how) {
    noteMistake({ at: "", title_en: `Question ${B.q + 1}: not right yet`, title_zh: `第 ${B.q + 1} 題還沒答對`, why: [said, how],
      ctx: { screen: "board", q: B.q, tries: B.wrong[B.q] || 0, solved: false } });
  }

  function controls(q) {
    if (q.kind === "log") return `<p class="cb-q-sel">${B.logSel.size ? bi(`${B.logSel.size} line${B.logSel.size > 1 ? "s" : ""} marked`, `標了 ${B.logSel.size} 行`) : bi("No lines marked yet.", "還沒標任何一行。")}</p>
      <button type="button" class="btn cb-go" id="cbGo"${B.logSel.size ? "" : " disabled"}>${bi("These are the crew", "這些是歹徒")}</button>`;
    if (q.kind === "cells") return `<div class="ah-sheet" id="ahSheet" aria-hidden="true"><span class="ah-sheet-t">TOO MUCH<small>給太多</small></span><i></i><i></i><i></i><i></i></div>
      <p class="cb-q-sel">${B.cellSel.size ? [...B.cellSel].map((k) => { const [a, b] = k.split("|"); return `<span class="g-pill">${bi(`${nm(a).name_en} × ${nm(b).name_en}`, `${nm(a).name_zh} × ${nm(b).name_zh}`)}</span>`; }).join(" ") : bi("No cells picked yet.", "還沒選格子。")}</p>
      <button type="button" class="btn cb-go" id="cbGo"${B.cellSel.size ? "" : " disabled"}>${bi("These gave too much", "就是這幾格給太多")}</button>`;
    if (q.kind === "drill") return `<div class="ah-rack" id="ahRack" aria-hidden="true">${ORDER.map((lv) => `<span class="ah-rstamp is-${lv}" data-lv="${lv}">${rstampFace(lv)}</span>`).join("")}</div>
      <p class="cb-q-sel">${overCells().map((c) => { const L = CB.LV[B.fix[cellKey(c)] || c.set]; return `<span class="g-pill">${bi(`${nm(c.role).name_en} × ${nm(c.data).name_en}: ${L.en}`, `${nm(c.role).name_zh} × ${nm(c.data).name_zh}：${L.zh}`)}</span>`; }).join(" ")}</p>
      ${CB.slideHTML("drill", bi("Slide to replay tonight", "滑過去，重跑今晚"), "Replay tonight with the fixed table")}`;
    return "";
  }

  function logClick(k) {
    const q = QS[B.q];
    if (!q || B.solved[B.q] || q.kind !== "log") return;
    setMark(k, !B.logSel.has(k));
    CB.SFX.play(B.logSel.has(k) ? "swipe" : "paper");
    renderQs();
  }

  function cellClick(key) {
    const q = QS[B.q];
    if (!q || B.solved[B.q]) return;
    if (q.kind === "cells") {
      if (B.cellSel.has(key)) B.cellSel.delete(key); else B.cellSel.add(key);
      $("#ahIam").innerHTML = tableHTML("set");
      renderQs();
      return;
    }
    if (q.kind === "drill") {
      if (B.running) return;
      const c = cells[key];
      if (!(rank(c.set) > rank(c.policy))) { CB.cbSay(bi("That cell isn't one of the two the crew used.", "這格不是歹徒用到的那兩格。"), "is-no"); return; }
      const cur = B.fix[key] || c.set;
      setFix(key, ORDER[(rank(cur) + 1) % ORDER.length]);
    }
  }

  function checkLog(q) {
    const crew = new Set(crewRows().map((r) => r.k));
    const bad = [...B.logSel].filter((k) => !crew.has(k)), miss = [...crew].filter((k) => !B.logSel.has(k));
    if (!bad.length && !miss.length) return solve(q);
    CB.nope(B);
    const r = bad.length ? logRows[bad[0]] : null;
    const m = r ? (/desk/i.test(r.src_en) ? { en: q.inside_desk_en, zh: q.inside_desk_zh } : { en: q.inside_en, zh: q.inside_zh }) : { en: q.missing_en, zh: q.missing_zh };
    CB.cbSay(bi(m.en, m.zh), "is-no");
    boardMiss(m, { en: "Each line says where it came from: a device and its IP address. The crew card at the top right has the crew's address.", zh: "每一行都寫了從哪裡來：哪台裝置、哪個 IP 位址。右上角「同一夥人」的卡片上有歹徒的位址。" });
  }

  function checkCells(q) {
    const over = new Set(overCells().map(cellKey)), sel = [...B.cellSel];
    const bad = sel.filter((k) => !over.has(k)), miss = [...over].filter((k) => !B.cellSel.has(k));
    if (!bad.length && !miss.length) return solve(q);
    CB.nope(B);
    const c = bad.length ? cells[bad[0]] : null;
    const m = c ? (rank(c.set) < rank(c.policy) ? { en: q.little_en, zh: q.little_zh } : { en: q.same_en, zh: q.same_zh }) : { en: q.missing_en, zh: q.missing_zh };
    CB.cbSay(bi(m.en, m.zh), "is-no");
    boardMiss(m, { en: "Flip the policy card and compare each cell of tonight's table with the policy above it. Too much means more than the policy gives.", zh: "把政策卡翻過來，拿今晚權限表的每一格跟上面的政策比。給太多，就是比政策給的還多。" });
  }

  /* The drill: the same log replayed against the fixed table. A crew line that still gets data is a leak; a staff line
     that no longer works is a table that is now too tight. */
  function allowed(row) {
    if (!row.data || !row.used) return null;
    const role = BOARD.accounts[row.acct].role, c = cells[`${role}|${row.data}`];
    if (!c) return true;                                  // data not on this table: unchanged tonight
    const lv = B.fix[cellKey(c)] || c.set;
    return rank(lv) >= rank(row.used);
  }

  async function drill(q) {
    const fixes = overCells().map((c) => ({ c, lv: B.fix[cellKey(c)] || c.set }));
    const tooOpen = fixes.find((x) => rank(x.lv) > rank(x.c.policy)), tooTight = fixes.find((x) => rank(x.lv) < rank(x.c.policy));
    B.running = true;
    $("#cbCork").classList.add("is-replay");
    for (const row of logRows) {
      const b = $(`.cb-log-row[data-k="${row.k}"] .ah-drill`), ok = allowed(row), crew = row.ip === BOARD.crew.ip;
      b.className = "ah-drill";
      if (ok === null) b.innerHTML = `<span class="is-signin">${bi("signs in", "登入")}</span>`;
      else if (crew) b.innerHTML = ok ? `<span class="is-leak">${bi("still leaks", "還是外洩")}</span>` : `<span class="is-block">${bi("blocked", "擋下")}</span>`;
      else b.innerHTML = ok ? `<span class="is-work">${bi("still works", "照常運作")}</span>` : `<span class="is-broken">${bi("breaks work", "工作做不了")}</span>`;
      if (!reduceMotion) { b.classList.add("is-in"); await wait(180); }
    }
    B.running = false;
    $("#cbCork").classList.remove("is-replay");
    if (!tooOpen && !tooTight) return solve(q);
    // 11/26 (front-end review K46): re-render first, then shake the new card (the shaken one was replaced at once before)
    renderQs();
    CB.nope(B);
    const m = tooTight ? { en: q.little_en, zh: q.little_zh } : { en: q.open_en, zh: q.open_zh };
    CB.cbSay(bi(m.en, m.zh), "is-no");
    boardMiss(m, { en: "Each red cell should give that job what the policy card gives it, no more and no less.", zh: "每個紅框格子要給到政策卡上那個職務的權限，不多也不少。" });
  }

  function solve(q) {
    const i = B.q;
    B.solved[i] = true;
    const pts = CB.qPoints(B, i);
    B.pts += pts;
    CB.solvedFx();
    if (q.kind === "log") {
      for (const r of crewRows()) $(`.cb-log-row[data-k="${r.k}"]`).classList.add("is-ok");
      B.strings.push(["#ahAcct0 .cb-pin", "#cbCrew .cb-pin", true], ["#ahAcct1 .cb-pin", "#cbCrew .cb-pin", true]);
      addFact(bi("bar-02 and k.wu from 203.0.113.45", "從 203.0.113.45 用 bar-02 和 k.wu"));
    } else if (q.kind === "cells") {
      B.cellSel.clear();
      $("#ahIam").innerHTML = tableHTML("set");
      for (const c of overCells()) {
        const acct = Object.keys(BOARD.accounts).findIndex((a) => BOARD.accounts[a].role === c.role);
        if (acct >= 0) B.strings.push([`#ahAcct${acct} .cb-pin`, `.ah-cell[data-c="${cellKey(c)}"] .cb-pin`, true]);
      }
      addFact(bi("Two cells gave too much", "兩格權限給太多"));
    } else if (q.kind === "drill") {
      B.drilled = true;
      $("#ahIam").innerHTML = tableHTML("set");
      addFact(bi("Fixed: 0 guest lists, 0 staff files", "改好後：0 份客人名單、0 筆員工資料"));
      $("#ahPolicy").classList.add("is-away");
      $("#ahNightSlot").innerHTML = nightHTML();
      B.strings.push(["#ahLog .cb-pin", "#ahNight .cb-pin", true]);
    }
    boardHud(pts);
    CB.cbSay(bi(q.solved_en, q.solved_zh), "is-good");
    B.q = i + 1;
    renderQs();
    requestAnimationFrame(() => CB.drawStrings(B.strings));
    if (B.solved.every(Boolean)) CB.addClose(wrapUp);
  }

  function addFact(html) {
    $("#cbCrewFacts").insertAdjacentHTML("beforeend", `<li class="is-new">${html}</li>`);
  }

  function nightHTML() {
    return `<div class="cb-doc ah-night is-pinned" id="ahNight"><i class="cb-pin" aria-hidden="true"></i>
      <p class="cb-doc-title">${bi("What the crew copied at 18:49: tonight's night shift", "歹徒 18:49 抄走的：今晚的夜班名單")}</p>
      <ul class="ah-night-list">${BOARD.night.map((n) => `<li><b>${esc(n.name)} <span lang="zh-Hant">${esc(n.name_zh)}</span></b><i>${bi(n.role_en, n.role_zh)}</i><span>${bi(n.en, n.zh)}</span></li>`).join("")}</ul></div>`;
  }

  /* ------------------------------------------------------------------ case closed, then the results */
  function wrapUp() {
    CB.cbSay(bi("That's the Help Desk side closed. Get some sleep, partner, and keep your phone close.", "服務台這邊結案了。去睡一下吧，搭檔，手機放身邊。"), "is-good");
    CB.closed(st, { wrap_en: BOARD.wrap_en, wrap_zh: BOARD.wrap_zh, cases: d.cases, why: BOARD.case_why,
      body: `<div class="ah-closed-drill"><div><b>1,240 → 0</b><span>${bi("guest phones and emails the crew could export (name and room stay masked)", "歹徒匯得出去的客人電話和 Email（姓名、房號只剩遮罩）")}</span></div>
          <div><b>38 → 0</b><span>${bi("staff records the crew could read", "歹徒讀得到的員工資料")}</span></div>
          <div><b>✓</b><span>${bi("the bar still posts room charges", "酒吧照樣能記房帳")}</span></div></div>
        <h3 class="cb-cases-title">${bi("On the night-shift list the crew copied", "歹徒抄走的夜班名單上")}</h3>
        <ul class="cb-accounts is-wide">${BOARD.night.map((n) => `<li><b>${esc(n.name)} · ${esc(n.role_en)} <i lang="zh-Hant">${esc(n.name_zh)}・${esc(n.role_zh)}</i></b>${bi(n.en, n.zh)}</li>`).join("")}</ul>
        <p class="cb-proc">${bi("The SOC is still going through what else Kevin's account changed tonight.", "資安監控中心還在查凱文的帳號今晚還改了什麼。")}</p>`,
      onResults: finale });
    setNow(() => ({ title_en: "Case closed", title_zh: "結案", ctx: { screen: "closed" }, steps: [
      { en: "Read what the fixed table took away from the crew, and the real cases on the right.", zh: "看看權限表改好之後，歹徒少拿到什麼，還有右邊的真實案例。" },
      { en: "Press See my results.", zh: "按「看結果」。" }] }));
  }

  function finale() {
    const stampsOk = rightCount(), firstTry = B.wrong.filter((w, i) => B.solved[i] && w === 0).length;
    const score = stampsOk + firstTry;
    const wrong = d.requests.filter((r) => !isRight(r));
    CB.finale(st, { file: 2, ranks: story.ranks, score, total: TOTAL, scene: BOARD.scene, dusk: 0.35,
      stats: [{ v: (S.points + B.pts).toLocaleString("en-US"), en: "points", zh: "分" }, { v: `${stampsOk}/${d.requests.length}`, en: "stamps right", zh: "章蓋對的" },
        { v: `${caughtCount()}/${impostors()}`, en: "impostors refused", zh: "擋下假冒的人" }, { v: `${S.shields}/${sh.shields}`, en: "shields left", zh: "剩下的盾牌" },
        { v: `${S.notes.length}`, en: "call-backs", zh: "回撥" }, { v: `${firstTry}/${QS.length}`, en: "solved first try", zh: "一次就解開" }],
      body: (S.losses.length ? `<ul class="rx-loss-list">${S.losses.map((r) => `<li>${bi((r.damage || {}).hit_en || "", (r.damage || {}).hit_zh || "")}</li>`).join("")}</ul>` : "")
        + (wrong.length ? `<h2>${bi("The forms to look at again", "再看一次這幾張")}</h2>${wrongList(wrong)}` : ""),
      next: { key: BOARD.next, en: BOARD.next_en, zh: BOARD.next_zh }, again: () => Games.access(d, main, true) });
    setNow(() => ({ title_en: "Your results", title_zh: "你的結果", ctx: { screen: "end" }, steps: [
      { en: `Case score: ${score} of ${TOTAL}. One point for each right stamp and for each question solved on the first try.`, zh: `本案分數 ${score}/${TOTAL}：每張蓋對的單子、每題一次就解開，各得一分。` },
      wrong.length ? { en: "The forms to look at again are listed with the stamp each one needed.", zh: "下面列出要再看一次的單子，和每張應該蓋的章。" } : null,
      { en: "Press Play again to take the shift again, or open the next case file.", zh: "按「再玩一次」重新值班，或打開下一個案件。" }].filter(Boolean) }));
    B = null;
  }

  if (replay) startShift();
  else {
    // 11/27: the title card, as the Help panel tells it
    setNow(() => ({ title_en: "Before you start", title_zh: "開始之前", ctx: { screen: "title" }, steps: [
      { en: "Press Open the case file to read your briefing.", zh: "按「打開這個案件」，看任務說明。" },
      { en: "Tonight you take the access requests at the IT Help Desk and stamp each one with only what the job needs.", zh: "今晚你在資訊服務台處理權限申請，每張單子只蓋工作需要的章。" }] }));
    CB.title(st, { file: 2, scene: "ah_desk", title_en: "Who May Use What?", title_zh: "誰能用什麼", time: story.start,
      place_en: (story.title || {}).place_en, place_zh: (story.title || {}).place_zh, hook_en: (story.title || {}).hook_en, hook_zh: (story.title || {}).hook_zh, onGo: brief });
  }
};
