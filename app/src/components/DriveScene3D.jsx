import { useEffect, useRef, useState } from 'react';
import * as THREE from 'three';
import { buildCorridor } from '../lib/corridor';
import { elevations } from '../lib/elevation';
import { demSampler } from '../lib/dem';

// The 3D drive: the real routed road, laid on real ground, flown from a
// camera that advances with the preview.
//
// Two things worth knowing before changing this:
//
// • The terrain is drawn DoubleSide on purpose. The index winding here runs
//   the opposite way round from the road ribbon's columns, and a corridor
//   that is silently culled from above is a miserable bug to chase — the
//   symptom is "shredded terrain and floating trees" rather than a blank
//   screen. DoubleSide costs little at this triangle count and cannot fail
//   that way.
// • The camera sits close and looks a short way ahead. Parked far back it
//   frames the landscape beautifully and reduces the road to a hairline,
//   which is not what a drive preview is for.

// Once DEM tiles are in hand every sample is a local array read, so the mesh
// can be far finer than an elevation API would ever allow. These numbers are
// what the camera needs to see ground rather than interpolation: a 400 km
// route lands at roughly 700 m along-route spacing.
const ALONG = 560;
const ACROSS = 31;

// If the tiles can't be had, the JSON elevation endpoint is metered, so the
// grid collapses to something it can actually answer.
const COARSE_ALONG = 90;
const COARSE_ACROSS = 9;

// Keeps the road from sawtoothing up and down every rise the sampler catches.
function smoothProfile(values, passes = 3) {
  let a = values.slice();
  for (let p = 0; p < passes; p += 1) {
    const b = a.slice();
    for (let i = 1; i < a.length - 1; i += 1) b[i] = (a[i - 1] + a[i] * 2 + a[i + 1]) / 4;
    a = b;
  }
  return a;
}

// A road cannot climb faster than a road climbs.
function capGrade(values, stepM, maxGrade = 0.09) {
  const max = stepM * maxGrade;
  const out = values.slice();
  for (let i = 1; i < out.length; i += 1) out[i] = Math.min(Math.max(out[i], out[i - 1] - max), out[i - 1] + max);
  for (let i = out.length - 2; i >= 0; i -= 1) out[i] = Math.min(Math.max(out[i], out[i + 1] - max), out[i + 1] + max);
  return out;
}

export default function DriveScene3D({
  path, progress, stops = [], t, onStatus,
}) {
  const mountRef = useRef(null);
  const stateRef = useRef(null);
  const progressRef = useRef(progress);
  const [error, setError] = useState(null);

  progressRef.current = progress;

  useEffect(() => {
    if (!path || path.length < 2 || !mountRef.current) return undefined;
    const mount = mountRef.current;
    let disposed = false;
    let raf = 0;
    const controller = new AbortController();

    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: false });
    renderer.setPixelRatio(Math.min(2, window.devicePixelRatio || 1));
    renderer.setSize(mount.clientWidth, mount.clientHeight, false);
    mount.appendChild(renderer.domElement);
    Object.assign(renderer.domElement.style, { width: '100%', height: '100%', display: 'block' });

    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(58, mount.clientWidth / mount.clientHeight, 5, 120000);

    // Sky: a gradient painted onto a canvas and wrapped round the scene, plus
    // fog in the same tone so the far end of the corridor fades out instead
    // of ending in a visible edge.
    const skyTop = new THREE.Color(t.dark ? '#131A26' : '#7FB2D6');
    const skyLow = new THREE.Color(t.dark ? '#242A2E' : '#DCE6E4');
    const c = document.createElement('canvas');
    c.width = 2; c.height = 256;
    const ctx = c.getContext('2d');
    const grad = ctx.createLinearGradient(0, 0, 0, 256);
    grad.addColorStop(0, `#${skyTop.getHexString()}`);
    grad.addColorStop(1, `#${skyLow.getHexString()}`);
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, 2, 256);
    const skyTex = new THREE.CanvasTexture(c);
    skyTex.colorSpace = THREE.SRGBColorSpace;
    const sky = new THREE.Mesh(
      new THREE.SphereGeometry(90000, 24, 16),
      new THREE.MeshBasicMaterial({ map: skyTex, side: THREE.BackSide, depthWrite: false }),
    );
    scene.add(sky);
    // Fades the far end of the corridor into the sky, so the ground does not
    // simply stop at a visible edge where the samples run out.
    scene.fog = new THREE.Fog(skyLow.getHex(), 1800, 16000);

    scene.add(new THREE.HemisphereLight(skyTop.getHex(), t.dark ? 0x0b0e12 : 0x8a8578, t.dark ? 0.5 : 0.95));
    const sun = new THREE.DirectionalLight(0xffffff, t.dark ? 0.35 : 1.05);
    sun.position.set(-1, 1.4, -1).multiplyScalar(10000);
    scene.add(sun);

    const group = new THREE.Group();
    scene.add(group);

    // ── geometry ────────────────────────────────────────────────────────────
    const build = (corridor, gridH, roadHRaw, source) => {
      if (disposed) return;
      const {
        road, spine, frames: fr, offsets, across, totalM,
      } = corridor;
      const along = spine.length;

      const stepM = totalM / (along - 1);
      const roadH = capGrade(smoothProfile(roadHRaw), stepM);

      // Pull the ground toward road level near the road, so the ribbon sits in
      // the terrain rather than being buried by it or hanging over it. Keep
      // this tight: carve a wide skirt and the whole foreground flattens into
      // a featureless apron, which is most of what the camera can see.
      const FLAT = 40;
      const TAPER = 420;
      const positions = new Float32Array(along * across * 3);
      const colors = new Float32Array(along * across * 3);

      // Colour comes from the height itself — valley floor through rock to
      // snow — so what is on screen is the elevation data rather than a
      // decorative guess.
      const band = (y) => {
        const green = t.dark ? [0.14, 0.19, 0.15] : [0.42, 0.53, 0.34];
        const rock = t.dark ? [0.22, 0.22, 0.21] : [0.49, 0.47, 0.42];
        const snow = t.dark ? [0.62, 0.65, 0.70] : [0.92, 0.93, 0.92];
        const mix = (a, b, f) => a.map((v, i) => v + (b[i] - v) * f);
        if (y < 1250) return green;
        if (y < 2150) return mix(green, rock, (y - 1250) / 900);
        return mix(rock, snow, Math.min(1, (y - 2150) / 700));
      };
      for (let i = 0; i < along; i += 1) {
        for (let j = 0; j < across; j += 1) {
          const x = spine[i].x + fr[i].nx * offsets[j];
          const z = spine[i].z + fr[i].nz * offsets[j];

          // Nearest road point, searched in a window around this row.
          let best = Infinity;
          let bestK = i;
          const lo = Math.max(0, i - 6);
          const hi = Math.min(along - 1, i + 6);
          for (let k = lo; k <= hi; k += 1) {
            const d = (x - road[k].x) ** 2 + (z - road[k].z) ** 2;
            if (d < best) { best = d; bestK = k; }
          }
          const dist = Math.sqrt(best);
          const blend = Math.max(0, Math.min(1, (TAPER - dist) / (TAPER - FLAT))) ** 2;
          const ground = gridH[i * across + j];
          const y = ground * (1 - blend) + roadH[bestK] * blend;

          const o = (i * across + j) * 3;
          positions[o] = x;
          positions[o + 1] = y;
          positions[o + 2] = z;
          const col = band(ground);
          colors[o] = col[0];
          colors[o + 1] = col[1];
          colors[o + 2] = col[2];
        }
      }

      const indices = [];
      for (let i = 0; i < along - 1; i += 1) {
        for (let j = 0; j < across - 1; j += 1) {
          const a = i * across + j;
          const b = a + 1;
          const d = a + across;
          const e = d + 1;
          indices.push(a, d, b, b, d, e);
        }
      }

      const terrainGeo = new THREE.BufferGeometry();
      terrainGeo.setAttribute('position', new THREE.BufferAttribute(positions, 3));
      terrainGeo.setAttribute('color', new THREE.BufferAttribute(colors, 3));
      terrainGeo.setIndex(indices);
      terrainGeo.computeVertexNormals();

      const terrain = new THREE.Mesh(terrainGeo, new THREE.MeshLambertMaterial({
        vertexColors: true,
        side: THREE.DoubleSide,
        flatShading: false,
      }));
      group.add(terrain);

      // The road itself: a ribbon on the real routed line, lifted just clear
      // of the carved ground.
      const LANE = 9;
      const rp = new Float32Array(along * 2 * 3);
      const ruv = new Float32Array(along * 2 * 2);
      let runM = 0;
      for (let i = 0; i < along; i += 1) {
        const a = road[Math.max(0, i - 1)];
        const b = road[Math.min(along - 1, i + 1)];
        let dx = b.x - a.x;
        let dz = b.z - a.z;
        const len = Math.hypot(dx, dz) || 1;
        dx /= len; dz /= len;
        const nx = -dz;
        const nz = dx;
        const y = roadH[i] + 1.2;
        rp[i * 6] = road[i].x + nx * LANE;
        rp[i * 6 + 1] = y;
        rp[i * 6 + 2] = road[i].z + nz * LANE;
        rp[i * 6 + 3] = road[i].x - nx * LANE;
        rp[i * 6 + 4] = y;
        rp[i * 6 + 5] = road[i].z - nz * LANE;

        // v runs in real metres so the lane markings keep their spacing
        // whatever the route length. Painting dashes as individual meshes
        // instead ties their size to the sample spacing, which on a long
        // route turns each "dash" into a 400 m stripe.
        if (i > 0) runM += Math.hypot(road[i].x - road[i - 1].x, road[i].z - road[i - 1].z);
        const v = runM / 40;
        ruv[i * 4] = 0; ruv[i * 4 + 1] = v;
        ruv[i * 4 + 2] = 1; ruv[i * 4 + 3] = v;
      }
      const ri = [];
      for (let i = 0; i < along - 1; i += 1) {
        const a = i * 2;
        ri.push(a, a + 2, a + 1, a + 1, a + 2, a + 3);
      }
      const roadGeo = new THREE.BufferGeometry();
      roadGeo.setAttribute('position', new THREE.BufferAttribute(rp, 3));
      roadGeo.setAttribute('uv', new THREE.BufferAttribute(ruv, 2));
      roadGeo.setIndex(ri);
      roadGeo.computeVertexNormals();

      // Asphalt with a dashed centre line, painted once and repeated along the
      // ribbon — one mesh and one texture rather than a mesh per marking.
      const rc = document.createElement('canvas');
      rc.width = 32; rc.height = 64;
      const rctx = rc.getContext('2d');
      rctx.fillStyle = t.dark ? '#2B2F34' : '#4B4F52';
      rctx.fillRect(0, 0, 32, 64);
      rctx.fillStyle = t.dark ? 'rgba(199,193,178,.85)' : 'rgba(244,239,226,.9)';
      rctx.fillRect(15, 0, 2, 34);                    // dash, then a gap
      rctx.fillStyle = t.dark ? 'rgba(199,193,178,.35)' : 'rgba(244,239,226,.45)';
      rctx.fillRect(1, 0, 1.5, 64);                   // edge lines
      rctx.fillRect(29.5, 0, 1.5, 64);
      const roadTex = new THREE.CanvasTexture(rc);
      roadTex.wrapS = THREE.RepeatWrapping;
      roadTex.wrapT = THREE.RepeatWrapping;
      roadTex.colorSpace = THREE.SRGBColorSpace;
      roadTex.anisotropy = 4;

      group.add(new THREE.Mesh(roadGeo, new THREE.MeshLambertMaterial({
        map: roadTex,
        side: THREE.DoubleSide,
      })));

      // Stops along the route, as markers in their category colour — the same
      // places listed on the route strip, so the drive shows where they are.
      const markerGeo = new THREE.SphereGeometry(38, 12, 10);
      const poleGeo = new THREE.CylinderGeometry(4, 4, 150, 6);
      stops.forEach((s) => {
        const p = corridor.proj.toLocal(s.lat, s.lng);
        let bestK = 0;
        let bestD = Infinity;
        for (let k = 0; k < along; k += 1) {
          const d = (p.x - road[k].x) ** 2 + (p.z - road[k].z) ** 2;
          if (d < bestD) { bestD = d; bestK = k; }
        }
        const baseY = roadH[bestK];
        const col = new THREE.Color(s.categoryColor || t.accent);
        const pole = new THREE.Mesh(poleGeo, new THREE.MeshLambertMaterial({ color: col }));
        pole.position.set(p.x, baseY + 75, p.z);
        group.add(pole);
        const head = new THREE.Mesh(markerGeo, new THREE.MeshBasicMaterial({ color: col }));
        head.position.set(p.x, baseY + 175, p.z);
        group.add(head);
      });

      stateRef.current = {
        road, roadH, along, totalM,
      };
      if (onStatus) onStatus({ ready: true, source });
    };

    const clearGroup = () => {
      while (group.children.length) {
        const child = group.children.pop();
        child.geometry?.dispose?.();
        child.material?.dispose?.();
      }
    };

    // Draw something immediately — a flat draft at low resolution — so the
    // panel is never a blank rectangle while the ground is being fetched.
    const draft = buildCorridor(path, { along: COARSE_ALONG, across: COARSE_ACROSS, halfKm: 6 });
    build(draft, new Array(draft.along * draft.across).fill(0), new Array(draft.along).fill(0), 'flat');

    (async () => {
      // Tiles first: they carry enough detail for a camera that looks about a
      // kilometre ahead, and cost a few dozen requests rather than hundreds.
      const dem = await demSampler([...draft.samples, ...draft.roadLatLng], { signal: controller.signal });
      if (disposed) return;

      if (dem) {
        const fine = buildCorridor(path, { along: ALONG, across: ACROSS, halfKm: 6 });
        const grid = fine.samples.map((p) => dem(p.lat, p.lng));
        const roadHeights = fine.roadLatLng.map((p) => dem(p.lat, p.lng));
        clearGroup();
        build(fine, grid, roadHeights, 'dem');
        return;
      }

      // No tiles: fall back to the metered point API on the coarse grid.
      const all = await elevations([...draft.samples, ...draft.roadLatLng], { signal: controller.signal });
      if (disposed) return;
      if (!all) { if (onStatus) onStatus({ ready: true, source: 'flat' }); return; }
      clearGroup();
      build(draft, all.slice(0, draft.along * draft.across), all.slice(draft.along * draft.across), 'points');
    })();

    // ── camera ──────────────────────────────────────────────────────────────
    const camPos = new THREE.Vector3();
    const lookAt = new THREE.Vector3();
    let first = true;

    // Offsets are in METRES along the route, not fractions of it. A fraction
    // that frames a 40 km hop puts the camera kilometres back on a 400 km one,
    // which is how a chase camera ends up admiring the landscape with the road
    // reduced to a hairline.
    const sampleAt = (metres) => {
      const st = stateRef.current;
      if (!st) return { p: { x: 0, z: 0 }, y: 0 };
      const idx = (metres / st.totalM) * (st.along - 1);
      const i = Math.max(0, Math.min(st.along - 1, Math.round(idx)));
      return { p: st.road[i], y: st.roadH[i] };
    };

    const BEHIND_M = 220;
    const AHEAD_M = 1300;

    const tick = () => {
      if (disposed) return;
      raf = requestAnimationFrame(tick);
      const st = stateRef.current;
      if (!st) { renderer.render(scene, camera); return; }

      const f = Math.max(0, Math.min(1, progressRef.current));
      const hereM = f * st.totalM;
      const ahead = sampleAt(Math.min(st.totalM, hereM + AHEAD_M));
      const behind = sampleAt(Math.max(0, hereM - BEHIND_M));

      // Close chase: a couple of hundred metres back and low enough that the
      // road fills the frame, looking about a kilometre up the carriageway.
      const target = new THREE.Vector3(behind.p.x, behind.y + 42, behind.p.z);
      const aim = new THREE.Vector3(ahead.p.x, ahead.y + 8, ahead.p.z);

      if (first) { camPos.copy(target); lookAt.copy(aim); first = false; } else {
        camPos.lerp(target, 0.14);
        lookAt.lerp(aim, 0.18);
      }
      camera.position.copy(camPos);
      camera.lookAt(lookAt);
      sky.position.copy(camPos);
      renderer.render(scene, camera);
    };
    tick();

    const onResize = () => {
      if (!mount.clientWidth) return;
      renderer.setSize(mount.clientWidth, mount.clientHeight, false);
      camera.aspect = mount.clientWidth / mount.clientHeight;
      camera.updateProjectionMatrix();
    };
    window.addEventListener('resize', onResize);

    return () => {
      disposed = true;
      controller.abort();
      cancelAnimationFrame(raf);
      window.removeEventListener('resize', onResize);
      scene.traverse((o) => { o.geometry?.dispose?.(); o.material?.dispose?.(); });
      skyTex.dispose();
      renderer.dispose();
      if (renderer.domElement.parentNode === mount) mount.removeChild(renderer.domElement);
    };
  }, [path, stops, t, onStatus]);

  useEffect(() => {
    // Surface a WebGL failure rather than showing a black rectangle.
    try {
      const probe = document.createElement('canvas');
      if (!probe.getContext('webgl2') && !probe.getContext('webgl')) {
        setError('This browser can’t draw the 3D view.');
      }
    } catch {
      setError('This browser can’t draw the 3D view.');
    }
  }, []);

  if (error) {
    return (
      <div style={{
        position: 'absolute', inset: 0, display: 'flex', alignItems: 'center',
        justifyContent: 'center', padding: 24, textAlign: 'center',
        fontSize: 13, color: t.body, background: t.chip,
      }}
      >
        {error}
      </div>
    );
  }

  return <div ref={mountRef} style={{ position: 'absolute', inset: 0 }} />;
}
