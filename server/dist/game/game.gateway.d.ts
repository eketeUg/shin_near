import { OnGatewayConnection, OnGatewayDisconnect } from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';
import { GameService } from './game.service';
import { NearRelayerService } from './near-relayer.service';
export declare class GameGateway implements OnGatewayConnection, OnGatewayDisconnect {
    private readonly gameService;
    private readonly nearRelayer;
    server: Server;
    private activeMatches;
    private matchmakingBuckets;
    private lobbyUsers;
    private offlineMessageQueue;
    private chatFightProposals;
    constructor(gameService: GameService, nearRelayer: NearRelayerService);
    handleConnection(client: Socket): void;
    handleDisconnect(client: Socket): void;
    handleCreateMatch(client: Socket, matchData: any): {
        matchId: any;
        contractId: string;
    };
    handleHostSyncFrame(client: Socket, frameData: any): void;
    handleHostFireEvent(client: Socket, eventData: any): void;
    handlePlaceSpectatorBet(client: Socket, betData: {
        matchId: string;
        backedFighterId: string;
        amountNear: number;
        spectatorAccountId: string;
    }): {
        success: boolean;
        message?: undefined;
    } | {
        success: boolean;
        message: string;
    };
    private processNearMatchSettlement;
    handleGetActiveMatches(client: Socket): void;
    handleJoinSpectator(client: Socket, matchId: string): {
        success: boolean;
        message?: undefined;
    } | {
        success: boolean;
        message: string;
    };
    handleLeaveSpectator(client: Socket, matchId: string): void;
    handleJoinMatchmaking(client: Socket, userData: any): void;
    handleLobbyRegisterPresence(client: Socket, userData: {
        accountId: string;
        username: string;
        charId?: string;
        elo?: number;
        wins?: number;
        losses?: number;
    }): void;
    handleLobbySendDm(client: Socket, msg: any): {
        deliveryStatus: string;
    };
    handleLobbySendFightProposal(client: Socket, msg: any): void;
    handleLobbyRespondFightProposal(client: Socket, data: {
        proposalId: string;
        status: 'ACCEPTED' | 'COUNTERED' | 'DECLINED';
        wagerNear: number;
    }): void;
    handleLobbyChatMessage(client: Socket, msgData: any): void;
    handleDirectChallengeRequest(client: Socket, challengeData: any): void;
    handleCancelMatchmaking(client: Socket): void;
    handleHostBindMatch(client: Socket, matchId: string): void;
    handleP2Input(client: Socket, data: {
        matchId: string;
        input: any;
    }): void;
    handleJoinGame(client: Socket): void;
    private startBotLoop;
    handlePlayerInput(client: Socket, input: {
        x: number;
        y: number;
    }): void;
    handlePlayerAttack(client: Socket): void;
}
