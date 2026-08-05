/**
 * densityTest.js
 * Symbol Density Test experiment
 */

export class DensityTest {
  constructor(uiCallbacks = {}) {
    this.ui = uiCallbacks;
    this.densities = ['small', 'medium', 'large', 'xlarge', 'xxlarge'];
    this.current = 0;
    this.results = [];
    this.running = false;
  }

  start(onComplete) {
    this.running = true;
    this.current = 0;
    this.results = [];
    this._runNext(onComplete);
  }

  _runNext(onComplete) {
    if (!this.running || this.current >= this.densities.length) {
      this.running = false;
      if (onComplete) onComplete(this.results);
      return;
    }

    const density = this.densities[this.current];
    this.ui.log?.(`Density Test: running ${density}`);

    // The actual test logic is orchestrated from main / ui.
    // This class provides the sequence and collects results.
    // For now we emit the next density to be tested by caller.

    setTimeout(() => {
      this.current++;
      this._runNext(onComplete);
    }, 1200);
  }

  recordResult(density, metrics) {
    this.results.push({
      density,
      errors: metrics.errors || 0,
      throughput: metrics.throughput || 0,
      reliability: metrics.reliability || 0,
      timestamp: Date.now()
    });
  }

  stop() {
    this.running = false;
  }

  getResults() {
    return this.results;
  }
}
