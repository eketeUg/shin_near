'use client';

import { useState, useEffect } from 'react';
import {
  User,
  Mail,
  Shield,
  Trophy,
  Flame,
  Skull,
  Edit3,
  Check,
  X,
  Copy,
  ExternalLink,
  Bot,
  Coins,
  Swords,
  Zap,
} from 'lucide-react';
import { nearArenaEngine, COMBAT_DOCTRINES } from '../services/nearArenaEngine';
import { Roster } from './PreGameFlow';

interface ProfilePageProps {
  user: any;
  onClose: () => void;
  onUpdateSuccess: (updatedUser: any) => void;
}

export default function ProfilePage({ user, onClose, onUpdateSuccess }: ProfilePageProps) {
  const [arenaState, setArenaState] = useState(() => nearArenaEngine.getState());
  const [isEditing, setIsEditing] = useState(false);
  const [newUsername, setNewUsername] = useState(
    user?.username || user?.userName || arenaState.playerWallet.username || 'Warrior',
  );
  const [copySuccess, setCopySuccess] = useState(false);

  const nearAccount = user?.walletAddress || arenaState.playerWallet.accountId;

  useEffect(() => {
    const onUpdate = () => setArenaState({ ...nearArenaEngine.getState() });
    window.addEventListener('nearArenaStateUpdated', onUpdate);
    if (!user?.isGuest && nearAccount) {
      void nearArenaEngine.syncOnChainState(nearAccount);
    }
    return () => window.removeEventListener('nearArenaStateUpdated', onUpdate);
  }, [nearAccount, user?.isGuest]);
  const ownedFighters = arenaState.fighters.filter((f) => !f.isNpc);
  const rankedFighters = [...arenaState.fighters].sort(
    (a, b) => b.elo - a.elo || b.wins - a.wins,
  );
  const totalWins = ownedFighters.reduce((acc, f) => acc + f.wins, 0);
  const totalLosses = ownedFighters.reduce((acc, f) => acc + f.losses, 0);
  const bestElo =
    ownedFighters.length > 0
      ? ownedFighters.reduce((max, f) => Math.max(max, f.elo), 1000)
      : 0;

  const handleUpdateUsername = () => {
    if (!newUsername.trim()) return;
    localStorage.setItem('shin_username', newUsername.trim());
    const wallet = nearArenaEngine.syncUsername(newUsername.trim(), user?.walletAddress);
    const updated = {
      ...user,
      username: newUsername.trim(),
      userName: newUsername.trim(),
      walletAddress: wallet.accountId,
    };
    localStorage.setItem('shin_near_user', JSON.stringify(updated));
    onUpdateSuccess(updated);
    setIsEditing(false);
  };

  const copyWallet = () => {
    navigator.clipboard.writeText(nearAccount);
    setCopySuccess(true);
    setTimeout(() => setCopySuccess(false), 2000);
  };

  const getCharGif = (charId: string) => {
    const found = Roster.find((r) => r.id === charId);
    return found ? `/assets/Shin_gifs/${found.gif}` : '/assets/Shin_gifs/Shinobi_AllActions.gif';
  };

  return (
    <div className="flex flex-col w-full max-w-4xl mx-auto animate-in fade-in zoom-in duration-300">
      {/* Header */}
      <div className="flex items-center justify-between mb-6 border-b border-shin-red/20 pb-4">
        <div className="flex items-center gap-4">
          <div className="w-14 h-14 rounded-full bg-gradient-to-br from-shin-red to-black border-2 border-shin-gold/50 flex items-center justify-center">
            <User className="text-white w-7 h-7" />
          </div>
          <div>
            <h2 className="text-2xl font-cinzel font-bold text-white tracking-widest uppercase">
              Warrior Profile
            </h2>
            <p className="text-emerald-400 text-[10px] font-mono uppercase tracking-widest">
              Embedded NEAR Chain-Abstracted Account • 0 Wallet Popups
            </p>
          </div>
        </div>
        <button onClick={onClose} className="text-gray-500 hover:text-white transition-colors cursor-pointer">
          <X size={24} />
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
        {/* Left Column: Identity & Embedded NEAR Wallet */}
        <div className="space-y-4">
          <div className="bg-white/5 border border-white/10 p-4 rounded-xl">
            <label className="text-[10px] text-gray-500 uppercase tracking-widest mb-1.5 block">
              Warrior Display Name
            </label>
            <div className="flex items-center gap-3">
              {isEditing ? (
                <div className="flex-1 flex gap-2">
                  <input
                    type="text"
                    value={newUsername}
                    onChange={(e) => setNewUsername(e.target.value)}
                    className="bg-black border border-shin-gold/50 text-white px-3 py-1.5 rounded w-full text-sm"
                    autoFocus
                  />
                  <button
                    onClick={handleUpdateUsername}
                    className="bg-shin-gold text-black p-2 rounded cursor-pointer"
                  >
                    <Check size={16} />
                  </button>
                </div>
              ) : (
                <>
                  <span className="text-lg font-cinzel text-white tracking-wider">
                    {arenaState.playerWallet.username}
                  </span>
                  <button
                    onClick={() => setIsEditing(true)}
                    className="text-gray-500 hover:text-shin-gold transition-colors cursor-pointer"
                  >
                    <Edit3 size={15} />
                  </button>
                </>
              )}
            </div>
          </div>

          <div className="bg-white/5 border border-shin-gold/30 p-4 rounded-xl">
            <label className="text-[10px] text-shin-gold uppercase tracking-widest mb-1.5 block">
              Invisible NEAR Game Wallet
            </label>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2 text-gray-200 min-w-0">
                <Shield size={16} className="text-emerald-400 shrink-0" />
                <span className="font-mono text-xs truncate">{nearAccount}</span>
              </div>
              <div className="flex gap-1.5 shrink-0">
                <button
                  onClick={copyWallet}
                  className="p-1.5 hover:bg-white/10 rounded text-gray-400 hover:text-white cursor-pointer"
                  title="Copy NEAR Account"
                >
                  {copySuccess ? <Check size={14} className="text-green-500" /> : <Copy size={14} />}
                </button>
                <a
                  href={`https://testnet.nearblocks.io/address/${nearAccount}`}
                  target="_blank"
                  rel="noreferrer"
                  className="p-1.5 hover:bg-white/10 rounded text-gray-400 hover:text-white"
                  title="View on NearBlocks Explorer"
                >
                  <ExternalLink size={14} />
                </a>
              </div>
            </div>
            <div className="grid grid-cols-3 gap-2 mt-3 pt-3 border-t border-white/10 text-center font-mono">
              <div>
                <div className="text-[9px] text-gray-500">NEAR</div>
                <div className="text-xs font-bold text-shin-gold">
                  {arenaState.playerWallet.NEAR.toFixed(2)}
                </div>
              </div>
              <div>
                <div className="text-[9px] text-gray-500">USDC</div>
                <div className="text-xs font-bold text-blue-400">
                  {arenaState.playerWallet.USDC.toFixed(0)}
                </div>
              </div>
              <div>
                <div className="text-[9px] text-gray-500">Fighter NFTs</div>
                <div className="text-xs font-bold text-emerald-400">{ownedFighters.length}</div>
              </div>
            </div>
          </div>
        </div>

        {/* Right Column: Combat Rating & Agent Fleet Summary */}
        <div className="space-y-4">
          <div className="bg-gradient-to-br from-shin-red/20 to-black border border-shin-red/30 p-5 rounded-xl relative overflow-hidden">
            <div className="absolute top-0 right-0 p-3 opacity-10">
              <Trophy size={68} />
            </div>
            <label className="text-[10px] text-shin-red uppercase tracking-widest mb-1 block font-bold">
              Peak Fighter ELO Rating
            </label>
            <div className="text-4xl font-cinzel font-black text-white">{bestElo}</div>
            <div className="mt-2 text-xs text-gray-400 font-mono">
              Record: <span className="text-emerald-400">{totalWins} Wins</span> •{' '}
              <span className="text-red-400">{totalLosses} Losses</span>
            </div>
          </div>

          <div className="bg-white/5 border border-white/10 p-4 rounded-xl space-y-2">
            <div className="text-[10px] font-cinzel text-shin-gold uppercase tracking-widest flex items-center gap-1.5">
              <Bot size={13} /> Owned Fighter Sub-Account Wallets
            </div>
            {ownedFighters.length === 0 ? (
              <div className="text-xs font-mono text-gray-500 py-2">
                No fighter sub-accounts active yet.
              </div>
            ) : (
              <div className="space-y-1.5 max-h-28 overflow-y-auto">
                {ownedFighters.map((f) => (
                  <div
                    key={f.tokenId}
                    className="flex items-center justify-between text-xs font-mono bg-black/50 px-2.5 py-1.5 rounded border border-white/5"
                  >
                    <span className="text-white truncate">{f.title} (Lv.{f.powerLevel})</span>
                    <span className="text-emerald-400 font-bold">{f.vaultBalanceNear.toFixed(2)} NEAR</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* User's Fighter NFTs */}
      <div className="mt-5 bg-white/5 border border-white/10 p-4 rounded-xl">
        <div className="flex items-center justify-between mb-3">
          <div className="text-xs font-cinzel text-shin-gold uppercase tracking-widest flex items-center gap-2 font-bold">
            <Swords size={14} /> My Fighter NFTs ({ownedFighters.length})
          </div>
          <span className="text-[10px] font-mono text-emerald-400 uppercase tracking-wider">
            On-Chain • shin-arena-28d.testnet
          </span>
        </div>

        {ownedFighters.length === 0 ? (
          <div className="bg-black/40 border border-white/5 rounded-xl p-6 text-center">
            <p className="text-xs font-mono text-gray-400">
              No Fighter NFTs owned on-chain yet.
            </p>
            <p className="text-[11px] font-mono text-gray-500 mt-1">
              Mint a fighter in the Arena to see your NFT roster, stats, and War Chest here.
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {ownedFighters.map((f) => {
              const doctrine =
                COMBAT_DOCTRINES.find((d) => d.id === f.doctrine) || COMBAT_DOCTRINES[0];
              const totalFights = f.wins + f.losses;
              const rankIndex = rankedFighters.findIndex((r) => r.tokenId === f.tokenId);
              const rankLabel = rankIndex >= 0 ? `#${rankIndex + 1}` : '—';
              return (
                <div
                  key={f.tokenId}
                  className="w-full bg-gradient-to-b from-gray-900/90 via-black/95 to-black border-2 border-shin-gold/40 rounded-2xl p-4 shadow-[0_0_30px_rgba(0,0,0,0.8)] relative overflow-hidden"
                >
                  {/* Top Champion Header */}
                  <div className="flex items-center justify-between border-b border-white/10 pb-3 mb-3 gap-2">
                    <div className="min-w-0">
                      <div className="text-[10px] font-mono text-gray-400 truncate">
                        {f.tokenId}
                      </div>
                      <h3 className="text-base font-cinzel font-black text-white uppercase truncate mt-0.5">
                        {f.title}
                      </h3>
                    </div>
                    <div className="text-right shrink-0">
                      <span className="px-2 py-0.5 rounded bg-shin-gold text-black font-mono font-black text-xs">
                        LV.{f.powerLevel}
                      </span>
                      <div className="text-[10px] font-mono text-gray-400 mt-1">
                        {f.elo} ELO • {f.wins}W/{f.losses}L
                      </div>
                    </div>
                  </div>

                  {/* Animated Fighter Stage */}
                  <div className="relative h-48 flex items-end justify-center bg-gradient-to-t from-red-950/30 via-black/40 to-transparent rounded-xl border border-white/10 mb-3 overflow-hidden">
                    <div className="absolute bottom-3 w-40 h-8 rounded-full bg-shin-gold/20 blur-md border border-shin-gold/40" />
                    <img
                      src={getCharGif(f.charId)}
                      alt={f.name}
                      className="w-40 h-40 object-contain scale-125 origin-bottom animate-float-idle z-10"
                      style={{ imageRendering: 'pixelated' }}
                    />
                    <div className="absolute top-2.5 left-2.5 px-2.5 py-1 rounded-full bg-black/80 border border-emerald-500/40 text-[10px] font-cinzel text-emerald-400 flex items-center gap-1.5">
                      <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
                      <span>Style: {doctrine.name}</span>
                    </div>
                  </div>

                  {/* Fighter Attributes */}
                  <div className="grid grid-cols-3 gap-2 mb-2 text-center">
                    <div className="bg-white/5 border border-white/10 rounded-lg p-2">
                      <div className="text-[9px] text-gray-400 uppercase">Attack</div>
                      <div className="text-sm font-mono font-bold text-red-400">{f.atk}</div>
                    </div>
                    <div className="bg-white/5 border border-white/10 rounded-lg p-2">
                      <div className="text-[9px] text-gray-400 uppercase">Defense</div>
                      <div className="text-sm font-mono font-bold text-emerald-400">{f.def}</div>
                    </div>
                    <div className="bg-white/5 border border-white/10 rounded-lg p-2">
                      <div className="text-[9px] text-gray-400 uppercase">Speed</div>
                      <div className="text-sm font-mono font-bold text-blue-400">{f.spd}</div>
                    </div>
                  </div>

                  {/* Fights, Wins, Losses & Ranking */}
                  <div className="grid grid-cols-4 gap-2 mb-3 text-center">
                    <div className="bg-white/5 border border-white/10 rounded-lg p-2">
                      <div className="text-[9px] text-gray-400 uppercase">Fights</div>
                      <div className="text-sm font-mono font-bold text-white">{totalFights}</div>
                    </div>
                    <div className="bg-white/5 border border-white/10 rounded-lg p-2">
                      <div className="text-[9px] text-gray-400 uppercase">Wins</div>
                      <div className="text-sm font-mono font-bold text-emerald-400">{f.wins}</div>
                    </div>
                    <div className="bg-white/5 border border-white/10 rounded-lg p-2">
                      <div className="text-[9px] text-gray-400 uppercase">Losses</div>
                      <div className="text-sm font-mono font-bold text-red-400">{f.losses}</div>
                    </div>
                    <div className="bg-white/5 border border-white/10 rounded-lg p-2">
                      <div className="text-[9px] text-gray-400 uppercase">Ranking</div>
                      <div className="text-sm font-mono font-bold text-shin-gold">{rankLabel}</div>
                    </div>
                  </div>

                  {/* War Chest & Stake Info */}
                  <div className="bg-black/80 border border-shin-gold/30 rounded-xl p-2.5 flex items-center justify-between">
                    <div>
                      <div className="text-[9px] text-gray-400 uppercase">
                        Fighter War Chest
                      </div>
                      <div className="text-xs font-mono font-bold text-shin-gold">
                        {f.vaultBalanceNear.toFixed(2)} NEAR
                      </div>
                    </div>
                    <div className="text-right">
                      <div className="text-[9px] text-gray-400 uppercase">Stake Per Fight</div>
                      <div className="text-xs font-mono font-bold text-emerald-400">
                        {f.wagerPerFightNear.toFixed(1)} NEAR / Pool
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      <div className="mt-6 flex justify-center">
        <button
          onClick={onClose}
          className="px-10 py-2.5 bg-white/5 border border-white/15 hover:border-white text-gray-300 hover:text-white transition-all font-cinzel tracking-[0.25em] uppercase text-xs rounded-lg cursor-pointer"
        >
          Return to Menu
        </button>
      </div>
    </div>
  );
}
