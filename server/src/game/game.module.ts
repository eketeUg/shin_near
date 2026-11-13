import { Module } from '@nestjs/common';
import { GameGateway } from './game.gateway';
import { GameService } from './game.service';
import { NearRelayerController } from './near-relayer.controller';
import { NearRelayerService } from './near-relayer.service';

@Module({
  controllers: [NearRelayerController],
  providers: [GameGateway, GameService, NearRelayerService],
  exports: [NearRelayerService],
})
export class GameModule {}
