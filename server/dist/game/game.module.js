"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.GameModule = void 0;
const common_1 = require("@nestjs/common");
const mongoose_1 = require("@nestjs/mongoose");
const auth_module_1 = require("../auth/auth.module");
const users_module_1 = require("../users/users.module");
const wallet_module_1 = require("../wallet/wallet.module");
const game_gateway_1 = require("./game.gateway");
const game_service_1 = require("./game.service");
const lobby_chat_controller_1 = require("./lobby-chat.controller");
const lobby_chat_service_1 = require("./lobby-chat.service");
const near_relayer_controller_1 = require("./near-relayer.controller");
const near_relayer_service_1 = require("./near-relayer.service");
const lobby_message_schema_1 = require("./schema/lobby-message.schema");
let GameModule = class GameModule {
};
exports.GameModule = GameModule;
exports.GameModule = GameModule = __decorate([
    (0, common_1.Module)({
        imports: [
            auth_module_1.AuthModule,
            users_module_1.UsersModule,
            wallet_module_1.WalletModule,
            mongoose_1.MongooseModule.forFeature([
                { name: lobby_message_schema_1.LobbyMessage.name, schema: lobby_message_schema_1.LobbyMessageSchema },
            ]),
        ],
        controllers: [near_relayer_controller_1.NearRelayerController, lobby_chat_controller_1.LobbyChatController],
        providers: [game_gateway_1.GameGateway, game_service_1.GameService, near_relayer_service_1.NearRelayerService, lobby_chat_service_1.LobbyChatService],
        exports: [near_relayer_service_1.NearRelayerService, lobby_chat_service_1.LobbyChatService],
    })
], GameModule);
//# sourceMappingURL=game.module.js.map