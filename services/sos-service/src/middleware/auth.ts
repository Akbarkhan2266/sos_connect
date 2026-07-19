import { NextFunction, Request, Response } from "express";
import jwt from "jsonwebtoken";

declare global {
  namespace Express {
    interface Request {
      userId?: string;
    }
  }
}

interface DecodedToken extends jwt.JwtPayload {
  userId: string;
}

export function authMiddleware(req: Request, res: Response, next: NextFunction): void {
  const authorization = req.headers.authorization;
  const tokenFromHeader = authorization?.startsWith("Bearer ") ? authorization.slice(7) : undefined;
  const tokenFromCookie = req.cookies?.access_token;

  const token = tokenFromHeader ?? tokenFromCookie;

  if (!token) {
    res.status(401).json({ error: "No token" });
    return;
  }

  try {
    const secret = process.env.JWT_SECRET;
    if (!secret) throw new Error("JWT_SECRET is not configured");
    const decoded = jwt.verify(token, secret) as DecodedToken;
    if (!decoded.userId) throw new Error("Token is missing userId");
    req.userId = decoded.userId;
    next();
  } catch {
    res.status(401).json({ error: "Invalid token" });
  }
}
