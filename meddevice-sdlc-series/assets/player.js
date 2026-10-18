// The cover image sits over the video before it plays, whenever it's paused, and at the end. Click it to play.
document.querySelectorAll(".player").forEach(function (p) {
  var v = p.querySelector("video"), cover = p.querySelector(".cover"), pl = p.querySelector(".pl"), t = 0;
  function show(word) { if (pl) pl.textContent = word; p.classList.remove("playing"); cover.tabIndex = 0; }
  function hide() { p.classList.add("playing"); cover.tabIndex = -1; }
  cover.addEventListener("click", function () { hide(); v.play(); });
  v.addEventListener("play", function () { clearTimeout(t); hide(); });
  // a short wait, so dragging the time bar (which pauses for a moment) doesn't flash the cover
  v.addEventListener("pause", function () { clearTimeout(t); t = setTimeout(function () { if (v.paused && !v.seeking) show("Resume"); }, 350); });
  v.addEventListener("ended", function () { show("Watch again"); });
  // a link ending in #play (from the episode list, the README or the home page) starts the video right away;
  // if the browser blocks playing with sound, the cover stays and one click plays it
  if (location.hash === "#play") {
    p.scrollIntoView({ block: "center" });
    hide();
    v.play().catch(function () { show("Play"); });
  }
});

// a link to a folded box (#transcript, #sources) opens it
function openFold() { var d = location.hash && document.querySelector("details" + location.hash); if (d) d.open = true; }
window.addEventListener("hashchange", openFold); openFold();
document.querySelectorAll('a[href^="#"]').forEach(function (a) { a.addEventListener("click", function () { setTimeout(openFold, 0); }); });
