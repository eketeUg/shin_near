'use client';

import React, { useEffect, useState } from 'react';
import { nearArenaEngine, ActiveArenaMatch } from '../services/nearArenaEngine';
import { Roster } from './PreGameFlow';
import { Play, Coins, CheckCircle2 } from 'lucide-react';

interface SpectateScreenProps {
  onClose: () => void;
  onWatchLive: (matchData: any) => void;
}

const SpectateScreen: React.FC<SpectateScreenProps> = ({ onClose, onWatchLive }) => {
  const [arenaState, setArenaState] = useState(() => nearArenaEngine.getState());
  const [selectedMatch, setSelectedMatch] = useState<ActiveArenaMatch | null>(null);
  const [betAmount, setBetAmount] = useState<string>('1.0');
  const [status, setStatus] = useState<string>('');

  useEffect(() => {
    const sync = () => setArenaState({ ...nearArenaEngine.getState() });
    window.addEventListener('nearArenaStateUpdated', sync);
    return () => window.removeEventListener('nearArenaStateUpdated', sync);
  }, []);

  const getCharGif = (charId: string) => {
    const found = Roster.find((r) => r.id === charId);
    return found ? `/assets/Shin_gifs/${found.gif}` : '/assets/Shin_gifs/Fighter_AllActions.gif';
  };

  const handlePlaceBet = (matchId: string, side: 'p1' | 'p2') => {
    try {
      const amt = parseFloat(betAmount) || 1.0;
      nearArenaEngine.placeSpectatorBet(matchId, side, amt);
      setArenaState({ ...nearArenaEngine.getState() });
      setStatus(`Locked ${amt} NEAR Pari-Mutuel Bet (0 Wallet Popups)!`);
      setTimeout(() => {
        setStatus('');
        setSelectedMatch(null);
      }, 1500);
    } catch (err: any) {
      setStatus(err.message || 'Bet failed');
      setTimeout(() => setStatus(''), 3000);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/90 p-4">
      <div className="bg-black border border-shin-gold rounded-2xl p-6 md:p-8 w-full max-w-4xl relative animate-in zoom-in-95 duration-200 shadow-[0_0_25px_rgba(212,175,55,0.3)] flex flex-col max-h-[88dvh]">
        <button
          onClick={onClose}
          className="absolute top-4 right-4 text-shin-gold hover:text-white transition-colors text-xl font-bold cursor-pointer"
        >
          ✕
        </button>

        <div className="flex flex-wrap items-center justify-between gap-3 mb-5 pr-8">
          <div>
            <h2 className="text-2xl md:text-3xl font-cinzel text-shin-gold uppercase drop-shadow-md">
              Live Arena Pari-Mutuel
            </h2>
            <p className="text-xs text-gray-400 font-mono">
              Your Invisible NEAR Wallet: <span className="text-white">{arenaState.playerWallet.accountId}</span> (
              <span className="text-shin-gold font-bold">{arenaState.playerWallet.NEAR.toFixed(2)} NEAR</span>)
            </p>
          </div>
          <div className="flex items-center gap-2 text-xs text-red-400 font-bold tracking-widest bg-red-500/10 px-3 py-1.5 border border-red-500/30 rounded-full">
            <span className="w-2 h-2 rounded-full bg-red-500 animate-pulse" />
            LIVE ON NEAR • 0 POPUPS
          </div>
        </div>

        {status && (
          <div className="bg-shin-gold/20 border border-shin-gold text-shin-gold text-center font-cinzel text-xs py-2 px-4 rounded-lg mb-4 flex items-center justify-center gap-2">
            <CheckCircle2 size={15} />
            <span>{status}</span>
          </div>
        )}

        <div className="flex-1 overflow-y-auto pr-1 space-y-4">
          {arenaState.activeMatches.map((m) => {
            const totalSpecPool = m.spectatorPoolP1Near + m.spectatorPoolP2Near;
            return (
              <div
                key={m.matchId}
                className="bg-gray-950/90 border border-gray-800 hover:border-shin-gold/60 rounded-xl p-5 flex flex-col md:flex-row justify-between items-center gap-6 transition-all"
              >
                <div className="flex items-center justify-around w-full md:w-auto flex-1 gap-4">
                  {/* Fighter 1 */}
                  <div className="flex flex-col items-center text-center w-36">
                    <div className="w-16 h-16 border-2 border-shin-red rounded-full overflow-hidden bg-gray-900 mb-2 flex items-center justify-center">
                      <img
                        src={getCharGif(m.p1.charId)}
                        alt={m.p1.name}
                        className="w-14 h-14 object-contain scale-125"
                        style={{ imageRendering: 'pixelated' }}
                      />
                    </div>
                    <span className="text-xs font-cinzel font-bold text-white truncate w-full">
                      {m.p1.title}
                    </span>
                    <span className="text-[10px] text-gray-400 font-mono truncate w-full">
                      {m.p1.agentWalletId}
                    </span>
                    <span className="text-xs text-emerald-400 mt-1 font-mono font-bold">
                      {m.spectatorPoolP1Near.toFixed(2)} NEAR Bet Pool
                    </span>
                  </div>

                  {/* VS Center */}
                  <div className="flex flex-col items-center">
                    <span className="text-shin-red font-cinzel text-2xl font-black">VS</span>
                    <span className="text-[10px] font-mono text-gray-400 mt-1 bg-white/5 px-2 py-0.5 rounded">
                      {m.viewers} Watching
                    </span>
                    <span className="text-[10px] mt-1.5 tracking-widest uppercase font-bold px-2 py-0.5 text-emerald-400 bg-emerald-500/10 border border-emerald-500/40 rounded">
                      FIGHTING LIVE
                    </span>
                  </div>

                  {/* Fighter 2 */}
                  <div className="flex flex-col items-center text-center w-36">
                    <div className="w-16 h-16 border-2 border-blue-500 rounded-full overflow-hidden bg-gray-900 mb-2 flex items-center justify-center">
                      <img
                        src={getCharGif(m.p2.charId)}
                        alt={m.p2.name}
                        className="w-14 h-14 object-contain scale-x-[-1.25] scale-y-125"
                        style={{ imageRendering: 'pixelated' }}
                      />
                    </div>
                    <span className="text-xs font-cinzel font-bold text-white truncate w-full">
                      {m.p2.title}
                    </span>
                    <span className="text-[10px] text-gray-400 font-mono truncate w-full">
                      {m.p2.agentWalletId}
                    </span>
                    <span className="text-xs text-blue-400 mt-1 font-mono font-bold">
                      {m.spectatorPoolP2Near.toFixed(2)} NEAR Bet Pool
                    </span>
                  </div>
                </div>

                {/* Right: Pool Totals & Action Buttons */}
                <div className="flex flex-col items-center md:items-end gap-2 w-full md:w-auto shrink-0 border-t md:border-t-0 border-white/10 pt-4 md:pt-0">
                  <div className="flex gap-4 md:flex-col md:gap-1 text-right">
                    <div>
                      <div className="text-[10px] text-gray-400 uppercase tracking-widest">
                        Fighter Wager Pool
                      </div>
                      <div className="text-base text-shin-gold font-mono font-bold">
                        {m.fighterPoolNear.toFixed(2)} NEAR
                      </div>
                    </div>
                    <div>
                      <div className="text-[10px] text-gray-500 uppercase">Spectator Pool</div>
                      <div className="text-sm text-emerald-400 font-mono font-bold">
                        {totalSpecPool.toFixed(2)} NEAR
                      </div>
                    </div>
                  </div>

                  <div className="flex gap-2 w-full md:w-auto pt-2">
                    <button
                      onClick={() => setSelectedMatch(m)}
                      className="flex-1 md:flex-initial px-4 py-2.5 bg-shin-gold text-black font-cinzel font-black text-xs uppercase tracking-widest hover:bg-yellow-400 transition-colors rounded-lg cursor-pointer"
                    >
                      PLACE BET
                    </button>
                    <button
                      onClick={() => {
                        onClose();
                        onWatchLive(m);
                      }}
                      className="flex-1 md:flex-initial px-4 py-2.5 bg-shin-red hover:bg-red-700 text-white font-cinzel font-black text-xs uppercase tracking-widest transition-colors rounded-lg flex items-center justify-center gap-1.5 cursor-pointer"
                    >
                      <Play size={12} fill="currentColor" /> WATCH LIVE
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>

        {/* Instant Pari-Mutuel Bet Modal */}
        {selectedMatch && (
          <div className="absolute inset-0 bg-black/95 z-50 flex items-center justify-center rounded-2xl p-4 backdrop-blur-md">
            <div className="w-full max-w-md bg-gray-950 border border-shin-gold p-6 rounded-2xl animate-in zoom-in-95">
              <h3 className="text-xl font-cinzel font-bold text-white mb-2 text-center uppercase">
                Place Pari-Mutuel Spectator Bet
              </h3>
              <p className="text-xs text-gray-400 text-center mb-5">
                Signed automatically by your invisible NEAR wallet (0 popups). Winning bettors split
                95% of the spectator pool; 5% royalty goes to the winning Fighter NFT&apos;s wallet!
              </p>

              <div className="mb-5">
                <label className="block text-gray-400 text-[10px] mb-1.5 uppercase tracking-widest">
                  Bet Amount (NEAR)
                </label>
                <input
                  type="number"
                  step="0.5"
                  min="0.5"
                  value={betAmount}
                  onChange={(e) => setBetAmount(e.target.value)}
                  className="w-full bg-black border border-gray-700 rounded-lg text-white font-mono text-lg p-3 focus:outline-none focus:border-shin-gold"
                />
              </div>

              <div className="grid grid-cols-2 gap-3 mb-4">
                <button
                  onClick={() => handlePlaceBet(selectedMatch.matchId, 'p1')}
                  className="bg-emerald-950/70 border border-emerald-500 hover:bg-emerald-900 p-3.5 rounded-xl flex flex-col items-center cursor-pointer"
                >
                  <span className="font-cinzel font-bold text-white text-sm">
                    Bet {selectedMatch.p1.title}
                  </span>
                  <span className="text-[10px] text-emerald-400 font-mono mt-1">
                    Pool: {selectedMatch.spectatorPoolP1Near.toFixed(2)} NEAR
                  </span>
                </button>

                <button
                  onClick={() => handlePlaceBet(selectedMatch.matchId, 'p2')}
                  className="bg-blue-950/70 border border-blue-500 hover:bg-blue-900 p-3.5 rounded-xl flex flex-col items-center cursor-pointer"
                >
                  <span className="font-cinzel font-bold text-white text-sm">
                    Bet {selectedMatch.p2.title}
                  </span>
                  <span className="text-[10px] text-blue-400 font-mono mt-1">
                    Pool: {selectedMatch.spectatorPoolP2Near.toFixed(2)} NEAR
                  </span>
                </button>
              </div>

              <button
                onClick={() => setSelectedMatch(null)}
                className="w-full py-2 text-gray-400 hover:text-white uppercase tracking-widest text-xs font-cinzel cursor-pointer"
              >
                Cancel
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default SpectateScreen;
