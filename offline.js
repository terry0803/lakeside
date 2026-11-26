/* The GitHub Pages copy of the Lakeside IT Assistant (11/22). Every page of the copy starts with this script.
   The iStaging buttons point here instead of straight at the presenter's laptop:
   - the laptop's assistant is ready: this page goes on to the same address on the laptop (the live assistant and games);
   - it is not (laptop off, server stopped, or the model or the graph not running): the saved copy opens. The map, the
     place overviews recorded on 2026-11-23, Progress, How it works and the four mini-games work; a new question to the AI
     gets a short note that the AI is off.
   In the saved copy the answers of the laptop's /api/... come from data/ through the fetch() below.
   Built by 知識後端/助理/pages/build_pages.py; edit the template there, not the copy in the site.
   11/22 evening, after a review: the probe asks /probe.png (503 unless the AI is ready) and gives up cleanly after 5 s;
   a page of the copy inside iStaging's window inside the saved full page keeps its progress with that page; Start over
   works; the laptop is not tried when the page around would block it. */
"use strict";
(() => {
  const LIVE = "https://lakeside.taila701b6.ts.net", BASE = "/lakeside", SAVED = "2026-11-23";
  const GAMES = ["phish", "access", "mfa", "ir"];
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
  css.textContent = `html.lk-probing { background: #101318; }
html.lk-probing body { visibility: hidden; }
html.lk-probing::after { content: "Connecting\\2026\\A 連線中\\2026"; white-space: pre-wrap; position: fixed; inset: 0; display: grid; place-items: center; padding: 0 24px;
  text-align: center; font: 15px/1.7 system-ui, "Microsoft JhengHei", sans-serif; color: rgba(226, 232, 240, .85); }
html.lk-probing.lk-slow::after { content: "Connecting\\2026\\A 連線中\\2026\\A\\A The IT Assistant and the mini-games run on the presenter\\2019s laptop. If the laptop or its AI is off, a saved copy opens in a moment.\\A IT 小幫手和小遊戲跑在報告用的筆電上，筆電或 AI 沒開的話，等一下會打開存好的離線版。"; }`;
  document.head.appendChild(css);
  root.classList.add("lk-probing");

  const KEY = "lakeside.offlineUntil", FORCE = "lakeside.offlineForced";
  const ss = (k, v) => { try { if (v === undefined) return sessionStorage.getItem(k); sessionStorage.setItem(k, v); } catch { /* no storage */ } return null; };
  // a window of this copy that already runs the saved copy: a page around this one (iStaging's window can sit in between),
  // or the saved full page whose tour opened this tab. Its storage is used too: the browser keeps a frame under another
  // site's frame apart, so scores saved in here would not reach that page's Progress tab.
  const offlineHost = () => {
    for (let w = window; w !== w.parent;) {
      w = w.parent;
      try { if (w.LAKESIDE_OFFLINE) return w; } catch { /* another site */ }
    }
    return null;
  };
  // a new tab opened from the saved full page (the balloon's Full version): saved copy too. A tab of its own shares that
  // page's storage anyway, so only the decision is taken from it (and nothing breaks when that page is closed later).
  const openerOffline = () => { try { const o = window.opener && window.opener.top; return !!(o && o.LAKESIDE_OFFLINE); } catch { return false; } };
  const ancestors = () => { try { return [...(location.ancestorOrigins || [])]; } catch { return []; } };
  const liveOrigin = new URL(LIVE).origin;
  const liveAbove = () => ancestors().includes(liveOrigin);      // the laptop's own page is around this one: it is on
  // a page around this one that the laptop does not allow to hold its pages (server.py frame-ancestors: itself, its local
  // address and *.istaging.com): going there would leave a blank window, so the saved copy instead. "null" is a sandboxed
  // frame, which frame-ancestors refuses too.
  const OK_AROUND = [liveOrigin, "http://127.0.0.1:8780", "http://localhost:8780", "http://localhost:3000", "http://127.0.0.1:3000"];
  const blockedAbove = () => ancestors().some((o) => !OK_AROUND.includes(o) && !/^https:\/\/([a-z0-9-]+\.)+istaging\.com$/.test(o));

  if (params.has("offline")) ss(FORCE, "1");        // asked for the saved copy: this tab stays in it (a new tab goes back)
  const host = offlineHost();
  if (params.has("offline") || ss(FORCE) === "1" || host || openerOffline()) offline(host);
  else if (liveAbove()) location.replace(liveUrl);
  else if (blockedAbove() || Number(ss(KEY)) > Date.now()) offline(null);
  else probe();

  function probe() {
    let done = false;
    const img = new Image();
    const slow = setTimeout(() => root.classList.add("lk-slow"), 1500);
    const give = setTimeout(() => finish(false), 5000);
    function finish(up) {
      if (done) return;
      done = true; clearTimeout(slow); clearTimeout(give);
      img.onload = img.onerror = null;
      if (!up) img.removeAttribute("src");           // stop waiting on the laptop, or the page keeps loading for ~20 s
      if (up) { location.replace(liveUrl); return; }
      ss(KEY, String(Date.now() + 60 * 1000));     // the next pages of this tab do not wait again for a minute (was 3; 11/23)
      offline(null);
      recheck();
    }
    img.onload = () => finish(true);
    img.onerror = () => finish(false);
    img.src = `${LIVE}/probe.png?t=${Date.now()}`;
  }

  // 11/23 (the user saw "the AI is off" while the laptop was on): one slow answer (the laptop's address can take a few
  // seconds to wake up) left the saved copy on. Ask twice more in the background; if the laptop answers before the visitor
  // has done anything on this page, go on to the live page.
  function recheck() {
    let touched = false;
    for (const t of ["pointerdown", "keydown"]) addEventListener(t, () => { touched = true; }, { capture: true, once: true });
    for (const ms of [8000, 20000]) setTimeout(() => {
      if (touched) return;
      const im = new Image();
      const give = setTimeout(() => { im.onload = im.onerror = null; im.removeAttribute("src"); }, 5000);
      im.onload = () => { clearTimeout(give); if (!touched) { ss(KEY, "0"); location.replace(liveUrl); } };
      im.onerror = () => clearTimeout(give);
      im.src = `${LIVE}/probe.png?t=${Date.now()}`;
    }, ms);
  }

  function offline(hostWin) {
    window.LAKESIDE_OFFLINE = true;
    installApi(hostWin);
    // the page's own scripts run after the page is read, then hear DOMContentLoaded once, as they would with "defer"
    const run = () => {
      let i = 0;
      const next = () => {
        if (i >= load.length) {
          root.classList.remove("lk-probing", "lk-slow");
          document.dispatchEvent(new Event("DOMContentLoaded", { bubbles: true }));
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
  function installApi(hostWin) {
    const realFetch = window.fetch.bind(window);
    const DATA = `${BASE}/data`;
    const SK = "lakeside.offline.state";
    const store = () => { try { return (hostWin || window).localStorage; } catch { try { return window.localStorage; } catch { return null; } } };
    const read = () => { try { return JSON.parse(store().getItem(SK)) || {}; } catch { return {}; } };
    const write = (s) => { try { store().setItem(SK, JSON.stringify(s)); } catch { /* private window */ } };
    const sessionId = () => {
      const s = read();
      if (!s.session) { s.session = `offline-${Math.random().toString(36).slice(2, 10)}`; write(s); }
      return s.session;
    };
    let total = 17;
    const state = () => {
      const s = read(), v = s.visited || [];
      return { room: s.room || null, visited: v.length, visited_keys: v, found: [], found_n: 0, total_findings: total,
               found_items: [], model: s.model || "qwen3.5:9b", last: [], games: s.games || {} };
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
    // 11/26 (review): the server's rule (agent.detect_lang): Chinese characters against English words not in capitals
    const hasZh = (s) => { const cjk = (String(s || "").match(/[㐀-鿿]/g) || []).length;
      const words = (String(s || "").match(/[A-Za-z][A-Za-z'-]*/g) || []).filter((w) => w.replace(/['-]/g, "") !== w.replace(/['-]/g, "").toUpperCase()).length;
      return cjk > 0 && cjk > 2 * words; };

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
    const OFF_EN = "I can't answer new questions right now. The AI runs on the presenter's laptop and is not running right now. In this saved copy you can still read the overview of each place (pick a place on the map and press the button below, or press “Ask the IT Assistant” on a sign in the tour), look at Progress and How it works, and play the four mini-games in the Casebook.";
    const OFF_ZH = "我現在不能回答新的問題。AI 跑在報告用的筆電上，現在沒開。這個離線版還可以看每個地點的介紹（在地圖上選地點再按下面的按鈕，或按導覽招牌上的「問 IT 小幫手」），看「進度」和「原理」，也可以玩事件簿裡的四個小遊戲。";
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
      if (p === "settings" && body.reset) write({ session: sessionId() });   // Start over: places and scores cleared
      if (p === "state" || p === "settings") return json({ session: sessionId(), state: state() });
      if (p === "visit") { visit(body.room); return json({ session: sessionId(), state: state() }); }
      if (p === "games/result") {                    // the same checks as server.py, including Python's int()
        const pyInt = (v) => (typeof v === "number" && Number.isFinite(v) ? Math.trunc(v)
          : typeof v === "string" && /^\s*[+-]?\d+\s*$/.test(v) ? parseInt(v, 10) : NaN);
        const score = pyInt(body.score), tot = pyInt(body.total);
        if (!GAMES.includes(body.game)) return json({ error: "unknown game" }, 400);
        if (Number.isNaN(score) || Number.isNaN(tot)) return json({ error: "score and total must be numbers" }, 400);
        if (!(tot > 0 && tot <= 100 && score >= 0 && score <= tot)) return json({ error: "score out of range" }, 400);
        const s = read(); s.games = s.games || {};
        const old = s.games[body.game] || {}, same = (old.best_total ?? old.total) === tot;   // as games.py record (11/26)
        s.games[body.game] = { score, total: tot, best: same ? Math.max(score, old.best ?? -1) : score, best_total: tot,
                               plays: (old.plays || 0) + 1, at: new Date().toTimeString().slice(0, 5) };
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
