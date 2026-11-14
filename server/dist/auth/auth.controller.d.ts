import { AuthService } from './auth.service';
import type { Request, Response } from 'express';
export declare class AuthController {
    private readonly authService;
    constructor(authService: AuthService);
    googleAuth(req: any): Promise<void>;
    googleAuthRedirect(req: any, res: Response): Promise<Response<any, Record<string, any>>>;
    getProfile(req: Request): Promise<import("mongoose").Document<unknown, {}, import("mongoose").Document<unknown, {}, import("../users/schema/user.schema").User, {}, import("mongoose").DefaultSchemaOptions> & import("../users/schema/user.schema").User & {
        _id: import("mongoose").Types.ObjectId;
    } & {
        __v: number;
    } & {
        id: string;
    }, {}, import("mongoose").DefaultSchemaOptions> & import("mongoose").Document<unknown, {}, import("../users/schema/user.schema").User, {}, import("mongoose").DefaultSchemaOptions> & import("../users/schema/user.schema").User & {
        _id: import("mongoose").Types.ObjectId;
    } & {
        __v: number;
    } & {
        id: string;
    } & Required<{
        _id: import("mongoose").Types.ObjectId;
    }>>;
    updateUsername(req: Request, body: {
        username: string;
    }): Promise<(import("mongoose").Document<unknown, {}, import("mongoose").Document<unknown, {}, import("../users/schema/user.schema").User, {}, import("mongoose").DefaultSchemaOptions> & import("../users/schema/user.schema").User & {
        _id: import("mongoose").Types.ObjectId;
    } & {
        __v: number;
    } & {
        id: string;
    }, {}, import("mongoose").DefaultSchemaOptions> & import("mongoose").Document<unknown, {}, import("../users/schema/user.schema").User, {}, import("mongoose").DefaultSchemaOptions> & import("../users/schema/user.schema").User & {
        _id: import("mongoose").Types.ObjectId;
    } & {
        __v: number;
    } & {
        id: string;
    } & Required<{
        _id: import("mongoose").Types.ObjectId;
    }>) | null>;
    logout(res: Response): Promise<{
        message: string;
    }>;
    sendOtp(body: {
        email: string;
    }): Promise<{
        message: string;
    }>;
    verifyOtp(body: {
        email: string;
        code: string;
    }, res: Response): Promise<{
        user: {
            email: string | undefined;
            sub: any;
            userName: string | undefined;
            username: string | undefined;
            provider: "email" | "guest" | "google";
            walletAddress: string | undefined;
            isNewUser: boolean;
        };
    }>;
}
