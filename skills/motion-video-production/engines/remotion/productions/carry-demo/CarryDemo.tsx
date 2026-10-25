import React from 'react';
import { AbsoluteFill, useCurrentFrame, useVideoConfig } from 'remotion';
import { FONT } from '../../src/fonts.ts';
import { COPY } from './copy.ts';
import { scene } from './scene.ts';

const INK = '#1D1D1F', WHITE = '#FFFFFF';
const line: React.CSSProperties = {
  position: 'absolute', left: 0, width: 1920, textAlign: 'center', lineHeight: 1.1, whiteSpace: 'nowrap',
  fontFamily: FONT.sans, letterSpacing: '-0.035em',
};

export const CarryDemo: React.FC = () => {
  const { fps } = useVideoConfig();
  const t = useCurrentFrame() / fps;
  const s = scene(t);
  return (
    <AbsoluteFill style={{ background: INK }}>
      {s.paper && <AbsoluteFill style={{ background: WHITE }} />}
      {s.inkRadius !== null && (
        <AbsoluteFill style={{ background: INK, clipPath: `circle(${s.inkRadius.toFixed(3)}% at 50% 50%)` }}>
          <div style={{ ...line, top: 360, fontSize: 280, fontWeight: 900, color: WHITE, opacity: s.big.opacity, transform: `scale(${s.big.scale})` }}>
            {COPY.big}
          </div>
          <div style={{ ...line, top: 720, fontSize: 72, fontWeight: 700, color: '#A1A1A6', opacity: s.tail.opacity }}>
            {COPY.tail}
          </div>
        </AbsoluteFill>
      )}
      {/* one element across the boundary, above both layers: the carry */}
      <div style={{ ...line, top: 420, fontSize: 150, fontWeight: 800, color: s.lead.color, opacity: s.lead.opacity, transform: `translateY(${s.lead.dy}px) scale(${s.lead.scale})` }}>
        {COPY.lead}
      </div>
    </AbsoluteFill>
  );
};
