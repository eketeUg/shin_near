import { OnGatewayConnection, OnGatewayDisconnect } from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';
import { GameService } from './game.service';
export declare class GameGateway implements OnGatewayConnection, OnGatewayDisconnect {
    private readonly gameService;
    server: Server;
    private activeMatches;
    private matchmakingBuckets;
    constructor(gameService: GameService);
    handleConnection(client: Socket): void;
    handleDisconnect(client: Socket): void;
    handleCreateMatch(client: Socket, matchData: any): {
        matchId: any;
    };
    handleHostSyncFrame(client: Socket, frameData: any): void;
    handleHostFireEvent(client: Socket, eventData: any): void;
    handlePlaceEncryptedBet(client: Socket, betData: {
        matchId: string;
        encryptedPrediction: string;
        amount: number;
        spectatorPubKey: string;
    }): {
        success: boolean;
        message?: undefined;
    } | {
        success: boolean;
        message: string;
    };
    private processMatchSettlement;
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
    handleCancelMatchmaking(client: Socket): void;
    handleHostBindMatch(client: Socket, matchId: string): void;
    handleP2Input(client: Socket, data: {
        matchId: string;
        input: any;
    }): void;
    handleJoinGame(client: Socket, data: any): void;
    private startBotLoop;
    handlePlayerInput(client: Socket, input: {
        x: number;
        y: number;
    }): void;
    handlePlayerAttack(client: Socket): void;
}
