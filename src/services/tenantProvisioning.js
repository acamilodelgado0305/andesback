import pool from "../database.js";
import { getPrisma } from "../db/prisma.js";

const sanitizeSlug = (slug) =>
  slug
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9-]/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "");

export const provisionTenant = async ({ slug, name }) => {
  if (!slug || !name) {
    throw new Error("slug y name son requeridos.");
  }

  const safeSlug = sanitizeSlug(slug);
  const schemaName = `tenant_${safeSlug}`;

  await pool.query(`CREATE SCHEMA IF NOT EXISTS "${schemaName}"`);

  const prisma = getPrisma("public");
  const tenant = await prisma.tenant.upsert({
    where: { slug: safeSlug },
    update: { name, schemaName, isActive: true },
    create: { slug: safeSlug, name, schemaName },
  });

  return tenant;
};
