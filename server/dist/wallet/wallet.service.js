"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
var WalletService_1;
Object.defineProperty(exports, "__esModule", { value: true });
exports.WalletService = void 0;
const common_1 = require("@nestjs/common");
const crypto_1 = require("crypto");
const web3_js_1 = require("@solana/web3.js");
const bs58_1 = __importDefault(require("bs58"));
const dotenv = __importStar(require("dotenv"));
const spl_token_1 = require("@solana/spl-token");
dotenv.config();
const ALGORITHM = 'aes-256-cbc';
const IV_LENGTH = 16;
let WalletService = WalletService_1 = class WalletService {
    logger = new common_1.Logger(WalletService_1.name);
    generateKey(password) {
        return (0, crypto_1.createHash)('sha256').update(password).digest();
    }
    createSVMWallet = () => {
        const keypair = web3_js_1.Keypair.generate();
        const privateKey = keypair.secretKey;
        const publicKey = keypair.publicKey;
        return {
            address: publicKey.toBase58(),
            privateKey: bs58_1.default.encode(privateKey),
        };
    };
    getSVMAddressFromPrivateKey = (privateKey) => {
        try {
            const privateKeyBytes = bs58_1.default.decode(privateKey);
            const wallet = web3_js_1.Keypair.fromSecretKey(privateKeyBytes);
            return {
                address: wallet.publicKey.toBase58(),
                privateKey: bs58_1.default.encode(wallet.secretKey),
            };
        }
        catch (error) {
            throw new Error(`Invalid private key format: ${error.message}`);
        }
    };
    encryptSVMWallet = (password, privateKey) => {
        const key = this.generateKey(password);
        const iv = (0, crypto_1.randomBytes)(IV_LENGTH);
        const cipher = (0, crypto_1.createCipheriv)(ALGORITHM, key, iv);
        let encrypted = cipher.update(privateKey, 'utf8', 'hex');
        encrypted += cipher.final('hex');
        const encryptedWallet = iv.toString('hex') + ':' + encrypted;
        return { json: encryptedWallet };
    };
    decryptSVMWallet = (password, encryptedWallet) => {
        try {
            const key = this.generateKey(password);
            const [ivHex, encrypted] = encryptedWallet.split(':');
            const iv = Buffer.from(ivHex, 'hex');
            const decipher = (0, crypto_1.createDecipheriv)(ALGORITHM, key, iv);
            let decrypted = decipher.update(encrypted, 'hex', 'utf8');
            decrypted += decipher.final('utf8');
            return {
                privateKey: decrypted,
                address: this.getSVMAddressFromPrivateKey(decrypted).address,
            };
        }
        catch (error) {
            throw new Error(`Failed to decrypt wallet: ${error.message}`);
        }
    };
    getSolBalance = async (address, rpcURL) => {
        try {
            const connection = new web3_js_1.Connection(rpcURL, 'confirmed');
            const publicKey = new web3_js_1.PublicKey(address);
            const balance = await connection.getBalance(publicKey);
            return { balance: balance / web3_js_1.LAMPORTS_PER_SOL };
        }
        catch (error) {
            this.logger.error(`Failed to get SOL balance for ${address}:`, error.message);
            return { balance: 0 };
        }
    };
    getSPLTokenBalance = async (address, tokenAddress, rpcURL, decimal) => {
        try {
            const connection = new web3_js_1.Connection(rpcURL, 'confirmed');
            const publicKey = new web3_js_1.PublicKey(address);
            const tokenMint = new web3_js_1.PublicKey(tokenAddress);
            const associatedTokenAddress = await (0, spl_token_1.getAssociatedTokenAddress)(tokenMint, publicKey, true);
            const accountInfo = await connection.getAccountInfo(associatedTokenAddress);
            if (!accountInfo)
                return { balance: 0 };
            const tokenAccount = await (0, spl_token_1.getAccount)(connection, associatedTokenAddress);
            return { balance: Number(tokenAccount.amount) / 10 ** decimal };
        }
        catch (error) {
            this.logger.error(`Error fetching SPL token balance:`, error.message);
            return { balance: 0 };
        }
    };
    getUSDCBalance = async (address, rpcURL) => {
        try {
            if (!process.env.USDC_MINT_ADDRESS) {
                throw new Error('USDC_MINT_ADDRESS is not set in environment variables');
            }
            const connection = new web3_js_1.Connection(rpcURL, 'confirmed');
            const publicKey = new web3_js_1.PublicKey(address);
            const tokenMint = new web3_js_1.PublicKey(process.env.USDC_MINT_ADDRESS);
            const associatedTokenAddress = await (0, spl_token_1.getAssociatedTokenAddress)(tokenMint, publicKey, true);
            const accountInfo = await connection.getAccountInfo(associatedTokenAddress);
            if (!accountInfo)
                return { balance: 0 };
            const tokenAccount = await (0, spl_token_1.getAccount)(connection, associatedTokenAddress);
            const balance = Number(tokenAccount.amount) / 10 ** 6;
            return { balance };
        }
        catch (error) {
            this.logger.error(`ERROR fetching USDC balance for ${address}:`, error.message);
            return { balance: 0 };
        }
    };
    getUSDTBalance = async (address, rpcURL) => {
        try {
            if (!process.env.USDT_MINT_ADDRESS) {
                throw new Error('USDT_MINT_ADDRESS is not set in environment variables');
            }
            const connection = new web3_js_1.Connection(rpcURL, 'confirmed');
            const publicKey = new web3_js_1.PublicKey(address);
            const tokenMint = new web3_js_1.PublicKey(process.env.USDT_MINT_ADDRESS);
            const associatedTokenAddress = await (0, spl_token_1.getAssociatedTokenAddress)(tokenMint, publicKey, true);
            const accountInfo = await connection.getAccountInfo(associatedTokenAddress);
            if (!accountInfo)
                return { balance: 0 };
            const tokenAccount = await (0, spl_token_1.getAccount)(connection, associatedTokenAddress);
            const balance = Number(tokenAccount.amount) / 10 ** 6;
            return { balance };
        }
        catch (error) {
            this.logger.error(`ERROR fetching USDT balance for ${address}:`, error.message);
            return { balance: 0 };
        }
    };
    getWalletBalance = async (walletAddress, rpcURL) => {
        const solBalance = await this.getSolBalance(walletAddress, rpcURL);
        const usdcBalance = await this.getUSDCBalance(walletAddress, rpcURL);
        const usdtBalance = await this.getUSDTBalance(walletAddress, rpcURL);
        return { solBalance, usdcBalance, usdtBalance };
    };
    transferSOL = async (privateKey, recipientAddress, amount, rpcURL, description) => {
        try {
            const connection = new web3_js_1.Connection(rpcURL, 'confirmed');
            const senderKeypair = web3_js_1.Keypair.fromSecretKey(bs58_1.default.decode(privateKey));
            const recipientPubkey = new web3_js_1.PublicKey(recipientAddress);
            const transaction = new web3_js_1.Transaction().add(web3_js_1.SystemProgram.transfer({
                fromPubkey: senderKeypair.publicKey,
                toPubkey: recipientPubkey,
                lamports: amount * web3_js_1.LAMPORTS_PER_SOL,
            }));
            const signature = await (0, web3_js_1.sendAndConfirmTransaction)(connection, transaction, [senderKeypair]);
            return { signature, description };
        }
        catch (error) {
            throw new Error(`Failed to transfer SOL: ${error.message}`);
        }
    };
    transferSPLToken = async (privateKey, recipientAddress, amount, tokenAddress, rpcURL, decimal, description) => {
        try {
            const connection = new web3_js_1.Connection(rpcURL, 'confirmed');
            const senderKeypair = web3_js_1.Keypair.fromSecretKey(bs58_1.default.decode(privateKey));
            const recipientPubkey = new web3_js_1.PublicKey(recipientAddress);
            const tokenMint = new web3_js_1.PublicKey(tokenAddress);
            const senderATA = await (0, spl_token_1.getAssociatedTokenAddress)(tokenMint, senderKeypair.publicKey);
            const recipientATA = await (0, spl_token_1.getOrCreateAssociatedTokenAccount)(connection, senderKeypair, tokenMint, recipientPubkey);
            const transaction = new web3_js_1.Transaction().add((0, spl_token_1.createTransferInstruction)(senderATA, recipientATA.address, senderKeypair.publicKey, amount * 10 ** decimal, [], spl_token_1.TOKEN_PROGRAM_ID));
            const signature = await (0, web3_js_1.sendAndConfirmTransaction)(connection, transaction, [senderKeypair]);
            return { signature, description };
        }
        catch (error) {
            throw new Error(`Failed to transfer SPL token: ${error.message}`);
        }
    };
    builtTokenTranferTx = async (privateKey, recipientAddress, amount, tokenAddress, rpcURL, decimal) => {
        try {
            const connection = new web3_js_1.Connection(rpcURL, 'confirmed');
            const senderKeypair = web3_js_1.Keypair.fromSecretKey(bs58_1.default.decode(privateKey));
            const recipientPubkey = new web3_js_1.PublicKey(recipientAddress);
            const tokenMint = new web3_js_1.PublicKey(tokenAddress);
            const senderATA = await (0, spl_token_1.getAssociatedTokenAddress)(tokenMint, senderKeypair.publicKey);
            const recipientATA = await (0, spl_token_1.getOrCreateAssociatedTokenAccount)(connection, senderKeypair, tokenMint, recipientPubkey);
            const transaction = new web3_js_1.Transaction().add((0, spl_token_1.createTransferInstruction)(senderATA, recipientATA.address, senderKeypair.publicKey, amount * 10 ** decimal, [], spl_token_1.TOKEN_PROGRAM_ID));
            const { blockhash } = await connection.getLatestBlockhash();
            transaction.recentBlockhash = blockhash;
            transaction.feePayer = senderKeypair.publicKey;
            return transaction;
        }
        catch (error) {
            throw new Error(`Failed to build transfer transaction: ${error.message}`);
        }
    };
};
exports.WalletService = WalletService;
exports.WalletService = WalletService = WalletService_1 = __decorate([
    (0, common_1.Injectable)()
], WalletService);
//# sourceMappingURL=wallet.service.js.map