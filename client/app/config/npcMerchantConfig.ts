/**
 * ============================================================================
 * SHIN: THE STRUGGLE — MODULAR NPC MERCHANT PRICING & BEHAVIOR CONFIGURATION
 * ============================================================================
 * Structured in a single readable configuration file per Track 09 (`09-games.md`):
 * - All items use NEP-245 Multi-Token IDs (`material:*`, `scroll:*`).
 * - Each NPC merchant is an autonomous agent with its own `.shin-arena.testnet`
 *   wallet, NEP-245 inventory stock, and dynamic supply/demand pricing engine.
 * - Flooding a merchant with materials drives prices down and drains their NEAR
 *   wallet. If a merchant's wallet drops below `insolvencyThresholdNear`, the
 *   shop closes (`isShopOpen = false`) until a player invests NEAR to reopen it.
 */

export interface Nep245CatalogItem {
  tokenId: string;
  name: string;
  category: 'MATERIAL' | 'SCROLL';
  icon: string;
  description: string;
  statBoost?: {
    atk?: number;
    def?: number;
    spd?: number;
    powerLevel?: number;
  };
}

export interface MerchantItemRule {
  tokenId: string;
  basePriceNear: number;
  minPriceNear: number;
  maxPriceNear: number;
  initialStock: number;
  targetStock: number;
  /** How strongly scarcity/surplus shifts price (e.g., 0.65 = up to ±65% from stock ratio) */
  stockElasticity: number;
  /** Price bump per net unit bought in the recent window */
  demandSensitivity: number;
  /** Spread between NPC Ask (buy from NPC) and NPC Bid (sell to NPC) */
  bidSpreadRatio: number;
}

export interface NpcMerchantConfig {
  merchantId: 'hanzo-dojo' | 'kenji-forge';
  name: string;
  title: string;
  walletId: string;
  avatarGif: string;
  specialty: string;
  initialWalletNear: number;
  /** If wallet balance falls below this threshold, the NPC goes broke and closes shop */
  insolvencyThresholdNear: number;
  /** Minimum NEAR injection required to reopen or invest in the shop */
  minInvestmentNear: number;
  /** Percentage of every trade's spread paid out to player investors */
  investorDividendRate: number;
  items: MerchantItemRule[];
}

export const NEP245_ITEM_CATALOG: Record<string, Nep245CatalogItem> = {
  'material:tamahagane-steel': {
    tokenId: 'material:tamahagane-steel',
    name: 'Tamahagane Shadow Steel',
    category: 'MATERIAL',
    icon: '⛏️',
    description:
      'High-carbon折り返し鍛錬 (folded steel) salvaged from defeated arena armor. Flood the forge to crash prices, or sell when scarce.',
  },
  'material:spirit-ember': {
    tokenId: 'material:spirit-ember',
    name: 'Blood-Moon Spirit Ember',
    category: 'MATERIAL',
    icon: '🔥',
    description:
      'Condensed ki crystal harvested after Spirit Dash-Strike KOs. Used by Grandmaster Hanzo to ink forbidden scrolls.',
  },
  'scroll:crimson-katana': {
    tokenId: 'scroll:crimson-katana',
    name: 'Scroll of the Crimson Katana',
    category: 'SCROLL',
    icon: '📜',
    description:
      'NEP-245 Combat Technique Scroll. Permanently grants +3 ATK and +1 Power Level to a Fighter NFT.',
    statBoost: { atk: 3, powerLevel: 1 },
  },
  'scroll:iron-posture': {
    tokenId: 'scroll:iron-posture',
    name: 'Scroll of Iron Posture',
    category: 'SCROLL',
    icon: '🛡️',
    description:
      'NEP-245 Defensive Technique Scroll. Permanently grants +3 DEF and +1 Power Level to a Fighter NFT.',
    statBoost: { def: 3, powerLevel: 1 },
  },
  'scroll:shadow-step-mastery': {
    tokenId: 'scroll:shadow-step-mastery',
    name: 'Scroll of Shadow-Step Mastery',
    category: 'SCROLL',
    icon: '⚡',
    description:
      'NEP-245 Shinobi Footwork Scroll. Permanently grants +3 SPD and +1 Power Level to a Fighter NFT.',
    statBoost: { spd: 3, powerLevel: 1 },
  },
};

export const NPC_MERCHANT_CONFIGS: NpcMerchantConfig[] = [
  {
    merchantId: 'hanzo-dojo',
    name: 'Grandmaster Hanzo',
    title: 'Shadow Clan Scroll Merchant',
    walletId: 'hanzo-dojo-npc.shin-arena.testnet',
    avatarGif: '/assets/Shin_gifs/Shinobi_idle.gif',
    specialty: 'Sells NEP-245 Shinobi Scrolls & buys Blood-Moon Spirit Embers',
    initialWalletNear: 12.0,
    insolvencyThresholdNear: 0.8,
    minInvestmentNear: 5.0,
    investorDividendRate: 0.15,
    items: [
      {
        tokenId: 'scroll:crimson-katana',
        basePriceNear: 0.85,
        minPriceNear: 0.25,
        maxPriceNear: 3.2,
        initialStock: 6,
        targetStock: 8,
        stockElasticity: 0.65,
        demandSensitivity: 0.08,
        bidSpreadRatio: 0.72,
      },
      {
        tokenId: 'scroll:iron-posture',
        basePriceNear: 0.75,
        minPriceNear: 0.25,
        maxPriceNear: 2.8,
        initialStock: 10,
        targetStock: 8,
        stockElasticity: 0.6,
        demandSensitivity: 0.07,
        bidSpreadRatio: 0.72,
      },
      {
        tokenId: 'scroll:shadow-step-mastery',
        basePriceNear: 0.8,
        minPriceNear: 0.25,
        maxPriceNear: 3.0,
        initialStock: 7,
        targetStock: 8,
        stockElasticity: 0.65,
        demandSensitivity: 0.08,
        bidSpreadRatio: 0.72,
      },
      {
        tokenId: 'material:spirit-ember',
        basePriceNear: 0.55,
        minPriceNear: 0.12,
        maxPriceNear: 1.8,
        initialStock: 8,
        targetStock: 10,
        stockElasticity: 0.75,
        demandSensitivity: 0.09,
        bidSpreadRatio: 0.82,
      },
    ],
  },
  {
    merchantId: 'kenji-forge',
    name: 'Master Blacksmith Kenji',
    title: 'Tamahagane Iron & Armory Agent',
    walletId: 'kenji-forge-npc.shin-arena.testnet',
    avatarGif: '/assets/Shin_gifs/Samurai_idle.gif',
    specialty: 'Buys & trades Tamahagane Shadow Steel and forges Katana/Armor Scrolls',
    initialWalletNear: 6.5,
    insolvencyThresholdNear: 0.8,
    minInvestmentNear: 5.0,
    investorDividendRate: 0.18,
    items: [
      {
        tokenId: 'material:tamahagane-steel',
        basePriceNear: 0.6,
        minPriceNear: 0.1,
        maxPriceNear: 2.1,
        initialStock: 12,
        targetStock: 12,
        stockElasticity: 0.8,
        demandSensitivity: 0.1,
        bidSpreadRatio: 0.85,
      },
      {
        tokenId: 'material:spirit-ember',
        basePriceNear: 0.5,
        minPriceNear: 0.1,
        maxPriceNear: 1.75,
        initialStock: 11,
        targetStock: 10,
        stockElasticity: 0.7,
        demandSensitivity: 0.08,
        bidSpreadRatio: 0.8,
      },
      {
        tokenId: 'scroll:crimson-katana',
        basePriceNear: 0.82,
        minPriceNear: 0.25,
        maxPriceNear: 3.0,
        initialStock: 5,
        targetStock: 6,
        stockElasticity: 0.65,
        demandSensitivity: 0.08,
        bidSpreadRatio: 0.75,
      },
    ],
  },
];

/**
 * Pure Supply & Demand Pricing Function:
 * - When `currentStock < targetStock`, scarcity drives the price UP.
 * - When players flood the merchant with an item (`currentStock > targetStock`), surplus drives the price DOWN.
 * - Recent net demand (`netDemandDelta` = recent buys minus recent sells) adds momentum.
 */
export function computeDynamicItemPrices(
  rule: MerchantItemRule,
  currentStock: number,
  netDemandDelta: number,
): {
  askPriceNear: number;
  bidPriceNear: number;
  scarcityRatio: number;
  priceTrend: 'SURGING' | 'CHEAP_SURPLUS' | 'BALANCED';
} {
  const safeStock = Math.max(0.5, currentStock);
  const stockDeviation = (rule.targetStock - safeStock) / rule.targetStock;
  const stockMultiplier = 1 + stockDeviation * rule.stockElasticity;
  const demandMultiplier = 1 + netDemandDelta * rule.demandSensitivity;

  const rawAsk = rule.basePriceNear * stockMultiplier * demandMultiplier;
  const askPriceNear = Number(
    Math.min(rule.maxPriceNear, Math.max(rule.minPriceNear, rawAsk)).toFixed(2),
  );
  const bidPriceNear = Number(
    Math.max(0.05, askPriceNear * rule.bidSpreadRatio).toFixed(2),
  );

  let priceTrend: 'SURGING' | 'CHEAP_SURPLUS' | 'BALANCED' = 'BALANCED';
  if (askPriceNear >= rule.basePriceNear * 1.18) {
    priceTrend = 'SURGING';
  } else if (askPriceNear <= rule.basePriceNear * 0.82) {
    priceTrend = 'CHEAP_SURPLUS';
  }

  return {
    askPriceNear,
    bidPriceNear,
    scarcityRatio: Number((rule.targetStock / safeStock).toFixed(2)),
    priceTrend,
  };
}

/**
 * Generates the human-readable active reasoning string displayed in the UI tooltip
 * so players and hackathon judges can inspect the NPC merchant's internal economic logic.
 */
export function generateMerchantReasoning(params: {
  merchantName: string;
  walletId: string;
  walletBalanceNear: number;
  insolvencyThresholdNear: number;
  items: {
    tokenId: string;
    name: string;
    stock: number;
    targetStock: number;
    askPriceNear: number;
    bidPriceNear: number;
    basePriceNear: number;
    netDemandDelta: number;
  }[];
  lastActionSummary?: string;
}): string {
  if (params.walletBalanceNear < params.insolvencyThresholdNear) {
    return `[SHOP CLOSED — INSOLVENT] My wallet (${params.walletId}) is down to ${params.walletBalanceNear.toFixed(2)} NEAR after heavy material buybacks. I cannot purchase stock or ink new scrolls until an investor injects NEAR liquidity into my shop!`;
  }

  const scarce = [...params.items].sort(
    (a, b) => a.stock / a.targetStock - b.stock / b.targetStock,
  )[0];
  const flooded = [...params.items].sort(
    (a, b) => b.stock / b.targetStock - a.stock / a.targetStock,
  )[0];

  const parts: string[] = [];
  if (params.lastActionSummary) {
    parts.push(params.lastActionSummary);
  }

  if (scarce && scarce.stock < scarce.targetStock) {
    const pct = Math.round(
      ((scarce.askPriceNear - scarce.basePriceNear) / scarce.basePriceNear) * 100,
    );
    parts.push(
      `Stock of ${scarce.name} is low (${scarce.stock}/${scarce.targetStock} units), so I raised my ask price ${pct >= 0 ? `+${pct}%` : `${pct}%`} to ${scarce.askPriceNear.toFixed(2)} NEAR.`,
    );
  }

  if (flooded && flooded.stock > flooded.targetStock * 1.15) {
    const pct = Math.round(
      ((flooded.bidPriceNear - flooded.basePriceNear) / flooded.basePriceNear) * 100,
    );
    parts.push(
      `Warriors flooded my shop with ${flooded.name} (${flooded.stock} in stock vs ${flooded.targetStock} target) — I slashed my buyback price (${pct}%) to ${flooded.bidPriceNear.toFixed(2)} NEAR to protect my ${params.walletBalanceNear.toFixed(2)} NEAR treasury.`,
    );
  }

  if (parts.length === 0) {
    parts.push(
      `Treasury healthy at ${params.walletBalanceNear.toFixed(2)} NEAR. Inventory is near equilibrium across all ${params.items.length} NEP-245 item lines; quoting baseline spread.`,
    );
  }

  return parts.join(' ');
}
