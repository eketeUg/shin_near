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
const bs58_1 = __importDefault(require("bs58"));
const dotenv = __importStar(require("dotenv"));
const near_api_js_1 = require("near-api-js");
dotenv.config();
const ALGORITHM = 'aes-256-cbc';
const IV_LENGTH = 16;
const YOCTO_NEAR = 1e24;
const DEFAULT_NEAR_RPC = process.env.NEAR_RPC_URL || 'https://test.rpc.fastnear.com';
let WalletService = WalletService_1 = class WalletService {
    logger = new common_1.Logger(WalletService_1.name);
    generateKey(password) {
        return (0, crypto_1.createHash)('sha256').update(password).digest();
    }
    createNEARWallet = (username) => {
        const keyPair = near_api_js_1.KeyPair.fromRandom('ed25519');
        const pubKeyBytes = Buffer.from(keyPair.getPublicKey().data);
        const implicitAccountId = pubKeyBytes.toString('hex');
        const cleanHandle = username
            ? username.toLowerCase().replace(/[^a-z0-9_-]/g, '')
            : '';
        const namedAccountId = cleanHandle
            ? `${cleanHandle}.shin-arena.testnet`
            : implicitAccountId;
        return {
            address: namedAccountId,
            implicitAccountId,
            publicKey: keyPair.getPublicKey().toString(),
            privateKey: keyPair.toString(),
        };
    };
    createSVMWallet = () => {
        const nearWallet = this.createNEARWallet();
        return {
            address: nearWallet.implicitAccountId,
            privateKey: nearWallet.privateKey.replace('ed25519:', ''),
        };
    };
    getSVMAddressFromPrivateKey = (privateKey) => {
        try {
            const normalized = privateKey.replace(/^ed25519:/, '');
            const secretKeyBytes = Buffer.from(bs58_1.default.decode(normalized));
            let pubBytes;
            let fullSecretBytes;
            if (secretKeyBytes.length === 64) {
                pubBytes = secretKeyBytes.subarray(32, 64);
                fullSecretBytes = secretKeyBytes;
            }
            else if (secretKeyBytes.length === 32) {
                const keyObj = (0, crypto_1.createPrivateKey)({
                    key: {
                        kty: 'OKP',
                        crv: 'Ed25519',
                        d: secretKeyBytes.toString('base64url'),
                    },
                    format: 'jwk',
                });
                const pubJwk = (0, crypto_1.createPublicKey)(keyObj).export({ format: 'jwk' });
                pubBytes = Buffer.from(pubJwk.x, 'base64url');
                fullSecretBytes = Buffer.concat([secretKeyBytes, pubBytes]);
            }
            else {
                throw new Error(`Expected 32 or 64 byte Ed25519 secret key, got ${secretKeyBytes.length}`);
            }
            const implicitHex = pubBytes.toString('hex');
            return {
                address: implicitHex,
                privateKey: bs58_1.default.encode(fullSecretBytes),
            };
        }
        catch (error) {
            throw new Error(`Invalid NEAR Ed25519 key format: ${error.message}`);
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
    getNearBalance = async (accountId, rpcURL = DEFAULT_NEAR_RPC) => {
        try {
            const provider = new near_api_js_1.providers.JsonRpcProvider({ url: rpcURL });
            const accountView = await provider.query({
                request_type: 'view_account',
                finality: 'final',
                account_id: accountId,
            });
            if (accountView?.amount) {
                const formatted = near_api_js_1.utils.format.formatNearAmount(accountView.amount, 4);
                return { balance: Number(formatted.replace(/,/g, '')) };
            }
            return { balance: 0 };
        }
        catch (error) {
            this.logger.warn(`NEAR RPC balance lookup fallback for ${accountId}: ${error.message}`);
            return { balance: 0 };
        }
    };
    getNEP141TokenBalance = async (accountId, tokenContractId, decimals = 6, rpcURL = DEFAULT_NEAR_RPC) => {
        try {
            const argsBase64 = Buffer.from(JSON.stringify({ account_id: accountId })).toString('base64');
            const response = await fetch(rpcURL, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    jsonrpc: '2.0',
                    id: 'shin-nep141-balance',
                    method: 'query',
                    params: {
                        request_type: 'call_function',
                        finality: 'final',
                        account_id: tokenContractId,
                        method_name: 'ft_balance_of',
                        args_base64: argsBase64,
                    },
                }),
            });
            const json = await response.json();
            if (json?.result?.result) {
                const raw = Buffer.from(json.result.result).toString('utf8').replace(/"/g, '');
                return { balance: Number(raw) / 10 ** decimals };
            }
            return { balance: 0 };
        }
        catch (error) {
            this.logger.warn(`NEP-141 balance lookup fallback: ${error.message}`);
            return { balance: 0 };
        }
    };
    getSolBalance = async (address, rpcURL) => {
        return this.getNearBalance(address, rpcURL || DEFAULT_NEAR_RPC);
    };
    getUSDCBalance = async (address, rpcURL) => {
        const contract = process.env.NEAR_USDC_CONTRACT || 'usdc.fakes.testnet';
        return this.getNEP141TokenBalance(address, contract, 6, rpcURL || DEFAULT_NEAR_RPC);
    };
    getUSDTBalance = async (address, rpcURL) => {
        const contract = process.env.NEAR_USDT_CONTRACT || 'usdt.fakes.testnet';
        return this.getNEP141TokenBalance(address, contract, 6, rpcURL || DEFAULT_NEAR_RPC);
    };
    getWalletBalance = async (walletAddress, rpcURL) => {
        const nearBalance = await this.getNearBalance(walletAddress, rpcURL || DEFAULT_NEAR_RPC);
        const usdcBalance = await this.getUSDCBalance(walletAddress, rpcURL || DEFAULT_NEAR_RPC);
        const usdtBalance = await this.getUSDTBalance(walletAddress, rpcURL || DEFAULT_NEAR_RPC);
        return {
            nearBalance,
            solBalance: nearBalance,
            usdcBalance,
            usdtBalance,
        };
    };
};
exports.WalletService = WalletService;
exports.WalletService = WalletService = WalletService_1 = __decorate([
    (0, common_1.Injectable)()
], WalletService);
//# sourceMappingURL=wallet.service.js.map