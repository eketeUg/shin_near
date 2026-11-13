import { Body, Controller, Get, Post, Query } from '@nestjs/common';
import { NearRelayerService } from './near-relayer.service';

@Controller('near')
export class NearRelayerController {
  constructor(private readonly nearRelayer: NearRelayerService) {}

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
    @Body()
    body: {
      methodName: string;
      args?: Record<string, unknown>;
      attachedDepositNear?: string;
      gas?: string;
    },
  ) {
    return this.nearRelayer.callMethod(
      body.methodName,
      body.args || {},
      body.attachedDepositNear || '0',
      body.gas || '60000000000000',
    );
  }
}
