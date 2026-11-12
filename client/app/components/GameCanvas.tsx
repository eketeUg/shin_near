'use client';

import { useEffect, useRef, useState } from 'react';
import * as Phaser from 'phaser';

import ControlsOverlay from './ControlsOverlay';
import { GameScene } from '../game/scenes/GameScene';
import Preloader from '../game/scenes/Preloader';

const GameCanvas = () => {
    const gameRef = useRef<Phaser.Game | null>(null);
    useEffect(() => {
        // Prevent pinch zoom, but allow single-finger scrolling so users can hide the browser address bar
        const preventDefault = (e: TouchEvent) => {
            if (e.touches.length > 1) e.preventDefault(); 
        };
        
        document.addEventListener('touchmove', preventDefault, { passive: false });
        
        return () => {
            document.removeEventListener('touchmove', preventDefault);
        };
    }, []);

    useEffect(() => {
        if (typeof window !== 'undefined' && !gameRef.current) {
            const container = document.getElementById('game-root');
            const targetRatio = container ? container.clientWidth / container.clientHeight : (window.innerWidth / window.innerHeight);
            const gameWidth = Math.max(1280, 600 * targetRatio);

            const config: Phaser.Types.Core.GameConfig = {
                type: Phaser.CANVAS,
                parent: 'game-root', // Attach the canvas to our container
                width: gameWidth, 
                height: 600,
                scale: {
                    mode: Phaser.Scale.FIT,
                    autoCenter: Phaser.Scale.CENTER_BOTH,
                },
                physics: {
                    default: 'arcade',
                    arcade: {
                        gravity: { y: 600, x: 0 },
                        debug: false, // You can turn this off later
                    },
                },
            };

            gameRef.current = new Phaser.Game(config);

            // Manually add scenes and only start Preloader immediately
            gameRef.current.scene.add('Preloader', Preloader, true);
            gameRef.current.scene.add('GameScene', GameScene, false);
        }

        const handleStartGame = (e: Event) => {
            const customEvent = e as CustomEvent;
            if (gameRef.current) {
                // Pass the selection details (mode, p1, p2) to the GameScene's init() method
                gameRef.current.scene.start('GameScene', customEvent.detail);
            }
        };

        window.addEventListener('startGameScene', handleStartGame);

        return () => {
            window.removeEventListener('startGameScene', handleStartGame);
            if (gameRef.current) {
                gameRef.current.destroy(true);
                gameRef.current = null;
            }
        };
    }, []);

    return (
        <div className="fixed top-0 left-0 w-screen h-[100dvh] bg-black flex items-center justify-center overflow-hidden">
            
            {/* Main Game Wrapper */}
            <div className="
                relative 
                w-full h-full 
                md:w-[1280px] md:h-[600px] 
                md:max-w-[95vw] md:max-h-[90dvh]
                md:rounded-xl md:shadow-2xl
                overflow-hidden
                landscape:block portrait:hidden md:portrait:block
            ">
                <div id="game-root" className="w-full h-full absolute inset-0 bg-gray-900" />
                <ControlsOverlay />
            </div>

            {/* Portrait Warning (Mobile Only) */}
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

export default GameCanvas;
