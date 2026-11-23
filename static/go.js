/* /go?room=<room>: where the "Ask the IT Assistant" buttons in the iStaging tours led on 11/21 night (from 11/22 they open
   iStaging's own window again). /go?full=1 is the balloon's "Full version" button (11/22): from iStaging it opens our full
   page with the map and the assistant; pressed inside our full page it only says so, without a second page.
   The buttons open a new tab (iStaging's "window" action) instead of iStaging's own pop-up, which stacked a second
   assistant over the tour when the tour was inside our full-screen page. This tab asks the page that opened it:
   - if the tour is inside our full-screen page, that page answers, opens its own floating assistant at this room, and
     this tab closes itself straight away (the visitor only sees it flash);
   - if nothing answers (the iStaging tour was opened directly), this tab becomes our full-screen page at that room,
     with the floating assistant open. */
"use strict";
(() => {
  const params = new URLSearchParams(location.search);
  const room = params.get("room") || (params.has("full") ? "sky" : "");
  const full = "/lakeside/?room=" + encodeURIComponent(room);
  const type = params.has("full") ? "lakeside:full" : "lakeside:open";
  let opener = null;
  try { opener = window.opener; } catch { opener = null; }
  if (!opener) { location.replace(full); return; }
  let settled = false;
  // 11/23 (review): only our own full page may answer (this address, the fixed one, the laptop itself; the GitHub copy is
  // this address when this tab is the GitHub copy too)
  const OURS = [location.origin, "https://lakeside.taila701b6.ts.net", "http://127.0.0.1:8780", "http://localhost:8780", "http://localhost:3000", "http://127.0.0.1:3000"];
  const onAck = (e) => {
    if (settled || !e.data || e.data.type !== "lakeside:ack" || !OURS.includes(e.origin)) return;
    settled = true;
    window.removeEventListener("message", onAck);
    try { opener.top.focus(); } catch { /* the browser decides */ }
    window.close();
    setTimeout(() => {               // still here: the browser would not close this tab
      document.getElementById("wait").hidden = true;
      document.getElementById("done").hidden = false;
    }, 500);
  };
  window.addEventListener("message", onAck);
  try { opener.top.postMessage({ type, room, tab: "chat" }, "*"); } catch { /* opener went away */ }
  setTimeout(() => {
    if (settled) return;
    settled = true;
    window.removeEventListener("message", onAck);
    location.replace(full);
  }, 900);
})();
