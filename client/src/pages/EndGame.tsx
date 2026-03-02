import { motion } from 'framer-motion';
import { GameEndMsg } from '../../../shared/game';
import SacredGeometryBg from '../components/SacredGeometryBg';

interface Props {
  result: GameEndMsg;
  myId: string;
  onRematch: () => void;
  onMenu: () => void;
}

export default function EndGame({ result, myId, onRematch, onMenu }: Props) {
  const isWinner = result.winnerId === myId;
  const sorted = [...result.players].sort((a, b) => b.kills - a.kills);

  return (
    <div className="relative min-h-screen overflow-hidden bg-[#f5f0e8] flex flex-col items-center justify-center">
      <SacredGeometryBg />

      <div className="relative z-10 flex flex-col items-center gap-8 px-6 max-w-lg w-full">
        {/* Result banner */}
        <motion.div
          initial={{ opacity: 0, scale: 0.8 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.6, type: 'spring' }}
          className="text-center"
        >
          <div className={`text-6xl font-black tracking-tight ${isWinner ? 'text-[#c8a84b]' : 'text-[#1a2340]/60'}`}>
            {isWinner ? 'VICTORY' : 'DEFEAT'}
          </div>
          <p className="text-[#1a2340]/60 text-sm tracking-[0.3em] uppercase mt-2">
            {result.winnerName} wins the arena
          </p>
        </motion.div>

        {/* Divider */}
        <div className="w-full flex items-center gap-4">
          <div className="flex-1 h-px bg-[#c8a84b]/30" />
          <div className="w-5 h-5 border border-[#c8a84b]/50 rotate-45" />
          <div className="flex-1 h-px bg-[#c8a84b]/30" />
        </div>

        {/* Scoreboard */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3 }}
          className="w-full bg-white/50 border border-[#c8a84b]/30 rounded-xl overflow-hidden"
        >
          <div className="grid grid-cols-4 px-4 py-2 bg-[#1a2340]/5 text-[#1a2340]/50 text-xs tracking-[0.2em] uppercase font-semibold">
            <span>Player</span>
            <span className="text-center">Kills</span>
            <span className="text-center">Deaths</span>
            <span className="text-center">K/D</span>
          </div>
          {sorted.map((p, i) => {
            const kd = p.deaths === 0 ? p.kills.toFixed(1) : (p.kills / p.deaths).toFixed(2);
            const isMe = p.id === myId;
            const isTop = i === 0;
            return (
              <motion.div
                key={p.id}
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: 0.4 + i * 0.1 }}
                className={`grid grid-cols-4 px-4 py-3 border-t border-[#c8a84b]/10 ${
                  isMe ? 'bg-[#c8a84b]/10' : ''
                }`}
              >
                <div className="flex items-center gap-2">
                  {isTop && <span className="text-[#c8a84b] text-xs">👑</span>}
                  <span className={`text-sm font-semibold ${isMe ? 'text-[#c8a84b]' : 'text-[#1a2340]'}`}>
                    {p.name}
                  </span>
                  {isMe && <span className="text-[10px] text-[#c8a84b]/60">(you)</span>}
                </div>
                <span className="text-center text-[#1a2340] font-bold">{p.kills}</span>
                <span className="text-center text-[#1a2340]/60">{p.deaths}</span>
                <span className="text-center text-[#1a2340]/80 font-mono text-sm">{kd}</span>
              </motion.div>
            );
          })}
        </motion.div>

        {/* Actions */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.7 }}
          className="flex gap-4 w-full"
        >
          <button
            onClick={onMenu}
            className="flex-1 py-3 border border-[#1a2340]/20 rounded-lg text-[#1a2340]/70 text-sm tracking-wider uppercase hover:border-[#c8a84b]/50 hover:text-[#c8a84b] transition-all"
          >
            Main Menu
          </button>
          <button
            onClick={onRematch}
            className="flex-1 py-3 bg-[#1a2340] text-[#c8a84b] rounded-lg text-sm font-black tracking-[0.3em] uppercase hover:bg-[#1a2340]/90 transition-all border border-[#c8a84b]/30"
          >
            Play Again
          </button>
        </motion.div>
      </div>
    </div>
  );
}
