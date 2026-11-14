import { OnModuleInit } from '@nestjs/common';
export interface NearRelayResult {
    ok: boolean;
    simulated: boolean;
    contractId: string;
    relayerAccountId: string;
    methodName: string;
    txHash: string;
    explorerUrl: string;
    result?: unknown;
    error?: string;
}
export declare class NearRelayerService implements OnModuleInit {
    private readonly logger;
    readonly networkId: string;
    readonly rpcUrl: string;
    readonly contractId: string;
    readonly shinTokenId: string;
    readonly relayerAccountId: string;
    private provider;
    private relayerAccount;
    private txQueue;
    onModuleInit(): Promise<void>;
    private initRelayer;
    getStatus(): {
        networkId: string;
        rpcUrl: string;
        contractId: string;
        shinTokenId: string;
        relayerAccountId: string;
        relayerReady: boolean;
    };
    private resolveAllowedContract;
    viewMethod(methodName: string, args?: Record<string, unknown>, targetContractId?: string): Promise<unknown>;
    callMethod(methodName: string, args?: Record<string, unknown>, attachedDepositNear?: string, gas?: string, customSigner?: {
        accountId: string;
        privateKey: string;
    }, targetContractId?: string): Promise<NearRelayResult>;
    private executeFunctionCall;
    dripTestnetNear(receiverId: string, amountNear?: string): Promise<NearRelayResult>;
}
