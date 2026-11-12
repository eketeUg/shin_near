'use client';

export type CombatDoctrineId =
  | 'AGGRESSIVE_RUSHDOWN'
  | 'IRON_GUARD'
  | 'COUNTER_STRIKER'
  | 'SHADOW_EVASIVE';

export interface FighterNftAsset {
  tokenId: string;
  charId: string;
  name: string;
  title: string;
  ownerAccountId: string;
  ownerName: string;
  isNpc: boolean;
  agentWalletId: string;
  implicitHexAddress: string;
  vaultBalanceNear: number;
  wagerPerFightNear: number;
  isAgentActive: boolean;
  autoTrainAtDojo: boolean;
  doctrine: CombatDoctrineId;
  powerLevel: number;
  atk: number;
  def: number;
  spd: number;
  wins: number;
  losses: number;
  winStreak: number;
  elo: number;
  totalEarningsNear: number;
  marketPriceNear: number; // 0 = not listed
}

export interface SpectatorBetEntry {
  bettorAccountId: string;
  bettorName: string;
  predictedSide: 'p1' | 'p2';
  amountNear: number;
  timestamp: number;
}

export interface ActiveArenaMatch {
  matchId: string;
  p1: FighterNftAsset;
  p2: FighterNftAsset;
  fighterStakeNear: number;
  fighterPoolNear: number;
  spectatorPoolP1Near: number;
  spectatorPoolP2Near: number;
  spectatorBets: SpectatorBetEntry[];
  viewers: number;
  status: 'BETTING_OPEN' | 'IN_COMBAT' | 'SETTLED';
  createdAt: number;
  winnerSide?: 'p1' | 'p2';
  txHash: string;
}

export interface ArenaLedgerTx {
  id: string;
  txHash: string;
  type:
    | 'MINT_NFT'
    | 'AGENT_FUND'
    | 'AGENT_WITHDRAW'
    | 'FIGHT_POOL_SETTLED'
    | 'SPECTATOR_BET'
    | 'SPECTATOR_PAYOUT'
    | 'NPC_DOJO_TRAIN'
    | 'MARKET_TRADE'
    | 'INTENTS_SWAP';
  summary: string;
  amountNear: number;
  actorWallet: string;
  timestamp: number;
}

export interface NpcDojoState {
  npcName: string;
  npcWalletId: string;
  treasuryBalanceNear: number;
  totalTrainingsCompleted: number;
  baseCostNear: number;
  currentDynamicCostNear: number;
}

export interface PlayerWalletState {
  accountId: string;
  implicitHex: string;
  username: string;
  NEAR: number;
  USDC: number;
  USDT: number;
}

export const COMBAT_DOCTRINES: {
  id: CombatDoctrineId;
  name: string;
  badge: string;
  desc: string;
  aiProfile: {
    aggression: number;
    blockRate: number;
    retreatThreshold: number;
    chaseSpeedBonus: number;
  };
}[] = [
  {
    id: 'AGGRESSIVE_RUSHDOWN',
    name: 'Aggressive Rushdown',
    badge: '🔥 RUSHDOWN',
    desc: 'Relentless forward pressure and rapid 3-hit combos. High attack frequency, low guard.',
    aiProfile: { aggression: 0.88, blockRate: 0.15, retreatThreshold: 35, chaseSpeedBonus: 1.15 },
  },
  {
    id: 'IRON_GUARD',
    name: 'Iron Guard Fortress',
    badge: '🛡️ IRON GUARD',
    desc: 'Prioritizes shield blocks to absorb opponent combos, then punishes at close range.',
    aiProfile: { aggression: 0.52, blockRate: 0.72, retreatThreshold: 55, chaseSpeedBonus: 0.95 },
  },
  {
    id: 'COUNTER_STRIKER',
    name: 'Precision Counter',
    badge: '⚡ COUNTER',
    desc: 'Baits attacks at mid-range, blocks the opening swing, and retaliates with heavy crits.',
    aiProfile: { aggression: 0.68, blockRate: 0.5, retreatThreshold: 85, chaseSpeedBonus: 1.05 },
  },
  {
    id: 'SHADOW_EVASIVE',
    name: 'Shadow Skirmisher',
    badge: '💨 EVASIVE',
    desc: 'Uses high movement speed, jumps, and hit-and-run spacing to avoid taking damage.',
    aiProfile: { aggression: 0.64, blockRate: 0.35, retreatThreshold: 115, chaseSpeedBonus: 1.22 },
  },
];

const STORAGE_KEY = 'shin_near_arena_state_v3';

function randomHex(len: number): string {
  const chars = '0123456789abcdef';
  let out = '';
  for (let i = 0; i < len; i++) {
    out += chars[Math.floor(Math.random() * chars.length)];
  }
  return out;
}

function makeTxHash(): string {
  const b58 = '123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz';
  let out = '';
  for (let i = 0; i < 44; i++) {
    out += b58[Math.floor(Math.random() * b58.length)];
  }
  return out;
}

const INITIAL_NPCS: FighterNftAsset[] = [
  {
    tokenId: 'shin-samurai_commander-npc-1',
    charId: 'samurai_commander',
    name: 'Commander',
    title: 'Shogun Takeshi',
    ownerAccountId: 'arena-dao.shin-arena.testnet',
    ownerName: 'Shadow Clan Guild',
    isNpc: true,
    agentWalletId: 'takeshi-npc.agent.shin-arena.testnet',
    implicitHexAddress: 'a81f9c2e40b17d33e89c4f12a09b6c77d12e8f34a90b12c3d4e5f6a7b8c9d0e1',
    vaultBalanceNear: 48.5,
    wagerPerFightNear: 2.0,
    isAgentActive: true,
    autoTrainAtDojo: true,
    doctrine: 'AGGRESSIVE_RUSHDOWN',
    powerLevel: 6,
    atk: 84,
    def: 68,
    spd: 62,
    wins: 14,
    losses: 5,
    winStreak: 3,
    elo: 1290,
    totalEarningsNear: 34.0,
    marketPriceNear: 0,
  },
  {
    tokenId: 'shin-kunoichi-npc-2',
    charId: 'kunoichi',
    name: 'Kunoichi',
    title: 'Lady Akatsuki',
    ownerAccountId: 'arena-dao.shin-arena.testnet',
    ownerName: 'Shadow Clan Guild',
    isNpc: true,
    agentWalletId: 'akatsuki-npc.agent.shin-arena.testnet',
    implicitHexAddress: 'b92e8d1f51c28e44f90d5a23b10c7d88e23f9a45b01c23d4e5f6a7b8c9d0e1f2',
    vaultBalanceNear: 39.2,
    wagerPerFightNear: 2.0,
    isAgentActive: true,
    autoTrainAtDojo: true,
    doctrine: 'SHADOW_EVASIVE',
    powerLevel: 5,
    atk: 76,
    def: 58,
    spd: 89,
    wins: 11,
    losses: 4,
    winStreak: 2,
    elo: 1245,
    totalEarningsNear: 26.5,
    marketPriceNear: 0,
  },
  {
    tokenId: 'shin-knight_1-npc-3',
    charId: 'knight_1',
    name: 'Knight',
    title: 'Kenshin Ironclad',
    ownerAccountId: 'arena-dao.shin-arena.testnet',
    ownerName: 'Shadow Clan Guild',
    isNpc: true,
    agentWalletId: 'kenshin-npc.agent.shin-arena.testnet',
    implicitHexAddress: 'c73f7e2a62d39f55a01e6b34c21d8e99f34a0b56c12d34e5f6a7b8c9d0e1f2a3',
    vaultBalanceNear: 52.0,
    wagerPerFightNear: 3.0,
    isAgentActive: true,
    autoTrainAtDojo: true,
    doctrine: 'IRON_GUARD',
    powerLevel: 7,
    atk: 78,
    def: 92,
    spd: 54,
    wins: 16,
    losses: 6,
    winStreak: 4,
    elo: 1330,
    totalEarningsNear: 41.0,
    marketPriceNear: 0,
  },
  {
    tokenId: 'shin-shinobi-npc-4',
    charId: 'shinobi',
    name: 'Shinobi',
    title: 'Kage Shadowblade',
    ownerAccountId: 'arena-dao.shin-arena.testnet',
    ownerName: 'Shadow Clan Guild',
    isNpc: true,
    agentWalletId: 'kage-npc.agent.shin-arena.testnet',
    implicitHexAddress: 'd64a6f3b73e40a66b12f7c45d32e9f00a45b1c67d23e45f6a7b8c9d0e1f2a3b4',
    vaultBalanceNear: 31.5,
    wagerPerFightNear: 1.5,
    isAgentActive: true,
    autoTrainAtDojo: true,
    doctrine: 'COUNTER_STRIKER',
    powerLevel: 4,
    atk: 80,
    def: 62,
    spd: 85,
    wins: 9,
    losses: 5,
    winStreak: 1,
    elo: 1185,
    totalEarningsNear: 19.5,
    marketPriceNear: 0,
  },
  {
    tokenId: 'shin-ninja_monk-npc-5',
    charId: 'ninja_monk',
    name: 'Monk',
    title: 'Master Zenkai',
    ownerAccountId: 'arena-dao.shin-arena.testnet',
    ownerName: 'Shadow Clan Guild',
    isNpc: true,
    agentWalletId: 'zenkai-npc.agent.shin-arena.testnet',
    implicitHexAddress: 'e55b5a4c84f51b77c23a8d56e43f0a11b56c2d78e34f56a7b8c9d0e1f2a3b4c5',
    vaultBalanceNear: 28.0,
    wagerPerFightNear: 1.0,
    isAgentActive: true,
    autoTrainAtDojo: true,
    doctrine: 'COUNTER_STRIKER',
    powerLevel: 5,
    atk: 74,
    def: 76,
    spd: 79,
    wins: 10,
    losses: 6,
    winStreak: 0,
    elo: 1205,
    totalEarningsNear: 16.0,
    marketPriceNear: 12.5,
  },
  {
    tokenId: 'shin-samurai-npc-6',
    charId: 'samurai',
    name: 'Samurai V1',
    title: 'Ronin Jin',
    ownerAccountId: 'arena-dao.shin-arena.testnet',
    ownerName: 'Shadow Clan Guild',
    isNpc: true,
    agentWalletId: 'jin-npc.agent.shin-arena.testnet',
    implicitHexAddress: 'f46c4b5d95a62c88d34b9e67f54a1b22c67d3e89f45a67b8c9d0e1f2a3b4c5d6',
    vaultBalanceNear: 35.0,
    wagerPerFightNear: 2.0,
    isAgentActive: true,
    autoTrainAtDojo: false,
    doctrine: 'AGGRESSIVE_RUSHDOWN',
    powerLevel: 4,
    atk: 85,
    def: 64,
    spd: 72,
    wins: 8,
    losses: 4,
    winStreak: 2,
    elo: 1210,
    totalEarningsNear: 18.0,
    marketPriceNear: 14.0,
  },
];

export interface ArenaPersistentState {
  playerWallet: PlayerWalletState;
  fighters: FighterNftAsset[];
  activeMatches: ActiveArenaMatch[];
  ledger: ArenaLedgerTx[];
  npcDojo: NpcDojoState;
}

class NearArenaEngine {
  private state: ArenaPersistentState;

  constructor() {
    this.state = this.loadOrInitState();
  }

  private loadOrInitState(): ArenaPersistentState {
    if (typeof window !== 'undefined') {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) {
        try {
          const parsed = JSON.parse(raw);
          if (parsed && parsed.playerWallet && parsed.fighters) {
            return parsed;
          }
        } catch (e) {
          console.warn('Failed to parse cached arena state:', e);
        }
      }
    }

    const defaultUsername =
      (typeof window !== 'undefined' && localStorage.getItem('shin_username')) || 'Warrior';
    const cleanSlug = defaultUsername.toLowerCase().replace(/[^a-z0-9]/g, '') || 'warrior';
    const playerAccountId = `${cleanSlug}.shin-arena.testnet`;

    // Give the player 1 starter Fighter NFT with its own Agent Wallet right out of the box
    const starterFighter: FighterNftAsset = {
      tokenId: 'shin-fighter-101',
      charId: 'fighter',
      name: 'Fighter',
      title: `${defaultUsername}'s Champion`,
      ownerAccountId: playerAccountId,
      ownerName: defaultUsername,
      isNpc: false,
      agentWalletId: `fighter-101.${cleanSlug}.shin-arena.testnet`,
      implicitHexAddress: randomHex(64),
      vaultBalanceNear: 6.0,
      wagerPerFightNear: 1.0,
      isAgentActive: true,
      autoTrainAtDojo: true,
      doctrine: 'AGGRESSIVE_RUSHDOWN',
      powerLevel: 2,
      atk: 68,
      def: 60,
      spd: 65,
      wins: 3,
      losses: 1,
      winStreak: 2,
      elo: 1080,
      totalEarningsNear: 4.0,
      marketPriceNear: 0,
    };

    const fighters = [starterFighter, ...INITIAL_NPCS];
    const activeMatches = this.buildInitialMatches(fighters);

    const initial: ArenaPersistentState = {
      playerWallet: {
        accountId: playerAccountId,
        implicitHex: randomHex(64),
        username: defaultUsername,
        NEAR: 25.0,
        USDC: 100.0,
        USDT: 50.0,
      },
      fighters,
      activeMatches,
      npcDojo: {
        npcName: 'Grandmaster Hanzo (Autonomous Shadow Dojo Sensei)',
        npcWalletId: 'hanzo-dojo-npc.shin-arena.testnet',
        treasuryBalanceNear: 64.5,
        totalTrainingsCompleted: 18,
        baseCostNear: 0.5,
        currentDynamicCostNear: 0.95,
      },
      ledger: [
        {
          id: 'tx-init-1',
          txHash: makeTxHash(),
          type: 'MINT_NFT',
          summary: `Minted Dynamic Fighter NFT #shin-fighter-101 with Sub-Account Wallet (${starterFighter.agentWalletId})`,
          amountNear: 0,
          actorWallet: playerAccountId,
          timestamp: Date.now() - 120000,
        },
        {
          id: 'tx-init-2',
          txHash: makeTxHash(),
          type: 'AGENT_FUND',
          summary: `Funded Agent Wallet ${starterFighter.agentWalletId} with 6.00 NEAR (Wager/Fight: 1.00 NEAR)`,
          amountNear: 6.0,
          actorWallet: starterFighter.agentWalletId,
          timestamp: Date.now() - 80000,
        },
        {
          id: 'tx-init-3',
          txHash: makeTxHash(),
          type: 'FIGHT_POOL_SETTLED',
          summary: `Shogun Takeshi defeated Kage Shadowblade — won 4.00 NEAR Fighter Pool + 0.35 NEAR Spectator Royalty`,
          amountNear: 4.35,
          actorWallet: 'takeshi-npc.agent.shin-arena.testnet',
          timestamp: Date.now() - 35000,
        },
      ],
    };

    this.saveState(initial);
    return initial;
  }

  private buildInitialMatches(fighters: FighterNftAsset[]): ActiveArenaMatch[] {
    const f0 = fighters[0]; // Player's starter agent
    const f1 = fighters[1]; // Takeshi
    const f2 = fighters[2]; // Akatsuki
    const f3 = fighters[3]; // Kenshin
    const f4 = fighters[4]; // Kage

    return [
      {
        matchId: 'near_match_live_1',
        p1: f1,
        p2: f2,
        fighterStakeNear: 2.0,
        fighterPoolNear: 4.0,
        spectatorPoolP1Near: 5.5,
        spectatorPoolP2Near: 4.2,
        spectatorBets: [
          {
            bettorAccountId: 'renji.near',
            bettorName: 'renji.near',
            predictedSide: 'p1',
            amountNear: 3.5,
            timestamp: Date.now() - 40000,
          },
          {
            bettorAccountId: 'kaede.near',
            bettorName: 'kaede.near',
            predictedSide: 'p2',
            amountNear: 4.2,
            timestamp: Date.now() - 25000,
          },
        ],
        viewers: 19,
        status: 'BETTING_OPEN',
        createdAt: Date.now() - 30000,
        txHash: makeTxHash(),
      },
      {
        matchId: 'near_match_live_2',
        p1: f0,
        p2: f4,
        fighterStakeNear: f0.wagerPerFightNear,
        fighterPoolNear: f0.wagerPerFightNear * 2,
        spectatorPoolP1Near: 3.0,
        spectatorPoolP2Near: 2.5,
        spectatorBets: [
          {
            bettorAccountId: 'ryu-trader.near',
            bettorName: 'ryu-trader.near',
            predictedSide: 'p1',
            amountNear: 3.0,
            timestamp: Date.now() - 15000,
          },
        ],
        viewers: 12,
        status: 'BETTING_OPEN',
        createdAt: Date.now() - 15000,
        txHash: makeTxHash(),
      },
      {
        matchId: 'near_match_live_3',
        p1: f3,
        p2: fighters[6] || f2,
        fighterStakeNear: 3.0,
        fighterPoolNear: 6.0,
        spectatorPoolP1Near: 7.8,
        spectatorPoolP2Near: 5.1,
        spectatorBets: [],
        viewers: 27,
        status: 'BETTING_OPEN',
        createdAt: Date.now() - 10000,
        txHash: makeTxHash(),
      },
    ];
  }

  private saveState(stateToSave: ArenaPersistentState = this.state) {
    if (typeof window !== 'undefined') {
      try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(stateToSave));
        window.dispatchEvent(new CustomEvent('nearArenaStateUpdated', { detail: stateToSave }));
      } catch (e) {
        console.warn('Could not save arena state:', e);
      }
    }
  }

  public getState(): ArenaPersistentState {
    return this.state;
  }

  public syncUsername(username: string): PlayerWalletState {
    if (!username || username === this.state.playerWallet.username) {
      return this.state.playerWallet;
    }
    const cleanSlug = username.toLowerCase().replace(/[^a-z0-9]/g, '') || 'warrior';
    const oldAccountId = this.state.playerWallet.accountId;
    const newAccountId = `${cleanSlug}.shin-arena.testnet`;

    this.state.playerWallet.username = username;
    this.state.playerWallet.accountId = newAccountId;

    this.state.fighters.forEach((f) => {
      if (!f.isNpc && f.ownerAccountId === oldAccountId) {
        f.ownerAccountId = newAccountId;
        f.ownerName = username;
      }
    });

    this.saveState();
    return this.state.playerWallet;
  }

  /**
   * 1-Click Gasless Testnet Faucet / NEAR Intents Deposit (Zero Popups)
   */
  public claimFaucetOrIntentSwap(nearAmount: number = 15, usdcAmount: number = 50): ArenaLedgerTx {
    this.state.playerWallet.NEAR = Number((this.state.playerWallet.NEAR + nearAmount).toFixed(2));
    this.state.playerWallet.USDC = Number((this.state.playerWallet.USDC + usdcAmount).toFixed(2));

    const tx: ArenaLedgerTx = {
      id: 'tx-' + Date.now(),
      txHash: makeTxHash(),
      type: 'INTENTS_SWAP',
      summary: `NEAR Intents Cross-Chain Top-Up: +${nearAmount} NEAR & +${usdcAmount} USDC credited to ${this.state.playerWallet.accountId} (Gasless)`,
      amountNear: nearAmount,
      actorWallet: this.state.playerWallet.accountId,
      timestamp: Date.now(),
    };
    this.state.ledger.unshift(tx);
    this.saveState();
    return tx;
  }

  /**
   * Claim / Mint a Fighter NFT with its own Sub-Account Agent Wallet (Zero Popups)
   */
  public mintFighterNft(params: {
    charId: string;
    charName: string;
    customTitle?: string;
    initialVaultNear?: number;
    wagerPerFightNear?: number;
    doctrine?: CombatDoctrineId;
    atk: number;
    def: number;
    spd: number;
    mintCostNear: number;
  }): FighterNftAsset {
    const totalCost = params.mintCostNear + (params.initialVaultNear || 0);
    if (this.state.playerWallet.NEAR < totalCost) {
      throw new Error(
        `Insufficient NEAR balance (${this.state.playerWallet.NEAR.toFixed(2)} NEAR). Use the 1-Click Testnet Faucet to top up!`,
      );
    }

    this.state.playerWallet.NEAR = Number((this.state.playerWallet.NEAR - totalCost).toFixed(2));

    const nonce = 100 + this.state.fighters.length + 1;
    const tokenId = `shin-${params.charId}-${nonce}`;
    const cleanOwner =
      this.state.playerWallet.username.toLowerCase().replace(/[^a-z0-9]/g, '') || 'warrior';
    const agentWalletId = `${params.charId}-${nonce}.agent.${cleanOwner}.testnet`;

    const newFighter: FighterNftAsset = {
      tokenId,
      charId: params.charId,
      name: params.charName,
      title: params.customTitle?.trim() || `${this.state.playerWallet.username}'s ${params.charName}`,
      ownerAccountId: this.state.playerWallet.accountId,
      ownerName: this.state.playerWallet.username,
      isNpc: false,
      agentWalletId,
      implicitHexAddress: randomHex(64),
      vaultBalanceNear: params.initialVaultNear ?? 3.0,
      wagerPerFightNear: params.wagerPerFightNear ?? 1.0,
      isAgentActive: true,
      autoTrainAtDojo: true,
      doctrine: params.doctrine || 'AGGRESSIVE_RUSHDOWN',
      powerLevel: 1,
      atk: params.atk,
      def: params.def,
      spd: params.spd,
      wins: 0,
      losses: 0,
      winStreak: 0,
      elo: 1000,
      totalEarningsNear: 0,
      marketPriceNear: 0,
    };

    this.state.fighters.unshift(newFighter);

    this.state.ledger.unshift({
      id: 'tx-' + Date.now(),
      txHash: makeTxHash(),
      type: 'MINT_NFT',
      summary: `Minted Fighter NFT ${tokenId} (${newFighter.title}) with Sub-Account Agent Wallet ${agentWalletId}`,
      amountNear: totalCost,
      actorWallet: this.state.playerWallet.accountId,
      timestamp: Date.now(),
    });

    this.saveState();
    return newFighter;
  }

  /**
   * Fund a Fighter NFT's Agent Wallet from the Player's main wallet
   */
  public fundAgentWallet(tokenId: string, amountNear: number): FighterNftAsset {
    if (amountNear <= 0) throw new Error('Enter a valid NEAR amount');
    if (this.state.playerWallet.NEAR < amountNear) {
      throw new Error('Insufficient player wallet NEAR balance. Click Top-Up Faucet first.');
    }

    const fighter = this.state.fighters.find((f) => f.tokenId === tokenId);
    if (!fighter) throw new Error('Fighter NFT not found');

    this.state.playerWallet.NEAR = Number((this.state.playerWallet.NEAR - amountNear).toFixed(2));
    fighter.vaultBalanceNear = Number((fighter.vaultBalanceNear + amountNear).toFixed(2));

    this.state.ledger.unshift({
      id: 'tx-' + Date.now(),
      txHash: makeTxHash(),
      type: 'AGENT_FUND',
      summary: `Deposited ${amountNear.toFixed(2)} NEAR into Agent Wallet ${fighter.agentWalletId}`,
      amountNear,
      actorWallet: fighter.agentWalletId,
      timestamp: Date.now(),
    });

    this.saveState();
    return fighter;
  }

  /**
   * Withdraw funds from a Fighter NFT's Agent Wallet back to the Player's main wallet
   */
  public withdrawFromAgentWallet(tokenId: string, amountNear: number): FighterNftAsset {
    const fighter = this.state.fighters.find((f) => f.tokenId === tokenId);
    if (!fighter) throw new Error('Fighter NFT not found');
    if (fighter.vaultBalanceNear < amountNear || amountNear <= 0) {
      throw new Error('Insufficient Agent Wallet balance');
    }

    fighter.vaultBalanceNear = Number((fighter.vaultBalanceNear - amountNear).toFixed(2));
    this.state.playerWallet.NEAR = Number((this.state.playerWallet.NEAR + amountNear).toFixed(2));

    this.state.ledger.unshift({
      id: 'tx-' + Date.now(),
      txHash: makeTxHash(),
      type: 'AGENT_WITHDRAW',
      summary: `Withdrew ${amountNear.toFixed(2)} NEAR from Agent Wallet ${fighter.agentWalletId} to ${this.state.playerWallet.accountId}`,
      amountNear,
      actorWallet: fighter.agentWalletId,
      timestamp: Date.now(),
    });

    this.saveState();
    return fighter;
  }

  /**
   * Update an Agent's autonomous fighting configuration (Wager per fight, Doctrine, Auto-Fight, Auto-Train)
   */
  public updateAgentConfig(
    tokenId: string,
    updates: Partial<{
      wagerPerFightNear: number;
      isAgentActive: boolean;
      autoTrainAtDojo: boolean;
      doctrine: CombatDoctrineId;
      marketPriceNear: number;
    }>,
  ): FighterNftAsset {
    const fighter = this.state.fighters.find((f) => f.tokenId === tokenId);
    if (!fighter) throw new Error('Fighter NFT not found');

    if (updates.wagerPerFightNear !== undefined) {
      fighter.wagerPerFightNear = Math.max(0.2, updates.wagerPerFightNear);
    }
    if (updates.isAgentActive !== undefined) {
      fighter.isAgentActive = updates.isAgentActive;
    }
    if (updates.autoTrainAtDojo !== undefined) {
      fighter.autoTrainAtDojo = updates.autoTrainAtDojo;
    }
    if (updates.doctrine !== undefined) {
      fighter.doctrine = updates.doctrine;
    }
    if (updates.marketPriceNear !== undefined) {
      fighter.marketPriceNear = Math.max(0, updates.marketPriceNear);
    }

    this.saveState();
    return fighter;
  }

  /**
   * Train a Fighter NFT at Grandmaster Hanzo's Autonomous NPC Dojo (Dynamic Bonding-Curve Pricing)
   */
  public trainFighterAtNpcDojo(tokenId: string, payFromAgentVault: boolean = true): FighterNftAsset {
    const fighter = this.state.fighters.find((f) => f.tokenId === tokenId);
    if (!fighter) throw new Error('Fighter NFT not found');

    const cost = this.state.npcDojo.currentDynamicCostNear;
    if (payFromAgentVault) {
      if (fighter.vaultBalanceNear < cost) {
        throw new Error(
          `Agent Wallet (${fighter.vaultBalanceNear.toFixed(2)} NEAR) needs at least ${cost.toFixed(2)} NEAR to pay NPC Dojo`,
        );
      }
      fighter.vaultBalanceNear = Number((fighter.vaultBalanceNear - cost).toFixed(2));
    } else {
      if (this.state.playerWallet.NEAR < cost) {
        throw new Error(`Player Wallet needs ${cost.toFixed(2)} NEAR`);
      }
      this.state.playerWallet.NEAR = Number((this.state.playerWallet.NEAR - cost).toFixed(2));
    }

    // Pay the NPC's wallet and increase dynamic bonding curve cost!
    this.state.npcDojo.treasuryBalanceNear = Number(
      (this.state.npcDojo.treasuryBalanceNear + cost).toFixed(2),
    );
    this.state.npcDojo.totalTrainingsCompleted += 1;
    this.state.npcDojo.currentDynamicCostNear = Number(
      (
        this.state.npcDojo.baseCostNear +
        this.state.npcDojo.totalTrainingsCompleted * 0.05
      ).toFixed(2),
    );

    // Boost Fighter NFT stats permanently
    fighter.powerLevel += 1;
    fighter.atk = Math.min(99, fighter.atk + 3);
    fighter.def = Math.min(99, fighter.def + 3);
    fighter.spd = Math.min(99, fighter.spd + 2);

    this.state.ledger.unshift({
      id: 'tx-' + Date.now(),
      txHash: makeTxHash(),
      type: 'NPC_DOJO_TRAIN',
      summary: `${fighter.title} paid ${cost.toFixed(2)} NEAR to NPC ${this.state.npcDojo.npcWalletId} -> Upgraded to Power Lv.${fighter.powerLevel}! (Next Dojo price: ${this.state.npcDojo.currentDynamicCostNear.toFixed(2)} NEAR)`,
      amountNear: cost,
      actorWallet: fighter.agentWalletId,
      timestamp: Date.now(),
    });

    this.saveState();
    return fighter;
  }

  /**
   * Buy a Fighter NFT from the Player/NPC Market (Ownership + Embedded Agent Wallet transfers to buyer!)
   */
  public buyFighterFromMarket(tokenId: string): FighterNftAsset {
    const fighter = this.state.fighters.find((f) => f.tokenId === tokenId);
    if (!fighter || fighter.marketPriceNear <= 0) {
      throw new Error('Fighter is not listed for sale');
    }
    const price = fighter.marketPriceNear;
    if (this.state.playerWallet.NEAR < price) {
      throw new Error(
        `Insufficient NEAR (${this.state.playerWallet.NEAR.toFixed(2)} NEAR). Need ${price.toFixed(2)} NEAR.`,
      );
    }

    this.state.playerWallet.NEAR = Number((this.state.playerWallet.NEAR - price).toFixed(2));
    fighter.ownerAccountId = this.state.playerWallet.accountId;
    fighter.ownerName = this.state.playerWallet.username;
    fighter.isNpc = false;
    fighter.marketPriceNear = 0;

    this.state.ledger.unshift({
      id: 'tx-' + Date.now(),
      txHash: makeTxHash(),
      type: 'MARKET_TRADE',
      summary: `${this.state.playerWallet.accountId} acquired Fighter NFT ${fighter.title} (Lv.${fighter.powerLevel}) + its ${fighter.vaultBalanceNear.toFixed(2)} NEAR Agent Wallet for ${price.toFixed(2)} NEAR`,
      amountNear: price,
      actorWallet: this.state.playerWallet.accountId,
      timestamp: Date.now(),
    });

    this.saveState();
    return fighter;
  }

  /**
   * Place a 1-Click Spectator Pari-Mutuel Bet on an active match (Zero Popups)
   */
  public placeSpectatorBet(
    matchId: string,
    predictedSide: 'p1' | 'p2',
    amountNear: number,
  ): ActiveArenaMatch {
    if (amountNear <= 0) throw new Error('Bet amount must be greater than 0');
    if (this.state.playerWallet.NEAR < amountNear) {
      throw new Error('Insufficient NEAR balance. Use the 1-Click Faucet to top up!');
    }

    const match = this.state.activeMatches.find((m) => m.matchId === matchId);
    if (!match) throw new Error('Match not found');
    if (match.status === 'SETTLED') throw new Error('Match has already settled');

    this.state.playerWallet.NEAR = Number((this.state.playerWallet.NEAR - amountNear).toFixed(2));

    if (predictedSide === 'p1') {
      match.spectatorPoolP1Near = Number((match.spectatorPoolP1Near + amountNear).toFixed(2));
    } else {
      match.spectatorPoolP2Near = Number((match.spectatorPoolP2Near + amountNear).toFixed(2));
    }

    match.spectatorBets.push({
      bettorAccountId: this.state.playerWallet.accountId,
      bettorName: this.state.playerWallet.username,
      predictedSide,
      amountNear,
      timestamp: Date.now(),
    });

    const targetFighter = predictedSide === 'p1' ? match.p1 : match.p2;
    this.state.ledger.unshift({
      id: 'tx-' + Date.now(),
      txHash: makeTxHash(),
      type: 'SPECTATOR_BET',
      summary: `${this.state.playerWallet.accountId} bet ${amountNear.toFixed(2)} NEAR on ${targetFighter.title} in Match ${matchId}`,
      amountNear,
      actorWallet: this.state.playerWallet.accountId,
      timestamp: Date.now(),
    });

    this.saveState();
    return match;
  }

  /**
   * Create a brand new Agent-vs-Agent match featuring a chosen Fighter NFT
   */
  public createImmediateAgentMatch(fighter1TokenId?: string): ActiveArenaMatch {
    const eligible = this.state.fighters.filter(
      (f) => f.isAgentActive && f.vaultBalanceNear >= f.wagerPerFightNear,
    );
    const f1 =
      (fighter1TokenId && this.state.fighters.find((f) => f.tokenId === fighter1TokenId)) ||
      eligible[0] ||
      this.state.fighters[0];
    const opponents = this.state.fighters.filter((f) => f.tokenId !== f1.tokenId);
    const f2 = opponents[Math.floor(Math.random() * opponents.length)];

    const stake = Math.min(f1.wagerPerFightNear, f2.wagerPerFightNear, 5.0) || 1.0;

    const newMatch: ActiveArenaMatch = {
      matchId: 'near_match_' + Math.random().toString(36).substring(2, 8),
      p1: f1,
      p2: f2,
      fighterStakeNear: stake,
      fighterPoolNear: Number((stake * 2).toFixed(2)),
      spectatorPoolP1Near: Number((1.5 + Math.random() * 4).toFixed(2)),
      spectatorPoolP2Near: Number((1.5 + Math.random() * 4).toFixed(2)),
      spectatorBets: [],
      viewers: Math.floor(8 + Math.random() * 25),
      status: 'BETTING_OPEN',
      createdAt: Date.now(),
      txHash: makeTxHash(),
    };

    this.state.activeMatches.unshift(newMatch);
    if (this.state.activeMatches.length > 6) {
      this.state.activeMatches.pop();
    }
    this.saveState();
    return newMatch;
  }

  /**
   * Settle an Agent-vs-Agent or PvP Match on-chain:
   * - Deducts stake from loser's Agent Wallet and credits Fighter Pool + 5% Spectator Royalty to winner's Agent Wallet
   * - Pays out winning Spectators from the Pari-Mutuel Spectator Pool
   * - Evolves Fighter NFT Power Level, ELO, Win/Loss record
   * - Triggers autonomous NPC Dojo training if winner has autoTrainAtDojo enabled
   */
  public settleMatch(matchId: string, winnerSide: 'p1' | 'p2'): {
    match: ActiveArenaMatch;
    spectatorPayoutNear: number;
    fighterPotWonNear: number;
  } {
    let match = this.state.activeMatches.find((m) => m.matchId === matchId);
    if (!match) {
      match = this.state.activeMatches[0];
    }
    if (match.status === 'SETTLED') {
      return { match, spectatorPayoutNear: 0, fighterPotWonNear: match.fighterPoolNear };
    }

    match.status = 'SETTLED';
    match.winnerSide = winnerSide;

    const winnerRef = winnerSide === 'p1' ? match.p1 : match.p2;
    const loserRef = winnerSide === 'p1' ? match.p2 : match.p1;

    const winner =
      this.state.fighters.find((f) => f.tokenId === winnerRef.tokenId) || winnerRef;
    const loser =
      this.state.fighters.find((f) => f.tokenId === loserRef.tokenId) || loserRef;

    const stake = match.fighterStakeNear;
    const totalSpectatorPool = match.spectatorPoolP1Near + match.spectatorPoolP2Near;
    const fighterRoyalty = Number((totalSpectatorPool * 0.05).toFixed(2));
    const netProfitToWinnerVault = Number((stake + fighterRoyalty).toFixed(2));

    // Update Fighter Agent Wallets
    loser.vaultBalanceNear = Math.max(0, Number((loser.vaultBalanceNear - stake).toFixed(2)));
    winner.vaultBalanceNear = Number(
      (winner.vaultBalanceNear + netProfitToWinnerVault).toFixed(2),
    );
    winner.totalEarningsNear = Number(
      (winner.totalEarningsNear + netProfitToWinnerVault).toFixed(2),
    );

    // Replenish NPC liquidity if an NPC gets low so the arena economy never stalls
    if (loser.isNpc && loser.vaultBalanceNear < loser.wagerPerFightNear * 2) {
      loser.vaultBalanceNear = Number((loser.vaultBalanceNear + 15.0).toFixed(2));
    }

    // Update Dynamic NFT stats
    winner.wins += 1;
    winner.winStreak += 1;
    winner.powerLevel += 1;
    winner.elo += 24;
    winner.atk = Math.min(99, winner.atk + 1);

    loser.losses += 1;
    loser.winStreak = 0;
    loser.elo = Math.max(800, loser.elo - 18);

    // Check if the player won any Spectator Pari-Mutuel bets on this match!
    const winningSidePool =
      winnerSide === 'p1' ? match.spectatorPoolP1Near : match.spectatorPoolP2Near;
    const distributableSpectatorPool = totalSpectatorPool * 0.95; // 95% to winning bettors, 5% to winning Fighter NFT!
    let playerSpectatorPayout = 0;

    match.spectatorBets.forEach((bet) => {
      if (
        bet.predictedSide === winnerSide &&
        bet.bettorAccountId === this.state.playerWallet.accountId &&
        winningSidePool > 0
      ) {
        const share = (bet.amountNear / winningSidePool) * distributableSpectatorPool;
        playerSpectatorPayout += share;
      }
    });

    playerSpectatorPayout = Number(playerSpectatorPayout.toFixed(2));
    if (playerSpectatorPayout > 0) {
      this.state.playerWallet.NEAR = Number(
        (this.state.playerWallet.NEAR + playerSpectatorPayout).toFixed(2),
      );
      this.state.ledger.unshift({
        id: 'tx-spec-' + Date.now(),
        txHash: makeTxHash(),
        type: 'SPECTATOR_PAYOUT',
        summary: `Pari-Mutuel Spectator Win! Paid ${playerSpectatorPayout.toFixed(2)} NEAR to ${this.state.playerWallet.accountId} for backing ${winner.title}`,
        amountNear: playerSpectatorPayout,
        actorWallet: this.state.playerWallet.accountId,
        timestamp: Date.now(),
      });
    }

    this.state.ledger.unshift({
      id: 'tx-settle-' + Date.now(),
      txHash: makeTxHash(),
      type: 'FIGHT_POOL_SETTLED',
      summary: `${winner.title} (${winner.agentWalletId}) won ${match.fighterPoolNear.toFixed(2)} NEAR Fighter Pool + ${fighterRoyalty.toFixed(2)} NEAR Spectator Royalty vs ${loser.title}`,
      amountNear: match.fighterPoolNear + fighterRoyalty,
      actorWallet: winner.agentWalletId,
      timestamp: Date.now(),
    });

    // Autonomous Agent-to-NPC Dojo Commerce
    const dojoCost = this.state.npcDojo.currentDynamicCostNear;
    if (winner.autoTrainAtDojo && winner.vaultBalanceNear >= dojoCost * 4) {
      try {
        this.trainFighterAtNpcDojo(winner.tokenId, true);
      } catch {}
    }

    // Spawn a replacement match so the arena stays populated
    setTimeout(() => {
      this.state.activeMatches = this.state.activeMatches.filter((m) => m.matchId !== matchId);
      this.createImmediateAgentMatch();
    }, 500);

    this.saveState();
    return {
      match,
      spectatorPayoutNear: playerSpectatorPayout,
      fighterPotWonNear: match.fighterPoolNear + fighterRoyalty,
    };
  }
}

export const nearArenaEngine = new NearArenaEngine();
