/** Experiment Manager — structured measurement runs */
export class ExperimentManager {
  constructor() { this.runs = []; }
  start({ grid = '64x48', fps = 30, distance = '30cm', brightness = 80 }) {
    const id = `run_${Date.now()}`;
    this.runs.push({ id, config: { grid, fps, distance, brightness }, start: performance.now(), frames: [], packets: [] });
    return id;
  }
  recordFrame({ frameIdx, packetSuccess, decodeLatencyMs, confidence }) {
    const run = this.runs[this.runs.length - 1];
    if (!run) return;
    run.frames.push({ frameIdx, packetSuccess, decodeLatencyMs, confidence });
    run.packets.push(packetSuccess ? 1 : 0);
  }
  finish() {
    const run = this.runs[this.runs.length - 1];
    if (!run) return null;
    run.durationMs = performance.now() - run.start;
    const successRate = (run.packets.filter(p => p === 1).length / run.packets.length) * 100;
    console.log(`[EXPERIMENT] ${run.id} | ${run.config.grid} @ ${run.config.fps}fps | Duration: ${(run.durationMs/1000).toFixed(1)}s | Packet Success: ${successRate.toFixed(1)}%`);
    return { ...run, summary: { durationMs: run.durationMs, successRate, packetCount: run.packets.length } };
  }
}
