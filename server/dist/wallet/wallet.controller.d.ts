import { WalletService } from './wallet.service';
export declare class WalletController {
    private readonly walletService;
    constructor(walletService: WalletService);
    getBalance(walletAddress: string): Promise<{
        nearBalance: Record<string, number>;
        solBalance: Record<string, number>;
        usdcBalance: Record<string, number>;
        usdtBalance: Record<string, number>;
    }>;
}
