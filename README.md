# Claude Certification Prep Platform

Internal exam-prep platform for `@alignminds.com` / `@alignminds.in` staff studying
the CCAF (CCAR-F) and CCAP (CCAR-P) Claude certifications. Full spec:
[`claude-cert-platform-spec.md`](./claude-cert-platform-spec.md).

## SES status (spec Section 3)

Checked against the live `alrarea` AWS profile (region `us-east-1`):
production access is **enabled** (not sandboxed), IAM permits `ses:SendEmail`.

Sender identity `noreply@alignminds.com` was registered on 2026-07-26
(`aws sesv2 create-email-identity --email-identity noreply@alignminds.com
--profile alrarea`) and `SES_FROM_ADDRESS` is set to it — **but it is not yet
verified** (`VerifiedForSendingStatus: false`). Real OTP emails will fail to
send until someone with access to that inbox clicks the verification link AWS
sent. This was a deliberate placeholder per the project owner ("use that for
now, will change later") — re-run
`aws sesv2 get-email-identity --email-identity noreply@alignminds.com
--profile alrarea` to check status, and update `SES_FROM_ADDRESS` if the
sender address changes.

## Repo layout

```
amplify/                  Amplify Gen 2 backend: one Lambda (Hono), Function URL
  backend.ts
  functions/api/
    handler.ts             Hono app entry, mounts route modules
    resource.ts             defineFunction()
    routes/                 auth, profile, courses (exams/questions land in a later phase)
    lib/                     jwt, otp, password, email, crypto, rate limiting, auth middleware
apps/web/                  React + Vite SPA
packages/db/               Prisma schema, client, seed script, guide-migration script
packages/shared/           zod schemas + constants shared by web and the function
```

## Database

Runs on the shared `nasabdb` RDS Postgres instance (also hosts unrelated
`bookbed`/`nasab` projects) under a dedicated database (`claude_cert`) and a
scoped least-privilege role (`claude_cert_app`, owner of only that database —
never the shared instance's master credential). Credentials are in
`db-credentials.csv` at the repo root (gitignored, not committed).

## Roles (deviates from the spec's two-role model — see below)

Three tiers, not two:
- **user** — default, per spec.
- **admin** — curates content, views all users' progress/stats. Granted only
  by a super_admin (never self-service), per spec's original "no self-service
  admin signup" principle.
- **super_admin** — everything admin can do, plus can grant/revoke admin
  (never grant/revoke super_admin itself through the API) and view a user's
  current OTP code. Set directly via seed/DB only, same as admin. Added at the
  project owner's explicit request, after the original two-role spec was
  written — `tech@alignminds.com` is seeded as the first super_admin
  (`packages/db/prisma/seed.ts`).

## Deviations from the literal spec (documented, not silent)

- `mode`/`difficulty`/`status`/`source`/`review_status`/`feedback_mode`/`role` are
  Prisma **native enums**, not `text` + hand-written CHECK constraints — Prisma
  manages enum DDL natively; CHECK constraints aren't something `prisma migrate`
  generates on its own.
- IDs are UUIDs generated **app-side** by Prisma, not via a Postgres extension
  (`gen_random_uuid()`), to avoid requiring an extension on a shared instance.
- Added `users.deleted_at` — the spec requires soft-delete semantics for user
  deletion (Section 6 notes) but never defines the column.
- Added a `login_attempts` table — the spec requires rate-limited login (Section 12)
  but the Lambda is stateless across invocations with no cache/Redis in this stack,
  so persisted rate-limit state needs a table; none existed in the literal ERD.
- **OTP codes are encrypted (AES-256-GCM), not hashed** — the spec (Section 12)
  says "stored as a hash, never plaintext." This was changed at the project
  owner's explicit request so a super_admin can view a user's current OTP (e.g.
  to read it out to someone who didn't receive the email). For a 6-digit code
  this trades little real security versus a hash — the keyspace is small enough
  that neither form protects much beyond the strength of the encryption/pepper
  key itself. `OTP_HASH_PEPPER` is no longer used; OTP encryption reuses
  `APP_ENC_SECRET`.
- Three roles instead of two (see above).

## Verified so far / open risk

- **Full stack verified live** against the real database via
  `npm run dev:api` (`@hono/node-server`, not yet a real Lambda deploy):
  register → OTP encrypted+stored → super_admin reads the real OTP via
  `/admin/users/:id/otp` → verify with that code → real JWT issued with the
  correct `role` claim → login → `/profile` returns the right role →
  `/courses/ccaf/topics` and topic detail/progress-marking all work against
  the migrated guide content. Role separation confirmed live: an `admin` can
  list/view all users' stats but gets 403 on OTP-view and role-change;
  only `super_admin` can do those two things.
- Confirmed via `tsc --noEmit` that `amplify/`, `packages/db`, `packages/shared`,
  and `apps/web` all typecheck cleanly, and `apps/web` builds with `vite build`.
- Confirmed via a standalone `esbuild --bundle` dry run of `handler.ts` that the
  whole dependency graph resolves — **except** `@node-rs/argon2`, whose native
  `.node` binary esbuild cannot inline into a single bundle (`No loader is
  configured for ".node" files`). Amplify Gen 2's `FunctionBundlingOptions`
  (`amplify/functions/api/resource.ts`) currently only exposes a `minify` flag —
  no documented `external`/`nodeModules` escape hatch was found in the installed
  package's type definitions. **This needs to be resolved before the first real
  `ampx sandbox` deploy**, by one of:
  1. Just try `ampx sandbox` first — Gen 2's bundler may already special-case
     native addons (unverified either way without a real deploy).
  2. If it doesn't, use the function's `layers` option (per its doc comment,
     the layer key "externalizes the module dependency so it doesn't get
     bundled") to keep `@node-rs/argon2` out of the bundle.
  3. Only as a last resort, and with explicit sign-off (the spec specifies
     argon2id in Section 6/12), swap to Node's built-in `crypto.scrypt`.

## Known limitations (this phase)

- No server-side refresh-token revocation list — logout is client-side-only token
  discard. A leaked refresh token remains valid until natural expiry (14 days).
- Only `mode='normal'` course content is populated (migrated from the existing
  HTML guides). In-depth/concise variants are a later, one-time authoring step.
- Exam engine, question upload/AI-generation, and the admin review queue
  (spec Sections 10/11) are not built in this phase — schema supports them,
  routes/UI don't exist yet.

## Environment variables (Lambda)

Set via `ampx sandbox secret set <name>` (stored in SSM Parameter Store, Standard
tier — never Secrets Manager, never Advanced parameters, per spec Section 4b):

- `DATABASE_URL` — Postgres connection string, `sslmode=require`, low `connection_limit`
- `JWT_ACCESS_SECRET`, `JWT_REFRESH_SECRET`
- `APP_ENC_SECRET` — 32 bytes, base64-encoded (AES-256-GCM: Anthropic API keys and OTP codes)
- `SES_FROM_ADDRESS` — verified sender address (see SES status above)
- `FRONTEND_ORIGIN` — the deployed Amplify Hosting URL, for CORS

## Local development

```
npm install
cp packages/db/.env.example packages/db/.env   # fill in a real DATABASE_URL
npm run db:migrate
npm run db:seed              # certifications + tech@alignminds.com super_admin
npm run db:migrate-guides
```

Root `.env` (gitignored) needs `DATABASE_URL` plus `JWT_ACCESS_SECRET`,
`JWT_REFRESH_SECRET`, `APP_ENC_SECRET`, `FRONTEND_ORIGIN`, `SES_FROM_ADDRESS` —
these are separate from `packages/db/.env`, which only needs `DATABASE_URL` for
Prisma CLI commands.

```
npm run dev:api    # runs the Hono app locally via @hono/node-server, http://localhost:8787
npm run dev:web    # frontend, http://localhost:5173
npx ampx sandbox    # deploy the Lambda + Function URL to a personal sandbox stack
```

`dev:api` is the fast local loop for iterating on routes — no redeploy needed
per change, unlike `ampx sandbox`.
