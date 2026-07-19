import { Request, Response } from "express";

import User from "../models/user.model";

export async function getUserById(req: Request, res: Response): Promise<Response> {
  try {
    const user = await User.findById(req.params.id).select("-password");
    if (!user) return res.status(404).json({ error: "User not found" });
    return res.json(user);
  } catch {
    return res.status(400).json({ error: "Invalid user id" });
  }
}

export async function updateAvailability(req: Request, res: Response): Promise<Response> {
  try {
    const { isAvailable } = req.body;
    if (typeof isAvailable !== "boolean") return res.status(400).json({ error: "isAvailable must be a boolean" });

    const user = await User.findByIdAndUpdate(req.params.id, { isAvailable }, { new: true, runValidators: true })
      .select("-password");
    if (!user) return res.status(404).json({ error: "User not found" });
    return res.json(user);
  } catch {
    return res.status(400).json({ error: "Invalid user id" });
  }
}
