'use client';

import { useEffect, useRef, useState } from 'react';
import { nearArenaEngine, ActiveArenaMatch } from '../services/nearArenaEngine';
import { Coins, Zap, Shield, Trophy, Swords, Flame, Terminal } from 'lucide-react';

const ControlsOverlay = ({
    isSpectator = false,
}: {
    isSpectator?: boolean;
    isInteractiveClient?: boolean;
}) => {
    const joystickRef = useRef<HTMLDivElement>(null);
    const [joystickActive, setJoystickActive] = useState(false);
    const [joystickPos, setJoystickPos] = useState({ x: 0, y: 0 });
    const joyStartPos = useRef({ x: 0, y: 0 });

    // Health & Spirit State
    const [p1Health, setP1Health] = useState({ hp: 300, maxHp: 300 });
    const [p2Health, setP2Health] = useState({ hp: 300, maxHp: 300 });
    const [p1Spirit, setP1Spirit] = useState({ spirit: 40, maxSpirit: 100 });
    const [p2Spirit, setP2Spirit] = useState({ spirit: 40, maxSpirit: 100 });

    // Combo Callout State
    const [p1Combo, setP1Combo] = useState<{ count: number; damage: number; isSpecial: boolean; key: number } | null>(null);
    const [p2Combo, setP2Combo] = useState<{ count: number; damage: number; isSpecial: boolean; key: number } | null>(null);
    const [centerBanner, setCenterBanner] = useState<string | null>(null);

    const [isPaused, setIsPaused] = useState(false);
    const [matchTime, setMatchTime] = useState(90);

    const [p1Name, setP1Name] = useState('Player 1');
    const [p2Name, setP2Name] = useState('Player 2');
    const [matchMode, setMatchMode] = useState<'PVP' | 'PVE' | 'AGENT_ARENA'>('PVP');
    const [activeMatchId, setActiveMatchId] = useState<string | null>(null);
    const [arenaMatch, setArenaMatch] = useState<ActiveArenaMatch | null>(null);
    const [betAmount, setBetAmount] = useState<number>(1.0);
    const [betFeedback, setBetFeedback] = useState<string | null>(null);
    const [walletNear, setWalletNear] = useState<number>(25.0);
    const [showTechDetails, setShowTechDetails] = useState(false);
    const [settlementReport, setSettlementReport] = useState<{
        fighterPotWonNear: number;
        spectatorPayoutNear: number;
        winnerWallet: string;
        newPowerLevel: number;
    } | null>(null);

    const [gameOver, setGameOver] = useState<{
        winner: string;
        winnerId: 'p1' | 'p2' | 'draw';
        roundsScore?: string;
        duration?: string;
        p1Stats: any;
        p2Stats: any;
    } | null>(null);

    const [isTouchDevice, setIsTouchDevice] = useState(false);

    const refreshArenaState = (mId?: string | null) => {
        const st = nearArenaEngine.getState();
        setWalletNear(st.playerWallet.NEAR);
        const targetId = mId ?? activeMatchId;
        if (targetId) {
            const found = st.activeMatches.find((m) => m.matchId === targetId);
            if (found) setArenaMatch({ ...found });
        } else if (st.activeMatches.length > 0) {
            setArenaMatch({ ...st.activeMatches[0] });
        }
    };

    useEffect(() => {
        refreshArenaState();
        const checkTouch = () => {
            setIsTouchDevice(
                'ontouchstart' in window ||
                    navigator.maxTouchPoints > 0 ||
                    window.matchMedia('(pointer: coarse)').matches,
            );
        };
        checkTouch();
        window.addEventListener('resize', checkTouch);

        const handleHealthChange = (e: any) => {
            const { playerId, hp, maxHp } = e.detail;
            if (playerId === 'local_player') {
                setP1Health({ hp, maxHp });
            } else if (playerId === 'remote_player') {
                setP2Health({ hp, maxHp });
            }
        };

        const handleSpiritChange = (e: any) => {
            const { playerId, spirit, maxSpirit } = e.detail;
            if (playerId === 'local_player') {
                setP1Spirit({ spirit, maxSpirit });
            } else if (playerId === 'remote_player') {
                setP2Spirit({ spirit, maxSpirit });
            }
        };

        const handleComboHit = (e: any) => {
            const { side, count, damage, isSpecial } = e.detail;
            if (count >= 2 || isSpecial) {
                if (side === 'p1') {
                    setP1Combo({ count, damage, isSpecial, key: Date.now() });
                } else {
                    setP2Combo({ count, damage, isSpecial, key: Date.now() });
                }
            }
        };

        const handleRoundStarted = () => {
            setCenterBanner('FIGHT!');
            setTimeout(() => setCenterBanner(null), 1100);
        };

        const handleRoundEnded = () => {
            setCenterBanner('K.O.!');
            setTimeout(() => setCenterBanner(null), 1300);
        };

        const handleGameOver = (e: any) => {
            const detail = e.detail;
            setGameOver(detail);
            if (detail.winnerId === 'p1' || detail.winnerId === 'p2') {
                const settled = nearArenaEngine.settleMatch(
                    detail.matchId || activeMatchId || '',
                    detail.winnerId,
                );
                const winningFighter =
                    detail.winnerId === 'p1' ? settled.match.p1 : settled.match.p2;
                setSettlementReport({
                    fighterPotWonNear: settled.fighterPotWonNear,
                    spectatorPayoutNear: settled.spectatorPayoutNear,
                    winnerWallet: winningFighter.agentWalletId,
                    newPowerLevel: winningFighter.powerLevel,
                });
                refreshArenaState(detail.matchId);
            }
        };

        const handleTimerUpdate = (e: any) => {
            setMatchTime(e.detail.time);
        };

        const handleMatchStarted = (e: any) => {
            if (e.detail.p1Name) setP1Name(e.detail.p1Name);
            if (e.detail.p2Name) setP2Name(e.detail.p2Name);
            if (e.detail.mode) setMatchMode(e.detail.mode);
            if (e.detail.matchId) {
                setActiveMatchId(e.detail.matchId);
                refreshArenaState(e.detail.matchId);
            } else {
                refreshArenaState();
            }

            setGameOver(null);
            setSettlementReport(null);
            setP1Health({ hp: 300, maxHp: 300 });
            setP2Health({ hp: 300, maxHp: 300 });
            setP1Spirit({ spirit: 40, maxSpirit: 100 });
            setP2Spirit({ spirit: 40, maxSpirit: 100 });
            setP1Combo(null);
            setP2Combo(null);
            setMatchTime(e.detail.mode === 'AGENT_ARENA' ? 90 : 180);
            setIsPaused(false);
        };

        const handleArenaStateUpdated = () => refreshArenaState();

        window.addEventListener('playerHealthChanged', handleHealthChange);
        window.addEventListener('playerSpiritChanged', handleSpiritChange);
        window.addEventListener('comboHit', handleComboHit);
        window.addEventListener('roundStarted', handleRoundStarted);
        window.addEventListener('roundEnded', handleRoundEnded);
        window.addEventListener('gameOver', handleGameOver);
        window.addEventListener('timerUpdate', handleTimerUpdate);
        window.addEventListener('matchStarted', handleMatchStarted);
        window.addEventListener('nearArenaStateUpdated', handleArenaStateUpdated);

        return () => {
            window.removeEventListener('resize', checkTouch);
            window.removeEventListener('playerHealthChanged', handleHealthChange);
            window.removeEventListener('playerSpiritChanged', handleSpiritChange);
            window.removeEventListener('comboHit', handleComboHit);
            window.removeEventListener('roundStarted', handleRoundStarted);
            window.removeEventListener('roundEnded', handleRoundEnded);
            window.removeEventListener('gameOver', handleGameOver);
            window.removeEventListener('timerUpdate', handleTimerUpdate);
            window.removeEventListener('matchStarted', handleMatchStarted);
            window.removeEventListener('nearArenaStateUpdated', handleArenaStateUpdated);
        };
    }, [activeMatchId]);

    useEffect(() => {
        if (!p1Combo) return;
        const t = setTimeout(() => setP1Combo(null), 1500);
        return () => clearTimeout(t);
    }, [p1Combo]);

    useEffect(() => {
        if (!p2Combo) return;
        const t = setTimeout(() => setP2Combo(null), 1500);
        return () => clearTimeout(t);
    }, [p2Combo]);

    // Touch Handlers for Joystick
    const handleTouchStart = (e: React.TouchEvent) => {
        const touch = e.touches[0];
        joyStartPos.current = { x: touch.clientX, y: touch.clientY };
        setJoystickActive(true);
        setJoystickPos({ x: 0, y: 0 });
    };

    const handleTouchMove = (e: React.TouchEvent) => {
        if (!joystickActive) return;
        const touch = e.touches[0];
        const dx = touch.clientX - joyStartPos.current.x;
        const dy = touch.clientY - joyStartPos.current.y;
        const radius = 30;
        const distance = Math.min(Math.sqrt(dx * dx + dy * dy), radius);
        const angle = Math.atan2(dy, dx);
        const clampedX = Math.cos(angle) * distance;
        const clampedY = Math.sin(angle) * distance;

        setJoystickPos({ x: clampedX, y: clampedY });

        const input = { left: false, right: false, up: false, down: false };
        if (clampedX < -15) input.left = true;
        if (clampedX > 15) input.right = true;
        if (clampedY < -15) input.up = true;
        if (clampedY > 15) input.down = true;

        window.dispatchEvent(new CustomEvent('joystickInput', { detail: input }));
    };

    const handleTouchEnd = () => {
        setJoystickActive(false);
        setJoystickPos({ x: 0, y: 0 });
        window.dispatchEvent(
            new CustomEvent('joystickInput', {
                detail: { left: false, right: false, up: false, down: false },
            }),
        );
    };

    const handleQuickSpectatorBet = (side: 'p1' | 'p2') => {
        if (!arenaMatch) return;
        try {
            const updated = nearArenaEngine.placeSpectatorBet(
                arenaMatch.matchId,
                side,
                betAmount,
            );
            setArenaMatch({ ...updated });
            setWalletNear(nearArenaEngine.getState().playerWallet.NEAR);
            const chosenName = side === 'p1' ? p1Name : p2Name;
            setBetFeedback(`🔥 Tossed ${betAmount} NEAR on ${chosenName}!`);
            setTimeout(() => setBetFeedback(null), 2600);
        } catch (err: any) {
            setBetFeedback(err.message || 'Bet failed');
            setTimeout(() => setBetFeedback(null), 3000);
        }
    };

    const isAgentOrSpectator = matchMode === 'AGENT_ARENA' || isSpectator;
    const p1SpecPool = arenaMatch?.spectatorPoolP1Near ?? 3.5;
    const p2SpecPool = arenaMatch?.spectatorPoolP2Near ?? 3.0;
    const totalSpecPool = p1SpecPool + p2SpecPool;
    const p1Odds = p1SpecPool > 0 ? ((totalSpecPool * 0.95) / p1SpecPool).toFixed(2) : '1.90';
    const p2Odds = p2SpecPool > 0 ? ((totalSpecPool * 0.95) / p2SpecPool).toFixed(2) : '1.90';

    const p1HpPct = Math.max(0, (p1Health.hp / p1Health.maxHp) * 100);
    const p2HpPct = Math.max(0, (p2Health.hp / p2Health.maxHp) * 100);
    const p1SpiritPct = Math.max(0, (p1Spirit.spirit / p1Spirit.maxSpirit) * 100);
    const p2SpiritPct = Math.max(0, (p2Spirit.spirit / p2Spirit.maxSpirit) * 100);

    return (
        <div className="absolute inset-0 pointer-events-none select-none overflow-hidden">
            {/* =================================================================
                TOP ARCADE FIGHTING HUD (Lifebars, Spirit Meters, Center Timer)
               ================================================================= */}
            <div
                className="absolute w-full flex justify-between items-start pointer-events-none z-30"
                style={{
                    top: 'max(0.75rem, env(safe-area-inset-top, 0px))',
                    paddingLeft: 'max(1rem, env(safe-area-inset-left))',
                    paddingRight: 'max(1rem, env(safe-area-inset-right))',
                }}
            >
                {/* FIGHTER 1 (LEFT CORNER) */}
                <div className="w-[41%] max-w-md flex flex-col items-start">
                    <div className="flex items-center gap-2 mb-1">
                        <span className="px-2 py-0.5 rounded bg-shin-gold text-black font-cinzel font-black text-[10px] uppercase">
                            {arenaMatch ? `LV.${arenaMatch.p1.powerLevel}` : 'P1'}
                        </span>
                        <span className="text-white font-cinzel font-black text-xs md:text-base tracking-wider uppercase drop-shadow-[0_2px_4px_rgba(0,0,0,0.9)] truncate">
                            {p1Name}
                        </span>
                    </div>

                    {/* Skewed Lifebar */}
                    <div className="w-full h-5 md:h-6 bg-black/85 border-2 border-shin-gold/70 arcade-skew p-0.5 shadow-[0_0_20px_rgba(0,0,0,0.8)] relative overflow-hidden">
                        <div
                            className="h-full bg-gradient-to-r from-red-600 via-amber-400 to-emerald-400 transition-all duration-150"
                            style={{ width: `${p1HpPct}%` }}
                        />
                    </div>

                    {/* Spirit Meter Bar */}
                    <div className="w-3/4 h-2.5 bg-black/80 border border-white/20 arcade-skew mt-1 overflow-hidden flex items-center">
                        <div
                            className={`h-full transition-all duration-150 ${
                                p1Spirit.spirit >= 50
                                    ? 'bg-gradient-to-r from-shin-gold via-yellow-300 to-white shadow-[0_0_12px_rgba(251,191,36,0.9)]'
                                    : 'bg-blue-500/80'
                            }`}
                            style={{ width: `${p1SpiritPct}%` }}
                        />
                    </div>
                    {!isAgentOrSpectator && p1Spirit.spirit >= 50 && (
                        <button
                            onClick={() =>
                                window.dispatchEvent(
                                    new CustomEvent('playerAction', { detail: { action: 'special' } }),
                                )
                            }
                            className="mt-1 pointer-events-auto px-2.5 py-0.5 rounded bg-shin-gold text-black font-cinzel font-black text-[10px] tracking-widest uppercase animate-pulse shadow-[0_0_15px_rgba(251,191,36,0.8)] cursor-pointer"
                        >
                            ⚡ SPIRIT STRIKE READY [PRESS X]
                        </button>
                    )}
                </div>

                {/* CENTER CLOCK & FIGHT POT */}
                <div className="flex flex-col items-center pointer-events-auto mx-2">
                    {isAgentOrSpectator && (
                        <div className="mb-1 px-3 py-0.5 bg-shin-gold/20 border border-shin-gold/60 rounded-full text-[10px] text-shin-gold font-cinzel font-black tracking-widest uppercase flex items-center gap-1.5 shadow-[0_0_15px_rgba(251,191,36,0.3)]">
                            <Flame size={12} />
                            <span>FIGHT POT: {(arenaMatch?.fighterPoolNear ?? 4.0).toFixed(1)} NEAR</span>
                        </div>
                    )}
                    <div className="bg-gradient-to-b from-gray-900 to-black border-2 border-shin-gold px-4 py-1 rounded-xl shadow-[0_0_25px_rgba(0,0,0,0.9)]">
                        <span className="font-cinzel font-black text-2xl md:text-4xl text-white tracking-wider">
                            {matchTime}
                        </span>
                    </div>
                    {!isAgentOrSpectator && !gameOver && (
                        <button
                            onClick={() => {
                                const newPausedState = !isPaused;
                                setIsPaused(newPausedState);
                                window.dispatchEvent(
                                    new CustomEvent('togglePause', {
                                        detail: { isPaused: newPausedState },
                                    }),
                                );
                            }}
                            className="mt-1 px-2.5 py-0.5 bg-black/80 border border-white/20 rounded text-[9px] font-cinzel text-gray-300 hover:text-white hover:border-shin-gold uppercase tracking-widest cursor-pointer"
                        >
                            {isPaused ? 'RESUME' : 'PAUSE'}
                        </button>
                    )}
                </div>

                {/* FIGHTER 2 (RIGHT CORNER) */}
                <div className="w-[41%] max-w-md flex flex-col items-end">
                    <div className="flex items-center gap-2 mb-1">
                        <span className="text-white font-cinzel font-black text-xs md:text-base tracking-wider uppercase drop-shadow-[0_2px_4px_rgba(0,0,0,0.9)] truncate">
                            {p2Name}
                        </span>
                        <span className="px-2 py-0.5 rounded bg-shin-red text-white font-cinzel font-black text-[10px] uppercase">
                            {arenaMatch ? `LV.${arenaMatch.p2.powerLevel}` : 'P2'}
                        </span>
                    </div>

                    {/* Skewed Lifebar */}
                    <div className="w-full h-5 md:h-6 bg-black/85 border-2 border-shin-red/70 arcade-skew-right p-0.5 shadow-[0_0_20px_rgba(0,0,0,0.8)] flex justify-end overflow-hidden">
                        <div
                            className="h-full bg-gradient-to-l from-red-600 via-orange-500 to-amber-400 transition-all duration-150"
                            style={{ width: `${p2HpPct}%` }}
                        />
                    </div>

                    {/* Spirit Meter Bar */}
                    <div className="w-3/4 h-2.5 bg-black/80 border border-white/20 arcade-skew-right mt-1 overflow-hidden flex justify-end items-center">
                        <div
                            className={`h-full transition-all duration-150 ${
                                p2Spirit.spirit >= 50
                                    ? 'bg-gradient-to-l from-shin-gold via-yellow-300 to-white shadow-[0_0_12px_rgba(251,191,36,0.9)]'
                                    : 'bg-blue-500/80'
                            }`}
                            style={{ width: `${p2SpiritPct}%` }}
                        />
                    </div>
                </div>
            </div>

            {/* =================================================================
                ARCADE COMBO CALLOUTS & CENTER ANNOUNCER (`FIGHT!`, `K.O.!`)
               ================================================================= */}
            {p1Combo && (
                <div
                    key={p1Combo.key}
                    className="absolute left-6 top-28 md:top-32 z-30 animate-combo-pop pointer-events-none"
                >
                    <div className="arcade-skew bg-gradient-to-r from-shin-gold via-amber-500 to-transparent px-4 py-1.5 border-l-4 border-white shadow-[0_0_25px_rgba(251,191,36,0.6)]">
                        <div className="arcade-unskew font-cinzel font-black text-xl md:text-3xl text-black tracking-wider uppercase">
                            {p1Combo.isSpecial ? '⚡ SPIRIT STRIKE!' : `${p1Combo.count} HIT COMBO!`}
                        </div>
                    </div>
                </div>
            )}

            {p2Combo && (
                <div
                    key={p2Combo.key}
                    className="absolute right-6 top-28 md:top-32 z-30 animate-combo-pop pointer-events-none text-right"
                >
                    <div className="arcade-skew-right bg-gradient-to-l from-shin-red via-red-600 to-transparent px-4 py-1.5 border-r-4 border-white shadow-[0_0_25px_rgba(255,42,42,0.6)]">
                        <div className="arcade-unskew-right font-cinzel font-black text-xl md:text-3xl text-white tracking-wider uppercase">
                            {p2Combo.isSpecial ? '⚡ SPIRIT STRIKE!' : `${p2Combo.count} HIT COMBO!`}
                        </div>
                    </div>
                </div>
            )}

            {centerBanner && !gameOver && (
                <div className="absolute inset-0 flex items-center justify-center z-40 pointer-events-none">
                    <div className="animate-combo-pop text-6xl md:text-8xl font-cinzel font-black text-shin-gold tracking-[0.2em] uppercase glow-gold drop-shadow-[0_6px_25px_rgba(0,0,0,1)]">
                        {centerBanner}
                    </div>
                </div>
            )}

            {/* =================================================================
                MOBILE TOUCH CONTROLS (With Glowing ⚡ SPIRIT Button)
               ================================================================= */}
            {isTouchDevice && !isAgentOrSpectator && (
                <div
                    className="touch-controls absolute w-24 h-24 bg-white/10 rounded-full backdrop-blur-sm pointer-events-auto touch-none flex items-center justify-center border-2 border-white/20"
                    style={{
                        bottom: 'max(1.5rem, env(safe-area-inset-bottom))',
                        left: 'max(1.5rem, env(safe-area-inset-left))',
                    }}
                    onTouchStart={handleTouchStart}
                    onTouchMove={handleTouchMove}
                    onTouchEnd={handleTouchEnd}
                    onTouchCancel={handleTouchEnd}
                    ref={joystickRef}
                >
                    <div
                        className="w-12 h-12 bg-white/50 rounded-full shadow-lg transform transition-transform duration-75"
                        style={{ transform: `translate(${joystickPos.x}px, ${joystickPos.y}px)` }}
                    />
                </div>
            )}

            {isTouchDevice && !isAgentOrSpectator && (
                <div
                    className="touch-controls absolute pointer-events-auto select-none"
                    style={{
                        bottom: 'max(1.5rem, env(safe-area-inset-bottom))',
                        right: 'max(1.5rem, env(safe-area-inset-right))',
                        width: '190px',
                        height: '130px',
                    }}
                >
                    {/* Shield Block Button */}
                    <button
                        className="absolute bottom-0 left-0 w-[64px] h-[64px] rounded-full bg-emerald-500/25 text-emerald-400 border-2 border-emerald-500/60 active:scale-95 flex items-center justify-center backdrop-blur-sm"
                        onTouchStart={() =>
                            window.dispatchEvent(
                                new CustomEvent('playerAction', { detail: { action: 'block_start' } }),
                            )
                        }
                        onTouchEnd={() =>
                            window.dispatchEvent(
                                new CustomEvent('playerAction', { detail: { action: 'block_end' } }),
                            )
                        }
                        onTouchCancel={() =>
                            window.dispatchEvent(
                                new CustomEvent('playerAction', { detail: { action: 'block_end' } }),
                            )
                        }
                    >
                        <Shield size={28} />
                    </button>

                    {/* Spirit Dash-Strike Button */}
                    <button
                        className={`absolute top-0 left-6 w-[60px] h-[60px] rounded-full border-2 active:scale-95 flex items-center justify-center backdrop-blur-sm transition-all ${
                            p1Spirit.spirit >= 50
                                ? 'bg-shin-gold text-black border-white shadow-[0_0_20px_rgba(251,191,36,0.9)] animate-pulse'
                                : 'bg-white/10 text-gray-500 border-white/20'
                        }`}
                        onTouchStart={() =>
                            window.dispatchEvent(
                                new CustomEvent('playerAction', { detail: { action: 'special' } }),
                            )
                        }
                    >
                        <Zap size={26} />
                    </button>

                    {/* Attack Combo Button */}
                    <button
                        className="absolute bottom-2 right-0 w-[74px] h-[74px] rounded-full bg-shin-red/30 text-red-400 border-2 border-shin-red active:scale-95 flex items-center justify-center backdrop-blur-sm shadow-[0_0_20px_rgba(255,42,42,0.5)]"
                        onTouchStart={() =>
                            window.dispatchEvent(
                                new CustomEvent('playerAction', { detail: { action: 'attack' } }),
                            )
                        }
                    >
                        <Swords size={32} />
                    </button>
                </div>
            )}

            {/* =================================================================
                CROWD POT BACKING BAR (Bottom Dock during Colosseum / Spectating)
               ================================================================= */}
            {isAgentOrSpectator && !gameOver && (
                <div className="absolute bottom-3 left-1/2 -translate-x-1/2 w-[96%] max-w-4xl bg-black/90 border-2 border-shin-gold/40 rounded-2xl px-4 py-3 pointer-events-auto backdrop-blur-md shadow-[0_0_30px_rgba(0,0,0,0.95)] z-40">
                    {betFeedback && (
                        <div className="text-center text-xs font-cinzel font-bold text-shin-gold bg-shin-gold/15 border border-shin-gold/40 py-1 px-3 rounded-lg mb-2 animate-pulse">
                            {betFeedback}
                        </div>
                    )}
                    <div className="flex flex-col md:flex-row items-center justify-between gap-3">
                        {/* Back Left Corner */}
                        <button
                            onClick={() => handleQuickSpectatorBet('p1')}
                            className="w-full md:w-auto flex-1 arcade-skew bg-gradient-to-r from-amber-950/90 to-black hover:from-amber-800 border-l-4 border-y border-r border-l-shin-gold border-white/20 px-4 py-2.5 flex items-center justify-between transition-all cursor-pointer group"
                        >
                            <div className="arcade-unskew text-left">
                                <div className="text-[10px] text-shin-gold font-cinzel font-black uppercase tracking-wider">
                                    BACK {p1Name.slice(0, 14)}
                                </div>
                                <div className="text-xs text-white font-mono">
                                    Pot: {p1SpecPool.toFixed(1)} NEAR ({p1Odds}x Payout)
                                </div>
                            </div>
                            <span className="arcade-unskew bg-shin-gold text-black font-cinzel font-black text-xs px-3 py-1 rounded group-hover:scale-105 transition-transform">
                                +{betAmount} NEAR
                            </span>
                        </button>

                        {/* Center Chip Selector */}
                        <div className="flex flex-col items-center px-2 shrink-0">
                            <div className="text-[10px] text-gray-300 font-cinzel uppercase tracking-widest mb-1">
                                Crowd Backing (<span className="text-shin-gold font-mono">{walletNear.toFixed(1)} NEAR</span>)
                            </div>
                            <div className="flex items-center gap-1.5">
                                {[0.5, 1, 2, 5].map((amt) => (
                                    <button
                                        key={amt}
                                        onClick={() => setBetAmount(amt)}
                                        className={`px-2.5 py-1 rounded text-xs font-mono font-bold border transition-all cursor-pointer ${
                                            betAmount === amt
                                                ? 'bg-shin-gold text-black border-shin-gold'
                                                : 'bg-black/60 text-gray-400 border-white/10 hover:border-white/30'
                                        }`}
                                    >
                                        {amt}
                                    </button>
                                ))}
                                <button
                                    onClick={() => window.dispatchEvent(new CustomEvent('exitMatch'))}
                                    className="ml-2 px-3 py-1 rounded text-[10px] font-cinzel font-bold uppercase tracking-wider bg-white/10 hover:bg-shin-red text-gray-200 hover:text-white border border-white/15 cursor-pointer"
                                >
                                    Leave Pit
                                </button>
                            </div>
                        </div>

                        {/* Back Right Corner */}
                        <button
                            onClick={() => handleQuickSpectatorBet('p2')}
                            className="w-full md:w-auto flex-1 arcade-skew-right bg-gradient-to-l from-red-950/90 to-black hover:from-red-800 border-r-4 border-y border-l border-r-shin-red border-white/20 px-4 py-2.5 flex items-center justify-between transition-all cursor-pointer group"
                        >
                            <span className="arcade-unskew-right bg-shin-red text-white font-cinzel font-black text-xs px-3 py-1 rounded group-hover:scale-105 transition-transform">
                                +{betAmount} NEAR
                            </span>
                            <div className="arcade-unskew-right text-right">
                                <div className="text-[10px] text-red-400 font-cinzel font-black uppercase tracking-wider">
                                    BACK {p2Name.slice(0, 14)}
                                </div>
                                <div className="text-xs text-white font-mono">
                                    Pot: {p2SpecPool.toFixed(1)} NEAR ({p2Odds}x Payout)
                                </div>
                            </div>
                        </button>
                    </div>
                </div>
            )}

            {/* Keyboard Controls Hint for Local PvE/PvP */}
            {!isTouchDevice && !isAgentOrSpectator && !gameOver && (
                <div className="absolute bottom-3 left-1/2 -translate-x-1/2 bg-black/80 border border-white/15 px-5 py-1.5 rounded-full text-[10px] font-cinzel tracking-widest text-gray-300 flex items-center gap-5">
                    <span>⬅️➡️ DASH</span>
                    <span>⬆️ JUMP</span>
                    <span className="text-red-400 font-bold">[A / S] COMBO SLASH</span>
                    <span className="text-shin-gold font-bold">[X / SPACE] ⚡ SPIRIT STRIKE</span>
                    <span className="text-emerald-400 font-bold">[D] GUARD</span>
                </div>
            )}

            {/* Pause Modal */}
            {isPaused && !gameOver && (
                <div className="absolute inset-0 bg-black/85 flex flex-col items-center justify-center pointer-events-auto z-50 backdrop-blur-md gap-4">
                    <h1 className="text-5xl text-white font-cinzel font-black tracking-widest uppercase mb-4">
                        MATCH PAUSED
                    </h1>
                    <button
                        onClick={() => {
                            setIsPaused(false);
                            window.dispatchEvent(
                                new CustomEvent('togglePause', { detail: { isPaused: false } }),
                            );
                        }}
                        className="w-[280px] px-6 py-4 bg-shin-gold text-black font-cinzel font-black text-lg tracking-widest hover:bg-yellow-400 transition-all rounded-xl cursor-pointer"
                    >
                        RESUME KOMBAT
                    </button>
                    <button
                        onClick={() => {
                            setIsPaused(false);
                            window.dispatchEvent(
                                new CustomEvent('togglePause', { detail: { isPaused: false } }),
                            );
                            window.dispatchEvent(new CustomEvent('exitMatch'));
                        }}
                        className="w-[280px] px-6 py-4 bg-red-950/60 border-2 border-shin-red text-shin-red font-cinzel font-bold text-lg tracking-widest hover:bg-shin-red hover:text-white transition-all rounded-xl cursor-pointer"
                    >
                        EXIT TO MENU
                    </button>
                </div>
            )}

            {/* =================================================================
                VICTORY SCREEN & SPOILS OF WAR (With Optional NEAR Tech Toggle)
               ================================================================= */}
            {gameOver && (
                <div className="absolute inset-0 bg-black/95 flex flex-col items-center justify-center pointer-events-auto z-[100] px-4 overflow-y-auto py-8">
                    <div className="mb-5 text-center">
                        <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-shin-gold/20 border border-shin-gold/50 text-shin-gold text-xs font-cinzel font-bold uppercase tracking-widest mb-2">
                            <Trophy size={14} /> Victory Declared
                        </div>
                        <h1 className="text-4xl md:text-6xl font-cinzel font-black text-white tracking-widest uppercase glow-gold">
                            {gameOver.winner} WINS!
                        </h1>
                        <div className="text-gray-400 font-cinzel text-xs tracking-widest uppercase mt-1">
                            Match Time: {gameOver.duration} • Score: {gameOver.roundsScore}
                        </div>
                    </div>

                    {/* Spoils of War / Pool Payout Card */}
                    {settlementReport && (
                        <div className="w-full max-w-2xl bg-gradient-to-r from-amber-950/40 via-black to-emerald-950/30 border-2 border-shin-gold/50 rounded-2xl p-5 mb-5">
                            <div className="flex items-center justify-between border-b border-white/10 pb-2.5 mb-3">
                                <span className="text-xs font-cinzel font-black text-shin-gold uppercase tracking-widest flex items-center gap-2">
                                    <Coins size={16} /> Spoils of the Colosseum
                                </span>
                                <button
                                    onClick={() => setShowTechDetails(!showTechDetails)}
                                    className="text-[10px] font-mono text-emerald-400 bg-emerald-950/60 px-2.5 py-1 rounded border border-emerald-500/30 flex items-center gap-1 cursor-pointer"
                                >
                                    <Terminal size={11} />
                                    <span>{showTechDetails ? 'Hide NEAR Receipt' : 'Inspect NEAR Receipt'}</span>
                                </button>
                            </div>
                            <div className="grid grid-cols-1 md:grid-cols-3 gap-3 text-center">
                                <div className="bg-black/70 p-3 rounded-xl border border-white/10">
                                    <div className="text-[10px] text-gray-400 uppercase">Champion Fight Pot</div>
                                    <div className="text-xl font-mono font-bold text-shin-gold">
                                        +{settlementReport.fighterPotWonNear.toFixed(2)} NEAR
                                    </div>
                                    <div className="text-[10px] text-gray-400 mt-0.5">
                                        Added to Winner&apos;s War Chest
                                    </div>
                                </div>
                                <div className="bg-black/70 p-3 rounded-xl border border-white/10">
                                    <div className="text-[10px] text-gray-400 uppercase">Warrior Rank Up</div>
                                    <div className="text-xl font-cinzel font-black text-blue-400">
                                        Level {settlementReport.newPowerLevel}
                                    </div>
                                    <div className="text-[10px] text-gray-400 mt-0.5">
                                        +24 ELO • +1 Attack Power
                                    </div>
                                </div>
                                <div className="bg-black/70 p-3 rounded-xl border border-white/10">
                                    <div className="text-[10px] text-gray-400 uppercase">Your Crowd Backing Payout</div>
                                    <div className="text-xl font-mono font-bold text-emerald-400">
                                        +{settlementReport.spectatorPayoutNear.toFixed(2)} NEAR
                                    </div>
                                    <div className="text-[10px] text-gray-400 mt-0.5">
                                        Instant Payout (0 Popups)
                                    </div>
                                </div>
                            </div>
                            {showTechDetails && (
                                <div className="mt-3 pt-2.5 border-t border-white/10 text-[11px] font-mono text-gray-300 flex flex-wrap items-center justify-between gap-2">
                                    <span>Winner Sub-Account: <strong className="text-shin-gold">{settlementReport.winnerWallet}</strong></span>
                                    <span className="text-emerald-400">Contract: shin-arena.testnet::settle_match</span>
                                </div>
                            )}
                        </div>
                    )}

                    {/* Combat Breakdown Grid */}
                    <div className="w-full max-w-2xl grid grid-cols-2 gap-4 mb-6">
                        {[
                            { stats: gameOver.p1Stats, id: 'p1', accent: 'shin-gold' },
                            { stats: gameOver.p2Stats, id: 'p2', accent: 'shin-red' },
                        ].map(({ stats, id }) => {
                            const isWin = gameOver.winnerId === id;
                            return (
                                <div
                                    key={id}
                                    className={`p-4 rounded-xl border ${
                                        isWin
                                            ? 'bg-shin-gold/10 border-shin-gold/50'
                                            : 'bg-white/5 border-white/10 opacity-70'
                                    }`}
                                >
                                    <h2 className="text-sm font-cinzel font-bold text-white mb-2 border-b border-white/10 pb-1 uppercase flex items-center justify-between">
                                        <span className="truncate">{stats.name}</span>
                                        {isWin && (
                                            <span className="text-[9px] bg-shin-gold text-black px-2 py-0.5 rounded font-bold">
                                                CHAMPION
                                            </span>
                                        )}
                                    </h2>
                                    <div className="space-y-1 text-xs">
                                        <div className="flex justify-between">
                                            <span className="text-gray-400">Damage Dealt</span>
                                            <span className="text-white font-mono font-bold">{stats.damageDealt}</span>
                                        </div>
                                        <div className="flex justify-between">
                                            <span className="text-gray-400">Combo Hits</span>
                                            <span className="text-white font-mono">{stats.hitsLanded || 0}</span>
                                        </div>
                                        <div className="flex justify-between">
                                            <span className="text-gray-400">Spirit Strikes</span>
                                            <span className="text-shin-gold font-mono">{stats.specialsLanded || 0}</span>
                                        </div>
                                        <div className="flex justify-between">
                                            <span className="text-gray-400">Guards</span>
                                            <span className="text-emerald-400 font-mono">{stats.blocks}</span>
                                        </div>
                                    </div>
                                </div>
                            );
                        })}
                    </div>

                    {/* Next Action Buttons */}
                    <div className="flex flex-col sm:flex-row gap-3 w-full max-w-lg">
                        <button
                            className="flex-1 py-3.5 bg-shin-gold border border-shin-gold text-black font-cinzel font-black text-sm tracking-widest uppercase rounded-xl transition-all hover:bg-yellow-400 cursor-pointer"
                            onClick={() => {
                                if (matchMode === 'AGENT_ARENA') {
                                    window.dispatchEvent(new CustomEvent('nextAgentMatch'));
                                } else if (isSpectator) {
                                    window.dispatchEvent(new CustomEvent('leaveSpectator'));
                                } else {
                                    window.dispatchEvent(new CustomEvent('rematch'));
                                }
                            }}
                        >
                            {matchMode === 'AGENT_ARENA'
                                ? '⚔ NEXT COLOSSEUM FIGHT'
                                : isSpectator
                                  ? 'RETURN TO COLOSSEUM'
                                  : '⚔ REMATCH'}
                        </button>

                        <button
                            className="flex-1 py-3.5 bg-white/5 border border-white/20 text-white font-cinzel font-bold text-xs tracking-widest uppercase rounded-xl transition-all hover:border-white cursor-pointer"
                            onClick={() => {
                                window.dispatchEvent(new CustomEvent('exitMatch'));
                            }}
                        >
                            RETURN TO HALL
                        </button>
                    </div>
                </div>
            )}
        </div>
    );
};

export default ControlsOverlay;
