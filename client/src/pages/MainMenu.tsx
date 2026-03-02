import { useState } from 'react';
import { motion } from 'framer-motion';
import SacredGeometryBg from '../components/SacredGeometryBg';
import SettingsModal from '../components/SettingsModal';

interface Props {
  onPlay: (name: string) => void;
}

export default function MainMenu({ onPlay }: Props) {
  const [name, setName] = useState('');
  const [showSettings, setShowSettings] = useState(false);
  const [nameError, setNameError] = useState('');

  const handlePlay = () => {
    const trimmed = name.trim();
    if (!trimmed) { setNameError('Enter your callsign'); return; }
    if (trimmed.length < 2) { setNameError('Min 2 characters'); return; }
    onPlay(trimmed);
  };

  return (
    <div className="relative min-h-screen overflow-hidden bg-[#f5f0e8] flex flex-col items-center justify-center">
      <SacredGeometryBg />

      <div className="relative z-10 flex flex-col items-center gap-8 px-6 max-w-lg w-full">
        {/* Logo */}
        <motion.div
          initial={{ opacity: 0, y: -30 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8, ease: 'easeOut' }}
          className="text-center"
        >
          <div className="flex items-center justify-center gap-3 mb-2">
            <div className="h-px w-16 bg-gradient-to-r from-transparent to-[#c8a84b]" />
            <span className="text-[#c8a84b] text-xs tracking-[0.4em] uppercase font-medium">
              Arena
            </span>
            <div className="h-px w-16 bg-gradient-to-l from-transparent to-[#c8a84b]" />
          </div>
          <h1 className="text-6xl font-black text-[#1a2340] tracking-tight leading-none">
            NEXUS
          </h1>
          <p className="text-[#c8a84b] text-sm tracking-[0.3em] uppercase mt-2 font-medium">
            Multiplayer · Arena · Shooter
          </p>
        </motion.div>

        {/* Sacred geometry divider */}
        <motion.div
          initial={{ scaleX: 0 }}
          animate={{ scaleX: 1 }}
          transition={{ duration: 0.6, delay: 0.3 }}
          className="w-full flex items-center gap-4"
        >
          <div className="flex-1 h-px bg-[#c8a84b]/30" />
          <div className="w-6 h-6 border border-[#c8a84b]/50 rotate-45" />
          <div className="flex-1 h-px bg-[#c8a84b]/30" />
        </motion.div>

        {/* Name input */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.4 }}
          className="w-full space-y-2"
        >
          <label className="text-[#1a2340] text-xs tracking-[0.3em] uppercase font-semibold">
            Callsign
          </label>
          <input
            type="text"
            value={name}
            onChange={e => { setName(e.target.value); setNameError(''); }}
            onKeyDown={e => e.key === 'Enter' && handlePlay()}
            maxLength={20}
            placeholder="Enter your name..."
            className="w-full px-4 py-3 bg-white/60 border border-[#c8a84b]/40 rounded-lg text-[#1a2340] placeholder-[#1a2340]/30 focus:outline-none focus:border-[#c8a84b] focus:bg-white/80 transition-all text-sm font-medium tracking-wide"
          />
          {nameError && (
            <p className="text-red-500 text-xs tracking-wide">{nameError}</p>
          )}
        </motion.div>

        {/* Play button */}
        <motion.button
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.5 }}
          whileHover={{ scale: 1.03 }}
          whileTap={{ scale: 0.97 }}
          onClick={handlePlay}
          className="w-full py-4 bg-[#1a2340] text-[#c8a84b] font-black text-sm tracking-[0.4em] uppercase rounded-lg border border-[#c8a84b]/30 hover:bg-[#1a2340]/90 hover:border-[#c8a84b] transition-all duration-200 shadow-lg hover:shadow-[#c8a84b]/20 hover:shadow-xl"
        >
          Enter Arena
        </motion.button>

        {/* Settings */}
        <motion.button
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.7 }}
          onClick={() => setShowSettings(true)}
          className="text-[#1a2340]/50 text-xs tracking-[0.3em] uppercase hover:text-[#c8a84b] transition-colors"
        >
          Settings
        </motion.button>

        {/* Feature pills */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.9 }}
          className="flex flex-wrap gap-2 justify-center"
        >
          {['1v1 Matchmaking', '4 Weapons', '6 Powerups', 'Client Prediction'].map(tag => (
            <span
              key={tag}
              className="px-3 py-1 text-[10px] tracking-[0.2em] uppercase text-[#c8a84b]/70 border border-[#c8a84b]/20 rounded-full bg-[#c8a84b]/5"
            >
              {tag}
            </span>
          ))}
        </motion.div>
      </div>

      {showSettings && <SettingsModal onClose={() => setShowSettings(false)} />}
    </div>
  );
}
