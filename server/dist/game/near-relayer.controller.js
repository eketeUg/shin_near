"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
var __metadata = (this && this.__metadata) || function (k, v) {
    if (typeof Reflect === "object" && typeof Reflect.metadata === "function") return Reflect.metadata(k, v);
};
var __param = (this && this.__param) || function (paramIndex, decorator) {
    return function (target, key) { decorator(target, key, paramIndex); }
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.NearRelayerController = void 0;
const common_1 = require("@nestjs/common");
const jwt_1 = require("@nestjs/jwt");
const users_service_1 = require("../users/users.service");
const wallet_service_1 = require("../wallet/wallet.service");
const near_relayer_service_1 = require("./near-relayer.service");
let NearRelayerController = class NearRelayerController {
    nearRelayer;
    jwtService;
    usersService;
    walletService;
    constructor(nearRelayer, jwtService, usersService, walletService) {
        this.nearRelayer = nearRelayer;
        this.jwtService = jwtService;
        this.usersService = usersService;
        this.walletService = walletService;
    }
    getStatus() {
        return this.nearRelayer.getStatus();
    }
    async viewMethod(method, argsJson, contractId) {
        let args = {};
        if (argsJson) {
            try {
                args = JSON.parse(argsJson);
            }
            catch {
                args = {};
            }
        }
        try {
            const result = await this.nearRelayer.viewMethod(method, args, contractId);
            return { ok: true, result };
        }
        catch (err) {
            return {
                ok: false,
                error: err instanceof Error ? err.message : String(err),
            };
        }
    }
    async callMethod(req, body) {
        const token = req.cookies?.['jwt'];
        if (!token) {
            return {
                ok: false,
                simulated: true,
                error: 'Login with Google or Email to execute on-chain NEAR transactions',
            };
        }
        let payload;
        try {
            payload = this.jwtService.verify(token);
        }
        catch {
            return {
                ok: false,
                simulated: true,
                error: 'Session expired. Please sign in again.',
            };
        }
        let customSigner;
        try {
            const dbUser = payload?.sub
                ? await this.usersService.findById(payload.sub)
                : null;
            if (dbUser?.walletAddress && dbUser?.walletDetails) {
                const bal = await this.walletService.getNearBalance(dbUser.walletAddress);
                if ((bal?.balance ?? 0) >= 0.1) {
                    const pin = process.env.DEFAULT_WALLET_PIN ||
                        process.env.JWT_SECRET ||
                        'shin_arena_default_wallet_pin';
                    const decrypted = this.walletService.decryptSVMWallet(pin, dbUser.walletDetails);
                    if (decrypted?.privateKey) {
                        customSigner = {
                            accountId: dbUser.walletAddress,
                            privateKey: decrypted.privateKey,
                        };
                    }
                }
            }
        }
        catch {
        }
        return this.nearRelayer.callMethod(body.methodName, body.args || {}, body.attachedDepositNear || '0', body.gas || '60000000000000', customSigner, body.contractId);
    }
    async dripTestnetNear(req, body) {
        const token = req.cookies?.['jwt'];
        if (!token) {
            return {
                ok: false,
                simulated: true,
                error: 'Login with Google or Email to claim Testnet NEAR',
            };
        }
        let payload;
        try {
            payload = this.jwtService.verify(token);
        }
        catch {
            return {
                ok: false,
                simulated: true,
                error: 'Session expired. Please sign in again.',
            };
        }
        const target = body?.receiverId || payload?.walletAddress;
        if (!target) {
            return { ok: false, simulated: true, error: 'No walletAddress found' };
        }
        return this.nearRelayer.dripTestnetNear(target, '0.25');
    }
};
exports.NearRelayerController = NearRelayerController;
__decorate([
    (0, common_1.Get)('status'),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", []),
    __metadata("design:returntype", void 0)
], NearRelayerController.prototype, "getStatus", null);
__decorate([
    (0, common_1.Get)('view'),
    __param(0, (0, common_1.Query)('method')),
    __param(1, (0, common_1.Query)('args')),
    __param(2, (0, common_1.Query)('contractId')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, String, String]),
    __metadata("design:returntype", Promise)
], NearRelayerController.prototype, "viewMethod", null);
__decorate([
    (0, common_1.Post)('call'),
    __param(0, (0, common_1.Req)()),
    __param(1, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, Object]),
    __metadata("design:returntype", Promise)
], NearRelayerController.prototype, "callMethod", null);
__decorate([
    (0, common_1.Post)('drip'),
    __param(0, (0, common_1.Req)()),
    __param(1, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, Object]),
    __metadata("design:returntype", Promise)
], NearRelayerController.prototype, "dripTestnetNear", null);
exports.NearRelayerController = NearRelayerController = __decorate([
    (0, common_1.Controller)('near'),
    __metadata("design:paramtypes", [near_relayer_service_1.NearRelayerService,
        jwt_1.JwtService,
        users_service_1.UsersService,
        wallet_service_1.WalletService])
], NearRelayerController);
//# sourceMappingURL=near-relayer.controller.js.map