import { createServer } from 'node:http';
import { readdir, readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { WebSocketServer } from 'ws';

const port = Number(process.env.FLOW_TRACE_PORT ?? 8787);
const serverDir = path.dirname(fileURLToPath(import.meta.url));
const visualizerRoot = path.resolve(serverDir, '..');
const workspaceRoot = path.resolve(visualizerRoot, '..');
const ignoredDirectories = new Set([
  '.codegraph',
  '.expo',
  '.git',
  '.junie',
  '.vscode',
  'android',
  'dist',
  'ios',
  'node_modules',
  'rn-flow-visualizer',
  'valorant-api-docs',
]);
const sourceExtensions = new Set(['.ts', '.tsx']);
const maxStaticEvents = Number(process.env.FLOW_STATIC_EVENT_LIMIT ?? 120);
const maxAiEvents = Number(process.env.FLOW_AI_EVENT_LIMIT ?? 160);

const httpServer = createServer((request, response) => {
  const url = new URL(request.url ?? '/', `http://${request.headers.host ?? '127.0.0.1'}`);

  response.setHeader('Access-Control-Allow-Origin', '*');
  response.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  response.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (request.method === 'OPTIONS') {
    response.writeHead(204);
    response.end();
    return;
  }

  if (request.method === 'GET' && url.pathname === '/scan-code') {
    scanWorkspaceFlow()
      .then((trace) => {
        response.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8' });
        response.end(JSON.stringify({ kind: 'FLOW_TRACE', trace }));
      })
      .catch((error) => {
        response.writeHead(500, { 'Content-Type': 'application/json; charset=utf-8' });
        response.end(
          JSON.stringify({
            kind: 'TRACE_SERVER_ERROR',
            message: error instanceof Error ? error.message : 'Static code scan failed',
          }),
        );
      });
    return;
  }

  if (request.method === 'GET' && url.pathname === '/train-code-flow') {
    trainWorkspaceFlowModel()
      .then((trace) => {
        response.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8' });
        response.end(JSON.stringify({ kind: 'FLOW_TRACE', trace }));
      })
      .catch((error) => {
        response.writeHead(500, { 'Content-Type': 'application/json; charset=utf-8' });
        response.end(
          JSON.stringify({
            kind: 'TRACE_SERVER_ERROR',
            message: error instanceof Error ? error.message : 'AI code flow training failed',
          }),
        );
      });
    return;
  }

  response.writeHead(404, { 'Content-Type': 'application/json; charset=utf-8' });
  response.end(JSON.stringify({ kind: 'TRACE_SERVER_ERROR', message: 'Not found' }));
});
const server = new WebSocketServer({ server: httpServer });

let lastTrace = null;

function broadcast(payload, except) {
  const message = JSON.stringify(payload);
  for (const client of server.clients) {
    if (client !== except && client.readyState === client.OPEN) {
      client.send(message);
    }
  }
}

server.on('connection', (socket, request) => {
  const remote = request.socket.remoteAddress ?? 'unknown';
  console.log(`[trace-server] client connected from ${remote}`);

  socket.send(JSON.stringify({ kind: 'TRACE_SERVER_READY', port }));
  if (lastTrace) {
    socket.send(JSON.stringify({ kind: 'FLOW_TRACE', trace: lastTrace }));
  }

  socket.on('message', (raw) => {
    try {
      const payload = JSON.parse(String(raw));
      if (payload.kind === 'FLOW_TRACE' && payload.trace) {
        lastTrace = payload.trace;
      }
      broadcast(payload, socket);
    } catch (error) {
      socket.send(
        JSON.stringify({
          kind: 'TRACE_SERVER_ERROR',
          message: error instanceof Error ? error.message : 'Invalid JSON payload',
        }),
      );
    }
  });

  socket.on('close', () => {
    console.log(`[trace-server] client disconnected from ${remote}`);
  });
});

httpServer.listen(port, '0.0.0.0', () => {
  console.log(`[trace-server] listening on ws://0.0.0.0:${port}`);
  console.log(`[trace-server] static scanner: http://127.0.0.1:${port}/scan-code`);
  console.log(`[trace-server] tiny AI trainer: http://127.0.0.1:${port}/train-code-flow`);
  console.log('[trace-server] Android emulator URL: ws://10.0.2.2:8787');
});

async function scanWorkspaceFlow() {
  const sourceFiles = await readWorkspaceSourceFiles();
  const traceId = `static_code_flow_${Date.now()}`;
  const candidates = sourceFiles.flatMap(({ relativeFile, source }) => extractStaticEvents({ traceId, relativeFile, source }));

  const events = dedupeEvents(candidates)
    .sort((left, right) => left.source.file.localeCompare(right.source.file) || left.source.line - right.source.line)
    .slice(0, maxStaticEvents)
    .map((event, index) => ({
      ...event,
      id: `${traceId}_event_${index + 1}`,
      traceId,
      order: index + 1,
      timestamp: index * 30,
      status: 'warning',
    }));

  return {
    id: traceId,
    name: `Static Code Flow (${events.length} signals)`,
    description:
      'Static code scan inferred from source files. Use it as a map of possible flow paths, then compare it with runtime traces for real requests, responses, state, storage, and navigation.',
    platform: 'mock',
    framework: 'react-native',
    stateManager: events.some((event) => String(event.label).includes('Zustand')) ? 'zustand' : 'none',
    events,
    createdAt: new Date().toISOString(),
  };
}

async function trainWorkspaceFlowModel() {
  const sourceFiles = await readWorkspaceSourceFiles();
  const trainingTraceId = `tiny_training_${Date.now()}`;
  const seedEvents = sourceFiles.flatMap(({ relativeFile, source }) => extractStaticEvents({ traceId: trainingTraceId, relativeFile, source }));
  const model = trainTinyFlowModel(seedEvents);
  const traceId = `ai_code_flow_${Date.now()}`;

  const predictions = sourceFiles
    .flatMap(({ relativeFile, source }) => predictSourceEvents({ traceId, relativeFile, source, model }))
    .sort((left, right) => right.input.model.confidence - left.input.model.confidence || left.source.file.localeCompare(right.source.file) || left.source.line - right.source.line);

  const events = dedupeEvents(predictions)
    .slice(0, maxAiEvents)
    .sort((left, right) => left.source.file.localeCompare(right.source.file) || left.source.line - right.source.line)
    .map((event, index) => ({
      ...event,
      id: `${traceId}_event_${index + 1}`,
      traceId,
      order: index + 1,
      timestamp: index * 35,
      status: event.input.model.confidence > 0.78 ? 'success' : 'warning',
    }));

  return {
    id: traceId,
    name: `Tiny AI Code Flow (${events.length} predictions)`,
    description:
      `A local Naive Bayes model trained on ${seedEvents.length} heuristic code-flow labels from this repo, then used to predict likely dashboard flow events. Treat this as AI-assisted code reading, not runtime truth.`,
    platform: 'mock',
    framework: 'react-native',
    stateManager: events.some((event) => /zustand|store/i.test(`${event.label} ${event.source.file}`)) ? 'zustand' : 'none',
    events,
    createdAt: new Date().toISOString(),
  };
}

async function readWorkspaceSourceFiles() {
  const files = await collectSourceFiles(workspaceRoot);
  return Promise.all(
    files.map(async (file) => ({
      relativeFile: toPosixPath(path.relative(workspaceRoot, file)),
      source: await readFile(file, 'utf8'),
    })),
  );
}

async function collectSourceFiles(directory) {
  const entries = await readdir(directory, { withFileTypes: true });
  const childFileGroups = await Promise.all(entries.map(async (entry) => {
    const fullPath = path.join(directory, entry.name);
    if (entry.isDirectory()) {
      if (!ignoredDirectories.has(entry.name)) {
        return collectSourceFiles(fullPath);
      }
      return [];
    }

    if (entry.isFile() && sourceExtensions.has(path.extname(entry.name))) {
      return [fullPath];
    }

    return [];
  }));

  return childFileGroups.flat();
}

function trainTinyFlowModel(seedEvents) {
  const classCounts = new Map();
  const tokenCounts = new Map();
  const totalTokensByClass = new Map();
  const vocabulary = new Set();

  for (const event of seedEvents) {
    const type = event.type;
    const tokens = tokenize(`${event.label} ${event.input?.evidence ?? ''} ${event.codeSnippet ?? ''} ${event.source.file}`);
    classCounts.set(type, (classCounts.get(type) ?? 0) + 1);

    if (!tokenCounts.has(type)) {
      tokenCounts.set(type, new Map());
      totalTokensByClass.set(type, 0);
    }

    const counts = tokenCounts.get(type);
    for (const token of tokens) {
      vocabulary.add(token);
      counts.set(token, (counts.get(token) ?? 0) + 1);
      totalTokensByClass.set(type, (totalTokensByClass.get(type) ?? 0) + 1);
    }
  }

  return {
    classCounts,
    tokenCounts,
    totalTokensByClass,
    vocabulary,
    totalSamples: seedEvents.length,
  };
}

function predictSourceEvents({ traceId, relativeFile, source, model }) {
  const lines = source.split(/\r?\n/);
  const events = [];

  lines.forEach((line, index) => {
    const trimmed = line.trim();
    if (!isPredictionCandidate(trimmed)) return;

    const context = [lines[index - 1], line, lines[index + 1]].filter(Boolean).join('\n');
    const prediction = predictEventType(`${relativeFile}\n${context}`, model);
    if (!prediction || prediction.confidence < 0.46) return;

    const lineNumber = index + 1;
    const label = buildPredictedLabel(prediction.type, trimmed, relativeFile);
    events.push({
      traceId,
      order: 0,
      type: prediction.type,
      label,
      description: `Tiny local model prediction from source context. Confidence ${Math.round(prediction.confidence * 100)}%.`,
      timestamp: 0,
      status: 'warning',
      source: {
        file: relativeFile,
        functionName: getFunctionName(trimmed) ?? undefined,
        componentName: getComponentName(trimmed) ?? undefined,
        line: lineNumber,
      },
      input: {
        static: true,
        aiGenerated: true,
        evidence: trimmed,
        model: {
          name: 'local-naive-bayes-code-flow',
          confidence: Number(prediction.confidence.toFixed(3)),
          margin: Number(prediction.margin.toFixed(3)),
          trainedSamples: model.totalSamples,
          vocabularySize: model.vocabulary.size,
        },
      },
      tool: 'Madge',
      codeSnippet: buildSnippet(lines, index),
      highlightedLines: [Math.min(3, index + 1)],
    });
  });

  return events;
}

function predictEventType(text, model) {
  const classes = [...model.classCounts.keys()];
  if (classes.length === 0) return null;

  const tokens = tokenize(text);
  const vocabularySize = Math.max(model.vocabulary.size, 1);
  const scores = classes.map((type) => {
    const classCount = model.classCounts.get(type) ?? 0;
    const counts = model.tokenCounts.get(type) ?? new Map();
    const totalTokens = model.totalTokensByClass.get(type) ?? 0;
    let score = Math.log((classCount + 1) / (model.totalSamples + classes.length));

    for (const token of tokens) {
      score += Math.log(((counts.get(token) ?? 0) + 1) / (totalTokens + vocabularySize));
    }

    return { type, score };
  }).sort((left, right) => right.score - left.score);

  const best = scores[0];
  const second = scores[1] ?? { score: best.score - 1 };
  const margin = best.score - second.score;
  const confidence = 1 / (1 + Math.exp(-Math.min(Math.max(margin, -5), 5)));

  return {
    type: best.type,
    confidence,
    margin,
  };
}

function isPredictionCandidate(line) {
  if (line.length < 4 || line.startsWith('//') || line.startsWith('*') || line.startsWith('import ')) return false;
  return /\b(onPress|onSubmit|Touchable|Pressable|useEffect|router\.|navigation\.|AsyncStorage|axios\.|fetch\(|set[A-Z]\w*|create\(|catch|throw|function|const|class)\b/.test(line);
}

function buildPredictedLabel(type, line, file) {
  const compactLine = line.replace(/\s+/g, ' ').slice(0, 80);
  if (type === 'COMPONENT_RENDER') return `${getComponentName(line) ?? path.basename(file)} can render UI`;
  if (type === 'API_REQUEST') return `Predicted API request: ${compactLine}`;
  if (type === 'NAVIGATION') return `Predicted navigation: ${compactLine}`;
  if (type === 'STORAGE_READ') return `Predicted storage read: ${compactLine}`;
  if (type === 'STORAGE_WRITE') return `Predicted storage write: ${compactLine}`;
  if (type === 'STATE_UPDATE') return `Predicted state update in ${path.basename(file)}`;
  if (type === 'UI_EVENT') return `Predicted UI event in ${path.basename(file)}`;
  if (type === 'ERROR') return `Predicted error path in ${path.basename(file)}`;
  if (type === 'SERVICE_CALL') return `Predicted service call: ${getFunctionName(line) ?? compactLine}`;
  return `Predicted function call: ${getFunctionName(line) ?? compactLine}`;
}

function tokenize(text) {
  return text
    .toLowerCase()
    .split(/[^a-z0-9_]+/g)
    .filter((token) => token.length > 2 && !['const', 'return', 'export', 'import', 'from', 'true', 'false'].includes(token));
}

function extractStaticEvents({ traceId, relativeFile, source }) {
  const lines = source.split(/\r?\n/);
  const events = [];

  const pushEvent = (type, label, lineIndex, options = {}) => {
    const lineNumber = lineIndex + 1;
    events.push({
      traceId,
      order: 0,
      type,
      label,
      description: options.description,
      timestamp: 0,
      status: 'warning',
      source: {
        file: relativeFile,
        functionName: options.functionName,
        componentName: options.componentName,
        line: lineNumber,
      },
      input: {
        static: true,
        confidence: options.confidence ?? 'medium',
        evidence: options.evidence ?? lines[lineIndex]?.trim(),
      },
      output: options.output,
      tool: 'Madge',
      codeSnippet: buildSnippet(lines, lineIndex),
      highlightedLines: [Math.min(3, lineIndex + 1)],
    });
  };

  lines.forEach((line, index) => {
    const trimmed = line.trim();
    const componentName = getComponentName(trimmed);
    if (componentName && relativeFile.endsWith('.tsx')) {
      pushEvent('COMPONENT_RENDER', `${componentName} can render UI`, index, {
        componentName,
        confidence: 'medium',
      });
    }

    if (/\bonPress\b|\bonStartShouldSetResponderCapture\b|\bTouchableOpacity\b|\bPressable\b/.test(trimmed)) {
      pushEvent('UI_EVENT', `UI interaction in ${path.basename(relativeFile)}`, index, {
        confidence: 'medium',
      });
    }

    if (/\brouter\.(push|replace|navigate)\b|\bnavigation\.(navigate|replace|goBack)\b/.test(trimmed)) {
      pushEvent('NAVIGATION', `Navigation call: ${trimmed.replace(/\s+/g, ' ').slice(0, 80)}`, index, {
        confidence: 'high',
      });
    }

    if (/\bAsyncStorage\.(getItem|getAllKeys|multiGet)\b/.test(trimmed)) {
      pushEvent('STORAGE_READ', `Storage read: ${trimmed.replace(/\s+/g, ' ').slice(0, 80)}`, index, {
        confidence: 'high',
      });
    }

    if (/\bAsyncStorage\.(setItem|removeItem|multiSet|multiRemove|clear)\b/.test(trimmed)) {
      pushEvent('STORAGE_WRITE', `Storage write: ${trimmed.replace(/\s+/g, ' ').slice(0, 80)}`, index, {
        confidence: 'high',
      });
    }

    const axiosMatch = trimmed.match(/\baxios\.(get|post|put|patch|delete)\s*\(([^)]*)/);
    if (axiosMatch) {
      pushEvent('API_REQUEST', `${axiosMatch[1].toUpperCase()} ${extractRequestTarget(axiosMatch[2])}`, index, {
        confidence: 'high',
        output: { inferredClient: 'axios' },
      });
    }

    const fetchMatch = trimmed.match(/\bfetch\s*\(([^)]*)/);
    if (fetchMatch) {
      pushEvent('API_REQUEST', `FETCH ${extractRequestTarget(fetchMatch[1])}`, index, {
        confidence: 'high',
        output: { inferredClient: 'fetch' },
      });
    }

    if (/\bcreate\s*\(|\bsetState\s*\(|\bset\(\s*\(|\bset[A-Z]\w*\s*\(/.test(trimmed) && isStateFile(relativeFile)) {
      pushEvent('STATE_UPDATE', `State mutation candidate in ${path.basename(relativeFile)}`, index, {
        confidence: 'medium',
      });
    }

    const functionName = getFunctionName(trimmed);
    if (functionName) {
      pushEvent(isServiceFile(relativeFile) ? 'SERVICE_CALL' : 'FUNCTION_CALL', `${functionName}()`, index, {
        functionName,
        confidence: isServiceFile(relativeFile) ? 'high' : 'medium',
      });
    }

    if (/\bcatch\b|\bthrow new\b/.test(trimmed)) {
      pushEvent('ERROR', `Error path in ${path.basename(relativeFile)}`, index, {
        confidence: 'medium',
      });
    }
  });

  return events;
}

function dedupeEvents(events) {
  const seen = new Set();
  return events.filter((event) => {
    const key = `${event.type}:${event.source.file}:${event.source.line}:${event.label}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

function getComponentName(line) {
  return (
    line.match(/(?:export\s+default\s+)?function\s+([A-Z][A-Za-z0-9_]*)\s*\(/)?.[1] ??
    line.match(/(?:export\s+)?const\s+([A-Z][A-Za-z0-9_]*)\s*=\s*(?:\([^)]*\)|[A-Za-z_$][\w$]*)\s*=>/)?.[1] ??
    null
  );
}

function getFunctionName(line) {
  return (
    line.match(/(?:export\s+)?(?:async\s+)?function\s+([a-zA-Z_$][\w$]*)\s*\(/)?.[1] ??
    line.match(/(?:export\s+)?const\s+([a-z][\w$]*)\s*=\s*(?:async\s*)?\(/)?.[1] ??
    line.match(/(?:public|private)\s+(?:async\s+)?([a-z][\w$]*)\s*\(/)?.[1] ??
    null
  );
}

function isStateFile(file) {
  return /store|zustand|hooks\/use/i.test(file);
}

function isServiceFile(file) {
  return /service|api|client|utils\//i.test(file);
}

function extractRequestTarget(value) {
  return value.match(/['"`]([^'"`]+)['"`]/)?.[1] ?? 'unknown endpoint';
}

function buildSnippet(lines, lineIndex) {
  const start = Math.max(0, lineIndex - 2);
  const end = Math.min(lines.length, lineIndex + 3);
  return lines.slice(start, end).join('\n');
}

function toPosixPath(value) {
  return value.split(path.sep).join('/');
}
