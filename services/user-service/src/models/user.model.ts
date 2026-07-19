import { Document, Model, Schema, model } from "mongoose";

export type UserRole = "victim" | "volunteer";

export interface UserDocument extends Document {
  name: string;
  phone: string;
  password: string;
  isValunteer: boolean;
  skills: string[];
  isAvailable: boolean;
  createdAt: Date;
}

const userSchema = new Schema<UserDocument>({
  name: { type: String, required: true, trim: true },
  phone: { type: String, required: true, unique: true, trim: true },
  password: { type: String, required: true },
  isValunteer: { type: Boolean, default:true, required: true },
  skills: { type: [String], default: [] },
  isAvailable: { type: Boolean, default: true },
  createdAt: { type: Date, default: Date.now }
});

const User: Model<UserDocument> = model<UserDocument>("User", userSchema);

export default User;
