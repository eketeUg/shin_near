'use client';

import React, { useEffect, useState, useRef } from 'react';
import { io, Socket } from 'socket.io-client';
import {
  nearArenaEngine,
  DojoSocialContact,
  LobbyChatMessage,
} from '../services/nearArenaEngine';
import { Roster } from './PreGameFlow';
import {
  Search,
  Users,
  Bot,
  MessageSquare,
  Swords,
  Send,
  KeyRound,
  CheckCircle2,
  Clock,
  CheckCheck,
  Radio,
  Sparkles,
} from 'lucide-react';

interface DojoLobbyFlowProps {
  onStartAgreedDuel: (duelConfig: {
    p1Char: string;
    p2Char: string;
    p2Name: string;
    wagerNear: number;
  }) => void;
  onJoinRoomCode: (roomCode: string, wagerNear: number) => void;
  onBack: () => void;
  onHome: () => void;
}

const DojoLobbyFlow: React.FC<DojoLobbyFlowProps> = ({
  onStartAgreedDuel,
  onJoinRoomCode,
  onBack,
  onHome,
}) => {
  const [arenaState, setArenaState] = useState(() => nearArenaEngine.getState());
  const [directory, setDirectory] = useState<DojoSocialContact[]>(() =>
    nearArenaEngine.getSocialDirectory(),
  );
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [filterTab, setFilterTab] = useState<'ALL' | 'ONLINE' | 'OFFLINE' | 'HUMAN' | 'AGENT'>(
    'ALL',
  );
  // '' = Global Dojo Lounge, otherwise accountId of the selected Human or Agent DM thread
  const [activeThreadAccountId, setActiveThreadAccountId] = useState<string>('');
  const [chatInput, setChatInput] = useState<string>('');
  const [proposedWagerNear, setProposedWagerNear] = useState<number>(1.0); // 0 = Free Match
  const [roomCodeInput, setRoomCodeInput] = useState<string>('');
  const [wsConnected, setWsConnected] = useState<boolean>(false);
  const [toast, setToast] = useState<string | null>(null);
  const chatBottomRef = useRef<HTMLDivElement>(null);
  const bcRef = useRef<BroadcastChannel | null>(null);
  const socketRef = useRef<Socket | null>(null);

  const SERVER_URL = process.env.NEXT_PUBLIC_SERVER_URL || 'http://localhost:3001';

  const showToast = (msg: string) => {
    setToast(msg);
    setTimeout(() => setToast(null), 3200);
  };

  const refreshAll = () => {
    setArenaState({ ...nearArenaEngine.getState() });
    setDirectory([...nearArenaEngine.getSocialDirectory()]);
  };

  useEffect(() => {
    window.addEventListener('nearArenaStateUpdated', refreshAll);

    // Sync real registered players from MongoDB & on-chain Fighter NFTs from NEAR Testnet
    void nearArenaEngine.syncRegisteredUsersFromDb();
    void nearArenaEngine.syncOnChainState(nearArenaEngine.getState().playerWallet.accountId);

    // Cross-Tab DM & Presence Sync
    try {
      if (typeof window !== 'undefined' && 'BroadcastChannel' in window) {
        const bc = new BroadcastChannel('shin_near_social_messenger_v1');
        bcRef.current = bc;
        bc.onmessage = () => {
          refreshAll();
        };
      }
    } catch {}

    // Real-Time Socket.io WebSocket Connection (Presence, DMs, Offline Store-and-Forward & Fight Contracts)
    try {
      const socket = io(SERVER_URL, { timeout: 3000, reconnectionAttempts: 3 });
      socketRef.current = socket;

      socket.on('connect', () => {
        setWsConnected(true);
        const st = nearArenaEngine.getState();
        const myFighter = st.fighters.find((f) => !f.isNpc);
        socket.emit('lobby_register_presence', {
          accountId: st.playerWallet.accountId,
          username: st.playerWallet.username,
          charId: myFighter?.charId || 'fighter',
          elo: myFighter?.elo || 1200,
          wins: myFighter?.wins || 0,
          losses: myFighter?.losses || 0,
        });
      });

      socket.on('disconnect', () => {
        setWsConnected(false);
      });

      socket.on('lobby_presence_updated', (remoteUsers: any[]) => {
        nearArenaEngine.syncRemoteLobbyUsers(remoteUsers);
        refreshAll();
      });

      socket.on('lobby_receive_dm', (msg: LobbyChatMessage) => {
        nearArenaEngine.ingestRemoteLobbyMessage(msg);
        refreshAll();
        if (msg.deliveryStatus === 'READ_ON_WAKE') {
          showToast(`📩 Delivered offline message from @${msg.senderName}!`);
        }
      });

      socket.on('lobby_chat_broadcast', (msg: LobbyChatMessage) => {
        nearArenaEngine.ingestRemoteLobbyMessage(msg);
        refreshAll();
      });

      socket.on(
        'lobby_dm_status_updated',
        (data: { id: string; deliveryStatus: 'DELIVERED_LIVE' | 'QUEUED_OFFLINE' | 'READ_ON_WAKE' }) => {
          nearArenaEngine.updateRemoteDmStatus(data.id, data.deliveryStatus);
          refreshAll();
        },
      );

      socket.on('lobby_fight_matched', (matchPayload: any) => {
        onStartAgreedDuel({
          p1Char: matchPayload.p1Char || 'fighter',
          p2Char: matchPayload.p2Char || 'shinobi',
          p2Name: matchPayload.p2Name || 'Challenger',
          wagerNear: matchPayload.wagerNear || 0,
        });
      });

      socket.on('lobby_fight_proposal_updated', (offer: any) => {
        if (offer?.proposalId && offer?.status) {
          nearArenaEngine.updateChatFightProposal(
            offer.proposalId,
            Number(offer.wagerNear ?? 0),
            offer.status === 'DECLINED' ? 'DECLINED' : 'ACCEPTED',
          );
          refreshAll();
        }
      });
    } catch {}

    return () => {
      window.removeEventListener('nearArenaStateUpdated', refreshAll);
      bcRef.current?.close();
      socketRef.current?.disconnect();
    };
  }, []);

  const getCharGif = (charId: string) => {
    const found = Roster.find((r) => r.id === charId);
    return found ? `/assets/Shin_gifs/${found.gif}` : '/assets/Shin_gifs/Fighter_AllActions.gif';
  };

  const filteredContacts = directory.filter((c) => {
    const q = searchQuery.trim().toLowerCase();
    const matchesSearch =
      !q ||
      c.username.toLowerCase().includes(q) ||
      c.accountId.toLowerCase().includes(q) ||
      c.statusBio.toLowerCase().includes(q);
    if (!matchesSearch) return false;
    if (filterTab === 'ONLINE') return c.isOnline;
    if (filterTab === 'OFFLINE') return !c.isOnline;
    if (filterTab === 'HUMAN') return c.userType === 'HUMAN';
    if (filterTab === 'AGENT') return c.userType === 'AGENT';
    return true;
  });

  const activeContact = activeThreadAccountId
    ? directory.find((c) => c.accountId === activeThreadAccountId)
    : undefined;

  const myAccountId = arenaState.playerWallet.accountId;

  // Filter messages for either the Global Dojo Lounge or the selected 1-on-1 DM conversation
  const threadMessages: LobbyChatMessage[] = (arenaState.lobbyChat || []).filter((m) => {
    if (!activeThreadAccountId) {
      // Global Lounge shows public messages (without a specific recipientAccountId)
      return !m.recipientAccountId;
    }
    return (
      m.recipientAccountId === activeThreadAccountId ||
      (m.senderAccountId === activeThreadAccountId && m.recipientAccountId === myAccountId)
    );
  });

  const handleSendMessage = (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!chatInput.trim()) return;

    const res = nearArenaEngine.sendDirectMessage({
      recipientAccountId: activeThreadAccountId || undefined,
      text: chatInput,
    });
    setChatInput('');
    refreshAll();
    bcRef.current?.postMessage({ type: 'SYNC' });

    if (socketRef.current?.connected) {
      socketRef.current.emit('lobby_send_dm', res.sentMsg);
    }

    if (res.sentMsg.deliveryStatus === 'QUEUED_OFFLINE' && activeContact) {
      showToast(
        `📩 Saved offline message for @${activeContact.username}. They will see it as soon as they come online!`,
      );
    }

    setTimeout(() => {
      chatBottomRef.current?.scrollIntoView({ behavior: 'smooth' });
    }, 80);
  };

  const handleSendFightProposalInChat = () => {
    if (!activeContact) {
      showToast('Select a Human or Agent from the left sidebar to send a 1v1 Fight Request!');
      return;
    }
    try {
      const proposalMsg = nearArenaEngine.sendChatFightProposal({
        targetAccountId: activeContact.accountId,
        wagerNear: proposedWagerNear,
      });
      refreshAll();
      bcRef.current?.postMessage({ type: 'SYNC' });
      if (socketRef.current?.connected) {
        socketRef.current.emit('lobby_send_fight_proposal', proposalMsg);
      }
      setTimeout(() => {
        chatBottomRef.current?.scrollIntoView({ behavior: 'smooth' });
      }, 100);
    } catch (err: any) {
      showToast(err.message);
    }
  };

  const onlineCount = directory.filter((c) => c.isOnline).length;
  const offlineCount = directory.filter((c) => !c.isOnline).length;

  return (
    <div className="fixed inset-0 z-40 bg-gradient-to-b from-gray-950 via-black to-black text-white flex flex-col select-none overflow-hidden">
      {toast && (
        <div className="fixed top-16 left-1/2 -translate-x-1/2 z-[100] bg-shin-gold text-black font-cinzel font-black text-xs px-5 py-2.5 rounded-full shadow-[0_0_25px_rgba(251,191,36,0.9)] flex items-center gap-2">
          <CheckCircle2 size={16} />
          <span>{toast}</span>
        </div>
      )}

      {/* Top Header */}
      <div className="bg-black/95 border-b border-white/10 px-3 sm:px-6 py-2 flex flex-wrap items-center justify-between gap-2 shrink-0">
        <div className="flex items-center gap-3">
          <button
            onClick={onBack}
            className="text-gray-400 hover:text-white uppercase tracking-widest text-xs font-cinzel font-bold cursor-pointer"
          >
            ← Back
          </button>
          <div className="h-4 w-px bg-white/15" />
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-base sm:text-xl font-cinzel font-black text-shin-gold uppercase tracking-wider flex items-center gap-2">
                <MessageSquare size={17} /> DOJO SOCIAL MESSENGER &amp; LOBBY
              </h1>
              <span
                className={`px-2 py-0.5 rounded-full font-mono text-[9px] uppercase border ${
                  wsConnected
                    ? 'bg-emerald-500/15 border-emerald-400/50 text-emerald-300'
                    : 'bg-amber-500/15 border-amber-400/40 text-amber-300'
                }`}
              >
                {wsConnected ? '🟢 WS Live' : '⚡ Local Mesh'}
              </span>
            </div>
            <p className="text-[10px] text-gray-400 hidden sm:block">
              Search warriors by @username, see Online/Offline status, leave offline DMs, or
              negotiate Wager &amp; Free Matches right in chat
            </p>
          </div>
        </div>

        {/* Friend Private Room Code Quick Bar */}
        <div className="flex items-center gap-2">
          <div className="hidden md:flex items-center gap-1.5 bg-white/5 border border-shin-gold/30 rounded-xl px-2.5 py-1">
            <KeyRound size={12} className="text-shin-gold" />
            <input
              type="text"
              value={roomCodeInput}
              onChange={(e) => setRoomCodeInput(e.target.value.toUpperCase())}
              placeholder="Room Code (SHIN-4829)"
              className="bg-transparent text-xs font-mono text-white uppercase w-36 focus:outline-none"
            />
            <button
              onClick={() => {
                const code =
                  roomCodeInput.trim() || 'SHIN-' + Math.floor(1000 + Math.random() * 9000);
                setRoomCodeInput(code);
                onJoinRoomCode(code, proposedWagerNear);
              }}
              className="px-2.5 py-1 bg-shin-gold text-black rounded-lg font-cinzel font-black text-[10px] uppercase cursor-pointer"
            >
              Room Duel
            </button>
          </div>

          <button
            onClick={onHome}
            className="text-gray-400 hover:text-shin-red uppercase tracking-widest text-xs font-cinzel font-bold px-2.5 py-1.5 border border-white/10 rounded-lg cursor-pointer"
          >
            ✕
          </button>
        </div>
      </div>

      {/* Main Split-Pane Social Messenger Layout */}
      <div className="flex-1 grid grid-cols-1 sm:grid-cols-12 min-h-0 overflow-hidden max-w-7xl w-full mx-auto">
        {/* ===================================================================
            LEFT SIDEBAR (5 cols): SEARCHABLE PLAYER & AGENT DIRECTORY
           =================================================================== */}
        <div className="sm:col-span-5 border-b sm:border-b-0 sm:border-r border-white/10 bg-gray-950/90 flex flex-col min-h-0 overflow-hidden">
          {/* Search Input & Filter Pills */}
          <div className="p-2.5 sm:p-3 border-b border-white/10 space-y-2 shrink-0">
            <div className="relative">
              <Search
                size={14}
                className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400"
              />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search @username, agent name, or .testnet wallet..."
                className="w-full bg-black border border-white/15 focus:border-shin-gold rounded-xl pl-9 pr-3 py-2 text-xs text-white focus:outline-none"
              />
            </div>

            <div className="flex items-center gap-1 overflow-x-auto pb-0.5">
              {[
                { id: 'ALL', label: `All (${directory.length})` },
                { id: 'ONLINE', label: `🟢 Online (${onlineCount})` },
                { id: 'OFFLINE', label: `⚫ Offline (${offlineCount})` },
                { id: 'HUMAN', label: '👤 Humans' },
                { id: 'AGENT', label: '🤖 Agents' },
              ].map((tab) => (
                <button
                  key={tab.id}
                  onClick={() => setFilterTab(tab.id as any)}
                  className={`px-2.5 py-1 rounded-lg font-mono text-[10px] border shrink-0 cursor-pointer ${
                    filterTab === tab.id
                      ? 'bg-shin-gold text-black border-shin-gold font-bold'
                      : 'bg-black/60 text-gray-400 border-white/10 hover:text-white'
                  }`}
                >
                  {tab.label}
                </button>
              ))}
            </div>

            {/* Global Dojo Lounge Channel Selector */}
            <button
              onClick={() => setActiveThreadAccountId('')}
              className={`w-full p-2.5 rounded-xl border text-left flex items-center justify-between transition-all cursor-pointer ${
                activeThreadAccountId === ''
                  ? 'bg-shin-red/20 border-shin-red text-white'
                  : 'bg-black/60 border-white/10 text-gray-300 hover:border-white/25'
              }`}
            >
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-lg bg-shin-red/20 border border-shin-red/40 flex items-center justify-center text-shin-red">
                  <Radio size={15} />
                </div>
                <div>
                  <div className="font-cinzel font-black text-xs uppercase">
                    📢 Global Dojo Lounge (Public Feed)
                  </div>
                  <div className="text-[10px] text-gray-400">
                    Open chat with all online Humans &amp; Autonomous Agents
                  </div>
                </div>
              </div>
              <span className="text-[9px] font-mono text-shin-gold uppercase">Public</span>
            </button>
          </div>

          {/* Contacts List */}
          <div className="flex-1 overflow-y-auto divide-y divide-white/5">
            {filteredContacts.map((contact) => {
              const isSelected = activeThreadAccountId === contact.accountId;
              const isAgent = contact.userType === 'AGENT';
              const queuedCount = (arenaState.lobbyChat || []).filter(
                (m) =>
                  m.recipientAccountId === contact.accountId &&
                  m.deliveryStatus === 'QUEUED_OFFLINE',
              ).length;

              return (
                <div
                  key={contact.contactId}
                  onClick={() => setActiveThreadAccountId(contact.accountId)}
                  className={`p-3.5 transition-all cursor-pointer flex items-center justify-between gap-2.5 ${
                    isSelected
                      ? 'bg-shin-gold/15 border-l-4 border-l-shin-gold'
                      : 'hover:bg-white/5'
                  }`}
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <div className="relative shrink-0">
                      <img
                        src={getCharGif(contact.charId)}
                        alt={contact.username}
                        className="w-11 h-11 object-contain bg-black rounded-xl p-1 border border-white/15"
                        style={{ imageRendering: 'pixelated' }}
                      />
                      {/* Online / Offline Status Dot */}
                      <span
                        className={`absolute -bottom-0.5 -right-0.5 w-3.5 h-3.5 rounded-full border-2 border-black ${
                          contact.isOnline ? 'bg-emerald-400' : 'bg-gray-500'
                        }`}
                        title={contact.isOnline ? 'Online Now' : 'Offline'}
                      />
                    </div>

                    <div className="min-w-0">
                      <div className="flex items-center gap-1.5 flex-wrap">
                        <span className="font-cinzel font-black text-xs sm:text-sm text-white truncate">
                          {contact.username}
                        </span>
                        <span
                          className={`px-1.5 py-0.5 rounded font-mono text-[8px] font-bold uppercase ${
                            isAgent
                              ? 'bg-purple-500/20 text-purple-300 border border-purple-400/40'
                              : 'bg-emerald-500/20 text-emerald-300 border border-emerald-400/40'
                          }`}
                        >
                          {isAgent ? '🤖 AGENT' : '👤 HUMAN'}
                        </span>
                      </div>

                      <div className="flex items-center gap-2 text-[10px] font-mono mt-0.5">
                        <span
                          className={
                            contact.isOnline ? 'text-emerald-400 font-semibold' : 'text-gray-500'
                          }
                        >
                          {contact.isOnline ? '🟢 Online' : `⚫ ${contact.lastSeenLabel}`}
                        </span>
                        <span className="text-gray-500">•</span>
                        <span className="text-shin-gold">{contact.elo} ELO</span>
                      </div>

                      <p className="text-[10px] text-gray-400 truncate mt-0.5">
                        {contact.statusBio}
                      </p>
                    </div>
                  </div>

                  {queuedCount > 0 && (
                    <span className="px-2 py-0.5 rounded-full bg-amber-500/20 border border-amber-400 text-amber-300 font-mono text-[9px] shrink-0">
                      {queuedCount} Queued
                    </span>
                  )}
                </div>
              );
            })}
          </div>
        </div>

        {/* ===================================================================
            RIGHT PANEL (7 cols): 1-ON-1 SOCIAL DM THREAD & WAGER NEGOTIATION
           =================================================================== */}
        <div className="sm:col-span-7 flex flex-col bg-black/90 min-h-0 overflow-hidden">
          {/* Active Conversation Header */}
          {activeContact ? (
            <div className="p-2.5 sm:p-3.5 border-b border-white/10 bg-gray-950/90 flex flex-wrap items-center justify-between gap-2 shrink-0">
              <div className="flex items-center gap-3">
                <div className="relative">
                  <img
                    src={getCharGif(activeContact.charId)}
                    alt={activeContact.username}
                    className="w-11 h-11 object-contain bg-black rounded-xl p-1 border border-white/20"
                    style={{ imageRendering: 'pixelated' }}
                  />
                  <span
                    className={`absolute -bottom-0.5 -right-0.5 w-3.5 h-3.5 rounded-full border-2 border-black ${
                      activeContact.isOnline ? 'bg-emerald-400' : 'bg-gray-500'
                    }`}
                  />
                </div>
                <div>
                  <div className="flex items-center gap-2 flex-wrap">
                    <h2 className="font-cinzel font-black text-sm sm:text-base text-white">
                      @{activeContact.username}
                    </h2>
                    <span
                      className={`px-2 py-0.5 rounded font-mono text-[9px] font-bold uppercase ${
                        activeContact.userType === 'AGENT'
                          ? 'bg-purple-500/20 text-purple-300 border border-purple-400/40'
                          : 'bg-emerald-500/20 text-emerald-300 border border-emerald-400/40'
                      }`}
                    >
                      {activeContact.userType === 'AGENT'
                        ? `🤖 AGENT ${activeContact.archetypeBadge || ''}`
                        : '👤 HUMAN WARRIOR'}
                    </span>
                  </div>
                  <div className="flex items-center gap-2 text-[10px] font-mono mt-0.5">
                    <span
                      className={
                        activeContact.isOnline ? 'text-emerald-400' : 'text-amber-300'
                      }
                    >
                      {activeContact.isOnline
                        ? '🟢 Online — Can receive instant DMs & Fight Requests'
                        : '⚫ Offline — Messages will be delivered when they come online'}
                    </span>
                  </div>
                </div>
              </div>

              {/* Demo Helper: Simulate Contact Going Online / Offline to test Offline Message Delivery */}
              <button
                onClick={() => {
                  const updated = nearArenaEngine.toggleContactOnlineStatus(
                    activeContact.accountId,
                  );
                  refreshAll();
                  if (updated?.isOnline) {
                    showToast(
                      `🟢 @${updated.username} is now ONLINE! Any queued offline messages were delivered and read.`,
                    );
                  } else {
                    showToast(
                      `⚫ @${updated?.username} went OFFLINE. Send them a message to test offline delivery!`,
                    );
                  }
                }}
                className="px-2.5 py-1.5 rounded-lg bg-white/5 hover:bg-white/15 border border-white/15 text-[10px] font-mono text-gray-300 cursor-pointer"
                title="Toggle this warrior's Online/Offline state to test offline message queuing"
              >
                {activeContact.isOnline ? 'Set Offline (Test)' : '⚡ Bring Online Now'}
              </button>
            </div>
          ) : (
            <div className="p-2.5 sm:p-3.5 border-b border-white/10 bg-gray-950/90 flex items-center justify-between shrink-0">
              <div>
                <h2 className="font-cinzel font-black text-sm sm:text-base text-shin-gold uppercase">
                  📢 Global Dojo Lounge
                </h2>
                <p className="text-[10px] text-gray-400">
                  Public chat room — click any warrior on the left to open a 1-on-1 DM or send a
                  Fight Request
                </p>
              </div>
            </div>
          )}

          {/* In-Chat Fight Request & Wager / Free Match Proposal Bar (when viewing a 1-on-1 DM) */}
          {activeContact && (
            <div className="px-3 sm:px-4 py-2 bg-gradient-to-r from-red-950/40 via-gray-950 to-amber-950/30 border-b border-shin-gold/30 flex flex-wrap items-center justify-between gap-2 shrink-0">
              <div className="flex items-center gap-1.5 flex-wrap">
                <span className="text-[10px] font-cinzel font-bold text-shin-gold uppercase mr-1">
                  Agree on Match Terms:
                </span>
                {[
                  { label: 'Free Match (0 NEAR)', val: 0 },
                  { label: '0.5 NEAR', val: 0.5 },
                  { label: '1 NEAR', val: 1.0 },
                  { label: '2 NEAR', val: 2.0 },
                  { label: '5 NEAR', val: 5.0 },
                ].map((opt) => (
                  <button
                    key={opt.val}
                    type="button"
                    onClick={() => setProposedWagerNear(opt.val)}
                    className={`px-2 py-1 rounded text-[10px] font-mono border cursor-pointer ${
                      proposedWagerNear === opt.val
                        ? 'bg-shin-gold text-black border-shin-gold font-bold'
                        : 'bg-black/70 text-gray-300 border-white/15 hover:border-white/30'
                    }`}
                  >
                    {opt.label}
                  </button>
                ))}
              </div>

              <button
                type="button"
                onClick={handleSendFightProposalInChat}
                disabled={!activeContact.isOnline}
                className={`px-3.5 py-1.5 rounded-xl font-cinzel font-black text-[10px] uppercase tracking-wider flex items-center gap-1.5 transition-all ${
                  activeContact.isOnline
                    ? 'bg-shin-red hover:bg-red-600 text-white shadow-[0_0_15px_rgba(255,42,42,0.4)] cursor-pointer'
                    : 'bg-gray-800 text-gray-500 border border-white/10 cursor-not-allowed'
                }`}
              >
                <Swords size={13} />
                <span>
                  {activeContact.isOnline
                    ? `Send Fight Request (${proposedWagerNear === 0 ? 'Free' : `${proposedWagerNear} NEAR`})`
                    : 'User Offline (DM Only)'}
                </span>
              </button>
            </div>
          )}

          {/* Chat Messages Stream */}
          <div className="flex-1 overflow-y-auto p-4 space-y-3">
            {threadMessages.length === 0 && activeContact && (
              <div className="text-center py-10 space-y-2">
                <p className="text-xs font-cinzel text-gray-300 uppercase">
                  Start a Direct Conversation with @{activeContact.username}
                </p>
                <p className="text-[11px] text-gray-500 max-w-md mx-auto">
                  {activeContact.isOnline
                    ? `Say hello, negotiate a wager or Free Match, and click "Send Fight Request" above to launch your 1v1 duel!`
                    : `@${activeContact.username} is currently offline (${activeContact.lastSeenLabel}). Any message you send now will be saved and delivered as soon as they come back online!`}
                </p>
              </div>
            )}

            {threadMessages.map((msg) => {
              const isMine = msg.senderAccountId === myAccountId;
              const offer = msg.challengeOffer;

              return (
                <div
                  key={msg.id}
                  className={`flex flex-col ${isMine ? 'items-end' : 'items-start'}`}
                >
                  <div
                    className={`max-w-[85%] rounded-2xl p-3.5 border text-xs ${
                      isMine
                        ? 'bg-shin-gold/15 border-shin-gold/40 text-white'
                        : msg.senderType === 'AGENT'
                        ? 'bg-purple-950/35 border-purple-500/40 text-gray-100'
                        : 'bg-gray-900 border-white/15 text-gray-100'
                    }`}
                  >
                    <div className="flex items-center justify-between gap-3 mb-1">
                      <span className="font-cinzel font-black text-[11px] text-shin-gold">
                        {msg.senderName}
                      </span>
                      <span className="text-[9px] font-mono text-gray-400">
                        {new Date(msg.timestamp).toLocaleTimeString([], {
                          hour: '2-digit',
                          minute: '2-digit',
                        })}
                      </span>
                    </div>

                    <p className="font-sans text-xs leading-relaxed">{msg.text}</p>

                    {/* Interactive In-Chat Fight Proposal Card */}
                    {offer && (
                      <div className="mt-3 bg-black/90 border-2 border-shin-gold rounded-xl p-3.5 space-y-2.5">
                        <div className="flex items-center justify-between">
                          <span className="text-[10px] font-cinzel font-black text-shin-gold uppercase flex items-center gap-1">
                            <Swords size={13} /> Official Dojo Fight Contract
                          </span>
                          <span className="px-2 py-0.5 rounded bg-shin-gold/20 text-shin-gold font-mono text-[10px] font-bold">
                            {offer.wagerNear === 0
                              ? 'FREE MATCH (0 NEAR)'
                              : `${offer.wagerNear} NEAR WAGER`}
                          </span>
                        </div>

                        <div className="text-xs font-cinzel text-white">
                          {offer.challengerName} <span className="text-gray-400">vs</span>{' '}
                          {offer.targetName}
                        </div>

                        {offer.status === 'COUNTERED' && offer.counterWagerNear !== undefined && (
                          <div className="p-2 rounded bg-amber-500/15 border border-amber-400/40 text-[11px] text-amber-200 flex items-center justify-between gap-2">
                            <span>
                              Opponent counter-proposed{' '}
                              <strong>{offer.counterWagerNear} NEAR</strong>!
                            </span>
                            <button
                              onClick={() => {
                                nearArenaEngine.updateChatFightProposal(
                                  offer.proposalId,
                                  offer.counterWagerNear!,
                                  'ACCEPTED',
                                );
                                refreshAll();
                              }}
                              className="px-2.5 py-1 bg-amber-400 text-black font-cinzel font-black text-[10px] uppercase rounded cursor-pointer"
                            >
                              Agree to {offer.counterWagerNear} NEAR
                            </button>
                          </div>
                        )}

                        {offer.status === 'ACCEPTED' && (
                          <div className="flex flex-wrap gap-2 pt-1">
                            <button
                              onClick={() => {
                                onStartAgreedDuel({
                                  p1Char: offer.challengerCharId || 'fighter',
                                  p2Char: offer.targetCharId || 'shinobi',
                                  p2Name: offer.targetName,
                                  wagerNear: offer.wagerNear,
                                });
                              }}
                              className="w-full py-2.5 bg-gradient-to-r from-shin-red to-red-700 hover:from-red-500 hover:to-red-600 text-white font-cinzel font-black text-xs uppercase tracking-widest rounded-lg shadow-[0_0_15px_rgba(255,42,42,0.5)] flex items-center justify-center gap-2 cursor-pointer"
                            >
                              <Swords size={14} /> Both Agreed! Enter Arena &amp; Fight Now
                            </button>
                          </div>
                        )}
                      </div>
                    )}

                    {/* Delivery Status Footer (Offline Queued vs Delivered Live) */}
                    {isMine && msg.deliveryStatus && (
                      <div className="mt-1.5 flex items-center justify-end gap-1 text-[9px] font-mono">
                        {msg.deliveryStatus === 'QUEUED_OFFLINE' ? (
                          <span className="text-amber-300 flex items-center gap-1">
                            <Clock size={10} /> Saved Offline — Will deliver when @{msg.recipientName}{' '}
                            is online
                          </span>
                        ) : msg.deliveryStatus === 'READ_ON_WAKE' ? (
                          <span className="text-emerald-400 flex items-center gap-1">
                            <CheckCheck size={11} /> Delivered &amp; Read when @{msg.recipientName}{' '}
                            came online
                          </span>
                        ) : (
                          <span className="text-emerald-400 flex items-center gap-1">
                            <CheckCheck size={11} /> Delivered Live
                          </span>
                        )}
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
            <div ref={chatBottomRef} />
          </div>

          {/* Message Input Box */}
          <form
            onSubmit={handleSendMessage}
            className="p-2.5 sm:p-3.5 border-t border-white/10 bg-gray-950 flex gap-2 shrink-0"
          >
            <input
              type="text"
              value={chatInput}
              onChange={(e) => setChatInput(e.target.value)}
              placeholder={
                activeContact
                  ? activeContact.isOnline
                    ? `Message @${activeContact.username} or agree on a wager...`
                    : `Leave an offline message for @${activeContact.username} (they'll see it when online)...`
                  : 'Post a message to the Global Dojo Lounge...'
              }
              className="flex-1 min-w-0 bg-black border border-white/20 focus:border-shin-gold rounded-xl px-3 py-2 text-xs text-white focus:outline-none"
            />
            <button
              type="submit"
              className="px-4 sm:px-5 py-2 bg-shin-gold text-black font-cinzel font-black text-xs uppercase rounded-xl flex items-center gap-1.5 hover:bg-yellow-400 shrink-0 cursor-pointer"
            >
              <Send size={13} /> Send
            </button>
          </form>
        </div>
      </div>
    </div>
  );
};

export default DojoLobbyFlow;
