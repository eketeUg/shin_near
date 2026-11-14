'use client';

import React, { useEffect, useMemo, useState } from 'react';
import { X, Send, ExternalLink, Loader2, User, Wallet, CheckCircle2, AlertTriangle } from 'lucide-react';
import { nearArenaEngine } from '../services/nearArenaEngine';

interface RegisteredPlayer {
  username: string;
  walletAddress: string;
  rating?: number;
  level?: number;
}

interface SendTokenModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSent?: () => void;
  currentWallet: string;
  isGuest?: boolean;
}

type TokenSymbol = 'SHIN' | 'NEAR' | 'USDC';

export default function SendTokenModal({
  isOpen,
  onClose,
  onSent,
  currentWallet,
  isGuest,
}: SendTokenModalProps) {
  const [token, setToken] = useState<TokenSymbol>('SHIN');
  const [recipient, setRecipient] = useState('');
  const [amount, setAmount] = useState('');
  const [players, setPlayers] = useState<RegisteredPlayer[]>([]);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [sending, setSending] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [successInfo, setSuccessInfo] = useState<{
    message: string;
    explorerUrl?: string;
  } | null>(null);

  const serverUrl = process.env.NEXT_PUBLIC_SERVER_URL || 'http://localhost:3001';
  const wallet = nearArenaEngine.getState().playerWallet;

  useEffect(() => {
    if (!isOpen) return;
    setErrorMsg(null);
    setSuccessInfo(null);
    fetch(`${serverUrl}/api/users`, { credentials: 'include' })
      .then((res) => (res.ok ? res.json() : []))
      .then((list: RegisteredPlayer[]) => {
        if (Array.isArray(list)) {
          setPlayers(
            list.filter(
              (p) =>
                p.walletAddress &&
                p.walletAddress.toLowerCase() !== (currentWallet || '').toLowerCase(),
            ),
          );
        }
      })
      .catch(() => {});
  }, [isOpen, currentWallet, serverUrl]);

  const filteredPlayers = useMemo(() => {
    const q = recipient.trim().replace(/^@/, '').toLowerCase();
    if (!q) return players.slice(0, 6);
    return players
      .filter(
        (p) =>
          p.username?.toLowerCase().includes(q) ||
          p.walletAddress?.toLowerCase().includes(q),
      )
      .slice(0, 6);
  }, [players, recipient]);

  if (!isOpen) return null;

  const balances: Record<TokenSymbol, number> = {
    SHIN: wallet.SHIN ?? 0,
    NEAR: wallet.NEAR ?? 0,
    USDC: wallet.USDC ?? 0,
  };

  const selectedBalance = balances[token];

  const handleSetPercent = (pct: number) => {
    if (selectedBalance <= 0) return;
    const raw =
      token === 'NEAR' && pct === 1
        ? Math.max(0, selectedBalance - 0.01)
        : selectedBalance * pct;
    const formatted =
      token === 'NEAR'
        ? raw.toFixed(4).replace(/\.?0+$/, '')
        : raw.toFixed(2).replace(/\.?0+$/, '');
    setAmount(formatted || '0');
  };

  const handleSend = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isGuest) {
      setErrorMsg('Guest players cannot send on-chain tokens. Sign in with Google or Email first.');
      return;
    }

    const cleanRecipient = recipient.trim();
    const numAmount = Number(amount);
    if (!cleanRecipient) {
      setErrorMsg('Enter a player username, .testnet address, or NEAR wallet address.');
      return;
    }
    if (!Number.isFinite(numAmount) || numAmount <= 0) {
      setErrorMsg('Enter a valid positive amount.');
      return;
    }

    setSending(true);
    setErrorMsg(null);
    setSuccessInfo(null);

    try {
      const res = await fetch(`${serverUrl}/api/near/transfer`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          recipient: cleanRecipient,
          token,
          amount: amount.trim(),
        }),
      });

      const data = await res.json().catch(() => ({}));
      if (!res.ok || !data?.ok) {
        setErrorMsg(data?.error || 'Transfer failed. Please check the recipient and balance.');
        return;
      }

      const destLabel = data.recipientUsername
        ? `${data.recipientUsername} (${data.recipient.slice(0, 10)}...)`
        : data.recipient;
      setSuccessInfo({
        message: `Sent ${amount.trim()} ${token} to ${destLabel}`,
        explorerUrl: data.explorerUrl,
      });
      setAmount('');
      if (currentWallet) {
        await nearArenaEngine.syncOnChainState(currentWallet);
      }
      onSent?.();
    } catch (err: any) {
      setErrorMsg(err?.message || 'Network error while sending tokens.');
    } finally {
      setSending(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4">
      <div className="w-full max-w-md bg-gradient-to-b from-gray-900 via-black to-black border border-shin-gold/40 rounded-2xl p-5 shadow-2xl relative animate-in fade-in zoom-in duration-200">
        <div className="flex items-center justify-between border-b border-white/10 pb-3 mb-4">
          <div className="flex items-center gap-2">
            <Send size={18} className="text-shin-gold" />
            <h3 className="text-base font-cinzel font-bold text-white uppercase tracking-wider">
              Send Tokens
            </h3>
          </div>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-white transition-colors cursor-pointer"
          >
            <X size={20} />
          </button>
        </div>

        {isGuest ? (
          <div className="bg-amber-500/10 border border-amber-500/30 rounded-xl p-4 text-xs font-mono text-amber-300 flex items-start gap-2.5">
            <AlertTriangle size={16} className="shrink-0 mt-0.5" />
            <span>
              Guest sessions cannot send on-chain tokens. Sign in with Google or Email to use your embedded NEAR wallet.
            </span>
          </div>
        ) : (
          <form onSubmit={handleSend} className="space-y-4">
            {/* Token Selector */}
            <div>
              <label className="text-[10px] font-mono text-gray-400 uppercase tracking-widest block mb-1.5">
                Select Token
              </label>
              <div className="grid grid-cols-3 gap-2">
                {(['SHIN', 'NEAR', 'USDC'] as TokenSymbol[]).map((sym) => (
                  <button
                    key={sym}
                    type="button"
                    onClick={() => {
                      setToken(sym);
                      setErrorMsg(null);
                    }}
                    className={`py-2 px-3 rounded-xl border text-left transition-all cursor-pointer ${
                      token === sym
                        ? 'bg-shin-gold/20 border-shin-gold text-white'
                        : 'bg-white/5 border-white/10 text-gray-400 hover:border-white/30'
                    }`}
                  >
                    <div className="text-xs font-cinzel font-bold">
                      {sym === 'SHIN' ? '$SHIN' : sym}
                    </div>
                    <div className="text-[10px] font-mono text-gray-300 truncate">
                      {balances[sym].toFixed(sym === 'NEAR' ? 3 : 2)}
                    </div>
                  </button>
                ))}
              </div>
            </div>

            {/* Recipient Input + Player Suggestions */}
            <div className="relative">
              <label className="text-[10px] font-mono text-gray-400 uppercase tracking-widest block mb-1.5">
                Recipient (Player Username, .testnet, or Wallet Address)
              </label>
              <div className="relative">
                <input
                  type="text"
                  value={recipient}
                  onFocus={() => setShowSuggestions(true)}
                  onBlur={() => setTimeout(() => setShowSuggestions(false), 180)}
                  onChange={(e) => {
                    setRecipient(e.target.value);
                    setShowSuggestions(true);
                    setErrorMsg(null);
                  }}
                  placeholder="e.g. shinobi20, alice.testnet, or 64-char hex"
                  className="w-full bg-black/80 border border-white/15 focus:border-shin-gold rounded-xl px-3.5 py-2.5 text-xs font-mono text-white placeholder:text-gray-600 outline-none"
                />
              </div>

              {showSuggestions && filteredPlayers.length > 0 && (
                <div className="absolute z-20 left-0 right-0 mt-1 bg-gray-950 border border-shin-gold/30 rounded-xl shadow-xl max-h-44 overflow-y-auto divide-y divide-white/5">
                  <div className="px-3 py-1.5 text-[9px] font-mono text-gray-500 uppercase tracking-wider">
                    Registered Players
                  </div>
                  {filteredPlayers.map((p) => (
                    <button
                      key={p.walletAddress}
                      type="button"
                      onMouseDown={(e) => {
                        e.preventDefault();
                        setRecipient(p.username || p.walletAddress);
                        setShowSuggestions(false);
                      }}
                      className="w-full px-3 py-2 flex items-center justify-between hover:bg-white/5 text-left cursor-pointer"
                    >
                      <div className="flex items-center gap-2 min-w-0">
                        <User size={12} className="text-shin-gold shrink-0" />
                        <span className="text-xs font-mono text-white truncate">
                          {p.username}
                        </span>
                      </div>
                      <span className="text-[10px] font-mono text-gray-500 flex items-center gap-1 shrink-0 ml-2">
                        <Wallet size={10} />
                        {p.walletAddress.slice(0, 6)}...{p.walletAddress.slice(-4)}
                      </span>
                    </button>
                  ))}
                </div>
              )}
            </div>

            {/* Amount Input */}
            <div>
              <div className="flex items-center justify-between mb-1.5">
                <label className="text-[10px] font-mono text-gray-400 uppercase tracking-widest">
                  Amount ({token === 'SHIN' ? '$SHIN' : token})
                </label>
                <div className="flex items-center gap-1.5">
                  {[
                    { label: '25%', pct: 0.25 },
                    { label: '50%', pct: 0.5 },
                    { label: 'MAX', pct: 1 },
                  ].map((b) => (
                    <button
                      key={b.label}
                      type="button"
                      onClick={() => handleSetPercent(b.pct)}
                      className="px-1.5 py-0.5 rounded bg-white/5 hover:bg-shin-gold/20 border border-white/10 text-[9px] font-mono text-shin-gold cursor-pointer"
                    >
                      {b.label}
                    </button>
                  ))}
                </div>
              </div>
              <input
                type="number"
                step="any"
                min="0"
                value={amount}
                onChange={(e) => {
                  setAmount(e.target.value);
                  setErrorMsg(null);
                }}
                placeholder={`0.00 ${token}`}
                className="w-full bg-black/80 border border-white/15 focus:border-shin-gold rounded-xl px-3.5 py-2.5 text-sm font-mono text-white placeholder:text-gray-600 outline-none"
              />
            </div>

            {errorMsg && (
              <div className="bg-red-950/60 border border-red-500/40 rounded-xl p-3 text-xs font-mono text-red-300 flex items-start gap-2">
                <AlertTriangle size={14} className="shrink-0 mt-0.5" />
                <span>{errorMsg}</span>
              </div>
            )}

            {successInfo && (
              <div className="bg-emerald-950/50 border border-emerald-500/40 rounded-xl p-3 text-xs font-mono text-emerald-300 space-y-1.5">
                <div className="flex items-center gap-2">
                  <CheckCircle2 size={14} className="shrink-0" />
                  <span>{successInfo.message}</span>
                </div>
                {successInfo.explorerUrl && (
                  <a
                    href={successInfo.explorerUrl}
                    target="_blank"
                    rel="noreferrer"
                    className="inline-flex items-center gap-1 text-[11px] text-shin-gold hover:underline"
                  >
                    <span>View on NearBlocks Explorer</span>
                    <ExternalLink size={11} />
                  </a>
                )}
              </div>
            )}

            <button
              type="submit"
              disabled={sending}
              className="w-full py-2.5 bg-shin-gold hover:bg-amber-400 disabled:opacity-50 text-black font-cinzel font-bold uppercase tracking-widest text-xs rounded-xl flex items-center justify-center gap-2 cursor-pointer transition-all"
            >
              {sending ? (
                <>
                  <Loader2 size={14} className="animate-spin" />
                  <span>Sending On-Chain...</span>
                </>
              ) : (
                <>
                  <Send size={14} />
                  <span>Send {token === 'SHIN' ? '$SHIN' : token}</span>
                </>
              )}
            </button>
          </form>
        )}
      </div>
    </div>
  );
}
