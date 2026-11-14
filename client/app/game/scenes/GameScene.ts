import * as Phaser from 'phaser';
import Player from '../entities/Player';
import { io, Socket } from 'socket.io-client';

export class GameScene extends Phaser.Scene {
    private player!: Player;
    private player2!: Player;
    private background!: Phaser.GameObjects.TileSprite;
    private cursors!: Phaser.Types.Input.Keyboard.CursorKeys;
    private aKey!: Phaser.Input.Keyboard.Key;
    private attackKey!: Phaser.Input.Keyboard.Key;
    private blockKey!: Phaser.Input.Keyboard.Key;
    private specialKey!: Phaser.Input.Keyboard.Key;
    private spaceKey!: Phaser.Input.Keyboard.Key;

    private moveInput = { left: false, right: false, up: false, down: false };

    private matchTimer: number = 180;
    private timerEvent!: Phaser.Time.TimerEvent;

    private socket: Socket | null = null;

    private matchId: string | null = null;
    private isOnlineHost: boolean = false;
    private remoteP2Input = { left: false, right: false, up: false, down: false };
    private matchStartTime: number = 0;

    private gameMode: 'PVP' | 'PVE' | 'AGENT_ARENA' = 'PVP';
    private p1CharType: string = 'shinobi';
    private p2CharType: string = 'samurai';
    private p1Name: string = 'Player 1';
    private p2Name: string = 'Player 2';
    private p1Doctrine: string = 'AGGRESSIVE_RUSHDOWN';
    private p2Doctrine: string = 'COUNTER_STRIKER';
    private p1PubKey: string = '';
    private p2PubKey: string = '';
    private difficulty: 'EASY' | 'HARD' = 'EASY';
    private totalRounds: number = 1;
    private p1Wins: number = 0;
    private p2Wins: number = 0;
    private currentRound: number = 1;
    private isRoundTransition: boolean = false;

    private aiState: 'IDLE' | 'CHASE' | 'ATTACK' | 'BLOCK' | 'RETREAT' = 'IDLE';
    private aiStateTimer: number = 0;
    private lastAIAttackTime: number = 0;

    private p1AiState: 'IDLE' | 'CHASE' | 'ATTACK' | 'BLOCK' | 'RETREAT' = 'IDLE';
    private p1AiStateTimer: number = 0;
    private p1LastAIAttackTime: number = 0;

    // Combo Chain Tracking
    private p1ComboCount: number = 0;
    private p1LastHitTime: number = 0;
    private p2ComboCount: number = 0;
    private p2LastHitTime: number = 0;
    private lastFrameBroadcastTime: number = 0;
    private lastP2InputSentStr: string = '';
    private isMatchFinished: boolean = false;

    constructor() {
        super({ key: 'GameScene' });
    }

    init(data: { mode?: 'PVP' | 'PVE' | 'AGENT_ARENA', p1?: string, p2?: string, p1Name?: string, p2Name?: string, p1Doctrine?: string, p2Doctrine?: string, difficulty?: 'EASY' | 'HARD', rounds?: number, isOnlineHost?: boolean, matchId?: string, p1PubKey?: string, p2PubKey?: string }) {
        if (this.socket) {
            if (this.isOnlineHost && this.matchId) {
                this.socket.emit('end_match', { matchId: this.matchId });
            }
            this.socket.disconnect();
            this.socket = null;
        }
        this.isMatchFinished = false;
        if (data.mode) this.gameMode = data.mode;
        if (data.p1) this.p1CharType = data.p1;
        if (data.p2) this.p2CharType = data.p2;
        if (data.p1Name) this.p1Name = data.p1Name;
        if (data.p2Name) this.p2Name = data.p2Name;
        else this.p2Name = this.gameMode === 'PVE' ? 'Master Shadow' : 'Player 2';
        if (data.p1Doctrine) this.p1Doctrine = data.p1Doctrine;
        if (data.p2Doctrine) this.p2Doctrine = data.p2Doctrine;
        if (data.difficulty) this.difficulty = data.difficulty;
        if (data.rounds) this.totalRounds = data.rounds;
        this.isOnlineHost =
            data.isOnlineHost !== undefined
                ? data.isOnlineHost
                : this.gameMode !== 'PVP';
        this.matchId =
            data.matchId ||
            `live_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 6)}`;
        if (data.p1PubKey) this.p1PubKey = data.p1PubKey;
        if (data.p2PubKey) this.p2PubKey = data.p2PubKey;
        this.lastFrameBroadcastTime = 0;
        this.lastP2InputSentStr = '';

        this.matchTimer = this.gameMode === 'AGENT_ARENA' ? 90 : 180;
        this.p1Wins = 0;
        this.p2Wins = 0;
        this.currentRound = 1;
        this.isRoundTransition = false;
        this.aiState = 'IDLE';
        this.aiStateTimer = 0;
        this.lastAIAttackTime = 0;
        this.p1AiState = 'IDLE';
        this.p1AiStateTimer = 0;
        this.p1LastAIAttackTime = 0;
        this.p1ComboCount = 0;
        this.p1LastHitTime = 0;
        this.p2ComboCount = 0;
        this.p2LastHitTime = 0;
    }

    create() {
        this.matchStartTime = this.time.now;
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
                { key: 'dead', tex: 'dead', rate: 8, repeat: 0 },
                { key: 'hurt', tex: 'hurt', rate: 14, repeat: 0 }
            ];

            animConfig.forEach(cfg => {
                const texKey = `${prefix}_${cfg.tex}`;
                if (this.textures.exists(texKey) && !this.anims.exists(`${prefix}_${cfg.key}`)) {
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

        this.player = new Player(this, width / 2 - 200, height - uiHeight - 100, `${this.p1CharType}_idle`, this.p1CharType, 'local_player', true);
        this.player.anims.play(`${this.p1CharType}_idle`, true);

        this.player2 = new Player(this, width / 2 + 200, height - uiHeight - 100, `${this.p2CharType}_idle`, this.p2CharType, 'remote_player', false);
        this.player2.setFlipX(true);
        this.player2.anims.play(`${this.p2CharType}_idle`, true);

        this.physics.add.collider(this.player, this.player2);

        this.physics.add.overlap(this.player.attackHitbox, this.player2, () => this.handleAttackHit(this.player, this.player2));
        this.physics.add.overlap(this.player2.attackHitbox, this.player, () => this.handleAttackHit(this.player2, this.player));

        if (this.input.keyboard) {
            this.cursors = this.input.keyboard.createCursorKeys();
            this.aKey = this.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.A);
            this.attackKey = this.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.S);
            this.blockKey = this.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.D);
            this.specialKey = this.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.X);
            this.spaceKey = this.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.SPACE);
        }

        try {
            const bgm = this.sound.add('arena_bgm', { loop: true, volume: 0.5 });
            bgm.play();
            window.dispatchEvent(new CustomEvent('arenaStarted'));
        } catch (e) {}

        window.dispatchEvent(new CustomEvent('matchStarted', {
            detail: {
                p1Name: this.p1Name,
                p2Name: this.p2Name,
                totalRounds: this.totalRounds,
                mode: this.gameMode,
                matchId: this.matchId
            }
        }));
        window.dispatchEvent(new CustomEvent('roundUpdate', { detail: { round: this.currentRound, p1Wins: this.p1Wins, p2Wins: this.p2Wins } }));
        window.dispatchEvent(new CustomEvent('roundStarted', { detail: { round: this.currentRound } }));
        window.dispatchEvent(new CustomEvent('playerSpiritChanged', { detail: { playerId: 'local_player', spirit: this.player.spirit, maxSpirit: this.player.maxSpirit } }));
        window.dispatchEvent(new CustomEvent('playerSpiritChanged', { detail: { playerId: 'remote_player', spirit: this.player2.spirit, maxSpirit: this.player2.maxSpirit } }));

        this.timerEvent = this.time.addEvent({
            delay: 1000,
            callback: this.updateTimer,
            callbackScope: this,
            loop: true
        });
        window.dispatchEvent(new CustomEvent('timerUpdate', { detail: { time: this.matchTimer } }));

        this.setupDOMEventListeners();
        this.setupSocketConnection();
    }

    private resolveServerOrigin(): { origin: string; customPath: string } {
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
        return { origin, customPath };
    }

    private setupSocketConnection() {
        if (!this.matchId) return;

        const { origin, customPath } = this.resolveServerOrigin();
        this.socket = io(origin, { path: customPath });

        this.socket.on('connect', () => {
            if (this.isOnlineHost) {
                this.socket?.emit('create_match', {
                    matchId: this.matchId,
                    hostName: this.p1Name,
                    p1Name: this.p1Name,
                    p2Name: this.p2Name,
                    p1Type: this.p1CharType,
                    p2Type: this.p2CharType,
                    mode: this.gameMode,
                    matchTimer: this.matchTimer,
                });
                this.socket?.emit('host_bind_match', this.matchId);
            } else if (this.gameMode === 'PVP') {
                this.socket?.emit('join_spectator', this.matchId);
            }
        });

        if (this.isOnlineHost) {
            this.socket.on('host_p2_input', (inputData: any) => {
                if (!inputData) return;
                if (inputData.type === 'joystick' && inputData.payload) {
                    this.remoteP2Input = inputData.payload;
                } else if (inputData.type === 'action' && inputData.payload) {
                    const act = inputData.payload.action;
                    if (act === 'attack') this.player2?.playAttackAnimation();
                    else if (act === 'special') this.player2?.playSpecialAttackAnimation();
                    else if (act === 'block_start') this.player2?.startBlock();
                    else if (act === 'block_end') this.player2?.stopBlock();
                    else if (act === 'block') {
                        this.player2?.startBlock();
                        this.time.delayedCall(300, () => this.player2?.stopBlock());
                    }
                } else if (typeof inputData.left === 'boolean') {
                    this.remoteP2Input = inputData;
                }
            });
        } else if (this.gameMode === 'PVP') {
            this.socket.on('spectator_sync_frame', (frameData: any) => {
                this.applyHostSyncFrameForP2(frameData);
            });
            this.socket.on('spectator_fire_event', (payload: any) => {
                if (payload?.type === 'match_event' && payload?.data?.event) {
                    window.dispatchEvent(new CustomEvent(payload.data.event, { detail: payload.data.detail }));
                }
            });
        }
    }

    private applyHostSyncFrameForP2(data: any) {
        if (!this.player || !this.player2 || !data) return;
        if (typeof data.matchTimer === 'number') {
            this.matchTimer = data.matchTimer;
            window.dispatchEvent(new CustomEvent('timerUpdate', { detail: { time: data.matchTimer } }));
        }
        const centerX = this.scale.width / 2;
        const groundY = this.scale.height - 115 - 100;
        if (data.p1) {
            const p1X = typeof data.p1.relX === 'number' ? centerX + data.p1.relX : data.p1.x;
            const p1Y = typeof data.p1.relY === 'number' ? groundY + data.p1.relY : data.p1.y;
            this.player.setPosition(p1X, p1Y);
            this.player.setFlipX(Boolean(data.p1.flipX));
            if (data.p1.anim && this.player.anims.currentAnim?.key !== data.p1.anim) {
                this.player.anims.play(data.p1.anim, true);
            }
            this.player.hp = data.p1.hp ?? this.player.hp;
            window.dispatchEvent(new CustomEvent('playerHealthChanged', { detail: { playerId: 'local_player', hp: this.player.hp, maxHp: this.player.maxHp } }));
        }
        if (data.p2) {
            const p2X = typeof data.p2.relX === 'number' ? centerX + data.p2.relX : data.p2.x;
            const p2Y = typeof data.p2.relY === 'number' ? groundY + data.p2.relY : data.p2.y;
            this.player2.setPosition(p2X, p2Y);
            this.player2.setFlipX(Boolean(data.p2.flipX));
            if (data.p2.anim && this.player2.anims.currentAnim?.key !== data.p2.anim) {
                this.player2.anims.play(data.p2.anim, true);
            }
            this.player2.hp = data.p2.hp ?? this.player2.hp;
            window.dispatchEvent(new CustomEvent('playerHealthChanged', { detail: { playerId: 'remote_player', hp: this.player2.hp, maxHp: this.player2.maxHp } }));
        }
    }

    private emitHostSyncFrameIfNeeded() {
        if (this.isMatchFinished || !this.isOnlineHost || !this.socket?.connected || !this.matchId || !this.player || !this.player2) return;
        const now = this.time.now;
        if (now - this.lastFrameBroadcastTime < 65) return;
        this.lastFrameBroadcastTime = now;

        const centerX = this.scale.width / 2;
        const groundY = this.scale.height - 115 - 100;

        this.socket.emit('host_sync_frame', {
            matchId: this.matchId,
            matchTimer: this.matchTimer,
            currentRound: this.currentRound,
            p1Wins: this.p1Wins,
            p2Wins: this.p2Wins,
            p1: {
                x: Math.round(this.player.x),
                y: Math.round(this.player.y),
                relX: Math.round(this.player.x - centerX),
                relY: Math.round(this.player.y - groundY),
                flipX: this.player.flipX,
                anim: this.player.anims.currentAnim?.key || `${this.p1CharType}_idle`,
                hp: Math.max(0, Math.round(this.player.hp)),
                maxHp: this.player.maxHp,
            },
            p2: {
                x: Math.round(this.player2.x),
                y: Math.round(this.player2.y),
                relX: Math.round(this.player2.x - centerX),
                relY: Math.round(this.player2.y - groundY),
                flipX: this.player2.flipX,
                anim: this.player2.anims.currentAnim?.key || `${this.p2CharType}_idle`,
                hp: Math.max(0, Math.round(this.player2.hp)),
                maxHp: this.player2.maxHp,
            },
        });
    }

    private updateTimer() {
        if (this.matchTimer > 0 && !this.player.isDead && !this.player2.isDead && !this.isRoundTransition) {
            this.matchTimer--;
            // Passive spirit regeneration (+2 per second)
            this.player.addSpirit(2);
            this.player2.addSpirit(2);
            window.dispatchEvent(new CustomEvent('timerUpdate', { detail: { time: this.matchTimer } }));

            if (this.matchTimer === 0) {
                this.handleTimeUp();
            }
        }
    }

    private handleTimeUp() {
        if (this.isRoundTransition) return;

        let winner: 'p1' | 'p2' | 'draw' = 'draw';
        if (this.player.hp > this.player2.hp) {
            winner = 'p1';
        } else if (this.player2.hp > this.player.hp) {
            winner = 'p2';
        }

        this.resolveRound(winner);
    }

    private resolveRound(winner: 'p1' | 'p2' | 'draw') {
        this.isRoundTransition = true;

        if (winner === 'p1') this.p1Wins++;
        else if (winner === 'p2') this.p2Wins++;

        const winThreshold = Math.floor(this.totalRounds / 2) + 1;
        const matchOver = this.p1Wins >= winThreshold || this.p2Wins >= winThreshold || this.currentRound >= this.totalRounds;

        window.dispatchEvent(new CustomEvent('roundEnded', { detail: { winner, p1Wins: this.p1Wins, p2Wins: this.p2Wins, matchOver } }));

        if (matchOver) {
            this.isMatchFinished = true;
            try { this.sound.play('victory'); } catch (e) {}

            setTimeout(() => {
                const durationSeconds = Math.floor((this.time.now - this.matchStartTime) / 1000);
                const minutes = Math.floor(durationSeconds / 60);
                const seconds = durationSeconds % 60;
                const durationStr = `${minutes}:${seconds.toString().padStart(2, '0')}`;

                const results = {
                    winner: winner === 'p1' ? this.p1Name : this.p2Name,
                    winnerId: winner,
                    matchId: this.matchId,
                    mode: this.gameMode,
                    roundsScore: `${this.p1Wins} - ${this.p2Wins}`,
                    duration: durationStr,
                    p1Stats: {
                        ...this.player.stats,
                        name: this.p1Name,
                        charType: this.p1CharType
                    },
                    p2Stats: {
                        ...this.player2.stats,
                        name: this.p2Name,
                        charType: this.p2CharType
                    }
                };

                window.dispatchEvent(new CustomEvent('gameOver', {
                    detail: results
                }));

                if (this.isOnlineHost && this.socket && this.matchId) {
                    this.socket.emit('host_fire_event', {
                        matchId: this.matchId,
                        type: 'match_event',
                        data: {
                            event: 'gameOver',
                            detail: results
                        }
                    });
                    this.socket.emit('end_match', { matchId: this.matchId });
                }
            }, 1400);
        } else {
            const loser = winner === 'p1' ? this.player2 : (winner === 'p2' ? this.player : null);
            const victor = winner === 'p1' ? this.player : (winner === 'p2' ? this.player2 : null);

            if (loser && victor) {
                const knockbackX = winner === 'p1' ? 300 : -300;
                loser.setVelocity(knockbackX, -200);

                this.tweens.add({
                    targets: loser,
                    alpha: 0,
                    duration: 500,
                    ease: 'Power2',
                    onComplete: () => {
                        this.resetRound();
                        this.tweens.add({
                            targets: loser,
                            alpha: 1,
                            duration: 500,
                            ease: 'Power2'
                        });
                    }
                });

                this.tweens.add({
                    targets: victor,
                    x: victor.id === 'local_player' ? this.scale.width / 2 - 200 : this.scale.width / 2 + 200,
                    duration: 500,
                    ease: 'Power2'
                });
            } else {
                setTimeout(() => {
                    this.resetRound();
                }, 1000);
            }
        }
    }

    private resetRound() {
        this.currentRound++;
        this.isRoundTransition = false;

        window.dispatchEvent(new CustomEvent('timerUpdate', { detail: { time: this.matchTimer } }));
        window.dispatchEvent(new CustomEvent('roundUpdate', { detail: { round: this.currentRound, p1Wins: this.p1Wins, p2Wins: this.p2Wins } }));
        window.dispatchEvent(new CustomEvent('roundStarted', { detail: { round: this.currentRound } }));

        this.player.hp = this.player.maxHp;
        this.player.resetState();
        this.player.x = this.scale.width / 2 - 200;
        this.player.y = this.scale.height - 115 - 100;
        this.player.anims.play(`${this.p1CharType}_idle`, true);
        window.dispatchEvent(new CustomEvent('playerHealthChanged', { detail: { playerId: 'local_player', hp: this.player.hp, maxHp: this.player.maxHp } }));

        this.player2.hp = this.player2.maxHp;
        this.player2.resetState();
        this.player2.x = this.scale.width / 2 + 200;
        this.player2.y = this.scale.height - 115 - 100;
        this.player2.anims.play(`${this.p2CharType}_idle`, true);
        window.dispatchEvent(new CustomEvent('playerHealthChanged', { detail: { playerId: 'remote_player', hp: this.player2.hp, maxHp: this.player2.maxHp } }));
    }

    update() {
        if (this.gameMode === 'AGENT_ARENA') {
            this.updateAutonomousAgent(this.player, this.player2, 'p1', this.p1Doctrine);
            this.updateAutonomousAgent(this.player2, this.player, 'p2', this.p2Doctrine);
            this.emitHostSyncFrameIfNeeded();
            return;
        }

        const combinedInput = {
            left: this.moveInput.left || (this.cursors?.left.isDown ?? false),
            right: this.moveInput.right || (this.cursors?.right.isDown ?? false),
            up: this.moveInput.up || (this.cursors?.up.isDown ?? false),
            down: this.moveInput.down || (this.cursors?.down.isDown ?? false)
        };

        if (this.gameMode === 'PVP' && !this.isOnlineHost) {
            // P2 Guest sends inputs to P1 Host
            const inputStr = JSON.stringify(combinedInput);
            if (inputStr !== this.lastP2InputSentStr && this.socket?.connected && this.matchId) {
                this.lastP2InputSentStr = inputStr;
                this.socket.emit('p2_input', {
                    matchId: this.matchId,
                    input: { type: 'joystick', payload: combinedInput },
                });
            }
            if (this.aKey && this.attackKey && this.blockKey && this.socket?.connected && this.matchId) {
                if (
                    (this.specialKey && Phaser.Input.Keyboard.JustDown(this.specialKey)) ||
                    (this.spaceKey && Phaser.Input.Keyboard.JustDown(this.spaceKey))
                ) {
                    this.socket.emit('p2_input', { matchId: this.matchId, input: { type: 'action', payload: { action: 'special' } } });
                } else if (Phaser.Input.Keyboard.JustDown(this.aKey) || Phaser.Input.Keyboard.JustDown(this.attackKey)) {
                    this.socket.emit('p2_input', { matchId: this.matchId, input: { type: 'action', payload: { action: 'attack' } } });
                }
                if (Phaser.Input.Keyboard.JustDown(this.blockKey)) {
                    this.socket.emit('p2_input', { matchId: this.matchId, input: { type: 'action', payload: { action: 'block_start' } } });
                } else if (Phaser.Input.Keyboard.JustUp(this.blockKey)) {
                    this.socket.emit('p2_input', { matchId: this.matchId, input: { type: 'action', payload: { action: 'block_end' } } });
                }
            }
            return;
        }

        if (this.player) {
            this.player.update(undefined, combinedInput);

            if (this.aKey && this.attackKey && this.blockKey) {
                if (
                    (this.specialKey && Phaser.Input.Keyboard.JustDown(this.specialKey)) ||
                    (this.spaceKey && Phaser.Input.Keyboard.JustDown(this.spaceKey))
                ) {
                    this.player.playSpecialAttackAnimation();
                } else if (Phaser.Input.Keyboard.JustDown(this.aKey) || Phaser.Input.Keyboard.JustDown(this.attackKey)) {
                    this.player.playAttackAnimation();
                }

                if (this.blockKey.isDown) {
                    this.player.startBlock();
                } else if (Phaser.Input.Keyboard.JustUp(this.blockKey)) {
                    this.player.stopBlock();
                }
            }
        }

        if (this.player2) {
            if (this.gameMode === 'PVP') {
                this.player2.update(undefined, this.remoteP2Input);
            } else if (this.gameMode === 'PVE') {
                this.updateAI();
            }
        }

        this.emitHostSyncFrameIfNeeded();
    }

    private updateAutonomousAgent(
        self: Player,
        opponent: Player,
        side: 'p1' | 'p2',
        doctrine: string
    ) {
        if (!self || !opponent || self.isDead || opponent.isDead || this.matchTimer <= 0 || this.isRoundTransition) return;

        const selfX = self.x;
        const oppX = opponent.x;
        const distance = Math.abs(selfX - oppX);
        const now = this.time.now;

        let aiJoystick = { left: false, right: false, up: false, down: false };

        const isRushdown = doctrine === 'AGGRESSIVE_RUSHDOWN';
        const isIronGuard = doctrine === 'IRON_GUARD';
        const isEvasive = doctrine === 'SHADOW_EVASIVE';

        const attackChance = isRushdown ? 0.86 : isIronGuard ? 0.56 : 0.74;
        const retreatThreshold = isEvasive ? 110 : isRushdown ? 45 : 80;
        const chaseThreshold = 115;
        const attackRange = 135;
        const idleDelay = isRushdown ? 80 : 140;
        const attackStateDuration = 240;
        const blockStateDuration = isIronGuard ? 480 : 280;
        const retreatStateDuration = isEvasive ? 360 : 220;
        const attackCooldown = isRushdown ? 240 : 320;

        let currentState = side === 'p1' ? this.p1AiState : this.aiState;
        let stateTimer = side === 'p1' ? this.p1AiStateTimer : this.aiStateTimer;
        let lastAtk = side === 'p1' ? this.p1LastAIAttackTime : this.lastAIAttackTime;

        // If Spirit is charged (>= 65) and within dash-strike range, unleash Spirit Dash-Strike!
        if (self.spirit >= 65 && distance <= 190 && now - lastAtk > attackCooldown) {
            self.setFlipX(selfX > oppX);
            if (self.playSpecialAttackAnimation()) {
                lastAtk = now;
            }
        }

        if (currentState === 'IDLE') {
            if (distance > chaseThreshold) {
                currentState = 'CHASE';
            } else if (now - stateTimer > idleDelay) {
                if (opponent.isAttacking && Math.random() < (isIronGuard ? 0.78 : 0.42)) {
                    currentState = 'BLOCK';
                } else {
                    currentState = Math.random() < attackChance ? 'ATTACK' : 'BLOCK';
                }
                stateTimer = now;
            }
        } else if (currentState === 'CHASE') {
            if (distance <= chaseThreshold) {
                currentState = 'ATTACK';
                stateTimer = now;
            } else if (isEvasive && Math.random() < 0.03) {
                aiJoystick.up = true;
            }
        } else if (currentState === 'ATTACK') {
            if (now - stateTimer > attackStateDuration) {
                currentState = (distance < retreatThreshold && Math.random() < (isEvasive ? 0.65 : 0.3)) ? 'RETREAT' : 'IDLE';
                stateTimer = now;
            }
        } else if (currentState === 'BLOCK') {
            if (now - stateTimer > blockStateDuration) {
                currentState = 'ATTACK';
                stateTimer = now;
            }
        } else if (currentState === 'RETREAT') {
            if (distance > chaseThreshold + 45 || now - stateTimer > retreatStateDuration) {
                currentState = 'IDLE';
                stateTimer = now;
            }
        }

        switch (currentState) {
            case 'CHASE':
                self.stopBlock();
                if (selfX > oppX) aiJoystick.left = true;
                else aiJoystick.right = true;
                break;
            case 'RETREAT':
                self.stopBlock();
                if (selfX > oppX) aiJoystick.right = true;
                else aiJoystick.left = true;
                if (isEvasive && Math.random() < 0.08) aiJoystick.up = true;
                break;
            case 'ATTACK':
                self.stopBlock();
                if (distance <= attackRange && now - lastAtk > attackCooldown) {
                    self.playAttackAnimation();
                    lastAtk = now;
                } else if (distance > attackRange) {
                    if (selfX > oppX) aiJoystick.left = true;
                    else aiJoystick.right = true;
                }
                break;
            case 'BLOCK':
                self.startBlock();
                break;
            case 'IDLE':
            default:
                self.stopBlock();
                break;
        }

        if (side === 'p1') {
            this.p1AiState = currentState;
            this.p1AiStateTimer = stateTimer;
            this.p1LastAIAttackTime = lastAtk;
        } else {
            this.aiState = currentState;
            this.aiStateTimer = stateTimer;
            this.lastAIAttackTime = lastAtk;
        }

        self.update(undefined, aiJoystick);
    }

    private updateAI() {
        if (!this.player || !this.player2 || this.player.isDead || this.player2.isDead || this.matchTimer <= 0 || this.isRoundTransition) return;

        const p1X = this.player.x;
        const p2X = this.player2.x;
        const distance = Math.abs(p1X - p2X);
        const now = this.time.now;

        let aiJoystick = { left: false, right: false, up: false, down: false };

        const retreatThreshold = this.difficulty === 'HARD' ? 95 : 40;
        const chaseThreshold = 120;
        const attackRange = 130;

        const attackChance = this.difficulty === 'HARD' ? 0.8 : 0.6;
        const idleDelay = this.difficulty === 'HARD' ? 100 : 400;
        const attackStateDuration = 250;
        const blockStateDuration = this.difficulty === 'HARD' ? 400 : 700;
        const retreatStateDuration = 300;
        const attackCooldown = this.difficulty === 'HARD' ? 300 : 700;

        if (this.player2.spirit >= 70 && distance <= 180 && now - this.lastAIAttackTime > attackCooldown) {
            this.player2.setFlipX(p2X > p1X);
            if (this.player2.playSpecialAttackAnimation()) {
                this.lastAIAttackTime = now;
            }
        }

        if (this.aiState === 'IDLE') {
            if (distance > chaseThreshold) {
                this.aiState = 'CHASE';
            } else if (now - this.aiStateTimer > idleDelay) {
                this.aiState = Math.random() < attackChance ? 'ATTACK' : 'BLOCK';
                this.aiStateTimer = now;
            }
        } else if (this.aiState === 'CHASE') {
            if (distance <= chaseThreshold) {
                this.aiState = 'IDLE';
                this.aiStateTimer = now;
            }
        } else if (this.aiState === 'ATTACK') {
            if (now - this.aiStateTimer > attackStateDuration) {
                this.aiState = (this.difficulty === 'HARD' && distance < retreatThreshold) ? 'RETREAT' : 'IDLE';
                this.aiStateTimer = now;
            }
        } else if (this.aiState === 'BLOCK') {
            if (now - this.aiStateTimer > blockStateDuration) {
                this.aiState = 'IDLE';
                this.aiStateTimer = now;
            }
        } else if (this.aiState === 'RETREAT') {
            if (distance > chaseThreshold + 50 || now - this.aiStateTimer > retreatStateDuration) {
                this.aiState = 'IDLE';
                this.aiStateTimer = now;
            }
        }

        switch (this.aiState) {
            case 'CHASE':
                this.player2.stopBlock();
                if (p2X > p1X) aiJoystick.left = true;
                else aiJoystick.right = true;
                break;
            case 'RETREAT':
                this.player2.stopBlock();
                if (p2X > p1X) aiJoystick.right = true;
                else aiJoystick.left = true;
                break;
            case 'ATTACK':
                this.player2.stopBlock();
                if (distance <= attackRange && now - this.lastAIAttackTime > attackCooldown) {
                    this.player2.playAttackAnimation();
                    this.lastAIAttackTime = now;
                }
                break;
            case 'BLOCK':
                this.player2.startBlock();
                break;
            case 'IDLE':
            default:
                this.player2.stopBlock();
                break;
        }

        this.player2.update(undefined, aiJoystick);
    }

    private setupDOMEventListeners() {
        window.removeEventListener('joystickInput', this.handleJoystickInput as any);
        window.removeEventListener('playerAction', this.handlePlayerAction as any);
        window.removeEventListener('playerAudio', this.handlePlayerAudio as any);
        window.removeEventListener('togglePause', this.handleTogglePause as any);
        window.removeEventListener('exitMatch', this.handleExitScene as any);

        window.addEventListener('joystickInput', this.handleJoystickInput as any);
        window.addEventListener('playerAction', this.handlePlayerAction as any);
        window.addEventListener('playerAudio', this.handlePlayerAudio as any);
        window.addEventListener('togglePause', this.handleTogglePause as any);
        window.addEventListener('exitMatch', this.handleExitScene as any);

        this.events.on(Phaser.Scenes.Events.DESTROY, () => {
            window.removeEventListener('joystickInput', this.handleJoystickInput as any);
            window.removeEventListener('playerAction', this.handlePlayerAction as any);
            window.removeEventListener('playerAudio', this.handlePlayerAudio as any);
            window.removeEventListener('togglePause', this.handleTogglePause as any);
            window.removeEventListener('exitMatch', this.handleExitScene as any);
            if (this.socket) {
                if (this.isOnlineHost && this.matchId) {
                    this.socket.emit('end_match', { matchId: this.matchId });
                }
                this.socket.disconnect();
                this.socket = null;
            }
        });
    }

    private handleExitScene = () => {
        this.isMatchFinished = true;
        try {
            this.sound.stopAll();
        } catch {}
        if (this.socket) {
            if (this.isOnlineHost && this.matchId) {
                this.socket.emit('end_match', { matchId: this.matchId });
            }
            this.socket.disconnect();
            this.socket = null;
        }
    };

    private handleTogglePause = (e: CustomEvent<{ isPaused: boolean }>) => {
        if (e.detail.isPaused) {
            this.scene.pause();
            this.sound.pauseAll();
        } else {
            this.scene.resume();
            this.sound.resumeAll();
        }
    };

    private handleJoystickInput = (e: CustomEvent<{ left: boolean, right: boolean, up: boolean, down: boolean }>) => {
        this.moveInput = e.detail;
    };

    private handlePlayerAction = (e: CustomEvent<{ action: string }>) => {
        if (this.gameMode === 'PVP' && !this.isOnlineHost) {
            if (this.socket?.connected && this.matchId) {
                this.socket.emit('p2_input', {
                    matchId: this.matchId,
                    input: { type: 'action', payload: e.detail },
                });
            }
            return;
        }
        if (!this.player) return;

        if (e.detail.action === 'attack') {
            this.player.playAttackAnimation();
        } else if (e.detail.action === 'special') {
            this.player.playSpecialAttackAnimation();
        } else if (e.detail.action === 'block_start') {
            this.player.startBlock();
        } else if (e.detail.action === 'block_end') {
            this.player.stopBlock();
        } else if (e.detail.action === 'block') {
            this.player.startBlock();
            this.time.delayedCall(300, () => this.player?.stopBlock());
        }
    };

    private handlePlayerAudio = () => {};

    private handleAttackHit(attacker: Player, target: Player) {
        if (attacker.isAttacking && !attacker.hasHit && !attacker.isDead && !target.isDead && !this.isRoundTransition) {
            attacker.hasHit = true;
            const isSpecial = attacker.isSpecialAttack;
            const baseDmg = this.gameMode === 'AGENT_ARENA'
                ? (isSpecial ? 46 : 22)
                : (isSpecial ? 36 : 14);

            const actualDamage = target.takeDamage(baseDmg, attacker.x, isSpecial);
            attacker.stats.damageDealt += actualDamage;
            attacker.stats.hitsLanded += 1;
            if (isSpecial) attacker.stats.specialsLanded += 1;

            if (this.isOnlineHost && this.socket?.connected && this.matchId) {
                this.socket.emit('host_fire_event', {
                    matchId: this.matchId,
                    type: 'audio',
                    data: {
                        type: target.isBlocking ? 'block_hit' : 'hit',
                        id: target.id,
                    },
                });
            }

            // Grant Spirit to attacker when landing a normal strike
            if (!isSpecial) {
                attacker.addSpirit(18);
            }

            // Track Combo Chain & Emit Arcade Callout
            const now = this.time.now;
            const side = attacker.id === 'local_player' ? 'p1' : 'p2';
            if (side === 'p1') {
                this.p1ComboCount = (now - this.p1LastHitTime <= 2200) ? this.p1ComboCount + 1 : 1;
                this.p1LastHitTime = now;
                window.dispatchEvent(new CustomEvent('comboHit', {
                    detail: { side: 'p1', count: this.p1ComboCount, damage: actualDamage, isSpecial }
                }));
            } else {
                this.p2ComboCount = (now - this.p2LastHitTime <= 2200) ? this.p2ComboCount + 1 : 1;
                this.p2LastHitTime = now;
                window.dispatchEvent(new CustomEvent('comboHit', {
                    detail: { side: 'p2', count: this.p2ComboCount, damage: actualDamage, isSpecial }
                }));
            }

            // Arcade Camera Shake for impact juice!
            try {
                if (target.hp <= 0) {
                    this.cameras.main.shake(320, 0.016);
                } else if (isSpecial) {
                    this.cameras.main.shake(190, 0.011);
                } else if (actualDamage > 0) {
                    this.cameras.main.shake(90, 0.004);
                }
            } catch (e) {}

            if (target.hp <= 0 && target.isDead) {
                const winner = attacker.id === 'local_player' ? 'p1' : 'p2';
                this.resolveRound(winner);
            }
        }
    }
}
