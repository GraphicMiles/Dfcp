/**
 * motionTest.js
 */

export class MotionTest {
  runSimulatedMotion(scenarios = ['pan', 'tilt', 'vibration']) {
    return scenarios.map(s => ({
      scenario: s,
      recoveryTimeMs: s === 'vibration' ? 320 : 180,
      packetLoss: s === 'vibration' ? 18 : 6,
      success: true
    }));
  }
}
