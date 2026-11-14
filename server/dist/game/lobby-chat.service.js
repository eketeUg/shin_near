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
exports.LobbyChatService = void 0;
const common_1 = require("@nestjs/common");
const mongoose_1 = require("@nestjs/mongoose");
const mongoose_2 = require("mongoose");
const lobby_message_schema_1 = require("./schema/lobby-message.schema");
let LobbyChatService = class LobbyChatService {
    messageModel;
    constructor(messageModel) {
        this.messageModel = messageModel;
    }
    async saveMessage(msg) {
        if (!msg?.id || !msg?.senderAccountId || !msg?.text)
            return null;
        return this.messageModel
            .findOneAndUpdate({ id: msg.id }, {
            $set: {
                id: msg.id,
                senderName: msg.senderName || 'Warrior',
                senderAccountId: msg.senderAccountId,
                senderType: msg.senderType || 'HUMAN',
                senderCharId: msg.senderCharId,
                archetypeBadge: msg.archetypeBadge,
                recipientName: msg.recipientName,
                recipientAccountId: msg.recipientAccountId || undefined,
                deliveryStatus: msg.deliveryStatus || 'DELIVERED_LIVE',
                text: msg.text,
                timestamp: msg.timestamp || Date.now(),
                challengeOffer: msg.challengeOffer,
            },
        }, { upsert: true, new: true })
            .lean()
            .exec();
    }
    async getHistoryForAccount(accountId, limit = 150) {
        const query = accountId
            ? {
                $or: [
                    { recipientAccountId: { $exists: false } },
                    { recipientAccountId: null },
                    { recipientAccountId: '' },
                    { senderAccountId: accountId },
                    { recipientAccountId: accountId },
                ],
            }
            : {
                $or: [
                    { recipientAccountId: { $exists: false } },
                    { recipientAccountId: null },
                    { recipientAccountId: '' },
                ],
            };
        const docs = await this.messageModel
            .find(query)
            .sort({ timestamp: -1 })
            .limit(limit)
            .lean()
            .exec();
        return docs.reverse();
    }
    async getQueuedOfflineDms(recipientAccountId) {
        return this.messageModel
            .find({
            recipientAccountId,
            deliveryStatus: 'QUEUED_OFFLINE',
        })
            .sort({ timestamp: 1 })
            .lean()
            .exec();
    }
    async markDmsReadOnWake(recipientAccountId) {
        await this.messageModel
            .updateMany({ recipientAccountId, deliveryStatus: 'QUEUED_OFFLINE' }, { $set: { deliveryStatus: 'READ_ON_WAKE' } })
            .exec();
    }
    async updateProposalStatus(proposalId, status, wagerNear) {
        const update = {
            'challengeOffer.status': status,
        };
        if (typeof wagerNear === 'number') {
            update['challengeOffer.wagerNear'] = wagerNear;
        }
        await this.messageModel
            .updateMany({ 'challengeOffer.proposalId': proposalId }, { $set: update })
            .exec();
    }
};
exports.LobbyChatService = LobbyChatService;
exports.LobbyChatService = LobbyChatService = __decorate([
    (0, common_1.Injectable)(),
    __param(0, (0, mongoose_1.InjectModel)(lobby_message_schema_1.LobbyMessage.name)),
    __metadata("design:paramtypes", [mongoose_2.Model])
], LobbyChatService);
//# sourceMappingURL=lobby-chat.service.js.map