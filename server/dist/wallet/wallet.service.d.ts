export declare class WalletService {
    private readonly logger;
    private generateKey;
    createNEARWallet: (username?: string) => Record<string, any>;
    createSVMWallet: () => Record<string, any>;
    getSVMAddressFromPrivateKey: (privateKey: string) => Record<string, string>;
    encryptSVMWallet: (password: string, privateKey: string) => Record<string, string>;
    decryptSVMWallet: (password: string, encryptedWallet: string) => Record<string, any>;
    getNearBalance: (accountId: string, rpcURL?: string) => Promise<Record<string, number>>;
    getNEP141TokenBalance: (accountId: string, tokenContractId: string, decimals?: number, rpcURL?: string) => Promise<Record<string, number>>;
    getSolBalance: (address: string, rpcURL?: string) => Promise<Record<string, number>>;
    getUSDCBalance: (address: string, rpcURL?: string) => Promise<Record<string, number>>;
    getUSDTBalance: (address: string, rpcURL?: string) => Promise<Record<string, number>>;
    getWalletBalance: (walletAddress: string, rpcURL?: string) => Promise<{
        nearBalance: Record<string, number>;
        solBalance: Record<string, number>;
        usdcBalance: Record<string, number>;
        usdtBalance: Record<string, number>;
    }>;
}
