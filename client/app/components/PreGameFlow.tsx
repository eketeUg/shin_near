import React, { useState, useEffect } from 'react';
import { Coins, Wallet, ShieldCheck, Sword, Zap, Loader2, Landmark, DollarSign, ArrowRight } from 'lucide-react';
import { nearArenaEngine } from '../services/nearArenaEngine';

export type GameMode = 'PVP' | 'PVE';
export type CharacterId = string;

interface PreGameFlowProps {
  initialMode: GameMode;
  onStartFight: (mode: GameMode, p1Character: CharacterId, p2Character: CharacterId, difficulty: 'EASY' | 'MEDIUM' | 'HARD') => void;
  onSearchOpponent?: (p1Character: CharacterId, wager?: { token: string, amount: number }) => void;
  onBack: () => void;
  onHome: () => void;
  ownedCharacters: string[];
  deployedCharacters?: string[];
  onMintNew: (charId: CharacterId) => void;
  playerName?: string;
  balances?: { NEAR: number, USDC: number, USDT: number, SHIN?: number };
}

export const Roster = [
  { id: 'fighter', name: 'Fighter', folder: 'Fighter', color: 'bg-orange-900 border-orange-500', frames: 6, gif: 'Fighter_AllActions.gif' },
  { id: 'knight_1', name: 'Knight', folder: 'Knight_1', color: 'bg-stone-700 border-stone-400', frames: 4, gif: 'Knight_AllActions.gif' },
  { id: 'kunoichi', name: 'Kunoichi', folder: 'Kunoichi', color: 'bg-purple-900 border-purple-500', frames: 9, gif: 'Kunoich_AllActions.gif' },
  { id: 'ninja_monk', name: 'Monk', folder: 'Ninja_Monk', color: 'bg-yellow-900 border-yellow-500', frames: 7, gif: 'Ninja_Monk_AllActions.gif' },
  { id: 'ninja_peasant', name: 'Peasant', folder: 'Ninja_Peasant', color: 'bg-green-900 border-green-500', frames: 6, gif: 'Ninja_Peasant_AllActions.gif' },
  { id: 'samurai', name: 'Samurai V1', folder: 'Samurai', color: 'bg-red-900 border-red-500', frames: 6, gif: 'Samurai_AllActions.gif' },
  { id: 'samurai_1', name: 'Samurai V2', folder: 'Samurai_1', color: 'bg-rose-900 border-rose-500', frames: 6, gif: 'Samurai_1_AllAction.gif' },
  { id: 'samurai_archer', name: 'Archer', folder: 'Samurai_Archer', color: 'bg-teal-900 border-teal-500', frames: 9, gif: 'Samurai_Archer_AllActions.gif' },
  { id: 'samurai_commander', name: 'Commander', folder: 'Samurai_Commander', color: 'bg-amber-900 border-amber-500', frames: 5, gif: 'Samurai_Commander_AllActions.gif' },
  { id: 'shinobi', name: 'Shinobi', folder: 'Shinobi', color: 'bg-blue-900 border-blue-500', frames: 6, gif: 'Shinobi_AllActions.gif' }
];

type Step = 'MATCH_CONFIG' | 'PVP_TYPE_SELECT' | 'WAGER_TOKEN_SELECT' | 'WAGER_AMOUNT_SELECT' | 'WAGER_CONFIRM' | 'CHAR_SELECT';

const PreGameFlow: React.FC<PreGameFlowProps> = ({ initialMode, onStartFight, onSearchOpponent, onBack, onHome, ownedCharacters, deployedCharacters = [], onMintNew, playerName, balances = { NEAR: 25, USDC: 100, USDT: 50 } }) => {
  const [step, setStep] = useState<Step>('MATCH_CONFIG');
  const [mode, setMode] = useState<GameMode>(initialMode);
  const [difficulty, setDifficulty] = useState<'EASY' | 'MEDIUM' | 'HARD'>('MEDIUM');
  
  // Wager State
  const [wagerType, setWagerType] = useState<'FREE' | 'WAGER'>('FREE');
  const [selectedToken, setSelectedToken] = useState<'SHIN'>('SHIN');
  const [wagerAmount, setWagerAmount] = useState<number>(100);
  const walletAccountId = nearArenaEngine.getState().playerWallet.accountId;
  const isGuestPlayer = !walletAccountId || walletAccountId.startsWith('guest-');
  const [customWager, setCustomWager] = useState<string>('');
  const [isLocking, setIsLocking] = useState(false);

  // Character Selection State
  const [p1Char, setP1Char] = useState<CharacterId | null>(null);
  const [p2Char, setP2Char] = useState<CharacterId | null>(null);
  const [activeTab, setActiveTab] = useState<'OWNED' | 'ALL' | 'LOCKED'>('ALL');

  const handleCharacterClick = (charId: CharacterId) => {
    if (!p1Char) {
      setP1Char(charId);
      if (mode === 'PVE') {
         const available = Roster.map(r => r.id as CharacterId);
         const randomChar = available[Math.floor(Math.random() * available.length)];
         setP2Char(randomChar);
      } else if (mode === 'PVP' && onSearchOpponent) {
         // Pass wager info to matchmaking
         onSearchOpponent(charId, wagerType === 'WAGER' ? { token: selectedToken, amount: wagerAmount } : undefined);
      }
    } else if (!p2Char && mode === 'PVP') {
      setP2Char(charId);
    }
  };

  const handleFightClick = () => {
    if (mode && p1Char && p2Char) {
      onStartFight(mode, p1Char, p2Char, difficulty);
    }
  };

  const handleBack = () => {
    if (step === 'CHAR_SELECT') {
      if (mode === 'PVE') setStep('MATCH_CONFIG');
      else setStep(wagerType === 'FREE' ? 'PVP_TYPE_SELECT' : 'WAGER_CONFIRM');
      setP1Char(null);
      setP2Char(null);
    } else if (step === 'WAGER_CONFIRM') setStep('WAGER_AMOUNT_SELECT');
    else if (step === 'WAGER_AMOUNT_SELECT') setStep('WAGER_TOKEN_SELECT');
    else if (step === 'WAGER_TOKEN_SELECT') setStep('PVP_TYPE_SELECT');
    else if (step === 'PVP_TYPE_SELECT') setStep('MATCH_CONFIG');
    else onBack();
  };

  const wagerPresets = [50, 100, 250, 500, 1000, 2500];

  return (
    <div className="fixed inset-0 z-40 overflow-y-auto bg-black/95 text-white backdrop-blur-xl">
      {/* Navigation Buttons */}
      <div className="fixed top-6 left-6 right-6 z-50 flex justify-between items-center">
        <button 
          onClick={handleBack}
          className="group flex items-center gap-2 text-gray-500 hover:text-shin-red transition-all font-cinzel font-bold text-xs md:text-sm tracking-widest uppercase"
        >
          <div className="w-8 h-8 rounded-full border border-gray-800 flex items-center justify-center group-hover:border-shin-red">←</div>
          <span>Back</span>
        </button>

        <button 
          onClick={onHome}
          className="group flex items-center gap-2 text-gray-500 hover:text-shin-gold transition-all font-cinzel font-bold text-xs md:text-sm tracking-widest uppercase"
        >
          <span>Main Menu</span>
          <div className="w-8 h-8 rounded-full border border-gray-800 flex items-center justify-center group-hover:border-shin-gold text-lg">✕</div>
        </button>
      </div>

      <div className="min-h-full w-full flex flex-col items-center justify-center pt-24 pb-12 px-4 md:py-12">

      {/* STEP 1: MATCH CONFIG (MODE CHECK) */}
      {step === 'MATCH_CONFIG' && (
        <div className="w-full max-w-2xl animate-in fade-in zoom-in duration-500 flex flex-col items-center">
            <h2 className="text-3xl md:text-5xl font-cinzel text-shin-gold mb-8 tracking-[0.2em] text-center uppercase drop-shadow-md">
              {mode === 'PVE' ? 'Campaign Settings' : 'Challenge Mode'}
            </h2>
            
            <div className="w-full bg-white/5 border border-white/10 p-8 rounded-2xl backdrop-blur-md shadow-2xl">
                {mode === 'PVE' ? (
                    <div className="space-y-8">
                        <div className="text-center space-y-2">
                            <h3 className="text-shin-gold/60 font-cinzel text-xs tracking-widest uppercase">Select Difficulty</h3>
                            <div className="flex flex-wrap justify-center gap-3">
                                {(['EASY', 'MEDIUM', 'HARD'] as const).map(diff => (
                                    <button 
                                        key={diff}
                                        onClick={() => setDifficulty(diff)}
                                        className={`px-6 py-3 font-cinzel font-bold text-sm tracking-widest border-2 transition-all ${difficulty === diff ? 'bg-white text-black border-white shadow-[0_0_20px_rgba(255,255,255,0.3)]' : 'border-white/10 text-white/40 hover:border-white/30'}`}
                                    >
                                        {diff}
                                    </button>
                                ))}
                            </div>
                        </div>
                        <button 
                            onClick={() => setStep('CHAR_SELECT')}
                            className="w-full py-4 bg-shin-red text-white font-cinzel font-black text-xl tracking-widest hover:bg-red-600 transition-all shadow-[0_0_20px_rgba(220,38,38,0.3)]"
                        >
                            BEGIN CHALLENGE
                        </button>
                    </div>
                ) : (
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <button 
                            onClick={() => { setWagerType('FREE'); setStep('PVP_TYPE_SELECT'); }}
                            className="group flex flex-col items-center justify-center p-8 bg-white/5 border border-white/10 hover:border-white/30 hover:bg-white/10 transition-all rounded-xl gap-4"
                        >
                            <div className="w-16 h-16 rounded-full bg-gray-800 flex items-center justify-center group-hover:scale-110 transition-transform">
                                <Sword size={32} className="text-white" />
                            </div>
                            <div className="text-center">
                                <h3 className="font-cinzel font-bold text-xl text-white">Free Fight</h3>
                                <p className="text-[10px] text-gray-500 uppercase tracking-widest mt-1">Hone your skills</p>
                            </div>
                        </button>

                        <button 
                            disabled={isGuestPlayer}
                            onClick={() => { setWagerType('WAGER'); setStep('PVP_TYPE_SELECT'); }}
                            className={`group flex flex-col items-center justify-center p-8 border transition-all rounded-xl gap-4 ${
                              isGuestPlayer
                                ? 'bg-white/5 border-white/10 opacity-50 cursor-not-allowed'
                                : 'bg-shin-gold/5 border-shin-gold/20 hover:border-shin-gold/50 hover:bg-shin-gold/10 shadow-[0_0_30px_rgba(212,175,55,0.05)]'
                            }`}
                        >
                            <div className="w-16 h-16 rounded-full bg-shin-gold/20 flex items-center justify-center group-hover:scale-110 transition-transform">
                                <Coins size={32} className="text-shin-gold" />
                            </div>
                            <div className="text-center">
                                <h3 className="font-cinzel font-bold text-xl text-shin-gold">Wager Fight</h3>
                                <p className="text-[10px] text-shin-gold/60 uppercase tracking-widest mt-1">
                                  {isGuestPlayer ? 'Sign in with Google or Email (No Guests)' : 'High stakes $SHIN battle'}
                                </p>
                            </div>
                        </button>
                    </div>
                )}
            </div>
        </div>
      )}

      {/* STEP 2: PVP TYPE SELECT (FREE vs WAGER) */}
      {step === 'PVP_TYPE_SELECT' && (
        <div className="w-full max-w-2xl animate-in fade-in slide-in-from-bottom-8 duration-500 flex flex-col items-center">
            <div className="text-center mb-8">
                <h2 className="text-2xl md:text-4xl font-cinzel text-white mb-2 tracking-widest uppercase">
                    {wagerType === 'FREE' ? 'Free Arena' : 'Wager Arena'}
                </h2>
                <p className="text-gray-500 text-xs tracking-[0.4em] uppercase">
                    {wagerType === 'FREE' ? 'ELO / MMR Matchmaking' : 'Step 1: Select Token'}
                </p>
            </div>

            {wagerType === 'FREE' ? (
                <div className="w-full bg-white/5 border border-white/10 p-10 rounded-2xl flex flex-col items-center gap-6">
                    <div className="w-20 h-20 rounded-full border-2 border-white/10 flex items-center justify-center text-gray-400">
                        <ShieldCheck size={40} />
                    </div>
                    <div className="text-center space-y-2">
                        <p className="text-sm text-gray-400 leading-relaxed max-w-xs mx-auto">
                            Join the public queue. Your opponent will be matched based on your current combat rating.
                        </p>
                    </div>
                    <button 
                        onClick={() => setStep('CHAR_SELECT')}
                        className="w-full py-4 bg-white text-black font-cinzel font-black text-xl tracking-[0.2em] hover:bg-gray-200 transition-all mt-4"
                    >
                        ENTER QUEUE
                    </button>
                </div>
            ) : (
                <div className="w-full max-w-md mx-auto">
                    {[
                        { id: 'SHIN', icon: Zap, color: 'text-shin-gold', balance: balances.SHIN ?? 0 }
                    ].map(token => (
                        <button 
                            key={token.id}
                            onClick={() => { setSelectedToken('SHIN'); setStep('WAGER_AMOUNT_SELECT'); }}
                            className="w-full group relative flex flex-col items-center p-8 bg-white/5 border border-shin-gold/40 hover:border-shin-gold rounded-xl transition-all"
                        >
                            <div className={`w-14 h-14 rounded-full bg-shin-gold/10 flex items-center justify-center mb-3 group-hover:scale-110 transition-transform ${token.color}`}>
                                <token.icon size={28} />
                            </div>
                            <h4 className="font-cinzel font-bold text-xl text-white mb-1">${token.id}</h4>
                            <p className="text-[10px] text-gray-400 uppercase tracking-widest mb-2">Official Arena Duel Token (95% Winner / 5% Treasury)</p>
                            <div className="flex items-center gap-1 text-shin-gold text-xs uppercase tracking-widest">
                                <Wallet size={12} />
                                <span>{Math.round(token.balance).toLocaleString()} $SHIN</span>
                            </div>
                            <div className="absolute top-3 right-3 opacity-70 group-hover:opacity-100 transition-opacity">
                                <ArrowRight size={16} className="text-shin-gold" />
                            </div>
                        </button>
                    ))}
                </div>
            )}
        </div>
      )}

      {/* STEP 3: WAGER AMOUNT SELECT */}
      {step === 'WAGER_AMOUNT_SELECT' && (
        <div className="w-full max-w-2xl animate-in fade-in slide-in-from-bottom-8 duration-500 flex flex-col items-center">
            <div className="text-center mb-8">
                <h2 className="text-2xl md:text-4xl font-cinzel text-white mb-2 tracking-widest uppercase">Select Wager</h2>
                <p className="text-gray-500 text-xs tracking-[0.4em] uppercase">Step 2: Choose Stake</p>
            </div>

            <div className="w-full bg-white/5 border border-white/10 p-8 rounded-2xl flex flex-col gap-8">
                <div className="grid grid-cols-4 gap-3">
                    {wagerPresets.map(val => (
                        <button 
                            key={val}
                            onClick={() => { setWagerAmount(val); setCustomWager(''); }}
                            className={`py-4 rounded border font-cinzel font-bold text-lg transition-all ${wagerAmount === val && !customWager ? 'bg-shin-gold text-black border-shin-gold shadow-[0_0_20px_rgba(212,175,55,0.2)]' : 'bg-black/40 border-white/10 text-gray-400 hover:border-white/30'}`}
                        >
                            {val} $SHIN
                        </button>
                    ))}
                    <div className="relative col-span-4 mt-2">
                        <input 
                            type="number"
                            placeholder="Custom $SHIN Amount..."
                            value={customWager}
                            onChange={(e) => {
                                setCustomWager(e.target.value);
                                setWagerAmount(Number(e.target.value) || 0);
                            }}
                            className="w-full bg-black/60 border border-white/10 p-4 rounded text-white font-cinzel focus:outline-none focus:border-shin-gold transition-colors pl-20"
                        />
                        <div className="absolute left-4 top-1/2 -translate-y-1/2 text-shin-gold font-cinzel text-sm font-bold">$SHIN</div>
                    </div>
                </div>

                <div className="flex justify-between items-center px-2 py-4 bg-white/5 rounded border border-white/5">
                    <div className="flex flex-col">
                        <span className="text-[9px] text-gray-500 uppercase tracking-widest">Wager Total</span>
                        <span className="text-xl font-cinzel text-white">{wagerAmount} ${selectedToken}</span>
                    </div>
                    <button 
                        disabled={wagerAmount <= 0}
                        onClick={() => setStep('WAGER_CONFIRM')}
                        className="px-8 py-3 bg-shin-gold text-black font-cinzel font-black text-sm tracking-widest hover:bg-yellow-500 transition-all disabled:opacity-30 disabled:grayscale"
                    >
                        CONFIRM STAKE
                    </button>
                </div>
            </div>
        </div>
      )}

      {/* STEP 4: CONFIRM + LOCK FUNDS */}
      {step === 'WAGER_CONFIRM' && (
        <div className="w-full max-w-md animate-in fade-in zoom-in duration-500 flex flex-col items-center">
            <div className="text-center mb-10">
                <h2 className="text-2xl md:text-4xl font-cinzel text-white mb-2 tracking-widest uppercase">Authorization</h2>
                <p className="text-gray-500 text-xs tracking-[0.4em] uppercase">Step 3: Secure Funds</p>
            </div>

            <div className="w-full bg-black/60 border border-shin-gold/30 p-8 rounded-3xl relative overflow-hidden flex flex-col items-center">
                {/* Decoration */}
                <div className="absolute top-0 inset-x-0 h-1 bg-gradient-to-r from-transparent via-shin-gold/50 to-transparent"></div>
                
                <div className="w-24 h-24 rounded-full bg-shin-gold/10 border border-shin-gold/30 flex items-center justify-center mb-6 relative">
                    {isLocking ? (
                        <Loader2 className="text-shin-gold animate-spin" size={48} />
                    ) : (
                        <Landmark className="text-shin-gold" size={40} />
                    )}
                    {isLocking && (
                        <div className="absolute inset-0 rounded-full border-2 border-shin-gold border-t-transparent animate-spin"></div>
                    )}
                </div>

                <div className="text-center mb-8 space-y-2">
                    <h3 className="text-xl font-cinzel font-bold text-white uppercase tracking-widest">Lock Funds</h3>
                    <p className="text-xs text-gray-500 leading-relaxed">
                        To enter the wager queue, we must temporarily lock <span className="text-white">${wagerAmount} {selectedToken}</span> in a secure smart contract escrow.
                    </p>
                </div>

                <div className="w-full space-y-3 mb-8">
                    <div className="flex justify-between p-3 bg-white/5 rounded border border-white/5 text-[10px] uppercase tracking-widest">
                        <span className="text-gray-500">Amount</span>
                        <span className="text-white">${wagerAmount}</span>
                    </div>
                    <div className="flex justify-between p-3 bg-white/5 rounded border border-white/5 text-[10px] uppercase tracking-widest">
                        <span className="text-gray-500">Asset</span>
                        <span className="text-white">{selectedToken}</span>
                    </div>
                    <div className="flex justify-between p-3 bg-white/5 rounded border border-white/5 text-[10px] uppercase tracking-widest">
                        <span className="text-gray-500">Escrow Fee</span>
                        <span className="text-green-500">$0.00 FREE</span>
                    </div>
                </div>

                <button 
                    disabled={isLocking}
                    onClick={() => {
                        setIsLocking(true);
                        // Simulate blockchain delay
                        setTimeout(() => {
                            setIsLocking(false);
                            setStep('CHAR_SELECT');
                        }, 2500);
                    }}
                    className="w-full py-4 bg-shin-gold text-black font-cinzel font-black text-lg tracking-[0.2em] hover:bg-yellow-500 transition-all flex items-center justify-center gap-3"
                >
                    {isLocking ? 'LOCKING FUNDS...' : 'CONFIRM & ENTER'}
                </button>
            </div>
        </div>
      )}

      {/* STEP 5: CHARACTER SELECT SCREEN */}
      {step === 'CHAR_SELECT' && (
        <div className="w-full max-w-5xl animate-in fade-in slide-in-from-right-4 duration-500 flex flex-col items-center gap-0">

          {/* ── TOP: VS STAGE ── */}
          <div className="w-full flex items-end justify-center gap-4 md:gap-12 relative"
               style={{ minHeight: '220px' }}>

            {/* P1 slot */}
            <div className="flex flex-col items-center flex-1 max-w-[180px]">
              <span className="text-[10px] text-shin-red tracking-[0.3em] uppercase mb-2 font-cinzel">
                {playerName ? (playerName.length > 9 ? playerName.substring(0, 9) + '…' : playerName) : 'P1'}
              </span>
              <div className="relative w-32 h-40 md:w-44 md:h-52 flex items-end justify-center">
                {p1Char ? (() => {
                  const d = Roster.find(r => r.id === p1Char);
                  return d ? (
                    <img
                      key={p1Char}
                      src={`/assets/Shin_gifs/${d.gif}`}
                      alt={d.name}
                      className="w-full h-full object-contain origin-bottom drop-shadow-[0_0_20px_rgba(255,51,51,0.7)]"
                      style={{
                        imageRendering: 'pixelated',
                        animation: 'slideUpIn 0.45s cubic-bezier(0.22,1,0.36,1) both',
                        transform: 'scale(1.5)',
                      }}
                    />
                  ) : null;
                })() : (
                  <div className="w-24 h-24 border-2 border-dashed border-gray-500 rounded-full flex items-center justify-center animate-pulse">
                    <span className="font-cinzel text-xs text-gray-300">SELECT</span>
                  </div>
                )}
              </div>
              <span className="font-cinzel text-sm md:text-base text-white mt-2 tracking-widest min-h-[1.5rem]">
                {p1Char ? p1Char.toUpperCase() : '???'}
              </span>
            </div>

            {/* VS badge */}
            <div className="flex flex-col items-center pb-8 shrink-0">
              <span className="text-4xl md:text-6xl text-shin-gold/80 font-cinzel italic tracking-widest drop-shadow-lg select-none">VS</span>
            </div>

            {/* P2 slot */}
            <div className="flex flex-col items-center flex-1 max-w-[180px]">
              <span className="text-[10px] text-shin-gold tracking-[0.3em] uppercase mb-2 font-cinzel">
                {mode === 'PVE' ? 'CPU' : 'P2'}
              </span>
              <div className="relative w-32 h-40 md:w-44 md:h-52 flex items-end justify-center">
                {p2Char ? (() => {
                  const d = Roster.find(r => r.id === p2Char);
                  return d ? (
                    <img
                      key={p2Char}
                      src={`/assets/Shin_gifs/${d.gif}`}
                      alt={d.name}
                      className="w-full h-full object-contain origin-bottom drop-shadow-[0_0_20px_rgba(255,215,0,0.6)]"
                      style={{
                        imageRendering: 'pixelated',
                        animation: 'slideUpInFlipped 0.45s cubic-bezier(0.22,1,0.36,1) both',
                      }}
                    />
                  ) : null;
                })() : (
                  <div className="w-24 h-24 border-2 border-dashed border-gray-500 rounded-full flex items-center justify-center animate-pulse">
                    <span className="font-cinzel text-xs text-gray-300">{mode === 'PVE' ? 'AUTO' : 'WAITING'}</span>
                  </div>
                )}
              </div>
              <span className="font-cinzel text-sm md:text-base text-white mt-2 tracking-widest min-h-[1.5rem]">
                {p2Char ? p2Char.toUpperCase() : '???'}
              </span>
            </div>
          </div>

          {/* Selection hint */}
          <div className="flex flex-col items-center gap-2 mb-4">
            <p className="text-shin-red tracking-[0.25em] uppercase text-[10px] md:text-xs font-cinzel">
                {!p1Char ? `${playerName || 'Player 1'} — choose your fighter` : (mode === 'PVP' && !p2Char) ? 'Player 2 — choose your fighter' : 'Ready to fight!'}
            </p>
            {mode === 'PVP' && (
                <div className="flex items-center gap-2 px-3 py-1 bg-white/5 rounded-full border border-white/10">
                    <span className={`w-2 h-2 rounded-full ${wagerType === 'WAGER' ? 'bg-shin-gold animate-pulse' : 'bg-green-500'}`}></span>
                    <span className="text-[8px] font-bold tracking-widest uppercase text-gray-400">
                        {wagerType === 'FREE' ? 'FREE FIGHT' : `WAGER: $${wagerAmount} ${selectedToken}`}
                    </span>
                </div>
            )}
          </div>

          {/* Divider */}
          <div className="w-full h-px bg-gradient-to-r from-transparent via-gray-700 to-transparent mb-4" />

          {/* ── BOTTOM: CHARACTER GRID PICKER ── */}
          {(() => {
            const ownedRoster = Roster.filter(char => ownedCharacters.includes(char.id) || (mode === 'PVE' && p1Char && !p2Char));
            const unownedRoster = Roster.filter(char => !ownedCharacters.includes(char.id) && !(mode === 'PVE' && p1Char && !p2Char));

            const renderCharacterButton = (char: typeof Roster[0], isOwned: boolean) => {
              const isP1 = p1Char === char.id;
              const isP2 = p2Char === char.id;
              const isSelected = isP1 || isP2;
              const isSelectingP1 = !p1Char;
              const isDeployedLock = isOwned && isSelectingP1 && deployedCharacters.includes(char.id);

              return (
                <button
                  key={char.id}
                  disabled={isSelected || isDeployedLock}
                  title={isDeployedLock ? 'This warrior is currently fighting in the Agent Arena. Withdraw it from the Agent Cup to play manually.' : undefined}
                  onClick={() => {
                    if (isDeployedLock) return;
                    if (isOwned) {
                      handleCharacterClick(char.id as CharacterId);
                    } else {
                      onMintNew(char.id as CharacterId);
                    }
                  }}
                  className={`group relative flex flex-col items-center justify-center p-2 transition-all duration-300 border-2 overflow-hidden w-full ${
                    isSelected
                      ? char.color + ' opacity-70 scale-95 cursor-default'
                      : isDeployedLock
                        ? 'bg-purple-950/40 border-purple-500/50 opacity-60 cursor-not-allowed'
                        : isOwned
                          ? 'bg-gray-900/80 border-gray-700 hover:border-white hover:scale-105 hover:shadow-[0_-6px_20px_rgba(255,255,255,0.15)] cursor-pointer'
                          : 'bg-black/60 border-gray-800 hover:border-shin-gold cursor-pointer opacity-70 hover:opacity-100'
                  }`}
                  style={{ minHeight: '160px' }}
                >
                  <span className={`absolute top-2 font-cinzel text-xs md:text-base uppercase tracking-widest text-center leading-tight ${isOwned ? 'text-white font-bold drop-shadow-[0_1px_3px_rgba(0,0,0,0.9)]' : 'text-gray-300 group-hover:text-shin-gold'} z-20`}>
                    {char.name}
                  </span>
                  <img
                    src={`/assets/Shin_gifs/${char.gif}`}
                    alt={char.name}
                    className="w-24 h-24 md:w-32 md:h-32 lg:w-40 lg:h-40 object-contain flex-shrink-0 transition-transform duration-300 group-hover:scale-110 mt-6 md:mt-8 relative z-10"
                    style={{ imageRendering: 'pixelated', transform: 'scale(1.5)', transformOrigin: 'bottom' }}
                  />
                  {isP1 && <div className="absolute top-1 left-1 bg-shin-red text-white text-[8px] px-1 font-bold rounded-sm z-10">P1</div>}
                  {isP2 && <div className="absolute top-1 right-1 bg-shin-gold text-black text-[8px] px-1 font-bold rounded-sm z-10">{mode === 'PVE' ? 'CPU' : 'P2'}</div>}
                  {isDeployedLock && (
                    <div className="absolute inset-0 flex items-center justify-center bg-black/65 z-20 p-2 text-center">
                      <span className="text-purple-300 font-mono text-[9px] uppercase font-bold tracking-wider border border-purple-400/50 bg-purple-950/80 px-2 py-1 rounded">
                        🤖 In Agent Arena
                      </span>
                    </div>
                  )}
                  {!isOwned && !isSelected && (
                    <div className="absolute inset-0 flex items-center justify-center bg-black/50 group-hover:bg-black/20 transition-all z-20">
                      <span className="text-shin-gold/60 group-hover:text-shin-gold font-cinzel text-[8px] tracking-widest border border-shin-gold/30 px-1">MINT</span>
                    </div>
                  )}
                </button>
              );
            };

            return (
              <div className="w-full flex flex-col items-center gap-4 pb-6">
                <div className="flex bg-black/50 border border-gray-800 p-0.5">
                  {(['ALL', 'OWNED', 'LOCKED'] as const).map(tab => (
                    <button
                      key={tab}
                      onClick={() => setActiveTab(tab)}
                      className={`px-5 py-1.5 font-cinzel text-xs tracking-widest uppercase transition-all ${activeTab === tab ? 'bg-shin-red text-white' : 'text-gray-500 hover:text-white'}`}
                    >
                      {tab}
                      {tab === 'OWNED' && <span className="ml-1 text-[9px] border border-gray-600 rounded px-0.5">{ownedRoster.length}</span>}
                    </button>
                  ))}
                </div>

                <div className="w-full pb-4 px-4 max-w-7xl">
                  <div className="grid grid-cols-5 gap-2 md:gap-4 lg:gap-6 w-full">
                    {(activeTab === 'ALL' || activeTab === 'OWNED') && ownedRoster.map(char => renderCharacterButton(char, true))}
                    {(activeTab === 'ALL' || activeTab === 'LOCKED') && unownedRoster.map(char => renderCharacterButton(char, false))}
                  </div>
                </div>
              </div>
            );
          })()}

          {p1Char && p2Char && (
            <button
              onClick={handleFightClick}
              className="px-12 md:px-16 py-3 md:py-4 bg-shin-red text-white font-cinzel font-black text-xl md:text-2xl tracking-[0.2em] border-2 border-transparent hover:border-white hover:bg-red-800 transition-all duration-300 animate-pulse hover:animate-none drop-shadow-[0_0_15px_rgba(255,0,0,0.5)] mb-4"
            >
              FIGHT!
            </button>
          )}
        </div>
      )}

      </div>
    </div>
  );
};

export default PreGameFlow;
