'use client';

import React, { useState, useEffect } from 'react';
import {
  nearArenaEngine,
  ActiveArenaMatch,
  COMBAT_DOCTRINES,
  AGENT_PERSONALITY_ARCHETYPES,
  AgentPersonalityArchetype,
} from '../services/nearArenaEngine';
import { Roster, CharacterId } from './PreGameFlow';
import {
  Coins,
  Shield,
  Zap,
  Trophy,
  Play,
  Plus,
  ArrowUpRight,
  ArrowDownLeft,
  Flame,
  Sparkles,
  Store,
  ScrollText,
  ExternalLink,
  CheckCircle2,
  Swords,
  Terminal,
} from 'lucide-react';

interface AgentArenaFlowProps {
  initialTab?: 'LIVE_ARENA' | 'MY_AGENTS' | 'DOJO_MARKET' | 'LEDGER';
  onWatchAgentFight: (match: ActiveArenaMatch) => void;
  onMintNewFighter: (charId: CharacterId) => void;
  onBack: () => void;
  onHome: () => void;
}

const AgentArenaFlow: React.FC<AgentArenaFlowProps> = ({
  initialTab = 'LIVE_ARENA',
  onWatchAgentFight,
  onMintNewFighter,
  onBack,
  onHome,
}) => {
  const [arenaState, setArenaState] = useState(() => nearArenaEngine.getState());
  const [activeTab, setActiveTab] = useState<'LIVE_ARENA' | 'MY_AGENTS' | 'DOJO_MARKET' | 'LEDGER'>(
    initialTab,
  );
  const [showNearUnderHood, setShowNearUnderHood] = useState<boolean>(false);
  const [selectedFighterId, setSelectedFighterId] = useState<string>(
    () => nearArenaEngine.getState().fighters.find((f) => !f.isNpc)?.tokenId || '',
  );
  const [fundAmount, setFundAmount] = useState<string>('5');
  const [withdrawAmount, setWithdrawAmount] = useState<string>('2');
  const [listPrice, setListPrice] = useState<string>('15');
  const [betAmounts, setBetAmounts] = useState<Record<string, number>>({});
  const [toast, setToast] = useState<string | null>(null);
  const [isFastForwarding, setIsFastForwarding] = useState<boolean>(false);
  const [simStep, setSimStep] = useState<number>(0);
  const [simHeadline, setSimHeadline] = useState<string>(
    'Click "Fast-Forward 7 Days" to simulate a full week of autonomous arena fights, loot drops, and NPC supply/demand price swings in 10 seconds.',
  );
  const [openReasoningId, setOpenReasoningId] = useState<string | null>('hanzo-dojo');
  const [trainerFee, setTrainerFee] = useState<string>('0.5');
  const [trainerSpecialty, setTrainerSpecialty] = useState<'ATK' | 'DEF' | 'SPD'>('ATK');
  const [targetTrainerId, setTargetTrainerId] = useState<string>('');
  const [onChainCupId, setOnChainCupId] = useState<string>('shin-cup-1');
  const [onChainEntryNear, setOnChainEntryNear] = useState<string>('0.5');

  useEffect(() => {
    setActiveTab(initialTab);
  }, [initialTab]);

  const showToast = (msg: string) => {
    setToast(msg);
    setTimeout(() => setToast(null), 3200);
  };

  useEffect(() => {
    const sync = () => setArenaState({ ...nearArenaEngine.getState() });
    window.addEventListener('nearArenaStateUpdated', sync);

    const interval = setInterval(() => {
      const current = nearArenaEngine.getState();
      if (current.activeMatches.length < 3) {
        nearArenaEngine.createImmediateAgentMatch();
      }
      setArenaState({ ...nearArenaEngine.getState() });
    }, 10000);

    return () => {
      window.removeEventListener('nearArenaStateUpdated', sync);
      clearInterval(interval);
    };
  }, []);

  const ownedFighters = arenaState.fighters.filter((f) => !f.isNpc);
  const selectedFighter =
    ownedFighters.find((f) => f.tokenId === selectedFighterId) || ownedFighters[0];

  const getCharGif = (charId: string) => {
    const found = Roster.find((r) => r.id === charId);
    return found ? `/assets/Shin_gifs/${found.gif}` : '/assets/Shin_gifs/Fighter_AllActions.gif';
  };

  const handleFaucetTopUp = () => {
    nearArenaEngine.claimFaucetOrIntentSwap();
    setArenaState({ ...nearArenaEngine.getState() });
    showToast('+15,000 $SHIN added to your SHIN Pouch!');
  };

  const handlePlaceLobbyBet = (matchId: string, side: 'p1' | 'p2', fighterName: string) => {
    const amt = betAmounts[matchId] || 1.0;
    const shinAmt = Math.round(amt * 1000);
    try {
      nearArenaEngine.placeSpectatorBet(matchId, side, amt);
      const match = arenaState.activeMatches.find((m) => m.matchId === matchId);
      const targetTokenId = side === 'p1' ? match?.p1.tokenId : match?.p2.tokenId;
      if (targetTokenId) {
        void nearArenaEngine.placeSpectatorBetShin(matchId, targetTokenId, shinAmt);
      }
      setArenaState({ ...nearArenaEngine.getState() });
      showToast(`🔥 Backed ${fighterName} with ${shinAmt.toLocaleString()} $SHIN! Click ENTER PIT to watch live!`);
    } catch (e: any) {
      showToast(e.message || 'Backing failed');
    }
  };

  const handleSpawnMyAgentMatch = () => {
    if (!selectedFighter) return;
    const match = nearArenaEngine.createImmediateAgentMatch(selectedFighter.tokenId);
    setArenaState({ ...nearArenaEngine.getState() });
    onWatchAgentFight(match);
  };

  const handleRunFastForwardSim = () => {
    if (isFastForwarding) return;
    setIsFastForwarding(true);
    setSimStep(0);
    let currentTick = 0;

    const timer = setInterval(() => {
      currentTick += 1;
      const res = nearArenaEngine.simulateEconomyDayTick();
      setSimStep(currentTick);
      setSimHeadline(res.headline);
      setArenaState({ ...nearArenaEngine.getState() });

      if (currentTick >= 7) {
        clearInterval(timer);
        setIsFastForwarding(false);
        showToast('⏩ Simulated 7 Days of Arena Combat & NPC Merchant Trading!');
      }
    }, 1400);
  };

  return (
    <div className="fixed inset-0 z-40 bg-gradient-to-b from-gray-950 via-black to-black text-white overflow-y-auto flex flex-col select-none">
      {/* Toast Notification */}
      {toast && (
        <div className="fixed top-20 left-1/2 -translate-x-1/2 z-[100] bg-shin-gold text-black font-cinzel font-black text-xs md:text-sm px-6 py-3 rounded-full shadow-[0_0_30px_rgba(251,191,36,0.9)] flex items-center gap-2 animate-in fade-in slide-in-from-top-4">
          <CheckCircle2 size={18} />
          <span>{toast}</span>
        </div>
      )}

      {/* =====================================================================
          TOP BAR (Game-First War Chest + Optional NEAR Judge Inspector Switch)
         ===================================================================== */}
      <div className="sticky top-0 z-50 bg-black/90 border-b border-white/10 px-3 sm:px-6 md:px-8 py-2.5 sm:py-3.5 flex flex-wrap items-center justify-between gap-2 sm:gap-4 backdrop-blur-md">
        <div className="flex items-center gap-2 sm:gap-4">
          <button
            onClick={onBack}
            className="text-gray-400 hover:text-white font-cinzel font-bold text-[10px] sm:text-xs uppercase tracking-widest flex items-center gap-1 cursor-pointer"
          >
            <span>←</span> <span className="hidden xs:inline">Title</span> Hall
          </button>
          <div className="h-4 w-px bg-white/15" />
          <div>
            <h1 className="text-sm sm:text-lg md:text-2xl font-cinzel font-black tracking-[0.12em] sm:tracking-[0.2em] text-white uppercase flex items-center gap-1.5 sm:gap-2.5">
              <Flame size={16} className="text-shin-red shrink-0" />
              <span>SHADOW BUDŌKAN</span>
            </h1>
          </div>
        </div>

        {/* Right: War Chest + NEAR Judge View Switch */}
        <div className="flex items-center gap-2 sm:gap-3">
          {/* Toggle NEAR Under-the-Hood details for Judges */}
          <button
            onClick={() => setShowNearUnderHood(!showNearUnderHood)}
            className={`px-2 sm:px-3 py-1 sm:py-1.5 rounded-lg text-[10px] sm:text-[11px] font-mono border flex items-center gap-1 transition-all cursor-pointer ${
              showNearUnderHood
                ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/50'
                : 'bg-white/5 text-gray-400 border-white/10 hover:text-white'
            }`}
            title="Toggle NEAR Sub-Account & Contract Inspector"
          >
            <Terminal size={12} />
            <span>{showNearUnderHood ? 'NEAR: ON' : 'NEAR View'}</span>
          </button>

          {/* Player War Chest */}
          <div className="bg-white/5 border border-shin-gold/40 rounded-xl px-2.5 sm:px-3.5 py-1 sm:py-1.5 flex items-center gap-2 sm:gap-3">
            <Coins size={14} className="text-shin-gold shrink-0" />
            <div>
              <div className="text-[8px] sm:text-[9px] text-gray-400 uppercase tracking-wider truncate max-w-[90px] sm:max-w-none">
                {showNearUnderHood ? arenaState.playerWallet.accountId : 'SHIN Pouch'}
              </div>
              <div className="text-[11px] sm:text-sm font-mono font-bold text-shin-gold">
                {Math.round(arenaState.playerWallet.NEAR * 1000).toLocaleString()} $SHIN
              </div>
            </div>
            <button
              onClick={handleFaucetTopUp}
              className="px-2 py-1 bg-shin-gold text-black rounded text-[9px] sm:text-[10px] font-cinzel font-black uppercase tracking-wider hover:bg-yellow-400 transition-all cursor-pointer"
            >
              + Refill
            </button>
          </div>

          <button
            onClick={onHome}
            className="text-gray-400 hover:text-shin-red font-cinzel font-bold text-xs uppercase tracking-widest px-2.5 py-1.5 border border-white/10 rounded-lg cursor-pointer"
          >
            ✕
          </button>
        </div>
      </div>

      {/* =====================================================================
          ARCADE NAVIGATION BLADES
         ===================================================================== */}
      <div className="px-3 sm:px-6 md:px-8 pt-3 sm:pt-5 pb-2 max-w-7xl mx-auto w-full flex flex-col lg:flex-row lg:items-center justify-between gap-2.5 sm:gap-3">
        <div className="flex items-center gap-2 overflow-x-auto pb-1 w-full lg:w-auto">
          {[
            { id: 'LIVE_ARENA', label: '🔥 Shōbu Pit', icon: Flame },
            {
              id: 'MY_AGENTS',
              label: `⚔ Shinobi Clan (${ownedFighters.length})`,
              icon: Shield,
            },
            { id: 'DOJO_MARKET', label: "🏮 Dojo & Bazaar", icon: Store },
            { id: 'LEDGER', label: '📜 Chronicle', icon: ScrollText },
          ].map((tab) => {
            const Icon = tab.icon;
            const active = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id as any)}
                className={`arcade-skew px-3.5 sm:px-5 py-2 sm:py-2.5 font-cinzel text-[11px] sm:text-xs font-black tracking-wider uppercase border transition-all shrink-0 cursor-pointer ${
                  active
                    ? 'bg-shin-red text-white border-white shadow-[0_0_20px_rgba(255,42,42,0.5)]'
                    : 'bg-white/5 text-gray-300 border-white/15 hover:border-shin-gold/50 hover:text-white'
                }`}
              >
                <div className="arcade-unskew flex items-center gap-1.5 sm:gap-2 whitespace-nowrap">
                  <Icon size={14} />
                  <span>{tab.label}</span>
                </div>
              </button>
            );
          })}
        </div>

        <button
          onClick={handleSpawnMyAgentMatch}
          className="w-full lg:w-auto arcade-skew px-5 py-2.5 bg-shin-gold text-black font-cinzel font-black text-xs tracking-widest uppercase hover:bg-yellow-400 transition-all shadow-[0_0_25px_rgba(251,191,36,0.45)] cursor-pointer"
        >
          <div className="arcade-unskew flex items-center justify-center gap-2">
            <Play size={14} fill="currentColor" />
            <span>Send {selectedFighter?.title || 'Shinobi'} Into Pit Now</span>
          </div>
        </button>
      </div>

      {/* =====================================================================
          MAIN CONTENT CONTAINER
         ===================================================================== */}
      <div className="flex-1 max-w-7xl mx-auto w-full px-4 md:px-8 py-5">
        {/* ============================================================
            TAB 1: COLOSSEUM PIT (LIVE AI DUELS & CROWD BACKING)
           ============================================================ */}
        {activeTab === 'LIVE_ARENA' && (
          <div className="space-y-6">
            {/* Atmospheric Colosseum Intro Banner */}
            <div className="bg-gradient-to-r from-red-950/50 via-black to-amber-950/40 border border-shin-gold/30 rounded-2xl p-5 flex flex-col md:flex-row items-center justify-between gap-4">
              <div className="space-y-1">
                <div className="text-xs font-cinzel font-black text-shin-gold uppercase tracking-widest flex items-center gap-2">
                  <Sparkles size={15} /> Non-Stop Shadow Battles • Winner Takes The Fight Pot
                </div>
                <p className="text-xs md:text-sm text-gray-300 max-w-3xl">
                  Warriors in the Budōkan stake their own{' '}
                  <span className="text-shin-gold font-semibold">SHIN Pouch</span> into each match
                  pot and fight autonomously using their learned Fighting Style. Back either corner
                  before or during the fight to win a share of the{' '}
                  <span className="text-emerald-400 font-semibold">Crowd Pot</span>!
                </p>
              </div>
              <div className="flex gap-3 shrink-0">
                <div className="bg-black/80 border border-white/10 px-4 py-2 rounded-xl text-center">
                  <div className="text-[9px] text-gray-400 uppercase">Warriors in Pit</div>
                  <div className="text-lg font-mono font-bold text-white">
                    {arenaState.fighters.filter((f) => f.isAgentActive).length}
                  </div>
                </div>
                <div className="bg-black/80 border border-shin-gold/30 px-4 py-2 rounded-xl text-center">
                  <div className="text-[9px] text-gray-400 uppercase">Dojo Sensei Fee</div>
                  <div className="text-lg font-mono font-bold text-shin-gold">
                    {Math.round(arenaState.npcDojo.currentDynamicCostNear * 1000).toLocaleString()} $SHIN
                  </div>
                </div>
              </div>
            </div>

            {/* Arcade VS Fight Posters Grid */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              {arenaState.activeMatches.map((match) => {
                const totalSpec = match.spectatorPoolP1Near + match.spectatorPoolP2Near;
                const p1Odds =
                  match.spectatorPoolP1Near > 0
                    ? ((totalSpec * 0.95) / match.spectatorPoolP1Near).toFixed(2)
                    : '1.90';
                const p2Odds =
                  match.spectatorPoolP2Near > 0
                    ? ((totalSpec * 0.95) / match.spectatorPoolP2Near).toFixed(2)
                    : '1.90';
                const currentBetAmt = betAmounts[match.matchId] ?? 1.0;

                return (
                  <div
                    key={match.matchId}
                    className="bg-gradient-to-b from-gray-900/95 via-black to-black border-2 border-white/15 hover:border-shin-gold rounded-2xl p-5 flex flex-col justify-between transition-all shadow-[0_0_30px_rgba(0,0,0,0.8)] relative overflow-hidden group"
                  >
                    {/* Top Match Header */}
                    <div className="flex items-center justify-between mb-3">
                      <span className="text-[10px] font-cinzel text-gray-300 bg-white/5 px-2.5 py-1 rounded border border-white/10">
                        👁 {match.viewers} Watching
                      </span>
                      <span className="bg-shin-red/20 text-shin-red border border-shin-red/50 text-[10px] font-cinzel font-black px-3 py-0.5 rounded-full flex items-center gap-1.5">
                        <span className="w-2 h-2 rounded-full bg-shin-red animate-ping" />
                        FIGHT POT: {Math.round(match.fighterPoolNear * 1000).toLocaleString()} $SHIN
                      </span>
                    </div>

                    {/* Visual VS Stage */}
                    <div className="grid grid-cols-11 items-center bg-gradient-to-r from-amber-950/30 via-black to-red-950/30 border border-white/10 rounded-xl p-3 mb-4 relative">
                      {/* Fighter 1 */}
                      <div className="col-span-5 flex flex-col items-center text-center">
                        <div className="relative w-24 h-24 flex items-end justify-center overflow-hidden">
                          <img
                            src={getCharGif(match.p1.charId)}
                            alt={match.p1.name}
                            className="w-24 h-24 object-contain scale-125 origin-bottom"
                            style={{ imageRendering: 'pixelated' }}
                          />
                        </div>
                        <div className="font-cinzel font-black text-xs text-white mt-1 truncate w-full">
                          {match.p1.title}
                        </div>
                        <div className="text-[10px] text-shin-gold font-mono font-bold">
                          Lv.{match.p1.powerLevel} • {match.p1.wins}W/{match.p1.losses}L
                        </div>
                        {showNearUnderHood && (
                          <div className="text-[8px] text-emerald-400 font-mono truncate w-full mt-0.5">
                            {match.p1.agentWalletId}
                          </div>
                        )}
                      </div>

                      {/* VS Emblem */}
                      <div className="col-span-1 flex flex-col items-center justify-center">
                        <div className="w-8 h-8 rounded-full bg-shin-red/20 border border-shin-red flex items-center justify-center font-cinzel font-black text-xs text-shin-red shadow-[0_0_15px_rgba(255,42,42,0.6)]">
                          VS
                        </div>
                      </div>

                      {/* Fighter 2 */}
                      <div className="col-span-5 flex flex-col items-center text-center">
                        <div className="relative w-24 h-24 flex items-end justify-center overflow-hidden">
                          <img
                            src={getCharGif(match.p2.charId)}
                            alt={match.p2.name}
                            className="w-24 h-24 object-contain scale-x-[-1.25] scale-y-125 origin-bottom"
                            style={{ imageRendering: 'pixelated' }}
                          />
                        </div>
                        <div className="font-cinzel font-black text-xs text-white mt-1 truncate w-full">
                          {match.p2.title}
                        </div>
                        <div className="text-[10px] text-red-400 font-mono font-bold">
                          Lv.{match.p2.powerLevel} • {match.p2.wins}W/{match.p2.losses}L
                        </div>
                        {showNearUnderHood && (
                          <div className="text-[8px] text-emerald-400 font-mono truncate w-full mt-0.5">
                            {match.p2.agentWalletId}
                          </div>
                        )}
                      </div>
                    </div>

                    {/* Pots Overview */}
                    <div className="grid grid-cols-2 gap-2 mb-3 text-center">
                      <div className="bg-shin-gold/10 border border-shin-gold/30 rounded-lg p-2">
                        <div className="text-[9px] text-gray-400 uppercase">Warrior Winner Pot</div>
                        <div className="text-sm font-mono font-bold text-shin-gold">
                          {Math.round(match.fighterPoolNear * 1000).toLocaleString()} $SHIN
                        </div>
                      </div>
                      <div className="bg-emerald-500/10 border border-emerald-500/30 rounded-lg p-2">
                        <div className="text-[9px] text-gray-400 uppercase">Crowd Backing Pot</div>
                        <div className="text-sm font-mono font-bold text-emerald-400">
                          {Math.round(totalSpec * 1000).toLocaleString()} $SHIN
                        </div>
                      </div>
                    </div>

                    {/* Quick Crowd Backing Bar */}
                    <div className="space-y-2 mb-4 bg-white/5 p-3 rounded-xl border border-white/10">
                      <div className="flex items-center justify-between text-[10px] text-gray-300 font-cinzel uppercase tracking-wider">
                        <span>Back a Warrior ($SHIN)</span>
                        <div className="flex gap-1">
                          {[0.5, 1, 2, 5].map((val) => (
                            <button
                              key={val}
                              onClick={() =>
                                setBetAmounts((prev) => ({ ...prev, [match.matchId]: val }))
                              }
                              className={`px-2 py-0.5 rounded font-mono text-[10px] border cursor-pointer ${
                                currentBetAmt === val
                                  ? 'bg-shin-gold text-black border-shin-gold font-bold'
                                  : 'bg-black/60 text-gray-400 border-white/10'
                              }`}
                            >
                              {(val * 1000).toLocaleString()} $SHIN
                            </button>
                          ))}
                        </div>
                      </div>

                      <div className="grid grid-cols-2 gap-2">
                        <button
                          onClick={() =>
                            handlePlaceLobbyBet(match.matchId, 'p1', match.p1.title)
                          }
                          className="py-2 px-2.5 bg-amber-950/70 hover:bg-amber-800 border border-shin-gold/50 rounded-lg text-xs font-cinzel font-bold text-shin-gold flex items-center justify-between cursor-pointer"
                        >
                          <span className="truncate">Back {match.p1.name}</span>
                          <span className="font-mono text-white">{p1Odds}x</span>
                        </button>
                        <button
                          onClick={() =>
                            handlePlaceLobbyBet(match.matchId, 'p2', match.p2.title)
                          }
                          className="py-2 px-2.5 bg-red-950/70 hover:bg-red-800 border border-shin-red/50 rounded-lg text-xs font-cinzel font-bold text-red-300 flex items-center justify-between cursor-pointer"
                        >
                          <span className="truncate">Back {match.p2.name}</span>
                          <span className="font-mono text-white">{p2Odds}x</span>
                        </button>
                      </div>
                    </div>

                    {/* Enter Live 2D Fight Button */}
                    <button
                      onClick={() => onWatchAgentFight(match)}
                      className="w-full py-3.5 bg-gradient-to-r from-shin-red to-red-700 hover:from-red-500 hover:to-red-600 text-white font-cinzel font-black text-xs tracking-[0.2em] uppercase rounded-xl shadow-[0_0_20px_rgba(255,42,42,0.4)] transition-all flex items-center justify-center gap-2 cursor-pointer"
                    >
                      <Swords size={15} />
                      <span>ENTER PIT &amp; WATCH LIVE</span>
                    </button>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* ============================================================
            TAB 2: CHAMPION BARRACKS (WAR CHEST, STAKES & AI DOCTRINE)
           ============================================================ */}
        {activeTab === 'MY_AGENTS' && (
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
            {/* Left Column: Owned Champions Roster */}
            <div className="lg:col-span-4 space-y-4">
              <div className="flex items-center justify-between">
                <h2 className="text-sm font-cinzel font-black uppercase tracking-widest text-shin-gold">
                  Your Roster ({ownedFighters.length})
                </h2>
                <button
                  onClick={() => onMintNewFighter('kunoichi')}
                  className="px-3 py-1.5 bg-shin-gold text-black font-cinzel font-black text-[10px] uppercase tracking-wider rounded-lg flex items-center gap-1 hover:bg-yellow-400 cursor-pointer"
                >
                  <Plus size={12} /> Awaken New Warrior
                </button>
              </div>

              <div className="space-y-3">
                {ownedFighters.map((fighter) => {
                  const isSelected = selectedFighter?.tokenId === fighter.tokenId;
                  return (
                    <div
                      key={fighter.tokenId}
                      onClick={() => setSelectedFighterId(fighter.tokenId)}
                      className={`p-4 rounded-xl border-2 transition-all cursor-pointer flex items-center gap-4 ${
                        isSelected
                          ? 'bg-shin-gold/15 border-shin-gold shadow-[0_0_25px_rgba(251,191,36,0.25)]'
                          : 'bg-white/5 border-white/10 hover:border-white/30'
                      }`}
                    >
                      <img
                        src={getCharGif(fighter.charId)}
                        alt={fighter.name}
                        className="w-16 h-16 object-contain bg-black/70 rounded-xl p-1 border border-white/15"
                        style={{ imageRendering: 'pixelated' }}
                      />
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between">
                          <span className="font-cinzel font-black text-sm text-white truncate">
                            {fighter.title}
                          </span>
                          <span className="text-[10px] font-mono font-bold bg-shin-gold text-black px-2 py-0.5 rounded">
                            LV.{fighter.powerLevel}
                          </span>
                        </div>
                        {showNearUnderHood && (
                          <div className="text-[9px] text-emerald-400 font-mono truncate mt-0.5">
                            {fighter.agentWalletId}
                          </div>
                        )}
                        <div className="flex items-center justify-between mt-2 text-xs font-mono">
                          <span className="text-shin-gold font-bold">
                            Pouch: {Math.round(fighter.vaultBalanceNear * 1000).toLocaleString()} $SHIN
                          </span>
                          <span className="text-gray-400">
                            {fighter.wins}W - {fighter.losses}L
                          </span>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Right Column: Champion Command Deck */}
            {selectedFighter && (
              <div className="lg:col-span-8 bg-gray-950/95 border-2 border-white/15 rounded-2xl p-6 space-y-6">
                <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-white/10 pb-5">
                  <div className="flex items-center gap-4">
                    <div className="w-24 h-24 bg-gradient-to-b from-amber-950/40 to-black border-2 border-shin-gold/50 rounded-2xl flex items-center justify-center overflow-hidden">
                      <img
                        src={getCharGif(selectedFighter.charId)}
                        alt={selectedFighter.name}
                        className="w-20 h-20 object-contain scale-125"
                        style={{ imageRendering: 'pixelated' }}
                      />
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <h3 className="text-xl md:text-2xl font-cinzel font-black text-white uppercase">
                          {selectedFighter.title}
                        </h3>
                        <span className="text-xs font-mono bg-shin-gold text-black font-black px-2.5 py-0.5 rounded">
                          LV.{selectedFighter.powerLevel}
                        </span>
                      </div>
                      {showNearUnderHood && (
                        <div className="text-xs font-mono text-gray-400 mt-1 flex items-center gap-2">
                          <span>Sub-Account Wallet:</span>
                          <span className="text-emerald-400">{selectedFighter.agentWalletId}</span>
                          <a
                            href={`https://testnet.nearblocks.io/address/${selectedFighter.agentWalletId}`}
                            target="_blank"
                            rel="noreferrer"
                            className="text-blue-400 hover:underline inline-flex items-center gap-0.5"
                          >
                            Explorer <ExternalLink size={11} />
                          </a>
                        </div>
                      )}
                      <div className="flex flex-wrap gap-4 mt-2.5 text-xs font-mono text-gray-300">
                        <span>
                          ATK: <strong className="text-red-400">{selectedFighter.atk}</strong>
                        </span>
                        <span>
                          DEF: <strong className="text-emerald-400">{selectedFighter.def}</strong>
                        </span>
                        <span>
                          SPD: <strong className="text-blue-400">{selectedFighter.spd}</strong>
                        </span>
                        <span>
                          RANK: <strong className="text-shin-gold">{selectedFighter.elo} ELO</strong>
                        </span>
                        <span>
                          SPOILS WON:{' '}
                          <strong className="text-emerald-400">
                            +{Math.round(selectedFighter.totalEarningsNear * 1000).toLocaleString()} $SHIN
                          </strong>
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* Shadow Arena Deployment Switch */}
                  <button
                    onClick={() => {
                      nearArenaEngine.updateAgentConfig(selectedFighter.tokenId, {
                        isAgentActive: !selectedFighter.isAgentActive,
                      });
                      setArenaState({ ...nearArenaEngine.getState() });
                      showToast(
                        !selectedFighter.isAgentActive
                          ? `${selectedFighter.title} entered the 24/7 Shadow Budōkan!`
                          : `${selectedFighter.title} returned to the Dojo.`,
                      );
                    }}
                    className={`px-5 py-3 rounded-xl font-cinzel font-black text-xs uppercase tracking-widest border-2 transition-all cursor-pointer ${
                      selectedFighter.isAgentActive
                        ? 'bg-emerald-500/20 border-emerald-400 text-emerald-300 shadow-[0_0_20px_rgba(16,185,129,0.35)]'
                        : 'bg-white/5 border-white/20 text-gray-400'
                    }`}
                  >
                    {selectedFighter.isAgentActive
                      ? '🟢 FIGHTING IN BUDŌKAN'
                      : '⚪ SEND TO BUDŌKAN'}
                  </button>
                </div>

                {/* Champion War Chest Management */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="bg-black/70 border border-shin-gold/40 rounded-xl p-4 space-y-3">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-cinzel font-bold text-shin-gold uppercase tracking-wider">
                        Warrior&apos;s SHIN Pouch
                      </span>
                      <span className="text-xl font-mono font-bold text-shin-gold">
                        {Math.round(selectedFighter.vaultBalanceNear * 1000).toLocaleString()} $SHIN
                      </span>
                    </div>
                    <p className="text-[11px] text-gray-400">
                      Load $SHIN into this warrior&apos;s personal SHIN Pouch so they can keep entering
                      winner-takes-all Budōkan pools.
                    </p>
                    <div className="flex gap-1.5">
                      {[2, 5, 10].map((quickAmt) => (
                        <button
                          key={quickAmt}
                          onClick={() => {
                            try {
                              nearArenaEngine.fundAgentWallet(selectedFighter.tokenId, quickAmt);
                              nearArenaEngine.fundFighterShin(selectedFighter.tokenId, quickAmt * 1000).catch(() => {});
                              setArenaState({ ...nearArenaEngine.getState() });
                              showToast(
                                `Added +${(quickAmt * 1000).toLocaleString()} $SHIN to ${selectedFighter.title}'s SHIN Pouch!`,
                              );
                            } catch (e: any) {
                              showToast(e.message);
                            }
                          }}
                          className="flex-1 py-2 bg-shin-gold/20 hover:bg-shin-gold hover:text-black text-shin-gold border border-shin-gold/50 rounded-lg font-mono font-bold text-xs transition-all cursor-pointer"
                        >
                          +{(quickAmt * 1000).toLocaleString()} $SHIN
                        </button>
                      ))}
                    </div>
                  </div>

                  <div className="bg-black/70 border border-white/15 rounded-xl p-4 space-y-3">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-cinzel font-bold text-gray-300 uppercase tracking-wider">
                        Collect Warrior Spoils
                      </span>
                      <span className="text-xs font-mono text-emerald-400">
                        Instant Transfer
                      </span>
                    </div>
                    <p className="text-[11px] text-gray-400">
                      Move winnings from this Warrior&apos;s SHIN Pouch back into your main SHIN Pouch
                      at any time.
                    </p>
                    <div className="flex gap-2">
                      <input
                        type="number"
                        min="0.5"
                        step="0.5"
                        value={withdrawAmount}
                        onChange={(e) => setWithdrawAmount(e.target.value)}
                        className="w-24 bg-black border border-white/20 rounded-lg px-3 py-2 text-sm font-mono text-white"
                      />
                      <button
                        onClick={() => {
                          try {
                            const amt = Number(withdrawAmount);
                            nearArenaEngine.withdrawFromAgentWallet(
                              selectedFighter.tokenId,
                              amt,
                            );
                            nearArenaEngine.withdrawFighterShin(
                              selectedFighter.tokenId,
                              Math.round(amt * 1000),
                            ).catch(() => {});
                            setArenaState({ ...nearArenaEngine.getState() });
                            showToast(`Collected ${Math.round(amt * 1000).toLocaleString()} $SHIN from ${selectedFighter.title}!`);
                          } catch (e: any) {
                            showToast(e.message);
                          }
                        }}
                        className="flex-1 bg-white/10 hover:bg-white/20 text-white font-cinzel font-bold text-xs uppercase tracking-wider rounded-lg px-4 py-2 flex items-center justify-center gap-1.5 cursor-pointer"
                      >
                        <ArrowUpRight size={14} /> Collect Spoils
                      </button>
                    </div>
                  </div>
                </div>

                {/* Per-Fight Stake Limit & Auto-Dojo Training */}
                <div className="bg-white/5 border border-white/10 rounded-xl p-4 space-y-4">
                  <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
                    <div>
                      <div className="text-xs font-cinzel font-black text-shin-gold uppercase tracking-wider">
                        Fight Stake Per Match (Pool Entry)
                      </div>
                      <div className="text-[11px] text-gray-400">
                        Amount your Champion puts on the line in each Budōkan duel (Winner takes
                        both stakes).
                      </div>
                    </div>
                    <div className="flex gap-2">
                      {[0.5, 1.0, 2.0, 5.0, 10.0].map((stake) => (
                        <button
                          key={stake}
                          onClick={() => {
                            nearArenaEngine.updateAgentConfig(selectedFighter.tokenId, {
                              wagerPerFightNear: stake,
                            });
                            setArenaState({ ...nearArenaEngine.getState() });
                            showToast(`Set Fight Stake to ${(stake * 1000).toLocaleString()} $SHIN per match`);
                          }}
                          className={`px-3 py-2 rounded-lg font-mono text-xs font-bold border transition-all cursor-pointer ${
                            selectedFighter.wagerPerFightNear === stake
                              ? 'bg-shin-gold text-black border-shin-gold'
                              : 'bg-black/60 text-gray-400 border-white/10 hover:border-white/30'
                          }`}
                        >
                          {(stake * 1000).toLocaleString()}
                        </button>
                      ))}
                    </div>
                  </div>

                  <div className="flex items-center justify-between pt-3 border-t border-white/10">
                    <div>
                      <div className="text-xs font-cinzel font-bold text-white uppercase tracking-wider">
                        Automatic Sensei Training After Wins
                      </div>
                      <div className="text-[11px] text-gray-400">
                        Automatically spend a portion of fight winnings at Master Hanzo&apos;s Dojo to
                        level up stats.
                      </div>
                    </div>
                    <button
                      onClick={() => {
                        nearArenaEngine.updateAgentConfig(selectedFighter.tokenId, {
                          autoTrainAtDojo: !selectedFighter.autoTrainAtDojo,
                        });
                        setArenaState({ ...nearArenaEngine.getState() });
                      }}
                      className={`px-4 py-1.5 rounded-full text-xs font-cinzel font-bold border cursor-pointer ${
                        selectedFighter.autoTrainAtDojo
                          ? 'bg-shin-gold/20 border-shin-gold text-shin-gold'
                          : 'bg-black/60 border-white/20 text-gray-500'
                      }`}
                    >
                      {selectedFighter.autoTrainAtDojo ? 'AUTO-TRAIN: ON' : 'AUTO-TRAIN: OFF'}
                    </button>
                  </div>
                </div>

                {/* Fighting Style (Combat AI Doctrine) */}
                <div className="space-y-3">
                  <div className="text-xs font-cinzel font-black text-white uppercase tracking-widest">
                    Shadow Fighting Style (AI Combat Doctrine)
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    {COMBAT_DOCTRINES.map((doc) => {
                      const active = selectedFighter.doctrine === doc.id;
                      return (
                        <button
                          key={doc.id}
                          onClick={() => {
                            nearArenaEngine.updateAgentConfig(selectedFighter.tokenId, {
                              doctrine: doc.id,
                            });
                            setArenaState({ ...nearArenaEngine.getState() });
                            showToast(`Fighting Style set to ${doc.name}`);
                          }}
                          className={`p-3.5 rounded-xl border-2 text-left transition-all cursor-pointer ${
                            active
                              ? 'bg-shin-red/15 border-shin-red shadow-[0_0_15px_rgba(255,42,42,0.25)]'
                              : 'bg-black/50 border-white/10 hover:border-white/30'
                          }`}
                        >
                          <div className="flex items-center justify-between mb-1">
                            <span className="font-cinzel font-bold text-xs text-white">
                              {doc.name}
                            </span>
                            <span className="text-[10px] font-mono text-shin-gold">
                              {doc.badge}
                            </span>
                          </div>
                          <p className="text-[11px] text-gray-400 leading-relaxed">{doc.desc}</p>
                        </button>
                      );
                    })}
                  </div>
                </div>

                {/* ============================================================
                    AGENT SOCIAL PERSONALITY, DIALOGUE & CONTINUOUS TOURNAMENT
                   ============================================================ */}
                <div className="bg-black/70 border border-shin-gold/30 rounded-xl p-4 space-y-4">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-white/10 pb-3">
                    <div>
                      <div className="text-xs font-cinzel font-black text-shin-gold uppercase tracking-wider">
                        Continuous 24/7 Agent Tournament Enrollment
                      </div>
                      <p className="text-[11px] text-gray-400">
                        Enrolled warriors automatically enter bracket cups, win per-bout $SHIN cuts +
                        Budōkan jackpots, and take a 2-minute rest cooldown between tournaments.
                      </p>
                    </div>
                    <div className="flex flex-wrap gap-2">
                      <button
                        onClick={() => {
                          const nextState = selectedFighter.enrolledInAutoTournament === false;
                          nearArenaEngine.updateAgentConfig(selectedFighter.tokenId, {
                            enrolledInAutoTournament: nextState,
                            withdrawAfterCurrentTournament: false,
                          });
                          setArenaState({ ...nearArenaEngine.getState() });
                          showToast(
                            nextState
                              ? `${selectedFighter.title} enrolled in Continuous Agent Tournaments!`
                              : `${selectedFighter.title} removed from Continuous Agent Tournaments.`,
                          );
                        }}
                        className={`px-3.5 py-2 rounded-lg font-cinzel font-bold text-[10px] uppercase tracking-wider border cursor-pointer ${
                          selectedFighter.enrolledInAutoTournament !== false
                            ? 'bg-emerald-500/20 border-emerald-400 text-emerald-300'
                            : 'bg-white/5 border-white/20 text-gray-400'
                        }`}
                      >
                        {selectedFighter.enrolledInAutoTournament !== false
                          ? '🏆 TOURNAMENT: ENROLLED'
                          : '⚪ TOURNAMENT: RESTING'}
                      </button>

                      {selectedFighter.enrolledInAutoTournament !== false && (
                        <button
                          onClick={() => {
                            const nextW = !selectedFighter.withdrawAfterCurrentTournament;
                            nearArenaEngine.updateAgentConfig(selectedFighter.tokenId, {
                              withdrawAfterCurrentTournament: nextW,
                            });
                            setArenaState({ ...nearArenaEngine.getState() });
                            showToast(
                              nextW
                                ? `${selectedFighter.title} will withdraw during the next 2-min Rest Cooldown.`
                                : `Cancelled post-tournament withdrawal for ${selectedFighter.title}.`,
                            );
                          }}
                          className={`px-3 py-2 rounded-lg font-mono text-[10px] uppercase border cursor-pointer ${
                            selectedFighter.withdrawAfterCurrentTournament
                              ? 'bg-amber-500/20 border-amber-400 text-amber-300'
                              : 'bg-black/60 border-white/15 text-gray-400 hover:text-white'
                          }`}
                        >
                          {selectedFighter.withdrawAfterCurrentTournament
                            ? '⏸️ Withdraw Queued After Cup'
                            : 'Withdraw After Cup'}
                        </button>
                      )}
                    </div>
                  </div>

                  {/* Programmable Lobby Personality & Custom Dialogue */}
                  <div className="space-y-3">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-cinzel font-black text-white uppercase tracking-wider">
                        Programmable Lobby Personality &amp; Challenge Dialogue
                      </span>
                      <span className="text-[10px] font-mono text-shin-gold">
                        Talks to Humans &amp; Agents in Live Lobby
                      </span>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                      {AGENT_PERSONALITY_ARCHETYPES.map((arch) => {
                        const currentArch =
                          selectedFighter.personality?.archetype || 'HONORABLE_SAMURAI';
                        const isSelectedArch = currentArch === arch.id;
                        return (
                          <button
                            key={arch.id}
                            onClick={() => {
                              nearArenaEngine.updateAgentConfig(selectedFighter.tokenId, {
                                personality: {
                                  archetype: arch.id as AgentPersonalityArchetype,
                                  greetingLine: arch.defaultGreeting,
                                  challengeAcceptLine: arch.defaultChallengeReply,
                                  victoryLine: arch.defaultVictoryLine,
                                  minWagerNear: selectedFighter.wagerPerFightNear,
                                },
                              });
                              setArenaState({ ...nearArenaEngine.getState() });
                              showToast(`${selectedFighter.title} personality set to ${arch.name}!`);
                            }}
                            className={`p-3 rounded-xl border text-left transition-all cursor-pointer ${
                              isSelectedArch
                                ? 'bg-shin-gold/15 border-shin-gold'
                                : 'bg-black/60 border-white/10 hover:border-white/25'
                            }`}
                          >
                            <div className="flex items-center justify-between mb-1">
                              <span className="font-cinzel font-bold text-xs text-white">
                                {arch.name}
                              </span>
                              <span className="text-[9px] font-mono text-shin-gold">
                                {arch.badge}
                              </span>
                            </div>
                            <p className="text-[10px] text-gray-400 leading-relaxed">{arch.desc}</p>
                          </button>
                        );
                      })}
                    </div>

                    {/* Custom Greeting / Trash-Talk Line Editor */}
                    <div className="pt-2 space-y-2">
                      <label className="block text-[10px] font-mono text-gray-400 uppercase">
                        Custom Lobby Greeting &amp; Challenge Response Line:
                      </label>
                      <div className="flex gap-2">
                        <input
                          type="text"
                          value={
                            selectedFighter.personality?.greetingLine ||
                            'My blade is drawn in honor. Step into the dojo if your spirit is steady.'
                          }
                          onChange={(e) => {
                            const existing = selectedFighter.personality || {
                              archetype: 'HONORABLE_SAMURAI' as AgentPersonalityArchetype,
                              greetingLine: '',
                              challengeAcceptLine:
                                'A worthy challenge! I accept your terms under the Bushido code.',
                              victoryLine: 'Your technique was fierce, warrior.',
                              minWagerNear: selectedFighter.wagerPerFightNear,
                            };
                            nearArenaEngine.updateAgentConfig(selectedFighter.tokenId, {
                              personality: {
                                ...existing,
                                greetingLine: e.target.value,
                              },
                            });
                            setArenaState({ ...nearArenaEngine.getState() });
                          }}
                          className="flex-1 bg-black border border-white/20 rounded-lg px-3 py-2 text-xs text-white font-sans"
                          placeholder="Enter how your agent talks to humans & agents in the lobby..."
                        />
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>
        )}

        {/* ============================================================
            TAB 3: MASTER HANZO'S DOJO, BLACKSMITH KENJI & WARRIOR BAZAAR
           ============================================================ */}
        {activeTab === 'DOJO_MARKET' && (
          <div className="space-y-8">
            {/* FAST-FORWARD 7-DAY ECONOMY SIMULATOR + PLAYER NEP-245 SATCHEL */}
            <div className="bg-gradient-to-r from-purple-950/50 via-black to-amber-950/30 border-2 border-purple-500/40 rounded-2xl p-5 flex flex-col lg:flex-row items-start lg:items-center justify-between gap-4">
              <div className="space-y-1.5 flex-1">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="text-[10px] font-mono font-bold uppercase px-2.5 py-0.5 rounded bg-purple-500/20 text-purple-300 border border-purple-500/40">
                    NEP-245 Multi-Token Economy • Supply &amp; Demand Pricing
                  </span>
                  <span className="text-[10px] font-mono text-gray-400">
                    Total Simulated Days: <strong className="text-white">{arenaState.simulatedDaysElapsed || 0}</strong>
                  </span>
                  {showNearUnderHood && (
                    <span className="text-[10px] font-mono text-shin-gold">
                      Config: client/app/config/npcMerchantConfig.ts
                    </span>
                  )}
                </div>
                <h2 className="text-lg md:text-xl font-cinzel font-black text-white">
                  ⏩ Fast-Forward Economy Simulator (1 Week of Autonomous Trading)
                </h2>
                <p className="text-xs text-gray-300 font-sans">{simHeadline}</p>
                {isFastForwarding && (
                  <div className="w-full max-w-md h-2 bg-black/80 rounded-full overflow-hidden border border-purple-500/40 mt-2">
                    <div
                      className="h-full bg-gradient-to-r from-purple-500 to-shin-gold transition-all duration-500"
                      style={{ width: `${(simStep / 7) * 100}%` }}
                    />
                  </div>
                )}
              </div>

              <div className="flex flex-wrap items-center gap-3 shrink-0">
                {/* Player Gathered NEP-245 Materials */}
                <div className="bg-black/80 border border-white/15 rounded-xl px-3.5 py-2 flex items-center gap-3 text-xs font-mono">
                  <div>
                    <div className="text-[9px] text-gray-400 uppercase">⛏️ Tamahagane Steel</div>
                    <div className="text-sm font-bold text-white">
                      {arenaState.playerItems?.['material:tamahagane-steel'] ?? 0} units
                    </div>
                  </div>
                  <div className="h-6 w-px bg-white/10" />
                  <div>
                    <div className="text-[9px] text-gray-400 uppercase">🔥 Spirit Ember</div>
                    <div className="text-sm font-bold text-shin-gold">
                      {arenaState.playerItems?.['material:spirit-ember'] ?? 0} units
                    </div>
                  </div>
                </div>

                <button
                  onClick={handleRunFastForwardSim}
                  disabled={isFastForwarding}
                  className="px-5 py-3 bg-shin-gold text-black font-cinzel font-black text-xs uppercase tracking-widest rounded-xl hover:bg-yellow-400 transition-all cursor-pointer disabled:opacity-50 shadow-[0_0_20px_rgba(251,191,36,0.4)]"
                >
                  {isFastForwarding
                    ? `⏩ Simulating Day ${simStep}/7...`
                    : '⏩ Fast-Forward 7 Days'}
                </button>
              </div>
            </div>

            {/* AUTONOMOUS NPC MERCHANTS (GRANDMASTER HANZO & BLACKSMITH KENJI) */}
            <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
              {(arenaState.npcMerchants || []).map((merchant) => {
                const isReasoningOpen = openReasoningId === merchant.merchantId;
                return (
                  <div
                    key={merchant.merchantId}
                    className={`rounded-2xl border-2 p-5 flex flex-col justify-between transition-all ${
                      merchant.isShopOpen
                        ? 'bg-gradient-to-br from-gray-950 via-black to-amber-950/20 border-shin-gold/40'
                        : 'bg-gradient-to-br from-red-950/40 via-black to-black border-red-500/70 shadow-[0_0_30px_rgba(239,68,68,0.25)]'
                    }`}
                  >
                    <div>
                      {/* Merchant Header */}
                      <div className="flex flex-wrap items-start justify-between gap-3 border-b border-white/10 pb-4 mb-4">
                        <div className="flex items-center gap-3.5">
                          <img
                            src={merchant.avatarGif}
                            alt={merchant.name}
                            className="w-16 h-16 object-contain bg-black/80 rounded-xl p-1.5 border border-white/15"
                            style={{ imageRendering: 'pixelated' }}
                          />
                          <div>
                            <div className="flex flex-wrap items-center gap-2">
                              <span
                                className={`text-[10px] font-mono font-bold px-2.5 py-0.5 rounded-full border ${
                                  merchant.isShopOpen
                                    ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40'
                                    : 'bg-red-500/25 text-red-300 border-red-500/50 animate-pulse'
                                }`}
                              >
                                {merchant.isShopOpen
                                  ? '🟢 SHOP OPEN'
                                  : '🔴 SHOP CLOSED (INSOLVENT / BROKE)'}
                              </span>
                              <button
                                onClick={() =>
                                  setOpenReasoningId(
                                    isReasoningOpen ? null : merchant.merchantId,
                                  )
                                }
                                title={merchant.activeReasoning}
                                className="text-[10px] font-mono font-bold px-2.5 py-0.5 rounded-full bg-purple-500/20 text-purple-300 border border-purple-500/40 hover:bg-purple-500/30 cursor-pointer"
                              >
                                🧠 {isReasoningOpen ? 'Hide' : 'Show'} NPC Reasoning
                              </button>
                            </div>
                            <h3 className="text-lg md:text-xl font-cinzel font-black text-white mt-1">
                              {merchant.name}
                            </h3>
                            <p className="text-[11px] text-gray-400">{merchant.specialty}</p>
                            {showNearUnderHood && (
                              <div className="text-[10px] font-mono text-shin-gold mt-0.5">
                                Agent Wallet: {merchant.walletId}
                              </div>
                            )}
                          </div>
                        </div>

                        {/* NPC Treasury & Investor Status */}
                        <div className="bg-black/80 border border-white/15 rounded-xl px-3.5 py-2 text-right">
                          <div className="text-[9px] text-gray-400 uppercase">Merchant Pouch</div>
                          <div
                            className={`text-lg font-mono font-bold ${
                              merchant.isShopOpen ? 'text-emerald-400' : 'text-red-400'
                            }`}
                          >
                            {Math.round(merchant.walletBalanceNear * 1000).toLocaleString()} $SHIN
                          </div>
                          <div className="text-[9px] font-mono text-gray-400">
                            Patron Stake: {Math.round(merchant.playerInvestmentNear * 1000).toLocaleString()} $SHIN (Earned:{' '}
                            <span className="text-shin-gold">
                              +{Math.round(merchant.investorDividendsEarnedNear * 1000).toLocaleString()} $SHIN
                            </span>
                            )
                          </div>
                        </div>
                      </div>

                      {/* NPC Active Reasoning Tooltip Box (`09-games.md`) */}
                      {isReasoningOpen && (
                        <div className="mb-4 bg-purple-950/35 border border-purple-500/40 rounded-xl p-3 text-xs font-mono text-purple-100">
                          <div className="text-[10px] font-bold text-purple-300 uppercase mb-1 flex items-center justify-between">
                            <span>🧠 Active NPC Agent Pricing &amp; Inventory Reasoning</span>
                            <span>Trades: {merchant.totalTradesCount}</span>
                          </div>
                          <p className="leading-relaxed text-[11px]">{merchant.activeReasoning}</p>
                        </div>
                      )}

                      {/* Insolvency Alert Banner when Shop Goes Broke */}
                      {!merchant.isShopOpen && (
                        <div className="mb-4 bg-red-950/60 border border-red-500/60 rounded-xl p-3.5 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
                          <div className="text-xs text-red-200">
                            <strong className="text-white block font-cinzel uppercase">
                              ⚠️ Shop Closed — Merchant Went Broke!
                            </strong>
                            Heavy material sell-offs drained {merchant.name}&apos;s pouch below{' '}
                            {Math.round(merchant.insolvencyThresholdNear * 1000).toLocaleString()} $SHIN. Invest $SHIN to reopen the shop
                            and earn {Math.round(merchant.investorDividendRate * 100)}% of future
                            spreads!
                          </div>
                          <button
                            onClick={() => {
                              try {
                                nearArenaEngine.investInNpcMerchant(merchant.merchantId, 5.0);
                                setArenaState({ ...nearArenaEngine.getState() });
                                showToast(
                                  `💎 Invested 5,000 $SHIN in ${merchant.name}! Shop RE-OPENED & scrolls restocked!`,
                                );
                              } catch (e: any) {
                                showToast(e.message);
                              }
                            }}
                            className="px-4 py-2.5 bg-shin-gold text-black font-cinzel font-black text-xs uppercase rounded-lg hover:bg-yellow-400 shrink-0 cursor-pointer"
                          >
                            + Invest 5,000 $SHIN (Re-Open)
                          </button>
                        </div>
                      )}

                      {/* NEP-245 Inventory Table (Buy & Sell / Flood) */}
                      <div className="space-y-2.5">
                        {merchant.items.map((item) => {
                          const playerOwnedQty = arenaState.playerItems?.[item.tokenId] ?? 0;
                          return (
                            <div
                              key={item.tokenId}
                              className="bg-black/75 border border-white/10 rounded-xl p-3 flex flex-col sm:flex-row sm:items-center justify-between gap-3"
                            >
                              <div className="space-y-0.5">
                                <div className="flex items-center gap-2">
                                  <span className="text-base">{item.icon}</span>
                                  <span className="font-cinzel font-bold text-xs text-white">
                                    {item.name}
                                  </span>
                                  <span
                                    className={`text-[9px] font-mono font-bold px-2 py-0.5 rounded ${
                                      item.priceTrend === 'SURGING'
                                        ? 'bg-red-500/20 text-red-300 border border-red-500/40'
                                        : item.priceTrend === 'CHEAP_SURPLUS'
                                          ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/40'
                                          : 'bg-white/10 text-gray-300'
                                    }`}
                                  >
                                    {item.priceTrend === 'SURGING'
                                      ? '📈 SCARCE / HIGH DEMAND'
                                      : item.priceTrend === 'CHEAP_SURPLUS'
                                        ? '📉 FLOODED / CHEAP'
                                        : '⚖️ BALANCED'}
                                  </span>
                                </div>
                                <div className="text-[10px] font-mono text-gray-400">
                                  NPC Stock:{' '}
                                  <strong className="text-white">
                                    {item.stock}/{item.targetStock}
                                  </strong>{' '}
                                  • You Hold:{' '}
                                  <strong className="text-shin-gold">{playerOwnedQty}x</strong>
                                  {showNearUnderHood && (
                                    <span className="text-purple-300 ml-2">({item.tokenId})</span>
                                  )}
                                </div>
                              </div>

                              <div className="flex flex-wrap items-center gap-2 shrink-0">
                                {/* Buy from NPC button */}
                                <button
                                  onClick={() => {
                                    try {
                                      nearArenaEngine.buyFromNpcMerchant(
                                        merchant.merchantId,
                                        item.tokenId,
                                        1,
                                        item.category === 'SCROLL'
                                          ? selectedFighter?.tokenId
                                          : undefined,
                                      );
                                      setArenaState({ ...nearArenaEngine.getState() });
                                      showToast(
                                        item.category === 'SCROLL' && selectedFighter
                                          ? `📜 Bought ${item.name} & trained ${selectedFighter.title}!`
                                          : `Bought 1x ${item.name} for ${Math.round(item.askPriceNear * 1000).toLocaleString()} $SHIN!`,
                                      );
                                    } catch (e: any) {
                                      showToast(e.message);
                                    }
                                  }}
                                  disabled={!merchant.isShopOpen || item.stock <= 0}
                                  className="px-3 py-1.5 bg-shin-gold text-black font-cinzel font-black text-[10px] uppercase rounded-lg hover:bg-yellow-400 disabled:opacity-40 cursor-pointer"
                                >
                                  Buy ({Math.round(item.askPriceNear * 1000).toLocaleString()} $SHIN)
                                </button>

                                {/* Buy with $SHIN (Default Economy Currency) */}
                                {item.category === 'SCROLL' && selectedFighter && (
                                  <button
                                    onClick={async () => {
                                      const shinPrice = Math.round(item.askPriceNear * 1000);
                                      const scrollType =
                                        item.tokenId === 'scroll:crimson-katana'
                                          ? 'ATK'
                                          : item.tokenId === 'scroll:iron-posture'
                                            ? 'DEF'
                                            : 'SPD';
                                      const res = await nearArenaEngine.buyDojoScrollWithShin(
                                        merchant.merchantId,
                                        selectedFighter.tokenId,
                                        scrollType,
                                        shinPrice,
                                      );
                                      setArenaState({ ...nearArenaEngine.getState() });
                                      showToast(
                                        res.ok
                                          ? `📜 Paid ${shinPrice} $SHIN to ${merchant.name} & trained ${selectedFighter.title}!`
                                          : res.error || '$SHIN purchase failed',
                                      );
                                    }}
                                    disabled={!merchant.isShopOpen || item.stock <= 0}
                                    className="px-3 py-1.5 bg-amber-500/20 border border-amber-400/50 text-amber-300 font-cinzel font-black text-[10px] uppercase rounded-lg hover:bg-amber-500/30 disabled:opacity-40 cursor-pointer"
                                  >
                                    Pay {Math.round(item.askPriceNear * 1000)} $SHIN
                                  </button>
                                )}

                                {/* Sell 1x to NPC button */}
                                <button
                                  onClick={() => {
                                    try {
                                      nearArenaEngine.sellToNpcMerchant(
                                        merchant.merchantId,
                                        item.tokenId,
                                        1,
                                      );
                                      setArenaState({ ...nearArenaEngine.getState() });
                                      showToast(
                                        `Sold 1x ${item.name} to ${merchant.name} for ${Math.round(item.bidPriceNear * 1000).toLocaleString()} $SHIN!`,
                                      );
                                    } catch (e: any) {
                                      showToast(e.message);
                                    }
                                  }}
                                  disabled={!merchant.isShopOpen || playerOwnedQty < 1}
                                  className="px-2.5 py-1.5 bg-white/10 hover:bg-white/20 text-white border border-white/20 font-mono font-bold text-[10px] rounded-lg disabled:opacity-35 cursor-pointer"
                                >
                                  Sell 1x ({Math.round(item.bidPriceNear * 1000).toLocaleString()} $SHIN)
                                </button>

                                {/* Flood 4x to test market crash / insolvency */}
                                {item.category === 'MATERIAL' && (
                                  <button
                                    onClick={() => {
                                      try {
                                        const qty = Math.min(4, Math.max(1, playerOwnedQty));
                                        nearArenaEngine.sellToNpcMerchant(
                                          merchant.merchantId,
                                          item.tokenId,
                                          qty,
                                        );
                                        setArenaState({ ...nearArenaEngine.getState() });
                                        showToast(
                                          `📉 Flooded ${qty}x ${item.name} into ${merchant.name}'s shop!`,
                                        );
                                      } catch (e: any) {
                                        showToast(e.message);
                                      }
                                    }}
                                    disabled={!merchant.isShopOpen || playerOwnedQty < 1}
                                    className="px-2.5 py-1.5 bg-red-500/20 hover:bg-red-500/30 text-red-300 border border-red-500/40 font-mono font-bold text-[10px] rounded-lg disabled:opacity-35 cursor-pointer"
                                  >
                                    Flood
                                  </button>
                                )}
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </div>

                    {/* Footer: Invest in Merchant Liquidity */}
                    <div className="mt-4 pt-3 border-t border-white/10 flex flex-wrap items-center justify-between gap-2 text-[11px]">
                      <span className="text-gray-400">
                        LP Backers earn{' '}
                        <strong className="text-shin-gold">
                          {Math.round(merchant.investorDividendRate * 100)}%
                        </strong>{' '}
                        of every scroll &amp; steel trade at this shop.
                      </span>
                      <button
                        onClick={() => {
                          try {
                            nearArenaEngine.investInNpcMerchant(merchant.merchantId, 5.0);
                            setArenaState({ ...nearArenaEngine.getState() });
                            showToast(
                              `💎 Invested 5,000 $SHIN into ${merchant.name}!`,
                            );
                          } catch (e: any) {
                            showToast(e.message);
                          }
                        }}
                        className="px-3 py-1.5 bg-emerald-500/20 hover:bg-emerald-500/30 text-emerald-300 border border-emerald-500/40 rounded-lg font-mono font-bold text-[10px] cursor-pointer"
                      >
                        + Invest 5,000 $SHIN in Shop
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>

            {/* PLAYER TRAINERS GUILD (90% Trainer / 10% Dev Treasury) */}
            <div className="rounded-2xl border border-emerald-500/30 bg-gradient-to-br from-emerald-950/30 via-black to-zinc-950 p-5 space-y-4">
              <div className="flex flex-col md:flex-row md:items-center justify-between gap-2">
                <div>
                  <div className="text-[10px] font-mono uppercase tracking-widest text-emerald-400">
                    On-Chain Player Trainers • 90% Trainer / 10% Dev Treasury
                  </div>
                  <h3 className="text-lg font-cinzel font-black text-white uppercase tracking-wider">
                    🥋 Player Trainers Guild (Earn 90% Coaching Fees)
                  </h3>
                  <p className="text-xs text-gray-400">
                    Register as a Sensei to train other players&apos; Fighter NFTs (+2 ATK/DEF/SPD &amp; +15 XP) and keep 90% of every training fee.
                  </p>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {/* Register as Trainer */}
                <div className="rounded-xl border border-white/10 bg-black/60 p-4 space-y-3">
                  <div className="text-xs font-cinzel font-bold text-emerald-300 uppercase">
                    Become a Sensei (Register On-Chain)
                  </div>
                  <div className="flex flex-wrap items-center gap-2">
                    <select
                      value={trainerSpecialty}
                      onChange={(e) => setTrainerSpecialty(e.target.value as 'ATK' | 'DEF' | 'SPD')}
                      className="bg-zinc-900 border border-white/15 rounded px-2.5 py-1.5 text-xs text-white"
                    >
                      <option value="ATK">+2 ATK Specialty</option>
                      <option value="DEF">+2 DEF Specialty</option>
                      <option value="SPD">+2 SPD Specialty</option>
                    </select>
                    <input
                      type="number"
                      min="0.1"
                      step="0.1"
                      value={trainerFee}
                      onChange={(e) => setTrainerFee(e.target.value)}
                      className="w-24 bg-zinc-900 border border-white/15 rounded px-2.5 py-1.5 text-xs font-mono text-white"
                      placeholder="Fee (x1k $SHIN)"
                    />
                    <button
                      onClick={async () => {
                        const res = await nearArenaEngine.registerPlayerTrainer(
                          parseFloat(trainerFee) || 0.5,
                          trainerSpecialty,
                        );
                        showToast(
                          res.ok
                            ? `Registered as ${trainerSpecialty} Sensei (${Math.round((parseFloat(trainerFee) || 0.5) * 1000).toLocaleString()} $SHIN)!`
                            : res.error || 'Registration failed',
                        );
                      }}
                      className="px-3 py-1.5 bg-emerald-500 hover:bg-emerald-400 text-black font-cinzel font-bold text-[10px] uppercase rounded cursor-pointer"
                    >
                      Register Trainer
                    </button>
                  </div>
                </div>

                {/* Train with a Player Trainer */}
                <div className="rounded-xl border border-white/10 bg-black/60 p-4 space-y-3">
                  <div className="text-xs font-cinzel font-bold text-amber-300 uppercase">
                    Train {selectedFighter ? selectedFighter.title : 'Selected Fighter'} with a Sensei
                  </div>
                  <div className="flex flex-wrap items-center gap-2">
                    <input
                      type="text"
                      value={targetTrainerId}
                      onChange={(e) => setTargetTrainerId(e.target.value)}
                      placeholder="trainer-account.testnet"
                      className="flex-1 min-w-[160px] bg-zinc-900 border border-white/15 rounded px-2.5 py-1.5 text-xs font-mono text-white"
                    />
                    <button
                      disabled={!selectedFighter || !targetTrainerId.trim()}
                      onClick={async () => {
                        if (!selectedFighter) return;
                        const profile = await nearArenaEngine.getTrainerProfile(targetTrainerId.trim());
                        if (!profile) {
                          showToast('Trainer account not registered on-chain.');
                          return;
                        }
                        const feeNear = Number(profile.fee_milli_near) / 1000;
                        const res = await nearArenaEngine.trainFighterWithPlayerTrainer(
                          selectedFighter.tokenId,
                          targetTrainerId.trim(),
                          feeNear,
                        );
                        setArenaState({ ...nearArenaEngine.getState() });
                        showToast(
                          res.ok
                            ? `Trained ${selectedFighter.title} (+2 ${profile.specialty}) for ${Math.round(feeNear * 1000).toLocaleString()} $SHIN!`
                            : res.error || 'Training failed',
                        );
                      }}
                      className="px-3 py-1.5 bg-amber-500 hover:bg-amber-400 text-black font-cinzel font-bold text-[10px] uppercase rounded disabled:opacity-40 cursor-pointer"
                    >
                      Train Fighter
                    </button>
                  </div>
                </div>
              </div>
            </div>

            {/* PLAYER-FUNDED ON-CHAIN TOURNAMENTS (95% Winners / 5% Dev Treasury) */}
            <div className="rounded-2xl border border-amber-500/30 bg-gradient-to-br from-amber-950/30 via-black to-zinc-950 p-5 space-y-4">
              <div>
                <div className="text-[10px] font-mono uppercase tracking-widest text-amber-400">
                  On-Chain Tournaments • 95% Winners / 5% Dev Treasury
                </div>
                <h3 className="text-lg font-cinzel font-black text-white uppercase tracking-wider">
                  🏆 Player-Funded Tournaments
                </h3>
                <p className="text-xs text-gray-400">
                  Create or join a Budōkan tournament pool. All entry fees go into the prize pot (95% to winners, 5% Dojo Treasury).
                </p>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <input
                  type="text"
                  value={onChainCupId}
                  onChange={(e) => setOnChainCupId(e.target.value)}
                  placeholder="Tournament ID (e.g. shin-cup-1)"
                  className="bg-zinc-900 border border-white/15 rounded px-2.5 py-1.5 text-xs font-mono text-white"
                />
                <input
                  type="number"
                  min="0.1"
                  step="0.1"
                  value={onChainEntryNear}
                  onChange={(e) => setOnChainEntryNear(e.target.value)}
                  className="w-24 bg-zinc-900 border border-white/15 rounded px-2.5 py-1.5 text-xs font-mono text-white"
                  placeholder="Entry NEAR"
                />
                <button
                  disabled={!onChainCupId.trim()}
                  onClick={async () => {
                    const res = await nearArenaEngine.createOnChainTournament(
                      onChainCupId.trim(),
                      parseFloat(onChainEntryNear) || 0.5,
                      4,
                    );
                    showToast(
                      res.ok
                        ? `Created on-chain tournament "${onChainCupId.trim()}"!`
                        : res.error || 'Create tournament failed',
                    );
                  }}
                  className="px-3 py-1.5 bg-amber-500 hover:bg-amber-400 text-black font-cinzel font-bold text-[10px] uppercase rounded disabled:opacity-40 cursor-pointer"
                >
                  Create Pool
                </button>
                <button
                  disabled={!selectedFighter || !onChainCupId.trim()}
                  onClick={async () => {
                    if (!selectedFighter) return;
                    const entryShin = Math.round((parseFloat(onChainEntryNear) || 0.5) * 1000);
                    const res = await nearArenaEngine.joinTournamentWithShin(
                      onChainCupId.trim(),
                      selectedFighter.tokenId,
                      entryShin,
                    );
                    showToast(
                      res.ok
                        ? `${selectedFighter.title} joined "${onChainCupId.trim()}" with ${entryShin.toLocaleString()} $SHIN!`
                        : res.error || 'Join tournament failed',
                    );
                  }}
                  className="px-3 py-1.5 bg-emerald-500 hover:bg-emerald-400 text-black font-cinzel font-bold text-[10px] uppercase rounded disabled:opacity-40 cursor-pointer"
                >
                  Join ({selectedFighter ? selectedFighter.title : 'Select Fighter'})
                </button>
              </div>
            </div>

            {/* Warrior Bazaar (Player-Owned Marketplace) */}
            <div className="space-y-4">
              <div className="flex flex-col md:flex-row md:items-center justify-between gap-2">
                <div>
                  <h3 className="text-lg font-cinzel font-black text-white uppercase tracking-widest">
                    ⚔ Warrior Bazaar (Recruit Veteran Shinobi)
                  </h3>
                  <p className="text-xs text-gray-400">
                    Every Shinobi carries their own SHIN Pouch. Recruiting a veteran transfers both
                    the Warrior and all $SHIN inside their pouch!
                  </p>
                </div>

                {selectedFighter && (
                  <div className="flex items-center gap-2 bg-white/5 border border-white/10 p-2 rounded-xl">
                    <span className="text-[10px] font-cinzel text-gray-300 uppercase px-2">
                      List {selectedFighter.title}:
                    </span>
                    <input
                      type="number"
                      min="1"
                      value={listPrice}
                      onChange={(e) => setListPrice(e.target.value)}
                      className="w-20 bg-black border border-white/20 rounded px-2 py-1 text-xs font-mono text-white"
                    />
                    <button
                      onClick={() => {
                        nearArenaEngine.updateAgentConfig(selectedFighter.tokenId, {
                          marketPriceNear: Number(listPrice),
                        });
                        setArenaState({ ...nearArenaEngine.getState() });
                        showToast(`Listed ${selectedFighter.title} in the Bazaar for ${(Number(listPrice) * 1000).toLocaleString()} $SHIN!`);
                      }}
                      className="px-3 py-1.5 bg-shin-red text-white font-cinzel font-bold text-[10px] uppercase rounded cursor-pointer"
                    >
                      List Warrior
                    </button>
                  </div>
                )}
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
                {arenaState.fighters
                  .filter((f) => f.marketPriceNear > 0)
                  .map((listed) => (
                    <div
                      key={listed.tokenId}
                      className="bg-gray-950 border-2 border-white/15 hover:border-shin-gold/50 rounded-2xl p-5 flex flex-col justify-between transition-all"
                    >
                      <div className="flex items-center gap-4 mb-4">
                        <img
                          src={getCharGif(listed.charId)}
                          alt={listed.name}
                          className="w-16 h-16 object-contain bg-black rounded-xl p-1 border border-white/10"
                          style={{ imageRendering: 'pixelated' }}
                        />
                        <div>
                          <div className="font-cinzel font-black text-white">{listed.title}</div>
                          <div className="text-[10px] font-mono text-shin-gold">
                            Lv.{listed.powerLevel} • {listed.elo} ELO ({listed.wins}W/{listed.losses}L)
                          </div>
                          <div className="text-[10px] font-mono text-emerald-400 mt-1">
                            Includes SHIN Pouch: {Math.round(listed.vaultBalanceNear * 1000).toLocaleString()} $SHIN
                          </div>
                        </div>
                      </div>

                      <div className="flex items-center justify-between border-t border-white/10 pt-3">
                        <div>
                          <div className="text-[9px] text-gray-500 uppercase">Recruit Tribute</div>
                          <div className="text-lg font-mono font-bold text-white">
                            {Math.round(listed.marketPriceNear * 1000).toLocaleString()} $SHIN
                          </div>
                        </div>
                        {listed.ownerAccountId === arenaState.playerWallet.accountId ? (
                          <button
                            onClick={() => {
                              nearArenaEngine.updateAgentConfig(listed.tokenId, {
                                marketPriceNear: 0,
                              });
                              setArenaState({ ...nearArenaEngine.getState() });
                              showToast(`Removed ${listed.title} from Bazaar`);
                            }}
                            className="px-4 py-2 bg-white/10 text-gray-300 font-cinzel text-xs uppercase rounded-lg cursor-pointer"
                          >
                            Remove
                          </button>
                        ) : (
                          <button
                            onClick={() => {
                              try {
                                nearArenaEngine.buyFighterFromMarket(listed.tokenId);
                                nearArenaEngine.buyFighterWithShin(
                                  listed.tokenId,
                                  Math.round(listed.marketPriceNear * 1000),
                                ).catch(() => {});
                                setArenaState({ ...nearArenaEngine.getState() });
                                showToast(
                                  `Recruited ${listed.title} + their ${Math.round(listed.vaultBalanceNear * 1000).toLocaleString()} $SHIN Pouch!`,
                                );
                              } catch (e: any) {
                                showToast(e.message);
                              }
                            }}
                            className="px-4 py-2 bg-shin-gold text-black font-cinzel font-black text-xs uppercase rounded-lg hover:bg-yellow-400 cursor-pointer"
                          >
                            Recruit Warrior
                          </button>
                        )}
                      </div>
                    </div>
                  ))}
              </div>
            </div>
          </div>
        )}

        {/* ============================================================
            TAB 4: BATTLE CHRONICLE (ON-CHAIN ACTIVITY FEED)
           ============================================================ */}
        {activeTab === 'LEDGER' && (
          <div className="bg-gray-950 border border-white/15 rounded-2xl p-6 space-y-4">
            <div className="flex items-center justify-between border-b border-white/10 pb-3">
              <div>
                <h3 className="text-base font-cinzel font-black text-white uppercase tracking-widest">
                  Scroll of Battles &amp; NEAR Contract Ledger
                </h3>
                <p className="text-xs text-gray-400">
                  Every warrior awakening, fight pot settlement, crowd payout, and dojo upgrade is
                  recorded invisibly on NEAR.
                </p>
              </div>
              <span className="text-xs font-mono text-emerald-400">
                shin-arena-28d.testnet
              </span>
            </div>

            <div className="space-y-2.5 max-h-[420px] overflow-y-auto pr-2">
              {arenaState.ledger.map((tx) => (
                <div
                  key={tx.id}
                  className="bg-black/70 border border-white/10 rounded-xl p-3.5 flex flex-col md:flex-row md:items-center justify-between gap-2"
                >
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <span className="text-[10px] font-mono font-bold px-2 py-0.5 rounded bg-shin-gold/15 text-shin-gold border border-shin-gold/30">
                        {tx.type}
                      </span>
                      <span className="text-xs text-white font-sans">{tx.summary}</span>
                    </div>
                    <div className="text-[10px] text-gray-500 font-mono">
                      Actor: {tx.actorWallet} • Receipt: {tx.txHash.slice(0, 18)}…
                    </div>
                  </div>
                  <div className="flex items-center gap-3 shrink-0">
                    {tx.amountNear > 0 && (
                      <span className="text-xs font-mono font-bold text-emerald-400">
                        {Math.round(tx.amountNear * 1000).toLocaleString()} $SHIN
                      </span>
                    )}
                    <a
                      href={`https://testnet.nearblocks.io/txns/${tx.txHash}`}
                      target="_blank"
                      rel="noreferrer"
                      className="text-[10px] font-mono text-blue-400 hover:underline flex items-center gap-1"
                    >
                      NearBlocks <ExternalLink size={11} />
                    </a>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default AgentArenaFlow;
