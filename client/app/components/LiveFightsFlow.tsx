'use client';

import React, { useEffect, useState } from 'react';
import { nearArenaEngine, ActiveArenaMatch } from '../services/nearArenaEngine';
import { Roster } from './PreGameFlow';
import { Play } from 'lucide-react';

interface LiveFightsFlowProps {
  onWatchMatch: (match: any) => void;
  onBack: () => void;
  onHome: () => void;
}

const LiveFightsFlow: React.FC<LiveFightsFlowProps> = ({ onWatchMatch, onBack, onHome }) => {
  const [matches, setMatches] = useState<ActiveArenaMatch[]>(
    () => nearArenaEngine.getState().activeMatches,
  );

  useEffect(() => {
    const sync = () => setMatches([...nearArenaEngine.getState().activeMatches]);
    window.addEventListener('nearArenaStateUpdated', sync);
    return () => window.removeEventListener('nearArenaStateUpdated', sync);
  }, []);

  const getCharGif = (charId: string) => {
    const found = Roster.find((r) => r.id === charId);
    return found ? `/assets/Shin_gifs/${found.gif}` : '/assets/Shin_gifs/Fighter_AllActions.gif';
  };

  return (
    <div className="absolute inset-0 z-40 bg-black text-white p-6 md:p-12 overflow-y-auto w-full h-full flex flex-col pt-20 pb-24">
      <button
        onClick={onBack}
        className="fixed top-6 left-6 text-gray-400 hover:text-white uppercase tracking-widest text-xs md:text-sm font-cinzel font-bold z-50 cursor-pointer"
      >
        ← Back
      </button>

      <button
        onClick={onHome}
        className="fixed top-6 right-6 text-gray-400 hover:text-shin-red uppercase tracking-widest text-xs md:text-sm font-cinzel font-bold z-50 cursor-pointer"
      >
        ✕ Main Menu
      </button>

      <h2 className="text-3xl md:text-5xl font-cinzel text-shin-gold mb-2 uppercase tracking-[0.2em] text-center">
        LIVE ARENA BROADCASTS
      </h2>
      <p className="text-xs text-gray-400 font-cinzel uppercase tracking-widest text-center mb-8">
        Click any ongoing fight to watch live in the 2D Arena &amp; place Pari-Mutuel Spectator Bets
      </p>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 max-w-6xl mx-auto w-full">
        {matches.map((m) => (
          <div
            key={m.matchId}
            onClick={() => onWatchMatch(m)}
            className="bg-gray-950 border border-gray-800 hover:border-shin-gold rounded-2xl p-6 cursor-pointer group transition-all duration-300 shadow-xl hover:-translate-y-1 relative overflow-hidden"
          >
            <div className="absolute top-0 right-0 bg-red-600 text-white text-[10px] uppercase font-bold px-3 py-1.5 flex items-center gap-2 rounded-bl-lg">
              <div className="w-1.5 h-1.5 rounded-full bg-white animate-pulse" />
              LIVE • {m.viewers} WATCHING
            </div>

            <h3 className="text-lg font-cinzel text-white mb-1 truncate pr-24">
              {m.p1.title} vs {m.p2.title}
            </h3>
            <p className="text-xs text-shin-gold font-mono mb-4">
              Fighter Pool: {m.fighterPoolNear.toFixed(2)} NEAR • Spectator Pool:{' '}
              {(m.spectatorPoolP1Near + m.spectatorPoolP2Near).toFixed(2)} NEAR
            </p>

            <div className="flex justify-between items-center bg-black/70 p-3 rounded-xl border border-gray-800 mb-4">
              <div className="text-center w-5/12 flex flex-col items-center">
                <img
                  src={getCharGif(m.p1.charId)}
                  alt={m.p1.name}
                  className="w-16 h-16 object-contain mb-1"
                  style={{ imageRendering: 'pixelated' }}
                />
                <span className="text-shin-red font-cinzel font-black text-xs uppercase truncate w-full">
                  {m.p1.title}
                </span>
                <span className="text-[9px] text-gray-500 font-mono truncate w-full">
                  {m.p1.agentWalletId}
                </span>
              </div>
              <div className="text-xl font-black text-gray-600 w-2/12 text-center font-cinzel">
                VS
              </div>
              <div className="text-center w-5/12 flex flex-col items-center">
                <img
                  src={getCharGif(m.p2.charId)}
                  alt={m.p2.name}
                  className="w-16 h-16 object-contain scale-x-[-1] mb-1"
                  style={{ imageRendering: 'pixelated' }}
                />
                <span className="text-blue-400 font-cinzel font-black text-xs uppercase truncate w-full">
                  {m.p2.title}
                </span>
                <span className="text-[9px] text-gray-500 font-mono truncate w-full">
                  {m.p2.agentWalletId}
                </span>
              </div>
            </div>

            <div className="w-full py-2.5 bg-shin-red/20 group-hover:bg-shin-red text-white font-cinzel font-bold text-xs uppercase tracking-widest rounded-lg flex items-center justify-center gap-2 transition-colors">
              <Play size={13} fill="currentColor" /> Watch &amp; Bet Live
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

export default LiveFightsFlow;
