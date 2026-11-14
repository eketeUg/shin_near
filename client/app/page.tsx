'use client';

import { useState, useRef, useEffect } from 'react';
import { Volume2, VolumeX, Trophy } from 'lucide-react';
import { io } from 'socket.io-client';
import GameCanvasWrapper from './components/GameCanvasWrapper';
import LoadingScreen from './components/LoadingScreen';
import MainMenu from './components/MainMenu';
import PreGameFlow, { GameMode, CharacterId } from './components/PreGameFlow';
import MintFighterFlow from './components/MintFighterFlow';
import LiveFightsFlow from './components/LiveFightsFlow';
import DojoLobbyFlow from './components/DojoLobbyFlow';
import TournamentsFlow from './components/TournamentsFlow';
import LeaderboardFlow from './components/LeaderboardFlow';
import SpectatorGameCanvasWrapper from './components/SpectatorGameCanvasWrapper';
import MatchmakingScreen from './components/MatchmakingScreen';
import AgentArenaFlow from './components/AgentArenaFlow';
import MobileLandscapeGate from './components/MobileLandscapeGate';
import { nearArenaEngine, ActiveArenaMatch } from './services/nearArenaEngine';

export default function Home() {
  const [isLoading, setIsLoading] = useState(true);
  const [isGameStarted, setIsGameStarted] = useState(false);
  const [isSpectating, setIsSpectating] = useState(false);
  const [showPreGameFlow, setShowPreGameFlow] = useState(false);
  const [showMintFlow, setShowMintFlow] = useState(false);
  const [showLiveFights, setShowLiveFights] = useState(false);
  const [showDojoLobby, setShowDojoLobby] = useState(false);
  const [showTournaments, setShowTournaments] = useState(false);
  const [showLeaderboard, setShowLeaderboard] = useState(false);
  const [showAgentArena, setShowAgentArena] = useState(false);
  const [agentArenaInitialTab, setAgentArenaInitialTab] = useState<
    'LIVE_ARENA' | 'MY_AGENTS' | 'DOJO_MARKET' | 'LEDGER'
  >('LIVE_ARENA');
  const [returnToAgentArenaAfterFight, setReturnToAgentArenaAfterFight] = useState(false);
  const [showMatchmaking, setShowMatchmaking] = useState(false);
  const [initialMintChar, setInitialMintChar] = useState<CharacterId | null>(null);
  const [matchmakingP1Char, setMatchmakingP1Char] = useState<CharacterId | null>(null);
  const [ownedChars, setOwnedChars] = useState<string[]>(['fighter']);
  const [username, setUsername] = useState<string>('Warrior');
  const [user, setUser] = useState<any | null>(null);
  const [spectatingMatch, setSpectatingMatch] = useState<any>(null);
  const bgMusicRef = useRef<HTMLAudioElement>(null);
  const [isMuted, setIsMuted] = useState(false);
  const [selectedMode, setSelectedMode] = useState<'PVE' | 'PVP'>('PVP');
  const [lastMenuModal, setLastMenuModal] = useState<
    'controls' | 'about' | 'settings' | 'lobby' | 'auth' | 'gamemode' | 'judge' | null
  >(null);

  const [wager, setWager] = useState<{ token: string; amount: number } | null>(null);
  const [matchmakingRoomCode, setMatchmakingRoomCode] = useState<string | null>(null);
  const [balances, setBalances] = useState({ NEAR: 25, USDC: 100, USDT: 50 });
  const [pendingPlayerFight, setPendingPlayerFight] = useState<any | null>(null);
  const activeTournamentBoutRef = useRef<{
    matchId: string;
    p1AccountId: string;
    p2AccountId: string;
  } | null>(null);
  const [tourneyAlert, setTourneyAlert] = useState<{
    title: string;
    matchLabel: string;
    opponentName: string;
  } | null>(null);
  const [deployedChars, setDeployedChars] = useState<string[]>([]);

  useEffect(() => {
    const onGameOver = (e: Event) => {
      const detail = (e as CustomEvent).detail;
      const bout = activeTournamentBoutRef.current;
      if (!bout || !detail) return;
      if (detail.winnerId !== 'p1' && detail.winnerId !== 'p2') return;
      const winnerAccountId =
        detail.winnerId === 'p1' ? bout.p1AccountId : bout.p2AccountId;
      activeTournamentBoutRef.current = null;
      if (winnerAccountId) {
        void nearArenaEngine.reportHumanTournamentMatchResult(
          bout.matchId,
          winnerAccountId,
        );
      }
    };
    window.addEventListener('gameOver', onGameOver);
    return () => window.removeEventListener('gameOver', onGameOver);
  }, []);

  useEffect(() => {
    const serverUrl = process.env.NEXT_PUBLIC_SERVER_URL || 'http://localhost:3001';
    const socket = io(serverUrl, { reconnectionAttempts: 5 });

    const checkMyReadyMatch = (cup: any) => {
      if (!cup?.matches) return;
      const myAcct = nearArenaEngine.getState().playerWallet.accountId;
      const myMatch = cup.matches.find(
        (m: any) =>
          m.status === 'READY' && (m.p1Id === myAcct || m.p2Id === myAcct),
      );
      if (myMatch) {
        const opponentName =
          myMatch.p1Id === myAcct ? myMatch.p2Name : myMatch.p1Name;
        setTourneyAlert({
          title: cup.title,
          matchLabel: myMatch.label,
          opponentName,
        });
      }
    };

    const updateDeployedFromAgentCup = (agentCup: any) => {
      if (!agentCup?.enrolledAgents) return;
      const myAcct = nearArenaEngine.getState().playerWallet.accountId;
      if (agentCup.status !== 'IN_PROGRESS') {
        setDeployedChars([]);
        return;
      }
      const list = agentCup.enrolledAgents
        .filter((a: any) => a.ownerId === myAcct && a.enrolled)
        .map((a: any) => a.charClass);
      setDeployedChars(Array.from(new Set(list)));
    };

    void nearArenaEngine
      .fetchLiveTournamentsState()
      .then((d) => updateDeployedFromAgentCup(d.agentCup))
      .catch(() => {});

    socket.on('tournament_started', (cup: any) => checkMyReadyMatch(cup));
    socket.on('tournament_updated', (payload: any) => {
      if (payload?.humanCup) checkMyReadyMatch(payload.humanCup);
      if (payload?.agentCup) updateDeployedFromAgentCup(payload.agentCup);
    });

    return () => {
      socket.disconnect();
    };
  }, []);
  const [orientationPreference, setOrientationPreference] = useState<
    'AUTO_HYBRID' | 'FORCE_LANDSCAPE' | 'FORCE_PORTRAIT'
  >('AUTO_HYBRID');

  const isForceLandscapeActive = orientationPreference === 'FORCE_LANDSCAPE';
  const [isLandscapeReady, setIsLandscapeReady] = useState(false);

  useEffect(() => {
    const updateLandscapeReady = () => {
      if (typeof window === 'undefined') return;
      const isTouchDevice =
        window.matchMedia?.('(pointer: coarse)').matches ||
        /Mobi|Android|iPhone|iPad|iPod/i.test(navigator.userAgent);
      const isPortrait = window.innerHeight > window.innerWidth;
      setIsLandscapeReady(!isTouchDevice || !isPortrait || isForceLandscapeActive);
    };

    updateLandscapeReady();
    window.addEventListener('resize', updateLandscapeReady);
    window.addEventListener('orientationchange', updateLandscapeReady);
    const orientationObj = typeof screen !== 'undefined' ? (screen as any)?.orientation : null;
    orientationObj?.addEventListener?.('change', updateLandscapeReady);

    return () => {
      window.removeEventListener('resize', updateLandscapeReady);
      window.removeEventListener('orientationchange', updateLandscapeReady);
      orientationObj?.removeEventListener?.('change', updateLandscapeReady);
    };
  }, [isForceLandscapeActive]);

  const isMobilePortraitViewport = () => {
    if (typeof window === 'undefined') return false;
    return window.innerWidth <= 900 && window.innerHeight > window.innerWidth;
  };

  const applyNativeOrientation = (target: 'landscape' | 'portrait' | 'unlock') => {
    try {
      const orientation = (screen as any)?.orientation;
      if (!orientation) return;
      if (target === 'unlock' && typeof orientation.unlock === 'function') {
        orientation.unlock();
      } else if (target !== 'unlock' && typeof orientation.lock === 'function') {
        orientation.lock(target).catch(() => {});
      }
    } catch {}
  };

  useEffect(() => {
    if (isForceLandscapeActive) {
      applyNativeOrientation('landscape');
    } else if (orientationPreference === 'FORCE_PORTRAIT') {
      applyNativeOrientation('portrait');
    } else {
      applyNativeOrientation('unlock');
    }
    const t = setTimeout(() => window.dispatchEvent(new Event('resize')), 60);
    return () => clearTimeout(t);
  }, [isForceLandscapeActive, orientationPreference]);

  const executeFightStart = (fightDetail: any) => {
    setPendingPlayerFight(null);
    setIsGameStarted(true);
    setTimeout(() => {
      window.dispatchEvent(new Event('resize'));
      window.dispatchEvent(
        new CustomEvent('startGameScene', {
          detail: fightDetail,
        }),
      );
    }, 60);
  };

  const startPlayerFightWithLandscapeGate = (fightDetail: any) => {
    // Request fullscreen and landscape lock on supported Android browsers
    try {
      if (typeof window !== 'undefined' && window.innerWidth <= 900) {
        document.documentElement.requestFullscreen?.().catch(() => {});
        applyNativeOrientation('landscape');
      }
    } catch {}

    if (isMobilePortraitViewport() && orientationPreference !== 'FORCE_LANDSCAPE') {
      setPendingPlayerFight(fightDetail);
    } else {
      executeFightStart(fightDetail);
    }
  };

  // Automatically unlock the Rotate-to-Landscape gate the exact moment the user turns their phone sideways
  useEffect(() => {
    if (!pendingPlayerFight) return;

    const checkOrientationUnlocked = () => {
      if (typeof window !== 'undefined' && window.innerWidth > window.innerHeight) {
        executeFightStart(pendingPlayerFight);
      }
    };

    checkOrientationUnlocked();
    window.addEventListener('resize', checkOrientationUnlocked);
    window.addEventListener('orientationchange', checkOrientationUnlocked);
    const orientationObj = typeof screen !== 'undefined' ? (screen as any)?.orientation : null;
    orientationObj?.addEventListener?.('change', checkOrientationUnlocked);

    return () => {
      window.removeEventListener('resize', checkOrientationUnlocked);
      window.removeEventListener('orientationchange', checkOrientationUnlocked);
      orientationObj?.removeEventListener?.('change', checkOrientationUnlocked);
    };
  }, [pendingPlayerFight]);

  const syncFromNearEngine = () => {
    const st = nearArenaEngine.getState();
    setBalances({
      NEAR: st.playerWallet.NEAR,
      USDC: st.playerWallet.USDC,
      USDT: st.playerWallet.USDT,
    });
    const playerOwnedCharIds = Array.from(
      new Set(st.fighters.filter((f) => !f.isNpc).map((f) => f.charId)),
    );
    setOwnedChars(playerOwnedCharIds.length > 0 ? playerOwnedCharIds : ['fighter']);
  };

  useEffect(() => {
    syncFromNearEngine();
    window.addEventListener('nearArenaStateUpdated', syncFromNearEngine);
    return () => window.removeEventListener('nearArenaStateUpdated', syncFromNearEngine);
  }, []);

  useEffect(() => {
    if (!isLoading && bgMusicRef.current) {
      bgMusicRef.current
        .play()
        .then(() => setIsMuted(false))
        .catch(() => {});
    }
  }, [isLoading]);

  const handleLoadComplete = () => {
    setIsLoading(false);
  };

  const launchAgentArenaFight = (match: ActiveArenaMatch) => {
    setShowAgentArena(false);
    setShowLiveFights(false);
    setShowPreGameFlow(false);
    setReturnToAgentArenaAfterFight(true);
    setIsGameStarted(true);

    window.dispatchEvent(
      new CustomEvent('startGameScene', {
        detail: {
          mode: 'AGENT_ARENA',
          p1: match.p1.charId,
          p2: match.p2.charId,
          p1Name: match.p1.title,
          p2Name: match.p2.title,
          p1Doctrine: match.p1.doctrine,
          p2Doctrine: match.p2.doctrine,
          difficulty: 'HARD',
          rounds: 1,
          matchId: match.matchId,
        },
      }),
    );
  };

  useEffect(() => {
    const handleLeaveSpectator = () => {
      setIsSpectating(false);
      setSpectatingMatch(null);
      setShowAgentArena(true);
    };

    const handleExitMatch = () => {
      setIsGameStarted(false);
      if (returnToAgentArenaAfterFight) {
        setShowAgentArena(true);
      }
    };

    const handleRematch = () => {
      setIsGameStarted(false);
      setShowPreGameFlow(true);
    };

    const handleNextAgentMatch = () => {
      const nextMatch = nearArenaEngine.createImmediateAgentMatch();
      launchAgentArenaFight(nextMatch);
    };

    window.addEventListener('leaveSpectator', handleLeaveSpectator);
    window.addEventListener('exitMatch', handleExitMatch);
    window.addEventListener('rematch', handleRematch);
    window.addEventListener('nextAgentMatch', handleNextAgentMatch);

    const syncUserIdentity = () => {
      try {
        const storedUser = localStorage.getItem('shin_near_user');
        if (storedUser) {
          const parsed = JSON.parse(storedUser);
          setUser(parsed);
          const resolved = parsed.username || parsed.userName;
          if (resolved) {
            setUsername(resolved);
            nearArenaEngine.syncUsername(resolved, parsed.walletAddress);
          }
          return;
        }
        const engineName = nearArenaEngine.getState().playerWallet.username;
        if (engineName) setUsername(engineName);
      } catch {
        // ignore storage errors
      }
    };
    syncUserIdentity();
    window.addEventListener('nearArenaStateUpdated', syncUserIdentity);

    return () => {
      window.removeEventListener('leaveSpectator', handleLeaveSpectator);
      window.removeEventListener('exitMatch', handleExitMatch);
      window.removeEventListener('rematch', handleRematch);
      window.removeEventListener('nextAgentMatch', handleNextAgentMatch);
      window.removeEventListener('nearArenaStateUpdated', syncUserIdentity);
    };
  }, [returnToAgentArenaAfterFight]);

  const handleStartMenuClick = (userData: any, mode: 'PVE' | 'PVP') => {
    setUser(userData);
    const name = userData?.username || userData?.userName || 'Warrior';
    setUsername(name);
    nearArenaEngine.syncUsername(name, userData?.walletAddress);
    syncFromNearEngine();
    setSelectedMode(mode);
    setLastMenuModal('gamemode');
    setReturnToAgentArenaAfterFight(false);
    setShowPreGameFlow(true);
  };

  const handleStartFight = (
    mode: GameMode,
    p1: CharacterId,
    p2: CharacterId,
    difficulty: 'EASY' | 'MEDIUM' | 'HARD',
  ) => {
    setShowPreGameFlow(false);
    setReturnToAgentArenaAfterFight(false);
    startPlayerFightWithLandscapeGate({
      mode,
      p1,
      p2,
      p1Name: username,
      p2Name: mode === 'PVE' ? 'Master Shadow' : 'Challenger',
      difficulty: difficulty === 'EASY' ? 'EASY' : 'HARD',
      rounds: 1,
    });
  };

  const handleHome = () => {
    setLastMenuModal(null);
    setPendingPlayerFight(null);
    setShowPreGameFlow(false);
    setShowMintFlow(false);
    setShowLiveFights(false);
    setShowDojoLobby(false);
    setShowTournaments(false);
    setShowAgentArena(false);
    setShowMatchmaking(false);
    setReturnToAgentArenaAfterFight(false);
    setInitialMintChar(null);
    setMatchmakingP1Char(null);
    setWager(null);
  };

  const toggleMute = () => {
    const audio = bgMusicRef.current;
    if (audio) {
      if (audio.muted || isMuted) {
        audio.muted = false;
        audio.play().catch(() => {});
        setIsMuted(false);
      } else {
        audio.muted = true;
        setIsMuted(true);
      }
    } else {
      setIsMuted(!isMuted);
    }
  };

  return (
    <main
      id="shin-mobile-shell"
      className={`${isForceLandscapeActive ? 'mobile-landscape-shell' : 'mobile-hybrid-shell'} relative`}
    >
      {/* Global Mobile Landscape Gate (shows immediately on portrait mobile browsers) */}
      <MobileLandscapeGate
        forceLandscapeCss={isForceLandscapeActive}
        onForceLandscapeCss={() => {
          setOrientationPreference('FORCE_LANDSCAPE');
          applyNativeOrientation('landscape');
        }}
      />

      {/* Loading Screen */}
      {isLoading && <LoadingScreen onComplete={handleLoadComplete} paused={!isLandscapeReady} />}

      {/* Main Menu */}
      {!isLoading &&
        !isGameStarted &&
        !isSpectating &&
        !pendingPlayerFight &&
        !showPreGameFlow &&
        !showMintFlow &&
        !showLiveFights &&
        !showDojoLobby &&
        !showTournaments &&
        !showLeaderboard &&
        !showAgentArena &&
        !showMatchmaking && (
          <MainMenu
            initialModal={lastMenuModal}
            onStart={handleStartMenuClick}
            onWatchLive={(matchData) => {
              if (matchData && matchData.p1 && matchData.p2) {
                launchAgentArenaFight(matchData);
              } else if (matchData) {
                setSpectatingMatch(matchData);
                setIsSpectating(true);
              } else {
                setLastMenuModal('lobby');
                setShowLiveFights(true);
              }
            }}
            onOpenDojoLobby={() => {
              setShowDojoLobby(true);
            }}
            onOpenTournaments={() => {
              setShowTournaments(true);
            }}
            onOpenLeaderboard={() => {
              setShowLeaderboard(true);
            }}
            onOpenColosseum={(tab = 'LIVE_ARENA') => {
              setAgentArenaInitialTab(tab);
              setShowAgentArena(true);
            }}
            onAwakenWarrior={(charId = 'kunoichi') => {
              setInitialMintChar(charId);
              setReturnToAgentArenaAfterFight(true);
              setShowMintFlow(true);
            }}
            isMuted={isMuted}
            onToggleMute={toggleMute}
          />
        )}

      {/* Shadow Colosseum & Champion Barracks */}
      {!isLoading && showAgentArena && !isGameStarted && (
        <AgentArenaFlow
          initialTab={agentArenaInitialTab}
          onWatchAgentFight={(match) => launchAgentArenaFight(match)}
          onMintNewFighter={(charId) => {
            setInitialMintChar(charId);
            setShowAgentArena(false);
            setShowMintFlow(true);
            setReturnToAgentArenaAfterFight(true);
          }}
          onBack={() => setShowAgentArena(false)}
          onHome={handleHome}
        />
      )}

      {/* Awaken New Warrior (Shrine Flow) */}
      {!isLoading && showMintFlow && (
        <MintFighterFlow
          initialSelectedChar={initialMintChar || 'kunoichi'}
          playerName={username}
          onMintComplete={() => {
            setShowMintFlow(false);
            syncFromNearEngine();
            if (returnToAgentArenaAfterFight) {
              setAgentArenaInitialTab('MY_AGENTS');
              setShowAgentArena(true);
            } else {
              setShowPreGameFlow(true);
            }
          }}
          onBack={() => {
            setShowMintFlow(false);
            if (returnToAgentArenaAfterFight) {
              setShowAgentArena(true);
            } else {
              setShowPreGameFlow(true);
            }
          }}
          onHome={handleHome}
        />
      )}

      {/* Pre-Game Flow */}
      {!isLoading && showPreGameFlow && !isGameStarted && !isSpectating && (
        <PreGameFlow
          initialMode={selectedMode}
          onStartFight={handleStartFight}
          onSearchOpponent={(charId, wagerData) => {
            setMatchmakingP1Char(charId);
            setWager(wagerData || null);
            setShowPreGameFlow(false);
            setShowMatchmaking(true);
          }}
          onBack={() => setShowPreGameFlow(false)}
          onHome={handleHome}
          ownedCharacters={ownedChars}
          deployedCharacters={deployedChars}
          playerName={username}
          balances={{
            ...balances,
            SHIN: nearArenaEngine.getState().playerWallet.SHIN ?? 0,
          }}
          onMintNew={(charId) => {
            setInitialMintChar(charId);
            setShowPreGameFlow(false);
            setReturnToAgentArenaAfterFight(false);
            setShowMintFlow(true);
          }}
        />
      )}

      {/* Matchmaking Screen */}
      {!isLoading && showMatchmaking && matchmakingP1Char && (
        <MatchmakingScreen
          playerName={username || 'Player'}
          charType={matchmakingP1Char}
          wager={wager}
          initialRoomCode={matchmakingRoomCode}
          onCancel={() => {
            setShowMatchmaking(false);
            setMatchmakingRoomCode(null);
            setShowPreGameFlow(true);
          }}
          onMatchFound={(matchData) => {
            setShowMatchmaking(false);
            setMatchmakingRoomCode(null);
            startPlayerFightWithLandscapeGate({
              mode: matchData.isAgentFallback ? 'PVE' : 'PVP',
              p1: matchData.p1Type,
              p2: matchData.p2Type,
              p1Name: username,
              p2Name: matchData.p2Name || 'Challenger',
              difficulty: 'HARD',
              rounds: 1,
              isOnlineHost: !!matchData.isHost,
              matchId: matchData.matchId,
              wager,
            });
          }}
        />
      )}

      {/* Pre-Arena Rotate Phone to Landscape Gate (for player-controlled PVE/PVP fights) */}
      {!isLoading && pendingPlayerFight && (
        <div className="fixed inset-0 z-[95] bg-black/95 backdrop-blur-xl flex flex-col items-center justify-center p-6 text-center select-none animate-in fade-in duration-200">
          <div className="max-w-sm w-full bg-gray-950/90 border-2 border-shin-gold rounded-2xl p-6 shadow-[0_0_45px_rgba(251,191,36,0.28)] flex flex-col items-center">
            {/* Animated Rotating Phone Illustration */}
            <div className="relative w-24 h-24 mb-4 flex items-center justify-center">
              <div className="w-12 h-20 rounded-xl border-2 border-shin-gold bg-black/80 flex flex-col items-center justify-between py-2 shadow-[0_0_20px_rgba(251,191,36,0.4)] animate-[spin_2.4s_ease-in-out_infinite]">
                <div className="w-4 h-0.5 rounded-full bg-shin-gold/60" />
                <span className="text-shin-gold text-base">⚔️</span>
                <div className="w-2 h-2 rounded-full border border-shin-gold/70" />
              </div>
            </div>

            <span className="px-2.5 py-0.5 rounded-full bg-shin-red/20 border border-shin-red/40 text-shin-red font-mono text-[10px] uppercase tracking-widest mb-2">
              Combat Controls Ready
            </span>

            <h2 className="text-xl font-cinzel font-black text-white uppercase tracking-wider mb-2">
              Rotate Phone to{' '}
              <span className="text-shin-gold">Landscape</span>
            </h2>

            <p className="text-xs text-gray-300 font-sans leading-relaxed mb-5">
              Turn your phone sideways to collapse the browser bar and unlock full widescreen space for your thumb joystick and combat techniques.
              <span className="block mt-1.5 text-shin-gold font-mono text-[11px]">
                The arena opens automatically as soon as you rotate!
              </span>
            </p>

            <div className="w-full space-y-2.5">
              <button
                onClick={() => {
                  setOrientationPreference('FORCE_LANDSCAPE');
                  applyNativeOrientation('landscape');
                  executeFightStart(pendingPlayerFight);
                }}
                className="w-full py-2.5 px-4 rounded-xl bg-shin-gold/15 hover:bg-shin-gold/25 border border-shin-gold/50 text-shin-gold font-cinzel font-bold text-xs uppercase tracking-wider transition-all cursor-pointer"
              >
                🔄 Orientation Locked? Force Landscape & Enter
              </button>

              <button
                onClick={() => {
                  setPendingPlayerFight(null);
                  setShowPreGameFlow(true);
                }}
                className="w-full py-2 px-4 rounded-xl bg-white/5 hover:bg-white/10 border border-white/10 text-gray-400 hover:text-white font-mono text-[11px] uppercase tracking-wider transition-all cursor-pointer"
              >
                ← Back to Character Select
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Dedicated Dojo Social Messenger & Lobby */}
      {!isLoading && showDojoLobby && (
        <DojoLobbyFlow
          onStartAgreedDuel={(duelConfig) => {
            setShowDojoLobby(false);
            startPlayerFightWithLandscapeGate({
              mode: 'PVE',
              p1: duelConfig.p1Char,
              p2: duelConfig.p2Char,
              p1Name: username,
              p2Name: duelConfig.p2Name,
              difficulty: 'HARD',
              rounds: 1,
              wager:
                duelConfig.wagerNear > 0
                  ? { token: 'SHIN', amount: Math.round(duelConfig.wagerNear * 1000) }
                  : null,
            });
          }}
          onJoinRoomCode={(code, wagerNear) => {
            setShowDojoLobby(false);
            setMatchmakingP1Char((ownedChars[0] as CharacterId) || 'fighter');
            setWager(
              wagerNear > 0
                ? { token: 'SHIN', amount: Math.round(wagerNear * 1000) }
                : null,
            );
            setMatchmakingRoomCode(code);
            setShowMatchmaking(true);
          }}
          onBack={() => setShowDojoLobby(false)}
          onHome={handleHome}
        />
      )}

      {/* Global Tournament Bracket Ready Notification */}
      {!isLoading && tourneyAlert && !showTournaments && !showMatchmaking && !isGameStarted && (
        <div className="fixed top-4 left-1/2 -translate-x-1/2 z-[90] max-w-lg w-[92%] bg-gray-950/95 border-2 border-shin-gold rounded-2xl px-4 py-3 shadow-[0_0_30px_rgba(251,191,36,0.4)] flex items-center justify-between gap-3">
          <div className="flex items-center gap-2.5 min-w-0">
            <Trophy size={18} className="text-shin-gold shrink-0" />
            <div className="min-w-0">
              <div className="text-xs font-cinzel font-black text-shin-gold uppercase truncate">
                {tourneyAlert.title} — {tourneyAlert.matchLabel} Ready!
              </div>
              <div className="text-[11px] font-mono text-gray-200 truncate">
                Paired vs <strong className="text-white">{tourneyAlert.opponentName}</strong>
              </div>
            </div>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <button
              onClick={() => {
                setTourneyAlert(null);
                setShowTournaments(true);
              }}
              className="px-3 py-1.5 bg-shin-gold text-black font-cinzel font-black text-[10px] uppercase rounded-lg cursor-pointer"
            >
              Wait Room
            </button>
            <button
              onClick={() => setTourneyAlert(null)}
              className="text-gray-400 hover:text-white text-xs px-1.5 py-1 cursor-pointer"
            >
              ✕
            </button>
          </div>
        </div>
      )}

      {/* Dedicated Humans-Only & Continuous Agent-Only Tournaments Flow */}
      {!isLoading && showTournaments && (
        <TournamentsFlow
          ownedCharacters={ownedChars}
          onStartTournamentDuel={(duelConfig) => {
            activeTournamentBoutRef.current = {
              matchId: duelConfig.matchId,
              p1AccountId: duelConfig.p1AccountId,
              p2AccountId: duelConfig.p2AccountId,
            };
            setTourneyAlert(null);
            setShowTournaments(false);
            if (duelConfig.roomCode) {
              setWager({ token: 'SHIN', amount: duelConfig.wagerShin });
              setMatchmakingP1Char(duelConfig.p1Char as CharacterId);
              setMatchmakingRoomCode(duelConfig.roomCode);
              setShowMatchmaking(true);
            } else {
              startPlayerFightWithLandscapeGate({
                mode: 'PVE',
                p1: duelConfig.p1Char,
                p2: duelConfig.p2Char,
                p1Name: username,
                p2Name: duelConfig.p2Name,
                difficulty: 'HARD',
                rounds: 1,
                wager: { token: 'SHIN', amount: duelConfig.wagerShin },
                isTournamentBout: duelConfig.isTournamentBout,
              });
            }
          }}
          onBack={() => setShowTournaments(false)}
          onHome={handleHome}
        />
      )}

      {/* Real-Time Agents & Humans Leaderboards */}
      {!isLoading && showLeaderboard && (
        <LeaderboardFlow
          onBack={() => setShowLeaderboard(false)}
          onHome={() => {
            setShowLeaderboard(false);
            handleHome();
          }}
        />
      )}

      {/* Live Fights Flow (Spectate TV) */}
      {!isLoading && showLiveFights && (
        <LiveFightsFlow
          onWatchMatch={(matchData: any) => {
            setShowLiveFights(false);
            if (matchData && matchData.p1 && matchData.p2 && !matchData.isServerBroadcast) {
              launchAgentArenaFight(matchData);
            } else {
              setSpectatingMatch(matchData);
              setIsSpectating(true);
            }
          }}
          onBack={() => setShowLiveFights(false)}
          onHome={handleHome}
        />
      )}

      {/* Game Canvas */}
      <div
        className={`absolute inset-0 transition-opacity duration-700 ${
          isGameStarted ? 'opacity-100 z-10' : 'opacity-0 pointer-events-none -z-10'
        }`}
      >
        <GameCanvasWrapper />
      </div>

      {/* Spectator Game Canvas */}
      <div
        className={`absolute inset-0 transition-opacity duration-700 ${
          isSpectating ? 'opacity-100 z-20' : 'opacity-0 pointer-events-none -z-20'
        }`}
      >
        {isSpectating && spectatingMatch && (
          <SpectatorGameCanvasWrapper matchData={spectatingMatch} />
        )}

        {isSpectating && (
          <button
            onClick={() => {
              setIsSpectating(false);
              setSpectatingMatch(null);
              setShowLiveFights(true);
            }}
            className="absolute z-50 text-white/50 hover:text-white text-xs uppercase tracking-widest border border-white/10 px-3 py-1 bg-black/50 backdrop-blur-sm"
            style={{
              top: 'env(safe-area-inset-top, 0px)',
              left: 'max(1rem, env(safe-area-inset-left))',
            }}
          >
            Leave Broadcast
          </button>
        )}
      </div>

      {/* Global Quick Mute / Unmute Speaker Button across all sub-pages */}
      {!isLoading &&
        (showAgentArena ||
          showDojoLobby ||
          showTournaments ||
          showLeaderboard ||
          showLiveFights ||
          showPreGameFlow ||
          showMintFlow ||
          showMatchmaking ||
          isGameStarted ||
          isSpectating) && (
          <button
            onClick={toggleMute}
            className={`fixed bottom-4 right-4 z-[95] p-2.5 rounded-full border backdrop-blur-md shadow-lg transition-all cursor-pointer ${
              isMuted
                ? 'bg-red-950/80 border-shin-red/60 text-shin-red hover:bg-red-900/90'
                : 'bg-black/80 border-white/20 text-gray-200 hover:border-shin-gold hover:text-shin-gold'
            }`}
            title={isMuted ? 'Unmute Audio' : 'Mute Audio'}
            aria-label={isMuted ? 'Unmute Audio' : 'Mute Audio'}
          >
            {isMuted ? <VolumeX size={18} /> : <Volume2 size={18} />}
          </button>
        )}

      {/* Website Background Music */}
      {!isGameStarted && !isSpectating && (
        <audio
          ref={bgMusicRef}
          src="/assets/sounds/website_bgm.wav"
          loop
          muted={isMuted}
          autoPlay
        />
      )}
    </main>
  );
}
