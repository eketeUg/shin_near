import {
  Controller,
  Get,
  Post,
  Body,
  Param,
  NotFoundException,
} from '@nestjs/common';
import { UsersService } from './users.service';

@Controller('users')
export class UsersController {
  constructor(private readonly usersService: UsersService) {}

  @Get()
  async listRegisteredUsers() {
    return this.usersService.findAllRegistered();
  }

  @Get(':walletAddress')
  async getUser(@Param('walletAddress') walletAddress: string) {
    const user = await this.usersService.findByWallet(walletAddress);
    if (!user) {
      throw new NotFoundException('User not found');
    }
    return user;
  }
}
