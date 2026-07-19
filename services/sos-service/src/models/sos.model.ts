import { Document, Model, Schema, model } from "mongoose";

export type SosSeverity = "pending" | "high" | "medium" | "low";
export type SosStatus = "open" | "matched" | "accepted" | "resolved" | "cancelled" | "volunteer_not_found";

export interface SosDocument extends Document {
  victimId: string;
  lat: number;
  lng: number;
  description: string;
  severity: SosSeverity;
  category: string;
  status: SosStatus;
  matchedVolunteers: string[];
  acceptedBy: string | null;
  createdAt: Date;
}

const sosSchema = new Schema<SosDocument>({
  victimId: { type: String, required: true },
  lat: { type: Number, required: true },
  lng: { type: Number, required: true },
  description: { type: String, required: true, trim: true },
  severity: { type: String, enum: ["pending", "high", "medium", "low"], default: "pending" },
  category: { type: String, default: "other" },
  status: { type: String, enum: ["open", "matched", "accepted", "resolved", "cancelled", "volunteer_not_found"], default: "open" },
  matchedVolunteers: { type: [String], default: [] },
  acceptedBy: { type: String, default: null },
  createdAt: { type: Date, default: Date.now }
});

const Sos: Model<SosDocument> = model<SosDocument>("Sos", sosSchema);

export default Sos;
