/** PostgreSQL TLS configuration with certificate validation enabled. */

export type PostgresSslMode = "disable" | "require" | "verify-ca" | "verify-full";
export type PostgresTlsConfig = false | { rejectUnauthorized: true; ca?: string };

const SUPPORTED_MODES = new Set<PostgresSslMode>([
  "disable",
  "require",
  "verify-ca",
  "verify-full",
]);

/**
 * Removes libpq SSL query parameters so node-postgres cannot replace the
 * explicit TLS object with a driver-parsed, weaker configuration.
 */
export function buildPostgresTlsConfig(options: {
  connectionString: string;
  nodeEnv?: string;
  sslMode?: string;
  caCertificate?: string;
}): { connectionString: string; ssl: PostgresTlsConfig } {
  let url: URL;
  try {
    url = new URL(options.connectionString);
  } catch {
    throw new Error("DATABASE_URL invalid");
  }
  if (url.protocol !== "postgres:" && url.protocol !== "postgresql:") {
    throw new Error("DATABASE_URL invalid");
  }

  const urlMode = url.searchParams.get("sslmode") ?? undefined;
  const envMode = options.sslMode || undefined;
  if (urlMode && !SUPPORTED_MODES.has(urlMode as PostgresSslMode)) {
    throw new Error("PostgreSQL SSL mode invalid");
  }
  if (envMode && !SUPPORTED_MODES.has(envMode as PostgresSslMode)) {
    throw new Error("PGSSLMODE invalid");
  }
  // Explicit server configuration wins over a URL's sslmode query option.
  // In all cases the URL option is removed before node-postgres sees it.
  const mode = (envMode ?? urlMode ?? "verify-full") as PostgresSslMode;
  const production = options.nodeEnv === "production";
  const tlsDisabled = mode === "disable";
  if (tlsDisabled) {
    const loopbackHosts = new Set(["localhost", "127.0.0.1", "[::1]", "::1"]);
    if (production || !loopbackHosts.has(url.hostname)) {
      throw new Error("PostgreSQL TLS required except for non-production loopback databases");
    }
  }

  const certParams = ["sslrootcert", "sslcert", "sslkey"];
  if (url.searchParams.has("sslcert") || url.searchParams.has("sslkey")) {
    throw new Error("Client-certificate PostgreSQL authentication is unsupported");
  }
  const hasUrlCertificate = certParams.some((name) => url.searchParams.has(name));
  if (hasUrlCertificate && !options.caCertificate) {
    throw new Error("Use PGSSL_CA_CERT for custom PostgreSQL trust roots");
  }

  for (const name of ["sslmode", ...certParams, "sslpassword"]) {
    url.searchParams.delete(name);
  }

  return {
    connectionString: url.toString(),
    ssl: tlsDisabled ? false : {
      rejectUnauthorized: true,
      ...(options.caCertificate ? { ca: options.caCertificate } : {}),
    },
  };
}
