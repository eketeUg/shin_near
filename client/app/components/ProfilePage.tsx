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
} from 'lucide-react';
import { nearArenaEngine } from '../services/nearArenaEngine';

interface ProfilePageProps {
  user: any;
  onClose: () => void;
  onUpdateSuccess: (updatedUser: any) => void;
}

export default function ProfilePage({ user, onClose, onUpdateSuccess }: ProfilePageProps) {
  const arenaState = nearArenaEngine.getState();
  const [isEditing, setIsEditing] = useState(false);
  const [newUsername, setNewUsername] = useState(
    user?.username || user?.userName || arenaState.playerWallet.username || 'Warrior',
  );
  const [copySuccess, setCopySuccess] = useState(false);

  const nearAccount = arenaState.playerWallet.accountId;

  useEffect(() => {
    if (!user?.isGuest && nearAccount) {
      void nearArenaEngine.syncOnChainState(nearAccount);
    }
  }, [nearAccount, user?.isGuest]);
  const ownedFighters = arenaState.fighters.filter((f) => !f.isNpc);
  const totalWins = ownedFighters.reduce((acc, f) => acc + f.wins, 0);
  const totalLosses = ownedFighters.reduce((acc, f) => acc + f.losses, 0);
  const bestElo = ownedFighters.reduce((max, f) => Math.max(max, f.elo), 1080);

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

  return (
    <div className="flex flex-col w-full max-w-2xl mx-auto animate-in fade-in zoom-in duration-300">
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
          </div>
        </div>
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
