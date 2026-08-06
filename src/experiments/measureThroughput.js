/**
 * Channel measurement experiment
 */
export function measureThroughput({ density = 'xxlarge', mode = 'rgb8', durationMs = 5000 }) {
  const start = performance.now();
  const results = { framesRendered: 0, bytesEncoded: 0, avgRenderMs: 0, achievedBps: 0 };
  const end = performance.now() + durationMs;
  while (performance.now() < end) {
    results.framesRendered++;
  }
  results.achievedBps = (results.bytesEncoded * 8) / ((performance.now() - start) / 1000);
  console.log(`[MEASURE] ${density}/${mode}: ${results.framesRendered} frames, ${results.achievedBps.toFixed(0)} bps`);
  return results;
}
