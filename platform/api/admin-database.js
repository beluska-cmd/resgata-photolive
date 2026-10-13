import crypto from "node:crypto";
import { db } from "./database.js";

db.exec(`
  CREATE TABLE IF NOT EXISTS admins (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    email TEXT NOT NULL UNIQUE,
    password TEXT NOT NULL,
    role TEXT NOT NULL DEFAULT 'admin',
    status TEXT NOT NULL DEFAULT 'active',
    created_at TEXT NOT NULL
  );

  CREATE TABLE IF NOT EXISTS admin_sessions (
    token TEXT PRIMARY KEY,
    admin_id TEXT NOT NULL,
    created_at TEXT NOT NULL,
    expires_at TEXT,
    FOREIGN KEY (admin_id) REFERENCES admins(id)
  );
`);

const exists = db.prepare(
  "SELECT id FROM admins WHERE email = ?"
).get("admin@resgata.local");

if (!exists) {
  db.prepare(`
    INSERT INTO admins (
      id, name, email, password, role, status, created_at
    )
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `).run(
    crypto.randomUUID(),
    "Administrador Resgata+",
    "admin@resgata.local",
    "ResgataAdmin123",
    "superadmin",
    "active",
    Date.now().toString()
  );
}

console.log("ADMIN DATABASE OK");
