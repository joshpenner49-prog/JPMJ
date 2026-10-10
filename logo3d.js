/* ============================================================
   Interactive 3D logo badge.
   The shapes below were traced directly from the uploaded logo
   PNG using contour detection (not hand-approximated), then
   normalized to a ~10-unit-wide coordinate space and extruded.
   Drag horizontally (or use the slider) to spin it.
   ============================================================ */
const LOGO_SHAPES = [
  { role: "letterP", outer: [[1.932,1.946],[1.57,2.033],[-0.224,2.033],[-0.224,-1.99],[0.514,-1.99],[0.528,-0.427],[1.483,-0.427],[1.816,-0.369],[2.221,-0.166],[2.395,-0.007],[2.54,0.195],[2.641,0.456],[2.685,0.774],[2.612,1.266],[2.424,1.599],[2.207,1.802]], holes: [[[0.514,1.339],[1.368,1.353],[1.614,1.281],[1.773,1.151],[1.874,0.948],[1.889,0.76],[1.831,0.572],[1.671,0.398],[1.44,0.297],[0.528,0.282]]] },
  { role: "letterJ", outer: [[-0.499,2.033],[-1.208,2.033],[-1.208,-0.89],[-1.295,-1.151],[-1.498,-1.31],[-1.831,-1.339],[-1.99,-1.281],[-2.12,-1.151],[-2.192,-0.876],[-2.959,-0.876],[-2.916,-1.252],[-2.786,-1.556],[-2.598,-1.773],[-2.308,-1.946],[-1.946,-2.033],[-1.469,-2.033],[-1.237,-1.99],[-0.991,-1.889],[-0.716,-1.657],[-0.586,-1.44],[-0.499,-1.107]], holes: [] },
  { role: "flagWing", outer: [[-1.44,1.324],[-1.787,0.832],[-2.308,0.832],[-2.004,1.31],[-2.511,1.281],[-2.858,0.803],[-3.408,0.774],[-3.611,0.47],[-3.712,0.384],[-4.407,0.282],[-3.205,0.311],[-3.307,0.123],[-3.437,-0.022],[-4.204,-0.123],[-2.931,-0.123],[-2.612,0.326],[-2.077,0.34],[-1.744,0.818],[-1.44,0.832]], holes: [[[-2.337,0.789],[-2.627,0.355],[-3.162,0.34],[-2.873,0.76]]] },
  { role: "swoosh", outer: [[-1.411,1.7],[-2.178,1.585],[-3.003,1.353],[-4.016,0.904],[-5.0,0.326],[-3.133,1.136]], holes: [] },
  { role: "speedLine1", outer: [[1.975,2.033],[2.207,1.932],[2.41,1.787],[5.0,1.99]], holes: [] },
  { role: "speedLine2", outer: [[2.54,1.643],[2.699,1.397],[4.45,1.599]], holes: [] },
  { role: "speedLine3", outer: [[2.815,1.064],[2.858,1.049],[3.669,1.252],[2.771,1.252]], holes: [] },
];

(function () {
  const section = document.getElementById("hero3d");
  const stage = document.getElementById("logo3d-stage");
  const canvas = document.getElementById("logo-canvas");
  const slider = document.getElementById("logo3d-slider");
  if (!section || !stage || !canvas || typeof THREE === "undefined") return;

  const prefersReducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  let renderer;
  try {
    renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true });
  } catch (e) {
    section.classList.add("no-3d");
    return;
  }
  if (!renderer) {
    section.classList.add("no-3d");
    return;
  }
  renderer.setClearColor(0x000000, 0);
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));

  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(38, 1, 0.1, 100);
  camera.position.set(0, 0.3, 11);
  camera.lookAt(0, 0, 0);

  // ---------- studio-style lighting for a glossy badge look ----------
  scene.add(new THREE.AmbientLight(0xffffff, 0.55));
  const key = new THREE.DirectionalLight(0xffffff, 1.0);
  key.position.set(4, 6, 6);
  scene.add(key);
  const fill = new THREE.DirectionalLight(0xcfd6de, 0.5);
  fill.position.set(-6, 2, 4);
  scene.add(fill);
  const rim = new THREE.DirectionalLight(0xffe6e9, 0.4);
  rim.position.set(0, -3, -6);
  scene.add(rim);

  // ---------- materials ----------
  const chromeMat = new THREE.MeshStandardMaterial({ color: 0x2a2d32, metalness: 0.82, roughness: 0.28 });
  const redMat = new THREE.MeshStandardMaterial({ color: 0xc8102e, metalness: 0.45, roughness: 0.32 });

  // Race-week theme layer (see race-week.css): when active, the left-side
  // accent group (flagWing + swoosh, next to the J) picks up the theme's
  // first accent color instead of the default red. Right-side speed lines
  // are unaffected. Falls back to plain red whenever no theme is set —
  // removing data-race-week from <html> fully reverts this.
  // Colors here must match each theme's --rw-a value in race-week.css.
  const RACE_WEEK_ACCENTS = {
    monza: 0x008c45,  // Italian green
    madrid: 0xf1bf00, // Spanish gold
    baku: 0x0092bc,   // Azerbaijan flag blue
    sepang: 0x010066, // Malaysia flag navy
    singapore: 0xef3340, // Singapore flag red
  };
  const raceWeekTheme = document.documentElement.getAttribute("data-race-week");
  let leftAccentMat = redMat;
  if (raceWeekTheme && RACE_WEEK_ACCENTS[raceWeekTheme] !== undefined) {
    leftAccentMat = new THREE.MeshStandardMaterial({ color: RACE_WEEK_ACCENTS[raceWeekTheme], metalness: 0.45, roughness: 0.32 });
  }

  const roleMaterial = {
    letterP: chromeMat,
    letterJ: chromeMat,
    flagWing: leftAccentMat,
    swoosh: leftAccentMat,
    speedLine1: redMat,
    speedLine2: redMat,
    speedLine3: redMat,
  };

  // ---------- build extruded logo group ----------
  const logoGroup = new THREE.Group();
  const extrudeSettings = { depth: 0.85, bevelEnabled: true, bevelThickness: 0.1, bevelSize: 0.08, bevelSegments: 4, curveSegments: 6 };

  LOGO_SHAPES.forEach((def) => {
    const shape = new THREE.Shape(def.outer.map(([x, y]) => new THREE.Vector2(x, y)));
    def.holes.forEach((hole) => {
      shape.holes.push(new THREE.Path(hole.map(([x, y]) => new THREE.Vector2(x, y))));
    });
    const geo = new THREE.ExtrudeGeometry(shape, extrudeSettings);
    const mesh = new THREE.Mesh(geo, roleMaterial[def.role] || chromeMat);
    logoGroup.add(mesh);
  });

  // center the group on its true bounding box (normalization got us close, this makes it exact)
  const box = new THREE.Box3().setFromObject(logoGroup);
  const center = box.getCenter(new THREE.Vector3());
  logoGroup.children.forEach((m) => m.position.sub(center));
  logoGroup.position.set(0, 0, -extrudeSettings.depth / 2);

  scene.add(logoGroup);
  logoGroup.rotation.x = -0.06; // fixed, subtle — just enough to read the bevel depth, not user-controlled

  // ---------- race-week entrance: real 3D arrival, not a CSS fake ----------
  // Starts rotated away and scaled down, eases into its resting pose with a
  // slight overshoot (reads as "settling" rather than just sliding in).
  // window.RW_PLAY_LOGO_ARRIVAL is set by an inline script just before this
  // file loads (see index.html) — computed early enough to beat this IIFE.
  let arrivalStart = null;
  const ARRIVAL_MS = 780;
  let playArrival = window.RW_PLAY_LOGO_ARRIVAL === true && !prefersReducedMotion;
  if (playArrival) {
    logoGroup.rotation.y = -2.35;
    logoGroup.scale.setScalar(0.62);
  }
  function easeOutBack(t) {
    const c1 = 1.4, c3 = c1 + 1;
    return 1 + c3 * Math.pow(t - 1, 3) + c1 * Math.pow(t - 1, 2);
  }

  // ---------- resize (tracks the stage element, not the viewport) ----------
  function resize() {
    const w = stage.clientWidth || 400;
    const h = stage.clientHeight || 400;
    renderer.setSize(w, h, false);
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
  }
  resize();
  window.addEventListener("resize", resize);

  // ---------- drag-to-spin + slider sync ----------
  let isDragging = false;
  let lastX = 0;
  let velocityY = 0;
  let lastInteraction = performance.now();
  const ROTATE_SPEED = 0.011;

  function pointerPos(e) {
    const p = e.touches ? e.touches[0] : e;
    return { x: p.clientX };
  }
  function onDown(e) {
    if (playArrival) {
      // interrupted mid-arrival — hand off to the user immediately rather
      // than fighting their drag input for the rest of the tween
      playArrival = false;
      logoGroup.scale.setScalar(1);
    }
    isDragging = true;
    velocityY = 0;
    lastX = pointerPos(e).x;
    stage.style.cursor = "grabbing";
  }
  function onMove(e) {
    if (!isDragging) return;
    const x = pointerPos(e).x;
    const dx = x - lastX;
    lastX = x;
    logoGroup.rotation.y += dx * ROTATE_SPEED;
    velocityY = dx * ROTATE_SPEED;
    lastInteraction = performance.now();
    if (e.cancelable) e.preventDefault();
  }
  function onUp() {
    isDragging = false;
    stage.style.cursor = "grab";
  }
  canvas.addEventListener("mousedown", onDown);
  window.addEventListener("mousemove", onMove);
  window.addEventListener("mouseup", onUp);
  canvas.addEventListener("touchstart", onDown, { passive: true });
  window.addEventListener("touchmove", onMove, { passive: false });
  window.addEventListener("touchend", onUp);

  if (slider) {
    slider.addEventListener("input", () => {
      logoGroup.rotation.y = THREE.MathUtils.degToRad(parseFloat(slider.value));
      velocityY = 0;
      lastInteraction = performance.now();
    });
  }
  function syncSlider() {
    if (!slider) return;
    let deg = THREE.MathUtils.radToDeg(logoGroup.rotation.y) % 360;
    if (deg < 0) deg += 360;
    slider.value = Math.round(deg);
  }

  if (prefersReducedMotion) {
    logoGroup.rotation.y = 0.5;
    renderer.render(scene, camera);
    syncSlider();
    return;
  }

  function animate(now) {
    requestAnimationFrame(animate);
    if (playArrival) {
      const t0 = now || performance.now();
      if (arrivalStart === null) arrivalStart = t0;
      const t = Math.min(1, (t0 - arrivalStart) / ARRIVAL_MS);
      const eased = easeOutBack(t);
      logoGroup.rotation.y = -2.35 * (1 - eased);
      logoGroup.scale.setScalar(Math.max(0.62 + 0.38 * eased, 0.01));
      if (t >= 1) {
        playArrival = false;
        logoGroup.rotation.y = 0;
        logoGroup.scale.setScalar(1);
        lastInteraction = performance.now(); // don't let ambient idle-drift kick in right away
        if (typeof window.rwTriggerPulse === "function") window.rwTriggerPulse();
      }
    } else if (!isDragging) {
      if (Math.abs(velocityY) > 0.00015) {
        // momentum: keeps spinning the same direction you flicked it, decays smoothly
        logoGroup.rotation.y += velocityY;
        velocityY *= 0.95;
      } else if (performance.now() - lastInteraction > 3200) {
        // ambient idle drift — slow and subtle, clearly secondary to direct control
        logoGroup.rotation.y += 0.0011;
      }
    }
    syncSlider();
    renderer.render(scene, camera);
  }
  animate();
})();
