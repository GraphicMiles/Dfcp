/**
 * dashboard.js
 * Research dashboard UI: channel metrics, status, heatmap, spectrum.
 */

import { SimpleLineChart } from './charts.js';

export class Dashboard {
  constructor(container) {
    this.container = container;
    this.metrics = {};
    this.charts = {};
    this._build();
  }

  _build() {
    this.container.innerHTML = `
      <div class="panel" style="margin-bottom:12px">
        <p class="panel-title">CHANNEL STATUS</p>
        
        <div style="display:grid;grid-template-columns:1fr 1fr;gap:8px;font-size:12px">
          <div>
            <div style="color:#6b7d6b;font-size:10px;letter-spacing:.08em">QUALITY</div>
            <div id="dash-quality" style="font-size:28px;font-weight:700;color:#5cf28c">—</div>
          </div>
          <div>
            <div style="color:#6b7d6b;font-size:10px;letter-spacing:.08em">TRACKING</div>
            <div id="dash-tracking" style="font-size:15px;color:#c9d6c9;margin-top:2px">—</div>
          </div>
        </div>

        <div style="display:grid;grid-template-columns:repeat(2,1fr);gap:1px;background:#1c2b1c;margin-top:12px;padding:1px">
          <div class="stat" style="padding:8px 10px">
            <div style="font-size:9px;color:#6b7d6b">BIT ERROR RATE</div>
            <div id="dash-ber" style="font-size:17px;color:#5cf28c;font-weight:700">—</div>
          </div>
          <div class="stat" style="padding:8px 10px">
            <div style="font-size:9px;color:#6b7d6b">PACKET SUCCESS</div>
            <div id="dash-psr" style="font-size:17px;color:#5cf28c;font-weight:700">—</div>
          </div>
          <div class="stat" style="padding:8px 10px">
            <div style="font-size:9px;color:#6b7d6b">EFFECTIVE RATE</div>
            <div id="dash-rate" style="font-size:17px;color:#5cf28c;font-weight:700">—</div>
          </div>
          <div class="stat" style="padding:8px 10px">
            <div style="font-size:9px;color:#6b7d6b">SNR EST</div>
            <div id="dash-snr" style="font-size:17px;color:#5cf28c;font-weight:700">—</div>
          </div>
        </div>

        <div style="margin-top:10px;font-size:11px;color:#6b7d6b">
          FPS: <span id="dash-fps" style="color:#c9d6c9">—</span> &nbsp;
          Decode: <span id="dash-dfps" style="color:#c9d6c9">—</span> &nbsp;
          Dist: <span id="dash-dist" style="color:#c9d6c9">—</span>m
        </div>
      </div>

      <div class="panel">
        <p class="panel-title">RELIABILITY HEATMAP</p>
        <canvas id="heatmap-canvas" width="360" height="270" style="width:100%;max-width:360px;background:#000;border:1px solid #1c2b1c"></canvas>
        <div style="font-size:9px;color:#6b7d6b;margin-top:4px">Green = high reliability • Red = frequent errors</div>
      </div>

      <div class="panel" style="margin-top:12px">
        <p class="panel-title">SPECTRUM (SPATIAL FFT)</p>
        <canvas id="fft-canvas" width="320" height="90" style="width:100%;max-width:320px;background:#000;border:1px solid #1c2b1c"></canvas>
        <div id="fft-text" style="font-size:10px;color:#6b7d6b;margin-top:4px">Low / Mid / High freq energy</div>
      </div>
    `;

    this.heatmapCanvas = this.container.querySelector('#heatmap-canvas');
    this.fftCanvas = this.container.querySelector('#fft-canvas');
    this.heatmapCtx = this.heatmapCanvas.getContext('2d');
    this.fftCtx = this.fftCanvas.getContext('2d');

    // Charts
    this.throughputChart = new SimpleLineChart(
      document.createElement('canvas'), { color: '#5cf28c' }
    );
  }

  updateMetrics(m) {
    this.metrics = m;

    const q = this.container.querySelector('#dash-quality');
    if (q) q.textContent = (m.quality || 0) + '%';

    const t = this.container.querySelector('#dash-tracking');
    if (t) t.textContent = (m.tracking || 'Stable');

    const ber = this.container.querySelector('#dash-ber');
    if (ber) ber.textContent = m.ber || '—';

    const psr = this.container.querySelector('#dash-psr');
    if (psr) psr.textContent = (m.packetSuccess || '—') + '%';

    const rate = this.container.querySelector('#dash-rate');
    if (rate) rate.textContent = (m.effectiveThroughput || '—') + ' kbps';

    const snr = this.container.querySelector('#dash-snr');
    if (snr) snr.textContent = m.snr || '—';

    const fps = this.container.querySelector('#dash-fps');
    if (fps) fps.textContent = (m.fps || 0).toFixed(1);

    const dfps = this.container.querySelector('#dash-dfps');
    if (dfps) dfps.textContent = (m.decodeFps || 0).toFixed(1);

    const dist = this.container.querySelector('#dash-dist');
    if (dist) dist.textContent = m.distance || '?';
  }

  drawHeatmap(heatmapInstance) {
    if (!this.heatmapCtx || !heatmapInstance) return;
    heatmapInstance.draw(this.heatmapCtx, 15);
  }

  drawSpectrum(spectrum) {
    if (!this.fftCtx) return;
    const ctx = this.fftCtx;
    ctx.clearRect(0, 0, 320, 90);

    const w = 320, h = 90;
    const barW = 92;

    const vals = [spectrum.low || 0, spectrum.mid || 0, spectrum.high || 0];
    const labels = ['LOW', 'MID', 'HIGH'];
    const colors = ['#2f8a52', '#5cf28c', '#f2b45c'];

    vals.forEach((v, i) => {
      const bh = Math.max(6, v * (h - 22));
      ctx.fillStyle = colors[i];
      ctx.fillRect(12 + i * barW, h - 12 - bh, 78, bh);

      ctx.fillStyle = '#6b7d6b';
      ctx.font = '10px monospace';
      ctx.fillText(labels[i], 12 + i * barW, h - 2);
      ctx.fillText((v * 100).toFixed(0) + '%', 12 + i * barW + 38, h - 14);
    });
  }

  setTrackingStatus(status) {
    const el = this.container.querySelector('#dash-tracking');
    if (el) el.textContent = status;
  }
}
// Profiler integration hook
import { ChannelProfiler } from '../analysis/profiler.js';
window.photonProfiler = new ChannelProfiler();
/** Live Optical Channel Dashboard graphs */
export function drawLiveGraph(canvasId, dataPoints, label, color) {
  const c = document.getElementById(canvasId);
  if (!c) return;
  const ctx = c.getContext('2d');
  ctx.clearRect(0, 0, c.width, c.height);
  const max = Math.max(...dataPoints.map(p => p.v), 1);
  dataPoints.forEach((p, i) => {
    const x = (i / Math.max(dataPoints.length - 1, 1)) * c.width;
    const y = c.height - (p.v / max) * (c.height - 10);
    ctx.fillStyle = color || '#5cf28c';
    ctx.fillRect(x - 1, y, 3, c.height - y);
  });
}
