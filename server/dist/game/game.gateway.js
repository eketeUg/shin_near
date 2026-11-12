"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
var __metadata = (this && this.__metadata) || function (k, v) {
    if (typeof Reflect === "object" && typeof Reflect.metadata === "function") return Reflect.metadata(k, v);
};
var __param = (this && this.__param) || function (paramIndex, decorator) {
    return function (target, key) { decorator(target, key, paramIndex); }
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.GameGateway = void 0;
const websockets_1 = require("@nestjs/websockets");
const socket_io_1 = require("socket.io");
const game_service_1 = require("./game.service");
const web3_js_1 = require("@solana/web3.js");
const anchor_1 = require("@coral-xyz/anchor");
const PROGRAM_ID = new web3_js_1.PublicKey("2exTZQktysE3gATBrRkmymsz35E5reE5ZGmtoedPhyFp");
let GameGateway = class GameGateway {
    gameService;
    server;
    activeMatches = new Map();
    matchmakingBuckets = new Map();
    constructor(gameService) {
        this.gameService = gameService;
    }
    handleConnection(client) {
        console.log(`Client connected: ${client.id}`);
    }
    handleDisconnect(client) {
        console.log(`Client disconnected: ${client.id}`);
        this.gameService.removePlayer(client.id);
        for (const [key, queue] of this.matchmakingBuckets.entries()) {
            this.matchmakingBuckets.set(key, queue.filter((p) => p.socket.id !== client.id));
        }
        let matchEnded = false;
        for (const [mid, match] of this.activeMatches.entries()) {
            if (match.hostId === client.id) {
                this.activeMatches.delete(mid);
                this.server.to(`match_${mid}`).emit('match_ended');
                matchEnded = true;
                console.log(`Match ${mid} ended because host ${client.id} disconnected.`);
            }
        }
        if (matchEnded) {
            this.server.emit('active_matches_updated', Array.from(this.activeMatches.values()));
        }
    }
    handleCreateMatch(client, matchData) {
        const matchId = matchData?.matchId || 'local_' + Math.random().toString(36).substring(2, 9);
        this.activeMatches.set(matchId, {
            hostId: client.id,
            matchId: matchId,
            hostName: matchData?.hostName || 'Unknown Player',
            p1Type: matchData?.p1Type || 'Unknown',
            p2Type: matchData?.p2Type || 'Unknown',
            mode: matchData?.mode || 'PvE',
            viewers: 0,
            encryptedWagers: [],
        });
        console.log(`Match created: ${matchId}`);
        this.server.emit('active_matches_updated', Array.from(this.activeMatches.values()));
        return { matchId };
    }
    handleHostSyncFrame(client, frameData) {
        let matchId = null;
        for (const [mid, match] of this.activeMatches.entries()) {
            if (match.hostId === client.id) {
                matchId = mid;
                break;
            }
        }
        if (matchId) {
            client.broadcast
                .to(`match_${matchId}`)
                .emit('spectator_sync_frame', frameData);
        }
    }
    handleHostFireEvent(client, eventData) {
        let matchId = null;
        for (const [mid, match] of this.activeMatches.entries()) {
            if (match.hostId === client.id) {
                matchId = mid;
                break;
            }
        }
        if (matchId) {
            client.broadcast
                .to(`match_${matchId}`)
                .emit('spectator_fire_event', eventData);
            if (eventData.type === 'match_event' &&
                eventData.data?.event === 'gameOver') {
                console.log(`[ORACLE] Match ${matchId} concluded. Triggering Anchor SettleMatch...`);
                this.processMatchSettlement(matchId, eventData.data.detail.winnerPubKey);
            }
        }
    }
    handlePlaceEncryptedBet(client, betData) {
        const { matchId, encryptedPrediction, amount, spectatorPubKey } = betData;
        if (this.activeMatches.has(matchId)) {
            const match = this.activeMatches.get(matchId);
            match.encryptedWagers.push({
                spectatorPubKey,
                encryptedPrediction,
                amount,
            });
            this.activeMatches.set(matchId, match);
            console.log(`[ARCIUM] Encrypted wager placed for Match ${matchId} by ${spectatorPubKey}. Pool size: ${match.encryptedWagers.length}`);
            return { success: true };
        }
        return { success: false, message: 'Match not found' };
    }
    async processMatchSettlement(matchId, winnerPubKeyStr) {
        const match = this.activeMatches.get(matchId);
        if (!match)
            return;
        console.log(`[ORACLE] Winner for ${matchId} is ${winnerPubKeyStr}. Broadcasting end...`);
        this.activeMatches.delete(matchId);
        this.server.emit('active_matches_updated', Array.from(this.activeMatches.values()));
        this.server.to(`match_${matchId}`).emit('match_ended');
        if (!matchId.startsWith('local_') && winnerPubKeyStr) {
            try {
                const secretKeyString = process.env.ORACLE_PRIVATE_KEY || '[246,145,15,58,162,11,105,108,124,196,16,61,6,27,105,73,158,187,49,158,35,46,155,59,45,216,13,87,175,20,58,137,236,152,7,41,228,87,3,251,130,227,144,21,173,191,15,142,65,71,151,213,44,83,78,143,156,92,49,86,183,184,88,140]';
                const secretKey = Uint8Array.from(JSON.parse(secretKeyString));
                const oracleKeypair = web3_js_1.Keypair.fromSecretKey(secretKey);
                const connection = new web3_js_1.Connection("https://api.devnet.solana.com", "confirmed");
                const provider = new anchor_1.AnchorProvider(connection, new anchor_1.Wallet(oracleKeypair), { preflightCommitment: "confirmed" });
                const matchPubkey = new web3_js_1.PublicKey(matchId);
                const winnerPubkey = new web3_js_1.PublicKey(winnerPubKeyStr);
                const idl = await anchor_1.Program.fetchIdl(PROGRAM_ID, provider);
                if (!idl)
                    throw new Error("IDL not found on chain");
                const program = new anchor_1.Program(idl, provider);
                const matchAccountData = await program.account["match"].fetch(matchPubkey);
                const numericMatchId = matchAccountData.matchId;
                console.log(`[ORACLE] On-Chain resolution for Match ID numeric: ${numericMatchId.toString()}`);
                const tx = await program.methods.resolveMatch(numericMatchId, winnerPubkey)
                    .accounts({
                    oracle: oracleKeypair.publicKey,
                    winnerAccount: winnerPubkey
                })
                    .signers([oracleKeypair])
                    .rpc();
                console.log(`[ORACLE] Payout distributed to Winner successfully! Signature: ${tx}`);
            }
            catch (err) {
                console.error("[ORACLE] Failed to settle match on-chain:", err);
            }
        }
    }
    handleGetActiveMatches(client) {
        client.emit('active_matches_updated', Array.from(this.activeMatches.values()));
    }
    handleJoinSpectator(client, matchId) {
        if (this.activeMatches.has(matchId)) {
            client.join(`match_${matchId}`);
            const match = this.activeMatches.get(matchId);
            match.viewers++;
            this.activeMatches.set(matchId, match);
            console.log(`Client ${client.id} joined spectator room match_${matchId}`);
            this.server.emit('active_matches_updated', Array.from(this.activeMatches.values()));
            return { success: true };
        }
        return { success: false, message: 'Match not found' };
    }
    handleLeaveSpectator(client, matchId) {
        client.leave(`match_${matchId}`);
        if (this.activeMatches.has(matchId)) {
            const match = this.activeMatches.get(matchId);
            match.viewers = Math.max(0, match.viewers - 1);
            this.activeMatches.set(matchId, match);
            this.server.emit('active_matches_updated', Array.from(this.activeMatches.values()));
            console.log(`Client ${client.id} left spectator room match_${matchId}`);
        }
    }
    handleJoinMatchmaking(client, userData) {
        const wager = userData.wager;
        const bucketKey = wager ? `wager_${wager.token}_${wager.amount}` : 'free';
        console.log(`Client ${client.id} joining queue for [${bucketKey}]`);
        for (const [key, queue] of this.matchmakingBuckets.entries()) {
            this.matchmakingBuckets.set(key, queue.filter(p => p.socket.id !== client.id));
        }
        if (!this.matchmakingBuckets.has(bucketKey)) {
            this.matchmakingBuckets.set(bucketKey, []);
        }
        const currentBucket = this.matchmakingBuckets.get(bucketKey);
        if (currentBucket.length > 0) {
            const opponent = currentBucket.shift();
            const matchId = 'online_' + Math.random().toString(36).substring(2, 9);
            this.activeMatches.set(matchId, {
                hostId: null,
                matchId: matchId,
                hostName: opponent.data?.username || 'Player 1',
                p1Type: opponent.data?.charType || 'shinobi',
                p2Type: userData?.charType || 'samurai',
                mode: wager ? 'Wager Fight' : 'Free Fight',
                wager: wager,
                viewers: 0,
                encryptedWagers: [],
            });
            this.server.emit('active_matches_updated', Array.from(this.activeMatches.values()));
            opponent.socket.emit('match_found', {
                role: 'P1',
                matchId: matchId,
                opponentId: client.id,
                opponentName: userData?.username || 'Player 2',
                opponentChar: userData?.charType || 'samurai',
                myChar: opponent.data?.charType || 'shinobi',
            });
            client.emit('match_found', {
                role: 'P2',
                matchId: matchId,
                opponentId: opponent.socket.id,
                opponentName: opponent.data?.username || 'Player 1',
                opponentChar: opponent.data?.charType || 'shinobi',
                myChar: userData?.charType || 'samurai',
            });
            client.join(`match_${matchId}`);
            console.log(`Matchmaking [${bucketKey}] successful! Match ${matchId}`);
        }
        else {
            currentBucket.push({ socket: client, data: userData });
        }
    }
    handleCancelMatchmaking(client) {
        for (const [key, queue] of this.matchmakingBuckets.entries()) {
            this.matchmakingBuckets.set(key, queue.filter((p) => p.socket.id !== client.id));
        }
        console.log(`Client ${client.id} left all matchmaking queues.`);
    }
    handleHostBindMatch(client, matchId) {
        if (this.activeMatches.has(matchId)) {
            const match = this.activeMatches.get(matchId);
            match.hostId = client.id;
            this.activeMatches.set(matchId, match);
            console.log(`Host ${client.id} successfully bound to remote match ${matchId}`);
            this.server.emit('active_matches_updated', Array.from(this.activeMatches.values()));
        }
    }
    handleP2Input(client, data) {
        if (this.activeMatches.has(data.matchId)) {
            const match = this.activeMatches.get(data.matchId);
            if (match.hostId) {
                this.server.to(match.hostId).emit('host_p2_input', data.input);
            }
        }
    }
    handleJoinGame(client, data) {
        const player = this.gameService.addPlayer(client.id);
        client.emit('currentPlayers', this.gameService.getAllPlayers());
        client.broadcast.emit('newPlayer', player);
        setTimeout(() => {
            if (this.gameService.getAllPlayers().length === 1) {
                const bot = this.gameService.addBot();
                this.server.emit('newPlayer', bot);
                this.startBotLoop(bot.id);
            }
        }, 3000);
    }
    startBotLoop(botId) {
        setInterval(() => {
            const bot = this.gameService.getPlayer(botId);
            if (!bot)
                return;
            const moveX = Math.random() > 0.5 ? 10 : -10;
            let moveY = 0;
            if (Math.random() > 0.95 && bot.y >= 300) {
                moveY = -20;
            }
            else if (bot.y < 500) {
                moveY = 5;
            }
            this.gameService.movePlayer(botId, bot.x + moveX, bot.y + moveY);
            this.server.emit('playerMoved', { id: botId, x: bot.x, y: bot.y });
            if (Math.random() > 0.9) {
                this.server.emit('playerAttacked', { id: botId });
            }
        }, 500);
    }
    handlePlayerInput(client, input) {
        this.gameService.movePlayer(client.id, input.x, input.y);
        this.server.emit('playerMoved', { id: client.id, x: input.x, y: input.y });
    }
    handlePlayerAttack(client) {
        const attackerId = client.id;
        const attacker = this.gameService.getPlayer(attackerId);
        if (!attacker)
            return;
        this.server.emit('playerAttacked', { id: attackerId });
        const players = this.gameService.getAllPlayers();
        const ATTACK_RANGE = 70;
        const DAMAGE = 10;
        players.forEach((target) => {
            if (target.id === attackerId)
                return;
            if (target.hp <= 0)
                return;
            const dx = target.x - attacker.x;
            const dy = target.y - attacker.y;
            const distance = Math.sqrt(dx * dx + dy * dy);
            if (distance <= ATTACK_RANGE) {
                const updatedTarget = this.gameService.damagePlayer(target.id, DAMAGE);
                if (updatedTarget) {
                    this.server.emit('playerDamaged', {
                        id: target.id,
                        hp: updatedTarget.hp,
                        maxHp: updatedTarget.maxHp,
                        damage: DAMAGE,
                        attackerId: attackerId,
                    });
                    if (updatedTarget.hp <= 0) {
                        this.server.emit('playerDied', {
                            id: target.id,
                            killerId: attackerId,
                        });
                    }
                }
            }
        });
    }
};
exports.GameGateway = GameGateway;
__decorate([
    (0, websockets_1.WebSocketServer)(),
    __metadata("design:type", socket_io_1.Server)
], GameGateway.prototype, "server", void 0);
__decorate([
    (0, websockets_1.SubscribeMessage)('create_match'),
    __param(0, (0, websockets_1.ConnectedSocket)()),
    __param(1, (0, websockets_1.MessageBody)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [socket_io_1.Socket, Object]),
    __metadata("design:returntype", void 0)
], GameGateway.prototype, "handleCreateMatch", null);
__decorate([
    (0, websockets_1.SubscribeMessage)('host_sync_frame'),
    __param(0, (0, websockets_1.ConnectedSocket)()),
    __param(1, (0, websockets_1.MessageBody)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [socket_io_1.Socket, Object]),
    __metadata("design:returntype", void 0)
], GameGateway.prototype, "handleHostSyncFrame", null);
__decorate([
    (0, websockets_1.SubscribeMessage)('host_fire_event'),
    __param(0, (0, websockets_1.ConnectedSocket)()),
    __param(1, (0, websockets_1.MessageBody)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [socket_io_1.Socket, Object]),
    __metadata("design:returntype", void 0)
], GameGateway.prototype, "handleHostFireEvent", null);
__decorate([
    (0, websockets_1.SubscribeMessage)('place_encrypted_bet'),
    __param(0, (0, websockets_1.ConnectedSocket)()),
    __param(1, (0, websockets_1.MessageBody)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [socket_io_1.Socket, Object]),
    __metadata("design:returntype", void 0)
], GameGateway.prototype, "handlePlaceEncryptedBet", null);
__decorate([
    (0, websockets_1.SubscribeMessage)('get_active_matches'),
    __param(0, (0, websockets_1.ConnectedSocket)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [socket_io_1.Socket]),
    __metadata("design:returntype", void 0)
], GameGateway.prototype, "handleGetActiveMatches", null);
__decorate([
    (0, websockets_1.SubscribeMessage)('join_spectator'),
    __param(0, (0, websockets_1.ConnectedSocket)()),
    __param(1, (0, websockets_1.MessageBody)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [socket_io_1.Socket, String]),
    __metadata("design:returntype", void 0)
], GameGateway.prototype, "handleJoinSpectator", null);
__decorate([
    (0, websockets_1.SubscribeMessage)('leave_spectator'),
    __param(0, (0, websockets_1.ConnectedSocket)()),
    __param(1, (0, websockets_1.MessageBody)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [socket_io_1.Socket, String]),
    __metadata("design:returntype", void 0)
], GameGateway.prototype, "handleLeaveSpectator", null);
__decorate([
    (0, websockets_1.SubscribeMessage)('join_matchmaking'),
    __param(0, (0, websockets_1.ConnectedSocket)()),
    __param(1, (0, websockets_1.MessageBody)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [socket_io_1.Socket, Object]),
    __metadata("design:returntype", void 0)
], GameGateway.prototype, "handleJoinMatchmaking", null);
__decorate([
    (0, websockets_1.SubscribeMessage)('cancel_matchmaking'),
    __param(0, (0, websockets_1.ConnectedSocket)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [socket_io_1.Socket]),
    __metadata("design:returntype", void 0)
], GameGateway.prototype, "handleCancelMatchmaking", null);
__decorate([
    (0, websockets_1.SubscribeMessage)('host_bind_match'),
    __param(0, (0, websockets_1.ConnectedSocket)()),
    __param(1, (0, websockets_1.MessageBody)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [socket_io_1.Socket, String]),
    __metadata("design:returntype", void 0)
], GameGateway.prototype, "handleHostBindMatch", null);
__decorate([
    (0, websockets_1.SubscribeMessage)('p2_input'),
    __param(0, (0, websockets_1.ConnectedSocket)()),
    __param(1, (0, websockets_1.MessageBody)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [socket_io_1.Socket, Object]),
    __metadata("design:returntype", void 0)
], GameGateway.prototype, "handleP2Input", null);
__decorate([
    (0, websockets_1.SubscribeMessage)('join_game'),
    __param(1, (0, websockets_1.MessageBody)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [socket_io_1.Socket, Object]),
    __metadata("design:returntype", void 0)
], GameGateway.prototype, "handleJoinGame", null);
__decorate([
    (0, websockets_1.SubscribeMessage)('playerInput'),
    __param(1, (0, websockets_1.MessageBody)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [socket_io_1.Socket, Object]),
    __metadata("design:returntype", void 0)
], GameGateway.prototype, "handlePlayerInput", null);
__decorate([
    (0, websockets_1.SubscribeMessage)('playerAttack'),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [socket_io_1.Socket]),
    __metadata("design:returntype", void 0)
], GameGateway.prototype, "handlePlayerAttack", null);
exports.GameGateway = GameGateway = __decorate([
    (0, websockets_1.WebSocketGateway)({
        cors: {
            origin: '*',
        },
    }),
    __metadata("design:paramtypes", [game_service_1.GameService])
], GameGateway);
//# sourceMappingURL=game.gateway.js.map