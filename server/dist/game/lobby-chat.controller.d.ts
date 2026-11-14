import { LobbyChatService } from './lobby-chat.service';
export declare class LobbyChatController {
    private readonly lobbyChatService;
    constructor(lobbyChatService: LobbyChatService);
    getHistory(accountId?: string): Promise<{
        ok: boolean;
        messages: import("./schema/lobby-message.schema").LobbyMessage[];
    }>;
}
