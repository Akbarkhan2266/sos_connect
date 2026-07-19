import bcrypt from "bcryptjs";
import { Request, Response } from "express";

import User, { UserRole } from "../models/user.model";
import { AUTH_COOKIE_NAME, authCookieOptions, createAccessToken } from "../utils/token";

const isUserRole = (value: unknown): value is UserRole => value === "victim" || value === "volunteer";

function sendAuthenticatedUser(res: Response, user: InstanceType<typeof User>, status = 200): Response {
  const token = createAccessToken({ userId: user.id, isValunteer: user.isValunteer });
  res.cookie(AUTH_COOKIE_NAME, token, authCookieOptions);
  return res.status(status).json({ userId: user.id, name: user.name, isValunteer: user.isValunteer });
}

export async function signup(req: Request, res: Response): Promise<Response> {
  try {
    const { name, phone, password, skills } = req.body;
    if (!name || !phone || !password) {
      return res.status(400).json({ error: "name, phone, password, and a valid role are required" });
    }

    const user = await User.create({
      name,
      phone,
      password: await bcrypt.hash(password, 10),
      skills:  (skills ?? [])
    });
    return sendAuthenticatedUser(res, user, 201);
  } catch (error) {
    if ((error as { code?: number }).code === 11000) {
      return res.status(409).json({ error: "Phone already registered" });
    }
    return res.status(500).json({ error: "Unable to create user" });
  }
}

export async function login(req: Request, res: Response): Promise<Response> {
  try {
    const { phone, password } = req.body;
    if (!phone || !password) return res.status(400).json({ error: "phone and password are required" });

    const user = await User.findOne({ phone });
    if (!user) return res.status(404).json({ error: "User not found" });
    if (!(await bcrypt.compare(password, user.password))) {
      return res.status(401).json({ error: "Wrong password" });
    }
    return sendAuthenticatedUser(res, user);
  } catch {
    return res.status(500).json({ error: "Unable to log in" });
  }
}

export function logout(_req: Request, res: Response): Response {
  res.clearCookie(AUTH_COOKIE_NAME, { httpOnly: true, sameSite: "lax", secure: process.env.NODE_ENV === "production" });
  return res.json({ message: "Logged out" });
}

export async function me(req: Request, res: Response): Promise<Response> {
  const user = await User.findById(req.auth!.userId).select("-password");
  if (!user) return res.status(404).json({ error: "User not found" });
  return res.json(user);
}
