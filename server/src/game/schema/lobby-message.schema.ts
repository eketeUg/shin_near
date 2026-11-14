import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, Schema as MongooseSchema } from 'mongoose';

export type LobbyMessageDocument = HydratedDocument<LobbyMessage>;

@Schema({ timestamps: true, collection: 'lobby_messages' })
export class LobbyMessage {
  @Prop({ required: true, unique: true, index: true })
  id!: string;

  @Prop({ required: true })
  senderName!: string;

  @Prop({ required: true, index: true })
  senderAccountId!: string;

  @Prop({ default: 'HUMAN' })
  senderType!: 'HUMAN' | 'AGENT';

  @Prop()
  senderCharId?: string;

  @Prop()
  archetypeBadge?: string;

  @Prop()
  recipientName?: string;

  @Prop({ index: true })
  recipientAccountId?: string;

  @Prop({ default: 'DELIVERED_LIVE' })
  deliveryStatus?: 'DELIVERED_LIVE' | 'QUEUED_OFFLINE' | 'READ_ON_WAKE';

  @Prop({ required: true })
  text!: string;

  @Prop({ required: true, index: true })
  timestamp!: number;

  @Prop({ type: MongooseSchema.Types.Mixed })
  challengeOffer?: Record<string, unknown>;
}

export const LobbyMessageSchema = SchemaFactory.createForClass(LobbyMessage);
