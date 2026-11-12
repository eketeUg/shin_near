import { Injectable } from '@nestjs/common';

export interface Player {
  id: string;
  x: number;
  y: number;
  hp: number;
  maxHp: number;
  isBot?: boolean;
  score: number;
}

@Injectable()
export class GameService {
  private players: Map<string, Player> = new Map();

  addPlayer(playerId: string, isBot = false) {
    const player: Player = {
      id: playerId,
      x: isBot ? 600 : 400, // Bots start on the right
      y: 300,
      hp: 100,
      maxHp: 100,
      isBot,
      score: 0,
    };
    this.players.set(playerId, player);
    return player;
  }

  addBot() {
    const botId = `bot_${Date.now()}`;
    return this.addPlayer(botId, true);
  }

  removePlayer(playerId: string) {
    this.players.delete(playerId);
  }

  getPlayer(playerId: string) {
    return this.players.get(playerId);
  }

  getAllPlayers() {
    return Array.from(this.players.values());
  }

  movePlayer(playerId: string, x: number, y: number) {
    const player = this.players.get(playerId);
    if (player) {
      player.x = x;
      player.y = y;
      return player;
    }
    return null;
  }

  damagePlayer(targetId: string, amount: number) {
    const player = this.players.get(targetId);
    if (player && player.hp > 0) {
      player.hp = Math.max(0, player.hp - amount);
      return player;
    }
    return null;
  }
}
