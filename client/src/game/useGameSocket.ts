// ============================================================
// WebSocket client hook
// ============================================================
import { useEffect, useRef, useCallback } from 'react';
import { ServerMsg, ClientMsg } from '../../../shared/game';

export type MsgHandler = (msg: ServerMsg) => void;

export function useGameSocket(onMessage: MsgHandler) {
  const wsRef = useRef<WebSocket | null>(null);
  const onMessageRef = useRef(onMessage);
  onMessageRef.current = onMessage;

  const connect = useCallback(() => {
    const proto = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const url = `${proto}//${window.location.host}/ws`;
    const ws = new WebSocket(url);
    wsRef.current = ws;

    ws.onopen = () => console.log('[WS] Connected');
    ws.onclose = () => console.log('[WS] Disconnected');
    ws.onerror = (e) => console.error('[WS] Error', e);
    ws.onmessage = (ev) => {
      try {
        const msg: ServerMsg = JSON.parse(ev.data);
        onMessageRef.current(msg);
      } catch { /* ignore */ }
    };
    return ws;
  }, []);

  useEffect(() => {
    const ws = connect();
    return () => ws.close();
  }, [connect]);

  const send = useCallback((msg: ClientMsg) => {
    const ws = wsRef.current;
    if (ws && ws.readyState === WebSocket.OPEN) {
      ws.send(JSON.stringify(msg));
    }
  }, []);

  return { send, wsRef };
}
