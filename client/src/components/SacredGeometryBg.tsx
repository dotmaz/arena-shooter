export default function SacredGeometryBg() {
  return (
    <div className="absolute inset-0 overflow-hidden pointer-events-none">
      <svg
        className="absolute inset-0 w-full h-full opacity-20"
        viewBox="0 0 1200 800"
        preserveAspectRatio="xMidYMid slice"
        xmlns="http://www.w3.org/2000/svg"
      >
        <defs>
          <radialGradient id="centerGlow" cx="50%" cy="50%" r="50%">
            <stop offset="0%" stopColor="#c8a84b" stopOpacity="0.15" />
            <stop offset="100%" stopColor="#c8a84b" stopOpacity="0" />
          </radialGradient>
        </defs>

        {/* Background glow */}
        <ellipse cx="600" cy="400" rx="500" ry="400" fill="url(#centerGlow)" />

        {/* Flower of Life — intersecting circles */}
        {[
          [600, 400], [700, 400], [500, 400],
          [650, 313], [550, 313], [650, 487], [550, 487],
        ].map(([cx, cy], i) => (
          <circle key={i} cx={cx} cy={cy} r="100" fill="none" stroke="#c8a84b" strokeWidth="0.8" />
        ))}

        {/* Golden ratio spiral approximation */}
        <g stroke="#c8a84b" strokeWidth="0.6" fill="none">
          <circle cx="600" cy="400" r="40" />
          <circle cx="600" cy="400" r="65" />
          <circle cx="600" cy="400" r="105" />
          <circle cx="600" cy="400" r="170" />
          <circle cx="600" cy="400" r="275" />
          <circle cx="600" cy="400" r="445" />
        </g>

        {/* Vesica Piscis */}
        <g stroke="#c8a84b" strokeWidth="0.5" fill="none" opacity="0.6">
          <circle cx="480" cy="400" r="200" />
          <circle cx="720" cy="400" r="200" />
        </g>

        {/* Outer pentagon */}
        <polygon
          points="600,100 870,295 770,620 430,620 330,295"
          fill="none" stroke="#c8a84b" strokeWidth="0.5" opacity="0.4"
        />

        {/* Grid lines */}
        <g stroke="#c8a84b" strokeWidth="0.3" opacity="0.3">
          {Array.from({ length: 13 }).map((_, i) => (
            <line key={`v${i}`} x1={i * 100} y1="0" x2={i * 100} y2="800" />
          ))}
          {Array.from({ length: 9 }).map((_, i) => (
            <line key={`h${i}`} x1="0" y1={i * 100} x2="1200" y2={i * 100} />
          ))}
        </g>

        {/* Corner ornaments */}
        {[[60, 60], [1140, 60], [60, 740], [1140, 740]].map(([x, y], i) => (
          <g key={i} transform={`translate(${x},${y})`} stroke="#c8a84b" strokeWidth="0.8" fill="none">
            <circle cx="0" cy="0" r="30" />
            <circle cx="0" cy="0" r="20" />
            <line x1="-30" y1="0" x2="30" y2="0" />
            <line x1="0" y1="-30" x2="0" y2="30" />
          </g>
        ))}
      </svg>
    </div>
  );
}
