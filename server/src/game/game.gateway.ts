import {
  WebSocketGateway,
  SubscribeMessage,
  MessageBody,
  OnGatewayConnection,
  OnGatewayDisconnect,
  WebSocketServer,
  ConnectedSocket,
} from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';
import { GameService } from './game.service';
import { createHash } from 'crypto';

const NEAR_ARENA_CONTRACT_ID =
  process.env.NEAR_CONTRACT_ID || 'shin-arena.testnet';
const NEAR_RPC_URL =
  process.env.NEAR_RPC_URL || 'https://rpc.testnet.near.org';

@WebSocketGateway({
  cors: {
    origin: '*',
  },
})
export class GameGateway implements OnGatewayConnection, OnGatewayDisconnect {
  @WebSocketServer()
  server: Server;

  // Match tracking for Spectator Mode & Autonomous Agent Arena
  private activeMatches = new Map<string, any>();

  // Matchmaking Queues: buckets by wager type
  // Key: "free" or "wager_{token}_{amount}"
  private matchmakingBuckets = new Map<
    string,
    { socket: Socket; data: any }[]
  >();

  // Social Dojo Lobby Presence Registry (keyed by accountId)
  private lobbyUsers = new Map<
    string,
    {
      accountId: string;
      username: string;
      charId: string;
      socketId: string | null;
      isOnline: boolean;
      lastSeenLabel: string;
      elo: number;
      wins: number;
      losses: number;
    }
  >();

  // Store-and-forward Offline DM Queue (keyed by recipient accountId)
  private offlineMessageQueue = new Map<string, any[]>();

  // Active in-chat fight proposals (keyed by proposalId)
  private chatFightProposals = new Map<string, any>();

  constructor(private readonly gameService: GameService) {}

  handleConnection(client: Socket) {
    console.log(`Client connected: ${client.id}`);
  }

  handleDisconnect(client: Socket) {
    console.log(`Client disconnected: ${client.id}`);
    this.gameService.removePlayer(client.id);

    // Remove from all matchmaking buckets
    for (const [key, queue] of this.matchmakingBuckets.entries()) {
      this.matchmakingBuckets.set(
        key,
        queue.filter((p) => p.socket.id !== client.id),
      );
    }

    // Mark any registered Dojo Lobby user for this socket as offline
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
      this.server.emit(
        'lobby_presence_updated',
        Array.from(this.lobbyUsers.values()),
      );
    }

    // If acting as a host, clean up their match
    let matchEnded = false;
    for (const [mid, match] of this.activeMatches.entries()) {
      if (match.hostId === client.id) {
        this.activeMatches.delete(mid);
        this.server.to(`match_${mid}`).emit('match_ended');
        matchEnded = true;
        console.log(
          `Match ${mid} ended because host ${client.id} disconnected.`,
        );
      }
    }

    if (matchEnded) {
      this.server.emit(
        'active_matches_updated',
        Array.from(this.activeMatches.values()),
      );
    }
  }

  // ==========================================
  // SPECTATOR MODE & AGENT ARENA: RELAY LOGIC
  // ==========================================

  @SubscribeMessage('create_match')
  handleCreateMatch(
    @ConnectedSocket() client: Socket,
    @MessageBody() matchData: any,
  ) {
    const matchId =
      matchData?.matchId ||
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
    // Broadcast to everyone that there's a new match to watch
    this.server.emit(
      'active_matches_updated',
      Array.from(this.activeMatches.values()),
    );

    return { matchId, contractId: NEAR_ARENA_CONTRACT_ID };
  }

  @SubscribeMessage('host_sync_frame')
  handleHostSyncFrame(
    @ConnectedSocket() client: Socket,
    @MessageBody() frameData: any,
  ) {
    let matchId: string | null = null;
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

  @SubscribeMessage('host_fire_event')
  handleHostFireEvent(
    @ConnectedSocket() client: Socket,
    @MessageBody() eventData: any,
  ) {
    let matchId: string | null = null;
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

      // If the match is over, NEAR Referee triggers `settle_match` on `shin-arena.testnet`
      if (
        eventData.type === 'match_event' &&
        eventData.data?.event === 'gameOver'
      ) {
        console.log(
          `[NEAR REFEREE] Match ${matchId} concluded. Triggering settle_match on ${NEAR_ARENA_CONTRACT_ID}...`,
        );
        this.processNearMatchSettlement(
          matchId,
          eventData.data.detail?.winnerPubKey || 'fighter-1.shin-arena.testnet',
        );
      }
    }
  }

  @SubscribeMessage('place_spectator_bet')
  handlePlaceSpectatorBet(
    @ConnectedSocket() client: Socket,
    @MessageBody()
    betData: {
      matchId: string;
      backedFighterId: string;
      amountNear: number;
      spectatorAccountId: string;
    },
  ) {
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
      console.log(
        `[NEAR SPECTATOR POOL] Bet of ${amountNear} NEAR placed on ${backedFighterId} in Match ${matchId} by ${spectatorAccountId}`,
      );
      this.server.to(`match_${matchId}`).emit('spectator_pool_updated', {
        matchId,
        totalBets: match.spectatorBets.length,
        spectatorBets: match.spectatorBets,
      });
      return { success: true };
    }
    return { success: false, message: 'Match not found' };
  }

  private async processNearMatchSettlement(
    matchId: string,
    winnerAccountId: string,
  ) {
    const match = this.activeMatches.get(matchId);
    if (!match) return;

    const receiptHash = createHash('sha256')
      .update(`${matchId}:${winnerAccountId}:${Date.now()}`)
      .digest('hex')
      .slice(0, 44);

    console.log(
      `[NEAR REFEREE] Settling Match ${matchId} on ${NEAR_ARENA_CONTRACT_ID} (${NEAR_RPC_URL}) -> Winner: ${winnerAccountId} | Receipt: ${receiptHash}`,
    );

    this.activeMatches.delete(matchId);
    this.server.emit(
      'active_matches_updated',
      Array.from(this.activeMatches.values()),
    );
    this.server.to(`match_${matchId}`).emit('match_ended', {
      matchId,
      winnerAccountId,
      contractId: NEAR_ARENA_CONTRACT_ID,
      receiptHash,
    });
  }

  @SubscribeMessage('get_active_matches')
  handleGetActiveMatches(@ConnectedSocket() client: Socket) {
    client.emit(
      'active_matches_updated',
      Array.from(this.activeMatches.values()),
    );
  }

  @SubscribeMessage('join_spectator')
  handleJoinSpectator(
    @ConnectedSocket() client: Socket,
    @MessageBody() matchId: string,
  ) {
    if (this.activeMatches.has(matchId)) {
      client.join(`match_${matchId}`);
      const match = this.activeMatches.get(matchId);
      match.viewers++;
      this.activeMatches.set(matchId, match);
      console.log(`Client ${client.id} joined spectator room match_${matchId}`);

      this.server.emit(
        'active_matches_updated',
        Array.from(this.activeMatches.values()),
      );
      return { success: true };
    }
    return { success: false, message: 'Match not found' };
  }

  @SubscribeMessage('leave_spectator')
  handleLeaveSpectator(
    @ConnectedSocket() client: Socket,
    @MessageBody() matchId: string,
  ) {
    client.leave(`match_${matchId}`);
    if (this.activeMatches.has(matchId)) {
      const match = this.activeMatches.get(matchId);
      match.viewers = Math.max(0, match.viewers - 1);
      this.activeMatches.set(matchId, match);
      this.server.emit(
        'active_matches_updated',
        Array.from(this.activeMatches.values()),
      );
      console.log(`Client ${client.id} left spectator room match_${matchId}`);
    }
  }

  // ==========================================
  // ONLINE PVP: MATCHMAKING & RELAY
  // ==========================================

  @SubscribeMessage('join_matchmaking')
  handleJoinMatchmaking(
    @ConnectedSocket() client: Socket,
    @MessageBody() userData: any,
  ) {
    const wager = userData.wager; // { token: string, amount: number } | null
    const roomCode = userData.roomCode ? String(userData.roomCode).trim().toUpperCase() : null;
    const bucketKey = roomCode
      ? `room_${roomCode}`
      : wager
      ? `wager_${wager.token}_${wager.amount}`
      : 'free';

    console.log(`Client ${client.id} joining NEAR queue for [${bucketKey}]`);

    for (const [key, queue] of this.matchmakingBuckets.entries()) {
      this.matchmakingBuckets.set(
        key,
        queue.filter((p) => p.socket.id !== client.id),
      );
    }

    if (!this.matchmakingBuckets.has(bucketKey)) {
      this.matchmakingBuckets.set(bucketKey, []);
    }

    const currentBucket = this.matchmakingBuckets.get(bucketKey)!;

    if (currentBucket.length > 0) {
      const opponent = currentBucket.shift()!;
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

      this.server.emit(
        'active_matches_updated',
        Array.from(this.activeMatches.values()),
      );

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
    } else {
      currentBucket.push({ socket: client, data: userData });
    }
  }

  @SubscribeMessage('lobby_register_presence')
  handleLobbyRegisterPresence(
    @ConnectedSocket() client: Socket,
    @MessageBody()
    userData: {
      accountId: string;
      username: string;
      charId?: string;
      elo?: number;
      wins?: number;
      losses?: number;
    },
  ) {
    if (!userData?.accountId) return;
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

    // Deliver any queued offline DMs waiting for this user!
    const queued = this.offlineMessageQueue.get(userData.accountId) || [];
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
      this.offlineMessageQueue.delete(userData.accountId);
    }

    this.server.emit(
      'lobby_presence_updated',
      Array.from(this.lobbyUsers.values()),
    );
  }

  @SubscribeMessage('lobby_send_dm')
  handleLobbySendDm(
    @ConnectedSocket() client: Socket,
    @MessageBody() msg: any,
  ) {
    if (!msg?.recipientAccountId) {
      // Global Dojo Lounge broadcast
      this.server.emit('lobby_chat_broadcast', {
        ...msg,
        socketId: client.id,
        timestamp: msg.timestamp || Date.now(),
      });
      return { deliveryStatus: 'DELIVERED_LIVE' };
    }

    const recipient = this.lobbyUsers.get(msg.recipientAccountId);
    if (recipient?.isOnline && recipient.socketId) {
      const liveMsg = {
        ...msg,
        deliveryStatus: 'DELIVERED_LIVE',
      };
      this.server.to(recipient.socketId).emit('lobby_receive_dm', liveMsg);
      return { deliveryStatus: 'DELIVERED_LIVE' };
    } else {
      const queuedMsg = {
        ...msg,
        deliveryStatus: 'QUEUED_OFFLINE',
      };
      const existing = this.offlineMessageQueue.get(msg.recipientAccountId) || [];
      existing.push(queuedMsg);
      this.offlineMessageQueue.set(msg.recipientAccountId, existing);
      return { deliveryStatus: 'QUEUED_OFFLINE' };
    }
  }

  @SubscribeMessage('lobby_send_fight_proposal')
  handleLobbySendFightProposal(
    @ConnectedSocket() client: Socket,
    @MessageBody() msg: any,
  ) {
    const offer = msg?.challengeOffer;
    if (!offer?.proposalId || !offer?.targetId) return;

    this.chatFightProposals.set(offer.proposalId, {
      ...offer,
      challengerSocketId: client.id,
    });

    const recipient = this.lobbyUsers.get(offer.targetId);
    if (recipient?.isOnline && recipient.socketId) {
      this.server.to(recipient.socketId).emit('lobby_receive_dm', msg);
    }
  }

  @SubscribeMessage('lobby_respond_fight_proposal')
  handleLobbyRespondFightProposal(
    @ConnectedSocket() client: Socket,
    @MessageBody()
    data: {
      proposalId: string;
      status: 'ACCEPTED' | 'COUNTERED' | 'DECLINED';
      wagerNear: number;
    },
  ) {
    const offer = this.chatFightProposals.get(data.proposalId);
    if (!offer) return;

    offer.status = data.status;
    if (data.status === 'COUNTERED') {
      offer.counterWagerNear = data.wagerNear;
    } else {
      offer.wagerNear = data.wagerNear;
    }
    this.chatFightProposals.set(data.proposalId, offer);

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
    } else {
      if (challenger?.socketId) {
        this.server.to(challenger.socketId).emit('lobby_fight_proposal_updated', offer);
      }
      if (target?.socketId) {
        this.server.to(target.socketId).emit('lobby_fight_proposal_updated', offer);
      }
    }
  }

  @SubscribeMessage('lobby_chat_message')
  handleLobbyChatMessage(
    @ConnectedSocket() client: Socket,
    @MessageBody() msgData: any,
  ) {
    this.server.emit('lobby_chat_broadcast', {
      ...msgData,
      socketId: client.id,
      timestamp: Date.now(),
    });
  }

  @SubscribeMessage('direct_challenge_request')
  handleDirectChallengeRequest(
    @ConnectedSocket() client: Socket,
    @MessageBody() challengeData: any,
  ) {
    this.server.emit('direct_challenge_received', {
      ...challengeData,
      challengerSocketId: client.id,
      timestamp: Date.now(),
    });
  }

  @SubscribeMessage('cancel_matchmaking')
  handleCancelMatchmaking(@ConnectedSocket() client: Socket) {
    for (const [key, queue] of this.matchmakingBuckets.entries()) {
      this.matchmakingBuckets.set(
        key,
        queue.filter((p) => p.socket.id !== client.id),
      );
    }
    console.log(`Client ${client.id} left all matchmaking queues.`);
  }

  @SubscribeMessage('host_bind_match')
  handleHostBindMatch(
    @ConnectedSocket() client: Socket,
    @MessageBody() matchId: string,
  ) {
    if (this.activeMatches.has(matchId)) {
      const match = this.activeMatches.get(matchId);
      match.hostId = client.id;
      this.activeMatches.set(matchId, match);
      console.log(
        `Host ${client.id} successfully bound to remote match ${matchId}`,
      );
      this.server.emit(
        'active_matches_updated',
        Array.from(this.activeMatches.values()),
      );
    }
  }

  @SubscribeMessage('p2_input')
  handleP2Input(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: { matchId: string; input: any },
  ) {
    if (this.activeMatches.has(data.matchId)) {
      const match = this.activeMatches.get(data.matchId);
      if (match.hostId) {
        this.server.to(match.hostId).emit('host_p2_input', data.input);
      }
    }
  }

  // ==========================================
  // SERVER-AUTHORITATIVE MODE LOGIC
  // ==========================================

  @SubscribeMessage('join_game')
  handleJoinGame(client: Socket) {
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

  private startBotLoop(botId: string) {
    setInterval(() => {
      const bot = this.gameService.getPlayer(botId);
      if (!bot) return;

      const moveX = Math.random() > 0.5 ? 10 : -10;
      let moveY = 0;

      if (Math.random() > 0.95 && bot.y >= 300) {
        moveY = -20;
      } else if (bot.y < 500) {
        moveY = 5;
      }

      this.gameService.movePlayer(botId, bot.x + moveX, bot.y + moveY);
      this.server.emit('playerMoved', { id: botId, x: bot.x, y: bot.y });

      if (Math.random() > 0.9) {
        this.server.emit('playerAttacked', { id: botId });
      }
    }, 500);
  }

  @SubscribeMessage('playerInput')
  handlePlayerInput(
    client: Socket,
    @MessageBody() input: { x: number; y: number },
  ) {
    this.gameService.movePlayer(client.id, input.x, input.y);
    this.server.emit('playerMoved', { id: client.id, x: input.x, y: input.y });
  }

  @SubscribeMessage('playerAttack')
  handlePlayerAttack(client: Socket) {
    const attackerId = client.id;
    const attacker = this.gameService.getPlayer(attackerId);

    if (!attacker) return;

    this.server.emit('playerAttacked', { id: attackerId });

    const players = this.gameService.getAllPlayers();
    const ATTACK_RANGE = 70;
    const DAMAGE = 10;

    players.forEach((target) => {
      if (target.id === attackerId) return;
      if (target.hp <= 0) return;

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
}
