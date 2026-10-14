import test from "node:test";
import assert from "node:assert/strict";
import { buildPostgresTlsConfig } from "../postgres-tls";

const url = "postgresql://user:password@db.example.test:5432/football_factory?sslmode=require&application_name=ff90";

test("PostgreSQL TLS defaults to certificate verification", () => {
  const config = buildPostgresTlsConfig({ connectionString: url, nodeEnv: "production" });
  assert.deepEqual(config.ssl, { rejectUnauthorized: true });
  assert.equal(new URL(config.connectionString).searchParams.has("sslmode"), false);
  assert.equal(new URL(config.connectionString).searchParams.get("application_name"), "ff90");
});

test("production refuses disabled TLS regardless of configuration source", () => {
  assert.throws(
    () => buildPostgresTlsConfig({ connectionString: url.replace("require", "disable"), nodeEnv: "production" }),
    /TLS required/,
  );
  assert.throws(
    () => buildPostgresTlsConfig({ connectionString: url, nodeEnv: "production", sslMode: "disable" }),
    /TLS required/,
  );
});

test("explicit local TLS disable is allowed only outside production", () => {
  const config = buildPostgresTlsConfig({
    connectionString: "postgres://user:password@127.0.0.1:5432/football_factory",
    nodeEnv: "development",
    sslMode: "disable",
  });
  assert.equal(config.ssl, false);
  assert.throws(
    () => buildPostgresTlsConfig({ connectionString: url, nodeEnv: "development", sslMode: "disable" }),
    /loopback databases/,
  );
});

test("explicit TLS environment mode overrides URL mode; unsupported modes fail closed", () => {
  const envMode = buildPostgresTlsConfig({
    connectionString: url,
    nodeEnv: "production",
    sslMode: "verify-full",
  });
  assert.deepEqual(envMode.ssl, { rejectUnauthorized: true });
  assert.throws(
    () => buildPostgresTlsConfig({ connectionString: url.replace("require", "no-verify"), nodeEnv: "production" }),
    /mode invalid/,
  );
});

test("custom CA is passed explicitly and certificate query paths are not silently ignored", () => {
  const config = buildPostgresTlsConfig({
    connectionString: url,
    nodeEnv: "production",
    caCertificate: "-----BEGIN CERTIFICATE-----\nfixture\n-----END CERTIFICATE-----",
  });
  assert.deepEqual(config.ssl, {
    rejectUnauthorized: true,
    ca: "-----BEGIN CERTIFICATE-----\nfixture\n-----END CERTIFICATE-----",
  });
  assert.throws(
    () => buildPostgresTlsConfig({
      connectionString: `${url}&sslrootcert=/private/ca.pem`,
      nodeEnv: "production",
    }),
    /PGSSL_CA_CERT/,
  );
});
