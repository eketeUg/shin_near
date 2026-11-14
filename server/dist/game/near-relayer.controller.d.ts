import { JwtService } from '@nestjs/jwt';
import type { Request } from 'express';
import { UsersService } from '../users/users.service';
import { WalletService } from '../wallet/wallet.service';
import { NearRelayerService } from './near-relayer.service';
export declare class NearRelayerController {
    private readonly nearRelayer;
    private readonly jwtService;
    private readonly usersService;
    private readonly walletService;
    constructor(nearRelayer: NearRelayerService, jwtService: JwtService, usersService: UsersService, walletService: WalletService);
    getStatus(): {
        networkId: string;
        rpcUrl: string;
        contractId: string;
        shinTokenId: string;
        relayerAccountId: string;
        relayerReady: boolean;
    };
    viewMethod(method: string, argsJson?: string, contractId?: string): Promise<{
        ok: boolean;
        result: unknown;
        error?: undefined;
    } | {
        ok: boolean;
        error: string;
        result?: undefined;
    }>;
    callMethod(req: Request, body: {
        methodName: string;
        args?: Record<string, unknown>;
        attachedDepositNear?: string;
        gas?: string;
        contractId?: string;
    }): Promise<import("./near-relayer.service").NearRelayResult | {
        ok: boolean;
        simulated: boolean;
        error: string;
    }>;
    dripTestnetNear(req: Request, body: {
        receiverId?: string;
    }): Promise<import("./near-relayer.service").NearRelayResult | {
        ok: boolean;
        simulated: boolean;
        error: string;
    }>;
}
