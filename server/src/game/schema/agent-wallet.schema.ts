import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument } from 'mongoose';

export type AgentWalletDocument = HydratedDocument<AgentWallet>;

@Schema({ timestamps: true })
export class AgentWallet {
  @Prop({ required: true, unique: true, index: true })
  tokenId: string;

  @Prop({ required: true, unique: true, index: true })
  agentAccountId: string;

  @Prop({ required: true })
  publicKey: string;

  @Prop({ required: true })
  encryptedPrivateKey: string;
}

export const AgentWalletSchema = SchemaFactory.createForClass(AgentWallet);
