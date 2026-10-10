/* ============================================================
   Driver page 3D helmet badge.
   Same extrusion/lighting/drag-rotate technique as the homepage's
   logo3d.js, reused here for a low-poly helmet silhouette instead
   of the site mark. Shell stays neutral; visor, crown stripe and
   chin bar pick up the driver's team color via window.DRIVER_TEAM_COLOR
   (set inline per generated driver page before this script loads).
   Single-axis (Y) drag only, idle auto-rotate after 3.2s — matches
   the homepage badge's deliberate interaction feel.
   ============================================================ */
const HELMET_SHAPES = [
  { role: "shell", outer: [[-1.6,3.0],[1.6,3.0],[2.6,1.5],[2.7,-0.3],[2.0,-1.8],[0.8,-2.6],[-0.8,-2.6],[-2.0,-1.8],[-2.7,-0.3],[-2.6,1.5]], holes: [] },
  { role: "visor", outer: [[-2.0,1.3],[2.0,1.3],[1.9,-0.3],[-1.9,-0.3]], holes: [] },
  { role: "crownStripe", outer: [[-0.7,3.05],[0.7,3.05],[1.0,2.25],[-1.0,2.25]], holes: [] },
  { role: "chinBar", outer: [[-1.6,-0.55],[1.6,-0.55],[1.5,-0.95],[-1.5,-0.95]], holes: [] },
];

function initDriverHero3D(opts) {
  const canvasId = (opts && opts.canvasId) || "driver-logo-canvas";
  const stageId = (opts && opts.stageId) || "driver3d-stage";
  const sliderId = (opts && opts.sliderId) || "driver3d-slider";
  const sectionId = (opts && opts.sectionId) || "driverHero3d";
  const teamColor = (opts && opts.teamColor) || window.DRIVER_TEAM_COLOR || "#c8102e";

  const section = document.getElementById(sectionId);
  const stage = document.getElementById(stageId);
  const canvas = document.getElementById(canvasId);
  const slider = document.getElementById(sliderId);
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
  camera.position.set(0, 0.2, 11);
  camera.lookAt(0, 0, 0);

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

  const shellMat = new THREE.MeshStandardMaterial({ color: 0xeef0f2, metalness: 0.25, roughness: 0.32 });
  const teamMat = new THREE.MeshStandardMaterial({ color: new THREE.Color(teamColor), metalness: 0.55, roughness: 0.24 });
  const visorMat = new THREE.MeshStandardMaterial({ color: 0x15161a, metalness: 0.7, roughness: 0.15 });

  const roleMaterial = {
    shell: shellMat,
    visor: visorMat,
    crownStripe: teamMat,
    chinBar: teamMat,
  };

  const helmetGroup = new THREE.Group();
  const extrudeSettings = { depth: 0.85, bevelEnabled: true, bevelThickness: 0.1, bevelSize: 0.08, bevelSegments: 4, curveSegments: 6 };

  HELMET_SHAPES.forEach((def, i) => {
    const shape = new THREE.Shape(def.outer.map(([x, y]) => new THREE.Vector2(x, y)));
    def.holes.forEach((hole) => {
      shape.holes.push(new THREE.Path(hole.map(([x, y]) => new THREE.Vector2(x, y))));
    });
    const geo = new THREE.ExtrudeGeometry(shape, extrudeSettings);
    const mesh = new THREE.Mesh(geo, roleMaterial[def.role] || shellMat);
    // layer visor/stripe/chin bar slightly in front of the shell so they read
    // as applied surfaces rather than fighting the shell for the same depth
    if (def.role !== "shell") mesh.position.z = 0.06 * (i + 1);
    helmetGroup.add(mesh);
  });

  const box = new THREE.Box3().setFromObject(helmetGroup);
  const center = box.getCenter(new THREE.Vector3());
  helmetGroup.children.forEach((m) => { m.position.x -= center.x; m.position.y -= center.y; });
  helmetGroup.position.set(0, 0, -extrudeSettings.depth / 2);

  scene.add(helmetGroup);
  helmetGroup.rotation.x = -0.05;

  function resize() {
    const w = stage.clientWidth || 320;
    const h = stage.clientHeight || 320;
    renderer.setSize(w, h, false);
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
  }
  resize();
  window.addEventListener("resize", resize);

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
    helmetGroup.rotation.y += dx * ROTATE_SPEED;
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
      helmetGroup.rotation.y = THREE.MathUtils.degToRad(parseFloat(slider.value));
      velocityY = 0;
      lastInteraction = performance.now();
    });
  }
  function syncSlider() {
    if (!slider) return;
    let deg = THREE.MathUtils.radToDeg(helmetGroup.rotation.y) % 360;
    if (deg < 0) deg += 360;
    slider.value = Math.round(deg);
  }

  if (prefersReducedMotion) {
    helmetGroup.rotation.y = 0.5;
    renderer.render(scene, camera);
    syncSlider();
    return;
  }

  function animate() {
    requestAnimationFrame(animate);
    if (!isDragging) {
      if (Math.abs(velocityY) > 0.00015) {
        helmetGroup.rotation.y += velocityY;
        velocityY *= 0.95;
      } else if (performance.now() - lastInteraction > 3200) {
        helmetGroup.rotation.y += 0.0011;
      }
    }
    syncSlider();
    renderer.render(scene, camera);
  }
  animate();
}

document.addEventListener("DOMContentLoaded", function () {
  initDriverHero3D({});
});
