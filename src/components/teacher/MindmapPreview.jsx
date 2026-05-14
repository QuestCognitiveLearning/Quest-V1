import React from "react";

export default function MindmapPreview({ curriculum }) {
  if (!curriculum || !curriculum.units) return null;

  const totalUnits = curriculum.units.length;

  return (
    <div className="w-full h-40 bg-gradient-to-br from-slate-50 to-blue-50 rounded-xl p-4 flex items-center justify-center border border-blue-100">
      <svg width="100%" height="100%" viewBox="0 0 220 120" preserveAspectRatio="xMidYMid meet">
        <defs>
          <filter id="shadow-mini">
            <feDropShadow dx="0" dy="1" stdDeviation="2" floodOpacity="0.15"/>
          </filter>
        </defs>

        {/* Center circle */}
        <circle cx="110" cy="60" r="16" fill="#4f76f6" filter="url(#shadow-mini)" />
        <text x="110" y="60" textAnchor="middle" dominantBaseline="middle" className="text-[6px] fill-white font-bold">
          {curriculum.units.length}
        </text>

        {/* Unit circles arranged in a circle */}
        {curriculum.units.slice(0, 8).map((unit, index) => {
          const angle = (index / Math.min(totalUnits, 8)) * 2 * Math.PI;
          const radius = 42;
          const x = 110 + Math.cos(angle) * radius;
          const y = 60 + Math.sin(angle) * radius;
          
          return (
            <g key={index}>
              {/* Line to center */}
              <line x1="110" y1="60" x2={x} y2={y} stroke="#cbd5e1" strokeWidth="1" opacity="0.5" />
              
              {/* Unit circle */}
              <circle cx={x} cy={y} r="11" fill="white" stroke="#4f76f6" strokeWidth="1.5" filter="url(#shadow-mini)" />
              <text x={x} y={y} textAnchor="middle" dominantBaseline="middle" className="text-[5px] fill-blue-600 font-bold">
                {unit.subunits.length}
              </text>
            </g>
          );
        })}
      </svg>
    </div>
  );
}