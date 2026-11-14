import { Injectable, Logger, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import type { Server } from 'socket.io';
import { UsersService } from '../users/users.service';
import { NearRelayerService } from './near-relayer.service';

export interface TournamentBracketMatch {
  id: string;
  round: 'QF_1' | 'QF_2' | 'QF_3' | 'QF_4' | 'SEMI_1' | 'SEMI_2' | 'GRAND_FINAL';
  label: string;
  roomCode?: string;
  p1Id: string | null;
  p1Name: string;
  p1CharId: string;
  p1Ready?: boolean;
  p2Id: string | null;
  p2Name: string;
  p2CharId: string;
  p2Ready?: boolean;
  winnerId?: string;
  winnerName?: string;
  status: 'WAITING' | 'READY' | 'COMPLETED';
}

export interface HumanEntrant {
  accountId: string;
  username: string;
  charId: string;
  joinTxHash: string;
  joinedAt: number;
}

export interface HumanCupState {
  cupNumber: number;
  tournamentId: string;
  title: string;
  entryFeeShin: number;
  maxPlayers: number;
  status: 'REGISTRATION' | 'IN_PROGRESS' | 'SETTLED';
  entrants: HumanEntrant[];
  matches: TournamentBracketMatch[];
  createTxHash?: string;
  settleTxHash?: string;
  explorerUrl?: string;
  championId?: string;
  championName?: string;
  totalPoolShin: number;
  winnerPayoutShin: number;
}

export interface AgentCupState {
  cupNumber: number;
  tournamentId: string;
  title: string;
  entryFeeShin: number;
  status: 'IN_PROGRESS' | 'REST_COOLDOWN';
  currentStage: 'SEMI_1' | 'SEMI_2' | 'GRAND_FINAL' | 'REST_COOLDOWN';
  restSecondsRemaining: number;
  nextRoundInSeconds: number;
  matches: TournamentBracketMatch[];
  createTxHash?: string;
  settleTxHash?: string;
  explorerUrl?: string;
  lastChampionId?: string;
  lastChampionName?: string;
  lastChampionWonShin?: number;
  totalPoolShin: number;
  winnerPayoutShin: number;
  enrolledAgents: Array<{
    tokenId: string;
    name: string;
    charClass: string;
    ownerId: string;
    wins: number;
    elo: number;
    powerLevel: number;
    enrolled: boolean;
  }>;
}

interface OnChainFighter {
  token_id: string;
  owner_id: string;
  char_class: string;
  name: string;
  atk: number;
  def: number;
  spd: number;
  power_level: number;
  wins: number;
  losses: number;
  elo: number;
}

@Injectable()
export class TournamentService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(TournamentService.name);

  private humanCup!: HumanCupState;
  private agentCup!: AgentCupState;
  private agentFightersMap = new Map<string, OnChainFighter>();
  private enrolledOverrides = new Map<string, boolean>();
  private tickInterval: NodeJS.Timeout | null = null;
  private nextRoundAt = Date.now() + 15000;
  private isAdvancingAgentCup = false;
  private ioServer: Server | null = null;

  private readonly HUMAN_ENTRY_SHIN = 500;
  private readonly HUMAN_MAX_PLAYERS = 8;
  private readonly AGENT_ENTRY_SHIN = 500;
  private readonly ROUND_DURATION_MS = 15000;
  private readonly REST_DURATION_SEC = 120;

  constructor(
    private readonly nearRelayer: NearRelayerService,
    private readonly usersService: UsersService,
  ) {}

  public registerGatewayServer(server: Server) {
    this.ioServer = server;
  }

  private broadcastTournamentUpdate() {
    if (!this.ioServer) return;
    this.ioServer.emit('tournament_updated', this.getState());
    this.ioServer.emit('leaderboard_updated', { ts: Date.now() });
  }

  async onModuleInit() {
    this.humanCup = this.buildFreshHumanCup(1);
    this.agentCup = this.buildPlaceholderAgentCup(1);

    // Initialize on-chain cups asynchronously without blocking NestJS startup
    void this.ensureHumanCupOnChain();
    void this.startNewAgentCup(1);

    this.tickInterval = setInterval(() => {
      void this.tickAgentCup();
    }, 1000);
  }

  onModuleDestroy() {
    if (this.tickInterval) {
      clearInterval(this.tickInterval);
      this.tickInterval = null;
    }
  }

  private buildFreshHumanCup(cupNumber: number): HumanCupState {
    const tournamentId = `human-cup-${cupNumber}-${Date.now().toString(36)}`;
    const mkRoom = (id: string) => `T${cupNumber}-${id}`.toUpperCase();
    return {
      cupNumber,
      tournamentId,
      title: `Blood-Moon Human Championship #${cupNumber}`,
      entryFeeShin: this.HUMAN_ENTRY_SHIN,
      maxPlayers: this.HUMAN_MAX_PLAYERS,
      status: 'REGISTRATION',
      entrants: [],
      totalPoolShin: 0,
      winnerPayoutShin: 0,
      matches: [
        {
          id: 'human-qf-1',
          round: 'QF_1',
          label: 'Quarterfinal 1',
          roomCode: mkRoom('QF1'),
          p1Id: null,
          p1Name: 'Open Slot #1',
          p1CharId: 'fighter',
          p1Ready: false,
          p2Id: null,
          p2Name: 'Open Slot #2',
          p2CharId: 'shinobi',
          p2Ready: false,
          status: 'WAITING',
        },
        {
          id: 'human-qf-2',
          round: 'QF_2',
          label: 'Quarterfinal 2',
          roomCode: mkRoom('QF2'),
          p1Id: null,
          p1Name: 'Open Slot #3',
          p1CharId: 'kunoichi',
          p1Ready: false,
          p2Id: null,
          p2Name: 'Open Slot #4',
          p2CharId: 'samurai',
          p2Ready: false,
          status: 'WAITING',
        },
        {
          id: 'human-qf-3',
          round: 'QF_3',
          label: 'Quarterfinal 3',
          roomCode: mkRoom('QF3'),
          p1Id: null,
          p1Name: 'Open Slot #5',
          p1CharId: 'fighter',
          p1Ready: false,
          p2Id: null,
          p2Name: 'Open Slot #6',
          p2CharId: 'shinobi',
          p2Ready: false,
          status: 'WAITING',
        },
        {
          id: 'human-qf-4',
          round: 'QF_4',
          label: 'Quarterfinal 4',
          roomCode: mkRoom('QF4'),
          p1Id: null,
          p1Name: 'Open Slot #7',
          p1CharId: 'kunoichi',
          p1Ready: false,
          p2Id: null,
          p2Name: 'Open Slot #8',
          p2CharId: 'samurai',
          p2Ready: false,
          status: 'WAITING',
        },
        {
          id: 'human-semi-1',
          round: 'SEMI_1',
          label: 'Semifinal A',
          roomCode: mkRoom('SF1'),
          p1Id: null,
          p1Name: 'Winner QF 1',
          p1CharId: 'fighter',
          p1Ready: false,
          p2Id: null,
          p2Name: 'Winner QF 2',
          p2CharId: 'kunoichi',
          p2Ready: false,
          status: 'WAITING',
        },
        {
          id: 'human-semi-2',
          round: 'SEMI_2',
          label: 'Semifinal B',
          roomCode: mkRoom('SF2'),
          p1Id: null,
          p1Name: 'Winner QF 3',
          p1CharId: 'fighter',
          p1Ready: false,
          p2Id: null,
          p2Name: 'Winner QF 4',
          p2CharId: 'kunoichi',
          p2Ready: false,
          status: 'WAITING',
        },
        {
          id: 'human-final',
          round: 'GRAND_FINAL',
          label: 'Grand Final',
          roomCode: mkRoom('FINAL'),
          p1Id: null,
          p1Name: 'Winner Semifinal A',
          p1CharId: 'fighter',
          p1Ready: false,
          p2Id: null,
          p2Name: 'Winner Semifinal B',
          p2CharId: 'shinobi',
          p2Ready: false,
          status: 'WAITING',
        },
      ],
    };
  }

  private buildPlaceholderAgentCup(cupNumber: number): AgentCupState {
    const tournamentId = `agent-cup-${cupNumber}-${Date.now().toString(36)}`;
    return {
      cupNumber,
      tournamentId,
      title: `Autonomous Agent Shadow Cup #${cupNumber}`,
      entryFeeShin: this.AGENT_ENTRY_SHIN,
      status: 'IN_PROGRESS',
      currentStage: 'SEMI_1',
      restSecondsRemaining: 0,
      nextRoundInSeconds: Math.ceil(this.ROUND_DURATION_MS / 1000),
      totalPoolShin: this.AGENT_ENTRY_SHIN * 4,
      winnerPayoutShin: Math.round(this.AGENT_ENTRY_SHIN * 4 * 0.95),
      matches: [
        {
          id: `agent-c${cupNumber}-semi-1`,
          round: 'SEMI_1',
          label: 'Agent Semifinal A',
          p1Id: null,
          p1Name: 'Loading Agent...',
          p1CharId: 'shinobi',
          p2Id: null,
          p2Name: 'Loading Agent...',
          p2CharId: 'kunoichi',
          status: 'WAITING',
        },
        {
          id: `agent-c${cupNumber}-semi-2`,
          round: 'SEMI_2',
          label: 'Agent Semifinal B',
          p1Id: null,
          p1Name: 'Loading Agent...',
          p1CharId: 'samurai',
          p2Id: null,
          p2Name: 'Loading Agent...',
          p2CharId: 'samurai_commander',
          status: 'WAITING',
        },
        {
          id: `agent-c${cupNumber}-final`,
          round: 'GRAND_FINAL',
          label: 'Agent Grand Final',
          p1Id: null,
          p1Name: 'Winner Semifinal A',
          p1CharId: 'shinobi',
          p2Id: null,
          p2Name: 'Winner Semifinal B',
          p2CharId: 'samurai',
          status: 'WAITING',
        },
      ],
      enrolledAgents: [],
    };
  }

  public getState() {
    const now = Date.now();
    return {
      humanCup: this.humanCup,
      agentCup: {
        ...this.agentCup,
        nextRoundInSeconds:
          this.agentCup.status === 'REST_COOLDOWN'
            ? this.agentCup.restSecondsRemaining
            : Math.max(0, Math.ceil((this.nextRoundAt - now) / 1000)),
      },
    };
  }

  public async ensureHumanCupOnChain(): Promise<HumanCupState> {
    if (this.humanCup.createTxHash) return this.humanCup;
    try {
      const res = await this.nearRelayer.callMethod('create_tournament', {
        tournament_id: this.humanCup.tournamentId,
        entry_fee_milli_near: this.humanCup.entryFeeShin,
        max_players: this.humanCup.maxPlayers,
      });
      if (res.ok && !res.simulated) {
        this.humanCup.createTxHash = res.txHash;
        this.humanCup.explorerUrl = res.explorerUrl;
      }
    } catch (err) {
      this.logger.warn(`Failed to create human cup on-chain: ${String(err)}`);
    }
    return this.humanCup;
  }

  public async joinHumanCup(params: {
    accountId: string;
    username: string;
    charId: string;
    joinTxHash: string;
  }): Promise<HumanCupState> {
    await this.ensureHumanCupOnChain();

    if (this.humanCup.status === 'SETTLED') {
      throw new Error('This Human Championship has already settled. Start the next cup!');
    }
    if (this.humanCup.entrants.some((e) => e.accountId === params.accountId)) {
      return this.humanCup;
    }
    if (this.humanCup.entrants.length >= this.humanCup.maxPlayers) {
      throw new Error(
        `Human Championship bracket is full (${this.humanCup.maxPlayers}/${this.humanCup.maxPlayers} players).`,
      );
    }

    const entrant: HumanEntrant = {
      accountId: params.accountId,
      username: params.username || params.accountId,
      charId: params.charId || 'fighter',
      joinTxHash: params.joinTxHash,
      joinedAt: Date.now(),
    };
    this.humanCup.entrants.push(entrant);
    this.humanCup.totalPoolShin = this.humanCup.entrants.length * this.humanCup.entryFeeShin;
    this.humanCup.winnerPayoutShin = Math.round(this.humanCup.totalPoolShin * 0.95);

    const idx = this.humanCup.entrants.length - 1;
    const matchIndex = Math.floor(idx / 2); // 0..3 -> QF_1..QF_4
    const targetMatch = this.humanCup.matches[matchIndex];
    if (idx % 2 === 0) {
      targetMatch.p1Id = entrant.accountId;
      targetMatch.p1Name = entrant.username;
      targetMatch.p1CharId = entrant.charId;
    } else {
      targetMatch.p2Id = entrant.accountId;
      targetMatch.p2Name = entrant.username;
      targetMatch.p2CharId = entrant.charId;
      targetMatch.status = 'READY';
    }

    if (this.humanCup.entrants.length >= this.humanCup.maxPlayers) {
      this.humanCup.status = 'IN_PROGRESS';
      if (this.ioServer) {
        this.ioServer.emit('tournament_started', this.humanCup);
      }
    }

    this.broadcastTournamentUpdate();
    return this.humanCup;
  }

  public setHumanMatchReady(params: {
    matchId: string;
    accountId: string;
    ready: boolean;
  }): HumanCupState {
    const match = this.humanCup.matches.find((m) => m.id === params.matchId);
    if (!match) {
      throw new Error('Tournament match not found.');
    }
    if (match.p1Id === params.accountId) {
      match.p1Ready = params.ready;
    } else if (match.p2Id === params.accountId) {
      match.p2Ready = params.ready;
    } else {
      throw new Error('You are not a participant in this match.');
    }
    this.broadcastTournamentUpdate();
    return this.humanCup;
  }

  public async reportHumanMatchResult(params: {
    matchId: string;
    winnerAccountId: string;
  }): Promise<HumanCupState> {
    const match = this.humanCup.matches.find((m) => m.id === params.matchId);
    if (!match) {
      throw new Error('Tournament match not found.');
    }
    if (match.status === 'COMPLETED') {
      return this.humanCup;
    }
    if (match.p1Id !== params.winnerAccountId && match.p2Id !== params.winnerAccountId) {
      throw new Error('Winner account is not a participant of this bracket match.');
    }

    const isP1 = match.p1Id === params.winnerAccountId;
    const winnerName = isP1 ? match.p1Name : match.p2Name;
    const winnerChar = isP1 ? match.p1CharId : match.p2CharId;
    const loserAccountId = isP1 ? match.p2Id : match.p1Id;

    match.winnerId = params.winnerAccountId;
    match.winnerName = winnerName;
    match.status = 'COMPLETED';

    const payoutIfFinal =
      match.round === 'GRAND_FINAL' ? this.humanCup.winnerPayoutShin : 0;
    void this.usersService.recordMatchOutcome(
      params.winnerAccountId,
      true,
      payoutIfFinal,
    );
    if (loserAccountId) {
      void this.usersService.recordMatchOutcome(loserAccountId, false, 0);
    }

    const semi1 = this.humanCup.matches[4];
    const semi2 = this.humanCup.matches[5];
    const finalMatch = this.humanCup.matches[6];

    if (match.round === 'QF_1') {
      semi1.p1Id = params.winnerAccountId;
      semi1.p1Name = winnerName;
      semi1.p1CharId = winnerChar;
    } else if (match.round === 'QF_2') {
      semi1.p2Id = params.winnerAccountId;
      semi1.p2Name = winnerName;
      semi1.p2CharId = winnerChar;
    } else if (match.round === 'QF_3') {
      semi2.p1Id = params.winnerAccountId;
      semi2.p1Name = winnerName;
      semi2.p1CharId = winnerChar;
    } else if (match.round === 'QF_4') {
      semi2.p2Id = params.winnerAccountId;
      semi2.p2Name = winnerName;
      semi2.p2CharId = winnerChar;
    } else if (match.round === 'SEMI_1') {
      finalMatch.p1Id = params.winnerAccountId;
      finalMatch.p1Name = winnerName;
      finalMatch.p1CharId = winnerChar;
    } else if (match.round === 'SEMI_2') {
      finalMatch.p2Id = params.winnerAccountId;
      finalMatch.p2Name = winnerName;
      finalMatch.p2CharId = winnerChar;
    }

    for (const nextM of [semi1, semi2, finalMatch]) {
      if (nextM.p1Id && nextM.p2Id && nextM.status === 'WAITING') {
        nextM.status = 'READY';
      }
    }

    if (match.round === 'GRAND_FINAL') {
      this.humanCup.status = 'SETTLED';
      this.humanCup.championId = params.winnerAccountId;
      this.humanCup.championName = winnerName;

      try {
        const settleRes = await this.nearRelayer.callMethod('settle_tournament', {
          tournament_id: this.humanCup.tournamentId,
          winner_token_ids: [params.winnerAccountId],
        });
        if (settleRes.ok && !settleRes.simulated) {
          this.humanCup.settleTxHash = settleRes.txHash;
          this.humanCup.explorerUrl = settleRes.explorerUrl;
        }
      } catch (err) {
        this.logger.warn(`Failed to settle human cup on-chain: ${String(err)}`);
      }
    }

    this.broadcastTournamentUpdate();
    return this.humanCup;
  }

  public async openNextHumanCup(): Promise<HumanCupState> {
    if (this.humanCup.status !== 'SETTLED') {
      return this.humanCup;
    }
    this.humanCup = this.buildFreshHumanCup(this.humanCup.cupNumber + 1);
    await this.ensureHumanCupOnChain();
    this.broadcastTournamentUpdate();
    return this.humanCup;
  }

  public setAgentEnrollment(tokenId: string, enrolled: boolean) {
    this.enrolledOverrides.set(tokenId, enrolled);
    this.agentCup.enrolledAgents = this.agentCup.enrolledAgents.map((a) =>
      a.tokenId === tokenId ? { ...a, enrolled } : a,
    );
    return this.getState();
  }

  private async fetchOnChainFighters(): Promise<OnChainFighter[]> {
    try {
      const fighters = (await this.nearRelayer.viewMethod('get_all_fighters', {})) as
        | OnChainFighter[]
        | null;
      if (Array.isArray(fighters)) {
        this.agentFightersMap.clear();
        for (const f of fighters) {
          this.agentFightersMap.set(f.token_id, f);
        }
        return fighters;
      }
    } catch (err) {
      this.logger.warn(`Failed to fetch on-chain fighters: ${String(err)}`);
    }
    return Array.from(this.agentFightersMap.values());
  }

  private async startNewAgentCup(cupNumber: number) {
    const prevChampId = this.agentCup?.lastChampionId;
    const prevChampName = this.agentCup?.lastChampionName;
    const prevChampWon = this.agentCup?.lastChampionWonShin;

    const allFighters = await this.fetchOnChainFighters();
    const enrolledList = allFighters.map((f) => ({
      tokenId: f.token_id,
      name: f.name,
      charClass: f.char_class,
      ownerId: f.owner_id,
      wins: f.wins,
      elo: f.elo,
      powerLevel: f.power_level,
      enrolled: this.enrolledOverrides.get(f.token_id) ?? true,
    }));

    const activeAgents = allFighters.filter(
      (f) => (this.enrolledOverrides.get(f.token_id) ?? true) === true,
    );

    // Pick 4 agents (rotate by cupNumber so different agents cycle in)
    const pool = activeAgents.length >= 4 ? activeAgents : allFighters;
    if (pool.length < 2) {
      this.agentCup = {
        ...this.buildPlaceholderAgentCup(cupNumber),
        lastChampionId: prevChampId,
        lastChampionName: prevChampName,
        lastChampionWonShin: prevChampWon,
        enrolledAgents: enrolledList,
      };
      this.nextRoundAt = Date.now() + this.ROUND_DURATION_MS;
      return;
    }

    const rotated = [...pool];
    const shift = (cupNumber - 1) % rotated.length;
    const ordered = [...rotated.slice(shift), ...rotated.slice(0, shift)];
    const f1 = ordered[0];
    const f2 = ordered[1 % ordered.length];
    const f3 = ordered[2 % ordered.length];
    const f4 = ordered[3 % ordered.length];

    const tournamentId = `agent-cup-${cupNumber}-${Date.now().toString(36)}`;
    let createTxHash: string | undefined;
    let explorerUrl: string | undefined;

    try {
      const createRes = await this.nearRelayer.callMethod('create_tournament', {
        tournament_id: tournamentId,
        entry_fee_milli_near: this.AGENT_ENTRY_SHIN,
        max_players: 4,
      });
      if (createRes.ok && !createRes.simulated) {
        createTxHash = createRes.txHash;
        explorerUrl = createRes.explorerUrl;
      }

      // Sponsor the 4 agent entries in $SHIN on-chain from the arena relayer
      const rawEntry = (
        BigInt(this.AGENT_ENTRY_SHIN) * BigInt('1000000000000000000')
      ).toString();
      for (const agent of [f1, f2, f3, f4]) {
        await this.nearRelayer.callMethod(
          'ft_transfer_call',
          {
            receiver_id: this.nearRelayer.contractId,
            amount: rawEntry,
            msg: `join_tournament:${tournamentId}:${agent.token_id}`,
          },
          '1yocto',
          '120000000000000',
          undefined,
          this.nearRelayer.shinTokenId,
        );
      }
    } catch (err) {
      this.logger.warn(`Agent cup on-chain setup warning: ${String(err)}`);
    }

    this.agentCup = {
      cupNumber,
      tournamentId,
      title: `Autonomous Agent Shadow Cup #${cupNumber}`,
      entryFeeShin: this.AGENT_ENTRY_SHIN,
      status: 'IN_PROGRESS',
      currentStage: 'SEMI_1',
      restSecondsRemaining: 0,
      nextRoundInSeconds: Math.ceil(this.ROUND_DURATION_MS / 1000),
      totalPoolShin: this.AGENT_ENTRY_SHIN * 4,
      winnerPayoutShin: Math.round(this.AGENT_ENTRY_SHIN * 4 * 0.95),
      createTxHash,
      explorerUrl,
      lastChampionId: prevChampId,
      lastChampionName: prevChampName,
      lastChampionWonShin: prevChampWon,
      enrolledAgents: enrolledList,
      matches: [
        {
          id: `agent-c${cupNumber}-semi-1`,
          round: 'SEMI_1',
          label: 'Agent Semifinal A',
          p1Id: f1.token_id,
          p1Name: f1.name,
          p1CharId: f1.char_class,
          p2Id: f2.token_id,
          p2Name: f2.name,
          p2CharId: f2.char_class,
          status: 'READY',
        },
        {
          id: `agent-c${cupNumber}-semi-2`,
          round: 'SEMI_2',
          label: 'Agent Semifinal B',
          p1Id: f3.token_id,
          p1Name: f3.name,
          p1CharId: f3.char_class,
          p2Id: f4.token_id,
          p2Name: f4.name,
          p2CharId: f4.char_class,
          status: 'READY',
        },
        {
          id: `agent-c${cupNumber}-final`,
          round: 'GRAND_FINAL',
          label: 'Agent Grand Final',
          p1Id: null,
          p1Name: 'Winner Semifinal A',
          p1CharId: f1.char_class,
          p2Id: null,
          p2Name: 'Winner Semifinal B',
          p2CharId: f3.char_class,
          status: 'WAITING',
        },
      ],
    };
    this.nextRoundAt = Date.now() + this.ROUND_DURATION_MS;
  }

  private pickAgentWinner(p1Id: string, p2Id: string): 'p1' | 'p2' {
    const f1 = this.agentFightersMap.get(p1Id);
    const f2 = this.agentFightersMap.get(p2Id);
    const s1 = f1
      ? f1.atk + f1.def + f1.spd + f1.power_level * 4 + f1.elo * 0.05
      : 200;
    const s2 = f2
      ? f2.atk + f2.def + f2.spd + f2.power_level * 4 + f2.elo * 0.05
      : 200;
    const probP1 = Math.min(0.8, Math.max(0.2, s1 / (s1 + s2)));
    return Math.random() < probP1 ? 'p1' : 'p2';
  }

  private async tickAgentCup() {
    if (this.isAdvancingAgentCup) return;
    if (this.agentCup.status === 'REST_COOLDOWN') {
      if (this.agentCup.restSecondsRemaining > 1) {
        this.agentCup.restSecondsRemaining -= 1;
        return;
      }
      this.isAdvancingAgentCup = true;
      try {
        this.agentCup.restSecondsRemaining = 0;
        await this.startNewAgentCup(this.agentCup.cupNumber + 1);
      } finally {
        this.isAdvancingAgentCup = false;
      }
      return;
    }

    if (Date.now() < this.nextRoundAt) return;
    const semi1 = this.agentCup.matches[0];
    const semi2 = this.agentCup.matches[1];
    const finalM = this.agentCup.matches[2];
    if (!semi1.p1Id || !semi1.p2Id) {
      // Retry fetching fighters if none were loaded yet
      this.isAdvancingAgentCup = true;
      try {
        await this.startNewAgentCup(this.agentCup.cupNumber);
      } finally {
        this.isAdvancingAgentCup = false;
      }
      return;
    }

    this.isAdvancingAgentCup = true;
    try {
      if (this.agentCup.currentStage === 'SEMI_1' && semi1.status !== 'COMPLETED') {
        const side = this.pickAgentWinner(semi1.p1Id, semi1.p2Id);
        semi1.winnerId = side === 'p1' ? semi1.p1Id : semi1.p2Id;
        semi1.winnerName = side === 'p1' ? semi1.p1Name : semi1.p2Name;
        semi1.status = 'COMPLETED';
        finalM.p1Id = semi1.winnerId;
        finalM.p1Name = semi1.winnerName;
        finalM.p1CharId = side === 'p1' ? semi1.p1CharId : semi1.p2CharId;
        this.agentCup.currentStage = 'SEMI_2';
        this.nextRoundAt = Date.now() + this.ROUND_DURATION_MS;
      } else if (this.agentCup.currentStage === 'SEMI_2' && semi2.status !== 'COMPLETED' && semi2.p1Id && semi2.p2Id) {
        const side = this.pickAgentWinner(semi2.p1Id, semi2.p2Id);
        semi2.winnerId = side === 'p1' ? semi2.p1Id : semi2.p2Id;
        semi2.winnerName = side === 'p1' ? semi2.p1Name : semi2.p2Name;
        semi2.status = 'COMPLETED';
        finalM.p2Id = semi2.winnerId;
        finalM.p2Name = semi2.winnerName;
        finalM.p2CharId = side === 'p1' ? semi2.p1CharId : semi2.p2CharId;
        finalM.status = 'READY';
        this.agentCup.currentStage = 'GRAND_FINAL';
        this.nextRoundAt = Date.now() + this.ROUND_DURATION_MS;
      } else if (this.agentCup.currentStage === 'GRAND_FINAL' && finalM.p1Id && finalM.p2Id) {
        const side = this.pickAgentWinner(finalM.p1Id, finalM.p2Id);
        finalM.winnerId = side === 'p1' ? finalM.p1Id : finalM.p2Id;
        finalM.winnerName = side === 'p1' ? finalM.p1Name : finalM.p2Name;
        finalM.status = 'COMPLETED';

        this.agentCup.lastChampionId = finalM.winnerId;
        this.agentCup.lastChampionName = finalM.winnerName;
        this.agentCup.lastChampionWonShin = this.agentCup.winnerPayoutShin;
        this.agentCup.status = 'REST_COOLDOWN';
        this.agentCup.currentStage = 'REST_COOLDOWN';
        this.agentCup.restSecondsRemaining = this.REST_DURATION_SEC;

        try {
          const settleRes = await this.nearRelayer.callMethod('settle_tournament', {
            tournament_id: this.agentCup.tournamentId,
            winner_token_ids: [finalM.winnerId],
          });
          if (settleRes.ok && !settleRes.simulated) {
            this.agentCup.settleTxHash = settleRes.txHash;
            this.agentCup.explorerUrl = settleRes.explorerUrl;
          }
        } catch (err) {
          this.logger.warn(`Failed to settle agent cup on-chain: ${String(err)}`);
        }
      }
    } finally {
      this.isAdvancingAgentCup = false;
    }
  }
}
