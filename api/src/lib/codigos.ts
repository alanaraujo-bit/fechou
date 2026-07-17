import { createHash, randomBytes, randomInt } from "node:crypto";

/** Código OTP de 6 dígitos (nunca começa com 0 pra evitar confusão ao digitar). */
export function gerarCodigoOtp(): string {
  return String(randomInt(100000, 1000000));
}

/** Token de refresh opaco — só o hash vai pro banco. */
export function gerarRefreshToken(): string {
  return randomBytes(32).toString("base64url");
}

export function hashSha256(valor: string): string {
  return createHash("sha256").update(valor).digest("hex");
}
