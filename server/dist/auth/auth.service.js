"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
var __metadata = (this && this.__metadata) || function (k, v) {
    if (typeof Reflect === "object" && typeof Reflect.metadata === "function") return Reflect.metadata(k, v);
};
var __param = (this && this.__param) || function (paramIndex, decorator) {
    return function (target, key) { decorator(target, key, paramIndex); }
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.AuthService = void 0;
const common_1 = require("@nestjs/common");
const jwt_1 = require("@nestjs/jwt");
const mongoose_1 = require("@nestjs/mongoose");
const mongoose_2 = require("mongoose");
const nodemailer = __importStar(require("nodemailer"));
const users_service_1 = require("../users/users.service");
const user_schema_1 = require("../users/schema/user.schema");
const otp_schema_1 = require("./otp.schema");
const wallet_service_1 = require("../wallet/wallet.service");
let AuthService = class AuthService {
    jwtService;
    usersService;
    walletService;
    otpModel;
    transporter;
    constructor(jwtService, usersService, walletService, otpModel) {
        this.jwtService = jwtService;
        this.usersService = usersService;
        this.walletService = walletService;
        this.otpModel = otpModel;
        this.transporter = nodemailer.createTransport({
            service: 'gmail',
            auth: {
                user: process.env.SMTP_USER,
                pass: process.env.SMTP_PASS,
            },
        });
        this.transporter.verify((error, success) => {
            if (error) {
                console.error('SMTP Connection Error:', error);
            }
            else {
                console.log('SMTP Server is ready (Gmail Service)');
            }
        });
    }
    async googleLogin(req) {
        if (!req.user) {
            throw new common_1.UnauthorizedException('No user from google');
        }
        let dbUser = await this.usersService.findByEmail(req.user.email);
        let needsSave = false;
        if (!dbUser) {
            dbUser = await this.usersService.create({
                email: req.user.email,
                username: req.user.email.split('@')[0],
                type: user_schema_1.UserType.AUTHENTICATED,
            });
            needsSave = true;
        }
        if (!dbUser.googleId) {
            dbUser.googleId = req.user.providerId;
            dbUser.authProvider = 'google';
            needsSave = true;
        }
        if (!dbUser.walletAddress) {
            await this.generateWalletForUser(dbUser);
            needsSave = true;
        }
        if (needsSave) {
            await dbUser.save();
        }
        const payload = {
            email: dbUser.email,
            sub: dbUser.id || dbUser._id?.toString(),
            userName: dbUser.username,
            provider: dbUser.authProvider,
            walletAddress: dbUser.walletAddress,
        };
        return {
            access_token: this.jwtService.sign(payload),
            user: payload,
        };
    }
    async sendOtp(email) {
        const code = Math.floor(10000 + Math.random() * 90000).toString();
        await this.otpModel.deleteMany({ email });
        await this.otpModel.create({
            email,
            code,
            attempts: 0,
            expiresAt: new Date(Date.now() + 5 * 60 * 1000),
        });
        try {
            console.log(`Attempting to send OTP to ${email}...`);
            await this.transporter.sendMail({
                from: `"SHIN: The Struggle" <${process.env.SMTP_USER}>`,
                to: email,
                subject: `Your Login Code: ${code}`,
                text: `Your SHIN: The Struggle verification code is: ${code}. This code expires in 5 minutes.`,
                html: `
          <div style="font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; max-width: 450px; margin: 0 auto; background-color: #050505; color: #ffffff; padding: 40px; border: 1px solid #1a1a1a; border-radius: 16px; text-align: center;">
            <div style="margin-bottom: 20px;">
              <h1 style="color: #d4af37; font-size: 32px; letter-spacing: 8px; margin: 0; font-weight: 900;">SHIN</h1>
              <p style="color: #666; font-size: 10px; letter-spacing: 5px; margin: 5px 0 0 0; text-transform: uppercase;">The Struggle</p>
            </div>
            
            <div style="height: 1px; background: linear-gradient(to right, transparent, #333, transparent); margin: 30px 0;"></div>
            
            <p style="color: #aaa; font-size: 14px; line-height: 1.6; margin-bottom: 25px;">
              Use the following sacred code to authorize your entry into the arena.
            </p>
            
            <div style="background: #111; border: 1px solid #d4af37; border-radius: 12px; padding: 25px; margin: 20px 0;">
              <span style="font-family: monospace; font-size: 42px; font-weight: bold; letter-spacing: 12px; color: #d4af37; display: block; filter: drop-shadow(0 0 8px rgba(212,175,55,0.3));">
                ${code}
              </span>
            </div>
            
            <p style="color: #555; font-size: 12px; margin-top: 30px;">
              This code will expire in <span style="color: #888;">5 minutes</span>.<br/>
              If you did not request this, please ignore this scroll.
            </p>
            
            <div style="margin-top: 40px; padding-top: 20px; border-top: 1px solid #1a1a1a;">
               <p style="color: #333; font-size: 10px; margin: 0;">&copy; 2026 28 Dreams Studio. All rights reserved.</p>
            </div>
          </div>
        `,
            });
            console.log(`OTP successfully sent to ${email}`);
        }
        catch (error) {
            console.error('Failed to send OTP email:', error);
            throw new common_1.BadRequestException('Failed to send verification email. Please check your SMTP settings.');
        }
        return { message: 'OTP sent' };
    }
    async verifyOtp(email, code) {
        const otpRecord = await this.otpModel.findOne({ email });
        if (!otpRecord) {
            throw new common_1.BadRequestException('OTP expired or not found. Please request a new one.');
        }
        if (otpRecord.attempts >= 3) {
            await this.otpModel.deleteOne({ _id: otpRecord._id });
            throw new common_1.BadRequestException('Too many attempts. Please request a new OTP.');
        }
        if (otpRecord.code !== code) {
            otpRecord.attempts += 1;
            await otpRecord.save();
            throw new common_1.BadRequestException(`Invalid code. ${3 - otpRecord.attempts} attempt(s) remaining.`);
        }
        await this.otpModel.deleteOne({ _id: otpRecord._id });
        let dbUser = await this.usersService.findByEmail(email);
        let needsSave = false;
        if (!dbUser) {
            dbUser = await this.usersService.create({
                email,
                username: email.split('@')[0],
                type: user_schema_1.UserType.AUTHENTICATED,
            });
            dbUser.authProvider = 'email';
            dbUser.emailVerified = true;
            needsSave = true;
        }
        else {
            if (!dbUser.emailVerified) {
                dbUser.emailVerified = true;
                dbUser.authProvider = 'email';
                needsSave = true;
            }
        }
        if (!dbUser.walletAddress) {
            await this.generateWalletForUser(dbUser);
            needsSave = true;
        }
        if (needsSave) {
            await dbUser.save();
        }
        const payload = {
            email: dbUser.email,
            sub: dbUser.id || dbUser._id?.toString(),
            userName: dbUser.username,
            provider: dbUser.authProvider,
            walletAddress: dbUser.walletAddress,
        };
        return {
            access_token: this.jwtService.sign(payload),
            user: payload,
        };
    }
    async generateWalletForUser(user) {
        const newSolanaWallet = await this.walletService.createSVMWallet();
        const encryptedSolanaWalletDetails = await this.walletService.encryptSVMWallet(process.env.DEFAULT_WALLET_PIN, newSolanaWallet.privateKey);
        user.walletAddress = newSolanaWallet.address;
        user.walletDetails = encryptedSolanaWalletDetails.json;
    }
    verifyToken(token) {
        try {
            return this.jwtService.verify(token);
        }
        catch (e) {
            throw new common_1.UnauthorizedException('Invalid token');
        }
    }
    async getFullUser(userId) {
        return this.usersService.findById(userId);
    }
    async updateUsername(userId, username) {
        if (!username || username.length < 3) {
            throw new common_1.BadRequestException('Username must be at least 3 characters');
        }
        return this.usersService.update(userId, { username });
    }
};
exports.AuthService = AuthService;
exports.AuthService = AuthService = __decorate([
    (0, common_1.Injectable)(),
    __param(3, (0, mongoose_1.InjectModel)(otp_schema_1.Otp.name)),
    __metadata("design:paramtypes", [jwt_1.JwtService,
        users_service_1.UsersService,
        wallet_service_1.WalletService,
        mongoose_2.Model])
], AuthService);
//# sourceMappingURL=auth.service.js.map