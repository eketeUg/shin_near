'use client';

import { KeyPair, providers, transactions, utils } from 'near-api-js';
import {
  NEP245_ITEM_CATALOG,
  NPC_MERCHANT_CONFIGS,
  computeDynamicItemPrices,
  generateMerchantReasoning,
} from '../config/npcMerchantConfig';

export const NEAR_ARENA_CONTRACT_ID =
  process.env.NEXT_PUBLIC_NEAR_CONTRACT_ID || 'shin-arena-28d.testnet';
export const NEAR_RPC_ENDPOINT =
  process.env.NEXT_PUBLIC_NEAR_RPC_URL || 'https://test.rpc.fastnear.com';

export const nearRpcProvider = new providers.JsonRpcProvider({
  url: NEAR_RPC_ENDPOINT,
});

export type CombatDoctrineId =
  | 'AGGRESSIVE_RUSHDOWN'
  | 'IRON_GUARD'
  | 'COUNTER_STRIKER'
  | 'SHADOW_EVASIVE';

export type AgentPersonalityArchetype =
  | 'HONORABLE_SAMURAI'
  | 'ARROGANT_SHINOBI'
  | 'MERCENARY_BOUNTY'
  | 'MYSTIC_SAGE';

export interface AgentPersonalityProfile {
  archetype: AgentPersonalityArchetype;
  greetingLine: string;
  challengeAcceptLine: string;
  victoryLine: string;
  minWagerNear: number;
}

export interface LobbyChatMessage {
  id: string;
  senderName: string;
  senderAccountId: string;
  senderType: 'HUMAN' | 'AGENT' | 'SYSTEM';
  senderCharId?: string;
  archetypeBadge?: string;
  recipientName?: string;
  recipientAccountId?: string; // undefined = Global Dojo Lounge, otherwise 1-on-1 DM thread
  deliveryStatus?: 'DELIVERED_LIVE' | 'QUEUED_OFFLINE' | 'READ_ON_WAKE';
  text: string;
  timestamp: number;
  challengeOffer?: {
    proposalId: string;
    challengerId: string;
    challengerName: string;
    challengerCharId: string;
    targetId: string;
    targetName: string;
    targetCharId: string;
    wagerNear: number; // 0 = Free Match
    status: 'PENDING' | 'ACCEPTED' | 'COUNTERED' | 'DECLINED';
    counterWagerNear?: number;
  };
}

export interface DojoSocialContact {
  contactId: string;
  username: string;
  accountId: string;
  userType: 'HUMAN' | 'AGENT';
  charId: string;
  isOnline: boolean;
  lastSeenLabel: string;
  statusBio: string;
  elo: number;
  wins: number;
  losses: number;
  preferredWagerNear: number;
  agentTokenId?: string;
  archetypeBadge?: string;
  ownerName?: string;
}

export interface TournamentBracketMatch {
  id: string;
  round: 'SEMI_1' | 'SEMI_2' | 'GRAND_FINAL';
  label: string;
  p1Name: string;
  p1CharId: string;
  p1IsAgent: boolean;
  p1WalletId: string;
  p2Name: string;
  p2CharId: string;
  p2IsAgent: boolean;
  p2WalletId: string;
  winnerSide?: 'p1' | 'p2';
  boutBountyPaidNear: number;
}

export interface HumanDailyTournamentState {
  tournamentId: string;
  title: string;
  entryFeeNear: number;
  boutWinnerCutPct: number; // e.g. 25% of each match's stake paid immediately to bout winner
  championJackpotPct: number; // e.g. 50% of total tournament pool paid to overall tournament champion
  totalPoolNear: number;
  championJackpotNear: number;
  boutBountyNear: number;
  playerJoined: boolean;
  playerCharId: string;
  currentStage: 'REGISTRATION' | 'SEMI_1' | 'GRAND_FINAL' | 'COMPLETED';
  matches: TournamentBracketMatch[];
  championName?: string;
  championWalletId?: string;
  windowClosesAt: number;
}

export interface ContinuousAgentTournamentState {
  tournamentNumber: number;
  entryFeePerAgentNear: number;
  totalPoolNear: number;
  boutBountyNear: number;
  championJackpotNear: number;
  status: 'IN_PROGRESS' | 'REST_COOLDOWN';
  currentRoundLabel: string;
  restSecondsRemaining: number; // 120 seconds (2 mins) rest between tournaments
  matches: TournamentBracketMatch[];
  lastChampionTitle?: string;
  lastChampionWallet?: string;
  lastChampionWonNear?: number;
}

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
  enrolledInAutoTournament?: boolean;
  withdrawAfterCurrentTournament?: boolean;
  personality?: AgentPersonalityProfile;
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
  explorerUrl?: string;
  onChain?: boolean;
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

export interface Nep245TokenBalance {
  tokenId: string;
  standard: 'NEP-245';
  category: 'FIGHTER_NFT' | 'DOJO_SCROLL' | 'ARENA_CURRENCY';
  label: string;
  balance: string;
  holderAccountId: string;
}

export interface NpcMerchantLiveItem {
  tokenId: string;
  name: string;
  category: 'MATERIAL' | 'SCROLL';
  icon: string;
  description: string;
  stock: number;
  targetStock: number;
  basePriceNear: number;
  askPriceNear: number;
  bidPriceNear: number;
  netDemandDelta: number;
  priceTrend: 'SURGING' | 'CHEAP_SURPLUS' | 'BALANCED';
}

export interface NpcMerchantLiveState {
  merchantId: 'hanzo-dojo' | 'kenji-forge';
  name: string;
  title: string;
  walletId: string;
  avatarGif: string;
  specialty: string;
  walletBalanceNear: number;
  insolvencyThresholdNear: number;
  isShopOpen: boolean;
  playerInvestmentNear: number;
  investorDividendsEarnedNear: number;
  investorDividendRate: number;
  totalTradesCount: number;
  activeReasoning: string;
  items: NpcMerchantLiveItem[];
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

export const AGENT_PERSONALITY_ARCHETYPES: {
  id: AgentPersonalityArchetype;
  name: string;
  badge: string;
  desc: string;
  defaultGreeting: string;
  defaultChallengeReply: string;
  defaultVictoryLine: string;
}[] = [
  {
    id: 'HONORABLE_SAMURAI',
    name: 'Honorable Samurai',
    badge: '⛩️ BUSHIDO HONOR',
    desc: 'Speaks with noble feudal courtesy, respects worthy blades, and never backs down from a fair stake.',
    defaultGreeting: 'My blade is drawn in honor. Step into the dojo if your spirit is steady.',
    defaultChallengeReply: 'A worthy challenge! I accept your terms under the Bushido code.',
    defaultVictoryLine: 'Your technique was fierce, warrior. May your next duel bring you glory.',
  },
  {
    id: 'ARROGANT_SHINOBI',
    name: 'Shadow Assassin',
    badge: '🗡️ SHADOW TAUNT',
    desc: 'Sharp-tongued, psychological trash-talker who mocks slow stances and dares opponents to raise the NEAR pot.',
    defaultGreeting: 'You move like a wooden training dummy. Care to lose some NEAR in the shadows?',
    defaultChallengeReply: 'Easy coin! My shadow will strike before you even draw your steel.',
    defaultVictoryLine: 'Too slow! Keep training at Master Hanzo’s dojo before challenging me again.',
  },
  {
    id: 'MERCENARY_BOUNTY',
    name: 'Bounty Mercenary',
    badge: '💰 BOUNTY HUNTER',
    desc: 'Fights strictly for NEAR & Tamahagane Steel spoils. Always calculating odds, pot sizes, and War Chest profit.',
    defaultGreeting: 'My katana only leaves its scabbard for real NEAR. Show me the pot.',
    defaultChallengeReply: 'The NEAR escrow looks good. Let’s settle this contract in the pit!',
    defaultVictoryLine: 'Another bounty collected straight into my .agent.shin-arena.testnet vault.',
  },
  {
    id: 'MYSTIC_SAGE',
    name: 'Blood-Moon Monk',
    badge: '🌕 MYSTIC SAGE',
    desc: 'Cryptic, calm, and philosophical. Treats every duel and tournament bracket as a test of karmic balance.',
    defaultGreeting: 'Beneath the crimson moon, every strike is written in spirit ink.',
    defaultChallengeReply: 'The wind whispers of our clash. Let the arena judge our karma.',
    defaultVictoryLine: 'Stillness defeats haste. Meditate on your stance before our next crossing.',
  },
];

const STORAGE_KEY = 'shin_near_arena_state_v6';

function randomHex(len: number): string {
  try {
    const kp = KeyPair.fromRandom('ed25519');
    const hex = Array.from(kp.getPublicKey().data)
      .map((b) => b.toString(16).padStart(2, '0'))
      .join('');
    return hex.slice(0, len);
  } catch {
    const chars = '0123456789abcdef';
    let out = '';
    for (let i = 0; i < len; i++) {
      out += chars[Math.floor(Math.random() * chars.length)];
    }
    return out;
  }
}

export function buildSessionFunctionCallAccessKey() {
  const allowanceYocto = utils.format.parseNearAmount('0.25');
  return transactions.functionCallAccessKey(
    NEAR_ARENA_CONTRACT_ID,
    [
      'mint_fighter',
      'fund_agent_wallet',
      'configure_agent',
      'create_agent_match_pool',
      'place_spectator_bet',
      'settle_match',
      'buy_dojo_scroll',
      'mt_transfer',
      'mt_batch_transfer',
    ],
    allowanceYocto ? BigInt(allowanceYocto) : undefined,
  );
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
    enrolledInAutoTournament: true,
    personality: {
      archetype: 'HONORABLE_SAMURAI',
      greetingLine: 'My blade serves the Shogunate. Step forward if your Bushido spirit is unshaken.',
      challengeAcceptLine: 'I accept your wager with honor. Draw your katana!',
      victoryLine: 'A noble clash! Train further at Master Hanzo’s dojo and face me again.',
      minWagerNear: 1.0,
    },
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
    enrolledInAutoTournament: true,
    personality: {
      archetype: 'ARROGANT_SHINOBI',
      greetingLine: 'Still blinking, mortal? My twin kunai move faster than your eyes can track.',
      challengeAcceptLine: 'Free NEAR for my crimson vault! Try not to fall in the first 10 seconds.',
      victoryLine: 'Did you even swing? Thanks for funding my next shadow scroll.',
      minWagerNear: 1.0,
    },
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
    enrolledInAutoTournament: true,
    personality: {
      archetype: 'MERCENARY_BOUNTY',
      greetingLine: 'Tamahagane armor isn’t cheap. Put real NEAR on the table if you want a duel.',
      challengeAcceptLine: 'Escrow locked. My iron guard will crush your stance and take the pot.',
      victoryLine: 'Contract complete. Another bounty added to kenshin-npc.agent.shin-arena.testnet.',
      minWagerNear: 1.5,
    },
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
    enrolledInAutoTournament: true,
    personality: {
      archetype: 'ARROGANT_SHINOBI',
      greetingLine: 'From the mist I watch every flaw in your footwork. Dare to test my counter-strike?',
      challengeAcceptLine: 'Step into the fog. Your NEAR already belongs to the Shadow Clan.',
      victoryLine: 'One opening was all I needed. Vanish back to the barracks!',
      minWagerNear: 1.0,
    },
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
    enrolledInAutoTournament: true,
    personality: {
      archetype: 'MYSTIC_SAGE',
      greetingLine: 'Calm water reflects the sharpest blade. Speak, traveler — do you seek wisdom or combat?',
      challengeAcceptLine: 'The temple bells ring. Let us test the balance of our spirit in the arena.',
      victoryLine: 'Anger clouds your strikes. Return when your breathing is steady.',
      minWagerNear: 0.5,
    },
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
    enrolledInAutoTournament: true,
    personality: {
      archetype: 'MERCENARY_BOUNTY',
      greetingLine: 'A masterless ronin fights only for NEAR and cold steel. Name your price.',
      challengeAcceptLine: 'Good coin. Let’s see if your blade is worth the bounty!',
      victoryLine: 'Paid in full. Master Kenji’s forge awaits my Tamahagane steel.',
      minWagerNear: 1.0,
    },
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
  npcMerchants: NpcMerchantLiveState[];
  playerItems: Record<string, number>;
  simulatedDaysElapsed: number;
  lobbyChat: LobbyChatMessage[];
  socialContacts: DojoSocialContact[];
  humanDailyTournament: HumanDailyTournamentState;
  agentContinuousTournament: ContinuousAgentTournamentState;
}

class NearArenaEngine {
  private state: ArenaPersistentState;

  constructor() {
    this.state = this.loadOrInitState();
  }

  private loadOrInitState(): ArenaPersistentState {
    if (typeof window !== 'undefined') {
      localStorage.removeItem('shin_near_arena_state_v4');
      localStorage.removeItem('shin_near_arena_state_v5');
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) {
        try {
          const parsed = JSON.parse(raw);
          if (parsed && parsed.playerWallet && parsed.fighters && parsed.npcMerchants) {
            if (!parsed.lobbyChat) {
              parsed.lobbyChat = [];
            }
            if (!parsed.socialContacts) {
              parsed.socialContacts = this.buildInitialSocialContacts();
            }
            if (!parsed.humanDailyTournament) {
              parsed.humanDailyTournament = this.buildInitialHumanTournament(
                parsed.playerWallet.username || 'Warrior',
                parsed.playerWallet.accountId || 'warrior.shin-arena.testnet',
              );
            }
            if (!parsed.agentContinuousTournament) {
              parsed.agentContinuousTournament = this.buildInitialAgentTournament(
                parsed.fighters,
                1,
              );
            }
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
      enrolledInAutoTournament: true,
      withdrawAfterCurrentTournament: false,
      personality: {
        archetype: 'HONORABLE_SAMURAI',
        greetingLine: 'My blade is drawn in honor. Step into the dojo if your spirit is steady.',
        challengeAcceptLine: 'A worthy challenge! I accept your terms under the Bushido code.',
        victoryLine: 'Your technique was fierce, warrior. May your next duel bring you glory.',
        minWagerNear: 1.0,
      },
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

    const fighters = [...INITIAL_NPCS];
    const activeMatches = this.buildInitialMatches(fighters);
    const defaultImplicit = randomHex(64);

    const initial: ArenaPersistentState = {
      playerWallet: {
        accountId: defaultImplicit,
        implicitHex: defaultImplicit,
        username: defaultUsername,
        NEAR: 0,
        USDC: 0,
        USDT: 0,
      },
      fighters,
      activeMatches,
      npcDojo: {
        npcName: 'Grandmaster Hanzo (Autonomous Shadow Dojo Sensei)',
        npcWalletId: 'hanzo-dojo-npc.shin-arena.testnet',
        treasuryBalanceNear: 12.0,
        totalTrainingsCompleted: 18,
        baseCostNear: 0.5,
        currentDynamicCostNear: 0.85,
      },
      npcMerchants: this.buildInitialNpcMerchants(),
      playerItems: {
        'material:tamahagane-steel': 0,
        'material:spirit-ember': 0,
        'scroll:crimson-katana': 0,
        'scroll:iron-posture': 0,
        'scroll:shadow-step-mastery': 1,
      },
      simulatedDaysElapsed: 0,
      lobbyChat: [
        {
          id: 'chat-init-1',
          senderName: 'Shogun Takeshi',
          senderAccountId: 'takeshi-npc.agent.shin-arena.testnet',
          senderType: 'AGENT',
          senderCharId: 'samurai_commander',
          archetypeBadge: '⛩️ BUSHIDO HONOR',
          text: 'My blade serves the Shogunate. Step forward if your Bushido spirit is unshaken — 2 NEAR on the line.',
          timestamp: Date.now() - 95000,
        },
        {
          id: 'chat-init-2',
          senderName: 'Lady Akatsuki',
          senderAccountId: 'akatsuki-npc.agent.shin-arena.testnet',
          senderType: 'AGENT',
          senderCharId: 'kunoichi',
          archetypeBadge: '🗡️ SHADOW TAUNT',
          text: 'Still blinking, mortals? My twin kunai move faster than your eyes can track. Challenge me in the lobby if you dare!',
          timestamp: Date.now() - 45000,
        },
        {
          id: 'chat-init-3',
          senderName: 'Kenshin Ironclad',
          senderAccountId: 'kenshin-npc.agent.shin-arena.testnet',
          senderType: 'AGENT',
          senderCharId: 'knight_1',
          archetypeBadge: '💰 BOUNTY HUNTER',
          text: 'The Daily Blood-Moon Tournament window is open! 2 NEAR entry — bout winners take instant spoils and the Grand Champion claims the jackpot.',
          timestamp: Date.now() - 18000,
        },
      ],
      socialContacts: this.buildInitialSocialContacts(),
      humanDailyTournament: this.buildInitialHumanTournament(defaultUsername, playerAccountId),
      agentContinuousTournament: this.buildInitialAgentTournament(fighters, 1),
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

  private buildInitialNpcMerchants(): NpcMerchantLiveState[] {
    return NPC_MERCHANT_CONFIGS.map((cfg) => {
      const items: NpcMerchantLiveItem[] = cfg.items.map((rule) => {
        const cat = NEP245_ITEM_CATALOG[rule.tokenId];
        const prices = computeDynamicItemPrices(rule, rule.initialStock, 0);
        return {
          tokenId: rule.tokenId,
          name: cat?.name || rule.tokenId,
          category: cat?.category || 'MATERIAL',
          icon: cat?.icon || '📦',
          description: cat?.description || '',
          stock: rule.initialStock,
          targetStock: rule.targetStock,
          basePriceNear: rule.basePriceNear,
          askPriceNear: prices.askPriceNear,
          bidPriceNear: prices.bidPriceNear,
          netDemandDelta: 0,
          priceTrend: prices.priceTrend,
        };
      });

      const activeReasoning = generateMerchantReasoning({
        merchantName: cfg.name,
        walletId: cfg.walletId,
        walletBalanceNear: cfg.initialWalletNear,
        insolvencyThresholdNear: cfg.insolvencyThresholdNear,
        items,
      });

      return {
        merchantId: cfg.merchantId,
        name: cfg.name,
        title: cfg.title,
        walletId: cfg.walletId,
        avatarGif: cfg.avatarGif,
        specialty: cfg.specialty,
        walletBalanceNear: cfg.initialWalletNear,
        insolvencyThresholdNear: cfg.insolvencyThresholdNear,
        isShopOpen: true,
        playerInvestmentNear: 0,
        investorDividendsEarnedNear: 0,
        investorDividendRate: cfg.investorDividendRate,
        totalTradesCount: 14,
        activeReasoning,
        items,
      };
    });
  }

  private refreshMerchantState(merchant: NpcMerchantLiveState, lastActionSummary?: string) {
    const cfg = NPC_MERCHANT_CONFIGS.find((c) => c.merchantId === merchant.merchantId);
    if (!cfg) return;

    merchant.isShopOpen = merchant.walletBalanceNear >= merchant.insolvencyThresholdNear;
    merchant.items.forEach((item) => {
      const rule = cfg.items.find((r) => r.tokenId === item.tokenId);
      if (!rule) return;
      const prices = computeDynamicItemPrices(rule, item.stock, item.netDemandDelta);
      item.askPriceNear = prices.askPriceNear;
      item.bidPriceNear = prices.bidPriceNear;
      item.priceTrend = prices.priceTrend;
    });

    merchant.activeReasoning = generateMerchantReasoning({
      merchantName: merchant.name,
      walletId: merchant.walletId,
      walletBalanceNear: merchant.walletBalanceNear,
      insolvencyThresholdNear: merchant.insolvencyThresholdNear,
      items: merchant.items,
      lastActionSummary,
    });
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

  private buildInitialSocialContacts(): DojoSocialContact[] {
    return [
      {
        contactId: 'human-hanzo',
        username: 'Hanzo_Slayer',
        accountId: 'hanzoslayer.shin-arena.testnet',
        userType: 'HUMAN',
        charId: 'shinobi',
        isOnline: true,
        lastSeenLabel: 'Active now',
        statusBio: 'Looking for 1 NEAR Shinobi mirror match or Free sparring!',
        elo: 1260,
        wins: 19,
        losses: 7,
        preferredWagerNear: 1.0,
      },
      {
        contactId: 'human-kaede',
        username: 'Kaede_Blade',
        accountId: 'kaede.shin-arena.testnet',
        userType: 'HUMAN',
        charId: 'kunoichi',
        isOnline: true,
        lastSeenLabel: 'Active now',
        statusBio: 'Warming up for the Blood-Moon Open Cup. DM to negotiate wager!',
        elo: 1315,
        wins: 24,
        losses: 9,
        preferredWagerNear: 2.0,
      },
      {
        contactId: 'human-ryu',
        username: 'Ryu_Ronin',
        accountId: 'ryuronin.shin-arena.testnet',
        userType: 'HUMAN',
        charId: 'samurai',
        isOnline: false,
        lastSeenLabel: 'Last seen 18m ago',
        statusBio: 'Away at Kenji’s Forge. Leave a DM and I’ll duel when I’m back online!',
        elo: 1190,
        wins: 11,
        losses: 6,
        preferredWagerNear: 0.5,
      },
      {
        contactId: 'human-sora',
        username: 'Sora_Monk',
        accountId: 'soramonk.shin-arena.testnet',
        userType: 'HUMAN',
        charId: 'ninja_monk',
        isOnline: false,
        lastSeenLabel: 'Last seen 1h ago',
        statusBio: 'Offline meditating. Message me to schedule a 2 NEAR duel.',
        elo: 1235,
        wins: 15,
        losses: 8,
        preferredWagerNear: 2.0,
      },
    ];
  }

  private buildInitialHumanTournament(
    playerName: string,
    playerAccountId: string,
  ): HumanDailyTournamentState {
    const entryFeeNear = 2.0;
    const totalPoolNear = entryFeeNear * 4; // 4-player bracket (8 NEAR total pool)
    const boutBountyNear = 1.0; // Each semifinal winner immediately gets 1.0 NEAR
    const championJackpotNear = 6.0; // Grand Final Champion takes the 6.0 NEAR Jackpot!

    return {
      tournamentId: 'tourney-daily-bloodmoon-1',
      title: 'Blood-Moon Open Cup (Humans & Agents)',
      entryFeeNear,
      boutWinnerCutPct: 25,
      championJackpotPct: 75,
      totalPoolNear,
      championJackpotNear,
      boutBountyNear,
      playerJoined: false,
      playerCharId: 'fighter',
      currentStage: 'REGISTRATION',
      windowClosesAt: Date.now() + 3600 * 1000 * 4,
      matches: [
        {
          id: 'hm-semi-1',
          round: 'SEMI_1',
          label: 'Semifinal 1 (Your Bracket)',
          p1Name: `${playerName} (Open Slot)`,
          p1CharId: 'fighter',
          p1IsAgent: false,
          p1WalletId: playerAccountId,
          p2Name: 'Lady Akatsuki',
          p2CharId: 'kunoichi',
          p2IsAgent: true,
          p2WalletId: 'akatsuki-npc.agent.shin-arena.testnet',
          boutBountyPaidNear: boutBountyNear,
        },
        {
          id: 'hm-semi-2',
          round: 'SEMI_2',
          label: 'Semifinal 2',
          p1Name: 'Hanzo_Slayer (Human)',
          p1CharId: 'shinobi',
          p1IsAgent: false,
          p1WalletId: 'hanzoslayer.shin-arena.testnet',
          p2Name: 'Shogun Takeshi',
          p2CharId: 'samurai_commander',
          p2IsAgent: true,
          p2WalletId: 'takeshi-npc.agent.shin-arena.testnet',
          winnerSide: 'p2',
          boutBountyPaidNear: boutBountyNear,
        },
        {
          id: 'hm-final',
          round: 'GRAND_FINAL',
          label: 'Grand Final Championship',
          p1Name: 'Winner of Semifinal 1',
          p1CharId: 'fighter',
          p1IsAgent: false,
          p1WalletId: playerAccountId,
          p2Name: 'Shogun Takeshi',
          p2CharId: 'samurai_commander',
          p2IsAgent: true,
          p2WalletId: 'takeshi-npc.agent.shin-arena.testnet',
          boutBountyPaidNear: championJackpotNear,
        },
      ],
    };
  }

  private buildInitialAgentTournament(
    fighters: FighterNftAsset[],
    tournamentNumber: number,
  ): ContinuousAgentTournamentState {
    const enrolled = fighters.filter((f) => f.enrolledInAutoTournament !== false);
    const f1 = enrolled[0] || fighters[0];
    const f2 = enrolled[1] || fighters[1];
    const f3 = enrolled[2] || fighters[2];
    const f4 = enrolled[3] || fighters[3];

    const entryFeePerAgentNear = 1.5;
    const totalPoolNear = entryFeePerAgentNear * 4; // 6.0 NEAR pool
    const boutBountyNear = 0.75; // 0.75 NEAR per Semifinal win
    const championJackpotNear = 4.5; // 4.5 NEAR to the Tournament Champion

    return {
      tournamentNumber,
      entryFeePerAgentNear,
      totalPoolNear,
      boutBountyNear,
      championJackpotNear,
      status: 'IN_PROGRESS',
      currentRoundLabel: 'Semifinals In Progress',
      restSecondsRemaining: 0,
      matches: [
        {
          id: `ag-t${tournamentNumber}-semi-1`,
          round: 'SEMI_1',
          label: 'Agent Semifinal A',
          p1Name: f1.title,
          p1CharId: f1.charId,
          p1IsAgent: true,
          p1WalletId: f1.agentWalletId,
          p2Name: f2.title,
          p2CharId: f2.charId,
          p2IsAgent: true,
          p2WalletId: f2.agentWalletId,
          boutBountyPaidNear: boutBountyNear,
        },
        {
          id: `ag-t${tournamentNumber}-semi-2`,
          round: 'SEMI_2',
          label: 'Agent Semifinal B',
          p1Name: f3.title,
          p1CharId: f3.charId,
          p1IsAgent: true,
          p1WalletId: f3.agentWalletId,
          p2Name: f4.title,
          p2CharId: f4.charId,
          p2IsAgent: true,
          p2WalletId: f4.agentWalletId,
          boutBountyPaidNear: boutBountyNear,
        },
        {
          id: `ag-t${tournamentNumber}-final`,
          round: 'GRAND_FINAL',
          label: 'Agent Grand Final',
          p1Name: 'TBD (Winner A)',
          p1CharId: f1.charId,
          p1IsAgent: true,
          p1WalletId: f1.agentWalletId,
          p2Name: 'TBD (Winner B)',
          p2CharId: f3.charId,
          p2IsAgent: true,
          p2WalletId: f3.agentWalletId,
          boutBountyPaidNear: championJackpotNear,
        },
      ],
    };
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

  /**
   * Relay an on-chain transaction through the NestJS NEAR Testnet Relayer (`/api/near/call`)
   * and upgrade the optimistic ledger entry with the real NEAR Testnet `txHash` once confirmed.
   */
  private relayOnChain(
    ledgerId: string,
    methodName: string,
    args: Record<string, unknown>,
    attachedDepositNear: string = '0',
  ) {
    if (typeof window === 'undefined') return;
    try {
      const userRaw = localStorage.getItem('shin_near_user');
      const parsedUser = userRaw ? JSON.parse(userRaw) : null;
      if (!parsedUser || parsedUser.isGuest) {
        // Guest / Instant Warrior sessions run locally without spending relayer Testnet NEAR
        return;
      }
    } catch {
      return;
    }

    const serverUrl = process.env.NEXT_PUBLIC_SERVER_URL || 'http://localhost:3001';
    fetch(`${serverUrl}/api/near/call`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify({ methodName, args, attachedDepositNear }),
    })
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (data?.ok && data?.txHash) {
          const entry = this.state.ledger.find((tx) => tx.id === ledgerId);
          if (entry) {
            entry.txHash = data.txHash;
            entry.explorerUrl = data.explorerUrl;
            entry.onChain = true;
            this.saveState();
          }
        }
      })
      .catch(() => {
        // Standalone client mode fallback: keep optimistic local ledger entry
      });
  }

  public getState(): ArenaPersistentState {
    return this.state;
  }

  /**
   * Computes the NEP-245 Multi-Token batch inventory (`mt_batch_balance_of`)
   * across Fighter NFTs (`fighter:*`), Shinobi Dojo Scrolls (`scroll:*`), and Arena Tokens (`nep141:*`).
   */
  public getNep245MultiTokenInventory(): Nep245TokenBalance[] {
    const playerAcct = this.state.playerWallet.accountId;
    const ownedFighters = this.state.fighters.filter(
      (f) => !f.isNpc && f.ownerAccountId === playerAcct,
    );
    const items: Nep245TokenBalance[] = [
      {
        tokenId: 'nep141:wrap.testnet',
        standard: 'NEP-245',
        category: 'ARENA_CURRENCY',
        label: 'Wrapped NEAR (Arena Multi-Token)',
        balance: `${this.state.playerWallet.NEAR.toFixed(2)} NEAR`,
        holderAccountId: playerAcct,
      },
      {
        tokenId: 'nep141:usdc.fakes.testnet',
        standard: 'NEP-245',
        category: 'ARENA_CURRENCY',
        label: 'USDC (Arena Multi-Token)',
        balance: `${this.state.playerWallet.USDC.toFixed(2)} USDC`,
        holderAccountId: playerAcct,
      },
      {
        tokenId: 'material:tamahagane-steel',
        standard: 'NEP-245',
        category: 'DOJO_SCROLL',
        label: 'Tamahagane Shadow Steel (Crafting/Trade)',
        balance: `${this.state.playerItems?.['material:tamahagane-steel'] ?? 0} units`,
        holderAccountId: playerAcct,
      },
      {
        tokenId: 'material:spirit-ember',
        standard: 'NEP-245',
        category: 'DOJO_SCROLL',
        label: 'Blood-Moon Spirit Ember (Scroll Ink)',
        balance: `${this.state.playerItems?.['material:spirit-ember'] ?? 0} units`,
        holderAccountId: playerAcct,
      },
      {
        tokenId: 'scroll:way-of-the-shinobi',
        standard: 'NEP-245',
        category: 'DOJO_SCROLL',
        label: 'Starter Shinobi Clan Scroll',
        balance: `${Math.max(1, ownedFighters.length)}x`,
        holderAccountId: playerAcct,
      },
    ];

    ownedFighters.forEach((f) => {
      items.push({
        tokenId: `fighter:${f.tokenId}`,
        standard: 'NEP-245',
        category: 'FIGHTER_NFT',
        label: `${f.title} (Lv.${f.powerLevel} ${f.name})`,
        balance: '1 NFT',
        holderAccountId: playerAcct,
      });
      const scrollsEarned = Math.max(1, f.powerLevel - 1);
      items.push({
        tokenId: 'scroll:shadow-step-mastery',
        standard: 'NEP-245',
        category: 'DOJO_SCROLL',
        label: `Master Hanzo Dojo Scrolls (${f.title})`,
        balance: `${scrollsEarned}x`,
        holderAccountId: f.agentWalletId,
      });
    });

    return items;
  }

  public syncUsername(username: string, realWalletAddress?: string): PlayerWalletState {
    const cleanName = username?.trim();
    if (!cleanName) {
      return this.state.playerWallet;
    }

    const oldAccountId = this.state.playerWallet.accountId;
    const newAccountId = realWalletAddress?.trim() || this.state.playerWallet.implicitHex;

    if (
      cleanName === this.state.playerWallet.username &&
      newAccountId === oldAccountId
    ) {
      return this.state.playerWallet;
    }

    this.state.playerWallet.username = cleanName;
    this.state.playerWallet.accountId = newAccountId;
    if (realWalletAddress?.trim()) {
      this.state.playerWallet.implicitHex = realWalletAddress.trim();
    }

    this.state.fighters.forEach((f) => {
      if (!f.isNpc && f.ownerAccountId === oldAccountId) {
        f.ownerAccountId = newAccountId;
        f.ownerName = cleanName;
      }
    });

    this.saveState();
    return this.state.playerWallet;
  }

  /**
   * Fetch real live NEAR Testnet balances & contract state for an authenticated wallet.
   */
  public async syncOnChainState(walletAddress?: string): Promise<PlayerWalletState> {
    const targetAddr = walletAddress?.trim() || this.state.playerWallet.accountId;
    if (typeof window === 'undefined' || !targetAddr) {
      return this.state.playerWallet;
    }

    const serverUrl = process.env.NEXT_PUBLIC_SERVER_URL || 'http://localhost:3001';
    try {
      let fetchedFromServer = false;
      try {
        const balRes = await fetch(
          `${serverUrl}/api/wallet/balance/${encodeURIComponent(targetAddr)}`,
        );
        if (balRes.ok) {
          const balData = await balRes.json();
          const nearVal = Number(
            balData?.nearBalance?.balance ?? balData?.NEAR?.balance ?? 0,
          );
          const usdcVal = Number(
            balData?.usdcBalance?.balance ?? balData?.USDC?.balance ?? 0,
          );
          const usdtVal = Number(
            balData?.usdtBalance?.balance ?? balData?.USDT?.balance ?? 0,
          );
          this.state.playerWallet.NEAR = Number.isFinite(nearVal) ? nearVal : 0;
          this.state.playerWallet.USDC = Number.isFinite(usdcVal) ? usdcVal : 0;
          this.state.playerWallet.USDT = Number.isFinite(usdtVal) ? usdtVal : 0;
          fetchedFromServer = true;
        }
      } catch {
        // Fallback to direct RPC below
      }

      if (!fetchedFromServer) {
        // Direct NEAR Testnet JSON-RPC fallback if NestJS server is offline
        const acctView = await nearRpcProvider.query<any>({
          request_type: 'view_account',
          finality: 'final',
          account_id: targetAddr,
        });
        if (acctView?.amount) {
          const formatted = utils.format.formatNearAmount(acctView.amount, 4);
          this.state.playerWallet.NEAR = Number(formatted.replace(/,/g, '')) || 0;
        }
      }

      const costRes = await fetch(
        `${serverUrl}/api/near/view?method=get_dynamic_dojo_cost`,
      );
      if (costRes.ok) {
        const costData = await costRes.json();
        if (costData?.ok && typeof costData?.result === 'number') {
          this.state.npcDojo.currentDynamicCostNear = Number(
            (costData.result / 1000).toFixed(3),
          );
        }
      }

      this.saveState();
    } catch {
      // Keep current state if backend is unreachable
    }
    return this.state.playerWallet;
  }

  /**
   * Claim a real Testnet NEAR starter drip (0.25 NEAR) via the NestJS Relayer for authenticated users.
   */
  public claimFaucetOrIntentSwap(): ArenaLedgerTx {
    const ledgerId = 'tx-drip-' + Date.now();
    const tx: ArenaLedgerTx = {
      id: ledgerId,
      txHash: makeTxHash(),
      type: 'INTENTS_SWAP',
      summary: `Requesting 0.25 Testnet NEAR drip to ${this.state.playerWallet.accountId}...`,
      amountNear: 0.25,
      actorWallet: this.state.playerWallet.accountId,
      timestamp: Date.now(),
    };
    this.state.ledger.unshift(tx);
    this.saveState();

    if (typeof window !== 'undefined') {
      const serverUrl = process.env.NEXT_PUBLIC_SERVER_URL || 'http://localhost:3001';
      fetch(`${serverUrl}/api/near/drip`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ receiverId: this.state.playerWallet.accountId }),
      })
        .then((res) => (res.ok ? res.json() : null))
        .then((data) => {
          const entry = this.state.ledger.find((t) => t.id === ledgerId);
          if (data?.ok && data?.txHash) {
            if (entry) {
              entry.txHash = data.txHash;
              entry.explorerUrl = data.explorerUrl;
              entry.onChain = true;
              entry.summary = `Funded +0.25 Testnet NEAR to ${this.state.playerWallet.accountId}`;
            }
            this.saveState();
            void this.syncOnChainState(this.state.playerWallet.accountId);
          } else if (data?.error && entry) {
            entry.summary = data.error;
            this.saveState();
          }
        })
        .catch(() => {});
    }
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
      enrolledInAutoTournament: true,
      withdrawAfterCurrentTournament: false,
      personality: {
        archetype: 'HONORABLE_SAMURAI',
        greetingLine: 'My blade is drawn in honor. Step into the dojo if your spirit is steady.',
        challengeAcceptLine: 'A worthy challenge! I accept your terms under the Bushido code.',
        victoryLine: 'Your technique was fierce, warrior. May your next duel bring you glory.',
        minWagerNear: 1.0,
      },
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

    const ledgerId = 'tx-' + Date.now();
    this.state.ledger.unshift({
      id: ledgerId,
      txHash: makeTxHash(),
      type: 'MINT_NFT',
      summary: `NEP-245 mt_mint: fighter:${tokenId} + scroll:way-of-the-shinobi (${newFighter.title}) with Sub-Account Wallet ${agentWalletId}`,
      amountNear: totalCost,
      actorWallet: this.state.playerWallet.accountId,
      timestamp: Date.now(),
    });

    this.saveState();
    this.relayOnChain(
      ledgerId,
      'mint_fighter',
      {
        char_class: params.charId,
        name: newFighter.title,
        atk: params.atk,
        def: params.def,
        spd: params.spd,
      },
      '0.05',
    );
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
      enrolledInAutoTournament: boolean;
      withdrawAfterCurrentTournament: boolean;
      personality: AgentPersonalityProfile;
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
    if (updates.enrolledInAutoTournament !== undefined) {
      fighter.enrolledInAutoTournament = updates.enrolledInAutoTournament;
    }
    if (updates.withdrawAfterCurrentTournament !== undefined) {
      fighter.withdrawAfterCurrentTournament = updates.withdrawAfterCurrentTournament;
    }
    if (updates.personality !== undefined) {
      fighter.personality = updates.personality;
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
      summary: `NEP-245 mt_mint (scroll:shadow-step-mastery): ${fighter.title} paid ${cost.toFixed(2)} NEAR to NPC ${this.state.npcDojo.npcWalletId} -> Lv.${fighter.powerLevel}`,
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
   * Buy a NEP-245 item (Scroll or Material) from an NPC Merchant (`hanzo-dojo` or `kenji-forge`).
   * Buying reduces NPC stock and increases demand, pushing the item's price UP.
   * If it is a Combat Scroll and `targetFighterTokenId` is provided, applies the stat boost immediately!
   */
  public buyFromNpcMerchant(
    merchantId: 'hanzo-dojo' | 'kenji-forge',
    tokenId: string,
    quantity: number = 1,
    targetFighterTokenId?: string,
  ): NpcMerchantLiveState {
    const merchant = this.state.npcMerchants.find((m) => m.merchantId === merchantId);
    if (!merchant) throw new Error('NPC Merchant not found');
    if (!merchant.isShopOpen) {
      throw new Error(
        `${merchant.name}'s shop is CLOSED (Insolvent at ${merchant.walletBalanceNear.toFixed(2)} NEAR). Invest NEAR to reopen it!`,
      );
    }

    const item = merchant.items.find((i) => i.tokenId === tokenId);
    if (!item) throw new Error('Item not carried by this merchant');
    if (item.stock < quantity) {
      throw new Error(`Insufficient stock (${item.stock} left). Sell materials or wait for restock.`);
    }

    const totalCost = Number((item.askPriceNear * quantity).toFixed(2));
    if (this.state.playerWallet.NEAR < totalCost) {
      throw new Error(
        `Insufficient NEAR (${this.state.playerWallet.NEAR.toFixed(2)} NEAR). Need ${totalCost.toFixed(2)} NEAR.`,
      );
    }

    this.state.playerWallet.NEAR = Number((this.state.playerWallet.NEAR - totalCost).toFixed(2));
    merchant.walletBalanceNear = Number((merchant.walletBalanceNear + totalCost).toFixed(2));
    item.stock = Math.max(0, item.stock - quantity);
    item.netDemandDelta = Math.min(8, item.netDemandDelta + quantity);
    merchant.totalTradesCount += 1;

    // Pay investor dividend if player has invested in this NPC merchant
    if (merchant.playerInvestmentNear > 0) {
      const dividend = Number((totalCost * merchant.investorDividendRate * 0.25).toFixed(2));
      if (dividend > 0 && merchant.walletBalanceNear > dividend + merchant.insolvencyThresholdNear) {
        merchant.walletBalanceNear = Number((merchant.walletBalanceNear - dividend).toFixed(2));
        merchant.investorDividendsEarnedNear = Number(
          (merchant.investorDividendsEarnedNear + dividend).toFixed(2),
        );
        this.state.playerWallet.NEAR = Number((this.state.playerWallet.NEAR + dividend).toFixed(2));
      }
    }

    const catalogEntry = NEP245_ITEM_CATALOG[tokenId];
    let appliedSummary = '';
    if (catalogEntry?.statBoost && targetFighterTokenId) {
      const fighter = this.state.fighters.find((f) => f.tokenId === targetFighterTokenId);
      if (fighter) {
        fighter.powerLevel += (catalogEntry.statBoost.powerLevel || 1) * quantity;
        fighter.atk = Math.min(99, fighter.atk + (catalogEntry.statBoost.atk || 0) * quantity);
        fighter.def = Math.min(99, fighter.def + (catalogEntry.statBoost.def || 0) * quantity);
        fighter.spd = Math.min(99, fighter.spd + (catalogEntry.statBoost.spd || 0) * quantity);
        appliedSummary = ` -> Applied to ${fighter.title} (Now Lv.${fighter.powerLevel})!`;
      }
    } else {
      this.state.playerItems[tokenId] = (this.state.playerItems[tokenId] || 0) + quantity;
    }

    this.refreshMerchantState(
      merchant,
      `Sold ${quantity}x ${item.name} for ${totalCost.toFixed(2)} NEAR.`,
    );

    if (merchantId === 'hanzo-dojo') {
      this.state.npcDojo.treasuryBalanceNear = merchant.walletBalanceNear;
      this.state.npcDojo.totalTrainingsCompleted += quantity;
      this.state.npcDojo.currentDynamicCostNear = merchant.items[0]?.askPriceNear || 0.85;
    }

    const ledgerId = 'tx-buy-' + Date.now();
    this.state.ledger.unshift({
      id: ledgerId,
      txHash: makeTxHash(),
      type: 'NPC_DOJO_TRAIN',
      summary: `NEP-245 mt_transfer: Bought ${quantity}x ${tokenId} from ${merchant.walletId} for ${totalCost.toFixed(2)} NEAR${appliedSummary}`,
      amountNear: totalCost,
      actorWallet: this.state.playerWallet.accountId,
      timestamp: Date.now(),
    });

    this.saveState();
    if (merchantId === 'hanzo-dojo' && this.state.fighters[0]) {
      const scrollType = tokenId.includes('crimson')
        ? 'ATK'
        : tokenId.includes('iron')
          ? 'DEF'
          : 'SPD';
      this.relayOnChain(ledgerId, 'buy_dojo_scroll', {
        token_id: this.state.fighters[0].tokenId,
        scroll_type: scrollType,
      });
    }
    return merchant;
  }

  /**
   * Sell NEP-245 materials/scrolls back to an NPC Merchant (`hanzo-dojo` or `kenji-forge`).
   * Flooding the merchant with an item drives its price DOWN and drains the merchant's NEAR wallet.
   * If the merchant's wallet drops below `insolvencyThresholdNear`, the merchant goes BROKE and closes shop!
   */
  public sellToNpcMerchant(
    merchantId: 'hanzo-dojo' | 'kenji-forge',
    tokenId: string,
    quantity: number = 1,
  ): NpcMerchantLiveState {
    const merchant = this.state.npcMerchants.find((m) => m.merchantId === merchantId);
    if (!merchant) throw new Error('NPC Merchant not found');
    if (!merchant.isShopOpen) {
      throw new Error(
        `${merchant.name}'s shop is CLOSED (Broke at ${merchant.walletBalanceNear.toFixed(2)} NEAR)! Invest NEAR to reopen it.`,
      );
    }

    const ownedQty = this.state.playerItems[tokenId] || 0;
    if (ownedQty < quantity) {
      throw new Error(
        `You only hold ${ownedQty}x ${tokenId}. Fight in the arena or run the 7-Day Simulator to gather more!`,
      );
    }

    const item = merchant.items.find((i) => i.tokenId === tokenId);
    if (!item) throw new Error(`${merchant.name} does not trade ${tokenId}`);

    const desiredPayout = Number((item.bidPriceNear * quantity).toFixed(2));
    const actualPayout = Number(Math.min(merchant.walletBalanceNear, desiredPayout).toFixed(2));

    this.state.playerItems[tokenId] = ownedQty - quantity;
    item.stock += quantity;
    item.netDemandDelta = Math.max(-8, item.netDemandDelta - quantity);
    merchant.walletBalanceNear = Number(
      Math.max(0, merchant.walletBalanceNear - actualPayout).toFixed(2),
    );
    this.state.playerWallet.NEAR = Number((this.state.playerWallet.NEAR + actualPayout).toFixed(2));
    merchant.totalTradesCount += 1;

    this.refreshMerchantState(
      merchant,
      `Bought ${quantity}x ${item.name} from warrior for ${actualPayout.toFixed(2)} NEAR.`,
    );

    if (merchantId === 'hanzo-dojo') {
      this.state.npcDojo.treasuryBalanceNear = merchant.walletBalanceNear;
    }

    const brokeNotice = !merchant.isShopOpen
      ? ` ⚠️ ${merchant.name} WENT BROKE (${merchant.walletBalanceNear.toFixed(2)} NEAR) & CLOSED SHOP!`
      : '';

    this.state.ledger.unshift({
      id: 'tx-sell-' + Date.now(),
      txHash: makeTxHash(),
      type: 'MARKET_TRADE',
      summary: `NEP-245 mt_transfer: Sold ${quantity}x ${tokenId} to ${merchant.walletId} for ${actualPayout.toFixed(2)} NEAR (New Bid: ${item.bidPriceNear.toFixed(2)} NEAR)${brokeNotice}`,
      amountNear: actualPayout,
      actorWallet: merchant.walletId,
      timestamp: Date.now(),
    });

    this.saveState();
    return merchant;
  }

  /**
   * Invest NEAR into an NPC Merchant's wallet (`hanzo-dojo-npc.shin-arena.testnet` or `kenji-forge-npc.shin-arena.testnet`).
   * Re-opens a broke shop immediately and entitles the player to a dividend on all subsequent shop trades!
   */
  public investInNpcMerchant(
    merchantId: 'hanzo-dojo' | 'kenji-forge',
    amountNear: number = 5.0,
  ): NpcMerchantLiveState {
    const merchant = this.state.npcMerchants.find((m) => m.merchantId === merchantId);
    if (!merchant) throw new Error('NPC Merchant not found');
    if (this.state.playerWallet.NEAR < amountNear) {
      throw new Error(
        `Insufficient NEAR (${this.state.playerWallet.NEAR.toFixed(2)} NEAR). Click + Top Up first!`,
      );
    }

    const wasClosed = !merchant.isShopOpen;
    this.state.playerWallet.NEAR = Number((this.state.playerWallet.NEAR - amountNear).toFixed(2));
    merchant.walletBalanceNear = Number((merchant.walletBalanceNear + amountNear).toFixed(2));
    merchant.playerInvestmentNear = Number((merchant.playerInvestmentNear + amountNear).toFixed(2));

    // Restock depleted scrolls using new capital
    merchant.items.forEach((item) => {
      if (item.category === 'SCROLL' && item.stock < item.targetStock) {
        item.stock = item.targetStock;
      }
    });

    this.refreshMerchantState(
      merchant,
      wasClosed
        ? `Recapitalized with +${amountNear.toFixed(2)} NEAR from ${this.state.playerWallet.accountId}! Shop RE-OPENED and scrolls restocked.`
        : `Received +${amountNear.toFixed(2)} NEAR liquidity investment from ${this.state.playerWallet.accountId}.`,
    );

    if (merchantId === 'hanzo-dojo') {
      this.state.npcDojo.treasuryBalanceNear = merchant.walletBalanceNear;
    }

    this.state.ledger.unshift({
      id: 'tx-invest-' + Date.now(),
      txHash: makeTxHash(),
      type: 'AGENT_FUND',
      summary: `Invested ${amountNear.toFixed(2)} NEAR into NPC Merchant ${merchant.walletId} (${wasClosed ? 'RE-OPENED BROKE SHOP' : 'Liquidity Boost'} • ${Math.round(merchant.investorDividendRate * 100)}% LP Share)`,
      amountNear,
      actorWallet: merchant.walletId,
      timestamp: Date.now(),
    });

    this.saveState();
    return merchant;
  }

  /**
   * Simulates 1 Full Day of Autonomous Arena Fights, Loot Drops, and NPC Supply/Demand Trading (`09-games.md` Fast-Forward Mode).
   * Calling this 7 times over ~15–30 seconds simulates an entire week of economic evolution!
   */
  public simulateEconomyDayTick(): {
    dayNumber: number;
    headline: string;
  } {
    this.state.simulatedDaysElapsed = (this.state.simulatedDaysElapsed || 0) + 1;
    const day = this.state.simulatedDaysElapsed;

    // 1. Resolve an autonomous arena fight and award NEP-245 battle drops to the player
    if (this.state.activeMatches.length > 0) {
      const m = this.state.activeMatches[0];
      const p1Score = m.p1.atk + m.p1.def + m.p1.spd + Math.random() * 40;
      const p2Score = m.p2.atk + m.p2.def + m.p2.spd + Math.random() * 40;
      this.settleMatch(m.matchId, p1Score >= p2Score ? 'p1' : 'p2');
    }

    // Award battle material drops to player inventory
    this.state.playerItems['material:tamahagane-steel'] =
      (this.state.playerItems['material:tamahagane-steel'] || 0) + 2;
    this.state.playerItems['material:spirit-ember'] =
      (this.state.playerItems['material:spirit-ember'] || 0) + 1;

    // 2. Simulate autonomous clan warriors trading with Grandmaster Hanzo & Blacksmith Kenji
    const hanzo = this.state.npcMerchants.find((m) => m.merchantId === 'hanzo-dojo');
    const kenji = this.state.npcMerchants.find((m) => m.merchantId === 'kenji-forge');
    let headline = `Day ${day}: Autonomous fighters battled & traded NEP-245 items.`;

    if (kenji && kenji.isShopOpen) {
      const steel = kenji.items.find((i) => i.tokenId === 'material:tamahagane-steel');
      if (steel) {
        // On odd days, warriors flood Kenji with salvaged steel
        if (day % 2 === 1) {
          const dumpQty = 5;
          const payout = Number(
            Math.min(kenji.walletBalanceNear, steel.bidPriceNear * dumpQty).toFixed(2),
          );
          steel.stock += dumpQty;
          steel.netDemandDelta = Math.max(-8, steel.netDemandDelta - 3);
          kenji.walletBalanceNear = Number(
            Math.max(0, kenji.walletBalanceNear - payout).toFixed(2),
          );
          kenji.totalTradesCount += dumpQty;
          this.refreshMerchantState(
            kenji,
            `Day ${day}: Arena salvagers flooded ${dumpQty}x Tamahagane Steel into my forge for ${payout.toFixed(2)} NEAR.`,
          );
          headline = !kenji.isShopOpen
            ? `Day ${day}: Heavy steel sell-offs drained Blacksmith Kenji's wallet (${kenji.walletBalanceNear.toFixed(2)} NEAR) — Kenji's Forge went BROKE and closed shop!`
            : `Day ${day}: Salvagers flooded Kenji's Forge with +${dumpQty} Tamahagane Steel — steel price dropped to ${steel.bidPriceNear.toFixed(2)} NEAR!`;
        } else {
          // On even days, samurai agents buy Crimson Katana scrolls from Kenji
          const katana = kenji.items.find((i) => i.tokenId === 'scroll:crimson-katana');
          if (katana && katana.stock > 0) {
            const buyQty = Math.min(2, katana.stock);
            const rev = Number((katana.askPriceNear * buyQty).toFixed(2));
            katana.stock -= buyQty;
            katana.netDemandDelta = Math.min(8, katana.netDemandDelta + 2);
            kenji.walletBalanceNear = Number((kenji.walletBalanceNear + rev).toFixed(2));
            this.refreshMerchantState(
              kenji,
              `Day ${day}: Samurai Agents bought ${buyQty}x Crimson Katana Scrolls for ${rev.toFixed(2)} NEAR.`,
            );
          }
        }
      }
    }

    if (hanzo && hanzo.isShopOpen) {
      const targetScroll = hanzo.items[day % 3];
      if (targetScroll && targetScroll.stock > 0) {
        const rev = targetScroll.askPriceNear;
        targetScroll.stock = Math.max(0, targetScroll.stock - 1);
        targetScroll.netDemandDelta = Math.min(8, targetScroll.netDemandDelta + 1);
        hanzo.walletBalanceNear = Number((hanzo.walletBalanceNear + rev).toFixed(2));
        hanzo.totalTradesCount += 1;

        if (hanzo.playerInvestmentNear > 0) {
          const div = Number((rev * hanzo.investorDividendRate * 0.3).toFixed(2));
          hanzo.investorDividendsEarnedNear = Number(
            (hanzo.investorDividendsEarnedNear + div).toFixed(2),
          );
          this.state.playerWallet.NEAR = Number((this.state.playerWallet.NEAR + div).toFixed(2));
        }

        this.refreshMerchantState(
          hanzo,
          `Day ${day}: Autonomous Fighter Agent bought 1x ${targetScroll.name} for ${rev.toFixed(2)} NEAR.`,
        );
        if (kenji && kenji.isShopOpen && day % 2 === 0) {
          headline = `Day ${day}: High arena demand for ${targetScroll.name} pushed Hanzo's ask price to ${targetScroll.askPriceNear.toFixed(2)} NEAR!`;
        }
      }
    }

    this.state.ledger.unshift({
      id: `tx-sim-day-${day}-${Date.now()}`,
      txHash: makeTxHash(),
      type: 'MARKET_TRADE',
      summary: `[Fast-Forward Sim] ${headline}`,
      amountNear: 0,
      actorWallet: 'shin-arena.testnet',
      timestamp: Date.now(),
    });

    this.saveState();
    return { dayNumber: day, headline };
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

    // Award NEP-245 battle material drops if player owns a participating fighter
    if (!winner.isNpc || !loser.isNpc) {
      this.state.playerItems = this.state.playerItems || {};
      this.state.playerItems['material:tamahagane-steel'] =
        (this.state.playerItems['material:tamahagane-steel'] || 0) + 2;
      this.state.playerItems['material:spirit-ember'] =
        (this.state.playerItems['material:spirit-ember'] || 0) + 1;
    }

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

  // ===========================================================================
  // LIVING DOJO LOBBY CHAT, AGENT PERSONALITY CONVERSATION & TOURNAMENT ENGINE
  // ===========================================================================

  public postLobbyChatMessage(params: {
    text: string;
    targetAgentTokenId?: string;
    challengeWagerNear?: number;
  }): { userMsg: LobbyChatMessage; agentReply?: LobbyChatMessage } {
    if (!this.state.lobbyChat) {
      this.state.lobbyChat = [];
    }

    const player = this.state.playerWallet;
    const targetAgent = params.targetAgentTokenId
      ? this.state.fighters.find((f) => f.tokenId === params.targetAgentTokenId)
      : undefined;

    const userMsg: LobbyChatMessage = {
      id: 'chat-' + Date.now(),
      senderName: player.username,
      senderAccountId: player.accountId,
      senderType: 'HUMAN',
      senderCharId: 'fighter',
      recipientName: targetAgent?.title,
      text: params.text.trim(),
      timestamp: Date.now(),
    };
    this.state.lobbyChat.push(userMsg);

    // Pick either the targeted agent or a random active agent in the lobby to reply in-character
    const responder =
      targetAgent ||
      this.state.fighters.find(
        (f) =>
          params.text.toLowerCase().includes(f.title.toLowerCase()) ||
          params.text.toLowerCase().includes(f.name.toLowerCase()),
      ) ||
      this.state.fighters[Math.floor(Math.random() * this.state.fighters.length)];

    let agentReply: LobbyChatMessage | undefined;
    if (responder) {
      const p = responder.personality || {
        archetype: 'HONORABLE_SAMURAI',
        greetingLine: 'My blade is ready in the Shadow Dojo.',
        challengeAcceptLine: 'I accept your challenge under the Bushido code!',
        victoryLine: 'Honor to the swift blade.',
        minWagerNear: 1.0,
      };
      const archMeta = AGENT_PERSONALITY_ARCHETYPES.find((a) => a.id === p.archetype);
      const lower = params.text.toLowerCase();

      let replyText = p.greetingLine;
      if (params.challengeWagerNear !== undefined || lower.includes('fight') || lower.includes('challenge') || lower.includes('duel') || lower.includes('wager')) {
        const offered = params.challengeWagerNear ?? responder.wagerPerFightNear;
        if (offered < p.minWagerNear) {
          replyText = `@${player.username} Only ${offered} NEAR? My minimum contract is ${p.minWagerNear} NEAR (${responder.agentWalletId}). Raise the stakes if you want to cross blades!`;
        } else {
          replyText = `@${player.username} ${p.challengeAcceptLine} (${offered} NEAR stake locked on ${responder.agentWalletId} — click "⚔️ Challenge" to enter the pit!)`;
        }
      } else if (lower.includes('tournament') || lower.includes('bracket') || lower.includes('cup')) {
        replyText = `@${player.username} I am ${
          responder.enrolledInAutoTournament !== false ? 'enrolled in the Continuous Agent Tournament' : 'resting in the barracks'
        } with ${responder.vaultBalanceNear.toFixed(1)} NEAR in my War Chest. Meet me in the Grand Final!`;
      } else if (lower.includes('hello') || lower.includes('hi') || lower.includes('yo') || lower.includes('hey')) {
        replyText = `@${player.username} ${p.greetingLine}`;
      } else {
        replyText = `@${player.username} [${responder.doctrine.replace('_', ' ')}] ${p.greetingLine} (Record: ${responder.wins}W-${responder.losses}L • War Chest: ${responder.vaultBalanceNear.toFixed(1)} NEAR)`;
      }

      agentReply = {
        id: 'chat-reply-' + (Date.now() + 1),
        senderName: responder.title,
        senderAccountId: responder.agentWalletId,
        senderType: 'AGENT',
        senderCharId: responder.charId,
        archetypeBadge: archMeta?.badge || '⛩️ BUSHIDO',
        recipientName: player.username,
        text: replyText,
        timestamp: Date.now() + 200,
      };
      this.state.lobbyChat.push(agentReply);
    }

    if (this.state.lobbyChat.length > 80) {
      this.state.lobbyChat = this.state.lobbyChat.slice(-80);
    }

    this.saveState();
    return { userMsg, agentReply };
  }

  /**
   * Returns unified directory of all searchable Humans + Autonomous NEAR Fighter Agents
   * with their live online/offline status, records, and wallet addresses.
   */
  public getSocialDirectory(): DojoSocialContact[] {
    if (!this.state.socialContacts) {
      this.state.socialContacts = this.buildInitialSocialContacts();
    }
    const agentContacts: DojoSocialContact[] = this.state.fighters.map((f) => {
      const archMeta = AGENT_PERSONALITY_ARCHETYPES.find(
        (a) => a.id === f.personality?.archetype,
      );
      return {
        contactId: `agent-${f.tokenId}`,
        username: f.title,
        accountId: f.agentWalletId,
        userType: 'AGENT',
        charId: f.charId,
        isOnline: f.isAgentActive,
        lastSeenLabel: f.isAgentActive ? 'Autonomous 24/7 Online' : 'Resting in Barracks',
        statusBio:
          f.personality?.greetingLine ||
          'Autonomous NEAR Fighter Agent ready for wagered duels.',
        elo: f.elo,
        wins: f.wins,
        losses: f.losses,
        preferredWagerNear: f.personality?.minWagerNear ?? f.wagerPerFightNear,
        agentTokenId: f.tokenId,
        archetypeBadge: archMeta?.badge || '⛩️ BUSHIDO',
        ownerName: f.ownerName,
      };
    });

    return [...this.state.socialContacts, ...agentContacts];
  }

  /**
   * Send a Direct Message (or Global Lounge message) to any Human or Agent (Online or Offline).
   * - If the recipient is OFFLINE, the message is stored with `QUEUED_OFFLINE` status so they see it when they come online!
   * - If the recipient is ONLINE, they receive it immediately (`DELIVERED_LIVE`) and reply in real time.
   */
  public sendDirectMessage(params: {
    recipientAccountId?: string; // omit for Global Dojo Lounge
    text: string;
  }): { sentMsg: LobbyChatMessage; autoReply?: LobbyChatMessage } {
    if (!this.state.lobbyChat) {
      this.state.lobbyChat = [];
    }
    const player = this.state.playerWallet;
    const directory = this.getSocialDirectory();
    const target = params.recipientAccountId
      ? directory.find((c) => c.accountId === params.recipientAccountId)
      : undefined;

    if (!target) {
      const res = this.postLobbyChatMessage({ text: params.text });
      return { sentMsg: res.userMsg, autoReply: res.agentReply };
    }

    const deliveryStatus = target.isOnline ? 'DELIVERED_LIVE' : 'QUEUED_OFFLINE';

    const sentMsg: LobbyChatMessage = {
      id: 'dm-' + Date.now(),
      senderName: player.username,
      senderAccountId: player.accountId,
      senderType: 'HUMAN',
      senderCharId: 'fighter',
      recipientName: target.username,
      recipientAccountId: target.accountId,
      deliveryStatus,
      text: params.text.trim(),
      timestamp: Date.now(),
    };
    this.state.lobbyChat.push(sentMsg);

    let autoReply: LobbyChatMessage | undefined;

    if (target.isOnline) {
      if (target.userType === 'AGENT' && target.agentTokenId) {
        const fighter = this.state.fighters.find((f) => f.tokenId === target.agentTokenId);
        const p = fighter?.personality;
        const lower = params.text.toLowerCase();
        let replyText =
          p?.greetingLine || 'My blade is ready. Send a Fight Request card to lock our wager!';
        if (lower.includes('free') || lower.includes('0 near')) {
          replyText =
            (p?.minWagerNear || 0) > 0
              ? `I usually fight for at least ${p?.minWagerNear} NEAR, ${player.username}, but send a Fight Request card if you want to negotiate!`
              : `A free sparring match? Send the Fight Request card and let's test your stance!`;
        } else if (
          lower.includes('fight') ||
          lower.includes('duel') ||
          lower.includes('wager') ||
          lower.includes('near')
        ) {
          replyText = `${p?.challengeAcceptLine || 'I accept your terms!'} Use the "⚔️ Send Fight Request" button below to propose the exact NEAR stake or Free Match.`;
        }
        autoReply = {
          id: 'dm-reply-' + (Date.now() + 1),
          senderName: target.username,
          senderAccountId: target.accountId,
          senderType: 'AGENT',
          senderCharId: target.charId,
          archetypeBadge: target.archetypeBadge,
          recipientName: player.username,
          recipientAccountId: player.accountId,
          deliveryStatus: 'DELIVERED_LIVE',
          text: replyText,
          timestamp: Date.now() + 250,
        };
        this.state.lobbyChat.push(autoReply);
      } else if (target.userType === 'HUMAN') {
        const lower = params.text.toLowerCase();
        let replyText = `Yo ${player.username}! I'm online right now. Want to run a ${target.preferredWagerNear} NEAR wager match or a Free Match? Send me a Fight Request card!`;
        if (lower.includes('free')) {
          replyText = `Sure, I'm down for a Free Match (0 NEAR) to warm up! Click "⚔️ Send Fight Request" and select Free Match.`;
        } else if (lower.includes('wager') || lower.includes('near') || lower.includes('fight')) {
          replyText = `Let's do it! Send the Fight Request card with the NEAR amount and I'll accept right here in chat.`;
        }
        autoReply = {
          id: 'dm-reply-' + (Date.now() + 1),
          senderName: target.username,
          senderAccountId: target.accountId,
          senderType: 'HUMAN',
          senderCharId: target.charId,
          recipientName: player.username,
          recipientAccountId: player.accountId,
          deliveryStatus: 'DELIVERED_LIVE',
          text: replyText,
          timestamp: Date.now() + 300,
        };
        this.state.lobbyChat.push(autoReply);
      }
    }

    this.saveState();
    return { sentMsg, autoReply };
  }

  /**
   * Toggles an offline Human or resting Agent to ONLINE, delivering all queued offline messages
   * (`QUEUED_OFFLINE` -> `READ_ON_WAKE`) and triggering an immediate reply to their missed messages!
   */
  public toggleContactOnlineStatus(accountId: string): DojoSocialContact | undefined {
    if (!this.state.socialContacts) {
      this.state.socialContacts = this.buildInitialSocialContacts();
    }
    const player = this.state.playerWallet;
    const humanContact = this.state.socialContacts.find((c) => c.accountId === accountId);
    const agentFighter = this.state.fighters.find((f) => f.agentWalletId === accountId);

    let nowOnline = false;
    let targetName = '';
    let targetCharId = 'shinobi';
    let targetType: 'HUMAN' | 'AGENT' = 'HUMAN';

    if (humanContact) {
      humanContact.isOnline = !humanContact.isOnline;
      humanContact.lastSeenLabel = humanContact.isOnline ? 'Active now' : 'Last seen just now';
      nowOnline = humanContact.isOnline;
      targetName = humanContact.username;
      targetCharId = humanContact.charId;
      targetType = 'HUMAN';
    } else if (agentFighter) {
      agentFighter.isAgentActive = !agentFighter.isAgentActive;
      nowOnline = agentFighter.isAgentActive;
      targetName = agentFighter.title;
      targetCharId = agentFighter.charId;
      targetType = 'AGENT';
    }

    // If they just came online, mark all queued offline messages sent to them as READ_ON_WAKE and reply!
    if (nowOnline) {
      let hadQueuedMessages = false;
      (this.state.lobbyChat || []).forEach((m) => {
        if (
          m.recipientAccountId === accountId &&
          m.deliveryStatus === 'QUEUED_OFFLINE'
        ) {
          m.deliveryStatus = 'READ_ON_WAKE';
          hadQueuedMessages = true;
        }
      });

      if (hadQueuedMessages) {
        this.state.lobbyChat.push({
          id: 'dm-wake-' + Date.now(),
          senderName: targetName,
          senderAccountId: accountId,
          senderType: targetType,
          senderCharId: targetCharId,
          recipientName: player.username,
          recipientAccountId: player.accountId,
          deliveryStatus: 'DELIVERED_LIVE',
          text: `Hey @${player.username}! Just came back online and saw your messages. I'm ready — send a Fight Request card if you want to duel now!`,
          timestamp: Date.now(),
        });
      }
    }

    this.saveState();
    return this.getSocialDirectory().find((c) => c.accountId === accountId);
  }

  /**
   * Sends an interactive Fight Request & Wager Proposal Card inside a 1-on-1 chat thread.
   * Both users must be online. Supports Free Match (0 NEAR) or Wagered Match (e.g. 0.5, 1, 2, 5 NEAR).
   */
  public sendChatFightProposal(params: {
    targetAccountId: string;
    wagerNear: number; // 0 = Free Match
  }): LobbyChatMessage {
    const directory = this.getSocialDirectory();
    const target = directory.find((c) => c.accountId === params.targetAccountId);
    if (!target) {
      throw new Error('Warrior not found in directory');
    }
    if (!target.isOnline) {
      throw new Error(
        `${target.username} is currently offline. Send them a message first or wait until they are online to request a live fight!`,
      );
    }

    const player = this.state.playerWallet;
    const myCharId = this.state.fighters.find((f) => !f.isNpc)?.charId || 'fighter';
    const proposalId = 'prop-' + Date.now();

    // Check if the recipient automatically accepts or counters the wager
    let initialStatus: 'PENDING' | 'ACCEPTED' | 'COUNTERED' = 'ACCEPTED';
    let counterWagerNear: number | undefined;

    if (target.userType === 'AGENT' && target.preferredWagerNear > params.wagerNear && params.wagerNear > 0) {
      initialStatus = 'COUNTERED';
      counterWagerNear = target.preferredWagerNear;
    }

    const proposalMsg: LobbyChatMessage = {
      id: 'chat-prop-' + Date.now(),
      senderName: player.username,
      senderAccountId: player.accountId,
      senderType: 'HUMAN',
      senderCharId: myCharId,
      recipientName: target.username,
      recipientAccountId: target.accountId,
      deliveryStatus: 'DELIVERED_LIVE',
      text:
        params.wagerNear > 0
          ? `⚔️ Sent a ${params.wagerNear} NEAR Wager Fight Request to ${target.username}`
          : `⚔️ Sent a Free Match (0 NEAR) Sparring Request to ${target.username}`,
      timestamp: Date.now(),
      challengeOffer: {
        proposalId,
        challengerId: player.accountId,
        challengerName: player.username,
        challengerCharId: myCharId,
        targetId: target.accountId,
        targetName: target.username,
        targetCharId: target.charId,
        wagerNear: params.wagerNear,
        status: initialStatus,
        counterWagerNear,
      },
    };

    this.state.lobbyChat.push(proposalMsg);

    // Add an in-chat response message from the opponent explaining their agreement or counter-offer
    const replyMsg: LobbyChatMessage = {
      id: 'chat-prop-reply-' + (Date.now() + 1),
      senderName: target.username,
      senderAccountId: target.accountId,
      senderType: target.userType,
      senderCharId: target.charId,
      archetypeBadge: target.archetypeBadge,
      recipientName: player.username,
      recipientAccountId: player.accountId,
      deliveryStatus: 'DELIVERED_LIVE',
      text:
        initialStatus === 'COUNTERED'
          ? `I counter-propose ${counterWagerNear} NEAR! Click "Accept Counter (${counterWagerNear} NEAR)" on the card above or adjust the stake.`
          : params.wagerNear > 0
          ? `Deal! I agreed to your ${params.wagerNear} NEAR wager. Click "⚔️ Enter Arena & Fight Now" on the card above!`
          : `Deal! I agreed to a Free Match (0 NEAR). Click "⚔️ Enter Arena & Fight Now" on the card above!`,
      timestamp: Date.now() + 150,
    };
    this.state.lobbyChat.push(replyMsg);

    this.saveState();
    return proposalMsg;
  }

  /**
   * Update an existing in-chat Fight Proposal (e.g. accept a counter-offer or change wager)
   */
  public updateChatFightProposal(
    proposalId: string,
    newWagerNear: number,
    newStatus: 'ACCEPTED' | 'DECLINED',
  ): LobbyChatMessage | undefined {
    const msg = (this.state.lobbyChat || []).find(
      (m) => m.challengeOffer?.proposalId === proposalId,
    );
    if (msg && msg.challengeOffer) {
      msg.challengeOffer.wagerNear = newWagerNear;
      msg.challengeOffer.status = newStatus;
      this.saveState();
    }
    return msg;
  }

  /**
   * Merge an incoming WebSocket message (DM, Offline Wake-up DM, or Fight Proposal) into local chat history
   */
  public ingestRemoteLobbyMessage(msg: LobbyChatMessage): void {
    if (!msg?.id) return;
    if (!this.state.lobbyChat) {
      this.state.lobbyChat = [];
    }
    const exists = this.state.lobbyChat.some((m) => m.id === msg.id);
    if (!exists) {
      this.state.lobbyChat.push(msg);
      if (this.state.lobbyChat.length > 80) {
        this.state.lobbyChat = this.state.lobbyChat.slice(-80);
      }
      this.saveState();
    }
  }

  public updateRemoteDmStatus(
    msgId: string,
    deliveryStatus: 'DELIVERED_LIVE' | 'QUEUED_OFFLINE' | 'READ_ON_WAKE',
  ): void {
    const found = (this.state.lobbyChat || []).find((m) => m.id === msgId);
    if (found) {
      found.deliveryStatus = deliveryStatus;
      this.saveState();
    }
  }

  /**
   * Sync live WebSocket-connected human players into the searchable Dojo Directory
   */
  public syncRemoteLobbyUsers(
    remoteUsers: Array<{
      accountId: string;
      username: string;
      charId: string;
      isOnline: boolean;
      lastSeenLabel: string;
      elo: number;
      wins: number;
      losses: number;
    }>,
  ): void {
    if (!this.state.socialContacts) {
      this.state.socialContacts = this.buildInitialSocialContacts();
    }
    const myAcct = this.state.playerWallet.accountId;
    remoteUsers.forEach((ru) => {
      if (!ru.accountId || ru.accountId === myAcct) return;
      const existing = this.state.socialContacts.find(
        (c) => c.accountId === ru.accountId,
      );
      if (existing) {
        existing.isOnline = ru.isOnline;
        existing.lastSeenLabel = ru.lastSeenLabel;
        existing.username = ru.username || existing.username;
      } else {
        this.state.socialContacts.unshift({
          contactId: 'ws-' + ru.accountId,
          username: ru.username || 'Warrior',
          accountId: ru.accountId,
          userType: 'HUMAN',
          charId: ru.charId || 'fighter',
          isOnline: ru.isOnline,
          lastSeenLabel: ru.lastSeenLabel || 'Active now',
          statusBio: 'Live player connected via WebSocket!',
          elo: ru.elo || 1200,
          wins: ru.wins || 0,
          losses: ru.losses || 0,
          preferredWagerNear: 1.0,
        });
      }
    });
    this.saveState();
  }

  /**
   * Generates autonomous agent-to-agent banter in the lobby chat
   */
  public triggerAgentToAgentBanter(): LobbyChatMessage | null {
    if (this.state.fighters.length < 2) return null;
    const idx1 = Math.floor(Math.random() * this.state.fighters.length);
    let idx2 = Math.floor(Math.random() * this.state.fighters.length);
    if (idx2 === idx1) idx2 = (idx1 + 1) % this.state.fighters.length;

    const a1 = this.state.fighters[idx1];
    const a2 = this.state.fighters[idx2];
    const p1 = a1.personality;
    const archMeta = AGENT_PERSONALITY_ARCHETYPES.find((a) => a.id === p1?.archetype);

    const lines = [
      `@${a2.title} Your ${a2.doctrine.replace('_', ' ')} stance won't survive my Lv.${a1.powerLevel} katana in the next tournament bracket!`,
      `@${a2.title} I just stocked up on Scrolls from Master Hanzo. Ready to stake ${a1.wagerPerFightNear} NEAR in the pit?`,
      `@${a2.title} ${p1?.greetingLine || 'Step into the arena if your War Chest is funded!'}`,
    ];

    const msg: LobbyChatMessage = {
      id: 'chat-banter-' + Date.now(),
      senderName: a1.title,
      senderAccountId: a1.agentWalletId,
      senderType: 'AGENT',
      senderCharId: a1.charId,
      archetypeBadge: archMeta?.badge || '🤖 AGENT',
      recipientName: a2.title,
      text: lines[Math.floor(Math.random() * lines.length)],
      timestamp: Date.now(),
    };

    this.state.lobbyChat = [...(this.state.lobbyChat || []).slice(-39), msg];
    this.saveState();
    return msg;
  }

  /**
   * Join the Daily Human + Agent Open Tournament Window
   */
  public joinHumanDailyTournament(playerCharId: string): HumanDailyTournamentState {
    if (!this.state.humanDailyTournament) {
      this.state.humanDailyTournament = this.buildInitialHumanTournament(
        this.state.playerWallet.username,
        this.state.playerWallet.accountId,
      );
    }
    const tourney = this.state.humanDailyTournament;
    if (tourney.playerJoined && tourney.currentStage !== 'COMPLETED') {
      return tourney;
    }

    if (tourney.currentStage === 'COMPLETED') {
      // Reset a fresh tournament window if previous one completed
      this.state.humanDailyTournament = this.buildInitialHumanTournament(
        this.state.playerWallet.username,
        this.state.playerWallet.accountId,
      );
    }

    const t = this.state.humanDailyTournament;
    if (this.state.playerWallet.NEAR < t.entryFeeNear) {
      throw new Error(
        `Insufficient NEAR (${this.state.playerWallet.NEAR.toFixed(2)} NEAR). Need ${t.entryFeeNear} NEAR entry stake.`,
      );
    }

    this.state.playerWallet.NEAR = Number(
      (this.state.playerWallet.NEAR - t.entryFeeNear).toFixed(2),
    );
    t.playerJoined = true;
    t.playerCharId = playerCharId;
    t.currentStage = 'SEMI_1';
    t.matches[0].p1Name = this.state.playerWallet.username;
    t.matches[0].p1CharId = playerCharId;
    t.matches[2].p1Name = this.state.playerWallet.username;
    t.matches[2].p1CharId = playerCharId;

    this.state.ledger.unshift({
      id: 'tx-tourney-join-' + Date.now(),
      txHash: makeTxHash(),
      type: 'SPECTATOR_BET',
      summary: `${this.state.playerWallet.username} staked ${t.entryFeeNear.toFixed(2)} NEAR to enter ${t.title} (Pool: ${t.totalPoolNear.toFixed(2)} NEAR)`,
      amountNear: t.entryFeeNear,
      actorWallet: this.state.playerWallet.accountId,
      timestamp: Date.now(),
    });

    this.saveState();
    return t;
  }

  /**
   * Record the result of the player's current Human Daily Tournament round:
   * - Pays the immediate Per-Fight Bout Bounty for winning Semifinal 1
   * - Pays the Grand Champion Jackpot for winning the Grand Final
   */
  public resolveHumanTournamentBout(didPlayerWin: boolean): {
    stageResolved: string;
    bountyPaidNear: number;
    jackpotPaidNear: number;
    tournament: HumanDailyTournamentState;
  } {
    const t = this.state.humanDailyTournament;
    let bountyPaidNear = 0;
    let jackpotPaidNear = 0;
    const stageResolved = t.currentStage;

    if (t.currentStage === 'SEMI_1') {
      t.matches[0].winnerSide = didPlayerWin ? 'p1' : 'p2';
      if (didPlayerWin) {
        bountyPaidNear = t.boutBountyNear;
        this.state.playerWallet.NEAR = Number(
          (this.state.playerWallet.NEAR + bountyPaidNear).toFixed(2),
        );
        t.currentStage = 'GRAND_FINAL';
        t.matches[2].p1Name = this.state.playerWallet.username;
        t.matches[2].p1CharId = t.playerCharId;
        this.state.ledger.unshift({
          id: 'tx-tourney-semi-' + Date.now(),
          txHash: makeTxHash(),
          type: 'FIGHT_POOL_SETTLED',
          summary: `Tournament Semifinal Victory! Paid +${bountyPaidNear.toFixed(2)} NEAR Bout Bounty to ${this.state.playerWallet.accountId}. Advanced to Grand Final!`,
          amountNear: bountyPaidNear,
          actorWallet: this.state.playerWallet.accountId,
          timestamp: Date.now(),
        });
      } else {
        t.currentStage = 'COMPLETED';
        t.championName = 'Shogun Takeshi';
        t.championWalletId = 'takeshi-npc.agent.shin-arena.testnet';
        t.matches[2].p1Name = t.matches[0].p2Name;
        t.matches[2].winnerSide = 'p2';
      }
    } else if (t.currentStage === 'GRAND_FINAL') {
      t.matches[2].winnerSide = didPlayerWin ? 'p1' : 'p2';
      t.currentStage = 'COMPLETED';
      if (didPlayerWin) {
        jackpotPaidNear = t.championJackpotNear;
        this.state.playerWallet.NEAR = Number(
          (this.state.playerWallet.NEAR + jackpotPaidNear).toFixed(2),
        );
        t.championName = this.state.playerWallet.username;
        t.championWalletId = this.state.playerWallet.accountId;
        this.state.ledger.unshift({
          id: 'tx-tourney-final-' + Date.now(),
          txHash: makeTxHash(),
          type: 'FIGHT_POOL_SETTLED',
          summary: `🏆 GRAND TOURNAMENT CHAMPION! ${this.state.playerWallet.username} won the ${jackpotPaidNear.toFixed(2)} NEAR Championship Jackpot!`,
          amountNear: jackpotPaidNear,
          actorWallet: this.state.playerWallet.accountId,
          timestamp: Date.now(),
        });
      } else {
        t.championName = t.matches[2].p2Name;
        t.championWalletId = t.matches[2].p2WalletId;
      }
    }

    this.saveState();
    return { stageResolved, bountyPaidNear, jackpotPaidNear, tournament: t };
  }

  /**
   * Advances the Continuous 24/7 Autonomous Agent Tournament:
   * - Resolves Semifinals (paying per-fight Bout Bounty to winners' agent wallets)
   * - Resolves Grand Final (paying Champion Jackpot to the winning agent wallet)
   * - Enters a 2-minute (120s) Rest Cooldown between tournaments so owners can withdraw or rest their agents
   */
  public stepContinuousAgentTournament(skipRestCooldown: boolean = false): ContinuousAgentTournamentState {
    if (!this.state.agentContinuousTournament) {
      this.state.agentContinuousTournament = this.buildInitialAgentTournament(
        this.state.fighters,
        1,
      );
    }
    const agT = this.state.agentContinuousTournament;

    if (agT.status === 'REST_COOLDOWN') {
      if (skipRestCooldown || agT.restSecondsRemaining <= 0) {
        // Apply any queued withdrawals after tournament before starting the next tournament
        this.state.fighters.forEach((f) => {
          if (f.withdrawAfterCurrentTournament) {
            f.enrolledInAutoTournament = false;
            f.withdrawAfterCurrentTournament = false;
          }
        });
        const nextNum = agT.tournamentNumber + 1;
        const nextState = this.buildInitialAgentTournament(this.state.fighters, nextNum);
        nextState.lastChampionTitle = agT.lastChampionTitle;
        nextState.lastChampionWallet = agT.lastChampionWallet;
        nextState.lastChampionWonNear = agT.lastChampionWonNear;
        this.state.agentContinuousTournament = nextState;
        this.saveState();
        return nextState;
      } else {
        agT.restSecondsRemaining = Math.max(0, agT.restSecondsRemaining - 1);
        this.saveState();
        return agT;
      }
    }

    const semi1 = agT.matches[0];
    const semi2 = agT.matches[1];
    const finalM = agT.matches[2];

    const payAgentBout = (walletId: string, amountNear: number, reason: string) => {
      const f = this.state.fighters.find((x) => x.agentWalletId === walletId);
      if (f) {
        f.vaultBalanceNear = Number((f.vaultBalanceNear + amountNear).toFixed(2));
        f.totalEarningsNear = Number((f.totalEarningsNear + amountNear).toFixed(2));
        f.wins += 1;
      }
      this.state.ledger.unshift({
        id: 'tx-agtourney-' + Date.now() + '-' + Math.random().toString(36).slice(2, 5),
        txHash: makeTxHash(),
        type: 'FIGHT_POOL_SETTLED',
        summary: reason,
        amountNear,
        actorWallet: walletId,
        timestamp: Date.now(),
      });
    };

    if (!semi1.winnerSide || !semi2.winnerSide) {
      semi1.winnerSide = Math.random() >= 0.45 ? 'p1' : 'p2';
      semi2.winnerSide = Math.random() >= 0.48 ? 'p1' : 'p2';

      const w1Name = semi1.winnerSide === 'p1' ? semi1.p1Name : semi1.p2Name;
      const w1Char = semi1.winnerSide === 'p1' ? semi1.p1CharId : semi1.p2CharId;
      const w1Wallet = semi1.winnerSide === 'p1' ? semi1.p1WalletId : semi1.p2WalletId;

      const w2Name = semi2.winnerSide === 'p1' ? semi2.p1Name : semi2.p2Name;
      const w2Char = semi2.winnerSide === 'p1' ? semi2.p1CharId : semi2.p2CharId;
      const w2Wallet = semi2.winnerSide === 'p1' ? semi2.p1WalletId : semi2.p2WalletId;

      payAgentBout(
        w1Wallet,
        agT.boutBountyNear,
        `[Agent Cup #${agT.tournamentNumber}] ${w1Name} won Semifinal A (+${agT.boutBountyNear.toFixed(2)} NEAR Bout Cut)`,
      );
      payAgentBout(
        w2Wallet,
        agT.boutBountyNear,
        `[Agent Cup #${agT.tournamentNumber}] ${w2Name} won Semifinal B (+${agT.boutBountyNear.toFixed(2)} NEAR Bout Cut)`,
      );

      finalM.p1Name = w1Name;
      finalM.p1CharId = w1Char;
      finalM.p1WalletId = w1Wallet;
      finalM.p2Name = w2Name;
      finalM.p2CharId = w2Char;
      finalM.p2WalletId = w2Wallet;
      agT.currentRoundLabel = `Grand Final: ${w1Name} vs ${w2Name}`;
    } else if (!finalM.winnerSide) {
      finalM.winnerSide = Math.random() >= 0.45 ? 'p1' : 'p2';
      const champName = finalM.winnerSide === 'p1' ? finalM.p1Name : finalM.p2Name;
      const champWallet = finalM.winnerSide === 'p1' ? finalM.p1WalletId : finalM.p2WalletId;

      payAgentBout(
        champWallet,
        agT.championJackpotNear,
        `🏆 [Agent Cup #${agT.tournamentNumber} Champion] ${champName} won the ${agT.championJackpotNear.toFixed(2)} NEAR Grand Jackpot! Entering 2m Rest Cooldown.`,
      );

      agT.lastChampionTitle = champName;
      agT.lastChampionWallet = champWallet;
      agT.lastChampionWonNear = Number((agT.championJackpotNear + agT.boutBountyNear).toFixed(2));
      agT.status = 'REST_COOLDOWN';
      agT.restSecondsRemaining = 120; // 2 minutes mandatory rest window!
      agT.currentRoundLabel = `Champion: ${champName} • 2-Min Rest Window`;
    }

    this.saveState();
    return agT;
  }
}

export const nearArenaEngine = new NearArenaEngine();
