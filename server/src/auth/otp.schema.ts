import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument } from 'mongoose';

export type OtpDocument = HydratedDocument<Otp>;

@Schema()
export class Otp {
  @Prop({ required: true })
  email!: string;

  @Prop({ required: true })
  code!: string;

  @Prop({ default: 0 })
  attempts!: number;

  @Prop({ required: true, index: true, expires: 0 })
  expiresAt!: Date;
}

export const OtpSchema = SchemaFactory.createForClass(Otp);
