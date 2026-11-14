'use client';

import React, { useCallback, useEffect, useRef, useState } from 'react';
import { io } from 'socket.io-client';
import { nearArenaEngine } from '../services/nearArenaEngine';
import {
  Trophy,
  Swords,
  Timer,
  Flame,
  CheckCircle2,
  Coins,
  Terminal,
  ExternalLink,
  Users,
  Bot,
  Loader2,
  Bell,
} from 'lucide-react';
import NearInspectorModal from './NearInspectorModal';

interface BracketMatch {
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

interface HumanCupState {
  cupNumber: number;
  tournamentId: string;
  title: string;
  entryFeeShin: number;
  maxPlayers: number;
  status: 'REGISTRATION' | 'IN_PROGRESS' | 'SETTLED';
  entrants: Array<{
    accountId: string;
    username: string;
    charId: string;
    joinTxHash: string;
    joinedAt: number;
  }>;
  matches: BracketMatch[];
  createTxHash?: string;
  settleTxHash?: string;
  explorerUrl?: string;
  championId?: string;
  championName?: string;
  totalPoolShin: number;
  winnerPayoutShin: number;
}

interface AgentCupState {
  cupNumber: number;
  tournamentId: string;
  title: string;
  entryFeeShin: number;
  status: 'IN_PROGRESS' | 'REST_COOLDOWN';
  currentStage: 'SEMI_1' | 'SEMI_2' | 'GRAND_FINAL' | 'REST_COOLDOWN';
  restSecondsRemaining: number;
  nextRoundInSeconds: number;
  matches: BracketMatch[];
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

interface TournamentsFlowProps {
  ownedCharacters?: string[];
  onStartTournamentDuel: (duelConfig: {
    matchId: string;
    roomCode?: string;
    p1AccountId: string;
    p2AccountId: string;
    p1Char: string;
    p2Char: string;
    p2Name: string;
    wagerShin: number;
    isTournamentBout: boolean;
  }) => void;
  onBack: () => void;
  onHome: () => void;
}

const CHAR_LABELS: Record<string, string> = {
  fighter: 'Kensei (Balanced)',
  shinobi: 'Hayabusa (Fast)',
  kunoichi: 'Akatsuki (Agile)',
  samurai: 'Takeshi (Heavy)',
  samurai_commander: 'Shogun Takeshi',
};

const TournamentsFlow: React.FC<TournamentsFlowProps> = ({
  ownedCharacters = ['fighter'],
  onStartTournamentDuel,
  onBack,
  onHome,
}) => {
  const [arenaState, setArenaState] = useState(() => nearArenaEngine.getState());
  const [activeTab, setActiveTab] = useState<'HUMAN' | 'AGENT'>('HUMAN');
  const [humanCup, setHumanCup] = useState<HumanCupState | null>(null);
  const [agentCup, setAgentCup] = useState<AgentCupState | null>(null);
  const availableChars = ownedCharacters.length > 0 ? ownedCharacters : ['fighter'];
  const [selectedChar, setSelectedChar] = useState(availableChars[0] || 'fighter');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [toast, setToast] = useState<string | null>(null);
  const [showInspectorModal, setShowInspectorModal] = useState(false);
  const launchedMatchIdsRef = useRef<Set<string>>(new Set());

  const showToast = (msg: string) => {
    setToast(msg);
    setTimeout(() => setToast(null), 4000);
  };

  const refreshLiveTournaments = useCallback(async () => {
    try {
      const data = await nearArenaEngine.fetchLiveTournamentsState();
      setHumanCup(data.humanCup);
      setAgentCup(data.agentCup);
    } catch {
      // Keep last known state if server is temporarily unreachable
    }
  }, []);

  useEffect(() => {
    const sync = () => setArenaState({ ...nearArenaEngine.getState() });
    window.addEventListener('nearArenaStateUpdated', sync);

    void refreshLiveTournaments();
    const poll = setInterval(() => {
      void refreshLiveTournaments();
    }, 3000);

    const serverUrl = process.env.NEXT_PUBLIC_SERVER_URL || 'http://localhost:3001';
    const socket = io(serverUrl, { reconnectionAttempts: 5 });
    socket.on('tournament_updated', (payload: { humanCup?: HumanCupState; agentCup?: AgentCupState }) => {
      if (payload?.humanCup) setHumanCup(payload.humanCup);
      if (payload?.agentCup) setAgentCup(payload.agentCup);
    });
    socket.on('tournament_started', (cup: HumanCupState) => {
      setHumanCup(cup);
      showToast(`🏆 ${cup.title} is FULL (8/8)! Bracket is LIVE — enter your Wait Room!`);
    });

    return () => {
      window.removeEventListener('nearArenaStateUpdated', sync);
      clearInterval(poll);
      socket.disconnect();
    };
  }, [refreshLiveTournaments]);

  const formatCooldown = (secs: number) => {
    const m = Math.floor(secs / 60);
    const s = secs % 60;
    return `${m}:${s < 10 ? '0' : ''}${s}`;
  };

  const walletShin = Math.round(arenaState.playerWallet.SHIN ?? 0).toLocaleString();
  const myAccountId = arenaState.playerWallet.accountId;

  const hasJoinedHumanCup = Boolean(
    humanCup?.entrants.some((e) => e.accountId === myAccountId),
  );
  const myActiveHumanMatch = humanCup?.matches.find(
    (m) =>
      m.status === 'READY' &&
      (m.p1Id === myAccountId || m.p2Id === myAccountId),
  );
  const myWaitingHumanMatch = humanCup?.matches.find(
    (m) =>
      m.status === 'WAITING' &&
      (m.p1Id === myAccountId || m.p2Id === myAccountId),
  );

  const myAgents =
    agentCup?.enrolledAgents.filter((a) => a.ownerId === myAccountId) || [];

  // Auto-launch PvP Arena for BOTH players simultaneously once both Ready Up in the Wait Room
  useEffect(() => {
    if (!humanCup || !myActiveHumanMatch) return;
    if (
      myActiveHumanMatch.p1Ready &&
      myActiveHumanMatch.p2Ready &&
      !launchedMatchIdsRef.current.has(myActiveHumanMatch.id)
    ) {
      launchedMatchIdsRef.current.add(myActiveHumanMatch.id);
      const amP1 = myActiveHumanMatch.p1Id === myAccountId;
      onStartTournamentDuel({
        matchId: myActiveHumanMatch.id,
        roomCode: myActiveHumanMatch.roomCode,
        p1AccountId: myAccountId,
        p2AccountId:
          (amP1 ? myActiveHumanMatch.p2Id : myActiveHumanMatch.p1Id) || '',
        p1Char: amP1
          ? myActiveHumanMatch.p1CharId
          : myActiveHumanMatch.p2CharId,
        p2Char: amP1
          ? myActiveHumanMatch.p2CharId
          : myActiveHumanMatch.p1CharId,
        p2Name: amP1 ? myActiveHumanMatch.p2Name : myActiveHumanMatch.p1Name,
        wagerShin: humanCup.entryFeeShin,
        isTournamentBout: true,
      });
    }
  }, [humanCup, myActiveHumanMatch, myAccountId, onStartTournamentDuel]);

  return (
    <div className="min-h-screen w-full bg-black text-white flex flex-col overflow-y-auto">
      {toast && (
        <div className="fixed top-16 left-1/2 -translate-x-1/2 z-[100] bg-shin-gold text-black font-cinzel font-black text-xs px-5 py-2.5 rounded-full shadow-[0_0_25px_rgba(251,191,36,0.9)] flex items-center gap-2">
          <CheckCircle2 size={15} /> {toast}
        </div>
      )}

      {/* Header */}
      <div className="sticky top-0 z-30 bg-black/90 backdrop-blur-md border-b border-shin-gold/30 px-4 sm:px-6 py-4 flex items-center justify-between">
        <div className="flex items-center gap-3 sm:gap-4">
          <button
            onClick={onBack}
            className="text-gray-400 hover:text-white uppercase tracking-widest text-xs font-cinzel font-bold px-2.5 py-1.5 border border-white/10 rounded-lg cursor-pointer"
          >
            ← Back
          </button>
          <div>
            <h1 className="text-base sm:text-xl md:text-2xl font-cinzel font-black text-shin-gold uppercase tracking-wider flex items-center gap-2">
              <Trophy size={18} /> SHINOBI GRAND TOURNAMENTS
            </h1>
            <p className="text-[10px] sm:text-xs text-gray-400 font-mono">
              On-Chain $SHIN Brackets • Humans-Only Championship &amp; Continuous Agent-Only Cup
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2 sm:gap-3">
          <button
            onClick={() => setShowInspectorModal(true)}
            className="px-2 sm:px-3 py-1 sm:py-1.5 rounded-lg text-[10px] sm:text-[11px] font-mono border flex items-center gap-1 transition-all cursor-pointer bg-white/5 text-emerald-300 border-emerald-500/30 hover:bg-emerald-500/15 hover:border-emerald-400"
            title="Inspect live on-chain transactions & contract activity"
          >
            <Terminal size={12} />
            <span>NEAR Inspector</span>
          </button>
          <div className="bg-white/5 border border-shin-gold/40 rounded-xl px-3 py-1.5 flex items-center gap-2">
            <Coins size={14} className="text-shin-gold" />
            <span className="text-xs font-mono font-bold text-shin-gold">
              {walletShin} $SHIN
            </span>
          </div>
          <button
            onClick={onHome}
            className="text-gray-400 hover:text-shin-red uppercase tracking-widest text-xs font-cinzel font-bold px-2.5 py-1.5 border border-white/10 rounded-lg cursor-pointer"
          >
            ✕
          </button>
        </div>
      </div>

      {/* Mode Split Tabs */}
      <div className="max-w-5xl mx-auto w-full px-4 md:px-8 pt-6">
        <div className="grid grid-cols-2 gap-3 bg-gray-950 p-1.5 rounded-2xl border border-white/10">
          <button
            onClick={() => setActiveTab('HUMAN')}
            className={`py-3 px-4 rounded-xl font-cinzel font-black text-xs sm:text-sm uppercase tracking-wider flex items-center justify-center gap-2 transition-all cursor-pointer ${
              activeTab === 'HUMAN'
                ? 'bg-shin-gold text-black shadow-[0_0_20px_rgba(251,191,36,0.4)]'
                : 'text-gray-400 hover:text-white'
            }`}
          >
            <Users size={16} />
            <span>Humans-Only Championship</span>
            {humanCup && (
              <span
                className={`text-[10px] font-mono px-2 py-0.5 rounded-full ${
                  activeTab === 'HUMAN'
                    ? 'bg-black/20 text-black'
                    : 'bg-white/10 text-shin-gold'
                }`}
              >
                {humanCup.entrants.length}/{humanCup.maxPlayers}
              </span>
            )}
          </button>

          <button
            onClick={() => setActiveTab('AGENT')}
            className={`py-3 px-4 rounded-xl font-cinzel font-black text-xs sm:text-sm uppercase tracking-wider flex items-center justify-center gap-2 transition-all cursor-pointer ${
              activeTab === 'AGENT'
                ? 'bg-purple-500 text-white shadow-[0_0_20px_rgba(168,85,247,0.45)]'
                : 'text-gray-400 hover:text-white'
            }`}
          >
            <Bot size={16} />
            <span>Agents-Only Continuous Cup</span>
            {agentCup && (
              <span
                className={`text-[10px] font-mono px-2 py-0.5 rounded-full ${
                  activeTab === 'AGENT'
                    ? 'bg-black/30 text-white'
                    : 'bg-purple-500/20 text-purple-300'
                }`}
              >
                Cup #{agentCup.cupNumber}
              </span>
            )}
          </button>
        </div>
      </div>

      {/* Main Content */}
      <div className="flex-1 max-w-5xl mx-auto w-full p-4 md:p-8">
        {activeTab === 'HUMAN' ? (
          /* =============================================================
             1. HUMANS-ONLY CHAMPIONSHIP (ON-CHAIN $SHIN + REAL PVP BRACKET)
             ============================================================= */
          <div className="bg-gray-950 border-2 border-shin-gold/50 rounded-2xl p-5 sm:p-6 space-y-5 shadow-[0_0_30px_rgba(251,191,36,0.15)]">
            {!humanCup ? (
              <div className="py-12 flex items-center justify-center gap-2 text-gray-400 font-mono text-xs">
                <Loader2 size={16} className="animate-spin text-shin-gold" />
                Loading live on-chain Human Championship...
              </div>
            ) : (
              <>
                <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4 border-b border-white/10 pb-4">
                  <div>
                    <span className="px-2.5 py-0.5 rounded bg-shin-gold/20 border border-shin-gold/50 text-shin-gold font-mono text-[10px] font-bold uppercase">
                      👤 Humans Only • No AI Agents • On-Chain Escrow
                    </span>
                    <h3 className="text-lg sm:text-2xl font-cinzel font-black text-white mt-2">
                      {humanCup.title}
                    </h3>
                    <p className="text-xs text-gray-400 mt-1">
                      Real 8-player human bracket settled on{' '}
                      <span className="font-mono text-emerald-400">shin-arena-28d.testnet</span>.
                      Champion wins{' '}
                      <strong className="text-shin-gold">95% of the $SHIN pot</strong> directly to
                      their NEAR wallet (5% Dev Treasury).
                    </p>
                    <div className="flex flex-wrap items-center gap-3 mt-2 text-[10px] font-mono text-gray-400">
                      <span>ID: {humanCup.tournamentId}</span>
                      {humanCup.explorerUrl && (
                        <a
                          href={humanCup.explorerUrl}
                          target="_blank"
                          rel="noreferrer"
                          className="text-emerald-400 hover:underline inline-flex items-center gap-1"
                        >
                          View On-Chain Tx <ExternalLink size={10} />
                        </a>
                      )}
                    </div>
                  </div>

                  <div className="text-right shrink-0 bg-black/80 border border-shin-gold/30 rounded-xl px-4 py-2.5">
                    <div className="text-[9px] font-mono text-gray-400 uppercase">
                      Live Escrow Pot
                    </div>
                    <div className="text-xl font-mono font-bold text-shin-gold">
                      {humanCup.totalPoolShin.toLocaleString()} $SHIN
                    </div>
                    <div className="text-[10px] font-mono text-emerald-400">
                      Entry: {humanCup.entryFeeShin.toLocaleString()} $SHIN
                    </div>
                  </div>
                </div>

                {/* 8-Player Human Bracket Tree (Quarterfinals -> Semifinals -> Grand Final) */}
                <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
                  {[
                    {
                      title: 'Quarterfinals (8 Players)',
                      rounds: ['QF_1', 'QF_2', 'QF_3', 'QF_4'],
                    },
                    {
                      title: 'Semifinals (4 Players)',
                      rounds: ['SEMI_1', 'SEMI_2'],
                    },
                    {
                      title: 'Grand Final (Championship)',
                      rounds: ['GRAND_FINAL'],
                    },
                  ].map((col) => (
                    <div key={col.title} className="space-y-2.5">
                      <div className="text-[10px] font-mono uppercase tracking-wider text-shin-gold/80 font-bold border-b border-white/10 pb-1.5">
                        {col.title}
                      </div>
                      {humanCup.matches
                        .filter((m) => col.rounds.includes(m.round))
                        .map((m) => {
                          const isMyMatch =
                            m.p1Id === myAccountId || m.p2Id === myAccountId;
                          return (
                            <div
                              key={m.id}
                              className={`bg-black/75 border rounded-xl p-3 space-y-1.5 ${
                                isMyMatch
                                  ? 'border-shin-gold/70 shadow-[0_0_12px_rgba(251,191,36,0.15)]'
                                  : 'border-white/10'
                              }`}
                            >
                              <div className="flex items-center justify-between gap-2">
                                <span className="text-[10px] font-mono text-shin-gold uppercase font-bold">
                                  {m.label}
                                </span>
                                <span className="text-[9px] font-mono px-2 py-0.5 rounded bg-white/5 border border-white/10 text-gray-300">
                                  {m.status === 'COMPLETED'
                                    ? `🏆 ${m.winnerName}`
                                    : m.status === 'READY'
                                    ? '⚔️ Ready'
                                    : '⏳ Waiting'}
                                </span>
                              </div>
                              <div className="text-xs font-cinzel font-bold space-y-1">
                                <div
                                  className={`flex items-center justify-between ${
                                    m.winnerId && m.winnerId === m.p1Id
                                      ? 'text-emerald-400'
                                      : m.p1Id
                                      ? 'text-white'
                                      : 'text-gray-500'
                                  }`}
                                >
                                  <span>👤 {m.p1Name}</span>
                                  {m.status === 'READY' && (
                                    <span className="text-[9px] font-mono">
                                      {m.p1Ready ? '✅ Ready' : '⏳ Wait'}
                                    </span>
                                  )}
                                </div>
                                <div
                                  className={`flex items-center justify-between ${
                                    m.winnerId && m.winnerId === m.p2Id
                                      ? 'text-emerald-400'
                                      : m.p2Id
                                      ? 'text-white'
                                      : 'text-gray-500'
                                  }`}
                                >
                                  <span>👤 {m.p2Name}</span>
                                  {m.status === 'READY' && (
                                    <span className="text-[9px] font-mono">
                                      {m.p2Ready ? '✅ Ready' : '⏳ Wait'}
                                    </span>
                                  )}
                                </div>
                              </div>
                            </div>
                          );
                        })}
                    </div>
                  ))}
                </div>

                {/* Human Tournament Controls */}
                <div className="pt-2 space-y-3">
                  {humanCup.status === 'SETTLED' ? (
                    <div className="bg-emerald-950/30 border border-emerald-500/40 rounded-xl p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                      <div>
                        <div className="text-xs font-cinzel font-black text-emerald-300 uppercase">
                          🏆 Champion Crowned: {humanCup.championName}
                        </div>
                        <p className="text-[11px] font-mono text-gray-300 mt-0.5">
                          {humanCup.winnerPayoutShin.toLocaleString()} $SHIN settled on-chain!
                          {humanCup.settleTxHash && (
                            <>
                              {' '}
                              Tx: <span className="text-emerald-400">{humanCup.settleTxHash.slice(0, 14)}...</span>
                            </>
                          )}
                        </p>
                      </div>
                      <button
                        onClick={async () => {
                          setIsSubmitting(true);
                          try {
                            const next = await nearArenaEngine.openNextHumanCup();
                            setHumanCup(next);
                            showToast(`Opened ${next.title}!`);
                          } catch (e: any) {
                            showToast(e.message);
                          } finally {
                            setIsSubmitting(false);
                          }
                        }}
                        disabled={isSubmitting}
                        className="px-4 py-2.5 bg-shin-gold text-black font-cinzel font-black text-xs uppercase rounded-xl cursor-pointer shrink-0"
                      >
                        Start Next Human Cup
                      </button>
                    </div>
                  ) : !hasJoinedHumanCup ? (
                    <div className="space-y-3">
                      {availableChars.length > 1 && (
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="text-[11px] font-mono text-gray-400 uppercase">
                            Select Owned Warrior:
                          </span>
                          {availableChars.map((cid) => (
                            <button
                              key={cid}
                              onClick={() => setSelectedChar(cid)}
                              className={`px-3 py-1.5 rounded-lg text-[11px] font-mono border cursor-pointer ${
                                selectedChar === cid
                                  ? 'bg-shin-gold/20 border-shin-gold text-shin-gold font-bold'
                                  : 'bg-white/5 border-white/10 text-gray-300'
                              }`}
                            >
                              {CHAR_LABELS[cid] || cid}
                            </button>
                          ))}
                        </div>
                      )}
                      <button
                        disabled={
                          isSubmitting ||
                          humanCup.entrants.length >= humanCup.maxPlayers
                        }
                        onClick={async () => {
                          setIsSubmitting(true);
                          try {
                            const updated =
                              await nearArenaEngine.joinHumanTournamentOnChain(
                                selectedChar,
                              );
                            setHumanCup(updated);
                            showToast(
                              `Staked ${humanCup.entryFeeShin.toLocaleString()} $SHIN on-chain & joined ${humanCup.title}!`,
                            );
                          } catch (e: any) {
                            showToast(e.message);
                          } finally {
                            setIsSubmitting(false);
                          }
                        }}
                        className="w-full py-3.5 bg-shin-gold text-black font-cinzel font-black text-xs uppercase tracking-widest rounded-xl hover:bg-yellow-400 transition-all cursor-pointer flex items-center justify-center gap-2 disabled:opacity-50"
                      >
                        {isSubmitting ? (
                          <Loader2 size={15} className="animate-spin" />
                        ) : (
                          <Trophy size={15} />
                        )}
                        {humanCup.entrants.length >= humanCup.maxPlayers
                          ? `Bracket Full (${humanCup.maxPlayers}/${humanCup.maxPlayers} Humans)`
                          : `Stake ${humanCup.entryFeeShin.toLocaleString()} $SHIN On-Chain & Join Human Cup`}
                      </button>
                    </div>
                  ) : myActiveHumanMatch ? (
                    (() => {
                      const amP1 = myActiveHumanMatch.p1Id === myAccountId;
                      const myReady = amP1
                        ? !!myActiveHumanMatch.p1Ready
                        : !!myActiveHumanMatch.p2Ready;
                      const oppReady = amP1
                        ? !!myActiveHumanMatch.p2Ready
                        : !!myActiveHumanMatch.p1Ready;
                      const oppName = amP1
                        ? myActiveHumanMatch.p2Name
                        : myActiveHumanMatch.p1Name;
                      return (
                        <div className="bg-red-950/30 border-2 border-shin-red/60 rounded-2xl p-4 space-y-3">
                          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                            <div>
                              <div className="text-xs font-cinzel font-black text-shin-gold uppercase flex items-center gap-1.5">
                                <Bell size={14} className="text-shin-red" /> Tournament Wait Room •{' '}
                                {myActiveHumanMatch.label}
                              </div>
                              <p className="text-[11px] font-mono text-gray-300 mt-0.5">
                                Matched vs <strong className="text-white">{oppName}</strong> • Room{' '}
                                <span className="text-emerald-400">{myActiveHumanMatch.roomCode}</span>
                              </p>
                            </div>
                            <div className="flex items-center gap-2 text-[10px] font-mono">
                              <span
                                className={`px-2.5 py-1 rounded border ${
                                  myReady
                                    ? 'bg-emerald-500/20 border-emerald-400 text-emerald-300'
                                    : 'bg-white/5 border-white/10 text-gray-300'
                                }`}
                              >
                                You: {myReady ? '✅ Ready' : '⏳ Not Ready'}
                              </span>
                              <span
                                className={`px-2.5 py-1 rounded border ${
                                  oppReady
                                    ? 'bg-emerald-500/20 border-emerald-400 text-emerald-300'
                                    : 'bg-white/5 border-white/10 text-gray-300'
                                }`}
                              >
                                {oppName}: {oppReady ? '✅ Ready' : '⏳ Waiting'}
                              </span>
                            </div>
                          </div>

                          <button
                            disabled={isSubmitting}
                            onClick={async () => {
                              setIsSubmitting(true);
                              try {
                                const updated = await nearArenaEngine.setHumanMatchReady(
                                  myActiveHumanMatch.id,
                                  !myReady,
                                );
                                setHumanCup(updated);
                              } catch (e: any) {
                                showToast(e.message);
                              } finally {
                                setIsSubmitting(false);
                              }
                            }}
                            className={`w-full py-3.5 font-cinzel font-black text-xs uppercase tracking-widest rounded-xl transition-all cursor-pointer flex items-center justify-center gap-2 ${
                              myReady
                                ? 'bg-white/10 hover:bg-white/15 border border-white/20 text-gray-200'
                                : 'bg-shin-red hover:bg-red-600 text-white shadow-[0_0_20px_rgba(239,68,68,0.4)]'
                            }`}
                          >
                            <Swords size={15} />
                            {myReady
                              ? `Waiting for ${oppName} to Ready Up... (Click to Cancel)`
                              : `Ready Up in Wait Room (Auto-Joins Arena with ${oppName})`}
                          </button>
                        </div>
                      );
                    })()
                  ) : myWaitingHumanMatch ? (
                    <div className="w-full py-3 px-4 bg-white/5 border border-shin-gold/30 rounded-xl text-center text-xs font-mono text-shin-gold">
                      ⏳ You are entered in {myWaitingHumanMatch.label}. Waiting for another human player to join on-chain!
                    </div>
                  ) : (
                    <div className="w-full py-3 px-4 bg-white/5 border border-white/10 rounded-xl text-center text-xs font-mono text-gray-300">
                      Your bracket run has concluded. Watch the remaining human matches finish!
                    </div>
                  )}
                </div>
              </>
            )}
          </div>
        ) : (
          /* =============================================================
             2. AGENTS-ONLY CONTINUOUS TOURNAMENT (SERVER + ON-CHAIN)
             ============================================================= */
          <div className="bg-gray-950 border-2 border-purple-500/50 rounded-2xl p-5 sm:p-6 space-y-5 shadow-[0_0_30px_rgba(168,85,247,0.15)]">
            {!agentCup ? (
              <div className="py-12 flex items-center justify-center gap-2 text-gray-400 font-mono text-xs">
                <Loader2 size={16} className="animate-spin text-purple-400" />
                Loading continuous on-chain Agent Cup...
              </div>
            ) : (
              <>
                <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4 border-b border-white/10 pb-4">
                  <div>
                    <span className="px-2.5 py-0.5 rounded bg-purple-500/20 border border-purple-400/50 text-purple-300 font-mono text-[10px] font-bold uppercase">
                      🤖 Agents Only • Continuous 24/7 Server &amp; On-Chain Settlement
                    </span>
                    <h3 className="text-lg sm:text-2xl font-cinzel font-black text-white mt-2">
                      {agentCup.title}
                    </h3>
                    <p className="text-xs text-gray-400 mt-1">
                      Autonomous Fighter NFTs battle continuously through Semifinals &amp; Grand
                      Final. Champions receive{' '}
                      <strong className="text-shin-gold">95% of the $SHIN pot</strong> directly into
                      their on-chain War Chest, followed by a{' '}
                      <strong className="text-amber-300">2-Minute Rest Cooldown</strong>.
                    </p>
                    <div className="flex flex-wrap items-center gap-3 mt-2 text-[10px] font-mono text-gray-400">
                      <span>ID: {agentCup.tournamentId}</span>
                      {agentCup.explorerUrl && (
                        <a
                          href={agentCup.explorerUrl}
                          target="_blank"
                          rel="noreferrer"
                          className="text-purple-300 hover:underline inline-flex items-center gap-1"
                        >
                          View On-Chain Tx <ExternalLink size={10} />
                        </a>
                      )}
                    </div>
                  </div>

                  <div className="text-right shrink-0 bg-black/80 border border-purple-500/30 rounded-xl px-4 py-2.5">
                    <div className="text-[9px] font-mono text-gray-400 uppercase">Agent Pool</div>
                    <div className="text-xl font-mono font-bold text-purple-300">
                      {agentCup.totalPoolShin.toLocaleString()} $SHIN
                    </div>
                    <div className="text-[10px] font-mono text-shin-gold">
                      Champion Cut: {agentCup.winnerPayoutShin.toLocaleString()} $SHIN
                    </div>
                  </div>
                </div>

                {/* Live Server Status Banner */}
                {agentCup.status === 'REST_COOLDOWN' ? (
                  <div className="bg-amber-950/40 border-2 border-amber-400 rounded-xl p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                    <div>
                      <div className="text-xs font-cinzel font-black text-amber-300 uppercase flex items-center gap-1.5">
                        <Timer size={15} /> Mandatory 2-Minute Agent Rest Window Active
                      </div>
                      <p className="text-[11px] text-gray-200 mt-0.5">
                        Cup #{agentCup.cupNumber} Champion:{' '}
                        <strong className="text-shin-gold">{agentCup.lastChampionName}</strong> (+
                        {(agentCup.lastChampionWonShin || 0).toLocaleString()} $SHIN settled on-chain).
                        Cup #{agentCup.cupNumber + 1} starts automatically in{' '}
                        <strong className="font-mono text-amber-300">
                          {formatCooldown(agentCup.restSecondsRemaining)}
                        </strong>
                        .
                      </p>
                    </div>
                    {agentCup.settleTxHash && (
                      <span className="text-[10px] font-mono text-emerald-300 bg-black/60 px-3 py-1.5 rounded-lg border border-emerald-500/30 shrink-0">
                        Settled: {agentCup.settleTxHash.slice(0, 12)}...
                      </span>
                    )}
                  </div>
                ) : (
                  <div className="bg-purple-950/30 border border-purple-500/40 rounded-xl p-3.5 flex items-center justify-between">
                    <div className="text-xs font-cinzel font-bold text-purple-200 flex items-center gap-2">
                      <Flame size={15} className="text-shin-red" />
                      <span>
                        Live Stage: {agentCup.currentStage.replace('_', ' ')}
                      </span>
                    </div>
                    <span className="text-[11px] font-mono text-purple-300 flex items-center gap-1.5">
                      <Timer size={13} /> Next round resolves in {agentCup.nextRoundInSeconds}s
                    </span>
                  </div>
                )}

                {/* Agent Bracket Matches */}
                <div className="space-y-2.5">
                  {agentCup.matches.map((m) => (
                    <div
                      key={m.id}
                      className="bg-black/75 border border-white/10 rounded-xl p-3.5 flex items-center justify-between gap-2"
                    >
                      <div>
                        <div className="text-[10px] font-mono text-purple-300 uppercase">
                          {m.label} •{' '}
                          {m.round === 'GRAND_FINAL'
                            ? `Winner War Chest: +${agentCup.winnerPayoutShin.toLocaleString()} $SHIN`
                            : 'Winner Advances to Agent Final'}
                        </div>
                        <div className="text-xs sm:text-sm font-cinzel font-bold text-white mt-0.5">
                          🤖 {m.p1Name} <span className="text-gray-500">VS</span> 🤖 {m.p2Name}
                        </div>
                      </div>
                      <span className="text-[10px] font-mono text-shin-gold">
                        {m.winnerName ? `🏆 ${m.winnerName}` : m.status === 'READY' ? '⚔️ Fighting' : 'Pending'}
                      </span>
                    </div>
                  ))}
                </div>

                {/* Player's Own Agents Enrollment Quick-Toggle */}
                <div className="bg-black/80 border border-white/10 rounded-xl p-4 space-y-2.5">
                  <div className="text-[10px] font-cinzel font-bold text-gray-300 uppercase tracking-wider">
                    Your Fighter NFTs — Continuous Agent Cup Enrollment:
                  </div>
                  {myAgents.length === 0 ? (
                    <div className="text-xs font-mono text-gray-400">
                      You have no minted Fighter NFTs on this wallet yet. Mint one in Agent Arena to
                      compete automatically in the 24/7 Agent Cups!
                    </div>
                  ) : (
                    myAgents.map((agent) => (
                      <div
                        key={agent.tokenId}
                        className="flex items-center justify-between text-xs bg-white/5 px-3 py-2 rounded-lg"
                      >
                        <div>
                          <span className="font-cinzel font-bold text-white">{agent.name}</span>
                          <span className="text-[10px] font-mono text-shin-gold ml-2">
                            (Lv.{agent.powerLevel} • ELO {agent.elo} • {agent.wins}W)
                          </span>
                        </div>
                        <button
                          onClick={async () => {
                            const nextState = !agent.enrolled;
                            try {
                              const data =
                                await nearArenaEngine.setAgentTournamentEnrollment(
                                  agent.tokenId,
                                  nextState,
                                );
                              setAgentCup(data.agentCup);
                              showToast(
                                nextState
                                  ? `${agent.name} enrolled in Continuous Agent Cups!`
                                  : `${agent.name} withdrawn from upcoming Agent Cups.`,
                              );
                            } catch (e: any) {
                              showToast(e.message);
                            }
                          }}
                          className={`px-3 py-1 rounded font-mono text-[10px] font-bold uppercase border cursor-pointer ${
                            agent.enrolled
                              ? 'bg-emerald-500/20 border-emerald-400 text-emerald-300'
                              : 'bg-red-500/20 border-red-400 text-red-300'
                          }`}
                        >
                          {agent.enrolled
                            ? '✅ Competing (Click to Withdraw)'
                            : '⏸️ Withdrawn (Click to Enroll)'}
                        </button>
                      </div>
                    ))
                  )}
                </div>
              </>
            )}
          </div>
        )}
      </div>

      <NearInspectorModal
        isOpen={showInspectorModal}
        onClose={() => setShowInspectorModal(false)}
      />
    </div>
  );
};

export default TournamentsFlow;
