import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { PassportModule } from '@nestjs/passport';
import { MongooseModule } from '@nestjs/mongoose';
import { AuthService } from './auth.service';
import { AuthController } from './auth.controller';
import { GoogleStrategy } from './google.strategy';
import { UsersModule } from '../users/users.module';
import { Otp, OtpSchema } from './otp.schema';
import { WalletModule } from 'src/wallet/wallet.module';

@Module({
  imports: [
    UsersModule,
    WalletModule,
    PassportModule,
    MongooseModule.forFeature([{ name: Otp.name, schema: OtpSchema }]),
    JwtModule.register({
      secret: process.env.JWT_SECRET || 'super_secret_shin_key_fallback',
      signOptions: { expiresIn: '7d' },
    }),
  ],
  providers: [AuthService, GoogleStrategy],
  controllers: [AuthController],
  exports: [JwtModule],
})
export class AuthModule {}

