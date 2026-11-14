'use client';

import React, { useEffect, useState } from 'react';
import { io } from 'socket.io-client';
import { nearArenaEngine } from '../services/nearArenaEngine';
import { Roster } from './PreGameFlow';
import { Play, CheckCircle2, Radio } from 'lucide-react';

interface SpectateScreenProps {
  onClose: () => void;
  onWatchLive: (matchData: any) => void;
}

const SpectateScreen: React.FC<SpectateScreenProps> = ({ onClose, onWatchLive }) => {
  const [arenaState, setArenaState] = useState(() => nearArenaEngine.getState());
  const [serverMatches, setServerMatches] = useState<any[]>([]);
  const [selectedMatch, setSelectedMatch] = useState<any | null>(null);
  const [betAmountShin, setBetAmountShin] = useState<string>('250');
  const [status, setStatus] = useState<string>('');

  useEffect(() => {
    const sync = () => setArenaState({ ...nearArenaEngine.getState() });
    window.addEventListener('nearArenaStateUpdated', sync);

    const serverUrl = process.env.NEXT_PUBLIC_SERVER_URL || 'http://localhost:3001';
    const socket = io(serverUrl, { reconnectionAttempts: 5 });

    socket.on('connect', () => {
      socket.emit('get_active_matches');
    });

    socket.on('active_matches_updated', (list: any[]) => {
      if (Array.isArray(list)) {
        setServerMatches(list);
      }
    });

    const poll = setInterval(() => {
      if (socket.connected) {
        socket.emit('get_active_matches');
      }
    }, 3000);

    return () => {
      window.removeEventListener('nearArenaStateUpdated', sync);
      clearInterval(poll);
      socket.disconnect();
    };
  }, []);

  const getCharGif = (charId: string) => {
    const norm = String(charId || 'fighter').toLowerCase();
    const found = Roster.find((r) => r.id.toLowerCase() === norm);
    return found ? `/assets/Shin_gifs/${found.gif}` : '/assets/Shin_gifs/Fighter_AllActions.gif';
  };

  const handlePlaceBet = async (match: any, side: 'p1' | 'p2') => {
    try {
      const shinAmt = Math.max(50, Math.floor(Number(betAmountShin) || 250));
      const targetTokenId =
        side === 'p1' ? match.p1?.tokenId || match.p1AccountId : match.p2?.tokenId || match.p2AccountId;
      if (targetTokenId) {
        await nearArenaEngine.placeSpectatorBetShin(match.matchId, targetTokenId, shinAmt);
      }
      setArenaState({ ...nearArenaEngine.getState() });
      setStatus(`Locked ${shinAmt.toLocaleString()} $SHIN Pari-Mutuel Bet on-chain!`);
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
      <div className="bg-black border border-shin-gold rounded-2xl p-4 sm:p-6 md:p-8 w-full max-w-4xl relative animate-in zoom-in-95 duration-200 shadow-[0_0_25px_rgba(212,175,55,0.3)] flex flex-col max-h-[88%]">
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
              Wallet: <span className="text-white">{arenaState.playerWallet.accountId}</span> (
              <span className="text-shin-gold font-bold">
                {Math.round(arenaState.playerWallet.SHIN ?? 0).toLocaleString()} $SHIN
              </span>
              )
            </p>
          </div>
          <div className="flex items-center gap-2 text-xs text-red-400 font-bold tracking-widest bg-red-500/10 px-3 py-1.5 border border-red-500/30 rounded-full">
            <Radio size={13} className="text-red-500 animate-pulse" />
            REAL SERVER BROADCASTS
          </div>
        </div>

        {status && (
          <div className="bg-shin-gold/20 border border-shin-gold text-shin-gold text-center font-cinzel text-xs py-2 px-4 rounded-lg mb-4 flex items-center justify-center gap-2">
            <CheckCircle2 size={15} />
            <span>{status}</span>
          </div>
        )}

        <div className="flex-1 overflow-y-auto pr-1 space-y-4">
          {serverMatches.length === 0 ? (
            <div className="py-12 text-center font-mono text-xs text-gray-400 border border-white/10 rounded-xl">
              No live broadcasts active on the server right now.
            </div>
          ) : (
            serverMatches.map((m) => {
              const p1Name = m.p1Name || m.p1?.name || m.hostName || 'Fighter 1';
              const p2Name = m.p2Name || m.p2?.name || 'Challenger';
              const p1Char = m.p1Type || m.p1?.charId || 'samurai';
              const p2Char = m.p2Type || m.p2?.charId || 'shinobi';
              const p1Hp = m.sim?.p1Hp ?? 100;
              const p2Hp = m.sim?.p2Hp ?? 100;
              const timer = m.sim?.matchTimer ?? 99;
              const potShin =
                m.fighterPoolShin ||
                (m.wager?.token === 'SHIN' ? Number(m.wager.amount || 0) * 2 : 500);

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
                          src={getCharGif(p1Char)}
                          alt={p1Name}
                          className="w-14 h-14 object-contain scale-125"
                          style={{ imageRendering: 'pixelated' }}
                        />
                      </div>
                      <span className="text-xs font-cinzel font-bold text-white truncate w-full">
                        {p1Name}
                      </span>
                      <span className="text-[10px] text-gray-400 font-mono truncate w-full">
                        {m.p1AccountId || m.p1?.accountId || ''}
                      </span>
                      <span className="text-xs text-emerald-400 mt-1 font-mono font-bold">
                        {p1Hp}% HP
                      </span>
                    </div>

                    {/* VS Center */}
                    <div className="flex flex-col items-center">
                      <span className="text-shin-red font-cinzel text-2xl font-black">VS</span>
                      <span className="text-[10px] font-mono text-gray-400 mt-1 bg-white/5 px-2 py-0.5 rounded">
                        {m.viewers || 0} Watching • ⏱ {timer}s
                      </span>
                      <span className="text-[10px] mt-1.5 tracking-widest uppercase font-bold px-2 py-0.5 text-emerald-400 bg-emerald-500/10 border border-emerald-500/40 rounded">
                        FIGHTING LIVE
                      </span>
                    </div>

                    {/* Fighter 2 */}
                    <div className="flex flex-col items-center text-center w-36">
                      <div className="w-16 h-16 border-2 border-blue-500 rounded-full overflow-hidden bg-gray-900 mb-2 flex items-center justify-center">
                        <img
                          src={getCharGif(p2Char)}
                          alt={p2Name}
                          className="w-14 h-14 object-contain scale-x-[-1.25] scale-y-125"
                          style={{ imageRendering: 'pixelated' }}
                        />
                      </div>
                      <span className="text-xs font-cinzel font-bold text-white truncate w-full">
                        {p2Name}
                      </span>
                      <span className="text-[10px] text-gray-400 font-mono truncate w-full">
                        {m.p2AccountId || m.p2?.accountId || ''}
                      </span>
                      <span className="text-xs text-blue-400 mt-1 font-mono font-bold">
                        {p2Hp}% HP
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
                          {potShin.toLocaleString()} $SHIN
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
                          onWatchLive({
                            matchId: m.matchId,
                            p1Type: p1Char,
                            p2Type: p2Char,
                            hostName: p1Name,
                            p1Name,
                            p2Name,
                            isServerBroadcast: true,
                          });
                        }}
                        className="flex-1 md:flex-initial px-4 py-2.5 bg-shin-red hover:bg-red-700 text-white font-cinzel font-black text-xs uppercase tracking-widest transition-colors rounded-lg flex items-center justify-center gap-1.5 cursor-pointer"
                      >
                        <Play size={12} fill="currentColor" /> WATCH LIVE
                      </button>
                    </div>
                  </div>
                </div>
              );
            })
          )}
        </div>

        {/* Instant Pari-Mutuel Bet Modal */}
        {selectedMatch && (
          <div className="absolute inset-0 bg-black/95 z-50 flex items-center justify-center rounded-2xl p-4 backdrop-blur-md">
            <div className="w-full max-w-md bg-gray-950 border border-shin-gold p-6 rounded-2xl animate-in zoom-in-95">
              <h3 className="text-xl font-cinzel font-bold text-white mb-2 text-center uppercase">
                Place $SHIN Spectator Bet
              </h3>
              <p className="text-xs text-gray-400 text-center mb-5">
                Winning bettors split 90% of the spectator pool; 5% royalty goes to the winning Fighter
                NFT&apos;s wallet and 5% to Dev Treasury.
              </p>

              <div className="mb-5">
                <label className="block text-gray-400 text-[10px] mb-1.5 uppercase tracking-widest">
                  Bet Amount ($SHIN)
                </label>
                <input
                  type="number"
                  step="50"
                  min="50"
                  value={betAmountShin}
                  onChange={(e) => setBetAmountShin(e.target.value)}
                  className="w-full bg-black border border-gray-700 rounded-lg text-white font-mono text-lg p-3 focus:outline-none focus:border-shin-gold"
                />
              </div>

              <div className="grid grid-cols-2 gap-3 mb-4">
                <button
                  onClick={() => handlePlaceBet(selectedMatch, 'p1')}
                  className="bg-emerald-950/70 border border-emerald-500 hover:bg-emerald-900 p-3.5 rounded-xl flex flex-col items-center cursor-pointer"
                >
                  <span className="font-cinzel font-bold text-white text-sm">
                    Bet {selectedMatch.p1Name || selectedMatch.hostName || 'Fighter 1'}
                  </span>
                </button>

                <button
                  onClick={() => handlePlaceBet(selectedMatch, 'p2')}
                  className="bg-blue-950/70 border border-blue-500 hover:bg-blue-900 p-3.5 rounded-xl flex flex-col items-center cursor-pointer"
                >
                  <span className="font-cinzel font-bold text-white text-sm">
                    Bet {selectedMatch.p2Name || 'Challenger'}
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
