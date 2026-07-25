import { BrainCircuit, Download, FileJson, FileSearch, Upload } from 'lucide-react';
import { useRef, useState } from 'react';
import { useFlowStore } from '../store/useFlowStore';
import { exportMarkdown } from '../utils/exportMarkdown';
import { validateTrace } from '../utils/validateTrace';
import { PlaybackControls } from './PlaybackControls';

interface HeaderProps {
  liveStatus: string;
  liveMessage: string;
}

const traceServerUrl = (import.meta.env.VITE_FLOW_TRACE_HTTP ?? 'http://127.0.0.1:8787').replace(/\/scan-code$/, '');
const staticScanUrl = `${traceServerUrl}/scan-code`;
const aiTrainUrl = `${traceServerUrl}/train-code-flow`;

function downloadText(filename: string, text: string, type = 'text/plain') {
  const blob = new Blob([text], { type });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = filename;
  anchor.click();
  URL.revokeObjectURL(url);
}

export function Header({ liveStatus, liveMessage }: HeaderProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [message, setMessage] = useState<string | null>(null);
  const traces = useFlowStore((state) => state.traces);
  const selectedTraceId = useFlowStore((state) => state.selectedTraceId);
  const importTrace = useFlowStore((state) => state.importTrace);
  const trace = traces.find((item) => item.id === selectedTraceId) ?? traces[0];

  const handleExportMarkdown = () => {
    downloadText(`${trace.id}.md`, exportMarkdown(trace), 'text/markdown');
  };

  const handleExportJson = () => {
    downloadText(`${trace.id}.json`, JSON.stringify(trace, null, 2), 'application/json');
  };

  const handleStaticScan = async () => {
    setMessage('Scanning source code...');

    try {
      const response = await fetch(staticScanUrl);
      if (!response.ok) {
        setMessage(`Code scan failed: ${response.status}`);
        return;
      }

      const payload = (await response.json()) as { trace?: unknown; message?: string };
      if (!validateTrace(payload.trace)) {
        setMessage(payload.message ?? 'Code scan failed: invalid trace payload.');
        return;
      }

      importTrace(payload.trace);
      setMessage(`Scanned ${payload.trace.events.length} static signals.`);
    } catch {
      setMessage('Code scan failed: trace server is not reachable.');
    }
  };

  const handleTrainAi = async () => {
    setMessage('Training tiny code-flow model...');

    try {
      const response = await fetch(aiTrainUrl);
      if (!response.ok) {
        setMessage(`AI train failed: ${response.status}`);
        return;
      }

      const payload = (await response.json()) as { trace?: unknown; message?: string };
      if (!validateTrace(payload.trace)) {
        setMessage(payload.message ?? 'AI train failed: invalid trace payload.');
        return;
      }

      importTrace(payload.trace);
      setMessage(`AI generated ${payload.trace.events.length} flow predictions.`);
    } catch {
      setMessage('AI train failed: trace server is not reachable.');
    }
  };

  const handleImport = async (file: File | undefined) => {
    if (!file) return;

    try {
      const parsed = JSON.parse(await file.text());
      if (!validateTrace(parsed)) {
        setMessage('Import failed: JSON is not a valid FlowTrace.');
        return;
      }

      importTrace(parsed);
      setMessage(`Imported ${parsed.name}.`);
    } catch {
      setMessage('Import failed: file is not valid JSON.');
    } finally {
      if (inputRef.current) inputRef.current.value = '';
    }
  };

  return (
    <header className="app-header">
      <div className="brand-block">
        <span className="brand-mark">RN</span>
        <div>
          <span className="brand-kicker">Runtime map</span>
          <h1>Flow Visualizer</h1>
        </div>
        <span className={`live-badge live-${liveStatus}`} title={liveMessage}>
          <span aria-hidden="true" />
          Bridge {liveStatus}
        </span>
      </div>
      <PlaybackControls />
      <div className="header-actions">
        {message && <span className="import-message">{message}</span>}
        <input
          ref={inputRef}
          type="file"
          accept="application/json"
          aria-label="Import FlowTrace JSON"
          hidden
          onChange={(event) => void handleImport(event.target.files?.[0])}
        />
        <button type="button" className="ghost-button" onClick={() => inputRef.current?.click()}>
          <Upload size={16} />
          Import
        </button>
        <button type="button" className="ghost-button" onClick={() => void handleStaticScan()}>
          <FileSearch size={16} />
          Scan code
        </button>
        <button type="button" className="ghost-button" onClick={() => void handleTrainAi()}>
          <BrainCircuit size={16} />
          Train AI
        </button>
        <button type="button" className="ghost-button" onClick={handleExportJson}>
          <FileJson size={16} />
          JSON
        </button>
        <button type="button" className="primary-button" onClick={handleExportMarkdown}>
          <Download size={16} />
          Markdown
        </button>
      </div>
    </header>
  );
}
