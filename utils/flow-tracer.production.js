/* eslint-disable */
const noop = () => undefined;

// Production never opts in to DEV flow tracing. Keep the call surface intact
// without shipping WebSocket, storage-snapshot or instrumentation code.
const flowTracer = {
  connect: noop,
  installGlobalTracing: noop,
  traceZustandStore: noop,
  startTrace: noop,
  track: noop,
  endTrace: () => null,
  snapshotAsyncStorage: async () => undefined,
};

module.exports = { flowTracer };
