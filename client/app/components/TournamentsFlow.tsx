'use client';

import React, { useEffect, useState } from 'react';
import { nearArenaEngine } from '../services/nearArenaEngine';
import {
  Trophy,
  Swords,
  Timer,
  Flame,
  FastForward,
  CheckCircle2,
  Coins,
} from 'lucide-react';

interface TournamentsFlowProps {
  onStartTournamentDuel: (duelConfig: {
    p1Char: string;
    p2Char: string;
    p2Name: string;
    wagerNear: number;
    isTournamentBout: boolean;
  }) => void;
  onBack: () => void;
  onHome: () => void;
}

const TournamentsFlow: React.FC<TournamentsFlowProps> = ({
  onStartTournamentDuel,
  onBack,
  onHome,
}) => {
  const [arenaState, setArenaState] = useState(() => nearArenaEngine.getState());
  const [toast, setToast] = useState<string | null>(null);

  const showToast = (msg: string) => {
    setToast(msg);
    setTimeout(() => setToast(null), 3200);
  };

  useEffect(() => {
    const sync = () => setArenaState({ ...nearArenaEngine.getState() });
    window.addEventListener('nearArenaStateUpdated', sync);

    // 1-second ticker for Continuous Agent Tournament 2-Minute Rest Cooldown
    const tourneyTimer = setInterval(() => {
      const st = nearArenaEngine.getState();
      if (st.agentContinuousTournament?.status === 'REST_COOLDOWN') {
        nearArenaEngine.stepContinuousAgentTournament(false);
        setArenaState({ ...nearArenaEngine.getState() });
      }
    }, 1000);

    return () => {
      window.removeEventListener('nearArenaStateUpdated', sync);
      clearInterval(tourneyTimer);
    };
  }, []);

  const humanTourney = arenaState.humanDailyTournament;
  const agentTourney = arenaState.agentContinuousTournament;

  const formatCooldown = (secs: number) => {
    const m = Math.floor(secs / 60);
    const s = secs % 60;
    return `${m}:${s.toString().padStart(2, '0')}`;
  };

  return (
    <div className="fixed inset-0 z-40 bg-gradient-to-b from-gray-950 via-black to-black text-white overflow-y-auto w-full h-full flex flex-col select-none">
      {toast && (
        <div className="fixed top-16 left-1/2 -translate-x-1/2 z-[100] bg-shin-gold text-black font-cinzel font-black text-xs px-5 py-2.5 rounded-full shadow-[0_0_25px_rgba(251,191,36,0.9)] flex items-center gap-2">
          <CheckCircle2 size={16} />
          <span>{toast}</span>
        </div>
      )}

      {/* Top Header */}
      <div className="sticky top-0 z-50 bg-black/95 border-b border-white/10 px-4 md:px-8 py-3.5 flex flex-wrap items-center justify-between gap-3 backdrop-blur-md">
        <div className="flex items-center gap-3">
          <button
            onClick={onBack}
            className="text-gray-400 hover:text-white uppercase tracking-widest text-xs font-cinzel font-bold cursor-pointer"
          >
            ← Back
          </button>
          <div className="h-4 w-px bg-white/15" />
          <div>
            <h1 className="text-base sm:text-xl md:text-2xl font-cinzel font-black text-shin-gold uppercase tracking-wider flex items-center gap-2">
              <Trophy size={18} /> SHINOBI GRAND TOURNAMENTS
            </h1>
            <p className="text-[10px] text-gray-400">
              Daily Human Tournament Windows (Per-Fight Cut + Champion Jackpot) &amp; Continuous
              24/7 Agent Cups (with 2m Rest Cooldown)
            </p>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <div className="bg-white/5 border border-shin-gold/40 rounded-xl px-3 py-1.5 flex items-center gap-2">
            <Coins size={14} className="text-shin-gold" />
            <span className="text-xs font-mono font-bold text-shin-gold">
              {arenaState.playerWallet.NEAR.toFixed(2)} NEAR
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

      {/* Main Content */}
      <div className="flex-1 max-w-7xl mx-auto w-full p-4 md:p-8">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* 1. DAILY HUMAN + AGENT OPEN TOURNAMENT WINDOW */}
          <div className="bg-gray-950 border-2 border-shin-gold/50 rounded-2xl p-5 space-y-5 shadow-[0_0_30px_rgba(251,191,36,0.15)]">
            <div className="flex items-start justify-between gap-3 border-b border-white/10 pb-4">
              <div>
                <span className="px-2.5 py-0.5 rounded bg-shin-gold/20 border border-shin-gold/50 text-shin-gold font-mono text-[10px] font-bold uppercase">
                  👤 Daily Open Tournament Window
                </span>
                <h3 className="text-lg sm:text-xl font-cinzel font-black text-white mt-1.5">
                  {humanTourney.title}
                </h3>
                <p className="text-xs text-gray-400 mt-1">
                  Each bout winner immediately takes the{' '}
                  <strong className="text-emerald-400">
                    +{humanTourney.boutBountyNear.toFixed(2)} NEAR Bout Cut
                  </strong>
                  , and the overall Tournament Champion takes the{' '}
                  <strong className="text-shin-gold">
                    +{humanTourney.championJackpotNear.toFixed(2)} NEAR Grand Jackpot
                  </strong>
                  !
                </p>
              </div>
              <div className="text-right shrink-0 bg-black/80 border border-shin-gold/30 rounded-xl px-3.5 py-2">
                <div className="text-[9px] font-mono text-gray-400 uppercase">Total Pool</div>
                <div className="text-lg font-mono font-bold text-shin-gold">
                  {humanTourney.totalPoolNear.toFixed(1)} NEAR
                </div>
                <div className="text-[9px] font-mono text-emerald-400">
                  Entry: {humanTourney.entryFeeNear} NEAR
                </div>
              </div>
            </div>

            {/* Bracket Matches List */}
            <div className="space-y-3">
              {humanTourney.matches.map((m) => (
                <div
                  key={m.id}
                  className="bg-black/75 border border-white/10 rounded-xl p-3.5 flex items-center justify-between gap-2"
                >
                  <div>
                    <div className="text-[10px] font-mono text-shin-gold uppercase font-bold">
                      {m.label} • Immediate Bounty: +{m.boutBountyPaidNear.toFixed(2)} NEAR
                    </div>
                    <div className="text-xs sm:text-sm font-cinzel font-bold text-white mt-1 flex items-center gap-2">
                      <span className={m.winnerSide === 'p1' ? 'text-emerald-400' : ''}>
                        {m.p1IsAgent ? '🤖' : '👤'} {m.p1Name}
                      </span>
                      <span className="text-gray-500">VS</span>
                      <span className={m.winnerSide === 'p2' ? 'text-emerald-400' : ''}>
                        {m.p2IsAgent ? '🤖' : '👤'} {m.p2Name}
                      </span>
                    </div>
                  </div>
                  <span className="text-[10px] font-mono px-2.5 py-1 rounded bg-white/5 border border-white/10 text-gray-300">
                    {m.winnerSide
                      ? `Winner: ${m.winnerSide === 'p1' ? m.p1Name : m.p2Name}`
                      : 'Pending'}
                  </span>
                </div>
              ))}
            </div>

            {/* Tournament Action Controls */}
            <div className="pt-2 flex flex-wrap gap-3">
              {!humanTourney.playerJoined || humanTourney.currentStage === 'COMPLETED' ? (
                <button
                  onClick={() => {
                    try {
                      const myChar =
                        arenaState.fighters.find((f) => !f.isNpc)?.charId || 'fighter';
                      nearArenaEngine.joinHumanDailyTournament(myChar);
                      setArenaState({ ...nearArenaEngine.getState() });
                      showToast(
                        `Joined ${humanTourney.title}! Staked ${humanTourney.entryFeeNear} NEAR.`,
                      );
                    } catch (e: any) {
                      showToast(e.message);
                    }
                  }}
                  className="w-full py-3 bg-shin-gold text-black font-cinzel font-black text-xs uppercase tracking-widest rounded-xl hover:bg-yellow-400 transition-all cursor-pointer flex items-center justify-center gap-2"
                >
                  <Trophy size={15} /> Join Daily Tournament Window ({humanTourney.entryFeeNear}{' '}
                  NEAR Entry)
                </button>
              ) : (
                <div className="w-full space-y-2">
                  <button
                    onClick={() => {
                      const currentBout =
                        humanTourney.currentStage === 'SEMI_1'
                          ? humanTourney.matches[0]
                          : humanTourney.matches[2];
                      onStartTournamentDuel({
                        p1Char: humanTourney.playerCharId || 'fighter',
                        p2Char: currentBout.p2CharId || 'kunoichi',
                        p2Name: currentBout.p2Name,
                        wagerNear: humanTourney.entryFeeNear,
                        isTournamentBout: true,
                      });
                    }}
                    className="w-full py-3 bg-shin-red hover:bg-red-600 text-white font-cinzel font-black text-xs uppercase tracking-widest rounded-xl transition-all cursor-pointer flex items-center justify-center gap-2"
                  >
                    <Swords size={15} /> Fight Your {humanTourney.currentStage.replace('_', ' ')}{' '}
                    Match in 2D Arena Now
                  </button>
                  <button
                    onClick={() => {
                      const res = nearArenaEngine.resolveHumanTournamentBout(true);
                      setArenaState({ ...nearArenaEngine.getState() });
                      if (res.jackpotPaidNear > 0) {
                        showToast(
                          `🏆 GRAND CHAMPION! +${res.jackpotPaidNear.toFixed(2)} NEAR Jackpot credited to your wallet!`,
                        );
                      } else {
                        showToast(
                          `Semifinal Won! +${res.bountyPaidNear.toFixed(2)} NEAR Bout Cut paid. Ready for Grand Final!`,
                        );
                      }
                    }}
                    className="w-full py-2 bg-white/10 hover:bg-white/15 border border-white/20 text-shin-gold font-mono text-[11px] uppercase rounded-xl cursor-pointer"
                  >
                    ⚡ Quick-Simulate My Current Round Win (Demo Shortcut)
                  </button>
                </div>
              )}
            </div>
          </div>

          {/* 2. CONTINUOUS 24/7 AUTONOMOUS AGENT TOURNAMENT (WITH 2-MIN REST COOLDOWN) */}
          <div className="bg-gray-950 border-2 border-purple-500/50 rounded-2xl p-5 space-y-5 shadow-[0_0_30px_rgba(168,85,247,0.15)]">
            <div className="flex items-start justify-between gap-3 border-b border-white/10 pb-4">
              <div>
                <span className="px-2.5 py-0.5 rounded bg-purple-500/20 border border-purple-400/50 text-purple-300 font-mono text-[10px] font-bold uppercase">
                  🤖 Continuous 24/7 Agent Tournament • Cup #{agentTourney.tournamentNumber}
                </span>
                <h3 className="text-lg sm:text-xl font-cinzel font-black text-white mt-1.5">
                  Autonomous Shadow Clan Cup #{agentTourney.tournamentNumber}
                </h3>
                <p className="text-xs text-gray-400 mt-1">
                  Enrolled agents battle continuously. After each tournament concludes, all agents
                  enter a mandatory{' '}
                  <strong className="text-amber-300">2-Minute Rest Cooldown (120s)</strong> so
                  owners can withdraw agents or upgrade stats before the next cup begins!
                </p>
              </div>
              <div className="text-right shrink-0 bg-black/80 border border-purple-500/30 rounded-xl px-3.5 py-2">
                <div className="text-[9px] font-mono text-gray-400 uppercase">Agent Pool</div>
                <div className="text-lg font-mono font-bold text-purple-300">
                  {agentTourney.totalPoolNear.toFixed(1)} NEAR
                </div>
                <div className="text-[9px] font-mono text-shin-gold">
                  Jackpot: {agentTourney.championJackpotNear.toFixed(1)} NEAR
                </div>
              </div>
            </div>

            {/* Status Banner: Live Round vs 2-Minute Rest Cooldown */}
            {agentTourney.status === 'REST_COOLDOWN' ? (
              <div className="bg-amber-950/40 border-2 border-amber-400 rounded-xl p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div>
                  <div className="text-xs font-cinzel font-black text-amber-300 uppercase flex items-center gap-1.5">
                    <Timer size={15} /> Mandatory 2-Minute Agent Rest Window Active
                  </div>
                  <p className="text-[11px] text-gray-200 mt-0.5">
                    Last Champion:{' '}
                    <strong className="text-shin-gold">{agentTourney.lastChampionTitle}</strong> (+
                    {agentTourney.lastChampionWonNear?.toFixed(2)} NEAR). Next tournament starts in{' '}
                    <strong className="font-mono text-amber-300">
                      {formatCooldown(agentTourney.restSecondsRemaining)}
                    </strong>
                    .
                  </p>
                </div>
                <button
                  onClick={() => {
                    nearArenaEngine.stepContinuousAgentTournament(true);
                    setArenaState({ ...nearArenaEngine.getState() });
                    showToast('⏩ Rest Cooldown completed! Next Agent Tournament started.');
                  }}
                  className="px-3.5 py-2 bg-amber-400 text-black font-cinzel font-black text-[10px] uppercase rounded-lg shrink-0 flex items-center gap-1 cursor-pointer"
                >
                  <FastForward size={13} /> Skip 2m Rest &amp; Start Next Cup
                </button>
              </div>
            ) : (
              <div className="bg-purple-950/30 border border-purple-500/40 rounded-xl p-3.5 flex items-center justify-between">
                <div className="text-xs font-cinzel font-bold text-purple-200 flex items-center gap-2">
                  <Flame size={15} className="text-shin-red" />
                  <span>{agentTourney.currentRoundLabel}</span>
                </div>
                <button
                  onClick={() => {
                    const updated = nearArenaEngine.stepContinuousAgentTournament(false);
                    setArenaState({ ...nearArenaEngine.getState() });
                    if (updated.status === 'REST_COOLDOWN') {
                      showToast(
                        `🏆 ${updated.lastChampionTitle} won Cup #${updated.tournamentNumber}! 2-Min Rest Cooldown started.`,
                      );
                    } else {
                      showToast('Resolved Agent Semifinals & paid per-bout NEAR cuts!');
                    }
                  }}
                  className="px-3.5 py-1.5 bg-purple-500 hover:bg-purple-400 text-white font-cinzel font-black text-[10px] uppercase rounded-lg cursor-pointer"
                >
                  ⚡ Resolve Next Bracket Round
                </button>
              </div>
            )}

            {/* Agent Bracket Matches */}
            <div className="space-y-2.5">
              {agentTourney.matches.map((m) => (
                <div
                  key={m.id}
                  className="bg-black/75 border border-white/10 rounded-xl p-3 flex items-center justify-between gap-2"
                >
                  <div>
                    <div className="text-[10px] font-mono text-purple-300 uppercase">
                      {m.label} • Payout: +{m.boutBountyPaidNear.toFixed(2)} NEAR
                    </div>
                    <div className="text-xs font-cinzel font-bold text-white mt-0.5">
                      🤖 {m.p1Name} <span className="text-gray-500">VS</span> 🤖 {m.p2Name}
                    </div>
                  </div>
                  <span className="text-[10px] font-mono text-shin-gold">
                    {m.winnerSide
                      ? `🏆 ${m.winnerSide === 'p1' ? m.p1Name : m.p2Name}`
                      : 'In Bracket'}
                  </span>
                </div>
              ))}
            </div>

            {/* Player's Own Agents Enrollment Quick-Toggle */}
            <div className="bg-black/80 border border-white/10 rounded-xl p-3.5 space-y-2">
              <div className="text-[10px] font-cinzel font-bold text-gray-300 uppercase tracking-wider">
                Your Warriors&apos; Continuous Tournament Enrollment (Opt-Out Anytime):
              </div>
              {arenaState.fighters
                .filter((f) => !f.isNpc)
                .map((myF) => (
                  <div
                    key={myF.tokenId}
                    className="flex items-center justify-between text-xs bg-white/5 px-3 py-2 rounded-lg"
                  >
                    <div>
                      <span className="font-cinzel font-bold text-white">{myF.title}</span>
                      <span className="text-[10px] font-mono text-shin-gold ml-2">
                        ({myF.vaultBalanceNear.toFixed(1)} NEAR Vault)
                      </span>
                    </div>
                    <button
                      onClick={() => {
                        const nextState = myF.enrolledInAutoTournament === false;
                        nearArenaEngine.updateAgentConfig(myF.tokenId, {
                          enrolledInAutoTournament: nextState,
                        });
                        setArenaState({ ...nearArenaEngine.getState() });
                        showToast(
                          nextState
                            ? `${myF.title} enrolled in next Agent Tournament!`
                            : `${myF.title} withdrawn from Continuous Agent Tournaments.`,
                        );
                      }}
                      className={`px-3 py-1 rounded font-mono text-[10px] font-bold uppercase border cursor-pointer ${
                        myF.enrolledInAutoTournament !== false
                          ? 'bg-emerald-500/20 border-emerald-400 text-emerald-300'
                          : 'bg-red-500/20 border-red-400 text-red-300'
                      }`}
                    >
                      {myF.enrolledInAutoTournament !== false
                        ? '✅ Competing (Click to Withdraw)'
                        : '⏸️ Withdrawn (Click to Enroll)'}
                    </button>
                  </div>
                ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default TournamentsFlow;
