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

**Production (real git-based CI/CD, per spec Section 4)** — Amplify app
`d3pa26vi81zujd`, connected to this repo's `main` branch. Every push to `main`
now automatically deploys *both* the backend (`ampx pipeline-deploy`, run by
Amplify's build service) and the frontend (Vite build), per `amplify.yml`:

```
Frontend (Amplify Hosting): https://main.d3pa26vi81zujd.amplifyapp.com/
API (Lambda Function URL):  https://nc74e5qqb3fl5khw7uvw272e240zwtoy.lambda-url.us-east-1.on.aws/
```

Verified live end-to-end against this exact production deployment (not just
local dev, not just the personal sandbox below): CORS preflight from the real
frontend origin succeeds, login/`profile`/`admin/users`/`courses` all respond
correctly through the actual Function URL the frontend's own built JS bundle
calls.

**Personal sandbox** (`ampx sandbox`, for fast local iteration before pushing)
is a separate stack, `amplify-claudecertification-User-sandbox-5254175739`,
Function URL `https://22wqfi355dgznjqh5yzoofy72u0yizrc.lambda-url.us-east-1.on.aws/`.
Deploy it with `npm run db:generate` (see below - do not skip) then
`npx ampx sandbox --once --profile alrarea`. It has its own copy of every
secret (`/amplify/claudecertification/User-sandbox-<hash>/...` in SSM) and its
own S3 bucket - changes here never touch production until you push.

### Setting up the production app (one-time, already done - notes for reference)

- `aws amplify create-app --repository ... --access-token $(gh auth token) --platform WEB` -
  connects the repo; a GitHub PAT avoids the interactive "authorize the Amplify
  GitHub App" console click.
- An **IAM service role** (trust policy: `amplify.amazonaws.com`) must be
  attached via `--iam-service-role-arn` - without it, `ampx pipeline-deploy`
  fails with `BootstrapDetectionError` (Amplify's build service runs in an
  AWS-managed account and needs a role in *this* account to deploy the CDK
  stack). Attached `AdministratorAccess` here, matching what this account's CDK
  bootstrap already grants its own `CloudFormationExecutionRole` - not a new
  escalation pattern, just extending the same one to Amplify's build service.
- **Secrets use a different SSM path than the sandbox**: not
  `/amplify/<appId>/<branch>/...` as the sandbox's own
  `/amplify/<appName>/<identifier>-sandbox-<hash>/...` pattern might suggest,
  but `/amplify/shared/<appId>/<NAME>` (or the exact per-environment path
  `/amplify/<appId>/<branch>-branch-<hash>/<NAME>` - the shared path is simpler
  since it doesn't depend on a generated hash and works for any branch).
  Check `aws lambda get-function-configuration`'s `AMPLIFY_SSM_ENV_CONFIG` env
  var on a deployed function to see exactly which paths it's trying.
- `FRONTEND_ORIGIN` was set as an app-level env var (not a secret) *before* the
  first deploy, to Amplify's own predictable
  `https://<branch>.<appId>.amplifyapp.com` domain - known immediately after
  `create-app`, unlike the backend's Function URL (random, only known after
  that phase's own deploy completes each time).

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

## Getting the CI/CD pipeline itself working (five more real bugs)

None of these were reachable via `ampx sandbox` (run from a developer machine
with an already-built `node_modules`) - only a real `git push` through
Amplify's actual build service surfaced them, one at a time, each fixed and
re-pushed:

1. **Monorepo build spec format.** Setting `AMPLIFY_MONOREPO_APP_ROOT` makes
   Amplify expect its own multi-app `applications: [...]` YAML shape, which
   conflicts with a single custom `backend:`/`frontend:` `amplify.yml`. Fix:
   dropped that env var - the custom build spec already handles workspace
   targeting directly (`npm run build --workspace=apps/web`).
2. **`npm ci` vs `npm install`.** A peer-dependency override inside the AWS
   Amplify construct libraries themselves (a `zod` version conflict between
   `@aws-amplify/backend-output-schemas` and this project's own `zod`) leaves
   `package-lock.json` in a shape `npm ci`'s strict sync check rejects -
   reproducible with a clean local `npm install` too, so it's a real npm/dependency-graph
   quirk, not a CI-only artifact. `npm install` (less strict) just works.
3. **Extensionless relative imports.** `ampx sandbox` tolerates
   `from "./resource"`; `ampx pipeline-deploy`'s loader does exact-match module
   resolution and doesn't try `.js` either (that's the usual TS-ESM convention
   for *compiled* output, and doesn't apply here since nothing compiles these
   files first) - only the literal `.ts` extension resolves. Required
   `allowImportingTsExtensions` + `noEmit` in `tsconfig.json` to let `tsc`
   accept that syntax.
4. **Missing IAM service role.** Covered above under "Setting up the
   production app" - `BootstrapDetectionError` without it.
5. **Prisma client never generated in CI.** A fresh `npm install` doesn't run
   `prisma generate` (nothing here relies on a postinstall hook for it), and
   even if it did, the WASM patch still needs to run explicitly - added both
   as explicit `amplify.yml` build commands rather than assuming either
   happens implicitly.

Debugging method throughout: `aws amplify get-job` for step-level status,
pulling the pre-signed S3 log URL for the failing step's actual output
(`BUILD`/`DEPLOY`/`VERIFY`), fixing exactly what that log said, redeploying,
repeating - not guessing.

## Bugs only a real browser caught (four more, none visible to tsc/vite build)

A green pipeline deploy is not the same as a working app. These four only
surfaced by actually loading the deployed site in a browser (Playwright -
the Claude-in-Chrome extension wasn't connecting in this environment) and
driving the real login/register forms - `curl`, `tsc`, and `vite build`
all stayed green through every one of them:

1. **Blank white page on every route.** Two different copies of React ended
   up in the same bundle - `apps/web`'s own `react-router-dom`/`react-markdown`
   resolved to a stray `react@18.3.1` (pulled in transitively by
   `@aws-amplify/backend-cli`'s unrelated internal codegen tooling, hoisted to
   the workspace root) instead of the app's own `react@19.2.8`. Calling a hook
   from one React instance while the other's internal dispatcher is active
   throws `Cannot read properties of null (reading 'useRef')`, crashing the
   entire render with nothing on screen and no error surfaced anywhere but the
   browser console. Fixed with an npm `"overrides"` in the root `package.json`
   pinning `react`/`react-dom` to one version workspace-wide. Confirm with
   `npm ls react --all` - every entry should say `deduped`, none should show a
   different resolved version.
2. **Every cross-origin request failed as a CORS error**, silently (no thrown
   exception, so page 1's fix alone made the app *look* fine - it rendered,
   just every login/register attempt did nothing). Both Hono's own `cors()`
   middleware (`handler.ts`) and the Lambda Function URL's native CORS config
   (`backend.ts`) were setting `Access-Control-Allow-Origin` on the same
   response - two values on one header is invalid per the Fetch spec, and
   browsers reject the response outright rather than picking one. Fixed by
   removing the Hono middleware entirely and relying only on the Function
   URL's native config (per spec Section 4b's own guidance to configure CORS
   there, not both places).
3. **Double-slash request URLs.** The Function URL that CDK gives back always
   ends in `/`; that value becomes `VITE_API_URL` at build time
   (`amplify.yml`), and every request path in `api.ts` also starts with `/`,
   producing `.../auth//login`. `api.ts` now strips trailing slashes from
   `API_URL` defensively rather than relying on the source always being clean.
4. **Direct navigation to any route but `/` returned 404** (e.g.
   `/register`, `/login`) - client-side `<Link>`/`navigate()` clicks worked
   fine since the JS was already loaded, which is exactly why this stayed
   hidden through every prior test that started from `/`. Amplify Hosting (S3
   + CloudFront under the hood) has no built-in SPA fallback; without an
   explicit rewrite rule it 404s any path that isn't a literal object in the
   bucket. Fixed with `aws amplify update-app --custom-rules`, Amplify's
   documented single-page-app rule (rewrite any extensionless path to
   `/index.html` with a 200, so `BrowserRouter` gets to handle it
   client-side). This is an **app-level setting, not something in git** -
   re-apply it if the app is ever recreated (see the exact rule in the AWS
   Amplify console under this app's "Rewrites and redirects", or re-run the
   command in git history).

Verified end-to-end with Playwright after each fix, culminating in a full
register → admin-views-live-OTP (SES still unverified, so this is the only
way to get a code without real email) → verify → login → course page load,
with a real second user account (`abdul@alignminds.com`) created this way -
not disposable test data, a real account for real use of the platform.

**Operational note, not a bug**: rapid concurrent test runs (many Playwright
scripts hitting the same Lambda within seconds of each other) occasionally
produced very slow (30s+) responses, most likely Lambda cold-starts stacking
up against the `pg` pool's small `max: 2` connections per warm container
competing for the shared RDS instance's connection slots. Spaced-out, realistic
usage (one user logging in at a time) did not reproduce this - flagging it as
something to watch if usage patterns change, not something fixed here.

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
