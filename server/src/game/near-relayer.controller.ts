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
    try {
      const dbUser = payload?.sub
        ? await this.usersService.findById(payload.sub)
        : null;
      if (dbUser?.walletAddress && dbUser?.walletDetails) {
        const bal = await this.walletService.getNearBalance(dbUser.walletAddress);
        if ((bal?.balance ?? 0) >= 0.1) {
          const pin =
            process.env.DEFAULT_WALLET_PIN ||
            process.env.JWT_SECRET ||
            'shin_arena_default_wallet_pin';
          const decrypted = this.walletService.decryptSVMWallet(
            pin,
            dbUser.walletDetails,
          );
          if (decrypted?.privateKey) {
            customSigner = {
              accountId: dbUser.walletAddress,
              privateKey: decrypted.privateKey,
            };
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
}
