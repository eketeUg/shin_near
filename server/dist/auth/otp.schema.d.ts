import { HydratedDocument } from 'mongoose';
export type OtpDocument = HydratedDocument<Otp>;
export declare class Otp {
    email: string;
    code: string;
    attempts: number;
    expiresAt: Date;
}
export declare const OtpSchema: import("mongoose").Schema<Otp, import("mongoose").Model<Otp, any, any, any, (import("mongoose").Document<unknown, any, Otp, any, import("mongoose").DefaultSchemaOptions> & Otp & {
    _id: import("mongoose").Types.ObjectId;
} & {
    __v: number;
} & {
    id: string;
}) | (import("mongoose").Document<unknown, any, Otp, any, import("mongoose").DefaultSchemaOptions> & Otp & {
    _id: import("mongoose").Types.ObjectId;
} & {
    __v: number;
}), any, Otp>, {}, {}, {}, {}, import("mongoose").DefaultSchemaOptions, Otp, import("mongoose").Document<unknown, {}, Otp, {
    id: string;
}, import("mongoose").DefaultSchemaOptions> & Omit<Otp & {
    _id: import("mongoose").Types.ObjectId;
} & {
    __v: number;
}, "id"> & {
    id: string;
}, {
    email?: import("mongoose").SchemaDefinitionProperty<string, Otp, import("mongoose").Document<unknown, {}, Otp, {
        id: string;
    }, import("mongoose").DefaultSchemaOptions> & Omit<Otp & {
        _id: import("mongoose").Types.ObjectId;
    } & {
        __v: number;
    }, "id"> & {
        id: string;
    }> | undefined;
    code?: import("mongoose").SchemaDefinitionProperty<string, Otp, import("mongoose").Document<unknown, {}, Otp, {
        id: string;
    }, import("mongoose").DefaultSchemaOptions> & Omit<Otp & {
        _id: import("mongoose").Types.ObjectId;
    } & {
        __v: number;
    }, "id"> & {
        id: string;
    }> | undefined;
    attempts?: import("mongoose").SchemaDefinitionProperty<number, Otp, import("mongoose").Document<unknown, {}, Otp, {
        id: string;
    }, import("mongoose").DefaultSchemaOptions> & Omit<Otp & {
        _id: import("mongoose").Types.ObjectId;
    } & {
        __v: number;
    }, "id"> & {
        id: string;
    }> | undefined;
    expiresAt?: import("mongoose").SchemaDefinitionProperty<Date, Otp, import("mongoose").Document<unknown, {}, Otp, {
        id: string;
    }, import("mongoose").DefaultSchemaOptions> & Omit<Otp & {
        _id: import("mongoose").Types.ObjectId;
    } & {
        __v: number;
    }, "id"> & {
        id: string;
    }> | undefined;
}, Otp>;
