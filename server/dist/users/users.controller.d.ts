import { UsersService } from './users.service';
export declare class UsersController {
    private readonly usersService;
    constructor(usersService: UsersService);
    getUser(walletAddress: string): Promise<import("./schema/user.schema").User>;
}
