import { Body, Controller, Get, Post } from '@nestjs/common';
import { TournamentService } from './tournament.service';

@Controller('tournaments')
export class TournamentController {
  constructor(private readonly tournamentService: TournamentService) {}

  @Get('state')
  getState() {
    return {
      ok: true,
      ...this.tournamentService.getState(),
    };
  }

  @Post('human/join')
  async joinHumanCup(
    @Body()
    body: {
      accountId: string;
      username: string;
      charId: string;
      joinTxHash: string;
    },
  ) {
    try {
      const humanCup = await this.tournamentService.joinHumanCup(body);
      return { ok: true, humanCup };
    } catch (err: unknown) {
      return {
        ok: false,
        error: err instanceof Error ? err.message : String(err),
      };
    }
  }

  @Post('human/report-match')
  async reportHumanMatch(
    @Body() body: { matchId: string; winnerAccountId: string },
  ) {
    try {
      const humanCup = await this.tournamentService.reportHumanMatchResult(body);
      return { ok: true, humanCup };
    } catch (err: unknown) {
      return {
        ok: false,
        error: err instanceof Error ? err.message : String(err),
      };
    }
  }

  @Post('human/next-cup')
  async openNextHumanCup() {
    try {
      const humanCup = await this.tournamentService.openNextHumanCup();
      return { ok: true, humanCup };
    } catch (err: unknown) {
      return {
        ok: false,
        error: err instanceof Error ? err.message : String(err),
      };
    }
  }

  @Post('agent/enrollment')
  setAgentEnrollment(@Body() body: { tokenId: string; enrolled: boolean }) {
    return {
      ok: true,
      ...this.tournamentService.setAgentEnrollment(body.tokenId, body.enrolled),
    };
  }
}
