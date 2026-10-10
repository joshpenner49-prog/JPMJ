/* ============================================================
   Race-week entrance animation. Call initRaceWeekEntrance() from
   an inline script on whichever page should play it (currently
   just the homepage). Plays once per browser session; skips
   entirely for prefers-reduced-motion. Pure presentation layer —
   never blocks or delays the actual page content underneath.
   ============================================================ */
function initRaceWeekEntrance() {
  var reduce = window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  var alreadyShown = sessionStorage.getItem("rwEntranceShown") === "1";
  if (reduce || alreadyShown) return;

  var overlay = document.createElement("div");
  overlay.className = "rw-entrance";
  overlay.setAttribute("aria-hidden", "true");
  ["a", "b", "c"].forEach(function (variant) {
    var streak = document.createElement("div");
    streak.className = "rw-streak " + variant;
    overlay.appendChild(streak);
  });
  document.body.appendChild(overlay);

  sessionStorage.setItem("rwEntranceShown", "1");

  requestAnimationFrame(function () {
    overlay.classList.add("rw-fade");
  });

  setTimeout(function () {
    overlay.remove();
  }, 1050);
}

/* Called by logo3d.js the instant its real 3D arrival tween finishes —
   a small soft flash right where the badge locks into place, like a
   shutter click / ignition moment punctuating the reveal. */
window.rwTriggerPulse = function () {
  var stage = document.getElementById("logo3d-stage");
  if (!stage) return;
  var pulse = document.createElement("div");
  pulse.className = "rw-pulse";
  pulse.setAttribute("aria-hidden", "true");
  stage.appendChild(pulse);
  requestAnimationFrame(function () {
    pulse.classList.add("rw-pulse-go");
  });
  setTimeout(function () {
    pulse.remove();
  }, 700);
};
