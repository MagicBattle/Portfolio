// Decodes an animated GIF into a THREE.CanvasTexture that advances itself.
import * as THREE from 'three';

let gifuct = null;
async function lib() {
  if (!gifuct) gifuct = await import('gifuct-js');
  return gifuct;
}

export async function loadAnimatedTexture(url, fallbackUrl) {
  try {
    const { parseGIF, decompressFrames } = await lib();
    const buf = await fetch(url).then(r => { if (!r.ok) throw new Error(r.status); return r.arrayBuffer(); });
    const gif = parseGIF(buf);
    const frames = decompressFrames(gif, true);
    if (!frames.length) throw new Error('no frames');
    const W = gif.lsd.width, H = gif.lsd.height;

    const canvas = document.createElement('canvas');
    canvas.width = W; canvas.height = H;
    const ctx = canvas.getContext('2d');
    const patch = document.createElement('canvas');
    const pctx = patch.getContext('2d');

    // Pre-compose every frame so playback is a cheap drawImage.
    const composed = [];
    let prev = null;
    for (const f of frames) {
      if (prev && prev.disposalType === 2) {
        ctx.clearRect(prev.dims.left, prev.dims.top, prev.dims.width, prev.dims.height);
      }
      patch.width = f.dims.width; patch.height = f.dims.height;
      pctx.putImageData(new ImageData(f.patch, f.dims.width, f.dims.height), 0, 0);
      ctx.drawImage(patch, f.dims.left, f.dims.top);
      const c = document.createElement('canvas');
      c.width = W; c.height = H;
      c.getContext('2d').drawImage(canvas, 0, 0);
      composed.push({ canvas: c, delay: Math.max(f.delay || 100, 20) });
      prev = f;
    }

    const out = document.createElement('canvas');
    out.width = W; out.height = H;
    const octx = out.getContext('2d');
    octx.drawImage(composed[0].canvas, 0, 0);
    const tex = new THREE.CanvasTexture(out);
    tex.magFilter = THREE.NearestFilter;
    tex.minFilter = THREE.NearestFilter;
    tex.generateMipmaps = false;
    tex.colorSpace = THREE.SRGBColorSpace;

    let i = 0, acc = 0;
    tex.userData.tick = (dtMs) => {
      acc += dtMs;
      let changed = false;
      while (acc >= composed[i].delay) {
        acc -= composed[i].delay;
        i = (i + 1) % composed.length;
        changed = true;
      }
      if (changed) {
        octx.clearRect(0, 0, W, H);
        octx.drawImage(composed[i].canvas, 0, 0);
        tex.needsUpdate = true;
      }
    };
    tex.userData.aspect = W / H;
    return tex;
  } catch (err) {
    console.warn('gif decode failed, using static sprite', url, err);
    const tex = await new THREE.TextureLoader().loadAsync(fallbackUrl);
    tex.magFilter = THREE.NearestFilter;
    tex.minFilter = THREE.NearestFilter;
    tex.generateMipmaps = false;
    tex.colorSpace = THREE.SRGBColorSpace;
    tex.userData.tick = () => {};
    tex.userData.aspect = tex.image.width / tex.image.height;
    return tex;
  }
}
