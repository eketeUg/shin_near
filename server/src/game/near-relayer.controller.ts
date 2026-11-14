import { Body, Controller, Get, Post, Query, Req } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import type { Request } from 'express';
import { UsersService } from '../users/users.service';
import { WalletService } from '../wallet/wallet.service';
import { NearRelayerService } from './near-relayer.service';

@Controller('near')
export class NearRelayerController {
  constructor(
    private readonly nearRelayer: NearRelayerService,
    private readonly jwtService: JwtService,
    private readonly usersService: UsersService,
    private readonly walletService: WalletService,
  ) {}

  @Get('status')
  getStatus() {
    return this.nearRelayer.getStatus();
  }

  @Get('view')
  async viewMethod(
    @Query('method') method: string,
    @Query('args') argsJson?: string,
    @Query('contractId') contractId?: string,
  ) {
    let args: Record<string, unknown> = {};
    if (argsJson) {
      try {
        args = JSON.parse(argsJson) as Record<string, unknown>;
      } catch {
        args = {};
      }
    }
    try {
      const result = await this.nearRelayer.viewMethod(method, args, contractId);
      return { ok: true, result };
    } catch (err: unknown) {
      return {
        ok: false,
        error: err instanceof Error ? err.message : String(err),
      };
    }
  }

  @Post('call')
  async callMethod(
    @Req() req: Request,
    @Body()
    body: {
      methodName: string;
      args?: Record<string, unknown>;
      attachedDepositNear?: string;
      gas?: string;
      contractId?: string;
    },
  ) {
    const token = req.cookies?.['jwt'] as string | undefined;
    if (!token) {
      return {
        ok: false,
        simulated: true,
        error: 'Login with Google or Email to execute on-chain NEAR transactions',
      };
    }
    let payload: any;
    try {
      payload = this.jwtService.verify(token);
    } catch {
      return {
        ok: false,
        simulated: true,
        error: 'Session expired. Please sign in again.',
      };
    }

    // Sign directly from the user's own funded NEAR wallet when balance >= 0.1 NEAR
    let customSigner: { accountId: string; privateKey: string } | undefined;
    let userWalletAddress: string | undefined = payload?.walletAddress;
    try {
      const dbUser = payload?.sub
        ? await this.usersService.findById(payload.sub)
        : null;
      if (dbUser?.walletAddress) {
        userWalletAddress = dbUser.walletAddress;
      }
      if (dbUser?.walletAddress && dbUser?.walletDetails) {
        const bal = await this.walletService.getNearBalance(dbUser.walletAddress);
        if ((bal?.balance ?? 0) >= 0.1) {
          const defaultPin = this.walletService.getDefaultWalletPin();
          const decrypted = this.walletService.decryptSVMWallet(
            defaultPin,
            dbUser.walletDetails,
          );
          if (decrypted?.privateKey) {
            customSigner = {
              accountId: dbUser.walletAddress,
              privateKey: decrypted.privateKey,
            };
            if (decrypted.usedPin && decrypted.usedPin !== defaultPin) {
              const reEncrypted = this.walletService.encryptSVMWallet(
                defaultPin,
                decrypted.privateKey,
              );
              dbUser.walletDetails = reEncrypted.json;
              await dbUser.save();
            }
          }
        }
      }
    } catch {
      // Fallback to relayer if user wallet decryption/balance lookup fails
    }

    return this.nearRelayer.callMethod(
      body.methodName,
      body.args || {},
      body.attachedDepositNear || '0',
      body.gas || '60000000000000',
      customSigner,
      body.contractId,
      userWalletAddress,
    );
  }

  @Post('drip')
  async dripTestnetNear(
    @Req() req: Request,
    @Body() body: { receiverId?: string },
  ) {
    const token = req.cookies?.['jwt'] as string | undefined;
    if (!token) {
      return {
        ok: false,
        simulated: true,
        error: 'Login with Google or Email to claim Testnet NEAR',
      };
    }
    let payload: any;
    try {
      payload = this.jwtService.verify(token);
    } catch {
      return {
        ok: false,
        simulated: true,
        error: 'Session expired. Please sign in again.',
      };
    }

    const target = body?.receiverId || payload?.walletAddress;
    if (!target) {
      return { ok: false, simulated: true, error: 'No walletAddress found' };
    }
    return this.nearRelayer.dripTestnetNear(target, '0.25');
  }

  @Post('transfer')
  async transferTokens(
    @Req() req: Request,
    @Body()
    body: {
      recipient: string;
      token: 'NEAR' | 'SHIN' | 'USDC' | 'USDT';
      amount: string | number;
    },
  ) {
    const tokenCookie = req.cookies?.['jwt'] as string | undefined;
    if (!tokenCookie) {
      return {
        ok: false,
        simulated: true,
        error: 'Login with Google or Email to send tokens',
      };
    }

    let payload: any;
    try {
      payload = this.jwtService.verify(tokenCookie);
    } catch {
      return {
        ok: false,
        simulated: true,
        error: 'Session expired. Please sign in again.',
      };
    }

    const sender = payload?.sub
      ? await this.usersService.findById(payload.sub)
      : null;
    if (!sender || sender.authProvider === 'guest') {
      return {
        ok: false,
        simulated: true,
        error: 'Guest players cannot send on-chain tokens. Sign in with Google or Email.',
      };
    }
    if (!sender.walletAddress || !sender.walletDetails) {
      return {
        ok: false,
        simulated: true,
        error: 'Embedded NEAR wallet not found for your account.',
      };
    }

    const tokenType = String(body?.token || '').toUpperCase() as
      | 'NEAR'
      | 'SHIN'
      | 'USDC'
      | 'USDT';
    if (!['NEAR', 'SHIN', 'USDC', 'USDT'].includes(tokenType)) {
      return { ok: false, simulated: true, error: 'Unsupported token type.' };
    }

    const amountNum = Number(body?.amount);
    const amountStr = String(body?.amount ?? '').trim();
    if (!Number.isFinite(amountNum) || amountNum <= 0 || !/^\d+(\.\d+)?$/.test(amountStr)) {
      return { ok: false, simulated: true, error: 'Enter a valid positive amount.' };
    }

    const rawRecipient = String(body?.recipient || '').trim().replace(/^@/, '');
    if (!rawRecipient) {
      return {
        ok: false,
        simulated: true,
        error: 'Enter a recipient username, .testnet address, or wallet address.',
      };
    }

    const isImplicitHex = /^[0-9a-f]{64}$/i.test(rawRecipient);
    const isNamedNear =
      rawRecipient.length >= 2 &&
      rawRecipient.length <= 64 &&
      /^[a-z0-9_-]+(\.[a-z0-9_-]+)+$/i.test(rawRecipient);

    let resolvedRecipient = '';
    let recipientUsername: string | undefined;

    if (isImplicitHex || isNamedNear) {
      resolvedRecipient = rawRecipient.toLowerCase();
      const matchedUser = await this.usersService.findByWallet(resolvedRecipient);
      if (matchedUser?.username) {
        recipientUsername = matchedUser.username;
      }
    } else {
      const targetUser = await this.usersService.findByUsername(rawRecipient);
      if (!targetUser?.walletAddress) {
        return {
          ok: false,
          simulated: true,
          error: `Player "${rawRecipient}" not found. Enter a valid player username, .testnet address, or 64-char NEAR wallet address.`,
        };
      }
      resolvedRecipient = targetUser.walletAddress;
      recipientUsername = targetUser.username;
    }

    if (resolvedRecipient.toLowerCase() === sender.walletAddress.toLowerCase()) {
      return {
        ok: false,
        simulated: true,
        error: 'You cannot send tokens to your own wallet.',
      };
    }

    let decryptedKey: string;
    try {
      const defaultPin = this.walletService.getDefaultWalletPin();
      const decrypted = this.walletService.decryptSVMWallet(
        defaultPin,
        sender.walletDetails,
      );
      if (!decrypted?.privateKey) {
        throw new Error('Missing private key');
      }
      decryptedKey = decrypted.privateKey;
      if (decrypted.usedPin && decrypted.usedPin !== defaultPin) {
        const reEncrypted = this.walletService.encryptSVMWallet(
          defaultPin,
          decrypted.privateKey,
        );
        sender.walletDetails = reEncrypted.json;
        await sender.save();
      }
    } catch {
      return {
        ok: false,
        simulated: true,
        error: 'Unable to unlock your embedded NEAR wallet.',
      };
    }

    const result = await this.nearRelayer.transferFromUserWallet({
      senderAccountId: sender.walletAddress,
      senderPrivateKey: decryptedKey,
      recipientId: resolvedRecipient,
      token: tokenType,
      amount: amountStr,
    });

    return {
      ...result,
      recipient: resolvedRecipient,
      recipientUsername,
      token: tokenType,
      amount: amountStr,
    };
  }
}
