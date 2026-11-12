'use client';

import dynamic from 'next/dynamic';

const SpectatorGameCanvas = dynamic(() => import('./SpectatorGameCanvas'), {
  ssr: false, 
});

export default function SpectatorGameCanvasWrapper({ matchData }: { matchData: any }) {
  return <SpectatorGameCanvas matchData={matchData} />;
}
