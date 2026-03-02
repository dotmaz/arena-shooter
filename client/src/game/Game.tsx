// ============================================================
// Main Game Component
// ============================================================
import { useEffect, useRef, useCallback, useState } from 'react';
import {
  GameState, PlayerInput, ServerMsg, GameStateMsg,
  GameEndMsg, KillEvent, QueueStatusMsg, WeaponType, WEAPONS,
} from '../../../shared/game';
import { GameRenderer } from './GameRenderer';
import { InputManager } from './InputManager';
import { GameLoop } from './GameLoop';
import { useGameSocket } from './useGameSocket';
import KillFeed from '../components/KillFeed';
import WeaponSelector from '../components/WeaponSelector';

interface Props {
  playerName: string;
  onGameEnd: (result: GameEndMsg) => void;
  onLeave: () => void;
}

type GamePhaseUI = 'queue' | 'playing' | 'ended';

export default function Game({ playerName, onGameEnd, onLeave }: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const rendererRef = useRef<GameRenderer | null>(null);
  const inputRef = useRef<InputManager | null>(null);
  const loopRef = useRef<GameLoop | null>(null);

  const [uiPhase, setUiPhase] = useState<GamePhaseUI>('queue');
  const [queuePos, setQueuePos] = useState(1);
  const [queueTotal, setQueueTotal] = useState(1);
  const [killFeed, setKillFeed] = useState<KillEvent[]>([]);
  const [currentWeapon, setCurrentWeapon] = useState<WeaponType>('blaster');
  const [myId, setMyId] = useState('');
  const [ping, setPing] = useState(0);
  const pingTs = useRef(0);

  const sendRef = useRef<((msg: { type: string; payload?: unknown }) => void) | null>(null);

  const handleMessage = useCallback((msg: ServerMsg) => {
    switch (msg.type) {
      case 'queue_status': {
        const p = msg.payload as QueueStatusMsg;
        setQueuePos(p.position);
        setQueueTotal(p.total);
        break;
      }
      case 'game_start': {
        setUiPhase('playing');
        break;
      }
      case 'game_state': {
        const { state, yourId, lastProcessedSeq } = msg.payload as GameStateMsg;
        if (!myId && yourId) setMyId(yourId);
        loopRef.current?.receiveState(state, lastProcessedSeq);
        break;
      }
      case 'game_end': {
        const result = msg.payload as GameEndMsg;
        setUiPhase('ended');
        loopRef.current?.stop();
        onGameEnd(result);
        break;
      }
      case 'kill_event': {
        const ev = msg.payload as KillEvent;
        setKillFeed(prev => [...prev.slice(-4), ev]);
        break;
      }
      case 'pong': {
        const { ts } = msg.payload as { ts: number };
        setPing(Date.now() - pingTs.current);
        break;
      }
      case 'connected': {
        const { playerId } = msg.payload as { playerId: string };
        setMyId(playerId);
        break;
      }
    }
  }, [onGameEnd]);

  const playerNameRef = useRef(playerName);
  playerNameRef.current = playerName;

  const handleOpen = useCallback(() => {
    sendRef.current?.({ type: 'join_queue', payload: { name: playerNameRef.current } });
  }, []);

  const { send } = useGameSocket(handleMessage, handleOpen);
  sendRef.current = send as unknown as typeof sendRef.current;

  // Initialize renderer and game loop
  useEffect(() => {
    if (!canvasRef.current) return;

    const renderer = new GameRenderer(canvasRef.current);
    const inputMgr = new InputManager();
    rendererRef.current = renderer;
    inputRef.current = inputMgr;

    const sendInput = (input: PlayerInput) => {
      send({ type: 'player_input', payload: input });
    };

    const loop = new GameLoop(renderer, inputMgr, sendInput);
    loopRef.current = loop;

    return () => {
      loop.stop();
      renderer.destroy();
      inputMgr.destroy();
    };
  }, []);

  // Start game loop when myId is set and in playing phase
  useEffect(() => {
    if (uiPhase === 'playing' && myId && loopRef.current) {
      loopRef.current.start(myId);
    }
  }, [uiPhase, myId]);

  // Ping interval
  useEffect(() => {
    const pingInterval = setInterval(() => {
      pingTs.current = Date.now();
      send({ type: 'ping' });
    }, 3000);

    return () => {
      clearInterval(pingInterval);
    };
  }, [send]);

  // Weapon change propagation
  const handleWeaponChange = useCallback((w: WeaponType) => {
    setCurrentWeapon(w);
    inputRef.current?.setWeapon(w);
  }, []);

  return (
    <div className="relative w-full h-screen overflow-hidden bg-[#0a0a14]">
      {/* PixiJS Canvas */}
      <canvas ref={canvasRef} className="absolute inset-0 w-full h-full" />

      {/* Queue overlay */}
      {uiPhase === 'queue' && (
        <div className="absolute inset-0 flex items-center justify-center bg-black/70 backdrop-blur-sm">
          <div className="text-center space-y-6 p-10 rounded-2xl border border-[#c8a84b]/30 bg-[#0d1117]/90">
            <div className="sacred-spinner mx-auto" />
            <h2 className="text-2xl font-bold text-[#c8a84b] tracking-widest uppercase">
              Matchmaking
            </h2>
            <p className="text-white/70">
              Position <span className="text-[#c8a84b] font-bold">{queuePos}</span> of{' '}
              <span className="text-white font-bold">{queueTotal}</span> in queue
            </p>
            <div className="flex gap-2 justify-center">
              {Array.from({ length: 3 }).map((_, i) => (
                <div
                  key={i}
                  className="w-2 h-2 rounded-full bg-[#c8a84b] animate-bounce"
                  style={{ animationDelay: `${i * 0.15}s` }}
                />
              ))}
            </div>
            <button
              onClick={onLeave}
              className="px-6 py-2 text-sm text-white/60 border border-white/20 rounded-lg hover:border-[#c8a84b]/50 hover:text-[#c8a84b] transition-all"
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      {/* In-game overlays */}
      {uiPhase === 'playing' && (
        <>
          {/* Kill feed */}
          <div className="absolute top-14 right-4 w-64">
            <KillFeed events={killFeed} myId={myId} />
          </div>

          {/* Weapon selector */}
          <div className="absolute bottom-20 left-1/2 -translate-x-1/2">
            <WeaponSelector current={currentWeapon} onChange={handleWeaponChange} />
          </div>

          {/* Ping */}
          <div className="absolute top-4 right-4 text-xs text-white/40 font-mono">
            {ping}ms
          </div>

          {/* Controls hint */}
          <div className="absolute top-4 left-4 text-xs text-white/30 space-y-0.5">
            <div>WASD — Move</div>
            <div>Mouse — Aim</div>
            <div>LMB — Shoot</div>
            <div>Space — Dash</div>
            <div>1-4 — Weapons</div>
          </div>
        </>
      )}
    </div>
  );
}
