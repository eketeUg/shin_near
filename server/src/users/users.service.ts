/* eslint-disable @typescript-eslint/no-unsafe-call */
import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { User, UserDocument } from './schema/user.schema';
import { CreateUserDto } from './dto/create-user.dto';
import { UpdateUserDto } from './dto/update-user.dto';

@Injectable()
export class UsersService {
  constructor(@InjectModel(User.name) private userModel: Model<UserDocument>) {}

  async create(dto: CreateUserDto) {
    return this.userModel.create({
      ...dto,
      authProvider: this.detectProvider(dto),
    });
  }

  async update(userId: string, dto: UpdateUserDto) {
    return this.userModel.findByIdAndUpdate(userId, dto, { new: true });
  }

  async findByEmail(email: string) {
    return this.userModel.findOne({ email });
  }

  async findById(id: string) {
    return this.userModel.findById(id);
  }

  async findByWallet(walletAddress: string): Promise<User | null> {
    return this.userModel.findOne({ walletAddress }).exec();
  }

  async findAllRegistered() {
    return this.userModel
      .find({ walletAddress: { $exists: true, $nin: [null, ''] } })
      .select(
        'username walletAddress rating level xp wins losses winStreak lossStreak totalShinEarned authProvider updatedAt',
      )
      .sort({ totalShinEarned: -1, wins: -1, rating: -1 })
      .lean()
      .exec();
  }

  async recordMatchOutcome(
    walletAddress: string,
    didWin: boolean,
    shinEarned: number = 0,
  ) {
    if (!walletAddress) return;
    if (didWin) {
      await this.userModel
        .findOneAndUpdate(
          { walletAddress },
          {
            $inc: {
              wins: 1,
              winStreak: 1,
              rating: 20,
              xp: 30,
              totalShinEarned: Math.max(0, Math.round(shinEarned)),
            },
            $set: { lossStreak: 0 },
          },
        )
        .exec();
    } else {
      await this.userModel
        .findOneAndUpdate(
          { walletAddress },
          {
            $inc: { losses: 1, lossStreak: 1 },
            $set: { winStreak: 0 },
          },
        )
        .exec();
    }
  }

  private detectProvider(dto: CreateUserDto) {
    if (dto.email) return 'email';
    return 'guest';
  }
}
