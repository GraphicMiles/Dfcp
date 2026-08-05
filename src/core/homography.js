/**
 * homography.js
 * 4-point homography computation + application.
 * Pure math, portable.
 */

export function computeHomography(src, dst) {
  // src, dst: array of 4 points {x,y}
  // Solve dst = H * src (homogeneous)
  const A = [];
  const b = [];
  for (let i = 0; i < 4; i++) {
    const { x: sx, y: sy } = src[i];
    const { x: dx, y: dy } = dst[i];
    A.push([sx, sy, 1, 0, 0, 0, -sx * dx, -sy * dx]);
    b.push(dx);
    A.push([0, 0, 0, sx, sy, 1, -sx * dy, -sy * dy]);
    b.push(dy);
  }

  const h = solveLinearSystem(A, b);
  return [h[0], h[1], h[2], h[3], h[4], h[5], h[6], h[7], 1];
}

export function solveLinearSystem(A, b) {
  const n = A.length;
  const M = A.map((row, i) => row.concat([b[i]]));

  for (let col = 0; col < n; col++) {
    let piv = col;
    for (let r = col + 1; r < n; r++) {
      if (Math.abs(M[r][col]) > Math.abs(M[piv][col])) piv = r;
    }
    [M[col], M[piv]] = [M[piv], M[col]];

    const pv = M[col][col] || 1e-9;
    for (let c = col; c <= n; c++) M[col][c] /= pv;

    for (let r = 0; r < n; r++) {
      if (r === col) continue;
      const f = M[r][col];
      for (let c = col; c <= n; c++) {
        M[r][c] -= f * M[col][c];
      }
    }
  }
  return M.map(row => row[n]);
}

export function applyHomography(h, x, y) {
  const w = h[6] * x + h[7] * y + h[8];
  if (Math.abs(w) < 1e-9) return { x: 0, y: 0 };
  return {
    x: (h[0] * x + h[1] * y + h[2]) / w,
    y: (h[3] * x + h[4] * y + h[5]) / w
  };
}

export function orderCorners(points) {
  // points: array of 4 {x,y}
  // Return [TL, TR, BR, BL] based on sum and diff
  if (!points || points.length !== 4) return points;

  let tl = points[0], tr = points[0], br = points[0], bl = points[0];
  let minSum = Infinity, maxSum = -Infinity;
  let minDiff = Infinity, maxDiff = -Infinity;

  for (let p of points) {
    const sum = p.x + p.y;
    const diff = p.x - p.y;
    if (sum < minSum) { minSum = sum; tl = p; }
    if (sum > maxSum) { maxSum = sum; br = p; }
    if (diff < minDiff) { minDiff = diff; bl = p; }
    if (diff > maxDiff) { maxDiff = diff; tr = p; }
  }

  // More robust ordering by sorting
  const sorted = [...points].sort((a, b) => (a.x + a.y) - (b.x + b.y));
  const tl2 = sorted[0];
  const br2 = sorted[3];
  const tr2 = sorted[1].x > sorted[2].x ? sorted[1] : sorted[2];
  const bl2 = sorted[1].x < sorted[2].x ? sorted[1] : sorted[2];

  // Fallback to heuristic if needed
  return [tl, tr, br, bl];
}
