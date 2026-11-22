/* The tour's mini map, second version (11/21 night). The maps are top views rendered in Blender, north up: the lake and
   the old town, the resort, and every building cut open from above (web/minimap/, boxes in content/minimap.yaml). A
   small map sits at the top right of the tour all the time and shows where you are; click it to open the big map. Inside
   a building the big map shows that building's floor plan and its scenes; zoom out (the minus button, the wheel, or the
   name at the top) to the lake and the old town, where every outdoor place and every building is; click a building to
   go in, click a place to go there in the tour. Positions are where each panorama was shot in Blender. The tour does not
   tell this page when you walk somewhere inside it, so "you are here" is the last place the assistant knows (this map,
   the place list, a "Go there" button, or a sign in the tour that opened the assistant). Uses app.js: S and goTo(). */
"use strict";

const Minimap = (() => {
  const NS = "http://www.w3.org/2000/svg", IMG = "/lakeside/static/minimap/";
  const M = { data: null, state: "mini", mode: "outdoor", building: null, view: null, room: null, drag: null, hover: null, built: false, layer: "" };
  const q = (s, e = document) => e.querySelector(s);
  const e = (s) => String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  const store = { get(k, d) { try { const v = localStorage.getItem("lia.mm." + k); return v === null ? d : JSON.parse(v); } catch { return d; } },
    set(k, v) { try { localStorage.setItem("lia.mm." + k, JSON.stringify(v)); } catch { /* private mode */ } } };

  const ICON_MAP = `<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M3 6.5 9 4l6 2.5L21 4v13.5L15 20l-6-2.5L3 20z" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linejoin="round"/><path d="M9 4v13.5M15 6.5V20" fill="none" stroke="currentColor" stroke-width="1.5"/></svg>`;
  const ICON_OPEN = `<svg viewBox="0 0 20 20" aria-hidden="true"><path d="M12 3h5v5M17 3l-6 6M8 17H3v-5M3 17l6-6" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/></svg>`;
  const ICON_HIDE = `<svg viewBox="0 0 20 20" aria-hidden="true"><path d="M5 10h10" stroke="currentColor" stroke-width="2" stroke-linecap="round"/></svg>`;
  const ICON_HOUSE = "M-5 1.5 0-3.5 5 1.5V5.5H-5z";       // drawn at the building's centre, scaled per zoom

  const room = (k) => (typeof S !== "undefined" && S.byKey ? S.byKey[k] : null);
  const nameOf = (k) => { const r = room(k); return r ? [r.it_en || r.name_en || k, r.it_zh || r.name_zh || ""] : [k, ""]; };
  const shortOf = (k) => { const n = nameOf(k)[0]; return n.includes(" · ") ? n.split(" · ")[0] : n; };
  // 11/22: the Chinese of a place's name on the map too (the part before or after the ・, like the English)
  const shortZh = (k) => { const z = nameOf(k)[1]; return z.includes("・") ? z.split("・")[0] : z; };
  const tailZh = (k) => { const z = nameOf(k)[1]; return z.includes("・") ? z.split("・").pop() : z; };
  const P = (x, y) => [x, -y];                // map metres (y north) → SVG (y down)
  const buildingOf = (k) => Object.keys(M.data.buildings).find((b) => (M.data.buildings[b].rooms || []).includes(k)) || null;
  const outdoorKeys = () => Object.keys(M.data.spots).filter((k) => !buildingOf(k) && room(k));
  const spotOf = (k, b) => { const s = M.data.spots[k]; if (!s) return null; const sh = b && (M.data.buildings[b].shift || {})[k]; return sh ? [s[0] + sh[0], s[1] + sh[1]] : s; };

  /* ------------------------------------------------------------------ building the widget */
  const EMBEDDED = () => document.documentElement.classList.contains("is-embed");
  async function init() {
    const tour = q(".tour");
    if (!tour) return;
    try { M.data = await fetch("/api/minimap").then((r) => r.json()); } catch { return; }
    if (!M.data || !M.data.spots) return;
    const box = document.createElement("div");
    box.className = "mm"; box.id = "mm";
    box.innerHTML = `<button type="button" class="mm-mini lg-rim lg-hi" id="mmMini" aria-controls="mmPanel" aria-expanded="false">
        <svg class="mm-mini-svg" id="mmMiniSvg" aria-hidden="true"></svg>
        <span class="mm-mini-cap"><span class="mm-mini-t"><b id="mmHereEn"></b><small lang="zh-Hant" id="mmHereZh"></small></span>
          <span class="mm-mini-open">${ICON_OPEN}<span>Map <span lang="zh-Hant">地圖</span></span></span></span></button>
      <button type="button" class="mm-hide" id="mmHide" title="Hide the mini map 收起小地圖" aria-label="Hide the mini map">${ICON_HIDE}</button>
      <button type="button" class="mm-pill lg-rim lg-hi" id="mmPill" title="Show the mini map 顯示小地圖" aria-label="Show the mini map" hidden><span class="mm-pill-ico">${ICON_MAP}</span><span class="dock-t"><b>Map</b><small lang="zh-Hant">地圖</small></span></button>
      <section class="mm-panel lg-rim lg-hi" id="mmPanel" hidden aria-label="Map">
        <header class="mm-head"><nav class="mm-crumbs" id="mmCrumbs" aria-label="Where on the map"></nav>
          <button type="button" class="mm-x" id="mmClose" aria-label="Close the map">×</button></header>
        <div class="mm-view" id="mmView">
          <svg class="mm-svg" id="mmSvg" role="group" aria-label="Map of the tour. Each place is a button."><g id="mmImgs"></g><g id="mmMarks"></g></svg>
          <div class="mm-tip" id="mmTip" hidden></div>
          <div class="mm-zoom"><button type="button" data-z="in" aria-label="Zoom in">+</button><button type="button" data-z="out" aria-label="Zoom out">−</button></div>
        </div>
        <p class="mm-foot" id="mmFoot"></p>
      </section>`;
    const side = q("#side");          // the column under iStaging's buttons: the map first, the assistant's buttons under it
    if (EMBEDDED() && q("#mapHost")) { box.classList.add("is-pane"); q("#mapHost").appendChild(box); }      // inside iStaging's window: the Map tab
    else if (side) side.prepend(box); else tour.appendChild(box);
    // 11/22 afternoon: a click anywhere outside the open big map shrinks it back. The tour is in iStaging's frame and its clicks
    // never reach this page, so while the map is open a clear layer lies over the tour to catch them.
    if (!EMBEDDED() && q("#layout")) {
      const scrim = document.createElement("div");
      scrim.className = "mm-scrim"; scrim.id = "mmScrim"; scrim.setAttribute("aria-hidden", "true");
      q("#layout").insertBefore(scrim, side || null);
      scrim.addEventListener("pointerdown", (ev) => { ev.preventDefault(); setState("mini"); });
      document.addEventListener("pointerdown", (ev) => {
        if (M.state !== "open" || EMBEDDED()) return;
        const t = ev.target instanceof Element ? ev.target : null;
        if (!t || t.closest("#mmPanel, #mmMini, #mmPill, #mmHide, #mmScrim")) return;
        setState("mini");
      }, true);
    }
    q("#mmMini").addEventListener("click", () => setState("open"));
    q("#mmHide").addEventListener("click", () => setState("hidden"));
    q("#mmPill").addEventListener("click", () => setState("mini"));
    q("#mmClose").addEventListener("click", () => setState("mini"));
    for (const b of box.querySelectorAll("[data-z]")) b.addEventListener("click", () => zoomBtn(b.dataset.z));
    const svg = q("#mmSvg");
    svg.addEventListener("wheel", onWheel, { passive: false });
    svg.addEventListener("pointerdown", onDown);
    svg.addEventListener("pointermove", onMove);
    svg.addEventListener("pointerup", onUp);
    svg.addEventListener("pointercancel", onUp);
    svg.addEventListener("pointerleave", () => tip(null));
    svg.addEventListener("click", onClick);
    svg.addEventListener("keydown", (ev) => { const t = ev.target.closest("[data-go],[data-b]"); if (t && (ev.key === "Enter" || ev.key === " ")) { ev.preventDefault(); activate(t); } });
    document.addEventListener("keydown", (ev) => { if (ev.key === "Escape" && M.state === "open" && !EMBEDDED()) setState("mini"); });
    window.addEventListener("resize", () => { if (M.state === "open") render(); else renderMini(); });
    M.built = true;
    update((typeof S !== "undefined" && S.room) || null);
    setState(store.get("state", "mini"));
    M.ready = true;                   // from now on a change of state may animate (not the one that restores the saved state)
  }

  // "mini": the small map in the corner; "open": the big map; "hidden": only a small Map button
  // 11/22 afternoon: the big map grows out of the small one and shrinks back into it as one piece (morphMap). Before, the shrink
  // only cut the big map down to the corner while it went see-through, then the small map popped in and the buttons under
  // it slid in a second time (the user: the shrink looked odd).
  const RM = window.matchMedia ? window.matchMedia("(prefers-reduced-motion: reduce)") : { matches: false };
  let morph = null;                 // a grow or shrink still running: its animations and what to do at the end
  function endMorph() {
    const mo = morph; morph = null;
    if (!mo) return;
    for (const a of mo.anims) a.cancel();
    mo.end();
  }
  const shown = (els) => [...els].filter((e) => e && !e.hidden && e.offsetParent !== null);
  /* The panel moves between the small map's box r and its own place: scaled to the small map's width, cut to its height,
     with the same 20px corners. Opening, the things it grows over (the small map, its button, the buttons below) fade out;
     closing, they are already back in place under it and the panel fades out once it fits the small map. */
  function morphMap(panel, r, opening, under) {
    const p = panel.getBoundingClientRect();
    if (!p.width || !p.height || !r.width || !r.height) return null;
    const s = r.width / p.width, cut = Math.max(0, p.height - r.height / s);
    const small = { transform: `translate(${(r.left - p.left).toFixed(1)}px, ${(r.top - p.top).toFixed(1)}px) scale(${s.toFixed(4)})`,
      clipPath: `inset(0px 0px ${cut.toFixed(1)}px 0px round ${(20 / s).toFixed(1)}px)` };
    // the open end leaves room for the panel's shadow, so nothing changes when the animation lets go
    const big = { transform: "translate(0px, 0px) scale(1)", clipPath: "inset(-70px -70px -70px -70px round 90px)" };
    const T = opening ? 540 : 440;
    const anims = [panel.animate(opening ? [small, big] : [big, small],
      { duration: T, easing: opening ? "cubic-bezier(.2, .9, .25, 1)" : "cubic-bezier(.4, 0, .2, 1)", fill: "forwards" })];
    anims.push(panel.animate(opening ? [{ opacity: 0.35 }, { opacity: 1 }] : [{ opacity: 1 }, { opacity: 0 }],
      opening ? { duration: 200, easing: "ease-out", fill: "backwards" } : { duration: 160, delay: T - 160, easing: "ease-in", fill: "forwards" }));
    if (opening) for (const e of under) anims.push(e.animate([{ opacity: 1 }, { opacity: 0 }], { duration: 200, easing: "ease-out", fill: "forwards" }));
    return anims;
  }
  function runMorph(anims, end) {
    const mo = { anims, end };
    morph = mo;
    Promise.all(anims.map((a) => a.finished)).then(() => { if (morph === mo) endMorph(); }).catch(() => { /* cut short by the next change */ });
  }
  function setState(s) {
    endMorph();
    const prev = M.state;
    M.state = EMBEDDED() ? "open" : ["mini", "open", "hidden"].includes(s) ? s : "mini";
    if (!EMBEDDED()) store.set("state", M.state === "open" ? "mini" : M.state);
    const panel = q("#mmPanel"), mini = q("#mmMini"), hide = q("#mmHide");
    tip(null);
    // everything for the new state; drawn: the morph already drew the map and moved the focus
    const apply = (drawn) => {
      mini.hidden = M.state !== "mini";
      hide.hidden = M.state !== "mini";
      q("#mmPill").hidden = M.state !== "hidden";
      panel.hidden = M.state !== "open";
      panel.classList.remove("is-float", "is-leaving");
      if (panel.hidden) panel.classList.remove("is-morph");
      mini.setAttribute("aria-expanded", String(M.state === "open"));
      q("#mm").dataset.state = M.state;
      const scrim = q("#mmScrim"); if (scrim) scrim.classList.toggle("is-on", M.state === "open");
      if (M.state === "open" && !drawn) { focusRoom(M.room, true); render(); if (!EMBEDDED()) q("#mmClose").focus({ preventScroll: true }); }
      if (M.state === "mini" && !drawn) { renderMini(); if (prev === "open") mini.focus({ preventScroll: true }); }
      document.dispatchEvent(new CustomEvent("minimap:state", { detail: M.state }));
    };
    const motion = !EMBEDDED() && !RM.matches && typeof panel.animate === "function";
    if (motion && prev === "mini" && M.state === "open" && shown([mini]).length) {
      const r = mini.getBoundingClientRect();
      panel.classList.add("is-morph", "is-float");          // over the small map until it has grown; the buttons below stay put
      panel.hidden = false;
      mini.setAttribute("aria-expanded", "true");
      const sc = q("#mmScrim"); if (sc) sc.classList.add("is-on");
      focusRoom(M.room, true); render(); q("#mmClose").focus({ preventScroll: true });
      const anims = morphMap(panel, r, true, shown([mini, hide, ...document.querySelectorAll(".dock-btn")]));
      if (anims) { runMorph(anims, () => apply(true)); return; }
      apply(true); return;
    }
    if (motion && prev === "open" && M.state === "mini" && !panel.hidden) {
      for (const b of document.querySelectorAll(".dock-btn")) b.classList.add("is-quiet");   // they come back in place, no second slide-in
      panel.classList.add("is-morph", "is-float", "is-leaving");    // lifted off the column, still on top; clicks go through it
      mini.hidden = false; hide.hidden = false;
      q("#mm").dataset.state = "mini";                       // the column is already the small map's, the buttons under it too
      const sc = q("#mmScrim"); if (sc) sc.classList.remove("is-on");
      renderMini(); mini.focus({ preventScroll: true });
      const anims = morphMap(panel, mini.getBoundingClientRect(), false, []);
      if (anims) { runMorph(anims, () => apply(true)); return; }
    }
    if (motion && M.ready && ((prev === "mini" && M.state === "hidden") || (prev === "hidden" && M.state === "mini")) && foldMini(M.state === "hidden", apply)) return;
    apply();
  }
  /* 11/22 night (the user: the small map shrinking into the Map button still had the old animation; it was a cut, and the
     two buttons below jumped up): the same motion as the assistant window folding into its buttons and the big map going
     small. Shrinking takes 0.44 s on cubic-bezier(.4, 0, .2, 1), growing back 0.54 s on cubic-bezier(.2, .9, .25, 1). The
     one going away floats where it was and fades over the first 40%; the one coming starts at the same corner and width
     (the pill as wide as the map, the map as narrow as the pill) under it and settles into place on the same curve, so the
     two stay together; the two buttons below slide to their new places. Transform and opacity only. */
  function foldMini(toPill, apply) {
    const mini = q("#mmMini"), pill = q("#mmPill"), hide = q("#mmHide"), box = q("#mm");
    const from = toPill ? mini : pill, to = toPill ? pill : mini;
    if (!shown([from]).length) return false;
    const F = from.getBoundingClientRect(), H0 = toPill && shown([hide]).length ? hide.getBoundingClientRect() : null;
    const docks = shown(document.querySelectorAll(".dock-btn")), before = docks.map((b) => b.getBoundingClientRect().top);
    from.classList.add("is-quiet"); to.classList.add("is-quiet");   // before it shows: the pill's slide-in would move where it is measured
    apply();                                               // the new state; the column takes its new shape at once
    const B = box.getBoundingClientRect(), Tg = to.getBoundingClientRect();
    if (!F.width || !Tg.width || to.offsetParent === null) { from.classList.remove("is-quiet"); to.classList.remove("is-quiet"); return true; }
    const s = Tg.width / F.width, dx = Tg.left - F.left, dy = Tg.top - F.top;
    const KEYS = ["position", "left", "top", "width", "height", "margin", "zIndex", "pointerEvents", "transformOrigin", "opacity"];
    const float = (el, r) => Object.assign(el.style, { position: "absolute", left: `${(r.left - B.left).toFixed(1)}px`, top: `${(r.top - B.top).toFixed(1)}px`,
      width: `${r.width.toFixed(1)}px`, height: `${r.height.toFixed(1)}px`, margin: "0", zIndex: "3", pointerEvents: "none", transformOrigin: "0 0" });
    // is-quiet stays on: taking it off restarts the pill's CSS slide-in, which played once more after it had landed (the user:
    // "after shrinking it bounces once more, like the buttons used to"); the dock buttons keep theirs the same way
    const clean = (el) => { for (const k of KEYS) el.style[k] = ""; };
    from.hidden = false; float(from, F);
    to.style.zIndex = "2"; to.style.transformOrigin = "0 0";
    const T = toPill ? 440 : 540, o = { duration: T, easing: toPill ? "cubic-bezier(.4, 0, .2, 1)" : "cubic-bezier(.2, .9, .25, 1)", fill: "both" };
    // 11/23: the Map button is now as wide as the small map (same kind of button as the two under it), so the width no
    // longer shrinks; the small map rolls up from the bottom to the button's height instead (and down again when it comes
    // back). The cut stays off the shadow at the open end, so nothing changes when the animation lets go.
    // the cut's corners in the small map's own units, so they match the button's on screen (it is narrower again)
    const miniClip = (toPill ? F.height - Tg.height / s : Tg.height - F.height * s).toFixed(1);
    const pillR = parseFloat(getComputedStyle(pill).borderTopLeftRadius) || 16, miniW = (toPill ? F : Tg).width, pillW = (toPill ? Tg : F).width;
    const OPEN = "inset(-30px -30px -30px -30px round 50px)", FULL = "inset(0px 0px 0px 0px round 20px)",
      CUT = `inset(0px 0px ${miniClip}px 0px round ${(pillR * miniW / pillW).toFixed(1)}px)`;
    const fromMove = [{ transform: "none" }, { transform: `translate(${dx.toFixed(1)}px, ${dy.toFixed(1)}px) scale(${s.toFixed(4)})` }];
    const toMove = [{ transform: `translate(${(-dx).toFixed(1)}px, ${(-dy).toFixed(1)}px) scale(${(1 / s).toFixed(4)})` }, { transform: "none" }];
    const anims = [
      from.animate(fromMove, o),
      from.animate([{ opacity: 1 }, { opacity: 0, offset: 0.4 }, { opacity: 0 }], { duration: T, fill: "both" }),
      to.animate(toMove, o),
      to.animate([{ opacity: 0 }, { opacity: 0, offset: 0.1 }, { opacity: 1, offset: 0.45 }, { opacity: 1 }], { duration: T, fill: "both" }),
      toPill ? mini.animate([{ clipPath: OPEN }, { clipPath: FULL, offset: 0.12 }, { clipPath: CUT }], o)
             : mini.animate([{ clipPath: CUT }, { clipPath: FULL, offset: 0.88 }, { clipPath: OPEN }], o),
    ];
    if (H0 && H0.width) {                                  // the "−" button rides along with the small map and goes first
      hide.hidden = false; float(hide, H0);
      const px = H0.left - F.left, py = H0.top - F.top;
      anims.push(hide.animate([{ transform: "none" }, { transform: `translate(${(dx + (s - 1) * px).toFixed(1)}px, ${(dy + (s - 1) * py).toFixed(1)}px) scale(${s.toFixed(4)})` }], o));
      anims.push(hide.animate([{ opacity: 1 }, { opacity: 0, offset: 0.25 }, { opacity: 0 }], { duration: T, fill: "both" }));
    }
    if (!toPill) hide.style.opacity = "0";                // it comes in once the map has grown
    docks.forEach((b, i) => {
      const d0 = before[i] - b.getBoundingClientRect().top;
      if (Math.abs(d0) > 0.5) anims.push(b.animate([{ transform: `translateY(${d0.toFixed(1)}px)` }, { transform: "translateY(0px)" }], o));
    });
    runMorph(anims, () => {
      from.hidden = true; clean(from); clean(to);
      if (toPill) { hide.hidden = true; clean(hide); }
      else { hide.style.opacity = ""; if (typeof hide.animate === "function") hide.animate([{ opacity: 0 }, { opacity: 1 }], { duration: 160, easing: "ease-out" }); }
    });
    return true;
  }
  const toggle = (on) => setState(on === undefined ? (M.state === "open" ? "mini" : "open") : on ? "open" : "mini");

  /* The place changed (this map, the place list, a "Go there" button): move "you are here". */
  function update(key) {
    M.room = key;
    if (!M.built) return;
    const [en, zh] = key ? nameOf(key) : ["Lakeside Resort", "湖畔渡假村"];
    q("#mmHereEn").textContent = en; q("#mmHereZh").textContent = zh;
    q("#mmMini").setAttribute("aria-label", `Mini map: you are at ${en}. Open the big map.`);
    if (M.state === "open") { focusRoom(key, false); render(); } else renderMini();
  }

  /* Show the building you are in, or the outdoor map around where you are. */
  function focusRoom(key, fresh) {
    const b = key ? buildingOf(key) : null;
    if (b) { M.mode = "plan"; M.building = b; return; }
    M.mode = "outdoor";
    const s = key && M.data.spots[key];
    if (!M.view || fresh) M.view = fitBox(M.data.outdoor.resort);
    if (s && (Math.abs(s[0] - M.view.x) > M.view.w * 0.35 || Math.abs(s[1] - M.view.y) > M.view.h * 0.35)) { M.view.x = s[0]; M.view.y = s[1]; }      // keep where you are well inside the map
    clampView();
  }

  /* ------------------------------------------------------------------ the outdoor view: centre and size in metres */
  const svgSize = () => { const v = q("#mmView"); return [Math.max(1, v.clientWidth), Math.max(1, v.clientHeight)]; };     // not the svg's box: the zoom animation scales it
  function fitBox(b, size) {
    const [W, H] = size || svgSize(), bw = b[2] - b[0], bh = b[3] - b[1], k = Math.max(bw / W, bh / H);
    return { x: (b[0] + b[2]) / 2, y: (b[1] + b[3]) / 2, w: W * k, h: H * k };
  }
  function clampView() {
    const B = M.data.outdoor.box, full = fitBox(B);
    if (M.view.w > full.w) M.view = full;
    const minW = full.w / 14;
    if (M.view.w < minW) { const k = minW / M.view.w; M.view.w *= k; M.view.h *= k; }
    M.view = keepOn(M.view, B);
  }
  // an axis on which the view is bigger than the map keeps the map in the middle; otherwise the view stays on the map
  // (11/21 night, the user: zoomed right out, the map sat at the left with an empty band on the right)
  function keepOn(v, B) {
    const bw = B[2] - B[0], bh = B[3] - B[1];
    return { w: v.w, h: v.h,
      x: v.w >= bw ? (B[0] + B[2]) / 2 : Math.max(B[0] + v.w / 2, Math.min(B[2] - v.w / 2, v.x)),
      y: v.h >= bh ? (B[1] + B[3]) / 2 : Math.max(B[1] + v.h / 2, Math.min(B[3] - v.h / 2, v.y)) };
  }
  const ppm = () => svgSize()[0] / M.view.w;            // pixels per metre in the outdoor view

  /* ------------------------------------------------------------------ drawing */
  const el = (tag, attrs, html) => { const n = document.createElementNS(NS, tag); for (const [k, v] of Object.entries(attrs || {})) if (v != null) n.setAttribute(k, v); if (html) n.innerHTML = html; return n; };
  const pts = (list) => list.map(([x, y]) => P(x, y).join(",")).join(" ");
  const imgs = (g, list) => { for (const im of list || []) { const b = im.box, [x, y] = P(b[0], b[3]); g.appendChild(el("image", { href: IMG + im.src, x, y, width: b[2] - b[0], height: b[3] - b[1], preserveAspectRatio: "none", class: "mm-img" })); } };

  function render() {
    if (M.state !== "open" || !M.data) return;
    const svg = q("#mmSvg"), layer = M.mode === "plan" ? "plan:" + M.building : "outdoor";
    if (M.layer !== layer) {          // the pictures only change when you go in or out; panning just moves the view
      M.layer = layer;
      const g = q("#mmImgs");
      g.innerHTML = "";
      if (M.mode === "plan") { const b = M.data.buildings[M.building]; imgs(g, (b.plan || {}).images); }
      else { const B = M.data.outdoor.box; g.appendChild(el("rect", { class: "mm-void", x: B[0] - 400, y: -B[3] - 400, width: B[2] - B[0] + 800, height: B[3] - B[1] + 800 })); imgs(g, M.data.outdoor.images); }
    }
    const marks = q("#mmMarks");
    marks.innerHTML = "";
    if (M.mode === "plan" && M.building) drawPlan(svg, marks, M.building, svgSize(), false); else drawOutdoor(svg, marks, M.view, svgSize(), false);
    crumbs();
    foot();
    const zin = q('[data-z="in"]'), zout = q('[data-z="out"]');
    zin.disabled = M.mode === "plan";
    zout.disabled = M.mode === "outdoor" && M.view && M.view.w >= fitBox(M.data.outdoor.box).w - 0.5;
  }

  /* the small map in the corner: the building you are in, or 150 m of the outdoor map around you */
  function renderMini() {
    const svg = q("#mmMiniSvg");
    if (!svg || M.state !== "mini" || !M.data) return;
    svg.innerHTML = "";
    const size = [Math.max(1, svg.clientWidth || 248), Math.max(1, svg.clientHeight || 148)];
    const key = M.room, b = key ? buildingOf(key) : null;
    const g = el("g"), marks = el("g");
    svg.appendChild(g); svg.appendChild(marks);
    const lift = 0.13;       // "you" a little above the middle, clear of the name along the bottom
    if (b) {
      const plan = M.data.buildings[b].plan || {}, box = plan.box, s = spotOf(key, b), pw = box[2] - box[0], ph = box[3] - box[1];
      let w = Math.max(Math.min(pw, 26), pw * 0.7), h = (w * size[1]) / size[0];
      if (h > ph) { h = ph; w = (h * size[0]) / size[1]; }
      const x = w >= pw ? (box[0] + box[2]) / 2 : Math.max(box[0] + w / 2, Math.min(box[2] - w / 2, s[0]));
      const y = h >= ph ? (box[1] + box[3]) / 2 : Math.max(box[1] + h / 2, Math.min(box[3] - h / 2, s[1] - h * lift));
      g.appendChild(el("rect", { class: "mm-void", x: box[0] - 200, y: -box[3] - 200, width: pw + 400, height: ph + 400 }));
      imgs(g, plan.images);
      drawPlan(svg, marks, b, size, true, { x, y, w, h });
      return;
    }
    const s = (key && M.data.spots[key]) || [25, 30], w = key === "sky" || key === "flight_home" ? 320 : 150, h = (w * size[1]) / size[0];
    const B = M.data.outdoor.box;
    g.appendChild(el("rect", { class: "mm-void", x: B[0] - 400, y: -B[3] - 400, width: B[2] - B[0] + 800, height: B[3] - B[1] + 800 }));
    imgs(g, M.data.outdoor.images);
    drawOutdoor(svg, marks, keepOn({ x: s[0], y: s[1] - h * lift, w, h }, B), size, true);
  }

  function drawOutdoor(svg, g, v, size, mini) {
    const O = M.data.outdoor, k = size[0] / v.w, px = (n) => n / k;
    const [vx, vy] = P(v.x - v.w / 2, v.y + v.h / 2);
    svg.setAttribute("viewBox", `${vx} ${vy} ${v.w} ${v.h}`);
    svg.setAttribute("preserveAspectRatio", "xMidYMid slice");
    const here = M.room, hereB = here ? buildingOf(here) : null, zoomedIn = k > 2.4;
    if (!mini && k < 3) for (const l of O.labels || []) { const [x, y] = P(l.x, l.y); g.appendChild(el("text", { class: "mm-area", x, y, "font-size": px(12.5), "text-anchor": "middle" }, `${e(l.en)}<tspan x="${x}" dy="${px(14)}" class="mm-area-zh">${e(l.zh)}</tspan>`)); }
    // buildings: a small house you can open, named when you are close enough to read it
    for (const [bk, b] of Object.entries(M.data.buildings)) {
      const c = centreOf(b), [cx, cy] = P(c[0], c[1]), isHere = bk === hereB;
      if (mini && !isHere) continue;
      const grp = el("g", { class: `mm-bld${isHere ? " is-here" : ""}`, "data-b": mini ? null : bk, tabindex: mini ? null : 0, role: mini ? null : "button", "aria-label": mini ? null : `${b.en} ${b.zh}: open the floor plan` });
      if (!mini) grp.appendChild(el("circle", { class: "mm-bld-hit", cx, cy, r: Math.max(px(14), sizeOf(b) / 2) }));
      if (isHere) grp.appendChild(el("circle", { class: "mm-here-ring", cx, cy, r: Math.max(px(13), sizeOf(b) / 2 + px(4)) }));
      if (!mini) {
        const s = px(1.6);
        grp.appendChild(el("rect", { class: "mm-bld-badge", x: cx - px(10), y: cy - px(10), width: px(20), height: px(20), rx: px(5) }));
        grp.appendChild(el("path", { class: "mm-bld-icon", d: ICON_HOUSE, transform: `translate(${cx} ${cy}) scale(${s})` }));
        if (zoomedIn || isHere) label(grp, cx, cy - px(14), b.en, px, "mm-bld-t", "middle", b.zh);
      } else grp.appendChild(el("circle", { class: "mm-dot is-here-dot", cx, cy, r: px(5.5), "stroke-width": px(2) }));
      g.appendChild(grp);
    }
    // outdoor places
    for (const key of outdoorKeys()) {
      const s = M.data.spots[key], r = room(key), [x, y] = P(s[0], s[1]), isHere = key === here, close = r.kind === "closeup";
      if (mini && !isHere && (Math.abs(s[0] - v.x) > v.w / 2 || Math.abs(s[1] - v.y) > v.h / 2)) continue;
      const air = key === "sky" || key === "flight_home";
      const grp = el("g", { class: `mm-spot${close ? " is-close" : ""}${air ? " is-air" : ""}${isHere ? " is-here" : ""}`, "data-go": mini ? null : key, tabindex: mini ? null : 0, role: mini ? null : "button", "aria-label": mini ? null : `${nameOf(key).join(" ")}${isHere ? ", you are here" : ""}: go there` });
      if (isHere) grp.appendChild(el("circle", { class: "mm-here-ring", cx: x, cy: y, r: px(12) }));
      if (!mini) grp.appendChild(el("circle", { class: "mm-hit", cx: x, cy: y, r: px(11) }));
      if (air) grp.appendChild(el("path", { class: "mm-balloon", d: balloon(x, y, px(7)), "stroke-width": px(1.4) }));
      else { grp.appendChild(el("circle", { class: "mm-halo", cx: x, cy: y, r: px(close ? 5.2 : 7.4) })); grp.appendChild(el("circle", { class: "mm-dot", cx: x, cy: y, r: px(close ? 3.6 : 5.4), "stroke-width": px(1.8) })); }
      if (!mini && (isHere || (zoomedIn && !close))) label(grp, x + px(9), y + px(4), shortOf(key), px, "mm-spot-t", "start", shortZh(key));
      g.appendChild(grp);
    }
  }

  function drawPlan(svg, g, bk, size, mini, view) {     // view: centre and size in metres (the small map); none = the whole plan
    const b = M.data.buildings[bk], plan = b.plan || {}, box = plan.box || b.foot;
    const [W, H] = size;
    let k;
    if (view) {
      const [vx, vy] = P(view.x - view.w / 2, view.y + view.h / 2);
      svg.setAttribute("viewBox", `${vx} ${vy} ${view.w} ${view.h}`);
      svg.setAttribute("preserveAspectRatio", "xMidYMid slice");
      k = W / view.w;
    } else {
      const [x0, y0] = P(box[0], box[3]);
      svg.setAttribute("viewBox", `${x0} ${y0} ${box[2] - box[0]} ${box[3] - box[1]}`);
      svg.setAttribute("preserveAspectRatio", "xMidYMid meet");
      k = Math.min(W / (box[2] - box[0]), H / (box[3] - box[1]));
    }
    const px = (n) => n / k;
    if (!mini) {
      if ((plan.rooms || []).length > 1) for (const r of plan.rooms) {     // the rooms' names in their top left corners, clear of the places in them
        const [lx, ly] = P(r.box[0], r.box[3]);
        tag(g, lx + px(5), ly + px(5), r.en, r.zh, px, r.restricted ? " is-restricted" : "");
      }
      for (const c of plan.circles || []) { const [cx, cy] = P(c.x, c.y); tag(g, cx - px(52), cy - c.r - px(2), c.en, c.zh, px, ""); }
    }
    for (const key of b.rooms) {
      const s = spotOf(key, bk), r = room(key);
      if (!s || !r) continue;
      const [x, y] = P(s[0], s[1]), isHere = key === M.room, close = r.kind === "closeup";
      if (mini && !isHere && close) continue;
      const grp = el("g", { class: `mm-spot${close ? " is-close" : ""}${isHere ? " is-here" : ""}${r.kind === "bad" ? " is-bad" : ""}`, "data-go": mini ? null : key, tabindex: mini ? null : 0, role: mini ? null : "button", "aria-label": mini ? null : `${nameOf(key).join(" ")}${isHere ? ", you are here" : ""}: go there` });
      if (isHere) grp.appendChild(el("circle", { class: "mm-here-ring", cx: x, cy: y, r: px(12) }));
      if (!mini) grp.appendChild(el("circle", { class: "mm-hit", cx: x, cy: y, r: px(10) }));
      grp.appendChild(el("circle", { class: "mm-halo", cx: x, cy: y, r: px(close ? 5.2 : 7.6) }));
      grp.appendChild(el("circle", { class: "mm-dot", cx: x, cy: y, r: px(close ? 3.6 : 5.6), "stroke-width": px(1.8) }));
      if (!mini && b.rooms.length <= 6 && !isHere) label(grp, x + px(9), y + px(4), nameOf(key)[0].includes(" · ") ? nameOf(key)[0].split(" · ").pop() : nameOf(key)[0], px, "mm-spot-t", "start", tailZh(key));
      if (isHere && !mini) {
        const w = px(96), h = px(17), lx = x - w / 2, ly = y - px(14) - h;
        grp.appendChild(el("rect", { class: "mm-here-flag", x: lx, y: ly, width: w, height: h, rx: px(4) }));
        grp.appendChild(el("text", { class: "mm-here-flag-t", x, y: ly + h - px(5), "font-size": px(10), "text-anchor": "middle" }, "You are here <tspan class=\"mm-here-flag-zh\">你在這裡</tspan>"));
      }
      g.appendChild(grp);
    }
  }

  // a name with a soft dark halo so it reads on any part of the picture
  function label(g, x, y, text, px, cls, anchor, zh) {
    g.appendChild(el("text", { class: cls, x, y, "font-size": px(11), "text-anchor": anchor || "middle", "stroke-width": px(3.2) },
      e(text) + (zh && zh !== text ? ` <tspan class="mm-room-zh">${e(zh)}</tspan>` : "")));
  }
  // a room's name: a dark tab with the English and the Chinese
  function tag(g, x, y, en, zh, px, cls) {
    const t = el("text", { class: "mm-room-t", x: x + px(5), y: y + px(12), "font-size": px(10) }, `${e(en)} <tspan class="mm-room-zh">${e(zh)}</tspan>`);
    const back = el("rect", { class: `mm-room-tab${cls}`, x, y, height: px(17), rx: px(4), width: px(10) });
    g.appendChild(back); g.appendChild(t);
    try { back.setAttribute("width", t.getComputedTextLength() + px(10)); } catch { back.setAttribute("width", px(8 * (en.length + zh.length))); }
  }

  const centreOf = (b) => (b.foot ? [(b.foot[0] + b.foot[2]) / 2, (b.foot[1] + b.foot[3]) / 2] : b.circle ? [b.circle[0], b.circle[1]] : [b.hull.x, b.hull.y]);
  const sizeOf = (b) => (b.foot ? Math.max(b.foot[2] - b.foot[0], b.foot[3] - b.foot[1]) : b.circle ? b.circle[2] * 2 : b.hull.len);
  const balloon = (x, y, r) => `M${x} ${y - r * 1.9} a${r} ${r} 0 1 1 0.01 0 Z M${x - r * 0.45} ${y - r * 0.2} L${x - r * 0.3} ${y + r * 0.5} H${x + r * 0.3} L${x + r * 0.45} ${y - r * 0.2} Z`;

  function crumbs() {
    const c = q("#mmCrumbs"), O = M.data.outdoor;
    const top = `<button type="button" data-crumb="out"${M.mode === "outdoor" ? ' aria-current="true"' : ""}>${e(O.en)} <span lang="zh-Hant">${e(O.zh)}</span></button>`;
    if (M.mode !== "plan") { c.innerHTML = top; }
    else { const b = M.data.buildings[M.building]; c.innerHTML = `${top}<span class="mm-sep" aria-hidden="true">›</span><span class="mm-crumb-b" aria-current="true">${e(b.en)} <span lang="zh-Hant">${e(b.zh)}</span></span>`; }
    const o = q('[data-crumb="out"]', c);
    if (o) o.addEventListener("click", () => { if (M.mode === "plan") zoomOut(); });
  }

  function foot() {
    const f = q("#mmFoot");
    if (M.mode === "plan") {
      const b = M.data.buildings[M.building];
      f.innerHTML = `<span><i class="mm-key"></i>place <span lang="zh-Hant">地點</span></span><span><i class="mm-key is-close"></i>close-up <span lang="zh-Hant">近看</span></span><span><i class="mm-key is-here"></i>you <span lang="zh-Hant">你</span></span><span class="mm-foot-hint">${b.rooms.length} scenes inside · zoom out for outdoors <span lang="zh-Hant">室內 ${b.rooms.length} 個場景，縮小看室外</span></span>`;
    } else f.innerHTML = `<span><i class="mm-key"></i>place <span lang="zh-Hant">地點</span></span><span><i class="mm-key is-bld"></i>building, click to go in <span lang="zh-Hant">建築，點了進去</span></span><span><i class="mm-key is-here"></i>you <span lang="zh-Hant">你</span></span>`;
  }

  /* ------------------------------------------------------------------ zoom, pan, click */
  function zoomBtn(z) {
    if (M.mode === "plan") { if (z === "out") zoomOut(); return; }
    zoomAt(z === "in" ? 1 / 1.6 : 1.6, null);
  }
  function zoomAt(f, at) {      // f < 1 zooms in; at = [x, y] in metres to keep still under the pointer
    const v = M.view, nx = at ? at[0] + (v.x - at[0]) * f : v.x, ny = at ? at[1] + (v.y - at[1]) * f : v.y;
    M.view = { x: nx, y: ny, w: v.w * f, h: v.h * f };
    clampView();
    render();
  }
  function zoomOut() {      // from a floor plan to the outdoor map, around that building
    const b = M.data.buildings[M.building], c = centreOf(b), R = fitBox(M.data.outdoor.resort);
    M.mode = "outdoor";
    M.view = { x: c[0], y: c[1], w: R.w * 0.6, h: R.h * 0.6 };
    clampView();
    animate("is-out");
    render();
  }
  function enter(bk) {
    M.mode = "plan"; M.building = bk;
    animate("is-in");
    render();
  }
  function animate(cls) {
    const v = q("#mmView");
    v.classList.remove("is-in", "is-out"); void v.offsetWidth; v.classList.add(cls);
  }
  const toMetres = (ev) => { const svg = q("#mmSvg"), p = svg.createSVGPoint(); p.x = ev.clientX; p.y = ev.clientY; const m = p.matrixTransform(svg.getScreenCTM().inverse()); return [m.x, -m.y]; };

  function onWheel(ev) {
    ev.preventDefault();
    if (M.mode === "plan") { if (ev.deltaY > 0) zoomOut(); return; }
    const t = ev.target.closest("[data-b]");
    if (ev.deltaY < 0 && t && ppm() > 4) return enter(t.dataset.b);       // zoomed right in on a building: go inside
    zoomAt(ev.deltaY > 0 ? 1.25 : 0.8, toMetres(ev));
  }
  function onDown(ev) {
    if (M.mode !== "outdoor" || ev.button !== 0) return;
    M.drag = { x: ev.clientX, y: ev.clientY, vx: M.view.x, vy: M.view.y, moved: false, id: ev.pointerId };
  }
  function onMove(ev) {
    const t = ev.target.closest("[data-go],[data-b]");
    tip(t, ev);
    const d = M.drag;
    if (!d) return;
    const dx = ev.clientX - d.x, dy = ev.clientY - d.y;
    if (!d.moved && Math.hypot(dx, dy) > 4) { d.moved = true; try { q("#mmSvg").setPointerCapture(d.id); } catch { /* fine */ } q("#mmView").classList.add("is-panning"); }
    if (!d.moved) return;
    const k = ppm();
    M.view.x = d.vx - dx / k; M.view.y = d.vy + dy / k;
    clampView();
    render();
  }
  function onUp() {
    const d = M.drag;
    M.drag = null;
    q("#mmView").classList.remove("is-panning");
    if (d && d.moved) M.justPanned = performance.now();
  }
  function onClick(ev) {
    if (M.justPanned && performance.now() - M.justPanned < 120) return;
    const t = ev.target.closest("[data-go],[data-b]");
    if (t) activate(t);
  }
  function activate(t) {
    if (t.dataset.b) return enter(t.dataset.b);
    const key = t.dataset.go;
    if (key && typeof goTo === "function") goTo(key, { jump: true });       // inside iStaging: take the whole tour there
  }

  function tip(t, ev) {
    const box = q("#mmTip");
    if (!box) return;
    if (!t) { box.hidden = true; M.hover = null; return; }
    const id = t.dataset.go || t.dataset.b;
    if (M.hover !== id) {
      M.hover = id;
      if (t.dataset.go) {
        const [en, zh] = nameOf(id), r = room(id);
        box.innerHTML = `<b>${e(en)}</b><span lang="zh-Hant">${e(zh)}</span>${id === M.room ? `<em>You are here <span lang="zh-Hant">你在這裡</span></em>` : r && r.kind === "closeup" ? `<em>Close-up · click to go <span lang="zh-Hant">近看，點了過去</span></em>` : `<em>Click to go <span lang="zh-Hant">點了過去</span></em>`}`;
      } else {
        const b = M.data.buildings[id];
        box.innerHTML = `<b>${e(b.en)}</b><span lang="zh-Hant">${e(b.zh)}</span><em>${b.rooms.length} scene${b.rooms.length > 1 ? "s" : ""} inside · click to go in <span lang="zh-Hant">裡面 ${b.rooms.length} 個場景，點了進去</span></em>`;
      }
    }
    box.hidden = false;
    const v = q("#mmView").getBoundingClientRect(), r = t.getBoundingClientRect();
    const x = (ev ? ev.clientX : r.left + r.width / 2) - v.left, y = r.top - v.top;
    box.style.left = `${Math.max(6, Math.min(v.width - box.offsetWidth - 6, x - box.offsetWidth / 2))}px`;
    box.style.top = `${Math.max(6, y - box.offsetHeight - 8)}px`;
  }

  document.addEventListener("DOMContentLoaded", init);
  // the Map tab was hidden while the page loaded: measure again and show where you are
  const refresh = () => { if (!M.built) return; M.layer = ""; focusRoom(M.room, true); render(); };
  return { update, toggle, setState, refresh, state: () => M.state };
})();
