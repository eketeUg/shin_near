'use client';

import { useState, useEffect } from 'react';
import {
  User as UserIcon,
  Swords,
  Flame,
  Sparkles,
  Eye,
  Shield,
  Zap,
  Trophy,
  ChevronLeft,
  ChevronRight,
  Plus,
  Terminal,
  ExternalLink,
  Volume2,
  VolumeX,
  Coins,
} from 'lucide-react';
import SpectateScreen from './SpectateScreen';
import AuthModal from './AuthModal';
import ProfilePage from './ProfilePage';
import { nearArenaEngine, COMBAT_DOCTRINES } from '../services/nearArenaEngine';
import { Roster, CharacterId } from './PreGameFlow';

interface MainMenuProps {
  initialModal?: 'controls' | 'about' | 'settings' | 'lobby' | 'auth' | 'gamemode' | 'profile' | 'judge' | null;
  onStart: (user: any, mode: 'PVE' | 'PVP') => void;
  onWatchLive: (match?: any) => void;
  onOpenDojoLobby?: () => void;
  onOpenTournaments?: () => void;
  onOpenColosseum?: (initialTab?: 'LIVE_ARENA' | 'MY_AGENTS' | 'DOJO_MARKET' | 'LEDGER') => void;
  onAwakenWarrior?: (charId?: CharacterId) => void;
  isMuted: boolean;
  onToggleMute: () => void;
}

const MainMenu = ({
  initialModal = null,
  onStart,
  onWatchLive,
  onOpenDojoLobby,
  onOpenTournaments,
  onOpenColosseum,
  onAwakenWarrior,
  isMuted,
  onToggleMute,
}: MainMenuProps) => {
  const [activeModal, setActiveModal] = useState<
    'controls' | 'about' | 'settings' | 'lobby' | 'auth' | 'gamemode' | 'profile' | 'judge' | null
  >(initialModal);
  const [username, setUsername] = useState<string>('Warrior');
  const [currentUser, setCurrentUser] = useState<any | null>(null);
  const [isAuthLoading, setIsAuthLoading] = useState(true);
  const [arenaState, setArenaState] = useState(() => nearArenaEngine.getState());
  const [championIdx, setChampionIdx] = useState(0);
  const [topUpFeedback, setTopUpFeedback] = useState<string | null>(null);
  const [pendingFightMode, setPendingFightMode] = useState<'PVE' | 'PVP' | null>(null);

  const playHoverSound = () => {
    if (isMuted) return;
    const audio = new Audio('/assets/audio/sfx/ui_hover.mp3');
    audio.volume = 0.2;
    audio.play().catch(() => {});
  };

  const playClickSound = () => {
    if (isMuted) return;
    const audio = new Audio('/assets/audio/sfx/ui_click.mp3');
    audio.volume = 0.5;
    audio.play().catch(() => {});
  };

  useEffect(() => {
    const syncNear = () => setArenaState({ ...nearArenaEngine.getState() });
    window.addEventListener('nearArenaStateUpdated', syncNear);
    return () => window.removeEventListener('nearArenaStateUpdated', syncNear);
  }, []);

  useEffect(() => {
    const checkAuth = async () => {
      try {
        const localUserStr = localStorage.getItem('shin_near_user');
        if (localUserStr) {
          const parsed = JSON.parse(localUserStr);
          setCurrentUser(parsed);
          const name = parsed.username || parsed.userName || 'Warrior';
          setUsername(name);
          nearArenaEngine.syncUsername(name);
          setIsAuthLoading(false);
          return;
        }
        let cachedName = localStorage.getItem('shin_username');
        if (!cachedName) {
          cachedName = `Warrior_${Math.floor(100 + Math.random() * 900)}`;
          localStorage.setItem('shin_username', cachedName);
        }
        setUsername(cachedName);
        nearArenaEngine.syncUsername(cachedName);
      } catch {
        setUsername('Warrior');
      } finally {
        setIsAuthLoading(false);
      }
    };
    checkAuth();
  }, []);

  const ownedChampions = arenaState.fighters.filter((f) => !f.isNpc);
  const activeChampion =
    ownedChampions[championIdx % Math.max(1, ownedChampions.length)] || arenaState.fighters[0];

  const getCharGif = (charId: string) => {
    const found = Roster.find((r) => r.id === charId);
    return found ? `/assets/Shin_gifs/${found.gif}` : '/assets/Shin_gifs/Shinobi_AllActions.gif';
  };

  const activeDoctrine =
    COMBAT_DOCTRINES.find((d) => d.id === activeChampion?.doctrine) || COMBAT_DOCTRINES[0];

  const handleQuickTopUp = () => {
    playClickSound();
    nearArenaEngine.claimFaucetOrIntentSwap(15, 50);
    setArenaState({ ...nearArenaEngine.getState() });
    setTopUpFeedback('+15 NEAR added to War Chest!');
    setTimeout(() => setTopUpFeedback(null), 2500);
  };

  return (
    <div className="fixed inset-0 z-10 flex flex-col justify-between overflow-y-auto bg-gradient-to-b from-black/80 via-black/65 to-black/95 text-white select-none">
      {/* =====================================================================
          TOP ARCADE HUD BAR (Gamer-first profile + Judge Under-the-Hood Toggle)
         ===================================================================== */}
      <header className="w-full px-3 sm:px-6 md:px-10 py-2.5 sm:py-3.5 flex flex-wrap items-center justify-between gap-2 sm:gap-3 border-b border-white/10 bg-black/75 backdrop-blur-md z-30">
        {/* Left: Player Identity & War Chest */}
        <div className="flex flex-wrap items-center gap-2 sm:gap-4">
          <button
            onClick={() => {
              playClickSound();
              setActiveModal(currentUser ? 'profile' : 'auth');
            }}
            className="group flex items-center gap-2 bg-white/5 hover:bg-white/10 border border-shin-gold/40 px-2.5 sm:px-3.5 py-1.5 rounded-lg transition-all cursor-pointer"
          >
            <div className="w-6 h-6 sm:w-7 sm:h-7 rounded bg-shin-gold/20 border border-shin-gold flex items-center justify-center text-shin-gold font-cinzel font-black text-xs">
              <UserIcon size={13} />
            </div>
            <div className="text-left">
              <div className="text-[8px] sm:text-[9px] text-gray-400 uppercase tracking-widest">
                {currentUser ? 'Champion' : 'Pass'}
              </div>
              <div className="text-[11px] sm:text-xs font-cinzel font-bold text-white group-hover:text-shin-gold transition-colors truncate max-w-[90px] sm:max-w-none">
                {isAuthLoading ? 'Loading...' : username}
              </div>
            </div>
          </button>

          {/* War Chest Balance */}
          <div className="flex items-center gap-1.5 sm:gap-2 bg-black/80 border border-white/15 px-2.5 sm:px-3.5 py-1.5 rounded-lg">
            <Coins size={14} className="text-shin-gold shrink-0" />
            <div>
              <div className="text-[8px] sm:text-[9px] text-gray-400 uppercase tracking-wider">War Chest</div>
              <div className="text-[11px] sm:text-sm font-mono font-bold text-shin-gold">
                {arenaState.playerWallet.NEAR.toFixed(1)} NEAR
              </div>
            </div>
            <button
              onClick={handleQuickTopUp}
              className="ml-1 sm:ml-2 px-2 py-1 bg-shin-gold text-black hover:bg-yellow-400 rounded text-[9px] sm:text-[10px] font-cinzel font-black uppercase tracking-wider transition-all cursor-pointer"
              title="Refill War Chest (Instant & Gasless)"
            >
              + Refill
            </button>
          </div>

          {topUpFeedback && (
            <span className="text-xs font-cinzel font-bold text-emerald-400 animate-pulse">
              {topUpFeedback}
            </span>
          )}
        </div>

        {/* Right: Live Colosseum Pulse + Judge Inspector Toggle + Sound */}
        <div className="flex items-center gap-2.5">
          <button
            onClick={() => {
              playClickSound();
              onOpenColosseum?.('LIVE_ARENA');
            }}
            className="hidden sm:flex items-center gap-2 px-3 py-1.5 rounded-lg bg-red-950/60 hover:bg-red-900/70 border border-red-500/40 text-xs font-cinzel text-red-300 cursor-pointer transition-all"
          >
            <span className="w-2 h-2 rounded-full bg-red-500 animate-ping" />
            <span>{arenaState.activeMatches.length} Live Colosseum Fights</span>
          </button>

          {/* Dedicated Judge / Under-The-Hood Inspector Button */}
          <button
            onClick={() => {
              playClickSound();
              setActiveModal('judge');
            }}
            className="px-3 py-1.5 rounded-lg bg-emerald-950/60 hover:bg-emerald-900/80 border border-emerald-500/40 text-emerald-300 text-[11px] font-mono flex items-center gap-1.5 transition-all cursor-pointer"
            title="Inspect Embedded NEAR Accounts, NEP-171 Fighter Vaults & Contract Receipts"
          >
            <Terminal size={13} />
            <span>NEAR Inspector</span>
          </button>

          <button
            onClick={onToggleMute}
            className="p-2 rounded-lg bg-white/5 hover:bg-white/10 border border-white/15 text-gray-300 hover:text-white cursor-pointer"
            title={isMuted ? 'Unmute Audio' : 'Mute Audio'}
          >
            {isMuted ? <VolumeX size={16} /> : <Volume2 size={16} />}
          </button>
        </div>
      </header>

      {/* =====================================================================
          MAIN SPLIT-STAGE ARCADE HUB (Left: Arcade Blades | Right: Champion)
         ===================================================================== */}
      <div className="flex-1 max-w-7xl w-full mx-auto px-3 sm:px-6 md:px-10 py-4 sm:py-6 pb-10 grid grid-cols-1 lg:grid-cols-12 items-center gap-6 sm:gap-8 z-20">
        {/* LEFT COLUMN (7 cols): Title & Angled Arcade Action Blades */}
        <div className="lg:col-span-7 flex flex-col items-start justify-center space-y-4 sm:space-y-6 w-full">
          {/* Dramatic Title Block */}
          <div>
            <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded bg-shin-red/20 border border-shin-red/50 text-shin-red text-[9px] sm:text-[10px] font-cinzel font-bold tracking-[0.2em] uppercase mb-1.5">
              <Flame size={12} /> Shinobi &amp; Samurai Arcade Arena
            </div>
            <div className="relative">
              <h1 className="text-5xl sm:text-7xl md:text-8xl font-black font-cinzel tracking-[0.12em] text-transparent bg-clip-text bg-gradient-to-b from-white via-gray-100 to-gray-400 leading-none glow-text">
                SHIN
              </h1>
              <div className="h-1 w-36 sm:w-48 bg-gradient-to-r from-shin-red via-shin-gold to-transparent mt-1.5 shadow-[0_0_15px_rgba(255,42,42,0.9)]" />
            </div>
            <p className="text-[11px] sm:text-xs md:text-sm font-cinzel text-shin-gold tracking-[0.35em] sm:tracking-[0.45em] uppercase mt-1.5 glow-gold">
              The Struggle • Enter The Pit
            </p>
          </div>

          {/* Primary Arcade Menu Blades */}
          <div className="w-full max-w-xl space-y-2.5 sm:space-y-3.5 pt-1">
            {/* BLADE 1: PLAY 1V1 KOMBAT (PVE / ONLINE PVP) */}
            <button
              onClick={() => {
                playClickSound();
                setActiveModal('gamemode');
              }}
              onMouseEnter={playHoverSound}
              className="group relative w-full text-left arcade-skew bg-gradient-to-r from-red-950/90 via-black/90 to-black/80 hover:from-shin-red hover:via-red-800 hover:to-black border-l-4 border-y border-r border-l-shin-red border-white/15 hover:border-white px-4 sm:px-7 py-3 sm:py-4 transition-all duration-200 shadow-[0_0_25px_rgba(255,42,42,0.2)] hover:shadow-[0_0_35px_rgba(255,42,42,0.6)] sm:hover:translate-x-2 cursor-pointer"
            >
              <div className="arcade-unskew flex items-center justify-between gap-2">
                <div className="flex items-center gap-3 sm:gap-4">
                  <div className="w-9 h-9 sm:w-11 sm:h-11 shrink-0 rounded-lg bg-shin-red/20 group-hover:bg-black/30 border border-shin-red/50 flex items-center justify-center text-shin-red group-hover:text-white">
                    <Swords size={20} />
                  </div>
                  <div>
                    <div className="font-cinzel font-black text-base sm:text-lg md:text-2xl tracking-[0.12em] sm:tracking-[0.15em] text-white uppercase">
                      FIGHT NOW (1V1 KOMBAT)
                    </div>
                    <div className="text-[10px] sm:text-[11px] text-gray-300 group-hover:text-white/90 tracking-wider">
                      Control your warrior in Arcade Story (PvE) or Online Duel (PvP)
                    </div>
                  </div>
                </div>
                <span className="font-cinzel font-black text-xs text-shin-gold group-hover:text-white uppercase tracking-widest hidden sm:inline">
                  PLAY →
                </span>
              </div>
            </button>

            {/* BLADE 2: SHADOW COLOSSEUM (AI VS AI POOLS & LIVE SPECTATOR BETTING) */}
            <button
              onClick={() => {
                playClickSound();
                onOpenColosseum?.('LIVE_ARENA');
              }}
              onMouseEnter={playHoverSound}
              className="group relative w-full text-left arcade-skew bg-gradient-to-r from-amber-950/80 via-black/90 to-black/80 hover:from-amber-600 hover:via-amber-900 hover:to-black border-l-4 border-y border-r border-l-shin-gold border-white/15 hover:border-shin-gold px-4 sm:px-7 py-3 sm:py-4 transition-all duration-200 shadow-[0_0_20px_rgba(251,191,36,0.15)] hover:shadow-[0_0_35px_rgba(251,191,36,0.5)] sm:hover:translate-x-2 cursor-pointer"
            >
              <div className="arcade-unskew flex items-center justify-between gap-2">
                <div className="flex items-center gap-3 sm:gap-4">
                  <div className="w-9 h-9 sm:w-11 sm:h-11 shrink-0 rounded-lg bg-shin-gold/20 group-hover:bg-black/30 border border-shin-gold/50 flex items-center justify-center text-shin-gold group-hover:text-white">
                    <Flame size={20} />
                  </div>
                  <div>
                    <div className="font-cinzel font-black text-sm sm:text-base md:text-xl tracking-[0.12em] sm:tracking-[0.15em] text-white uppercase flex flex-wrap items-center gap-1.5 sm:gap-2">
                      <span>SHADOW COLOSSEUM</span>
                      <span className="text-[8px] sm:text-[9px] bg-shin-gold text-black font-mono font-bold px-2 py-0.5 rounded">
                        WINNER TAKES POOL
                      </span>
                    </div>
                    <div className="text-[10px] sm:text-[11px] text-gray-300 group-hover:text-white/90 tracking-wider">
                      Send your Shadow Agent into 24/7 prize pools or bet on live AI battles
                    </div>
                  </div>
                </div>
                <span className="font-cinzel font-black text-xs text-shin-gold group-hover:text-white uppercase tracking-widest hidden sm:inline">
                  ENTER →
                </span>
              </div>
            </button>

            {/* BLADE 3: CHAMPION BARRACKS & GRANDMASTER DOJO */}
            <button
              onClick={() => {
                playClickSound();
                onOpenColosseum?.('MY_AGENTS');
              }}
              onMouseEnter={playHoverSound}
              className="group relative w-full text-left arcade-skew bg-gradient-to-r from-emerald-950/75 via-black/90 to-black/80 hover:from-emerald-700 hover:via-emerald-900 hover:to-black border-l-4 border-y border-r border-l-emerald-400 border-white/15 hover:border-emerald-400 px-4 sm:px-7 py-3 sm:py-3.5 transition-all duration-200 sm:hover:translate-x-2 cursor-pointer"
            >
              <div className="arcade-unskew flex items-center justify-between gap-2">
                <div className="flex items-center gap-3 sm:gap-4">
                  <div className="w-9 h-9 sm:w-10 sm:h-10 shrink-0 rounded-lg bg-emerald-500/20 border border-emerald-500/40 flex items-center justify-center text-emerald-400 group-hover:text-white">
                    <Shield size={18} />
                  </div>
                  <div>
                    <div className="font-cinzel font-bold text-xs sm:text-sm md:text-lg tracking-[0.12em] sm:tracking-[0.15em] text-white uppercase">
                      BARRACKS &amp; DOJO ({ownedChampions.length} WARRIORS)
                    </div>
                    <div className="text-[10px] sm:text-[11px] text-gray-400 group-hover:text-white/90 tracking-wider">
                      Fill Fighter War Chests, set Per-Fight Stakes &amp; trade at Hanzo&apos;s Dojo
                    </div>
                  </div>
                </div>
                <span className="font-cinzel font-bold text-xs text-emerald-400 group-hover:text-white uppercase tracking-widest hidden sm:inline">
                  MANAGE →
                </span>
              </div>
            </button>

            {/* BLADE 4: DOJO SOCIAL LOBBY, TOURNAMENTS, AWAKEN WARRIOR & SPECTATE TV */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 pt-1">
              <button
                onClick={() => {
                  playClickSound();
                  onOpenDojoLobby?.();
                }}
                onMouseEnter={playHoverSound}
                className="arcade-skew bg-black/80 hover:bg-emerald-500/20 border border-emerald-400/50 hover:border-emerald-400 px-2.5 py-2.5 sm:py-3 transition-all cursor-pointer group"
              >
                <div className="arcade-unskew flex items-center justify-center gap-1.5 font-cinzel font-bold text-[10px] sm:text-[11px] tracking-wider text-emerald-300 group-hover:text-white uppercase">
                  <UserIcon size={13} />
                  <span>Dojo Chat Lobby</span>
                </div>
              </button>

              <button
                onClick={() => {
                  playClickSound();
                  onOpenTournaments?.();
                }}
                onMouseEnter={playHoverSound}
                className="arcade-skew bg-black/80 hover:bg-purple-500/20 border border-purple-400/50 hover:border-purple-400 px-2.5 py-2.5 sm:py-3 transition-all cursor-pointer group"
              >
                <div className="arcade-unskew flex items-center justify-center gap-1.5 font-cinzel font-bold text-[10px] sm:text-[11px] tracking-wider text-purple-300 group-hover:text-white uppercase">
                  <Trophy size={13} />
                  <span>Tournaments</span>
                </div>
              </button>

              <button
                onClick={() => {
                  playClickSound();
                  onAwakenWarrior?.('kunoichi');
                }}
                onMouseEnter={playHoverSound}
                className="arcade-skew bg-black/80 hover:bg-shin-gold/20 border border-shin-gold/40 hover:border-shin-gold px-2.5 py-2.5 sm:py-3 transition-all cursor-pointer group"
              >
                <div className="arcade-unskew flex items-center justify-center gap-1.5 font-cinzel font-bold text-[10px] sm:text-[11px] tracking-wider text-shin-gold group-hover:text-white uppercase">
                  <Sparkles size={13} />
                  <span>Awaken Warrior</span>
                </div>
              </button>

              <button
                onClick={() => {
                  playClickSound();
                  onWatchLive();
                }}
                onMouseEnter={playHoverSound}
                className="arcade-skew bg-black/80 hover:bg-blue-500/20 border border-blue-400/40 hover:border-blue-400 px-2.5 py-2.5 sm:py-3 transition-all cursor-pointer group"
              >
                <div className="arcade-unskew flex items-center justify-center gap-1.5 font-cinzel font-bold text-[10px] sm:text-[11px] tracking-wider text-blue-300 group-hover:text-white uppercase">
                  <Eye size={13} />
                  <span>Spectate TV</span>
                </div>
              </button>
            </div>
          </div>

          {/* Utility Row: Controls / Lore / Settings */}
          <div className="flex flex-wrap items-center gap-2 sm:gap-3 pt-1">
            {[
              { id: 'controls', label: '🎮 FIGHT CONTROLS' },
              { id: 'about', label: '📜 LORE & ARENA RULES' },
              { id: 'settings', label: '⚙️ SETTINGS' },
            ].map((btn) => (
              <button
                key={btn.id}
                onClick={() => {
                  playClickSound();
                  setActiveModal(btn.id as any);
                }}
                className="px-3.5 py-2 rounded bg-white/5 hover:bg-white/15 border border-white/10 text-[10px] font-cinzel font-bold tracking-widest text-gray-400 hover:text-white uppercase transition-all cursor-pointer"
              >
                {btn.label}
              </button>
            ))}
          </div>
        </div>

        {/* RIGHT COLUMN (5 cols): Living Champion Showcase Pedestal */}
        {activeChampion && (
          <div className="lg:col-span-5 flex flex-col items-center">
            <div className="w-full max-w-md bg-gradient-to-b from-gray-900/90 via-black/95 to-black border-2 border-shin-gold/40 rounded-2xl p-5 shadow-[0_0_50px_rgba(0,0,0,0.9)] relative overflow-hidden">
              {/* Top Champion Header */}
              <div className="flex items-center justify-between border-b border-white/10 pb-3 mb-4">
                <div>
                  <div className="text-[10px] font-cinzel text-shin-gold uppercase tracking-widest flex items-center gap-1.5">
                    <Trophy size={12} /> Active Champion Showcase
                  </div>
                  <h2 className="text-xl font-cinzel font-black text-white uppercase mt-0.5">
                    {activeChampion.title}
                  </h2>
                </div>
                <div className="text-right">
                  <span className="px-2.5 py-1 rounded bg-shin-gold text-black font-mono font-black text-xs">
                    LV.{activeChampion.powerLevel}
                  </span>
                  <div className="text-[10px] font-mono text-gray-400 mt-1">
                    {activeChampion.elo} ELO • {activeChampion.wins}W/{activeChampion.losses}L
                  </div>
                </div>
              </div>

              {/* Animated Fighter Stage */}
              <div className="relative h-56 flex items-end justify-center bg-gradient-to-t from-red-950/30 via-black/40 to-transparent rounded-xl border border-white/10 mb-4 overflow-hidden">
                {/* Glowing Dojo Aura Ring */}
                <div className="absolute bottom-3 w-48 h-10 rounded-full bg-shin-gold/20 blur-md border border-shin-gold/40" />

                {/* Cycle Champion Arrows */}
                {ownedChampions.length > 1 && (
                  <>
                    <button
                      onClick={() => {
                        playClickSound();
                        setChampionIdx(
                          (prev) => (prev - 1 + ownedChampions.length) % ownedChampions.length,
                        );
                      }}
                      className="absolute left-2 top-1/2 -translate-y-1/2 w-8 h-8 rounded-full bg-black/70 border border-white/20 hover:border-shin-gold flex items-center justify-center text-white z-20 cursor-pointer"
                    >
                      <ChevronLeft size={16} />
                    </button>
                    <button
                      onClick={() => {
                        playClickSound();
                        setChampionIdx((prev) => (prev + 1) % ownedChampions.length);
                      }}
                      className="absolute right-2 top-1/2 -translate-y-1/2 w-8 h-8 rounded-full bg-black/70 border border-white/20 hover:border-shin-gold flex items-center justify-center text-white z-20 cursor-pointer"
                    >
                      <ChevronRight size={16} />
                    </button>
                  </>
                )}

                <img
                  src={getCharGif(activeChampion.charId)}
                  alt={activeChampion.name}
                  className="w-44 h-44 object-contain scale-125 origin-bottom animate-float-idle z-10"
                  style={{ imageRendering: 'pixelated' }}
                />

                {/* Shadow AI Status Pill */}
                <div className="absolute top-3 left-3 px-2.5 py-1 rounded-full bg-black/80 border border-emerald-500/40 text-[10px] font-cinzel text-emerald-400 flex items-center gap-1.5">
                  <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
                  <span>Style: {activeDoctrine.name}</span>
                </div>
              </div>

              {/* Fighter Attributes & War Chest Strip */}
              <div className="grid grid-cols-3 gap-2 mb-4 text-center">
                <div className="bg-white/5 border border-white/10 rounded-lg p-2">
                  <div className="text-[9px] text-gray-400 uppercase">Attack</div>
                  <div className="text-sm font-mono font-bold text-red-400">{activeChampion.atk}</div>
                </div>
                <div className="bg-white/5 border border-white/10 rounded-lg p-2">
                  <div className="text-[9px] text-gray-400 uppercase">Defense</div>
                  <div className="text-sm font-mono font-bold text-emerald-400">
                    {activeChampion.def}
                  </div>
                </div>
                <div className="bg-white/5 border border-white/10 rounded-lg p-2">
                  <div className="text-[9px] text-gray-400 uppercase">Speed</div>
                  <div className="text-sm font-mono font-bold text-blue-400">{activeChampion.spd}</div>
                </div>
              </div>

              {/* Fighter's Dedicated War Chest & Stake Info */}
              <div className="bg-black/80 border border-shin-gold/30 rounded-xl p-3 mb-4 flex items-center justify-between">
                <div>
                  <div className="text-[10px] text-gray-400 uppercase">
                    Champion&apos;s Own War Chest
                  </div>
                  <div className="text-sm font-mono font-bold text-shin-gold">
                    {activeChampion.vaultBalanceNear.toFixed(2)} NEAR
                  </div>
                </div>
                <div className="text-right">
                  <div className="text-[10px] text-gray-400 uppercase">Stake Per Fight</div>
                  <div className="text-sm font-mono font-bold text-emerald-400">
                    {activeChampion.wagerPerFightNear.toFixed(1)} NEAR / Pool
                  </div>
                </div>
              </div>

              {/* Instant Action Buttons for Active Champion */}
              <div className="grid grid-cols-2 gap-2.5">
                <button
                  onClick={() => {
                    playClickSound();
                    const match = nearArenaEngine.createImmediateAgentMatch(activeChampion.tokenId);
                    onWatchLive(match);
                  }}
                  className="py-3 px-3 bg-shin-red hover:bg-red-600 text-white font-cinzel font-black text-xs uppercase tracking-wider rounded-xl shadow-[0_0_20px_rgba(255,42,42,0.4)] transition-all flex items-center justify-center gap-1.5 cursor-pointer"
                >
                  <Zap size={14} />
                  <span>Send to Pit Now</span>
                </button>
                <button
                  onClick={() => {
                    playClickSound();
                    onOpenColosseum?.('DOJO_MARKET');
                  }}
                  className="py-3 px-3 bg-shin-gold/20 hover:bg-shin-gold hover:text-black text-shin-gold border border-shin-gold/50 font-cinzel font-bold text-xs uppercase tracking-wider rounded-xl transition-all flex items-center justify-center gap-1.5 cursor-pointer"
                >
                  <span>🏮 Train at Dojo</span>
                </button>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* =====================================================================
          MODALS (Game Mode, Controls, About, Judge Inspector, Auth, Profile)
         ===================================================================== */}
      {activeModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/90 p-4 backdrop-blur-md">
          {activeModal === 'auth' ? (
            <div className="animate-in zoom-in-95 duration-200 flex justify-center w-full">
              <AuthModal
                subtitle={
                  pendingFightMode
                    ? 'Sign in with Google/Email for on-chain NEAR rewards, or fight as a Guest'
                    : undefined
                }
                onClose={() => {
                  playClickSound();
                  setPendingFightMode(null);
                  setActiveModal(null);
                }}
                onSuccess={(user) => {
                  setCurrentUser(user);
                  const name = user.username || user.userName || 'Warrior';
                  setUsername(name);
                  nearArenaEngine.syncUsername(name);
                  setArenaState({ ...nearArenaEngine.getState() });
                  setActiveModal(null);
                  if (pendingFightMode) {
                    const modeToLaunch = pendingFightMode;
                    setPendingFightMode(null);
                    onStart(user, modeToLaunch);
                  }
                }}
              />
            </div>
          ) : (
            <div
              className={`${
                activeModal === 'profile' || activeModal === 'judge' ? 'max-w-3xl' : 'max-w-md'
              } bg-gray-950 border-2 border-shin-red rounded-2xl p-4 sm:p-6 md:p-8 w-full relative animate-in zoom-in-95 duration-200 shadow-[0_0_35px_rgba(255,42,42,0.3)] max-h-[90%] overflow-y-auto`}
            >
              {activeModal !== 'profile' && (
                <button
                  onClick={() => {
                    playClickSound();
                    setActiveModal(null);
                  }}
                  className="absolute top-4 right-4 text-gray-400 hover:text-white transition-colors text-xl font-bold cursor-pointer"
                  title="Close"
                >
                  ✕
                </button>
              )}

              {/* Profile Modal */}
              {activeModal === 'profile' && (
                <ProfilePage
                  user={currentUser}
                  onClose={() => setActiveModal(null)}
                  onUpdateSuccess={(updatedUser) => {
                    setCurrentUser(updatedUser);
                    setUsername(updatedUser.username || updatedUser.userName);
                  }}
                />
              )}

              {/* Game Mode Selection Modal */}
              {activeModal === 'gamemode' && (
                <div className="flex flex-col items-center justify-center">
                  <h2 className="text-2xl md:text-3xl font-cinzel font-black text-white mb-2 text-center tracking-widest uppercase">
                    Choose Your Battle
                  </h2>
                  <p className="text-xs text-gray-400 mb-6 text-center">
                    Take direct control of your warrior in the 2D combat pit
                  </p>
                  <div className="flex flex-col gap-4 w-full">
                    <button
                      onClick={() => {
                        playClickSound();
                        if (!currentUser) {
                          setPendingFightMode('PVE');
                          setActiveModal('auth');
                          return;
                        }
                        setActiveModal(null);
                        onStart(currentUser, 'PVE');
                      }}
                      className="group relative w-full px-6 py-5 bg-black/80 border border-white/20 hover:border-shin-gold hover:bg-shin-gold/10 rounded-xl transition-all cursor-pointer text-left"
                    >
                      <div className="flex items-center justify-between">
                        <span className="font-cinzel font-black text-xl tracking-widest text-white group-hover:text-shin-gold">
                          ⚔ ARCADE GAUNTLET (VS AI)
                        </span>
                        <span className="text-xs font-mono text-shin-gold">INSTANT</span>
                      </div>
                      <span className="block text-xs text-gray-400 mt-1">
                        Battle arena masters, build your Spirit Gauge, and test your combos
                      </span>
                    </button>

                    <button
                      onClick={() => {
                        playClickSound();
                        if (!currentUser) {
                          setPendingFightMode('PVP');
                          setActiveModal('auth');
                          return;
                        }
                        setActiveModal(null);
                        onStart(currentUser, 'PVP');
                      }}
                      className="group relative w-full px-6 py-5 bg-black/80 border border-white/20 hover:border-shin-red hover:bg-shin-red/10 rounded-xl transition-all cursor-pointer text-left"
                    >
                      <div className="flex items-center justify-between">
                        <span className="font-cinzel font-black text-xl tracking-widest text-white group-hover:text-shin-red">
                          🔥 ONLINE DUEL (PVP / STAKES)
                        </span>
                        <span className="text-xs font-mono text-shin-red">WAGER OR FREE</span>
                      </div>
                      <span className="block text-xs text-gray-400 mt-1">
                        Challenge live opponents in real-time or lock a winner-takes-all pot
                      </span>
                    </button>
                  </div>
                </div>
              )}

              {/* Matchmaking Lobby Modal */}
              {activeModal === 'lobby' && (
                <SpectateScreen
                  onClose={() => {
                    playClickSound();
                    setActiveModal(null);
                  }}
                  onWatchLive={onWatchLive}
                />
              )}

              {/* Controls Modal (Updated with X Special Spirit Strike!) */}
              {activeModal === 'controls' && (
                <div>
                  <h2 className="text-2xl font-cinzel font-black text-shin-gold mb-4 border-b border-white/10 pb-2 uppercase">
                    Arcade Combat Controls
                  </h2>
                  <div className="space-y-3 text-gray-300 text-sm">
                    <div className="flex justify-between items-center bg-white/5 p-3 rounded-lg border border-white/10">
                      <span className="font-bold text-white">⬅️ ➡️ / Joystick</span>
                      <span>Dash Left / Right</span>
                    </div>
                    <div className="flex justify-between items-center bg-white/5 p-3 rounded-lg border border-white/10">
                      <span className="font-bold text-yellow-400">⬆️ / Jump</span>
                      <span>Aerial Leap (Dodge Sweeps)</span>
                    </div>
                    <div className="flex justify-between items-center bg-white/5 p-3 rounded-lg border border-white/10">
                      <span className="font-bold text-red-400">[A] or [S] Key / Attack</span>
                      <span>3-Hit Katana / Martial Combo</span>
                    </div>
                    <div className="flex justify-between items-center bg-shin-gold/15 p-3 rounded-lg border border-shin-gold/50">
                      <span className="font-bold text-shin-gold">[X] or [SPACE] / ⚡ Spirit</span>
                      <span className="text-shin-gold font-bold">
                        Spirit Dash-Strike (50% Spirit • Pierces Guard!)
                      </span>
                    </div>
                    <div className="flex justify-between items-center bg-white/5 p-3 rounded-lg border border-white/10">
                      <span className="font-bold text-emerald-400">[D] Key / Shield</span>
                      <span>Guard Stance (Blocks Damage &amp; Builds Spirit)</span>
                    </div>
                  </div>
                </div>
              )}

              {/* Lore & Arena Rules Modal */}
              {activeModal === 'about' && (
                <div>
                  <h2 className="text-2xl font-cinzel font-black text-shin-gold mb-4 border-b border-white/10 pb-2 uppercase">
                    The Lore of SHIN
                  </h2>
                  <div className="space-y-4 text-gray-300 text-sm leading-relaxed">
                    <p className="bg-white/5 p-4 rounded-xl border border-white/10">
                      <strong className="text-white">SHIN: The Struggle</strong> is a fast-paced 2D
                      Shinobi &amp; Samurai arcade fighting game. Every Champion you awaken possesses
                      both a lethal martial style and their own independent{' '}
                      <strong className="text-shin-gold">War Chest</strong>.
                    </p>
                    <div className="grid grid-cols-1 gap-2.5 text-xs">
                      <div className="bg-black/60 p-3 rounded-lg border border-white/10">
                        <strong className="text-shin-red uppercase">1. Fight Yourself or Send Your Shadow:</strong>{' '}
                        Take direct control in 1v1 combat, or assign a Fighting Style and Stake Limit
                        so your Champion fights autonomously in the 24/7 Shadow Colosseum.
                      </div>
                      <div className="bg-black/60 p-3 rounded-lg border border-white/10">
                        <strong className="text-shin-gold uppercase">2. Live Crowd Backing:</strong>{' '}
                        Spectators watching live fights can toss coins into the Red or Blue corner pot.
                        Winning backers split 95% of the pot, and 5% goes straight into the winning
                        Warrior&apos;s War Chest!
                      </div>
                      <div className="bg-black/60 p-3 rounded-lg border border-white/10">
                        <strong className="text-emerald-400 uppercase">3. Grandmaster Hanzo&apos;s Shadow Dojo:</strong>{' '}
                        Master Hanzo is an autonomous NPC sensei whose training fee rises and falls
                        naturally with arena demand.
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* JUDGE INSPECTOR MODAL (NEAR Architecture Under-The-Hood) */}
              {activeModal === 'judge' && (
                <div className="space-y-5">
                  <div className="border-b border-white/15 pb-3">
                    <div className="text-[10px] font-mono text-emerald-400 uppercase tracking-widest">
                      NEAR Hackathon Technical Verification View
                    </div>
                    <h2 className="text-xl md:text-2xl font-cinzel font-black text-white uppercase mt-1">
                      Under The Hood: How NEAR Powers SHIN Invisibly
                    </h2>
                    <p className="text-xs text-gray-400 mt-1">
                      Players experience pure arcade fighting with zero wallet popups. Underneath,
                      every warrior, NPC, fight pool, and dojo upgrade runs on NEAR accounts.
                    </p>
                  </div>

                  {/* 4 Pillars Grid */}
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-xs">
                    <div className="bg-black/80 border border-emerald-500/30 rounded-xl p-3.5">
                      <div className="font-mono font-bold text-emerald-400 mb-1">
                        1. Zero-Popup Session Account
                      </div>
                      <div className="font-mono text-[11px] text-white break-all">
                        Account: {arenaState.playerWallet.accountId}
                      </div>
                      <div className="font-mono text-[10px] text-gray-400 mt-1">
                        Implicit Key: ed25519:{arenaState.playerWallet.implicitHex.slice(0, 16)}… (250 TGas Relayer)
                      </div>
                    </div>

                    <div className="bg-black/80 border border-shin-gold/30 rounded-xl p-3.5">
                      <div className="font-mono font-bold text-shin-gold mb-1">
                        2. Autonomous NPC Sensei Wallet
                      </div>
                      <div className="font-mono text-[11px] text-white">
                        {arenaState.npcDojo.npcWalletId}
                      </div>
                      <div className="font-mono text-[10px] text-gray-400 mt-1">
                        Treasury: {arenaState.npcDojo.treasuryBalanceNear.toFixed(2)} NEAR • Dynamic
                        Fee: {arenaState.npcDojo.currentDynamicCostNear.toFixed(2)} NEAR
                      </div>
                    </div>
                  </div>

                  {/* Owned Fighter NFTs & Sub-Account Wallets */}
                  <div className="bg-white/5 border border-white/10 rounded-xl p-4">
                    <div className="text-xs font-mono font-bold text-white uppercase mb-2">
                      3. Dynamic NEP-171 Fighter NFTs with Sub-Account Wallets ({ownedChampions.length})
                    </div>
                    <div className="space-y-2 max-h-40 overflow-y-auto">
                      {ownedChampions.map((f) => (
                        <div
                          key={f.tokenId}
                          className="flex flex-wrap items-center justify-between bg-black/70 px-3 py-2 rounded border border-white/10 text-[11px] font-mono"
                        >
                          <span className="text-white font-bold">
                            {f.title} ({f.tokenId})
                          </span>
                          <span className="text-shin-gold">{f.agentWalletId}</span>
                          <span className="text-emerald-400">
                            Vault: {f.vaultBalanceNear.toFixed(2)} NEAR (Stake: {f.wagerPerFightNear}N)
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* NEP-245 Multi-Token Batch Inventory */}
                  <div className="bg-white/5 border border-purple-500/30 rounded-xl p-4">
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-xs font-mono font-bold text-purple-300 uppercase">
                        4. NEP-245 Multi-Token Batch Inventory (`mt_batch_balance_of`)
                      </span>
                      <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-purple-500/20 text-purple-300 border border-purple-500/40">
                        STANDARD: NEP-245 v1.0.0
                      </span>
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-1.5 max-h-36 overflow-y-auto">
                      {nearArenaEngine.getNep245MultiTokenInventory().map((item, idx) => (
                        <div
                          key={`${item.tokenId}-${idx}`}
                          className="flex items-center justify-between bg-black/75 px-3 py-1.5 rounded border border-white/10 text-[10px] font-mono"
                        >
                          <div className="truncate pr-2">
                            <span className="text-purple-300 font-bold">{item.tokenId}</span>
                            <div className="text-[9px] text-gray-400 truncate">
                              Holder: {item.holderAccountId}
                            </div>
                          </div>
                          <span className="text-shin-gold font-bold shrink-0">{item.balance}</span>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Recent Contract Receipts */}
                  <div className="bg-white/5 border border-white/10 rounded-xl p-4">
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-xs font-mono font-bold text-white uppercase">
                        5. Live Contract Receipts (shin-arena.testnet)
                      </span>
                      <button
                        onClick={() => {
                          setActiveModal(null);
                          onOpenColosseum?.('LEDGER');
                        }}
                        className="text-[11px] font-mono text-shin-gold hover:underline cursor-pointer"
                      >
                        Open Full Ledger →
                      </button>
                    </div>
                    <div className="space-y-1.5 max-h-36 overflow-y-auto">
                      {arenaState.ledger.slice(0, 5).map((tx) => (
                        <div
                          key={tx.id}
                          className="flex items-center justify-between text-[11px] font-mono bg-black/70 px-3 py-1.5 rounded"
                        >
                          <span className="text-gray-300 truncate max-w-md">{tx.summary}</span>
                          <a
                            href={`https://testnet.nearblocks.io/txns/${tx.txHash}`}
                            target="_blank"
                            rel="noreferrer"
                            className="text-blue-400 hover:underline flex items-center gap-1 shrink-0 ml-2"
                          >
                            {tx.txHash.slice(0, 10)}… <ExternalLink size={10} />
                          </a>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              )}

              {/* Settings Modal */}
              {activeModal === 'settings' && (
                <div>
                  <h2 className="text-2xl font-cinzel font-black text-shin-red mb-6 border-b border-shin-red/20 pb-2 uppercase">
                    Arena Settings
                  </h2>
                  <div className="space-y-4">
                    <div className="flex items-center justify-between bg-white/5 p-4 rounded-xl border border-white/10">
                      <div>
                        <div className="text-white font-bold">Sound &amp; Arcade Music</div>
                        <div className="text-gray-400 text-xs">Toggle arena music and sword SFX</div>
                      </div>
                      <button
                        onClick={onToggleMute}
                        className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors cursor-pointer ${
                          !isMuted ? 'bg-shin-red' : 'bg-gray-600'
                        }`}
                      >
                        <span
                          className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                            !isMuted ? 'translate-x-6' : 'translate-x-1'
                          }`}
                        />
                      </button>
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default MainMenu;
