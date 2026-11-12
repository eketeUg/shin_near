import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument } from 'mongoose';

export type UserDocument = HydratedDocument<User>;

export enum UserType {
  GUEST = 'guest',
  AUTHENTICATED = 'authenticated',
}

@Schema({ timestamps: true })
export class User {
  // ===== Identity =====
  @Prop()
  username?: string;

  @Prop({ unique: true, sparse: true })
  email?: string;

  @Prop({ unique: true, sparse: true })
  googleId?: string;

  @Prop({ unique: true, sparse: true })
  walletAddress?: string;

  @Prop({ unique: true, sparse: true })
  walletDetails?: string;

  @Prop({ default: false })
  emailVerified!: boolean;

  @Prop({ default: 'guest' })
  authProvider!: 'google' | 'email' | 'guest';

  @Prop({ enum: UserType, default: UserType.GUEST })
  type!: UserType;

  // ===== Game progression =====
  @Prop({ default: 1 })
  level!: number;

  @Prop({ default: 0 })
  xp!: number;

  @Prop({ default: 100 })
  rating!: number; // PvP matchmaking (ELO-like)

  // ===== Game permissions =====
  @Prop({ default: true })
  canFightAI!: boolean;

  @Prop({ default: true })
  canFightPlayer!: boolean;

  @Prop({ default: false })
  canPlaceBet!: boolean; // ONLY authenticated users

  // ===== Economy =====
  @Prop({ default: 0 })
  balance!: number; // off-chain token balance or game credits

  @Prop({ default: 0 })
  lockedBalance!: number; // bets locked in active matches

  // ===== Anti-abuse / control =====
  @Prop({ default: 0 })
  lossStreak!: number;

  @Prop({ default: 0 })
  winStreak!: number;

  @Prop({ default: 0 })
  wins!: number;

  @Prop({ default: 0 })
  losses!: number;
}

export const UserSchema = SchemaFactory.createForClass(User);
