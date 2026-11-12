import * as Phaser from 'phaser';

export default class Preloader extends Phaser.Scene {
    constructor() {
        super({ key: 'Preloader' });
    }

    preload() {
        // Broadcast progress to React
        this.load.on('progress', (progress: number) => {
            window.dispatchEvent(new CustomEvent('phaserLoadProgress', { detail: { progress } }));
        });

        // Broadcast completion to React
        this.load.on('complete', () => {
            window.dispatchEvent(new CustomEvent('phaserLoadComplete'));
        });

        // Load Sprite Sheets for all characters with their correct intrinsic dimensions
        const charConfig: Record<string, number> = {
            'Fighter': 128,
            'Knight_1': 128,
            'Kunoichi': 128,
            'Ninja_Monk': 96,
            'Ninja_Peasant': 96,
            'Samurai': 128,
            'Samurai_1': 128,
            'Samurai_Archer': 128,
            'Samurai_Commander': 128,
            'Shinobi': 128
        };
        const actions = ['Idle', 'Run', 'Jump', 'Attack_1', 'Attack_2', 'Attack_3', 'Shield', 'Dead', 'Hurt'];

        Object.entries(charConfig).forEach(([char, size]) => {
            const keyPrefix = char.toLowerCase();
            actions.forEach(action => {
                // Skip missing Attack_3 for Ninja_Peasant to prevent the preloader from hanging on a 404
                if (char === 'Ninja_Peasant' && action === 'Attack_3') return;

                this.load.spritesheet(
                    `${keyPrefix}_${action.toLowerCase()}`, 
                    `/assets/sprites/${char}/${action}.png`, 
                    { frameWidth: size, frameHeight: size }
                );
            });
        });

        // Background Images (Menu Backdrop + 2D Combat Stage)
        this.load.image('bg', '/assets/arena_stage.png');
        this.load.image('menu_bg', '/assets/shin_bg.png');

        // Shared Sounds
        this.load.audio('hit', '/assets/sounds/hit.mp3');
        this.load.audio('death', '/assets/sounds/death.wav');
        this.load.audio('victory', '/assets/sounds/victory.mp3');
        this.load.audio('jump', '/assets/sounds/jump.wav');
        this.load.audio('move', '/assets/sounds/move.mp3');
        this.load.audio('idle', '/assets/sounds/idle.mp3');
        this.load.audio('arena_bgm', '/assets/sounds/arena_bgm.wav');

        // Character Specific Sounds
        this.load.audio('samurai_attack', '/assets/sounds/Samurai/samurai_attack.wav');
        this.load.audio('samurai_effort', '/assets/sounds/Samurai/samurai_effort.wav');
        this.load.audio('shinobi_attack', '/assets/sounds/Shinobi/shinobi_attack.wav');
        this.load.audio('shinobi_effort', '/assets/sounds/Shinobi/shinobi_effort.wav');
    }

    create() {
        // We do *not* automatically start the game scene here.
        // We wait for the React Main Menu to be clicked, which will dispatch an event to start it.
    }
}
