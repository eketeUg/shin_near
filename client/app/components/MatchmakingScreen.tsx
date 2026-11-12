'use client';

import React, { useEffect, useState, useRef } from 'react';
import { ShieldCheck, Sword, Search, X, Users, Bot } from 'lucide-react';
import { io, Socket } from 'socket.io-client';
import { nearArenaEngine } from '../services/nearArenaEngine';

interface MatchmakingScreenProps {
  playerName: string;
  charType: string;
  wager: { token: string; amount: number } | null;
  onMatchFound: (matchData: any) => void;
  onCancel: () => void;
}

const MatchmakingScreen: React.FC<MatchmakingScreenProps> = ({
  playerName,
  charType,
  wager,
  onMatchFound,
  onCancel,
}) => {
  const [status, setStatus] = useState<string>('Initializing...');
  const [isLocking, setIsLocking] = useState<boolean>(!!wager);
  const [isSearching, setIsSearching] = useState<boolean>(!wager);
  const socketRef = useRef<Socket | null>(null);
  const matchedRef = useRef<boolean>(false);
  const [searchTime, setSearchTime] = useState(0);

  const SERVER_URL = process.env.NEXT_PUBLIC_SERVER_URL || 'http://localhost:3001';

  const matchWithFundedArenaAgent = () => {
    if (matchedRef.current) return;
    matchedRef.current = true;
    const arenaMatch = nearArenaEngine.createImmediateAgentMatch();
    const opponentAgent =
      arenaMatch.p2.charId !== charType ? arenaMatch.p2 : arenaMatch.p1;

    setStatus(`Challenger Found: ${opponentAgent.title} (${opponentAgent.agentWalletId})!`);
    setTimeout(() => {
      onMatchFound({
        isAgentFallback: true,
        matchId: arenaMatch.matchId,
        p1Type: charType,
        p2Type: opponentAgent.charId,
        p1Name: playerName,
        p2Name: opponentAgent.title,
      });
    }, 1000);
  };

  useEffect(() => {
    let timer: any;
    if (isSearching) {
      timer = setInterval(() => {
        setSearchTime((prev) => {
          const next = prev + 1;
          // Auto-match with a funded NEAR Fighter Agent after 4s if no human opponent is queued
          if (next >= 4 && !matchedRef.current) {
            matchWithFundedArenaAgent();
          }
          return next;
        });
      }, 1000);
    }
    return () => clearInterval(timer);
  }, [isSearching]);

  useEffect(() => {
    if (wager) {
      setStatus(`Locking ${wager.amount} ${wager.token} in NEAR Escrow Pool (0 Popups)...`);
      const lockTimer = setTimeout(() => {
        setIsLocking(false);
        setIsSearching(true);
        startMatchmaking();
      }, 1400);
      return () => clearTimeout(lockTimer);
    } else {
      startMatchmaking();
    }

    return () => {
      if (socketRef.current) {
        socketRef.current.emit('cancel_matchmaking');
        socketRef.current.disconnect();
      }
    };
  }, []);

  const startMatchmaking = () => {
    setStatus(
      wager
        ? `Searching for ${wager.amount} ${wager.token} challenger...`
        : 'Searching for Arena Challenger...',
    );

    try {
      const socket = io(SERVER_URL, { timeout: 2500, reconnectionAttempts: 1 });
      socketRef.current = socket;

      socket.on('connect', () => {
        socket.emit('join_matchmaking', {
          username: playerName,
          charType: charType,
          wager: wager,
          rating: 1200,
        });
      });

      socket.on('match_found', (data) => {
        if (matchedRef.current) return;
        matchedRef.current = true;
        setStatus('Live Player Found! Entering Arena...');
        setTimeout(() => {
          onMatchFound({
            ...data,
            isHost: data.role === 'P1',
            p1Type: data.role === 'P1' ? charType : data.opponentChar,
            p2Type: data.role === 'P2' ? charType : data.opponentChar,
            p1Name: data.role === 'P1' ? playerName : data.opponentName,
            p2Name: data.role === 'P2' ? playerName : data.opponentName,
          });
        }, 1200);
      });
    } catch {
      // Fallback handled automatically by the 4-second agent challenger timer
    }
  };

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  return (
    <div className="fixed inset-0 z-50 flex flex-col items-center justify-center bg-black/95 text-white backdrop-blur-md overflow-hidden">
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] bg-shin-red/5 rounded-full blur-[120px] pointer-events-none" />

      <div className="absolute top-10 flex flex-col items-center">
        <div className="flex items-center gap-2 px-4 py-1.5 bg-white/5 border border-white/10 rounded-full mb-2">
          <Users size={14} className="text-shin-gold" />
          <span className="text-[10px] font-cinzel font-bold tracking-[0.2em] uppercase text-gray-400">
            NEAR Wager &amp; PvP Lobby
          </span>
        </div>
        <h1 className="text-3xl md:text-5xl font-cinzel font-black tracking-[0.3em] uppercase text-white">
          Matchmaking
        </h1>
      </div>

      <div className="relative flex flex-col items-center max-w-lg w-full px-8 text-center">
        <div className="relative w-44 h-44 mb-10">
          <div className="absolute inset-0 border border-white/10 rounded-full animate-ping opacity-20" />
          <div className="absolute inset-0 flex items-center justify-center">
            <div className="w-36 h-36 border-b-2 border-r-2 border-shin-red/40 rounded-full animate-spin" />
          </div>
          <div className="absolute inset-0 flex flex-col items-center justify-center">
            {isLocking ? (
              <ShieldCheck className="text-shin-gold animate-pulse" size={44} />
            ) : (
              <Sword size={36} className="text-shin-red animate-pulse" />
            )}
          </div>
        </div>

        <div className="space-y-4 mb-10">
          <div className="flex flex-col items-center gap-2">
            <span className="text-[10px] text-shin-gold font-cinzel tracking-widest uppercase animate-pulse">
              {isLocking ? 'Invisible NEAR Escrow Lock' : 'Seeking Challenger'}
            </span>
            <h3 className="text-base md:text-lg font-cinzel text-white uppercase tracking-wider min-h-[1.5em]">
              {status}
            </h3>
          </div>

          <div className="grid grid-cols-2 gap-8 pt-3">
            <div className="flex flex-col items-center gap-1">
              <span className="text-[9px] text-gray-500 uppercase tracking-widest">Match Pool</span>
              <span className="text-xs font-cinzel text-shin-gold font-bold">
                {wager ? `${wager.amount * 2} ${wager.token} POT` : 'FREE FIGHT'}
              </span>
            </div>
            <div className="flex flex-col items-center gap-1">
              <span className="text-[9px] text-gray-500 uppercase tracking-widest">Queue Time</span>
              <span className="text-xs font-mono text-white">{formatTime(searchTime)}</span>
            </div>
          </div>
        </div>

        <div className="flex flex-wrap justify-center gap-3">
          <button
            onClick={matchWithFundedArenaAgent}
            className="px-6 py-3 bg-shin-gold text-black font-cinzel font-black text-xs tracking-widest uppercase rounded-lg hover:bg-yellow-400 transition-all flex items-center gap-2 cursor-pointer"
          >
            <Bot size={15} /> Fight Funded Arena Agent Now
          </button>
          <button
            onClick={onCancel}
            className="px-6 py-3 bg-white/5 border border-white/10 hover:border-shin-red text-gray-400 hover:text-white font-cinzel font-bold text-xs tracking-widest uppercase rounded-lg flex items-center gap-2 cursor-pointer"
          >
            <X size={15} /> Cancel
          </button>
        </div>
      </div>
    </div>
  );
};

export default MatchmakingScreen;
