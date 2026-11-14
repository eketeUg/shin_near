/* eslint-disable @typescript-eslint/no-unsafe-assignment */
/* eslint-disable @typescript-eslint/no-unsafe-member-access */
import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
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
  'ft_transfer_call',
  'withdraw_agent_shin',
  'settle_shin_match',
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
export class NearRelayerService implements OnModuleInit {
  private readonly logger = new Logger(NearRelayerService.name);

  readonly networkId = process.env.NEAR_NETWORK || 'testnet';
  readonly rpcUrl = process.env.NEAR_RPC_URL || 'https://test.rpc.fastnear.com';
  readonly contractId = process.env.NEAR_CONTRACT_ID || 'shin-arena-28d.testnet';
  readonly shinTokenId =
    process.env.NEAR_SHIN_TOKEN_ID || 'shin.shin-arena-28d.testnet';
  readonly relayerAccountId =
    process.env.NEAR_REFEREE_ACCOUNT_ID ||
    process.env.NEAR_CONTRACT_ID ||
    'shin-arena-28d.testnet';

  private provider = new providers.JsonRpcProvider({ url: this.rpcUrl });
  private relayerAccount: Account | null = null;
  private txQueue: Promise<unknown> = Promise.resolve();

  async onModuleInit() {
    await this.initRelayer();
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
    const argsBase64 = Buffer.from(JSON.stringify(args)).toString('base64');
    const res: any = await this.provider.query({
      request_type: 'call_function',
      finality: 'final',
      account_id: resolvedContract,
      method_name: methodName,
      args_base64: argsBase64,
    });
    if (Array.isArray(res?.result)) {
      const text = Buffer.from(res.result).toString('utf8');
      try {
        return JSON.parse(text);
      } catch {
        return text;
      }
    }
    return null;
  }

  callMethod(
    methodName: string,
    args: Record<string, unknown> = {},
    attachedDepositNear = '0',
    gas = '60000000000000',
    customSigner?: { accountId: string; privateKey: string },
    targetContractId?: string,
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
      this.logger.warn(
        `[NEAR TX FAILED] ${methodName}: ${err?.message || err}`,
      );
      return {
        ok: false,
        simulated: true,
        contractId: this.contractId,
        relayerAccountId: this.relayerAccountId,
        methodName,
        txHash: '',
        explorerUrl: '',
        error: err?.message || String(err),
      };
    }
  }

  /**
   * Sends a small real Testnet NEAR drip to a newly onboarded user's implicit account
   * (only if their current on-chain balance is below 0.1 NEAR).
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
      // Check current balance first to prevent repeated drips
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

      if (currentNear >= 0.1) {
        return {
          ok: false,
          simulated: false,
          contractId: this.contractId,
          relayerAccountId: this.relayerAccountId,
          methodName: 'sendMoney',
          txHash: '',
          explorerUrl: '',
          error: `Account already funded (${currentNear.toFixed(4)} NEAR)`,
        };
      }

      const yocto = BigInt(utils.format.parseNearAmount(amountNear) || '0');
      const outcome: any = await this.relayerAccount.sendMoney(receiverId, yocto);
      const txHash: string =
        outcome?.transaction?.hash || outcome?.transaction_outcome?.id || '';
      const explorerUrl = txHash
        ? `https://testnet.nearblocks.io/txns/${txHash}`
        : '';

      this.logger.log(`[NEAR DRIP] Sent ${amountNear} NEAR to ${receiverId} -> ${txHash}`);
      return {
        ok: true,
        simulated: false,
        contractId: this.contractId,
        relayerAccountId: this.relayerAccountId,
        methodName: 'sendMoney',
        txHash,
        explorerUrl,
      };
    } catch (err: any) {
      return {
        ok: false,
        simulated: true,
        contractId: this.contractId,
        relayerAccountId: this.relayerAccountId,
        methodName: 'sendMoney',
        txHash: '',
        explorerUrl: '',
        error: err?.message || String(err),
      };
    }
  }
}
