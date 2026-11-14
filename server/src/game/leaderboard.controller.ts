import { Controller, Get } from '@nestjs/common';
import { UsersService } from '../users/users.service';
import { AgentWalletService } from './agent-wallet.service';
import { NearRelayerService } from './near-relayer.service';

@Controller('leaderboard')
export class LeaderboardController {
  constructor(
    private readonly agentWalletService: AgentWalletService,
    private readonly usersService: UsersService,
    private readonly nearRelayer: NearRelayerService,
  ) {}

  @Get()
  async getLeaderboard() {
    const [rawAgents, rawHumans] = await Promise.all([
      this.agentWalletService.getAllAgentsDirectory(),
      this.usersService.findAllRegistered(),
    ]);

    const agents = rawAgents
      .map((a) => {
        const totalBouts = (a.wins || 0) + (a.losses || 0);
        const winRate =
          totalBouts > 0 ? Math.round(((a.wins || 0) / totalBouts) * 100) : 0;
        return {
          ...a,
          totalBouts,
          winRate,
        };
      })
      .sort(
        (a, b) =>
          b.shinBalance - a.shinBalance ||
          b.wins - a.wins ||
          b.elo - a.elo,
      );

    const humans = await Promise.all(
      (rawHumans || []).map(async (u: any) => {
        let shinBalance = 0;
        if (u.walletAddress) {
          try {
            const raw = (await this.nearRelayer.viewMethod(
              'ft_balance_of',
              { account_id: u.walletAddress },
              this.nearRelayer.shinTokenId,
            )) as string | null;
            if (raw) {
              shinBalance = Number(BigInt(raw) / BigInt('1000000000000000')) / 1000;
            }
          } catch {
            shinBalance = 0;
          }
        }
        const wins = u.wins || 0;
        const losses = u.losses || 0;
        const totalBouts = wins + losses;
        const winRate =
          totalBouts > 0 ? Math.round((wins / totalBouts) * 100) : 0;

        return {
          username: u.username || u.walletAddress?.slice(0, 12) || 'Warrior',
          walletAddress: u.walletAddress,
          nearblocksUrl: u.walletAddress
            ? `https://testnet.nearblocks.io/address/${u.walletAddress}`
            : '',
          level: u.level || 1,
          xp: u.xp || 0,
          elo: u.rating || 100,
          wins,
          losses,
          totalBouts,
          winRate,
          winStreak: u.winStreak || 0,
          totalShinEarned: u.totalShinEarned || 0,
          shinBalance,
        };
      }),
    );

    humans.sort(
      (a, b) =>
        b.totalShinEarned - a.totalShinEarned ||
        b.wins - a.wins ||
        b.elo - a.elo,
    );

    return {
      ok: true,
      updatedAt: Date.now(),
      agents,
      humans,
    };
  }
}
