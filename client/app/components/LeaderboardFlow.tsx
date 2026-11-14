'use client';

import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { io } from 'socket.io-client';
import {
  Trophy,
  Bot,
  Users,
  Coins,
  ExternalLink,
  Terminal,
  Loader2,
  CheckCircle2,
  Flame,
  ArrowUpDown,
} from 'lucide-react';
import { nearArenaEngine } from '../services/nearArenaEngine';
import NearInspectorModal from './NearInspectorModal';

interface AgentLeaderboardRow {
  tokenId: string;
  name: string;
  charClass: string;
  ownerId: string;
  powerLevel: number;
  atk: number;
  def: number;
  spd: number;
  wins: number;
  losses: number;
  totalBouts: number;
  winRate: number;
  elo: number;
  hasStandaloneWallet: boolean;
  agentAccountId: string;
  nearBalance: number;
  shinBalance: number;
  nearblocksUrl: string;
}

interface HumanLeaderboardRow {
  username: string;
  walletAddress: string;
  nearblocksUrl: string;
  level: number;
  xp: number;
  elo: number;
  wins: number;
  losses: number;
  totalBouts: number;
  winRate: number;
  winStreak: number;
  totalShinEarned: number;
  shinBalance: number;
}

interface LeaderboardFlowProps {
  onBack: () => void;
  onHome: () => void;
}

const LeaderboardFlow: React.FC<LeaderboardFlowProps> = ({ onBack, onHome }) => {
  const [arenaState, setArenaState] = useState(() => nearArenaEngine.getState());
  const [activeTab, setActiveTab] = useState<'AGENTS' | 'HUMANS'>('AGENTS');
  const [sortBy, setSortBy] = useState<'EARNINGS' | 'WINS' | 'ELO'>('EARNINGS');
  const [agents, setAgents] = useState<AgentLeaderboardRow[]>([]);
  const [humans, setHumans] = useState<HumanLeaderboardRow[]>([]);
  const [updatedAt, setUpdatedAt] = useState<number | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [toast, setToast] = useState<string | null>(null);
  const [showInspectorModal, setShowInspectorModal] = useState(false);

  const showToast = (msg: string) => {
    setToast(msg);
    setTimeout(() => setToast(null), 3800);
  };

  const fetchLeaderboard = useCallback(async () => {
    try {
      const serverUrl = process.env.NEXT_PUBLIC_SERVER_URL || 'http://localhost:3001';
      const res = await fetch(`${serverUrl}/api/leaderboard`);
      const data = await res.json();
      if (data?.ok) {
        setAgents(data.agents || []);
        setHumans(data.humans || []);
        setUpdatedAt(data.updatedAt || Date.now());
      }
    } catch {
      // Keep last known leaderboard on transient errors
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    const sync = () => setArenaState({ ...nearArenaEngine.getState() });
    window.addEventListener('nearArenaStateUpdated', sync);

    void fetchLeaderboard();
    const poll = setInterval(() => {
      void fetchLeaderboard();
    }, 4000);

    const serverUrl = process.env.NEXT_PUBLIC_SERVER_URL || 'http://localhost:3001';
    const socket = io(serverUrl, { reconnectionAttempts: 5 });
    socket.on('leaderboard_updated', () => {
      void fetchLeaderboard();
    });
    socket.on('tournament_updated', () => {
      void fetchLeaderboard();
    });

    return () => {
      window.removeEventListener('nearArenaStateUpdated', sync);
      clearInterval(poll);
      socket.disconnect();
    };
  }, [fetchLeaderboard]);

  const sortedAgents = useMemo(() => {
    const copy = [...agents];
    if (sortBy === 'WINS') {
      copy.sort((a, b) => b.wins - a.wins || b.winRate - a.winRate || b.elo - a.elo);
    } else if (sortBy === 'ELO') {
      copy.sort((a, b) => b.elo - a.elo || b.wins - a.wins);
    } else {
      copy.sort((a, b) => b.shinBalance - a.shinBalance || b.wins - a.wins || b.elo - a.elo);
    }
    return copy;
  }, [agents, sortBy]);

  const sortedHumans = useMemo(() => {
    const copy = [...humans];
    if (sortBy === 'WINS') {
      copy.sort((a, b) => b.wins - a.wins || b.winRate - a.winRate || b.elo - a.elo);
    } else if (sortBy === 'ELO') {
      copy.sort((a, b) => b.elo - a.elo || b.wins - a.wins);
    } else {
      copy.sort(
        (a, b) =>
          b.totalShinEarned - a.totalShinEarned ||
          b.shinBalance - a.shinBalance ||
          b.wins - a.wins,
      );
    }
    return copy;
  }, [humans, sortBy]);

  const myAccountId = arenaState.playerWallet.accountId;
  const walletShin = Math.round(arenaState.playerWallet.SHIN ?? 0).toLocaleString();

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
              <Trophy size={18} /> REAL-TIME ARENA LEADERBOARDS
            </h1>
            <p className="text-[10px] sm:text-xs text-gray-400 font-mono flex items-center gap-2">
              <span className="inline-flex items-center gap-1 text-emerald-400">
                <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
                LIVE
              </span>
              <span>
                On-Chain $SHIN Earnings, W/L Records &amp; Nearblocks Verification
                {updatedAt ? ` • Synced ${new Date(updatedAt).toLocaleTimeString()}` : ''}
              </span>
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

      {/* Controls Bar */}
      <div className="max-w-6xl mx-auto w-full px-4 md:px-8 pt-6 space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          {/* Tabs */}
          <div className="grid grid-cols-2 gap-2 bg-gray-950 p-1.5 rounded-2xl border border-white/10">
            <button
              onClick={() => setActiveTab('AGENTS')}
              className={`py-2.5 px-4 rounded-xl font-cinzel font-black text-xs uppercase tracking-wider flex items-center justify-center gap-2 transition-all cursor-pointer ${
                activeTab === 'AGENTS'
                  ? 'bg-purple-500 text-white shadow-[0_0_20px_rgba(168,85,247,0.45)]'
                  : 'text-gray-400 hover:text-white'
              }`}
            >
              <Bot size={15} />
              <span>Active Agents ({agents.length})</span>
            </button>
            <button
              onClick={() => setActiveTab('HUMANS')}
              className={`py-2.5 px-4 rounded-xl font-cinzel font-black text-xs uppercase tracking-wider flex items-center justify-center gap-2 transition-all cursor-pointer ${
                activeTab === 'HUMANS'
                  ? 'bg-shin-gold text-black shadow-[0_0_20px_rgba(251,191,36,0.4)]'
                  : 'text-gray-400 hover:text-white'
              }`}
            >
              <Users size={15} />
              <span>Human Warriors ({humans.length})</span>
            </button>
          </div>

          {/* Sort Switcher */}
          <div className="flex items-center gap-2 bg-gray-950 border border-white/10 rounded-xl px-3 py-1.5">
            <ArrowUpDown size={13} className="text-gray-400" />
            <span className="text-[10px] font-mono text-gray-400 uppercase">Sort:</span>
            {(['EARNINGS', 'WINS', 'ELO'] as const).map((mode) => (
              <button
                key={mode}
                onClick={() => setSortBy(mode)}
                className={`px-2.5 py-1 rounded-lg text-[10px] font-mono font-bold uppercase cursor-pointer ${
                  sortBy === mode
                    ? 'bg-shin-gold text-black'
                    : 'text-gray-400 hover:text-white'
                }`}
              >
                {mode === 'EARNINGS' ? '$SHIN Earned' : mode}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Leaderboard Table / Cards */}
      <div className="flex-1 max-w-6xl mx-auto w-full p-4 md:p-8">
        {isLoading ? (
          <div className="py-16 flex items-center justify-center gap-2 text-gray-400 font-mono text-xs">
            <Loader2 size={18} className="animate-spin text-shin-gold" />
            Loading live on-chain leaderboards...
          </div>
        ) : activeTab === 'AGENTS' ? (
          <div className="space-y-3">
            {sortedAgents.length === 0 ? (
              <div className="bg-gray-950 border border-white/10 rounded-2xl p-8 text-center text-xs font-mono text-gray-400">
                No active Fighter NFTs found on-chain yet.
              </div>
            ) : (
              sortedAgents.map((ag, idx) => {
                const isOwner = ag.ownerId === myAccountId;
                return (
                  <div
                    key={ag.tokenId}
                    className={`bg-gray-950 border rounded-2xl p-4 flex flex-col lg:flex-row lg:items-center justify-between gap-4 ${
                      idx === 0
                        ? 'border-shin-gold/70 shadow-[0_0_25px_rgba(251,191,36,0.12)]'
                        : isOwner
                        ? 'border-emerald-500/40'
                        : 'border-white/10'
                    }`}
                  >
                    <div className="flex items-start sm:items-center gap-3.5 min-w-0">
                      <div
                        className={`w-9 h-9 rounded-xl flex items-center justify-center font-cinzel font-black text-sm shrink-0 ${
                          idx === 0
                            ? 'bg-shin-gold text-black'
                            : idx === 1
                            ? 'bg-gray-300 text-black'
                            : idx === 2
                            ? 'bg-amber-700 text-white'
                            : 'bg-white/5 text-gray-400 border border-white/10'
                        }`}
                      >
                        #{idx + 1}
                      </div>

                      <div className="min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="font-cinzel font-black text-sm sm:text-base text-white">
                            🤖 {ag.name}
                          </span>
                          <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-purple-500/20 border border-purple-400/40 text-purple-200 uppercase">
                            {ag.charClass} • Lv.{ag.powerLevel}
                          </span>
                          {isOwner && (
                            <span className="text-[9px] font-mono px-2 py-0.5 rounded bg-emerald-500/20 border border-emerald-400/50 text-emerald-300">
                              YOUR AGENT
                            </span>
                          )}
                        </div>
                        <div className="text-[11px] font-mono text-gray-400 mt-1 flex flex-wrap items-center gap-x-3 gap-y-1">
                          <span>
                            Stats: <strong className="text-gray-200">{ag.atk}</strong> ATK /{' '}
                            <strong className="text-gray-200">{ag.def}</strong> DEF /{' '}
                            <strong className="text-gray-200">{ag.spd}</strong> SPD
                          </span>
                          <span>
                            Wallet:{' '}
                            <a
                              href={ag.nearblocksUrl}
                              target="_blank"
                              rel="noreferrer"
                              className="text-purple-300 hover:underline inline-flex items-center gap-1"
                            >
                              {ag.agentAccountId} <ExternalLink size={10} />
                            </a>
                          </span>
                          <span>Owner: {ag.ownerId}</span>
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center gap-3 flex-wrap justify-between lg:justify-end shrink-0">
                      <div className="bg-black/70 border border-white/10 rounded-xl px-3 py-1.5 text-center">
                        <div className="text-[9px] font-mono text-gray-400 uppercase">Record</div>
                        <div className="text-xs font-mono font-bold text-white">
                          <span className="text-emerald-400">{ag.wins}W</span> -{' '}
                          <span className="text-red-400">{ag.losses}L</span> ({ag.winRate}%)
                        </div>
                      </div>

                      <div className="bg-black/70 border border-white/10 rounded-xl px-3 py-1.5 text-center">
                        <div className="text-[9px] font-mono text-gray-400 uppercase">ELO</div>
                        <div className="text-xs font-mono font-bold text-purple-300">{ag.elo}</div>
                      </div>

                      <div className="bg-black/70 border border-shin-gold/40 rounded-xl px-3.5 py-1.5 text-right">
                        <div className="text-[9px] font-mono text-gray-400 uppercase">
                          Wallet Balance
                        </div>
                        <div className="text-sm font-mono font-bold text-shin-gold">
                          {Math.round(ag.shinBalance).toLocaleString()} $SHIN
                        </div>
                        <div className="text-[9px] font-mono text-gray-400">
                          {ag.nearBalance.toFixed(3)} NEAR
                        </div>
                      </div>

                      {isOwner && ag.hasStandaloneWallet && ag.shinBalance > 0 && (
                        <button
                          disabled={isSubmitting}
                          onClick={async () => {
                            setIsSubmitting(true);
                            try {
                              const res = await nearArenaEngine.withdrawAgentWalletShin(
                                ag.tokenId,
                                Math.floor(ag.shinBalance),
                              );
                              await fetchLeaderboard();
                              showToast(
                                `Withdrew ${Math.floor(ag.shinBalance).toLocaleString()} $SHIN! (${res.txHash?.slice(0, 10)}...)`,
                              );
                            } catch (e: any) {
                              showToast(e.message);
                            } finally {
                              setIsSubmitting(false);
                            }
                          }}
                          className="px-3 py-2 rounded-xl bg-shin-gold text-black font-cinzel font-black text-[10px] uppercase cursor-pointer"
                        >
                          Withdraw $SHIN
                        </button>
                      )}
                    </div>
                  </div>
                );
              })
            )}
          </div>
        ) : (
          <div className="space-y-3">
            {sortedHumans.length === 0 ? (
              <div className="bg-gray-950 border border-white/10 rounded-2xl p-8 text-center text-xs font-mono text-gray-400">
                No registered human warriors yet.
              </div>
            ) : (
              sortedHumans.map((h, idx) => {
                const isMe = h.walletAddress === myAccountId;
                return (
                  <div
                    key={h.walletAddress || h.username + idx}
                    className={`bg-gray-950 border rounded-2xl p-4 flex flex-col lg:flex-row lg:items-center justify-between gap-4 ${
                      idx === 0
                        ? 'border-shin-gold/70 shadow-[0_0_25px_rgba(251,191,36,0.12)]'
                        : isMe
                        ? 'border-emerald-500/40'
                        : 'border-white/10'
                    }`}
                  >
                    <div className="flex items-center gap-3.5 min-w-0">
                      <div
                        className={`w-9 h-9 rounded-xl flex items-center justify-center font-cinzel font-black text-sm shrink-0 ${
                          idx === 0
                            ? 'bg-shin-gold text-black'
                            : idx === 1
                            ? 'bg-gray-300 text-black'
                            : idx === 2
                            ? 'bg-amber-700 text-white'
                            : 'bg-white/5 text-gray-400 border border-white/10'
                        }`}
                      >
                        #{idx + 1}
                      </div>

                      <div className="min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="font-cinzel font-black text-sm sm:text-base text-white">
                            👤 {h.username}
                          </span>
                          <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-shin-gold/15 border border-shin-gold/40 text-shin-gold">
                            Lv.{h.level}
                          </span>
                          {h.winStreak >= 2 && (
                            <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-red-500/20 border border-red-400/40 text-red-300 inline-flex items-center gap-1">
                              <Flame size={10} /> {h.winStreak} Streak
                            </span>
                          )}
                          {isMe && (
                            <span className="text-[9px] font-mono px-2 py-0.5 rounded bg-emerald-500/20 border border-emerald-400/50 text-emerald-300">
                              YOU
                            </span>
                          )}
                        </div>
                        {h.walletAddress && (
                          <div className="text-[11px] font-mono text-gray-400 mt-1 truncate">
                            Wallet:{' '}
                            <a
                              href={h.nearblocksUrl}
                              target="_blank"
                              rel="noreferrer"
                              className="text-emerald-400 hover:underline inline-flex items-center gap-1"
                            >
                              {h.walletAddress} <ExternalLink size={10} />
                            </a>
                          </div>
                        )}
                      </div>
                    </div>

                    <div className="flex items-center gap-3 flex-wrap justify-between lg:justify-end shrink-0">
                      <div className="bg-black/70 border border-white/10 rounded-xl px-3 py-1.5 text-center">
                        <div className="text-[9px] font-mono text-gray-400 uppercase">Record</div>
                        <div className="text-xs font-mono font-bold text-white">
                          <span className="text-emerald-400">{h.wins}W</span> -{' '}
                          <span className="text-red-400">{h.losses}L</span> ({h.winRate}%)
                        </div>
                      </div>

                      <div className="bg-black/70 border border-white/10 rounded-xl px-3 py-1.5 text-center">
                        <div className="text-[9px] font-mono text-gray-400 uppercase">ELO</div>
                        <div className="text-xs font-mono font-bold text-shin-gold">{h.elo}</div>
                      </div>

                      <div className="bg-black/70 border border-shin-gold/40 rounded-xl px-3.5 py-1.5 text-right">
                        <div className="text-[9px] font-mono text-gray-400 uppercase">
                          Tournament Won
                        </div>
                        <div className="text-sm font-mono font-bold text-shin-gold">
                          {Math.round(h.totalShinEarned).toLocaleString()} $SHIN
                        </div>
                        <div className="text-[9px] font-mono text-gray-400">
                          Wallet: {Math.round(h.shinBalance).toLocaleString()} $SHIN
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })
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

export default LeaderboardFlow;
