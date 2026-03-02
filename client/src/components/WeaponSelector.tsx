import { WeaponType, WEAPONS } from '../../../shared/game';

interface Props {
  current: WeaponType;
  onChange: (w: WeaponType) => void;
}

const WEAPON_KEYS: Array<{ key: string; type: WeaponType }> = [
  { key: '1', type: 'blaster' },
  { key: '2', type: 'shotgun' },
  { key: '3', type: 'railgun' },
  { key: '4', type: 'burst' },
];

export default function WeaponSelector({ current, onChange }: Props) {
  return (
    <div className="flex gap-2">
      {WEAPON_KEYS.map(({ key, type }) => {
        const wDef = WEAPONS[type];
        const hexColor = `#${wDef.color.toString(16).padStart(6, '0')}`;
        const isActive = current === type;

        return (
          <button
            key={type}
            onClick={() => onChange(type)}
            className={`relative flex flex-col items-center gap-1 px-3 py-2 rounded-lg border transition-all duration-150 ${
              isActive
                ? 'border-[#c8a84b] bg-[#c8a84b]/10 scale-105'
                : 'border-white/20 bg-black/40 hover:border-white/40'
            }`}
          >
            <span className="text-xs font-mono text-white/40">{key}</span>
            <div
              className="w-8 h-1 rounded-full"
              style={{ backgroundColor: hexColor, boxShadow: isActive ? `0 0 8px ${hexColor}` : 'none' }}
            />
            <span
              className="text-[10px] font-bold tracking-wider uppercase"
              style={{ color: isActive ? hexColor : 'rgba(255,255,255,0.5)' }}
            >
              {wDef.label}
            </span>
          </button>
        );
      })}
    </div>
  );
}
