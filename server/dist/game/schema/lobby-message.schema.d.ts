import { HydratedDocument, Schema as MongooseSchema } from 'mongoose';
export type LobbyMessageDocument = HydratedDocument<LobbyMessage>;
export declare class LobbyMessage {
    id: string;
    senderName: string;
    senderAccountId: string;
    senderType: 'HUMAN' | 'AGENT';
    senderCharId?: string;
    archetypeBadge?: string;
    recipientName?: string;
    recipientAccountId?: string;
    deliveryStatus?: 'DELIVERED_LIVE' | 'QUEUED_OFFLINE' | 'READ_ON_WAKE';
    text: string;
    timestamp: number;
    challengeOffer?: Record<string, unknown>;
}
export declare const LobbyMessageSchema: MongooseSchema<LobbyMessage, import("mongoose").Model<LobbyMessage, any, any, any, import("mongoose").Document<unknown, any, LobbyMessage, any, import("mongoose").DefaultSchemaOptions> & LobbyMessage & {
    _id: import("mongoose").Types.ObjectId;
} & {
    __v: number;
}, any, LobbyMessage>, {}, {}, {}, {}, import("mongoose").DefaultSchemaOptions, LobbyMessage, import("mongoose").Document<unknown, {}, LobbyMessage, {}, import("mongoose").DefaultSchemaOptions> & LobbyMessage & {
    _id: import("mongoose").Types.ObjectId;
} & {
    __v: number;
}, {
    id?: import("mongoose").SchemaDefinitionProperty<string, LobbyMessage, import("mongoose").Document<unknown, {}, LobbyMessage, {}, import("mongoose").DefaultSchemaOptions> & LobbyMessage & {
        _id: import("mongoose").Types.ObjectId;
    } & {
        __v: number;
    }> | undefined;
    senderName?: import("mongoose").SchemaDefinitionProperty<string, LobbyMessage, import("mongoose").Document<unknown, {}, LobbyMessage, {}, import("mongoose").DefaultSchemaOptions> & LobbyMessage & {
        _id: import("mongoose").Types.ObjectId;
    } & {
        __v: number;
    }> | undefined;
    senderAccountId?: import("mongoose").SchemaDefinitionProperty<string, LobbyMessage, import("mongoose").Document<unknown, {}, LobbyMessage, {}, import("mongoose").DefaultSchemaOptions> & LobbyMessage & {
        _id: import("mongoose").Types.ObjectId;
    } & {
        __v: number;
    }> | undefined;
    senderType?: import("mongoose").SchemaDefinitionProperty<"HUMAN" | "AGENT", LobbyMessage, import("mongoose").Document<unknown, {}, LobbyMessage, {}, import("mongoose").DefaultSchemaOptions> & LobbyMessage & {
        _id: import("mongoose").Types.ObjectId;
    } & {
        __v: number;
    }> | undefined;
    senderCharId?: import("mongoose").SchemaDefinitionProperty<string | undefined, LobbyMessage, import("mongoose").Document<unknown, {}, LobbyMessage, {}, import("mongoose").DefaultSchemaOptions> & LobbyMessage & {
        _id: import("mongoose").Types.ObjectId;
    } & {
        __v: number;
    }> | undefined;
    archetypeBadge?: import("mongoose").SchemaDefinitionProperty<string | undefined, LobbyMessage, import("mongoose").Document<unknown, {}, LobbyMessage, {}, import("mongoose").DefaultSchemaOptions> & LobbyMessage & {
        _id: import("mongoose").Types.ObjectId;
    } & {
        __v: number;
    }> | undefined;
    recipientName?: import("mongoose").SchemaDefinitionProperty<string | undefined, LobbyMessage, import("mongoose").Document<unknown, {}, LobbyMessage, {}, import("mongoose").DefaultSchemaOptions> & LobbyMessage & {
        _id: import("mongoose").Types.ObjectId;
    } & {
        __v: number;
    }> | undefined;
    recipientAccountId?: import("mongoose").SchemaDefinitionProperty<string | undefined, LobbyMessage, import("mongoose").Document<unknown, {}, LobbyMessage, {}, import("mongoose").DefaultSchemaOptions> & LobbyMessage & {
        _id: import("mongoose").Types.ObjectId;
    } & {
        __v: number;
    }> | undefined;
    deliveryStatus?: import("mongoose").SchemaDefinitionProperty<"DELIVERED_LIVE" | "QUEUED_OFFLINE" | "READ_ON_WAKE" | undefined, LobbyMessage, import("mongoose").Document<unknown, {}, LobbyMessage, {}, import("mongoose").DefaultSchemaOptions> & LobbyMessage & {
        _id: import("mongoose").Types.ObjectId;
    } & {
        __v: number;
    }> | undefined;
    text?: import("mongoose").SchemaDefinitionProperty<string, LobbyMessage, import("mongoose").Document<unknown, {}, LobbyMessage, {}, import("mongoose").DefaultSchemaOptions> & LobbyMessage & {
        _id: import("mongoose").Types.ObjectId;
    } & {
        __v: number;
    }> | undefined;
    timestamp?: import("mongoose").SchemaDefinitionProperty<number, LobbyMessage, import("mongoose").Document<unknown, {}, LobbyMessage, {}, import("mongoose").DefaultSchemaOptions> & LobbyMessage & {
        _id: import("mongoose").Types.ObjectId;
    } & {
        __v: number;
    }> | undefined;
    challengeOffer?: import("mongoose").SchemaDefinitionProperty<Record<string, unknown> | undefined, LobbyMessage, import("mongoose").Document<unknown, {}, LobbyMessage, {}, import("mongoose").DefaultSchemaOptions> & LobbyMessage & {
        _id: import("mongoose").Types.ObjectId;
    } & {
        __v: number;
    }> | undefined;
}, LobbyMessage>;
