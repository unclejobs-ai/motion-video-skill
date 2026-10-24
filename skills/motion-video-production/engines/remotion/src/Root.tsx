import React from 'react';
import { Composition } from 'remotion';
import { CarryDemo } from '../productions/carry-demo/CarryDemo.tsx';
import { CARRY_DEMO } from '../productions/carry-demo/timing.ts';

export const Root: React.FC = () => (
  <>
    <Composition id="carry-demo" component={CarryDemo} durationInFrames={CARRY_DEMO.seconds * CARRY_DEMO.fps} fps={CARRY_DEMO.fps} width={1920} height={1080} />
  </>
);
