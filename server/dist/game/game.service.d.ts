export interface Player {
    id: string;
    x: number;
    y: number;
    hp: number;
    maxHp: number;
    isBot?: boolean;
    score: number;
}
export declare class GameService {
    private players;
    addPlayer(playerId: string, isBot?: boolean): Player;
    addBot(): Player;
    removePlayer(playerId: string): void;
    getPlayer(playerId: string): Player | undefined;
    getAllPlayers(): Player[];
    movePlayer(playerId: string, x: number, y: number): Player | null;
    damagePlayer(targetId: string, amount: number): Player | null;
}
