import React from 'react';
import { PortType, PORT_COLORS } from '../../types';

/**
 * Stylized connector symbols loosely modeled on DIN/IEC conventions.
 * All symbols are drawn in a 40×40 viewBox, centered.
 */
interface Props {
  type: PortType;
  size?: number;
  /** Optional label shown beneath the symbol */
  label?: string;
  /** When true, mirror the symbol (e.g. Out vs In) */
  mirrored?: boolean;
}

export function ConnectorSymbol({ type, size = 40, label, mirrored }: Props) {
  const color = PORT_COLORS[type] ?? '#6b7280';
  const stroke = '#1f2937';

  return (
    <div
      style={{
        display: 'inline-flex',
        flexDirection: 'column',
        alignItems: 'center',
        gap: 2,
        transform: mirrored ? 'scaleX(-1)' : undefined,
      }}
      title={type}
    >
      <svg width={size} height={size} viewBox="0 0 40 40">
        {renderSymbol(type, color, stroke)}
      </svg>
      {label && (
        <span
          style={{
            fontSize: 9,
            color: '#475569',
            fontFamily: 'ui-monospace, SFMono-Regular, monospace',
            transform: mirrored ? 'scaleX(-1)' : undefined,
          }}
        >
          {label}
        </span>
      )}
    </div>
  );
}

function renderSymbol(type: PortType, color: string, stroke: string): React.ReactElement {
  switch (type) {
    case 'hdmi':
    case 'hdmi-in':
    case 'hdmi-out':
      // Trapezoid (HDMI Type A shape)
      return (
        <g>
          <path
            d="M 6 14 L 34 14 L 31 26 L 9 26 Z"
            fill={color} stroke={stroke} strokeWidth="1.5"
            strokeLinejoin="round"
          />
          <rect x="11" y="17" width="18" height="6" fill={stroke} opacity="0.4" rx="0.5" />
        </g>
      );

    case 'displayport':
    case 'displayport-in':
    case 'displayport-out':
      // Asymmetric pentagon (DisplayPort)
      return (
        <g>
          <path
            d="M 6 14 L 30 14 L 34 18 L 34 26 L 6 26 Z"
            fill={color} stroke={stroke} strokeWidth="1.5"
            strokeLinejoin="round"
          />
          <rect x="9" y="17" width="20" height="6" fill={stroke} opacity="0.4" rx="0.5" />
        </g>
      );

    case 'usb-a':
      // USB Type-A: rectangle with offset insertion bar
      return (
        <g>
          <rect x="6" y="14" width="28" height="12" fill={color} stroke={stroke} strokeWidth="1.5" rx="1.5" />
          <rect x="9" y="17" width="22" height="3" fill="white" stroke={stroke} strokeWidth="0.7" />
        </g>
      );

    case 'usb-b':
      // USB Type-B: trapezoid (square-ish)
      return (
        <g>
          <path
            d="M 10 12 L 30 12 L 28 28 L 12 28 Z"
            fill={color} stroke={stroke} strokeWidth="1.5"
            strokeLinejoin="round"
          />
          <rect x="14" y="16" width="12" height="8" fill={stroke} opacity="0.4" rx="0.5" />
        </g>
      );

    case 'usb-c':
    case 'usb-c-out':
      // USB Type-C: rounded oval
      return (
        <g>
          <rect x="6" y="16" width="28" height="8" fill={color} stroke={stroke} strokeWidth="1.5" rx="4" />
          <rect x="11" y="18" width="18" height="4" fill={stroke} opacity="0.4" rx="2" />
        </g>
      );

    case 'rj45':
    case 'rj45-poe':
      // RJ45 with stepped tab
      return (
        <g>
          <path
            d="M 8 14 L 32 14 L 32 24 L 26 24 L 26 28 L 14 28 L 14 24 L 8 24 Z"
            fill={color} stroke={stroke} strokeWidth="1.5"
            strokeLinejoin="round"
          />
          {/* Pin contacts */}
          {[0,1,2,3,4,5,6,7].map(i => (
            <line key={i}
              x1={11 + i * 2.5} y1="16"
              x2={11 + i * 2.5} y2="22"
              stroke={stroke} strokeWidth="0.6"
            />
          ))}
          {type === 'rj45-poe' && (
            <text x="20" y="13" textAnchor="middle" fontSize="6" fontWeight="700" fill={stroke}>
              PoE
            </text>
          )}
        </g>
      );

    case 'power-c13':
    case 'power-c14':
      // IEC 60320 C13/C14: rounded rectangle with chamfered top
      return (
        <g>
          <path
            d="M 9 13 L 27 13 L 31 18 L 31 28 L 9 28 Z"
            fill={color} stroke={stroke} strokeWidth="1.5"
            strokeLinejoin="round"
          />
          {/* Three pin holes */}
          <circle cx="14" cy="22" r="1.5" fill={stroke} />
          <circle cx="20" cy="22" r="1.5" fill={stroke} />
          <circle cx="26" cy="22" r="1.5" fill={stroke} />
          <text x="20" y="36" textAnchor="middle" fontSize="6" fontWeight="700" fill={stroke}>
            {type === 'power-c14' ? 'C14' : 'C13'}
          </text>
        </g>
      );

    case 'power-eu':
    case 'power-eu-out':
      // CEE 7/3 Schuko: round outline with two holes + earth clips
      return (
        <g>
          <circle cx="20" cy="20" r="12" fill={color} stroke={stroke} strokeWidth="1.5" />
          <circle cx="16" cy="20" r="2" fill={stroke} />
          <circle cx="24" cy="20" r="2" fill={stroke} />
          {/* Earth clips */}
          <rect x="19" y="9" width="2" height="3" fill={stroke} />
          <rect x="19" y="28" width="2" height="3" fill={stroke} />
        </g>
      );

    case 'audio-3.5':
    case 'audio-3.5-in':
    case 'audio-3.5-out':
      // 3.5mm Klinke: circle with smaller circle
      return (
        <g>
          <circle cx="20" cy="20" r="11" fill={color} stroke={stroke} strokeWidth="1.5" />
          <circle cx="20" cy="20" r="4" fill="white" stroke={stroke} strokeWidth="1" />
          <circle cx="20" cy="20" r="1.5" fill={stroke} />
        </g>
      );

    case 'logi-micpod':
    case 'logi-micpod-host':
    case 'logi-micpod-in':
    case 'logi-micpod-out':
      // Logitech proprietary 12-pin: round D-shape with 12 pin marks
      return (
        <g>
          <path
            d="M 9 14 L 31 14 A 6 6 0 0 1 31 26 L 9 26 A 6 6 0 0 1 9 14 Z"
            fill={color} stroke={stroke} strokeWidth="1.5"
            strokeLinejoin="round"
          />
          {/* 12 pins arranged as 2 rows of 6 */}
          {[0,1,2,3,4,5].map(i => (
            <circle key={`top-${i}`} cx={13 + i * 2.6} cy="18" r="0.7" fill={stroke} />
          ))}
          {[0,1,2,3,4,5].map(i => (
            <circle key={`bot-${i}`} cx={13 + i * 2.6} cy="22" r="0.7" fill={stroke} />
          ))}
          <text x="20" y="36" textAnchor="middle" fontSize="5.5" fontWeight="700" fill={stroke}>
            MicPod
          </text>
        </g>
      );

    case 'usb-micro':
      // USB Micro-B: trapezoid (smaller than B)
      return (
        <g>
          <path
            d="M 11 16 L 29 16 L 27 24 L 13 24 Z"
            fill={color} stroke={stroke} strokeWidth="1.5"
            strokeLinejoin="round"
          />
          <rect x="14" y="18" width="12" height="4" fill={stroke} opacity="0.4" rx="0.5" />
        </g>
      );

    default:
      return (
        <rect x="8" y="14" width="24" height="12" fill={color} stroke={stroke} strokeWidth="1.5" rx="2" />
      );
  }
}
