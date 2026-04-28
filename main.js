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
  if (loader) loader.classList.add('is-done');
  document.body.style.overflow = '';
  playHeroIntro();
}
window.addEventListener('load', () => {
  setTimeout(dismissLoader, 1500);
});
/* Safety net: dismiss after max 3.5s no matter what */
setTimeout(dismissLoader, 3500);
document.body.style.overflow = 'hidden';

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

/* ---------- THREE.JS GLOBE ---------- */
(function threeScene() {
  const canvas = document.getElementById('globeCanvas');
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
    color: 0x070D1F,
    transparent: true,
    opacity: 0.96,
  });
  globeGroup.add(new THREE.Mesh(coreGeo, coreMat));

  /* ===== 2. LATITUDE / LONGITUDE GRID ===== */
  const gridMat = new THREE.LineBasicMaterial({
    color: 0x4FD2FF,
    transparent: true,
    opacity: 0.22,
  });
  const equatorMat = new THREE.LineBasicMaterial({
    color: RED,
    transparent: true,
    opacity: 0.55,
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

  /* parallels every 15° */
  for (let lat = -75; lat <= 75; lat += 15) {
    globeGroup.add(makeCircle(lat, lat === 0 ? equatorMat : gridMat));
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

  /* ===== 3. CITY NETWORK — ~85 real cities so the globe reads as a global network ===== */
  const cities = [
    /* Asia / SE Asia (clustered — our hub region) */
    [101.7, 3.1, 'KL', true],     /* HUB */
    [103.8, 1.3, 'SIN', true],
    [100.5, 13.7, 'BKK'],
    [106.6, 10.8, 'SGN'],
    [105.9, 21.0, 'HAN'],
    [121.0, 14.6, 'MNL'],
    [114.1, 22.3, 'HKG', true],
    [121.5, 31.2, 'SHA'],
    [116.4, 39.9, 'PEK'],
    [113.3, 23.1, 'CAN'],
    [120.6, 27.0, 'WNZ'],
    [127.0, 37.5, 'ICN', true],
    [139.7, 35.7, 'TYO', true],
    [135.5, 34.7, 'OSA'],
    [125.3, 35.2, 'PUS'],
    [106.8, -6.2, 'CGK'],
    [115.2, -8.7, 'DPS'],
    [80.9, 7.3, 'CMB'],
    [77.2, 28.6, 'DEL', true],
    [72.9, 19.1, 'BOM'],
    [88.4, 22.6, 'CCU'],
    [80.3, 13.1, 'MAA'],
    [90.4, 23.8, 'DAC'],
    [67.0, 24.9, 'KHI'],
    [69.3, 41.3, 'TAS'],
    [85.3, 27.7, 'KTM'],
    /* Middle East (major freight gateways) */
    [55.3, 25.3, 'DXB', true],
    [54.4, 24.5, 'AUH'],
    [51.5, 25.3, 'DOH', true],
    [50.6, 26.2, 'BAH'],
    [46.8, 24.7, 'RUH'],
    [39.2, 21.5, 'JED'],
    [35.2, 31.9, 'AMM'],
    [31.2, 30.0, 'CAI'],
    [44.4, 33.3, 'BGW'],
    [51.4, 35.7, 'IKA'],
    /* Europe */
    [-0.1, 51.5, 'LHR', true],
    [2.3, 48.9, 'CDG', true],
    [4.9, 52.4, 'AMS'],
    [13.4, 52.5, 'BER'],
    [8.7, 50.1, 'FRA', true],
    [9.2, 45.5, 'MXP'],
    [12.5, 41.9, 'FCO'],
    [-3.7, 40.4, 'MAD'],
    [-9.1, 38.7, 'LIS'],
    [4.4, 50.8, 'BRU'],
    [16.4, 48.2, 'VIE'],
    [14.4, 50.1, 'PRG'],
    [21.0, 52.2, 'WAW'],
    [37.6, 55.7, 'SVO'],
    [28.9, 41.0, 'IST', true],
    [23.7, 37.9, 'ATH'],
    [18.1, 59.3, 'ARN'],
    [10.7, 59.9, 'OSL'],
    [12.6, 55.7, 'CPH'],
    /* Africa */
    [3.4, 6.5, 'LOS'],
    [-13.6, 9.5, 'CKY'],
    [36.8, -1.3, 'NBO'],
    [32.6, 15.5, 'KRT'],
    [18.4, -33.9, 'CPT'],
    [28.0, -26.2, 'JNB', true],
    [-17.5, 14.7, 'DKR'],
    [-7.6, 33.6, 'CMN'],
    [9.2, 32.9, 'TUN'],
    /* Americas */
    [-74.0, 40.7, 'JFK', true],
    [-87.6, 41.9, 'ORD'],
    [-77.0, 38.9, 'IAD'],
    [-71.1, 42.4, 'BOS'],
    [-80.2, 25.8, 'MIA'],
    [-95.4, 29.8, 'IAH'],
    [-118.2, 34.1, 'LAX', true],
    [-122.4, 37.8, 'SFO'],
    [-122.3, 47.6, 'SEA'],
    [-79.4, 43.7, 'YYZ'],
    [-73.6, 45.5, 'YUL'],
    [-99.1, 19.4, 'MEX'],
    [-77.0, 8.0, 'PTY'],
    [-58.4, -34.6, 'EZE'],
    [-46.6, -23.6, 'GRU'],
    [-43.2, -22.9, 'GIG'],
    [-70.7, -33.5, 'SCL'],
    [-78.5, -0.2, 'UIO'],
    [-77.0, 12.0, 'BOG'],
    /* Oceania */
    [151.2, -33.8, 'SYD', true],
    [144.9, -37.8, 'MEL'],
    [174.7, -36.8, 'AKL'],
    [115.8, -32.0, 'PER'],
  ];

  const HUB = cities[0]; /* Kuala Lumpur */

  /* All city dots */
  const cityPositions = [];
  const cityHubPositions = [];
  cities.forEach((c) => {
    const v = lonLatToVec3(c[0], c[1], radius * 1.012);
    cityPositions.push(v.x, v.y, v.z);
    if (c[3]) cityHubPositions.push(v.x, v.y, v.z);
  });

  const cityGeo = new THREE.BufferGeometry();
  cityGeo.setAttribute('position', new THREE.Float32BufferAttribute(cityPositions, 3));
  const cityMat = new THREE.PointsMaterial({
    color: RED,
    size: 0.05,
    transparent: true,
    opacity: 0.95,
    sizeAttenuation: true,
  });
  globeGroup.add(new THREE.Points(cityGeo, cityMat));

  /* Hub points — bigger, brighter */
  const hubGeo = new THREE.BufferGeometry();
  hubGeo.setAttribute('position', new THREE.Float32BufferAttribute(cityHubPositions, 3));
  const hubMat = new THREE.PointsMaterial({
    color: WHITE,
    size: 0.11,
    transparent: true,
    opacity: 1,
    sizeAttenuation: true,
  });
  globeGroup.add(new THREE.Points(hubGeo, hubMat));

  /* Pulsing rings around hub cities */
  const hubRings = [];
  cities.filter((c) => c[3]).forEach((c) => {
    const pos = lonLatToVec3(c[0], c[1], radius * 1.018);
    const ringGeo = new THREE.RingGeometry(0.07, 0.085, 32);
    const ringMat = new THREE.MeshBasicMaterial({
      color: RED, transparent: true, opacity: 0.7, side: THREE.DoubleSide,
    });
    const ring = new THREE.Mesh(ringGeo, ringMat);
    ring.position.copy(pos);
    /* orient ring tangent to sphere */
    ring.lookAt(pos.clone().multiplyScalar(2));
    ring.userData.phase = Math.random() * Math.PI * 2;
    hubRings.push(ring);
    globeGroup.add(ring);
  });

  /* ===== 4. FLIGHT ARCS — hub-and-spoke from KL to ~30 destinations ===== */
  const arcGroup = new THREE.Group();
  globeGroup.add(arcGroup);

  const arcDestinations = cities.slice(1).filter(() => Math.random() < 0.35);
  /* Always include the major hubs */
  cities.filter((c) => c[3] && c !== HUB).forEach((c) => {
    if (!arcDestinations.includes(c)) arcDestinations.push(c);
  });

  const travelers = [];
  arcDestinations.forEach((tgt, idx) => {
    const start = lonLatToVec3(HUB[0], HUB[1], radius * 1.01);
    const end = lonLatToVec3(tgt[0], tgt[1], radius * 1.01);
    const mid = start.clone().add(end).multiplyScalar(0.5);
    const dist = start.distanceTo(end);
    const lift = radius + dist * 0.55;
    mid.normalize().multiplyScalar(lift);

    const curve = new THREE.QuadraticBezierCurve3(start, mid, end);

    /* Arc tube — color by tier */
    const isMajor = tgt[3];
    const arcColor = isMajor ? RED : (idx % 2 === 0 ? GOLD : CYAN);
    const tubeGeo = new THREE.TubeGeometry(curve, 64, isMajor ? 0.012 : 0.007, 8, false);
    const arcMat = new THREE.MeshBasicMaterial({
      color: arcColor,
      transparent: true,
      opacity: isMajor ? 0.85 : 0.5,
    });
    const tube = new THREE.Mesh(tubeGeo, arcMat);
    arcGroup.add(tube);

    /* Outer glow tube */
    if (isMajor) {
      const glowGeo = new THREE.TubeGeometry(curve, 64, 0.022, 8, false);
      const glowMat = new THREE.MeshBasicMaterial({
        color: arcColor,
        transparent: true,
        opacity: 0.18,
      });
      arcGroup.add(new THREE.Mesh(glowGeo, glowMat));
    }

    /* Cargo plane — small triangular prism oriented along curve */
    const planeMat = new THREE.MeshBasicMaterial({ color: WHITE });
    const planeGeo = new THREE.ConeGeometry(0.025, 0.08, 4);
    const plane = new THREE.Mesh(planeGeo, planeMat);
    plane.userData = {
      curve,
      t: Math.random(),
      speed: 0.0014 + Math.random() * 0.0022,
    };
    arcGroup.add(plane);
    travelers.push(plane);

    /* Trail glow halo following plane */
    const trailMat = new THREE.MeshBasicMaterial({
      color: arcColor, transparent: true, opacity: 0.7,
    });
    const trailGeo = new THREE.SphereGeometry(0.03, 12, 12);
    const trail = new THREE.Mesh(trailGeo, trailMat);
    trail.userData = { plane, offset: 0.04 };
    arcGroup.add(trail);
    travelers.push(trail);
  });

  /* KL hub — big white sphere with pulsing red ring */
  const klPos = lonLatToVec3(HUB[0], HUB[1], radius * 1.02);
  const klMarker = new THREE.Mesh(
    new THREE.SphereGeometry(0.08, 20, 20),
    new THREE.MeshBasicMaterial({ color: WHITE }),
  );
  klMarker.position.copy(klPos);
  globeGroup.add(klMarker);

  const klRing = new THREE.Mesh(
    new THREE.RingGeometry(0.11, 0.14, 48),
    new THREE.MeshBasicMaterial({ color: RED, transparent: true, opacity: 0.9, side: THREE.DoubleSide }),
  );
  klRing.position.copy(klPos);
  klRing.lookAt(klPos.clone().multiplyScalar(2));
  globeGroup.add(klRing);

  /* ===== 5. ATMOSPHERIC HALO ===== */
  const haloGeo = new THREE.SphereGeometry(radius * 1.18, 64, 48);
  const haloMat = new THREE.ShaderMaterial({
    transparent: true,
    side: THREE.BackSide,
    uniforms: {
      uColor: { value: new THREE.Color(0x4FD2FF) },
    },
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
        float intensity = pow(0.65 - dot(vNormal, vec3(0,0,1.0)), 2.5);
        gl_FragColor = vec4(uColor, 1.0) * intensity;
      }
    `,
  });
  const halo = new THREE.Mesh(haloGeo, haloMat);
  globeGroup.add(halo);

  /* Outer red halo for brand emphasis */
  const haloRedGeo = new THREE.SphereGeometry(radius * 1.32, 48, 32);
  const haloRedMat = new THREE.ShaderMaterial({
    transparent: true,
    side: THREE.BackSide,
    uniforms: { uColor: { value: new THREE.Color(RED) } },
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
        float intensity = pow(0.55 - dot(vNormal, vec3(0,0,1.0)), 4.0);
        gl_FragColor = vec4(uColor, 1.0) * intensity * 0.8;
      }
    `,
  });
  globeGroup.add(new THREE.Mesh(haloRedGeo, haloRedMat));

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

  /* ===== 7. INITIAL ORIENTATION & INTERACTION ===== */
  /* Tilt slightly so equator/arcs read as a horizon */
  globeGroup.rotation.y = 0.6;
  globeGroup.rotation.x = 0.18;

  let pointer = { x: 0, y: 0, tx: 0, ty: 0 };
  window.addEventListener('mousemove', (e) => {
    pointer.tx = (e.clientX / window.innerWidth - 0.5) * 0.4;
    pointer.ty = (e.clientY / window.innerHeight - 0.5) * 0.2;
  });

  let scrollY = 0;
  window.addEventListener('scroll', () => { scrollY = window.scrollY; }, { passive: true });

  function place() {
    const w = window.innerWidth;
    if (w < 768) {
      globeGroup.scale.setScalar(0.85);
      globeGroup.position.set(0, 0, 0);
      camera.position.z = 9.5;
    } else {
      globeGroup.scale.setScalar(1);
      globeGroup.position.set(0, 0, 0);
      camera.position.z = 8.5;
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

  /* ===== 8. ANIMATION LOOP ===== */
  function tick() {
    pointer.x += (pointer.tx - pointer.x) * 0.05;
    pointer.y += (pointer.ty - pointer.y) * 0.05;

    const scrollNorm = Math.min(scrollY / window.innerHeight, 2);
    const time = performance.now() * 0.001;

    /* Continuous revolution + subtle pointer tilt */
    globeGroup.rotation.y += 0.0028;
    globeGroup.rotation.x = 0.18 + pointer.y * 0.3;

    /* Subtle camera parallax */
    camera.position.x = pointer.x * 0.3;
    camera.position.y = -pointer.y * 0.2;
    camera.lookAt(0, 0, 0);

    /* Travelers — planes orient along curve tangent, trails sit slightly behind */
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

    /* Pulse hub rings */
    hubRings.forEach((ring, i) => {
      const pulse = (Math.sin(time * 1.6 + ring.userData.phase) + 1) * 0.5;
      ring.scale.setScalar(1 + pulse * 0.6);
      ring.material.opacity = 0.7 - pulse * 0.6;
    });

    /* KL ring stronger pulse */
    const klPulse = (Math.sin(time * 2) + 1) * 0.5;
    klRing.scale.setScalar(1 + klPulse * 0.9);
    klRing.material.opacity = 0.9 - klPulse * 0.85;

    stars.rotation.y += 0.0002;

    renderer.render(scene, camera);
    requestAnimationFrame(tick);
  }
  tick();
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
  /* Heading fade/slide reveal — keep inline tags intact (no word-splitting) */
  document.querySelectorAll('.split-text h2, .about__heading h2, .services__head h2, .horizon__head h2, .contact__title').forEach((h) => {
    gsap.from(h, {
      y: 80, opacity: 0, duration: 1.2, ease: 'expo.out',
      scrollTrigger: { trigger: h, start: 'top 88%' },
    });
  });

  /* About body parallax */
  gsap.from('.about__body p, .value', {
    y: 40, opacity: 0, duration: 1, ease: 'expo.out', stagger: 0.1,
    scrollTrigger: { trigger: '.about__body', start: 'top 80%' },
  });

  /* Service cards rise in */
  gsap.from('.service', {
    y: 80, opacity: 0, duration: 1.1, ease: 'expo.out', stagger: 0.12,
    scrollTrigger: { trigger: '.services__list', start: 'top 80%' },
  });

  /* Quote cards reveal staggered */
  gsap.from('.quote-card', {
    y: 60, opacity: 0, duration: 1, ease: 'expo.out', stagger: 0.12,
    scrollTrigger: { trigger: '.quote-stack', start: 'top 80%' },
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
  document.querySelectorAll('.stat').forEach((stat) => {
    const target = parseInt(stat.dataset.count, 10);
    const suffix = stat.dataset.suffix || '';
    const numEl = stat.querySelector('.stat__num');
    const obj = { v: 0 };

    ScrollTrigger.create({
      trigger: stat,
      start: 'top 85%',
      once: true,
      onEnter: () => {
        gsap.to(obj, {
          v: target,
          duration: 2.2,
          ease: 'expo.out',
          onUpdate: () => {
            numEl.textContent = Math.round(obj.v).toLocaleString() + suffix;
          },
        });
      },
    });
  });
})();

/* ---------- HORIZONTAL SCROLL (VISION/MISSION) ---------- */
(function horizon() {
  const section = document.querySelector('.horizon');
  const track = document.querySelector('.horizon__track');
  if (!section || !track || window.innerWidth < 900) return;

  const updateAmount = () => {
    return track.scrollWidth - window.innerWidth + 96;
  };

  gsap.to(track, {
    x: () => -updateAmount(),
    ease: 'none',
    scrollTrigger: {
      trigger: section,
      start: 'top top',
      end: () => '+=' + updateAmount(),
      scrub: 0.6,
      pin: true,
      anticipatePin: 1,
      invalidateOnRefresh: true,
    },
  });
})();

/* ---------- SERVICE CARD POINTER GLOW ---------- */
(function serviceGlow() {
  document.querySelectorAll('.service').forEach((card) => {
    card.addEventListener('mousemove', (e) => {
      const r = card.getBoundingClientRect();
      const x = ((e.clientX - r.left) / r.width) * 100;
      const y = ((e.clientY - r.top) / r.height) * 100;
      card.style.setProperty('--mx', x + '%');
      card.style.setProperty('--my', y + '%');
    });
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
