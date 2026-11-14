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
import { AgentWalletController } from './agent-wallet.controller';
import { AgentWalletService } from './agent-wallet.service';
import { LeaderboardController } from './leaderboard.controller';
import { LobbyMessage, LobbyMessageSchema } from './schema/lobby-message.schema';
import { AgentWallet, AgentWalletSchema } from './schema/agent-wallet.schema';

@Module({
  imports: [
    AuthModule,
    UsersModule,
    WalletModule,
    MongooseModule.forFeature([
      { name: LobbyMessage.name, schema: LobbyMessageSchema },
      { name: AgentWallet.name, schema: AgentWalletSchema },
    ]),
  ],
  controllers: [
    NearRelayerController,
    LobbyChatController,
    TournamentController,
    AgentWalletController,
    LeaderboardController,
  ],
  providers: [
    GameGateway,
    GameService,
    NearRelayerService,
    LobbyChatService,
    TournamentService,
    AgentWalletService,
  ],
  exports: [
    NearRelayerService,
    LobbyChatService,
    TournamentService,
    AgentWalletService,
  ],
})
export class GameModule {}
