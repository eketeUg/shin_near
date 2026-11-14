'use client';

import React, { useEffect, useState, useRef } from 'react';
import { ShieldCheck, Sword, X, Users, Bot, KeyRound, Copy, Check } from 'lucide-react';
import { io, Socket } from 'socket.io-client';
import { nearArenaEngine } from '../services/nearArenaEngine';

interface MatchmakingScreenProps {
  playerName: string;
  charType: string;
  wager: { token: string; amount: number } | null;
  initialRoomCode?: string | null;
  onMatchFound: (matchData: any) => void;
  onCancel: () => void;
}

const HUMAN_QUEUE_TIMEOUT_SECS = 15;

const MatchmakingScreen: React.FC<MatchmakingScreenProps> = ({
  playerName,
  charType,
  wager,
  initialRoomCode = null,
  onMatchFound,
  onCancel,
}) => {
  const [status, setStatus] = useState<string>('Initializing...');
  const [isLocking, setIsLocking] = useState<boolean>(!!wager);
  const [isSearching, setIsSearching] = useState<boolean>(!wager);
  const [roomCode, setRoomCode] = useState<string>(initialRoomCode || '');
  const [roomCodeInput, setRoomCodeInput] = useState<string>(initialRoomCode || '');
  const [copiedCode, setCopiedCode] = useState<boolean>(false);
  const [searchTime, setSearchTime] = useState(0);
  const [escrowError, setEscrowError] = useState<string | null>(null);

  const socketRef = useRef<Socket | null>(null);
  const escrowRef = useRef<{ escrowId: string; accountId: string } | null>(null);
  const bcRef = useRef<BroadcastChannel | null>(null);
  const matchedRef = useRef<boolean>(false);
  const clientInstanceIdRef = useRef<string>(
    'tab_' + Math.random().toString(36).substring(2, 9),
  );

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
    }, 900);
  };

  // Queue timer: gives human opponents / friends 15 seconds (or unlimited if waiting in a private Room Code)
  useEffect(() => {
    let timer: any;
    if (isSearching) {
      timer = setInterval(() => {
        setSearchTime((prev) => {
          const next = prev + 1;
          // Auto-match with a funded NEAR Fighter Agent after 15s only in open queue (never override a private Room Code wait)
          if (!roomCode && next >= HUMAN_QUEUE_TIMEOUT_SECS && !matchedRef.current) {
            matchWithFundedArenaAgent();
          }
          return next;
        });
      }, 1000);
    }
    return () => clearInterval(timer);
  }, [isSearching, roomCode]);

  // Cross-Tab BroadcastChannel + Socket.io Matchmaking
  const startMatchmaking = (activeRoomCode: string) => {
    const cleanCode = activeRoomCode.trim().toUpperCase();
    const bucketKey = cleanCode
      ? `room_${cleanCode}`
      : wager
      ? `wager_${wager.token}_${wager.amount}`
      : 'free';

    setStatus(
      cleanCode
        ? `Waiting in Private Room #${cleanCode} for friend...`
        : wager
        ? `Searching for ${wager.amount} ${wager.token} Human or Agent Challenger...`
        : 'Searching Dojo Queue for Live Human Challenger...',
    );

    // 1. Cross-Tab / Same-Device Instant Pairing via BroadcastChannel
    try {
      if (typeof window !== 'undefined' && 'BroadcastChannel' in window) {
        bcRef.current?.close();
        const bc = new BroadcastChannel('shin_near_duel_matchmaking_v1');
        bcRef.current = bc;

        bc.onmessage = (ev) => {
          const msg = ev.data;
          if (!msg || matchedRef.current) return;
          if (msg.senderId === clientInstanceIdRef.current) return;
          if (msg.bucketKey !== bucketKey) return;

          if (msg.type === 'SEEKING_OPPONENT') {
            // Pair with the other tab/window and reply with MATCH_PAIRED
            matchedRef.current = true;
            const matchId = 'duel_' + Math.random().toString(36).substring(2, 9);
            bc.postMessage({
              type: 'MATCH_PAIRED',
              bucketKey,
              senderId: clientInstanceIdRef.current,
              targetId: msg.senderId,
              matchId,
              hostName: msg.username,
              hostChar: msg.charType,
              guestName: playerName,
              guestChar: charType,
            });
            setStatus(`Matched with ${msg.username}! Entering Arena...`);
            setTimeout(() => {
              onMatchFound({
                isHost: false,
                isAgentFallback: false,
                matchId,
                p1Type: msg.charType,
                p2Type: charType,
                p1Name: msg.username,
                p2Name: playerName,
              });
            }, 900);
          } else if (
            msg.type === 'MATCH_PAIRED' &&
            msg.targetId === clientInstanceIdRef.current
          ) {
            matchedRef.current = true;
            setStatus(`Matched with ${msg.guestName}! Entering Arena...`);
            setTimeout(() => {
              onMatchFound({
                isHost: true,
                isAgentFallback: false,
                matchId: msg.matchId,
                p1Type: charType,
                p2Type: msg.guestChar,
                p1Name: playerName,
                p2Name: msg.guestName,
              });
            }, 900);
          }
        };

        bc.postMessage({
          type: 'SEEKING_OPPONENT',
          senderId: clientInstanceIdRef.current,
          bucketKey,
          username: playerName,
          charType,
          wager,
        });
      }
    } catch {}

    // 2. Remote Socket.io Server Pairing
    try {
      socketRef.current?.disconnect();
      const socket = io(SERVER_URL, { timeout: 2500, reconnectionAttempts: 2 });
      socketRef.current = socket;

      socket.on('connect', () => {
        const engineState = nearArenaEngine.getState();
        socket.emit('join_matchmaking', {
          username: playerName,
          charType,
          wager,
          roomCode: cleanCode || null,
          rating: 1200,
          accountId: escrowRef.current?.accountId || engineState.playerWallet.accountId || null,
          escrowId: escrowRef.current?.escrowId || null,
        });
      });

      socket.on('match_found', (data) => {
        if (matchedRef.current) return;
        matchedRef.current = true;
        setStatus(`Live Challenger Found (${data.opponentName})! Entering Arena...`);
        setTimeout(() => {
          onMatchFound({
            ...data,
            isHost: data.role === 'P1',
            p1Type: data.role === 'P1' ? charType : data.opponentChar,
            p2Type: data.role === 'P2' ? charType : data.opponentChar,
            p1Name: data.role === 'P1' ? playerName : data.opponentName,
            p2Name: data.role === 'P2' ? playerName : data.opponentName,
          });
        }, 1000);
      });
    } catch {}
  };

  useEffect(() => {
    let cancelled = false;

    const initQueue = async () => {
      if (wager && wager.amount > 0) {
        if (wager.token !== 'SHIN') {
          setEscrowError('1v1 Wager Duels currently support $SHIN only.');
          setIsLocking(false);
          return;
        }
        setStatus(`Escrowing ${wager.amount} $SHIN on-chain in shin-arena-28d.testnet...`);
        const escrowId = 'duel_' + Date.now() + '_' + Math.random().toString(36).slice(2, 7);
        const res = await nearArenaEngine.lockDuelShinEscrow(escrowId, wager.amount);
        if (cancelled) return;
        if (!res.ok) {
          setEscrowError(res.error || 'Failed to lock $SHIN escrow.');
          setIsLocking(false);
          return;
        }
        escrowRef.current = { escrowId: res.escrowId, accountId: res.accountId };
        setIsLocking(false);
        setIsSearching(true);
        startMatchmaking(roomCode);
      } else {
        startMatchmaking(roomCode);
      }
    };

    void initQueue();

    return () => {
      cancelled = true;
      if (socketRef.current) {
        socketRef.current.emit('cancel_matchmaking');
        socketRef.current.disconnect();
      }
      bcRef.current?.close();
    };
  }, []);

  const handleGenerateRoomCode = () => {
    const generated = 'SHIN-' + Math.floor(1000 + Math.random() * 9000);
    setRoomCodeInput(generated);
    setRoomCode(generated);
    setSearchTime(0);
    startMatchmaking(generated);
  };

  const handleApplyRoomCode = () => {
    const cleaned = roomCodeInput.trim().toUpperCase();
    setRoomCode(cleaned);
    setSearchTime(0);
    startMatchmaking(cleaned);
  };

  const handleCopyRoomCode = () => {
    if (!roomCode) return;
    navigator.clipboard?.writeText(roomCode).catch(() => {});
    setCopiedCode(true);
    setTimeout(() => setCopiedCode(false), 1800);
  };

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  return (
    <div className="fixed inset-0 z-50 flex flex-col items-center justify-center bg-black/95 text-white backdrop-blur-md overflow-y-auto p-4">
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[500px] h-[500px] bg-shin-red/5 rounded-full blur-[120px] pointer-events-none" />

      <div className="relative flex flex-col items-center max-w-xl w-full bg-gray-950/90 border border-white/15 rounded-2xl p-5 sm:p-8 text-center shadow-2xl">
        <div className="flex items-center gap-2 px-3.5 py-1 bg-white/5 border border-white/10 rounded-full mb-2">
          <Users size={13} className="text-shin-gold" />
          <span className="text-[10px] font-cinzel font-bold tracking-[0.2em] uppercase text-gray-300">
            NEAR Wager &amp; PvP Matchmaking
          </span>
        </div>

        <h1 className="text-2xl sm:text-4xl font-cinzel font-black tracking-[0.2em] uppercase text-white mb-5">
          {roomCode ? `Private Room: ${roomCode}` : 'Online Duel Queue'}
        </h1>

        <div className="relative w-32 h-32 sm:w-36 sm:h-36 mb-6">
          <div className="absolute inset-0 border border-white/10 rounded-full animate-ping opacity-20" />
          <div className="absolute inset-0 flex items-center justify-center">
            <div className="w-28 h-28 sm:w-32 sm:h-32 border-b-2 border-r-2 border-shin-red/50 rounded-full animate-spin" />
          </div>
          <div className="absolute inset-0 flex flex-col items-center justify-center">
            {isLocking ? (
              <ShieldCheck className="text-shin-gold animate-pulse" size={38} />
            ) : (
              <Sword size={32} className="text-shin-red animate-pulse" />
            )}
          </div>
        </div>

        <div className="space-y-3 mb-6 w-full">
          <div className="flex flex-col items-center gap-1.5">
            <span className="text-[10px] text-shin-gold font-cinzel tracking-widest uppercase animate-pulse">
              {isLocking
                ? 'Invisible NEAR Escrow Lock'
                : roomCode
                ? 'Share Code With Friend (Works Across Tabs & Devices)'
                : `Human Queue Window (${Math.max(0, HUMAN_QUEUE_TIMEOUT_SECS - searchTime)}s before Agent Fallback)`}
            </span>
            <h3 className="text-sm sm:text-base font-cinzel text-white uppercase tracking-wider">
              {escrowError ? 'Escrow Failed' : status}
            </h3>
            {escrowError && (
              <p className="text-xs font-mono text-red-400 bg-red-950/50 border border-red-500/40 rounded-lg px-3 py-2 max-w-md">
                {escrowError}
              </p>
            )}
          </div>

          <div className="grid grid-cols-2 gap-4 pt-2 max-w-xs mx-auto">
            <div className="bg-black/60 border border-white/10 rounded-xl p-2.5 flex flex-col items-center">
              <span className="text-[9px] text-gray-400 uppercase tracking-widest">Match Pool</span>
              <span className="text-xs font-cinzel text-shin-gold font-bold">
                {wager ? `${wager.amount * 2} ${wager.token} POT` : 'FREE FIGHT'}
              </span>
            </div>
            <div className="bg-black/60 border border-white/10 rounded-xl p-2.5 flex flex-col items-center">
              <span className="text-[9px] text-gray-400 uppercase tracking-widest">Queue Time</span>
              <span className="text-xs font-mono text-white">{formatTime(searchTime)}</span>
            </div>
          </div>
        </div>

        {/* Private 4-Digit Room Code Box (for Friends / 2-Tab Testing) */}
        <div className="w-full bg-black/70 border border-shin-gold/30 rounded-xl p-3.5 mb-6 text-left">
          <div className="flex items-center justify-between mb-2">
            <span className="text-[10px] font-cinzel font-bold text-shin-gold uppercase tracking-wider flex items-center gap-1.5">
              <KeyRound size={12} /> Duel a Friend via Private Room Code
            </span>
            <button
              onClick={handleGenerateRoomCode}
              className="text-[10px] font-mono text-emerald-400 hover:underline cursor-pointer"
            >
              + Generate Code
            </button>
          </div>
          <div className="flex gap-2">
            <input
              type="text"
              value={roomCodeInput}
              onChange={(e) => setRoomCodeInput(e.target.value.toUpperCase())}
              placeholder="e.g. SHIN-4829"
              className="flex-1 bg-gray-950 border border-white/15 rounded-lg px-3 py-2 text-xs font-mono text-white uppercase tracking-widest"
            />
            <button
              onClick={handleApplyRoomCode}
              className="px-3.5 py-2 bg-shin-gold/20 hover:bg-shin-gold hover:text-black border border-shin-gold/50 text-shin-gold font-cinzel font-bold text-[10px] uppercase tracking-wider rounded-lg transition-all cursor-pointer"
            >
              Join Room
            </button>
            {roomCode && (
              <button
                onClick={handleCopyRoomCode}
                className="px-2.5 py-2 bg-white/10 hover:bg-white/20 border border-white/15 text-white rounded-lg flex items-center gap-1 text-[10px] font-mono cursor-pointer"
                title="Copy Room Code"
              >
                {copiedCode ? <Check size={13} className="text-emerald-400" /> : <Copy size={13} />}
              </button>
            )}
          </div>
        </div>

        <div className="flex flex-wrap justify-center gap-3 w-full">
          <button
            onClick={matchWithFundedArenaAgent}
            className="flex-1 min-w-[200px] px-5 py-3 bg-shin-gold text-black font-cinzel font-black text-xs tracking-widest uppercase rounded-xl hover:bg-yellow-400 transition-all flex items-center justify-center gap-2 cursor-pointer"
          >
            <Bot size={15} /> Fight Funded NEAR Agent Now
          </button>
          <button
            onClick={() => {
              if (socketRef.current) {
                socketRef.current.emit('cancel_matchmaking');
                socketRef.current.disconnect();
              }
              onCancel();
            }}
            className="px-5 py-3 bg-white/5 border border-white/10 hover:border-shin-red text-gray-300 hover:text-white font-cinzel font-bold text-xs tracking-widest uppercase rounded-xl flex items-center justify-center gap-2 cursor-pointer"
          >
            <X size={15} /> {escrowError ? 'Back' : 'Cancel & Refund'}
          </button>
        </div>
      </div>
    </div>
  );
};

export default MatchmakingScreen;
