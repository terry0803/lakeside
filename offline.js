/* The GitHub Pages copy of the Lakeside IT Assistant (11/22). Every page of the copy starts with this script.
   The iStaging buttons point here instead of straight at the team's laptop:
   - the laptop answers: this page goes on to the same address on the laptop (the live assistant and mini-games);
   - it does not: the saved copy opens. The map, the place overviews recorded on 2026-11-22, Progress, How it works and the
     four mini-games work; a new question to the AI gets a short note that the AI is off.
   In the saved copy the answers of the laptop's /api/... come from data/ through the fetch() below.
   Built by 知識後端/助理/pages/build_pages.py; edit the template there, not the copy in the site. */
"use strict";
(() => {
  const LIVE = "https://lakeside.taila701b6.ts.net", BASE = "/lakeside", SAVED = "2026-11-22";
  const me = document.currentScript;
  const load = ((me && me.dataset.load) || "").split(/\s+/).filter(Boolean);
  const params = new URLSearchParams(location.search);
  const root = document.documentElement;

  // the same page on the laptop: /lakeside/games/phish/ -> /games/phish
  let path = location.pathname.startsWith(BASE) ? location.pathname.slice(BASE.length) : location.pathname;
  path = path.replace(/index\.html$/, "") || "/";
  if (path.length > 1) path = path.replace(/\/+$/, "");
  const liveUrl = LIVE + path + location.search + location.hash;

  // while it checks: a dark page with one line, instead of a half-built page
  const css = document.createElement("style");
  css.textContent = `html.lk-probing { background: #0d1520; }
html.lk-probing body { visibility: hidden; }
html.lk-probing::after { content: "Connecting\\2026\\A 連線中\\2026"; white-space: pre-wrap; position: fixed; inset: 0; display: grid; place-items: center; padding: 0 24px;
  text-align: center; font: 15px/1.7 system-ui, "Microsoft JhengHei", sans-serif; color: rgba(226, 232, 240, .85); }
html.lk-probing.lk-slow::after { content: "Connecting\\2026\\A 連線中\\2026\\A\\A The live version runs on the team\\2019s laptop. If it is off, a saved copy opens in a moment.\\A 正式版跑在組員的筆電上，筆電沒開的話，等一下會打開存好的離線版。"; }`;
  document.head.appendChild(css);
  root.classList.add("lk-probing");

  const KEY = "lakeside.offlineUntil";
  const offlineCached = () => { try { return Number(sessionStorage.getItem(KEY)) > Date.now(); } catch { return false; } };
  const offlineAbove = () => {        // a page of this copy around this one already runs offline (same address)
    for (let w = window; w !== w.parent;) {   // iStaging's frame can sit in between, so every level on its own
      w = w.parent;
      try { if (w.LAKESIDE_OFFLINE) return true; } catch { /* another site */ }
    }
    return false;
  };
  const liveAbove = () => {           // the laptop's own page is around this one, so the laptop is on
    try { return [...(location.ancestorOrigins || [])].includes(new URL(LIVE).origin); } catch { return false; }
  };

  const remember = () => { try { sessionStorage.setItem(KEY, String(Date.now() + 3 * 60 * 1000)); } catch { /* no storage */ } };
  if (params.has("offline")) remember();          // asked for the saved copy: the next pages of this tab stay in it
  if (params.has("offline") || offlineAbove() || offlineCached()) offline();
  else if (liveAbove()) location.replace(liveUrl);
  else probe();

  function probe() {
    let done = false;
    const img = new Image();
    const slow = setTimeout(() => root.classList.add("lk-slow"), 1500);
    const give = setTimeout(() => finish(false), 5000);
    function finish(up) {
      if (done) return;
      done = true; clearTimeout(slow); clearTimeout(give);
      if (up) { location.replace(liveUrl); return; }
      remember();
      offline();
    }
    img.onload = () => finish(true);
    img.onerror = () => finish(false);
    img.src = `${LIVE}/static/probe.png?t=${Date.now()}`;
  }

  function offline() {
    window.LAKESIDE_OFFLINE = true;
    installApi();
    // the page's own scripts run after the page is read, then hear DOMContentLoaded once, as they would with "defer"
    const run = () => {
      let i = 0;
      const next = () => {
        if (i >= load.length) {
          root.classList.remove("lk-probing", "lk-slow");
          document.dispatchEvent(new Event("DOMContentLoaded"));
          return;
        }
        const s = document.createElement("script");
        s.src = load[i++]; s.onload = next; s.onerror = next;
        document.head.appendChild(s);
      };
      next();
    };
    if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", run, { once: true });
    else run();
  }

  /* ------------------------------------------------------------ the laptop's /api/..., from the saved files */
  function installApi() {
    const realFetch = window.fetch.bind(window);
    const DATA = `${BASE}/data`;
    const SK = "lakeside.offline.state";
    const read = () => { try { return JSON.parse(localStorage.getItem(SK)) || {}; } catch { return {}; } };
    const write = (s) => { try { localStorage.setItem(SK, JSON.stringify(s)); } catch { /* private window */ } };
    const sessionId = () => {
      const s = read();
      if (!s.session) { s.session = `offline-${Math.random().toString(36).slice(2, 10)}`; write(s); }
      return s.session;
    };
    let total = 17;
    const state = () => {
      const s = read(), v = s.visited || [];
      return { room: s.room || null, visited: v.length, visited_keys: v, found: [], found_n: 0, total_findings: total,
               found_items: [], model: "qwen3.5:9b", last: [], games: s.games || {} };
    };
    const visit = (room) => {
      if (!room) return;
      const s = read(); s.room = room; s.visited = s.visited || [];
      if (!s.visited.includes(room)) s.visited.push(room);
      write(s);
    };
    const json = (o, status = 200) => new Response(JSON.stringify(o), { status, headers: { "Content-Type": "application/json" } });
    const sse = (evs) => new Response(evs.map(([e, d]) => `event: ${e}\ndata: ${JSON.stringify(d)}\n\n`).join(""),
      { headers: { "Content-Type": "text/event-stream" } });
    const hasZh = (s) => /[㐀-鿿]/.test(s || "");

    async function replay(room, lang) {         // the answer recorded for this place
      const r = await realFetch(`${DATA}/overview/${lang}/${encodeURIComponent(room)}.sse`);
      if (!r.ok) return null;
      const evs = [];
      for (const chunk of (await r.text()).split("\n\n")) {
        let ev = "message", data = "";
        for (const line of chunk.split("\n")) {
          if (line.startsWith("event: ")) ev = line.slice(7); else if (line.startsWith("data: ")) data += line.slice(6);
        }
        if (!data) continue;
        const d = JSON.parse(data);
        if (ev === "start") d.session = sessionId();
        if (ev === "done") d.state = state();
        evs.push([ev, d]);
      }
      return sse(evs);
    }
    const OFF_EN = "I can't answer new questions right now. The AI runs on the team's laptop, which is off. In this saved copy you can still open the overview of every place (the button below, or pick a place on the map or in the tour), see Progress and How it works, and play the four mini-games in the Casebook.";
    const OFF_ZH = "我現在不能回答新的問題。AI 跑在組員的筆電上，筆電沒開。這個離線版還可以看每個地點的介紹（按下面的按鈕，或在地圖、導覽裡選地點），看進度和原理說明，也可以玩事件簿裡的四個小遊戲。";
    const aiOff = (lang) => sse([
      ["start", { session: sessionId(), lang }],
      ["done", { answer: `${OFF_EN}\n${OFF_ZH}`, go: [],
                 followups: [{ text: lang === "zh" ? "這裡有什麼？" : "What is in this place?", en: "What is in this place?", zh: "這裡有什麼？" }],
                 trace: { offline: true, tool_used: "offline", timings: { total_s: 0 } }, state: state() }],
    ]);

    window.fetch = async (input, init) => {
      const url = new URL(typeof input === "string" ? input : input.url, location.href);
      if (url.origin !== location.origin || !url.pathname.startsWith("/api/")) return realFetch(input, init);
      const p = url.pathname.slice(5);
      let body = {};
      try { body = init && init.body ? JSON.parse(init.body) : {}; } catch { body = {}; }
      if (p === "rooms") {
        const j = await (await realFetch(`${DATA}/rooms.json`)).json();
        total = j.total_findings || total;
        return json(j);
      }
      if (p === "minimap" || p === "schema") return realFetch(`${DATA}/${p}.json`);
      if (p === "health") {
        const r = await realFetch(`${DATA}/health.json`);
        return json({ ...(r.ok ? await r.json() : {}), offline: true, saved: SAVED });
      }
      if (p === "state" || p === "settings") return json({ session: sessionId(), state: state() });
      if (p === "visit") { visit(body.room); return json({ session: sessionId(), state: state() }); }
      if (p === "games/result") {
        const score = Number(body.score), tot = Number(body.total);
        if (!(tot > 0 && score >= 0 && score <= tot)) return json({ error: "score out of range" }, 400);
        const s = read(); s.games = s.games || {};
        const old = s.games[body.game] || {};
        s.games[body.game] = { score, total: tot, best: Math.max(score, old.best ?? -1), plays: (old.plays || 0) + 1,
                               at: new Date().toTimeString().slice(0, 5) };
        write(s);
        return json({ session: sessionId(), state: state() });
      }
      if (p.startsWith("games/")) return realFetch(`${DATA}/games/${p.slice(6)}.json`);
      if (p === "action" || p === "chat") {
        visit(body.room);
        const said = p === "chat" ? body.message : body.label;
        const lang = body.lang === "zh" || body.lang === "en" ? body.lang : (hasZh(said) ? "zh" : "en");
        const overview = p === "action" ? body.tool === "room_overview" : /what is in this place|這裡有什麼/i.test(said || "");
        if (overview && body.room) { const r = await replay(body.room, lang); if (r) return r; }
        return aiOff(lang);
      }
      return json({ error: "not in the saved copy" }, 404);
    };
  }
})();
