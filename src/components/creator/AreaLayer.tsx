import React from 'react';
import { Area } from '../../types';

interface Props {
  areas: Area[];
  onContextMenu: (e: React.MouseEvent, areaId: string) => void;
  onSelect?: (areaId: string) => void;
}

export function AreaLayer({ areas, onContextMenu, onSelect }: Props) {
  return (
    <svg
      style={{
        position: 'absolute', top: 0, left: 0,
        overflow: 'visible', pointerEvents: 'none',
        width: '100%', height: '100%',
        zIndex: 0,
      }}
    >
      {areas.map(area => {
        const color = area.color ?? '#6366F1';
        // Unlocked areas get a slightly more visible fill to signal "editable"
        const bgOpacity = area.locked ? 0.04 : 0.09;
        const LABEL_PAD = 6;

        return (
          <g key={area.id}>
            {/* Background fill + border */}
            <rect
              x={area.x} y={area.y}
              width={area.width} height={area.height}
              fill={color}
              fillOpacity={bgOpacity}
              stroke={color}
              strokeWidth={area.locked ? 1.5 : 2}
              strokeDasharray={area.locked ? '8 4' : '5 3'}
              strokeOpacity={area.locked ? 0.6 : 0.9}
              rx={4}
              style={{ pointerEvents: 'auto', cursor: 'default' }}
              onClick={() => onSelect?.(area.id)}
              onContextMenu={e => {
                e.preventDefault();
                e.stopPropagation();
                onContextMenu(e, area.id);
              }}
            />

            {/* Name label pill */}
            <rect
              x={area.x + LABEL_PAD}
              y={area.y + LABEL_PAD}
              width={Math.min(area.width - LABEL_PAD * 2, area.name.length * 7 + 16)}
              height={20}
              rx={4}
              fill={color}
              fillOpacity={0.15}
              style={{ pointerEvents: 'none' }}
            />

            {/* Area name */}
            <text
              x={area.x + LABEL_PAD + 6}
              y={area.y + LABEL_PAD + 10}
              fontSize={11}
              fontWeight={600}
              fill={color}
              fillOpacity={0.9}
              dominantBaseline="middle"
              style={{ pointerEvents: 'none', userSelect: 'none' }}
            >
              {area.name}
            </text>

            {/* Lock status indicator — subtle, no click target (use right-click menu) */}
            <text
              x={area.x + area.width - LABEL_PAD - 4}
              y={area.y + LABEL_PAD + 10}
              fontSize={10}
              textAnchor="end"
              dominantBaseline="middle"
              fill={color}
              fillOpacity={area.locked ? 0.45 : 0.75}
              style={{ pointerEvents: 'none', userSelect: 'none' }}
            >
              {area.locked ? '⚲' : '✎'}
            </text>
          </g>
        );
      })}
    </svg>
  );
}
