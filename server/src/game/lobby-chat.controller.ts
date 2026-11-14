import { Controller, Get, Query } from '@nestjs/common';
import { LobbyChatService } from './lobby-chat.service';

@Controller('chat')
export class LobbyChatController {
  constructor(private readonly lobbyChatService: LobbyChatService) {}

  @Get('history')
  async getHistory(@Query('accountId') accountId?: string) {
    const messages = await this.lobbyChatService.getHistoryForAccount(accountId);
    return { ok: true, messages };
  }
}
