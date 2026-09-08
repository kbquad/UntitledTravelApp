import { useEffect, useRef } from 'react';
import * as THREE from 'three';
import { demSampler } from '../lib/dem';
import {
  tileMosaic, boxAround, lngToGlobalX, latToGlobalY,
} from '../lib/mosaic';

export { MAP3D_CREDIT } from '../lib/mosaic';

const IMAGERY_URL = (x, y, z) => `https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/${z}/${y}/${x}`;

// A map area is an axis-aligned box in Mercator, so unlike the drive corridor
// the ground here is a plain grid and the imagery is a straight tile mosaic —
// UVs interpolate linearly across it with no resampling.
const GRID = 96;          // vertices per side
const VERTICAL = 1.7;     // gentle relief exaggeration; a map read from above
                          // shows almost no shape at true scale

export default function MapScene3D({
  centre, spanM = 9000, stops = [], me, t, selectedId, onSelect, onStatus, sceneApi,
  interactive = true, pinScale = 1,
}) {
  const mountRef = useRef(null);
  const apiRef = useRef(null);
  const stopsRef = useRef(stops);
  const selectedRef = useRef(selectedId);
  const meRef = useRef(me);

  // Rebuilding the world is expensive, so it is keyed on a coarse centre:
  // small movements pan the camera, they do not refetch tiles.
  const key = `${centre.lat.toFixed(2)},${centre.lng.toFixed(2)},${Math.round(spanM)}`;

  useEffect(() => {
    const mount = mountRef.current;
    if (!mount) return undefined;
    let disposed = false;
    let raf = 0;
    const controller = new AbortController();

    let renderer;
    try {
      renderer = new THREE.WebGLRenderer({ antialias: true });
    } catch {
      onStatus?.({ ok: false, reason: 'webgl' });
      return undefined;
    }
    renderer.setPixelRatio(Math.min(2, window.devicePixelRatio || 1));
    renderer.setSize(mount.clientWidth, mount.clientHeight, false);
    mount.appendChild(renderer.domElement);
    Object.assign(renderer.domElement.style, { width: '100%', height: '100%', display: 'block' });

    const scene = new THREE.Scene();
    const sky = new THREE.Color(t.dark ? '#101317' : '#C8D6DE');
    scene.background = sky;
    scene.fog = new THREE.Fog(sky.getHex(), spanM * 0.55, spanM * 1.3);

    const camera = new THREE.PerspectiveCamera(50, mount.clientWidth / mount.clientHeight, 5, spanM * 6);
    scene.add(new THREE.HemisphereLight(0xffffff, t.dark ? 0x0b0e12 : 0x8a8578, t.dark ? 0.55 : 1.0));
    const sun = new THREE.DirectionalLight(0xffffff, t.dark ? 0.3 : 0.85);
    sun.position.set(-1, 1.5, -0.8).multiplyScalar(spanM);
    scene.add(sun);

    const world = new THREE.Group();
    scene.add(world);

    // Local metres, centred on `centre`: +x east, +z south, +y up.
    const mPerDegLat = 110540;
    const mPerDegLng = 111320 * Math.cos((centre.lat * Math.PI) / 180);
    const toLocal = (lat, lng) => ({
      x: (lng - centre.lng) * mPerDegLng,
      z: -(lat - centre.lat) * mPerDegLat,
    });

    const box = boxAround(centre.lat, centre.lng, spanM);
    let heightAt = () => 0;

    const pins = [];        // everything to tear down on the next pass
    const pickables = [];   // what the raycaster is allowed to hit

    const buildMarkers = () => {
      pins.forEach((m) => { world.remove(m); m.geometry.dispose(); m.material.dispose(); });
      pins.length = 0;
      pickables.length = 0;

      (stopsRef.current ?? []).forEach((s) => {
        const p = toLocal(s.lat, s.lng);
        if (Math.abs(p.x) > spanM / 2 || Math.abs(p.z) > spanM / 2) return;
        const ground = heightAt(s.lat, s.lng) * VERTICAL;
        const on = s.id === selectedRef.current;
        const colour = new THREE.Color(s.categoryColor || t.accent);
        // Pins scale with the area, so they stay the same size on screen as
        // the camera pulls back — `pinScale` lifts them in a short header,
        // where the same fraction of the frame is far fewer pixels.
        const size = (spanM / 110) * pinScale;

        // A cone standing on the ground: reads as a pin from any angle, and
        // needs no billboarding to stay legible as the camera orbits.
        const pin = new THREE.Mesh(
          new THREE.ConeGeometry(size * 0.45, size * 1.6, 10),
          new THREE.MeshLambertMaterial({
            color: colour,
            emissive: colour,
            emissiveIntensity: on ? 0.65 : 0.15,
          }),
        );
        pin.position.set(p.x, ground + size * 0.8, p.z);
        pin.userData.stop = s;
        world.add(pin);
        pins.push(pin);

        // A pin drawn at map scale is only a few pixels wide, which is far
        // below what a thumb can reliably hit. Picking goes against an
        // invisible sphere roughly a fingertip across instead — drawn, so the
        // raycaster considers it, but fully transparent and writing no depth.
        const hit = new THREE.Mesh(
          new THREE.SphereGeometry(size * 1.5, 8, 6),
          new THREE.MeshBasicMaterial({ transparent: true, opacity: 0, depthWrite: false }),
        );
        hit.position.copy(pin.position);
        hit.renderOrder = -1;
        hit.userData.stop = s;
        world.add(hit);
        pins.push(hit);
        pickables.push(hit);
      });

      // Where you are, as a ring on the ground — the flat map's blue dot,
      // drawn so it reads at a shallow angle.
      const you = meRef.current;
      if (you) {
        const p = toLocal(you.lat, you.lng);
        if (Math.abs(p.x) <= spanM / 2 && Math.abs(p.z) <= spanM / 2) {
          const r = (spanM / 90) * pinScale;
          const ring = new THREE.Mesh(
            new THREE.TorusGeometry(r, r * 0.16, 8, 28),
            new THREE.MeshBasicMaterial({ color: new THREE.Color(t.accent) }),
          );
          ring.rotation.x = -Math.PI / 2;
          ring.position.set(p.x, heightAt(you.lat, you.lng) * VERTICAL + r * 0.3, p.z);
          world.add(ring);
          pins.push(ring);
        }
      }
    };

    const buildGround = (dem, mosaic) => {
      const half = spanM / 2;
      const positions = new Float32Array(GRID * GRID * 3);
      const uvs = new Float32Array(GRID * GRID * 2);

      for (let i = 0; i < GRID; i += 1) {
        for (let j = 0; j < GRID; j += 1) {
          // Regular grid in local metres, converted back to lat/lng to sample.
          const x = -half + (i / (GRID - 1)) * spanM;
          const z = -half + (j / (GRID - 1)) * spanM;
          const lat = centre.lat - z / mPerDegLat;
          const lng = centre.lng + x / mPerDegLng;
          const h = dem ? dem(lat, lng) : 0;

          const o = (j * GRID + i) * 3;
          positions[o] = x;
          positions[o + 1] = h * VERTICAL;
          positions[o + 2] = z;

          const uo = (j * GRID + i) * 2;
          if (mosaic) {
            uvs[uo] = (lngToGlobalX(lng, mosaic.zoom) - mosaic.minX) / (mosaic.maxX - mosaic.minX);
            // Mercator y grows southward, texture v grows downward: same
            // direction, but three.js samples v from the bottom.
            uvs[uo + 1] = 1 - (latToGlobalY(lat, mosaic.zoom) - mosaic.minY) / (mosaic.maxY - mosaic.minY);
          } else {
            uvs[uo] = i / (GRID - 1);
            uvs[uo + 1] = j / (GRID - 1);
          }
        }
      }

      const index = [];
      for (let i = 0; i < GRID - 1; i += 1) {
        for (let j = 0; j < GRID - 1; j += 1) {
          const a = j * GRID + i;
          const b = a + 1;
          const c = a + GRID;
          const d = c + 1;
          index.push(a, c, b, b, c, d);
        }
      }

      const geo = new THREE.BufferGeometry();
      geo.setAttribute('position', new THREE.BufferAttribute(positions, 3));
      geo.setAttribute('uv', new THREE.BufferAttribute(uvs, 2));
      geo.setIndex(index);
      geo.computeVertexNormals();

      let material;
      if (mosaic) {
        const tex = new THREE.CanvasTexture(mosaic.canvas);
        tex.colorSpace = THREE.SRGBColorSpace;
        tex.anisotropy = renderer.capabilities.getMaxAnisotropy?.() ?? 1;
        tex.wrapS = THREE.ClampToEdgeWrapping;
        tex.wrapT = THREE.ClampToEdgeWrapping;
        material = new THREE.MeshLambertMaterial({
          map: tex,
          color: new THREE.Color(t.dark ? 0x6b7683 : 0xffffff),
        });
      } else {
        material = new THREE.MeshLambertMaterial({ color: new THREE.Color(t.dark ? '#243026' : '#93A585') });
      }

      const ground = new THREE.Mesh(geo, material);
      ground.name = 'ground';
      const old = world.getObjectByName('ground');
      if (old) { world.remove(old); old.geometry.dispose(); old.material.map?.dispose(); old.material.dispose(); }
      world.add(ground);
      buildMarkers();
    };

    buildGround(null, null);

    (async () => {
      const cols = [];
      for (let i = 0; i < 24; i += 1) {
        for (let j = 0; j < 24; j += 1) {
          cols.push({
            lat: box.minLat + ((box.maxLat - box.minLat) * j) / 23,
            lng: box.minLng + ((box.maxLng - box.minLng) * i) / 23,
          });
        }
      }
      const dem = await demSampler(cols, { signal: controller.signal });
      if (disposed) return;
      if (dem) heightAt = dem;

      const mosaic = await tileMosaic({
        box, zoom: 13, urlFor: IMAGERY_URL, signal: controller.signal,
      });
      if (disposed) return;

      buildGround(dem, mosaic);
      onStatus?.({ ok: true, terrain: !!dem, imagery: !!mosaic });
    })();

    // ── camera: orbit around the centre ─────────────────────────────────────
    let yaw = 0;
    let pitch = 0.62;                 // looking down at the ground, not at it edge-on
    let dist = spanM * 0.75;
    const place = () => {
      const cy = Math.cos(pitch);
      camera.position.set(
        Math.sin(yaw) * cy * dist,
        Math.sin(pitch) * dist,
        Math.cos(yaw) * cy * dist,
      );
      camera.lookAt(0, 0, 0);
    };
    place();

    const el = renderer.domElement;
    let dragging = false;
    let lastX = 0;
    let lastY = 0;
    let moved = 0;

    const onDown = (e) => { dragging = true; moved = 0; lastX = e.clientX; lastY = e.clientY; el.setPointerCapture?.(e.pointerId); };
    const onMove = (e) => {
      if (!dragging) return;
      const dx = e.clientX - lastX;
      const dy = e.clientY - lastY;
      moved += Math.abs(dx) + Math.abs(dy);
      lastX = e.clientX;
      lastY = e.clientY;
      yaw -= dx * 0.005;
      pitch = Math.max(0.18, Math.min(1.45, pitch + dy * 0.004));
      place();
    };
    const onUp = (e) => {
      dragging = false;
      // A drag is a camera move; only a tap selects a pin.
      if (moved < 6) pick(e);
    };
    const zoomBy = (factor) => {
      dist = Math.max(spanM * 0.18, Math.min(spanM * 1.6, dist * factor));
      place();
    };
    const onWheel = (e) => {
      e.preventDefault();
      zoomBy(1 + Math.sign(e.deltaY) * 0.12);
    };

    const ray = new THREE.Raycaster();
    const pick = (e) => {
      if (!onSelect) return;
      const r = el.getBoundingClientRect();
      const pointer = new THREE.Vector2(
        ((e.clientX - r.left) / r.width) * 2 - 1,
        -((e.clientY - r.top) / r.height) * 2 + 1,
      );
      ray.setFromCamera(pointer, camera);
      const hit = ray.intersectObjects(pickables, false)[0];
      if (hit) onSelect(hit.object.userData.stop);
    };

    if (interactive) {
      el.style.touchAction = 'none';
      el.addEventListener('pointerdown', onDown);
      el.addEventListener('pointermove', onMove);
      el.addEventListener('pointerup', onUp);
      el.addEventListener('pointercancel', () => { dragging = false; });
      el.addEventListener('wheel', onWheel, { passive: false });
    }

    // Exposed so selection and list changes can refresh the pins without
    // tearing down and refetching the whole world.
    apiRef.current = {
      zoomIn: () => zoomBy(1 / 1.35),
      zoomOut: () => zoomBy(1.35),
      resetView: () => { yaw = 0; pitch = 0.62; dist = spanM * 0.75; place(); },
      refreshMarkers: (nextStops, nextSelected, nextMe) => {
        stopsRef.current = nextStops;
        selectedRef.current = nextSelected;
        meRef.current = nextMe;
        buildMarkers();
      },
    };
    if (sceneApi) sceneApi.current = apiRef.current;

    const tick = () => {
      if (disposed) return;
      raf = requestAnimationFrame(tick);
      if (!interactive) { yaw += 0.0009; place(); }   // a slow drift for the static header
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
      if (sceneApi && sceneApi.current === apiRef.current) sceneApi.current = null;
      controller.abort();
      cancelAnimationFrame(raf);
      window.removeEventListener('resize', onResize);
      el.removeEventListener('pointerdown', onDown);
      el.removeEventListener('pointermove', onMove);
      el.removeEventListener('pointerup', onUp);
      el.removeEventListener('wheel', onWheel);
      scene.traverse((o) => {
        o.geometry?.dispose?.();
        if (o.material) { o.material.map?.dispose?.(); o.material.dispose?.(); }
      });
      renderer.dispose();
      if (renderer.domElement.parentNode === mount) mount.removeChild(renderer.domElement);
    };
    // Rebuilds only when the area or the theme changes; `stops` and selection
    // are handled by the marker pass below.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key, t.dark, interactive]);

  useEffect(() => {
    apiRef.current?.refreshMarkers?.(stops, selectedId, me);
  }, [stops, selectedId, me]);

  return <div ref={mountRef} style={{ position: 'absolute', inset: 0 }} />;
}
