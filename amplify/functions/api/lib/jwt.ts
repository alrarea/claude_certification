import { SignJWT, jwtVerify } from "jose";
import { ACCESS_TOKEN_TTL_MINUTES, REFRESH_TOKEN_TTL_DAYS } from "@claude-cert/shared";

export type UserRole = "user" | "admin" | "super_admin";

export interface AccessTokenClaims {
  sub: string; // user id
  email: string;
  role: UserRole;
}

export interface RefreshTokenClaims {
  sub: string;
}

function secret(name: string): Uint8Array {
  const value = process.env[name];
  if (!value) throw new Error(`${name} is not set`);
  return new TextEncoder().encode(value);
}

export async function signAccessToken(claims: AccessTokenClaims): Promise<string> {
  return new SignJWT({ email: claims.email, role: claims.role })
    .setProtectedHeader({ alg: "HS256" })
    .setSubject(claims.sub)
    .setIssuedAt()
    .setExpirationTime(`${ACCESS_TOKEN_TTL_MINUTES}m`)
    .sign(secret("JWT_ACCESS_SECRET"));
}

export async function signRefreshToken(claims: RefreshTokenClaims): Promise<string> {
  return new SignJWT({})
    .setProtectedHeader({ alg: "HS256" })
    .setSubject(claims.sub)
    .setIssuedAt()
    .setExpirationTime(`${REFRESH_TOKEN_TTL_DAYS}d`)
    .sign(secret("JWT_REFRESH_SECRET"));
}

export async function verifyAccessToken(token: string): Promise<AccessTokenClaims> {
  const { payload } = await jwtVerify(token, secret("JWT_ACCESS_SECRET"));
  return {
    sub: payload.sub as string,
    email: payload.email as string,
    role: (payload.role as UserRole) ?? "user",
  };
}

export async function verifyRefreshToken(token: string): Promise<RefreshTokenClaims> {
  const { payload } = await jwtVerify(token, secret("JWT_REFRESH_SECRET"));
  return { sub: payload.sub as string };
}
