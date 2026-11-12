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
            const longEdge = Math.max(window.innerWidth, window.innerHeight);
            const shortEdge = Math.max(1, Math.min(window.innerWidth, window.innerHeight));
            const safeRatio = longEdge / shortEdge;
            const gameWidth = Math.min(1600, Math.max(1280, Math.round(600 * safeRatio)));

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
                        gravity: { y: 0, x: 0 },
                        debug: false,
                    },
                },
            };

            gameRef.current = new Phaser.Game(config);

            gameRef.current.scene.add('Preloader', Preloader, true);
            gameRef.current.scene.add('SpectatorScene', SpectatorScene, false);
        }

        const handleResize = () => {
            if (gameRef.current?.scale) {
                gameRef.current.scale.refresh();
            }
        };

        const handleLoadComplete = () => {
            isLoaded = true;
            if (matchData && gameRef.current) {
                gameRef.current.scene.start('SpectatorScene', matchData);
            }
        };

        window.addEventListener('resize', handleResize);
        window.addEventListener('orientationchange', handleResize);
        window.addEventListener('phaserLoadComplete', handleLoadComplete);

        return () => {
            window.removeEventListener('resize', handleResize);
            window.removeEventListener('orientationchange', handleResize);
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
        <div className="fixed inset-0 w-full h-full bg-black flex items-center justify-center overflow-hidden">
            <div
                className="
                relative 
                w-full h-full 
                lg:w-[1280px] lg:h-[600px] 
                lg:max-w-[95vw] lg:max-h-[90dvh]
                lg:rounded-xl lg:shadow-2xl
                overflow-hidden
            "
            >
                <div
                    id="spectator-game-root"
                    className="w-full h-full"
                />
                <ControlsOverlay isSpectator={true} isInteractiveClient={matchData?.isInteractiveClient} />
                
                {/* HUD Overlay for Spectator Data (read-only) */}
                {!matchData?.isInteractiveClient && (
                    <div className="absolute top-14 sm:top-6 left-1/2 -translate-x-1/2 flex justify-between text-white drop-shadow-md z-40 bg-black/60 px-4 sm:px-6 py-1.5 sm:py-2 border border-red-900 rounded-full">
                         <span className="text-red-500 font-cinzel tracking-[0.2em] sm:tracking-[0.3em] font-black text-[10px] sm:text-sm flex items-center gap-2">
                             <div className="w-2.5 h-2.5 bg-red-600 rounded-full animate-pulse"></div>
                             LIVE BROADCAST
                         </span>
                    </div>
                )}

                {/* Spectator Loading Overlay */}
                {!isGameLoaded && (
                    <div className="absolute inset-0 z-[100] flex flex-col items-center justify-center bg-black/90 text-white backdrop-blur-md">
                        <h2 className="text-xl sm:text-2xl font-cinzel tracking-widest text-shin-red mb-4 animate-pulse">CONNECTING TO ARENA</h2>
                        <div className="w-56 sm:w-64 h-1 bg-gray-900 overflow-hidden border border-gray-800">
                            <div className="h-full bg-shin-red transition-all duration-200" style={{ width: `${loadProgress}%` }} />
                        </div>
                        <p className="mt-2 text-xs text-gray-500 font-mono tracking-widest">{loadProgress}%</p>
                    </div>
                )}
            </div>
        </div>
    );
};

export default SpectatorGameCanvas;
