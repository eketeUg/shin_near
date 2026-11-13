'use client';

import React, { useEffect, useState, useRef } from 'react';
import {
  nearArenaEngine,
  ActiveArenaMatch,
  FighterNftAsset,
  AGENT_PERSONALITY_ARCHETYPES,
} from '../services/nearArenaEngine';
import { Roster } from './PreGameFlow';
import {
  Play,
  Users,
  Bot,
  MessageSquare,
  Swords,
  Trophy,
  Send,
  Timer,
  Flame,
  KeyRound,
  CheckCircle2,
  FastForward,
} from 'lucide-react';

interface LiveFightsFlowProps {
  onWatchMatch: (match: any) => void;
  onStartDirectDuel?: (duelConfig: {
    p1Char: string;
    p2Char: string;
    p2Name: string;
    wagerNear: number;
    isTournamentBout?: boolean;
  }) => void;
  onJoinRoomCode?: (roomCode: string, wagerNear: number) => void;
  onBack: () => void;
  onHome: () => void;
}

interface OnlineHumanWarrior {
  id: string;
  username: string;
  accountId: string;
  charId: string;
  elo: number;
  wins: number;
  losses: number;
  preferredWagerNear: number;
  statusText: string;
  isCrossTabPeer?: boolean;
}

const SIMULATED_ONLINE_HUMANS: OnlineHumanWarrior[] = [
  {
    id: 'human-1',
    username: 'Hanzo_Slayer',
    accountId: 'hanzoslayer.shin-arena.testnet',
    charId: 'shinobi',
    elo: 1260,
    wins: 19,
    losses: 7,
    preferredWagerNear: 1.0,
    statusText: 'Looking for 1 NEAR Shinobi mirror match!',
  },
  {
    id: 'human-2',
    username: 'Kaede_Blade',
    accountId: 'kaede.shin-arena.testnet',
    charId: 'kunoichi',
    elo: 1315,
    wins: 24,
    losses: 9,
    preferredWagerNear: 2.0,
    statusText: 'Practicing for the Daily Blood-Moon Tournament',
  },
  {
    id: 'human-3',
    username: 'Ryu_Ronin',
    accountId: 'ryuronin.shin-arena.testnet',
    charId: 'samurai',
    elo: 1190,
    wins: 11,
    losses: 6,
    preferredWagerNear: 0.5,
    statusText: 'Ready for quick PvP or Room Code duels',
  },
];

const LiveFightsFlow: React.FC<LiveFightsFlowProps> = ({
  onWatchMatch,
  onStartDirectDuel,
  onJoinRoomCode,
  onBack,
  onHome,
}) => {
  const [arenaState, setArenaState] = useState(() => nearArenaEngine.getState());
  const [activeSubTab, setActiveSubTab] = useState<
    'DOJO_LOBBY' | 'TOURNAMENTS' | 'LIVE_BROADCASTS'
  >('DOJO_LOBBY');
  const [rosterFilter, setRosterFilter] = useState<'ALL' | 'HUMAN' | 'AGENT'>('ALL');
  const [selectedTalkTargetId, setSelectedTalkTargetId] = useState<string>('');
  const [chatInput, setChatInput] = useState<string>('');
  const [challengeStakeNear, setChallengeStakeNear] = useState<number>(1.0);
  const [roomCodeInput, setRoomCodeInput] = useState<string>('');
  const [peerHumans, setPeerHumans] = useState<OnlineHumanWarrior[]>([]);
  const [toast, setToast] = useState<string | null>(null);
  const chatBottomRef = useRef<HTMLDivElement>(null);
  const lobbyBcRef = useRef<BroadcastChannel | null>(null);

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

    // Periodic autonomous Agent-to-Agent lobby banter every 18s
    const banterTimer = setInterval(() => {
      nearArenaEngine.triggerAgentToAgentBanter();
      setArenaState({ ...nearArenaEngine.getState() });
    }, 18000);

    // Cross-Tab Lobby Presence & Live Chat via BroadcastChannel
    try {
      if (typeof window !== 'undefined' && 'BroadcastChannel' in window) {
        const bc = new BroadcastChannel('shin_near_dojo_lobby_v1');
        lobbyBcRef.current = bc;
        const myWallet = nearArenaEngine.getState().playerWallet;

        bc.onmessage = (ev) => {
          const data = ev.data;
          if (!data) return;
          if (data.type === 'LOBBY_PRESENCE' && data.accountId !== myWallet.accountId) {
            setPeerHumans((prev) => {
              const filtered = prev.filter((p) => p.accountId !== data.accountId);
              return [
                {
                  id: 'peer-' + data.accountId,
                  username: data.username,
                  accountId: data.accountId,
                  charId: data.charId || 'fighter',
                  elo: 1220,
                  wins: 5,
                  losses: 2,
                  preferredWagerNear: 1.0,
                  statusText: 'Online in another browser tab/window!',
                  isCrossTabPeer: true,
                },
                ...filtered,
              ];
            });
          } else if (data.type === 'LOBBY_CHAT_SYNC') {
            setArenaState({ ...nearArenaEngine.getState() });
          }
        };

        bc.postMessage({
          type: 'LOBBY_PRESENCE',
          username: myWallet.username,
          accountId: myWallet.accountId,
          charId: 'fighter',
        });
      }
    } catch {}

    return () => {
      window.removeEventListener('nearArenaStateUpdated', sync);
      clearInterval(tourneyTimer);
      clearInterval(banterTimer);
      lobbyBcRef.current?.close();
    };
  }, []);

  const getCharGif = (charId: string) => {
    const found = Roster.find((r) => r.id === charId);
    return found ? `/assets/Shin_gifs/${found.gif}` : '/assets/Shin_gifs/Fighter_AllActions.gif';
  };

  const handleSendChat = (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!chatInput.trim()) return;
    nearArenaEngine.postLobbyChatMessage({
      text: chatInput,
      targetAgentTokenId: selectedTalkTargetId || undefined,
    });
    setChatInput('');
    setArenaState({ ...nearArenaEngine.getState() });
    lobbyBcRef.current?.postMessage({ type: 'LOBBY_CHAT_SYNC' });
    setTimeout(() => {
      chatBottomRef.current?.scrollIntoView({ behavior: 'smooth' });
    }, 100);
  };

  const handleChallengeAgent = (agent: FighterNftAsset) => {
    const minWager = agent.personality?.minWagerNear ?? 0.5;
    if (challengeStakeNear < minWager) {
      nearArenaEngine.postLobbyChatMessage({
        text: `I challenge you to a ${challengeStakeNear} NEAR duel, ${agent.title}!`,
        targetAgentTokenId: agent.tokenId,
        challengeWagerNear: challengeStakeNear,
      });
      setArenaState({ ...nearArenaEngine.getState() });
      showToast(
        `${agent.title} declined in chat: minimum wager is ${minWager} NEAR! Raise your stake.`,
      );
      return;
    }

    nearArenaEngine.postLobbyChatMessage({
      text: `⚔️ Challenging ${agent.title} for ${challengeStakeNear} NEAR!`,
      targetAgentTokenId: agent.tokenId,
      challengeWagerNear: challengeStakeNear,
    });
    setArenaState({ ...nearArenaEngine.getState() });

    if (onStartDirectDuel) {
      onStartDirectDuel({
        p1Char: arenaState.fighters.find((f) => !f.isNpc)?.charId || 'fighter',
        p2Char: agent.charId,
        p2Name: agent.title,
        wagerNear: challengeStakeNear,
      });
    } else {
      const m = nearArenaEngine.createImmediateAgentMatch(agent.tokenId);
      onWatchMatch(m);
    }
  };

  const handleChallengeHuman = (human: OnlineHumanWarrior) => {
    if (onStartDirectDuel) {
      onStartDirectDuel({
        p1Char: arenaState.fighters.find((f) => !f.isNpc)?.charId || 'fighter',
        p2Char: human.charId,
        p2Name: human.username,
        wagerNear: challengeStakeNear,
      });
    }
  };

  const allHumans = [...peerHumans, ...SIMULATED_ONLINE_HUMANS];
  const allAgents = arenaState.fighters;
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
      <div className="sticky top-0 z-50 bg-black/90 border-b border-white/10 px-4 md:px-8 py-3 flex flex-wrap items-center justify-between gap-3 backdrop-blur-md">
        <div className="flex items-center gap-3">
          <button
            onClick={onBack}
            className="text-gray-400 hover:text-white uppercase tracking-widest text-xs font-cinzel font-bold cursor-pointer"
          >
            ← Back
          </button>
          <div className="h-4 w-px bg-white/15" />
          <h2 className="text-base sm:text-xl md:text-2xl font-cinzel font-black text-shin-gold uppercase tracking-wider">
            SHINOBI DOJO LOBBY &amp; TOURNAMENTS
          </h2>
        </div>

        {/* Navigation Tabs */}
        <div className="flex items-center gap-1.5 overflow-x-auto">
          {[
            {
              id: 'DOJO_LOBBY',
              label: `🏮 Online Lobby (${allHumans.length}👤 + ${allAgents.length}🤖)`,
            },
            { id: 'TOURNAMENTS', label: '🏆 Daily & Agent Tournaments' },
            {
              id: 'LIVE_BROADCASTS',
              label: `📺 Live Fights (${arenaState.activeMatches.length})`,
            },
          ].map((t) => (
            <button
              key={t.id}
              onClick={() => setActiveSubTab(t.id as any)}
              className={`px-3 py-1.5 rounded-lg font-cinzel font-bold text-[10px] sm:text-xs uppercase tracking-wider border transition-all cursor-pointer whitespace-nowrap ${
                activeSubTab === t.id
                  ? 'bg-shin-red text-white border-white shadow-[0_0_15px_rgba(255,42,42,0.4)]'
                  : 'bg-white/5 text-gray-300 border-white/15 hover:border-shin-gold/50'
              }`}
            >
              {t.label}
            </button>
          ))}

          <button
            onClick={onHome}
            className="ml-2 text-gray-400 hover:text-shin-red uppercase tracking-widest text-xs font-cinzel font-bold px-2.5 py-1.5 border border-white/10 rounded-lg cursor-pointer"
          >
            ✕
          </button>
        </div>
      </div>

      {/* Main Content */}
      <div className="flex-1 max-w-7xl mx-auto w-full p-4 md:p-6">
        {/* =====================================================================
            TAB 1: LIVING DOJO LOBBY (HUMANS 👤 + AGENTS 🤖 + CHAT & CHALLENGE)
           ===================================================================== */}
        {activeSubTab === 'DOJO_LOBBY' && (
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
            {/* Left 7 Columns: Online Humans & Autonomous Agents Roster */}
            <div className="lg:col-span-7 space-y-4">
              {/* Filter Bar + Stake Selector + Room Code Bar */}
              <div className="bg-gray-950 border border-white/15 rounded-2xl p-4 space-y-3">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="flex items-center gap-1.5">
                    {[
                      { id: 'ALL', label: `All Online (${allHumans.length + allAgents.length})` },
                      { id: 'HUMAN', label: `👤 Humans (${allHumans.length})` },
                      { id: 'AGENT', label: `🤖 Agents (${allAgents.length})` },
                    ].map((f) => (
                      <button
                        key={f.id}
                        onClick={() => setRosterFilter(f.id as any)}
                        className={`px-3 py-1 rounded-lg font-cinzel font-bold text-[10px] uppercase tracking-wider border cursor-pointer ${
                          rosterFilter === f.id
                            ? 'bg-shin-gold text-black border-shin-gold'
                            : 'bg-black/60 text-gray-400 border-white/10'
                        }`}
                      >
                        {f.label}
                      </button>
                    ))}
                  </div>

                  {/* Challenge Stake Picker */}
                  <div className="flex items-center gap-1.5">
                    <span className="text-[10px] font-mono text-gray-400 uppercase">
                      Challenge Stake:
                    </span>
                    {[0.5, 1.0, 2.0, 5.0].map((amt) => (
                      <button
                        key={amt}
                        onClick={() => setChallengeStakeNear(amt)}
                        className={`px-2 py-0.5 rounded font-mono text-[10px] border cursor-pointer ${
                          challengeStakeNear === amt
                            ? 'bg-shin-gold text-black border-shin-gold font-bold'
                            : 'bg-black text-gray-400 border-white/15'
                        }`}
                      >
                        {amt}N
                      </button>
                    ))}
                  </div>
                </div>

                {/* Private 4-Digit Friend Room Code Bar */}
                <div className="flex flex-wrap items-center gap-2 pt-2 border-t border-white/10">
                  <span className="text-[10px] font-cinzel font-bold text-shin-gold uppercase flex items-center gap-1">
                    <KeyRound size={12} /> Friend Room Code:
                  </span>
                  <input
                    type="text"
                    value={roomCodeInput}
                    onChange={(e) => setRoomCodeInput(e.target.value.toUpperCase())}
                    placeholder="SHIN-4829"
                    className="bg-black border border-white/20 rounded-lg px-2.5 py-1 text-xs font-mono text-white uppercase w-32"
                  />
                  <button
                    onClick={() => {
                      const code =
                        roomCodeInput.trim() ||
                        'SHIN-' + Math.floor(1000 + Math.random() * 9000);
                      setRoomCodeInput(code);
                      if (onJoinRoomCode) {
                        onJoinRoomCode(code, challengeStakeNear);
                      }
                    }}
                    className="px-3 py-1 bg-shin-gold/20 hover:bg-shin-gold hover:text-black border border-shin-gold/50 text-shin-gold rounded-lg font-cinzel font-bold text-[10px] uppercase tracking-wider cursor-pointer"
                  >
                    Create / Join Room Duel
                  </button>
                </div>
              </div>

              {/* Roster Cards */}
              <div className="space-y-2.5 max-h-[540px] overflow-y-auto pr-1">
                {/* HUMAN WARRIORS */}
                {(rosterFilter === 'ALL' || rosterFilter === 'HUMAN') &&
                  allHumans.map((h) => (
                    <div
                      key={h.id}
                      className="bg-gray-950/90 border border-emerald-500/30 hover:border-emerald-400 rounded-xl p-3.5 flex flex-col sm:flex-row sm:items-center justify-between gap-3 transition-all"
                    >
                      <div className="flex items-center gap-3">
                        <div className="relative">
                          <img
                            src={getCharGif(h.charId)}
                            alt={h.username}
                            className="w-12 h-12 object-contain bg-black rounded-lg p-1 border border-emerald-500/40"
                            style={{ imageRendering: 'pixelated' }}
                          />
                          <span className="absolute -bottom-1 -right-1 w-3 h-3 rounded-full bg-emerald-400 border-2 border-black" />
                        </div>
                        <div>
                          <div className="flex flex-wrap items-center gap-1.5">
                            <span className="font-cinzel font-black text-sm text-white">
                              {h.username}
                            </span>
                            <span className="px-2 py-0.5 rounded bg-emerald-500/20 border border-emerald-400/50 text-emerald-300 font-mono text-[9px] font-bold uppercase flex items-center gap-1">
                              <Users size={10} /> 👤 HUMAN WARRIOR
                            </span>
                            <span className="text-[10px] font-mono text-gray-400">
                              {h.elo} ELO ({h.wins}W-{h.losses}L)
                            </span>
                          </div>
                          <p className="text-[11px] text-gray-300 mt-0.5">{h.statusText}</p>
                          <div className="text-[9px] font-mono text-gray-500">{h.accountId}</div>
                        </div>
                      </div>

                      <div className="flex items-center gap-2 shrink-0">
                        <button
                          onClick={() => {
                            setChatInput(`@${h.username} Ready for a ${challengeStakeNear} NEAR duel? `);
                          }}
                          className="px-2.5 py-1.5 bg-white/5 hover:bg-white/15 border border-white/15 rounded-lg text-[10px] font-cinzel font-bold text-gray-200 flex items-center gap-1 cursor-pointer"
                        >
                          <MessageSquare size={12} /> Chat
                        </button>
                        <button
                          onClick={() => handleChallengeHuman(h)}
                          className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg text-[10px] font-cinzel font-black uppercase tracking-wider flex items-center gap-1 cursor-pointer"
                        >
                          <Swords size={12} /> Challenge ({challengeStakeNear}N)
                        </button>
                      </div>
                    </div>
                  ))}

                {/* AUTONOMOUS NEAR AGENTS */}
                {(rosterFilter === 'ALL' || rosterFilter === 'AGENT') &&
                  allAgents.map((ag) => {
                    const archMeta = AGENT_PERSONALITY_ARCHETYPES.find(
                      (a) => a.id === ag.personality?.archetype,
                    );
                    const minW = ag.personality?.minWagerNear ?? 0.5;
                    return (
                      <div
                        key={ag.tokenId}
                        className="bg-gray-950/90 border border-shin-gold/30 hover:border-shin-gold rounded-xl p-3.5 flex flex-col sm:flex-row sm:items-center justify-between gap-3 transition-all"
                      >
                        <div className="flex items-center gap-3">
                          <div className="relative">
                            <img
                              src={getCharGif(ag.charId)}
                              alt={ag.title}
                              className="w-12 h-12 object-contain bg-black rounded-lg p-1 border border-shin-gold/40"
                              style={{ imageRendering: 'pixelated' }}
                            />
                            <span className="absolute -top-1 -left-1 px-1 rounded bg-shin-gold text-black font-mono font-black text-[8px]">
                              LV.{ag.powerLevel}
                            </span>
                          </div>
                          <div>
                            <div className="flex flex-wrap items-center gap-1.5">
                              <span className="font-cinzel font-black text-sm text-white">
                                {ag.title}
                              </span>
                              <span className="px-2 py-0.5 rounded bg-purple-500/20 border border-purple-400/50 text-purple-300 font-mono text-[9px] font-bold uppercase flex items-center gap-1">
                                <Bot size={10} /> 🤖 NEAR AGENT
                              </span>
                              <span className="px-1.5 py-0.5 rounded bg-shin-gold/15 text-shin-gold font-mono text-[9px]">
                                {archMeta?.badge || '⛩️ BUSHIDO'}
                              </span>
                            </div>
                            <p className="text-[11px] text-gray-300 italic mt-0.5 line-clamp-1">
                              &ldquo;{ag.personality?.greetingLine || 'My katana is ready in the colosseum.'}&rdquo;
                            </p>
                            <div className="flex flex-wrap items-center gap-3 text-[9px] font-mono text-gray-400 mt-0.5">
                              <span className="text-emerald-400">{ag.agentWalletId}</span>
                              <span>Vault: {ag.vaultBalanceNear.toFixed(1)} NEAR</span>
                              <span>Min Stake: {minW} NEAR</span>
                              <span>Owner: {ag.ownerName}</span>
                            </div>
                          </div>
                        </div>

                        <div className="flex items-center gap-2 shrink-0">
                          <button
                            onClick={() => {
                              setSelectedTalkTargetId(ag.tokenId);
                              setChatInput(`@${ag.title} `);
                            }}
                            className="px-2.5 py-1.5 bg-purple-500/15 hover:bg-purple-500/30 border border-purple-400/40 rounded-lg text-[10px] font-cinzel font-bold text-purple-200 flex items-center gap-1 cursor-pointer"
                          >
                            <MessageSquare size={12} /> Talk to Agent
                          </button>
                          <button
                            onClick={() => handleChallengeAgent(ag)}
                            className="px-3 py-1.5 bg-shin-red hover:bg-red-600 text-white rounded-lg text-[10px] font-cinzel font-black uppercase tracking-wider flex items-center gap-1 cursor-pointer"
                          >
                            <Swords size={12} /> Duel ({challengeStakeNear}N)
                          </button>
                        </div>
                      </div>
                    );
                  })}
              </div>
            </div>

            {/* Right 5 Columns: Live Dojo Lobby Chat (Humans + Programmable Agents) */}
            <div className="lg:col-span-5 bg-gray-950 border border-white/15 rounded-2xl p-4 flex flex-col h-[620px]">
              <div className="flex items-center justify-between border-b border-white/10 pb-3 mb-3">
                <div>
                  <h3 className="text-sm font-cinzel font-black text-shin-gold uppercase tracking-wider flex items-center gap-2">
                    <MessageSquare size={15} /> Live Dojo Comms (Humans &amp; Agents)
                  </h3>
                  <p className="text-[10px] text-gray-400">
                    Chat with online players or talk &amp; negotiate stakes directly with autonomous
                    NEAR Fighter Agents!
                  </p>
                </div>
              </div>

              {/* Target Agent Selector Pill */}
              <div className="flex items-center gap-1.5 overflow-x-auto pb-2 mb-2 border-b border-white/10">
                <span className="text-[9px] font-mono text-gray-400 uppercase shrink-0">
                  Direct To:
                </span>
                <button
                  onClick={() => setSelectedTalkTargetId('')}
                  className={`px-2 py-0.5 rounded text-[9px] font-mono border cursor-pointer shrink-0 ${
                    !selectedTalkTargetId
                      ? 'bg-shin-gold text-black border-shin-gold font-bold'
                      : 'bg-black text-gray-400 border-white/15'
                  }`}
                >
                  Everyone
                </button>
                {allAgents.slice(0, 5).map((ag) => (
                  <button
                    key={ag.tokenId}
                    onClick={() => setSelectedTalkTargetId(ag.tokenId)}
                    className={`px-2 py-0.5 rounded text-[9px] font-mono border cursor-pointer shrink-0 ${
                      selectedTalkTargetId === ag.tokenId
                        ? 'bg-purple-500 text-white border-purple-300 font-bold'
                        : 'bg-black text-gray-400 border-white/15'
                    }`}
                  >
                    🤖 {ag.title}
                  </button>
                ))}
              </div>

              {/* Messages Feed */}
              <div className="flex-1 overflow-y-auto space-y-2.5 pr-1">
                {(arenaState.lobbyChat || []).map((msg) => {
                  const isAgent = msg.senderType === 'AGENT';
                  return (
                    <div
                      key={msg.id}
                      className={`p-3 rounded-xl border text-xs ${
                        isAgent
                          ? 'bg-purple-950/25 border-purple-500/30'
                          : 'bg-emerald-950/20 border-emerald-500/30'
                      }`}
                    >
                      <div className="flex flex-wrap items-center justify-between gap-1 mb-1">
                        <div className="flex items-center gap-1.5">
                          <span className="font-cinzel font-black text-white text-xs">
                            {msg.senderName}
                          </span>
                          <span
                            className={`px-1.5 py-0.5 rounded font-mono text-[8px] font-bold uppercase ${
                              isAgent
                                ? 'bg-purple-500/20 text-purple-300 border border-purple-400/40'
                                : 'bg-emerald-500/20 text-emerald-300 border border-emerald-400/40'
                            }`}
                          >
                            {isAgent ? `🤖 AGENT ${msg.archetypeBadge || ''}` : '👤 HUMAN'}
                          </span>
                        </div>
                        <span className="text-[9px] font-mono text-gray-500">
                          {msg.senderAccountId}
                        </span>
                      </div>
                      <p className="text-gray-200 font-sans leading-relaxed">{msg.text}</p>
                    </div>
                  );
                })}
                <div ref={chatBottomRef} />
              </div>

              {/* Quick Dialogue Prompts + Chat Input */}
              <div className="pt-3 border-t border-white/10 mt-2 space-y-2">
                <div className="flex gap-1.5 overflow-x-auto pb-1">
                  {[
                    'Who wants a 2 NEAR duel?',
                    'Are you ready for the tournament?',
                    'Your stance is weak, challenge me!',
                  ].map((quick) => (
                    <button
                      key={quick}
                      type="button"
                      onClick={() => {
                        nearArenaEngine.postLobbyChatMessage({
                          text: quick,
                          targetAgentTokenId: selectedTalkTargetId || undefined,
                        });
                        setArenaState({ ...nearArenaEngine.getState() });
                      }}
                      className="px-2 py-1 rounded bg-white/5 hover:bg-white/10 border border-white/10 text-[9px] font-mono text-gray-300 whitespace-nowrap cursor-pointer"
                    >
                      &ldquo;{quick}&rdquo;
                    </button>
                  ))}
                </div>

                <form onSubmit={handleSendChat} className="flex gap-2">
                  <input
                    type="text"
                    value={chatInput}
                    onChange={(e) => setChatInput(e.target.value)}
                    placeholder={
                      selectedTalkTargetId
                        ? 'Talk or propose a wager to this Agent...'
                        : 'Message the Dojo Lobby (Agents reply in-character)...'
                    }
                    className="flex-1 bg-black border border-white/20 rounded-xl px-3 py-2 text-xs text-white"
                  />
                  <button
                    type="submit"
                    className="px-4 py-2 bg-shin-gold text-black font-cinzel font-black text-xs uppercase rounded-xl flex items-center gap-1 hover:bg-yellow-400 cursor-pointer"
                  >
                    <Send size={13} /> Send
                  </button>
                </form>
              </div>
            </div>
          </div>
        )}

        {/* =====================================================================
            TAB 2: DAILY HUMAN TOURNAMENT WINDOWS & CONTINUOUS AGENT TOURNAMENTS
           ===================================================================== */}
        {activeSubTab === 'TOURNAMENTS' && (
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
                        if (onStartDirectDuel) {
                          onStartDirectDuel({
                            p1Char: humanTourney.playerCharId || 'fighter',
                            p2Char: currentBout.p2CharId || 'kunoichi',
                            p2Name: currentBout.p2Name,
                            wagerNear: humanTourney.entryFeeNear,
                            isTournamentBout: true,
                          });
                        }
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
                      Last Champion: <strong className="text-shin-gold">{agentTourney.lastChampionTitle}</strong> (+
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
        )}

        {/* =====================================================================
            TAB 3: LIVE ARENA BROADCASTS (SPECTATE & PARI-MUTUEL BETTING)
           ===================================================================== */}
        {activeSubTab === 'LIVE_BROADCASTS' && (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {arenaState.activeMatches.map((m) => (
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
                    <span className="text-[9px] text-gray-400 font-mono truncate w-full">
                      {m.p1.agentWalletId}
                    </span>
                  </div>
                  <div className="text-xl font-black text-shin-gold/80 w-2/12 text-center font-cinzel">
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
                    <span className="text-[9px] text-gray-400 font-mono truncate w-full">
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
        )}
      </div>
    </div>
  );
};

export default LiveFightsFlow;
