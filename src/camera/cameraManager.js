/**
 * cameraManager.js
 * Handles getUserMedia, video stream, frame capture.
 * Clean separation from UI.
 */

export class CameraManager {
  constructor() {
    this.stream = null;
    this.video = null;
    this.canvas = null; // internal sampling canvas
    this.ctx = null;
    this.running = false;
    this.onFrame = null; // callback(imageData)
    this._raf = null;
  }

  async start(videoElement, constraints = {}) {
    if (this.running) return;

    const defaultConstraints = {
      video: {
        facingMode: { ideal: 'environment' },
        width: { ideal: 1280 },
        height: { ideal: 720 }
      },
      audio: false
    };

    try {
      this.stream = await navigator.mediaDevices.getUserMedia({
        ...defaultConstraints,
        ...constraints
      });

      this.video = videoElement || document.createElement('video');
      this.video.srcObject = this.stream;
      this.video.autoplay = true;
      this.video.playsInline = true;
      this.video.muted = true;

      await new Promise(resolve => {
        this.video.onloadedmetadata = () => {
          this.video.play().then(resolve).catch(resolve);
        };
      });

      // Prepare sampling canvas
      this.canvas = document.createElement('canvas');
      this.canvas.width = this.video.videoWidth || 1280;
      this.canvas.height = this.video.videoHeight || 720;
      this.ctx = this.canvas.getContext('2d', { willReadFrequently: true });

      this.running = true;
      this._startFrameLoop();

      return {
        width: this.canvas.width,
        height: this.canvas.height
      };
    } catch (err) {
      console.error('Camera start failed', err);
      throw err;
    }
  }

  _startFrameLoop() {
    const loop = () => {
      if (!this.running || !this.video || !this.ctx) return;

      if (this.video.readyState >= 2) {
        this.ctx.drawImage(this.video, 0, 0, this.canvas.width, this.canvas.height);
        const imageData = this.ctx.getImageData(0, 0, this.canvas.width, this.canvas.height);

        if (this.onFrame) {
          try {
            this.onFrame(imageData);
          } catch (e) {
            // swallow per-frame errors
          }
        }
      }
      this._raf = requestAnimationFrame(loop);
    };
    this._raf = requestAnimationFrame(loop);
  }

  stop() {
    this.running = false;
    if (this._raf) cancelAnimationFrame(this._raf);

    if (this.stream) {
      this.stream.getTracks().forEach(t => t.stop());
      this.stream = null;
    }
    if (this.video) {
      this.video.srcObject = null;
    }
  }

  getFrame() {
    if (!this.ctx || !this.canvas) return null;
    return this.ctx.getImageData(0, 0, this.canvas.width, this.canvas.height);
  }

  getDimensions() {
    if (!this.canvas) return { width: 0, height: 0 };
    return { width: this.canvas.width, height: this.canvas.height };
  }
}
