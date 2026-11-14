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
Object.defineProperty(exports, "__esModule", { value: true });
exports.LobbyMessageSchema = exports.LobbyMessage = void 0;
const mongoose_1 = require("@nestjs/mongoose");
const mongoose_2 = require("mongoose");
let LobbyMessage = class LobbyMessage {
    id;
    senderName;
    senderAccountId;
    senderType;
    senderCharId;
    archetypeBadge;
    recipientName;
    recipientAccountId;
    deliveryStatus;
    text;
    timestamp;
    challengeOffer;
};
exports.LobbyMessage = LobbyMessage;
__decorate([
    (0, mongoose_1.Prop)({ required: true, unique: true, index: true }),
    __metadata("design:type", String)
], LobbyMessage.prototype, "id", void 0);
__decorate([
    (0, mongoose_1.Prop)({ required: true }),
    __metadata("design:type", String)
], LobbyMessage.prototype, "senderName", void 0);
__decorate([
    (0, mongoose_1.Prop)({ required: true, index: true }),
    __metadata("design:type", String)
], LobbyMessage.prototype, "senderAccountId", void 0);
__decorate([
    (0, mongoose_1.Prop)({ default: 'HUMAN' }),
    __metadata("design:type", String)
], LobbyMessage.prototype, "senderType", void 0);
__decorate([
    (0, mongoose_1.Prop)(),
    __metadata("design:type", String)
], LobbyMessage.prototype, "senderCharId", void 0);
__decorate([
    (0, mongoose_1.Prop)(),
    __metadata("design:type", String)
], LobbyMessage.prototype, "archetypeBadge", void 0);
__decorate([
    (0, mongoose_1.Prop)(),
    __metadata("design:type", String)
], LobbyMessage.prototype, "recipientName", void 0);
__decorate([
    (0, mongoose_1.Prop)({ index: true }),
    __metadata("design:type", String)
], LobbyMessage.prototype, "recipientAccountId", void 0);
__decorate([
    (0, mongoose_1.Prop)({ default: 'DELIVERED_LIVE' }),
    __metadata("design:type", String)
], LobbyMessage.prototype, "deliveryStatus", void 0);
__decorate([
    (0, mongoose_1.Prop)({ required: true }),
    __metadata("design:type", String)
], LobbyMessage.prototype, "text", void 0);
__decorate([
    (0, mongoose_1.Prop)({ required: true, index: true }),
    __metadata("design:type", Number)
], LobbyMessage.prototype, "timestamp", void 0);
__decorate([
    (0, mongoose_1.Prop)({ type: mongoose_2.Schema.Types.Mixed }),
    __metadata("design:type", Object)
], LobbyMessage.prototype, "challengeOffer", void 0);
exports.LobbyMessage = LobbyMessage = __decorate([
    (0, mongoose_1.Schema)({ timestamps: true, collection: 'lobby_messages' })
], LobbyMessage);
exports.LobbyMessageSchema = mongoose_1.SchemaFactory.createForClass(LobbyMessage);
//# sourceMappingURL=lobby-message.schema.js.map