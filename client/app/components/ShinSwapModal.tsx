'use client';

import React, { useEffect, useState } from 'react';
import { X, ArrowLeftRight, Sparkles, ExternalLink, Loader2 } from 'lucide-react';
import { utils } from 'near-api-js';
import { nearArenaEngine, AmmPoolInfo } from '../services/nearArenaEngine';

interface ShinSwapModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSwapped?: () => void;
}

export default function ShinSwapModal({ isOpen, onClose, onSwapped }: ShinSwapModalProps) {
  const [direction, setDirection] = useState<'NEAR_TO_SHIN' | 'SHIN_TO_NEAR'>('NEAR_TO_SHIN');
  const [amountInput, setAmountInput] = useState<string>('0.5');
  const [quoteOut, setQuoteOut] = useState<number>(0);
  const [ammInfo, setAmmInfo] = useState<AmmPoolInfo | null>(null);
  const [loadingQuote, setLoadingQuote] = useState(false);
  const [swapping, setSwapping] = useState(false);
  const [statusMsg, setStatusMsg] = useState<string | null>(null);
  const [txExplorerUrl, setTxExplorerUrl] = useState<string | null>(null);

  const wallet = nearArenaEngine.getState().playerWallet;

  useEffect(() => {
    if (!isOpen) return;
    setStatusMsg(null);
    setTxExplorerUrl(null);
    nearArenaEngine.getAmmInfo().then(setAmmInfo).catch(() => {});
  }, [isOpen]);

  useEffect(() => {
    if (!isOpen) return;
    const val = parseFloat(amountInput);
    if (!val || val <= 0) {
      setQuoteOut(0);
      return;
    }
    let cancelled = false;
    setLoadingQuote(true);
    const timer = setTimeout(async () => {
      try {
        const q =
          direction === 'NEAR_TO_SHIN'
            ? await nearArenaEngine.getAmmQuoteNearToShin(val)
            : await nearArenaEngine.getAmmQuoteShinToNear(val);
        if (!cancelled) setQuoteOut(q);
      } catch {
        if (!cancelled) setQuoteOut(0);
      } finally {
        if (!cancelled) setLoadingQuote(false);
      }
    }, 220);
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [isOpen, amountInput, direction]);

  if (!isOpen) return null;

  const nearReserveDisplay = ammInfo
    ? Number(utils.format.formatNearAmount(ammInfo.near_reserve, 2).replace(/,/g, '')).toFixed(2)
    : '2.00';
  const shinReserveDisplay = ammInfo
    ? (Number(BigInt(ammInfo.shin_reserve) / BigInt('1000000000000000')) / 1000).toFixed(1)
    : '2000.0';

  const handleSwap = async () => {
    const val = parseFloat(amountInput);
    if (!val || val <= 0) return;
    setSwapping(true);
    setStatusMsg(null);
    setTxExplorerUrl(null);
    try {
      const res =
        direction === 'NEAR_TO_SHIN'
          ? await nearArenaEngine.swapNearForShin(val, quoteOut * 0.98)
          : await nearArenaEngine.swapShinForNear(val);

      if (res.ok) {
        setStatusMsg(
          direction === 'NEAR_TO_SHIN'
            ? `Swapped ${val} NEAR → ~${quoteOut.toFixed(2)} $SHIN!`
            : `Swapped ${val} $SHIN → ~${quoteOut.toFixed(4)} NEAR!`,
        );
        if (res.explorerUrl) setTxExplorerUrl(res.explorerUrl);
        const refreshed = await nearArenaEngine.getAmmInfo();
        setAmmInfo(refreshed);
        onSwapped?.();
      } else {
        setStatusMsg(res.error || 'Swap failed. Ensure you are signed in with a funded NEAR wallet.');
      }
    } catch (err: any) {
      setStatusMsg(err?.message || 'Swap failed');
    } finally {
      setSwapping(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4">
      <div className="w-full max-w-md rounded-2xl border border-amber-500/30 bg-zinc-950 p-6 shadow-2xl text-zinc-100">
        <div className="flex items-center justify-between border-b border-zinc-800 pb-4">
          <div className="flex items-center gap-2">
            <Sparkles className="h-5 w-5 text-amber-400" />
            <div>
              <h2 className="text-lg font-bold tracking-wide text-amber-300">
                NEAR ↔ $SHIN AMM SWAP
              </h2>
              <p className="text-[11px] text-zinc-400">
                Constant Product Pool (x · y = k) • 0.5% Fee (0.3% Dev / 0.2% LP)
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="rounded-lg p-1.5 text-zinc-400 hover:bg-zinc-800 hover:text-white"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Pool Reserves Bar */}
        <div className="mt-4 grid grid-cols-2 gap-2 rounded-xl border border-zinc-800 bg-zinc-900/60 p-3 text-xs">
          <div>
            <div className="text-zinc-500">Pool NEAR Reserve</div>
            <div className="font-mono font-bold text-emerald-400">{nearReserveDisplay} NEAR</div>
          </div>
          <div>
            <div className="text-zinc-500">Pool $SHIN Reserve</div>
            <div className="font-mono font-bold text-amber-400">{shinReserveDisplay} $SHIN</div>
          </div>
        </div>

        {/* Input Token */}
        <div className="mt-4 rounded-xl border border-zinc-800 bg-zinc-900 p-4">
          <div className="flex items-center justify-between text-xs text-zinc-400">
            <span>You Pay ({direction === 'NEAR_TO_SHIN' ? 'NEAR' : '$SHIN'})</span>
            <span>
              Bal:{' '}
              {direction === 'NEAR_TO_SHIN'
                ? `${(wallet.NEAR ?? 0).toFixed(3)} NEAR`
                : `${(wallet.SHIN ?? 0).toFixed(2)} $SHIN`}
            </span>
          </div>
          <div className="mt-2 flex items-center gap-3">
            <input
              type="number"
              min="0"
              step="0.1"
              value={amountInput}
              onChange={(e) => setAmountInput(e.target.value)}
              className="w-full bg-transparent text-2xl font-mono font-bold text-white outline-none"
              placeholder="0.0"
            />
            <span className="rounded-lg bg-zinc-800 px-3 py-1.5 text-xs font-bold text-amber-300">
              {direction === 'NEAR_TO_SHIN' ? 'NEAR' : '$SHIN'}
            </span>
          </div>
        </div>

        {/* Flip Direction */}
        <div className="my-2 flex justify-center">
          <button
            onClick={() =>
              setDirection((d) => (d === 'NEAR_TO_SHIN' ? 'SHIN_TO_NEAR' : 'NEAR_TO_SHIN'))
            }
            className="flex items-center gap-1.5 rounded-full border border-zinc-700 bg-zinc-900 px-3 py-1.5 text-xs font-semibold text-zinc-300 hover:border-amber-500/50 hover:text-amber-300"
          >
            <ArrowLeftRight className="h-3.5 w-3.5" />
            Flip Pair
          </button>
        </div>

        {/* Output Token */}
        <div className="rounded-xl border border-zinc-800 bg-zinc-900 p-4">
          <div className="flex items-center justify-between text-xs text-zinc-400">
            <span>You Receive ({direction === 'NEAR_TO_SHIN' ? '$SHIN' : 'NEAR'})</span>
            <span>0.5% AMM Fee Included</span>
          </div>
          <div className="mt-2 flex items-center justify-between">
            <div className="text-2xl font-mono font-bold text-emerald-400">
              {loadingQuote ? (
                <span className="flex items-center gap-2 text-sm text-zinc-400">
                  <Loader2 className="h-4 w-4 animate-spin" /> Quoting...
                </span>
              ) : (
                quoteOut.toFixed(direction === 'NEAR_TO_SHIN' ? 2 : 4)
              )}
            </div>
            <span className="rounded-lg bg-zinc-800 px-3 py-1.5 text-xs font-bold text-emerald-300">
              {direction === 'NEAR_TO_SHIN' ? '$SHIN' : 'NEAR'}
            </span>
          </div>
        </div>

        {statusMsg && (
          <div className="mt-4 rounded-xl border border-amber-500/30 bg-amber-500/10 p-3 text-xs text-amber-200">
            <div>{statusMsg}</div>
            {txExplorerUrl && (
              <a
                href={txExplorerUrl}
                target="_blank"
                rel="noreferrer"
                className="mt-1.5 inline-flex items-center gap-1 font-semibold text-emerald-400 underline"
              >
                View on NearBlocks <ExternalLink className="h-3 w-3" />
              </a>
            )}
          </div>
        )}

        <button
          disabled={swapping || !amountInput || parseFloat(amountInput) <= 0}
          onClick={handleSwap}
          className="mt-5 flex w-full items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-amber-500 to-orange-600 py-3 font-bold text-black shadow-lg transition hover:brightness-110 disabled:opacity-50"
        >
          {swapping ? (
            <>
              <Loader2 className="h-4 w-4 animate-spin" /> Executing On-Chain Swap...
            </>
          ) : (
            `Swap ${direction === 'NEAR_TO_SHIN' ? 'NEAR → $SHIN' : '$SHIN → NEAR'}`
          )}
        </button>
      </div>
    </div>
  );
}
