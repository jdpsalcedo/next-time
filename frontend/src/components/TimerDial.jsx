import { useEffect, useRef, useState } from 'react';

const SIZE = 280;
const STROKE = 36;
const PAD = 4;
const R = (SIZE - STROKE) / 2 - PAD;
const CX = SIZE / 2;
const CY = SIZE / 2;
const CIRC = 2 * Math.PI * R;

function angleFromPointer(svgEl, clientX, clientY) {
  const rect = svgEl.getBoundingClientRect();
  const x = clientX - rect.left - rect.width / 2;
  const y = clientY - rect.top - rect.height / 2;
  const rad = Math.atan2(y, x);
  const fromTop = (rad + Math.PI / 2 + 2 * Math.PI) % (2 * Math.PI);
  return fromTop / (2 * Math.PI);
}

export default function TimerDial({
  totalSec,
  totalElapsed,
  splits,
  topLabel,
  centerLabel,
  bottomLabel,
  onSeek,
  onCenterTap,
}) {
  const svgRef = useRef(null);
  const [dragging, setDragging] = useState(false);

  const safeTotal = Math.max(1, totalSec);
  const progress = Math.max(0, Math.min(1, totalElapsed / safeTotal));

  function hitZone(clientX, clientY) {
    const el = svgRef.current;
    if (!el) return 'outside';
    const rect = el.getBoundingClientRect();
    const x = clientX - rect.left - rect.width / 2;
    const y = clientY - rect.top - rect.height / 2;
    const dist = Math.sqrt(x * x + y * y);
    const tolerance = 4;
    if (dist > R + STROKE / 2 + tolerance) return 'outside';
    if (dist < R - STROKE / 2 - tolerance) return 'center';
    return 'ring';
  }

  const boundaries = [];
  let cum = 0;
  for (let i = 0; i < splits.length - 1; i++) {
    cum += splits[i].duration_seconds;
    if (cum < safeTotal) boundaries.push(cum / safeTotal);
  }

  useEffect(() => {
    if (!dragging) return;
    function move(e) {
      if (!svgRef.current || !onSeek) return;
      const frac = angleFromPointer(svgRef.current, e.clientX, e.clientY);
      onSeek(frac * safeTotal);
    }
    function up() {
      setDragging(false);
    }
    document.addEventListener('pointermove', move);
    document.addEventListener('pointerup', up);
    document.addEventListener('pointercancel', up);
    return () => {
      document.removeEventListener('pointermove', move);
      document.removeEventListener('pointerup', up);
      document.removeEventListener('pointercancel', up);
    };
  }, [dragging, onSeek, safeTotal]);

  function onDown(e) {
    if (!svgRef.current) return;
    const zone = hitZone(e.clientX, e.clientY);
    if (zone === 'ring' && onSeek) {
      e.preventDefault();
      setDragging(true);
      const frac = angleFromPointer(svgRef.current, e.clientX, e.clientY);
      onSeek(frac * safeTotal);
    } else if (zone === 'center' && onCenterTap) {
      e.preventDefault();
      onCenterTap();
    }
  }

  return (
    <svg
      ref={svgRef}
      width={SIZE}
      height={SIZE}
      viewBox={`0 0 ${SIZE} ${SIZE}`}
      className={`timer-dial ${onSeek ? 'seekable' : ''}`}
      onPointerDown={onDown}
    >
      <circle
        cx={CX}
        cy={CY}
        r={R}
        className="timer-dial-track"
        strokeWidth={STROKE}
        fill="none"
      />
      <circle
        cx={CX}
        cy={CY}
        r={R}
        className="timer-dial-progress"
        strokeWidth={STROKE}
        fill="none"
        strokeDasharray={`${CIRC * progress} ${CIRC}`}
        transform={`rotate(-90 ${CX} ${CY})`}
        strokeLinecap="butt"
      />
      {boundaries.map((frac, i) => {
        const angleRad = (-90 + frac * 360) * (Math.PI / 180);
        const inset = STROKE / 2 + 2;
        const x1 = CX + (R - inset) * Math.cos(angleRad);
        const y1 = CY + (R - inset) * Math.sin(angleRad);
        const x2 = CX + (R + inset) * Math.cos(angleRad);
        const y2 = CY + (R + inset) * Math.sin(angleRad);
        return (
          <line
            key={i}
            x1={x1}
            y1={y1}
            x2={x2}
            y2={y2}
            className="timer-dial-divider"
            strokeWidth={3}
          />
        );
      })}

      {topLabel && (
        <text x={CX} y={CY - 32} textAnchor="middle" className="timer-dial-top">
          {topLabel}
        </text>
      )}
      {centerLabel && (
        <text x={CX} y={CY + 10} textAnchor="middle" className="timer-dial-center">
          {centerLabel}
        </text>
      )}
      {bottomLabel && (
        <text x={CX} y={CY + 40} textAnchor="middle" className="timer-dial-bottom">
          {bottomLabel}
        </text>
      )}
    </svg>
  );
}
