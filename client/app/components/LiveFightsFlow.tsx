'use client';

import React, { useEffect, useState } from 'react';
import { io } from 'socket.io-client';
import { Roster } from './PreGameFlow';
import { Play, Radio, Users } from 'lucide-react';

interface LiveFightsFlowProps {
  onWatchMatch: (match: any) => void;
  onBack: () => void;
  onHome: () => void;
}

const LiveFightsFlow: React.FC<LiveFightsFlowProps> = ({ onWatchMatch, onBack, onHome }) => {
  const [serverMatches, setServerMatches] = useState<any[]>([]);
  const [connected, setConnected] = useState(false);

  useEffect(() => {
    const serverUrl = process.env.NEXT_PUBLIC_SERVER_URL || 'http://localhost:3001';
    const socket = io(serverUrl, { reconnectionAttempts: 5 });

    socket.on('connect', () => {
      setConnected(true);
      socket.emit('get_active_matches');
    });

    socket.on('disconnect', () => {
      setConnected(false);
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
      clearInterval(poll);
      socket.disconnect();
    };
  }, []);

  const getCharGif = (charId: string) => {
    const norm = String(charId || 'fighter').toLowerCase();
    const found = Roster.find((r) => r.id.toLowerCase() === norm);
    return found ? `/assets/Shin_gifs/${found.gif}` : '/assets/Shin_gifs/Fighter_AllActions.gif';
  };

  return (
    <div className="fixed inset-0 z-40 bg-black text-white p-6 md:p-12 overflow-y-auto w-full h-full flex flex-col pt-20 pb-24 select-none">
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

      <div className="flex items-center justify-center gap-2 mb-2">
        <span
          className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[10px] font-mono uppercase tracking-wider border ${
            connected
              ? 'bg-red-950/60 border-red-500/50 text-red-300'
              : 'bg-gray-900 border-white/10 text-gray-400'
          }`}
        >
          <Radio size={12} className={connected ? 'text-red-400 animate-pulse' : 'text-gray-500'} />
          {connected ? 'Synchronized Server Broadcast Stream' : 'Connecting to Broadcast Relay...'}
        </span>
      </div>

      <h2 className="text-3xl md:text-5xl font-cinzel text-shin-gold mb-2 uppercase tracking-[0.2em] text-center">
        LIVE ARENA BROADCASTS
      </h2>
      <p className="text-xs text-gray-400 font-cinzel uppercase tracking-widest text-center mb-8">
        Real-Time Multi-Viewer Streams • Everyone Watches the Exact Same Frame, HP &amp; Timer
      </p>

      {serverMatches.length === 0 ? (
        <div className="max-w-lg mx-auto w-full bg-gray-950 border border-white/10 rounded-2xl p-8 text-center font-mono text-xs text-gray-400">
          Waiting for next live arena broadcast stream...
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 max-w-6xl mx-auto w-full">
          {serverMatches.map((m) => {
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
                onClick={() =>
                  onWatchMatch({
                    matchId: m.matchId,
                    p1Type: p1Char,
                    p2Type: p2Char,
                    hostName: p1Name,
                    p1Name,
                    p2Name,
                    isServerBroadcast: true,
                  })
                }
                className="bg-gray-950 border border-gray-800 hover:border-shin-gold rounded-2xl p-6 cursor-pointer group transition-all duration-300 shadow-xl hover:-translate-y-1 relative overflow-hidden"
              >
                <div className="absolute top-0 right-0 bg-red-600 text-white text-[10px] uppercase font-bold px-3 py-1.5 flex items-center gap-1.5 rounded-bl-lg">
                  <div className="w-1.5 h-1.5 rounded-full bg-white animate-pulse" />
                  <Users size={11} />
                  <span>LIVE • {m.viewers || 0} WATCHING</span>
                </div>

                <div className="text-[10px] font-mono text-gray-400 uppercase mb-1">
                  {m.mode || 'LIVE BROADCAST'} • ⏱ {timer}s
                </div>

                <h3 className="text-lg font-cinzel text-white mb-1 truncate pr-24">
                  {p1Name} vs {p2Name}
                </h3>
                <p className="text-xs text-shin-gold font-mono mb-4">
                  Match Pot: {potShin.toLocaleString()} $SHIN
                </p>

                <div className="flex justify-between items-center bg-black/70 p-3 rounded-xl border border-gray-800 mb-4">
                  <div className="text-center w-5/12 flex flex-col items-center">
                    <img
                      src={getCharGif(p1Char)}
                      alt={p1Name}
                      className="w-16 h-16 object-contain mb-1"
                      style={{ imageRendering: 'pixelated' }}
                    />
                    <span className="text-shin-red font-cinzel font-black text-xs uppercase truncate w-full">
                      {p1Name}
                    </span>
                    <div className="w-full h-1.5 bg-gray-800 rounded-full overflow-hidden mt-1">
                      <div
                        className="h-full bg-emerald-400 transition-all duration-300"
                        style={{ width: `${Math.max(0, Math.min(100, p1Hp))}%` }}
                      />
                    </div>
                    <span className="text-[9px] text-gray-400 font-mono mt-0.5">{p1Hp}% HP</span>
                  </div>
                  <div className="text-xl font-black text-shin-gold/80 w-2/12 text-center font-cinzel">
                    VS
                  </div>
                  <div className="text-center w-5/12 flex flex-col items-center">
                    <img
                      src={getCharGif(p2Char)}
                      alt={p2Name}
                      className="w-16 h-16 object-contain scale-x-[-1] mb-1"
                      style={{ imageRendering: 'pixelated' }}
                    />
                    <span className="text-blue-400 font-cinzel font-black text-xs uppercase truncate w-full">
                      {p2Name}
                    </span>
                    <div className="w-full h-1.5 bg-gray-800 rounded-full overflow-hidden mt-1">
                      <div
                        className="h-full bg-emerald-400 transition-all duration-300"
                        style={{ width: `${Math.max(0, Math.min(100, p2Hp))}%` }}
                      />
                    </div>
                    <span className="text-[9px] text-gray-400 font-mono mt-0.5">{p2Hp}% HP</span>
                  </div>
                </div>

                <div className="flex items-center justify-between text-xs text-gray-400 font-mono">
                  <span className="text-shin-gold font-bold flex items-center gap-1 group-hover:translate-x-1 transition-transform">
                    <Play size={13} /> Join Synchronized Stream →
                  </span>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};

export default LiveFightsFlow;
