/**
 * Channel profiler / measurement instrumentation
 */
export class ChannelProfiler {
  constructor() { this.sessions = []; }
  recordFrame({ frameIdx, decodeTimeMs, confidence, errors, contrast, brightness, payloadLatencyMs }) {
    console.log(`[PROFILE] Frame ${frameIdx}: decode=${decodeTimeMs}ms conf=${confidence}% err=${errors} contrast=${contrast} brightness=${brightness} latency=${payloadLatencyMs}ms`);
  }
}
