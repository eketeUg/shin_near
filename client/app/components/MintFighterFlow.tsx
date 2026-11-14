'use client';

import React, { useState } from 'react';
import { CharacterId, Roster } from './PreGameFlow';
import {
  nearArenaEngine,
  COMBAT_DOCTRINES,
  CombatDoctrineId,
} from '../services/nearArenaEngine';
import { Coins, Sparkles, Swords, Shield, Zap } from 'lucide-react';

interface MintFighterFlowProps {
  onMintComplete: (charId?: CharacterId) => void;
  onBack: () => void;
  onHome: () => void;
  initialSelectedChar: CharacterId;
  playerName?: string;
}

const generateStats = (id: string) => {
  const speed = 58 + ((id.length * 4) % 34);
  const power = 66 + ((id.charCodeAt(0) * 3) % 28);
  const defense = 54 + ((id.charCodeAt(id.length - 1) * 5) % 36);
  return { speed, power, defense };
};

const MintFighterFlow: React.FC<MintFighterFlowProps> = ({
  onMintComplete,
  onBack,
  onHome,
  initialSelectedChar,
  playerName,
}) => {
  const [selectedCharId, setSelectedCharId] = useState<CharacterId>(
    initialSelectedChar || 'kunoichi',
  );
  const char = Roster.find((c) => c.id === selectedCharId) || Roster[0];
  const stats = generateStats(char.id);

  const [fighterTitle, setFighterTitle] = useState<string>(
    `${playerName || 'Warrior'}'s ${char.name}`,
  );
  const [initialAgentBankroll, setInitialAgentBankroll] = useState<number>(3.0);
  const [wagerPerFight, setWagerPerFight] = useState<number>(1.0);
  const [doctrine, setDoctrine] = useState<CombatDoctrineId>('AGGRESSIVE_RUSHDOWN');
  const [isMinting, setIsMinting] = useState<boolean>(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const walletState = nearArenaEngine.getState().playerWallet;
  const isFree = char.id === 'fighter';
  const mintCostNear = isFree ? 0 : 1.5;

  const handleMint = async () => {
    try {
      setIsMinting(true);
      setErrorMsg(null);

      await new Promise((r) => setTimeout(r, 550));

      nearArenaEngine.mintFighterNft({
        charId: char.id,
        charName: char.name,
        customTitle: fighterTitle.trim() || `${playerName || 'Warrior'}'s ${char.name}`,
        initialVaultNear: initialAgentBankroll,
        wagerPerFightNear: wagerPerFight,
        doctrine,
        atk: stats.power,
        def: stats.defense,
        spd: stats.speed,
        mintCostNear,
      });

      onMintComplete(char.id);
    } catch (e: any) {
      setErrorMsg(e.message || 'Awakening failed');
    } finally {
      setIsMinting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex flex-col items-center justify-center bg-gradient-to-b from-gray-950 via-black to-black text-white p-4 overflow-y-auto select-none">
      {/* Top Bar */}
      <div className="fixed top-0 left-0 right-0 z-50 px-6 py-4 flex items-center justify-between bg-black/80 border-b border-white/10 backdrop-blur-md">
        <button
          onClick={onBack}
          disabled={isMinting}
          className="text-gray-400 hover:text-white uppercase tracking-widest text-xs font-cinzel font-bold cursor-pointer"
        >
          ← Back
        </button>
        <div className="flex items-center gap-2 text-xs font-cinzel font-black tracking-widest text-shin-gold uppercase">
          <Sparkles size={15} />
          <span>Shrine of Awakening</span>
        </div>
        <button
          onClick={onHome}
          disabled={isMinting}
          className="text-gray-400 hover:text-shin-red uppercase tracking-widest text-xs font-cinzel font-bold cursor-pointer"
        >
          ✕ Exit
        </button>
      </div>

      <div className="w-full max-w-5xl flex flex-col md:flex-row items-center justify-center gap-8 my-auto pt-16 pb-8">
        {/* Left: Animated Warrior Pedestal & 10-Class Selector */}
        <div className="flex flex-col items-center w-full md:w-5/12">
          <span className="text-[10px] font-cinzel font-bold uppercase bg-shin-gold/20 text-shin-gold px-3 py-1 rounded-full border border-shin-gold/40 mb-2">
            Choose Warrior Lineage
          </span>
          <h2 className="text-3xl md:text-5xl font-cinzel font-black uppercase mb-3 text-white glow-gold">
            {char.name}
          </h2>

          <div className="relative w-64 h-64 md:w-72 md:h-72 flex flex-col items-center justify-end p-4 border-2 bg-gradient-to-b from-amber-950/30 via-gray-950 to-black border-shin-gold/50 rounded-2xl shadow-[0_0_50px_rgba(251,191,36,0.2)] overflow-hidden mb-4">
            <div className="absolute bottom-4 w-44 h-8 rounded-full bg-shin-gold/25 blur-md" />
            <img
              src={`/assets/Shin_gifs/${char.gif}`}
              alt={char.name}
              className="w-44 h-44 md:w-52 md:h-52 object-contain scale-125 origin-bottom animate-float-idle z-10"
              style={{ imageRendering: 'pixelated' }}
            />
          </div>

          {/* 10 Warrior Classes Roster Picker */}
          <div className="flex flex-wrap justify-center gap-1.5 max-w-md">
            {Roster.map((r) => (
              <button
                key={r.id}
                onClick={() => {
                  setSelectedCharId(r.id);
                  setFighterTitle(`${playerName || 'Warrior'}'s ${r.name}`);
                }}
                className={`px-3 py-1.5 rounded-lg text-[10px] font-cinzel uppercase border transition-all cursor-pointer ${
                  selectedCharId === r.id
                    ? 'bg-shin-gold text-black border-shin-gold font-black shadow-[0_0_12px_rgba(251,191,36,0.5)]'
                    : 'bg-white/5 text-gray-400 border-white/10 hover:text-white hover:border-white/30'
                }`}
              >
                {r.name}
              </button>
            ))}
          </div>
        </div>

        {/* Right: Warrior Oath, Starting War Chest & Fighting Style */}
        <div className="flex flex-col w-full md:w-7/12 bg-gray-950/95 border-2 border-white/15 rounded-2xl p-6 relative shadow-2xl">
          <div className="flex items-center justify-between border-b border-white/10 pb-3 mb-4">
            <div>
              <h3 className="text-lg md:text-xl font-cinzel font-black text-shin-gold uppercase tracking-wider">
                Awaken New Champion
              </h3>
              <p className="text-xs text-gray-400">
                Every awakened Champion receives their own personal War Chest to fight in 1v1 duels
                or the 24/7 Shadow Budōkan.
              </p>
            </div>
            <div className="text-right font-mono text-xs shrink-0">
              <div className="text-[10px] text-gray-400 uppercase">Your War Chest</div>
              <div className="text-shin-gold font-bold">{walletState.NEAR.toFixed(2)} NEAR</div>
            </div>
          </div>

          {/* Combat Attributes */}
          <div className="grid grid-cols-3 gap-3 mb-4">
            <div className="bg-black/70 border border-white/10 p-3 rounded-xl">
              <div className="text-[10px] text-gray-400 uppercase flex items-center gap-1">
                <Swords size={11} className="text-red-400" /> Attack
              </div>
              <div className="text-lg font-mono font-bold text-red-400">{stats.power}</div>
              <div className="h-1.5 bg-gray-800 rounded mt-1 overflow-hidden">
                <div className="h-full bg-red-500" style={{ width: `${stats.power}%` }} />
              </div>
            </div>
            <div className="bg-black/70 border border-white/10 p-3 rounded-xl">
              <div className="text-[10px] text-gray-400 uppercase flex items-center gap-1">
                <Zap size={11} className="text-blue-400" /> Speed
              </div>
              <div className="text-lg font-mono font-bold text-blue-400">{stats.speed}</div>
              <div className="h-1.5 bg-gray-800 rounded mt-1 overflow-hidden">
                <div className="h-full bg-blue-500" style={{ width: `${stats.speed}%` }} />
              </div>
            </div>
            <div className="bg-black/70 border border-white/10 p-3 rounded-xl">
              <div className="text-[10px] text-gray-400 uppercase flex items-center gap-1">
                <Shield size={11} className="text-emerald-400" /> Guard
              </div>
              <div className="text-lg font-mono font-bold text-emerald-400">{stats.defense}</div>
              <div className="h-1.5 bg-gray-800 rounded mt-1 overflow-hidden">
                <div className="h-full bg-emerald-500" style={{ width: `${stats.defense}%` }} />
              </div>
            </div>
          </div>

          {/* Custom Champion Name */}
          <div className="mb-4">
            <label className="block text-[10px] font-cinzel font-bold text-gray-300 uppercase tracking-widest mb-1">
              Champion Name / Title
            </label>
            <input
              type="text"
              maxLength={28}
              value={fighterTitle}
              onChange={(e) => setFighterTitle(e.target.value)}
              className="w-full bg-black border border-white/20 rounded-xl px-4 py-2.5 text-sm font-cinzel font-bold text-white focus:outline-none focus:border-shin-gold"
            />
          </div>

          {/* Starting War Chest & Match Stake */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-4">
            <div className="bg-white/5 border border-white/10 p-3 rounded-xl">
              <div className="text-[10px] font-cinzel font-bold text-shin-gold uppercase tracking-wider mb-1.5 flex items-center gap-1">
                <Coins size={12} /> Starting War Chest
              </div>
              <div className="flex gap-1.5">
                {[0, 3, 5, 10].map((amt) => (
                  <button
                    key={amt}
                    onClick={() => setInitialAgentBankroll(amt)}
                    className={`flex-1 py-1.5 rounded-lg font-mono text-xs border cursor-pointer ${
                      initialAgentBankroll === amt
                        ? 'bg-shin-gold text-black border-shin-gold font-bold'
                        : 'bg-black/60 text-gray-400 border-white/10'
                    }`}
                  >
                    {amt}N
                  </button>
                ))}
              </div>
            </div>

            <div className="bg-white/5 border border-white/10 p-3 rounded-xl">
              <div className="text-[10px] font-cinzel font-bold text-emerald-400 uppercase tracking-wider mb-1.5 flex items-center gap-1">
                <Swords size={12} /> Stake Per Budōkan Duel
              </div>
              <div className="flex gap-1.5">
                {[0.5, 1, 2, 5].map((amt) => (
                  <button
                    key={amt}
                    onClick={() => setWagerPerFight(amt)}
                    className={`flex-1 py-1.5 rounded-lg font-mono text-xs border cursor-pointer ${
                      wagerPerFight === amt
                        ? 'bg-emerald-500 text-black border-emerald-500 font-bold'
                        : 'bg-black/60 text-gray-400 border-white/10'
                    }`}
                  >
                    {amt}N
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* Shadow Fighting Style */}
          <div className="mb-5">
            <label className="block text-[10px] font-cinzel font-bold text-gray-300 uppercase tracking-widest mb-1.5">
              Shadow Fighting Style (For Autonomous Arena Battles)
            </label>
            <div className="grid grid-cols-2 gap-2">
              {COMBAT_DOCTRINES.map((d) => (
                <button
                  key={d.id}
                  onClick={() => setDoctrine(d.id)}
                  className={`p-2.5 rounded-xl border text-left transition-all cursor-pointer ${
                    doctrine === d.id
                      ? 'bg-shin-red/20 border-shin-red text-white shadow-[0_0_15px_rgba(255,42,42,0.3)]'
                      : 'bg-black/50 border-white/10 text-gray-400 hover:border-white/30'
                  }`}
                >
                  <div className="text-xs font-cinzel font-bold">{d.name}</div>
                  <div className="text-[10px] text-shin-gold font-mono">{d.badge}</div>
                </button>
              ))}
            </div>
          </div>

          {/* Summary & Awaken Button */}
          <div className="bg-black/80 border border-white/10 rounded-xl p-3 mb-4 flex items-center justify-between text-xs font-mono">
            <span className="text-gray-400">
              Shrine Tribute ({mintCostNear} NEAR) + Starting War Chest ({initialAgentBankroll} NEAR):
            </span>
            <span className="text-shin-gold font-bold text-sm">
              {(mintCostNear + initialAgentBankroll).toFixed(2)} NEAR Total
            </span>
          </div>

          {errorMsg && (
            <div className="text-red-400 text-xs text-center mb-3 font-sans">{errorMsg}</div>
          )}

          <button
            onClick={handleMint}
            disabled={isMinting}
            className="w-full py-4 bg-gradient-to-r from-shin-gold via-amber-400 to-shin-gold hover:brightness-110 text-black font-cinzel font-black text-base tracking-[0.2em] uppercase rounded-xl shadow-[0_0_30px_rgba(251,191,36,0.5)] transition-all cursor-pointer disabled:opacity-50"
          >
            {isMinting
              ? '⚡ AWAKENING CHAMPION...'
              : '⚡ AWAKEN CHAMPION & ENTER BARRACKS'}
          </button>
        </div>
      </div>
    </div>
  );
};

export default MintFighterFlow;
