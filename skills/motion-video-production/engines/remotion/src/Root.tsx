import React from 'react';
import { Composition } from 'remotion';
import { CarryDemo } from '../productions/carry-demo/CarryDemo.tsx';
import { CARRY_DEMO } from '../productions/carry-demo/timing.ts';
import { Wordcut, type WordcutProps } from '../productions/wordcut/Wordcut.tsx';
import { WORDCUT } from '../productions/wordcut/timing.ts';
import { VIEW } from '../productions/wordcut/scene.ts';
import { DATA } from '../productions/wordcut/data.ts';

export const Root: React.FC = () => (
  <>
    <Composition id="carry-demo" component={CarryDemo} durationInFrames={CARRY_DEMO.seconds * CARRY_DEMO.fps} fps={CARRY_DEMO.fps} width={1920} height={1080} />
    <Composition id="wordcut" component={Wordcut} durationInFrames={WORDCUT.seconds * WORDCUT.fps} fps={WORDCUT.fps} width={VIEW[DATA.aspect].out[0]} height={VIEW[DATA.aspect].out[1]}
      defaultProps={{ aspect: DATA.aspect, diag: false } as WordcutProps}
      calculateMetadata={({ props }) => ({ width: VIEW[props.aspect].out[0], height: VIEW[props.aspect].out[1] })} />
  </>
);
