/* eslint-disable @typescript-eslint/no-unsafe-assignment */
/* eslint-disable @typescript-eslint/no-unsafe-member-access */
/* eslint-disable @typescript-eslint/no-unsafe-call */
import { Injectable, Logger } from '@nestjs/common';
import {
  createCipheriv,
  createDecipheriv,
  createHash,
  randomBytes,
} from 'crypto';
import { Keypair } from '@solana/web3.js';
import bs58 from 'bs58';
import * as dotenv from 'dotenv';

dotenv.config();

const ALGORITHM = 'aes-256-cbc';
const IV_LENGTH = 16;
const YOCTO_NEAR = 1e24;
const DEFAULT_NEAR_RPC = process.env.NEAR_RPC_URL || 'https://rpc.testnet.near.org';

/**
 * Service for managing Embedded NEAR Protocol Wallets (Chain Abstraction / Zero-Popup Signing)
 * as well as backwards-compatible keypair encryption helpers.
 */
@Injectable()
export class WalletService {
  private readonly logger = new Logger(WalletService.name);

  /**
   * Generates a 256-bit hash of a password to be used as an encryption key.
   */
  private generateKey(password: string): Buffer {
    return createHash('sha256').update(password).digest();
  }

  /**
   * Creates a new NEAR Protocol Embedded Wallet (Ed25519 implicit account + optional sub-account)
   * and returns its accountId / address and ed25519 private key.
   */
  createNEARWallet = (username?: string): Record<string, any> => {
    const keypair = Keypair.generate();
    const implicitAccountId = Buffer.from(keypair.publicKey.toBytes()).toString('hex');
    const cleanHandle = username
      ? username.toLowerCase().replace(/[^a-z0-9_-]/g, '')
      : '';
    const namedAccountId = cleanHandle
      ? `${cleanHandle}.shin-arena.testnet`
      : implicitAccountId;

    return {
      address: namedAccountId,
      implicitAccountId,
      publicKey: `ed25519:${bs58.encode(keypair.publicKey.toBytes())}`,
      privateKey: `ed25519:${bs58.encode(keypair.secretKey)}`,
    };
  };

  /**
   * Backwards-compatible alias used by AuthService when provisioning an embedded player wallet on signup.
   */
  createSVMWallet = (): Record<string, any> => {
    const nearWallet = this.createNEARWallet();
    return {
      address: nearWallet.implicitAccountId,
      privateKey: nearWallet.privateKey.replace('ed25519:', ''),
    };
  };

  /**
   * Derives a NEAR implicit account ID (64-char hex) from an Ed25519 base58-encoded private key.
   */
  getSVMAddressFromPrivateKey = (
    privateKey: string,
  ): Record<string, string> => {
    try {
      const normalized = privateKey.replace(/^ed25519:/, '');
      const privateKeyBytes = bs58.decode(normalized);
      const wallet = Keypair.fromSecretKey(privateKeyBytes);
      const implicitHex = Buffer.from(wallet.publicKey.toBytes()).toString('hex');
      return {
        address: implicitHex,
        privateKey: bs58.encode(wallet.secretKey),
      };
    } catch (error) {
      throw new Error(`Invalid private key format: ${error.message}`);
    }
  };

  /**
   * Encrypts an embedded wallet private key using AES-256-CBC with a user-provided secret/PIN.
   */
  encryptSVMWallet = (
    password: string,
    privateKey: string,
  ): Record<string, string> => {
    const key = this.generateKey(password);
    const iv = randomBytes(IV_LENGTH);
    const cipher = createCipheriv(ALGORITHM, key, iv);

    let encrypted = cipher.update(privateKey, 'utf8', 'hex');
    encrypted += cipher.final('hex');

    const encryptedWallet = iv.toString('hex') + ':' + encrypted;
    return { json: encryptedWallet };
  };

  /**
   * Decrypts an encrypted wallet string using the provided secret/PIN.
   */
  decryptSVMWallet = (
    password: string,
    encryptedWallet: string,
  ): Record<string, any> => {
    try {
      const key = this.generateKey(password);
      const [ivHex, encrypted] = encryptedWallet.split(':');
      const iv = Buffer.from(ivHex, 'hex');

      const decipher = createDecipheriv(ALGORITHM, key, iv);
      let decrypted = decipher.update(encrypted, 'hex', 'utf8');
      decrypted += decipher.final('utf8');

      return {
        privateKey: decrypted,
        address: this.getSVMAddressFromPrivateKey(decrypted).address,
      };
    } catch (error) {
      throw new Error(`Failed to decrypt wallet: ${error.message}`);
    }
  };

  /**
   * Queries native NEAR balance via NEAR JSON-RPC (`query` -> `view_account`).
   */
  getNearBalance = async (
    accountId: string,
    rpcURL: string = DEFAULT_NEAR_RPC,
  ): Promise<Record<string, number>> => {
    try {
      const response = await fetch(rpcURL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          jsonrpc: '2.0',
          id: 'shin-near-balance',
          method: 'query',
          params: {
            request_type: 'view_account',
            finality: 'final',
            account_id: accountId,
          },
        }),
      });
      const json = await response.json();
      if (json?.result?.amount) {
        const near = Number(json.result.amount) / YOCTO_NEAR;
        return { balance: Number(near.toFixed(4)) };
      }
      return { balance: 0 };
    } catch (error) {
      this.logger.warn(
        `NEAR RPC balance lookup fallback for ${accountId}: ${error.message}`,
      );
      return { balance: 0 };
    }
  };

  /**
   * Queries NEP-141 fungible token balance (`ft_balance_of`) on NEAR JSON-RPC.
   */
  getNEP141TokenBalance = async (
    accountId: string,
    tokenContractId: string,
    decimals = 6,
    rpcURL: string = DEFAULT_NEAR_RPC,
  ): Promise<Record<string, number>> => {
    try {
      const argsBase64 = Buffer.from(
        JSON.stringify({ account_id: accountId }),
      ).toString('base64');
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
    } catch (error) {
      this.logger.warn(`NEP-141 balance lookup fallback: ${error.message}`);
      return { balance: 0 };
    }
  };

  getSolBalance = async (
    address: string,
    rpcURL?: string,
  ): Promise<Record<string, number>> => {
    return this.getNearBalance(address, rpcURL || DEFAULT_NEAR_RPC);
  };

  getUSDCBalance = async (
    address: string,
    rpcURL?: string,
  ): Promise<Record<string, number>> => {
    const contract = process.env.NEAR_USDC_CONTRACT || 'usdc.fakes.testnet';
    return this.getNEP141TokenBalance(address, contract, 6, rpcURL || DEFAULT_NEAR_RPC);
  };

  getUSDTBalance = async (
    address: string,
    rpcURL?: string,
  ): Promise<Record<string, number>> => {
    const contract = process.env.NEAR_USDT_CONTRACT || 'usdt.fakes.testnet';
    return this.getNEP141TokenBalance(address, contract, 6, rpcURL || DEFAULT_NEAR_RPC);
  };

  getWalletBalance = async (walletAddress: string, rpcURL?: string) => {
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
}
