'use client';

import { useEffect, useRef, useState } from 'react';
import * as Phaser from 'phaser';

import { SpectatorScene } from '../game/scenes/SpectatorScene';
import Preloader from '../game/scenes/Preloader';
import ControlsOverlay from './ControlsOverlay';

const SpectatorGameCanvas = ({ matchData }: { matchData: any }) => {
    const gameRef = useRef<Phaser.Game | null>(null);
    const [loadProgress, setLoadProgress] = useState(0);
    const [isGameLoaded, setIsGameLoaded] = useState(false);

    useEffect(() => {
        const preventDefault = (e: TouchEvent) => {
            if (e.touches.length > 1) e.preventDefault(); 
        };
        document.addEventListener('touchmove', preventDefault, { passive: false });
        
        return () => {
            document.removeEventListener('touchmove', preventDefault);
        };
    }, []);

    useEffect(() => {
        let isLoaded = false;

        if (typeof window !== 'undefined' && !gameRef.current) {
            const container = document.getElementById('spectator-game-root');
            const targetRatio = container ? container.clientWidth / container.clientHeight : (window.innerWidth / window.innerHeight);
            const gameWidth = Math.max(1280, 600 * targetRatio);

            const config: Phaser.Types.Core.GameConfig = {
                type: Phaser.CANVAS,
                parent: 'spectator-game-root',
                width: gameWidth, 
                height: 600,
                scale: {
                    mode: Phaser.Scale.FIT,
                    autoCenter: Phaser.Scale.CENTER_BOTH,
                },
                physics: {
                    default: 'arcade',
                    arcade: {
                        gravity: { y: 0, x: 0 }, // Handled entirely by host state updates
                        debug: false,
                    },
                },
            };

            gameRef.current = new Phaser.Game(config);

            gameRef.current.scene.add('Preloader', Preloader, true);
            gameRef.current.scene.add('SpectatorScene', SpectatorScene, false);
        }

        const handleLoadComplete = () => {
            isLoaded = true;
            if (matchData && gameRef.current) {
                gameRef.current.scene.start('SpectatorScene', matchData);
            }
        };

        window.addEventListener('phaserLoadComplete', handleLoadComplete);

        return () => {
            window.removeEventListener('phaserLoadComplete', handleLoadComplete);
            if (gameRef.current) {
                gameRef.current.destroy(true);
                gameRef.current = null;
            }
        };
    }, [matchData]);

    useEffect(() => {
        const handleProgress = (e: any) => {
            setLoadProgress(Math.floor(e.detail.progress * 100));
        };
        const handleComplete = () => {
            setIsGameLoaded(true);
        };

        window.addEventListener('phaserLoadProgress', handleProgress);
        window.addEventListener('phaserLoadComplete', handleComplete);

        return () => {
            window.removeEventListener('phaserLoadProgress', handleProgress);
            window.removeEventListener('phaserLoadComplete', handleComplete);
        };
    }, []);

    return (
        <div className="fixed top-0 left-0 w-screen h-[100dvh] bg-black flex items-center justify-center overflow-hidden">
            <div className="
                relative 
                w-full h-full 
                md:w-[1280px] md:h-[600px] 
                md:max-w-[95vw] md:max-h-[90dvh]
                md:rounded-xl md:shadow-2xl
                overflow-hidden
                landscape:block portrait:hidden md:portrait:block
            ">
                <div id="spectator-game-root" className="w-full h-full" />
                <ControlsOverlay isSpectator={true} isInteractiveClient={matchData?.isInteractiveClient} />
                
                {/* HUD Overlay for Spectator Data (read-only) */}
                {!matchData?.isInteractiveClient && (
                    <div className="absolute top-6 left-1/2 -translate-x-1/2 flex justify-between text-white drop-shadow-md z-40 bg-black/60 px-6 py-2 border border-red-900 rounded-full">
                         <span className="text-red-500 font-cinzel tracking-[0.3em] font-black text-sm flex items-center gap-3">
                             <div className="w-3 h-3 bg-red-600 rounded-full animate-pulse"></div>
                             LIVE BROADCAST
                         </span>
                    </div>
                )}

                {/* Spectator Loading Overlay */}
                {!isGameLoaded && (
                    <div className="absolute inset-0 z-[100] flex flex-col items-center justify-center bg-black/90 text-white backdrop-blur-md">
                        <h2 className="text-2xl font-cinzel tracking-widest text-shin-red mb-4 animate-pulse">CONNECTING TO ARENA</h2>
                        <div className="w-64 h-1 bg-gray-900 overflow-hidden border border-gray-800">
                            <div className="h-full bg-shin-red transition-all duration-200" style={{ width: `${loadProgress}%` }} />
                        </div>
                        <p className="mt-2 text-xs text-gray-500 font-mono tracking-widest">{loadProgress}%</p>
                    </div>
                )}
            </div>

            <div className="
                fixed inset-0 z-50 flex flex-col items-center justify-center 
                bg-black text-white p-8 text-center
                landscape:hidden md:hidden
            ">
                <div className="animate-pulse">
                    <h1 className="text-3xl font-black font-cinzel text-shin-red mb-4">ROTATE DEVICE</h1>
                    <p className="text-gray-400 text-sm mb-8 tracking-widest uppercase"> Landscape Mode Required</p>
                    <div className="text-6xl text-shin-gold">⟳</div>
                </div>
            </div>
        </div>
    );
};

export default SpectatorGameCanvas;
