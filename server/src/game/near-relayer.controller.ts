import { Body, Controller, Get, Post, Query, Req } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import type { Request } from 'express';
import { NearRelayerService } from './near-relayer.service';

@Controller('near')
export class NearRelayerController {
  constructor(
    private readonly nearRelayer: NearRelayerService,
    private readonly jwtService: JwtService,
  ) {}

  @Get('status')
  getStatus() {
    return this.nearRelayer.getStatus();
  }

  @Get('view')
  async viewMethod(
    @Query('method') method: string,
    @Query('args') argsJson?: string,
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
      const result = await this.nearRelayer.viewMethod(method, args);
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
    try {
      this.jwtService.verify(token);
    } catch {
      return {
        ok: false,
        simulated: true,
        error: 'Session expired. Please sign in again.',
      };
    }

    return this.nearRelayer.callMethod(
      body.methodName,
      body.args || {},
      body.attachedDepositNear || '0',
      body.gas || '60000000000000',
    );
  }
}
