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
const lobby_chat_service_1 = require("./lobby-chat.service");
const near_relayer_service_1 = require("./near-relayer.service");
const crypto_1 = require("crypto");
const NEAR_ARENA_CONTRACT_ID = process.env.NEAR_CONTRACT_ID || 'shin-arena-28d.testnet';
const NEAR_RPC_URL = process.env.NEAR_RPC_URL || 'https://test.rpc.fastnear.com';
let GameGateway = class GameGateway {
    gameService;
    nearRelayer;
    lobbyChatService;
    server;
    activeMatches = new Map();
    matchmakingBuckets = new Map();
    lobbyUsers = new Map();
    offlineMessageQueue = new Map();
    chatFightProposals = new Map();
    constructor(gameService, nearRelayer, lobbyChatService) {
        this.gameService = gameService;
        this.nearRelayer = nearRelayer;
        this.lobbyChatService = lobbyChatService;
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
        let presenceChanged = false;
        for (const [acct, user] of this.lobbyUsers.entries()) {
            if (user.socketId === client.id) {
                user.isOnline = false;
                user.socketId = null;
                user.lastSeenLabel = 'Last seen just now';
                this.lobbyUsers.set(acct, user);
                presenceChanged = true;
            }
        }
        if (presenceChanged) {
            this.server.emit('lobby_presence_updated', Array.from(this.lobbyUsers.values()));
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
        const matchId = matchData?.matchId ||
            'near_match_' + Math.random().toString(36).substring(2, 9);
        this.activeMatches.set(matchId, {
            hostId: client.id,
            matchId: matchId,
            hostName: matchData?.hostName || 'Unknown Warrior',
            p1Type: matchData?.p1Type || 'shinobi',
            p2Type: matchData?.p2Type || 'samurai',
            mode: matchData?.mode || 'AGENT_ARENA',
            wagerNear: matchData?.wagerNear || 1.0,
            viewers: 0,
            spectatorBets: [],
        });
        console.log(`[NEAR ARENA] Match created on ${NEAR_ARENA_CONTRACT_ID}: ${matchId}`);
        this.server.emit('active_matches_updated', Array.from(this.activeMatches.values()));
        return { matchId, contractId: NEAR_ARENA_CONTRACT_ID };
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
                console.log(`[NEAR REFEREE] Match ${matchId} concluded. Triggering settle_match on ${NEAR_ARENA_CONTRACT_ID}...`);
                this.processNearMatchSettlement(matchId, eventData.data.detail?.winnerPubKey || 'fighter-1.shin-arena.testnet');
            }
        }
    }
    handlePlaceSpectatorBet(client, betData) {
        const { matchId, backedFighterId, amountNear, spectatorAccountId } = betData;
        if (this.activeMatches.has(matchId)) {
            const match = this.activeMatches.get(matchId);
            match.spectatorBets.push({
                spectatorAccountId,
                backedFighterId,
                amountNear,
                timestamp: Date.now(),
            });
            this.activeMatches.set(matchId, match);
            console.log(`[NEAR SPECTATOR POOL] Bet of ${amountNear} NEAR placed on ${backedFighterId} in Match ${matchId} by ${spectatorAccountId}`);
            this.server.to(`match_${matchId}`).emit('spectator_pool_updated', {
                matchId,
                totalBets: match.spectatorBets.length,
                spectatorBets: match.spectatorBets,
            });
            return { success: true };
        }
        return { success: false, message: 'Match not found' };
    }
    async processNearMatchSettlement(matchId, winnerAccountId) {
        const match = this.activeMatches.get(matchId);
        if (!match)
            return;
        let receiptHash = (0, crypto_1.createHash)('sha256')
            .update(`${matchId}:${winnerAccountId}:${Date.now()}`)
            .digest('hex')
            .slice(0, 44);
        let explorerUrl = '';
        let onChain = false;
        const winnerTokenId = match?.p1?.accountId === winnerAccountId
            ? match?.p1?.tokenId
            : match?.p2?.tokenId;
        if (winnerTokenId) {
            const relay = await this.nearRelayer.callMethod('settle_match', {
                match_id: matchId,
                winner_token_id: winnerTokenId,
            });
            if (relay.ok && relay.txHash) {
                receiptHash = relay.txHash;
                explorerUrl = relay.explorerUrl;
                onChain = true;
            }
        }
        console.log(`[NEAR REFEREE] Settling Match ${matchId} on ${NEAR_ARENA_CONTRACT_ID} (${NEAR_RPC_URL}) -> Winner: ${winnerAccountId} | Receipt: ${receiptHash} | OnChain: ${onChain}`);
        this.activeMatches.delete(matchId);
        this.server.emit('active_matches_updated', Array.from(this.activeMatches.values()));
        this.server.to(`match_${matchId}`).emit('match_ended', {
            matchId,
            winnerAccountId,
            contractId: NEAR_ARENA_CONTRACT_ID,
            receiptHash,
            explorerUrl,
            onChain,
        });
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
        const roomCode = userData.roomCode ? String(userData.roomCode).trim().toUpperCase() : null;
        const bucketKey = roomCode
            ? `room_${roomCode}`
            : wager
                ? `wager_${wager.token}_${wager.amount}`
                : 'free';
        console.log(`Client ${client.id} joining NEAR queue for [${bucketKey}]`);
        for (const [key, queue] of this.matchmakingBuckets.entries()) {
            this.matchmakingBuckets.set(key, queue.filter((p) => p.socket.id !== client.id));
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
                mode: roomCode ? `Room #${roomCode}` : wager ? 'NEAR Wager Fight' : 'Free Fight',
                wager: wager,
                viewers: 0,
                spectatorBets: [],
            });
            this.server.emit('active_matches_updated', Array.from(this.activeMatches.values()));
            opponent.socket.emit('match_found', {
                role: 'P1',
                matchId: matchId,
                roomCode,
                opponentId: client.id,
                opponentName: userData?.username || 'Player 2',
                opponentChar: userData?.charType || 'samurai',
                myChar: opponent.data?.charType || 'shinobi',
            });
            client.emit('match_found', {
                role: 'P2',
                matchId: matchId,
                roomCode,
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
    async handleLobbyRegisterPresence(client, userData) {
        if (!userData?.accountId)
            return;
        this.lobbyUsers.set(userData.accountId, {
            accountId: userData.accountId,
            username: userData.username || 'Warrior',
            charId: userData.charId || 'fighter',
            socketId: client.id,
            isOnline: true,
            lastSeenLabel: 'Active now',
            elo: userData.elo || 1200,
            wins: userData.wins || 0,
            losses: userData.losses || 0,
        });
        const queued = await this.lobbyChatService.getQueuedOfflineDms(userData.accountId);
        if (queued.length > 0) {
            queued.forEach((msg) => {
                const deliveredMsg = {
                    ...msg,
                    deliveryStatus: 'READ_ON_WAKE',
                };
                client.emit('lobby_receive_dm', deliveredMsg);
                const sender = this.lobbyUsers.get(msg.senderAccountId);
                if (sender?.socketId) {
                    this.server.to(sender.socketId).emit('lobby_dm_status_updated', {
                        id: msg.id,
                        deliveryStatus: 'READ_ON_WAKE',
                    });
                }
            });
            await this.lobbyChatService.markDmsReadOnWake(userData.accountId);
        }
        this.server.emit('lobby_presence_updated', Array.from(this.lobbyUsers.values()));
    }
    async handleLobbySendDm(client, msg) {
        const timestamp = msg.timestamp || Date.now();
        if (!msg?.recipientAccountId) {
            const globalMsg = {
                ...msg,
                id: msg.id || `msg-${timestamp}`,
                deliveryStatus: 'DELIVERED_LIVE',
                timestamp,
            };
            await this.lobbyChatService.saveMessage(globalMsg);
            this.server.emit('lobby_chat_broadcast', {
                ...globalMsg,
                socketId: client.id,
            });
            return { deliveryStatus: 'DELIVERED_LIVE' };
        }
        const recipient = this.lobbyUsers.get(msg.recipientAccountId);
        if (recipient?.isOnline && recipient.socketId) {
            const liveMsg = {
                ...msg,
                id: msg.id || `dm-${timestamp}`,
                deliveryStatus: 'DELIVERED_LIVE',
                timestamp,
            };
            await this.lobbyChatService.saveMessage(liveMsg);
            this.server.to(recipient.socketId).emit('lobby_receive_dm', liveMsg);
            return { deliveryStatus: 'DELIVERED_LIVE' };
        }
        else {
            const queuedMsg = {
                ...msg,
                id: msg.id || `dm-${timestamp}`,
                deliveryStatus: 'QUEUED_OFFLINE',
                timestamp,
            };
            await this.lobbyChatService.saveMessage(queuedMsg);
            return { deliveryStatus: 'QUEUED_OFFLINE' };
        }
    }
    async handleLobbySendFightProposal(client, msg) {
        const offer = msg?.challengeOffer;
        if (!offer?.proposalId || !offer?.targetId)
            return;
        this.chatFightProposals.set(offer.proposalId, {
            ...offer,
            challengerSocketId: client.id,
        });
        await this.lobbyChatService.saveMessage(msg);
        const recipient = this.lobbyUsers.get(offer.targetId);
        if (recipient?.isOnline && recipient.socketId) {
            this.server.to(recipient.socketId).emit('lobby_receive_dm', msg);
        }
    }
    async handleLobbyRespondFightProposal(client, data) {
        const offer = this.chatFightProposals.get(data.proposalId);
        if (!offer)
            return;
        offer.status = data.status;
        if (data.status === 'COUNTERED') {
            offer.counterWagerNear = data.wagerNear;
        }
        else {
            offer.wagerNear = data.wagerNear;
        }
        this.chatFightProposals.set(data.proposalId, offer);
        await this.lobbyChatService.updateProposalStatus(data.proposalId, data.status, offer.wagerNear);
        const challenger = this.lobbyUsers.get(offer.challengerId);
        const target = this.lobbyUsers.get(offer.targetId);
        if (data.status === 'ACCEPTED') {
            const matchId = 'duel_' + Math.random().toString(36).substring(2, 9);
            this.activeMatches.set(matchId, {
                hostId: challenger?.socketId || client.id,
                matchId,
                hostName: offer.challengerName,
                p1Type: offer.challengerCharId || 'fighter',
                p2Type: offer.targetCharId || 'shinobi',
                mode: offer.wagerNear > 0 ? `${offer.wagerNear} NEAR Chat Duel` : 'Free Chat Duel',
                wager: offer.wagerNear > 0 ? { token: 'NEAR', amount: offer.wagerNear } : null,
                viewers: 0,
                spectatorBets: [],
            });
            const matchPayload = {
                matchId,
                proposalId: offer.proposalId,
                wagerNear: offer.wagerNear,
                p1Name: offer.challengerName,
                p1Char: offer.challengerCharId || 'fighter',
                p2Name: offer.targetName,
                p2Char: offer.targetCharId || 'shinobi',
            };
            if (challenger?.socketId) {
                this.server.to(challenger.socketId).emit('lobby_fight_matched', {
                    ...matchPayload,
                    isHost: true,
                });
            }
            if (target?.socketId) {
                this.server.to(target.socketId).emit('lobby_fight_matched', {
                    ...matchPayload,
                    isHost: false,
                });
            }
        }
        else {
            if (challenger?.socketId) {
                this.server.to(challenger.socketId).emit('lobby_fight_proposal_updated', offer);
            }
            if (target?.socketId) {
                this.server.to(target.socketId).emit('lobby_fight_proposal_updated', offer);
            }
        }
    }
    handleLobbyChatMessage(client, msgData) {
        this.server.emit('lobby_chat_broadcast', {
            ...msgData,
            socketId: client.id,
            timestamp: Date.now(),
        });
    }
    handleDirectChallengeRequest(client, challengeData) {
        this.server.emit('direct_challenge_received', {
            ...challengeData,
            challengerSocketId: client.id,
            timestamp: Date.now(),
        });
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
    handleJoinGame(client) {
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
    (0, websockets_1.SubscribeMessage)('place_spectator_bet'),
    __param(0, (0, websockets_1.ConnectedSocket)()),
    __param(1, (0, websockets_1.MessageBody)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [socket_io_1.Socket, Object]),
    __metadata("design:returntype", void 0)
], GameGateway.prototype, "handlePlaceSpectatorBet", null);
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
    (0, websockets_1.SubscribeMessage)('lobby_register_presence'),
    __param(0, (0, websockets_1.ConnectedSocket)()),
    __param(1, (0, websockets_1.MessageBody)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [socket_io_1.Socket, Object]),
    __metadata("design:returntype", Promise)
], GameGateway.prototype, "handleLobbyRegisterPresence", null);
__decorate([
    (0, websockets_1.SubscribeMessage)('lobby_send_dm'),
    __param(0, (0, websockets_1.ConnectedSocket)()),
    __param(1, (0, websockets_1.MessageBody)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [socket_io_1.Socket, Object]),
    __metadata("design:returntype", Promise)
], GameGateway.prototype, "handleLobbySendDm", null);
__decorate([
    (0, websockets_1.SubscribeMessage)('lobby_send_fight_proposal'),
    __param(0, (0, websockets_1.ConnectedSocket)()),
    __param(1, (0, websockets_1.MessageBody)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [socket_io_1.Socket, Object]),
    __metadata("design:returntype", Promise)
], GameGateway.prototype, "handleLobbySendFightProposal", null);
__decorate([
    (0, websockets_1.SubscribeMessage)('lobby_respond_fight_proposal'),
    __param(0, (0, websockets_1.ConnectedSocket)()),
    __param(1, (0, websockets_1.MessageBody)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [socket_io_1.Socket, Object]),
    __metadata("design:returntype", Promise)
], GameGateway.prototype, "handleLobbyRespondFightProposal", null);
__decorate([
    (0, websockets_1.SubscribeMessage)('lobby_chat_message'),
    __param(0, (0, websockets_1.ConnectedSocket)()),
    __param(1, (0, websockets_1.MessageBody)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [socket_io_1.Socket, Object]),
    __metadata("design:returntype", void 0)
], GameGateway.prototype, "handleLobbyChatMessage", null);
__decorate([
    (0, websockets_1.SubscribeMessage)('direct_challenge_request'),
    __param(0, (0, websockets_1.ConnectedSocket)()),
    __param(1, (0, websockets_1.MessageBody)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [socket_io_1.Socket, Object]),
    __metadata("design:returntype", void 0)
], GameGateway.prototype, "handleDirectChallengeRequest", null);
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
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [socket_io_1.Socket]),
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
    __metadata("design:paramtypes", [game_service_1.GameService,
        near_relayer_service_1.NearRelayerService,
        lobby_chat_service_1.LobbyChatService])
], GameGateway);
//# sourceMappingURL=game.gateway.js.map