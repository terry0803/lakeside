/* The Awards Night casebook, chapters 2 to 4 (11/21 evening): what they share with chapter 1 (phish.js, which keeps its own
   copy). The stage cut from the tour's renders, the score bar in the page header, the cut scene when something gets
   through, and the case board: a cork board in a wooden frame, pins, red string, index-card questions, CASE CLOSED and
   the results with the next case file. Same class names and look as chapter 1, so game.css styles all four alike.
   Every chapter keeps its own state; these are plain helpers. */
"use strict";

const CB = (() => {
  const IMG = "/lakeside/static/games/img/scenes/";
  const fill = (s, map) => String(s || "").replace(/\{(\w+)\}/g, (_, k) => (k in map ? map[k] : ""));
  const mins = (t) => { const m = /^(\d+):(\d+)/.exec(t || ""); return m ? +m[1] * 60 + +m[2] : 0; };
  const hhmm = (m) => { const t = ((Math.floor(m) % 1440) + 1440) % 1440; return `${String(Math.floor(t / 60)).padStart(2, "0")}:${String(t % 60).padStart(2, "0")}`; };
  const pad2 = (n) => String(n).padStart(2, "0");

  const ICON = {
    pause: `<svg viewBox="0 0 16 16" aria-hidden="true"><path d="M4.5 3h2.4v10H4.5zM9.1 3h2.4v10H9.1z" fill="currentColor"/></svg>`,
    play: `<svg viewBox="0 0 16 16" aria-hidden="true"><path d="M5 3l8 5-8 5z" fill="currentColor"/></svg>`,
    phone: `<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M6.6 3.5 9.4 7l-1.8 2.3a12 12 0 0 0 7.1 7.1L17 14.6l3.5 2.8-1.6 3.1c-.4.7-1.2 1.1-2 1C9.4 20.6 3.4 14.6 2.5 7.1c-.1-.8.3-1.6 1-2z" fill="currentColor"/></svg>`,
    mail: `<svg viewBox="0 0 24 24" aria-hidden="true"><rect x="2.5" y="5" width="19" height="14" rx="2" fill="none" stroke="currentColor" stroke-width="1.8"/><path d="M3.5 6.5 12 13l8.5-6.5" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linejoin="round"/></svg>`,
    ticket: `<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M3 7.5V5h18v2.5a2.5 2.5 0 0 0 0 5V19H3v-6.5a2.5 2.5 0 0 0 0-5z" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linejoin="round"/><path d="M14 5.5v13" stroke="currentColor" stroke-width="1.4" stroke-dasharray="2 2"/></svg>`,
    walk: `<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="13" cy="4.5" r="2.2" fill="currentColor"/><path d="M10 21l2.4-6.5L15 17v4M12.4 14.5 13 9l-3.5 2-1.5 3.5M13 9l3 3.5 3 .5" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round"/></svg>`,
    lock: `<svg viewBox="0 0 24 24" aria-hidden="true"><rect x="5" y="10.5" width="14" height="10" rx="2" fill="currentColor"/><path d="M8 10.5V8a4 4 0 0 1 8 0v2.5" fill="none" stroke="currentColor" stroke-width="2"/></svg>`,
    check: `<svg viewBox="0 0 16 16" aria-hidden="true"><path d="M3 8.5l3.2 3L13 4.8" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"/></svg>`,
    cross: `<svg viewBox="0 0 16 16" aria-hidden="true"><path d="M4 4l8 8M12 4l-8 8" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"/></svg>`,
    bulb: `<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M9 18h6M10 21h4M12 3a6 6 0 0 0-3.6 10.8c.7.6 1.1 1.3 1.1 2.2h5c0-.9.4-1.6 1.1-2.2A6 6 0 0 0 12 3z" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linejoin="round"/></svg>`,
    shield: (on) => `<svg viewBox="0 0 24 26" class="${on ? "is-on" : "is-off"}" aria-hidden="true"><path d="M12 1.5 21 5v7.2c0 6-4 10.4-9 12.3C7 22.6 3 18.2 3 12.2V5z" fill="${on ? "currentColor" : "none"}" stroke="currentColor" stroke-width="1.8" stroke-linejoin="round"/>${on ? `<path d="M8 12.6l3 3 5.4-6" fill="none" stroke="#fff" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"/>` : `<path d="M9 9l6 7M15 9l-6 7" stroke="currentColor" stroke-width="1.6" stroke-linecap="round"/>`}</svg>`,
  };

  /* Bigger line icons for the "how to play" tiles on the briefing card. */
  const RULE = {
    drag: `<svg viewBox="0 0 48 48" aria-hidden="true"><rect x="13" y="12" width="22" height="16" rx="3" fill="#fff" stroke="currentColor" stroke-width="2"/><path d="M16 17h12M16 22h8" stroke="currentColor" stroke-width="2" stroke-linecap="round"/><path d="M6 20l-4 4 4 4M42 20l4 4-4 4" fill="none" stroke="#c4321f" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"/><path d="M24 30v9l3-2.5 2 5 3-1.3-2-4.8 4-.4z" fill="currentColor"/></svg>`,
    eye: `<svg viewBox="0 0 48 48" aria-hidden="true"><circle cx="20" cy="20" r="11" fill="#fff" stroke="currentColor" stroke-width="2.6"/><path d="M28 28l11 11" stroke="currentColor" stroke-width="4" stroke-linecap="round"/><path d="M14 20h12M20 14v12" stroke="#c4321f" stroke-width="2" stroke-linecap="round" opacity=".8"/></svg>`,
    phone: `<svg viewBox="0 0 48 48" aria-hidden="true"><rect x="14" y="5" width="20" height="38" rx="4" fill="#fff" stroke="currentColor" stroke-width="2.4"/><path d="M21 9h6" stroke="currentColor" stroke-width="2" stroke-linecap="round"/><path d="M8 16c-2 4-2 12 0 16M40 16c2 4 2 12 0 16" fill="none" stroke="#b08a3e" stroke-width="2.4" stroke-linecap="round"/><circle cx="24" cy="38" r="2" fill="currentColor"/></svg>`,
    fuse: `<svg viewBox="0 0 48 48" aria-hidden="true"><circle cx="24" cy="26" r="15" fill="#fff" stroke="currentColor" stroke-width="2.4"/><path d="M24 26V16M24 26l7 5" stroke="currentColor" stroke-width="2.6" stroke-linecap="round"/><path d="M19 6h10M24 6v5" stroke="currentColor" stroke-width="2.4" stroke-linecap="round"/><path d="M36 10l4-3" stroke="#c4321f" stroke-width="2.4" stroke-linecap="round"/></svg>`,
    shield: `<svg viewBox="0 0 48 48" aria-hidden="true"><path d="M24 4 39 10v12c0 10-6.5 17.5-15 21C15.5 39.5 9 32 9 22V10z" fill="#fff" stroke="currentColor" stroke-width="2.4" stroke-linejoin="round"/><path d="M17 24l5 5 9-11" fill="none" stroke="#46703f" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"/></svg>`,
    stamp: `<svg viewBox="0 0 48 48" aria-hidden="true"><path d="M19 5h10v10l4 3v6H15v-6l4-3z" fill="#fff" stroke="currentColor" stroke-width="2.2" stroke-linejoin="round"/><rect x="11" y="24" width="26" height="6" rx="1.5" fill="currentColor"/><rect x="8" y="35" width="32" height="9" rx="2" fill="none" stroke="#c4321f" stroke-width="2.4" stroke-dasharray="4 3"/></svg>`,
    bell: `<svg viewBox="0 0 48 48" aria-hidden="true"><path d="M14 33V22a10 10 0 0 1 20 0v11l3 4H11z" fill="#fff" stroke="currentColor" stroke-width="2.4" stroke-linejoin="round"/><path d="M20 40a4 4 0 0 0 8 0" fill="none" stroke="currentColor" stroke-width="2.4"/><circle cx="35" cy="12" r="6" fill="#c4321f"/></svg>`,
    number: `<svg viewBox="0 0 48 48" aria-hidden="true"><rect x="6" y="11" width="36" height="26" rx="4" fill="#fff" stroke="currentColor" stroke-width="2.4"/><text x="24" y="30" text-anchor="middle" font-size="14" font-weight="700" font-family="Bahnschrift, Segoe UI, sans-serif" fill="currentColor">47</text><path d="M36 6l6 6" stroke="#46703f" stroke-width="2.4" stroke-linecap="round"/></svg>`,
    map: `<svg viewBox="0 0 48 48" aria-hidden="true"><rect x="5" y="8" width="38" height="32" rx="4" fill="#12202b" stroke="currentColor" stroke-width="2"/><path d="M13 30l9-10 8 6 7-10" fill="none" stroke="#ff6b4a" stroke-width="2.4" stroke-linecap="round" stroke-dasharray="3 3"/><circle cx="13" cy="30" r="3.5" fill="#ff6b4a"/><circle cx="22" cy="20" r="3.5" fill="#7fd1a8"/><circle cx="30" cy="26" r="3.5" fill="#7fd1a8"/><circle cx="37" cy="16" r="3.5" fill="#7fd1a8"/></svg>`,
    cards: `<svg viewBox="0 0 48 48" aria-hidden="true"><rect x="7" y="13" width="18" height="26" rx="3" transform="rotate(-12 16 26)" fill="#fffdf6" stroke="currentColor" stroke-width="2"/><rect x="16" y="10" width="18" height="26" rx="3" fill="#fffdf6" stroke="currentColor" stroke-width="2"/><rect x="25" y="13" width="18" height="26" rx="3" transform="rotate(12 34 26)" fill="#fffdf6" stroke="#b08a3e" stroke-width="2.2"/></svg>`,
    warn: `<svg viewBox="0 0 48 48" aria-hidden="true"><path d="M24 6 44 40H4z" fill="#fff" stroke="currentColor" stroke-width="2.4" stroke-linejoin="round"/><path d="M24 18v11" stroke="#c4321f" stroke-width="3.2" stroke-linecap="round"/><circle cx="24" cy="34" r="2.2" fill="#c4321f"/></svg>`,
    door: `<svg viewBox="0 0 48 48" aria-hidden="true"><path d="M12 42V7h20v35" fill="#fff" stroke="currentColor" stroke-width="2.4" stroke-linejoin="round"/><path d="M8 42h32" stroke="currentColor" stroke-width="2.4" stroke-linecap="round"/><circle cx="27" cy="25" r="1.8" fill="currentColor"/><rect x="35" y="18" width="8" height="12" rx="1.5" fill="#1f2a2e"/><circle cx="39" cy="22" r="1.4" fill="#7fd1a8"/></svg>`,
  };

  /* ------------------------------------------------------------------ sound: made on the fly with Web Audio, no files.
     The toggle in the page header remembers the choice in this browser. Nothing plays before the first click. */
  const SFX = (() => {
    let ctx = null, master = null, on = true;
    try { on = localStorage.getItem("lia.sound") !== "0"; } catch { /* private mode */ }
    let noiseBuf = null;
    function ensure() {
      if (!on) return null;
      if (!ctx) {
        const AC = window.AudioContext || window.webkitAudioContext;
        if (!AC) return null;
        ctx = new AC();
        master = ctx.createGain(); master.gain.value = 0.3; master.connect(ctx.destination);
        noiseBuf = ctx.createBuffer(1, ctx.sampleRate, ctx.sampleRate);
        const ch = noiseBuf.getChannelData(0);
        let seed = 7; for (let i = 0; i < ch.length; i++) { seed = (seed * 16807) % 2147483647; ch[i] = (seed / 2147483647) * 2 - 1; }
      }
      if (ctx.state === "suspended") ctx.resume();
      return ctx;
    }
    function tone(freq, dur, o) {
      o = Object.assign({ type: "sine", vol: 0.3, attack: 0.006, delay: 0 }, o || {});
      const t = ctx.currentTime + o.delay, osc = ctx.createOscillator(), g = ctx.createGain();
      osc.type = o.type; osc.frequency.setValueAtTime(freq, t);
      if (o.slideTo) osc.frequency.exponentialRampToValueAtTime(o.slideTo, t + dur);
      g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(o.vol, t + o.attack); g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
      osc.connect(g); g.connect(master); osc.start(t); osc.stop(t + dur + 0.05);
    }
    function noise(dur, o) {
      o = Object.assign({ vol: 0.3, type: "lowpass", freq: 1200, q: 0.7, delay: 0 }, o || {});
      const t = ctx.currentTime + o.delay, src = ctx.createBufferSource(), f = ctx.createBiquadFilter(), g = ctx.createGain();
      src.buffer = noiseBuf; f.type = o.type; f.frequency.setValueAtTime(o.freq, t); f.Q.value = o.q;
      if (o.sweepTo) f.frequency.exponentialRampToValueAtTime(o.sweepTo, t + dur);
      g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(o.vol, t + 0.01); g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
      src.connect(f); f.connect(g); g.connect(master); src.start(t); src.stop(t + dur + 0.05);
    }
    const BANK = {
      tap: () => tone(880, 0.06, { type: "triangle", vol: 0.12 }),
      stamp: () => { noise(0.14, { vol: 0.55, freq: 900 }); tone(120, 0.2, { vol: 0.55, slideTo: 55 }); },
      paper: () => noise(0.28, { vol: 0.16, type: "bandpass", freq: 2600, q: 0.8, sweepTo: 1400 }),
      ding: () => { tone(1318, 0.4, { vol: 0.2 }); tone(1976, 0.35, { vol: 0.1, delay: 0.07 }); },
      ring: () => { for (let i = 0; i < 6; i++) { tone(880, 0.07, { type: "square", vol: 0.05, delay: i * 0.09 }); tone(1175, 0.07, { type: "square", vol: 0.04, delay: i * 0.09 + 0.045 }); } },
      buzz: () => { for (let i = 0; i < 3; i++) tone(62, 0.13, { type: "sawtooth", vol: 0.22, delay: i * 0.17 }); },
      good: () => [523, 659, 784].forEach((f, i) => tone(f, 0.2, { type: "triangle", vol: 0.2, delay: i * 0.07 })),
      bad: () => { tone(233, 0.28, { type: "sawtooth", vol: 0.14, slideTo: 140 }); tone(175, 0.3, { type: "square", vol: 0.06, delay: 0.05, slideTo: 110 }); },
      alarm: () => { for (let i = 0; i < 4; i++) tone(i % 2 ? 660 : 880, 0.15, { type: "square", vol: 0.07, delay: i * 0.17 }); },
      pin: () => { tone(1700, 0.05, { type: "triangle", vol: 0.1 }); noise(0.05, { vol: 0.12, type: "highpass", freq: 3500 }); },
      pluck: () => { tone(196, 0.6, { type: "triangle", vol: 0.18, slideTo: 192 }); tone(392, 0.3, { type: "sine", vol: 0.06 }); },
      slam: () => { noise(0.3, { vol: 0.55, freq: 500 }); tone(82, 0.42, { vol: 0.65, slideTo: 41 }); },
      tick: () => tone(1250, 0.025, { type: "square", vol: 0.05 }),
      whoosh: () => noise(0.5, { vol: 0.2, type: "bandpass", freq: 500, q: 0.6, sweepTo: 3200 }),
      glitch: () => { for (let i = 0; i < 6; i++) tone(240 + ((i * 397) % 900), 0.04, { type: "square", vol: 0.05, delay: i * 0.035 }); },
      shield: () => { noise(0.35, { vol: 0.35, type: "bandpass", freq: 1400, q: 1.2 }); tone(320, 0.32, { type: "sawtooth", vol: 0.16, slideTo: 70 }); },
      zap: () => { tone(1900, 0.16, { type: "sawtooth", vol: 0.1, slideTo: 220 }); noise(0.12, { vol: 0.18, type: "highpass", freq: 2200 }); },
      win: () => [523, 659, 784, 1047].forEach((f, i) => tone(f, 0.34, { type: "triangle", vol: 0.18, delay: i * 0.1 })),
      open: () => { tone(392, 0.12, { type: "triangle", vol: 0.12 }); tone(523, 0.16, { type: "triangle", vol: 0.12, delay: 0.08 }); },
      swipe: () => noise(0.22, { vol: 0.16, type: "bandpass", freq: 900, q: 0.7, sweepTo: 2800 }),
      clunk: () => { noise(0.08, { vol: 0.3, freq: 700 }); tone(140, 0.12, { vol: 0.3, slideTo: 90 }); },
      static: () => noise(0.24, { vol: 0.12, type: "bandpass", freq: 1900, q: 0.5 }),
      dtmf: () => { tone(770, 0.09, { vol: 0.07 }); tone(1336, 0.09, { vol: 0.07 }); },
      creak: () => { tone(180, 0.9, { type: "sawtooth", vol: 0.05, slideTo: 120 }); noise(0.9, { vol: 0.08, type: "bandpass", freq: 600, q: 4, sweepTo: 300 }); },
    };
    return {
      play(name) { try { if (!ensure() || !BANK[name]) return; BANK[name](); } catch { /* audio is a bonus */ } },
      get on() { return on; },
      set(v) { on = !!v; try { localStorage.setItem("lia.sound", on ? "1" : "0"); } catch { /* private mode */ } if (on) { ensure(); BANK.tap(); } },
      unlock() { ensure(); },
    };
  })();

  function soundButton() {   // one button in the page header, next to the score
    const b = $("#gSound");
    if (!b || b.dataset.bound) return;
    b.dataset.bound = "1";
    const draw = () => {
      b.setAttribute("aria-pressed", String(SFX.on));
      b.innerHTML = SFX.on ? `<svg viewBox="0 0 20 20" aria-hidden="true"><path d="M3 8h3l4-3.5v11L6 12H3z" fill="currentColor"/><path d="M13 7a4 4 0 0 1 0 6M15.5 4.5a7.5 7.5 0 0 1 0 11" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round"/></svg><span>${bi("Sound", "音效")}</span>`
        : `<svg viewBox="0 0 20 20" aria-hidden="true"><path d="M3 8h3l4-3.5v11L6 12H3z" fill="currentColor"/><path d="M13 7.5l5 5M18 7.5l-5 5" stroke="currentColor" stroke-width="1.6" stroke-linecap="round"/></svg><span>${bi("Muted", "靜音")}</span>`;
    };
    b.addEventListener("click", () => { SFX.set(!SFX.on); draw(); });
    draw();
  }
  document.addEventListener("DOMContentLoaded", soundButton);
  document.addEventListener("pointerdown", () => SFX.unlock(), { once: true });

  /* ------------------------------------------------------------------ people: flat busts in the resort's colours */
  function mentor(cls) {   // Mei-Ling Chen, IT Help Desk (same drawing as chapter 1)
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

  function analyst(cls) {   // Jun-Hao Lin, SOC analyst: hoodie, lanyard, headset (same drawing as chapter 1)
    return `<svg class="rs-portrait ${cls || "cb-portrait"}" viewBox="0 0 96 96" aria-hidden="true">
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

  /* Anyone else at the resort. o: bg, skin, hair (colour), style (short|bob|long|bun|side|cap), coat, shirt, vest,
     tie (bow|tie), glasses, lanyard, apron, mood (smile|flat|worried). Kept in the same flat style as Mei-Ling. */
  function face(o, cls) {
    o = Object.assign({ bg: "#c9d6d4", skin: "#efcfb2", hair: "#2b2421", style: "short", coat: "#3b4a54", shirt: "#ffffff", mood: "smile" }, o || {});
    const skinD = o.skin === "#efcfb2" ? "#e2b896" : o.skin === "#d9a57e" ? "#c98f66" : "#d6a888";
    const back = {
      bob: `<path d="M26 40c0-15 10-24 22-24s22 9 22 24c0 6-2 11-4 15H30c-2-4-4-9-4-15z" fill="${o.hair}"/>`,
      long: `<path d="M25 44c0-17 10-28 23-28s23 11 23 28v24c-4 3-10 4-15 3V52H40v19c-5 1-11 0-15-3z" fill="${o.hair}"/>`,
      bun: `<circle cx="48" cy="18" r="7.5" fill="${o.hair}"/><path d="M29 40c0-14 9-22 19-22s19 8 19 22c0 4-1 8-3 11H32c-2-3-3-7-3-11z" fill="${o.hair}"/>`,
    }[o.style] || "";
    const front = {
      short: `<path d="M32 40c-1-13 7-21 17-21 9 0 16 6 16 18-4-5-9-8-16-8-8 0-13 4-17 11z" fill="${o.hair}"/>`,
      side: `<path d="M31 41c-1-14 8-22 18-22 10 0 17 7 16 17-7-6-15-9-23-7-4 1-8 5-11 12z" fill="${o.hair}"/><path d="M42 21c-3 4-4 8-4 12" stroke="${o.skin}" stroke-width="1.4" fill="none" opacity=".5"/>`,
      bob: `<path d="M33 36c4-9 10-12 16-12 7 0 12 4 15 12-6-3-11-7-15-7-5 0-10 4-16 7z" fill="${o.hair}"/>`,
      long: `<path d="M32 38c3-10 10-14 17-14s13 4 15 13c-5-4-10-6-15-6-6 0-12 3-17 7z" fill="${o.hair}"/>`,
      bun: `<path d="M32 37c3-9 9-13 16-13s13 4 16 13c-5-4-10-6-16-6s-11 2-16 6z" fill="${o.hair}"/>`,
      cap: `<path d="M30 36c1-11 8-17 18-17s17 6 18 17z" fill="${o.cap || "#1f3a5f"}"/><path d="M29 35h38c3 0 5 1 6 3H27c-1-2 0-3 2-3z" fill="${o.cap || "#1f3a5f"}"/><circle cx="48" cy="27" r="3.4" fill="#d8bd77"/>`,
    }[o.style] || "";
    const mouth = o.mood === "worried" ? `<path d="M44 53.5c2.4-1.6 5.6-1.6 8 0" fill="none" stroke="#9b4c36" stroke-width="1.6" stroke-linecap="round"/>`
      : o.mood === "flat" ? `<path d="M44.5 52.5h7" stroke="#9b4c36" stroke-width="1.6" stroke-linecap="round"/>`
      : o.mood === "happy" ? `<path d="M42.5 50.5c3 4 8 4 11 0z" fill="#8f3a2a"/><path d="M44 51.5h8" stroke="#fff" stroke-width="1.2"/>`
      : o.mood === "annoyed" ? `<path d="M43.5 54c2.6-2.2 6.4-2.2 9 0" fill="none" stroke="#8f3a2a" stroke-width="1.8" stroke-linecap="round"/>`
      : o.mood === "shocked" ? `<ellipse cx="48" cy="53" rx="2.6" ry="3.2" fill="#8f3a2a"/>`
      : `<path d="M44 52c2.5 2 5.5 2 8 0" fill="none" stroke="#a5523c" stroke-width="1.6" stroke-linecap="round"/>`;
    const brows = o.mood === "worried" ? `<path d="M38 38.5c2 .4 4 0 6-1.4M52 37.1c2 1.4 4 1.8 6 1.4" fill="none" stroke="#1d1a19" stroke-width="1.5" stroke-linecap="round"/>`
      : o.mood === "annoyed" ? `<path d="M38 37c2.2.4 4.2 1.4 6 2.8M58 37c-2.2.4-4.2 1.4-6 2.8" fill="none" stroke="#1d1a19" stroke-width="1.7" stroke-linecap="round"/>`
      : o.mood === "shocked" ? `<path d="M38 36.5c2-1.6 4-1.6 6 0M52 36.5c2-1.6 4-1.6 6 0" fill="none" stroke="#1d1a19" stroke-width="1.5" stroke-linecap="round"/>`
      : o.mood === "happy" ? `<path d="M38.5 38.5c1.8-1.2 3.8-1.2 5.5 0M52 38.5c1.8-1.2 3.8-1.2 5.5 0" fill="none" stroke="#1d1a19" stroke-width="1.4" stroke-linecap="round"/>` : "";
    const cheeks = o.mood === "happy" ? `<circle cx="38.5" cy="48.5" r="2.6" fill="#f2a7a0" opacity=".55"/><circle cx="57.5" cy="48.5" r="2.6" fill="#f2a7a0" opacity=".55"/>` : "";
    const glasses = o.glasses ? `<circle cx="42" cy="43" r="4.6" fill="none" stroke="#1f2a2e" stroke-width="1.6"/><circle cx="54" cy="43" r="4.6" fill="none" stroke="#1f2a2e" stroke-width="1.6"/><path d="M46.6 43h2.8" stroke="#1f2a2e" stroke-width="1.6"/>` : "";
    const vest = o.vest ? `<path d="M30 74c4-4 10-6 18-6s14 2 18 6l2 22H28z" fill="${o.vest}"/><path d="M41 69l7 17 7-17" fill="${o.shirt}"/>` : "";
    const tie = o.tie === "bow" ? `<path d="M42 71l6 3 6-3v6l-6-3-6 3z" fill="${o.tieColor || "#7a2418"}"/>` : o.tie ? `<path d="M46.5 71h3l1.5 3-1.5 12h-3L45 74z" fill="${o.tieColor || "#7a2418"}"/>` : "";
    const apron = o.apron ? `<path d="M36 78h24v18H36z" fill="${o.apron}"/><path d="M36 78l-4-6M60 78l4-6" stroke="${o.apron}" stroke-width="2"/>` : "";
    const lanyard = o.lanyard ? `<path d="M43 70l-2 14M53 70l2 14" stroke="${o.lanyard}" stroke-width="2"/><rect x="41.5" y="83" width="13" height="10" rx="1.5" fill="#fff"/><rect x="43.5" y="85" width="5" height="5" fill="#9cc2c8"/>` : "";
    const patch = o.patch ? `<path d="M62 78l6 1v6c0 3-3 5-6 6-3-1-6-3-6-6v-6z" fill="${o.patch}"/>` : "";
    return `<svg class="rs-portrait ${cls || ""}" viewBox="0 0 96 96" aria-hidden="true">
      ${o.bare ? "" : `<circle cx="48" cy="48" r="48" fill="${o.bg}"/>`}${back}
      <path d="M14 96c2-18 16-28 34-28s32 10 34 28z" fill="${o.coat}"/>
      <path d="M40 67l8 9 8-9" fill="${o.shirt}"/>${vest}${apron}${tie}${lanyard}${patch}
      <rect x="42" y="54" width="12" height="13" rx="5" fill="${skinD}"/>
      <ellipse cx="48" cy="42" rx="15" ry="17" fill="${o.skin}"/>${front}${brows}
      ${o.mood === "shocked" ? `<circle cx="42" cy="43.5" r="2" fill="#fff"/><circle cx="54" cy="43.5" r="2" fill="#fff"/><circle cx="42" cy="43.5" r="1.2" fill="#1f2a2e"/><circle cx="54" cy="43.5" r="1.2" fill="#1f2a2e"/>`
        : o.mood === "happy" ? `<path d="M40 44c1.2-1.3 2.8-1.3 4 0M52 44c1.2-1.3 2.8-1.3 4 0" fill="none" stroke="#1f2a2e" stroke-width="1.5" stroke-linecap="round"/>`
        : `<circle cx="42" cy="43.5" r="1.5" fill="#1f2a2e"/><circle cx="54" cy="43.5" r="1.5" fill="#1f2a2e"/>`}${cheeks}${glasses}${mouth}</svg>`;
  }

  function personHTML(p, text, o) {   // p: {svg, name, name_zh, role_en, role_zh}; o.big, o.id
    o = o || {};
    return `<div class="rs-mentor${o.big ? " is-big" : ""}">${p.svg}
      <div class="rs-mentor-text"><p class="rx-mentor-name">${esc(p.name)} · ${esc(p.role_en)} <span lang="zh-Hant">${esc(p.role_zh)} ${esc(p.name_zh)}</span></p>
      <p class="rx-say rs-say"${o.id ? ` id="${o.id}"` : ""} aria-live="polite">${text}</p></div></div>`;
  }

  function say(node, html, mood) {
    if (!node || !html) return;
    node.innerHTML = html;
    node.classList.remove("is-bump", "is-good", "is-no"); void node.offsetWidth;
    node.classList.add("is-bump"); if (mood) node.classList.add(mood);
  }

  /* ------------------------------------------------------------------ the stage */
  function stage(main) {
    main.classList.add("is-stage");
    main.innerHTML = `<div class="rs" id="rs"><div class="rs-bg" id="rsBg"></div><div class="rs-dusk" id="rsDusk"></div>
      <div class="rs-body" id="rsBody"></div><div class="rs-cut" id="rsCut" hidden></div><div class="rs-toast" id="rsToast" hidden></div></div>`;
    const $rs = $("#rs");
    G.watchFit();
    const st = {
      $rs, body: $("#rsBody"),
      scene(name, dusk) { $("#rsBg").style.backgroundImage = `url(${IMG}${name}.jpg)`; st.dusk(dusk || 0); },
      dusk(v) { $("#rsDusk").style.opacity = String(v || 0); },
      mood(cls) { $rs.dataset.mood = cls || ""; },
      banner(w) {
        const b = el("div", "rs-wave", bi(w.en, w.zh));
        $rs.appendChild(b);
        SFX.play("ding");
        setTimeout(() => b.remove(), reduceMotion ? 2500 : 3800);
      },
      hit() {
        SFX.play("shield");
        if (reduceMotion) return;
        $rs.classList.remove("is-hit"); void $rs.offsetWidth; $rs.classList.add("is-hit");
        setTimeout(() => $rs.classList.remove("is-hit"), 700);
      },
      toast(img, html, ms) {
        const t = $("#rsToast");
        t.hidden = false;
        t.innerHTML = `${img ? `<img src="${IMG}${img}.jpg" alt="">` : ""}<p>${html}</p>`;
        t.classList.toggle("is-noimg", !img);
        t.classList.remove("is-in"); void t.offsetWidth; t.classList.add("is-in");
        clearTimeout(t._h);
        t._h = setTimeout(() => { t.hidden = true; }, ms || 3600);
      },
      float(target, html, cls) {   // a label floating up from an element
        if (!target) return;
        const r = target.getBoundingClientRect(), R = $rs.getBoundingClientRect();
        const f = el("div", "rx-float " + (cls || ""), html);
        f.style.left = `${r.left + r.width / 2 - R.left}px`; f.style.top = `${r.top + 10 - R.top}px`;
        $rs.appendChild(f);
        setTimeout(() => f.remove(), 1300);
      },
      confetti() {
        SFX.play("win");
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
      },
      /* What the crew did with something you let through: one of the tour's rooms, the beats as subtitles, one close-up.
         11/21 night: two slips close together used to start a second cut on top of the first; the first one's button
         went away with it, its done() never ran and the shift froze. Cuts now wait their turn, and the desk behind a cut
         is inert so the keyboard cannot reach it either. */
      cut(o) {
        st.cutQ = (st.cutQ || Promise.resolve()).then(() => st.cutOne(o));
        return st.cutQ;
      },
      cutOne(o) {
        return new Promise((done) => {
          const cut = $("#rsCut");
          st.body.inert = true;
          const beats = (o.beats || []).map((k) => `<li><time>${esc(k.time)}${k.time_zh ? ` <span lang="zh-Hant">${esc(k.time_zh)}</span>` : ""}</time><p>${bi(k.en, k.zh)}</p></li>`).join("");
          const left = o.shields;
          cut.hidden = false;
          cut.innerHTML = `<div class="rs-cut-bg" style="background-image:url(${IMG}${esc(o.scene || "rush_soc")}.jpg)"></div><div class="rs-cut-shade"></div>
            <div class="rs-cut-inset">${o.inset || ""}</div>
            <div class="rs-cut-text"><p class="rs-cut-kicker">${bi("What happened next", "接下來發生了什麼")}</p>
              <ol class="rx-beats rs-beats">${beats}</ol>
              <p class="rx-hit rs-cut-hit"><span>${bi(o.hit_en || "", o.hit_zh || "")}</span></p>
              ${typeof left === "number" ? `<p class="rs-cut-shield">${ICON.shield(false)}${bi(left > 0 ? `Shield lost. ${left} left.` : "That was your last shield.", left > 0 ? `少了一面盾牌，還剩 ${left} 面。` : "最後一面盾牌也沒了。")}</p>` : ""}
              <button type="button" class="btn rs-cut-go">${o.go || bi("Back to work", "回去繼續")}</button></div>`;
          cut.classList.remove("is-in"); void cut.offsetWidth; cut.classList.add("is-in");
          SFX.play("bad");
          const go = $(".rs-cut-go", cut);
          go.focus({ preventScroll: true });
          go.addEventListener("click", () => { cut.hidden = true; cut.innerHTML = ""; st.body.inert = false; done(); });
        });
      },
      overlay(cls, html, label) {   // fixed dialog over everything; returns {box, close}
        const box = el("div", cls);
        box.setAttribute("role", "dialog"); if (label) box.setAttribute("aria-label", label);
        box.innerHTML = html;
        st.body.appendChild(box);
        const close = () => { box.remove(); document.removeEventListener("keydown", onKey); };
        const onKey = (ev) => { if (ev.key === "Escape") close(); };
        document.addEventListener("keydown", onKey);
        box.addEventListener("click", (ev) => { if (ev.target === box) close(); });
        for (const x of $$("[data-close]", box)) x.addEventListener("click", close);
        return { box, close };
      },
    };
    return st;
  }

  /* ------------------------------------------------------------------ the briefing card */
  function brief(st, o) {
    const tiles = (o.rules || []).every((r) => r.icon);
    const rules = (o.rules || []).map((r) => (tiles ? `<li><span class="cb-rule-ic">${RULE[r.icon] || ""}</span><p>${bi(r.en, r.zh)}</p></li>` : `<li>${bi(r.en, r.zh)}</li>`)).join("");
    st.body.innerHTML = `<section class="rs-brief has-rules">
      <div class="rs-brief-clock" aria-hidden="true"><span>${esc(o.top_en || "Awards Night")} <i lang="zh-Hant">${esc(o.top_zh || "頒獎晚會")}</i></span>
        <b>${esc(o.start)}</b><span>${esc(o.until_en || "")} <i lang="zh-Hant">${esc(o.until_zh || "")}</i></span>
        <span class="rs-brief-file">Case file ${o.file} <i lang="zh-Hant">事件簿第 ${o.file} 章</i></span></div>
      <div class="rs-brief-main">${personHTML(o.person, bi(o.intro_en || "", o.intro_zh || ""), { big: true })}
        ${o.extra || ""}
        ${o.after_en ? `<p class="rs-brief-after">${bi(o.after_en, o.after_zh)}</p>` : ""}
        <button type="button" class="btn rs-start">${o.button || bi("Start", "開始")}</button></div>
      <div class="rs-brief-rules"><p class="rs-brief-rules-h">${bi("How to play", "怎麼玩")}</p><ol class="${tiles ? "cb-rules" : "rx-rules"}">${rules}</ol></div></section>`;
    $(".rs-start", st.body).addEventListener("click", () => { SFX.play("open"); o.onStart(); });
  }

  /* The title card: the chapter's scene pushing in slowly between black bars, the case file, the title, when and where.
     Shown once when the page opens; the click that dismisses it also lets the sound start. */
  function title(st, o) {
    st.scene(o.scene, 0.15);
    st.$rs.classList.add("is-title");
    st.body.innerHTML = `<section class="cb-title" role="dialog" aria-label="${esc(o.title_en)}">
      <div class="cb-title-in">
        <p class="cb-title-file">${bi(`Awards Night casebook · case file ${o.file} of 4`, `頒獎晚會事件簿・第 ${o.file} 章`)}</p>
        <h2 class="cb-title-h">${esc(o.title_en)}<span lang="zh-Hant">${esc(o.title_zh)}</span></h2>
        <p class="cb-title-when"><b>${esc(o.time)}</b><span>${bi(o.place_en || "", o.place_zh || "")}</span></p>
        ${o.hook_en ? `<p class="cb-title-hook">${bi(o.hook_en, o.hook_zh)}</p>` : ""}
        <button type="button" class="btn cb-title-go">${bi("Open the case file", "打開這一章")}</button></div></section>`;
    const go = () => { SFX.play("whoosh"); st.$rs.classList.remove("is-title"); o.onGo(); };
    $(".cb-title-go", st.body).addEventListener("click", go);
    $(".cb-title-go", st.body).focus({ preventScroll: true });
  }

  /* Time passes: the clock races from one time to the next over the scene, with where we are now. */
  function timeskip(st, o) {
    return new Promise((done) => {
      const from = mins(o.from), to0 = mins(o.to), to = to0 < from ? to0 + 1440 : to0;
      const box = el("div", "cb-skip", `<div class="cb-skip-in"><p class="cb-skip-day">${bi(o.day_en || "", o.day_zh || "")}</p><p class="cb-skip-clock" id="cbSkipT">${esc(o.from)}</p>
        <p class="cb-skip-place">${bi(o.place_en || "", o.place_zh || "")}</p></div>`);
      st.$rs.appendChild(box);
      SFX.play("whoosh");
      const steps = reduceMotion ? 1 : 16;
      let k = 0;
      const t = setInterval(() => {
        k += 1;
        const m = Math.round(from + ((to - from) * k) / steps);
        const c = $("#cbSkipT", box); if (c) c.textContent = hhmm(m);
        if (k % 2 === 0) SFX.play("tick");
        if (k >= steps) {
          clearInterval(t);
          setTimeout(() => { box.classList.add("is-out"); setTimeout(() => { box.remove(); done(); }, reduceMotion ? 0 : 420); }, reduceMotion ? 200 : 650);
        }
      }, 70);
    });
  }

  /* Three right in a row (or more): a big banner in the middle of the stage. */
  function streak(st, n) {
    if (n < 3) return;
    const b = el("div", "cb-streak", `<b>×${n}</b><span>${bi("in a row", "連續答對")}</span>`);
    st.$rs.appendChild(b);
    SFX.play("win");
    setTimeout(() => b.remove(), reduceMotion ? 900 : 1700);
  }

  /* ------------------------------------------------------------------ the score bar in the page header */
  function hud(o) {
    const meter = $("#meter");
    if (!meter.dataset.bound) {
      meter.dataset.bound = "1";
      meter.addEventListener("click", (ev) => { if (ev.target.closest("[data-pause]") && G.onPause) G.onPause(); });
    }
    G.meter(`<div class="rx-hud">
      ${o.pause ? `<button type="button" class="rx-pause" data-pause aria-pressed="false">${ICON.pause}<span>${bi("Pause", "暫停")}</span></button>` : ""}
      ${o.clock ? `<div class="rx-hud-clock"><b id="hudClock">${esc(o.clock)}</b><span>${o.clockLabel || ""}</span></div>` : ""}
      <div class="rx-hud-pts"><b id="hudPts">${(o.points || 0).toLocaleString("en-US")}</b><span>${bi("points", "分")}</span><i class="rx-streak" id="hudStreak" hidden></i></div>
      ${o.extra || ""}
      ${o.shields ? `<div class="rx-hud-shields"><div id="hudShields" role="img"></div><span>${bi("shields", "盾牌")}</span></div>` : ""}</div>`);
    const h = {
      points(v, streak, pop) {
        const p = $("#hudPts"); if (!p) return;
        p.textContent = Math.round(v).toLocaleString("en-US");
        const s = $("#hudStreak");
        if (s) { s.hidden = !(streak >= 2); s.textContent = `×${streak}`; }
        if (pop) {
          const n = el("span", "rx-pop" + (pop < 0 ? " is-neg" : ""), (pop > 0 ? "+" : "") + pop);
          p.parentElement.appendChild(n);
          setTimeout(() => n.remove(), 1200);
        }
      },
      shields(left, total, lost) {
        const box = $("#hudShields"); if (!box) return;
        box.setAttribute("aria-label", `${left} of ${total} shields left`);
        box.innerHTML = Array.from({ length: total }, (_, k) => ICON.shield(k < left)).join("");
        if (lost) { const x = box.children[left]; if (x) x.classList.add("is-break"); }
      },
      clock(t) { const c = $("#hudClock"); if (c) c.textContent = t; },
      paused(p) {
        const b = $("[data-pause]", meter);
        if (b) { b.setAttribute("aria-pressed", String(p)); b.innerHTML = p ? `${ICON.play}<span>${bi("Resume", "繼續")}</span>` : `${ICON.pause}<span>${bi("Pause", "暫停")}</span>`; }
      },
    };
    if (o.shields) h.shields(o.shields, o.shieldsTotal || o.shields);
    return h;
  }

  /* ------------------------------------------------------------------ the shift clock: ticks every 100 ms of real time */
  function loop(tick) {
    let timer = null, last = 0;
    return {
      start() { this.stop(); last = performance.now(); timer = setInterval(() => { const t = performance.now(), dt = Math.min(0.5, (t - last) / 1000); last = t; tick(dt); }, 100); },
      stop() { if (timer) { clearInterval(timer); timer = null; } },
    };
  }

  function pauseLayer(st, onResume) {
    const p = el("div", "rs-paused"); p.id = "rsPaused"; p.hidden = true;
    p.innerHTML = `<div><p>${bi("Paused", "暫停中")}</p><button type="button" class="btn">${ICON.play}${bi("Resume", "繼續")}</button></div>`;
    st.body.appendChild(p);
    $("button", p).addEventListener("click", onResume);
    return {
      set(on) { p.hidden = !on; st.$rs.classList.toggle("is-paused", on); if (on) $("button", p).focus({ preventScroll: true }); },
    };
  }

  /* ------------------------------------------------------------------ the end of a shift that went wrong */
  function over(st, o) {
    st.body.innerHTML = `<section class="rs-over">
      <div class="rs-over-pic">${o.pic || ""}</div>
      <div class="rs-over-text"><p class="rs-over-time">${esc(o.time)}</p>
        <h2>${bi(o.title_en, o.title_zh)}</h2>
        ${o.items ? `<ul class="rx-loss-list">${o.items}</ul>` : ""}
        <p>${bi(o.text_en, o.text_zh)}</p>
        <div class="g-end-actions"><button type="button" class="btn rs-again">${bi("Try the shift again", "重新值班")}</button>
          <a class="btn btn-ghost" href="${G.backHref}">${bi("Back to the tour", "回到導覽")}</a></div></div></section>`;
    $(".rs-again", st.body).addEventListener("click", o.again);
    $(".rs-over .btn-ghost", st.body).addEventListener("click", G.back);
    window.scrollTo({ top: 0, behavior: reduceMotion ? "auto" : "smooth" });
  }

  /* ------------------------------------------------------------------ the case board */
  /* o: scene, dusk, analyst (person), intro_en/zh, cork (html for the cork), right (extra html under the questions) */
  function board(st, o) {
    st.scene(o.scene, o.dusk == null ? 0.12 : o.dusk);
    st.body.innerHTML = `<section class="cb ${o.cls || ""}">
      <div class="cb-main">
        <div class="cb-frame"><div class="cb-cork" id="cbCork">${o.cork}<svg class="cb-strings" id="cbStrings" aria-hidden="true"></svg></div></div>
        <aside class="cb-right">
          <div class="cb-head">${analyst()}<div class="cb-head-text"><p class="rx-mentor-name">${esc(o.analyst.name)} · ${esc(o.analyst.role_en)} <span lang="zh-Hant">${esc(o.analyst.role_zh)} ${esc(o.analyst.name_zh)}</span></p>
            <p class="rx-say cb-say" id="cbSay" aria-live="polite">${bi(o.intro_en || "", o.intro_zh || "")}</p></div></div>
          <div class="cb-qs" id="cbQs" aria-label="Case questions"></div>${o.right || ""}</aside>
      </div></section>`;
    window.scrollTo({ top: 0, behavior: reduceMotion ? "auto" : "smooth" });
    pinIn($("#cbCork"));
  }

  function pinIn(root) {   // everything with a pin drops onto the cork in turn
    if (!root || reduceMotion) return;
    const items = [...new Set($$(".cb-pin", root).map((p) => p.closest(".cb-card") || p.parentElement))];
    items.forEach((x, k) => { x.style.setProperty("--i", k); x.classList.add("cb-drop"); setTimeout(() => x.classList.remove("cb-drop"), 600 + k * 70); });
    items.slice(0, 7).forEach((_, k) => setTimeout(() => SFX.play("pin"), 120 + k * 110));
  }

  const cbSay = (html, mood) => say($("#cbSay"), html, mood);

  /* The question cards: solved ones get a stamp, the open one shows its controls (from the chapter), the rest wait. */
  function questions(QS, B, controls) {
    const box = $("#cbQs");
    box.innerHTML = `<h2 class="cb-qs-title">${bi("Case questions", "推理題")}</h2>` + QS.map((q, i) => {
      if (B.solved[i]) return `<section class="cb-q is-solved"><p class="cb-q-n">${bi(`Question ${i + 1}`, `第 ${i + 1} 題`)}<span class="cb-q-stamp">SOLVED<small>破案</small></span></p>
        <p class="cb-q-text">${bi(q.en, q.zh)}</p></section>`;
      if (i !== B.q) return `<section class="cb-q is-locked"><p class="cb-q-n">${bi(`Question ${i + 1}`, `第 ${i + 1} 題`)}</p><p class="cb-q-lock">${bi("Opens when the one above is solved.", "解開上一題才會打開。")}</p></section>`;
      return `<section class="cb-q is-active" id="cbQ"><p class="cb-q-n">${bi(`Question ${i + 1}`, `第 ${i + 1} 題`)}</p>
        <p class="cb-q-text">${bi(q.en, q.zh)}</p>${q.how_en ? `<p class="cb-q-how">${bi(q.how_en, q.how_zh)}</p>` : ""}${controls(q, i)}</section>`;
    }).join("");
    return box;
  }

  function nope(B) {
    SFX.play("bad");
    B.wrong[B.q] += 1;
    const q = $("#cbQ");
    if (q && !reduceMotion) { q.classList.remove("is-shake"); void q.offsetWidth; q.classList.add("is-shake"); }
  }

  const P = { q: 200, qWrong: 40, qMin: 80 };
  const qPoints = (B, i) => Math.max(P.qMin, P.q - P.qWrong * B.wrong[i]);

  /* Red string from pin to pin, sagging a little, drawn in when it is new. strings: [selectorA, selectorB, fresh] */
  function drawStrings(strings) {
    const svg = $("#cbStrings"), cork = $("#cbCork");
    if (!svg || !cork || !strings) return;
    const R = cork.getBoundingClientRect(), k = G.k();
    svg.setAttribute("viewBox", `0 0 ${R.width} ${R.height}`);
    svg.setAttribute("width", R.width / k); svg.setAttribute("height", R.height / k);
    const at = (sel) => { const n = typeof sel === "string" ? $(sel, cork) : sel; if (!n) return null; const r = n.getBoundingClientRect(); if (!r.width && !r.height) return null; return { x: r.left + r.width / 2 - R.left, y: r.top + r.height / 2 - R.top }; };
    svg.innerHTML = strings.map(([a, b, fresh], k) => {
      const p = at(a), q = at(b);
      if (!p || !q) return "";
      const sag = Math.min(70, Math.hypot(q.x - p.x, q.y - p.y) * 0.12);
      const dd = (o) => `M${(p.x + o).toFixed(1)} ${(p.y + o * 2).toFixed(1)} Q${((p.x + q.x) / 2 + o).toFixed(1)} ${((p.y + q.y) / 2 + sag + o * 2).toFixed(1)} ${(q.x + o).toFixed(1)} ${(q.y + o * 2).toFixed(1)}`;
      return `<path class="cb-str-sh" d="${dd(1)}"/><path class="cb-str${fresh ? " is-fresh" : ""}" data-k="${k}" d="${dd(0)}"/>`;
    }).join("");
    for (const path of $$(".cb-str.is-fresh", svg)) {
      if (reduceMotion) continue;
      const len = path.getTotalLength();
      path.style.strokeDasharray = `${len}`; path.style.strokeDashoffset = `${len}`;
      path.getBoundingClientRect();
      path.style.transition = "stroke-dashoffset 1.1s ease-out"; path.style.strokeDashoffset = "0";
    }
    for (const s of strings) s[2] = false;
  }

  function solvedFx() { SFX.play("slam"); setTimeout(() => SFX.play("pluck"), 260); }

  /* 11/22: a redraw took away the control that had the keyboard (focus fell back to the page): carry on at the control the
     next step needs. Nothing moves if the focus is still on something that is there. */
  function refocus(sel) {
    const a = document.activeElement;
    if (a && a !== document.body && a.isConnected) return;
    const n = $(sel);
    if (n) n.focus({ preventScroll: true });
  }

  function addClose(onClose) {
    const last = $$(".cb-q.is-solved").pop();
    if (!last || $(".cb-close", last)) return;
    last.insertAdjacentHTML("beforeend", `<button type="button" class="btn cb-go cb-close">${bi("Close the case", "結案")}</button>`);
    $(".cb-close", last).addEventListener("click", onClose);
  }

  /* ------------------------------------------------------------------ case closed: what follows, the real cases, results */
  function caseHTML(c, why) {
    return `<article class="cb-case"><p class="cb-case-year">${esc(c.year || "")}</p>
      <h3>${bi(c.name_en, c.name_zh)}</h3><p class="cb-case-d">${bi(c.desc_en || "", c.desc_zh || "")}</p>
      ${why ? `<p class="cb-case-why">${bi(why.en, why.zh)}</p>` : ""}
      ${c.lesson_en ? `<p class="cb-case-lesson"><b>${bi("Lesson", "教訓")}</b> ${bi(c.lesson_en, c.lesson_zh)}</p>` : ""}</article>`;
  }

  function closed(st, o) {   // o: wrap_en/zh, body (html), cases, why, onResults
    const why = o.why || {};
    const { box } = st.overlay("cb-closed", `<div class="cb-closed-card"><div class="cb-closed-l"><p class="cb-closed-stamp">CASE CLOSED<small>${esc(o.stamp_zh || "結案")}</small></p>
      <p class="cb-closed-wrap">${bi(o.wrap_en || "", o.wrap_zh || "")}</p>${o.body || ""}</div>
      <div class="cb-closed-r">${(o.cases || []).length ? `<h3 class="cb-cases-title">${bi("The same moves in real cases", "真實案例裡的同一招")}<small>${bi("From the knowledge graph", "出自知識圖")}</small></h3>
      <div class="cb-cases">${o.cases.map((c) => caseHTML(c, why[c.key])).join("")}</div>` : ""}
      <button type="button" class="btn cb-results">${bi("See my results", "看結果")}</button></div></div>`, "Case closed");
    SFX.play("slam");
    if (!reduceMotion) { st.$rs.classList.remove("is-hit"); void st.$rs.offsetWidth; st.$rs.classList.add("is-slammed"); setTimeout(() => st.$rs.classList.remove("is-slammed"), 600); }
    $(".cb-results", box).addEventListener("click", () => { box.remove(); o.onResults(); });
    $(".cb-results", box).focus({ preventScroll: true });
  }

  function medal(key) {
    const c = { gold: ["#d8bd77", "#b08a3e", "#7f6128"], silver: ["#dfe5e7", "#a9b4b8", "#6f7f83"], bronze: ["#e3b48d", "#b0703e", "#7a4520"] }[key] || ["#dfe5e7", "#a9b4b8", "#6f7f83"];
    return `<svg class="rx-medal" viewBox="0 0 120 150" role="img" aria-label="${esc(key)} medal">
      <path d="M38 4h18l12 46H50z" fill="#0e4a55"/><path d="M64 4h18L70 50H52z" fill="#176473"/>
      <circle cx="60" cy="96" r="44" fill="${c[1]}"/><circle cx="60" cy="96" r="36" fill="${c[0]}" stroke="${c[2]}" stroke-width="2"/>
      <path d="M60 72l7 14 15 2-11 10 3 15-14-7-14 7 3-15-11-10 15-2z" fill="${c[2]}" opacity=".85"/></svg>`;
  }

  const NEXT = { phish: ["Inbox Rush", "收件匣大作戰"], access: ["Who May Use What?", "誰能用什麼"], mfa: ["The MFA Door", "多因素驗證門"], ir: ["Incident Response", "事件應變"] };

  /* o: file, ranks [{key,min,en,zh,line_en,line_zh}], score, total, stats [{v, en, zh, hit}], body (html), next {key, en, zh}, scene, again */
  function finale(st, o) {
    const ranks = (o.ranks || []).slice().sort((x, y) => y.min - x.min);
    const rank = ranks.find((r) => o.score >= r.min) || { key: "bronze", en: "Trainee", zh: "實習生" };
    const saved = G.save(o.score, o.total);
    const nx = o.next && NEXT[o.next.key];
    const box = el("div", "rs-finale");
    box.appendChild(G.done(`<div class="rx-report">
      <div class="rx-medal-wrap">${medal(rank.key)}</div>
      <div><p class="rs-kicker">${bi(`Awards Night · case file ${o.file}`, `頒獎晚會事件簿・第 ${o.file} 章`)}</p><p class="rx-rank">${bi(rank.en, rank.zh)}</p><p class="g-end-lead">${bi(rank.line_en || "", rank.line_zh || "")}</p></div>
      <div class="rx-score"><b>${o.score}</b><span>/ ${o.total}</span><small>${bi("case score", "本章分數")}</small></div></div>
      <div class="rx-stats" style="grid-template-columns:repeat(${Math.min(6, o.stats.length)},minmax(0,1fr))">${o.stats.map((s) => `<div class="${s.hit ? "is-hit" : ""}"><b>${s.v}</b><span>${bi(s.en, s.zh)}</span></div>`).join("")}</div>
      ${o.body || ""}
      ${nx ? `<a class="rs-next-case" href="/lakeside/games/${esc(o.next.key)}"><span class="rs-kicker">${bi("Next case file", "下一章")}</span>
        <b>${bi(nx[0], nx[1])}</b><span>${bi(o.next.en || "", o.next.zh || "")}</span></a>` : ""}`, o.again));
    st.body.innerHTML = "";
    st.body.appendChild(box);
    st.scene(o.scene, o.dusk == null ? 0.35 : o.dusk);
    if (rank.key === "gold") st.confetti();
    G.meter(`<div class="rx-hud"><div class="rx-hud-pts"><b>${o.score}/${o.total}</b><span>${bi("case score", "本章分數")}</span></div></div>`);
    window.scrollTo({ top: 0, behavior: reduceMotion ? "auto" : "smooth" });
    return Object.assign({}, rank, { saved });
  }

  /* a level chip the way the access table on the Help Desk wall draws it */
  const LV = {
    none: { en: "No access", zh: "不給", icon: '<path d="M4 8h8" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/>' },
    masked: { en: "Masked", zh: "只給遮罩", icon: '<g fill="currentColor"><circle cx="3" cy="8" r="1.4"/><circle cx="6.3" cy="8" r="1.4"/><circle cx="9.6" cy="8" r="1.4"/></g><path d="M12.2 5.2v5.6" stroke="currentColor" stroke-width="1.6"/>' },
    read: { en: "Read", zh: "唯讀", icon: '<path d="M1.5 8s2.4-4.2 6.5-4.2S14.5 8 14.5 8s-2.4 4.2-6.5 4.2S1.5 8 1.5 8z" fill="none" stroke="currentColor" stroke-width="1.4"/><circle cx="8" cy="8" r="1.9" fill="currentColor"/>' },
    write: { en: "Edit", zh: "可改", icon: '<path d="M3 13l1-3.2 6.6-6.6 2.2 2.2L6.2 12z" fill="none" stroke="currentColor" stroke-width="1.4" stroke-linejoin="round"/><path d="M9.4 4.4l2.2 2.2" stroke="currentColor" stroke-width="1.4"/>' },
    admin: { en: "Admin only", zh: "技術管理", icon: '<circle cx="8" cy="8" r="2.2" fill="none" stroke="currentColor" stroke-width="1.4"/><path d="M8 1.8v2M8 12.2v2M1.8 8h2M12.2 8h2M3.6 3.6 5 5M11 11l1.4 1.4M3.6 12.4 5 11M11 5l1.4-1.4" stroke="currentColor" stroke-width="1.4" stroke-linecap="round"/>' },
  };
  const lvIcon = (lv) => `<svg viewBox="0 0 16 16" aria-hidden="true">${(LV[lv] || LV.none).icon}</svg>`;
  const lvChip = (lv, extra) => `<span class="lv lv-${lv} lv-chip ${extra || ""}">${lvIcon(lv)}${bi(LV[lv].en, LV[lv].zh)}</span>`;

  /* ------------------------------------------------------------------ hands-on controls shared by chapters 3 and 4 */
  const cap = (node, id) => { try { node.setPointerCapture(id); } catch { /* not a live pointer */ } };
  const CHEV = `<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M8 5l7 7-7 7" fill="none" stroke="currentColor" stroke-width="2.8" stroke-linecap="round" stroke-linejoin="round"/></svg>`;
  /* A slide switch: drag the knob to the far end (or press the right arrow four times). Used for "approve", "answer",
     "unlock" and "unblock": anything you should mean, not tap by accident. */
  function slideHTML(kind, label, aria) {
    return `<div class="mn-slide is-${kind}" data-slide="${kind}"><span class="mn-slide-fill"></span><span class="mn-slide-label">${label}</span>
      <button type="button" class="mn-slide-knob" aria-label="${esc(aria)}">${CHEV}</button></div>`;
  }
  function slideCtl(box, done) {
    if (!box) return;
    const knob = $(".mn-slide-knob", box), fill = $(".mn-slide-fill", box);
    let p = null, k = 0;
    const max = () => Math.max(1, box.clientWidth - knob.offsetWidth - 6);
    const set = (x) => {
      const m = max(), v = Math.max(0, Math.min(m, x));
      knob.style.transform = `translateX(${v}px)`;
      fill.style.width = `${v + knob.offsetWidth + 3}px`;
      box.style.setProperty("--k", (v / m).toFixed(3));
      return v / m;
    };
    const back = () => { k = 0; box.classList.add("is-back"); set(0); setTimeout(() => box.classList.remove("is-back"), 260); };
    const finish = () => { box.classList.add("is-done"); SFX.play("clunk"); done(); };
    knob.addEventListener("pointerdown", (ev) => {
      if (ev.button !== 0 || box.classList.contains("is-off") || box.classList.contains("is-done")) return;
      ev.preventDefault(); ev.stopPropagation();
      p = { x0: ev.clientX, v: 0 };
      cap(knob, ev.pointerId);
      box.classList.add("is-drag");
    });
    knob.addEventListener("pointermove", (ev) => { if (p) p.v = set((ev.clientX - p.x0) / G.k()); });
    const end = () => {
      if (!p) return;
      const v = p.v;
      p = null;
      box.classList.remove("is-drag");
      if (v >= 0.92) { set(max()); finish(); } else back();
    };
    knob.addEventListener("pointerup", end);
    knob.addEventListener("pointercancel", end);
    knob.addEventListener("keydown", (ev) => {
      if (box.classList.contains("is-off") || box.classList.contains("is-done")) return;
      if (ev.key === "ArrowRight") { ev.preventDefault(); k = Math.min(1, k + 0.25); set(k * max()); if (k >= 1) finish(); }
      else if (ev.key === "ArrowLeft" || ev.key === "Escape") { ev.preventDefault(); back(); }
    });
    box.reset = () => { box.classList.remove("is-done"); back(); };
  }


  /* Pull a red string from the question card to a piece of evidence on the cork: the line follows the pointer, the
     evidence under it lights up, and letting go on it is the answer. (A click on the evidence still works.) */
  function stringFrom(handle, sel, onDrop) {
    if (!handle) return;
    let p = null;
    const live = () => {
      let s = $("#cbLive");
      if (!s) { s = document.createElementNS("http://www.w3.org/2000/svg", "svg"); s.id = "cbLive"; s.setAttribute("class", "cb-live"); s.setAttribute("aria-hidden", "true"); document.body.appendChild(s); }
      return s;
    };
    const targetAt = (x, y) => { const e = document.elementFromPoint(x, y); return e ? e.closest(sel) : null; };
    handle.addEventListener("pointerdown", (ev) => {
      if (ev.button !== 0) return;
      ev.preventDefault();
      const r = $(".cb-pin", handle) ? $(".cb-pin", handle).getBoundingClientRect() : handle.getBoundingClientRect();
      p = { x0: r.left + r.width / 2, y0: r.top + r.height / 2, over: null };
      cap(handle, ev.pointerId);
      handle.classList.add("is-pulling");
      const cork = $("#cbCork"); if (cork) cork.classList.add("is-stringing");
      SFX.play("pluck");
    });
    handle.addEventListener("pointermove", (ev) => {
      if (!p) return;
      const s = live(), x = ev.clientX, y = ev.clientY, sag = Math.min(60, Math.hypot(x - p.x0, y - p.y0) * 0.1);
      s.setAttribute("viewBox", `0 0 ${innerWidth} ${innerHeight}`);
      const d = (o) => `M${(p.x0 + o).toFixed(1)} ${(p.y0 + o * 2).toFixed(1)} Q${((p.x0 + x) / 2 + o).toFixed(1)} ${((p.y0 + y) / 2 + sag + o * 2).toFixed(1)} ${(x + o).toFixed(1)} ${(y + o * 2).toFixed(1)}`;
      s.innerHTML = `<path class="cb-str-sh" d="${d(1)}"/><path class="cb-str" d="${d(0)}"/><circle class="cb-live-end" cx="${x}" cy="${y}" r="6"/>`;
      const t = targetAt(x, y);
      if (t !== p.over) { if (p.over) p.over.classList.remove("is-string-over"); if (t) t.classList.add("is-string-over"); p.over = t; }
    });
    const end = () => {
      if (!p) return;
      const t = p.over;
      if (t) t.classList.remove("is-string-over");
      p = null;
      handle.classList.remove("is-pulling");
      const cork = $("#cbCork"); if (cork) cork.classList.remove("is-stringing");
      const s = $("#cbLive"); if (s) s.innerHTML = "";
      if (t) onDrop(t);
    };
    handle.addEventListener("pointerup", end);
    handle.addEventListener("pointercancel", end);
    // 11/22: from the keyboard the string goes line by line: Enter (or Space) here moves to the first piece of evidence, and
    // Enter on a line answers with it (review: this button did nothing on Enter, and the working route had no hint)
    handle.addEventListener("keydown", (ev) => {
      if (ev.key !== "Enter" && ev.key !== " ") return;
      ev.preventDefault();
      const first = $(sel);
      if (first) first.focus({ preventScroll: true });
    });
  }
  const spoolHTML = (en, zh) => `<button type="button" class="cb-spool" id="cbSpool"><i class="cb-pin" aria-hidden="true"></i><span>${bi(en, zh)}</span></button>`;

  return { IMG, ICON, RULE, SFX, cap, slideHTML, slideCtl, stringFrom, spoolHTML, LV, lvIcon, lvChip, fill, mins, hhmm, pad2, mentor, analyst, face, personHTML, say, stage, brief, title, timeskip, streak, hud, loop, pauseLayer, over,
    board, pinIn, solvedFx, refocus, cbSay, questions, nope, qPoints, drawStrings, addClose, closed, caseHTML, medal, finale, NEXT };
})();
