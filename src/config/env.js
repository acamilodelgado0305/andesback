import dotenv from "dotenv";

dotenv.config();

const {
  DATABASE_URL,
  PGUSER,
  PGPASSWORD,
  PGHOST,
  PGDATABASE,
  PGPORT,
  PGSSLMODE,
} = process.env;

if (!DATABASE_URL && PGUSER && PGPASSWORD && PGHOST && PGDATABASE) {
  const port = PGPORT || "5432";
  const user = encodeURIComponent(PGUSER);
  const password = encodeURIComponent(PGPASSWORD);
  const host = PGHOST;
  const db = PGDATABASE;
  const sslMode = PGSSLMODE ? `&sslmode=${encodeURIComponent(PGSSLMODE)}` : "";
  process.env.DATABASE_URL = `postgresql://${user}:${password}@${host}:${port}/${db}?schema=public${sslMode}`;
}
