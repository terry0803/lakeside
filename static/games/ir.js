/* Incident Response 事件應變, third version (11/21 night): case file 4, the last one in the Awards Night casebook.
   The night, 03:47 to 05:00: the resort's network map. Ransomware spreads along the lines from the night audit PC; every
   device it reaches starts encrypting. Everything is done with your hands:
   - click a device to look at it up close: pull its network cable out of the back (step 1), or hold its power button
     (the trap: the evidence in memory is gone); on Yi-Chen's screen the ransom note has a slider to pay (the trap);
   - dial 2199 on the desk phone to reach the SOC (step 2): the map's fog lifts and the SOC's tools unlock;
   - drag the SOC's tools onto the map: EDR shields onto devices, the cutter onto a switch or onto the crew's VPN line
     from the internet (step 3, which also disables y.chou);
   - the people-and-paper steps are cards you drag onto the map: the plan, the analysis, the notifications, the review;
   - drag the offline tape out of the safe onto the server room to restore (too early, and it is encrypted again), and
     the USB backup drive on your desk is the third trap.
   The steps, their order and who does them come from the knowledge graph's ransomware procedure (the short "why" under
   each step is written in content/games.yaml); the traps are that procedure's don'ts. Three shields: the door access server, the POS back office and the online backup, and every trap
   (11/21 night: the booking system is a cloud service in the knowledge graph, so it is no longer on this map).
   The case board, Sunday 16:00 at the lighthouse: put the whole week in order, pick the backup to restore from, and work
   out who must be told by when. Then the whole casebook closes. Shared helpers: casebook.js.
   11/27: the Help panel (what to do on each screen, why a move went wrong), the reasons on the spot and the first-time
   guide: see "Help, the first-time guide, why" below. */
"use strict";

Games.ir = function (d, main, replay) {
  const story = d.story, BOARD = story.board, QS = BOARD.questions || [];
  const sh = Object.assign({ rate: 0.5, spread: 8, encrypt: 9, reseed: 20, shields: 3, isolate: 3, cut: 2 }, story.shift || {});
  const T0 = CB.mins(story.start || "03:47"), TEND = CB.mins(story.end || "05:00") - T0;
  const clockAt = (m) => CB.hhmm(T0 + m);
  const STEPS = d.steps, PROC = d.procedure;
  const NODES = story.nodes, NODE = Object.fromEntries(NODES.map((n) => [n.k, n]));
  const LINKS = story.links.map(([a, b, via]) => ({ a, b, via: via || null }));
  const SW = story.switches, CARDS = story.cards, CARD = Object.fromEntries(CARDS.map((c) => [c.k, c]));
  const CRIT = NODES.filter((n) => n.critical).map((n) => n.k);
  const PLAYS = CARDS.filter((c) => c.how === "card").map((c) => c.k);       // the people-and-paper steps stay cards
  const TOTAL = STEPS.length + CRIT.length + 1 + QS.length;      // steps in order, critical systems kept, no trap, questions
  const P = { step: 120, order: 40, isolate: 30, saved: 150, trap: 80 };
  const NET = Object.assign({ ip: "203.0.113.45", user: "y.chou", x: 812, to: "fileserver" }, story.net || {});
  const GB = { pc: 240, server: 900, nas: 2400, till: 60, tape: 0 };
  const TOP = 76;                       // the map's viewBox starts this far above the zones: room for the internet and the crew's line
  const SOC_NUM = digitsOf(((story.contacts || []).find((c) => c.key === "soc") || { number: "2199" }).number) || "2199";
  const st = CB.stage(main);
  const ANALYST = { svg: CB.analyst(), name: story.analyst.name, name_zh: story.analyst.name_zh, role_en: story.analyst.role_en, role_zh: story.analyst.role_zh };
  const CALLER = { svg: CB.face({ style: "bob", hair: "#2b2421", coat: "#1f3a5f", mood: "worried" }), name: "Yi-Chen Chou", name_zh: "周易真", role_en: "Night Auditor, front office", role_zh: "櫃台夜間稽核" };
  // each step in a few words for the review's "last night's response" (the procedure's own sentences are too long to cut)
  const STEP_SHORT = { 1: ["Unplug, leave it on", "拔網路線，不關機"], 2: ["Call the SOC, 2199", "打 2199 給資安監控中心"], 3: ["Contain the spread", "圍堵擴散"],
    4: ["Activate the plan", "啟動應變計畫"], 5: ["Find how it got in", "查出怎麼進來的"], 6: ["Restore from offline", "從離線副本還原"],
    7: ["Notify those affected", "通知受影響的人"], 8: ["Hold the review", "開檢討會"] };
  // 11/27: the card that stands for each step in the Help panel (step 3: the EDR shield), and the panel itself (common.js)
  const STEP_KEY = {};
  for (const c of CARDS) if (c.step && !(c.step in STEP_KEY)) STEP_KEY[c.step] = c.k;
  const STEP3 = CARDS.filter((c) => c.step === 3).map((c) => c.k);
  const stepBy = (o) => STEPS.find((s) => s.order === o);
  const setNow = (fn) => { if (G.help) G.help.setNow(fn); };
  const mistake = (m) => { if (G.help) G.help.mistake(m); };
  // 11/27: the first-time guide, on the first play of this page only (not on "Play again" or "Try the shift again")
  const GD = replay ? null : { stage: "", at: 0, t0: 0, c: null, key: null, x: null };
  let S = null, B = null, H = null;
  const loop = CB.loop(tick);
  window.onresize = () => { if (B) CB.drawStrings(B.strings); if (S && S.open) placeClose(); };
  function digitsOf(s) { return String(s || "").replace(/\D/g, ""); }
  /* 11/26 (front-end review K66): img/ransom.png is the restaurant POS note (phish.js); the night audit PC, the door access
     server and the backup NAS get their own note, drawn here in the same layout (900 x 600) as an image */
  function noteImg(o, alt, cls) {
    const x = (s) => esc(String(s));
    const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 900 600" width="900" height="600" font-family="Segoe UI, Microsoft JhengHei, PingFang TC, sans-serif" font-weight="700">
      <rect width="900" height="600" fill="#8b1111"/><rect width="900" height="80" fill="#5a0b0b"/><rect y="504" width="900" height="96" fill="#2a0505"/>
      <text x="30" y="56" font-size="38" fill="#fff">${x(o.head)}</text>
      <text x="38" y="168" font-size="52" fill="#fff" textLength="824" lengthAdjust="spacingAndGlyphs">YOUR FILES ARE ENCRYPTED</text>
      <text x="38" y="238" font-size="36" fill="#ffd0c8">${x(o.l1)}</text><text x="38" y="298" font-size="36" fill="#ffd0c8">${x(o.l2)}</text>
      <text x="38" y="356" font-size="32" fill="#ffd0c8">${x(o.zh)}</text>
      <text x="450" y="566" font-size="38" fill="#fff" text-anchor="middle">Do not turn off this computer · 不要關機</text></svg>`;
    return `<img${cls ? ` class="${cls}"` : ""} src="data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}" alt="${x(alt)}">`;
  }
  // the note on Yi-Chen's PC, as in its close-up: the price doubles after 60 minutes (59:00 left in her 03:48 photo)
  const nightNote = (left, alt, cls) => noteImg({ head: "Front office · Night audit PC", l1: "Pay 5 BTC for the key.", l2: `The price doubles in ${left}.`, zh: "櫃台電腦的檔案都被加密了" }, alt, cls);
  const serverNote = (n) => noteImg({ head: n.en, l1: "Every file on this server is locked.", l2: "Pay 5 BTC for the key.", zh: `${n.zh}的檔案都被加密了` }, `Ransom note on the ${n.en} ${n.zh}上的勒索畫面`, "rs-ransom");

  const SVG = {
    shield: `<svg viewBox="0 0 48 48" aria-hidden="true"><path d="M24 4 40 10v12c0 11-7 18-16 22C15 40 8 33 8 22V10z" fill="#2f6f8f" stroke="#cfe9ff" stroke-width="2.4" stroke-linejoin="round"/><path d="M16 24l6 6 11-12" fill="none" stroke="#fff" stroke-width="3.4" stroke-linecap="round" stroke-linejoin="round"/></svg>`,
    cutter: `<svg viewBox="0 0 48 48" aria-hidden="true"><circle cx="13" cy="35" r="7" fill="none" stroke="#ffd36b" stroke-width="3.4"/><circle cx="35" cy="35" r="7" fill="none" stroke="#ffd36b" stroke-width="3.4"/><path d="M17 30 33 6M31 30 15 6" stroke="#e9eef0" stroke-width="3.6" stroke-linecap="round"/><circle cx="24" cy="18" r="2.4" fill="#0b151d"/></svg>`,
    usb: `<svg viewBox="0 0 64 40" aria-hidden="true"><rect x="2" y="6" width="44" height="28" rx="5" fill="#2a3236" stroke="#9fb0ad" stroke-width="2"/><rect x="46" y="12" width="14" height="16" rx="2" fill="#c9d3d1"/><rect x="50" y="16" width="3" height="3" fill="#2a3236"/><rect x="50" y="21" width="3" height="3" fill="#2a3236"/><rect x="8" y="13" width="24" height="5" rx="1.5" fill="#d8bd77"/><circle cx="38" cy="26" r="2.2" fill="#7fd1a8"/></svg>`,
    tape: `<svg viewBox="0 0 64 44" aria-hidden="true"><rect x="2" y="4" width="60" height="36" rx="5" fill="#1d1a12" stroke="#d8bd77" stroke-width="2.4"/><circle cx="20" cy="22" r="8" fill="none" stroke="#d8bd77" stroke-width="2.4"/><circle cx="44" cy="22" r="8" fill="none" stroke="#d8bd77" stroke-width="2.4"/><path d="M20 30h24" stroke="#d8bd77" stroke-width="2"/><text x="32" y="15" text-anchor="middle" font-size="7" font-weight="700" fill="#f1e6d0" font-family="Bahnschrift, Segoe UI, sans-serif">02:00</text></svg>`,
    plug: `<svg viewBox="0 0 40 28" aria-hidden="true"><rect x="1" y="4" width="22" height="20" rx="3" fill="#dfe7e2" stroke="#6d7a80" stroke-width="1.6"/><path d="M5 8h14v8l-3 3H8l-3-3z" fill="#9fb0ad"/><rect x="23" y="9" width="16" height="10" rx="3" fill="#2f6f8f"/></svg>`,
    power: `<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 3v8" stroke="currentColor" stroke-width="2.4" stroke-linecap="round"/><path d="M7 6.5a7.5 7.5 0 1 0 10 0" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round"/></svg>`,
  };

  /* ------------------------------------------------------------------ the briefing */
  function brief() {
    loop.stop();
    st.scene("ir_night", 0.35);
    G.meter("");
    CB.brief(st, { file: 4, start: story.start, top_en: "Sunday, before dawn", top_zh: "週日凌晨", until_en: `until ${story.end}`, until_zh: `應變到 ${story.end}`, person: ANALYST,
      intro_en: story.intro_en, intro_zh: story.intro_zh, rules: story.rules, after_en: story.after_en, after_zh: story.after_zh,
      extra: `<div class="ir-brief-pic">${nightNote("60:00", "The ransom note on the night audit PC 夜間稽核電腦上的勒索畫面")}</div>`,      // 11/26 (front-end review K66)
      button: bi("Take the call", "接電話"), onStart: startShift });
    // 11/27: the Help panel on the briefing
    const order = STEPS.map((s) => [s.order, ...(STEP_SHORT[s.order] || [s.text_en, s.text_zh])]);
    setNow(() => ({ title_en: "Before the night", title_zh: "開始之前", ctx: { screen: "brief" }, steps: [
      { en: "Read Your goal at the top and How to play on the right.", zh: "先看上面的「你的任務」和右邊的「怎麼玩」。" },
      { en: `On the night shift, red spreads along the network lines and encrypts every device it reaches. Stop it in the procedure's order: ${order.map((x) => `${x[0]} ${x[1]}`).join(" · ")}.`,
        zh: `值班時，紅色會沿著網路線擴散，碰到的裝置都會被加密。照流程的順序擋住它：${order.map((x) => `${x[0]} ${x[2]}`).join("・")}。` },
      { en: "★ marks the critical systems. If one is encrypted, or you fall for a trap, you lose a shield. Three, and the night is lost.",
        zh: "★ 是關鍵系統。它被加密，或是你踩到陷阱，就少一面盾牌。三面都沒了，今晚就輸了。" },
      { en: "Press Take the call to start.", zh: "按「接電話」開始。" }] }));
  }

  /* ------------------------------------------------------------------ the night: state */
  function startShift() {
    loop.stop();
    if (G.help) G.help.clear();      // 11/27 review: last night's mistakes (and their chips) go with "Try again" / "Play again"
    const nodes = {};
    for (const n of NODES) nodes[n.k] = { state: n.start ? "infected" : "clean", pct: n.start || 0, since: 0, lost: false };
    S = { clock: 0, over: false, paused: false, hold: 0, nodes, lostAt: {}, cut: new Set(), acct: true, reseedIdx: 0, reseedT: 0, played: {}, stepAt: {}, seq: 0,
      uses: { isolate: sh.isolate, cut: sh.cut }, sel: null, drag: null, hover: null, analyzing: 0, analyzed: false, restored: false, notified: false, plan: false, soc: false,
      shields: sh.shields, losses: [], traps: [], points: 0, log: [], contained: false, endAt: 0, open: null, dial: "", alarmed: {}, paid: false, usb: false, dragEnd: 0, dirty: false,
      order: [], lastMistake: null, encTip: false };      // 11/27: the good moves in the order played, and the last slip (for the Help panel)
    B = null;
    if (GD) Object.assign(GD, { stage: "plug", at: 0, t0: performance.now(), c: null, key: null, x: null });     // 11/27: the night waits for the first move
    st.scene("ir_night", 0.55);
    H = CB.hud({ pause: true, clock: story.start, clockLabel: bi("ransomware", "勒索軟體"), shields: sh.shields });
    G.onPause = () => togglePause();
    window.scrollTo({ top: 0 });
    st.body.innerHTML = `<div class="ir-play">
      <div class="rs-side ir-left"><div id="irWho">${CB.personHTML(CALLER, bi(story.lines.start.en, story.lines.start.zh), { id: "irSay" })}</div>
        ${phoneHTML()}
        <section class="rs-notebook ir-log" aria-label="Incident log"><h3>${bi("Incident log", "事件紀錄")}</h3><ol id="irLog"></ol></section></div>
      <div class="ir-center">
        <div class="ir-map-wrap" id="irWrap"><svg class="ir-map" id="irMap" viewBox="0 ${-TOP} 1000 ${600 + TOP}" role="group" aria-label="Network map of the resort 渡假村的網路圖">${mapSVG()}</svg>
          <div class="ir-sweep" id="irSweep" aria-hidden="true"></div>
          <div class="ir-close" id="irClose" hidden></div>
          <p class="ir-map-tip" id="irTip" hidden></p></div>
        <section class="ir-status" id="irStatus"></section></div>
      <div class="rs-side ir-right">
        <section class="ir-tools" id="irTools"></section>
        <section class="ir-hand-box"><h3>${bi("Your cards", "手上的卡")}<small>${bi("Drag one onto the map to play it.", "拖到網路圖上就是出牌。")}</small></h3><div class="ir-hand" id="irHand" role="group" aria-label="Your cards"></div></section>
        <section class="ir-desk"><div class="ir-usb" id="irUsb" tabindex="0" role="button" aria-label="USB backup drive from last Friday. Drag it onto a device.">${SVG.usb}<p>${bi("USB backup drive · last Friday", "USB 備份硬碟・上週五")}</p></div></section>
      </div></div>`;
    S.pause = CB.pauseLayer(st, () => togglePause(false));
    if (window.__irKeys) document.removeEventListener("keydown", window.__irKeys);      // one listener, whichever round is playing
    window.__irKeys = irEsc;
    document.addEventListener("keydown", irEsc);
    $("#irMap").addEventListener("click", mapClick);
    $("#irMap").addEventListener("keydown", mapKey);
    $("#irKeys").addEventListener("click", (ev) => { const b = ev.target.closest("[data-k]"); if (b) dialKey(b.dataset.k); });
    $("#irDial").addEventListener("click", dialOut);
    $("#irDel").addEventListener("click", () => { S.dial = S.dial.slice(0, -1); lcd(); });
    draggable($("#irUsb"), "usb", { tap: () => nudge($("#irUsb")), key: () => { if (!S.usb) { pick("usb"); toTarget(); } } });
    draggable($(`.ir-node[data-k="offline"]`), "tape", { ghost: () => el("div", "ir-tape-ghost", SVG.tape), tap: () => openClose("offline"), key: () => { pick("tape"); toTarget(); } });
    log(bi("Yi-Chen's screen at the front office shows a ransom note.", "櫃台易真的螢幕跳出勒索畫面。"), "is-bad");
    log(bi(story.lines.fog.en, story.lines.fog.zh), "is-quiet");
    hand(); tools(); drawMap(); status(); lcd();
    H.points(0, 0);
    setNow(shiftNow);      // 11/27
    loop.start();
    setTimeout(() => { if (S && !S.over && !S.open) openClose("night_pc"); }, reduceMotion ? 0 : 900);   // Yi-Chen's PC, up close
    // 11/27: Yi-Chen asks "What do I do?" and nobody answered. You do, and the first thing you say is the cable.
    const s0 = S;
    setTimeout(() => {
      if (S !== s0 || S.over || S.soc || S.played.unplug || S.traps.length) return;
      say(bi("You: \"Pull the network cable out of your PC, and don't switch it off.\"", "你：「把電腦的網路線拔掉，不要關機。」"));      // short: the bubble holds 150 px
    }, reduceMotion ? 1200 : 2200);
  }

  const say = (html, mood) => CB.say($("#irSay"), html, mood);
  function log(html, cls) {
    S.log.push({ t: clockAt(S.clock), html, cls });
    const ol = $("#irLog");
    if (ol) ol.insertAdjacentHTML("afterbegin", `<li class="is-new ${cls || ""}"><time>${esc(clockAt(S.clock))}</time><p>${html}</p></li>`);
  }

  /* ------------------------------------------------------------------ the map */
  const ICONS = {
    pc: `<rect x="-15" y="-13" width="30" height="20" rx="2.5" class="ir-ic"/><path d="M-6 11h12M0 7v4" class="ir-ic-l"/>`,
    server: `<rect x="-13" y="-16" width="26" height="32" rx="3" class="ir-ic"/><path d="M-8-8h16M-8 0h16M-8 8h16" class="ir-ic-l"/>`,
    nas: `<rect x="-15" y="-12" width="30" height="24" rx="3" class="ir-ic"/><circle cx="-6" cy="0" r="3" class="ir-ic-l"/><circle cx="6" cy="0" r="3" class="ir-ic-l"/>`,
    till: `<path d="M-14 4h28v9h-28z" class="ir-ic"/><path d="M-10 4l2-15h16l2 15" class="ir-ic"/><path d="M-5-6h10" class="ir-ic-l"/>`,
    tape: `<rect x="-15" y="-11" width="30" height="22" rx="3" class="ir-ic"/><circle cx="-6" cy="0" r="4.5" class="ir-ic-l"/><circle cx="6" cy="0" r="4.5" class="ir-ic-l"/>`,
  };
  const R = 27, CIRC = 2 * Math.PI * R;

  function tunnelD() {
    const to = NODE[NET.to];
    return `M${NET.x} ${-TOP + 52} C ${NET.x} ${40}, ${to.x + 70} ${to.y - 90}, ${to.x + 18} ${to.y - R + 2}`;
  }

  function mapSVG() {
    const zones = story.zones.map((z) => `<g class="ir-zone is-${z.k}" data-zone="${z.k}"><rect x="${z.x}" y="${z.y}" width="${z.w}" height="${z.h}" rx="14"/>
      <text x="${z.x + 14}" y="${z.y + 22}" class="ir-zone-t">${esc(z.en)}</text><text x="${z.x + 14}" y="${z.y + 39}" class="ir-zone-z">${esc(z.zh)}</text></g>`).join("");
    const links = LINKS.map((l, i) => { const a = NODE[l.a], b = NODE[l.b]; return `<line class="ir-link" data-i="${i}" x1="${a.x}" y1="${a.y}" x2="${b.x}" y2="${b.y}"/>`; }).join("");
    // 11/22: devices, switches and the crew's line take the keyboard too (Tab to one, Enter or Space = a click there)
    const sws = SW.map((s) => `<g class="ir-sw" data-sw="${s.k}" tabindex="0" role="button" transform="translate(${s.x} ${s.y})"><rect x="-20" y="-11" width="40" height="22" rx="6"/>
      <path d="M-12-3h24M-12 3h24" class="ir-sw-l"/><path d="M-13-13l26 26" class="ir-sw-x"/><title>${esc(s.en)} ${esc(s.zh)}</title></g>`).join("");
    const nodes = NODES.map((n) => `<g class="ir-node is-${n.type}${n.critical ? " is-crit" : ""}" data-k="${n.k}" tabindex="0" role="button" transform="translate(${n.x} ${n.y})">
      <circle r="${R + 6}" class="ir-halo"/><circle r="${R + 13}" class="ir-bubble"/><circle r="${R}" class="ir-disc"/><circle r="${R}" class="ir-ring" stroke-dasharray="${CIRC.toFixed(1)}" stroke-dashoffset="${CIRC.toFixed(1)}" transform="rotate(-90)"/>
      <g class="ir-icon">${ICONS[n.type]}</g><text class="ir-q" y="7">?</text>
      <g class="ir-badge" transform="translate(${R - 4} ${-R + 4})"><circle r="11"/><text y="4"></text></g>
      <text class="ir-label" y="${R + 18}">${esc(n.en)}</text><text class="ir-label-z" y="${R + 32}">${esc(n.zh)}</text>${n.critical ? `<text class="ir-crit" y="${-R - 10}">★</text>` : ""}<title>${esc(n.en)} ${esc(n.zh)}${n.critical ? " · ★ critical system: if it is encrypted, you lose a shield 關鍵系統：被加密就少一面盾牌" : ""}</title></g>`).join("");   // 11/27: what the star means
    const net = `<g class="ir-net" id="irNet"><rect x="${NET.x - 140}" y="${-TOP + 6}" width="280" height="46" rx="10"/>
      <text x="${NET.x}" y="${-TOP + 25}" class="ir-net-t">Internet <tspan class="ir-net-tz">網際網路</tspan> · ${esc(NET.ip)}</text><text x="${NET.x}" y="${-TOP + 42}" class="ir-net-z">VPN · ${esc(NET.user)} · attacker ${esc("歹徒")}</text></g>
      <path class="ir-tunnel" id="irTunnel" d="${tunnelD()}"/><path class="ir-tunnel-hit" id="irTunnelHit" tabindex="-1" role="button" d="${tunnelD()}"><title>The crew's VPN line 歹徒的 VPN 連線</title></path>`;
    return `<defs><radialGradient id="irGlow"><stop offset="0" stop-color="#ff4b3a" stop-opacity=".55"/><stop offset="1" stop-color="#ff4b3a" stop-opacity="0"/></radialGradient></defs>
      <g class="ir-zones">${zones}</g>${net}<g class="ir-links">${links}</g><g class="ir-sws">${sws}</g><g class="ir-pulses" id="irPulses"></g><g class="ir-nodes">${nodes}</g><g class="ir-fx" id="irFx"></g>`;
  }

  const active = (k) => ["infected", "encrypted"].includes(S.nodes[k].state);
  const linkOpen = (l) => !(l.via && S.cut.has(l.via));
  const neighbours = (k) => LINKS.filter((l) => (l.a === k || l.b === k) && linkOpen(l)).map((l) => (l.a === k ? l.b : l.a));
  const PRIORITY = ["fileserver", "doors", "backup_nas", "pos_bo", "fo_pc", "acct_pc", "event_pc", "pos1", "pos2", "night_pc"];
  const visible = (k) => S.soc || NODE[k].seen || NODE[k].safe;
  const aim = () => S.drag || S.sel;

  function targetOk(kind, k) {
    const n = NODE[k], s = S.nodes[k];
    if (!n || n.safe) return false;
    if (kind === "isolate") return visible(k) && !["isolated", "unplugged", "off", "restored"].includes(s.state);
    if (kind === "usb") return !S.usb && (n.type === "server" || n.type === "nas") && visible(k) && ["infected", "encrypted"].includes(s.state);
    return false;
  }
  const zoneTarget = (kind, hit) => kind === "tape" && (hit.zone === "server" || (hit.node && NODE[hit.node].zone === "server"));

  function drawMap() {
    const svg = $("#irMap");
    if (!svg) return;
    const k0 = aim(), hv = S.hover || {};
    for (const n of NODES) {
      const g = $(`.ir-node[data-k="${n.k}"]`, svg), s = S.nodes[n.k], vis = visible(n.k);
      const tgt = k0 && (targetOk(k0, n.k) || (k0 === "tape" && n.zone === "server"));
      g.setAttribute("class", `ir-node is-${n.type}${n.critical ? " is-crit" : ""} st-${vis ? s.state : "unknown"}${tgt ? " is-target" : ""}${tgt && hv.node === n.k ? " is-hover" : ""}${S.open === n.k ? " is-open" : ""}${n.safe && S.analyzed && S.contained && !S.restored ? " is-ready" : ""}`);
      $(".ir-ring", g).setAttribute("stroke-dashoffset", (CIRC * (1 - (vis ? s.pct : 0))).toFixed(1));
      const badge = { infected: `${Math.round(s.pct * 100)}`, encrypted: "🔒", isolated: "EDR", unplugged: "✂", off: "OFF", restored: "✓" }[s.state] || "";
      $(".ir-badge text", g).textContent = vis ? badge : "";
    }
    for (const l of LINKS) {
      const line = $(`.ir-link[data-i="${LINKS.indexOf(l)}"]`, svg);
      const hot = (active(l.a) && S.nodes[l.a].state !== "isolated") || active(l.b);
      line.setAttribute("class", `ir-link${linkOpen(l) ? "" : " is-cut"}${S.soc && hot && linkOpen(l) ? " is-hot" : ""}`);
    }
    for (const s of SW) {
      const tgt = k0 === "cut" && !S.cut.has(s.k) && S.uses.cut > 0;
      $(`.ir-sw[data-sw="${s.k}"]`, svg).setAttribute("class", `ir-sw${S.cut.has(s.k) ? " is-cut" : ""}${tgt ? " is-target" : ""}${tgt && hv.sw === s.k ? " is-hover" : ""}`);
    }
    const tun = $("#irTunnel"), tgtT = k0 === "cut" && S.acct && S.soc;
    tun.setAttribute("class", `ir-tunnel${!S.soc ? " is-hidden" : S.acct ? " is-live" : " is-cut"}${tgtT ? " is-target" : ""}${tgtT && hv.tunnel ? " is-hover" : ""}`);
    $("#irNet").setAttribute("class", `ir-net${!S.soc ? " is-hidden" : S.acct ? " is-live" : " is-cut"}`);
    $("#irTunnelHit").setAttribute("tabindex", S.soc && S.acct ? "0" : "-1");     // the keyboard reaches the line once it can be seen and cut
    $("#irWrap").classList.toggle("is-aiming", !!k0);
  }

  function svgEl(tag, attrs) {
    const e = document.createElementNS("http://www.w3.org/2000/svg", tag);
    for (const [k, v] of Object.entries(attrs || {})) e.setAttribute(k, v);
    return e;
  }

  function pulse(a, b, force) {
    if (reduceMotion || (!S.soc && !force)) return;
    const p = $("#irPulses"), A = NODE[a], Bn = NODE[b];
    const c = svgEl("circle", { r: 7, class: "ir-pulse" });
    c.style.setProperty("--x0", `${A.x}px`); c.style.setProperty("--y0", `${A.y}px`); c.style.setProperty("--x1", `${Bn.x}px`); c.style.setProperty("--y1", `${Bn.y}px`);
    p.appendChild(c);
    setTimeout(() => c.remove(), 900);
  }

  function comet(k) {      // the crew sends another one down the VPN line
    if (reduceMotion || !S.soc) return;
    const path = $("#irTunnel"), fx = $("#irFx");
    if (!path || !fx) return;
    const L = path.getTotalLength(), c = svgEl("circle", { r: 9, class: "ir-comet" });
    fx.appendChild(c);
    const t0 = performance.now();
    const step = (t) => {
      const f = Math.min(1, (t - t0) / 950), pt = path.getPointAtLength(L * f);
      c.setAttribute("cx", pt.x.toFixed(1)); c.setAttribute("cy", pt.y.toFixed(1));
      if (f < 1) requestAnimationFrame(step); else { c.remove(); if (k !== NET.to) pulse(NET.to, k, true); }
    };
    requestAnimationFrame(step);
  }

  function sparks(x, y, cls) {
    if (reduceMotion) return;
    const fx = $("#irFx");
    for (let i = 0; i < 10; i++) {
      const a = (i / 10) * Math.PI * 2, r = 26 + (i % 3) * 10;
      const s = svgEl("circle", { cx: x, cy: y, r: 3.2, class: `ir-spark ${cls || ""}` });
      s.style.setProperty("--dx", `${(Math.cos(a) * r).toFixed(1)}px`); s.style.setProperty("--dy", `${(Math.sin(a) * r).toFixed(1)}px`);
      fx.appendChild(s);
      setTimeout(() => s.remove(), 700);
    }
  }

  function wave(x, y) {    // the restore rolls out from the safe across the network
    if (reduceMotion) return;
    const fx = $("#irFx"), w = svgEl("circle", { cx: x, cy: y, r: 1100, class: "ir-wave" });
    fx.appendChild(w);
    setTimeout(() => w.remove(), 1700);
  }

  /* ------------------------------------------------------------------ the clock and the spread */
  function tick(dt) {
    guideSync();      // 11/27: the first-time guide's notes come and go with the play
    if (!S || S.over || S.paused || S.hold || document.hidden) return;
    // 11/27: while the first-time guide waits for a move, the night stands still (the clock, the encryption, the spread and
    // the crew's new ones). Not S.hold or S.paused: those stop the moves too. The analysis and the redraw go on.
    const held = guideHeld();
    if (!held) S.clock = Math.min(TEND, S.clock + dt * sh.rate);
    for (const n of held ? [] : NODES) {
      const s = S.nodes[n.k];
      if (!active(n.k)) continue;
      if (s.state === "infected") {
        s.pct = Math.min(1, s.pct + dt / (sh.encrypt * ((sh.by_type || {})[n.type] || 1)));     // more data takes longer to encrypt
        if (n.critical && s.pct > 0.5 && visible(n.k) && !S.alarmed[n.k]) { S.alarmed[n.k] = true; CB.SFX.play("alarm"); }
        if (s.pct >= 1) { s.state = "encrypted"; encrypted(n); if (S.hold || S.over) return; }
      }
      s.since += dt;
      if (s.since >= sh.spread) {
        const next = neighbours(n.k).filter((k) => S.nodes[k].state === "clean" && !NODE[k].safe).sort((x, y) => PRIORITY.indexOf(x) - PRIORITY.indexOf(y))[0];
        if (next) { infect(next, n.k); pulse(n.k, next); s.since = 0; }
      }
    }
    if (S.acct && !held) {
      S.reseedT += dt;
      if (S.reseedT >= sh.reseed) {
        S.reseedT = 0;
        const k = (story.reseed || []).slice(S.reseedIdx).find((x) => S.nodes[x].state === "clean");
        S.reseedIdx += 1;
        if (k) {
          infect(k, "vpn");
          comet(k);
          if (S.soc) { log(bi(`${NODE[k].en}: ${story.lines.reseed.en}`, `${NODE[k].zh}：${story.lines.reseed.zh}`), "is-bad"); say(bi(story.lines.reseed.en, story.lines.reseed.zh), "is-no"); }
        }
      }
    }
    if (S.analyzing > 0) {
      S.analyzing -= dt;
      if (S.analyzing <= 0) {
        S.analyzed = true;
        say(bi(story.lines.analyzed.en, story.lines.analyzed.zh), "is-good"); log(bi(story.lines.analyzed.en, story.lines.analyzed.zh), "is-ok");
        CB.SFX.play("ding");
        hand();
      }
    }
    const spreading = NODES.some((n) => active(n.k) && neighbours(n.k).some((k) => S.nodes[k].state === "clean" && !NODE[k].safe));
    const encrypting = NODES.some((n) => S.nodes[n.k].state === "infected");   // still connected and encrypting (review: was missing)
    if (!S.contained && S.soc && !S.acct && !spreading && !encrypting) { S.contained = true; say(bi(story.lines.contained.en, story.lines.contained.zh), "is-good"); log(bi(story.lines.contained.en, story.lines.contained.zh), "is-ok"); CB.SFX.play("win"); hand(); }
    if (S.contained && (spreading || encrypting || S.acct)) S.contained = false;
    H.clock(clockAt(S.clock));
    $("#irWrap").classList.toggle("is-alarm", CRIT.some((k) => S.nodes[k].state === "infected" && S.nodes[k].pct > 0.5 && visible(k)));
    drawMap(); status(); closeState();
    if (S.dirty && !S.drag) { S.dirty = false; hand(); tools(); }
    if (S.clock >= TEND && !S.endAt) S.endAt = performance.now() + 400;
    if (S.endAt && performance.now() >= S.endAt) endShift();
  }

  /* a device that finishes encrypting flashes its own small ransom screen on the map, then shrinks into its lock */
  function ransomPop(n) {
    const wrap = $("#irWrap"), svg = $("#irMap");
    if (!wrap || !svg) return;
    const r = svg.getBoundingClientRect(), wr = wrap.getBoundingClientRect(), k = G.k();
    const x = (r.left - wr.left + (n.x / 1000) * r.width) / k, y = (r.top - wr.top + ((n.y + TOP) / (600 + TOP)) * r.height) / k;
    const p = el("div", "ir-pop", `<p class="ir-pop-h">YOUR FILES ARE ENCRYPTED<small lang="zh-Hant">你的檔案都被加密了</small></p><p class="ir-pop-n">${bi(n.en, n.zh)}</p>
      <p class="ir-pop-t">${bi("Pay 5 BTC or lose them", "付 5 個比特幣，不然檔案就沒了")}</p>`);
    p.style.left = `${x}px`; p.style.top = `${y}px`;
    wrap.appendChild(p);
    CB.SFX.play("static");
    setTimeout(() => { p.classList.add("is-out"); setTimeout(() => p.remove(), 450); }, reduceMotion ? 1800 : 2600);
  }

  function infect(k, from) {     // 11/27: from = where it came from (a device, or "vpn"), for the "why" when a key system is lost
    const s = S.nodes[k];
    if (s.state !== "clean") return;
    s.state = "infected"; s.pct = 0; s.since = 0; s.from = from || null;
    if (S.soc) log(bi(`${NODE[k].en} starts encrypting.`, `${NODE[k].zh}開始加密。`), "is-bad");
  }

  async function encrypted(n) {
    const s = S.nodes[n.k];
    if (S.soc || n.seen) { log(bi(`${n.en} is encrypted.`, `${n.zh}被加密了。`), "is-bad"); ransomPop(n); }
    if (!n.critical) {
      // 11/27: the first device that locks up (Yi-Chen's PC, 5 s in) looked like a lost night: say it costs no shield
      if ((S.soc || n.seen) && !S.encTip) {
        S.encTip = true;
        const pc = n.type === "pc" || n.type === "till";
        tipNote(bi(`${n.en} is encrypted. It has no ★, so no shield is lost, but it can still spread along its lines until you cut it off. ${pc ? "Pull its network cable." : "Use an EDR shield or the cutter."}`,
          `${n.zh}被加密了。它沒有 ★，不會少盾牌，可是在你把它切開之前，它還能沿著網路線擴散。${pc ? "把它的網路線拔掉。" : "用端點防護盾牌或剪刀把它切開。"}`), 7000);
      }
      return;
    }
    if (s.lost) return;
    s.lost = true;
    S.lostAt[n.k] = clockAt(S.clock);
    S.lastMistake = { chosen: "encrypted", item: n.k };      // 11/27: what would have stopped it, on the cut scene and in the Help panel
    await lose({ kind: "system", node: n, hit_en: `${n.en} is encrypted`, hit_zh: `${n.zh}被加密了`, beats: critBeats(n), why: critWhy(n), ctx: shiftCtx(), at: clockAt(S.clock) });
  }

  function critBeats(n) {
    const t = clockAt(S.clock);
    if (n.k === "doors") return [{ time: t, en: "Staff badges stop opening the doors, and the door log stops recording who goes where.", zh: "員工卡刷不開門，門禁紀錄也停了，看不出誰進出了哪裡。" }];
    if (n.k === "pos_bo") return [{ time: t, en: "The POS back office is encrypted: every till in the restaurant and the bar stops taking orders.", zh: "收銀後台被加密，餐廳和酒吧的收銀機全部不能點單結帳。" }];
    return [{ time: t, en: "The online backups and their snapshots are encrypted. Only what is offline is left.", zh: "線上備份和快照都被加密了，只剩下離線的東西。" }];
  }

  async function lose(x) {
    S.shields -= 1;
    const left = S.shields;   // shields after this slip (cuts queue up if another comes first)
    S.losses.push(x);
    H.shields(S.shields, sh.shields, true);
    st.hit();
    S.hold += 1;
    guideSync();      // 11/27: a guide note never sits on top of the cut scene
    await wait(500);
    // 11/27: why, said on the cut scene (with Ask the IT Assistant) and kept in the Help panel (st.cut calls G.help.mistake)
    await st.cut({ why: x.why, ctx: x.ctx, at: x.at, scene: x.kind === "system" && x.node.k === "pos_bo" ? "rush_pos" : "ir_night", beats: x.beats, hit_en: x.hit_en, hit_zh: x.hit_zh,
      inset: x.rule ? `<div class="ir-rule"><p class="ir-rule-k">${bi("The procedure says", "流程寫著")}</p><p>${bi(x.rule.en, x.rule.zh)}</p><small>${bi(`“${PROC.name_en}”, knowledge graph`, `知識圖「${PROC.name_zh}」`)}</small></div>`
        // 11/26 (front-end review K66): the POS note only for the POS back office, each server its own note
        : x.kind === "system" ? (x.node.k === "pos_bo" ? `<img class="rs-ransom" src="/lakeside/static/games/img/ransom.png" alt="Ransom note on the restaurant POS 收銀機上的勒索畫面">` : serverNote(x.node)) : "",
      shields: left, go: left > 0 ? bi("Back to the map", "回到網路圖") : bi("Continue", "繼續") });
    S.hold -= 1;
    if (S.shields <= 0 && !S.hold) gameOver();   // only after the last queued cut
  }

  function togglePause(force) {
    if (!S || S.over) return;
    S.paused = typeof force === "boolean" ? force : !S.paused;
    // 11/26 (front-end review K61): the pause layer only stopped the mouse; the play area is inert too, so Tab and Enter
    // can't reach the phone, the cards or the tools behind it. Resume puts the keyboard back where it was.
    const play = $(".ir-play", st.body);
    if (play) {
      if (S.paused) S.pauseFocus = play.contains(document.activeElement) ? document.activeElement : null;
      play.inert = S.paused;
    }
    S.pause.set(S.paused);
    H.paused(S.paused);
    if (!S.paused && S.pauseFocus) { if (S.pauseFocus.isConnected) S.pauseFocus.focus({ preventScroll: true }); S.pauseFocus = null; }
  }

  /* ------------------------------------------------------------------ dragging things onto the map */
  function hitAt(x, y) {     // what is under the pointer, worked out on the map's own coordinates
    const svg = $("#irMap");
    if (!svg) return {};
    const r = svg.getBoundingClientRect();
    if (x < r.left || x > r.right || y < r.top || y > r.bottom) return {};
    const pt = svg.createSVGPoint();
    pt.x = x; pt.y = y;
    const p = pt.matrixTransform(svg.getScreenCTM().inverse());
    const node = NODES.find((n) => Math.hypot(p.x - n.x, p.y - n.y) <= R + 14);
    const sw = SW.find((s) => Math.abs(p.x - s.x) <= 28 && Math.abs(p.y - s.y) <= 20);
    const zone = story.zones.find((z) => p.x >= z.x && p.x <= z.x + z.w && p.y >= z.y && p.y <= z.y + z.h);
    const e = document.elementFromPoint(x, y);
    const tunnel = !node && !sw && !!(e && e.closest(".ir-tunnel-hit"));
    return { node: node && node.k, sw: sw && sw.k, tunnel, zone: zone && zone.k, map: true };
  }

  function draggable(elm, kind, o) {
    if (!elm) return;
    let p = null;
    elm.addEventListener("pointerdown", (ev) => {
      if (ev.button !== 0 || !S || S.over || S.hold || S.paused) return;
      // 11/27: a locked or used-up card or tool says why, instead of doing nothing
      if (elm.classList.contains("is-locked") || elm.classList.contains("is-used")) { if (o && o.blocked) o.blocked(); return; }
      ev.preventDefault();
      ev.stopPropagation();
      const r = elm.getBoundingClientRect();
      p = { x0: ev.clientX, y0: ev.clientY, dx: Math.min(ev.clientX - r.left, 80), dy: Math.min(ev.clientY - r.top, 40), moved: false, ghost: null };
      CB.cap(elm, ev.pointerId);
    });
    elm.addEventListener("pointermove", (ev) => {
      if (!p) return;
      if (!p.moved && Math.hypot(ev.clientX - p.x0, ev.clientY - p.y0) > 6) {
        // 11/27: and the rest of the condition, which was only in the tape's close-up
        if (kind === "tape" && !S.analyzed) { p = null; return tipNote(bi(`Not yet: the SOC has to find out how they got in first, or the restore brings them back. ${RESTORE_WHEN[0]}`, `還不行：資安監控中心要先查出他們怎麼進來的，不然一還原歹徒又回來了。${RESTORE_WHEN[1]}`)); }
        p.moved = true;
        const g = o && o.ghost ? o.ghost() : elm.cloneNode(true);
        g.classList.add("ir-ghost");
        g.removeAttribute("id");
        // 11/26 (front-end review K69): the copy lives outside the scaled canvas: canvas width, then drawn at the canvas's scale
        if (!(o && o.ghost)) g.style.width = `${elm.getBoundingClientRect().width / (G.k() || 1)}px`;
        g.style.transformOrigin = "0 0";
        document.body.appendChild(g);
        p.ghost = g;
        elm.classList.add("is-lifted");
        S.drag = kind; S.sel = null; tip();
        CB.SFX.play("paper");
        drawMap();
        guideSync();      // 11/27: a guide note steps aside while something is in hand
      }
      if (!p || !p.ghost) return;
      p.ghost.style.transform = `translate(${ev.clientX - p.dx}px, ${ev.clientY - p.dy}px) rotate(-3deg) scale(${G.k() || 1})`;      // 11/26 (front-end review K69)
      const h = hitAt(ev.clientX, ev.clientY);
      S.hover = h;
      p.ghost.classList.toggle("is-over", valid(kind, h));
      drawMap();
    });
    const end = (ev) => {
      if (!p) return;
      const { moved, ghost } = p;
      p = null;
      elm.classList.remove("is-lifted");
      if (ghost) ghost.remove();
      S.drag = null; S.hover = null;
      S.dragEnd = performance.now();
      if (!moved) { drawMap(); if (o && o.tap) o.tap(); return; }
      const h = hitAt(ev.clientX, ev.clientY);
      // 11/27: let go beside the map too (a card dropped there said nothing, and looked played)
      if (!dropOn(kind, h)) { drawMap(); const m = missText(kind); if (m) tipNote(m); }
      if (S.dirty) { S.dirty = false; hand(); tools(); }
    };
    elm.addEventListener("pointerup", end);
    elm.addEventListener("pointercancel", end);
    // 11/23 review: the pointer was taken away under the drag: nothing is dropped, and the copy under the finger goes too
    elm.addEventListener("lostpointercapture", () => {
      if (!p) return;
      const { ghost } = p;
      p = null;
      elm.classList.remove("is-lifted");
      if (ghost) ghost.remove();
      if (!S) return;
      S.drag = null; S.hover = null;
      if (!S.over) drawMap();
    });
    elm.addEventListener("keydown", (ev) => {
      if (elm.classList.contains("is-locked") || elm.classList.contains("is-used")) return;     // 11/22: like the pointer, the keyboard leaves these alone
      if ((ev.key === "Enter" || ev.key === " ") && o && o.key) { ev.preventDefault(); o.key(); }
    });
  }

  function valid(kind, h) {
    if (!h || !h.map) return false;
    if (kind === "isolate") return !!h.node && targetOk("isolate", h.node) && S.uses.isolate > 0;
    if (kind === "cut") return (!!h.sw && !S.cut.has(h.sw) && S.uses.cut > 0) || (h.tunnel && S.acct);
    if (kind === "usb") return !!h.node && targetOk("usb", h.node);
    if (kind === "tape") return zoneTarget(kind, h);
    return PLAYS.includes(kind);
  }

  function dropOn(kind, h) {
    if (!valid(kind, h)) return false;
    if (kind === "isolate") use("isolate", h.node);
    else if (kind === "cut") { if (h.tunnel && S.acct && !(h.sw && !S.cut.has(h.sw))) use("disable"); else use("cut", h.sw); }
    else if (kind === "usb") trap(CARD.usb, h.node);
    else if (kind === "tape") use("restore");
    else use(kind);
    return true;
  }

  function missText(kind) {
    if (kind === "isolate") return bi("Drop the shield on a device that is still connected.", "把盾牌放在還連著網路的裝置上。");
    if (kind === "cut") return bi("Drop the cutter on a switch, or on the crew's line from the internet.", "把剪刀放在交換器上，或是歹徒從網路進來的那條線上。");
    if (kind === "usb") return bi("Nothing to plug it into there.", "那裡沒有地方可以插。");
    if (kind === "tape") return bi("Restore onto the server room.", "要還原到機房。");
    if (PLAYS.includes(kind)) return dragCard();      // 11/27
    return "";
  }
  // 11/27: a card is played by dragging it onto the map; a click only wiggled it
  const dragCard = () => bi("Drag it onto the map to play it.", "拖到網路圖上才算出牌。");
  const RESTORE_WHEN = ["Then restore once nothing is encrypting or spreading and the crew's line is cut.", "查清楚之後，等沒有東西在加密或擴散、歹徒的連線也切斷了，再還原。"];

  /* Click instead of drag (and the keyboard): pick a tool, then click where it goes. */
  function pick(kind) {
    if (!S || S.over || S.hold || S.paused) return;      // 11/26 (front-end review K61): not while paused
    if ((kind === "isolate" || kind === "cut") && toolOff(kind)) return tipNote(toolBlock(kind));      // 11/22: a locked or used-up tool is not picked up (11/27: and says why)
    if (kind === "tape" && !S.analyzed) return tipNote(bi(`Not yet: the SOC has to find out how they got in first. ${RESTORE_WHEN[0]}`, `還不行：資安監控中心要先查出他們怎麼進來的。${RESTORE_WHEN[1]}`));
    if (kind === "usb" && S.usb) return;
    S.sel = S.sel === kind ? null : kind;
    CB.SFX.play("tap");
    tip(); tools(); drawMap();
    guideSync();      // 11/27: a guide note steps aside while a tool is in hand
  }

  function mapClick(ev) {
    if (!S || S.over || S.hold || performance.now() - S.dragEnd < 80) return;
    mapAct(hitAt(ev.clientX, ev.clientY));
  }
  function mapAct(h) {
    if (S.sel) {
      if (dropOn(S.sel, h)) return;
      return tipNote(missText(S.sel));
    }
    if (h.node) {
      if (!visible(h.node)) return tipNote(bi("You can't see that one from the front office. The SOC can.", "從櫃台看不到那一台，資安監控中心看得到。"));
      openClose(h.node);
    } else if (h.tunnel && S.soc) tipNote(bi(`The crew's VPN session as ${NET.user}, from ${NET.ip}. Cut it with the SOC's cutter.`, `歹徒用 ${NET.user} 從 ${NET.ip} 連進來的 VPN。用資安監控中心的剪刀剪斷。`));
    else if (S.open) closeClose();
  }
  /* 11/22: the keyboard on the map. Tab to a device, a switch or the crew's line; Enter or Space there is a click there: it
     opens the device up close, or drops what you picked up with Enter (an SOC tool, the USB drive; the offline tape's own
     Enter picks the tape up). */
  function mapKey(ev) {
    if ((ev.key !== "Enter" && ev.key !== " ") || ev.defaultPrevented || !S || S.over || S.hold || S.paused) return;
    const t = ev.target instanceof Element ? ev.target.closest(".ir-node, .ir-sw, .ir-tunnel-hit") : null;
    if (!t || (t.dataset.k && NODE[t.dataset.k] && NODE[t.dataset.k].safe)) return;     // the tape in the safe has its own Enter
    ev.preventDefault();
    const k = t.dataset.k, sw = t.dataset.sw;
    mapAct(k ? { node: k, zone: NODE[k].zone, map: true } : sw ? { sw, map: true } : { tunnel: true, map: true });
    if (k && S.open === k) { const x = $(".ir-close-x", $("#irClose")); if (x) x.focus({ preventScroll: true }); }   // into the close-up
  }

  /* 11/23 (review G1): Escape puts back a tool you picked up, or closes the device up close, like their Cancel and ×.
     Marked as used, so it doesn't also close the game window (common.js). */
  function irEsc(ev) {
    if (ev.key !== "Escape" || ev.defaultPrevented || !S || S.over || S.hold || S.paused) return;
    if (S.sel) { ev.preventDefault(); S.sel = null; tip(); tools(); drawMap(); return; }
    if (!S.open) return;
    ev.preventDefault();
    const k = S.open, box = $("#irClose"), inside = !!box && box.contains(document.activeElement);
    closeClose();
    const g = inside && $(`.ir-node[data-k="${k}"]`, $("#irMap"));     // from inside the close-up: back to its device on the map
    if (g) g.focus({ preventScroll: true });
  }

  // picked up with the keyboard: go straight to the place on the map where it matters most. 11/22 (review: the first target in
  // page order was an office PC, so Enter, Enter put a shield there): devices in the order the ransomware goes for them
  // (PRIORITY), the ones already encrypted last; the cutter goes to the crew's line first, then to a switch.
  function toTarget() {
    const rank = (g) => { const k = g.dataset.k, i = PRIORITY.indexOf(k); return (S.nodes[k].state === "encrypted" ? PRIORITY.length + 1 : 0) + (i < 0 ? PRIORITY.length : i); };
    const node = $$("#irMap .ir-node.is-target").sort((a, b) => rank(a) - rank(b))[0];
    const n = ($("#irTunnel.is-target") && $("#irTunnelHit")) || $("#irMap .ir-sw.is-target") || node;
    if (n) n.focus({ preventScroll: true });
  }

  function nudge(e) { e.classList.remove("is-nudge"); void e.offsetWidth; e.classList.add("is-nudge"); }

  function tipNote(html, ms) {     // 11/27: ms, so a reason stays long enough to read
    const t = $("#irTip");
    if (!t) return;
    t.hidden = false;
    t.innerHTML = html;
    clearTimeout(t._h);
    // 11/26 (front-end review K65): a tool still in hand gets its own tip and Cancel back, instead of keeping the miss note
    t._h = setTimeout(() => { if (!S || S.over) return; if (S.sel) tip(); else t.hidden = true; }, ms || 4500);
  }

  function tip() {
    const t = $("#irTip");
    if (!t) return;
    clearTimeout(t._h);      // 11/26 (front-end review K65 check): a note's pending timer would redraw this tip and take the focus off Cancel
    const k = S.sel;
    if (!k) { t.hidden = true; return; }
    const what = { isolate: bi("EDR shield: now click a device on the map.", "端點防護：在網路圖上點一台裝置。"), cut: bi("Cutter: now click a switch, or the crew's line from the internet.", "剪刀：點一台交換器，或歹徒從網路進來的線。"),
      usb: bi("USB drive: now click a device to plug it into.", "USB 硬碟：點一台要插的裝置。"), tape: bi("Offline tape: now click the server room.", "離線磁帶：點機房。") }[k] || "";
    t.hidden = false;
    t.innerHTML = `${what} <button type="button" id="irCancel">${bi("Cancel", "取消")}</button>`;
    $("#irCancel").addEventListener("click", () => { S.sel = null; tip(); tools(); drawMap(); });
  }

  /* ------------------------------------------------------------------ a device, up close */
  function openClose(k) {
    S.open = k;
    drawClose();
    placeClose();
    drawMap();
    CB.SFX.play("tap");
    guideSync();      // 11/27: the first-time guide moves onto the cable as soon as it is in view
  }
  function closeClose() { S.open = null; drawClose(); drawMap(); guideSync(); }

  function stateText(k) {
    const s = S.nodes[k];
    return ({ clean: bi("Working normally", "正常運作"), infected: bi(`Encrypting · ${Math.round(s.pct * 100)}%`, `加密中・${Math.round(s.pct * 100)}%`), encrypted: bi("Encrypted", "已加密"),
      isolated: bi("Isolated by EDR, still on", "被端點防護隔離，還開著"), unplugged: bi("Cable out, still on", "網路線拔掉了，還開著"), off: bi("Switched off", "已關機"), restored: bi("Restored", "已還原") })[s.state] || "";
  }
  function closeState() {
    const x = $("#irCloseState");
    if (x && S.open) { x.innerHTML = stateText(S.open); x.className = `ir-close-state is-${S.nodes[S.open].state}`; }
    const rt = $("#irRansomT");
    if (rt) rt.textContent = ransomLeft();
  }
  const ransomLeft = () => { const left = Math.max(0, 3600 - Math.floor(S.clock * 60)); return `${CB.pad2(Math.floor(left / 60))}:${CB.pad2(left % 60)}`; };

  function drawClose() {
    const box = $("#irClose"), k = S.open;
    if (!k) { box.hidden = true; box.innerHTML = ""; return; }
    const n = NODE[k], s = S.nodes[k];
    const endpoint = n.type === "pc" || n.type === "till", live = !["off", "restored"].includes(s.state);
    let body;
    if (n.safe) body = `<div class="ir-close-tape">${SVG.tape}<p>${S.restored ? bi("Restored from this copy.", "已經從這份副本還原。")
      : S.analyzed && S.contained ? bi("Drag the tape onto the server room to restore from it.", "把磁帶拖到機房，從它還原。")
      : S.analyzed ? bi("The SOC knows how they got in. Restore once nothing is encrypting and the crew's line is cut.", "資安監控中心查出他們怎麼進來了。等沒有東西在加密、歹徒的連線也切斷了，再從它還原。")
      : bi("Locked in the safe, on no network. It can wait until the SOC knows how they got in.", "鎖在保險箱，不接任何網路。等資安監控中心查清楚他們怎麼進來，再用它。")}</p></div>`;
    else {
      const ransom = k === "night_pc" && live && !S.restored;
      body = `${ransom ? `<div class="ir-ransom"><p class="ir-ransom-h">YOUR FILES ARE ENCRYPTED<small lang="zh-Hant">你的檔案都被加密了</small></p>
          <p class="ir-ransom-t">${bi("Pay 5 BTC for the key. The price doubles in", "付 5 個比特幣拿金鑰。價格加倍倒數")} <b id="irRansomT">${ransomLeft()}</b></p>
          ${S.paid ? `<p class="ir-ransom-paid">${bi("Paid. Waiting for the key…", "已付款，等金鑰中…")}</p>` : CB.slideHTML("pay", bi("Slide to pay 5 BTC", "滑動付 5 個比特幣"), "Pay the ransom: drag the knob to the right")}</div>` : ""}
        ${live ? `<div class="ir-back${endpoint ? "" : " is-server"}">
          ${endpoint ? `<div class="ir-port${s.state === "unplugged" ? " is-out" : ""}"><span class="ir-jack" aria-hidden="true"></span>
              ${s.state === "unplugged" ? `<span class="ir-plug is-out" aria-hidden="true">${SVG.plug}</span>` : `<button type="button" class="ir-plug" id="irPlug" aria-label="Network cable: drag it to the right to pull it out">${SVG.plug}</button>`}
              <span class="ir-port-l">${bi("Network", "網路線")}</span></div>`
            : `<p class="ir-close-p">${n.zone === "server" ? bi("In the locked server room: its cable is out of reach. The SOC can isolate it from here.", "在上鎖的機房裡，網路線碰不到。資安監控中心可以從遠端隔離它。")
              : bi("In a locked cabinet on the POS network: its cable is out of reach. The SOC can isolate it from here.", "在收銀網段上鎖的機櫃裡，網路線碰不到。資安監控中心可以從遠端隔離它。")}</p>`}
          <div class="ir-pw"><button type="button" class="ir-power" id="irPower" aria-label="Power button: hold it to switch off"><i class="ir-power-ring"></i>${SVG.power}</button><span>${bi("Power", "電源")}</span></div>
        </div>` : ""}`;
    }
    box.hidden = false;
    box.className = `ir-close${n.safe ? " is-safe" : ""}`;
    box.innerHTML = `<div class="ir-close-in"><p class="ir-close-h"><b>${bi(n.en, n.zh)}</b><button type="button" class="ir-close-x" aria-label="Close">×</button></p>
      <p class="ir-close-state is-${s.state}" id="irCloseState">${stateText(k)}</p>${body}</div>`;
    // closed from the keyboard: back to the device on the map, so Tab carries on from there
    $(".ir-close-x", box).addEventListener("click", (ev) => { closeClose(); if (!ev.detail) { const g = $(`.ir-node[data-k="${k}"]`, $("#irMap")); if (g) g.focus({ preventScroll: true }); } });
    const plug = $("#irPlug");
    if (plug) plugCtl(plug, k);
    const pw = $("#irPower");
    if (pw) holdCtl(pw, 1200, () => trap(CARD.power_off, k));
    const pay = $(".mn-slide[data-slide=pay]", box);
    if (pay) CB.slideCtl(pay, () => { S.paid = true; trap(CARD.pay); });
  }

  function placeClose() {
    const box = $("#irClose"), wrap = $("#irWrap"), svg = $("#irMap");
    if (!S.open || !box || box.hidden) return;
    const n = NODE[S.open], r = svg.getBoundingClientRect(), wr = wrap.getBoundingClientRect(), k = G.k();
    const x = (r.left - wr.left + (n.x / 1000) * r.width) / k, y = (r.top - wr.top + ((n.y + TOP) / (600 + TOP)) * r.height) / k;
    wr.width /= k; wr.height /= k;
    const w = box.offsetWidth, h = box.offsetHeight;
    let left = x + 48;
    if (left + w > wr.width - 8) left = x - 48 - w;
    left = Math.max(8, Math.min(wr.width - w - 8, left));
    const top = Math.max(8, Math.min(wr.height - h - 8, y - h / 2));
    box.style.left = `${left}px`; box.style.top = `${top}px`;
  }

  function plugCtl(btn, k) {   // pull the cable out of the back: drag it out to the right
    let p = null;
    btn.addEventListener("pointerdown", (ev) => { if (ev.button !== 0 || S.hold || S.over || S.paused) return; ev.preventDefault(); p = { x0: ev.clientX, far: 0 }; CB.cap(btn, ev.pointerId); btn.classList.add("is-pull"); });
    btn.addEventListener("pointermove", (ev) => {
      if (!p) return;
      // 11/26 (front-end review K68): screen pixels into the scaled canvas's pixels, so the cable follows the pointer
      const d = Math.max(0, (ev.clientX - p.x0) / (G.k() || 1));
      p.far = Math.max(p.far, d);
      btn.style.transform = `translateX(${Math.min(64, d)}px)`;
      if (d > 56) { p = null; btn.classList.remove("is-pull"); use("unplug", k); }
    });
    // 11/27: let go too soon (or only clicked): it sprang back with no word, now it says which way
    const end = () => {
      if (!p) return;
      const far = p.far;
      p = null; btn.classList.remove("is-pull"); btn.style.transform = ""; nudge($(".ir-port", $("#irClose")) || btn);
      tipNote(far > 6 ? bi("Drag it further to the right.", "再往右拖一點。") : bi("Drag the plug to the right to pull the cable out.", "把插頭往右拖，網路線就拔掉了。"));
    };
    btn.addEventListener("pointerup", end);
    btn.addEventListener("pointercancel", end);
    btn.addEventListener("keydown", (ev) => {
      if (ev.key !== "Enter" && ev.key !== " ") return;
      ev.preventDefault();
      use("unplug", k);
      // 11/22: the redraw takes the cable's button away: the keyboard goes to the close-up's ×, not to the power button (a trap)
      const x = $(".ir-close-x", $("#irClose"));
      if (x) x.focus({ preventScroll: true });
    });
  }

  function holdCtl(b, ms, done) {   // a power button: hold it down until the ring closes
    let t = null;
    const down = (ev) => {
      if (ev && ev.button !== undefined && ev.button !== 0) return;
      if (t || S.hold || S.over || S.paused) return;      // 11/26 (front-end review K61): not while paused
      if (ev && ev.pointerId !== undefined) { ev.preventDefault(); CB.cap(b, ev.pointerId); }
      b.classList.add("is-holding");
      b.style.setProperty("--hold", `${ms}ms`);
      // 11/26 (front-end review K62): the close-up closed (Escape) or was redrawn during the hold: the button is gone, so its
      // let-go never came and the PC still switched off. Only a button that is still there finishes the hold.
      t = setTimeout(() => { t = null; b.classList.remove("is-holding"); if (b.isConnected) done(); }, ms);
    };
    const up = () => { if (!t) return; clearTimeout(t); t = null; b.classList.remove("is-holding"); };
    b.addEventListener("pointerdown", down);
    b.addEventListener("pointerup", up);
    b.addEventListener("pointercancel", up);
    b.addEventListener("lostpointercapture", up);      // 11/26 (front-end review K62): the pointer was taken away = let go
    b.addEventListener("blur", up);                    // 11/26 (front-end review K62): Tab away during a Space hold = let go
    b.addEventListener("keydown", (ev) => { if ((ev.key === " " || ev.key === "Enter") && !ev.repeat) { ev.preventDefault(); down(); } });
    b.addEventListener("keyup", (ev) => { if (ev.key === " " || ev.key === "Enter") up(); });
  }

  /* ------------------------------------------------------------------ the desk phone: dial the SOC yourself */
  function phoneHTML() {
    return `<section class="ir-phone" id="irPhone"><p class="ir-phone-h">${bi("Desk phone · line 2", "桌上電話・二線")}</p>
      <p class="ir-lcd" id="irLcd"></p>
      <div class="ir-keys" id="irKeys">${["1", "2", "3", "4", "5", "6", "7", "8", "9", "*", "0", "#"].map((k) => `<button type="button" data-k="${k}">${k}</button>`).join("")}</div>
      <div class="ir-phone-act"><button type="button" class="ir-dial" id="irDial">${CB.ICON.phone}<span>${bi("Call", "撥出")}</span></button><button type="button" class="ir-del" id="irDel" aria-label="Delete">⌫</button></div></section>`;
  }
  function lcd(msg) {
    const l = $("#irLcd");
    if (!l) return;
    l.innerHTML = msg || (S.dial ? `<b>${esc(S.dial)}</b>` : `<span>${S.soc ? bi("SOC on the line", "資安監控中心在線上") : bi("Yi-Chen is holding on line 1", "易真在一線等")}</span>`);
  }
  function dialKey(k) {
    if (!S || S.over || S.hold || S.paused || S.dial.length >= 12) return;      // 11/26 (front-end review K61): not while paused
    S.dial += k;
    CB.SFX.play("dtmf");
    lcd();
  }
  function dialOut() {
    if (!S || S.over || S.hold || S.paused) return;      // 11/26 (front-end review K61): not while paused
    const num = digitsOf(S.dial);
    if (!num) return;
    S.dial = "";
    CB.SFX.play("ring");
    lcd(`<span>${bi(`Calling ${num}…`, `撥號中 ${num}…`)}</span>`);
    $("#irPhone").classList.add("is-ringing");
    const s0 = S;
    // 11/26 (front-end review K63): a cut scene or the pause during the ring used to drop the call (use() ignores it while
    // S.hold is set) and the LCD stayed on "Calling…": the phone keeps ringing until the cut or the pause is over
    const ring = () => {
      if (!S || S !== s0 || S.over) return;
      if (S.hold || S.paused) { setTimeout(ring, 300); return; }
      $("#irPhone").classList.remove("is-ringing");
      if (num !== SOC_NUM) { lcd(`<span>${bi("Not in service. The SOC is on ext. 2199.", "空號。資安監控中心是分機 2199。")}</span>`); return; }
      if (S.soc) { say(bi(story.lines.soc_again.en, story.lines.soc_again.zh), "is-good"); lcd(); return; }
      use("soc");
    };
    setTimeout(ring, reduceMotion ? 150 : 1400);
  }

  function sweep() {      // the SOC's view arrives: a radar sweep over the map
    const s = $("#irSweep");
    if (!s || reduceMotion) return;
    s.classList.remove("is-on"); void s.offsetWidth; s.classList.add("is-on");
    CB.SFX.play("whoosh");
  }

  /* ------------------------------------------------------------------ the SOC's tools and your cards */
  const stepDone = (n) => n in S.stepAt;
  const locked = (c) => (c.needs || []).some((n) => !stepDone(n)) || (c.k === "restore" && !S.analyzed) || (c.k === "notify" && !S.analyzed) || (c.k === "review" && (!S.restored || !S.notified));
  const usedUp = (c) => (!c.target && !c.uses && S.played[c.k]) || (c.k === "analyze" && (S.analyzing > 0 || S.analyzed));
  const needsPair = (c) => {     // 11/27: in two languages apart, so a sentence can be built around it
    if ((c.needs || []).includes(2) && !stepDone(2)) return ["after the SOC call", "打給資安監控中心之後"];
    if (c.k === "restore" || c.k === "notify") return ["after the analysis", "查清楚之後"];
    if (c.k === "review") return ["after the restore and the notifications", "還原和通知之後"];
    return null;
  };
  const needsText = (c) => { const p = needsPair(c); return p ? bi(p[0], p[1]) : ""; };
  // 11/27: a locked card, a used card or a tool out of reach said nothing when it was clicked or dragged: now it says why
  const lockText = (c) => { const p = needsPair(c); return p ? `${CB.ICON.lock} ${bi(`"${c.en}" opens ${p[0]}.`, `「${c.zh}」要${p[1]}才能出。`)}` : ""; };
  const cardBlock = (c) => (locked(c) ? lockText(c) : c.k === "analyze" && S.analyzing > 0 ? bi("The SOC is still analysing.", "資安監控中心還在分析。")
    : bi("You already played this card.", "這張卡已經出過了。"));
  const toolBlock = (k) => (!S.soc ? `${CB.ICON.lock} ${bi(`The SOC's tools open after the SOC call: dial ${SOC_NUM} on the desk phone.`, `打給資安監控中心之後才能用他們的工具：在桌上電話按 ${SOC_NUM}。`)}`
    : k === "isolate" ? bi(`No EDR shields left: the SOC had ${sh.isolate}.`, `端點防護用完了，資安監控中心只有 ${sh.isolate} 個。`)
    : bi(`The cutter is used up: it had ${sh.cut} cuts.`, `剪刀用完了，只能剪 ${sh.cut} 次。`));

  // a tool is out of reach before the SOC call, and once used up (the cutter still reaches the crew's line while it is live)
  const toolOff = (k) => !S.soc || (S.uses[k] <= 0 && !(k === "cut" && S.acct));
  function tools() {
    const box = $("#irTools");
    if (!box) return;
    if (S.drag) { S.dirty = true; return; }
    const off = !S.soc;
    // 11/22: a used-up tool is out of the Tab order too (review: Tab still reached the 0× shield, and Enter picked it up)
    const tool = (k, svg, en, zh, n, hint) => `<div class="ir-tool${off ? " is-locked" : ""}${!off && n <= 0 && !(k === "cut" && S.acct) ? " is-used" : ""}${S.sel === k ? " is-sel" : ""}" data-k="${k}" tabindex="${toolOff(k) ? -1 : 0}" role="button"
        aria-disabled="${toolOff(k)}" aria-label="${esc(`${en}: drag it onto the map`)}">${svg}<b>${bi(en, zh)}</b><em>${n}×</em><span>${hint}</span></div>`;
    box.innerHTML = `<h3>${bi("The SOC's tools", "資安監控中心的工具")}${off ? `<small>${CB.ICON.lock}${bi("after the SOC call", "打給資安監控中心之後")}</small>` : ""}</h3>
      <div class="ir-tool-row">${tool("isolate", SVG.shield, "EDR shield", "端點防護", S.uses.isolate, bi("onto a device", "放到裝置上"))}
        ${tool("cut", SVG.cutter, "Cutter", "剪刀", S.uses.cut, bi("a switch, or the crew's line", "交換器，或歹徒的線"))}</div>`;
    // 11/26 (front-end review K70): Enter on a picked tool puts it back; the redraw took the focused tool away, so the keyboard
    // stays on the new copy of that tool instead of falling to the page
    for (const t of $$(".ir-tool", box)) draggable(t, t.dataset.k, { tap: () => pick(t.dataset.k), key: () => {
      pick(t.dataset.k);
      if (S.sel) toTarget();
      else { const b = $(`.ir-tool[data-k="${t.dataset.k}"]`, $("#irTools")); if (b && b.tabIndex >= 0) b.focus({ preventScroll: true }); }
    }, blocked: () => { nudge(t); tipNote(toolBlock(t.dataset.k)); } });      // 11/27
  }

  function hand() {
    const box = $("#irHand");
    if (!box) return;
    if (S.drag) { S.dirty = true; return; }
    // 11/22: a redraw keeps the keyboard on the same card (by data-k), also once it is played (review: focus fell to the page)
    const had = box.contains(document.activeElement) ? document.activeElement.dataset.k : null;
    box.innerHTML = PLAYS.map((k) => CARD[k]).map((c) => {
      const lk = locked(c), up = usedUp(c);
      return `<div class="ir-card${lk ? " is-locked" : ""}${up ? " is-used" : ""}${S.played[c.k] ? " is-played" : ""}" data-k="${c.k}" tabindex="${lk || up ? -1 : 0}" role="button" aria-disabled="${lk || up}">
        <span class="ir-card-who">${bi(c.who_en, c.who_zh)}</span><span class="ir-card-t">${bi(c.en, c.zh)}</span>
        ${lk ? `<span class="ir-card-lock">${CB.ICON.lock}${needsText(c)}</span>` : ""}${up && !lk ? `<span class="ir-card-done">${CB.ICON.check}</span>` : ""}</div>`;
    }).join("");
    for (const cEl of $$(".ir-card", box)) {
      const c = CARD[cEl.dataset.k];
      // 11/27: a click only wiggled the card; now it also says how to play it, and a locked or used card says why
      draggable(cEl, c.k, { tap: () => { nudge(cEl); tipNote(dragCard()); }, key: () => { if (!locked(c) && !usedUp(c)) use(c.k); }, blocked: () => { nudge(cEl); tipNote(cardBlock(c)); } });
    }
    const back = had && $(`.ir-card[data-k="${had}"]`, box);
    if (back) back.focus({ preventScroll: true });
  }

  function markStep(c) {
    if (!c.step) return null;
    if (!(c.step in S.stepAt)) {
      S.stepAt[c.step] = S.seq++;
      const inOrder = STEPS.filter((s) => s.order > c.step).every((s) => !(s.order in S.stepAt) || S.stepAt[s.order] > S.stepAt[c.step]);
      const pts = P.step + (inOrder ? P.order : 0);
      S.points += pts; H.points(S.points, 0, pts);
      // 11/27: played after a later step (it was accepted without a word): that later step, the lowest one, for the reason
      if (!inOrder) return STEPS.filter((s) => s.order > c.step && s.order in S.stepAt).sort((a, b) => a.order - b.order)[0] || null;
    }
    return null;
  }

  /* The traps: the procedure's don'ts. */
  function trap(c, target) {
    if (!S || S.over || S.hold || S.paused) return;      // 11/26 (front-end review K61): not while paused
    S.sel = null;
    S.played[c.k] = (S.played[c.k] || 0) + 1;
    const was = target && S.nodes[target] ? S.nodes[target].state : "";      // 11/27: for the "why" (its cable may have been out already)
    if (c.k === "power_off" && target) S.nodes[target].state = "off";
    if (c.k === "usb") { S.usb = true; $("#irUsb").classList.add("is-used"); }
    S.traps.push(c.k);
    CB.SFX.play("bad");
    log(bi(`${c.en}${target ? `: ${NODE[target].en}` : ""}.`, `${c.zh}${target ? `：${NODE[target].zh}` : ""}。`), "is-bad");
    tip(); tools(); drawMap(); if (S.open) drawClose();
    const rule = { en: PROC.dont_en[c.dont], zh: PROC.dont_zh[c.dont] };
    // 11/27: why (the procedure's own reason, and the move to make instead), on the cut scene and in the Help panel
    const item = target || (c.k === "pay" ? "night_pc" : "");
    S.lastMistake = item ? { chosen: c.k, item } : { chosen: c.k };
    guideMove(c.k);
    return lose({ kind: "trap", card: c, rule, hit_en: c.hit_en, hit_zh: c.hit_zh, beats: [{ time: clockAt(S.clock), en: c.hit_en, zh: c.hit_zh }],
      why: trapWhy(c, target, was), ctx: shiftCtx(), at: clockAt(S.clock) });
  }

  /* The good moves: the procedure's steps. */
  function use(k, target) {
    const c = CARD[k];
    if (!c || !S || S.over || S.hold || S.paused) return;      // 11/26 (front-end review K61): not while paused
    if (locked(c)) return tipNote(lockText(c));      // 11/27: says which card and what comes first
    if (usedUp(c)) return;
    S.sel = null;
    S.played[k] = (S.played[k] || 0) + 1;
    const step = STEPS.find((s) => s.order === c.step);
    if (k === "unplug") {
      S.nodes[target].state = "unplugged";
      CB.SFX.play("clunk");
      log(bi(`${NODE[target].en}: unplugged, left on.`, `${NODE[target].zh}：拔掉網路線，沒有關機。`), "is-ok");
      if (target === "night_pc") say(bi("Yi-Chen: \"Cable's out. The screen is still on. I've taken a photo of the note.\"", "易真：「網路線拔掉了，螢幕還開著，勒索畫面我拍下來了。」"), "is-good");
    } else if (k === "soc") {
      S.soc = true;
      const who = $("#irWho");
      if (who) who.innerHTML = CB.personHTML(ANALYST, "", { id: "irSay" });
      sweep();
      say(bi(story.lines.soc.en, story.lines.soc.zh), "is-good");
      log(bi("Called the SOC on 2199. The SOC can see every device now.", "撥 2199 給資安監控中心，現在看得到每一台裝置了。"), "is-ok");
      for (const n of NODES.filter((x) => !x.seen && !x.safe && active(x.k))) log(bi(`${n.en} was already encrypting.`, `${n.zh}早就在加密了。`), "is-bad");
      lcd();
    } else if (k === "isolate") {
      S.uses.isolate -= 1;
      S.nodes[target].state = "isolated";
      S.points += P.isolate; H.points(S.points, 0, P.isolate);
      CB.SFX.play("pin");
      sparks(NODE[target].x, NODE[target].y, "is-blue");
      log(bi(`SOC isolated ${NODE[target].en} with EDR.`, `資安監控中心用端點防護隔離了${NODE[target].zh}。`), "is-ok");
    } else if (k === "disable") {
      S.acct = false;
      CB.SFX.play("zap");
      const to = NODE[NET.to];
      sparks(to.x + 40, to.y - 70);
      log(bi(`SOC disabled ${NET.user} and ended the VPN session from ${NET.ip}.`, `資安監控中心停用 ${NET.user}，切斷來自 ${NET.ip} 的 VPN 連線。`), "is-ok");
      say(bi("Jun-Hao: \"Account's off, VPN session killed. They can't start anything new.\"", "俊豪：「帳號停了，VPN 連線也砍了，他們沒辦法再放新的。」"), "is-good");
    } else if (k === "cut") {
      S.uses.cut -= 1;
      S.cut.add(target);
      const s = SW.find((x) => x.k === target);
      CB.SFX.play("zap");
      sparks(s.x, s.y);
      log(bi(`SOC cut the link at the ${s.en.split(":")[0].toLowerCase()}: ${s.en.split(": ")[1] || ""}.`, `資安監控中心在${s.zh.split("：")[0]}切斷了${s.zh.split("：")[1] || ""}的連線。`), "is-ok");
    } else if (k === "plan") {
      S.plan = true;
      CB.SFX.play("paper");
      log(bi("Incident plan active. The restaurant and the front desk switch to paper.", "應變計畫啟動，餐廳和櫃台改用紙本。"), "is-ok");
    } else if (k === "analyze") {
      S.analyzing = c.secs || 5;
      CB.SFX.play("tap");
      log(bi("The SOC starts the analysis, keeping the evidence.", "資安監控中心開始分析，同時保留證據。"), "is-quiet");
    } else if (k === "restore") {
      if (!S.contained) {     // restoring while it is still inside: the procedure's fourth don't
        S.traps.push("restore");
        S.played.restore = 0;
        CB.SFX.play("bad");
        log(bi(story.early_restore_en, story.early_restore_zh), "is-bad");
        hand(); drawMap();
        S.lastMistake = { chosen: "early_restore" };      // 11/27: what was still going on, and why the procedure restores later
        return lose({ kind: "trap", card: c, rule: { en: PROC.dont_en[3], zh: PROC.dont_zh[3] }, hit_en: story.early_restore_en, hit_zh: story.early_restore_zh,
          beats: [{ time: clockAt(S.clock), en: story.early_restore_en, zh: story.early_restore_zh }], why: restoreWhy(), ctx: shiftCtx(), at: clockAt(S.clock) });
      }
      S.restored = true;
      const tape = NODE.offline || NODES.find((n) => n.safe);
      wave(tape.x, tape.y);
      CB.SFX.play("win");
      for (const n of NODES) { const s = S.nodes[n.k]; if (s.pct > 0 && !n.safe) { s.state = "restored"; s.pct = 1; } }
      log(bi("Restored from the 02:00 offline copy, patched, passwords changed.", "從 02:00 的離線副本還原，修補、改密碼。"), "is-ok");
    } else if (k === "notify") {
      S.notified = true;
      CB.SFX.play("paper");
      log(bi("The Privacy Officer starts the notifications.", "個資保護長開始通知。"), "is-ok");
    } else if (k === "review") {
      CB.SFX.play("good");
      log(bi("Review booked for Sunday 16:00 at the lighthouse.", "檢討會訂在週日 16:00，燈塔。"), "is-ok");
    }
    S.lastMistake = null;      // 11/27: a good move; the last slip is no longer "just now" for the Help panel
    if (!S.order.includes(k)) S.order.push(k);
    const late = k === "isolate" || k === "cut" || k === "disable" ? markStep({ step: 3 }) : markStep(c);
    hand(); tools(); tip();
    // 11/26 (front-end review, ir check): after tip(), which hid the note at once when no tool is in hand
    if (late && step) lateNote(k, step, late);      // 11/27: right but late, said on the spot
    else if (step && k !== "isolate" && k !== "cut") cardNote(c, step);
    drawMap(); status();
    if (S.open) drawClose();
    guideMove(k);
    if (k === "review") endShift();
  }

  function cardNote(c, step) {   // what the procedure says about the step just played, briefly, under the map
    const t = $("#irTip");
    if (!t) return;
    t.hidden = false;
    t.innerHTML = `<b>${bi(`Step ${step.order}`, `第 ${step.order} 步`)}</b> ${bi(step.why_en, step.why_zh)}`;
    clearTimeout(t._h);
    t._h = setTimeout(() => { if (!S || S.over) return; if (S.sel) tip(); else t.hidden = true; }, 6000);      // 11/26 (front-end review K65): as in tipNote
  }

  /* ------------------------------------------------------------------ 11/27: Help, the first-time guide, why
     The user (11/27): 「感覺現在遊戲有點不知道在玩甚麼，都沒說得夠清楚該怎麼玩，並且錯了也不能問小幫手」. The Help panel
     (common.js G.help) hears what is on the screen (setNow) and why a move went wrong (G.help.mistake, also through
     st.cut). The cut scene and the tip under the map say the reason on the spot, built from the procedure in the knowledge
     graph, each step's "why" (games.yaml) and the night as it went. The first time this page plays the night, a guide
     (CB.coach) points at the first moves and holds the night still (GD, checked in tick) until each move is made. */

  // what the IT Assistant is told about the night: ids only (assistant/games.py builds the facts from its own copy)
  function shiftCtx() {
    const o = { screen: "shift", done: S.order.slice() }, n = nextOrder();
    if (n) o.next = STEP_KEY[n];
    if (S.open) o.item = S.open;
    return Object.assign(o, S.lastMistake || {});
  }
  // the lowest step of the procedure not played yet
  function nextOrder() { return STEPS.map((s) => s.order).sort((a, b) => a - b).find((o) => !stepDone(o)); }
  // a device the red can still reach from one next to it: [from, to]
  function spreadPair() {
    for (const n of NODES) {
      if (!active(n.k)) continue;
      const k = neighbours(n.k).find((j) => S.nodes[j].state === "clean" && !NODE[j].safe);
      if (k) return [n.k, k];
    }
    return null;
  }

  // a step played after a later one: right, but late (no order bonus, and the summary marks it late)
  function lateNote(k, s, m) {
    const [sn, sz] = STEP_SHORT[s.order] || [s.text_en, s.text_zh], [mn, mz] = STEP_SHORT[m.order] || [m.text_en, m.text_zh];
    S.lastMistake = { chosen: "late", card: k };
    const ctx = shiftCtx();
    mistake({ at: clockAt(S.clock), title_en: `Step ${s.order} came late: ${sn}`, title_zh: `第 ${s.order} 步做太晚了：${sz}`, ctx, why: [
      { en: `Step ${s.order} comes before step ${m.order} (${mn}), but you played step ${m.order} first. It still counts as done, just not in order: no order bonus, and the summary marks it late.`,
        zh: `第 ${s.order} 步要在第 ${m.order} 步（${mz}）之前，可是你先做了第 ${m.order} 步。這一步還是算做了，只是不算照順序：沒有順序加分，結算時會標成太晚。` },
      { en: `Why step ${s.order} is there: ${s.why_en || ""}`, zh: `第 ${s.order} 步為什麼排在這裡：${s.why_zh || ""}` }] });
    tipNote(`<b>${bi(`Step ${s.order}, late`, `第 ${s.order} 步，太晚了`)}</b> ${bi(`Right move, but it comes before step ${m.order} (${mn}). ${s.why_en || ""}`, `做法對，只是它要在第 ${m.order} 步（${mz}）之前。${s.why_zh || ""}`)}${
      G.help ? ` <button type="button" id="irTipAsk">${bi("Ask the IT Assistant", "問小幫手")}</button>` : ""}`, 9000);
    CB.bindAsk($("#irTipAsk"), { ...ctx, mistake: true });
  }

  // why a trap was one: the procedure's reason for the step it goes against, and the move to make instead
  function trapWhy(c, target, was) {     // was: the device's state before the trap
    const s1 = stepBy(1), s6 = stepBy(6), n = target && NODE[target], out = [], [nn, nz] = STEP_SHORT[nextOrder()] || ["", ""];
    if (c.k === "power_off") {
      if (s1) out.push({ en: s1.why_en, zh: s1.why_zh });
      if (was === "unplugged" || was === "isolated") out.push(was === "unplugged"
        ? { en: "Its cable was already out, and that was enough: leave it switched on.", zh: "它的網路線已經拔掉了，這樣就夠了，電源不要動。" }
        : { en: "EDR had already isolated it, and that was enough: leave it switched on.", zh: "端點防護已經隔離它了，這樣就夠了，電源不要動。" });
      else out.push(n && n.type !== "pc" && n.type !== "till"
        ? { en: `The ${n.en}'s cable is out of reach: ${S.soc ? "drag an EDR shield onto it instead" : `call the SOC on ${SOC_NUM}, then drag an EDR shield onto it`}.`,
            zh: `${n.zh}的網路線碰不到：${S.soc ? "改把端點防護盾牌拖到它上面" : `先打 ${SOC_NUM} 給資安監控中心，再把端點防護盾牌拖到它上面`}。` }
        : { en: "Pull the network cable instead: drag the plug to the right and leave the power on.", zh: "要拔網路線：把插頭往右拖，電源不要動。" });
    } else if (c.k === "pay") {
      if (s6) out.push({ en: `The way back is the offline copy in the safe, step 6. ${s6.why_en}`, zh: `要救回檔案，靠的是保險箱裡的離線副本（第 6 步）。${s6.why_zh}` });
      out.push({ en: `Leave the pay slider alone.${nn ? ` Your next step: ${nn}.` : ""}`, zh: `付款滑桿不要碰。${nz ? `你的下一步：${nz}。` : ""}` });
    } else if (c.k === "usb") {
      if (s6) out.push({ en: `${s6.why_en} A drive plugged into an infected server is within the crew's reach.`, zh: `${s6.why_zh}接到中毒伺服器的硬碟，歹徒就碰得到了。` });
      out.push({ en: "Keep the USB drive on the desk. The copy to restore from is the offline tape in the safe.", zh: "USB 硬碟留在桌上。要還原，用的是保險箱裡的離線磁帶。" });
    }
    return out;
  }

  // why restoring then was too early: what was still going on at that moment
  function restoreWhy() {
    const s6 = stepBy(6), out = [], en = [], zh = [], enc = NODES.filter((n) => S.nodes[n.k].state === "infected"), sp = spreadPair();
    if (s6) out.push({ en: `Step 6: ${s6.why_en}`, zh: `第 6 步：${s6.why_zh}` });
    if (S.acct) { en.push(`the crew's VPN line (${NET.user}) was still live`); zh.push(`歹徒的 VPN 連線（${NET.user}）還連著`); }
    if (enc.length) { en.push(`still encrypting: ${enc.map((n) => n.en).join(", ")}`); zh.push(`還在加密：${enc.map((n) => n.zh).join("、")}`); }
    if (sp) { en.push(`the red could still spread from the ${NODE[sp[0]].en} to the ${NODE[sp[1]].en}`); zh.push(`紅色還能從${NODE[sp[0]].zh}擴散到${NODE[sp[1]].zh}`); }
    if (en.length) out.push({ en: `At that moment ${en.join("; ")}.`, zh: `那時候${zh.join("；")}。` });
    out.push({ en: "Restore once nothing is encrypting or spreading and the crew's line is cut. The tape in the safe glows when it is safe.",
      zh: "等沒有東西在加密或擴散、歹徒的線也剪斷了再還原。可以還原時，保險箱裡的磁帶會發亮。" });
    return out;
  }

  // what would have stopped a key system: a shield on it, or cutting it off where the red came in (infect's "from")
  function critWhy(n) {
    const s = S.nodes[n.k], out = [];
    out.push(!S.soc
      ? { en: `An EDR shield on the ${n.en} would have stopped it. The shields come with the SOC call (${SOC_NUM}), and so does the view of the whole network.`,
          zh: `在${n.zh}放端點防護盾牌就擋得住。打 ${SOC_NUM} 給資安監控中心之後才有盾牌，也才看得到整個網路。` }
      : S.uses.isolate > 0
        ? { en: `An EDR shield on the ${n.en} would have stopped it: a shielded device stops encrypting. You still had ${S.uses.isolate} left.`,
            zh: `在${n.zh}放端點防護盾牌就擋得住：被隔離的裝置不會再加密。你那時還有 ${S.uses.isolate} 個。` }
        : { en: `An EDR shield on the ${n.en} would have stopped it, but all ${sh.isolate} were already used.`, zh: `在${n.zh}放端點防護盾牌就擋得住，可是 ${sh.isolate} 個都已經用掉了。` });
    const src = s.from && s.from !== "vpn" ? NODE[s.from] : null;
    if (s.from === "vpn") out.push({ en: `The crew started it themselves over ${NET.user}'s VPN line. Cutting that line with the cutter stops them starting new ones.`,
      zh: `這台是歹徒從 ${NET.user} 的 VPN 連線直接放的。用剪刀剪斷那條線，他們就不能再放新的。` });
    else if (src) {
      const l = LINKS.find((x) => (x.a === src.k && x.b === n.k) || (x.a === n.k && x.b === src.k)), w = l && l.via && SW.find((x) => x.k === l.via);
      if (w) {
        const we = w.en.split(": "), wz = w.zh.split("：");
        out.push({ en: `Or cut it off: it came from the ${src.en} through the ${we[0].toLowerCase()}${we[1] ? ` (${we[1]})` : ""}. The cutter there would have kept it out.`,
          zh: `也可以把它切開：它是從${src.zh}經過${wz[0]}${wz[1] ? `（${wz[1]}）` : ""}過來的，在那裡用剪刀剪斷就進不來。` });
      } else out.push({ en: `It came from the ${src.en} over a direct link with no switch to cut, so only a shield on one of the two would have stopped it.`,
        zh: `它是從${src.zh}直接傳過來的，中間沒有交換器可以剪，只有在這兩台其中一台放盾牌才擋得住。` });
    }
    return out;
  }

  /* What the Help panel says during the night (read each time it opens): the next step and its control, what is going on,
     the device up close, what is locked and why, the starred systems and what costs a shield. */
  function shiftNow() {
    if (!S || S.over) return null;
    const steps = [], line = (en, zh) => steps.push({ en, zh }), n = nextOrder(), nc = n && CARD[STEP_KEY[n]];
    const pc = NODES.find((x) => x.start && x.seen) || NODE.night_pc;
    if (n === 1 && active(pc.k)) line(`Next, step 1: pull the infected PC's network cable. Click the ${pc.en} on the map, then drag its plug to the right. Leave it switched on.`,
      `下一步是第 1 步：拔掉中毒電腦的網路線。在網路圖上點${pc.zh}，再把插頭往右拖。電源不要關。`);
    else if (n === 1) line("Next, step 1: pull the network cable of a PC that is still encrypting. Click it on the map, then drag its plug to the right. Leave it switched on.",
      "下一步是第 1 步：拔掉還在加密的電腦的網路線。在網路圖上點它，再把插頭往右拖。電源不要關。");
    else if (n === 2) line(`Next, step 2: call the SOC. Dial ${SOC_NUM} on the desk phone on the left, then press Call.`, `下一步是第 2 步：打給資安監控中心。在左邊的桌上電話按 ${SOC_NUM}，再按撥出。`);
    else if (n === 3) line("Next, step 3: contain the spread. Drag the EDR shield onto the devices in danger, and the cutter onto the crew's VPN line at the top of the map.",
      "下一步是第 3 步：把擴散圍起來。把端點防護盾牌拖到有危險的裝置上，剪刀拖到網路圖上方歹徒的 VPN 線。");
    else if (n === 6) {
      if (!S.analyzed) line("Next, step 6: restore from the offline tape. It opens when the analysis is done.", "下一步是第 6 步：從離線磁帶還原。分析完才能做。");
      else if (!S.contained) line("Next, step 6: restore from the offline tape, but only once everything is contained (see below). The tape in the safe glows when it is safe.",
        "下一步是第 6 步：從離線磁帶還原，不過要等全部圍堵好（看下面）。可以還原時，保險箱裡的磁帶會發亮。");
      else line("Next, step 6: drag the glowing offline tape from the safe into the server room.", "下一步是第 6 步：把保險箱裡發亮的離線磁帶拖到機房。");
    } else if (nc) line(`Next, step ${n}: drag the card "${nc.en}" onto the map.${n === 5 ? ` The SOC needs about ${nc.secs || 5} seconds.` : n === 8 ? " That ends the night." : ""}`,
      `下一步是第 ${n} 步：把「${nc.zh}」這張卡拖到網路圖上。${n === 5 ? `資安監控中心大約要 ${nc.secs || 5} 秒。` : n === 8 ? "出完這張，今晚就結束了。" : ""}`);
    if (S.analyzing > 0) line("The SOC is analysing (step 5). The restore and the notifications open when it is done.", "資安監控中心正在分析（第 5 步）。分析完，還原和通知才會打開。");
    if (S.soc && !S.contained && !S.restored) {
      const en = [], zh = [], enc = NODES.filter((x) => S.nodes[x.k].state === "infected"), sp = spreadPair();
      if (S.acct) { en.push("the crew's VPN line is still live"); zh.push("歹徒的 VPN 線還連著"); }
      if (enc.length) { en.push(`still encrypting: ${enc.map((x) => x.en).join(", ")}`); zh.push(`還在加密：${enc.map((x) => x.zh).join("、")}`); }
      if (sp) { en.push(`the red can still spread from the ${NODE[sp[0]].en} to the ${NODE[sp[1]].en}`); zh.push(`紅色還能從${NODE[sp[0]].zh}擴散到${NODE[sp[1]].zh}`); }
      if (en.length) line(`Not contained yet: ${en.join("; ")}.`, `還沒圍堵完：${zh.join("；")}。`);
    }
    if (S.soc && !S.restored) line(`SOC tools left: ${S.uses.isolate} EDR shield${S.uses.isolate === 1 ? "" : "s"} and ${S.uses.cut} cut${S.uses.cut === 1 ? "" : "s"} with the cutter${S.acct ? " (cutting the crew's VPN line uses none)" : ""}. A cut switch stops the red crossing it, but a device already encrypting keeps going until it is shielded or unplugged.`,
      `資安監控中心的工具還有：端點防護 ${S.uses.isolate} 個、剪刀 ${S.uses.cut} 次${S.acct ? "（剪歹徒的 VPN 線不算次數）" : ""}。剪斷交換器，紅色就過不去；可是已經在加密的裝置會繼續加密，要放盾牌或拔網路線才會停。`);
    if (S.open) {
      const d = NODE[S.open], s = S.nodes[S.open], endpoint = d.type === "pc" || d.type === "till", pay = S.open === "night_pc" && !S.paid;
      // 11/27 review: after the restore too (it still said to drag the tape)
      if (d.safe && S.restored) line(`Up close: the ${d.en}. Restored from this copy. Close it with ×.`, `近看：${d.zh}。已經從這份副本還原了。按 × 關掉。`);
      else if (d.safe) line(S.analyzed ? `Up close: the ${d.en}. Drag the tape into the server room once nothing is encrypting or spreading and the crew's line is cut.` : `Up close: the ${d.en}. It waits in the safe until the SOC knows how they got in.`,
        S.analyzed ? `近看：${d.zh}。等沒有東西在加密或擴散、歹徒的線也剪斷了，再把磁帶拖到機房。` : `近看：${d.zh}。它在保險箱裡等，資安監控中心查出他們怎麼進來之後才能用。`);
      else if (s.state === "off" || s.state === "restored") line(`Up close: the ${d.en}. It is ${s.state === "off" ? "switched off" : "restored"}. Close it with ×.`, `近看：${d.zh}。它${s.state === "off" ? "已經關機了" : "已經還原了"}。按 × 關掉。`);
      else if (s.state === "isolated") line(`Up close: the ${d.en}. EDR has isolated it and it is still on. Close it with ×.`, `近看：${d.zh}。端點防護已經隔離它了，它還開著。按 × 關掉。`);
      else if (endpoint && s.state === "unplugged") line(`Up close: the ${d.en}. The cable is out and it is still on, as it should be. Close it with ×.`, `近看：${d.zh}。網路線拔掉了，電腦還開著，這樣就對了。按 × 關掉。`);
      else if (endpoint) line(`Up close: the ${d.en}. Drag the Network plug to the right to pull the cable out. Holding Power is a trap${pay ? ", and so is the pay slider" : ""}.`,
        `近看：${d.zh}。把「網路線」插頭往右拖，網路線就拔掉了。按住電源是陷阱${pay ? "，付款滑桿也是" : ""}。`);
      else line(`Up close: the ${d.en}. Its cable is out of reach: ${S.soc ? "drag an EDR shield onto it on the map" : `after the ${SOC_NUM} call, the SOC can isolate it`}. Holding Power is a trap.`,
        `近看：${d.zh}。它的網路線碰不到：${S.soc ? "在網路圖上把端點防護盾牌拖到它上面" : `打 ${SOC_NUM} 之後，資安監控中心可以隔離它`}。按住電源是陷阱。`);
    }
    const groups = [], add = (p, en, zh) => { if (!p) return; let g = groups.find((x) => x.p[0] === p[0]); if (!g) groups.push((g = { p, en: [], zh: [] })); g.en.push(en); g.zh.push(zh); };
    if (!S.soc) add(["after the SOC call", "打給資安監控中心之後"], "the SOC's tools", "資安監控中心的工具");
    for (const c of CARDS.filter((x) => PLAYS.includes(x.k) || x.how === "tape")) if (locked(c)) add(needsPair(c), ...(STEP_SHORT[c.step] || [c.en, c.zh]));
    if (groups.length) line(`Locked for now: ${groups.map((g) => `${g.en.join(", ")} (${g.p[0]})`).join("; ")}. A locked card says what comes first.`,
      `現在鎖住的：${groups.map((g) => `${g.zh.join("、")}（${g.p[1]}）`).join("；")}。鎖住的卡上會寫要先做什麼。`);
    const crit = CRIT.map((k) => NODE[k]);
    line(`★ marks the critical systems: ${crit.map((x) => `the ${x.en}`).join(", ")}. If one is encrypted, you lose a shield. Shields left: ${S.shields} of ${sh.shields}.`,
      `★ 是關鍵系統：${crit.map((x) => x.zh).join("、")}。它們被加密就少一面盾牌。盾牌還剩 ${S.shields} 面（共 ${sh.shields} 面）。`);
    if (!S.soc) line('Until you call the SOC, every device you can\'t see from the front office shows as "?": the red can spread there without you seeing it.',
      "打給資安監控中心之前，從櫃台看不到的裝置都是「?」：紅色擴散過去你也看不到。");
    line("Traps cost a shield too: holding a Power button down, the pay slider on the ransom note, plugging the USB backup drive into a server, and restoring before the spread is contained.",
      "踩到陷阱也會少一面盾牌：按住電源鍵、勒索畫面上的付款滑桿、把 USB 備份硬碟接到伺服器，還有還沒圍堵好就還原。");
    const chips = [];
    if (S.analyzed && !S.restored) chips.push({ en: "When can I restore?", zh: "什麼時候可以還原？" });
    if (!S.soc) chips.push({ en: "What do the stars mean?", zh: "星號是什麼意思？" });
    if (PLAYS.some((k) => locked(CARD[k]))) chips.push({ en: "Why are some cards locked?", zh: "為什麼有些卡鎖住了？" });
    return { title_en: "Right now", title_zh: "現在要做的事", steps, ctx: shiftCtx(), chips: chips.slice(0, 2) };
  }

  /* The first-time guide. Stages: "plug" from the start (the night PC's cable; a click on the PC first if its close-up is
     shut), "phone" after the unplug (dial 2199), "tools" a moment after the SOC call (an EDR shield onto a server in
     danger), "cards" once step 3 is done (drag a card onto the map). Each of these holds the night until its move is made or Got it
     is pressed; "idle", "after_phone" and the "*_wait" stages hold nothing. A note steps aside while something is in hand
     or a cut scene is up (the cut scene sits on the same layer). */
  const GD_HOLD = ["plug", "phone", "tools", "cards"];
  const guideHeld = () => !!GD && GD_HOLD.includes(GD.stage);

  function guideSync() {
    if (!GD) return;
    if (!S || S.over || !GD.stage) { coachOff(); return; }
    if (S.paused) return;      // hidden while paused (liquid.css), back as it was on Resume
    const t = performance.now(), busy = !!(S.hold || S.drag || S.sel);
    if (GD.stage === "tools_wait" && t >= GD.at) {
      GD.x = stepDone(3) ? null : dangerServer();
      if (!GD.x) Object.assign(GD, { stage: "cards_wait", at: t + 700 });
      else if (!busy) GD.stage = "tools";
    }
    if (GD.stage === "cards_wait" && t >= GD.at) {
      if (PLAYS.some((k) => S.played[k])) GD.stage = "";
      // 11/27 review: the cards are steps 4 to 8; pointing at them before step 3 (Got it on the tools note) made step 3 late
      else if (nextOrder() > 3 && !busy) GD.stage = "cards";   // 11/27 regression review: steps 1 to 3 all done
    }
    let want = null;
    if (GD.stage && !busy && t >= GD.at) {
      if (GD.stage === "plug") want = S.open === "night_pc" ? ($("#irPlug") ? "plug" : null) : t - GD.t0 > 1300 ? "node" : null;
      else if (GD_HOLD.includes(GD.stage)) want = GD.stage;
    }
    if (want !== GD.key) { coachOff(); if (want) coachOn(want); }
  }

  // a move was made: on to the guide's next note (the one it answered goes away)
  function guideMove(k) {
    if (!GD || !GD.stage || !S) return;
    const t = performance.now(), was = GD.stage;
    if (was === "plug") {
      if (S.soc) Object.assign(GD, { stage: "tools_wait", at: t + 900 });
      // the unplug; or the night PC switched off (a trap), so its cable no longer matters: on to the phone
      else if (k === "unplug" || (k === "power_off" && S.nodes.night_pc && S.nodes.night_pc.state === "off")) Object.assign(GD, { stage: "phone", at: t + 700 });
      else GD.stage = "idle";      // another trap first: no note until the cable or the call
    } else if (k === "soc" && ["idle", "phone", "after_phone"].includes(was)) Object.assign(GD, { stage: "tools_wait", at: t + 900 });
    else if (k === "unplug" && was === "idle" && !S.soc) Object.assign(GD, { stage: "phone", at: t + 700 });
    // (also while the cards note waits for step 3: it comes a moment after the move, not on the drop)
    else if (STEP3.includes(k) && ["tools", "tools_wait", "cards_wait"].includes(was)) Object.assign(GD, { stage: "cards_wait", at: t + 700 });
    else if (PLAYS.includes(k) && was === "cards") GD.stage = "";
    if (GD.stage !== was) guideSync();
  }

  function guideOk(want) {     // Got it: the note goes and the night moves on
    if (!GD) return;
    if (want === "phone" && GD.stage === "phone") GD.stage = "after_phone";
    else if (want === "tools" && GD.stage === "tools") Object.assign(GD, { stage: "cards_wait", at: performance.now() + 700 });
    else if (want === "cards" && GD.stage === "cards") GD.stage = "";
  }

  function guideStop() { if (GD) { GD.stage = ""; coachOff(); } }

  function coachOff() {
    if (!GD) return;
    if (GD.c) GD.c.close();
    GD.c = null; GD.key = null;
  }

  function coachOn(want) {
    const GOT = { en: "Got it", zh: "知道了" }, ok = () => { GD.c = null; GD.key = null; guideOk(want); };
    let o = null;
    if (want === "plug") o = { target: () => $("#irPlug"), gesture: "drag-right", step_en: "Step 1", step_zh: "第 1 步",
      en: "Stop the spread first: pull its network cable, drag the plug to the right. Don't press Power.", zh: "先擋住擴散：把網路線拔掉，插頭往右拖。不要按電源。" };
    else if (want === "node") o = { target: () => $('.ir-node[data-k="night_pc"] .ir-disc'), gesture: "click", step_en: "Step 1", step_zh: "第 1 步",
      en: `Click the ${NODE.night_pc.en} to see it up close.`, zh: `點${NODE.night_pc.zh}，打開來近看。` };
    // 11/27 review: after Got it the keyboard goes to the control the note is about (focusAfter): the first digit's key,
    // the EDR shield, the first card that can be played
    else if (want === "phone") o = { target: () => $("#irPhone"), focusAfter: () => $(`#irKeys [data-k="${SOC_NUM[0]}"]`) || $("#irKeys button"), gesture: "click", step_en: "Step 2", step_zh: "第 2 步", button: GOT, onOk: ok,
      en: `Now call the SOC: dial ${SOC_NUM} on the desk phone and press Call.`, zh: `接著打給資安監控中心：在桌上電話按 ${SOC_NUM}，再按撥出。` };
    else if (want === "tools" && NODE[GD.x]) {
      const x = NODE[GD.x], on = S.nodes[GD.x].state === "infected";
      o = { target: () => $('.ir-tool[data-k="isolate"]'), focusAfter: () => $('.ir-tool[data-k="isolate"]'), to: () => $(`.ir-node[data-k="${GD.x}"] .ir-disc`), gesture: "drag-to", step_en: "Step 3", step_zh: "第 3 步", button: GOT, onOk: ok,
        en: `Drag the EDR shield onto the ${x.en} (${on ? "it is encrypting now" : "the red is heading there"}). A shielded device stops encrypting and spreading.`,
        zh: `把端點防護盾牌拖到${x.zh}上（${on ? "它正在加密" : "紅色正往那裡去"}）。被隔離的裝置就不會再加密，也不會再擴散。` };
    } else if (want === "cards") o = { target: () => $("#irHand .ir-card:not(.is-locked):not(.is-used)") || $("#irHand .ir-card"), focusAfter: () => $("#irHand .ir-card:not(.is-locked):not(.is-used)"), to: () => $("#irMap"), gesture: "drag-to",
      step_en: "Steps 4 to 8", step_zh: "第 4 到第 8 步", button: GOT, onOk: ok,
      en: "The next steps are cards: drag a card onto the map to play it. A locked card says what has to happen first.", zh: "接下來的步驟都是卡片：把卡片拖到網路圖上就是出牌。鎖住的卡會寫要先做什麼。" };
    if (!o) { if (want === "tools") guideOk("tools"); return; }      // never hold the night with no note up
    GD.c = CB.coach(st, o); GD.key = want;
  }

  // the server the red is on, or heading for, that a shield can still reach (in the order the ransomware goes for them)
  function dangerServer() {
    const cand = PRIORITY.filter((k) => NODE[k] && (NODE[k].type === "server" || NODE[k].type === "nas") && targetOk("isolate", k));
    return cand.find((k) => S.nodes[k].state === "infected") || cand.find((k) => S.nodes[k].state === "clean" && neighbours(k).some((j) => active(j))) || null;
  }

  /* ------------------------------------------------------------------ the status column */
  function status() {
    const box = $("#irStatus");
    if (!box) return;
    const cnt = { encrypted: 0, infected: 0, safe: 0 };
    let gb = 0;
    for (const n of NODES) {
      if (n.safe) continue;
      const s = S.nodes[n.k];
      if (s.state !== "restored") gb += s.pct * (GB[n.type] || 0);
      if (s.pct >= 1 && s.state !== "restored") cnt.encrypted++; else if (s.state === "infected") cnt.infected++; else cnt.safe++;
    }
    const row = (ok, en, zh, v) => `<li class="${ok === true ? "is-ok" : ok === false ? "is-bad" : "is-wait"}"><span>${bi(en, zh)}</span><b>${v}</b></li>`;
    const sys = (k) => { const s = S.nodes[k]; return s.state === "restored" ? ["✓", true] : s.pct >= 1 ? ["🔒", false]
      : s.pct > 0 && s.state !== "infected" ? [bi(`stopped at ${Math.round(s.pct * 100)}%`, `停在 ${Math.round(s.pct * 100)}%`), true] : s.pct > 0 ? [`${Math.round(s.pct * 100)}%`, null] : [bi("OK", "正常"), true]; };
    box.innerHTML = `<div class="ir-counts"><div class="is-bad"><b>${S.soc ? cnt.encrypted : "?"}</b><span>${bi("encrypted", "已加密")}</span></div>
        <div class="is-wait"><b>${S.soc ? cnt.infected : "?"}</b><span>${bi("encrypting", "加密中")}</span></div><div class="is-ok"><b>${S.soc ? cnt.safe : "?"}</b><span>${bi("not encrypting", "沒在加密")}</span></div></div>
      <p class="ir-gb${gb > 0 && S.soc ? " is-bad" : ""}"><span>${bi("Data encrypted so far", "目前被加密的資料")}</span><b>${S.soc ? `${Math.round(gb).toLocaleString("en-US")} GB` : "?"}</b></p>
      <ul class="ir-rows">
        ${CRIT.map((k) => { const [v, ok] = S.soc ? sys(k) : ["?", null]; return row(ok, NODE[k].en, NODE[k].zh, v); }).join("")}
        ${row(!S.acct, "Crew's VPN session", "歹徒的 VPN 連線", S.acct ? (S.soc ? bi("live", "連線中") : "?") : bi("ended", "已切斷"))}
        ${row(S.plan ? true : null, "Restaurant and front desk", "餐廳和櫃台", S.plan ? bi("on paper", "改用紙本") : bi("waiting", "等待中"))}
        ${row(S.analyzed ? true : null, "Analysis", "分析", S.analyzed ? bi("done", "完成") : S.analyzing > 0 ? bi("running", "進行中") : "—")}
        ${row(S.restored ? true : null, "Restore", "還原", S.restored ? bi("done", "完成") : "—")}
        ${row(S.notified ? true : null, "Notifications", "通知", S.notified ? bi("started", "進行中") : "—")}
        ${row(true, "Offline copy (02:00)", "離線副本（02:00）", bi("in the safe", "在保險箱"))}</ul>`;
  }

  /* ------------------------------------------------------------------ 05:00 */
  // in order = played, and no later step was played before it (a missed step costs only its own point)
  const inOrder = (n) => n in S.stepAt && STEPS.filter((s) => s.order > n).every((s) => !(s.order in S.stepAt) || S.stepAt[s.order] > S.stepAt[n]);
  const right = () => ({
    steps: STEPS.filter((s) => inOrder(s.order)).length,
    kept: CRIT.filter((k) => !S.nodes[k].lost).length,
    clean: S.traps.length ? 0 : 1,
  });
  const shiftScore = () => { const r = right(); return r.steps + r.kept + r.clean; };

  // 11/23 review: 05:00 (or the last shield) can come while a tool, a card or the tape is being dragged: its copy goes too
  function dropGhosts() {
    for (const g of $$(".ir-ghost")) g.remove();
    S.drag = null; S.hover = null;
  }

  async function endShift() {
    if (S.over) return;
    S.over = true;
    loop.stop();
    guideStop();      // 11/27
    dropGhosts();
    await wait(600);
    summary();
  }

  function summary() {
    st.scene("ir_night", 0.25);
    const r = right();
    const order = STEPS.map((s) => `<li class="${inOrder(s.order) ? "is-ok" : s.order in S.stepAt ? "is-late" : "is-miss"}"><b>${s.order}</b><span>${bi(s.text_en, s.text_zh)}</span><i>${bi(s.who_en, s.who_zh)}</i></li>`).join("");
    st.body.innerHTML = `<section class="rs-dinner ir-sum"><div class="rs-sum-l">
      <p class="rs-kicker">${S.contained || S.restored ? bi(`${clockAt(S.clock)} · the network is quiet`, `${clockAt(S.clock)}・網路安靜下來了`) : bi(`${clockAt(S.clock)} · the night shift is over`, `${clockAt(S.clock)}・值班結束了`)}</p>
      <h2 class="rs-dinner-title">${r.kept === CRIT.length && !S.traps.length ? bi("The door access server, the POS back office and the backups made it through.", "門禁伺服器、收銀後台和備份都撐過來了。") : bi(`You got through the night with ${S.shields} shield${S.shields === 1 ? "" : "s"}.`, `撐過這一夜了，還剩 ${S.shields} 面盾牌。`)}</h2>
      <div class="rx-stats rs-dinner-stats">
        <div><b>${r.steps}/${STEPS.length}</b><span>${bi("steps in order", "照順序的步驟")}</span></div>
        <div><b>${r.kept}/${CRIT.length}</b><span>${bi("key systems kept", "保住的關鍵系統")}</span></div>
        <div><b>${S.traps.length}</b><span>${bi("traps", "踩到的陷阱")}</span></div>
        <div><b class="rs-shields-row">${Array.from({ length: sh.shields }, (_, k) => CB.ICON.shield(k < S.shields)).join("")}</b><span>${bi("shields left", "剩下的盾牌")}</span></div>
        <div><b>${S.points.toLocaleString("en-US")}</b><span>${bi("points", "分")}</span></div></div>
      ${CB.personHTML(ANALYST, bi("Get some sleep. Review at the lighthouse at 16:00: I'll bring every card from tonight.", "去睡吧。下午四點燈塔開檢討會，我會把今晚的每張卡片都帶來。"))}
      <button type="button" class="btn rs-start">${bi("Sunday 16:00, the review", "週日下午四點，檢討會")}</button></div>
      <div class="rs-sum-r"><h3 class="ir-sum-h">${bi(`The procedure: “${PROC.name_en}”`, `流程：「${PROC.name_zh}」`)}<small>${bi("From the knowledge graph. Green: played in order (no later step before it).", "出自知識圖。綠色是照順序出的（前面沒有出過更後面的步驟）。")}</small></h3>
      <ol class="ir-steps">${order}</ol></div></section>`;
    G.meter(`<div class="rx-hud"><div class="rx-hud-clock"><b>${esc(clockAt(S.clock))}</b><span>${bi("night", "夜裡")}</span></div><div class="rx-hud-pts"><b>${S.points.toLocaleString("en-US")}</b><span>${bi("points", "分")}</span></div></div>`);
    $(".rs-start", st.body).addEventListener("click", async (ev) => {
      // 11/26 (front-end review C01): Enter again during the time skip doesn't start a second skip and a second board
      const b = ev.currentTarget; if (b.disabled) return; b.disabled = true;
      await CB.timeskip(st, { from: clockAt(S.clock), to: "16:00", place_en: "The review at the lighthouse", place_zh: "燈塔的檢討會", day_en: "Sunday afternoon", day_zh: "週日下午" });
      startBoard();
    });
    window.scrollTo({ top: 0, behavior: reduceMotion ? "auto" : "smooth" });
    // 11/27: the Help panel after the night
    setNow(() => ({ title_en: "After the night", title_zh: "值班結束", ctx: { screen: "end", done: S.order.slice() }, steps: [
      { en: "The night is over. On the right is the procedure from the knowledge graph: a green number was played in order, an amber one late (after a later step), a faded row never.",
        zh: "值班結束了。右邊是知識圖裡的應變流程：號碼是綠色的照順序做了，橘色的做太晚了（在更後面的步驟之後），整行淡掉的是沒做到。" },
      { en: `Your night: ${r.steps} of ${STEPS.length} steps in order, ${r.kept} of ${CRIT.length} key systems kept, ${S.traps.length} trap${S.traps.length === 1 ? "" : "s"}.`,
        zh: `你這一晚：照順序的步驟 ${r.steps}/${STEPS.length}，保住的關鍵系統 ${r.kept}/${CRIT.length}，踩到陷阱 ${S.traps.length} 次。` },
      { en: "Press Sunday 16:00, the review, to go to the case board: three questions that tie the whole week together.", zh: "按「週日下午四點，檢討會」到案情板：三個問題，把整個禮拜的事串起來。" }],
      chips: [{ en: "Why does the order of the steps matter?", zh: "步驟的順序為什麼重要？" }] }));
  }

  function gameOver() {
    S.over = true;
    loop.stop();
    guideStop();      // 11/27
    dropGhosts();
    st.$rs.classList.remove("is-paused");
    st.scene("rush_pos", 0.2);
    CB.over(st, { time: clockAt(S.clock), title_en: "The whole resort is down.", title_zh: "整個渡假村都停擺了。",
      items: S.losses.map((x) => `<li>${bi(x.hit_en, x.hit_zh)}</li>`).join(""),
      text_en: "Try the night again: unplug, don't switch off; call 2199 first so you can see; stop the account, then contain, then restore.",
      text_zh: "再試一次：拔網路線不要關機；先打 2199 才看得到全貌；先停帳號、再圍堵、最後才還原。",
      // 11/26 (front-end review K66): the POS note only when the POS back office went; otherwise the note from Yi-Chen's PC
      pic: S.nodes.pos_bo && S.nodes.pos_bo.lost ? `<img class="rs-ransom" src="/lakeside/static/games/img/ransom.png" alt="Ransom note on the restaurant POS 收銀機上的勒索畫面">`
        : nightNote(ransomLeft(), "The ransom note on the night audit PC 夜間稽核電腦上的勒索畫面", "rs-ransom"),
      again: () => Games.ir(d, main, true) });
    G.meter(`<div class="rx-hud"><div class="rx-hud-pts"><b>${S.points.toLocaleString("en-US")}</b><span>${bi("points", "分")}</span></div></div>`);
    // 11/27: the Help panel when the night is lost (the reasons for each shield are under "Why that went wrong")
    setNow(() => ({ title_en: "The night is lost", title_zh: "今晚輸了", ctx: { screen: "end", done: S.order.slice() }, steps: [
      { en: `All ${sh.shields} shields are gone. The list shows what cost each one.`, zh: `${sh.shields} 面盾牌都沒了。清單上是每一面怎麼丟的。` },
      { en: "Try the night again: unplug, don't switch off; call 2199 first so you can see; stop the account, then contain, then restore.",
        zh: "再試一次：拔網路線不要關機；先打 2199 才看得到全貌；先停帳號、再圍堵、最後才還原。" },
      { en: "Press Try the shift again to start the night over.", zh: "按「重新值班」從頭再來。" }],
      chips: [{ en: "How do I keep my shields next time?", zh: "下次要怎麼保住盾牌？" }] }));
  }

  /* ------------------------------------------------------------------ the case board: the review at the lighthouse */
  const CHAIN = BOARD.chain;
  const CH = Object.fromEntries(CHAIN.map((c) => [c.k, c]));

  function startBoard() {
    loop.stop();
    const shuffled = [3, 6, 0, 5, 2, 7, 1, 4].map((i) => CHAIN[i].k).filter(Boolean);
    B = { q: 0, wrong: QS.map(() => 0), solved: QS.map(() => false), pts: 0, strings: [], tray: shuffled, slots: CHAIN.map(() => null), pick: null, step: 0, tried: {} };
    CB.board(st, { scene: BOARD.scene, dusk: 0.05, analyst: BOARD.analyst, intro_en: BOARD.intro_en, intro_zh: BOARD.intro_zh, cls: "ir-board", cork: corkHTML() });
    $("#irChain").addEventListener("click", chainClick);
    chainDrag();
    $("#irBackups").addEventListener("click", (ev) => { const b = ev.target.closest(".cb-log-row"); if (b) backupRow(b.dataset.k, b); });
    boardHud();
    renderQs();
  }

  function boardHud(pop) {
    G.meter(`<div class="rx-hud"><div class="rx-hud-clock"><b>${esc(BOARD.time)}</b><span>${bi("the lighthouse", `${BOARD.time_zh}，燈塔`)}</span></div>
      <div class="rx-hud-pts"><b id="hudPts">${((S ? S.points : 0) + B.pts).toLocaleString("en-US")}</b><span>${bi("points", "分")}</span></div>
      <div class="rx-hud-qs"><b>${B.solved.filter(Boolean).length}/${QS.length}</b><span>${bi("solved", "破案")}</span></div></div>`);
    if (pop) { const n = el("span", "rx-pop", "+" + pop); $("#hudPts").parentElement.appendChild(n); setTimeout(() => n.remove(), 1200); }
  }

  const FILE = { 1: ["Inbox Rush", "收件匣大作戰"], 2: ["Who May Use What?", "誰能用什麼"], 3: ["The MFA Door", "多因素驗證門"], 4: ["Incident Response", "事件應變"] };
  function chainCard(k, where) {
    const c = CH[k], solved = B && B.solved[0];
    return `<button type="button" class="ir-cc${B && B.pick === k ? " is-pick" : ""}${solved ? " is-done" : ""}" data-k="${k}" data-where="${where}">
      <span class="ir-cc-file">${bi(`File ${c.file}`, CB.caseZh(c.file))}</span><span class="ir-cc-t">${bi(c.en, c.zh)}</span>${solved ? `<time>${chainTime(c)}</time>` : ""}</button>`;
  }
  const chainTime = (c) => `${esc(c.time)}${c.time_zh ? ` <span lang="zh-Hant">${esc(c.time_zh)}</span>` : ""}`;

  // 11/22: an empty slot is a button, so Tab and Enter can put the picked card there too
  function chainHTML() {
    return `<div class="ir-string">${B.slots.map((k, i) => `<div class="ir-slot${k ? " is-full" : ""}" data-slot="${i}"><span class="ir-slot-n">${i + 1}</span>${k ? chainCard(k, "slot") : `<button type="button" class="ir-slot-empty">${bi("empty", "空位")}</button>`}</div>`).join("")}</div>
      <div class="ir-tray">${B.tray.map((k) => chainCard(k, "tray")).join("")}${B.tray.length ? "" : `<p class="ir-tray-empty">${bi("All eight are on the string.", "八張都放上去了。")}</p>`}</div>`;
  }

  function corkHTML() {
    const L = BOARD.backups;
    const response = S ? STEPS.map((s) => { const [en, zh] = STEP_SHORT[s.order] || [s.text_en, s.text_zh]; return `<li class="${inOrder(s.order) ? "is-ok" : s.order in S.stepAt ? "is-late" : "is-miss"}"><b>${s.order}</b><span>${bi(en, zh)}</span></li>`; }).join("") : "";
    const rows = backupRows(L.rows);
    return `<div class="ir-cork-main">
        <div class="cb-doc ir-chain-doc is-pinned" id="irChainDoc"><i class="cb-pin" aria-hidden="true"></i><i class="cb-pin is-r" aria-hidden="true"></i>
          <p class="cb-doc-title">${bi("From the first move to the ransom note", "從第一步到勒索畫面")}</p><div id="irChain">${chainHTML()}</div></div>
        <div class="ir-row2">
          <div class="cb-doc cb-log ir-backups" id="irBackupsDoc"><i class="cb-pin" aria-hidden="true"></i><p class="cb-doc-title">${bi(L.title_en, L.title_zh)}</p>
            <ol class="cb-log-rows" id="irBackups">${rows.map((r) => `<li><button type="button" class="cb-log-row ir-brow is-${esc(r.kind)}" data-k="${esc(r.k)}"><time>${esc(r.t)}</time><span class="cb-log-what">${bi(r.en, r.zh)}</span></button></li>`).join("")}</ol></div>
          <div class="ir-photo" style="--r:1.6deg"><i class="cb-pin" aria-hidden="true"></i>${nightNote("59:00", "The ransom note, photographed by Yi-Chen at 03:48 易真 03:48 拍下的勒索畫面")}<!-- 11/26 (front-end review K66) --><p>${bi("Photo: Yi-Chen, 03:48", "照片：易真，03:48")}</p></div>
        </div></div>
      <div class="cb-side">
        <div class="cb-crew is-known" id="cbCrew"><i class="cb-pin" aria-hidden="true"></i>
          <svg class="cb-crew-face" viewBox="0 0 60 60" aria-hidden="true"><rect width="60" height="60" rx="4" fill="#2b2421"/><circle cx="30" cy="24" r="11" fill="#5b4f49"/><path d="M10 60c2-14 10-21 20-21s18 7 20 21z" fill="#5b4f49"/>
            <text x="30" y="29" text-anchor="middle" font-size="15" font-weight="700" fill="#d8bd77" font-family="Bahnschrift, Segoe UI, sans-serif">?</text></svg>
          <p class="cb-crew-name">${bi("The crew", "同一夥人")}</p><ul class="cb-crew-facts" id="cbCrewFacts"><li>203.0.113.45</li><li>${bi("In through y.chou's VPN at 03:21", "03:21 從 y.chou 的 VPN 進來")}</li></ul></div>
        <div class="cb-doc ir-resp" style="transform:rotate(-.6deg)"><i class="cb-pin" aria-hidden="true"></i><p class="cb-doc-title">${bi("Last night's response", "昨晚的應變")}</p><ol>${response}</ol></div>
      </div>`;
  }

  /* The backup log follows last night: the NAS line shows when it was encrypted, or that it stayed online all night. */
  function backupRows(rows) {
    if (!S) return rows;
    const nas = NODES.find((n) => n.type === "nas"), out = rows.map((r) => Object.assign({}, r));
    const row = nas && out.find((r) => r.k === "nas_hit");
    if (row && !S.nodes[nas.k].lost) Object.assign(row, { t: `${story.start}–${story.end}`, en: "Backup NAS: online all night, on the same network the crew was in", zh: "線上備份 NAS：整夜都連在歹徒進來的那個網路上" });
    else if (row && S.lostAt[nas.k]) row.t = S.lostAt[nas.k];
    return out.map((r, i) => [r, i]).sort((a, b) => (a[0].t < b[0].t ? -1 : a[0].t > b[0].t ? 1 : a[1] - b[1])).map((x) => x[0]);
  }

  function renderQs() {
    const q0 = QS[B.q];
    if (q0 && q0.pick === "string" && !B.solved[B.q]) B.step = 1;
    CB.questions(QS, B, controls);
    setNow(irBoardNow);      // 11/27: after CB.questions, which sets the plain one
    const q = QS[B.q];
    $("#cbCork").classList.toggle("is-picking", !!q && !B.solved[B.q] && q.kind === "choose" && B.step === 1);
    for (const b of $$("#cbQs .cb-opt")) b.addEventListener("click", () => choose(q, b.dataset.k));
    const go = $("#cbGo");
    if (go) go.addEventListener("click", () => (q.pick === "timeline" ? checkDeadline(q) : checkChain(q)));
    if (q && !B.solved[B.q] && q.pick === "string") CB.stringFrom($("#cbSpool"), "#irBackups .cb-log-row", (row) => backupRow(row.dataset.k, row));
    if (q && !B.solved[B.q] && q.pick === "timeline") flagCtl(q);
  }

  /* 11/27: what the Help panel says on the board: CB's lines, plus what this board leaves unsaid (the chain's rule, that the
     backup log's lines are the choices, that the flag goes on the exact hour and its keys), and one question to ask */
  function irBoardNow() {
    const n = CB.boardNow(QS, B), q = QS[B.q];
    if (!q || B.solved[B.q]) return n;
    const add = q.kind === "chain"
      ? { en: "The rule: every card has to sit to the right of everything it needs, because a cause always comes before what it leads to. After a wrong try, Jun-Hao names the first card that can't happen yet.",
          zh: "規則：每張卡都要排在它需要的事情右邊，因為原因一定在結果前面。排錯時，俊豪會說第幾張這時候還不可能發生。" }
      : q.pick === "string"
        ? { en: "There are no answer buttons here: the lines of the backup log on the cork board are the choices. Pull the red string onto the line you would trust, or click that line.",
            zh: "這一題沒有選項按鈕：軟木板上備份紀錄的每一行就是選項。把紅線拉到你信得過的那一行，或直接點那一行。" }
        : q.pick === "timeline"
          ? { en: "The flag has to sit on the exact hour. Drag it, or use the arrow keys (one hour) and Page Up or Page Down (12 hours), then press Pin the deadline here.",
              zh: "紅旗要放在剛好的那個小時。可以用拖的，也可以用方向鍵（一次一小時）和 Page Up、Page Down（一次 12 小時），再按「期限釘在這裡」。" } : null;
    if (add) n.steps.splice(q.how_en ? 2 : 1, 0, add);
    const hrs = q.timeline && q.timeline.answer;
    const chip = q.kind === "chain" ? { en: "What has to come before what?", zh: "哪一步一定要在哪一步之前？" }
      : q.pick === "string" ? { en: "Which backup can we trust?", zh: "哪一份備份信得過？" }
      : q.pick === "timeline" && hrs ? { en: `When do the ${hrs} hours start?`, zh: `${hrs} 小時從什麼時候開始算？` } : null;
    if (chip) n.chips = [chip, ...(n.chips || [])];
    return n;
  }
  const boardCtx = () => ({ screen: "board", q: B.q, tries: B.wrong[B.q] || 0, solved: !!B.solved[B.q] });

  function controls(q) {
    if (q.kind === "chain") { const n = B.slots.filter(Boolean).length; return `<p class="cb-q-sel">${bi(`${n} of ${CHAIN.length} on the string`, `繩子上有 ${n} / ${CHAIN.length} 張`)}</p>
      <button type="button" class="btn cb-go" id="cbGo"${n === CHAIN.length ? "" : " disabled"}>${bi("That's the order", "就是這個順序")}</button>`; }
    if (q.kind === "choose") {
      if (q.pick === "string") return CB.spoolHTML("Drag the red string to the evidence", "把紅線拖到證據上");
      if (q.pick === "timeline") return timelineHTML(q);
      if (B.step === 1) { const o = q.options.find((x) => x.k === q.answer); return `<p class="cb-q-chosen">${bi(o.en, o.zh)}</p><p class="cb-q-how is-next">${bi(q.evidence_en, q.evidence_zh)}</p>`; }
      return `<div class="cb-opts">${q.options.map((o) => `<button type="button" class="cb-opt${B.tried[o.k] ? " is-tried" : ""}" data-k="${esc(o.k)}"${B.tried[o.k] ? " disabled" : ""}>${bi(o.en, o.zh)}</button>`).join("")}</div>`;
    }
    return "";
  }

  /* Q1: the chain. A card is in a valid place when everything it depends on is to its left. */
  function chainClick(ev) {
    const q = QS[B.q];
    if (!q || q.kind !== "chain" || B.solved[B.q] || performance.now() - (B.dragEnd || 0) < 120) return;
    const card = ev.target.closest(".ir-cc"), slot = ev.target.closest(".ir-slot");
    const kb = ev.detail === 0;     // Enter or Space: after the redraw, put the keyboard where the next move is
    if (card && card.dataset.where === "tray") { B.pick = B.pick === card.dataset.k ? null : card.dataset.k; redrawChain(); if (kb) chainFocus(B.pick ? ".ir-slot-empty" : `.ir-cc[data-k="${card.dataset.k}"]`); return; }
    if (card && card.dataset.where === "slot") {                  // take it back
      const i = B.slots.indexOf(card.dataset.k);
      if (B.pick) { const back = B.slots[i]; B.slots[i] = B.pick; B.tray = B.tray.filter((x) => x !== B.pick); B.tray.push(back); B.pick = null; }
      else { B.slots[i] = null; B.tray.push(card.dataset.k); }
      redrawChain();
      if (kb) chainFocus(`.ir-slot[data-slot="${i}"] button`);
      return;
    }
    if (slot && B.pick && !B.slots[+slot.dataset.slot]) {
      B.slots[+slot.dataset.slot] = B.pick; B.tray = B.tray.filter((x) => x !== B.pick); B.pick = null; redrawChain();
      if (kb) chainFocus(".ir-tray .ir-cc");
    }
  }
  function chainFocus(sel) { const n = $(`#irChain ${sel}`) || $("#cbGo:not([disabled])") || $("#irChain .ir-cc"); if (n) n.focus({ preventScroll: true }); }

  /* Q1 by hand: drag a card onto a slot (a full slot swaps), or back onto the pile. */
  function chainDrag() {
    const box = $("#irChain");
    let p = null;
    box.addEventListener("pointerdown", (ev) => {
      const card = ev.target.closest(".ir-cc"), q = QS[B.q];
      if (!card || ev.button !== 0 || !q || q.kind !== "chain" || B.solved[B.q]) return;
      const r = card.getBoundingClientRect();
      p = { k: card.dataset.k, from: card.dataset.where, x0: ev.clientX, y0: ev.clientY, dx: ev.clientX - r.left, dy: ev.clientY - r.top, w: r.width, moved: false, ghost: null, card };
      CB.cap(card, ev.pointerId);
    });
    box.addEventListener("pointermove", (ev) => {
      if (!p) return;
      if (!p.moved && Math.hypot(ev.clientX - p.x0, ev.clientY - p.y0) > 6) {
        p.moved = true;
        const g = p.card.cloneNode(true);
        g.classList.add("ir-cc-ghost");
        g.style.width = `${p.w / (G.k() || 1)}px`;      // 11/26 (front-end review K69): canvas width, drawn at the canvas's scale
        g.style.transformOrigin = "0 0";
        document.body.appendChild(g);
        p.ghost = g;
        p.card.classList.add("is-lifted");
        CB.SFX.play("paper");
      }
      if (!p.ghost) return;
      p.ghost.style.transform = `translate(${ev.clientX - p.dx}px, ${ev.clientY - p.dy}px) rotate(-2deg) scale(${G.k() || 1})`;      // 11/26 (front-end review K69)
      const e = document.elementFromPoint(ev.clientX, ev.clientY), slot = e && e.closest(".ir-slot");
      for (const s of $$(".ir-slot.is-over", box)) if (s !== slot) s.classList.remove("is-over");
      if (slot) slot.classList.add("is-over");
    });
    const end = (ev) => {
      if (!p) return;
      const { k, from, moved, ghost } = p;
      p = null;
      if (ghost) ghost.remove();
      if (!moved) return;
      B.dragEnd = performance.now();
      const e = document.elementFromPoint(ev.clientX, ev.clientY), slot = e && e.closest(".ir-slot"), tray = e && e.closest(".ir-tray");
      if (slot) {
        const i = +slot.dataset.slot, cur = B.slots[i];
        if (from === "tray") { B.tray = B.tray.filter((x) => x !== k); if (cur) B.tray.push(cur); }
        else { const j = B.slots.indexOf(k); B.slots[j] = cur && cur !== k ? cur : null; }
        B.slots[i] = k;
        CB.SFX.play("pin");
      } else if (tray && from === "slot") {
        B.slots[B.slots.indexOf(k)] = null;
        B.tray.push(k);
      }
      B.pick = null;
      redrawChain();
    };
    box.addEventListener("pointerup", end);
    box.addEventListener("pointercancel", end);
    // 11/23 review: the pointer was taken away under the drag: the card stays where it was and its copy goes
    box.addEventListener("lostpointercapture", () => {
      if (!p) return;
      const { ghost, card } = p;
      p = null;
      if (ghost) ghost.remove();
      if (card) card.classList.remove("is-lifted");
      for (const s of $$(".ir-slot.is-over", box)) s.classList.remove("is-over");
    });
  }

  /* Q3 on a timeline: the week from the moment we found out; drag the flag to the latest time we may still notify. */
  const DAYS = [["Sat", "週六"], ["Sun", "週日"], ["Mon", "週一"], ["Tue", "週二"], ["Wed", "週三"], ["Thu", "週四"], ["Fri", "週五"]];
  function tlAt(T, h) {
    const [d0, hm] = String(T.start).split(" "), day0 = Math.max(0, DAYS.findIndex((x) => x[0] === d0)), tot = CB.mins(hm) / 60 + h;
    const day = (day0 + Math.floor(tot / 24)) % 7, hr = Math.round(tot % 24);
    return [`${DAYS[day][0]} ${CB.pad2(hr)}:00`, `${DAYS[day][1]} ${CB.pad2(hr)}:00`];
  }
  // 11/23 review: the line starts at 23:00 on Saturday, so the day names sit at midnight (they sat at 23:00 and the review,
  // Sunday 16:00, looked as if it was still Saturday); the small ticks are 00:00, 06:00, 12:00 and 18:00
  const tlHour0 = (T) => CB.mins(String(T.start).split(" ")[1]) / 60;
  function timelineHTML(q) {
    const T = q.timeline, h = B.flag || 0, pct = (x) => `${((x / T.hours) * 100).toFixed(2)}%`;
    const h0 = tlHour0(T), ticks = [];
    for (let x = (((-h0) % 6) + 6) % 6; x <= T.hours; x += 6) {
      const [en, zh] = tlAt(T, x);
      ticks.push((h0 + x) % 24 === 0 ? `<span class="ir-tl-tick is-day" style="--x:${pct(x)}"><b>${esc(en.split(" ")[0])}</b><small>${esc(zh.split(" ")[0])}</small></span>` : `<span class="ir-tl-tick" style="--x:${pct(x)}"></span>`);
    }
    const [en, zh] = tlAt(T, h);
    return `<div class="ir-tl"><div class="ir-tl-track" id="irTl">${ticks.join("")}
        <span class="ir-tl-mark is-found" style="--x:0%">${bi("found out", "發現")}</span>
        ${T.review_at != null ? `<span class="ir-tl-mark is-review" style="--x:${pct(T.review_at)}">${bi("review", "檢討會")}</span>` : ""}
        <button type="button" class="ir-tl-flag" id="irFlag" style="--x:${pct(h)}" aria-label="Deadline flag. The arrow keys move it by an hour.">
          <svg viewBox="0 0 24 32" aria-hidden="true"><path d="M5 2v30" stroke="#5b4f49" stroke-width="2.4"/><path d="M6 3h15l-4 6 4 6H6z" fill="#b3261e"/></svg></button></div>
      <p class="ir-tl-now" id="irFlagT">${bi(en, zh)} <span class="ir-tl-h">${h} h</span></p>
      <button type="button" class="btn cb-go" id="cbGo">${bi("Pin the deadline here", "期限釘在這裡")}</button></div>`;
  }
  function flagCtl(q) {
    const T = q.timeline, track = $("#irTl"), flag = $("#irFlag");
    if (!track || !flag) return;
    const set = (h) => {
      B.flag = Math.max(0, Math.min(T.hours, Math.round(h)));
      flag.style.setProperty("--x", `${((B.flag / T.hours) * 100).toFixed(2)}%`);
      const [en, zh] = tlAt(T, B.flag);
      $("#irFlagT").innerHTML = `${bi(en, zh)} <span class="ir-tl-h">${B.flag} h</span>`;
    };
    let drag = false;
    const at = (x) => { const r = track.getBoundingClientRect(); return ((x - r.left) / r.width) * T.hours; };
    flag.addEventListener("pointerdown", (ev) => { if (ev.button !== 0) return; ev.preventDefault(); ev.stopPropagation(); drag = true; CB.cap(flag, ev.pointerId); flag.classList.add("is-drag"); });
    const h0 = tlHour0(T);      // a click as the flag passes one of the ticks (00:00, 06:00, 12:00, 18:00)
    flag.addEventListener("pointermove", (ev) => { if (!drag) return; const before = B.flag; set(at(ev.clientX)); if (B.flag !== before && (h0 + B.flag) % 6 === 0) CB.SFX.play("tick"); });
    const end = () => { if (!drag) return; drag = false; flag.classList.remove("is-drag"); };
    flag.addEventListener("pointerup", end);
    flag.addEventListener("pointercancel", end);
    track.addEventListener("pointerdown", (ev) => { if (ev.target.closest("#irFlag")) return; set(at(ev.clientX)); });
    flag.addEventListener("keydown", (ev) => {
      const step = { ArrowLeft: -1, ArrowRight: 1, PageDown: -12, PageUp: 12 }[ev.key];
      if (step) { ev.preventDefault(); set((B.flag || 0) + step); }
    });
  }
  function checkDeadline(q) {
    const T = q.timeline, h = B.flag || 0;
    if (h === T.answer) return solve(q);
    CB.nope(B);
    const o = T.review_at != null && Math.abs(h - T.review_at) <= 2 ? q.options.find((x) => x.k === "review") : null;
    const w = o ? [o.why_en, o.why_zh] : h < T.answer ? [q.early_en, q.early_zh] : [q.late_en, q.late_zh];
    CB.cbSay(bi(w[0], w[1]), "is-no");
    // 11/27: the same reason in the Help panel, where the IT Assistant can be asked about it
    const [en, zh] = tlAt(T, h);
    mistake({ at: "", title_en: `${en} is not the deadline`, title_zh: `${zh} 不是期限`, why: [{ en: w[0], zh: w[1] }], ctx: boardCtx() });
  }

  function redrawChain() { $("#irChain").innerHTML = chainHTML(); renderQs(); requestAnimationFrame(() => CB.drawStrings(B.strings)); }

  function checkChain(q) {
    const pos = Object.fromEntries(B.slots.map((k, i) => [k, i]));
    const bad = B.slots.findIndex((k) => CH[k].after.some((a) => pos[a] > pos[k]));
    if (bad < 0) return solve(q);
    CB.nope(B);
    for (const s of $$(".ir-slot")) s.classList.toggle("is-bad", +s.dataset.slot === bad);
    CB.cbSay(bi(CB.fill(q.wrong_en, { n: bad + 1 }), CB.fill(q.wrong_zh, { n: bad + 1 })), "is-no");
    const c = CH[B.slots[bad]];      // 11/27: and in the Help panel
    mistake({ at: "", title_en: "That order doesn't work yet", title_zh: "這個順序還不對", ctx: boardCtx(), why: [
      { en: CB.fill(q.wrong_en, { n: bad + 1 }), zh: CB.fill(q.wrong_zh, { n: bad + 1 }) },
      { en: `"${c.en}" needs a card that sits to its right. Every card has to sit to the right of everything it needs.`, zh: `「${c.zh}」需要的卡排在它右邊了。每張卡都要排在它需要的事情右邊。` }] });
  }

  /* Q2 and Q3: choose; Q2 then points at the backup log */
  function choose(q, k) {
    if (k === q.answer) {
      if (q.evidence) { B.step = 1; CB.cbSay(bi(q.evidence_en, q.evidence_zh), "is-good"); return renderQs(); }
      return solve(q);
    }
    const o = q.options.find((x) => x.k === k);
    B.tried[k] = true;
    renderQs();          // 11/26 (front-end review K46): re-render first, or the new card replaces the shaking one
    CB.nope(B);
    CB.cbSay(bi(o.why_en || "", o.why_zh || ""), "is-no");
    if (o.why_en) mistake({ at: "", title_en: `Not "${o.en}"`, title_zh: `不是「${o.zh}」`, why: [{ en: o.why_en, zh: o.why_zh || "" }], ctx: boardCtx() });      // 11/27
  }

  function backupRow(k, btn) {
    const q = QS[B.q];
    if (!q || B.solved[B.q] || q.kind !== "choose" || B.step !== 1 || !q.evidence) return;
    if (k === q.evidence) { btn.classList.add("is-ok"); return solve(q); }
    CB.nope(B);
    const o = q.row_hint && q.options.find((x) => x.k === q.row_hint[k]);
    const w = o ? [o.why_en, o.why_zh] : [q.wrong_evidence_en, q.wrong_evidence_zh];
    CB.cbSay(bi(w[0], w[1]), "is-no");
    const r = backupRows(BOARD.backups.rows).find((x) => x.k === k);      // 11/27: and in the Help panel, with the line as it is on the board
    mistake({ at: "", title_en: r ? `Not the line "${r.en}"` : "Not that line", title_zh: r ? `不是「${r.zh}」這一行` : "不是這一行", why: [{ en: w[0], zh: w[1] }], ctx: boardCtx() });
  }

  function solve(q) {
    const i = B.q;
    B.solved[i] = true;
    const pts = CB.qPoints(B, i);
    B.pts += pts;
    if (q.kind === "chain") {
      // the right order by time, with the evidence times turned over
      B.slots = CHAIN.map((c) => c.k);
      B.tray = [];
      $("#irChain").innerHTML = chainHTML();
      B.strings.push(["#irChainDoc .cb-pin", "#cbCrew .cb-pin", true]);
      fact(bi("Eight steps, late October to last night", "十月底到昨晚，八個步驟"));
    } else if (q.answer === "offline") {
      B.strings.push(["#irBackupsDoc .cb-pin", "#cbCrew .cb-pin", true]);
      fact(bi("Restore from the 02:00 offline copy", "從 02:00 離線副本還原"));
    } else {
      fact(bi("Notify by Tuesday 23:00", "週二 23:00 前通報"));
    }
    boardHud(pts);
    CB.solvedFx();
    CB.cbSay(bi(q.solved_en, q.solved_zh), "is-good");
    B.q = i + 1; B.step = 0;
    renderQs();
    requestAnimationFrame(() => CB.drawStrings(B.strings));
    if (B.solved.every(Boolean)) CB.addClose(wrapUp);
    // 11/22: solved with a button the redraw took away (the chain's "That's the order"): on to the next question's control
    CB.refocus("#cbQ #cbSpool, #cbQ .cb-opt:not([disabled]), #cbQ #irFlag, #cbQs .cb-close");
    showNext();
  }

  // 11/26 (front-end review K64): the next question (Q3's timeline and its pin button) opened below the bottom of the
  // questions column, with the keyboard on a flag nobody could see: scroll the column (only the column, not the stage) so
  // the open question, or the close button at the end, is in view, its top first if it is taller than the column
  function showNext() {
    const cur = $("#cbQ") || $("#cbQs .cb-close"), col = cur && cur.closest(".cb-right");
    if (!col || col.scrollHeight <= col.clientHeight) return;
    const k = G.k() || 1, r = cur.getBoundingClientRect(), c = col.getBoundingClientRect();
    const above = (r.top - c.top) / k - 8, below = (r.bottom - c.bottom) / k + 8;
    const by = above < 0 ? above : below > 0 ? Math.min(above, below) : 0;
    if (by) col.scrollBy({ top: by, behavior: reduceMotion ? "auto" : "smooth" });
  }

  function fact(html) { $("#cbCrewFacts").insertAdjacentHTML("beforeend", `<li class="is-new">${html}</li>`); }

  /* ------------------------------------------------------------------ the whole casebook closes */
  function wrapUp() {
    CB.cbSay(bi("That's the week. Thanks, partner.", "這個禮拜的案子都結了。謝啦，搭檔。"), "is-good");
    const links = CHAIN.map((c, i) => { const n = d.nodes[c.control]; return `<li><span class="ir-link-n">${i + 1}</span><div><p class="ir-link-t">${bi(c.en, c.zh)}<time>${chainTime(c)}</time></p>
      ${n ? `<p class="ir-link-c"><b>${bi(n.name_en, n.name_zh)}</b> ${bi(n.desc_en, n.desc_zh)}</p>` : ""}</div></li>`; }).join("");
    CB.closed(st, { stamp_zh: "全案結案", wrap_en: BOARD.wrap_en, wrap_zh: BOARD.wrap_zh, cases: d.cases, why: BOARD.case_why,
      body: `<h3 class="cb-cases-title">${bi("Where each link could have been cut", "每一環可以在哪裡被擋下")}<small>${bi("Controls from the knowledge graph", "知識圖裡的防護措施")}</small></h3><ol class="ir-links-list">${links}</ol>`,
      onResults: finale });
    setNow(() => ({ title_en: "Case closed", title_zh: "結案", ctx: { screen: "closed" }, steps: [      // 11/27
      { en: "The whole week is solved. On the left, each link of the chain with the control from the knowledge graph that could have cut it.", zh: "整個禮拜的案子都解開了。左邊是這條鏈的每一環，還有知識圖裡能把它擋下來的防護措施。" },
      { en: "On the right, real cases with the same moves.", zh: "右邊是用了同一招的真實案例。" },
      { en: "Press See my results for your score.", zh: "按「看結果」看你的分數。" }] }));
  }

  async function finale() {
    const r = right(), firstTry = B.wrong.filter((w, i) => B.solved[i] && w === 0).length;
    const score = shiftScore() + firstTry;
    const rank = CB.finale(st, { file: 4, ranks: story.ranks, score, total: TOTAL, scene: "ir_home", dusk: 0.15,
      stats: [{ v: (S.points + B.pts).toLocaleString("en-US"), en: "points", zh: "分" }, { v: `${r.steps}/${STEPS.length}`, en: "steps in order", zh: "照順序的步驟" },
        { v: `${r.kept}/${CRIT.length}`, en: "key systems kept", zh: "保住的關鍵系統" }, { v: `${S.traps.length}`, en: "traps", zh: "踩到的陷阱", hit: !!S.traps.length },
        { v: `${S.shields}/${sh.shields}`, en: "shields left", zh: "剩下的盾牌" }, { v: `${firstTry}/${QS.length}`, en: "solved first try", zh: "一次就解開" }],
      body: `<section class="ir-book" id="irBook"><h2>${bi("The Awards Night casebook", "頒獎晚會事件簿")}</h2><p class="g-hint">${bi("Loading your four case files…", "讀取四個案件的成績…")}</p></section>`,
      next: null, again: () => Games.ir(d, main, true) });
    setNow(() => ({ title_en: "Your results", title_zh: "你的成績", ctx: { screen: "end" }, steps: [      // 11/27
      { en: `The case score counts the steps played in order, the critical systems kept, a night with no trap and the questions solved on the first try: ${TOTAL} in all. The medal comes from it.`,
        zh: `本案分數算的是：照順序的步驟、保住的關鍵系統、整晚沒踩陷阱、一次就解開的推理題，滿分 ${TOTAL}。獎牌看這個分數。` },
      { en: "Below is the whole casebook: click a case file to play it.", zh: "下面是整本事件簿，點一個案件就能去玩。" },
      { en: "Play again starts the night over. Back to the tour closes the game.", zh: "按「再玩一次」重新值班；按「回到導覽」關掉遊戲。" }] }));
    B = null;
    await (rank.saved || wait(500));   // wait for G.save to write this chapter, then read all four back (review: a fixed 500 ms raced the tunnel)
    let games = {};
    try { const res = await fetch(`/api/state?session=${encodeURIComponent(G.session)}`); games = ((await res.json()).state || {}).games || {}; } catch { /* offline: show this chapter only */ }
    if (G.unsaved && !games[G.unsaved.game]) games[G.unsaved.game] = { best: G.unsaved.score, total: G.unsaved.total };   // 11/26: not saved, still shown
    const book = $("#irBook");
    if (!book) return;
    const files = ["phish", "access", "mfa", "ir"];
    const done = files.filter((k) => games[k]).length;
    book.innerHTML = `<h2>${bi("The Awards Night casebook", "頒獎晚會事件簿")}</h2>
      <ol class="ir-book-files">${files.map((k, i) => { const g = games[k]; return `<li class="${g ? "is-done" : ""}"><span class="ir-book-n">${i + 1}</span>
        <a href="/lakeside/games/${k}">${bi(CB.NEXT[k][0], CB.NEXT[k][1])}</a><b>${g ? `${g.best} / ${g.best_total ?? g.total}` : bi("not played", "還沒玩")}</b></li>`; }).join("")}</ol>
      <p class="g-hint">${done === 4 ? bi("All four case files closed. The balloon is waiting to take you home.", "四個案件都結案了。熱氣球在等你回家。") : bi(`${done} of 4 case files closed. The others are waiting in the tour.`, `四個案件裡結案了 ${done} 個，其他的還在導覽裡等你。`)}</p>`;
    if (done === 4 && rank.key !== "gold") st.confetti();
  }

  if (!replay) setNow(() => ({ title_en: "The case file", title_zh: "案件封面", ctx: { screen: "title" }, steps: [      // 11/27
    { en: "This is case file 4, the last one of the Awards Night casebook: a ransomware night at the resort.", zh: "這是頒獎晚會事件簿的第四案，也是最後一案：渡假村的勒索軟體之夜。" },
    { en: "Press Open the case file to read the briefing. Nothing starts until you take the call.", zh: "按「打開這個案件」看說明。接電話之前，什麼都不會開始。" }] }));
  if (replay) startShift();
  else CB.title(st, { file: 4, scene: "ir_night", title_en: "Incident Response", title_zh: "事件應變", time: story.start,
    place_en: (story.title || {}).place_en, place_zh: (story.title || {}).place_zh, hook_en: (story.title || {}).hook_en, hook_zh: (story.title || {}).hook_zh, onGo: brief });
};
