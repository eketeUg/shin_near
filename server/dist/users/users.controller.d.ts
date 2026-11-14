import { UsersService } from './users.service';
export declare class UsersController {
    private readonly usersService;
    constructor(usersService: UsersService);
    listRegisteredUsers(): Promise<(import("mongoose").Document<unknown, {}, import("./schema/user.schema").User, {}, import("mongoose").DefaultSchemaOptions> & import("./schema/user.schema").User & {
        _id: import("mongoose").Types.ObjectId;
    } & {
        __v: number;
    } & {
        id: string;
    } & Required<{
        _id: import("mongoose").Types.ObjectId;
    }>)[]>;
    getUser(walletAddress: string): Promise<import("./schema/user.schema").User>;
}
