/**
 * blurTest.js
 */

export class BlurTest {
  constructor() {
    this.results = [];
  }

  recordBlurTest(distance, focusQuality, motionBlur, metrics) {
    const degradation = Math.max(0, (distance - 0.5) * 40 + (1 - focusQuality) * 35 + motionBlur * 25);
    const result = {
      distance, focusQuality, motionBlur,
      symbolErrorRate: Math.min(0.8, degradation / 100),
      ...metrics
    };
    this.results.push(result);
    return result;
  }
}
