'use client';

import React, { useEffect, useState } from 'react';
import { ExternalLink, Terminal, X } from 'lucide-react';
import { nearArenaEngine } from '../services/nearArenaEngine';

interface NearInspectorModalProps {
  isOpen: boolean;
  onClose: () => void;
  onOpenFullLedger?: () => void;
}

const ARENA_CONTRACT_ID =
  process.env.NEXT_PUBLIC_ARENA_CONTRACT_ID || 'shin-arena-28d.testnet';
const SHIN_TOKEN_ID =
  process.env.NEXT_PUBLIC_SHIN_TOKEN_ID || 'shin.shin-arena-28d.testnet';

export const NearInspectorModal: React.FC<NearInspectorModalProps> = ({
  isOpen,
  onClose,
  onOpenFullLedger,
}) => {
  const [arenaState, setArenaState] = useState(() => nearArenaEngine.getState());
  const [onChainOnly, setOnChainOnly] = useState(false);

  useEffect(() => {
    if (!isOpen) return;
    setArenaState({ ...nearArenaEngine.getState() });
    const sync = () => setArenaState({ ...nearArenaEngine.getState() });
    window.addEventListener('nearArenaStateUpdated', sync);
    return () => window.removeEventListener('nearArenaStateUpdated', sync);
  }, [isOpen]);

  if (!isOpen) return null;

  const ownedWarriors = arenaState.fighters.filter((f) => !f.isNpc);
  const visibleLedger = onChainOnly
    ? arenaState.ledger.filter((tx) => tx.onChain)
    : arenaState.ledger;

  return (
    <div className="fixed inset-0 z-[120] bg-black/85 backdrop-blur-md flex items-center justify-center p-4">
      <div className="bg-zinc-950 border-2 border-emerald-500/40 rounded-2xl max-w-4xl w-full max-h-[88vh] flex flex-col shadow-[0_0_50px_rgba(16,185,129,0.2)] overflow-hidden">
        {/* Header */}
        <div className="flex items-start justify-between gap-4 px-6 py-4 border-b border-white/10 bg-black/60">
          <div>
            <div className="flex items-center gap-2 text-[10px] font-mono text-emerald-400 uppercase tracking-widest">
              <Terminal size={12} />
              <span>NEAR Testnet Under-The-Hood Inspector</span>
            </div>
            <h2 className="text-lg md:text-xl font-cinzel font-black text-white uppercase mt-1">
              On-Chain Activity &amp; Contract Ledger
            </h2>
            <p className="text-xs text-gray-400 mt-0.5">
              Live Web3 transactions, sub-account settlements, and token transfers running invisibly
              behind the game.
            </p>
          </div>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-white p-1.5 rounded-lg border border-white/10 hover:border-white/30 cursor-pointer"
            aria-label="Close NEAR Inspector"
          >
            <X size={16} />
          </button>
        </div>

        {/* Scrollable Body */}
        <div className="flex-1 overflow-y-auto p-6 space-y-5">
          {/* Contracts & Session Account */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3 text-xs">
            <div className="bg-black/80 border border-emerald-500/30 rounded-xl p-3.5">
              <div className="font-mono font-bold text-emerald-400 mb-1">
                1. Player Session Account
              </div>
              <div className="font-mono text-[11px] text-white break-all">
                {arenaState.playerWallet.accountId}
              </div>
              <div className="font-mono text-[10px] text-gray-400 mt-1">
                {Math.round(arenaState.playerWallet.NEAR * 1000).toLocaleString()} $SHIN •{' '}
                {arenaState.playerWallet.NEAR.toFixed(2)} NEAR
              </div>
              {arenaState.playerWallet.accountId.endsWith('.shin-arena.testnet') ? (
                <span className="inline-block text-[10px] font-mono text-gray-500 mt-1.5">
                  Guest / Local Session (Sign in for on-chain wallet)
                </span>
              ) : (
                <a
                  href={`https://testnet.nearblocks.io/address/${arenaState.playerWallet.accountId}`}
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex items-center gap-1 text-[10px] font-mono text-blue-400 hover:underline mt-1.5"
                >
                  NearBlocks <ExternalLink size={10} />
                </a>
              )}
            </div>

            <div className="bg-black/80 border border-shin-gold/30 rounded-xl p-3.5">
              <div className="font-mono font-bold text-shin-gold mb-1">
                2. Budōkan &amp; $SHIN Contracts
              </div>
              <div className="font-mono text-[11px] text-white truncate">
                Arena: {ARENA_CONTRACT_ID}
              </div>
              <div className="font-mono text-[10px] text-gray-400 truncate mt-0.5">
                Token: {SHIN_TOKEN_ID}
              </div>
              <div className="flex items-center gap-3 mt-1.5">
                <a
                  href={`https://testnet.nearblocks.io/address/${ARENA_CONTRACT_ID}`}
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex items-center gap-1 text-[10px] font-mono text-blue-400 hover:underline"
                >
                  Arena <ExternalLink size={10} />
                </a>
                <a
                  href={`https://testnet.nearblocks.io/address/${SHIN_TOKEN_ID}`}
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex items-center gap-1 text-[10px] font-mono text-blue-400 hover:underline"
                >
                  $SHIN <ExternalLink size={10} />
                </a>
              </div>
            </div>

            <div className="bg-black/80 border border-white/15 rounded-xl p-3.5">
              <div className="font-mono font-bold text-purple-300 mb-1">
                3. Dojo &amp; Sensei Vault
              </div>
              <div className="font-mono text-[11px] text-white truncate">
                {ARENA_CONTRACT_ID} (Dojo Escrow)
              </div>
              <div className="font-mono text-[10px] text-gray-400 mt-1">
                Treasury: {Math.round(arenaState.npcDojo.treasuryBalanceNear * 1000).toLocaleString()} $SHIN
              </div>
              <a
                href={`https://testnet.nearblocks.io/address/${ARENA_CONTRACT_ID}`}
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center gap-1 text-[10px] font-mono text-blue-400 hover:underline mt-1.5"
              >
                NearBlocks <ExternalLink size={10} />
              </a>
            </div>
          </div>

          {/* All On-Chain Transactions & Activities */}
          <div className="bg-white/5 border border-white/10 rounded-xl p-4">
            <div className="flex flex-wrap items-center justify-between gap-2 mb-3">
              <span className="text-xs font-mono font-bold text-white uppercase">
                Live Transactions &amp; Activities ({visibleLedger.length})
              </span>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => setOnChainOnly(!onChainOnly)}
                  className={`text-[10px] font-mono px-2.5 py-1 rounded border cursor-pointer ${
                    onChainOnly
                      ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/50'
                      : 'bg-black/60 text-gray-400 border-white/15 hover:text-white'
                  }`}
                >
                  {onChainOnly ? '✓ On-Chain Only' : 'Show On-Chain Only'}
                </button>
                {onOpenFullLedger && (
                  <button
                    onClick={() => {
                      onClose();
                      onOpenFullLedger();
                    }}
                    className="text-[11px] font-mono text-shin-gold hover:underline cursor-pointer"
                  >
                    Open Scroll of Battles →
                  </button>
                )}
              </div>
            </div>

            {visibleLedger.length === 0 ? (
              <div className="text-xs font-mono text-gray-500 py-6 text-center">
                {onChainOnly
                  ? 'No confirmed NEAR Testnet transactions yet. Sign in and duel, back a warrior, or swap $SHIN to see live on-chain receipts here.'
                  : 'No activity recorded yet. Start a duel, back a warrior, or swap $SHIN to see live transactions here.'}
              </div>
            ) : (
              <div className="space-y-2 max-h-72 overflow-y-auto pr-1">
                {visibleLedger.map((tx) => (
                  <div
                    key={tx.id}
                    className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-[11px] font-mono bg-black/75 border border-white/10 px-3.5 py-2.5 rounded-lg"
                  >
                    <div className="space-y-0.5 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span
                          className={`text-[9px] font-bold px-2 py-0.5 rounded border ${
                            tx.onChain
                              ? 'bg-emerald-500/15 text-emerald-300 border-emerald-500/30'
                              : 'bg-white/5 text-gray-400 border-white/15'
                          }`}
                        >
                          {tx.onChain ? 'ON-CHAIN' : 'LOCAL SIM'}
                        </span>
                        <span className="text-[9px] font-bold px-2 py-0.5 rounded bg-shin-gold/15 text-shin-gold border border-shin-gold/30">
                          {tx.type}
                        </span>
                        <span className="text-gray-200 font-sans text-xs">{tx.summary}</span>
                      </div>
                      <div className="text-[10px] text-gray-500 truncate">
                        Actor: {tx.actorWallet} • {new Date(tx.timestamp).toLocaleTimeString()}
                      </div>
                    </div>

                    <div className="flex items-center gap-3 shrink-0">
                      {tx.amountNear > 0 && (
                        <span className="text-shin-gold font-bold">
                          {Math.round(tx.amountNear * 1000).toLocaleString()} $SHIN
                        </span>
                      )}
                      {tx.onChain ? (
                        <a
                          href={tx.explorerUrl || `https://testnet.nearblocks.io/txns/${tx.txHash}`}
                          target="_blank"
                          rel="noreferrer"
                          className="text-blue-400 hover:underline inline-flex items-center gap-1"
                        >
                          NearBlocks <ExternalLink size={11} />
                        </a>
                      ) : (
                        <span className="text-[10px] text-gray-600">No Tx</span>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Owned Fighter Sub-Accounts */}
          <div className="bg-white/5 border border-white/10 rounded-xl p-4">
            <div className="text-xs font-mono font-bold text-white uppercase mb-2">
              Shinobi Sub-Account Wallets ({ownedWarriors.length})
            </div>
            <div className="space-y-1.5 max-h-36 overflow-y-auto">
              {ownedWarriors.map((f) => (
                <div
                  key={f.tokenId}
                  className="flex flex-wrap items-center justify-between gap-2 bg-black/70 px-3 py-2 rounded border border-white/10 text-[11px] font-mono"
                >
                  <span className="text-white font-bold">
                    {f.title} ({f.tokenId})
                  </span>
                  <a
                    href={`https://testnet.nearblocks.io/address/${ARENA_CONTRACT_ID}`}
                    target="_blank"
                    rel="noreferrer"
                    className="text-shin-gold hover:underline inline-flex items-center gap-1"
                  >
                    Vault on {ARENA_CONTRACT_ID} <ExternalLink size={10} />
                  </a>
                  <span className="text-emerald-400">
                    Pouch: {Math.round(f.vaultBalanceNear * 1000).toLocaleString()} $SHIN
                  </span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default NearInspectorModal;
