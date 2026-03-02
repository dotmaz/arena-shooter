import { KillEvent, WEAPONS } from '../../../shared/game';
import { motion, AnimatePresence } from 'framer-motion';

interface Props {
  events: KillEvent[];
  myId: string;
}

export default function KillFeed({ events, myId }: Props) {
  return (
    <div className="flex flex-col gap-1 items-end">
      <AnimatePresence>
        {events.map((ev, i) => {
          const isMyKill = ev.killerId === myId;
          const isMyDeath = ev.victimId === myId;
          const wColor = WEAPONS[ev.weapon]?.color ?? 0xffffff;
          const hexColor = `#${wColor.toString(16).padStart(6, '0')}`;

          return (
            <motion.div
              key={`${ev.tick}-${ev.victimId}`}
              initial={{ opacity: 0, x: 40 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: 40 }}
              transition={{ duration: 0.25 }}
              className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-mono backdrop-blur-sm border ${
                isMyKill
                  ? 'bg-[#c8a84b]/10 border-[#c8a84b]/30 text-[#c8a84b]'
                  : isMyDeath
                  ? 'bg-red-900/20 border-red-500/30 text-red-300'
                  : 'bg-black/40 border-white/10 text-white/70'
              }`}
            >
              <span className="font-bold">{ev.killerName}</span>
              <span style={{ color: hexColor }}>
                {ev.weapon === 'blaster' ? '⚡' :
                 ev.weapon === 'shotgun' ? '💥' :
                 ev.weapon === 'railgun' ? '⚡' : '🔫'}
              </span>
              <span className="opacity-70">{ev.victimName}</span>
            </motion.div>
          );
        })}
      </AnimatePresence>
    </div>
  );
}
