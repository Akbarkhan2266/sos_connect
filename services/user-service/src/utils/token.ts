import { CookieOptions } from "express";
import jwt from "jsonwebtoken";

import { UserRole } from "../models/user.model";

export const AUTH_COOKIE_NAME = "access_token";
const tokenLifetimeMs = 7 * 24 * 60 * 60 * 1000;

export interface AuthPayload {
  userId: string;
  isValunteer: boolean;
}

function getJwtSecret(): string {
  const secret = process.env.JWT_SECRET;
  if (!secret) throw new Error("JWT_SECRET must be configured");
  return secret;
}

export function createAccessToken(payload: AuthPayload): string {
  return jwt.sign(payload, getJwtSecret(), { expiresIn: "7d" });
}

export function verifyAccessToken(token: string): AuthPayload {
  return jwt.verify(token, getJwtSecret()) as AuthPayload;
}

export const authCookieOptions: CookieOptions = {
  httpOnly: true,
  secure: process.env.NODE_ENV === "production",
  sameSite: "lax",
  maxAge: tokenLifetimeMs
};
