import * as THREE from 'three';

// The marker the 3D scenes stand on the ground.
//
// Both scenes used to plant a cone at each stop. On green terrain a row of
// coloured cones reads as a line of trees, not as map pins, so the marker is
// now the shape everyone already knows: a teardrop with a hole in it, drawn
// once per colour and shown as a camera-facing sprite.
//
// Textures are cached because a busy map draws the same handful of colours a
// hundred times over, and a canvas per pin would be a hundred uploads to the
// GPU for no visual difference.
const cache = new Map();

const PX = 128;   // texture is square; the pin is drawn into the top of it

export function pinTexture(hex, selected = false) {
  const key = `${hex}|${selected ? 1 : 0}`;
  const hit = cache.get(key);
  if (hit) return hit;

  const canvas = document.createElement('canvas');
  canvas.width = PX;
  canvas.height = Math.round(PX * 1.3);
  const c = canvas.getContext('2d');

  const cx = PX / 2;
  const headR = PX * 0.3;
  const headY = headR + PX * 0.12;
  const tipY = canvas.height - PX * 0.06;

  // A soft contact shadow, so the pin looks planted rather than floating.
  c.fillStyle = 'rgba(0,0,0,.22)';
  c.beginPath();
  c.ellipse(cx, tipY - PX * 0.02, headR * 0.5, headR * 0.16, 0, 0, Math.PI * 2);
  c.fill();

  // Teardrop: the head, then two curves down to the point.
  c.beginPath();
  c.arc(cx, headY, headR, Math.PI * 0.86, Math.PI * 0.14);
  c.quadraticCurveTo(cx + headR * 0.62, tipY - headR * 0.72, cx, tipY);
  c.quadraticCurveTo(cx - headR * 0.62, tipY - headR * 0.72, cx - headR * 0.99, headY + headR * 0.44);
  c.closePath();

  c.fillStyle = hex;
  c.fill();
  // A light rim keeps the pin readable against both dark imagery and snow.
  c.lineWidth = selected ? PX * 0.055 : PX * 0.035;
  c.strokeStyle = selected ? '#FFFFFF' : 'rgba(255,255,255,.82)';
  c.stroke();

  // The hole.
  c.beginPath();
  c.arc(cx, headY, headR * 0.36, 0, Math.PI * 2);
  c.fillStyle = selected ? '#FFFFFF' : 'rgba(255,255,255,.9)';
  c.fill();

  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.minFilter = THREE.LinearFilter;      // no mipmaps: the canvas is not a power of two
  tex.generateMipmaps = false;
  cache.set(key, tex);
  return tex;
}
