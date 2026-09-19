import * as THREE from 'three';

// Name labels for the 3D map.
//
// A field of identical pins tells you where things are but not what they are,
// which is most of what a map is for. These are the little name plates that
// sit above each pin — drawn once per (name, theme) into a canvas and shown as
// a sprite that always faces the camera.
//
// Whether a label is *shown* is decided per frame by the declutterer in
// MapScene3D, not here. This module only knows how to draw one.

const cache = new Map();

const PAD_X = 13;
const PAD_Y = 8;
const FONT_PX = 25;
const RADIUS = 11;
const MAX_W = 360;      // past this the name is ellipsised rather than wrapped
const SCALE = 2;        // drawn at 2x so it stays crisp on a dense screen
const TAIL = 9;         // the little pointer under the plate, aimed at the pin

const FONT = `700 ${FONT_PX}px "Plus Jakarta Sans", system-ui, sans-serif`;

// Measuring needs a context; reuse one rather than making a canvas per call.
let ruler = null;
const measure = (text) => {
  if (!ruler) ruler = document.createElement('canvas').getContext('2d');
  ruler.font = FONT;
  return ruler.measureText(text).width;
};

// Stop names carry a lot of tail: "Devonian Gardens, CORE", "Central
// Library, Level 2". The part before the comma is the name people would
// actually say, so try that before resorting to an ellipsis.
const fit = (text) => {
  if (measure(text) <= MAX_W) return text;
  const head = text.split(',')[0].trim();
  if (head && measure(head) <= MAX_W) return head;
  let cut = head || text;
  while (cut.length > 4 && measure(`${cut}…`) > MAX_W) cut = cut.slice(0, -1);
  return `${cut.replace(/[\s,·-]+$/, '')}…`;
};

const roundRect = (c, x, y, w, h, r) => {
  c.beginPath();
  c.moveTo(x + r, y);
  c.arcTo(x + w, y, x + w, y + h, r);
  c.arcTo(x + w, y + h, x, y + h, r);
  c.arcTo(x, y + h, x, y, r);
  c.arcTo(x, y, x + w, y, r);
  c.closePath();
};

/**
 * A label plate. Returns the texture plus its aspect ratio, because the
 * caller sizes the sprite in screen pixels and needs to know how wide the
 * plate came out.
 */
export function labelTexture(text, {
  bg, fg, accent, selected = false,
}) {
  const label = fit(String(text ?? '').trim() || 'Stop');
  const key = `${label}|${bg}|${fg}|${accent}|${selected ? 1 : 0}`;
  const hit = cache.get(key);
  if (hit) return hit;

  const textW = measure(label);
  const w = Math.ceil(textW + PAD_X * 2);
  const plateH = Math.ceil(FONT_PX + PAD_Y * 2);
  const h = plateH + TAIL;          // room under the plate for the pointer

  const canvas = document.createElement('canvas');
  canvas.width = w * SCALE;
  canvas.height = h * SCALE;
  const c = canvas.getContext('2d');
  c.scale(SCALE, SCALE);

  // Plate and pointer are drawn as one path, so the shadow falls around the
  // silhouette rather than leaving a seam where the two meet.
  const mid = w / 2;
  c.shadowColor = 'rgba(0,0,0,.28)';
  c.shadowBlur = 7;
  c.shadowOffsetY = 2;
  roundRect(c, 1, 1, w - 2, plateH - 2, RADIUS);
  c.moveTo(mid - TAIL * 0.8, plateH - 2);
  c.lineTo(mid, plateH - 2 + TAIL);
  c.lineTo(mid + TAIL * 0.8, plateH - 2);
  c.closePath();
  c.fillStyle = selected ? accent : bg;
  c.fill();
  c.shadowColor = 'transparent';

  // A hairline keeps the plate's edge visible where it lands on something of
  // almost exactly its own brightness.
  c.lineWidth = 1;
  c.strokeStyle = selected ? accent : 'rgba(0,0,0,.14)';
  c.stroke();

  c.font = FONT;
  c.textBaseline = 'middle';
  c.textAlign = 'center';
  c.fillStyle = selected ? '#FFFFFF' : fg;
  c.fillText(label, mid, plateH / 2 + 1);

  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.minFilter = THREE.LinearFilter;
  tex.generateMipmaps = false;

  const made = { texture: tex, aspect: w / h, heightPx: h };
  cache.set(key, made);
  return made;
}
