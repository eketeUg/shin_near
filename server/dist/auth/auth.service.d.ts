import { JwtService } from '@nestjs/jwt';
import { Model } from 'mongoose';
import { UsersService } from '../users/users.service';
import { OtpDocument } from './otp.schema';
import { WalletService } from 'src/wallet/wallet.service';
export declare class AuthService {
    private jwtService;
    private usersService;
    private readonly walletService;
    private otpModel;
    private transporter;
    constructor(jwtService: JwtService, usersService: UsersService, walletService: WalletService, otpModel: Model<OtpDocument>);
    googleLogin(req: any): Promise<{
        access_token: string;
        user: {
            email: string | undefined;
            sub: any;
            userName: string | undefined;
            provider: "email" | "guest" | "google";
            walletAddress: string | undefined;
        };
    }>;
    sendOtp(email: string): Promise<{
        message: string;
    }>;
    verifyOtp(email: string, code: string): Promise<{
        access_token: string;
        user: {
            email: string | undefined;
            sub: any;
            userName: string | undefined;
            provider: "email" | "guest" | "google";
            walletAddress: string | undefined;
        };
    }>;
    private generateWalletForUser;
    verifyToken(token: string): any;
    getFullUser(userId: string): Promise<(import("mongoose").Document<unknown, {}, import("mongoose").Document<unknown, {}, import("src/users/schema/user.schema").User, {}, import("mongoose").DefaultSchemaOptions> & import("src/users/schema/user.schema").User & {
        _id: import("mongoose").Types.ObjectId;
    } & {
        __v: number;
    } & {
        id: string;
    }, {}, import("mongoose").DefaultSchemaOptions> & import("mongoose").Document<unknown, {}, import("src/users/schema/user.schema").User, {}, import("mongoose").DefaultSchemaOptions> & import("src/users/schema/user.schema").User & {
        _id: import("mongoose").Types.ObjectId;
    } & {
        __v: number;
    } & {
        id: string;
    } & Required<{
        _id: import("mongoose").Types.ObjectId;
    }>) | null>;
    updateUsername(userId: string, username: string): Promise<(import("mongoose").Document<unknown, {}, import("mongoose").Document<unknown, {}, import("src/users/schema/user.schema").User, {}, import("mongoose").DefaultSchemaOptions> & import("src/users/schema/user.schema").User & {
        _id: import("mongoose").Types.ObjectId;
    } & {
        __v: number;
    } & {
        id: string;
    }, {}, import("mongoose").DefaultSchemaOptions> & import("mongoose").Document<unknown, {}, import("src/users/schema/user.schema").User, {}, import("mongoose").DefaultSchemaOptions> & import("src/users/schema/user.schema").User & {
        _id: import("mongoose").Types.ObjectId;
    } & {
        __v: number;
    } & {
        id: string;
    } & Required<{
        _id: import("mongoose").Types.ObjectId;
    }>) | null>;
}
