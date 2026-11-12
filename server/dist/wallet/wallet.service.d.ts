import { Transaction } from '@solana/web3.js';
export declare class WalletService {
    private readonly logger;
    private generateKey;
    createSVMWallet: () => Record<string, any>;
    getSVMAddressFromPrivateKey: (privateKey: string) => Record<string, string>;
    encryptSVMWallet: (password: string, privateKey: string) => Record<string, string>;
    decryptSVMWallet: (password: string, encryptedWallet: string) => Record<string, any>;
    getSolBalance: (address: string, rpcURL: string) => Promise<Record<string, number>>;
    getSPLTokenBalance: (address: string, tokenAddress: string, rpcURL: string, decimal: number) => Promise<Record<string, number>>;
    getUSDCBalance: (address: string, rpcURL: string) => Promise<Record<string, number>>;
    getUSDTBalance: (address: string, rpcURL: string) => Promise<Record<string, number>>;
    getWalletBalance: (walletAddress: string, rpcURL: string) => Promise<{
        solBalance: Record<string, number>;
        usdcBalance: Record<string, number>;
        usdtBalance: Record<string, number>;
    }>;
    transferSOL: (privateKey: string, recipientAddress: string, amount: number, rpcURL: string, description?: string) => Promise<Record<any, unknown>>;
    transferSPLToken: (privateKey: string, recipientAddress: string, amount: number, tokenAddress: string, rpcURL: string, decimal: number, description?: string) => Promise<Record<any, unknown>>;
    builtTokenTranferTx: (privateKey: string, recipientAddress: string, amount: number, tokenAddress: string, rpcURL: string, decimal: number) => Promise<Transaction>;
}
