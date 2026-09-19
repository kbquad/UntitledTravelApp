import { useEffect, useRef } from 'react';
import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { demSampler } from '../lib/dem';
import { fetchBuildings, BUILDING_SPAN_M } from '../lib/buildings';
import { pinTexture } from '../lib/pinTexture';
import { labelTexture } from '../lib/labelTexture';
import { categoryColor } from '../theme';
import {
  tileMosaic, boxAround, lngToGlobalX, latToGlobalY, gradeCanvas, GRADE,
} from '../lib/mosaic';

export { MAP3D_CREDIT } from '../lib/mosaic';

const IMAGERY_URL = (x, y, z) => `https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/${z}/${y}/${x}`;

// A map area is an axis-aligned box in Mercator, so unlike the drive corridor
// the ground here is a plain grid and the imagery is a straight tile mosaic —
// UVs interpolate linearly across it with no resampling.

// A signal that fires when either the parent aborts or `ms` passes.
const withDeadline = (parent, ms) => {
  const c = new AbortController();
  const stop = () => c.abort();
  parent.addEventListener('abort', stop, { once: true });
  setTimeout(stop, ms);
  return c.signal;
};

const GRID = 144;         // vertices per side
const VERTICAL = 1.7;     // gentle relief exaggeration; a map read from above
                          // shows almost no shape at true scale

export default function MapScene3D({
  centre, spanM = 5000, stops = [], me, t, selectedId, onSelect, onStatus, sceneApi,
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
    // The top of the design's `scene` gradient, so the horizon behind the
    // terrain is the same sky the flat illustrations use.
    const sky = new THREE.Color(t.dark ? '#131A26' : '#BBD3DE');
    scene.background = sky;
    // The terrain is a finite box, so past its far edge there is nothing but
    // sky at ground level. Fog is what hides that edge — but it has to start
    // beyond the middle of the map, or it hazes the city instead of the
    // horizon. The far corner of the ground sits about spanM * 1.2 from the
    // camera at the resting pitch, so that is where it has to be opaque.
    scene.fog = new THREE.Fog(sky.getHex(), spanM * 0.85, spanM * 1.2);

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

    // Terrain heights are metres above sea level, but the camera orbits the
    // origin. Calgary sits at 1045 m and Denver at 1600 — left absolute, the
    // ground rises a kilometre above the point the camera is looking at and
    // the map renders as sky. So the world is shifted to put the centre's own
    // ground at y=0, and every height is measured from there.
    let baseH = 0;
    const elevOf = (lat, lng) => (heightAt(lat, lng) - baseH) * VERTICAL;

    const pins = [];        // everything to tear down on the next pass
    const pickables = [];   // what the raycaster is allowed to hit
    const labels = [];      // name plates, shown or hidden by the declutterer

    const buildMarkers = () => {
      // Sprite textures are shared and cached by colour, so the material is
      // disposed but its map deliberately is not.
      pins.forEach((m) => { world.remove(m); m.geometry?.dispose?.(); m.material.dispose(); });
      pins.length = 0;
      pickables.length = 0;
      labels.length = 0;

      (stopsRef.current ?? []).forEach((s) => {
        const p = toLocal(s.lat, s.lng);
        if (Math.abs(p.x) > spanM / 2 || Math.abs(p.z) > spanM / 2) return;
        const ground = elevOf(s.lat, s.lng);
        const on = s.id === selectedRef.current;
        const hex = categoryColor(s.category, t.accent);
        // Pins scale with the area, so they stay the same size on screen as
        // the camera pulls back — `pinScale` lifts them in a short header,
        // where the same fraction of the frame is far fewer pixels.
        const size = (spanM / 110) * pinScale;

        // A map pin, drawn as a sprite so it always faces the camera. An
        // earlier version stood a cone on the ground, which on green terrain
        // read as a tree rather than a marker.
        const pin = new THREE.Sprite(new THREE.SpriteMaterial({
          map: pinTexture(hex, on),
          depthTest: true,
          sizeAttenuation: true,
        }));
        pin.scale.set(size * 2, size * 2.6, 1);
        pin.center.set(0.5, 0);          // the point sits on the ground
        pin.position.set(p.x, ground, p.z);
        pin.userData.stop = s;
        pin.renderOrder = 2;
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
        // Centred on the pin head, not on the ground point it stands at.
        hit.position.set(p.x, ground + size * 1.3, p.z);
        hit.renderOrder = -1;
        hit.userData.stop = s;
        world.add(hit);
        pins.push(hit);
        pickables.push(hit);

        // The name plate above the pin. Labels are drawn at a fixed size on
        // screen rather than shrinking with distance — that is what makes a
        // map readable at a glance — so `sizeAttenuation` is off and the
        // sprite is scaled from the viewport in `layoutLabels`.
        const plate = labelTexture(s.name, {
          bg: t.card, fg: t.text, accent: t.accent, selected: on,
        });
        const label = new THREE.Sprite(new THREE.SpriteMaterial({
          map: plate.texture,
          depthTest: false,          // a name is worth seeing over a hillside
          sizeAttenuation: false,
          transparent: true,
        }));
        label.center.set(0.5, 0);
        label.position.set(p.x, ground + size * 1.75, p.z);
        label.renderOrder = 10;
        label.userData = { stop: s, aspect: plate.aspect, selected: on };
        label.visible = false;       // until the declutterer says otherwise
        world.add(label);
        pins.push(label);
        labels.push(label);
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
          ring.position.set(p.x, elevOf(you.lat, you.lng) + r * 0.3, p.z);
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
          const h = dem ? dem(lat, lng) - baseH : 0;

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
        // The mosaic is already graded into the theme, so the material must
        // not tint it a second time.
        material = new THREE.MeshLambertMaterial({ map: tex });
      } else {
        // No imagery: the design's own map colour rather than a guess at grass.
        material = new THREE.MeshLambertMaterial({ color: new THREE.Color(t.mapWater) });
      }

      const ground = new THREE.Mesh(geo, material);
      ground.name = 'ground';
      const old = world.getObjectByName('ground');
      if (old) { world.remove(old); old.geometry.dispose(); old.material.map?.dispose(); old.material.dispose(); }
      world.add(ground);
      buildMarkers();
    };

    // Extrudes footprints onto the terrain as one merged mesh. One mesh per
    // building would be a thousand draw calls for a downtown; merged, a city
    // costs the same as a single object.
    const buildCity = (footprints) => {
      const base = new THREE.Color(t.dark ? '#39414C' : '#EAE5DC');
      const parts = [];
      for (const { ring, height } of footprints) {
        const pts = ring.map((n) => {
          const l = toLocal(n.lat, n.lng);
          return new THREE.Vector2(l.x, l.z);
        });
        // Anything mostly outside the view is not worth carrying.
        if (pts.some((p) => Math.abs(p.x) > spanM / 2 || Math.abs(p.y) > spanM / 2)) continue;

        let geo;
        try {
          geo = new THREE.ExtrudeGeometry(new THREE.Shape(pts), {
            // Same exaggeration the terrain gets, so a building and the hill
            // it stands on are in one vertical world rather than two.
            depth: height * VERTICAL, bevelEnabled: false, curveSegments: 1,
          });
        } catch {
          continue;      // a self-intersecting way earcut can't triangulate
        }
        // The shape is extruded in +z and lies in the xy plane; stand it up so
        // its footprint is on the ground and its height runs along +y.
        geo.rotateX(-Math.PI / 2);
        // Sit it on the terrain under its first corner. Buildings are small
        // next to the DEM's resolution, so one sample each is plenty.
        geo.translate(0, elevOf(ring[0].lat, ring[0].lng), 0);
        geo.deleteAttribute('uv');   // merging needs every part to match

        // A city where every block is the identical grey is the single most
        // synthetic thing on this map. Real roofs and walls vary, so each
        // building gets its own small shift in tone and warmth — keyed off
        // its own position so it stays put between rebuilds rather than
        // shimmering, and kept narrow so the result reads as a city rather
        // than as confetti.
        const seed = Math.abs(Math.sin(ring[0].lat * 12.9898 + ring[0].lng * 78.233) * 43758.5453) % 1;
        const shade = base.clone();
        shade.offsetHSL(
          (seed - 0.5) * 0.035,                 // barely any hue drift
          (seed - 0.5) * 0.04,
          (seed - 0.5) * (t.dark ? 0.10 : 0.13),
        );
        const count = geo.attributes.position.count;
        const colours = new Float32Array(count * 3);
        for (let i = 0; i < count; i += 1) {
          colours[i * 3] = shade.r;
          colours[i * 3 + 1] = shade.g;
          colours[i * 3 + 2] = shade.b;
        }
        geo.setAttribute('color', new THREE.BufferAttribute(colours, 3));
        parts.push(geo);
      }
      if (!parts.length) return;

      const merged = mergeGeometries(parts, false);
      parts.forEach((g) => g.dispose());
      if (!merged) return;
      merged.computeVertexNormals();

      const city = new THREE.Mesh(merged, new THREE.MeshLambertMaterial({
        vertexColors: true,
        flatShading: true,     // so walls and roofs catch the sun differently
      }));
      city.name = 'city';
      const old = world.getObjectByName('city');
      if (old) { world.remove(old); old.geometry.dispose(); old.material.dispose(); }
      world.add(city);
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
      // Terrain and imagery come from different hosts, so they are fetched
      // together rather than one after the other, and both share a deadline:
      // a tile host that is merely slow must not leave the map as a blank
      // plane indefinitely. Past the deadline, whatever arrived is used and
      // the rest is treated as missing — which, if that is everything, hands
      // the screen back to the flat map.
      const deadline = withDeadline(controller.signal, 20000);
      const [dem, mosaic] = await Promise.all([
        // z14 is ~10 m per sample here: finer than the 96-vertex grid, so
        // every vertex gets its own height rather than an interpolated one.
        demSampler(cols, { zoom: 14, signal: deadline }).catch(() => null),
        // z15 is ~5 m per pixel — roughly the screen's own resolution at this
        // span. The mosaic drops a level by itself if that would be too many
        // tiles for a wider view.
        tileMosaic({
          box, zoom: 15, urlFor: IMAGERY_URL, signal: deadline,
        }).catch(() => null),
      ]);
      if (disposed) return;
      if (dem) {
        heightAt = dem;
        baseH = dem(centre.lat, centre.lng);
      }
      if (mosaic) gradeCanvas(mosaic.canvas, t.dark ? GRADE.dark : GRADE.light);

      buildGround(dem, mosaic);
      onStatus?.({ ok: true, terrain: !!dem, imagery: !!mosaic });

      // The city goes on last. It is the slowest of the three fetches and the
      // one the map is least broken without, so nothing waits on it — and
      // Overpass under load can take most of a minute, so it gets its own,
      // longer deadline.
      const city = await fetchBuildings({
        box: boxAround(centre.lat, centre.lng, Math.min(spanM, BUILDING_SPAN_M)),
        signal: withDeadline(controller.signal, 45000),
      });
      if (disposed || !city) return;
      buildCity(city);
      onStatus?.({
        ok: true, terrain: !!dem, imagery: !!mosaic, buildings: city.length,
      });
    })();

    // ── camera: orbit around the centre ─────────────────────────────────────
    let yaw = 0;
    // Low enough that buildings show their sides — straight down, a city is
    // just a pattern of roofs. The header is the exception: it is a wide,
    // short strip, and at a low angle the ground runs out inside the frame
    // and the world reads as a floating island, so it looks down harder.
    const restPitch = interactive ? 0.5 : 1.18;
    const restDist = spanM * (interactive ? 0.75 : 0.54);
    let pitch = restPitch;
    let dist = restDist;
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

    // ── label decluttering ──────────────────────────────────────────────────
    //
    // Every stop gets a name plate, but a city's worth of them overlapping is
    // less readable than none at all. Each pass projects them to the screen,
    // takes them nearest-camera first, and keeps one only if its box is still
    // clear — so the labels you get are the ones closest to you, and they
    // never sit on top of each other. The selected stop always wins.
    //
    // Cheap enough at ~60 labels, but it is O(n²) against what has been
    // accepted, so it runs a few times a second rather than every frame.
    const LABEL_PX = 20;              // on-screen height of a plate
    const GAP_PX = 5;                 // breathing room between plates
    const MAX_LABELS = 16;            // past this a map reads as a word search
    const projected = new THREE.Vector3();

    const layoutLabels = () => {
      const w = mount.clientWidth;
      const h = mount.clientHeight;
      if (!w || !h || !labels.length) return;

      // With sizeAttenuation off, three.js multiplies the sprite's scale by
      // the view depth, cancelling the perspective divide. What is left is
      // scale * (1 / tan(fov/2)) in NDC — so this is the factor that turns a
      // wanted pixel height into the scale that produces it, on both axes.
      const perPx = (2 * Math.tan((camera.fov * Math.PI) / 360)) / h;

      const candidates = [];
      for (const label of labels) {
        label.scale.set(LABEL_PX * label.userData.aspect * perPx, LABEL_PX * perPx, 1);

        projected.copy(label.position).project(camera);
        const behind = projected.z > 1 || projected.z < -1;
        const x = (projected.x * 0.5 + 0.5) * w;
        const y = (-projected.y * 0.5 + 0.5) * h;
        const pw = LABEL_PX * label.userData.aspect;
        // A plate must fit entirely on screen. Letting one hang off the edge
        // reads as a bug, and a half-name is no use anyway.
        if (behind || x - pw / 2 < 4 || x + pw / 2 > w - 4 || y - LABEL_PX < 4 || y > h - 4) {
          label.visible = false;
          continue;
        }
        candidates.push({
          label,
          depth: projected.z,
          // The plate sits above its anchor, hence the -LABEL_PX.
          box: [x - pw / 2 - GAP_PX, y - LABEL_PX - GAP_PX, x + pw / 2 + GAP_PX, y + GAP_PX],
        });
      }

      // Selected first, then nearest. Everything else competes for space.
      candidates.sort((a, b) => {
        if (a.label.userData.selected !== b.label.userData.selected) {
          return a.label.userData.selected ? -1 : 1;
        }
        return a.depth - b.depth;
      });

      const taken = [];
      for (const c of candidates) {
        if (taken.length >= MAX_LABELS) { c.label.visible = false; continue; }
        const [ax0, ay0, ax1, ay1] = c.box;
        let clear = true;
        for (const [bx0, by0, bx1, by1] of taken) {
          if (ax0 < bx1 && ax1 > bx0 && ay0 < by1 && ay1 > by0) { clear = false; break; }
        }
        c.label.visible = clear;
        if (clear) taken.push(c.box);
      }
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
      resetView: () => { yaw = 0; pitch = restPitch; dist = restDist; place(); },
      refreshMarkers: (nextStops, nextSelected, nextMe) => {
        stopsRef.current = nextStops;
        selectedRef.current = nextSelected;
        meRef.current = nextMe;
        buildMarkers();
        layoutLabels();
      },
    };
    if (sceneApi) sceneApi.current = apiRef.current;

    // Labels are re-laid-out a few times a second, not every frame: the
    // pass is O(n^2) against what it has accepted, and nothing moves fast
    // enough for the difference to show.
    let lastLayout = 0;
    const tick = (now = 0) => {
      if (disposed) return;
      raf = requestAnimationFrame(tick);
      if (!interactive) { yaw += 0.0009; place(); }   // a slow drift for the static header
      if (now - lastLayout > 140) { lastLayout = now; layoutLabels(); }
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
        if (!o.material) return;
        // Pin textures are cached across scenes by colour; disposing one here
        // would blank the pins on the next map that asks for that colour.
        if (!o.isSprite) o.material.map?.dispose?.();
        o.material.dispose?.();
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
