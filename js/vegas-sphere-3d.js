/* ============================================================
   VEGAS SPHERE, 3D (Las Vegas race week only)
   A WebGL globe drawn over the CSS Sphere on the homepage. The CSS
   Sphere (script.js) still decides which screen is showing, including
   the race-weekend screens; this module only paints that screen onto a
   rotating, lit sphere with an LED dot texture and a neon halo.
   Loaded by script.js only in Vegas week, only with WebGL and only for
   visitors who allow motion. If anything fails, the CSS Sphere stays.
   three.js is vendored in js/vendor (MIT, licenses/three-LICENSE).
   ============================================================ */
import * as THREE from "./vendor/three.module.min.js";

const SCREEN_COLOURS = {
  chip:   ["#3A1C78", "#1A0B3D", "#07051A"],
  count:  ["#FF4FAE", "#B1176E", "#3A0730"],
  bill:   ["#FFC93C", "#E06A12", "#4A1405"],
  odds:   ["#3DE8F5", "#1478A8", "#061C3A"],
  live:   ["#FF3B3B", "#B3121E", "#3A0408"],
  pole:   ["#B07CFF", "#5B22B8", "#1A0640"],
  winner: ["#FFD86A", "#B07A10", "#3A2402"],
  flag:   ["#F4F4F4", "#151515", "#151515"],
};

/* ---------- reading the active CSS screen ---------- */
function readScreen(button) {
  const el = button.querySelector(".vg-screen.is-on");
  if (!el) return { type: "chip", lines: [] };
  const type = (el.className.match(/vg-screen--(\w+)/) || [])[1] || "chip";
  const smalls = [...el.querySelectorAll(".vg-small")].map((s) => s.textContent.trim());
  const bigEl = el.querySelector(".vg-big");
  const big = bigEl ? bigEl.innerHTML.split(/<br\s*\/?>/i).map((t) => t.replace(/<[^>]+>/g, "").trim()).filter(Boolean) : [];
  return { type, top: smalls[0] || "", big, bottom: smalls.length > 1 ? smalls[smalls.length - 1] : "" };
}

/* ---------- painting the equirectangular texture ---------- */
function setSpacing(ctx, px) { if ("letterSpacing" in ctx) ctx.letterSpacing = px + "px"; }

function fitText(ctx, text, font, size, maxW) {
  let s = size;
  ctx.font = font.replace("{s}", s);
  while (s > 20 && ctx.measureText(text).width > maxW) { s -= 4; ctx.font = font.replace("{s}", s); }
  return s;
}

function arcText(ctx, text, cx, cy, r, top, k) {
  // characters spaced along an arc centred at the top (or bottom) of a circle
  const widths = [...text].map((ch) => ctx.measureText(ch).width + 2.6 * k);
  const total = widths.reduce((a, b) => a + b, 0);
  let a = (top ? -Math.PI / 2 : Math.PI / 2) + (top ? -1 : 1) * (total / r) / 2;
  [...text].forEach((ch, i) => {
    const w = widths[i];
    const mid = a + (top ? 1 : -1) * (w / r) / 2;
    ctx.save();
    ctx.translate(cx + r * Math.cos(mid), cy + r * Math.sin(mid));
    ctx.rotate(mid + (top ? Math.PI / 2 : -Math.PI / 2));
    ctx.fillText(ch, 0, 0);
    ctx.restore();
    a += (top ? 1 : -1) * (w / r);
  });
}

function drawChip(ctx, cx, cy, R) {
  // the JP Vegas chip, the same design as the SVG on the homepage (200-unit grid)
  const k = R / 100;
  const P = (v) => v * k;
  ctx.save();
  ctx.translate(cx - P(100), cy - P(100));
  const circle = (x, y, r, fill, stroke, lw) => {
    ctx.beginPath(); ctx.arc(P(x), P(y), P(r), 0, Math.PI * 2);
    if (fill) { ctx.fillStyle = fill; ctx.fill(); }
    if (stroke) { ctx.strokeStyle = stroke; ctx.lineWidth = P(lw); ctx.stroke(); }
  };
  circle(100, 100, 97, "#FF4FAE");
  const suits = ["♠", "♥", "♦", "♣"];
  for (let i = 0; i < 8; i++) {
    ctx.save();
    ctx.translate(P(100), P(100)); ctx.rotate((i * 45 * Math.PI) / 180); ctx.translate(-P(100), -P(100));
    ctx.fillStyle = "#FFFFFF";
    ctx.beginPath(); ctx.roundRect(P(91), P(4), P(18), P(16), P(3)); ctx.fill();
    if (i % 2 === 0) {
      const s = suits[i / 2];
      ctx.fillStyle = s === "♥" || s === "♦" ? "#D7193F" : "#12082C";
      ctx.font = `${P(13)}px sans-serif`; ctx.textAlign = "center"; ctx.textBaseline = "alphabetic";
      ctx.fillText(s, P(100), P(17.5));
    }
    ctx.restore();
  }
  circle(100, 100, 80, "#12082C", "#FFC93C", 2.5);
  for (let i = 0; i < 28; i++) {
    const a = (i * 2 * Math.PI) / 28;
    circle(100 + 71 * Math.cos(a), 100 + 71 * Math.sin(a), 2.6, "#FFE27A");
  }
  const g = ctx.createRadialGradient(P(100), P(88), 0, P(100), P(100), P(62));
  g.addColorStop(0, "#3A1C78"); g.addColorStop(1, "#12082C");
  circle(100, 100, 62, g, "#FFC93C", 1.5);
  ctx.textAlign = "center"; ctx.textBaseline = "alphabetic";
  ctx.fillStyle = "#FFC93C"; ctx.font = `800 ${P(10)}px Manrope, sans-serif`;
  arcText(ctx, "LAS VEGAS", P(100), P(100), P(50), true, k);
  ctx.fillStyle = "#FF6BBD"; ctx.font = `800 ${P(8.5)}px Manrope, sans-serif`;
  arcText(ctx, "GRAND PRIX · 2026", P(100), P(100), P(62), false, k);
  // the Welcome-sign star
  ctx.beginPath();
  const st = [[100, 56], [102.6, 62], [109, 62.6], [104.1, 66.8], [105.6, 73.1], [100, 69.7], [94.4, 73.1], [95.9, 66.8], [91, 62.6], [97.4, 62]];
  st.forEach(([x, y], i) => (i ? ctx.lineTo(P(x), P(y)) : ctx.moveTo(P(x), P(y))));
  ctx.closePath(); ctx.fillStyle = "#D7193F"; ctx.fill(); ctx.strokeStyle = "#FFC93C"; ctx.lineWidth = P(0.8); ctx.stroke();
  ctx.fillStyle = "#FFF4FA"; ctx.font = `${P(56)}px "DM Serif Display", Georgia, serif`;
  ctx.shadowColor = "rgba(255,79,174,0.9)"; ctx.shadowBlur = P(6);
  ctx.fillText("JP", P(100), P(125));
  ctx.restore();
}

function chequer(ctx, x0, y0, w, h, size, a, b) {
  for (let y = y0; y < y0 + h; y += size) {
    for (let x = x0; x < x0 + w; x += size) {
      ctx.fillStyle = ((Math.floor(x / size) + Math.floor(y / size)) % 2) ? a : b;
      ctx.fillRect(x, y, size, size);
    }
  }
}

function drawContent(ctx, s, cx, cy, H) {
  if (s.type === "chip") { drawChip(ctx, cx, cy, H * 0.25); return; }
  const maxW = H * 0.46;
  const mono = "600 {s}px 'IBM Plex Mono', monospace";
  const sans = "800 {s}px Manrope, sans-serif";
  ctx.textAlign = "center"; ctx.textBaseline = "middle";
  const lines = s.big.length ? s.big : ["—"];
  // size the big lines to fit, then stack: small / big lines / small
  let bigSize = H * 0.115;
  lines.forEach((l) => { bigSize = Math.min(bigSize, fitText(ctx, l, sans, bigSize, maxW)); });
  const smallSize = H * 0.034;
  const lh = bigSize * 1.02;
  const blockH = smallSize * 2.6 * 2 + lh * lines.length;
  let y = cy - blockH / 2 + smallSize * 1.3;
  const boxed = s.type === "flag";
  const small = (t) => {
    if (!t) { y += smallSize * 2.6; return; }
    setSpacing(ctx, smallSize * 0.18);
    ctx.font = mono.replace("{s}", smallSize);
    if (boxed) { const w = ctx.measureText(t).width + smallSize; ctx.fillStyle = "rgba(10,6,24,0.8)"; ctx.fillRect(cx - w / 2, y - smallSize * 0.8, w, smallSize * 1.6); }
    if (s.type === "winner") { ctx.lineWidth = smallSize * 0.3; ctx.strokeStyle = "rgba(40,22,0,0.85)"; ctx.strokeText(t.toUpperCase(), cx, y); }
    ctx.fillStyle = "#FFFFFF"; ctx.shadowColor = "rgba(0,0,0,0.6)"; ctx.shadowBlur = 6;
    ctx.fillText(t.toUpperCase(), cx, y);
    ctx.shadowBlur = 0; setSpacing(ctx, 0);
    y += smallSize * 2.6;
  };
  small(s.top);
  y += -smallSize * 1.3 + lh / 2;
  lines.forEach((l) => {
    ctx.font = sans.replace("{s}", bigSize);
    if (boxed) { const w = ctx.measureText(l).width + bigSize * 0.4; ctx.fillStyle = "rgba(10,6,24,0.8)"; ctx.fillRect(cx - w / 2, y - lh * 0.5, w, lh); }
    if (s.type === "winner") {
      // a dark outline keeps the winner's name crisp on the gold chequers
      ctx.lineJoin = "round"; ctx.lineWidth = bigSize * 0.14; ctx.strokeStyle = "rgba(40,22,0,0.85)";
      ctx.strokeText(l, cx, y);
    }
    ctx.fillStyle = s.type === "winner" ? "#FFF4C2" : "#FFFFFF";
    ctx.shadowColor = s.type === "winner" ? "rgba(255,201,60,0.95)" : "rgba(255,255,255,0.8)"; ctx.shadowBlur = bigSize * 0.18;
    ctx.fillText(l, cx, y);
    ctx.shadowBlur = 0;
    y += lh;
  });
  y += -lh / 2 + smallSize * 1.3;
  small(s.bottom);
}

function paint(canvas, s) {
  const ctx = canvas.getContext("2d");
  const W = canvas.width, H = canvas.height;
  const [c0, c1, c2] = SCREEN_COLOURS[s.type] || SCREEN_COLOURS.chip;
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  // background: one colour field, glowing brightest behind the front and back faces
  ctx.fillStyle = c2; ctx.fillRect(0, 0, W, H);
  if (s.type === "flag") chequer(ctx, 0, 0, W, H, H / 14, "#F4F4F4", "#151515");
  if (s.type === "winner") chequer(ctx, 0, 0, W, H, H / 14, "#FFFFFF", "#111111");
  for (const fx of [0.25, 0.75]) {
    const g = ctx.createRadialGradient(W * fx, H / 2, 0, W * fx, H / 2, H * 0.62);
    if (s.type === "flag") { g.addColorStop(0, "rgba(0,0,0,0)"); g.addColorStop(1, "rgba(0,0,0,0)"); }
    else if (s.type === "winner") { g.addColorStop(0, "rgba(255,201,60,0.6)"); g.addColorStop(1, "rgba(120,70,0,0.8)"); }
    else { g.addColorStop(0, c0); g.addColorStop(0.55, c1); g.addColorStop(1, c2); }
    ctx.fillStyle = g; ctx.fillRect(W * fx - H * 0.62, 0, H * 1.24, H);
  }
  // the screen faces the viewer at u = 0.25; a copy plays on the back
  drawContent(ctx, s, W * 0.25, H / 2, H);
  drawContent(ctx, s, W * 0.75, H / 2, H);
  // LED mesh: dark gaps between the pixels
  const pitch = Math.max(3, Math.round(H / 220));
  ctx.fillStyle = "rgba(6,3,18,0.45)";
  for (let x = 0; x < W; x += pitch) ctx.fillRect(x, 0, 1, H);
  for (let y = 0; y < H; y += pitch) ctx.fillRect(0, y, W, 1);
}

/* ---------- the scene ---------- */
export function mountSphere3D(button) {
  const wrap = button.closest(".vg-sphere-wrap");
  if (!wrap) return false;
  const small = window.matchMedia("(max-width: 760px)").matches;
  let renderer;
  try {
    renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true, powerPreference: "low-power" });
  } catch (e) { return false; }
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, small ? 1.5 : 2));
  renderer.outputColorSpace = THREE.SRGBColorSpace;

  const holder = document.createElement("div");
  holder.className = "vg3d";
  holder.setAttribute("aria-hidden", "true");
  holder.appendChild(renderer.domElement);
  wrap.appendChild(holder);

  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(30, 1, 0.1, 100);
  camera.position.set(0, 0, 4.25);

  const tex = document.createElement("canvas");
  tex.width = small ? 1024 : 2048; tex.height = tex.width / 2;
  const texture = new THREE.CanvasTexture(tex);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.anisotropy = renderer.capabilities.getMaxAnisotropy();

  const seg = small ? 64 : 96;
  const globe = new THREE.Mesh(
    new THREE.SphereGeometry(1, seg, seg / 2),
    new THREE.MeshStandardMaterial({ color: 0x0a0618, emissive: 0xffffff, emissiveMap: texture, emissiveIntensity: 1, roughness: 0.32, metalness: 0.05 })
  );
  scene.add(globe);

  // shading: darken the limb so it reads as a ball, not a disc
  const limb = new THREE.Mesh(
    new THREE.SphereGeometry(1.002, seg, seg / 2),
    new THREE.ShaderMaterial({
      transparent: true, depthWrite: false,
      vertexShader: "varying vec3 vN; varying vec3 vV; void main(){ vec4 mv = modelViewMatrix * vec4(position,1.0); vN = normalize(normalMatrix*normal); vV = normalize(-mv.xyz); gl_Position = projectionMatrix*mv; }",
      fragmentShader: "varying vec3 vN; varying vec3 vV; void main(){ float f = 1.0 - max(dot(vN,vV),0.0); gl_FragColor = vec4(0.0,0.0,0.02, pow(f,2.2)*0.85); }",
    })
  );
  scene.add(limb);

  // neon halo: a back-faced shell glowing pink to cyan at the rim
  const halo = new THREE.Mesh(
    new THREE.SphereGeometry(1.1, 64, 32),
    new THREE.ShaderMaterial({
      transparent: true, depthWrite: false, side: THREE.BackSide, blending: THREE.AdditiveBlending,
      vertexShader: "varying vec3 vN; varying vec3 vP; void main(){ vN = normalize(normalMatrix*normal); vP = position; gl_Position = projectionMatrix*modelViewMatrix*vec4(position,1.0); }",
      fragmentShader: "varying vec3 vN; varying vec3 vP; void main(){ float i = pow(max(0.62 - dot(vN, vec3(0.0,0.0,1.0)), 0.0), 2.0) * 1.6; vec3 c = mix(vec3(1.0,0.31,0.68), vec3(0.24,0.91,0.96), smoothstep(-1.0,1.0,vP.y)); gl_FragColor = vec4(c, clamp(i,0.0,1.0)*0.55); }",
    })
  );
  scene.add(halo);

  scene.add(new THREE.AmbientLight(0xffffff, 0.35));
  const key = new THREE.DirectionalLight(0xffffff, 1.6);
  key.position.set(-2.2, 2.6, 3.2);
  scene.add(key);

  /* ---- layout: the canvas sits over the CSS Sphere, a little larger for the halo ---- */
  function layout() {
    const b = button.getBoundingClientRect(), w = wrap.getBoundingClientRect();
    const size = b.width * 1.22;
    holder.style.width = holder.style.height = size + "px";
    holder.style.left = (b.left - w.left + b.width / 2 - size / 2) + "px";
    holder.style.top = (b.top - w.top + b.height / 2 - size / 2) + "px";
    renderer.setSize(size, size, false);
    renderer.domElement.style.width = renderer.domElement.style.height = "100%";
  }
  layout();
  new ResizeObserver(layout).observe(wrap);

  /* ---- keep the texture in step with the CSS Sphere ---- */
  let sig = "";
  function sync() {
    const s = readScreen(button);
    const next = JSON.stringify(s);
    if (next === sig) return;
    sig = next;
    paint(tex, s);
    texture.needsUpdate = true;
  }
  new MutationObserver(sync).observe(button, { subtree: true, attributes: true, attributeFilter: ["class"], childList: true, characterData: true });

  /* ---- interaction: drag to spin, tap to change screen ---- */
  const el = renderer.domElement;
  let rotY = 0, rotX = 0, velY = 0, dragging = false, lastX = 0, lastY = 0, downX = 0, downY = 0, downT = 0, released = -1e9;
  el.addEventListener("pointerdown", (e) => {
    dragging = true; lastX = downX = e.clientX; lastY = downY = e.clientY; downT = performance.now(); velY = 0;
    el.setPointerCapture(e.pointerId);
  });
  el.addEventListener("pointermove", (e) => {
    if (!dragging) return;
    const dx = e.clientX - lastX, dy = e.clientY - lastY;
    lastX = e.clientX; lastY = e.clientY;
    velY = dx * 0.01; rotY += velY;
    rotX = Math.max(-0.5, Math.min(0.5, rotX + dy * 0.006));
  });
  const end = (e) => {
    if (!dragging) return;
    dragging = false; released = performance.now();
    const moved = Math.hypot(e.clientX - downX, e.clientY - downY);
    if (moved < 6 && performance.now() - downT < 450) button.click(); // a tap: next screen
  };
  el.addEventListener("pointerup", end);
  el.addEventListener("pointercancel", end);

  /* ---- loop: only while on screen and the tab is visible ---- */
  let visible = true, raf = 0;
  const clock = new THREE.Clock();
  function frame() {
    raf = 0;
    if (!visible || document.hidden) return;
    const t = clock.getElapsedTime();
    if (!dragging) {
      rotY += velY; velY *= 0.94;
      // after a moment, ease back to the gentle sway that keeps the screen facing out
      if (performance.now() - released > 1600) {
        const target = 0.32 * Math.sin(t * 0.45);
        const turns = Math.round((rotY - target) / (Math.PI * 2));
        rotY += (target + turns * Math.PI * 2 - rotY) * 0.03;
        rotX += (0.08 * Math.sin(t * 0.3) - rotX) * 0.03;
      }
    }
    globe.rotation.set(rotX, rotY, 0);
    renderer.render(scene, camera);
    raf = requestAnimationFrame(frame);
  }
  const start = () => { if (!raf && visible && !document.hidden) raf = requestAnimationFrame(frame); };
  new IntersectionObserver((entries) => { visible = entries[0].isIntersecting; start(); }).observe(holder);
  document.addEventListener("visibilitychange", start);

  (document.fonts ? document.fonts.ready : Promise.resolve()).then(() => {
    sig = ""; // repaint now the web fonts are in
    sync();
    wrap.classList.add("vg-3d-on");
    start();
  });
  return true;
}
