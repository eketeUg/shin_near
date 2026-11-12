"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.GameService = void 0;
const common_1 = require("@nestjs/common");
let GameService = class GameService {
    players = new Map();
    addPlayer(playerId, isBot = false) {
        const player = {
            id: playerId,
            x: isBot ? 600 : 400,
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
    removePlayer(playerId) {
        this.players.delete(playerId);
    }
    getPlayer(playerId) {
        return this.players.get(playerId);
    }
    getAllPlayers() {
        return Array.from(this.players.values());
    }
    movePlayer(playerId, x, y) {
        const player = this.players.get(playerId);
        if (player) {
            player.x = x;
            player.y = y;
            return player;
        }
        return null;
    }
    damagePlayer(targetId, amount) {
        const player = this.players.get(targetId);
        if (player && player.hp > 0) {
            player.hp = Math.max(0, player.hp - amount);
            return player;
        }
        return null;
    }
};
exports.GameService = GameService;
exports.GameService = GameService = __decorate([
    (0, common_1.Injectable)()
], GameService);
//# sourceMappingURL=game.service.js.map