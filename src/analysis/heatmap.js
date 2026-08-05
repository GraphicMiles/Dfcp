/**
 * heatmap.js
 * Spatial reliability heatmap over the symbol grid.
 * Helps identify problem areas on the screen.
 */

export class Heatmap {
  constructor(width = 24, height = 18) {
    this.w = width;
    this.h = height;
    this.grid = Array.from({ length: height }, () => Array(width).fill(0)); // success count
    this.errorGrid = Array.from({ length: height }, () => Array(width).fill(0));
    this.totalSamples = 0;
  }

  setGridSize(w, h) {
    this.w = w;
    this.h = h;
    this.grid = Array.from({ length: h }, () => Array(w).fill(0));
    this.errorGrid = Array.from({ length: h }, () => Array(w).fill(0));
    this.totalSamples = 0;
  }

  recordSymbol(col, row, success) {
    if (col < 0 || col >= this.w || row < 0 || row >= this.h) return;
    if (success) {
      this.grid[row][col]++;
    } else {
      this.errorGrid[row][col]++;
    }
    this.totalSamples++;
  }

  /**
   * Returns 2D array of reliability [0-1] per cell
   */
  getReliabilityMap() {
    const map = [];
    for (let r = 0; r < this.h; r++) {
      const row = [];
      for (let c = 0; c < this.w; c++) {
        const total = this.grid[r][c] + this.errorGrid[r][c];
        const rel = total > 0 ? this.grid[r][c] / total : 0.5;
        row.push(Math.round(rel * 100) / 100);
      }
      map.push(row);
    }
    return map;
  }

  /**
   * Render to a small canvas context
   */
  draw(ctx, cellSize = 18) {
    const map = this.getReliabilityMap();
    ctx.clearRect(0, 0, ctx.canvas.width, ctx.canvas.height);

    for (let r = 0; r < this.h; r++) {
      for (let c = 0; c < this.w; c++) {
        const rel = map[r][c];
        let color;
        if (rel > 0.92) color = '#22c55e';      // green
        else if (rel > 0.75) color = '#eab308'; // yellow
        else if (rel > 0.5) color = '#f59e0b';  // amber
        else color = '#ef4444';                 // red

        ctx.fillStyle = color;
        ctx.fillRect(c * cellSize, r * cellSize, cellSize - 1, cellSize - 1);
      }
    }
  }

  reset() {
    this.grid = Array.from({ length: this.h }, () => Array(this.w).fill(0));
    this.errorGrid = Array.from({ length: this.h }, () => Array(this.w).fill(0));
    this.totalSamples = 0;
  }
}
