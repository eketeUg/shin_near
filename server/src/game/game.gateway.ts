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
import { LobbyChatService } from './lobby-chat.service';
import { NearRelayerService } from './near-relayer.service';
import { TournamentService } from './tournament.service';
import { UsersService } from '../users/users.service';
import { AgentBrainService } from './agent-brain.service';
import { createHash } from 'crypto';

const NEAR_ARENA_CONTRACT_ID =
  process.env.NEAR_CONTRACT_ID || 'shin-arena-28d.testnet';
const NEAR_RPC_URL =
  process.env.NEAR_RPC_URL || 'https://test.rpc.fastnear.com';

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
  private disconnectTimers = new Map<string, ReturnType<typeof setTimeout>>();
  private broadcastTickCount = 0;
  private cachedOnChainAgents: any[] = [];

  constructor(
    private readonly gameService: GameService,
    private readonly nearRelayer: NearRelayerService,
    private readonly lobbyChatService: LobbyChatService,
    private readonly tournamentService: TournamentService,
    private readonly usersService: UsersService,
    private readonly agentBrainService: AgentBrainService,
  ) {}

  afterInit(server: Server) {
    this.tournamentService.registerGatewayServer(server);
    this.agentBrainService.registerGatewayServer(server);
    void this.ensureServerBroadcastMatches();
    setInterval(() => {
      this.tickServerBroadcasts();
    }, 100);
  }

  private async ensureServerBroadcastMatches() {
    try {
      const fighters = (await this.nearRelayer
        .viewMethod('get_all_fighters', {})
        .catch(() => [])) as any[];
      if (Array.isArray(fighters) && fighters.length >= 2) {
        this.cachedOnChainAgents = fighters;
      }
    } catch {}

    const serverMatches = Array.from(this.activeMatches.values()).filter(
      (m) => m.isServerBroadcast,
    );
    const needed = Math.max(0, 2 - serverMatches.length);
    for (let i = 0; i < needed; i++) {
      this.spawnServerBroadcastMatch(i);
    }
  }

  private spawnServerBroadcastMatch(slotIdx = 0) {
    if (this.cachedOnChainAgents.length < 2) {
      return;
    }
    const pool = this.cachedOnChainAgents;
    const f1 = pool[(slotIdx * 2 + Math.floor(Math.random() * pool.length)) % pool.length];
    let f2 = pool[(slotIdx * 2 + 1 + Math.floor(Math.random() * pool.length)) % pool.length];
    if (f2.token_id === f1.token_id) {
      f2 = pool.find((x) => x.token_id !== f1.token_id) || pool[0];
    }

    const matchId = `live_bcast_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 6)}`;
    const p1Type = String(f1.char_class || 'samurai').toLowerCase();
    const p2Type = String(f2.char_class || 'shinobi').toLowerCase();

    this.activeMatches.set(matchId, {
      hostId: 'SERVER_BROADCAST',
      isServerBroadcast: true,
      matchId,
      hostName: f1.name || 'Fighter 1',
      p1Name: f1.name || 'Fighter 1',
      p2Name: f2.name || 'Fighter 2',
      p1Type,
      p2Type,
      p1AccountId: f1.agent_wallet_id || f1.owner_id || f1.token_id,
      p2AccountId: f2.agent_wallet_id || f2.owner_id || f2.token_id,
      p1: {
        tokenId: f1.token_id,
        accountId: f1.agent_wallet_id || f1.owner_id || f1.token_id,
        name: f1.name || 'Fighter 1',
        charId: p1Type,
        atk: Number(f1.atk || 16),
        def: Number(f1.def || 12),
        elo: Number(f1.elo || 1250),
      },
      p2: {
        tokenId: f2.token_id,
        accountId: f2.agent_wallet_id || f2.owner_id || f2.token_id,
        name: f2.name || 'Fighter 2',
        charId: p2Type,
        atk: Number(f2.atk || 16),
        def: Number(f2.def || 12),
        elo: Number(f2.elo || 1250),
      },
      mode: 'LIVE AGENT ARENA BROADCAST',
      wager: { token: 'SHIN', amount: 250 },
      wagerShin: 250,
      fighterPoolShin: 500,
      viewers: 0,
      spectatorBets: [],
      sim: {
        matchTimer: 99,
        tickInSec: 0,
        p1RelX: -180,
        p2RelX: 180,
        p1Hp: 100,
        p2Hp: 100,
        p1MaxHp: 100,
        p2MaxHp: 100,
        p1Anim: `${p1Type}_idle`,
        p2Anim: `${p2Type}_idle`,
        p1FlipX: false,
        p2FlipX: true,
        ending: false,
      },
    });

    if (this.server) {
      this.server.emit(
        'active_matches_updated',
        Array.from(this.activeMatches.values()),
      );
    }
  }

  private tickServerBroadcasts() {
    if (!this.server) return;
    this.broadcastTickCount++;

    for (const [matchId, match] of this.activeMatches.entries()) {
      if (!match.isServerBroadcast || !match.sim || match.sim.ending) continue;
      const s = match.sim;
      s.tickInSec++;
      if (s.tickInSec >= 10) {
        s.tickInSec = 0;
        s.matchTimer = Math.max(0, s.matchTimer - 1);
      }

      const dist = Math.abs(s.p2RelX - s.p1RelX);
      s.p1FlipX = s.p1RelX > s.p2RelX;
      s.p2FlipX = s.p2RelX > s.p1RelX;

      if (dist > 95) {
        // Move toward each other
        const step1 = 10 + Math.random() * 6;
        const step2 = 10 + Math.random() * 6;
        s.p1RelX += s.p1RelX < s.p2RelX ? step1 : -step1;
        s.p2RelX += s.p2RelX < s.p1RelX ? step2 : -step2;
        s.p1Anim = `${match.p1Type}_run`;
        s.p2Anim = `${match.p2Type}_run`;
      } else {
        // Close-range combat exchange
        const roll = Math.random();
        if (roll < 0.28) {
          const atkIdx = 1 + Math.floor(Math.random() * 3);
          s.p1Anim = `${match.p1Type}_attack_${atkIdx}`;
          const blocked = Math.random() < 0.25;
          s.p2Anim = blocked ? `${match.p2Type}_block` : `${match.p2Type}_idle`;
          const dmg = blocked ? 1 : Math.max(2, Math.round((match.p1?.atk || 16) * 0.22));
          s.p2Hp = Math.max(0, s.p2Hp - dmg);
          s.p2RelX = Math.min(340, s.p2RelX + (blocked ? 8 : 22));
          this.server.to(`match_${matchId}`).emit('spectator_fire_event', {
            type: 'audio',
            data: { type: blocked ? 'block_hit' : 'hit', id: 'remote_player' },
          });
        } else if (roll < 0.56) {
          const atkIdx = 1 + Math.floor(Math.random() * 3);
          s.p2Anim = `${match.p2Type}_attack_${atkIdx}`;
          const blocked = Math.random() < 0.25;
          s.p1Anim = blocked ? `${match.p1Type}_block` : `${match.p1Type}_idle`;
          const dmg = blocked ? 1 : Math.max(2, Math.round((match.p2?.atk || 16) * 0.22));
          s.p1Hp = Math.max(0, s.p1Hp - dmg);
          s.p1RelX = Math.max(-340, s.p1RelX - (blocked ? 8 : 22));
          this.server.to(`match_${matchId}`).emit('spectator_fire_event', {
            type: 'audio',
            data: { type: blocked ? 'block_hit' : 'hit', id: 'local_player' },
          });
        } else if (roll < 0.72) {
          // Dash back / reposition
          s.p1RelX = Math.max(-300, s.p1RelX - 35);
          s.p2RelX = Math.min(300, s.p2RelX + 35);
          s.p1Anim = `${match.p1Type}_run`;
          s.p2Anim = `${match.p2Type}_run`;
        } else {
          s.p1Anim = `${match.p1Type}_idle`;
          s.p2Anim = `${match.p2Type}_idle`;
        }
      }

      const framePayload = {
        matchTimer: s.matchTimer,
        currentRound: 1,
        p1Wins: 0,
        p2Wins: 0,
        p1: {
          x: 640 + s.p1RelX,
          y: 385,
          relX: s.p1RelX,
          relY: 0,
          flipX: s.p1FlipX,
          anim: s.p1Hp <= 0 ? `${match.p1Type}_dead` : s.p1Anim,
          hp: s.p1Hp,
          maxHp: s.p1MaxHp,
        },
        p2: {
          x: 640 + s.p2RelX,
          y: 385,
          relX: s.p2RelX,
          relY: 0,
          flipX: s.p2FlipX,
          anim: s.p2Hp <= 0 ? `${match.p2Type}_dead` : s.p2Anim,
          hp: s.p2Hp,
          maxHp: s.p2MaxHp,
        },
      };

      this.server.to(`match_${matchId}`).emit('spectator_sync_frame', framePayload);

      if (s.p1Hp <= 0 || s.p2Hp <= 0 || s.matchTimer <= 0) {
        s.ending = true;
        const p1Won = s.p1Hp >= s.p2Hp;
        const winnerSide = p1Won ? 'p1' : 'p2';
        const winnerName = p1Won ? match.p1Name : match.p2Name;
        const winnerAccountId = p1Won ? match.p1AccountId : match.p2AccountId;

        this.server.to(`match_${matchId}`).emit('spectator_fire_event', {
          type: 'match_event',
          data: {
            event: 'gameOver',
            detail: {
              matchId,
              winner: winnerName,
              winnerId: winnerSide,
              winnerPubKey: winnerAccountId,
              duration: `${99 - s.matchTimer}s`,
              roundsScore: p1Won ? '1 - 0' : '0 - 1',
              p1Stats: {
                name: match.p1Name,
                charType: match.p1Type,
                damageDealt: 100 - s.p2Hp,
                hitsLanded: Math.max(1, Math.round((100 - s.p2Hp) / 4)),
              },
              p2Stats: {
                name: match.p2Name,
                charType: match.p2Type,
                damageDealt: 100 - s.p1Hp,
                hitsLanded: Math.max(1, Math.round((100 - s.p1Hp) / 4)),
              },
            },
          },
        });

        setTimeout(() => {
          void this.processNearMatchSettlement(matchId, winnerAccountId);
          setTimeout(() => {
            void this.ensureServerBroadcastMatches();
          }, 2500);
        }, 1500);
      }
    }

    if (this.broadcastTickCount % 20 === 0) {
      this.server.emit(
        'active_matches_updated',
        Array.from(this.activeMatches.values()),
      );
    }
  }

  handleConnection(client: Socket) {
    console.log(`Client connected: ${client.id}`);
  }

  handleDisconnect(client: Socket) {
    console.log(`Client disconnected: ${client.id}`);
    this.gameService.removePlayer(client.id);

    // Remove from all matchmaking buckets and refund any unmatched $SHIN duel escrow
    for (const [key, queue] of this.matchmakingBuckets.entries()) {
      const leaving = queue.filter((p) => p.socket.id === client.id);
      for (const entry of leaving) {
        if (entry.data?.escrowId && entry.data?.accountId) {
          void this.nearRelayer
            .callMethod(
              'refund_shin_duel',
              {
                escrow_id: entry.data.escrowId,
                account_id: entry.data.accountId,
              },
              '80000000000000',
            )
            .catch(() => {});
        }
      }
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

    // If acting as a host, give a 6s grace period in case the client is transitioning from MatchmakingScreen to GameScene
    for (const [mid, match] of this.activeMatches.entries()) {
      if (match.hostId === client.id && !match.isServerBroadcast) {
        const prevTimer = this.disconnectTimers.get(mid);
        if (prevTimer) clearTimeout(prevTimer);
        const timer = setTimeout(() => {
          this.disconnectTimers.delete(mid);
          const current = this.activeMatches.get(mid);
          if (current && current.hostId === client.id) {
            this.activeMatches.delete(mid);
            this.server.to(`match_${mid}`).emit('match_ended');
            console.log(
              `Match ${mid} ended because host ${client.id} disconnected.`,
            );
            this.server.emit(
              'active_matches_updated',
              Array.from(this.activeMatches.values()),
            );
          }
        }, 6000);
        this.disconnectTimers.set(mid, timer);
      }
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
    const existing = this.activeMatches.get(matchId);
    const pendingTimer = this.disconnectTimers.get(matchId);
    if (pendingTimer) {
      clearTimeout(pendingTimer);
      this.disconnectTimers.delete(matchId);
    }

    const p1Type = String(matchData?.p1Type || existing?.p1Type || 'shinobi').toLowerCase();
    const p2Type = String(matchData?.p2Type || existing?.p2Type || 'samurai').toLowerCase();
    const p1Name = matchData?.p1Name || matchData?.hostName || existing?.p1Name || existing?.hostName || 'Warrior 1';
    const p2Name = matchData?.p2Name || existing?.p2Name || 'Challenger';
    const wager = matchData?.wager || existing?.wager || null;
    const fighterPoolShin =
      matchData?.fighterPoolShin ||
      existing?.fighterPoolShin ||
      (wager?.token === 'SHIN' ? Number(wager.amount || 0) * 2 : 500);

    this.activeMatches.set(matchId, {
      ...(existing || {}),
      hostId: client.id,
      matchId,
      hostName: p1Name,
      p1Name,
      p2Name,
      p1Type,
      p2Type,
      mode: matchData?.mode || existing?.mode || 'LIVE DUEL',
      wager,
      wagerNear: matchData?.wagerNear || existing?.wagerNear || 1.0,
      fighterPoolShin,
      viewers: existing?.viewers || 0,
      spectatorBets: existing?.spectatorBets || [],
      sim: existing?.sim || {
        matchTimer: matchData?.matchTimer || 180,
        p1Hp: 100,
        p2Hp: 100,
        p1MaxHp: 100,
        p2MaxHp: 100,
      },
    });

    client.join(`match_${matchId}`);
    console.log(`[NEAR ARENA] Match created on ${NEAR_ARENA_CONTRACT_ID}: ${matchId} (${p1Name} vs ${p2Name})`);
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
    let matchId: string | null = frameData?.matchId || null;
    if (!matchId || !this.activeMatches.has(matchId)) {
      matchId = null;
      for (const [mid, match] of this.activeMatches.entries()) {
        if (match.hostId === client.id) {
          matchId = mid;
          break;
        }
      }
    }

    if (matchId && this.activeMatches.has(matchId)) {
      const match = this.activeMatches.get(matchId);
      if (match) {
        match.hostId = client.id;
        match.sim = {
          ...(match.sim || {}),
          matchTimer: frameData?.matchTimer ?? match.sim?.matchTimer ?? 180,
          p1Hp: frameData?.p1?.hp ?? match.sim?.p1Hp ?? 100,
          p2Hp: frameData?.p2?.hp ?? match.sim?.p2Hp ?? 100,
          p1MaxHp: frameData?.p1?.maxHp ?? 100,
          p2MaxHp: frameData?.p2?.maxHp ?? 100,
        };
        this.activeMatches.set(matchId, match);
      }
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
    let matchId: string | null = eventData?.matchId || eventData?.data?.detail?.matchId || null;
    if (!matchId || !this.activeMatches.has(matchId)) {
      matchId = null;
      for (const [mid, match] of this.activeMatches.entries()) {
        if (match.hostId === client.id) {
          matchId = mid;
          break;
        }
      }
    }

    if (matchId) {
      client.broadcast
        .to(`match_${matchId}`)
        .emit('spectator_fire_event', eventData);

      // If the match is over, NEAR Referee triggers settlement on `shin-arena-28d.testnet`
      if (
        eventData.type === 'match_event' &&
        eventData.data?.event === 'gameOver'
      ) {
        const match = this.activeMatches.get(matchId);
        const detail = eventData.data?.detail || {};
        const resolvedWinner =
          detail.winnerPubKey ||
          (detail.winnerId === 'p1'
            ? match?.p1AccountId
            : detail.winnerId === 'p2'
            ? match?.p2AccountId
            : undefined) ||
          'fighter-1.shin-arena.testnet';
        console.log(
          `[NEAR REFEREE] Match ${matchId} concluded. Triggering settlement on ${NEAR_ARENA_CONTRACT_ID} (Winner: ${resolvedWinner})...`,
        );
        this.processNearMatchSettlement(matchId, resolvedWinner);
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

    let receiptHash = createHash('sha256')
      .update(`${matchId}:${winnerAccountId}:${Date.now()}`)
      .digest('hex')
      .slice(0, 44);
    let explorerUrl = '';
    let onChain = false;

    // 1. Settle 1v1 Human $SHIN Waged Duel directly to winner's NEAR wallet (95% pot / 5% dev fee)
    if (
      match?.wager?.token === 'SHIN' &&
      Number(match?.wager?.amount) > 0 &&
      match?.p1EscrowId &&
      match?.p2EscrowId &&
      match?.p1AccountId &&
      match?.p2AccountId
    ) {
      const relay = await this.nearRelayer.callMethod(
        'settle_shin_duel',
        {
          duel_id: matchId,
          p1_escrow_id: match.p1EscrowId,
          p1_account_id: match.p1AccountId,
          p2_escrow_id: match.p2EscrowId,
          p2_account_id: match.p2AccountId,
          winner_account_id: winnerAccountId,
        },
        '120000000000000',
      );
      if (relay.ok && relay.txHash) {
        receiptHash = relay.txHash;
        explorerUrl = relay.explorerUrl;
        onChain = true;
      }
    } else {
      // 2. Fallback: Agent/NFT match settlement if fighter token IDs are tracked
      const winnerTokenId =
        match?.p1?.accountId === winnerAccountId
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
    }

    // Update MongoDB human player stats (wins/losses/rating/xp/totalShinEarned)
    if (match?.p1AccountId && match?.p2AccountId) {
      const totalPotShin =
        match?.wager?.token === 'SHIN' ? Number(match.wager.amount || 0) * 2 : 0;
      const winnerPayoutShin = Math.floor(totalPotShin * 0.95);
      const loserAccountId =
        winnerAccountId === match.p1AccountId
          ? match.p2AccountId
          : match.p1AccountId;
      await this.usersService
        .recordMatchOutcome(winnerAccountId, true, winnerPayoutShin)
        .catch(() => {});
      await this.usersService
        .recordMatchOutcome(loserAccountId, false, 0)
        .catch(() => {});
    }

    console.log(
      `[NEAR REFEREE] Settling Match ${matchId} on ${NEAR_ARENA_CONTRACT_ID} (${NEAR_RPC_URL}) -> Winner: ${winnerAccountId} | Receipt: ${receiptHash} | OnChain: ${onChain}`,
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
      explorerUrl,
      onChain,
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
  async handleJoinMatchmaking(
    @ConnectedSocket() client: Socket,
    @MessageBody() userData: any,
  ) {
    const wager = userData.wager; // { token: string, amount: number } | null
    if (wager && Number(wager.amount) > 0) {
      const acct = String(userData?.accountId || '');
      if (!acct || acct.startsWith('guest-')) {
        client.emit('matchmaking_error', {
          message: 'Guest players cannot compete in on-chain wager duels. Please sign in with Google or Email first.',
        });
        return;
      }
      const dbUser = await this.usersService.findByWallet(acct).catch(() => null);
      if (dbUser?.authProvider === 'guest') {
        client.emit('matchmaking_error', {
          message: 'Guest players cannot compete in on-chain wager duels. Please sign in with Google or Email first.',
        });
        return;
      }
    }
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
        hostId: opponent.socket.id,
        matchId: matchId,
        hostName: opponent.data?.username || 'Player 1',
        p1Name: opponent.data?.username || 'Player 1',
        p2Name: userData?.username || 'Player 2',
        p1Type: opponent.data?.charType || 'shinobi',
        p2Type: userData?.charType || 'samurai',
        p1AccountId: opponent.data?.accountId || null,
        p2AccountId: userData?.accountId || null,
        p1EscrowId: opponent.data?.escrowId || null,
        p2EscrowId: userData?.escrowId || null,
        mode: roomCode ? `Room #${roomCode}` : wager ? 'SHIN Wager Fight' : 'Free Fight',
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
        opponentAccountId: userData?.accountId || null,
        opponentChar: userData?.charType || 'samurai',
        myChar: opponent.data?.charType || 'shinobi',
      });

      client.emit('match_found', {
        role: 'P2',
        matchId: matchId,
        roomCode,
        opponentId: opponent.socket.id,
        opponentName: opponent.data?.username || 'Player 1',
        opponentAccountId: opponent.data?.accountId || null,
        opponentChar: opponent.data?.charType || 'shinobi',
        myChar: userData?.charType || 'samurai',
      });

      opponent.socket.join(`match_${matchId}`);
      client.join(`match_${matchId}`);
      console.log(`Matchmaking [${bucketKey}] successful! Match ${matchId}`);
    } else {
      currentBucket.push({ socket: client, data: userData });
    }
  }

  @SubscribeMessage('cancel_matchmaking')
  async handleCancelMatchmaking(@ConnectedSocket() client: Socket) {
    for (const [key, queue] of this.matchmakingBuckets.entries()) {
      const leaving = queue.filter((p) => p.socket.id === client.id);
      for (const entry of leaving) {
        if (entry.data?.escrowId && entry.data?.accountId) {
          await this.nearRelayer
            .callMethod(
              'refund_shin_duel',
              {
                escrow_id: entry.data.escrowId,
                account_id: entry.data.accountId,
              },
              '80000000000000',
            )
            .catch(() => {});
        }
      }
      this.matchmakingBuckets.set(
        key,
        queue.filter((p) => p.socket.id !== client.id),
      );
    }
    client.emit('matchmaking_cancelled', { refunded: true });
  }

  @SubscribeMessage('lobby_register_presence')
  async handleLobbyRegisterPresence(
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

    // Deliver any persisted queued offline DMs from MongoDB!
    const queued = await this.lobbyChatService.getQueuedOfflineDms(
      userData.accountId,
    );
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

    this.server.emit(
      'lobby_presence_updated',
      Array.from(this.lobbyUsers.values()),
    );
  }

  @SubscribeMessage('lobby_send_dm')
  async handleLobbySendDm(
    @ConnectedSocket() client: Socket,
    @MessageBody() msg: any,
  ) {
    const timestamp = msg.timestamp || Date.now();
    if (!msg?.recipientAccountId) {
      // Global Dojo Lounge broadcast + persist to MongoDB
      const globalMsg = {
        ...msg,
        id: msg.id || `msg-${timestamp}`,
        deliveryStatus: 'DELIVERED_LIVE' as const,
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
        deliveryStatus: 'DELIVERED_LIVE' as const,
        timestamp,
      };
      await this.lobbyChatService.saveMessage(liveMsg);
      this.server.to(recipient.socketId).emit('lobby_receive_dm', liveMsg);
      return { deliveryStatus: 'DELIVERED_LIVE' };
    } else {
      const queuedMsg = {
        ...msg,
        id: msg.id || `dm-${timestamp}`,
        deliveryStatus: 'QUEUED_OFFLINE' as const,
        timestamp,
      };
      await this.lobbyChatService.saveMessage(queuedMsg);
      return { deliveryStatus: 'QUEUED_OFFLINE' };
    }
  }

  @SubscribeMessage('lobby_send_fight_proposal')
  async handleLobbySendFightProposal(
    @ConnectedSocket() client: Socket,
    @MessageBody() msg: any,
  ) {
    const offer = msg?.challengeOffer;
    if (!offer?.proposalId || !offer?.targetId) return;

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

  @SubscribeMessage('lobby_respond_fight_proposal')
  async handleLobbyRespondFightProposal(
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
    await this.lobbyChatService.updateProposalStatus(
      data.proposalId,
      data.status,
      offer.wagerNear,
    );

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
        mode:
          offer.wagerNear > 0
            ? `${Math.round(offer.wagerNear * 1000)} $SHIN Chat Duel`
            : 'Free Chat Duel',
        wager:
          offer.wagerNear > 0
            ? { token: 'SHIN', amount: Math.round(offer.wagerNear * 1000) }
            : null,
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

  @SubscribeMessage('host_bind_match')
  handleHostBindMatch(
    @ConnectedSocket() client: Socket,
    @MessageBody() matchId: string,
  ) {
    if (this.activeMatches.has(matchId)) {
      const pendingTimer = this.disconnectTimers.get(matchId);
      if (pendingTimer) {
        clearTimeout(pendingTimer);
        this.disconnectTimers.delete(matchId);
      }
      const match = this.activeMatches.get(matchId);
      match.hostId = client.id;
      this.activeMatches.set(matchId, match);
      client.join(`match_${matchId}`);
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
