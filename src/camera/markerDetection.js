/**
 * markerDetection.js
 * Automatic detection of magenta corner markers.
 * HSV-based color segmentation + contour approximation.
 */

export function rgbToHsv(r, g, b) {
  r /= 255; g /= 255; b /= 255;
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  const d = max - min;
  let h = 0;
  const s = max === 0 ? 0 : d / max;
  const v = max;

  if (d !== 0) {
    if (max === r) h = (g - b) / d + (g < b ? 6 : 0);
    else if (max === g) h = (b - r) / d + 2;
    else h = (r - g) / d + 4;
    h /= 6;
  }
  return [h * 360, s * 100, v * 100];
}

export function detectMagentaMarkers(imageData, width, height, options = {}) {
  const { minArea = 300, maxArea = 8000, hueTol = 25 } = options;
  const data = imageData.data;

  // Create binary mask for magenta: high R+B, low G, hue ~300-330
  const mask = new Uint8Array(width * height);
  let idx = 0;

  for (let i = 0; i < data.length; i += 4) {
    const r = data[i], g = data[i + 1], b = data[i + 2];
    const [h, s, v] = rgbToHsv(r, g, b);

    const isMagenta = (
      r > 160 && b > 160 && g < 130 &&
      (h > 280 || h < 30) && // wraps around 0/360
      s > 45 && v > 45
    );

    mask[idx++] = isMagenta ? 255 : 0;
  }

  // Simple connected components + bounding box
  const components = [];
  const visited = new Uint8Array(width * height);

  const dirs = [[-1,0],[1,0],[0,-1],[0,1],[-1,-1],[-1,1],[1,-1],[1,1]];

  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const mIdx = y * width + x;
      if (mask[mIdx] === 0 || visited[mIdx]) continue;

      // flood fill
      let stack = [[x, y]];
      visited[mIdx] = 1;
      let minX = x, maxX = x, minY = y, maxY = y;
      let area = 1;

      while (stack.length) {
        const [cx, cy] = stack.pop();
        for (const [dx, dy] of dirs) {
          const nx = cx + dx, ny = cy + dy;
          if (nx < 0 || nx >= width || ny < 0 || ny >= height) continue;
          const nIdx = ny * width + nx;
          if (!visited[nIdx] && mask[nIdx]) {
            visited[nIdx] = 1;
            stack.push([nx, ny]);
            area++;
            minX = Math.min(minX, nx);
            maxX = Math.max(maxX, nx);
            minY = Math.min(minY, ny);
            maxY = Math.max(maxY, ny);
          }
        }
      }

      const w = maxX - minX + 1;
      const h = maxY - minY + 1;
      const a = w * h;

      if (area > minArea && area < maxArea && w > 8 && h > 8 && w / h < 3 && h / w < 3) {
        const cx = minX + w / 2;
        const cy = minY + h / 2;
        components.push({ x: cx, y: cy, area, w, h, bbox: { minX, minY, maxX, maxY } });
      }
    }
  }

  // Keep the 4 largest components (expecting the four corners)
  components.sort((a, b) => b.area - a.area);
  const candidates = components.slice(0, 6); // allow a few extras

  if (candidates.length < 4) return null;

  // Order them TL TR BR BL
  const ordered = orderFourPoints(candidates.map(c => ({ x: c.x, y: c.y })));
  return ordered;
}

function orderFourPoints(pts) {
  // Sort by (x+y) for TL/BR and (x-y) for TR/BL
  pts.sort((a, b) => (a.x + a.y) - (b.x + b.y));
  const tl = pts[0];
  const br = pts[pts.length - 1];

  const remaining = pts.slice(1, -1);
  remaining.sort((a, b) => (a.x - a.y) - (b.x - b.y));

  let tr, bl;
  if (remaining.length >= 2) {
    tr = remaining[0];
    bl = remaining[1];
  } else {
    // fallback
    tr = pts[1];
    bl = pts[2] || pts[1];
  }

  // Final sanity: make sure we have four distinct
  const result = [tl, tr, br, bl];
  return result;
}

export function refineMarkerCenters(imageData, candidates, radius = 22) {
  const data = imageData.data;
  const W = imageData.width;
  const refined = [];

  for (let c of candidates) {
    let sx = 0, sy = 0, n = 0;
    const x0 = Math.max(0, Math.floor(c.x - radius));
    const x1 = Math.min(W - 1, Math.floor(c.x + radius));
    const y0 = Math.max(0, Math.floor(c.y - radius));
    const y1 = Math.min(imageData.height - 1, Math.floor(c.y + radius));

    for (let y = y0; y <= y1; y++) {
      for (let x = x0; x <= x1; x++) {
        const i = (y * W + x) * 4;
        const r = data[i], g = data[i + 1], b = data[i + 2];
        if (r > 170 && b > 170 && g < 120) {
          sx += x; sy += y; n++;
        }
      }
    }
    if (n > 5) {
      refined.push({ x: sx / n, y: sy / n });
    } else {
      refined.push(c);
    }
  }
  return refined;
}
