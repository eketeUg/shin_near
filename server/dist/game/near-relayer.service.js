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
var NearRelayerService_1;
Object.defineProperty(exports, "__esModule", { value: true });
exports.NearRelayerService = void 0;
const common_1 = require("@nestjs/common");
const fs = __importStar(require("fs"));
const os = __importStar(require("os"));
const path = __importStar(require("path"));
const near_api_js_1 = require("near-api-js");
const ALLOWED_WRITE_METHODS = new Set([
    'mint_fighter',
    'configure_agent',
    'fund_agent_wallet',
    'create_agent_match_pool',
    'place_spectator_bet',
    'settle_match',
    'buy_dojo_scroll',
    'sell_material_to_npc_dojo',
    'invest_in_npc_dojo',
    'list_fighter_on_market',
    'buy_fighter_from_market',
    'mt_transfer',
    'mt_batch_transfer',
    'swap_near_for_shin',
    'register_trainer',
    'train_fighter_with_trainer',
    'create_tournament',
    'join_tournament',
    'settle_tournament',
    'nft_transfer',
    'ft_transfer_call',
    'withdraw_agent_shin',
    'settle_shin_match',
]);
let NearRelayerService = NearRelayerService_1 = class NearRelayerService {
    logger = new common_1.Logger(NearRelayerService_1.name);
    networkId = process.env.NEAR_NETWORK || 'testnet';
    rpcUrl = process.env.NEAR_RPC_URL || 'https://test.rpc.fastnear.com';
    contractId = process.env.NEAR_CONTRACT_ID || 'shin-arena-28d.testnet';
    shinTokenId = process.env.NEAR_SHIN_TOKEN_ID || 'shin.shin-arena-28d.testnet';
    relayerAccountId = process.env.NEAR_REFEREE_ACCOUNT_ID ||
        process.env.NEAR_CONTRACT_ID ||
        'shin-arena-28d.testnet';
    provider = new near_api_js_1.providers.JsonRpcProvider({ url: this.rpcUrl });
    relayerAccount = null;
    txQueue = Promise.resolve();
    async onModuleInit() {
        await this.initRelayer();
    }
    async initRelayer() {
        try {
            let privateKey = process.env.NEAR_RELAYER_PRIVATE_KEY?.trim();
            if (!privateKey) {
                const credPath = path.join(os.homedir(), '.near-credentials', this.networkId, `${this.relayerAccountId}.json`);
                if (fs.existsSync(credPath)) {
                    const raw = JSON.parse(fs.readFileSync(credPath, 'utf8'));
                    privateKey = raw.private_key || raw.secret_key;
                }
            }
            if (!privateKey) {
                this.logger.warn(`No relayer private key found for ${this.relayerAccountId}; on-chain writes disabled until credentials are configured.`);
                return;
            }
            const keyStore = new near_api_js_1.keyStores.InMemoryKeyStore();
            const keyPair = near_api_js_1.KeyPair.fromString(privateKey);
            await keyStore.setKey(this.networkId, this.relayerAccountId, keyPair);
            const near = await (0, near_api_js_1.connect)({
                networkId: this.networkId,
                nodeUrl: this.rpcUrl,
                keyStore,
            });
            this.relayerAccount = await near.account(this.relayerAccountId);
            this.logger.log(`NEAR Testnet Relayer ready: ${this.relayerAccountId} -> ${this.contractId} (${this.rpcUrl})`);
        }
        catch (err) {
            this.logger.error(`Failed to initialize NEAR relayer: ${err?.message || err}`);
            this.relayerAccount = null;
        }
    }
    getStatus() {
        return {
            networkId: this.networkId,
            rpcUrl: this.rpcUrl,
            contractId: this.contractId,
            shinTokenId: this.shinTokenId,
            relayerAccountId: this.relayerAccountId,
            relayerReady: Boolean(this.relayerAccount),
        };
    }
    resolveAllowedContract(targetContractId) {
        if (targetContractId &&
            (targetContractId === this.contractId ||
                targetContractId === this.shinTokenId)) {
            return targetContractId;
        }
        return this.contractId;
    }
    async viewMethod(methodName, args = {}, targetContractId) {
        const resolvedContract = this.resolveAllowedContract(targetContractId);
        const argsBase64 = Buffer.from(JSON.stringify(args)).toString('base64');
        const res = await this.provider.query({
            request_type: 'call_function',
            finality: 'final',
            account_id: resolvedContract,
            method_name: methodName,
            args_base64: argsBase64,
        });
        if (Array.isArray(res?.result)) {
            const text = Buffer.from(res.result).toString('utf8');
            try {
                return JSON.parse(text);
            }
            catch {
                return text;
            }
        }
        return null;
    }
    callMethod(methodName, args = {}, attachedDepositNear = '0', gas = '60000000000000', customSigner, targetContractId) {
        const resolvedContract = this.resolveAllowedContract(targetContractId);
        if (!ALLOWED_WRITE_METHODS.has(methodName)) {
            return Promise.resolve({
                ok: false,
                simulated: true,
                contractId: resolvedContract,
                relayerAccountId: this.relayerAccountId,
                methodName,
                txHash: '',
                explorerUrl: '',
                error: `Method ${methodName} is not in the relayer allowlist`,
            });
        }
        if (customSigner) {
            return this.executeFunctionCall(methodName, args, attachedDepositNear, gas, customSigner, resolvedContract);
        }
        const task = this.txQueue.then(() => this.executeFunctionCall(methodName, args, attachedDepositNear, gas, undefined, resolvedContract));
        this.txQueue = task.catch(() => undefined);
        return task;
    }
    async executeFunctionCall(methodName, args, attachedDepositNear, gas, customSigner, targetContractId) {
        const resolvedContract = targetContractId || this.contractId;
        let signer = this.relayerAccount;
        let signerId = this.relayerAccountId;
        if (customSigner) {
            try {
                const keyStore = new near_api_js_1.keyStores.InMemoryKeyStore();
                const formattedKey = customSigner.privateKey.startsWith('ed25519:')
                    ? customSigner.privateKey
                    : `ed25519:${customSigner.privateKey}`;
                await keyStore.setKey(this.networkId, customSigner.accountId, near_api_js_1.KeyPair.fromString(formattedKey));
                const near = await (0, near_api_js_1.connect)({
                    networkId: this.networkId,
                    nodeUrl: this.rpcUrl,
                    keyStore,
                });
                signer = await near.account(customSigner.accountId);
                signerId = customSigner.accountId;
            }
            catch (err) {
                this.logger.warn(`Custom signer init failed for ${customSigner.accountId}, falling back to relayer: ${err?.message || err}`);
            }
        }
        if (!signer) {
            return {
                ok: false,
                simulated: true,
                contractId: this.contractId,
                relayerAccountId: signerId,
                methodName,
                txHash: '',
                explorerUrl: '',
                error: 'NEAR signer key is not loaded',
            };
        }
        try {
            const depositYocto = attachedDepositNear === '1yocto'
                ? 1n
                : BigInt(near_api_js_1.utils.format.parseNearAmount(attachedDepositNear) || '0');
            const outcome = await signer.functionCall({
                contractId: resolvedContract,
                methodName,
                args,
                gas: BigInt(gas),
                attachedDeposit: depositYocto,
            });
            const txHash = outcome?.transaction?.hash || outcome?.transaction_outcome?.id || '';
            const explorerBase = this.networkId === 'mainnet'
                ? 'https://nearblocks.io/txns'
                : 'https://testnet.nearblocks.io/txns';
            const explorerUrl = txHash ? `${explorerBase}/${txHash}` : '';
            let parsedResult = undefined;
            const successVal = outcome?.status?.SuccessValue;
            if (typeof successVal === 'string' && successVal.length > 0) {
                const decoded = Buffer.from(successVal, 'base64').toString('utf8');
                try {
                    parsedResult = JSON.parse(decoded);
                }
                catch {
                    parsedResult = decoded;
                }
            }
            this.logger.log(`[NEAR TX] ${methodName} on ${resolvedContract} -> ${txHash}`);
            return {
                ok: true,
                simulated: false,
                contractId: resolvedContract,
                relayerAccountId: this.relayerAccountId,
                methodName,
                txHash,
                explorerUrl,
                result: parsedResult,
            };
        }
        catch (err) {
            this.logger.warn(`[NEAR TX FAILED] ${methodName}: ${err?.message || err}`);
            return {
                ok: false,
                simulated: true,
                contractId: this.contractId,
                relayerAccountId: this.relayerAccountId,
                methodName,
                txHash: '',
                explorerUrl: '',
                error: err?.message || String(err),
            };
        }
    }
    async dripTestnetNear(receiverId, amountNear = '0.25') {
        if (!this.relayerAccount) {
            return {
                ok: false,
                simulated: true,
                contractId: this.contractId,
                relayerAccountId: this.relayerAccountId,
                methodName: 'sendMoney',
                txHash: '',
                explorerUrl: '',
                error: 'NEAR relayer key is not loaded',
            };
        }
        try {
            let currentNear = 0;
            try {
                const acct = await this.provider.query({
                    request_type: 'view_account',
                    finality: 'final',
                    account_id: receiverId,
                });
                if (acct?.amount) {
                    currentNear = Number(near_api_js_1.utils.format.formatNearAmount(acct.amount, 4).replace(/,/g, ''));
                }
            }
            catch {
                currentNear = 0;
            }
            if (currentNear >= 0.1) {
                return {
                    ok: false,
                    simulated: false,
                    contractId: this.contractId,
                    relayerAccountId: this.relayerAccountId,
                    methodName: 'sendMoney',
                    txHash: '',
                    explorerUrl: '',
                    error: `Account already funded (${currentNear.toFixed(4)} NEAR)`,
                };
            }
            const yocto = BigInt(near_api_js_1.utils.format.parseNearAmount(amountNear) || '0');
            const outcome = await this.relayerAccount.sendMoney(receiverId, yocto);
            const txHash = outcome?.transaction?.hash || outcome?.transaction_outcome?.id || '';
            const explorerUrl = txHash
                ? `https://testnet.nearblocks.io/txns/${txHash}`
                : '';
            this.logger.log(`[NEAR DRIP] Sent ${amountNear} NEAR to ${receiverId} -> ${txHash}`);
            return {
                ok: true,
                simulated: false,
                contractId: this.contractId,
                relayerAccountId: this.relayerAccountId,
                methodName: 'sendMoney',
                txHash,
                explorerUrl,
            };
        }
        catch (err) {
            return {
                ok: false,
                simulated: true,
                contractId: this.contractId,
                relayerAccountId: this.relayerAccountId,
                methodName: 'sendMoney',
                txHash: '',
                explorerUrl: '',
                error: err?.message || String(err),
            };
        }
    }
};
exports.NearRelayerService = NearRelayerService;
exports.NearRelayerService = NearRelayerService = NearRelayerService_1 = __decorate([
    (0, common_1.Injectable)()
], NearRelayerService);
//# sourceMappingURL=near-relayer.service.js.map