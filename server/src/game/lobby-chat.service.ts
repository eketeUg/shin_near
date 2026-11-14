import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { LobbyMessage, LobbyMessageDocument } from './schema/lobby-message.schema';

@Injectable()
export class LobbyChatService {
  constructor(
    @InjectModel(LobbyMessage.name)
    private readonly messageModel: Model<LobbyMessageDocument>,
  ) {}

  async saveMessage(msg: Partial<LobbyMessage>): Promise<LobbyMessage | null> {
    if (!msg?.id || !msg?.senderAccountId || !msg?.text) return null;
    return this.messageModel
      .findOneAndUpdate(
        { id: msg.id },
        {
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
        },
        { upsert: true, new: true },
      )
      .lean()
      .exec();
  }

  async getHistoryForAccount(accountId?: string, limit = 150): Promise<LobbyMessage[]> {
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

  async getQueuedOfflineDms(recipientAccountId: string): Promise<LobbyMessage[]> {
    return this.messageModel
      .find({
        recipientAccountId,
        deliveryStatus: 'QUEUED_OFFLINE',
      })
      .sort({ timestamp: 1 })
      .lean()
      .exec();
  }

  async markDmsReadOnWake(recipientAccountId: string): Promise<void> {
    await this.messageModel
      .updateMany(
        { recipientAccountId, deliveryStatus: 'QUEUED_OFFLINE' },
        { $set: { deliveryStatus: 'READ_ON_WAKE' } },
      )
      .exec();
  }

  async updateProposalStatus(
    proposalId: string,
    status: string,
    wagerNear?: number,
  ): Promise<void> {
    const update: Record<string, unknown> = {
      'challengeOffer.status': status,
    };
    if (typeof wagerNear === 'number') {
      update['challengeOffer.wagerNear'] = wagerNear;
    }
    await this.messageModel
      .updateMany({ 'challengeOffer.proposalId': proposalId }, { $set: update })
      .exec();
  }
}
