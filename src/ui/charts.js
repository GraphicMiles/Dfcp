/**
 * charts.js
 * Simple canvas-based charts for dashboard and analysis.
 */

export class SimpleLineChart {
  constructor(canvas, options = {}) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d');
    this.data = [];
    this.maxPoints = options.maxPoints || 80;
    this.color = options.color || '#5cf28c';
    this.label = options.label || '';
  }

  push(value) {
    this.data.push(value);
    if (this.data.length > this.maxPoints) this.data.shift();
    this.draw();
  }

  draw() {
    const ctx = this.ctx;
    const w = this.canvas.width;
    const h = this.canvas.height;
    ctx.clearRect(0, 0, w, h);

    if (!this.data.length) return;

    const max = Math.max(...this.data, 1);
    const min = Math.min(...this.data, 0);
    const range = max - min || 1;

    ctx.strokeStyle = this.color;
    ctx.lineWidth = 1.5;
    ctx.beginPath();

    this.data.forEach((v, i) => {
      const x = (i / (this.data.length - 1)) * w;
      const y = h - ((v - min) / range) * (h * 0.9);
      if (i === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    });
    ctx.stroke();

    // baseline
    ctx.strokeStyle = '#1c2b1c';
    ctx.beginPath();
    ctx.moveTo(0, h * 0.92);
    ctx.lineTo(w, h * 0.92);
    ctx.stroke();
  }

  reset() {
    this.data = [];
    this.draw();
  }
}

export class BarChart {
  constructor(canvas) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d');
  }

  draw(labels, values, colors = []) {
    const ctx = this.ctx;
    ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);

    const w = this.canvas.width;
    const h = this.canvas.height;
    const barWidth = (w - 20) / values.length;
    const max = Math.max(...values, 1);

    values.forEach((v, i) => {
      const barH = (v / max) * (h - 24);
      const x = 10 + i * barWidth;
      ctx.fillStyle = colors[i] || '#2f8a52';
      ctx.fillRect(x, h - 10 - barH, barWidth - 6, barH);

      ctx.fillStyle = '#6b7d6b';
      ctx.font = '9px monospace';
      ctx.fillText(labels[i], x + 2, h - 2);
    });
  }
}
