'use client';

import { useState, useRef, useEffect } from 'react';
import GameCanvasWrapper from './components/GameCanvasWrapper';
import LoadingScreen from './components/LoadingScreen';
import MainMenu from './components/MainMenu';
import PreGameFlow, { GameMode, CharacterId } from './components/PreGameFlow';
import MintFighterFlow from './components/MintFighterFlow';
import LiveFightsFlow from './components/LiveFightsFlow';
import SpectatorGameCanvasWrapper from './components/SpectatorGameCanvasWrapper';
import MatchmakingScreen from './components/MatchmakingScreen';
import AgentArenaFlow from './components/AgentArenaFlow';
import { nearArenaEngine, ActiveArenaMatch } from './services/nearArenaEngine';

export default function Home() {
  const [isLoading, setIsLoading] = useState(true);
  const [isGameStarted, setIsGameStarted] = useState(false);
  const [isSpectating, setIsSpectating] = useState(false);
  const [showPreGameFlow, setShowPreGameFlow] = useState(false);
  const [showMintFlow, setShowMintFlow] = useState(false);
  const [showLiveFights, setShowLiveFights] = useState(false);
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
  const [balances, setBalances] = useState({ NEAR: 25, USDC: 100, USDT: 50 });
  const [orientationPreference, setOrientationPreference] = useState<
    'AUTO_HYBRID' | 'FORCE_LANDSCAPE' | 'FORCE_PORTRAIT'
  >('AUTO_HYBRID');

  const isInCombatOrSpectating = isGameStarted || isSpectating;
  const isForceLandscapeActive =
    orientationPreference === 'FORCE_LANDSCAPE' ||
    (orientationPreference === 'AUTO_HYBRID' && isInCombatOrSpectating);

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
    // Notify Phaser canvases to recalculate dimensions after CSS rotation settles
    const t = setTimeout(() => window.dispatchEvent(new Event('resize')), 60);
    return () => clearTimeout(t);
  }, [isForceLandscapeActive, orientationPreference]);

  const handleToggleMobileOrientation = () => {
    const nextIsLandscape = !isForceLandscapeActive;
    if (nextIsLandscape) {
      setOrientationPreference('FORCE_LANDSCAPE');
      applyNativeOrientation('landscape');
    } else {
      setOrientationPreference('FORCE_PORTRAIT');
      applyNativeOrientation('portrait');
    }
  };

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

    return () => {
      window.removeEventListener('leaveSpectator', handleLeaveSpectator);
      window.removeEventListener('exitMatch', handleExitMatch);
      window.removeEventListener('rematch', handleRematch);
      window.removeEventListener('nextAgentMatch', handleNextAgentMatch);
    };
  }, [returnToAgentArenaAfterFight]);

  const handleStartMenuClick = (userData: any, mode: 'PVE' | 'PVP') => {
    setUser(userData);
    const name = userData?.username || userData?.userName || 'Warrior';
    setUsername(name);
    nearArenaEngine.syncUsername(name);
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
    setIsGameStarted(true);
    window.dispatchEvent(
      new CustomEvent('startGameScene', {
        detail: {
          mode,
          p1,
          p2,
          p1Name: username,
          p2Name: mode === 'PVE' ? 'Master Shadow' : 'Challenger',
          difficulty: difficulty === 'EASY' ? 'EASY' : 'HARD',
          rounds: 1,
        },
      }),
    );
  };

  const handleHome = () => {
    setLastMenuModal(null);
    setShowPreGameFlow(false);
    setShowMintFlow(false);
    setShowLiveFights(false);
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
      {/* Floating Mobile Orientation Toggle Pill (visible on screens <= 900px) */}
      {!isLoading && (
        <div
          className="fixed z-[90] flex items-center gap-1 lg:hidden"
          style={{
            bottom: 'max(0.5rem, env(safe-area-inset-bottom, 0px))',
            left: '50%',
            transform: 'translateX(-50%)',
          }}
        >
          <button
            onClick={handleToggleMobileOrientation}
            className="px-3 py-1 rounded-full bg-black/85 border border-shin-gold/50 text-shin-gold text-[10px] font-mono uppercase tracking-widest shadow-[0_0_15px_rgba(0,0,0,0.9)] backdrop-blur-md flex items-center gap-1.5 active:scale-95 transition-all cursor-pointer"
            title="Switch between Widescreen Landscape and Portrait on mobile"
          >
            <span>🔄</span>
            <span>{isForceLandscapeActive ? 'Switch to Portrait' : 'Rotate to Landscape'}</span>
          </button>
          {orientationPreference !== 'AUTO_HYBRID' && (
            <button
              onClick={() => setOrientationPreference('AUTO_HYBRID')}
              className="px-2 py-1 rounded-full bg-gray-900/90 border border-white/20 text-gray-300 text-[9px] font-mono uppercase tracking-wider cursor-pointer"
              title="Reset to Smart Hybrid (Portrait Menus + Auto-Landscape Fights)"
            >
              Auto
            </button>
          )}
        </div>
      )}

      {/* Loading Screen */}
      {isLoading && <LoadingScreen onComplete={handleLoadComplete} />}

      {/* Main Menu */}
      {!isLoading &&
        !isGameStarted &&
        !isSpectating &&
        !showPreGameFlow &&
        !showMintFlow &&
        !showLiveFights &&
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
          playerName={username}
          balances={balances}
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
          onCancel={() => {
            setShowMatchmaking(false);
            setShowPreGameFlow(true);
          }}
          onMatchFound={(matchData) => {
            setShowMatchmaking(false);
            setIsGameStarted(true);
            window.dispatchEvent(
              new CustomEvent('startGameScene', {
                detail: {
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
                },
              }),
            );
          }}
        />
      )}

      {/* Live Fights Flow */}
      {!isLoading && showLiveFights && (
        <LiveFightsFlow
          onWatchMatch={(matchData: any) => {
            setShowLiveFights(false);
            if (matchData && matchData.p1 && matchData.p2) {
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
