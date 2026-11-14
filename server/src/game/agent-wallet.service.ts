import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { KeyPair } from 'near-api-js';
import { WalletService } from '../wallet/wallet.service';
import { NearRelayerService } from './near-relayer.service';
import { AgentWallet, AgentWalletDocument } from './schema/agent-wallet.schema';

@Injectable()
export class AgentWalletService {
  private readonly logger = new Logger(AgentWalletService.name);

  constructor(
    @InjectModel(AgentWallet.name)
    private readonly agentWalletModel: Model<AgentWalletDocument>,
    private readonly nearRelayer: NearRelayerService,
    private readonly walletService: WalletService,
  ) {}

  private getEncryptionPin(): string {
    return (
      process.env.DEFAULT_WALLET_PIN ||
      process.env.JWT_SECRET ||
      'shin_arena_default_wallet_pin'
    );
  }

  public deriveAgentAccountId(tokenId: string): string {
    const cleanSlug = tokenId.toLowerCase().replace(/[^a-z0-9-]/g, '-');
    return `${cleanSlug}.${this.nearRelayer.contractId}`;
  }

  public async provisionAgentWallet(tokenId: string): Promise<{
    ok: boolean;
    tokenId: string;
    agentAccountId: string;
    publicKey: string;
    nearblocksUrl: string;
    alreadyExisted: boolean;
    error?: string;
  }> {
    const existing = await this.agentWalletModel.findOne({ tokenId }).exec();
    if (existing) {
      return {
        ok: true,
        tokenId,
        agentAccountId: existing.agentAccountId,
        publicKey: existing.publicKey,
        nearblocksUrl: `https://testnet.nearblocks.io/address/${existing.agentAccountId}`,
        alreadyExisted: true,
      };
    }

    const relayer = this.nearRelayer.getRelayerAccount();
    if (!relayer) {
      return {
        ok: false,
        tokenId,
        agentAccountId: this.deriveAgentAccountId(tokenId),
        publicKey: '',
        nearblocksUrl: '',
        alreadyExisted: false,
        error: 'NEAR relayer not initialized on server',
      };
    }

    const agentAccountId = this.deriveAgentAccountId(tokenId);
    const keyPair = KeyPair.fromRandom('ed25519');
    const publicKey = keyPair.getPublicKey().toString();
    const privateKey = keyPair.toString();

    try {
      // 1. Check if sub-account already exists on-chain
      let accountExists = false;
      try {
        await this.nearRelayer.getRpcProvider().query({
          request_type: 'view_account',
          finality: 'final',
          account_id: agentAccountId,
        });
        accountExists = true;
      } catch {
        accountExists = false;
      }

      if (!accountExists) {
        // Fund with 0.05 NEAR for storage + gas + $SHIN storage_deposit
        await relayer.createAccount(
          agentAccountId,
          keyPair.getPublicKey(),
          BigInt('50000000000000000000000'),
        );
      }

      // 2. Register standalone agent account on $SHIN NEP-141 token (0.00125 NEAR)
      await relayer.functionCall({
        contractId: this.nearRelayer.shinTokenId,
        methodName: 'storage_deposit',
        args: { account_id: agentAccountId, registration_only: true },
        gas: BigInt('30000000000000'),
        attachedDeposit: BigInt('1250000000000000000000'),
      });

      // 3. Encrypt & store keypair in MongoDB
      const encrypted = this.walletService.encryptSVMWallet(
        this.getEncryptionPin(),
        privateKey,
      );
      await this.agentWalletModel.create({
        tokenId,
        agentAccountId,
        publicKey,
        encryptedPrivateKey: encrypted.json,
      });

      this.logger.log(`Provisioned standalone NEAR wallet ${agentAccountId} for ${tokenId}`);
      return {
        ok: true,
        tokenId,
        agentAccountId,
        publicKey,
        nearblocksUrl: `https://testnet.nearblocks.io/address/${agentAccountId}`,
        alreadyExisted: false,
      };
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      this.logger.error(`Failed to provision wallet for ${tokenId}: ${msg}`);
      return {
        ok: false,
        tokenId,
        agentAccountId,
        publicKey,
        nearblocksUrl: `https://testnet.nearblocks.io/address/${agentAccountId}`,
        alreadyExisted: false,
        error: msg,
      };
    }
  }

  public async getOnChainBalances(agentAccountId: string): Promise<{
    agentAccountId: string;
    nearBalance: number;
    shinBalance: number;
    nearblocksUrl: string;
  }> {
    let nearBalance = 0;
    let shinBalance = 0;

    try {
      const acct: any = await this.nearRelayer.getRpcProvider().query({
        request_type: 'view_account',
        finality: 'final',
        account_id: agentAccountId,
      });
      if (acct?.amount) {
        nearBalance = Number(BigInt(acct.amount) / BigInt('100000000000000000000')) / 10000;
      }
    } catch {
      nearBalance = 0;
    }

    try {
      const rawShin = (await this.nearRelayer.viewMethod(
        'ft_balance_of',
        { account_id: agentAccountId },
        this.nearRelayer.shinTokenId,
      )) as string | null;
      if (rawShin) {
        shinBalance = Number(BigInt(rawShin) / BigInt('1000000000000000')) / 1000;
      }
    } catch {
      shinBalance = 0;
    }

    return {
      agentAccountId,
      nearBalance,
      shinBalance,
      nearblocksUrl: `https://testnet.nearblocks.io/address/${agentAccountId}`,
    };
  }

  public async getAllAgentsDirectory() {
    const fighters = (await this.nearRelayer.viewMethod('get_all_fighters', {})) as any[] | null;
    if (!Array.isArray(fighters)) return [];

    const results = await Promise.all(
      fighters.map(async (f) => {
        const walletRecord = await this.agentWalletModel.findOne({ tokenId: f.token_id }).exec();
        const resolvedWalletId =
          walletRecord?.agentAccountId ||
          (f.agent_wallet_id?.endsWith(`.${this.nearRelayer.contractId}`)
            ? f.agent_wallet_id
            : this.deriveAgentAccountId(f.token_id));
        const balances = await this.getOnChainBalances(resolvedWalletId);
        return {
          tokenId: f.token_id,
          name: f.name,
          charClass: f.char_class,
          ownerId: f.owner_id,
          powerLevel: f.power_level,
          atk: f.atk ?? 70,
          def: f.def ?? 70,
          spd: f.spd ?? 70,
          wins: f.wins ?? 0,
          losses: f.losses ?? 0,
          elo: f.elo ?? 1000,
          hasStandaloneWallet: Boolean(walletRecord),
          ...balances,
        };
      }),
    );

    return results;
  }

  public async withdrawShinToOwner(params: {
    tokenId: string;
    callerAccountId: string;
    amountShin: number;
  }) {
    if (!params.amountShin || params.amountShin <= 0) {
      throw new Error('Withdrawal amount must be greater than 0 $SHIN.');
    }

    // 1. Strict on-chain ownership verification via NEP-171 nft_token
    const nft = (await this.nearRelayer.viewMethod('nft_token', {
      token_id: params.tokenId,
    })) as { owner_id?: string } | null;

    if (!nft?.owner_id) {
      throw new NotFoundException(`Fighter NFT ${params.tokenId} not found on-chain.`);
    }
    if (nft.owner_id !== params.callerAccountId) {
      throw new ForbiddenException(
        `Only the on-chain owner (${nft.owner_id}) can withdraw from ${params.tokenId}.`,
      );
    }

    // 2. Look up standalone agent wallet & decrypt private key
    const walletRecord = await this.agentWalletModel
      .findOne({ tokenId: params.tokenId })
      .exec();
    if (!walletRecord) {
      throw new NotFoundException(
        `No standalone wallet provisioned yet for ${params.tokenId}.`,
      );
    }

    const decrypted = this.walletService.decryptSVMWallet(
      this.getEncryptionPin(),
      walletRecord.encryptedPrivateKey,
    );
    if (!decrypted?.privateKey) {
      throw new Error('Failed to decrypt agent wallet key.');
    }

    // 3. Ensure receiver ($SHIN storage_deposit) is registered for owner
    const relayer = this.nearRelayer.getRelayerAccount();
    if (relayer) {
      try {
        await relayer.functionCall({
          contractId: this.nearRelayer.shinTokenId,
          methodName: 'storage_deposit',
          args: { account_id: params.callerAccountId, registration_only: true },
          gas: BigInt('30000000000000'),
          attachedDeposit: BigInt('1250000000000000000000'),
        });
      } catch {
        // Ignore if already registered
      }
    }

    // 4. Sign real ft_transfer FROM agentAccountId TO owner's personal NEAR wallet
    const rawAmount = (
      BigInt(Math.floor(params.amountShin * 1000)) * BigInt('1000000000000000')
    ).toString();

    return this.nearRelayer.callMethod(
      'ft_transfer',
      {
        receiver_id: params.callerAccountId,
        amount: rawAmount,
        memo: `Owner withdrawal from Agent ${params.tokenId}`,
      },
      '1yocto',
      '60000000000000',
      {
        accountId: walletRecord.agentAccountId,
        privateKey: decrypted.privateKey,
      },
      this.nearRelayer.shinTokenId,
    );
  }

  /**
   * Guarded autonomous Agent-to-Agent $SHIN transfer:
   * - Max 100 $SHIN per autonomous transfer
   * - Enforces 200 $SHIN minimum reserve in sender wallet
   * - Target must be a registered standalone agent wallet in MongoDB
   */
  async autonomousAgentTransferShin(params: {
    fromTokenId: string;
    toTokenId: string;
    amountShin: number;
    memo?: string;
  }) {
    const cappedAmount = Math.min(100, Math.max(1, Math.floor(params.amountShin)));
    if (params.fromTokenId === params.toTokenId) {
      throw new BadRequestException('Cannot transfer to self.');
    }

    const fromWallet = await this.agentWalletModel
      .findOne({ tokenId: params.fromTokenId })
      .exec();
    const toWallet = await this.agentWalletModel
      .findOne({ tokenId: params.toTokenId })
      .exec();

    if (!fromWallet || !toWallet) {
      throw new NotFoundException('Both sender and receiver must have standalone agent wallets.');
    }

    const bal = await this.getOnChainBalances(fromWallet.agentAccountId);
    if (bal.shinBalance < cappedAmount + 200) {
      throw new BadRequestException(
        `Guardrail blocked: sender requires at least ${cappedAmount + 200} $SHIN (200 $SHIN reserve).`,
      );
    }

    const decrypted = this.walletService.decryptSVMWallet(
      this.getEncryptionPin(),
      fromWallet.encryptedPrivateKey,
    );
    if (!decrypted?.privateKey) {
      throw new Error('Failed to decrypt sender agent wallet key.');
    }

    const rawAmount = (
      BigInt(Math.floor(cappedAmount * 1000)) * BigInt('1000000000000000')
    ).toString();

    return this.nearRelayer.callMethod(
      'ft_transfer',
      {
        receiver_id: toWallet.agentAccountId,
        amount: rawAmount,
        memo: params.memo || `Autonomous Agent Tip (${params.fromTokenId} -> ${params.toTokenId})`,
      },
      '1yocto',
      '60000000000000',
      {
        accountId: fromWallet.agentAccountId,
        privateKey: decrypted.privateKey,
      },
      this.nearRelayer.shinTokenId,
    );
  }
}
