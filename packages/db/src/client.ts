import "dotenv/config";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "@prisma/client";

declare global {
  // eslint-disable-next-line no-var
  var __prisma: PrismaClient | undefined;
}

const DEFAULT_MAX_CONNECTIONS = 2;

function createClient(): PrismaClient {
  const rawUrl = process.env.DATABASE_URL;
  if (!rawUrl) throw new Error("DATABASE_URL is not set");

  // `sslmode`/`connection_limit` are libpq/Prisma-native-engine query-string
  // params - the `pg` driver (used by the adapter below) doesn't understand
  // either one:
  //  - `connection_limit` is silently ignored; pool size is configured via
  //    PoolConfig's `max` instead.
  //  - `sslmode` is *not* ignored - node-postgres now treats "require" as an
  //    alias for "verify-full" (full CA chain validation), which fails
  //    against RDS's cert chain since it isn't in Node's default trust
  //    store. TLS is configured explicitly via the `ssl` option instead,
  //    which still encrypts the connection, just without chain
  //    verification - consistent with the spec's own stated model
  //    (Section 4: "connection security has to come from strong
  //    credentials + enforced SSL/TLS ... not network-level IP
  //    restriction" - it doesn't call for full CA verification
  //    specifically).
  const url = new URL(rawUrl);
  url.searchParams.delete("sslmode");
  url.searchParams.delete("connection_limit");

  // Driver adapter (pg) + WASM query compiler, not the native Rust query
  // engine binary - see schema.prisma's generator comment for why.
  //
  // The extra pool options below are defensive hardening for Lambda: a
  // pooled connection can go stale during the "frozen" gap between
  // invocations (Lambda suspends the whole container, including any TCP
  // keepalive timers, so staleness can't be caught *during* the freeze -
  // but keepAlive still helps the OS notice a truly dead socket faster on
  // the very next probe instead of hanging on write). connectionTimeoutMillis
  // bounds how long establishing a *new* connection can take, so a network
  // hiccup fails fast with a clear error rather than silently eating the
  // Lambda's own timeout budget. idleTimeoutMillis is set explicitly
  // (matching pg's own default) so a connection that's sat idle across a
  // gap gets proactively recycled rather than reused unchecked.
  const adapter = new PrismaPg({
    connectionString: url.toString(),
    ssl: { rejectUnauthorized: false },
    max: DEFAULT_MAX_CONNECTIONS,
    keepAlive: true,
    keepAliveInitialDelayMillis: 10_000,
    connectionTimeoutMillis: 10_000,
    idleTimeoutMillis: 10_000,
  });
  return new PrismaClient({ adapter });
}

// Reused across warm Lambda invocations.
export const prisma = global.__prisma ?? createClient();

if (process.env.NODE_ENV !== "production") {
  global.__prisma = prisma;
}

export * from "@prisma/client";
