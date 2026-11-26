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
   lost-badge procedure and the real cases. Shared helpers: casebook.js.
   11/27: Help 求助 (common.js G.help): what to do on each screen, why each wrong move was wrong (on the spot and in the
   panel), and a first-time guide with a note the first time each new thing comes up (CB.coach). */
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
  const READER = DOORS.find((x) => x.box === "reader") || {};     // the door alert at the badge reader (Kevin's lost badge)

  /* 11/27 (the user: 「都沒說得夠清楚該怎麼玩，並且錯了也不能問小幫手」): why a move was wrong, built from the game data only:
     the knowledge graph's procedure (its steps and don'ts), the MFA fatigue threat, the briefing's rules and the reasons
     games.yaml gives for each option. {en, zh} lines, for st.cut, G.help.mistake and the notes on the stage. */
  const ln = (en, zh) => (en ? { en, zh: zh || "" } : null);
  const reasons = (...a) => a.filter((x) => x && x.en);
  const joinEn = (a) => a.map((x) => x.en).join(" "), joinZh = (a) => a.map((x) => x.zh).join("");
  const stepOf = (proc, phase, who) => { const s = ((proc || {}).steps || []).find((x) => x.phase === phase && (!who || x.who === who)); return s ? ln(s.text_en, s.text_zh) : null; };
  const dontOf = (proc, i) => ln(((proc || {}).dont_en || [])[i], ((proc || {}).dont_zh || [])[i]);
  const ruleOf = (icon) => { const r = (story.rules || []).find((x) => x.icon === icon); return r ? ln(r.en, r.zh) : null; };
  const nodeOf = (k) => { const n = (d.nodes || {})[k]; return n ? ln(n.desc_en, n.desc_zh) : null; };
  const whyOf = (o) => (o ? ln(o.why_en, o.why_zh) : null);
  const optOf = (e, k) => ((e && e.options) || []).find((o) => o.k === k);
  const rightOf = (e) => { const g = ((e && e.options) || []).find((o) => o.good); return g ? ln(`The right move: ${g.en}.`, `該做的是：${g.zh}。`) : null; };
  const firstOf = (en, zh) => ln((/^[^.!?]*[.!?]/.exec(en || "") || [en])[0], (/^[^。！？]*[。！？]/.exec(zh || "") || [zh])[0]);     // the first sentence
  // what the IT Assistant is told (ids only, contract in common.js G.help): the event on screen and, once you acted, what you did
  const ctxOf = (item, chosen) => Object.assign({ screen: "shift" }, item ? { item } : {}, chosen ? { chosen } : {});
  const setNow = (fn) => { if (G.help) G.help.setNow(fn); };
  const oops = (m) => { if (G.help) G.help.mistake(m); };

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

  /* ------------------------------------------------------------------ 11/27: notes on the stage
     The first-time guide, and why a move went wrong: a ring around the control, a moving finger that shows the move, and
     a glass note beside it (CB.coach). One note at a time; the others wait in S.noteQ (o.when: not before; o.done: no
     longer needed). While a note is up the night's clock waits (S.note; not S.hold, which also stops the radio, the end
     of the shift and the game over). It goes when its move is made (o.done, checked every tick) or its button is pressed;
     a cut scene puts it back in the queue until the cut is over. The guide's notes (o.key) show once per page, so Play
     again and Try again skip the ones already seen. */
  const SEEN = Games.mfa.seen || (Games.mfa.seen = new Set());
  const GOT = { en: "Got it", zh: "知道了" };
  function want(o) {
    if (!S || S.over || S.ending || S.clock >= TEND) return;     // 11/27 review: from 03:25 on a note could only hold up the end
    if (o.key && (SEEN.has(o.key) || S.noteQ.some((x) => x.key === o.key))) return;
    S.noteQ.push(o);
    noteTick();
  }
  function whyNote(o) { want(Object.assign({ step_en: "Why", step_zh: "為什麼", button: GOT, gesture: "click" }, o)); }
  function noteTick() {
    if (!S || S.over) return;
    const yes = (f) => { try { return !!f(); } catch { return false; } };
    if (S.note && S.note.o.done && yes(S.note.o.done)) noteClose();
    if (S.note || S.hold || S.paused) return;
    if (S.clock >= TEND) { S.noteQ = []; return; }     // 11/27 review: 03:25, what still waits can no longer be done
    for (let i = 0; i < S.noteQ.length; i++) {
      const o = S.noteQ[i];
      if (o.done && yes(o.done)) { S.noteQ.splice(i--, 1); continue; }     // its moment has passed
      if (o.when && !yes(o.when)) continue;
      S.noteQ.splice(i, 1);
      if (o.key) SEEN.add(o.key);
      const h = { o };
      // focusAfter (11/27 review): where the keyboard goes after "Got it" when the ringed control is not the next one
      h.c = CB.coach(st, { target: o.target, to: o.to, gesture: o.gesture || "click", en: o.en, zh: o.zh, step_en: o.step_en, step_zh: o.step_zh,
        button: o.button, focusAfter: o.focusAfter, focusOk: !!o.button && !o.done, onOk: () => { if (S && S.note === h) noteClose(); } });
      S.note = h;
      return;
    }
  }
  function noteClose() {
    const h = S && S.note;
    if (!h) return;
    S.note = null;
    h.c.close();
    noteTick();     // the next one waiting
  }
  function noteSuspend() {     // a cut scene is coming: the note waits in the queue until it is over
    if (!S || !S.note) return;
    const h = S.note;
    S.note = null;
    h.c.close();
    S.noteQ.unshift(h.o);
  }
  function notesOff() {
    if (!S) return;
    S.noteQ = [];
    if (S.note) { const h = S.note; S.note = null; h.c.close(); }
  }
  /* 11/27 review: a timer in real time that must not go off while the game stands still (Pause, the Help panel, a note
     holding the clock): when it comes due then, it tries again every 250 ms until the night runs again */
  function later(fn, ms) {
    const s0 = S;
    const go = () => { if (S !== s0 || !S || S.over) return; if (S.paused || S.note) { setTimeout(go, 250); return; } fn(); };
    setTimeout(go, ms);
  }
  /* after the call in Jun-Hao's name: the Phone icon, and 2199 */
  function dialNote() {
    want({ key: "dial", target: () => $("#mnPhoneApp"), gesture: "click", step_en: "Next step", step_zh: "下一步",
      en: `Now call the real SOC yourself: press Phone, type ${NUM.soc} and press the green call button.`,
      zh: `現在自己打給真的資安監控中心：按「電話」，輸入 ${NUM.soc}，再按綠色的撥號鍵。`,
      button: GOT, when: () => !S.app, done: () => !!S.reported || !!S.soc || S.app === "dial" });
  }

  /* ------------------------------------------------------------------ 11/27: "Right now" in the Help panel, screen by screen */
  const titleNow = () => ({ title_en: "The case file", title_zh: "案件", ctx: { screen: "title" },
    steps: [ln("Press Open the case file to read your briefing.", "按「打開這個案件」看說明。")] });
  const briefNow = () => ({ title_en: "The briefing", title_zh: "值班前的說明", ctx: { screen: "brief" },
    steps: [ln("Your goal is at the top. How to play, on the right, is the whole night in four rules.", "最上面是你的任務。右邊「怎麼玩」的四條規則，就是整晚要做的事。"),
      ln(`The on-call card has the numbers you need. The SOC is ${NUM.soc}.`, `值班卡上有要用的電話，資安監控中心是 ${NUM.soc}。`),
      ln("Press Go to sleep to start. The night starts in the dark: your work phone will light up.", "按「去睡覺」開始。一開始房間是暗的，工作手機會亮起來。")],
    chips: [ln("What is MFA fatigue?", "什麼是 MFA 疲勞攻擊？")] });
  const ownChosen = () => (S.own.tries ? (S.own.last === "deny" ? "deny" : "wrong_number") : "");

  /* The night: what is on the screen this moment (the open app, then a door alert, a prompt, your own sign-in), the exact
     control and move, and what costs a shield; the IT Assistant is told which event that is, and what you did once you acted. */
  function shiftNow() {
    if (!S || S.over) return null;
    const soc = NUM.soc, app = S.app, o = S.own;
    const out = (title_en, title_zh, steps, ctx, chips) => ({ title_en, title_zh, steps: steps.filter(Boolean), ctx, chips });
    // 11/27 review: unblocking the lost badge costs a shield only when the crew then gets through with it (after they have
    // gone, Security blocks it again and it costs 40 points)
    const shield = ln(`${S.shields} of ${sh.shields} shields left. You lose one each time you approve a prompt, type the code for a caller, or let the crew through the door: unlocking it, or unblocking Kevin's lost badge so they can use it.`,
      `還剩 ${S.shields} 面盾牌（共 ${sh.shields} 面）。同意登入通知、幫來電的人按驗證碼、放歹徒進門（遠端開門，或解除凱文遺失員工證的停用讓他們刷卡），每次都會少一面。`);
    const door = S.alerts.filter((a) => !a.doomed).slice(-1)[0], pushes = S.notifs.filter((n) => n.kind === "push");
    const doorToo = door ? ln("A door alert is waiting too: hold the radio button on the laptop.", "門口也有通知在等：按住筆電上的無線電按鈕。") : null;
    const lockToo = app && pushes.length ? ln("While an app covers the phone, prompts can't be swiped. Left alone they time out, and nobody gets in.", "App 開著的時候，登入通知滑不掉。沒人理的通知時間到就消失，不會讓任何人登入。") : null;
    const callAsk = [ln("Is this really the SOC?", "這真的是資安監控中心嗎？")];
    if (S.dark) return out("In the dark", "房間還是暗的", [ln("Click anywhere or press a key to turn on the lamp.", "點一下畫面或按任意鍵，就會開燈。"),
      ln("Your work phone is about to light up.", "工作手機快要亮了。")], ctxOf());
    if (app === "call") {
      const c = S.call, back = !c || c.state === "done" || !!c.fake;
      if (c && c.state === "ringing") return out(`A call from ${CALL.number}`, "有人打來", [
        ln(`The screen says ${CALL.name_en}, but the number is ${CALL.number}. The SOC on your on-call card is ${soc}.`, `螢幕上寫${CALL.name_zh}，號碼卻是 ${CALL.number}。值班卡上的資安監控中心是 ${soc}。`),
        ln("You can press Decline, or Slide to answer to hear what he wants.", "可以按「拒接」，或「滑動接聽」聽聽他要什麼。"),
        ln("Never type or read out a code for him: that costs a shield.", "驗證碼絕對不要按給他或念給他，那會少一面盾牌。"),
        ln(`Afterwards open Phone and dial ${soc} yourself.`, `之後打開「電話」，自己撥 ${soc}。`), doorToo, lockToo], ctxOf(CALL.id), callAsk);
      return out(back ? `Calling back ${CALL.number}` : `On the phone with ${CALL.number}`, back ? "回撥那個號碼" : "通話中", [
        back ? ln("The number that rang you belongs to the caller, not to the SOC.", "打來的號碼是那個人的，不是資安監控中心的。") : null,
        whyOf(optOf(CALL, "read")),
        ln("Press End call, the red button at the bottom, to hang up. Typing the code costs a shield.", "按最下面紅色的「掛斷」。按出驗證碼會少一面盾牌。"),
        ln(`Then open Phone and dial ${soc} yourself.`, `然後打開「電話」，自己撥 ${soc}。`), doorToo, lockToo],
        ctxOf(CALL.id, back ? "call_back_caller" : ""), callAsk);
    }
    if (app === "soc") {
      const s = S.soc;
      if (!s || s.state === "dialing") return out("Calling the SOC", "正在打給資安監控中心", [ln("Wait for Jun-Hao to answer.", "等俊豪接起來。"), doorToo], ctxOf("soc"));
      if (s.state === "done") return out("Reported to the SOC", "回報完了", [ln("Jun-Hao is resetting your password and signing out every session. Press Hang up.", "俊豪正在重設你的密碼，登出所有工作階段。按「掛斷」。"), doorToo], ctxOf("soc", "report"));
      return out("On the phone with the SOC", "正在跟資安監控中心通話", [
        ln("Drag each thing you want to tell Jun-Hao up into the call. From the keyboard, press Enter on a line.", "把要跟俊豪說的話一句一句拖到上面的通話裡。用鍵盤的話，在那句話上按 Enter。"),
        ln(`Tell him what happened tonight. A line that makes things worse costs ${P.bad} points, not a shield.`, `把今晚發生的事告訴他。說了會壞事的話扣 ${P.bad} 分，不會少盾牌。`),
        ln("Press That's everything when you're done. Hanging up before you say anything reports nothing.", "說完按「就這些」。什麼都沒說就掛斷，等於沒有回報。"), doorToo, lockToo],
        ctxOf("soc"), [ln("What should I tell the SOC?", "要跟資安監控中心說什麼？")]);
    }
    if (app === "dial") return out("Phone", "電話", [
      ln(`Type ${soc} on the keypad (your keyboard works too) and press the green call button.`, `在鍵盤上輸入 ${soc}（電腦鍵盤也可以），再按綠色的撥號鍵。`),
      ln(`${soc} is the SOC on your on-call card. Calling it yourself is how you report.`, `${soc} 是值班卡上資安監控中心的號碼，自己打過去才算回報。`),
      S.fired[CALL.id] ? ln("Recent calls show the number that rang you. Calling it back reaches the caller, not the SOC.", "最近通話裡有剛剛打來的號碼，回撥只會打給那個人，不是資安監控中心。") : null,
      ln("Close puts the phone away.", "按「關閉」收起電話。"), doorToo, lockToo], S.res[CALL.id] ? ctxOf(CALL.id, S.res[CALL.id]) : ctxOf());
    if (app === "auth") return out("Your own sign-in", "你自己要登入", [
      ln("Type the number your laptop shows into this app, then press Yes. Your keyboard works too.", "把筆電上顯示的號碼輸入這個 App，再按「是我」。電腦鍵盤也可以打。"),
      ln("Later puts the app away, and the sign-in keeps waiting.", "按「稍後」可以先收起來，登入會繼續等你。"),
      ln(`A wrong number or No blocks it and costs ${P.ownWrong} points.`, `號碼打錯或按「不是我」，登入會被擋下，扣 ${P.ownWrong} 分。`), doorToo, lockToo],
      ctxOf(OWN.id, ownChosen()), [ln("What is number matching?", "什麼是號碼比對？")]);
    if (app === "line") return out("A call to another number", "打給其他號碼", [
      ln(`For the Banquet Hall door, use the radio on the laptop. To report, dial ${soc}.`, `宴會廳門口的事用筆電上的無線電，回報要撥 ${soc}。`),
      ln("Press End call to hang up.", "按「掛斷」掛掉電話。"), doorToo, lockToo], ctxOf());
    if (door) return out(door.e.alert_en, door.e.alert_zh, [
      ln("Someone is at the Banquet Hall door: look at the camera on your laptop.", "宴會廳門口有人：看筆電上的監視器。"),
      ln("Hold the round radio button (Hold to talk) for about a second, then let go. That tells Security.", "按住圓形的無線電按鈕（按住說話）大約一秒再放開，就會告訴安全室。"),
      ln("Don't use Slide to unlock or Slide to unblock: that lets the crew in and costs a shield.", "不要用「滑動開門」或「滑動解除停用」：那是放歹徒進來，會少一面盾牌。"),
      ln("Swiping the alert off your phone tells nobody.", "把手機上的通知滑掉，沒有人會知道。"),
      pushes.length ? ln("A sign-in prompt is waiting too: swipe it to the left.", "也有登入通知在等：往左滑掉。") : null],
      ctxOf(door.e.id), [ln("Why not just unlock the door?", "為什麼不能直接開門？")]);
    if (pushes.length) {
      const n = pushes[0];
      return out("A sign-in prompt you didn't start", "不是你發起的登入通知", [
        ln(`${n.e.where_en}. You didn't start it, so someone has your password.`, `${n.e.where_zh}。這不是你發起的，代表有人拿到你的密碼了。`),
        ln("Swipe the card to the left to deny it. Or click the card and press Delete.", "把卡片往左滑就是拒絕。也可以點一下卡片，再按 Delete。"),
        ln("Never use Slide to approve: approving costs a shield.", "絕對不要用「滑動同意」：同意會少一面盾牌。"),
        pushes.some((x) => x.e.trick) ? dontOf(PROC, 0) : null],
        ctxOf(n.id), [ln("Why should I deny it?", "為什麼要拒絕？")]);
    }
    if (o.state === "ready" || o.state === "prompt") return out("Your own sign-in", "你自己要登入", [
      o.state === "ready" ? ln(o.e.ask_en, o.e.ask_zh) : ln("Your sign-in is waiting: click its card on your phone to open the app again.", "你的登入還在等：點一下手機上的登入卡片，再打開 App。"),
      ruleOf("number"),
      ln("This one is yours: don't swipe it away or say No.", "這次是你自己要登入，不要滑掉，也不要按「不是我」。")],
      ctxOf(OWN.id, ownChosen()), [ln("What is number matching?", "什麼是號碼比對？")]);
    if (S.badge === "active") return out("Kevin's lost badge is active", "凱文遺失的卡現在可以用", [firstOf(READER.ask_en, READER.ask_zh),
      ln("Press Block it again on the laptop's door console.", "按筆電門禁控制台上的「重新停用」。"), shield], ctxOf(S.fired[READER.id] ? READER.id : "", "unblock"));
    const started = PUSHES.some((e) => S.fired[e.id]) || !!S.fired[CALL.id];
    const quiet = !S.reported && EV.every((e) => S.fired[e.id] && S.res[e.id]);
    return out("Right now", "現在", [
      ln("Nothing is waiting for you right now. Watch your phone and the door camera on the laptop.", "現在沒有事情在等你。注意手機和筆電上的門口監視器。"),
      S.reported ? ln("You've reported to the SOC: your password is reset, so the prompts have stopped.", "你已經回報資安監控中心了：密碼重設了，通知也停了。")
        : started ? ln(`You haven't reported yet: open Phone at the bottom of your phone and dial ${soc}.`, `你還沒回報：打開手機下方的「電話」，撥 ${soc}。`) : null,
      quiet ? ln(`Everything else has happened, so the clock runs faster now. Only the call to ${soc} is left.`, `其他事都發生過了，時間會走得比較快，只剩打 ${soc}。`) : null,
      shield], ctxOf());
  }

  /* ------------------------------------------------------------------ the briefing: Mei-Ling's message before bed */
  function brief() {
    loop.stop();
    setNow(briefNow);     // 11/27
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
      alerts: [], badge: "blocked", app: null, dial: "", recents: [], streak: 0, calledFake: false, via: {},
      note: null, noteQ: [], ending: false };     // 11/27: the note on the stage, the ones waiting, and 03:25 closing what is open
    B = null;
    st.scene("mn_room", 0.18);
    H = CB.hud({ pause: true, clock: story.start, clockLabel: bi("on call", "值班中"), shields: sh.shields });
    G.onPause = () => togglePause();
    if (G.help) G.help.clear();     // 11/27: the Help panel's mistakes are this night's
    setNow(shiftNow);
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

  // 11/26 (front-end review K56): the score never goes below 0, and the pop shows what really changed (no "-30" at 0 points)
  function addPts(x) {
    const before = S.points;
    S.points = Math.max(0, S.points + x);
    H.points(S.points, S.streak, S.points - before || null);
  }

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
    noteTick();     // 11/27: a note on the stage goes once its move is made, and the next one waiting comes up
    if (!S || S.over || S.paused || S.hold || S.note || document.hidden) return;     // 11/27: the clock waits while a note is up
    if (S.dark && S.wakeAt && performance.now() >= S.wakeAt) wake();
    const quiet = !S.reported && EV.every((e) => S.fired[e.id] && S.res[e.id]);     // everything has happened; only the call to 2199 is left
    const sending = !!(S.call && S.call.state === "sending");     // 11/26 (front-end review K53): the code is going down the line
    S.clock = Math.min(TEND, S.clock + dt * (busy() ? sh.rate : quiet ? sh.idle * 2 : sh.idle));
    for (const e of EV) if (!S.note && !S.fired[e.id] && S.clock >= e.at && canFire(e)) fire(e);     // 11/27: nothing more fires once a note came up
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
    if ((allDone || S.clock >= TEND) && !S.hold && !sending) {     // K53: 03:25 waits for those 900 ms; the breach that follows holds it
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
    // 11/26 (front-end review K48): the phone and the laptop are inert while paused, so the keyboard cannot slide, swipe
    // or press anything behind the Paused layer; on Resume the keyboard goes back where it was
    const play = $(".mn-play"), a = document.activeElement;
    if (S.paused) S.pauseFocus = play && a && play.contains(a) ? a : null;
    if (play) play.inert = S.paused;
    S.pause.set(S.paused);
    H.paused(S.paused);
    if (!S.paused && S.pauseFocus) { const f = S.pauseFocus; S.pauseFocus = null; if (f.isConnected && !f.closest("[inert]")) f.focus({ preventScroll: true }); }
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
        // 11/27: it said "Something wants you to approve a sign-in", which read like an instruction to approve
        if (w) w.innerHTML = bi("The phone lights up the room: a sign-in prompt you didn't start.", "手機把房間照亮了：一則不是你發起的登入通知。");
      }
      // 11/27: the first-time guide. The first prompt of the night waits (the clock stops), the lamp goes on, and a ring and a
      // finger show the swipe to the left on its card. It goes when that prompt is answered (or stopped by your report).
      if (e === PUSHES[0] && !SEEN.has("push")) {
        wake();
        want({ key: "push", target: () => $(`.mn-nw[data-id="${e.id}"] .mn-n`), gesture: "drag-left",
          en: "A sign-in you didn't start: someone has your password. Swipe it left to deny it.", zh: "不是你發起的登入：有人拿到你的密碼了。往左滑拒絕。",
          done: () => !!S.res[e.id] });
      }
      if (e.msg_en) addNotif({ id: "msg-" + e.id, e: {}, kind: "msg", left: 10, total: 10, from_en: e.msg_from_en, from_zh: e.msg_from_zh, en: e.msg_en, zh: e.msg_zh });   // the trick comes by text, the prompt looks like any other
    } else if (e.kind === "door") doorFire(e);
    else if (e.kind === "call") {
      S.call = { e, state: "ringing", left: e.secs, ringT: 0, talk: 0, typed: "", said: 0, pad: false, lines: [] };     // 11/26 (front-end review K57): lines = what the caller said
      S.recents.unshift({ num: e.number, en: e.name_en, zh: e.name_zh, t: clockAt(S.clock), dir: "in" });
      take("call");
      callScreen();
      // 11/27: the first call of the page: a ring on the hang-up button, and the rule (no code for a caller, dial 2199 yourself)
      want({ key: "call", target: () => $("#mnTake [data-end], #mnTake [data-c=decline]"), gesture: "click", step_en: "A call", step_zh: "來電",
        en: `Never type or read out the code for a caller, even one who says he is the SOC. Hang up here, then open Phone and dial ${NUM.soc} yourself.`,
        zh: `驗證碼絕對不要按給或念給來電的人，就算他說自己是資安監控中心也一樣。在這裡掛掉，再打開「電話」自己撥 ${NUM.soc}。`,
        button: GOT, done: () => !S.call || S.call.e !== e || S.call.state === "done" || S.call.state === "sending" });
    } else if (e.kind === "own") {
      S.own = { state: "ready", tries: 0, left: e.secs, e, typed: "" };
      addNotif({ id: "msg-" + e.id, e, kind: "msg", left: 12, total: 12, from_en: "Security · Hsu", from_zh: "安全室 許志明", en: e.ask_en, zh: e.ask_zh });
      portal();
      buzz();
      // 11/27: the first sign-in of your own: a ring on the laptop's Sign in button, with the briefing's rule for it
      const r = ruleOf("number") || ln("Press Sign in on the laptop, then type the number the laptop shows into the app on your phone.", "先按筆電上的「登入」，再把筆電上顯示的號碼輸入手機的 App。");
      want({ key: "own", target: () => $("#mnSignIn"), gesture: "click", step_en: "Your own sign-in", step_zh: "你自己要登入", en: r.en, zh: r.zh,
        button: GOT, done: () => S.own.state !== "ready" });
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
    if (n.kind === "push") { S.res[n.id] = "expired"; S.streak = 0; H.points(S.points, 0); /* 11/26 (front-end review K55): the ×N badge goes */ addLog(clockAt(S.clock), bi(story.lines.expired.en, story.lines.expired.zh), "is-quiet"); }
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
    H.points(S.points, 0);     // 11/26 (front-end review K55): the streak badge goes with the streak
    S.approved += 1;
    CB.SFX.play("bad");
    addLog(clockAt(S.clock), bi("Approved a sign-in you didn't start.", "同意了一則不是你發起的登入。"), "is-bad");
    // 11/27: why, on the cut scene and in the Help panel: the MFA fatigue threat and the procedure's don't and first step
    await breach(story.push_damage, n.e, { ctx: ctxOf(n.id, "approve"), why: reasons(nodeOf("mfa_fatigue"), dontOf(PROC, 0), stepOf(PROC, "contain", "you")) });
  }

  // o (11/27): {why, ctx} for the cut scene, which shows the reasons, adds the Ask button and tells the Help panel
  async function breach(dm, e, o) {
    noteSuspend();     // 11/27: a note on the stage waits until the cut is over
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
      go: left > 0 ? bi("Back to the phone", "回到手機") : bi("Continue", "繼續"),
      why: (o && o.why) || [], ctx: (o && o.ctx) || ctxOf(e && e.id), at: clockAt(S.clock) });
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
    // 11/27: the first door alert of the page: a ring on the radio button and a finger that holds it; the sliders are traps
    if (!a.doomed) want({ key: "door", target: () => $("#mnPtt"), gesture: "hold", step_en: "Someone at the door", step_zh: "門口有人",
      en: "Someone is at the Banquet Hall door. Hold this radio button to tell Security. Swiping the alert off your phone tells nobody, and the sliders on this console let them in.",
      zh: "宴會廳門口有人。按住這個無線電按鈕，告訴安全室。把手機上的通知滑掉，沒有人會知道。控制台上的滑桿是放他們進來的。",
      button: GOT, done: () => !S.alerts.includes(a) });
    if (a.doomed) later(() => {     // 11/27 review: not while paused (the cut used to play behind the Help panel)
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
      await breach(dm, e, { ctx: ctxOf(e.id, via === "unlock" ? "unlock" : "unblock"), why: doorWhy(e, via) });     // 11/27
      if (S.over) return;
      camReset();
      conDraw();
      return;
    }
    S.res[e.id] = "none";
    addLog(e.cam.slice(0, 5), bi(`${e.alert_en}: nobody told Security. ${e.miss_en || (idle && idle.why_en) || ""}`, `${e.alert_zh}：沒有人通知安全室。${e.miss_zh || (idle && idle.why_zh) || ""}`), "is-miss");
    camAway(e, false);
    conDraw();
    if (S.ending) return;     // 03:25 closed it: not a move of yours
    // 11/27: the alert ran out with nobody told. The same reason as the log line, on the spot by the radio button (the clock
    // waits until "Got it"), and in the Help panel
    const r = e.miss_en ? ln(e.miss_en, e.miss_zh) : ln(`Nobody told Security. ${(idle && idle.why_en) || ""}`.trim(), `沒有人通知安全室。${(idle && idle.why_zh) || ""}`);
    oops({ at: e.cam.slice(0, 5), title_en: `${e.alert_en}: nobody told Security`, title_zh: `${e.alert_zh}：沒有人通知安全室`, why: reasons(r, rightOf(e)), ctx: ctxOf(e.id, "timeout") });
    // 11/27 review: only "Got it" closes it (holding the radio now does nothing for this alert), so no moving finger; after
    // "Got it" the keyboard goes back where it was (else to the radio button)
    const back = document.activeElement;
    whyNote({ target: () => $("#mnPtt"), gesture: "none", en: `${r.en} Next time, hold this radio button.`, zh: `${r.zh}下次按住這個無線電按鈕。`,
      focusAfter: () => (back && back !== document.body && back.isConnected && !back.closest("[inert]") ? back : null) });
  }

  /* 11/27: why opening the door (or unblocking the lost badge) for them was wrong: the badge's story when it is Kevin's,
     the reason games.yaml gives for the option that is only half right, and the right move */
  function doorWhy(e, via) {
    const idle = (e.options || []).find((o) => !o.good && !o.bad), at = (S.beforeAt || "").slice(0, 5);
    return reasons(e.box === "reader" ? firstOf(e.ask_en, e.ask_zh) : null,
      via === "before" && at ? ln(`You had unblocked it at ${at}.`, `你在 ${at} 就解除了停用。`) : null, whyOf(idle), rightOf(e));
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
    // 11/27: why, from the reader alert's own story and the lost-badge procedure, in the Help panel; before the crew has
    // tapped it, also on the spot by "Block it again" (the clock waits until it is blocked again or "Got it")
    const blocks = stepOf(BADGE, "contain");
    const why = reasons(firstOf(READER.ask_en, READER.ask_zh), blocks ? ln(`${BADGE.name_en}: ${blocks.en}`, `${BADGE.name_zh}：${blocks.zh}`) : null);
    oops({ at: clockAt(S.clock), title_en: `Unblocked badge ${BADGE_ID} (${BD.en}, reported lost)`, title_zh: `解除了員工證 ${BADGE_ID}（${BD.zh}，已掛失）的停用`, why,
      ctx: ctxOf(d3 && S.fired[d3.id] ? d3.id : "", "unblock") });
    if (!(d3 && S.res[d3.id])) whyNote({ target: () => $("#mnReblock:not([hidden])") || $("#mnBadgeLamp"), en: `${joinEn(why)} Press Block it again.`, zh: `${joinZh(why)}按「重新停用」。`,
      done: () => S.badge !== "active" });
    if (d3 && S.res[d3.id]) {     // the crew is gone, but a lost badge is still a lost badge
      later(() => {     // 11/27 review: not while paused (it took the 40 points while you were in the Help panel)
        if (!S || S.over || S.badge !== "active") return;
        S.badge = "blocked";
        addPts(-P.reblock);     // 11/26 (front-end review K56)
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
    // 11/26 (regression R11): the hold ends without sending when the button loses the keyboard or the pointer before the
    // key or finger comes up (Pause moves the keyboard to Resume, the play area goes inert), so nothing stays held
    const cancel = () => {
      if (!t0) return;
      t0 = 0;
      clearTimeout(timer);
      b.classList.remove("is-holding", "is-ready");
    };
    b.addEventListener("pointerdown", down);
    b.addEventListener("pointerup", up);
    b.addEventListener("pointercancel", up);
    b.addEventListener("blur", cancel);
    b.addEventListener("lostpointercapture", cancel);
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
    // 11/26 (front-end review K54): an alert that came in while the door stood open is still live: draw its crew and LED again
    const a = S.alerts[S.alerts.length - 1];
    if (a) camEvent(a.doomed ? Object.assign({}, a.e, ACCEPTED, { led: "" }) : a.e);
    else { $("#mnCamBox").hidden = true; $("#mnCamSay").hidden = true; $("#mnCamBar").hidden = true; $("#mnCam").classList.remove("is-alert"); }
  }

  /* ------------------------------------------------------------------ the phone's own screens */
  // 11/26 (front-end review K49): while an app covers the phone, the lock screen and the dock under it are inert (Tab
  // and Enter no longer reach them), and the keyboard moves into the app (phoneFocus). Closing the app clears that and,
  // if the keyboard was in the app, puts it back on the Phone button (or on `back`).
  function take(kind) {
    S.app = kind; const t = $("#mnTake"); t.hidden = false; t.className = `mn-takeover is-${kind}`;
    for (const n of $$("#mnScreen > :not(#mnTake)")) n.inert = true;
    return t;
  }
  function untake(back) {
    if (!S) return; S.app = null; const t = $("#mnTake"); if (!t) return;
    const had = t.contains(document.activeElement);
    t.hidden = true; t.innerHTML = ""; t.className = "mn-takeover";
    for (const n of $$("#mnScreen > :not(#mnTake)")) n.inert = false;
    if (had && !S.over) CB.refocus(typeof back === "string" ? back : "#mnPhoneApp");     // `back` is an Event when untake is a click handler
  }
  /* the keyboard goes to the app's first control, unless it is busy somewhere else (the laptop): an incoming call does not
     take the keyboard away from the door console */
  function phoneFocus(sel) {
    const a = document.activeElement, t = $("#mnTake");
    if (!t || t.hidden) return;
    const lost = !a || a === document.body || !a.isConnected || (!!a.closest("#mnScreen") && !t.contains(a));
    if (!lost) return;
    const n = $(sel, t);
    if (n) n.focus({ preventScroll: true });
  }
  // Enter is a button's own when the keyboard is on one that can be used (not one under the app)
  const onButton = () => { const a = document.activeElement; return !!(a && a.closest("button") && !a.closest("[inert]")); };

  const KEYS = [["1", ""], ["2", "ABC"], ["3", "DEF"], ["4", "GHI"], ["5", "JKL"], ["6", "MNO"], ["7", "PQRS"], ["8", "TUV"], ["9", "WXYZ"], ["*", ""], ["0", "+"], ["#", ""]];
  const keysHTML = (id, keys) => `<div class="mn-keys" id="${id}">${(keys || KEYS).map(([k, s]) => (k ? `<button type="button" data-k="${k}" aria-label="${k === "del" ? "Delete" : k}">${k === "del" ? "⌫" : `<b>${k}</b><small>${s}</small>`}</button>` : "<span></span>")).join("")}</div>`;
  // 11/22 evening: the crew's number is a UK drama number (+44 7700 900417), typed with or without the 00 in front;
  // 11/22 review: grouped that way from 0044 or 44 on while you type (it showed 0044-770-0900 for 8 to 13 digits)
  const shownNum = (s) => { const x = digitsOf(s); if (/^(00)?44/.test(x)) { const y = x.replace(/^(00)?44/, ""); return ["+44", y.slice(0, 4), y.slice(4)].filter(Boolean).join(" "); } return x.length > 7 ? x.replace(/^(\d{4})(\d{3})(\d*)$/, (m, a, b, c) => [a, b, c].filter(Boolean).join("-")) : x; };
  const keyFx = (b) => { if (!b) return; b.classList.remove("is-hit"); void b.offsetWidth; b.classList.add("is-hit"); };

  function onKey(ev) {
    if (S && S.dark && !ev.ctrlKey && !ev.metaKey && !ev.altKey) wake();
    // 11/26 (regression R10): a key a card, slide or button already used is theirs. Enter on the sign-in card opens the
    // app and then bubbles here; without this it also answered at once with the digits typed before Later
    // 11/26 (second regression pass): not Escape: a slide knob marks every Escape as used, and Escape here puts the phone
    // app away (as before R10)
    if (ev.defaultPrevented && ev.key !== "Escape") return;
    if (B) return boardKey(ev);     // 11/27: on the case board the door keypad takes the keyboard too
    if (!S || S.over || S.paused || !S.app || ev.ctrlKey || ev.metaKey || ev.altKey) return;
    const k = ev.key;
    if (S.app === "dial") {
      if (/^[0-9*#]$/.test(k)) { ev.preventDefault(); dialKey(k); }
      else if (k === "Backspace") { ev.preventDefault(); dialKey("del"); }
      else if (k === "Enter" && !onButton()) { ev.preventDefault(); dialOut(); }     // 11/26 (front-end review K49): not the covered Phone button
      else if (k === "Escape") { ev.preventDefault(); untake(); }      // 11/23: handled here, the game window stays open (common.js)
    } else if (S.app === "auth") {
      if (/^[0-9]$/.test(k)) { ev.preventDefault(); authKey(k); } else if (k === "Backspace") { ev.preventDefault(); authKey("del"); }
      else if (k === "Enter" && !onButton() && S.own.typed.length >= 2) { ev.preventDefault(); ownAnswer(S.own.typed); }     // 11/26 (front-end review K49): Enter = Yes
      else if (k === "Escape") { ev.preventDefault(); authLater(); }
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
    phoneFocus("#mnDialCall");     // 11/26 (front-end review K49): type the number, Enter calls
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
    phoneFocus("[data-end]");     // 11/26 (front-end review K49)
    // 11/26 (front-end review K58): each outgoing call gets its own number; a timer from a call you already ended checks it
    return (S.outTok = (S.outTok || 0) + 1);
  }

  function lineCall(num) {   // Security, the Help Desk, or nobody
    const t = take("line");
    const who = num === NUM.security ? "security" : num === NUM.helpdesk ? "helpdesk" : null;
    const c = who ? story.contacts.find((x) => x.key === who) : null;
    const tok = outgoing(t, c ? bi(c.en, c.zh) : esc(shownNum(num)), c ? c.number : shownNum(num), who === "security" ? "SEC" : who === "helpdesk" ? "IT" : "?", "");
    setTimeout(() => {
      if (!S || S.over || S.app !== "line" || S.outTok !== tok) return;     // K58: not a later call's screen
      const line = (CON.lines || {})[who || "none"] || { en: "", zh: "" };
      t.innerHTML = `<div class="mn-call is-talking"><p class="mn-call-label">${numHTML(c ? c.number : shownNum(num))}${c ? ` · ${bi(c.en, c.zh)}` : ""}</p>
        <div class="mn-talk"><p class="mn-bubble">“${esc(line.en)}”<span lang="zh-Hant">${esc(line.zh)}</span></p></div>
        <button type="button" class="mn-end" data-end aria-label="End call">${ICON.hang}<span>${bi("End call", "掛斷")}</span></button></div>`;
      $("[data-end]", t).addEventListener("click", untake);
      phoneFocus("[data-end]");     // 11/26 (front-end review K49)
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
      phoneFocus(".mn-slide-knob");     // 11/26 (front-end review K49): ArrowRight answers
      return;
    }
    const open = c.fake ? [e.again_en, e.again_zh] : [e.open_en, e.open_zh];
    // 11/27: under what he says, a line with the rule (the reason, on a call you rang back); "dial 2199 yourself" used to
    // show up only in the night log after you hung up
    t.innerHTML = `<div class="mn-call is-talking is-fake"><p class="mn-call-label">${esc(e.number)} · ${bi(e.name_en, e.name_zh)}<b class="mn-call-time" id="mnCallT">00:00</b></p>
      ${c.pad ? `<p class="mn-sms is-mini">${ICON.lake}<span>${bi(`Code ${e.code} · never share it`, `驗證碼 ${e.code}・不要給任何人`)}</span></p>`
        : `<div class="mn-sms"><p class="mn-n-app">${ICON.lake}<span>${APP}</span><time>${bi("now", "現在")}</time></p>
        <p>${bi(`Your one-time code is ${e.code}. Never share it. The SOC will never ask for it.`, `你的一次性驗證碼是 ${e.code}。不要給任何人，資安監控中心不會跟你要。`)}</p></div>`}
      <div class="mn-talk" id="mnTalk"><p class="mn-bubble">“${esc(open[0])}”<span lang="zh-Hant">${esc(open[1])}</span></p></div>
      <p class="mn-miss">${c.fake ? bi(`You rang this number back: it belongs to the caller, not to the SOC. Hang up, then dial ${NUM.soc} yourself.`, `你回撥了這個號碼：它是那個人的，不是資安監控中心的。掛掉，再自己撥 ${NUM.soc}。`)
        : bi(`Rule: never type the code for a caller. Hang up, then dial ${NUM.soc} yourself.`, `規則：驗證碼不要按給來電的人。掛掉，再自己撥 ${NUM.soc}。`)}</p>
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
    for (const l of c.lines || []) talkLine(l);     // 11/26 (front-end review K57): every line he said, "That didn't work" included
    const box = $("#mnTalk");
    if (box) box.scrollTop = box.scrollHeight;
    phoneFocus(c.pad ? "[data-ctl=hide]" : "[data-ctl=pad]");     // 11/26 (front-end review K49)
  }

  function callAnswer() {
    if (!S.call || S.call.state !== "ringing") return;
    S.call.state = "talking";
    S.call.talk = 0;
    CB.SFX.play("open");
    callScreen();
  }

  // 11/26 (front-end review K57): a line the caller says is kept on the call, so a redraw (Keypad / Hide keypad) shows it again
  function callSay(l) {
    if (!l) return;
    S.call.lines = (S.call.lines || []).concat([l]);
    talkLine(l);
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
    while (c.said < due && c.said < lines.length) { callSay(lines[c.said]); c.said += 1; }     // K57
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
      callSay({ en: CALL.got_en, zh: CALL.got_zh });     // K57
      c.state = "sending";
      await wait(900);
      return callEnd("read");
    }
    if (ds.length >= CODE.length) { callSay({ en: CALL.wrong_en, zh: CALL.wrong_zh }); c.typed = ""; if (typed) typed.innerHTML = "&nbsp;"; }     // K57: callSay
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
      addLog(clockAt(S.clock), bi(`Typed the code ${e.code} for a caller using Jun-Hao's name (${e.number}).`, `替冒充俊豪的來電（${e.number}）按出了驗證碼 ${e.code}。`) + whyLine("read"), "is-bad");
      // 11/27: why (the option's reason and the procedure's don't), then the Phone icon and 2199 once the cut is over
      await breach(e.damage, e, { ctx: ctxOf(e.id, "read"), why: reasons(whyOf(optOf(CALL, "read")), dontOf(PROC, 1)) });
      if (S && !S.over && !S.reported) dialNote();
      return;
    }
    if (wasFake) {
      addLog(clockAt(S.clock), bi(`Called back ${e.number}: the same voice wanted the code again. The number that rang you belongs to the caller, not to the SOC.`,
        `回撥 ${e.number}：同一個聲音又要驗證碼。打來的號碼是那個人的，不是資安監控中心的。`), "is-miss");
      if (!S.reported) dialNote();     // 11/27
      return;
    }
    S.res[e.id] = k;     // missed / declined / hang / gaveup
    const txt = k === "missed" ? bi(`Missed call from ${e.number}.`, `${e.number} 的未接來電。`)
      : k === "declined" ? bi(`Declined a call from ${e.number}.`, `拒接了 ${e.number} 的來電。`)
      : k === "gaveup" ? bi(`"Jun-Hao" (${e.number}) hung up when you didn't type the code.`, `你一直沒按驗證碼，「俊豪」（${e.number}）就掛了。`)
      : bi(`Hung up on "Jun-Hao" (${e.number}).`, `掛掉「俊豪」（${e.number}）的電話。`);
    // 11/23 review: until you have called 2199 yourself, the log says what is still missing (the "hang" option's why)
    addLog(clockAt(S.clock), txt + (S.reported ? "" : whyLine("hang")), "is-miss");
    if (!S.reported) dialNote();     // 11/27: the first time, a ring on the Phone icon: dial 2199 yourself
  }
  // the reason under a line of the night log: the "why" of one of the call's options in games.yaml
  function whyLine(k) {
    const o = (CALL.options || []).find((x) => x.k === k);
    return o && o.why_en ? `<span class="mn-why">${bi(o.why_en, o.why_zh)}</span>` : "";
  }

  function callFake() {   // you rang back the number that called you
    const t = take("call");
    S.calledFake = true;
    // 11/27: a mistake (it reaches the caller). The reason is the night log's own line and the briefing's rule; the call
    // screen says it too while he talks
    oops({ at: clockAt(S.clock), title_en: `Called back ${CALL.number}`, title_zh: `回撥了 ${CALL.number}`, ctx: ctxOf(CALL.id, "call_back_caller"),
      why: reasons(ln("The number that rang you belongs to the caller, not to the SOC.", "打來的號碼是那個人的，不是資安監控中心的。"), ruleOf("phone")) });
    const tok = outgoing(t, bi(CALL.name_en, CALL.name_zh), CALL.number, "JL", "");
    setTimeout(() => {
      if (!S || S.over || S.app !== "call" || S.outTok !== tok) return;     // 11/26 (front-end review K58)
      S.call = Object.assign(S.call || { e: CALL, ringT: 0, left: 0 }, { state: "talking", fake: true, talk: 0, typed: "", said: 0, pad: false, lines: [] });     // K57: a new conversation
      callScreen();
    }, reduceMotion ? 150 : 1500);
  }

  /* ------------------------------------------------------------------ calling the real SOC: you dialled 2199 */
  function callSoc() {
    const t = take("soc");
    S.soc = { state: "dialing", said: new Set() };
    // 11/27 review: hanging up while it still rings is the same as hanging up before saying anything (unless you reported already)
    const tok = outgoing(t, bi("SOC", "資安監控中心"), "ext. 2199", "SOC", "is-soc", () => { S.soc = null; if (!S.reported) socHungUp(); });
    setTimeout(() => { if (S && !S.over && S.soc && S.soc.state === "dialing" && S.app === "soc" && S.outTok === tok) socTalk(); }, reduceMotion ? 200 : 1500);     // 11/26 (front-end review K58)
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
      phoneFocus("[data-end]");     // 11/26 (front-end review K49)
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
    $("[data-end]", t).addEventListener("click", () => { if (S.soc.said.size) reportDone(); else { S.soc = null; untake(); socHungUp(); } });
    phoneFocus(".mn-line");     // 11/26 (front-end review K49): Enter says the line
    // 11/27: the first report of the page: a ring on the first line and a finger that drags it up into the call (on the
    // whole deck the note had no room below and covered the call itself)
    want({ key: "soc", target: () => $("#mnDeck .mn-line:not([disabled])") || $("#mnDeck"), to: () => $("#mnTalk"), gesture: "drag-to", step_en: "Report to the SOC", step_zh: "回報資安監控中心",
      en: "Drag what you want to tell him up into the call, one line at a time. Then press That's everything.",
      zh: "把要跟他說的話一句一句拖到上面的通話裡，說完按「就這些」。",
      button: GOT, when: () => S.app === "soc", done: () => !S.soc || S.soc.state !== "talking" || S.soc.said.size > 0 });
  }

  /* 11/27: you hung up on the SOC before saying anything. That used to pass in silence (nothing was reported); now the
     night log, the Help panel and a note by the Phone icon say why it matters: the procedure's "report right away" */
  function socHungUp() {
    const why = reasons(ln("You hung up before you told Jun-Hao anything, so nothing was reported.", "你還沒跟俊豪說任何事就掛了，等於沒有回報。"), ln(PROC.time_en, PROC.time_zh));
    addLog(clockAt(S.clock), bi("Hung up on the SOC before telling them anything.", "還沒跟資安監控中心說任何事就掛了。") + (PROC.time_en ? `<span class="mn-why">${bi(PROC.time_en, PROC.time_zh)}</span>` : ""), "is-miss");
    oops({ at: clockAt(S.clock), title_en: "Hung up on the SOC without reporting", title_zh: "還沒回報就掛掉資安監控中心的電話", why, ctx: ctxOf("soc", "hang") });
    whyNote({ target: () => $("#mnPhoneApp"), en: `${joinEn(why)} Open Phone and dial ${NUM.soc} again.`, zh: `${joinZh(why)}打開「電話」，再撥一次 ${NUM.soc}。`,
      when: () => !S.app, done: () => !!S.reported || !!S.soc || S.app === "dial" });
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
        // 11/26 (front-end review K51): the copy lives outside the scaled canvas: canvas-pixel size and padding, scaled by G.k()
        g.style.width = `${card.offsetWidth}px`;
        g.style.padding = getComputedStyle(card).padding;
        g.style.transformOrigin = "0 0";
        document.body.appendChild(g);
        p.ghost = g;
        card.classList.add("is-lifted");
        CB.SFX.play("paper");
      }
      if (p.ghost) { p.ghost.style.transform = `translate(${ev.clientX - p.dx}px, ${ev.clientY - p.dy}px) scale(${G.k() || 1}) rotate(-2deg)`; zone.classList.toggle("is-target", inside(ev)); }
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
    // 11/23 review: the pointer was taken away under the drag: nothing is said, and the copy under the finger goes too
    card.addEventListener("lostpointercapture", () => {
      if (!p) return;
      const { ghost } = p;
      p = null;
      card.classList.remove("is-lifted");
      zone.classList.remove("is-target");
      if (ghost) ghost.remove();
    });
    card.addEventListener("keydown", (ev) => { if (ev.key === "Enter" || ev.key === " ") { ev.preventDefault(); onDrop(); } });
  }

  function sayLine(b) {
    if (!S.soc || S.soc.state !== "talking" || b.disabled) return;
    const r = S.soc.items.find((x) => x.k === b.dataset.k);
    b.disabled = true;
    b.classList.add("is-said");
    setTimeout(() => { b.remove(); CB.refocus("#mnDeck .mn-line:not([disabled]), #mnTell"); }, reduceMotion ? 0 : 240);     // 11/26 (front-end review K49): on to the next line
    S.soc.said.add(r.k);
    const box = $("#mnTalk"), hint = $("#mnDropHint");
    if (hint) hint.remove();
    box.insertAdjacentHTML("beforeend", `<p class="mn-bubble is-me">${bi(r.en, r.zh)}</p>`);
    box.scrollTop = box.scrollHeight;
    CB.SFX.play("tap");
    const pts = r.good ? P.good : r.bad ? -P.bad : 0;
    addPts(pts);     // 11/26 (front-end review K56)
    $("#mnTell").disabled = false;
    // 11/27: a line that makes things worse: Jun-Hao says why in the call (below); the Help panel keeps the same reason
    if (r.bad) oops({ at: clockAt(S.clock), title_en: `You told the SOC: “${r.en}”`, title_zh: `你跟資安監控中心說：「${r.zh}」`, why: reasons(ln(r.why_en, r.why_zh)), ctx: ctxOf("soc", r.k) });
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
    phoneFocus("[data-end]");     // 11/26 (front-end review K49)
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
        <p class="mn-portal-d">${o.tries ? (o.blocked ? bi(`${o.blocked.en} Sign in again.`, `${o.blocked.zh}再登入一次。`) /* 11/27: why it was blocked */ : bi("The last try was blocked. Sign in again.", "上一次被擋下了，再登入一次。")) : bi(o.e.ask_en, o.e.ask_zh)}</p><button type="button" class="btn mn-signin" id="mnSignIn">${bi("Sign in", "登入")}</button><i class="mn-n-bar"><b id="mnOwnBar"></b></i></div>`;
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
      <div class="mn-auth-boxes" id="mnAuthBoxes" tabindex="-1" role="group" aria-label="The number on your screen: type two digits, then Enter"><b></b><b></b></div>
      ${keysHTML("mnAuthKeys", [["1", ""], ["2", ""], ["3", ""], ["4", ""], ["5", ""], ["6", ""], ["7", ""], ["8", ""], ["9", ""], ["", ""], ["0", ""], ["del", ""]])}
      <div class="mn-auth-btns"><button type="button" class="mn-auth-no" id="mnAuthNo">${bi("No, it's not me", "不是我")}</button><button type="button" class="mn-auth-yes" id="mnAuthYes" disabled>${bi("Yes", "是我")}</button></div>
      <button type="button" class="mn-auth-later" id="mnAuthLater">${bi("Later", "稍後")}</button></div>`;
    $("#mnAuthKeys").addEventListener("click", (ev) => { const b = ev.target.closest("[data-k]"); if (b) authKey(b.dataset.k); });
    $("#mnAuthNo").addEventListener("click", () => ownAnswer("deny"));
    $("#mnAuthYes").addEventListener("click", () => ownAnswer(o.typed));
    $("#mnAuthLater").addEventListener("click", authLater);
    authDraw();
    phoneFocus("#mnAuthBoxes");     // 11/26 (front-end review K49): type the two digits, Enter = Yes
  }
  /* 11/23 review: put the app away without answering (Later, or Escape). The sign-in keeps waiting: its card on the lock
     screen opens the app again, and the phone's dialler works in the meantime. */
  function authLater() {
    if (!S || S.app !== "auth") return;
    untake(".mn-nw.is-own .mn-n");     // 11/26 (front-end review K49): untake refocuses, so it is told where
    CB.SFX.play("tap");
    CB.refocus(".mn-nw.is-own .mn-n");      // the keyboard waits on that card: Enter opens the app again
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
    addPts(-P.ownWrong);     // 11/26 (front-end review K56)
    CB.SFX.play("bad");
    // 11/27: the -30 used to come with only "Try again". Why it was blocked (number matching: the number in the app must be
    // the one the laptop shows) goes on the portal, in the log, in the Help panel and in a note on Sign in
    const rule = ruleOf("number");
    o.last = x === "deny" ? "deny" : "wrong";
    o.blocked = x === "deny" ? ln("You said no to your own sign-in, so it was blocked.", "你拒絕了自己的登入，所以被擋下了。")
      : ln(`The app got ${x || "no number"}, but the laptop showed ${o.e.match}, so the sign-in was blocked.`, `App 收到的是 ${x || "空白"}，筆電上顯示的卻是 ${o.e.match}，所以登入被擋下了。`);
    addLog(clockAt(S.clock), (x === "deny" ? bi("You denied your own sign-in. Try again.", "你拒絕了自己的登入，再試一次。")
      : bi(`Wrong number (${x || "none"}): the sign-in was blocked. Try again.`, `號碼輸入錯誤（${x || "沒有輸入"}），登入被擋下了，再試一次。`)) + (rule ? `<span class="mn-why">${bi(rule.en, rule.zh)}</span>` : ""), "is-miss");
    o.state = "ready";
    portal();
    const why = reasons(o.blocked, rule);
    oops({ at: clockAt(S.clock), title_en: "Your own sign-in was blocked", title_zh: "你自己的登入被擋下了", why, ctx: ctxOf(OWN.id, x === "deny" ? "deny" : "wrong_number") });
    whyNote({ target: () => $("#mnSignIn"), en: joinEn(why), zh: joinZh(why), done: () => S.own.state !== "ready" });
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
    } else {
      addLog(clockAt(S.clock), bi("The on-call portal timed out before you signed in.", "還沒登入，值班入口就逾時了。"), "is-miss");
      // 11/27: in the Help panel too, with the briefing's rule for signing in yourself (not when 03:25 closed it)
      if (!S.ending) oops({ at: clockAt(S.clock), title_en: "The on-call portal timed out before you signed in", title_zh: "還沒登入，值班入口就逾時了", why: reasons(ruleOf("number")), ctx: ctxOf(o.e.id, "timeout") });
    }
    syncNotifs();
    portal();
  }

  /* ------------------------------------------------------------------ 03:25 */
  // 11/23 review: the call in Jun-Hao's name. ✓ = no code typed for him, and 2199 called yourself (straight after the call,
  // or a report to the SOC at any time in the night); △ = no code, but 2199 never called (no point); ✗ = the code typed.
  // Under △ and ✗ the results say what was missing: the "why" of the option it comes closest to (games.yaml, the call's
  // options: declined, missed and given up count as "hang").
  const callMark = () => (S.res[CALL.id] === "read" ? "✗" : S.res[CALL.id] === "back" || S.reported ? "✓" : "△");
  const callWhyHTML = () => {
    const m = callMark(), o = m === "✓" || !S.res[CALL.id] ? null : (CALL.options || []).find((x) => x.k === (m === "✗" ? "read" : "hang"));
    return o && o.why_en ? `<p class="mn-call-why">${bi(o.why_en, o.why_zh)}</p>` : "";
  };
  const right = () => ({
    prompts: S.approved === 0 && S.res[CALL.id] !== "read" ? 1 : 0,
    doors: DOORS.filter((e) => (e.options.find((o) => o.k === S.res[e.id]) || {}).good).length,
    call: callMark() === "✓" ? 1 : 0,
    own: S.res[OWN.id] === "ok" ? 1 : 0,
    report: S.reported && S.reported.allGood ? 1 : 0,
  });
  const shiftScore = () => Object.values(right()).reduce((a, b) => a + b, 0);

  async function endShift() {
    if (S.over) return;
    S.ending = true;     // 11/27: what 03:25 closes below is not a move of yours: no notes, no mistakes
    notesOff();
    for (const g of $$(".mn-line-ghost")) g.remove();     // 11/23 review: 03:25 came while a line was still being dragged to the SOC
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
    setNow(() => ({ title_en: "03:25, the night is over", title_zh: "03:25，值班結束", ctx: { screen: "end" },     // 11/27
      steps: [ln("The row of results shows how the night went: ✓ right, △ half right, ✗ wrong.", "下面那排是今晚的結果：✓ 做對，△ 對一半，✗ 做錯。"),
        ln("Press 07:30, the corridor to go to the case board and find out how the crew got in.", "按「早上七點半，走廊」去案情板，查出歹徒是怎麼進來的。")] }));
    const r = right();
    const denied = PUSHES.filter((e) => S.res[e.id] === "denied").length, stopped = PUSHES.filter((e) => S.res[e.id] === "stopped").length;
    st.body.innerHTML = `<section class="rs-dinner mn-sum">
      <p class="rs-kicker">${bi(`${story.end} · quiet again`, `${story.end}・安靜下來了`)}</p>
      <h2 class="rs-dinner-title">${S.shields < sh.shields ? bi(`You made it to morning with ${S.shields} shield${S.shields > 1 ? "s" : ""}.`, `撐到天亮了，還剩 ${S.shields} 面盾牌。`)
        // 11/26 (front-end review K60): not when you answered the call, called anyone back, or signed in on the phone
        : !denied && !r.doors && !S.reported && !["hang", "back", "gaveup"].includes(S.res[CALL.id]) && !S.calledFake && !["ok", "ok_late"].includes(S.res[OWN.id]) ? bi("Nothing got through, but nobody was answering the phone.", "歹徒什麼都沒得逞，不過整晚都沒人接手機。")
        : bi("Nothing you didn't start got a yes from you.", "不是你發起的，你一個都沒同意。")}</h2>
      <div class="rx-stats rs-dinner-stats">
        <div><b>${denied}${stopped ? `<small>+${stopped}</small>` : ""}</b><span>${bi(stopped ? "prompts denied, + stopped by your report" : "prompts denied", stopped ? "拒絕的通知，加上回報後停掉的" : "拒絕的通知")}</span></div>
        <div><b>${r.doors}/${DOORS.length}</b><span>${bi("door alerts handled", "門禁通知處理對的")}</span></div>
        <div><b>${callMark()}</b><span>${bi("the call in Jun-Hao's name", "冒充俊豪的電話")}</span></div>
        <div><b>${r.report ? "✓" : S.reported ? "△" : "✗"}</b><span>${bi("reported to 2199", "打 2199 回報")}</span></div>
        <div><b class="rs-shields-row">${Array.from({ length: sh.shields }, (_, k) => CB.ICON.shield(k < S.shields)).join("")}</b><span>${bi("shields left", "剩下的盾牌")}</span></div></div>
      ${callWhyHTML()}
      ${S.reported ? "" : S.res[CALL.id] === "back" ? `<p class="mn-late-call">${bi("You called 2199, but hung up before you told Jun-Hao what happened. Next time, tell him before you hang up.", "你有打 2199，可是還沒跟俊豪說發生什麼事就掛了。下次先講完再掛。")}</p>`     /* 11/26 (front-end review K59): you did call 2199 */
        : `<p class="mn-late-call">${bi("03:24: the SOC called you. They had seen the prompts on their side and reset your password. Next time, call 2199 the moment it starts.", "03:24 資安監控中心打給你：他們那邊看到了這些通知，已經幫你重設密碼。下次一開始就打 2199。")}</p>`}
      ${CB.personHTML({ svg: CB.analyst(), name: ANALYST.name, name_zh: ANALYST.name_zh, role_en: ANALYST.role_en, role_zh: ANALYST.role_zh },
        bi(`Get some sleep. Security pulled the door log; I'll bring the sign-in logs. 07:30 at the policy board in the corridor.${S.log.length ? " Bring your night log." : ""}`,
          `去睡一下吧。安全室調出了門禁紀錄，我會帶登入紀錄。七點半走廊的政策公告欄見。${S.log.length ? "值班紀錄記得帶著。" : ""}`))}
      <button type="button" class="btn rs-start">${bi("07:30, the corridor", "早上七點半，走廊")}</button></section>`;
    G.meter(`<div class="rx-hud"><div class="rx-hud-clock"><b>${esc(story.end)}</b><span>${bi("on call", "值班")}</span></div><div class="rx-hud-pts"><b>${S.points.toLocaleString("en-US")}</b><span>${bi("points", "分")}</span></div></div>`);
    $(".rs-start", st.body).addEventListener("click", async (ev) => {
      // 11/26 (front-end review C01): Enter again during the time skip doesn't start a second skip and a second board
      const b = ev.currentTarget; if (b.disabled) return; b.disabled = true;
      await CB.timeskip(st, { from: story.end, to: BOARD.time, place_en: "The Security Policy Board in the corridor", place_zh: "走廊的資安政策公告欄", day_en: "The morning after", day_zh: "隔天早上" });
      startBoard();
    });
    window.scrollTo({ top: 0, behavior: reduceMotion ? "auto" : "smooth" });
  }

  function gameOver() {
    notesOff();     // 11/27
    S.over = true;
    loop.stop();
    setNow(() => ({ title_en: "The night is lost", title_zh: "今晚輸了", ctx: { screen: "end" },     // 11/27
      steps: [ln(`The crew got in ${S.losses.length} times. Each line in the list is one of them.`, `歹徒得逞了 ${S.losses.length} 次，清單上每一行就是其中一次。`),     // 11/27 review: a 4th can land before the 3rd cut
        ln("Press Try the shift again to play the night again. The rules are below.", "按「重新值班」再玩一次，規則在下面。")] }));
    for (const g of $$(".mn-line-ghost")) g.remove();
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
    const keypad = `<div class="mn-keypad" id="mnKeypad" tabindex="-1"><i class="cb-pin" aria-hidden="true"></i><p class="mn-kp-t">${bi("Door keypad · test it", "門禁鍵盤・試按")}</p>
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
    if (B.kpBusy) return;     // 11/26 (front-end review K50): WRONG CODE is still up; a second OK is not a second try
    if (k === "C") { B.typed = ""; digits(); lcd("ENTER CODE", "請輸入密碼"); return; }
    if (k !== "OK") { if (B.typed.length < 4) { B.typed += k; digits(); } return; }
    if (B.typed.length < 4) return;
    if (B.typed === d.code) { lcd("CODE OK · TAP BADGE", "密碼正確・請感應員工證", "is-ok"); return solve(q); }
    CB.nope(B);
    B.kpBusy = true;
    lcd("WRONG CODE", "密碼錯誤", "is-bad");
    CB.cbSay(B.wrong[B.q] >= 2 ? bi(q.hint2_en, q.hint2_zh) : bi(q.hint1_en, q.hint1_zh), "is-no");
    boardOops(`Wrong code: ${B.typed}`, `密碼錯誤：${B.typed}`, B.wrong[B.q] >= 2 ? ln(q.hint2_en, q.hint2_zh) : ln(q.hint1_en, q.hint1_zh));     // 11/27
    const b0 = B;
    await wait(900);
    b0.kpBusy = false;
    if (B !== b0) return;     // K50: the board was left (or played again) in the meantime
    B.typed = ""; digits(); lcd("ENTER CODE", "請輸入密碼");
  }
  /* 11/27: the door keypad takes the keyboard too (it used to need the buttons on the board): digits, Backspace takes the
     last one back, Enter is OK. 11/27 review: Enter only when the keyboard is on the page itself or on the keypad; on
     anything else (Back to the tour, Sources, a log row, Ask) Enter stays that control's own */
  function boardKey(ev) {
    const q = QV()[B.q];
    if (!q || q.kind !== "code" || B.solved[B.q] || ev.ctrlKey || ev.metaKey || ev.altKey || ev.isComposing || ev.repeat) return;
    const k = ev.key, a = document.activeElement;
    const kp = document.getElementById("mnKeypad");
    const toBox = () => { if (kp && a && a !== kp && kp.contains(a)) kp.focus({ preventScroll: true }); };   // 11/27 regression review
    if (/^[0-9]$/.test(k)) { ev.preventDefault(); toBox(); key(k); }
    else if (k === "Backspace") { ev.preventDefault(); toBox(); if (!B.kpBusy && B.typed) { B.typed = B.typed.slice(0, -1); digits(); } }
    // Enter is OK only from the page itself or the keypad's own box: on a focused key it presses that key (a keyboard player
    // tabbing through the digits types with Enter), on a link or Sources it keeps its own action
    else if (k === "Enter" && (!a || a === document.body || a.id === "mnKeypad")) { ev.preventDefault(); key("OK"); }
  }
  // 11/27: a wrong try on the board goes to the Help panel with the words Jun-Hao says for it (CB.boardNow tells the rest)
  const boardOops = (title_en, title_zh, ...why) => oops({ at: "", title_en, title_zh, why: reasons(...why), ctx: { screen: "board", q: B.q, tries: B.wrong[B.q] || 0, solved: false } });

  /* Q2: choose, then point at the door log */
  function choose(q, k) {
    if (k === q.answer) { B.step = 1; CB.cbSay(bi(q.evidence_en, q.evidence_zh), "is-good"); return renderQs(); }
    const o = q.options.find((x) => x.k === k);
    B.tried[k] = true;
    renderQs();          // 11/26 (front-end review K46): re-render first, or the new card replaces the shaking one
    CB.nope(B);
    CB.cbSay(bi(o.why_en || "", o.why_zh || ""), "is-no");
    boardOops(`Not this one: ${o.en}`, `不是這個：${o.zh}`, whyOf(o));     // 11/27
  }

  function doorRow(kind, btn) {
    const q = QV()[B.q];
    if (!q || B.solved[B.q] || q.kind !== "choose" || B.step !== 1) return;
    if (kind === q.evidence) { btn.classList.add("is-ok"); return solve(q, btn); }
    CB.nope(B);
    const o = q.row_hint && q.options.find((x) => x.k === q.row_hint[kind]);
    CB.cbSay(o ? bi(o.why_en, o.why_zh) : bi(q.wrong_evidence_en, q.wrong_evidence_zh), "is-no");
    boardOops("Not that line of the door log", "門禁紀錄不是那一行", o ? whyOf(o) : ln(q.wrong_evidence_en, q.wrong_evidence_zh));     // 11/27
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
    boardOops("Not those lines yet", "標的行還不對", ln(m[0], m[1]));     // 11/27
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
    setNow(() => ({ title_en: "Case closed", title_zh: "結案", ctx: { screen: "closed" },     // 11/27
      steps: [ln("On the left: what changes now. On the right: real cases with the same moves.", "左邊是接下來要改的事，右邊是用同一招的真實案例。"),
        ln("Press See my results.", "按「看結果」。")] }));
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
    setNow(() => ({ title_en: "Your results", title_zh: "你的成績", ctx: { screen: "end" },     // 11/27
      steps: [ln("Your rank and score for case 3, and how the night went.", "這是第三案的等級、分數，還有今晚的表現。"),
        ln("Press Play again to try for a better rank, or open the next case file at the bottom.", "按「再玩一次」挑戰更好的等級，或打開最下面的下一個案件。")] }));
    const r = right(), firstTry = B.wrong.filter((w, i) => B.solved[i] && w === 0).length;
    const score = shiftScore() + firstTry;
    const denied = PUSHES.filter((e) => S.res[e.id] === "denied").length;
    const clean = !S.approved && !doorOpened();
    CB.finale(st, { file: 3, ranks: clean ? story.ranks : story.ranks.filter((x) => x.key !== "gold"), score, total: TOTAL, scene: BOARD.scene, dusk: 0.3,
      stats: [{ v: (S.points + B.pts).toLocaleString("en-US"), en: "points", zh: "分" }, { v: `${denied}`, en: "prompts denied", zh: "拒絕的通知" },
        { v: `${r.doors}/${DOORS.length}`, en: "door alerts", zh: "門禁通知" }, { v: callMark(), en: "the fake SOC call", zh: "假冒的電話" },
        { v: `${S.shields}/${sh.shields}`, en: "shields left", zh: "剩下的盾牌" }, { v: `${firstTry}/${QS.length}`, en: "solved first try", zh: "一次就解開" }],
      body: callWhyHTML() + (S.losses.length ? `<ul class="rx-loss-list">${S.losses.map((x) => `<li>${bi(x.dm.hit_en, x.dm.hit_zh)}</li>`).join("")}</ul>` : ""),
      next: { key: BOARD.next, en: BOARD.next_en, zh: BOARD.next_zh }, again: () => Games.mfa(d, main, true) });
    B = null;
  }

  if (replay) startShift();
  else {
    setNow(titleNow);     // 11/27: the Help panel's "Right now" on the title card
    CB.title(st, { file: 3, scene: "mn_room", title_en: "The MFA Door", title_zh: "多因素驗證門", time: story.start,
      place_en: (story.title || {}).place_en, place_zh: (story.title || {}).place_zh, hook_en: (story.title || {}).hook_en, hook_zh: (story.title || {}).hook_zh, onGo: brief });
  }
};
