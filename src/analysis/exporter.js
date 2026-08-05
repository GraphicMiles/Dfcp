/**
 * exporter.js
 * Session recording and export (JSON / CSV).
 * Also prepares AI dataset samples.
 */

export class SessionExporter {
  constructor() {
    this.sessions = [];
    this.currentSession = null;
  }

  startSession(meta = {}) {
    this.currentSession = {
      id: 'sess_' + Date.now(),
      timestamp: new Date().toISOString(),
      device: meta.device || navigator.userAgent.slice(0, 60),
      resolution: meta.resolution || '',
      cameraFPS: meta.cameraFPS || 0,
      gridDensity: meta.gridDensity || 'medium',
      symbolMode: meta.symbolMode || 'rgb4',
      distance: meta.distance || '',
      lighting: meta.lighting || 'indoor',
      framesSent: 0,
      framesReceived: 0,
      errors: 0,
      BER: 0,
      throughput: 0,
      samples: [], // for AI dataset
      rawFrames: [] // optional
    };
    return this.currentSession;
  }

  recordFrame(frameData) {
    if (!this.currentSession) return;
    this.currentSession.framesReceived++;
    if (frameData.checksumFail) this.currentSession.errors++;
    if (frameData.ber !== undefined) this.currentSession.BER = frameData.ber;
    if (frameData.throughput !== undefined) this.currentSession.throughput = frameData.throughput;
  }

  addSample(framePngDataUrl, expectedSymbols, decoded, confidence, env) {
    if (!this.currentSession) return;
    this.currentSession.samples.push({
      frame: framePngDataUrl, // base64 or reference
      expected: expectedSymbols,
      decoded,
      confidence,
      env: env || {}
    });
  }

  finishSession(extra = {}) {
    if (!this.currentSession) return null;
    Object.assign(this.currentSession, extra);
    this.sessions.push(this.currentSession);
    const finished = this.currentSession;
    this.currentSession = null;
    return finished;
  }

  exportJSON(session = null) {
    const data = session || this.currentSession || this.sessions[this.sessions.length - 1];
    if (!data) return null;
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    this._download(blob, `photon-session-${data.id || Date.now()}.json`);
  }

  exportCSV(session = null) {
    const s = session || this.currentSession || this.sessions[this.sessions.length - 1];
    if (!s) return;

    const headers = [
      'id', 'timestamp', 'device', 'resolution', 'cameraFPS', 'gridDensity',
      'symbolMode', 'distance', 'lighting', 'framesSent', 'framesReceived',
      'errors', 'BER', 'throughput'
    ];
    let csv = headers.join(',') + '\n';
    csv += [
      s.id, s.timestamp, `"${s.device}"`, s.resolution, s.cameraFPS,
      s.gridDensity, s.symbolMode, s.distance, s.lighting,
      s.framesSent, s.framesReceived, s.errors, s.BER, s.throughput
    ].join(',') + '\n';

    const blob = new Blob([csv], { type: 'text/csv' });
    this._download(blob, `photon-session-${s.id}.csv`);
  }

  _download(blob, filename) {
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }

  getAllSessions() {
    return this.sessions;
  }
}
