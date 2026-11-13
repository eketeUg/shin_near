import {
  Injectable,
  UnauthorizedException,
  BadRequestException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import * as nodemailer from 'nodemailer';
import { UsersService } from '../users/users.service';
import { UserType, UserDocument } from 'src/users/schema/user.schema';
import { Otp, OtpDocument } from './otp.schema';
import { WalletService } from 'src/wallet/wallet.service';

@Injectable()
export class AuthService {
  private transporter: nodemailer.Transporter;

  constructor(
    private jwtService: JwtService,
    private usersService: UsersService,
    private readonly walletService: WalletService,
    @InjectModel(Otp.name) private otpModel: Model<OtpDocument>,
  ) {
    this.transporter = nodemailer.createTransport({
      service: 'gmail',
      auth: {
        user: process.env.SMTP_USER,
        pass: process.env.SMTP_PASS,
      },
    });

    // Verify connection on startup
    this.transporter.verify((error, success) => {
      if (error) {
        console.error('SMTP Connection Error:', error);
      } else {
        console.log('SMTP Server is ready (Gmail Service)');
      }
    });
  }

  // ===================== Google OAuth =====================

  async googleLogin(req: any) {
    if (!req.user) {
      throw new UnauthorizedException('No user from google');
    }

    let dbUser = await this.usersService.findByEmail(req.user.email);
    let needsSave = false;
    let isNewUser = false;

    if (!dbUser) {
      dbUser = await this.usersService.create({
        email: req.user.email,
        username: req.user.email.split('@')[0],
        type: UserType.AUTHENTICATED,
      } as any);
      needsSave = true;
      isNewUser = true;
    }

    if (!dbUser.googleId) {
      dbUser.googleId = req.user.providerId;
      dbUser.authProvider = 'google';
      needsSave = true;
    }

    // Ensure user has a wallet
    if (!dbUser.walletAddress) {
      await this.generateWalletForUser(dbUser);
      needsSave = true;
    }

    if (needsSave) {
      await dbUser.save();
    }

    const payload = {
      email: dbUser.email,
      sub: dbUser.id || (dbUser as any)._id?.toString(),
      userName: dbUser.username,
      username: dbUser.username,
      provider: dbUser.authProvider,
      walletAddress: dbUser.walletAddress,
      isNewUser,
    };

    return {
      access_token: this.jwtService.sign(payload),
      user: payload,
    };
  }

  // ===================== Email OTP =====================

  async sendOtp(email: string) {
    // Generate a 5-digit OTP
    const code = Math.floor(10000 + Math.random() * 90000).toString();

    // Remove any existing OTP for this email, then create fresh
    await this.otpModel.deleteMany({ email });
    await this.otpModel.create({
      email,
      code,
      attempts: 0,
      expiresAt: new Date(Date.now() + 5 * 60 * 1000), // 5 minutes
    });

    // Send the email
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
    } catch (error) {
      console.error('Failed to send OTP email:', error);
      throw new BadRequestException('Failed to send verification email. Please check your SMTP settings.');
    }

    return { message: 'OTP sent' };
  }

  async verifyOtp(email: string, code: string) {
    const otpRecord = await this.otpModel.findOne({ email });

    if (!otpRecord) {
      throw new BadRequestException(
        'OTP expired or not found. Please request a new one.',
      );
    }

    if (otpRecord.attempts >= 3) {
      await this.otpModel.deleteOne({ _id: otpRecord._id });
      throw new BadRequestException(
        'Too many attempts. Please request a new OTP.',
      );
    }

    if (otpRecord.code !== code) {
      otpRecord.attempts += 1;
      await otpRecord.save();
      throw new BadRequestException(
        `Invalid code. ${3 - otpRecord.attempts} attempt(s) remaining.`,
      );
    }

    // OTP is valid — clean up
    await this.otpModel.deleteOne({ _id: otpRecord._id });

    // Find or create the user
    let dbUser = await this.usersService.findByEmail(email);
    let needsSave = false;
    let isNewUser = false;

    if (!dbUser) {
      dbUser = await this.usersService.create({
        email,
        username: email.split('@')[0],
        type: UserType.AUTHENTICATED,
      } as any);
      dbUser.authProvider = 'email';
      dbUser.emailVerified = true;
      needsSave = true;
      isNewUser = true;
    } else {
      if (!dbUser.emailVerified) {
        dbUser.emailVerified = true;
        dbUser.authProvider = 'email';
        needsSave = true;
      }
    }

    // Ensure user has a wallet
    if (!dbUser.walletAddress) {
      await this.generateWalletForUser(dbUser);
      needsSave = true;
    }

    if (needsSave) {
      await dbUser.save();
    }

    const payload = {
      email: dbUser.email,
      sub: dbUser.id || (dbUser as any)._id?.toString(),
      userName: dbUser.username,
      username: dbUser.username,
      provider: dbUser.authProvider,
      walletAddress: dbUser.walletAddress,
      isNewUser,
    };

    return {
      access_token: this.jwtService.sign(payload),
      user: payload,
    };
  }

  /**
   * Helper to generate and encrypt a new SVM wallet for a user document.
   * Does NOT save the document.
   */
  private async generateWalletForUser(user: UserDocument) {
    const newSolanaWallet = await this.walletService.createSVMWallet();

    const encryptedSolanaWalletDetails =
      await this.walletService.encryptSVMWallet(
        process.env.DEFAULT_WALLET_PIN ||
          process.env.JWT_SECRET ||
          'shin_arena_default_wallet_pin',
        newSolanaWallet.privateKey,
      );

    user.walletAddress = newSolanaWallet.address;
    user.walletDetails = encryptedSolanaWalletDetails.json;
  }

  // ===================== Token =====================

  verifyToken(token: string) {
    try {
      return this.jwtService.verify(token);
    } catch (e) {
      throw new UnauthorizedException('Invalid token');
    }
  }

  // ===================== Profile =====================

  async getFullUser(userId: string) {
    return this.usersService.findById(userId);
  }

  async updateUsername(userId: string, username: string) {
    const clean = (username || '').trim();
    if (clean.length < 3) {
      throw new BadRequestException('Username must be at least 3 characters');
    }
    return this.usersService.update(userId, { username: clean });
  }
}
