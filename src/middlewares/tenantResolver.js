import { getPrisma } from "../db/prisma.js";

export const tenantResolver = async (req, res, next) => {
  try {
    const tenantSlug =
      req.headers["x-tenant"] || req.headers["x-tenant-slug"];

    if (!tenantSlug || typeof tenantSlug !== "string") {
      return res.status(400).json({
        error: "Falta el header x-tenant (slug de la empresa).",
      });
    }

    const prisma = getPrisma("public");
    const tenant = await prisma.tenant.findUnique({
      where: { slug: tenantSlug },
    });

    if (!tenant || tenant.isActive === false) {
      return res.status(404).json({
        error: "Tenant no encontrado o inactivo.",
      });
    }

    req.tenant = tenant;
    req.tenantSchema = tenant.schemaName;
    return next();
  } catch (err) {
    return next(err);
  }
};
