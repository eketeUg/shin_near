import { Controller, Get, Param, NotFoundException } from '@nestjs/common';
import { WalletService } from './wallet.service';

@Controller('wallet')
export class WalletController {
  constructor(private readonly walletService: WalletService) {}

  @Get('balance/:walletAddress')
  async getBalance(@Param('walletAddress') walletAddress: string) {
    try {
      const balances = await this.walletService.getWalletBalance(
        walletAddress,
        process.env.NEAR_RPC_URL,
      );
      
      if (!balances) {
        throw new NotFoundException('Could not fetch balances for this wallet');
      }
      
      return balances;
    } catch (error) {
      throw new NotFoundException(`Wallet balance fetch failed: ${error.message}`);
    }
  }
}
