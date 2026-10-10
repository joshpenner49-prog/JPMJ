/* ============================================================
   Precision Mark — the JP insignia, in CSS 3D + SVG.
   No library, no canvas, no animation loop: a stack of <svg>
   layers inside a preserve-3d box, each pushed back with
   translateZ to read as an extruded, polished plate.

   Mount anywhere with:
     <span data-insignia data-size="64" data-theme="light"></span>
   Optional:
     data-variant="letters"  JP letters on the plate only (for < 40px)
     data-decorative         hide from assistive tech (e.g. inside a
                             link that already names the site)

   Anything inside the mount (e.g. a flat <img> fallback for no-JS)
   is replaced when the 3D version builds.

   Motion: a single reveal ease from a steeper pose into rest the
   first time it enters the viewport (with a timed fallback so it
   never waits forever), then pointer tilt for mouse/pen only.
   prefers-reduced-motion: renders at rest, no reveal, no tilt.
   Never starts hidden: the pre-reveal pose is fully visible.

   Path data, gradient stops and layer maths are ported from the
   approved reference (reference/Insignia.dc.html).
   ============================================================ */
(function () {
  "use strict";

  var reduce = false;
  try { reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches; } catch (e) { /* old browser */ }

  var EASE = "cubic-bezier(.2,.7,.2,1)";
  var uidCount = 0;

  var PLATE = "M16 4 H84 L96 16 V84 L84 96 H16 L4 84 V16 Z";
  var RECESS = "M17.5 8.5 H82.5 L91.5 17.5 V82.5 L82.5 91.5 H17.5 L8.5 82.5 V17.5 Z";
  var LETTER_J = "M41 30 H50 V61 Q50 73 39.5 73 Q29 73 29 62 V59 H37.5 V61 Q37.5 64.5 39.5 64.5 Q41 64.5 41 61 Z";
  var LETTER_P = "M53 30 H66 Q76.5 30 76.5 41.5 Q76.5 53 66 53 H62 V73 H53 Z";
  var P_COUNTER = "M62 37.5 H65 Q68.5 37.5 68.5 41.5 Q68.5 45.5 65 45.5 H62 Z";

  function stops(list) {
    return list.map(function (s) { return '<stop offset="' + s[0] + '" stop-color="' + s[1] + '"/>'; }).join("");
  }

  function layerSvg(z, inner) {
    return '<svg viewBox="0 0 100 100" aria-hidden="true" focusable="false" style="transform:translateZ(' + z + 'px)">' + inner + "</svg>";
  }

  function buildInsignia(el) {
    if (el.getAttribute("data-pm-ready") === "1") return;
    el.setAttribute("data-pm-ready", "1");

    var size = parseFloat(el.getAttribute("data-size")) || 64;
    var dark = el.getAttribute("data-theme") === "dark";
    var lettersOnly = el.getAttribute("data-variant") === "letters";
    var uid = "pm-ins-" + (++uidCount);

    var small = size < 90;
    var depth = Math.max(3, size / 16);
    var n = size < 70 ? 5 : 9;
    var wallStep = Math.max(0.5, size / 120);
    var amp = small ? 0.5 : 1;
    var restX = small ? 3 : 7;
    var restY = small ? -5 : -13;

    var g = { m: uid + "-m", b: uid + "-b", r: uid + "-r", l: uid + "-l", e: uid + "-e" };

    // back layers: the plate's extrusion side walls, dark-to-mid grey ramp
    var html = "";
    for (var i = n; i >= 1; i--) {
      var t = i / n;
      var c = Math.round(150 - t * 82);
      html += layerSvg((-depth * t).toFixed(2), '<path d="' + PLATE + '" fill="rgb(' + c + "," + (c + 2) + "," + (c + 5) + ')"/>');
    }

    // polished plate face, recess, wing and speed lines
    var face =
      "<defs>" +
        '<linearGradient id="' + g.m + '" x1="0" y1="0" x2="1" y2="1" gradientTransform="rotate(118 .5 .5)">' +
          stops([[0, "#F3F3F1"], [0.26, "#CDCFD1"], [0.46, "#8F9296"], [0.6, "#DCDDDE"], [0.82, "#A3A6AA"], [1, "#E9EAEA"]]) +
        "</linearGradient>" +
        '<linearGradient id="' + g.b + '" x1="0" y1="0" x2="0" y2="1">' +
          stops([[0, "#FFFFFF"], [0.5, "#B9BBBE"], [1, "#55575B"]]) +
        "</linearGradient>" +
        '<linearGradient id="' + g.r + '" x1="0" y1="0" x2="0" y2="1">' +
          stops([[0, "#121315"], [0.35, "#1F2023"], [1, "#2B2C30"]]) +
        "</linearGradient>" +
        '<linearGradient id="' + g.l + '" x1="0" y1="0" x2="1" y2="1" gradientTransform="rotate(132 .5 .5)">' +
          stops([[0, "#FAFAF8"], [0.3, "#C4C6C9"], [0.5, "#85888C"], [0.66, "#E4E5E6"], [1, "#9EA1A5"]]) +
        "</linearGradient>" +
        '<linearGradient id="' + g.e + '" x1="0" y1="0" x2="0" y2="1">' +
          stops([[0, "#DA3C52"], [1, "#A51E30"]]) +
        "</linearGradient>" +
      "</defs>" +
      '<path d="' + PLATE + '" fill="url(#' + g.m + ')" stroke="url(#' + g.b + ')" stroke-width="0.8" stroke-linejoin="round"/>' +
      '<path d="' + RECESS + '" fill="url(#' + g.r + ')" stroke="#0C0D0E" stroke-width="0.6" stroke-linejoin="round"/>' +
      '<path d="M18 91.5 H82" stroke="#FFFFFF" stroke-width="0.45" stroke-opacity="0.4"/>';

    if (!lettersOnly) {
      face +=
        // left wing: engraved swoosh + speed line, red enamel chequer (the insignia's only red)
        '<path d="M11.5 49 Q20 33 42 27.2 Q22.5 34.2 11.5 49 Z" fill="url(#' + g.l + ')"/>' +
        '<path d="M10.5 52.6 L27 50.6 L10.5 53.8 Z" fill="url(#' + g.l + ')"/>' +
        '<path d="M24.8 36.4 H30.3 L28 41.2 H22.5 Z" fill="url(#' + g.e + ')"/>' +
        '<path d="M35.8 36.4 H40.4 L38.1 41.2 H33.5 Z" fill="url(#' + g.e + ')"/>' +
        '<path d="M19.6 41.2 H25.7 L23.4 46 H17.3 Z" fill="url(#' + g.e + ')"/>' +
        '<path d="M30.6 41.2 H36.1 L33.8 46 H28.3 Z" fill="url(#' + g.e + ')"/>' +
        // right: three tapered speed lines leaving the top of the P
        '<path d="M70 30.4 L89.5 28.2 L70.4 32.4 Z" fill="url(#' + g.l + ')"/>' +
        '<path d="M74 35.3 L87.2 34.1 L74.4 37 Z" fill="url(#' + g.l + ')"/>' +
        '<path d="M75.6 40.1 L84.6 39.5 L75.8 41.6 Z" fill="url(#' + g.l + ')"/>';
    }
    html += layerSvg(0, face);

    // letter side walls, raised above the plate
    for (var k = 1; k <= 3; k++) {
      var wc = 70 + k * 14;
      var wf = "rgb(" + wc + "," + (wc + 2) + "," + (wc + 5) + ")";
      html += layerSvg((wallStep * k).toFixed(2),
        '<path d="' + LETTER_J + '" fill="' + wf + '"/>' +
        '<path d="' + LETTER_P + '" fill="' + wf + '"/>' +
        '<path d="' + P_COUNTER + '" fill="#1E1F22"/>');
    }

    // silver letter faces
    html += layerSvg((wallStep * 4).toFixed(2),
      '<path d="' + LETTER_J + '" fill="url(#' + g.l + ')" stroke="#FFFFFF" stroke-width="0.35" stroke-opacity="0.55" stroke-linejoin="round"/>' +
      '<path d="' + LETTER_P + '" fill="url(#' + g.l + ')" stroke="#FFFFFF" stroke-width="0.35" stroke-opacity="0.55" stroke-linejoin="round"/>' +
      '<path d="' + P_COUNTER + '" fill="#1E1F22" stroke="#0C0D0E" stroke-width="0.4"/>');

    el.classList.add("pm-insignia");
    el.style.width = size + "px";
    el.style.perspective = Math.round(size * 5) + "px";
    if (el.hasAttribute("data-decorative")) {
      el.setAttribute("aria-hidden", "true");
    } else {
      el.setAttribute("role", "img");
      el.setAttribute("aria-label", el.getAttribute("aria-label") || "JP Motorsport Journal insignia");
    }

    el.innerHTML =
      '<span class="pm-shadow" aria-hidden="true" style="background:' + (dark ? "rgba(0,0,0,0.7)" : "rgba(25,26,28,0.32)") +
        ";filter:blur(" + Math.max(3, size / 14).toFixed(1) + 'px)"></span>' +
      '<span class="pm-stack">' + html + "</span>";

    var stack = el.querySelector(".pm-stack");
    var shadow = el.querySelector(".pm-shadow");
    var gradM = el.querySelector("#" + g.m);
    var gradL = el.querySelector("#" + g.l);

    var state = { rx: 0, ry: 0, revealed: reduce, settled: reduce };

    function apply() {
      var rx = restX + state.rx * amp;
      var ry = restY + state.ry * amp;
      stack.style.transform = state.revealed
        ? "rotateX(" + rx.toFixed(2) + "deg) rotateY(" + ry.toFixed(2) + "deg)"
        : "rotateX(22deg) rotateY(-32deg) translateY(" + (size * 0.04).toFixed(1) + "px) scale(0.95)";
      // reflections follow the tilt
      gradM.setAttribute("gradientTransform", "rotate(" + (118 + state.ry * 2.6 - state.rx * 1.6).toFixed(1) + " .5 .5)");
      gradL.setAttribute("gradientTransform", "rotate(" + (132 + state.ry * 3.2 - state.rx * 2).toFixed(1) + " .5 .5)");
      shadow.style.transform = "translateX(" + (-state.ry * size / 220).toFixed(1) + "px)";
    }

    if (reduce) {
      apply();
      return;
    }

    stack.style.transition = "transform 1.4s " + EASE;
    shadow.style.transition = "transform .5s ease";
    apply();

    var io = null;
    function reveal() {
      if (state.revealed) return;
      state.revealed = true;
      if (io) io.disconnect();
      // force the pre-reveal pose to paint before easing to rest
      requestAnimationFrame(function () {
        requestAnimationFrame(function () {
          apply();
          setTimeout(function () {
            state.settled = true;
            stack.style.transition = "transform .5s " + EASE;
          }, 1500);
        });
      });
    }

    try {
      if ("IntersectionObserver" in window) {
        io = new IntersectionObserver(function (entries) {
          if (entries[0] && entries[0].isIntersecting) reveal();
        }, { threshold: 0.1 });
        io.observe(el);
      } else {
        reveal();
      }
    } catch (e) {
      reveal();
    }
    // never rely on the observer alone
    setTimeout(reveal, 1200);

    var pending = null;
    var raf = 0;
    el.addEventListener("pointermove", function (e) {
      if (!state.settled || e.pointerType === "touch") return;
      var r = el.getBoundingClientRect();
      var nx = Math.max(-0.5, Math.min(0.5, (e.clientX - r.left) / r.width - 0.5));
      var ny = Math.max(-0.5, Math.min(0.5, (e.clientY - r.top) / r.height - 0.5));
      pending = { ry: nx * 16, rx: -ny * 12 };
      if (!raf) {
        raf = requestAnimationFrame(function () {
          raf = 0;
          if (!pending) return;
          state.rx = pending.rx;
          state.ry = pending.ry;
          apply();
        });
      }
    });
    el.addEventListener("pointerleave", function () {
      pending = null;
      if (state.rx === 0 && state.ry === 0) return;
      state.rx = 0;
      state.ry = 0;
      apply();
    });
  }

  function init() {
    var mounts = document.querySelectorAll("[data-insignia]");
    for (var i = 0; i < mounts.length; i++) buildInsignia(mounts[i]);
  }

  window.PrecisionMark = { insignia: buildInsignia, init: init };

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", init);
  else init();
})();
