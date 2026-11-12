'use client';

import React, { useState, useEffect } from 'react';
import {
  nearArenaEngine,
  ActiveArenaMatch,
  COMBAT_DOCTRINES,
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
    nearArenaEngine.claimFaucetOrIntentSwap(15, 50);
    setArenaState({ ...nearArenaEngine.getState() });
    showToast('+15 NEAR added to your War Chest!');
  };

  const handlePlaceLobbyBet = (matchId: string, side: 'p1' | 'p2', fighterName: string) => {
    const amt = betAmounts[matchId] || 1.0;
    try {
      nearArenaEngine.placeSpectatorBet(matchId, side, amt);
      setArenaState({ ...nearArenaEngine.getState() });
      showToast(`🔥 Backed ${fighterName} with ${amt} NEAR! Click ENTER PIT to watch live!`);
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
      <div className="sticky top-0 z-50 bg-black/90 border-b border-white/10 px-4 md:px-8 py-3.5 flex flex-wrap items-center justify-between gap-4 backdrop-blur-md">
        <div className="flex items-center gap-4">
          <button
            onClick={onBack}
            className="text-gray-400 hover:text-white font-cinzel font-bold text-xs uppercase tracking-widest flex items-center gap-1.5 cursor-pointer"
          >
            <span>←</span> Title Hall
          </button>
          <div className="h-5 w-px bg-white/15" />
          <div>
            <h1 className="text-lg md:text-2xl font-cinzel font-black tracking-[0.2em] text-white uppercase flex items-center gap-2.5">
              <Flame size={20} className="text-shin-red" />
              <span>THE SHADOW COLOSSEUM</span>
            </h1>
          </div>
        </div>

        {/* Right: War Chest + NEAR Judge View Switch */}
        <div className="flex items-center gap-3">
          {/* Toggle NEAR Under-the-Hood details for Judges */}
          <button
            onClick={() => setShowNearUnderHood(!showNearUnderHood)}
            className={`px-3 py-1.5 rounded-lg text-[11px] font-mono border flex items-center gap-1.5 transition-all cursor-pointer ${
              showNearUnderHood
                ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/50'
                : 'bg-white/5 text-gray-400 border-white/10 hover:text-white'
            }`}
            title="Toggle NEAR Sub-Account & Contract Inspector"
          >
            <Terminal size={13} />
            <span>{showNearUnderHood ? 'NEAR View: ON' : 'NEAR View'}</span>
          </button>

          {/* Player War Chest */}
          <div className="bg-white/5 border border-shin-gold/40 rounded-xl px-3.5 py-1.5 flex items-center gap-3">
            <Coins size={16} className="text-shin-gold" />
            <div>
              <div className="text-[9px] text-gray-400 uppercase tracking-wider">
                {showNearUnderHood ? arenaState.playerWallet.accountId : 'Your War Chest'}
              </div>
              <div className="text-xs md:text-sm font-mono font-bold text-shin-gold">
                {arenaState.playerWallet.NEAR.toFixed(2)} NEAR
              </div>
            </div>
            <button
              onClick={handleFaucetTopUp}
              className="px-2.5 py-1 bg-shin-gold text-black rounded text-[10px] font-cinzel font-black uppercase tracking-wider hover:bg-yellow-400 transition-all cursor-pointer"
            >
              + Refill
            </button>
          </div>

          <button
            onClick={onHome}
            className="text-gray-400 hover:text-shin-red font-cinzel font-bold text-xs uppercase tracking-widest px-3 py-2 border border-white/10 rounded-lg cursor-pointer"
          >
            ✕
          </button>
        </div>
      </div>

      {/* =====================================================================
          ARCADE NAVIGATION BLADES
         ===================================================================== */}
      <div className="px-4 md:px-8 pt-5 pb-2 max-w-7xl mx-auto w-full flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap gap-2.5">
          {[
            { id: 'LIVE_ARENA', label: '🔥 Colosseum Pit (Live Fights)', icon: Flame },
            {
              id: 'MY_AGENTS',
              label: `⚔ Champion Barracks (${ownedFighters.length})`,
              icon: Shield,
            },
            { id: 'DOJO_MARKET', label: "🏮 Master Hanzo's Dojo & Bazaar", icon: Store },
            { id: 'LEDGER', label: '📜 Battle Chronicle', icon: ScrollText },
          ].map((tab) => {
            const Icon = tab.icon;
            const active = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id as any)}
                className={`arcade-skew px-5 py-2.5 font-cinzel text-xs font-black tracking-wider uppercase border transition-all cursor-pointer ${
                  active
                    ? 'bg-shin-red text-white border-white shadow-[0_0_20px_rgba(255,42,42,0.5)]'
                    : 'bg-white/5 text-gray-400 border-white/15 hover:border-shin-gold/50 hover:text-white'
                }`}
              >
                <div className="arcade-unskew flex items-center gap-2">
                  <Icon size={15} />
                  <span>{tab.label}</span>
                </div>
              </button>
            );
          })}
        </div>

        <button
          onClick={handleSpawnMyAgentMatch}
          className="arcade-skew px-6 py-2.5 bg-shin-gold text-black font-cinzel font-black text-xs tracking-widest uppercase hover:bg-yellow-400 transition-all shadow-[0_0_25px_rgba(251,191,36,0.45)] cursor-pointer"
        >
          <div className="arcade-unskew flex items-center gap-2">
            <Play size={14} fill="currentColor" />
            <span>Send {selectedFighter?.title || 'Champion'} Into Pit Now</span>
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
                  Champions in the Colosseum stake their own{' '}
                  <span className="text-shin-gold font-semibold">War Chest</span> into each match
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
                    {arenaState.npcDojo.currentDynamicCostNear.toFixed(2)} NEAR
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
                        FIGHT POT: {match.fighterPoolNear.toFixed(1)} NEAR
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
                          {match.fighterPoolNear.toFixed(1)} NEAR
                        </div>
                      </div>
                      <div className="bg-emerald-500/10 border border-emerald-500/30 rounded-lg p-2">
                        <div className="text-[9px] text-gray-400 uppercase">Crowd Backing Pot</div>
                        <div className="text-sm font-mono font-bold text-emerald-400">
                          {totalSpec.toFixed(1)} NEAR
                        </div>
                      </div>
                    </div>

                    {/* Quick Crowd Backing Bar */}
                    <div className="space-y-2 mb-4 bg-white/5 p-3 rounded-xl border border-white/10">
                      <div className="flex items-center justify-between text-[10px] text-gray-300 font-cinzel uppercase tracking-wider">
                        <span>Toss Coins on Winner</span>
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
                              {val}
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
                            War Chest: {fighter.vaultBalanceNear.toFixed(1)} NEAR
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
                            +{selectedFighter.totalEarningsNear.toFixed(2)} NEAR
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
                          ? `${selectedFighter.title} entered the 24/7 Shadow Colosseum!`
                          : `${selectedFighter.title} rested in Barracks.`,
                      );
                    }}
                    className={`px-5 py-3 rounded-xl font-cinzel font-black text-xs uppercase tracking-widest border-2 transition-all cursor-pointer ${
                      selectedFighter.isAgentActive
                        ? 'bg-emerald-500/20 border-emerald-400 text-emerald-300 shadow-[0_0_20px_rgba(16,185,129,0.35)]'
                        : 'bg-white/5 border-white/20 text-gray-400'
                    }`}
                  >
                    {selectedFighter.isAgentActive
                      ? '🟢 FIGHTING IN COLOSSEUM'
                      : '⚪ SEND TO COLOSSEUM'}
                  </button>
                </div>

                {/* Champion War Chest Management */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="bg-black/70 border border-shin-gold/40 rounded-xl p-4 space-y-3">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-cinzel font-bold text-shin-gold uppercase tracking-wider">
                        Champion&apos;s War Chest
                      </span>
                      <span className="text-xl font-mono font-bold text-shin-gold">
                        {selectedFighter.vaultBalanceNear.toFixed(2)} NEAR
                      </span>
                    </div>
                    <p className="text-[11px] text-gray-400">
                      Load coins into this warrior&apos;s personal War Chest so they can keep entering
                      winner-takes-all Colosseum pools.
                    </p>
                    <div className="flex gap-1.5">
                      {[2, 5, 10].map((quickAmt) => (
                        <button
                          key={quickAmt}
                          onClick={() => {
                            try {
                              nearArenaEngine.fundAgentWallet(selectedFighter.tokenId, quickAmt);
                              setArenaState({ ...nearArenaEngine.getState() });
                              showToast(
                                `Added +${quickAmt} NEAR to ${selectedFighter.title}'s War Chest!`,
                              );
                            } catch (e: any) {
                              showToast(e.message);
                            }
                          }}
                          className="flex-1 py-2 bg-shin-gold/20 hover:bg-shin-gold hover:text-black text-shin-gold border border-shin-gold/50 rounded-lg font-mono font-bold text-xs transition-all cursor-pointer"
                        >
                          +{quickAmt} NEAR
                        </button>
                      ))}
                    </div>
                  </div>

                  <div className="bg-black/70 border border-white/15 rounded-xl p-4 space-y-3">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-cinzel font-bold text-gray-300 uppercase tracking-wider">
                        Collect Champion Spoils
                      </span>
                      <span className="text-xs font-mono text-emerald-400">
                        Instant Transfer
                      </span>
                    </div>
                    <p className="text-[11px] text-gray-400">
                      Move winnings from this Champion&apos;s War Chest back into your main player
                      chest at any time.
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
                            nearArenaEngine.withdrawFromAgentWallet(
                              selectedFighter.tokenId,
                              Number(withdrawAmount),
                            );
                            setArenaState({ ...nearArenaEngine.getState() });
                            showToast(`Collected ${withdrawAmount} NEAR from ${selectedFighter.title}!`);
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
                        Amount your Champion puts on the line in each Colosseum fight (Winner takes
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
                            showToast(`Set Fight Stake to ${stake} NEAR per match`);
                          }}
                          className={`px-3 py-2 rounded-lg font-mono text-xs font-bold border transition-all cursor-pointer ${
                            selectedFighter.wagerPerFightNear === stake
                              ? 'bg-shin-gold text-black border-shin-gold'
                              : 'bg-black/60 text-gray-400 border-white/10 hover:border-white/30'
                          }`}
                        >
                          {stake}
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
              </div>
            )}
          </div>
        )}

        {/* ============================================================
            TAB 3: MASTER HANZO'S DOJO & WARRIOR BAZAAR
           ============================================================ */}
        {activeTab === 'DOJO_MARKET' && (
          <div className="space-y-8">
            {/* Grandmaster Hanzo's Autonomous Dojo */}
            <div className="bg-gradient-to-br from-amber-950/40 via-black to-black border-2 border-shin-gold/50 rounded-2xl p-6">
              <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4 border-b border-white/10 pb-4 mb-5">
                <div>
                  <span className="text-[10px] font-cinzel font-bold uppercase bg-shin-gold/20 text-shin-gold px-3 py-0.5 rounded-full border border-shin-gold/40">
                    Living Sensei Economy • Supply &amp; Demand Pricing
                  </span>
                  <h2 className="text-xl md:text-3xl font-cinzel font-black text-white mt-2">
                    🏮 {arenaState.npcDojo.npcName}
                  </h2>
                  <p className="text-xs text-gray-300 mt-1">
                    Sensei Treasury:{' '}
                    <span className="text-emerald-400 font-mono font-bold">
                      {arenaState.npcDojo.treasuryBalanceNear.toFixed(2)} NEAR
                    </span>{' '}
                    • Warriors Trained: <strong className="text-white">{arenaState.npcDojo.totalTrainingsCompleted}</strong>
                    {showNearUnderHood && (
                      <span className="text-shin-gold font-mono ml-2">
                        ({arenaState.npcDojo.npcWalletId})
                      </span>
                    )}
                  </p>
                </div>

                <div className="bg-black/80 border border-shin-gold/50 rounded-xl px-5 py-3 text-center shrink-0">
                  <div className="text-[10px] text-gray-400 uppercase">Current Session Fee</div>
                  <div className="text-2xl font-mono font-bold text-shin-gold">
                    {arenaState.npcDojo.currentDynamicCostNear.toFixed(2)} NEAR
                  </div>
                  <div className="text-[9px] text-gray-500">
                    Rises automatically with arena demand
                  </div>
                </div>
              </div>

              <div className="flex flex-col md:flex-row items-center justify-between gap-4">
                <p className="text-xs md:text-sm text-gray-300 max-w-2xl">
                  Put <strong className="text-white">{selectedFighter?.title}</strong> through
                  Grandmaster Hanzo&apos;s intense dojo trials to permanently boost{' '}
                  <span className="text-shin-gold font-bold">
                    +1 Level, +3 ATK, +3 DEF, and +2 SPD
                  </span>
                  .
                </p>
                {selectedFighter && (
                  <button
                    onClick={() => {
                      try {
                        nearArenaEngine.trainFighterAtNpcDojo(selectedFighter.tokenId, true);
                        setArenaState({ ...nearArenaEngine.getState() });
                        showToast(
                          `🏮 ${selectedFighter.title} completed Dojo Trials! Reached Level ${
                            selectedFighter.powerLevel + 1
                          }!`,
                        );
                      } catch (e: any) {
                        showToast(e.message);
                      }
                    }}
                    className="px-6 py-3.5 bg-shin-gold text-black font-cinzel font-black text-xs uppercase tracking-widest rounded-xl hover:bg-yellow-400 transition-all shrink-0 cursor-pointer shadow-[0_0_20px_rgba(251,191,36,0.4)]"
                  >
                    ⚡ Train {selectedFighter.title} ({arenaState.npcDojo.currentDynamicCostNear.toFixed(2)} NEAR)
                  </button>
                )}
              </div>
            </div>

            {/* Warrior Bazaar (Player-Owned Marketplace) */}
            <div className="space-y-4">
              <div className="flex flex-col md:flex-row md:items-center justify-between gap-2">
                <div>
                  <h3 className="text-lg font-cinzel font-black text-white uppercase tracking-widest">
                    ⚔ Warrior Bazaar (Recruit Veteran Champions)
                  </h3>
                  <p className="text-xs text-gray-400">
                    Every Champion carries their own War Chest. Recruiting a veteran transfers both
                    the Warrior and all coins inside their chest!
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
                        showToast(`Listed ${selectedFighter.title} in the Bazaar for ${listPrice} NEAR!`);
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
                            Includes War Chest: {listed.vaultBalanceNear.toFixed(2)} NEAR
                          </div>
                        </div>
                      </div>

                      <div className="flex items-center justify-between border-t border-white/10 pt-3">
                        <div>
                          <div className="text-[9px] text-gray-500 uppercase">Recruit Tribute</div>
                          <div className="text-lg font-mono font-bold text-white">
                            {listed.marketPriceNear.toFixed(2)} NEAR
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
                                setArenaState({ ...nearArenaEngine.getState() });
                                showToast(
                                  `Recruited ${listed.title} + their ${listed.vaultBalanceNear.toFixed(2)} NEAR War Chest!`,
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
                shin-arena.testnet
              </span>
            </div>

            <div className="space-y-2.5 max-h-[60dvh] overflow-y-auto pr-2">
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
                        {tx.amountNear.toFixed(2)} NEAR
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
