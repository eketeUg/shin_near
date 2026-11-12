import { Module } from '@nestjs/common';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { GameModule } from './game/game.module';
import { DatabaseModule } from './database/database.module';
import { UsersModule } from './users/users.module';
import { WalletModule } from './wallet/wallet.module';
import { AuthModule } from './auth/auth.module';

@Module({
  imports: [GameModule, DatabaseModule, UsersModule, WalletModule, AuthModule],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
