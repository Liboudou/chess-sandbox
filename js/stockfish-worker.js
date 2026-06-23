// Stockfish Worker
// This worker loads the stockfish.js engine and communicates with the main thread.

// Load the stockfish.js bundle from CDN
importScripts('https://cdn.jsdelivr.net/npm/stockfish.js/stockfish.wasm.js');

// The stockfish.js bundle should expose a `Stockfish` global or similar.
// After inspecting the stockfish.js package, the worker script itself is the engine.
// We'll assume that the global `Module` is the factory and we can create an instance.
// However, to be safe, we'll follow the pattern from the stockfish.js documentation for workers.

// Actually, the stockfish.js package provides a way to create a worker via:
//   const worker = new Worker(new URL('node_modules/stockfish.js/dist/worker.js', import.meta.url));
// But we are using a CDN bundle that is meant to be used as a worker directly.

// Let's assume that importing the script gives us a self.Stockfish object.
// We'll create an instance and then handle commands.

let engine = null;

// Initialize the engine
try {
  // The stockfish.js bundle might export a factory function.
  // We'll look for a global named `Stockfish` or `engineFactory`.
  // If not, we'll try to use the Module to create an engine.
  if (typeof Stockfish !== 'undefined') {
    engine = new Stockfish();
  } else if (typeof Module !== 'undefined' && typeof Module.createEngine === 'function') {
    engine = Module.createEngine();
  } else {
    // Fallback: try to create an engine from the Module
    engine = new Module.EEngine();
  }
} catch (e) {
  console.error('Failed to initialize Stockfish engine:', e);
}

self.onmessage = async function(event) {
  const { id, command, args } = event.data;
  try {
    let result;
    switch (command) {
      case 'init':
        // Already initialized in the worker
        result = { status: 'ok' };
        break;
      case 'setOption':
        if (engine.setOption) {
          engine.setOption(args[0], args[1]);
        } else if (engine.parameters) {
          engine.parameters[args[0]] = args[1];
        }
        result = { status: 'ok' };
        break;
      case 'position':
        // args[0] is a FEN string
        if (engine.setPosition) {
          engine.setPosition(args[0]);
        } else {
          engine.load(args[0]);
        }
        result = { status: 'ok' };
        break;
      case 'go':
        // args[0] is an object with { depth } or { time }
        // We'll support depth for simplicity
        if (engine.go) {
          // The engine.go method might take a callback or return a promise.
          // We'll assume it takes a callback that returns the best move.
          // We need to wrap in a promise.
          return new Promise((resolve, reject) => {
            engine.go(args[0], (err, bestmove) => {
              if (err) {
                reject(err);
              } else {
                resolve({ bestmove });
              }
            });
          }).then(bestmove => {
            self.postMessage({ id, bestmove });
          }).catch(err => {
            self.postMessage({ id, error: err.message });
          });
        } else {
          throw new Error('Engine does not support go command');
        }
        // We'll return early because we are handling the response asynchronously.
        return;
      case 'stop':
        if (engine.stop) {
          engine.stop();
        }
        result = { status: 'ok' };
        break;
      default:
        throw new Error(`Unknown command: ${command}`);
    }
    // For synchronous commands, we send the result back.
    if (result !== undefined) {
      self.postMessage({ id, result });
    }
  } catch (e) {
    self.postMessage({ id, error: e.message });
  }
};