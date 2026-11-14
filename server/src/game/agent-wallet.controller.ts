import {
  Body,
  Controller,
  Get,
  Param,
  Post,
  Req,
  UnauthorizedException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import type { Request } from 'express';
import { UsersService } from '../users/users.service';
import { AgentWalletService } from './agent-wallet.service';

@Controller('agents')
export class AgentWalletController {
  constructor(
    private readonly agentWalletService: AgentWalletService,
    private readonly jwtService: JwtService,
    private readonly usersService: UsersService,
  ) {}

  @Get('directory')
  async getDirectory() {
    const agents = await this.agentWalletService.getAllAgentsDirectory();
    return { ok: true, agents };
  }

  @Post('provision')
  async provision(@Body() body: { tokenId: string }) {
    return this.agentWalletService.provisionAgentWallet(body.tokenId);
  }

  @Get(':tokenId/balance')
  async getBalance(@Param('tokenId') tokenId: string) {
    const accountId = this.agentWalletService.deriveAgentAccountId(tokenId);
    const balances = await this.agentWalletService.getOnChainBalances(accountId);
    return { ok: true, ...balances };
  }

  @Post('withdraw')
  async withdrawToOwner(
    @Req() req: Request,
    @Body() body: { tokenId: string; amountShin: number },
  ) {
    const token = req.cookies?.['jwt'] as string | undefined;
    if (!token) {
      throw new UnauthorizedException('Sign in to withdraw from your agent wallet.');
    }
    let payload: { sub?: string };
    try {
      payload = this.jwtService.verify(token);
    } catch {
      throw new UnauthorizedException('Session expired. Please sign in again.');
    }
    const user = payload?.sub ? await this.usersService.findById(payload.sub) : null;
    if (!user?.walletAddress) {
      throw new UnauthorizedException('No NEAR wallet linked to this account.');
    }

    const res = await this.agentWalletService.withdrawShinToOwner({
      tokenId: body.tokenId,
      callerAccountId: user.walletAddress,
      amountShin: Number(body.amountShin),
    });
    return res;
  }
}
