import crypto from "node:crypto";
import { db } from "./database.js";

function hashPassword(password) {
  const salt = crypto.randomBytes(16).toString("hex");
  const hash = crypto.scryptSync(password, salt, 64).toString("hex");
  return `${salt}:${hash}`;
}

function verifyPassword(password, stored) {
  const [salt, originalHash] = String(stored || "").split(":");
  if (!salt || !originalHash) return false;

  const hash = crypto.scryptSync(password, salt, 64).toString("hex");

  return crypto.timingSafeEqual(
    Buffer.from(hash, "hex"),
    Buffer.from(originalHash, "hex")
  );
}

function createAdminPasswordHash() {
  const admin = db.prepare(`
    SELECT id, password
    FROM admins
    WHERE email = ?
  `).get("admin@resgata.local");

  if (!admin) {
    throw new Error("Administrador não encontrado.");
  }

  if (String(admin.password).includes(":")) {
    return false;
  }

  const hashed = hashPassword(admin.password);

  db.prepare(`
    UPDATE admins
    SET password = ?
    WHERE id = ?
  `).run(hashed, admin.id);

  return true;
}

const migrated = createAdminPasswordHash();

console.log(
  migrated
    ? "SENHA ADMIN PROTEGIDA COM SCRYPT"
    : "SENHA ADMIN JA ESTAVA PROTEGIDA"
);

export { hashPassword, verifyPassword };
