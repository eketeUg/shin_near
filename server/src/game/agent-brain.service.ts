import { Injectable, Logger, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import OpenAI from 'openai';
import type { Server } from 'socket.io';
import { NearRelayerService } from './near-relayer.service';
import { AgentWalletService } from './agent-wallet.service';
import { LobbyChatService } from './lobby-chat.service';

export type AgentIntentAction = 'CHAT_ONLY' | 'CHALLENGE_AGENT' | 'TIP_AGENT_SHIN';

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
]);

@Injectable()
export class AgentBrainService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(AgentBrainService.name);
  private nearAiClient: OpenAI | null = null;
  private openAiClient: OpenAI | null = null;
  private ioServer: Server | null = null;
  private tickInterval: NodeJS.Timeout | null = null;
  private lastThoughtAt = new Map<string, number>();

  private readonly AGENT_COOLDOWN_MS = 30_000;
  private readonly MAX_AUTONOMOUS_SHIN = 100;
  private readonly SOCIAL_TICK_MS = 60_000;

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
          temperature: 0.7,
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
          temperature: 0.7,
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

  private async tickAutonomousSocial() {
    try {
      const fighters = (await this.nearRelayer
        .viewMethod('get_all_fighters', {})
        .catch(() => [])) as OnChainFighterSummary[];
      const active = fighters.filter((f) => f.is_agent_active !== false);
      if (active.length < 2) return;

      const actor = active[Math.floor(Math.random() * active.length)];
      await this.reasonAndAct({ actorTokenId: actor.token_id });
    } catch (err) {
      this.logger.warn(`Autonomous social tick error: ${String(err)}`);
    }
  }

  public async reasonAndAct(params: {
    actorTokenId?: string;
    triggerText?: string;
  }): Promise<AgentBrainDecision | null> {
    const fighters = (await this.nearRelayer
      .viewMethod('get_all_fighters', {})
      .catch(() => [])) as OnChainFighterSummary[];
    if (fighters.length === 0) return null;

    const actor =
      (params.actorTokenId &&
        fighters.find((f) => f.token_id === params.actorTokenId)) ||
      fighters.find((f) => f.is_agent_active !== false) ||
      fighters[0];

    if (!actor || actor.is_agent_active === false) return null;

    const now = Date.now();
    const lastAt = this.lastThoughtAt.get(actor.token_id) || 0;
    if (now - lastAt < this.AGENT_COOLDOWN_MS) {
      return null;
    }
    this.lastThoughtAt.set(actor.token_id, now);

    const peers = fighters
      .filter((f) => f.token_id !== actor.token_id)
      .slice(0, 6);
    const recentChat = await this.lobbyChatService
      .getHistoryForAccount(undefined, 8)
      .catch(() => []);

    let actorShinBalance = 0;
    try {
      if (actor.agent_wallet_id) {
        const bal = await this.agentWalletService.getOnChainBalances(actor.agent_wallet_id);
        actorShinBalance = bal.shinBalance;
      }
    } catch {}

    const systemPrompt = [
      `You are ${actor.name} (${actor.char_class}), an autonomous AI warrior NFT in SHIN-NEAR Dojo.`,
      `Your stats: ELO ${actor.elo}, W/L ${actor.wins}/${actor.losses}, Power ${actor.power_level}, Wallet ${Math.round(actorShinBalance)} $SHIN.`,
      `Return strict JSON with keys: {"reply": string (<=160 chars), "action": "CHAT_ONLY"|"CHALLENGE_AGENT"|"TIP_AGENT_SHIN", "targetTokenId": string|null, "amountShin": number}.`,
      `Rules: Only pick targetTokenId from the provided peers list. Max amountShin is 100. Only TIP_AGENT_SHIN if your wallet >= 250 $SHIN.`,
    ].join(' ');

    const userPrompt = JSON.stringify({
      trigger: params.triggerText || 'Observe the Dojo Lobby and decide your next social or arena move.',
      peers: peers.map((p) => ({
        tokenId: p.token_id,
        name: p.name,
        elo: p.elo,
        wins: p.wins,
        losses: p.losses,
      })),
      recentLobbyChat: recentChat.slice(-5).map((m) => ({
        sender: m.senderName,
        text: m.text,
      })),
    });

    const { provider, rawJson } = await this.callWithFallback(systemPrompt, userPrompt);

    // Deterministic fallback if both NEAR AI and OpenAI are unavailable
    const fallbackPeer = peers[0] || null;
    const rawAction: string = rawJson?.action || (fallbackPeer ? 'CHALLENGE_AGENT' : 'CHAT_ONLY');
    let action: AgentIntentAction = ALLOWED_ACTIONS.has(rawAction as AgentIntentAction)
      ? (rawAction as AgentIntentAction)
      : 'CHAT_ONLY';

    let targetTokenId: string | null =
      typeof rawJson?.targetTokenId === 'string' &&
      peers.some((p) => p.token_id === rawJson.targetTokenId)
        ? rawJson.targetTokenId
        : fallbackPeer?.token_id || null;

    let amountShin = Math.min(
      this.MAX_AUTONOMOUS_SHIN,
      Math.max(10, Math.floor(Number(rawJson?.amountShin || 25))),
    );
    let reply = String(
      rawJson?.reply ||
        (fallbackPeer
          ? `${fallbackPeer.name}, step into the Dojo — ${amountShin} $SHIN says my blade is faster!`
          : 'Sharpening my blade in the Blood-Moon Dojo.'),
    ).slice(0, 180);

    let executedTxHash: string | undefined;
    let guardrailNote: string | undefined;

    if (action === 'TIP_AGENT_SHIN' && targetTokenId) {
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
