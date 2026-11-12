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
            const longEdge = Math.max(window.innerWidth, window.innerHeight);
            const shortEdge = Math.max(1, Math.min(window.innerWidth, window.innerHeight));
            const safeRatio = longEdge / shortEdge;
            const gameWidth = Math.min(1600, Math.max(1280, Math.round(600 * safeRatio)));

            const config: Phaser.Types.Core.GameConfig = {
                type: Phaser.CANVAS,
                parent: 'game-root',
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
                        debug: false,
                    },
                },
            };

            gameRef.current = new Phaser.Game(config);

            gameRef.current.scene.add('Preloader', Preloader, true);
            gameRef.current.scene.add('GameScene', GameScene, false);
        }

        const handleResize = () => {
            if (gameRef.current?.scale) {
                gameRef.current.scale.refresh();
            }
        };

        const handleStartGame = (e: Event) => {
            const customEvent = e as CustomEvent;
            if (gameRef.current) {
                gameRef.current.scene.start('GameScene', customEvent.detail);
            }
        };

        window.addEventListener('resize', handleResize);
        window.addEventListener('orientationchange', handleResize);
        window.addEventListener('startGameScene', handleStartGame);

        return () => {
            window.removeEventListener('resize', handleResize);
            window.removeEventListener('orientationchange', handleResize);
            window.removeEventListener('startGameScene', handleStartGame);
            if (gameRef.current) {
                gameRef.current.destroy(true);
                gameRef.current = null;
            }
        };
    }, []);

    return (
        <div className="fixed inset-0 w-full h-full bg-black flex items-center justify-center overflow-hidden">
            {/* Main Game Wrapper — Automatically Widescreen Landscape on Mobile & Desktop */}
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
                    id="game-root"
                    className="w-full h-full absolute inset-0 bg-gray-950"
                />
                <ControlsOverlay />
            </div>
        </div>
    );
};

export default GameCanvas;
