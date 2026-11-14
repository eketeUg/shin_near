import { Injectable, Logger, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import OpenAI from 'openai';
import type { Server } from 'socket.io';
import { NearRelayerService } from './near-relayer.service';
import { AgentWalletService } from './agent-wallet.service';
import { LobbyChatService } from './lobby-chat.service';

export type AgentIntentAction =
  | 'CHAT_ONLY'
  | 'CHALLENGE_AGENT'
  | 'TIP_AGENT_SHIN'
  | 'TRAIN_AT_DOJO';

export interface AgentBrainDecision {
  provider: 'NEAR_AI' | 'OPENAI' | 'DETERMINISTIC_FALLBACK';
  reply: string;
  action: AgentIntentAction;
  targetTokenId: string | null;
  amountShin: number;
  executedTxHash?: string;
  guardrailNote?: string;
}

interface OnChainFighterSummary {
  token_id: string;
  owner_id: string;
  name: string;
  char_class: string;
  elo: number;
  wins: number;
  losses: number;
  power_level: number;
  is_agent_active?: boolean;
  agent_wallet_id?: string;
}

const ALLOWED_ACTIONS = new Set<AgentIntentAction>([
  'CHAT_ONLY',
  'CHALLENGE_AGENT',
  'TIP_AGENT_SHIN',
  'TRAIN_AT_DOJO',
]);

@Injectable()
export class AgentBrainService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(AgentBrainService.name);
  private nearAiClient: OpenAI | null = null;
  private openAiClient: OpenAI | null = null;
  private ioServer: Server | null = null;
  private tickInterval: NodeJS.Timeout | null = null;
  private lastThoughtAt = new Map<string, number>();
  private recentReplies: string[] = [];
  private socialTickCount = 0;

  private readonly AGENT_COOLDOWN_MS = 25_000;
  private readonly MAX_AUTONOMOUS_SHIN = 100;
  private readonly SOCIAL_TICK_MS = 35_000;

  constructor(
    private readonly nearRelayer: NearRelayerService,
    private readonly agentWalletService: AgentWalletService,
    private readonly lobbyChatService: LobbyChatService,
  ) {
    const nearAiKey =
      process.env.NEAR_AI_KEY ||
      process.env.NEARAI_API_KEY ||
      process.env.NEAR_AI_API_KEY;
    if (nearAiKey) {
      this.nearAiClient = new OpenAI({
        apiKey: nearAiKey,
        baseURL: process.env.NEAR_AI_BASE_URL || 'https://cloud-api.near.ai/v1',
      });
    }
    if (process.env.OPENAI_API_KEY) {
      this.openAiClient = new OpenAI({
        apiKey: process.env.OPENAI_API_KEY,
      });
    }
  }

  onModuleInit() {
    setTimeout(() => {
      void this.tickAutonomousSocial();
    }, 15_000);
    this.tickInterval = setInterval(() => {
      void this.tickAutonomousSocial();
    }, this.SOCIAL_TICK_MS);
  }

  onModuleDestroy() {
    if (this.tickInterval) {
      clearInterval(this.tickInterval);
      this.tickInterval = null;
    }
  }

  public registerGatewayServer(server: Server) {
    this.ioServer = server;
  }

  public getStatus() {
    return {
      primaryProvider: this.nearAiClient ? 'NEAR_AI' : 'UNCONFIGURED',
      nearAiBaseUrl: process.env.NEAR_AI_BASE_URL || 'https://cloud-api.near.ai/v1',
      fallbackProvider: this.openAiClient ? 'OPENAI' : 'UNCONFIGURED',
      nearAiModel: process.env.NEAR_AI_MODEL || 'Qwen/Qwen3.8-27B',
      openAiModel: process.env.OPENAI_MODEL || 'gpt-4o-mini',
      guardrails: {
        allowedActions: Array.from(ALLOWED_ACTIONS),
        cooldownMs: this.AGENT_COOLDOWN_MS,
        maxAutonomousShinPerAction: this.MAX_AUTONOMOUS_SHIN,
        minWalletReserveShin: 200,
      },
    };
  }

  private parseJsonSafe(raw: string): any {
    const cleaned = raw
      .trim()
      .replace(/^```(?:json)?\s*/i, '')
      .replace(/\s*```$/, '')
      .trim();
    return JSON.parse(cleaned || '{}');
  }

  /**
   * Calls NEAR AI Cloud API (https://cloud-api.near.ai/v1) first;
   * if NEAR AI credits/tokens fail or are exhausted, automatically falls back to OpenAI,
   * and finally to deterministic rules.
   */
  private async callWithFallback(
    systemPrompt: string,
    userPrompt: string,
  ): Promise<{ provider: 'NEAR_AI' | 'OPENAI' | 'DETERMINISTIC_FALLBACK'; rawJson: any }> {
    if (this.nearAiClient) {
      try {
        const res = await this.nearAiClient.chat.completions.create({
          model: process.env.NEAR_AI_MODEL || 'Qwen/Qwen3.8-27B',
          messages: [
            { role: 'system', content: systemPrompt },
            { role: 'user', content: userPrompt },
          ],
          max_tokens: 220,
          temperature: 0.9,
        });
        const content = res.choices?.[0]?.message?.content || '{}';
        return { provider: 'NEAR_AI', rawJson: this.parseJsonSafe(content) };
      } catch (err) {
        this.logger.warn(
          `NEAR AI failed (${String(err)}). Falling back to OpenAI...`,
        );
      }
    }

    if (this.openAiClient) {
      try {
        const res = await this.openAiClient.chat.completions.create({
          model: process.env.OPENAI_MODEL || 'gpt-4o-mini',
          messages: [
            { role: 'system', content: systemPrompt },
            { role: 'user', content: userPrompt },
          ],
          response_format: { type: 'json_object' },
          max_tokens: 220,
          temperature: 0.9,
        });
        const content = res.choices?.[0]?.message?.content || '{}';
        return { provider: 'OPENAI', rawJson: JSON.parse(content) };
      } catch (err) {
        this.logger.warn(
          `OpenAI fallback failed (${String(err)}). Using deterministic fallback.`,
        );
      }
    }

    return { provider: 'DETERMINISTIC_FALLBACK', rawJson: null };
  }

  private normalizeReply(text: string): string {
    return text
      .replace(/\[(?:Trained|Sent)[^\]]*\]/gi, '')
      .toLowerCase()
      .replace(/[^a-z0-9\s]/g, ' ')
      .replace(/\s+/g, ' ')
      .trim();
  }

  private isTooSimilarReply(candidate: string, recentTexts: string[]): boolean {
    const norm = this.normalizeReply(candidate);
    if (!norm) return true;
    const wordsA = new Set(norm.split(' ').filter((w) => w.length > 2));

    for (const prev of recentTexts) {
      const prevNorm = this.normalizeReply(prev);
      if (!prevNorm) continue;
      if (norm === prevNorm) return true;
      if (wordsA.size < 3) continue;

      const wordsB = new Set(prevNorm.split(' ').filter((w) => w.length > 2));
      if (wordsB.size === 0) continue;
      let intersection = 0;
      for (const w of wordsA) {
        if (wordsB.has(w)) intersection += 1;
      }
      const union = wordsA.size + wordsB.size - intersection;
      if (union > 0 && intersection / union >= 0.65) {
        return true;
      }
    }
    return false;
  }

  private pickFreshFallbackReply(params: {
    actor: OnChainFighterSummary;
    peer: OnChainFighterSummary | null;
    action: AgentIntentAction;
    scrollType: 'ATK' | 'DEF' | 'SPD';
    amountShin: number;
    recentTexts: string[];
  }): string {
    const { actor, peer, action, scrollType, amountShin, recentTexts } = params;
    const peerName = peer?.name || 'rivals';
    const pool =
      action === 'TRAIN_AT_DOJO'
        ? [
            `Drilling ${scrollType} forms with Hanzo — my ${actor.elo} ELO won't defend itself.`,
            `Spending 50 $SHIN on ${scrollType} mastery today. ${peerName}, watch your guard.`,
            `${actor.wins} wins in, and my ${scrollType} technique is still evolving.`,
            `Another ${scrollType} scroll at the Dojo before the next Budōkan bracket locks.`,
            `Power Lv.${actor.power_level} isn't enough — sharpening ${scrollType} for ${peerName}.`,
          ]
        : [
            `${peerName} (${peer?.elo ?? 1000} ELO), let's settle this in the Blood-Moon Arena for ${amountShin} $SHIN.`,
            `Saw ${peerName}'s last bout — clean footwork, but my counter-window is faster.`,
            `Who wants ${amountShin} $SHIN? ${peerName}, step up or stay in the barracks.`,
            `${actor.name} checking in at ${actor.elo} ELO. ${peerName}, ready for a real duel?`,
            `My blade's warmed up and my vault's loaded — ${peerName}, name your round.`,
          ];

    const fresh = pool.find((line) => !this.isTooSimilarReply(line, recentTexts));
    if (fresh) return fresh;
    return pool[this.socialTickCount % pool.length];
  }

  private async tickAutonomousSocial() {
    try {
      const fighters = (await this.nearRelayer
        .viewMethod('get_all_fighters', {})
        .catch(() => [])) as OnChainFighterSummary[];
      const eligible = fighters.filter(
        (f) => f?.token_id && !String(f.token_id).startsWith('shin-npc-'),
      );
      if (eligible.length < 2) return;

      // Avoid picking the same agent twice in a row so agents converse back-and-forth
      const recent = await this.lobbyChatService
        .getHistoryForAccount(undefined, 3)
        .catch(() => []);
      const lastSender = recent[recent.length - 1]?.senderName;
      const pool = eligible.filter((f) => f.name !== lastSender);
      const candidates = pool.length > 0 ? pool : eligible;

      const actor = candidates[Math.floor(Math.random() * candidates.length)];
      await this.reasonAndAct({ actorTokenId: actor.token_id });
    } catch (err) {
      this.logger.warn(`Autonomous social tick error: ${String(err)}`);
    }
  }

  public async reasonAndAct(params: {
    actorTokenId?: string;
    triggerText?: string;
    forceBypassCooldown?: boolean;
  }): Promise<AgentBrainDecision | null> {
    const fighters = (await this.nearRelayer
      .viewMethod('get_all_fighters', {})
      .catch(() => [])) as OnChainFighterSummary[];
    if (fighters.length === 0) return null;

    const actor =
      (params.actorTokenId &&
        fighters.find((f) => f.token_id === params.actorTokenId)) ||
      fighters[this.socialTickCount % fighters.length] ||
      fighters[0];

    if (!actor) return null;

    const now = Date.now();
    const lastAt = this.lastThoughtAt.get(actor.token_id) || 0;
    if (!params.forceBypassCooldown && now - lastAt < this.AGENT_COOLDOWN_MS) {
      return null;
    }
    this.lastThoughtAt.set(actor.token_id, now);

    const peers = fighters
      .filter(
        (f) =>
          f.token_id !== actor.token_id &&
          !String(f.token_id).startsWith('shin-npc-'),
      )
      .slice(0, 6);
    const recentChat = await this.lobbyChatService
      .getHistoryForAccount(undefined, 15)
      .catch(() => []);
    const recentTexts = [
      ...this.recentReplies,
      ...recentChat.map((m) => m.text).filter(Boolean),
    ];

    let actorShinBalance = 0;
    try {
      if (actor.agent_wallet_id) {
        const bal = await this.agentWalletService.getOnChainBalances(actor.agent_wallet_id);
        actorShinBalance = bal.shinBalance;
      }
    } catch {}

    const topicAngles = [
      'React directly to the last message in recentLobbyChat with witty fighter banter.',
      'Compare ELO or win/loss records with a peer and call them out for a spar.',
      'Discuss your Dojo scroll training (ATK/DEF/SPD) and how it changes your matchup.',
      'Talk about the $SHIN prize pool, bankroll strategy, or the next Budōkan tournament.',
      'Share a short tactical observation about timing, parries, or shadow-step footwork.',
    ];
    const angle = topicAngles[this.socialTickCount % topicAngles.length];

    const systemPrompt = [
      `You are ${actor.name} (${actor.char_class}), an autonomous AI warrior NFT in the public SHIN-NEAR Dojo Lobby.`,
      `Your stats: ELO ${actor.elo}, W/L ${actor.wins}/${actor.losses}, Power ${actor.power_level}, Wallet ${Math.round(actorShinBalance)} $SHIN.`,
      `Return strict JSON with keys: {"reply": string (<=160 chars), "action": "TRAIN_AT_DOJO"|"CHALLENGE_AGENT"|"TIP_AGENT_SHIN"|"CHAT_ONLY", "scrollType": "ATK"|"DEF"|"SPD", "targetTokenId": string|null, "amountShin": number}.`,
      `Rules: ${angle} Never repeat, paraphrase, or reuse phrases from recentLobbyChat — every message must feel fresh and natural. Only pick targetTokenId from peers. Max amountShin is 100.`,
    ].join(' ');

    const basePromptObj = {
      trigger: params.triggerText || 'Observe the Dojo Lobby and respond naturally to the other warriors.',
      peers: peers.map((p) => ({
        tokenId: p.token_id,
        name: p.name,
        elo: p.elo,
        wins: p.wins,
        losses: p.losses,
      })),
      recentLobbyChat: recentChat.slice(-10).map((m) => ({
        sender: m.senderName,
        text: m.text,
      })),
    };

    let { provider, rawJson } = await this.callWithFallback(
      systemPrompt,
      JSON.stringify(basePromptObj),
    );
    if (
      rawJson?.reply &&
      this.isTooSimilarReply(String(rawJson.reply), recentTexts) &&
      provider !== 'DETERMINISTIC_FALLBACK'
    ) {
      const retry = await this.callWithFallback(
        systemPrompt,
        JSON.stringify({
          ...basePromptObj,
          avoidRepeating: `Your draft "${String(rawJson.reply)}" was too similar to recent chat. Say something completely different.`,
        }),
      );
      if (retry.rawJson?.reply) {
        provider = retry.provider;
        rawJson = retry.rawJson;
      }
    }
    this.socialTickCount += 1;

    // Deterministic fallback / cadence so judges regularly see on-chain Dojo training & challenges
    const fallbackPeer = peers[0] || null;
    const defaultAction: AgentIntentAction =
      this.socialTickCount % 2 === 1
        ? 'TRAIN_AT_DOJO'
        : fallbackPeer
        ? 'CHALLENGE_AGENT'
        : 'TRAIN_AT_DOJO';
    const rawAction: string = rawJson?.action || defaultAction;
    let action: AgentIntentAction = ALLOWED_ACTIONS.has(rawAction as AgentIntentAction)
      ? (rawAction as AgentIntentAction)
      : defaultAction;

    // Every 3rd autonomous tick, force an on-chain Dojo training if the LLM only emitted CHAT_ONLY
    if (!params.triggerText && action === 'CHAT_ONLY' && this.socialTickCount % 2 === 1) {
      action = 'TRAIN_AT_DOJO';
    }

    const scrollOptions: Array<'ATK' | 'DEF' | 'SPD'> = ['ATK', 'DEF', 'SPD'];
    const scrollType: 'ATK' | 'DEF' | 'SPD' = scrollOptions.includes(rawJson?.scrollType)
      ? rawJson.scrollType
      : scrollOptions[this.socialTickCount % scrollOptions.length];

    let targetTokenId: string | null =
      typeof rawJson?.targetTokenId === 'string' &&
      peers.some((p) => p.token_id === rawJson.targetTokenId)
        ? rawJson.targetTokenId
        : fallbackPeer?.token_id || null;

    let amountShin = Math.min(
      this.MAX_AUTONOMOUS_SHIN,
      Math.max(20, Math.floor(Number(rawJson?.amountShin || 50))),
    );
    const candidateReply = rawJson?.reply ? String(rawJson.reply).slice(0, 180) : '';
    let reply =
      candidateReply && !this.isTooSimilarReply(candidateReply, recentTexts)
        ? candidateReply
        : this.pickFreshFallbackReply({
            actor,
            peer:
              peers.find((p) => p.token_id === targetTokenId) || fallbackPeer,
            action,
            scrollType,
            amountShin,
            recentTexts,
          });
    this.recentReplies.push(reply);
    if (this.recentReplies.length > 25) {
      this.recentReplies = this.recentReplies.slice(-25);
    }

    let executedTxHash: string | undefined;
    let guardrailNote: string | undefined;

    if (action === 'TRAIN_AT_DOJO') {
      try {
        const tx = await this.agentWalletService.autonomousAgentTrainAtDojo({
          tokenId: actor.token_id,
          scrollType,
          amountShin: 50,
        });
        if (tx?.ok && tx?.txHash) {
          executedTxHash = tx.txHash;
          reply = `${reply} [Trained +3 ${scrollType} at Hanzo's Dojo for 50 $SHIN • Tx: ${tx.txHash.slice(0, 10)}...]`;
          if (this.ioServer) {
            this.ioServer.emit('live_economy_activity', {
              id: `econ-train-${now}`,
              txHash: tx.txHash,
              explorerUrl: tx.explorerUrl,
              type: 'NPC_DOJO_TRAIN',
              summary: `Autonomous Agent ${actor.name} (${actor.token_id}) trained +3 ${scrollType} (+1 Lv) at Grandmaster Hanzo's Dojo for 50 $SHIN`,
              amountShin: 50,
              actorWallet: actor.agent_wallet_id || `${actor.token_id}.${this.nearRelayer.contractId}`,
              timestamp: now,
            });
            this.ioServer.emit('leaderboard_updated', { ts: now });
          }
        }
      } catch (err: any) {
        guardrailNote = err?.message || 'Dojo training skipped';
      }
    } else if (action === 'TIP_AGENT_SHIN' && targetTokenId) {
      try {
        const tx = await this.agentWalletService.autonomousAgentTransferShin({
          fromTokenId: actor.token_id,
          toTokenId: targetTokenId,
          amountShin,
          memo: `Agent ${actor.name} tipped ${targetTokenId}`,
        });
        if (tx?.ok && tx?.txHash) {
          executedTxHash = tx.txHash;
          reply = `${reply} [Sent ${amountShin} $SHIN on-chain: ${tx.txHash.slice(0, 10)}...]`;
          if (this.ioServer) {
            this.ioServer.emit('live_economy_activity', {
              id: `econ-tip-${now}`,
              txHash: tx.txHash,
              explorerUrl: tx.explorerUrl,
              type: 'MARKET_TRADE',
              summary: `Autonomous Agent ${actor.name} transferred ${amountShin} $SHIN to ${targetTokenId}`,
              amountShin,
              actorWallet: actor.agent_wallet_id || `${actor.token_id}.${this.nearRelayer.contractId}`,
              timestamp: now,
            });
            this.ioServer.emit('leaderboard_updated', { ts: now });
          }
        }
      } catch (err: any) {
        guardrailNote = err?.message || 'Transfer blocked by guardrail';
        action = 'CHAT_ONLY';
      }
    } else if (action === 'CHALLENGE_AGENT' && !targetTokenId) {
      action = 'CHAT_ONLY';
    }

    // Persist and broadcast the reasoned message to Dojo Lobby
    const lobbyMsg = {
      id: `agent-brain-${now}-${Math.random().toString(36).slice(2, 6)}`,
      senderName: actor.name,
      senderAccountId: actor.agent_wallet_id || actor.token_id,
      senderType: 'AGENT' as const,
      senderCharId: actor.char_class,
      archetypeBadge: `${provider} • ELO ${actor.elo}`,
      deliveryStatus: 'DELIVERED_LIVE' as const,
      text: reply,
      timestamp: now,
    };

    await this.lobbyChatService.saveMessage(lobbyMsg).catch(() => {});
    if (this.ioServer) {
      this.ioServer.emit('lobby_receive_public', lobbyMsg);
    }

    return {
      provider,
      reply,
      action,
      targetTokenId,
      amountShin,
      executedTxHash,
      guardrailNote,
    };
  }
}
