import { useEffect, useState } from 'react';
import { useFlowStore } from '../store/useFlowStore';
import { validateTrace } from '../utils/validateTrace';

type LiveTraceStatus = 'connecting' | 'connected' | 'disconnected' | 'error';

interface LiveTraceMessage {
  kind: string;
  trace?: unknown;
  message?: string;
}

const socketUrl = import.meta.env.VITE_FLOW_TRACE_WS ?? 'ws://127.0.0.1:8787';

export function useLiveTrace() {
  const importTrace = useFlowStore((state) => state.importTrace);
  const [status, setStatus] = useState<LiveTraceStatus>('connecting');
  const [lastMessage, setLastMessage] = useState('Waiting for trace server');

  useEffect(() => {
    let closedByEffect = false;
    const socket = new WebSocket(socketUrl);

    socket.addEventListener('open', () => {
      setStatus('connected');
      setLastMessage(`Connected to ${socketUrl}`);
    });

    socket.addEventListener('message', (event) => {
      try {
        const payload = JSON.parse(String(event.data)) as LiveTraceMessage;
        if (payload.kind === 'FLOW_TRACE' && validateTrace(payload.trace)) {
          importTrace(payload.trace);
          setLastMessage(`Live trace updated: ${payload.trace.name}`);
        } else if (payload.message) {
          setLastMessage(payload.message);
        }
      } catch {
        setLastMessage('Ignored invalid trace server message');
      }
    });

    socket.addEventListener('close', () => {
      if (!closedByEffect) {
        setStatus('disconnected');
        setLastMessage('Trace server disconnected');
      }
    });

    socket.addEventListener('error', () => {
      setStatus('error');
      setLastMessage(`Cannot connect to ${socketUrl}`);
    });

    return () => {
      closedByEffect = true;
      socket.close();
    };
  }, [importTrace]);

  return { status, lastMessage, socketUrl };
}
