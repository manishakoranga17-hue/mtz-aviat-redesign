/* =============================================
   MENTEIZ AVIATION REDESIGN — interactions
   Three.js globe + flight arcs, GSAP scroll FX
   ============================================= */

gsap.registerPlugin(ScrollTrigger);

/* ---------- LOADER ---------- */
let heroIntroDone = false;
function dismissLoader() {
  if (heroIntroDone) return;
  heroIntroDone = true;
  const loader = document.getElementById('loader');
  if (loader) {
    loader.classList.add('is-done');
    setTimeout(() => {
      loader.style.display = 'none';
      if (window.ScrollTrigger) ScrollTrigger.refresh();
    }, 1200);
  }
  document.body.style.overflow = '';
  playHeroIntro();
}
window.addEventListener('load', () => {
  setTimeout(dismissLoader, 1800);
});
/* Safety net: dismiss after max 3.5s no matter what */
setTimeout(dismissLoader, 3500);
document.body.style.overflow = 'hidden';

/* Drive the percentage counter, the plane's flight across the track,
   and the gradient trail behind it — all from a single rAF loop. */
(function loaderCounter() {
  const pct = document.getElementById('loaderPct');
  const plane = document.getElementById('loaderPlane');
  const fill = document.getElementById('loaderTrackFill');
  if (!pct) return;

  function setProgress(p) {
    /* p in [0,1]. */
    pct.textContent = String(Math.floor(p * 100)).padStart(2, '0');
    if (plane) {
      plane.style.left = (p * 100) + '%';
    }
    if (fill) {
      fill.style.width = (p * 100) + '%';
    }
  }

  const start = performance.now();
  const duration = 2100;
  function tick(now) {
    if (heroIntroDone) {
      setProgress(1);
      return;
    }
    const t = Math.min((now - start) / duration, 0.99);
    const eased = 1 - Math.pow(1 - t, 2);
    setProgress(eased);
    requestAnimationFrame(tick);
  }
  requestAnimationFrame(tick);
})();

/* ---------- CUSTOM CURSOR ---------- */
(function cursor() {
  const dot = document.getElementById('cursor');
  const ring = document.getElementById('cursorFollower');
  if (!dot || !ring) return;

  let mx = window.innerWidth / 2, my = window.innerHeight / 2;
  let rx = mx, ry = my;

  window.addEventListener('mousemove', (e) => {
    mx = e.clientX; my = e.clientY;
    dot.style.transform = `translate(${mx}px, ${my}px) translate(-50%,-50%)`;
  });

  function loop() {
    rx += (mx - rx) * 0.18;
    ry += (my - ry) * 0.18;
    ring.style.transform = `translate(${rx}px, ${ry}px) translate(-50%,-50%)`;
    requestAnimationFrame(loop);
  }
  loop();

  document.querySelectorAll('[data-cursor="hover"]').forEach((el) => {
    el.addEventListener('mouseenter', () => document.body.classList.add('cursor-hover'));
    el.addEventListener('mouseleave', () => document.body.classList.remove('cursor-hover'));
  });
})();

/* ---------- SCROLL PROGRESS ---------- */
(function progress() {
  const bar = document.getElementById('scrollProgress');
  if (!bar) return;
  window.addEventListener('scroll', () => {
    const h = document.documentElement;
    const scrolled = (h.scrollTop) / (h.scrollHeight - h.clientHeight);
    bar.style.width = (scrolled * 100) + '%';
  }, { passive: true });
})();

/* ---------- NAV SCROLLED STATE ---------- */
(function navState() {
  const nav = document.querySelector('.nav');
  window.addEventListener('scroll', () => {
    nav.classList.toggle('is-scrolled', window.scrollY > 40);
  }, { passive: true });
})();

/* ---------- THREE.JS GLOBE — INTERACTIVE NETWORK ---------- */
(function threeScene() {
  const canvas = document.getElementById('globeCanvas');
  const stageEl = canvas && canvas.parentElement;
  const tooltipEl = document.getElementById('globeTooltip');
  const tooltipCode = tooltipEl && tooltipEl.querySelector('.globe-tooltip__code');
  const tooltipName = tooltipEl && tooltipEl.querySelector('.globe-tooltip__name');
  const tooltipCountry = tooltipEl && tooltipEl.querySelector('.globe-tooltip__country');
  const routeListEl = document.getElementById('routeList');
  const routesCountEl = document.getElementById('routesCount');
  const hintEl = document.getElementById('networkHint');
  if (!canvas || typeof THREE === 'undefined') return;

  const renderer = new THREE.WebGLRenderer({ canvas, alpha: true, antialias: true });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));

  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(38, 1, 0.1, 1000);
  camera.position.set(0, 0, 9);

  const RED = 0xDE1D2A;
  const GOLD = 0xF5B23A;
  const CYAN = 0x4FD2FF;
  const WHITE = 0xFFFFFF;

  const globeGroup = new THREE.Group();
  scene.add(globeGroup);

  const radius = 2.9;

  /* Helper: lon/lat → unit-vector position on sphere */
  function lonLatToVec3(lon, lat, r) {
    const phi = (90 - lat) * Math.PI / 180;
    const theta = (lon + 180) * Math.PI / 180;
    return new THREE.Vector3(
      -r * Math.sin(phi) * Math.cos(theta),
       r * Math.cos(phi),
       r * Math.sin(phi) * Math.sin(theta),
    );
  }

  /* ===== 1. SOLID CORE — dark navy sphere so wireframe reads on top ===== */
  const coreGeo = new THREE.SphereGeometry(radius * 0.995, 64, 48);
  const coreMat = new THREE.MeshBasicMaterial({
    color: 0x05132b,
    transparent: true,
    opacity: 0.98,
  });
  globeGroup.add(new THREE.Mesh(coreGeo, coreMat));

  /* ===== 2. LATITUDE / LONGITUDE GRID — soft white, not techy aqua ===== */
  const gridMat = new THREE.LineBasicMaterial({
    color: 0xffffff,
    transparent: true,
    opacity: 0.10,
  });

  function makeCircle(latDeg, mat) {
    const pts = [];
    const lat = latDeg * Math.PI / 180;
    const segments = 96;
    const r = radius;
    for (let i = 0; i <= segments; i++) {
      const t = (i / segments) * Math.PI * 2;
      pts.push(new THREE.Vector3(
        r * Math.cos(lat) * Math.cos(t),
        r * Math.sin(lat),
        r * Math.cos(lat) * Math.sin(t),
      ));
    }
    return new THREE.Line(new THREE.BufferGeometry().setFromPoints(pts), mat);
  }

  /* parallels every 15° (no special equator highlight) */
  for (let lat = -75; lat <= 75; lat += 15) {
    globeGroup.add(makeCircle(lat, gridMat));
  }

  /* meridians every 15° */
  function makeMeridian(lonDeg, mat) {
    const pts = [];
    const lon = lonDeg * Math.PI / 180;
    const segments = 96;
    const r = radius;
    for (let i = 0; i <= segments; i++) {
      const phi = (i / segments) * Math.PI - Math.PI / 2;
      pts.push(new THREE.Vector3(
        r * Math.cos(phi) * Math.cos(lon),
        r * Math.sin(phi),
        r * Math.cos(phi) * Math.sin(lon),
      ));
    }
    return new THREE.Line(new THREE.BufferGeometry().setFromPoints(pts), mat);
  }
  for (let lon = 0; lon < 360; lon += 15) {
    globeGroup.add(makeMeridian(lon, gridMat));
  }

  /* ===== 2b. COUNTRY BOUNDARIES (via world-atlas TopoJSON) ===== */
  const countryMat = new THREE.LineBasicMaterial({
    color: 0xffffff,
    transparent: true,
    opacity: 0.25,
  });
  const countriesGroup = new THREE.Group();
  globeGroup.add(countriesGroup);

  function addRing(ring) {
    /* ring: array of [lon, lat]; render slightly above the sphere so the
       lines aren't z-fought by the core. Subdivide long segments to keep
       the line hugging the sphere. Break the line into multiple
       LineSegments where a step crosses the antimeridian (|dLon| > 180)
       so we don't draw a chord across the back of the globe. */
    const r = radius * 1.002;
    const segments = [];
    let current = [];
    for (let i = 0; i < ring.length - 1; i++) {
      const a = ring[i], b = ring[i + 1];
      const dLon = b[0] - a[0];
      const dLat = b[1] - a[1];
      if (Math.abs(dLon) > 180) {
        /* antimeridian crossing — close current run, start a new one */
        if (current.length) {
          current.push(lonLatToVec3(a[0], a[1], r));
          segments.push(current);
        }
        current = [];
        continue;
      }
      const steps = Math.max(1, Math.ceil(Math.max(Math.abs(dLon), Math.abs(dLat)) / 2));
      for (let s = 0; s < steps; s++) {
        const t = s / steps;
        const lon = a[0] + dLon * t;
        const lat = a[1] + dLat * t;
        current.push(lonLatToVec3(lon, lat, r));
      }
    }
    if (ring.length) {
      const last = ring[ring.length - 1];
      current.push(lonLatToVec3(last[0], last[1], r));
    }
    if (current.length) segments.push(current);
    segments.forEach((pts) => {
      if (pts.length < 2) return;
      const geo = new THREE.BufferGeometry().setFromPoints(pts);
      countriesGroup.add(new THREE.Line(geo, countryMat));
    });
  }

  function drawCountries(features) {
    features.forEach((f) => {
      const g = f.geometry;
      if (!g) return;
      const polys = g.type === 'Polygon' ? [g.coordinates] : g.coordinates;
      polys.forEach((rings) => rings.forEach(addRing));
    });
  }

  if (window.topojson) {
    fetch('https://cdn.jsdelivr.net/npm/world-atlas@2/countries-110m.json')
      .then((r) => r.json())
      .then((world) => {
        const fc = topojson.feature(world, world.objects.countries);
        drawCountries(fc.features);
      })
      .catch(() => {});
  }

  /* ===== 3. ROUTES — full data: lon, lat, IATA code, city, country, isHub ===== */
  const HUB_DATA = { lon: 101.7, lat: 3.1, code: 'KUL', city: 'Kuala Lumpur', country: 'Malaysia', hub: true };

  const routes = [
    { lon: 103.8, lat: 1.3,   code: 'SIN', city: 'Singapore',     country: 'Singapore',     hub: true },
    { lon: 100.5, lat: 13.7,  code: 'BKK', city: 'Bangkok',       country: 'Thailand' },
    { lon: 121.0, lat: 14.6,  code: 'MNL', city: 'Manila',        country: 'Philippines' },
    { lon: 114.1, lat: 22.3,  code: 'HKG', city: 'Hong Kong',     country: 'China',         hub: true },
    { lon: 121.5, lat: 31.2,  code: 'PVG', city: 'Shanghai',      country: 'China' },
    { lon: 116.4, lat: 39.9,  code: 'PEK', city: 'Beijing',       country: 'China' },
    { lon: 127.0, lat: 37.5,  code: 'ICN', city: 'Seoul',         country: 'South Korea',   hub: true },
    { lon: 139.7, lat: 35.7,  code: 'NRT', city: 'Tokyo',         country: 'Japan',         hub: true },
    { lon: 106.8, lat: -6.2,  code: 'CGK', city: 'Jakarta',       country: 'Indonesia' },
    { lon: 77.2,  lat: 28.6,  code: 'DEL', city: 'Delhi',         country: 'India',         hub: true },
    { lon: 72.9,  lat: 19.1,  code: 'BOM', city: 'Mumbai',        country: 'India' },
    { lon: 80.3,  lat: 13.1,  code: 'MAA', city: 'Chennai',       country: 'India' },
    { lon: 90.4,  lat: 23.8,  code: 'DAC', city: 'Dhaka',         country: 'Bangladesh' },
    { lon: 55.3,  lat: 25.3,  code: 'DXB', city: 'Dubai',         country: 'UAE',           hub: true },
    { lon: 51.5,  lat: 25.3,  code: 'DOH', city: 'Doha',          country: 'Qatar',         hub: true },
    { lon: 46.8,  lat: 24.7,  code: 'RUH', city: 'Riyadh',        country: 'Saudi Arabia' },
    { lon: 39.2,  lat: 21.5,  code: 'JED', city: 'Jeddah',        country: 'Saudi Arabia' },
    { lon: 28.9,  lat: 41.0,  code: 'IST', city: 'Istanbul',      country: 'Türkiye',       hub: true },
    { lon: 31.2,  lat: 30.0,  code: 'CAI', city: 'Cairo',         country: 'Egypt' },
    { lon: -0.1,  lat: 51.5,  code: 'LHR', city: 'London',        country: 'UK',            hub: true },
    { lon: 2.3,   lat: 48.9,  code: 'CDG', city: 'Paris',         country: 'France',        hub: true },
    { lon: 8.7,   lat: 50.1,  code: 'FRA', city: 'Frankfurt',     country: 'Germany',       hub: true },
    { lon: 4.9,   lat: 52.4,  code: 'AMS', city: 'Amsterdam',     country: 'Netherlands' },
    { lon: 12.5,  lat: 41.9,  code: 'FCO', city: 'Rome',          country: 'Italy' },
    { lon: -3.7,  lat: 40.4,  code: 'MAD', city: 'Madrid',        country: 'Spain' },
    { lon: 36.8,  lat: -1.3,  code: 'NBO', city: 'Nairobi',       country: 'Kenya' },
    { lon: 28.0,  lat: -26.2, code: 'JNB', city: 'Johannesburg',  country: 'South Africa',  hub: true },
    { lon: -74.0, lat: 40.7,  code: 'JFK', city: 'New York',      country: 'USA',           hub: true },
    { lon: -87.6, lat: 41.9,  code: 'ORD', city: 'Chicago',       country: 'USA' },
    { lon: -118.2,lat: 34.1,  code: 'LAX', city: 'Los Angeles',   country: 'USA',           hub: true },
    { lon: -80.2, lat: 25.8,  code: 'MIA', city: 'Miami',         country: 'USA' },
    { lon: -99.1, lat: 19.4,  code: 'MEX', city: 'Mexico City',   country: 'Mexico' },
    { lon: -46.6, lat: -23.6, code: 'GRU', city: 'São Paulo',     country: 'Brazil' },
    { lon: 151.2, lat: -33.8, code: 'SYD', city: 'Sydney',        country: 'Australia',     hub: true },
    { lon: 174.7, lat: -36.8, code: 'AKL', city: 'Auckland',      country: 'New Zealand' },
  ];

  /* Ambient secondary cities — show as small dots, no arcs, no tooltips */
  const ambient = [
    [105.9, 21.0], [113.3, 23.1], [135.5, 34.7], [125.3, 35.2], [115.2, -8.7],
    [80.9, 7.3], [88.4, 22.6], [67.0, 24.9], [54.4, 24.5], [50.6, 26.2],
    [35.2, 31.9], [44.4, 33.3], [51.4, 35.7], [13.4, 52.5], [9.2, 45.5],
    [-9.1, 38.7], [4.4, 50.8], [16.4, 48.2], [14.4, 50.1], [21.0, 52.2],
    [37.6, 55.7], [23.7, 37.9], [18.1, 59.3], [10.7, 59.9], [12.6, 55.7],
    [3.4, 6.5], [32.6, 15.5], [18.4, -33.9], [-7.6, 33.6], [-77.0, 38.9],
    [-95.4, 29.8], [-122.4, 37.8], [-122.3, 47.6], [-79.4, 43.7], [-73.6, 45.5],
    [-58.4, -34.6], [-70.7, -33.5], [-77.0, 12.0], [144.9, -37.8], [115.8, -32.0],
  ];

  const allRoutePoints = [HUB_DATA, ...routes];

  /* — Pickable city points (with userData for raycaster) — */
  const cityPickGroup = new THREE.Group();
  globeGroup.add(cityPickGroup);
  const cityPickMeshes = [];

  allRoutePoints.forEach((r) => {
    const v = lonLatToVec3(r.lon, r.lat, radius * 1.014);
    const isHub = !!r.hub || r.code === 'KUL';
    const dotSize = r.code === 'KUL' ? 0.10 : (isHub ? 0.07 : 0.05);
    const dotColor = r.code === 'KUL' ? WHITE : (isHub ? WHITE : RED);
    const mesh = new THREE.Mesh(
      new THREE.SphereGeometry(dotSize, 14, 14),
      new THREE.MeshBasicMaterial({ color: dotColor })
    );
    mesh.position.copy(v);
    mesh.userData = { route: r, isHub, base: dotSize };
    cityPickGroup.add(mesh);
    cityPickMeshes.push(mesh);
  });

  /* Ambient city dots (decorative only, smaller, no userData) */
  const ambPositions = [];
  ambient.forEach(([lon, lat]) => {
    const v = lonLatToVec3(lon, lat, radius * 1.012);
    ambPositions.push(v.x, v.y, v.z);
  });
  const ambGeo = new THREE.BufferGeometry();
  ambGeo.setAttribute('position', new THREE.Float32BufferAttribute(ambPositions, 3));
  globeGroup.add(new THREE.Points(ambGeo, new THREE.PointsMaterial({
    color: 0xff7785, size: 0.04, transparent: true, opacity: 0.6, sizeAttenuation: true,
  })));

  /* Pulsing rings around hub cities */
  const hubRings = [];
  allRoutePoints.filter((r) => r.hub).forEach((r) => {
    const pos = lonLatToVec3(r.lon, r.lat, radius * 1.02);
    const ring = new THREE.Mesh(
      new THREE.RingGeometry(0.07, 0.085, 32),
      new THREE.MeshBasicMaterial({ color: RED, transparent: true, opacity: 0.7, side: THREE.DoubleSide })
    );
    ring.position.copy(pos);
    ring.lookAt(pos.clone().multiplyScalar(2));
    ring.userData.phase = Math.random() * Math.PI * 2;
    ring.userData.code = r.code;
    hubRings.push(ring);
    globeGroup.add(ring);
  });

  /* ===== 4. FLIGHT ARCS — one per route from KUL ===== */
  const arcGroup = new THREE.Group();
  globeGroup.add(arcGroup);

  const arcsByCode = new Map(); /* code → { tube, glow, plane, trail, mat, glowMat, defaultOpacity } */
  const travelers = [];

  routes.forEach((tgt, idx) => {
    const start = lonLatToVec3(HUB_DATA.lon, HUB_DATA.lat, radius * 1.01);
    const end = lonLatToVec3(tgt.lon, tgt.lat, radius * 1.01);
    const mid = start.clone().add(end).multiplyScalar(0.5);
    const dist = start.distanceTo(end);
    const lift = radius + dist * 0.55;
    mid.normalize().multiplyScalar(lift);

    const curve = new THREE.QuadraticBezierCurve3(start, mid, end);

    const isMajor = !!tgt.hub;
    const arcColor = isMajor ? RED : (idx % 2 === 0 ? GOLD : 0xff8a5c);
    const baseOpacity = isMajor ? 0.78 : 0.45;

    const tubeMat = new THREE.MeshBasicMaterial({
      color: arcColor, transparent: true, opacity: baseOpacity,
    });
    const tube = new THREE.Mesh(
      new THREE.TubeGeometry(curve, 64, isMajor ? 0.011 : 0.007, 8, false),
      tubeMat
    );
    arcGroup.add(tube);

    const glowMat = new THREE.MeshBasicMaterial({
      color: arcColor, transparent: true, opacity: isMajor ? 0.18 : 0.10,
    });
    const glow = new THREE.Mesh(
      new THREE.TubeGeometry(curve, 64, isMajor ? 0.022 : 0.014, 8, false),
      glowMat
    );
    arcGroup.add(glow);

    /* moving plane along arc */
    const plane = new THREE.Mesh(
      new THREE.ConeGeometry(0.025, 0.08, 4),
      new THREE.MeshBasicMaterial({ color: WHITE })
    );
    plane.userData = { curve, t: Math.random(), speed: 0.0014 + Math.random() * 0.0022 };
    arcGroup.add(plane);
    travelers.push(plane);

    const trail = new THREE.Mesh(
      new THREE.SphereGeometry(0.03, 12, 12),
      new THREE.MeshBasicMaterial({ color: arcColor, transparent: true, opacity: 0.7 })
    );
    trail.userData = { plane, offset: 0.04 };
    arcGroup.add(trail);
    travelers.push(trail);

    arcsByCode.set(tgt.code, {
      tube, glow, plane, trail, tubeMat, glowMat,
      baseTubeOpacity: baseOpacity,
      baseGlowOpacity: isMajor ? 0.18 : 0.10,
    });
  });

  /* KL hub — pulsing red ring around its dot */
  const klPos = lonLatToVec3(HUB_DATA.lon, HUB_DATA.lat, radius * 1.025);
  const klRing = new THREE.Mesh(
    new THREE.RingGeometry(0.11, 0.14, 48),
    new THREE.MeshBasicMaterial({ color: RED, transparent: true, opacity: 0.9, side: THREE.DoubleSide }),
  );
  klRing.position.copy(klPos);
  klRing.lookAt(klPos.clone().multiplyScalar(2));
  globeGroup.add(klRing);

  /* ===== 5. ATMOSPHERIC HALO — tight soft-white rim, then a wider warm red glow ===== */
  /* Inner rim: soft white, hugs the sphere edge */
  const rimGeo = new THREE.SphereGeometry(radius * 1.06, 64, 48);
  const rimMat = new THREE.ShaderMaterial({
    transparent: true,
    side: THREE.BackSide,
    depthWrite: false,
    uniforms: { uColor: { value: new THREE.Color(0xeaf1ff) } },
    vertexShader: `
      varying vec3 vNormal;
      void main() {
        vNormal = normalize(normalMatrix * normal);
        gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
      }
    `,
    fragmentShader: `
      varying vec3 vNormal;
      uniform vec3 uColor;
      void main() {
        float i = pow(0.85 - dot(vNormal, vec3(0,0,1.0)), 5.0);
        gl_FragColor = vec4(uColor, 1.0) * i * 0.55;
      }
    `,
  });
  globeGroup.add(new THREE.Mesh(rimGeo, rimMat));

  /* Outer halo removed — the inner soft-white rim is enough; no colored backlight */

  /* ===== 6. STARFIELD ===== */
  const starGeo = new THREE.BufferGeometry();
  const starPos = [];
  for (let i = 0; i < 1500; i++) {
    const r = 25 + Math.random() * 35;
    const theta = Math.random() * Math.PI * 2;
    const phi = Math.acos(2 * Math.random() - 1);
    starPos.push(
      r * Math.sin(phi) * Math.cos(theta),
      r * Math.cos(phi),
      r * Math.sin(phi) * Math.sin(theta),
    );
  }
  starGeo.setAttribute('position', new THREE.Float32BufferAttribute(starPos, 3));
  const stars = new THREE.Points(starGeo, new THREE.PointsMaterial({
    color: WHITE, size: 0.06, transparent: true, opacity: 0.7, sizeAttenuation: true,
  }));
  scene.add(stars);

  /* ===== 7. ORIENTATION ===== */
  globeGroup.rotation.y = 0.6;
  globeGroup.rotation.x = 0.18;

  function place() {
    const w = canvas.clientWidth || 600;
    if (w < 600) {
      globeGroup.scale.setScalar(0.92);
      camera.position.z = 11.5;
    } else {
      globeGroup.scale.setScalar(1);
      camera.position.z = 10.8;
    }
  }
  place();
  function resize() {
    const w = canvas.clientWidth || window.innerWidth;
    const h = canvas.clientHeight || window.innerHeight;
    renderer.setSize(w, h, false);
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
    place();
  }
  resize();
  window.addEventListener('resize', resize);

  /* ===== 8. INTERACTION — drag-to-rotate ===== */
  const drag = { active: false, lastX: 0, lastY: 0, vx: 0, vy: 0, idle: 0 };
  let autoRotate = true;
  let interacted = false;

  function dimHint() {
    if (interacted || !hintEl) return;
    interacted = true;
    hintEl.classList.add('is-faded');
  }

  canvas.addEventListener('pointerdown', (e) => {
    drag.active = true;
    drag.lastX = e.clientX;
    drag.lastY = e.clientY;
    drag.vx = 0; drag.vy = 0;
    autoRotate = false;
    stageEl.classList.add('is-dragging');
    canvas.setPointerCapture(e.pointerId);
    dimHint();
  });
  canvas.addEventListener('pointermove', (e) => {
    if (drag.active) {
      const dx = (e.clientX - drag.lastX) / 220;
      const dy = (e.clientY - drag.lastY) / 220;
      drag.vx = dx;
      drag.vy = dy;
      globeGroup.rotation.y += dx;
      globeGroup.rotation.x = Math.max(-1.1, Math.min(1.1, globeGroup.rotation.x + dy));
      drag.lastX = e.clientX;
      drag.lastY = e.clientY;
      drag.idle = 0;
    }
    handleHover(e);
  });
  function endDrag(e) {
    if (!drag.active) return;
    drag.active = false;
    stageEl.classList.remove('is-dragging');
    if (e && e.pointerId !== undefined) {
      try { canvas.releasePointerCapture(e.pointerId); } catch (_) {}
    }
  }
  canvas.addEventListener('pointerup', endDrag);
  canvas.addEventListener('pointercancel', endDrag);
  canvas.addEventListener('pointerleave', () => {
    hideTooltip();
  });

  /* ===== 9. RAYCASTER for hover tooltip on route dots ===== */
  const raycaster = new THREE.Raycaster();
  raycaster.params.Points = { threshold: 0.06 };
  const ndc = new THREE.Vector2();
  let hoveredCode = null;

  function handleHover(e) {
    if (!cityPickMeshes.length) return;
    const rect = canvas.getBoundingClientRect();
    ndc.x = ((e.clientX - rect.left) / rect.width) * 2 - 1;
    ndc.y = -((e.clientY - rect.top) / rect.height) * 2 + 1;
    raycaster.setFromCamera(ndc, camera);
    const hits = raycaster.intersectObjects(cityPickMeshes, false);
    if (hits.length) {
      const hit = hits[0].object;
      const r = hit.userData.route;
      showTooltip(r, e.clientX - rect.left, e.clientY - rect.top);
      if (hoveredCode !== r.code) {
        hoveredCode = r.code;
        if (r.code !== 'KUL') highlightArc(r.code);
        updateActiveListItem(r.code);
      }
      canvas.style.cursor = drag.active ? 'grabbing' : 'pointer';
    } else {
      hideTooltip();
      if (hoveredCode) {
        hoveredCode = null;
        clearArcHighlight();
        updateActiveListItem(null);
      }
      canvas.style.cursor = drag.active ? 'grabbing' : 'grab';
    }
  }

  function showTooltip(r, x, y) {
    if (!tooltipEl) return;
    tooltipCode.textContent = r.code;
    tooltipName.textContent = r.city;
    tooltipCountry.textContent = r.country + (r.code === 'KUL' ? ' · Home base' : '');
    tooltipEl.style.transform = `translate(calc(${x}px - 50%), calc(${y}px - 120%))`;
    tooltipEl.classList.add('is-visible');
  }
  function hideTooltip() {
    if (tooltipEl) tooltipEl.classList.remove('is-visible');
  }

  /* ===== 10. ARC HIGHLIGHTING ===== */
  function highlightArc(code) {
    arcsByCode.forEach((arc, c) => {
      if (c === code) {
        arc.tubeMat.opacity = 1;
        arc.tubeMat.color.setHex(RED);
        arc.glowMat.opacity = 0.4;
        arc.glowMat.color.setHex(RED);
      } else {
        arc.tubeMat.opacity = arc.baseTubeOpacity * 0.18;
        arc.glowMat.opacity = arc.baseGlowOpacity * 0.18;
      }
    });
  }
  function clearArcHighlight() {
    arcsByCode.forEach((arc) => {
      arc.tubeMat.opacity = arc.baseTubeOpacity;
      arc.glowMat.opacity = arc.baseGlowOpacity;
      /* restore color from route data */
      const code = [...arcsByCode.entries()].find(([, v]) => v === arc)[0];
      const route = routes.find((r) => r.code === code);
      const original = route.hub ? RED : (routes.indexOf(route) % 2 === 0 ? GOLD : 0xff8a5c);
      arc.tubeMat.color.setHex(original);
      arc.glowMat.color.setHex(original);
    });
  }

  /* ===== 11. ROUTE LIST UI ===== */
  if (routeListEl) {
    /* Sort: hubs first, then alphabetical */
    const ordered = [...routes].sort((a, b) => {
      if (!!a.hub !== !!b.hub) return a.hub ? -1 : 1;
      return a.city.localeCompare(b.city);
    });
    const frag = document.createDocumentFragment();
    ordered.forEach((r) => {
      const li = document.createElement('li');
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'route-item' + (r.hub ? ' route-item--hub' : '');
      btn.dataset.code = r.code;
      btn.innerHTML =
        '<span class="route-item__code">KUL → ' + r.code + '</span>' +
        '<span class="route-item__city">' + r.city + '<span class="route-item__country">' + r.country + '</span></span>' +
        '<svg class="route-item__arrow" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" aria-hidden="true">' +
          '<path d="M7 17L17 7M9 7h8v8"/>' +
        '</svg>';
      btn.addEventListener('mouseenter', () => {
        highlightArc(r.code);
        updateActiveListItem(r.code);
        dimHint();
      });
      btn.addEventListener('mouseleave', () => {
        clearArcHighlight();
        updateActiveListItem(null);
      });
      btn.addEventListener('click', () => {
        spinTo(r);
      });
      li.appendChild(btn);
      frag.appendChild(li);
    });
    routeListEl.appendChild(frag);
    if (routesCountEl) routesCountEl.textContent = routes.length + ' active routes';
  }

  function updateActiveListItem(code) {
    if (!routeListEl) return;
    routeListEl.querySelectorAll('.route-item').forEach((el) => {
      el.classList.toggle('is-active', el.dataset.code === code);
    });
  }

  /* Smoothly rotate the globe so the destination faces the camera */
  let spin = null;
  function spinTo(route) {
    autoRotate = false;
    /* Target Y rotation: align route lon with camera (camera at +Z, looking -Z).
       Our lonLat→world maps east at +X, so to face camera we want lon ≈ -90°.
       Compensate by rotating globe by (-lon - 90)° plus initial 0 — derived empirically. */
    const targetY = THREE.MathUtils.degToRad(-route.lon - 90);
    const targetX = THREE.MathUtils.degToRad(route.lat * 0.6 - 10);
    spin = {
      fromY: globeGroup.rotation.y,
      toY: nearestAngle(globeGroup.rotation.y, targetY),
      fromX: globeGroup.rotation.x,
      toX: targetX,
      t: 0,
      dur: 1.4,
    };
    highlightArc(route.code);
    updateActiveListItem(route.code);
  }
  function nearestAngle(from, to) {
    /* Pick the equivalent angle within ±π of `from` so we take the shortest path */
    const TAU = Math.PI * 2;
    let d = ((to - from) % TAU + TAU) % TAU;
    if (d > Math.PI) d -= TAU;
    return from + d;
  }

  /* ===== 12. ANIMATION LOOP ===== */
  let last = performance.now();
  function tick(now) {
    const dt = Math.min(0.05, (now - last) / 1000);
    last = now;
    const time = now * 0.001;

    if (!drag.active) {
      drag.idle += dt;
      /* gentle inertia after a drag release */
      if (Math.abs(drag.vx) > 0.0001 || Math.abs(drag.vy) > 0.0001) {
        globeGroup.rotation.y += drag.vx;
        globeGroup.rotation.x = Math.max(-1.1, Math.min(1.1, globeGroup.rotation.x + drag.vy));
        drag.vx *= 0.92;
        drag.vy *= 0.92;
      } else if (autoRotate && drag.idle > 0.4 && !hoveredCode && !spin) {
        globeGroup.rotation.y += 0.0018;
      }
    }

    /* Spin-to animation */
    if (spin) {
      spin.t += dt / spin.dur;
      const e = 1 - Math.pow(1 - Math.min(spin.t, 1), 3); /* easeOutCubic */
      globeGroup.rotation.y = spin.fromY + (spin.toY - spin.fromY) * e;
      globeGroup.rotation.x = spin.fromX + (spin.toX - spin.fromX) * e;
      if (spin.t >= 1) spin = null;
    }

    /* Travelers */
    travelers.forEach((obj) => {
      if (obj.userData.curve) {
        obj.userData.t += obj.userData.speed;
        if (obj.userData.t > 1) obj.userData.t = 0;
        const p = obj.userData.curve.getPoint(obj.userData.t);
        obj.position.copy(p);
        const tangent = obj.userData.curve.getTangent(Math.min(obj.userData.t + 0.001, 1));
        obj.lookAt(p.clone().add(tangent));
        obj.rotateX(-Math.PI / 2);
      } else if (obj.userData.plane) {
        const plane = obj.userData.plane;
        const t = Math.max(plane.userData.t - obj.userData.offset, 0);
        const p = plane.userData.curve.getPoint(t);
        obj.position.copy(p);
        obj.scale.setScalar(0.6 + Math.sin(time * 4 + plane.userData.t * 10) * 0.2);
      }
    });

    /* Hub ring pulse */
    hubRings.forEach((ring) => {
      const pulse = (Math.sin(time * 1.6 + ring.userData.phase) + 1) * 0.5;
      ring.scale.setScalar(1 + pulse * 0.6);
      ring.material.opacity = 0.7 - pulse * 0.6;
    });
    const klPulse = (Math.sin(time * 2) + 1) * 0.5;
    klRing.scale.setScalar(1 + klPulse * 0.9);
    klRing.material.opacity = 0.9 - klPulse * 0.85;

    /* Hovered city dot — gentle scale up */
    cityPickMeshes.forEach((m) => {
      const target = (hoveredCode && m.userData.route.code === hoveredCode) ? 1.6 : 1.0;
      m.scale.x += (target - m.scale.x) * 0.18;
      m.scale.y = m.scale.x;
      m.scale.z = m.scale.x;
    });

    stars.rotation.y += 0.0002;

    renderer.render(scene, camera);
    requestAnimationFrame(tick);
  }
  requestAnimationFrame(tick);
})();

/* ---------- HERO INTRO (called after loader) ---------- */
function playHeroIntro() {
  /* Subtle fade-up for beat 1 — uses fromTo so end state is guaranteed visible */
  gsap.fromTo('.hero__beat--1 .hero__beat-tag',
    { y: -10, opacity: 0 },
    { y: 0, opacity: 1, duration: 0.9, ease: 'expo.out' });

  gsap.fromTo('.hero__beat--1 .hero__beat-title',
    { y: 60, opacity: 0 },
    { y: 0, opacity: 1, duration: 1.2, ease: 'expo.out', delay: 0.1 });

  gsap.fromTo('.hero__beat--1 .hero__beat-sub, .hero__beat--1 .hero__beat-meta',
    { y: 20, opacity: 0 },
    { y: 0, opacity: 1, duration: 0.9, ease: 'expo.out', stagger: 0.1, delay: 0.55 });

  gsap.fromTo('.hero__corner, .hero__progress, .hero__ticker',
    { opacity: 0 },
    { opacity: 1, duration: 1, ease: 'expo.out', delay: 0.85, stagger: 0.1 });
}

/* ---------- SECTION REVEALS ---------- */
(function reveals() {
  const has = (selector) => document.querySelector(selector);

  /* Heading fade/slide reveal — keep inline tags intact (no word-splitting) */
  document.querySelectorAll('.split-text h2, .about__heading h2, .services__title, .flightplan__title, .contact__title').forEach((h) => {
    gsap.from(h, {
      y: 80, opacity: 0, duration: 1.2, ease: 'expo.out',
      scrollTrigger: { trigger: h, start: 'top 88%' },
    });
  });

  /* About body parallax */
  if (has('.about__body')) {
    gsap.from('.about__body p, .value', {
      y: 40, opacity: 0, duration: 1, ease: 'expo.out', stagger: 0.1,
      scrollTrigger: { trigger: '.about__body', start: 'top 80%' },
    });
  }

  /* Service cells rise in */
  if (has('.svc') && has('.services__grid')) {
    gsap.from('.svc', {
      y: 32, opacity: 0, duration: 0.9, ease: 'power3.out', stagger: 0.05,
      scrollTrigger: { trigger: '.services__grid', start: 'top 85%' },
    });
  }

  /* Quote cards reveal staggered */
  gsap.from('.qcard', {
    y: 32, opacity: 0, duration: 0.9, ease: 'power3.out', stagger: 0.10,
    scrollTrigger: { trigger: '.quote-grid', start: 'top 85%' },
  });

  /* Contact card reveal */
  gsap.from('.contact__card', {
    y: 40, opacity: 0, duration: 1, ease: 'expo.out', stagger: 0.1,
    scrollTrigger: { trigger: '.contact__grid', start: 'top 85%' },
  });

  /* Footer big text reveal */
  gsap.from('.foot__big span, .foot__big em', {
    y: 100, opacity: 0, duration: 1.2, ease: 'expo.out', stagger: 0.1,
    scrollTrigger: { trigger: '.foot', start: 'top 75%' },
  });
})();

/* ---------- STATS COUNT-UP ---------- */
(function counters() {
  const stats = gsap.utils.toArray('.stat');
  if (!stats.length) return;

  /* Cards start hidden + offset so they can lift into place when the grid enters view */
  gsap.set(stats, { opacity: 0, y: 32 });

  ScrollTrigger.create({
    trigger: '.stats__grid',
    start: 'top 80%',
    once: true,
    onEnter: () => {
      stats.forEach((stat, i) => {
        const target = parseInt(stat.dataset.count, 10);
        const suffix = stat.dataset.suffix || '';
        const numEl = stat.querySelector('.stat__num');
        const obj = { v: 0 };
        const stagger = i * 0.13;

        /* Card lift-in */
        gsap.to(stat, {
          opacity: 1,
          y: 0,
          duration: 0.9,
          ease: 'power3.out',
          delay: stagger,
        });

        /* Smooth count-up — gentler easing + longer ride than expo.out */
        gsap.to(obj, {
          v: target,
          duration: 2.6,
          ease: 'power2.out',
          delay: stagger,
          onUpdate: () => {
            numEl.textContent = Math.round(obj.v).toLocaleString() + suffix;
          },
          onComplete: () => {
            /* Lock to exact target string in case of rounding drift */
            numEl.textContent = target.toLocaleString() + suffix;
          },
        });
      });
    },
  });
})();



/* ---------- 3D PLANE TILT (about) ---------- */
(function planeTilt() {
  const plane = document.querySelector('.plane-3d');
  if (!plane) return;
  let rx = -15, ry = 25;
  let trx = -15, try_ = 25;
  let auto = true;

  const wrap = plane.parentElement;
  wrap.addEventListener('mousemove', (e) => {
    auto = false;
    const r = wrap.getBoundingClientRect();
    const cx = r.left + r.width / 2;
    const cy = r.top + r.height / 2;
    try_ = ((e.clientX - cx) / r.width) * 60;
    trx = -((e.clientY - cy) / r.height) * 60;
  });
  wrap.addEventListener('mouseleave', () => { auto = true; });

  function loop() {
    if (auto) {
      try_ += 0.25;
      trx = -15 + Math.sin(performance.now() / 1500) * 6;
    }
    rx += (trx - rx) * 0.08;
    ry += (try_ - ry) * 0.08;
    plane.style.transform = `rotateX(${rx}deg) rotateY(${ry}deg)`;
    requestAnimationFrame(loop);
  }
  loop();
})();

/* ---------- HERO: split each beat title into word-spans for progressive reveal ---------- */
(function splitBeatTitlesIntoWords() {
  document.querySelectorAll('.hero__beat-title .line > span').forEach((node) => {
    /* Walk children: keep <em>/<sup>/<br> intact, wrap text-node words in .word spans */
    const result = document.createDocumentFragment();
    node.childNodes.forEach((child) => {
      if (child.nodeType === Node.TEXT_NODE) {
        const parts = child.textContent.split(/(\s+)/);
        parts.forEach((p) => {
          if (p === '') return;
          if (/^\s+$/.test(p)) {
            result.appendChild(document.createTextNode(p));
          } else {
            const w = document.createElement('span');
            w.className = 'word';
            w.textContent = p;
            result.appendChild(w);
          }
        });
      } else {
        /* Element like <em> or <sup> — wrap entire element as one word */
        const w = document.createElement('span');
        w.className = 'word';
        w.appendChild(child.cloneNode(true));
        result.appendChild(w);
      }
    });
    node.innerHTML = '';
    node.appendChild(result);
  });
})();

/* ---------- HERO: AMBIENT VIDEO + SCROLL-SCRUBBED PUSH-IN ---------- */
(function heroVideo() {
  const hero = document.querySelector('.hero');
  const ambient = document.getElementById('heroVideoAmbient');
  const pushin  = document.getElementById('heroVideoPushin');
  const progressBar = document.getElementById('heroProgressBar');
  if (!hero || !ambient || !pushin) return;

  /* Ambient: plays naturally at landing as cinematic backdrop */
  ambient.muted = true;
  ambient.loop = true;
  ambient.playsInline = true;
  ambient.autoplay = true;
  ambient.playbackRate = 0.6;
  ambient.play().catch(() => {
    const resume = () => { ambient.play(); window.removeEventListener('pointerdown', resume); };
    window.addEventListener('pointerdown', resume, { once: true });
  });

  /* Push-in: plays forward; playbackRate is modulated to track scroll position.
     This avoids the choppy "keyframe-jump" you get when seeking AI-encoded MP4s. */
  pushin.muted = true;
  pushin.loop = false;
  pushin.playsInline = true;
  pushin.preload = 'auto';
  pushin.pause();
  let pushinDuration = 0;
  pushin.addEventListener('loadedmetadata', () => {
    pushinDuration = pushin.duration || 0;
  });
  /* Prime the decoder so the first frames are ready when crossfade begins */
  const primePushin = () => {
    pushin.play().then(() => { pushin.pause(); pushin.currentTime = 0; }).catch(() => {});
  };
  if (pushin.readyState >= 1) primePushin();
  else pushin.addEventListener('loadeddata', primePushin, { once: true });

  let pushinIdleTimer = null;
  function syncPushinToScroll(p) {
    if (!pushinDuration) return;
    const target = p * pushinDuration;
    const gap = target - pushin.currentTime;

    if (Math.abs(gap) < 0.04) {
      /* close enough — pause on this frame */
      if (!pushin.paused) pushin.pause();
    } else if (gap > 0) {
      /* scrolling forward — play forward, faster if further behind */
      const rate = Math.max(0.5, Math.min(4, 1 + gap * 2.4));
      try { pushin.playbackRate = rate; } catch (_) {}
      if (pushin.paused) pushin.play().catch(() => {});
    } else {
      /* scrolled back — seek (may snap to nearest keyframe, then pause) */
      if (!pushin.paused) pushin.pause();
      try { pushin.currentTime = Math.max(0, target); } catch (_) {}
    }

    /* Pause shortly after scroll stops so we hold on the frame at scroll position */
    clearTimeout(pushinIdleTimer);
    pushinIdleTimer = setTimeout(() => {
      if (!pushin.paused) pushin.pause();
    }, 180);
  }

  /* BEATS visibility — make beat 1 visible immediately, others hidden */
  const beats = gsap.utils.toArray('.hero__beat');
  beats.forEach((b, i) => {
    gsap.set(b, { opacity: i === 0 ? 1 : 0, y: 0, force3D: true });
  });

  /* Per-beat word ranges (when each beat is "active" within the pinned scroll) */
  const beatRanges = [
    { from: 0.00, to: 0.22 },
    { from: 0.28, to: 0.48 },
    { from: 0.54, to: 0.74 },
    { from: 0.80, to: 1.00 },
  ];
  const beatWordSets = beatRanges.map((_, i) =>
    Array.from(document.querySelectorAll('.hero__beat--' + (i + 1) + ' .word'))
  );

  function lightWordsForBeat(beatIdx, localProgress) {
    const words = beatWordSets[beatIdx];
    if (!words.length) return;
    const cutoff = Math.floor(localProgress * (words.length + 0.6));
    words.forEach((w, i) => {
      w.classList.toggle('is-lit', i < cutoff);
    });
  }

  /* Pin the hero for 300vh of scroll, drive beats via scroll progress */
  ScrollTrigger.create({
    trigger: hero,
    start: 'top top',
    end: '+=300%',
    pin: true,
    anticipatePin: 1,
    invalidateOnRefresh: true,
    onUpdate: (self) => {
      const p = self.progress;
      if (progressBar) progressBar.style.height = (p * 100) + '%';

      /* Crossfade ambient → push-in across first 30% of pinned scroll */
      const fade = Math.max(0, Math.min(1, p / 0.30));
      ambient.style.opacity = (1 - fade).toFixed(3);
      pushin.style.opacity  = fade.toFixed(3);

      /* Drive push-in playback to track scroll position smoothly */
      syncPushinToScroll(p);

      /* Update progress label + light up the active beat's words progressively */
      const label = document.querySelector('.hero__progress-label');
      let activeBeat = 0;
      if (p > 0.78) activeBeat = 3;
      else if (p > 0.52) activeBeat = 2;
      else if (p > 0.26) activeBeat = 1;
      if (label) label.textContent = '0' + (activeBeat + 1) + ' / 04';

      /* Light each active beat's words based on its local progress */
      beatRanges.forEach((r, i) => {
        if (i === activeBeat) {
          const local = (p - r.from) / (r.to - r.from);
          lightWordsForBeat(i, Math.max(0, Math.min(1, local)));
        } else if (p > r.to) {
          /* fully lit if we've already passed it */
          lightWordsForBeat(i, 1);
        } else {
          /* not reached yet */
          lightWordsForBeat(i, 0);
        }
      });
    },
  });

  /* Beat fade timeline — scrubbed by scroll */
  if (beats.length >= 4) {
    const tl = gsap.timeline({
      scrollTrigger: {
        trigger: hero,
        start: 'top top',
        end: '+=300%',
        scrub: 0.6,
      },
    });

    tl.to(beats[0], { opacity: 0, y: -40, duration: 0.06 }, 0.22);

    tl.fromTo(beats[1], { opacity: 0, y: 40 }, { opacity: 1, y: 0, duration: 0.06 }, 0.28);
    tl.to(beats[1], { opacity: 0, y: -40, duration: 0.06 }, 0.48);

    tl.fromTo(beats[2], { opacity: 0, y: 40 }, { opacity: 1, y: 0, duration: 0.06 }, 0.54);
    tl.to(beats[2], { opacity: 0, y: -40, duration: 0.06 }, 0.74);

    tl.fromTo(beats[3], { opacity: 0, y: 40 }, { opacity: 1, y: 0, duration: 0.06 }, 0.80);
  }
})();


/* ---------- SMOOTH ANCHOR SCROLL ---------- */
document.querySelectorAll('a[href^="#"]').forEach((a) => {
  a.addEventListener('click', (e) => {
    const id = a.getAttribute('href');
    if (id.length < 2) return;
    const tgt = document.querySelector(id);
    if (!tgt) return;
    e.preventDefault();
    window.scrollTo({ top: tgt.offsetTop - 60, behavior: 'smooth' });
  });
});

/* (Tech grid uses only CSS-driven SVG animations — no JS needed.) */

/* ---------- FAQ: accordion (one panel open at a time) ---------- */
(function faq() {
  const items = Array.from(document.querySelectorAll('.faq__item'));
  if (!items.length) return;

  items.forEach(item => {
    const btn = item.querySelector('.faq__q');
    if (!btn) return;
    btn.addEventListener('click', () => {
      const willOpen = !item.classList.contains('is-open');
      items.forEach(other => {
        other.classList.remove('is-open');
        const ob = other.querySelector('.faq__q');
        if (ob) ob.setAttribute('aria-expanded', 'false');
      });
      if (willOpen) {
        item.classList.add('is-open');
        btn.setAttribute('aria-expanded', 'true');
      }
    });
  });
})();

/* ---------- CARGO STAGE: image crossfade + numbered index ---------- */
(function cargoStage() {
  const stage = document.getElementById('cargoStage');
  if (!stage) return;
  const items = Array.from(stage.querySelectorAll('.cs-item'));
  const imgs  = Array.from(stage.querySelectorAll('.cargo-stage__img'));
  const numEl  = document.getElementById('cargoStageNum');
  const nameEl = document.getElementById('cargoStageName');
  const progress = document.getElementById('cargoStageProgress');
  if (!items.length || !imgs.length) return;

  const TOTAL = items.length;
  const HOLD_MS = 4000;
  let current = 0;
  let paused = false;
  let progressStart = performance.now();
  let progressRaf;

  function setActive(idx, { fromUser = false } = {}) {
    if (idx === current && !fromUser) return;
    current = idx;
    items.forEach((it, i) => it.classList.toggle('is-active', i === idx));
    imgs.forEach((im, i) => im.classList.toggle('is-active', i === idx));

    /* Smooth text crossfade: fade out → swap → fade in */
    const item = items[idx];
    numEl.classList.add('is-changing');
    nameEl.classList.add('is-changing');
    setTimeout(() => {
      numEl.textContent  = String(idx + 1).padStart(2, '0') + ' / ' + String(TOTAL).padStart(2, '0');
      nameEl.textContent = item.dataset.name;
      numEl.classList.remove('is-changing');
      nameEl.classList.remove('is-changing');
    }, 220);

    progressStart = performance.now();
  }

  function tickProgress(now) {
    if (!paused) {
      const elapsed = now - progressStart;
      const pct = Math.min(100, (elapsed / HOLD_MS) * 100);
      progress.style.width = pct + '%';
      if (elapsed >= HOLD_MS) {
        setActive((current + 1) % TOTAL);
      }
    } else {
      progressStart = now - (parseFloat(progress.style.width || '0') / 100) * HOLD_MS;
    }
    progressRaf = requestAnimationFrame(tickProgress);
  }

  items.forEach((it, i) => {
    it.addEventListener('click', () => setActive(i, { fromUser: true }));
    it.addEventListener('mouseenter', () => { paused = true; });
    it.addEventListener('mouseleave', () => { paused = false; });
  });
  stage.addEventListener('mouseenter', () => { paused = true; });
  stage.addEventListener('mouseleave', () => { paused = false; });

  /* Pause autoplay when off-screen so it doesn't burn cycles */
  if ('IntersectionObserver' in window) {
    const io = new IntersectionObserver((entries) => {
      entries.forEach(e => { paused = paused || !e.isIntersecting; if (e.isIntersecting && !stage.matches(':hover')) paused = false; });
    }, { threshold: 0.15 });
    io.observe(stage);
  }

  progressRaf = requestAnimationFrame(tickProgress);
})();

/* ---------- TECHNOLOGY STACK: interactive isometric hero ---------- */
(function technologyStack() {
  const mount = document.getElementById('techStack');
  if (!mount) return;

  const svgNS = 'http://www.w3.org/2000/svg';
  const layers = [
    { id: 0, yBase: 490, side: 'left', title: 'Smart Booking', icon: 'calendar', color: '#DE1D2A', topGrad: ['#F06A72', '#DE1D2A'], sideGrad: ['#B81824', '#7F111A'] },
    { id: 1, yBase: 450, side: 'right', title: 'Real-time Tracking', icon: 'pin', centerIcon: 'locate', color: '#0A1F3D', topGrad: ['#2A4B72', '#0A1F3D'], sideGrad: ['#16345F', '#07162D'] },
    { id: 2, yBase: 410, side: 'left', title: 'Automated Reporting', icon: 'chart', centerIcon: 'lineChart', color: '#EC5360', topGrad: ['#F18A91', '#EC5360'], sideGrad: ['#DE1D2A', '#A81724'] },
    { id: 3, yBase: 370, side: 'right', title: 'Digital Payments', icon: 'card', color: '#26528A', topGrad: ['#5F7EA5', '#26528A'], sideGrad: ['#1D4274', '#102849'] },
    { id: 4, yBase: 330, side: 'left', title: 'Digital POD', icon: 'file', color: '#A81724', topGrad: ['#E44954', '#A81724'], sideGrad: ['#8B1420', '#5E0C15'] },
    { id: 5, yBase: 290, side: 'right', title: 'Integrated Accounting', icon: 'calculator', color: '#16345F', topGrad: ['#496B98', '#16345F'], sideGrad: ['#102849', '#07162D'] },
    { id: 6, yBase: 250, side: 'left', title: 'Partner Connect', icon: 'network', color: '#C7333F', topGrad: ['#EF737C', '#C7333F'], sideGrad: ['#B81824', '#7F111A'] },
    { id: 7, yBase: 210, side: 'right', title: 'Customer Connect', icon: 'users', color: '#454742', topGrad: ['#8D9089', '#454742'], sideGrad: ['#5F625B', '#2D302C'] },
  ];

  const iconMarkup = {
    calendar: '<rect x="5" y="7" width="22" height="20" rx="2.5"/><line x1="5" y1="12" x2="27" y2="12"/><line x1="10" y1="4" x2="10" y2="9"/><line x1="22" y1="4" x2="22" y2="9"/><path d="M11 19l3 3 7-6"/>',
    pin: '<path d="M16 28s8-7.6 8-15a8 8 0 1 0-16 0c0 7.4 8 15 8 15z"/><circle cx="16" cy="13" r="3"/>',
    locate: '<circle cx="16" cy="16" r="6"/><path d="M16 2v4M16 26v4M2 16h4M26 16h4"/>',
    chart: '<line x1="5" y1="27" x2="28" y2="27"/><rect x="7" y="13" width="3" height="14"/><rect x="13" y="7" width="3" height="20"/><rect x="19" y="17" width="3" height="10"/><rect x="25" y="10" width="3" height="17"/>',
    lineChart: '<path d="M5 25h22"/><path d="M7 22l5-6 5 3 7-10"/><path d="M21 9h3v3"/>',
    card: '<rect x="4" y="9" width="24" height="14" rx="2"/><line x1="4" y1="14" x2="28" y2="14"/><line x1="8" y1="20" x2="15" y2="20"/>',
    file: '<path d="M8 4h14l4 4v20H8z"/><path d="M22 4v4h4"/><line x1="12" y1="14" x2="22" y2="14"/><line x1="12" y1="18" x2="20" y2="18"/><path d="M15 23l3 3 6-7"/>',
    calculator: '<rect x="5" y="4" width="22" height="24" rx="2"/><line x1="9" y1="10" x2="23" y2="10"/><circle cx="11" cy="16" r="1"/><circle cx="16" cy="16" r="1"/><circle cx="21" cy="16" r="1"/><circle cx="11" cy="22" r="1"/><circle cx="16" cy="22" r="1"/><circle cx="21" cy="22" r="1"/>',
    network: '<circle cx="8" cy="16" r="4"/><circle cx="24" cy="8" r="4"/><circle cx="24" cy="24" r="4"/><path d="M11.5 14l9-4.5M11.5 18l9 4.5"/>',
    users: '<circle cx="12" cy="11" r="4"/><path d="M5 27c1.4-5 4-8 7-8s5.6 3 7 8"/><circle cx="22" cy="13" r="3"/><path d="M19 20c2.6.6 4.8 2.9 6 7"/>',
  };

  const svg = createSvg('svg', { viewBox: '0 0 1000 650', class: 'tech-stack__svg', role: 'img', 'aria-labelledby': 'techStackTitle' });
  svg.appendChild(createSvg('title', { id: 'techStackTitle' }, 'Interactive layered stack of technology capabilities'));
  const defs = createSvg('defs');
  defs.appendChild(createSvg('filter', { id: 'tech-glow-blur', x: '-50%', y: '-50%', width: '200%', height: '200%' }, [
    createSvg('feGaussianBlur', { stdDeviation: '40' }),
  ]));
  defs.appendChild(createSvg('filter', { id: 'tech-icon-glow', x: '-20%', y: '-20%', width: '140%', height: '140%' }, [
    createSvg('feGaussianBlur', { stdDeviation: '6', result: 'blur' }),
    createSvg('feComposite', { in: 'SourceGraphic', in2: 'blur', operator: 'over' }),
  ]));
  defs.appendChild(createSvg('filter', { id: 'tech-side-texture', x: '-20%', y: '-20%', width: '140%', height: '140%' }, [
    createSvg('feTurbulence', { type: 'fractalNoise', baseFrequency: '0.05 0.005', numOctaves: '3', result: 'noise' }),
    createSvg('feColorMatrix', { type: 'matrix', values: '0.33 0.33 0.33 0 0  0.33 0.33 0.33 0 0  0.33 0.33 0.33 0 0  0 0 0 0.4 0', in: 'noise', result: 'monoNoise' }),
    createSvg('feBlend', { mode: 'overlay', in: 'monoNoise', in2: 'SourceGraphic', result: 'blend' }),
    createSvg('feComposite', { operator: 'in', in: 'blend', in2: 'SourceGraphic' }),
  ]));
  defs.appendChild(createSvg('clipPath', { id: 'tech-front-half-clip' }, [
    createSvg('polygon', { points: '-300,-300 -300,300 300,300' }),
  ]));
  layers.forEach((layer) => {
    defs.appendChild(gradient(`tech-top-grad-${layer.id}`, layer.topGrad));
    defs.appendChild(gradient(`tech-side-grad-${layer.id}`, layer.sideGrad));
  });
  svg.appendChild(defs);

  const floatGroup = createSvg('g', { class: 'tech-stack__float' });
  svg.appendChild(floatGroup);

  const refs = layers.map((layer) => {
    const glow = createSvg('g', { class: 'tech-stack__glow' }, [
      createSvg('ellipse', { cx: '500', cy: String(layer.yBase), rx: '200', ry: '80', fill: `url(#tech-top-grad-${layer.id})`, filter: 'url(#tech-glow-blur)' }),
    ]);
    floatGroup.appendChild(glow);

    const isLeft = layer.side === 'left';
    const xStart = isLeft ? 302 : 698;
    const xEnd = isLeft ? 240 : 760;
    const yLine = layer.yBase + 10;
    const connector = createSvg('g', { class: 'tech-stack__connector', style: `animation-delay:${layer.id * 0.05}s;animation-fill-mode:both` }, [
      createSvg('line', { class: 'tech-stack__line-muted', x1: xStart, y1: yLine, x2: xEnd, y2: yLine }),
      createSvg('line', { class: 'tech-stack__line-active', x1: xStart, y1: yLine, x2: xEnd, y2: yLine, stroke: layer.color, pathLength: '100' }),
      createSvg('line', { class: 'tech-stack__line-shine', x1: xStart, y1: yLine, x2: xEnd, y2: yLine, filter: 'url(#tech-icon-glow)', pathLength: '100' }),
    ]);
    floatGroup.appendChild(connector);

    return { layer, glow, connector };
  });

  const cube = createSvg('g', { class: 'tech-stack__cube' });
  floatGroup.appendChild(cube);

  refs.forEach((ref) => {
    const { layer } = ref;
    const slab = createSvg('g', { class: 'tech-stack__layer' });
    slab.style.setProperty('--active-layer-color', layer.color);
    const positioned = createSvg('g', { class: 'tech-stack__layer-position' });
    slab.appendChild(positioned);
    slab.addEventListener('mouseenter', () => {
      if (introState === 2) setActive(layer.id);
    });

    ref.active = buildActiveLayer(layer);
    ref.solid = buildSolidLayer();
    ref.wire = buildWireLayer();
    positioned.append(ref.active, ref.solid, ref.wire);
    ref.slab = slab;
    ref.positioned = positioned;
    cube.appendChild(slab);
  });

  refs.forEach((ref) => {
    const { layer } = ref;
    const isLeft = layer.side === 'left';
    const foreignObject = createSvg('foreignObject', {
      class: 'tech-stack__label',
      x: isLeft ? '20' : '760',
      y: String(layer.yBase - 5),
      width: '220',
      height: '34',
      style: `--layer-color:${layer.color};animation-delay:${layer.id * 0.05 + 0.2}s;animation-fill-mode:both`,
    });
    const shell = document.createElement('div');
    shell.className = `tech-stack__label-shell tech-stack__label-shell--${layer.side}`;
    shell.innerHTML = `
      <div class="tech-stack__pill">
        ${isLeft ? `<span>${layer.title}</span>${htmlIcon(layer.icon)}` : `${htmlIcon(layer.icon)}<span>${layer.title}</span>`}
        <svg class="tech-stack__label-border" aria-hidden="true"><rect x="0.75" y="0.75" width="98.5%" height="98.5%" rx="14" ry="14" pathLength="100"></rect></svg>
      </div>
    `;
    shell.addEventListener('mouseenter', () => setActive(layer.id));
    foreignObject.appendChild(shell);
    ref.label = foreignObject;
    floatGroup.appendChild(foreignObject);
  });

  mount.appendChild(svg);
  const srList = document.createElement('ul');
  srList.className = 'tech-stack__sr-list';
  srList.innerHTML = layers.map((layer) => `<li>${layer.title}</li>`).join('');
  mount.appendChild(srList);

  let introState = 0;
  let activeIndex = 7;
  let isHovering = false;
  let idleTimer;
  let introTimerExpand;
  let introTimerReady;

  svg.addEventListener('mouseenter', () => {
    isHovering = true;
  });
  svg.addEventListener('mouseleave', () => {
    isHovering = false;
  });

  function setActive(index) {
    activeIndex = index;
    render();
  }

  function render() {
    mount.classList.toggle('is-ready', introState === 2);
    refs.forEach((ref) => {
      const { layer } = ref;
      const isActive = introState === 2 && activeIndex === layer.id;
      const isBelow = introState < 2 || layer.id < activeIndex;
      const yPos = introState === 0 ? 430 - layer.id * 20 : layer.yBase;

      ref.positioned.style.transform = `translate(500px, ${yPos}px)`;
      ref.active.style.display = isActive ? '' : 'none';
      ref.solid.style.display = !isActive && isBelow ? '' : 'none';
      ref.wire.style.display = !isActive && !isBelow ? '' : 'none';
      ref.slab.classList.toggle('is-active', isActive);
      ref.glow.classList.toggle('is-active', isActive);
      ref.connector.classList.toggle('is-active', isActive);
      ref.label.classList.toggle('is-active', isActive);
    });
  }

  introTimerExpand = setTimeout(() => {
    introState = 1;
    render();
  }, 1000);
  introTimerReady = setTimeout(() => {
    introState = 2;
    render();
    idleTimer = setInterval(() => {
      if (!isHovering) {
        setActive(activeIndex - 1 < 0 ? layers.length - 1 : activeIndex - 1);
      }
    }, 3000);
  }, 2200);

  document.addEventListener('visibilitychange', () => {
    if (document.hidden) {
      clearInterval(idleTimer);
      idleTimer = null;
    } else if (introState === 2 && !idleTimer) {
      idleTimer = setInterval(() => {
        if (!isHovering) setActive(activeIndex - 1 < 0 ? layers.length - 1 : activeIndex - 1);
      }, 3000);
    }
  });

  render();

  function buildActiveLayer(layer) {
    const group = createSvg('g');
    const sides = createSvg('g', {
      class: 'tech-stack__active-sides',
      fill: `url(#tech-side-grad-${layer.id})`,
    });
    for (let i = 0; i < 20; i += 1) {
      sides.appendChild(isometricRect({ y: i, rx: 32, fill: `url(#tech-side-grad-${layer.id})` }));
    }
    const top = createSvg('g', { transform: 'scale(1, 0.5) rotate(-45)' }, [
      createSvg('rect', { class: 'tech-stack__top', x: '-140', y: '-140', width: '280', height: '280', rx: '32', stroke: `url(#tech-top-grad-${layer.id})` }),
    ]);
    const centerIcon = svgIcon(layer.centerIcon || layer.icon, layer.sideGrad[1]);
    centerIcon.setAttribute('transform', 'translate(-40 -40) scale(2.5)');
    top.appendChild(centerIcon);
    group.append(sides, top);
    return group;
  }

  function buildSolidLayer() {
    const group = createSvg('g');
    const fill = createSvg('g', { class: 'tech-stack__solid-fill' });
    for (let i = 0; i < 20; i += 1) {
      fill.appendChild(isometricRect({ y: i, rx: 32 }));
    }
    const outline = createSvg('g', { class: 'tech-stack__outline' }, [
      createSvg('g', { transform: 'translate(0, 20) scale(1, 0.5) rotate(-45)' }, [
        createSvg('rect', { x: '-140', y: '-140', width: '280', height: '280', rx: '32', 'clip-path': 'url(#tech-front-half-clip)' }),
      ]),
      createSvg('g', { transform: 'scale(1, 0.5) rotate(-45)' }, [
        createSvg('rect', { x: '-140', y: '-140', width: '280', height: '280', rx: '32', fill: '#dfe5ec' }),
      ]),
      createSvg('line', { x1: '-184.7', y1: '0', x2: '-184.7', y2: '20' }),
      createSvg('line', { x1: '184.7', y1: '0', x2: '184.7', y2: '20' }),
    ]);
    group.append(fill, outline);
    return group;
  }

  function buildWireLayer() {
    return createSvg('g', { class: 'tech-stack__wire' }, [
      createSvg('g', { transform: 'scale(1, 0.5) rotate(-45)' }, [
        createSvg('rect', { x: '-140', y: '-140', width: '280', height: '280', rx: '32' }),
      ]),
      createSvg('g', { transform: 'translate(0, 20) scale(1, 0.5) rotate(-45)' }, [
        createSvg('rect', { x: '-140', y: '-140', width: '280', height: '280', rx: '32', 'clip-path': 'url(#tech-front-half-clip)' }),
      ]),
      createSvg('line', { x1: '-184.7', y1: '0', x2: '-184.7', y2: '20' }),
      createSvg('line', { x1: '184.7', y1: '0', x2: '184.7', y2: '20' }),
    ]);
  }

  function isometricRect({ y, rx, fill }) {
    const attrs = { x: '-140', y: '-140', width: '280', height: '280', rx: String(rx) };
    if (fill) attrs.fill = fill;
    return createSvg('g', { transform: `translate(0, ${y}) scale(1, 0.5) rotate(-45)` }, [
      createSvg('rect', attrs),
    ]);
  }

  function svgIcon(name, stroke) {
    const icon = createSvg('g', {
      class: 'tech-stack__active-icon',
      stroke,
      'stroke-width': '1.8',
      viewBox: '0 0 32 32',
    });
    icon.innerHTML = iconMarkup[name] || iconMarkup.calendar;
    return icon;
  }

  function htmlIcon(name) {
    return `<svg viewBox="0 0 32 32" aria-hidden="true">${iconMarkup[name] || iconMarkup.calendar}</svg>`;
  }

  function gradient(id, stops) {
    return createSvg('linearGradient', { id, x1: '0%', y1: '0%', x2: '100%', y2: '100%' }, [
      createSvg('stop', { offset: '0%', 'stop-color': stops[0] }),
      createSvg('stop', { offset: '100%', 'stop-color': stops[1] }),
    ]);
  }

  function createSvg(tag, attrs = {}, children) {
    const el = document.createElementNS(svgNS, tag);
    Object.entries(attrs).forEach(([key, value]) => el.setAttribute(key, value));
    if (typeof children === 'string') {
      el.textContent = children;
    } else if (Array.isArray(children)) {
      children.forEach((child) => el.appendChild(child));
    }
    return el;
  }

  window.addEventListener('beforeunload', () => {
    clearTimeout(introTimerExpand);
    clearTimeout(introTimerReady);
    clearInterval(idleTimer);
  });
})();

/* ---------- LOOKUP WIDGET: tab switching ---------- */
(function () {
  const tabs = document.querySelectorAll('.lookup__tab');
  const forms = document.querySelectorAll('.lookup__form');
  if (!tabs.length || !forms.length) return;
  tabs.forEach((tab) => {
    tab.addEventListener('click', () => {
      const target = tab.dataset.tab;
      tabs.forEach((t) => {
        const active = t === tab;
        t.classList.toggle('is-active', active);
        t.setAttribute('aria-selected', String(active));
      });
      forms.forEach((f) => {
        f.classList.toggle('is-active', f.dataset.form === target);
      });
    });
  });
  /* From/To swap on the schedule form */
  const swap = document.querySelector('.lookup__swap');
  if (swap) {
    swap.addEventListener('click', () => {
      const form = swap.closest('.lookup__form');
      if (!form) return;
      const inputs = form.querySelectorAll('.lookup__field input');
      if (inputs.length >= 2) {
        const a = inputs[0].value;
        inputs[0].value = inputs[1].value;
        inputs[1].value = a;
      }
    });
  }
})();

/* ---------- FOOTER: shifting brand wordmark + back-to-top ---------- */
(function () {
  const foot = document.getElementById('foot');
  if (!foot) return;
  const rows = foot.querySelectorAll('.foot__big-row');
  if (rows.length && window.gsap && window.ScrollTrigger) {
    rows.forEach((row) => {
      const dir = parseFloat(row.dataset.shift || '1');
      /* x in px keeps the shift bounded regardless of how wide the
         wordmark gets at large viewports. xPercent of a 1500px+ block
         pushes the (right-aligned) "Aviation" past the overflow:hidden
         edge and looks invisible at rest. */
      gsap.fromTo(
        row,
        { x: dir * 60 },
        {
          x: dir * -60,
          ease: 'none',
          scrollTrigger: {
            trigger: foot,
            start: 'top bottom',
            end: 'bottom top',
            scrub: 0.6,
          },
        }
      );
    });

    /* Subtle scroll-driven y-only nudge; never sets opacity:0 so content
       stays visible even if ScrollTrigger fails to refresh. */
    gsap.from('.foot__cols .foot__col', {
      y: 24,
      stagger: 0.08,
      duration: 0.8,
      ease: 'power3.out',
      scrollTrigger: {
        trigger: '.foot__cols',
        start: 'top 92%',
      },
    });
  }

  const topBtn = document.getElementById('footTopBtn');
  if (topBtn) {
    topBtn.addEventListener('click', () => {
      window.scrollTo({ top: 0, behavior: 'smooth' });
    });
  }
})();
