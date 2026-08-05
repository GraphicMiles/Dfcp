/**
 * tracking.js
 * Simple frame-to-frame marker stability and motion estimation.
 * Helps determine tracking quality for dashboard.
 */

export class Tracker {
  constructor() {
    this.prevCorners = null;
    this.stability = 1.0; // 0-1
    this.motion = 0;      // px/frame estimate
  }

  update(corners) {
    if (!corners || corners.length !== 4) {
      this.stability = Math.max(0.2, this.stability * 0.85);
      return { stability: this.stability, motion: this.motion };
    }

    if (!this.prevCorners) {
      this.prevCorners = corners;
      this.stability = 0.95;
      this.motion = 0;
      return { stability: this.stability, motion: this.motion };
    }

    let totalDist = 0;
    for (let i = 0; i < 4; i++) {
      const dx = corners[i].x - this.prevCorners[i].x;
      const dy = corners[i].y - this.prevCorners[i].y;
      totalDist += Math.hypot(dx, dy);
    }

    const avgDist = totalDist / 4;
    this.motion = avgDist;

    // Stability: high when motion is low
    const targetStability = Math.max(0.4, 1 - Math.min(1, avgDist / 18));
    this.stability = this.stability * 0.7 + targetStability * 0.3;

    this.prevCorners = corners;
    return {
      stability: this.stability,
      motion: this.motion
    };
  }

  reset() {
    this.prevCorners = null;
    this.stability = 1.0;
    this.motion = 0;
  }
}
