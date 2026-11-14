import * as Phaser from 'phaser';
import Player from '../entities/Player';
import { io, Socket } from 'socket.io-client';

export class SpectatorScene extends Phaser.Scene {
    private player!: Player;
    private player2!: Player;
    private background!: Phaser.GameObjects.TileSprite;
    
    // Spectator Mode variables
    private socket: Socket | null = null;
    private matchId!: string;
    
    private p1CharType: string = 'shinobi';
    private p2CharType: string = 'samurai';
    private p1Name: string = 'Player 1';
    private p2Name: string = 'Player 2';
    
    // Interactive Client Role variable
    private isInteractiveClient: boolean = false;
    private lastInputStr: string = "";
    
    constructor() {
        super({ key: 'SpectatorScene' });
    }

    init(data: { matchId: string, p1Type?: string, p2Type?: string, hostName?: string, p1Name?: string, p2Name?: string, isInteractiveClient?: boolean, opponentChar?: string, myChar?: string, opponentName?: string, myName?: string }) {
        this.matchId = data.matchId;
        
        if (data.isInteractiveClient) {
            this.p1CharType = data.opponentChar || 'shinobi'; // Host is P1
            this.p2CharType = data.myChar || 'samurai';       // Client is P2
            this.p1Name = data.opponentName || 'Player 1';
            this.p2Name = data.myName || 'YOU';
            this.isInteractiveClient = data.isInteractiveClient;
        } else {
            this.p1CharType = (data.p1Type || 'shinobi').toLowerCase();
            this.p2CharType = (data.p2Type || 'samurai').toLowerCase();
            this.p1Name = data.p1Name || data.hostName || 'Player 1';
            this.p2Name = data.p2Name || data.opponentName || 'Challenger';
        }
    }

    create() {
        const width = this.scale.width;
        const height = this.scale.height;
        this.background = this.add.tileSprite(width / 2, height / 2, width, height, 'bg');
        this.background.setDisplaySize(width, height);
        this.background.setScrollFactor(0);
        this.background.setAlpha(0.92);

        const uiHeight = 115; 
        const floorOverlay = this.add.rectangle(width / 2, height - (uiHeight / 2), width, uiHeight, 0x050507, 0.45);
        floorOverlay.setDepth(10);
        const floorGlowLine = this.add.rectangle(width / 2, height - uiHeight, width, 2, 0xfbbf24, 0.45);
        floorGlowLine.setDepth(11);

        // Dynamically create animations for all 10 characters
        const characters = [
            'Fighter', 'Knight_1', 'Kunoichi', 'Ninja_Monk', 'Ninja_Peasant',
            'Samurai', 'Samurai_1', 'Samurai_Archer', 'Samurai_Commander', 'Shinobi'
        ];

        characters.forEach(char => {
            const prefix = char.toLowerCase();
            const animConfig = [
                { key: 'idle', tex: 'idle', rate: 8, repeat: -1 },
                { key: 'run', tex: 'run', rate: 12, repeat: -1 },
                { key: 'jump', tex: 'jump', rate: 15, repeat: 0 },
                { key: 'attack_1', tex: 'attack_1', rate: 15, repeat: 0 },
                { key: 'attack_2', tex: 'attack_2', rate: 15, repeat: 0 },
                { key: 'attack_3', tex: 'attack_3', rate: 15, repeat: 0 },
                { key: 'block', tex: 'shield', rate: 12, repeat: 0 },
                { key: 'dead', tex: 'dead', rate: 8, repeat: 0 }
            ];

            animConfig.forEach(cfg => {
                const texKey = `${prefix}_${cfg.tex}`;
                if (this.textures.exists(texKey)) {
                    this.anims.create({
                        key: `${prefix}_${cfg.key}`,
                        frames: this.anims.generateFrameNumbers(texKey),
                        frameRate: cfg.rate,
                        repeat: cfg.repeat
                    });
                }
            });
        });

        this.physics.world.setBounds(0, 0, width, height - uiHeight);

        // Initialize Player entities but we will override their physics
        this.player = new Player(this, width / 2 - 200, height - uiHeight - 100, `${this.p1CharType}_idle`, this.p1CharType, 'local_player', false);
        this.player2 = new Player(this, width / 2 + 200, height - uiHeight - 100, `${this.p2CharType}_idle`, this.p2CharType, 'remote_player', false);
        
        // Disable gravity/physics for spectators, we perfectly mirror the host
        const p1Body = this.player.body as Phaser.Physics.Arcade.Body;
        const p2Body = this.player2.body as Phaser.Physics.Arcade.Body;
        if (p1Body) p1Body.setAllowGravity(false);
        if (p2Body) p2Body.setAllowGravity(false);

        // Start Arena Background Music
        try {
            const bgm = this.sound.add('arena_bgm', { loop: true, volume: 0.5 });
            bgm.play();
            window.dispatchEvent(new CustomEvent('arenaStarted'));
        } catch (e) {
            console.warn('Arena BGM not loaded');
        }

        // Notify Overlay of Match Start
        window.dispatchEvent(new CustomEvent('matchStarted', { detail: { p1Name: this.p1Name, p2Name: this.p2Name, totalRounds: 3 } }));

        // Connect to Server as Spectator
        try {
            const envUrl = process.env.NEXT_PUBLIC_SERVER_URL;
            let wsUrl = envUrl || 'http://localhost:3001';
            if (typeof window !== 'undefined') {
                const host = window.location.hostname;
                if (
                    (!envUrl || envUrl.includes('localhost') || envUrl.includes('127.0.0.1')) &&
                    host &&
                    host !== 'localhost' &&
                    host !== '127.0.0.1'
                ) {
                    wsUrl = `${window.location.protocol}//${host}:3001`;
                }
            }
            const customPath = wsUrl.includes('/shin') ? '/shin/socket.io' : '/socket.io';
            const origin = new URL(wsUrl).origin;
            this.socket = io(origin, { path: customPath });
            
            this.socket.on('connect', () => {
                console.log(`Connected. Joining match ${this.matchId} as Spectator...`);
                this.socket?.emit('join_spectator', this.matchId);
            });

            this.socket.on('spectator_sync_frame', (frameData: any) => {
                this.syncState(frameData);
            });

            let hasEnded = false;
            let autoLeaveTimer: ReturnType<typeof setTimeout> | null = null;

            const scheduleStreamAutoClose = () => {
                if (autoLeaveTimer) clearTimeout(autoLeaveTimer);
                autoLeaveTimer = setTimeout(() => {
                    window.dispatchEvent(new CustomEvent('leaveSpectator'));
                }, 4500);
            };

            this.socket.on('spectator_fire_event', (payload: any) => {
                if (payload.type === 'audio') {
                    this.playAudioEvent(payload.data);
                } else if (payload.type === 'match_event') {
                    if (payload.data?.event === 'gameOver') {
                        hasEnded = true;
                        scheduleStreamAutoClose();
                    }
                    // Forward match events (roundEnded, gameOver) to ControlsOverlay
                    window.dispatchEvent(new CustomEvent(payload.data.event, { detail: payload.data.detail }));
                }
            });

            this.socket.on('match_ended', (endData?: any) => {
                console.log('Match stream ended.', endData);
                if (!hasEnded) {
                    hasEnded = true;
                    const p1Hp = this.player?.hp ?? 100;
                    const p2Hp = this.player2?.hp ?? 100;
                    const p1Won = p1Hp >= p2Hp;
                    window.dispatchEvent(
                        new CustomEvent('gameOver', {
                            detail: {
                                matchId: this.matchId,
                                winner: p1Won ? this.p1Name : this.p2Name,
                                winnerId: p1Won ? 'p1' : 'p2',
                                winnerPubKey: endData?.winnerAccountId,
                                duration: 'Stream Concluded',
                                roundsScore: p1Won ? '1 - 0' : '0 - 1',
                                p1Stats: {
                                    name: this.p1Name,
                                    charType: this.p1CharType,
                                    damageDealt: Math.max(0, 100 - p2Hp),
                                    hitsLanded: Math.max(1, Math.round((100 - p2Hp) / 5)),
                                    specialsLanded: 0,
                                    blocks: 0,
                                },
                                p2Stats: {
                                    name: this.p2Name,
                                    charType: this.p2CharType,
                                    damageDealt: Math.max(0, 100 - p1Hp),
                                    hitsLanded: Math.max(1, Math.round((100 - p1Hp) / 5)),
                                    specialsLanded: 0,
                                    blocks: 0,
                                },
                            },
                        }),
                    );
                }
                scheduleStreamAutoClose();
            });

            // Cleanup UI listener on destroy
            this.events.on(Phaser.Scenes.Events.DESTROY, () => {
                if (autoLeaveTimer) clearTimeout(autoLeaveTimer);
                try {
                    this.sound.stopAll();
                } catch {}
                if (this.socket) {
                    this.socket.emit('leave_spectator', this.matchId);
                    this.socket.disconnect();
                }
            });
            
            // Interactive Inputs
            if (this.isInteractiveClient) {
                this.setupDOMEventListeners();
            }
            
        } catch(e) {
            console.warn("Could not connect to broadcast server", e);
        }
    }

    private syncState(data: any) {
        if (!this.player || !this.player2) return;

        // Sync Global State
        window.dispatchEvent(new CustomEvent('timerUpdate', { detail: { time: data.matchTimer || 0 } }));
        window.dispatchEvent(new CustomEvent('roundUpdate', { detail: { round: data.currentRound || 1, p1Wins: data.p1Wins || 0, p2Wins: data.p2Wins || 0 } }));

        const centerX = this.scale.width / 2;
        const groundY = this.scale.height - 115 - 100;

        // Sync Player 1
        if (data.p1) {
            const p1X = typeof data.p1.relX === 'number' ? centerX + data.p1.relX : data.p1.x;
            const p1Y = typeof data.p1.relY === 'number' ? groundY + data.p1.relY : data.p1.y;
            this.player.setPosition(p1X, p1Y);
            this.player.setFlipX(data.p1.flipX);
            // Only play animation if changed to avoid resetting current animation
            if (this.player.anims.currentAnim?.key !== data.p1.anim && data.p1.anim) {
                this.player.anims.play(data.p1.anim, true);
            }
            // Sync UI Health
            window.dispatchEvent(new CustomEvent('playerHealthChanged', { detail: { playerId: 'local_player', hp: data.p1.hp, maxHp: data.p1.maxHp } }));
        }

        // Sync Player 2
        if (data.p2) {
            const p2X = typeof data.p2.relX === 'number' ? centerX + data.p2.relX : data.p2.x;
            const p2Y = typeof data.p2.relY === 'number' ? groundY + data.p2.relY : data.p2.y;
            this.player2.setPosition(p2X, p2Y);
            this.player2.setFlipX(data.p2.flipX);
            if (this.player2.anims.currentAnim?.key !== data.p2.anim && data.p2.anim) {
                this.player2.anims.play(data.p2.anim, true);
            }
            window.dispatchEvent(new CustomEvent('playerHealthChanged', { detail: { playerId: 'remote_player', hp: data.p2.hp, maxHp: data.p2.maxHp } }));
        }
    }

    private flashHit(playerId: string) {
        let p = playerId === 'local_player' ? this.player : this.player2;
        if (!p) return;
        
        p.setTint(0xff0000);
        this.time.delayedCall(150, () => {
            if (!p.isDead) p.clearTint();
        });
    }

    private playAudioEvent(data: any) {
        try {
            switch (data.type) {
                case 'attack':
                    if (data.charType) {
                        this.sound.play(`${data.charType}_attack`);
                        this.sound.play(`${data.charType}_effort`);
                    }
                    break;
                case 'hit':
                    this.sound.play('hit');
                    if (data.id) this.flashHit(data.id);
                    break;
                case 'block_hit':
                    this.sound.play('hit', { volume: 0.5 });
                    if (data.id) this.flashHit(data.id);
                    break;
                case 'death':
                    this.sound.play('death');
                    break;
            }
        } catch (e) {
            console.warn("Spectator audio playback failed:", e);
        }
    }

    update() {
        // Do absolutely nothing locally. Physics and animations are puppeted by syncState.
    }

    private setupDOMEventListeners() {
        window.removeEventListener('joystickInput', this.handleJoystickInput as EventListener);
        window.removeEventListener('playerAction', this.handlePlayerAction as EventListener);

        window.addEventListener('joystickInput', this.handleJoystickInput as EventListener);
        window.addEventListener('playerAction', this.handlePlayerAction as EventListener);
        
        this.events.on(Phaser.Scenes.Events.DESTROY, () => {
            window.removeEventListener('joystickInput', this.handleJoystickInput as EventListener);
            window.removeEventListener('playerAction', this.handlePlayerAction as EventListener);
        });
    }

    private handleJoystickInput = (e: CustomEvent<{ left: boolean, right: boolean, up: boolean, down: boolean }>) => {
        if (!this.socket || !this.matchId) return;
        
        // Prevent spamming identical payloads by checking a quick stringify
        const currentStr = JSON.stringify(e.detail);
        if (currentStr !== this.lastInputStr) {
            this.lastInputStr = currentStr;
            this.socket.emit('p2_input', {
                matchId: this.matchId,
                input: { type: 'joystick', payload: e.detail }
            });
        }
    };

    private handlePlayerAction = (e: CustomEvent<{ action: string }>) => {
        if (!this.socket || !this.matchId) return;
        this.socket.emit('p2_input', {
            matchId: this.matchId,
            input: { type: 'action', payload: e.detail }
        });
    };
}
