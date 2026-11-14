/* eslint-disable @typescript-eslint/no-unsafe-assignment */
/* eslint-disable @typescript-eslint/no-unsafe-member-access */
import { Injectable, Logger, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import * as nodemailer from 'nodemailer';
import { Account, connect, KeyPair, keyStores, providers, utils } from 'near-api-js';
import type { KeyPairString } from 'near-api-js/lib/utils';

const ALLOWED_WRITE_METHODS = new Set([
  'mint_fighter',
  'configure_agent',
  'fund_agent_wallet',
  'create_agent_match_pool',
  'place_spectator_bet',
  'settle_match',
  'buy_dojo_scroll',
  'sell_material_to_npc_dojo',
  'invest_in_npc_dojo',
  'list_fighter_on_market',
  'buy_fighter_from_market',
  'mt_transfer',
  'mt_batch_transfer',
  'swap_near_for_shin',
  'register_trainer',
  'train_fighter_with_trainer',
  'create_tournament',
  'join_tournament',
  'settle_tournament',
  'nft_transfer',
  'ft_transfer',
  'ft_transfer_call',
  'withdraw_agent_shin',
  'settle_shin_match',
  'settle_shin_duel',
  'refund_shin_duel',
]);

export interface NearRelayResult {
  ok: boolean;
  simulated: boolean;
  contractId: string;
  relayerAccountId: string;
  methodName: string;
  txHash: string;
  explorerUrl: string;
  result?: unknown;
  error?: string;
}

@Injectable()
export class NearRelayerService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(NearRelayerService.name);

  readonly networkId = process.env.NEAR_NETWORK || 'testnet';
  readonly rpcUrl =
    process.env.NEAR_RPC_URL || 'https://test.rpc.fastnear.com';
  readonly fallbackRpcUrls = Array.from(
    new Set([
      this.rpcUrl,
      'https://test.rpc.fastnear.com',
      'https://near-testnet.lava.build',
      'https://near-testnet.drpc.org',
      'https://endpoints.omniatech.io/v1/near/testnet/public',
    ]),
  );
  readonly contractId = process.env.NEAR_CONTRACT_ID || 'shin-arena-28d.testnet';
  readonly shinTokenId =
    process.env.NEAR_SHIN_TOKEN_ID || 'shin.shin-arena-28d.testnet';
  readonly relayerAccountId =
    process.env.NEAR_REFEREE_ACCOUNT_ID ||
    process.env.NEAR_CONTRACT_ID ||
    'shin-arena-28d.testnet';

  private provider = new providers.FailoverRpcProvider(
    this.fallbackRpcUrls.map((url) => new providers.JsonRpcProvider({ url })),
  );
  private relayerAccount: Account | null = null;
  private txQueue: Promise<unknown> = Promise.resolve();
  private viewCache = new Map<string, { value: unknown; expiresAt: number }>();

  private mailTransporter: nodemailer.Transporter | null = null;
  private gasMonitorTimer: NodeJS.Timeout | null = null;
  private lastGasAlertSentAt = new Map<'LOW' | 'EXHAUSTED', number>();
  private readonly adminAlertEmail = (
    process.env.ADMIN_ALERT_EMAIL ||
    process.env.ADMIN_EMAIL ||
    process.env.SMTP_USER ||
    ''
  ).trim();
  private readonly lowGasThresholdNear = Number(
    process.env.RELAYER_LOW_GAS_THRESHOLD_NEAR || 1.0,
  );
  private readonly criticalGasThresholdNear = Number(
    process.env.RELAYER_CRITICAL_GAS_THRESHOLD_NEAR || 0.2,
  );
  private readonly alertCooldownMs =
    Number(process.env.RELAYER_ALERT_COOLDOWN_MINUTES || 60) * 60 * 1000;
  private readonly gasCheckIntervalMs = Number(
    process.env.RELAYER_GAS_CHECK_INTERVAL_MS || 5 * 60 * 1000,
  );

  async onModuleInit() {
    await this.initRelayer();
    this.startGasMonitor();
  }

  onModuleDestroy() {
    if (this.gasMonitorTimer) {
      clearInterval(this.gasMonitorTimer);
      this.gasMonitorTimer = null;
    }
  }

  private async initRelayer() {
    try {
      let privateKey = process.env.NEAR_RELAYER_PRIVATE_KEY?.trim();

      if (!privateKey) {
        const credPath = path.join(
          os.homedir(),
          '.near-credentials',
          this.networkId,
          `${this.relayerAccountId}.json`,
        );
        if (fs.existsSync(credPath)) {
          const raw = JSON.parse(fs.readFileSync(credPath, 'utf8'));
          privateKey = raw.private_key || raw.secret_key;
        }
      }

      if (!privateKey) {
        this.logger.warn(
          `No relayer private key found for ${this.relayerAccountId}; on-chain writes disabled until credentials are configured.`,
        );
        return;
      }

      const keyStore = new keyStores.InMemoryKeyStore();
      const keyPair = KeyPair.fromString(privateKey as KeyPairString);
      await keyStore.setKey(this.networkId, this.relayerAccountId, keyPair);

      const near = await connect({
        networkId: this.networkId,
        nodeUrl: this.rpcUrl,
        keyStore,
      } as unknown as Parameters<typeof connect>[0]);
      this.relayerAccount = await near.account(this.relayerAccountId);
      this.logger.log(
        `NEAR Testnet Relayer ready: ${this.relayerAccountId} -> ${this.contractId} (${this.rpcUrl})`,
      );
    } catch (err: any) {
      this.logger.error(`Failed to initialize NEAR relayer: ${err?.message || err}`);
      this.relayerAccount = null;
    }
  }

  getStatus() {
    return {
      networkId: this.networkId,
      rpcUrl: this.rpcUrl,
      contractId: this.contractId,
      shinTokenId: this.shinTokenId,
      relayerAccountId: this.relayerAccountId,
      relayerReady: Boolean(this.relayerAccount),
    };
  }

  getRelayerAccount(): Account | null {
    return this.relayerAccount;
  }

  getRpcProvider() {
    return this.provider;
  }

  private resolveAllowedContract(targetContractId?: string): string {
    if (
      targetContractId &&
      (targetContractId === this.contractId ||
        targetContractId === this.shinTokenId)
    ) {
      return targetContractId;
    }
    return this.contractId;
  }

  async viewMethod(
    methodName: string,
    args: Record<string, unknown> = {},
    targetContractId?: string,
  ): Promise<unknown> {
    const resolvedContract = this.resolveAllowedContract(targetContractId);
    const cacheKey = `${resolvedContract}:${methodName}:${JSON.stringify(args)}`;
    const now = Date.now();
    const cached = this.viewCache.get(cacheKey);
    if (cached && cached.expiresAt > now) {
      return cached.value;
    }

    const argsBase64 = Buffer.from(JSON.stringify(args)).toString('base64');
    try {
      const res: any = await this.provider.query({
        request_type: 'call_function',
        finality: 'final',
        account_id: resolvedContract,
        method_name: methodName,
        args_base64: argsBase64,
      });
      if (Array.isArray(res?.result)) {
        const text = Buffer.from(res.result).toString('utf8');
        let parsed: unknown = text;
        try {
          parsed = JSON.parse(text);
        } catch {
          parsed = text;
        }
        this.viewCache.set(cacheKey, { value: parsed, expiresAt: now + 8000 });
        return parsed;
      }
      return null;
    } catch (err) {
      if (cached) {
        return cached.value;
      }
      throw err;
    }
  }

  callMethod(
    methodName: string,
    args: Record<string, unknown> = {},
    attachedDepositNear = '0',
    gas = '60000000000000',
    customSigner?: { accountId: string; privateKey: string },
    targetContractId?: string,
    userWalletAddress?: string,
  ): Promise<NearRelayResult> {
    const resolvedContract = this.resolveAllowedContract(targetContractId);
    if (!ALLOWED_WRITE_METHODS.has(methodName)) {
      return Promise.resolve({
        ok: false,
        simulated: true,
        contractId: resolvedContract,
        relayerAccountId: this.relayerAccountId,
        methodName,
        txHash: '',
        explorerUrl: '',
        error: `Method ${methodName} is not in the relayer allowlist`,
      });
    }

    if (customSigner) {
      return this.executeFunctionCall(
        methodName,
        args,
        attachedDepositNear,
        gas,
        customSigner,
        resolvedContract,
        userWalletAddress,
      );
    }

    // Serialize nonces per relayer access key
    const task = this.txQueue.then(() =>
      this.executeFunctionCall(
        methodName,
        args,
        attachedDepositNear,
        gas,
        undefined,
        resolvedContract,
        userWalletAddress,
      ),
    );
    this.txQueue = task.catch(() => undefined);
    return task;
  }

  private async executeFunctionCall(
    methodName: string,
    args: Record<string, unknown>,
    attachedDepositNear: string,
    gas: string,
    customSigner?: { accountId: string; privateKey: string },
    targetContractId?: string,
    userWalletAddress?: string,
  ): Promise<NearRelayResult> {
    const resolvedContract = targetContractId || this.contractId;
    let signer = this.relayerAccount;
    let signerId = this.relayerAccountId;

    if (customSigner) {
      try {
        const keyStore = new keyStores.InMemoryKeyStore();
        const formattedKey = customSigner.privateKey.startsWith('ed25519:')
          ? customSigner.privateKey
          : `ed25519:${customSigner.privateKey}`;
        await keyStore.setKey(
          this.networkId,
          customSigner.accountId,
          KeyPair.fromString(formattedKey as KeyPairString),
        );
        const near = await connect({
          networkId: this.networkId,
          nodeUrl: this.rpcUrl,
          keyStore,
        } as unknown as Parameters<typeof connect>[0]);
        signer = await near.account(customSigner.accountId);
        signerId = customSigner.accountId;
      } catch (err: any) {
        this.logger.warn(
          `Custom signer init failed for ${customSigner.accountId}, falling back to relayer: ${err?.message || err}`,
        );
      }
    }

    if (!signer) {
      return {
        ok: false,
        simulated: true,
        contractId: this.contractId,
        relayerAccountId: signerId,
        methodName,
        txHash: '',
        explorerUrl: '',
        error: 'NEAR signer key is not loaded',
      };
    }

    // If swap_near_for_shin falls back to relayer signing (e.g. user wallet < 0.1 NEAR or key mismatch),
    // shin-arena-28d.testnet cannot ft_transfer to itself (NEP-141 assert_ne!(sender, receiver)).
    // Instead, compute the AMM quote and transfer the output $SHIN directly to userWalletAddress!
    if (
      methodName === 'swap_near_for_shin' &&
      signerId === this.contractId &&
      userWalletAddress &&
      userWalletAddress !== this.contractId
    ) {
      try {
        const depositYoctoStr =
          utils.format.parseNearAmount(attachedDepositNear) || '0';
        const quotedShinRaw = await this.viewMethod(
          'get_amm_quote_near_to_shin',
          { near_in: depositYoctoStr },
          this.contractId,
        );
        const shinOutStr = String(
          quotedShinRaw || '250000000000000000000',
        ).replace(/"/g, '');

        try {
          await signer.functionCall({
            contractId: this.shinTokenId,
            methodName: 'storage_deposit',
            args: { account_id: userWalletAddress, registration_only: true },
            gas: BigInt('30000000000000'),
            attachedDeposit: BigInt(
              utils.format.parseNearAmount('0.00125') ||
                '1250000000000000000000',
            ),
          });
        } catch {
          // Already registered
        }

        const ftOutcome: any = await signer.functionCall({
          contractId: this.shinTokenId,
          methodName: 'ft_transfer',
          args: {
            receiver_id: userWalletAddress,
            amount: shinOutStr,
            memo: `SHIN AMM Swap: ${attachedDepositNear} NEAR -> $SHIN`,
          },
          gas: BigInt('30000000000000'),
          attachedDeposit: 1n,
        });

        const txHash: string =
          ftOutcome?.transaction?.hash ||
          ftOutcome?.transaction_outcome?.id ||
          '';
        const explorerBase =
          this.networkId === 'mainnet'
            ? 'https://nearblocks.io/txns'
            : 'https://testnet.nearblocks.io/txns';
        const explorerUrl = txHash ? `${explorerBase}/${txHash}` : '';

        return {
          ok: true,
          simulated: false,
          contractId: this.shinTokenId,
          relayerAccountId: signerId,
          methodName,
          txHash,
          explorerUrl,
          result: shinOutStr,
        };
      } catch (err: any) {
        return {
          ok: false,
          simulated: true,
          contractId: this.contractId,
          relayerAccountId: signerId,
          methodName,
          txHash: '',
          explorerUrl: '',
          error: err?.message || String(err),
        };
      }
    }

    try {
      const depositYocto =
        attachedDepositNear === '1yocto'
          ? 1n
          : BigInt(utils.format.parseNearAmount(attachedDepositNear) || '0');
      const outcome: any = await signer.functionCall({
        contractId: resolvedContract,
        methodName,
        args,
        gas: BigInt(gas),
        attachedDeposit: depositYocto,
      });

      const txHash: string =
        outcome?.transaction?.hash || outcome?.transaction_outcome?.id || '';
      const explorerBase =
        this.networkId === 'mainnet'
          ? 'https://nearblocks.io/txns'
          : 'https://testnet.nearblocks.io/txns';
      const explorerUrl = txHash ? `${explorerBase}/${txHash}` : '';

      let parsedResult: unknown = undefined;
      const successVal = outcome?.status?.SuccessValue;
      if (typeof successVal === 'string' && successVal.length > 0) {
        const decoded = Buffer.from(successVal, 'base64').toString('utf8');
        try {
          parsedResult = JSON.parse(decoded);
        } catch {
          parsedResult = decoded;
        }
      }

      this.viewCache.clear();
      this.logger.log(
        `[NEAR TX] ${methodName} on ${resolvedContract} -> ${txHash}`,
      );

      return {
        ok: true,
        simulated: false,
        contractId: resolvedContract,
        relayerAccountId: this.relayerAccountId,
        methodName,
        txHash,
        explorerUrl,
        result: parsedResult,
      };
    } catch (err: any) {
      const errMsg = err?.message || String(err);
      this.logger.warn(`[NEAR TX FAILED] ${methodName}: ${errMsg}`);
      if (
        signerId === this.relayerAccountId &&
        this.isInsufficientGasOrStorageError(errMsg)
      ) {
        void this.handleRelayerGasError(methodName, errMsg);
      }
      return {
        ok: false,
        simulated: true,
        contractId: this.contractId,
        relayerAccountId: this.relayerAccountId,
        methodName,
        txHash: '',
        explorerUrl: '',
        error: errMsg,
      };
    }
  }

  /**
   * Sends a starter Testnet NEAR drip (if below 0.1 NEAR) AND 250 $SHIN tokens
   * to an onboarded user's account.
   */
  async dripTestnetNear(
    receiverId: string,
    amountNear: string = '0.25',
  ): Promise<NearRelayResult> {
    if (!this.relayerAccount) {
      return {
        ok: false,
        simulated: true,
        contractId: this.contractId,
        relayerAccountId: this.relayerAccountId,
        methodName: 'sendMoney',
        txHash: '',
        explorerUrl: '',
        error: 'NEAR relayer key is not loaded',
      };
    }

    try {
      let currentNear = 0;
      try {
        const acct: any = await this.provider.query({
          request_type: 'view_account',
          finality: 'final',
          account_id: receiverId,
        });
        if (acct?.amount) {
          currentNear = Number(utils.format.formatNearAmount(acct.amount, 4).replace(/,/g, ''));
        }
      } catch {
        currentNear = 0; // Account not yet initialized on-chain (0 NEAR)
      }

      let lastTxHash = '';

      if (currentNear < 0.1) {
        const yocto = BigInt(utils.format.parseNearAmount(amountNear) || '0');
        const outcome: any = await this.relayerAccount.sendMoney(receiverId, yocto);
        lastTxHash =
          outcome?.transaction?.hash || outcome?.transaction_outcome?.id || '';
        this.logger.log(`[NEAR DRIP] Sent ${amountNear} NEAR to ${receiverId} -> ${lastTxHash}`);
      }

      // Register NEP-141 storage and transfer 250 $SHIN (18 decimals)
      try {
        await this.relayerAccount.functionCall({
          contractId: this.shinTokenId,
          methodName: 'storage_deposit',
          args: { account_id: receiverId, registration_only: true },
          gas: BigInt('30000000000000'),
          attachedDeposit: BigInt(utils.format.parseNearAmount('0.00125') || '1250000000000000000000'),
        });
      } catch {
        // Ignore if already registered
      }

      const shinAmountRaw = (BigInt(250) * BigInt('1000000000000000000')).toString();
      const ftOutcome: any = await this.relayerAccount.functionCall({
        contractId: this.shinTokenId,
        methodName: 'ft_transfer',
        args: {
          receiver_id: receiverId,
          amount: shinAmountRaw,
          memo: 'SHIN Dojo Faucet Refill (+250 SHIN)',
        },
        gas: BigInt('30000000000000'),
        attachedDeposit: 1n,
      });

      const txHash: string =
        ftOutcome?.transaction?.hash ||
        ftOutcome?.transaction_outcome?.id ||
        lastTxHash;
      const explorerUrl = txHash
        ? `https://testnet.nearblocks.io/txns/${txHash}`
        : '';

      this.logger.log(`[SHIN DRIP] Sent 250 SHIN to ${receiverId} -> ${txHash}`);
      return {
        ok: true,
        simulated: false,
        contractId: this.shinTokenId,
        relayerAccountId: this.relayerAccountId,
        methodName: 'ft_transfer',
        txHash,
        explorerUrl,
      };
    } catch (err: any) {
      const errMsg = err?.message || String(err);
      if (this.isInsufficientGasOrStorageError(errMsg)) {
        void this.handleRelayerGasError('dripTestnetNear', errMsg);
      }
      return {
        ok: false,
        simulated: true,
        contractId: this.contractId,
        relayerAccountId: this.relayerAccountId,
        methodName: 'sendMoney',
        txHash: '',
        explorerUrl: '',
        error: errMsg,
      };
    }
  }

  private parseTokenUnits(amountStr: string, decimals: number): bigint {
    const clean = amountStr.trim();
    if (!/^\d+(\.\d+)?$/.test(clean)) {
      throw new Error('Invalid token amount format');
    }
    const [wholePart, fracPart = ''] = clean.split('.');
    const paddedFrac = fracPart.slice(0, decimals).padEnd(decimals, '0');
    return BigInt(wholePart) * 10n ** BigInt(decimals) + BigInt(paddedFrac || '0');
  }

  async transferFromUserWallet(params: {
    senderAccountId: string;
    senderPrivateKey: string;
    recipientId: string;
    token: 'NEAR' | 'SHIN' | 'USDC' | 'USDT';
    amount: string;
  }): Promise<NearRelayResult> {
    const { senderAccountId, senderPrivateKey, recipientId, token, amount } = params;
    const explorerBase =
      this.networkId === 'mainnet'
        ? 'https://nearblocks.io/txns'
        : 'https://testnet.nearblocks.io/txns';

    try {
      const keyStore = new keyStores.InMemoryKeyStore();
      const formattedKey = senderPrivateKey.startsWith('ed25519:')
        ? senderPrivateKey
        : `ed25519:${senderPrivateKey}`;
      await keyStore.setKey(
        this.networkId,
        senderAccountId,
        KeyPair.fromString(formattedKey as KeyPairString),
      );

      const near = await connect({
        networkId: this.networkId,
        nodeUrl: this.rpcUrl,
        keyStore,
      } as unknown as Parameters<typeof connect>[0]);
      const senderAccount = await near.account(senderAccountId);

      // Query sender's native NEAR balance
      const acct: any = await this.provider.query({
        request_type: 'view_account',
        finality: 'final',
        account_id: senderAccountId,
      });
      const senderNearYocto = BigInt(acct?.amount || '0');

      if (token === 'NEAR') {
        const yoctoAmount = BigInt(utils.format.parseNearAmount(amount) || '0');
        if (yoctoAmount <= 0n) {
          return {
            ok: false,
            simulated: true,
            contractId: 'near',
            relayerAccountId: senderAccountId,
            methodName: 'sendMoney',
            txHash: '',
            explorerUrl: '',
            error: 'Amount must be greater than 0 NEAR',
          };
        }

        const gasReserve = BigInt(utils.format.parseNearAmount('0.005') || '5000000000000000000000');
        if (senderNearYocto < yoctoAmount + gasReserve) {
          return {
            ok: false,
            simulated: true,
            contractId: 'near',
            relayerAccountId: senderAccountId,
            methodName: 'sendMoney',
            txHash: '',
            explorerUrl: '',
            error: 'Insufficient NEAR balance (keep at least ~0.005 NEAR for gas)',
          };
        }

        const outcome: any = await senderAccount.sendMoney(recipientId, yoctoAmount);
        const txHash: string =
          outcome?.transaction?.hash || outcome?.transaction_outcome?.id || '';
        this.viewCache.clear();
        this.logger.log(
          `[USER NEAR TRANSFER] ${senderAccountId} -> ${recipientId} (${amount} NEAR) -> ${txHash}`,
        );
        return {
          ok: true,
          simulated: false,
          contractId: 'near',
          relayerAccountId: senderAccountId,
          methodName: 'sendMoney',
          txHash,
          explorerUrl: txHash ? `${explorerBase}/${txHash}` : '',
        };
      }

      // NEP-141 token transfer (SHIN, USDC, USDT)
      const tokenConfig: Record<'SHIN' | 'USDC' | 'USDT', { contractId: string; decimals: number }> = {
        SHIN: { contractId: this.shinTokenId, decimals: 18 },
        USDC: {
          contractId: process.env.NEAR_USDC_CONTRACT || 'usdc.fakes.testnet',
          decimals: 6,
        },
        USDT: {
          contractId: process.env.NEAR_USDT_CONTRACT || 'usdt.fakes.testnet',
          decimals: 6,
        },
      };
      const cfg = tokenConfig[token];
      const rawAmount = this.parseTokenUnits(amount, cfg.decimals);
      if (rawAmount <= 0n) {
        return {
          ok: false,
          simulated: true,
          contractId: cfg.contractId,
          relayerAccountId: senderAccountId,
          methodName: 'ft_transfer',
          txHash: '',
          explorerUrl: '',
          error: `Amount must be greater than 0 ${token}`,
        };
      }

      const rawBalance = await this.viewMethod(
        'ft_balance_of',
        { account_id: senderAccountId },
        cfg.contractId,
      );
      const currentTokenBalance = BigInt(String(rawBalance || '0').replace(/"/g, '') || '0');
      if (currentTokenBalance < rawAmount) {
        return {
          ok: false,
          simulated: true,
          contractId: cfg.contractId,
          relayerAccountId: senderAccountId,
          methodName: 'ft_transfer',
          txHash: '',
          explorerUrl: '',
          error: `Insufficient ${token} balance`,
        };
      }

      const minNearForFt = BigInt(utils.format.parseNearAmount('0.01') || '10000000000000000000000');
      if (senderNearYocto < minNearForFt) {
        return {
          ok: false,
          simulated: true,
          contractId: cfg.contractId,
          relayerAccountId: senderAccountId,
          methodName: 'ft_transfer',
          txHash: '',
          explorerUrl: '',
          error: 'Insufficient NEAR for transaction gas (need at least 0.01 NEAR in your wallet)',
        };
      }

      // Register recipient on the NEP-141 token contract if not yet registered
      try {
        await senderAccount.functionCall({
          contractId: cfg.contractId,
          methodName: 'storage_deposit',
          args: { account_id: recipientId, registration_only: true },
          gas: BigInt('30000000000000'),
          attachedDeposit: BigInt(
            utils.format.parseNearAmount('0.00125') || '1250000000000000000000',
          ),
        });
      } catch {
        // Ignore if already registered
      }

      const outcome: any = await senderAccount.functionCall({
        contractId: cfg.contractId,
        methodName: 'ft_transfer',
        args: {
          receiver_id: recipientId,
          amount: rawAmount.toString(),
          memo: `SHIN Arena Transfer (${amount} ${token})`,
        },
        gas: BigInt('30000000000000'),
        attachedDeposit: 1n,
      });

      const txHash: string =
        outcome?.transaction?.hash || outcome?.transaction_outcome?.id || '';
      this.viewCache.clear();
      this.logger.log(
        `[USER ${token} TRANSFER] ${senderAccountId} -> ${recipientId} (${amount} ${token}) -> ${txHash}`,
      );
      return {
        ok: true,
        simulated: false,
        contractId: cfg.contractId,
        relayerAccountId: senderAccountId,
        methodName: 'ft_transfer',
        txHash,
        explorerUrl: txHash ? `${explorerBase}/${txHash}` : '',
      };
    } catch (err: any) {
      const errMsg = err?.message || String(err);
      this.logger.warn(`[USER TRANSFER FAILED] ${senderAccountId} -> ${recipientId}: ${errMsg}`);
      return {
        ok: false,
        simulated: true,
        contractId: this.contractId,
        relayerAccountId: senderAccountId,
        methodName: token === 'NEAR' ? 'sendMoney' : 'ft_transfer',
        txHash: '',
        explorerUrl: '',
        error: errMsg,
      };
    }
  }

  private startGasMonitor() {
    if (process.env.SMTP_USER && process.env.SMTP_PASS) {
      this.mailTransporter = nodemailer.createTransport({
        host: process.env.SMTP_HOST || 'smtp.gmail.com',
        port: Number(process.env.SMTP_PORT || 465),
        secure: Number(process.env.SMTP_PORT || 465) === 465,
        auth: {
          user: process.env.SMTP_USER,
          pass: process.env.SMTP_PASS,
        },
      });
    } else {
      this.logger.warn(
        'SMTP_USER / SMTP_PASS not configured; relayer low-gas email alerts disabled.',
      );
    }

    if (!this.relayerAccount) return;

    void this.checkRelayerGasBalance('startup');
    this.gasMonitorTimer = setInterval(() => {
      void this.checkRelayerGasBalance('periodic');
    }, this.gasCheckIntervalMs);
    this.gasMonitorTimer.unref?.();
  }

  private isInsufficientGasOrStorageError(message: string): boolean {
    const lower = message.toLowerCase();
    return (
      lower.includes('not enough balance') ||
      lower.includes("wouldn't have enough balance") ||
      lower.includes('lackbalanceforstate') ||
      lower.includes('notenoughbalance') ||
      lower.includes('does not have enough balance') ||
      lower.includes('balance is too low')
    );
  }

  async getRelayerBalanceSummary(): Promise<{
    totalNear: number;
    storageLockedNear: number;
    availableNear: number;
  } | null> {
    try {
      const acct: any = await this.provider.query({
        request_type: 'view_account',
        finality: 'final',
        account_id: this.relayerAccountId,
      });
      if (!acct?.amount) return null;

      const totalYocto = BigInt(acct.amount);
      const storageBytes = BigInt(acct.storage_usage || 0);
      // NEAR protocol locks 10^19 yoctoNEAR (0.00001 NEAR) per byte of state storage
      const storageLockedYocto = storageBytes * BigInt('10000000000000000000');
      const availableYocto =
        totalYocto > storageLockedYocto ? totalYocto - storageLockedYocto : 0n;

      const toNear = (yocto: bigint) =>
        Number(
          utils.format
            .formatNearAmount(yocto.toString(), 4)
            .replace(/,/g, ''),
        );

      return {
        totalNear: toNear(totalYocto),
        storageLockedNear: toNear(storageLockedYocto),
        availableNear: toNear(availableYocto),
      };
    } catch (err: any) {
      this.logger.warn(
        `Failed to query relayer balance for ${this.relayerAccountId}: ${err?.message || err}`,
      );
      return null;
    }
  }

  async checkRelayerGasBalance(trigger = 'periodic') {
    const summary = await this.getRelayerBalanceSummary();
    if (!summary) return;

    if (summary.availableNear <= this.criticalGasThresholdNear) {
      await this.notifyAdminRelayerGas('EXHAUSTED', {
        ...summary,
        trigger,
      });
    } else if (summary.availableNear <= this.lowGasThresholdNear) {
      await this.notifyAdminRelayerGas('LOW', {
        ...summary,
        trigger,
      });
    } else if (this.lastGasAlertSentAt.size > 0) {
      // Balance recovered above threshold — allow future alerts if it drops again
      this.lastGasAlertSentAt.clear();
    }
  }

  private async handleRelayerGasError(methodName: string, errorMessage: string) {
    const summary = await this.getRelayerBalanceSummary();
    await this.notifyAdminRelayerGas('EXHAUSTED', {
      totalNear: summary?.totalNear,
      storageLockedNear: summary?.storageLockedNear,
      availableNear: summary?.availableNear,
      trigger: `tx_failed:${methodName}`,
      errorMessage,
    });
  }

  private async notifyAdminRelayerGas(
    level: 'LOW' | 'EXHAUSTED',
    details: {
      totalNear?: number;
      storageLockedNear?: number;
      availableNear?: number;
      trigger: string;
      errorMessage?: string;
    },
  ) {
    const now = Date.now();
    const lastSent = this.lastGasAlertSentAt.get(level) || 0;
    if (now - lastSent < this.alertCooldownMs) {
      return;
    }

    const label =
      level === 'EXHAUSTED' ? 'OUT OF GAS / STORAGE' : 'LOW GAS WARNING';
    this.logger.error(
      `[RELAYER ${label}] ${this.relayerAccountId} (${this.networkId}) | available=${details.availableNear ?? 'unknown'} NEAR | total=${details.totalNear ?? 'unknown'} NEAR | trigger=${details.trigger}`,
    );

    if (!this.mailTransporter || !this.adminAlertEmail) {
      this.logger.warn(
        `Relayer gas alert not emailed (SMTP or ADMIN_ALERT_EMAIL missing). Target=${this.adminAlertEmail || 'unset'}`,
      );
      return;
    }

    this.lastGasAlertSentAt.set(level, now);

    const subject =
      level === 'EXHAUSTED'
        ? `[SHIN Relayer] CRITICAL: Out of NEAR Gas (${this.relayerAccountId})`
        : `[SHIN Relayer] WARNING: Low NEAR Gas (${this.relayerAccountId})`;

    const availableStr =
      details.availableNear !== undefined
        ? `${details.availableNear} NEAR`
        : 'Unavailable';
    const totalStr =
      details.totalNear !== undefined
        ? `${details.totalNear} NEAR`
        : 'Unavailable';
    const lockedStr =
      details.storageLockedNear !== undefined
        ? `${details.storageLockedNear} NEAR`
        : 'Unavailable';

    const textLines = [
      `SHIN Arena NEAR Relayer Alert: ${label}`,
      `Account: ${this.relayerAccountId} (${this.networkId})`,
      `Available (unlocked) NEAR: ${availableStr}`,
      `Total NEAR balance: ${totalStr}`,
      `Storage-locked NEAR: ${lockedStr}`,
      `Thresholds: Low <= ${this.lowGasThresholdNear} NEAR | Critical <= ${this.criticalGasThresholdNear} NEAR`,
      `Trigger: ${details.trigger}`,
      details.errorMessage ? `Error: ${details.errorMessage}` : '',
      `Timestamp: ${new Date().toISOString()}`,
    ].filter(Boolean);

    const html = `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #e5e7eb; border-radius: 8px;">
        <h2 style="color: ${level === 'EXHAUSTED' ? '#dc2626' : '#d97706'}; margin-top: 0;">
          ${label}
        </h2>
        <p>Your SHIN Arena NEAR relayer account needs a NEAR top-up to keep executing on-chain transactions.</p>
        <table style="width: 100%; border-collapse: collapse; margin: 16px 0;">
          <tr><td style="padding: 6px 0; color: #6b7280;">Relayer Account</td><td style="padding: 6px 0; font-weight: bold;">${this.relayerAccountId} (${this.networkId})</td></tr>
          <tr><td style="padding: 6px 0; color: #6b7280;">Available (Unlocked) NEAR</td><td style="padding: 6px 0; font-weight: bold; color: ${level === 'EXHAUSTED' ? '#dc2626' : '#d97706'};">${availableStr}</td></tr>
          <tr><td style="padding: 6px 0; color: #6b7280;">Total Balance</td><td style="padding: 6px 0;">${totalStr}</td></tr>
          <tr><td style="padding: 6px 0; color: #6b7280;">Storage-Locked NEAR</td><td style="padding: 6px 0;">${lockedStr}</td></tr>
          <tr><td style="padding: 6px 0; color: #6b7280;">Alert Thresholds</td><td style="padding: 6px 0;">Low &le; ${this.lowGasThresholdNear} NEAR | Critical &le; ${this.criticalGasThresholdNear} NEAR</td></tr>
          <tr><td style="padding: 6px 0; color: #6b7280;">Trigger</td><td style="padding: 6px 0;"><code>${details.trigger}</code></td></tr>
        </table>
        ${details.errorMessage ? `<p style="background: #fef2f2; color: #991b1b; padding: 10px; border-radius: 6px; font-family: monospace; font-size: 12px;">${details.errorMessage}</p>` : ''}
        <p style="color: #6b7280; font-size: 12px; margin-bottom: 0;">Sent at ${new Date().toISOString()} (cooldown: ${Math.round(this.alertCooldownMs / 60000)} min)</p>
      </div>
    `;

    try {
      await this.mailTransporter.sendMail({
        from: process.env.SMTP_FROM || `"SHIN Arena Relayer" <${process.env.SMTP_USER}>`,
        to: this.adminAlertEmail,
        subject,
        text: textLines.join('\n'),
        html,
      });
      this.logger.log(
        `Relayer ${level} gas alert email sent to ${this.adminAlertEmail}`,
      );
    } catch (err: any) {
      this.logger.warn(
        `Failed to send relayer gas alert email: ${err?.message || err}`,
      );
    }
  }
}
