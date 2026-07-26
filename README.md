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
amplify/                  Amplify Gen 2 backend: one Lambda (Hono), Function URL, S3 bucket
  backend.ts
  functions/api/
    handler.ts             Hono app entry, mounts route modules
    resource.ts             defineFunction()
    routes/                 auth, profile, courses, admin, exams, questions
    lib/                     jwt, otp, password, email, crypto, rate limiting, auth middleware,
                             s3, extractDocumentText, anthropicGenerate, optionBalance
apps/web/                  React + Vite SPA
packages/db/               Prisma schema, client, seed scripts, guide-migration script
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

## Deployed

Live sandbox deploy (`ampx sandbox --once --profile alrarea`), stack
`amplify-claudecertification-User-sandbox-5254175739`:

```
API (Lambda Function URL): https://22wqfi355dgznjqh5yzoofy72u0yizrc.lambda-url.us-east-1.on.aws/
```

Verified live against this exact deployed Lambda (not just local dev): login as
`tech@alignminds.com` returns a real JWT with the correct `role` claim,
`/profile`, `/admin/users`, and `/courses/ccaf/topics` all respond correctly,
and `/auth/register` fails cleanly with a 502 (SES sender not yet verified —
expected, see SES status above) rather than crashing.

There's no frontend hosting yet — `ampx sandbox` only deploys the backend
Lambda. `apps/web`'s Amplify Hosting deployment (git-connected CI/CD per spec
Section 4) is a separate, not-yet-done step, and needs `FRONTEND_ORIGIN` set to
its real URL afterward (for CORS) before the two can talk to each other.

To redeploy after a code change: `npm run db:generate`
(see below - **do not skip this**, plain `prisma generate` isn't enough) then
`npx ampx sandbox --once --profile alrarea`.

## Two real serverless-bundling bugs found and fixed during deploy

Both were only reachable by actually deploying, not by local dev or `tsc`/`vite
build` - Amplify Gen 2's Lambda bundler (esbuild, no exposed config for
external modules or copying non-JS asset files - `resource.ts`'s
`FunctionBundlingOptions` only has `minify`) silently produces a Lambda that
crashes at runtime instead of erroring at build time.

1. **`@node-rs/argon2`'s native binary.** `npm install` on this Windows dev
   machine only fetches the Windows `.node` binary; the deployed Lambda (Amazon
   Linux) crashed with `Failed to load native binding`. Fixed by switching
   `lib/password.ts` to **`hash-wasm`**'s argon2id (pure WebAssembly, same
   algorithm, no per-OS binary to get wrong - see the comment in that file).

2. **Prisma's native query engine.** Same root cause, one layer down:
   `@prisma/client`'s default "library" engine is also a native `.node`
   binary, and even after fixing that (`binaryTargets = ["native",
   "rhel-openssl-3.0.x"]`), the correct engine file still wasn't being copied
   next to the bundle at deploy time (`ENOENT`). Fixed with two changes,
   **both required**:
   - `schema.prisma`'s generator: `engineType = "client"` + the `@prisma/adapter-pg`
     driver adapter (`src/client.ts`) - this switches to Prisma's WASM query
     compiler instead of a native engine binary at all.
   - The WASM compiler still loads its `.wasm` file from disk at runtime by
     default, which hits the exact same "bundler doesn't copy extra files"
     problem. `packages/db/scripts/patch-prisma-wasm.js` patches the generated
     client to inline the wasm bytes as a base64 string directly in the JS
     instead, so there's no separate file to lose - **must run after every
     `prisma generate`**, which is why `npm run generate` (not the bare
     `prisma generate` CLI command) is now the documented command everywhere.
     Read that script's top comment before touching it; it's inherently a bit
     fragile (depends on the exact shape of Prisma's generated code) and will
     need updating if a future Prisma version changes that shape.

   A third, smaller issue surfaced alongside this: the `pg` driver (used by
   the adapter) treats `sslmode=require` as an alias for `verify-full` (full
   CA chain validation), which fails against RDS's cert chain. `src/client.ts`
   strips `sslmode`/`connection_limit` from `DATABASE_URL` and configures TLS
   (`ssl: { rejectUnauthorized: false }`) and pool size (`max: 2`) explicitly
   instead - still encrypted, just without chain verification, consistent
   with the spec's own stated security model (Section 4).

Both fixes were verified with a real `ampx sandbox` deploy + live HTTP
requests against the deployed Function URL, not just locally.

## Exam engine + question bank (spec Sections 10/11)

All built: exam setup/take/results (`/exam/new`, `/exam/:id`, `/exam/:id/results`),
manual question authoring, document upload (PDF/DOCX/HTML → S3 → text extraction
→ AI-generated candidate questions if the uploader has a saved key), on-demand
AI generation, and the admin review queue (`/questions/manage`,
`/questions/manage/review`).

- **Question visibility**: a user's own `pending` (AI-generated/uploaded)
  questions are usable in their own exams immediately; everyone else only
  sees `approved` ones — per spec Section 11's explicit scoping.
- **Option-length balance** (spec Section 10, "options within ~40% of each
  other"): checked on manual entry (returned in the response, not enforced -
  spec says "warn," not block) and enforced with a one-shot AI rewrite pass
  for generated questions (`lib/optionBalance.ts`, `lib/anthropicGenerate.ts`).
- **Upload size capped at 4MB** (`MAX_UPLOAD_SIZE_BYTES`) - uploads go through
  the Function URL as base64 JSON, not multipart/presigned-S3, and Lambda
  Function URLs cap synchronous request bodies at 6MB; base64 inflates size
  ~33%, so 4MB raw leaves headroom for the JSON wrapper.
- **PDF/DOCX/HTML text extraction** uses `pdf-parse` (wraps `pdfjs-dist`,
  pure JS) and `mammoth` (pure JS) - deliberately avoided anything with a
  native binary, given the argon2/Prisma bundling bugs above.
- Verified live end-to-end against the deployed Lambda: created an exam,
  answered questions under both `immediate` (feedback revealed per-question)
  and `end_of_set` (correctness withheld until `/complete`) modes, viewed the
  score/topic/difficulty breakdown, manually authored a question (auto-approved),
  confirmed `/questions/generate` fails cleanly without a saved API key.
  **Not** live-tested: an actual AI generation/upload call with a real
  Anthropic key (same caveat as the profile API-key path).
- A handful of manual sample questions are seeded
  (`packages/db/scripts/seed-sample-questions.ts`) against one CCAF topic, so
  the exam engine has something to serve out of the box - real content growth
  is expected via the manual/upload/generate routes from here.

## Known limitations (this phase)

- No server-side refresh-token revocation list — logout is client-side-only token
  discard. A leaked refresh token remains valid until natural expiry (14 days).
- Only `mode='normal'` course content is populated (migrated from the existing
  HTML guides). In-depth/concise variants are a later, one-time authoring step.
- Admin question review is approve/reject only - no inline edit before
  approving (spec mentions "approve/reject/edit inline" as a nice-to-have on
  the review screen; edit isn't built).
- Document uploads without a saved Anthropic key are stored in S3 but nothing
  surfaces their extracted text to an admin yet for manual course-content
  pull-in (spec allows this as a manual step; no UI for it in this phase).

## Environment variables (Lambda)

Set via `ampx sandbox secret set <name>` (stored in SSM Parameter Store, Standard
tier — never Secrets Manager, never Advanced parameters, per spec Section 4b):

- `DATABASE_URL` — plain Postgres connection string, no query params needed
  (TLS/pool size are configured in code - see `src/client.ts`)
- `JWT_ACCESS_SECRET`, `JWT_REFRESH_SECRET`
- `APP_ENC_SECRET` — 32 bytes, base64-encoded (AES-256-GCM: Anthropic API keys and OTP codes)
- `SES_FROM_ADDRESS` — verified sender address (see SES status above)
- `FRONTEND_ORIGIN` — the deployed Amplify Hosting URL, for CORS

`UPLOADS_BUCKET_NAME` is set automatically by CDK (`backend.ts`), not a secret -
no manual action needed for it.

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
npm run db:generate                        # after any schema.prisma change - required, see below
npx ampx sandbox --once --profile alrarea  # deploy the Lambda + Function URL
```

`dev:api` is the fast local loop for iterating on routes — no redeploy needed
per change, unlike `ampx sandbox`.

**`npm run generate` (not the bare `prisma generate` CLI command) everywhere** -
it chains a required post-processing patch, see "Two real serverless-bundling
bugs" below. Using the bare CLI command will silently produce a client that
works locally but crashes once deployed.

Migrations run via `migrate deploy` (`npm run db:migrate`), not `migrate dev` -
the app's DB role intentionally has no `CREATEDB` grant (least privilege on a
shared instance), which `migrate dev`'s shadow database needs. When the schema
changes, generate the SQL offline first
(`npx prisma migrate diff --from-migrations ./prisma/migrations --to-schema-datamodel prisma/schema.prisma --script > prisma/migrations/<timestamp>_<name>/migration.sql`,
plus a same-shaped folder + `migration_lock.toml`), review it, then `migrate deploy`.
