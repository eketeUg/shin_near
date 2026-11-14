import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { AuthModule } from '../auth/auth.module';
import { UsersModule } from '../users/users.module';
import { WalletModule } from '../wallet/wallet.module';
import { GameGateway } from './game.gateway';
import { GameService } from './game.service';
import { LobbyChatController } from './lobby-chat.controller';
import { LobbyChatService } from './lobby-chat.service';
import { NearRelayerController } from './near-relayer.controller';
import { NearRelayerService } from './near-relayer.service';
import { TournamentController } from './tournament.controller';
import { TournamentService } from './tournament.service';
import { LobbyMessage, LobbyMessageSchema } from './schema/lobby-message.schema';

@Module({
  imports: [
    AuthModule,
    UsersModule,
    WalletModule,
    MongooseModule.forFeature([
      { name: LobbyMessage.name, schema: LobbyMessageSchema },
    ]),
  ],
  controllers: [NearRelayerController, LobbyChatController, TournamentController],
  providers: [GameGateway, GameService, NearRelayerService, LobbyChatService, TournamentService],
  exports: [NearRelayerService, LobbyChatService, TournamentService],
})
export class GameModule {}
