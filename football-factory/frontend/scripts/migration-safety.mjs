/**
 * Migration files run inside a transaction owned by migrate.mjs. Reject
 * transaction-control statements so schema changes and history tracking
 * commit or roll back together.
 */
export function hasTransactionControl(sql) {
  const uncommented = sql
    .replace(/\/\*[\s\S]*?\*\//g, "")
    .replace(/--[^\r\n]*/g, "");
  return /(?:^|;)\s*(?:BEGIN(?:\s+(?:WORK|TRANSACTION))?|START\s+TRANSACTION|COMMIT(?:\s+(?:WORK|TRANSACTION))?|END(?:\s+(?:WORK|TRANSACTION))?|ROLLBACK(?:\s+(?:WORK|TRANSACTION))?)\s*;/im.test(uncommented);
}
