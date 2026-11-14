import { Model } from 'mongoose';
import { LobbyMessage, LobbyMessageDocument } from './schema/lobby-message.schema';
export declare class LobbyChatService {
    private readonly messageModel;
    constructor(messageModel: Model<LobbyMessageDocument>);
    saveMessage(msg: Partial<LobbyMessage>): Promise<LobbyMessage | null>;
    getHistoryForAccount(accountId?: string, limit?: number): Promise<LobbyMessage[]>;
    getQueuedOfflineDms(recipientAccountId: string): Promise<LobbyMessage[]>;
    markDmsReadOnWake(recipientAccountId: string): Promise<void>;
    updateProposalStatus(proposalId: string, status: string, wagerNear?: number): Promise<void>;
}
