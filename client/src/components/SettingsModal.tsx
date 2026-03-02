import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';

interface Props {
  onClose: () => void;
}

export function getSettings() {
  return {
    masterVolume: parseFloat(localStorage.getItem('sfx_vol') ?? '0.7'),
    musicVolume: parseFloat(localStorage.getItem('music_vol') ?? '0.3'),
    showFps: localStorage.getItem('show_fps') === 'true',
    particleQuality: (localStorage.getItem('particle_quality') ?? 'high') as 'low' | 'medium' | 'high',
  };
}

export default function SettingsModal({ onClose }: Props) {
  const [masterVol, setMasterVol] = useState(0.7);
  const [musicVol, setMusicVol] = useState(0.3);
  const [showFps, setShowFps] = useState(false);
  const [particleQuality, setParticleQuality] = useState<'low' | 'medium' | 'high'>('high');

  useEffect(() => {
    const s = getSettings();
    setMasterVol(s.masterVolume);
    setMusicVol(s.musicVolume);
    setShowFps(s.showFps);
    setParticleQuality(s.particleQuality);
  }, []);

  const save = () => {
    localStorage.setItem('sfx_vol', String(masterVol));
    localStorage.setItem('music_vol', String(musicVol));
    localStorage.setItem('show_fps', String(showFps));
    localStorage.setItem('particle_quality', particleQuality);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm">
      <motion.div
        initial={{ opacity: 0, scale: 0.9 }}
        animate={{ opacity: 1, scale: 1 }}
        exit={{ opacity: 0, scale: 0.9 }}
        className="bg-[#f5f0e8] border border-[#c8a84b]/40 rounded-2xl p-8 w-full max-w-md shadow-2xl"
      >
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-xl font-black text-[#1a2340] tracking-widest uppercase">Settings</h2>
          <button onClick={onClose} className="text-[#1a2340]/40 hover:text-[#1a2340] transition-colors text-xl">✕</button>
        </div>

        <div className="space-y-6">
          {/* Audio */}
          <div>
            <h3 className="text-[#c8a84b] text-xs tracking-[0.3em] uppercase font-semibold mb-3">Audio</h3>
            <div className="space-y-4">
              <SliderRow label="SFX Volume" value={masterVol} onChange={setMasterVol} />
              <SliderRow label="Music Volume" value={musicVol} onChange={setMusicVol} />
            </div>
          </div>

          {/* Graphics */}
          <div>
            <h3 className="text-[#c8a84b] text-xs tracking-[0.3em] uppercase font-semibold mb-3">Graphics</h3>
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-[#1a2340] text-sm">Show FPS</span>
                <button
                  onClick={() => setShowFps(!showFps)}
                  className={`w-10 h-5 rounded-full transition-colors ${showFps ? 'bg-[#c8a84b]' : 'bg-[#1a2340]/20'}`}
                >
                  <div className={`w-4 h-4 rounded-full bg-white mx-0.5 transition-transform ${showFps ? 'translate-x-5' : 'translate-x-0'}`} />
                </button>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-[#1a2340] text-sm">Particle Quality</span>
                <div className="flex gap-1">
                  {(['low', 'medium', 'high'] as const).map(q => (
                    <button
                      key={q}
                      onClick={() => setParticleQuality(q)}
                      className={`px-2 py-1 text-xs rounded capitalize transition-all ${
                        particleQuality === q
                          ? 'bg-[#1a2340] text-[#c8a84b]'
                          : 'bg-[#1a2340]/10 text-[#1a2340]/60 hover:bg-[#1a2340]/20'
                      }`}
                    >
                      {q}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </div>

        <div className="mt-8 flex gap-3">
          <button
            onClick={onClose}
            className="flex-1 py-2.5 border border-[#1a2340]/20 rounded-lg text-[#1a2340]/60 text-sm hover:border-[#1a2340]/40 transition-all"
          >
            Cancel
          </button>
          <button
            onClick={save}
            className="flex-1 py-2.5 bg-[#1a2340] text-[#c8a84b] rounded-lg text-sm font-bold tracking-wider uppercase hover:bg-[#1a2340]/90 transition-all"
          >
            Save
          </button>
        </div>
      </motion.div>
    </div>
  );
}

function SliderRow({ label, value, onChange }: { label: string; value: number; onChange: (v: number) => void }) {
  return (
    <div className="flex items-center gap-4">
      <span className="text-[#1a2340] text-sm w-28">{label}</span>
      <input
        type="range"
        min={0} max={1} step={0.05}
        value={value}
        onChange={e => onChange(parseFloat(e.target.value))}
        className="flex-1 accent-[#c8a84b]"
      />
      <span className="text-[#1a2340]/60 text-xs w-8 text-right">{Math.round(value * 100)}%</span>
    </div>
  );
}
