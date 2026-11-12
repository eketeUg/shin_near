'use client';

import dynamic from 'next/dynamic';

const GameCanvas = dynamic(() => import('./GameCanvas'), { ssr: false });

const GameCanvasWrapper = () => {
    return <GameCanvas />;
};

export default GameCanvasWrapper;
