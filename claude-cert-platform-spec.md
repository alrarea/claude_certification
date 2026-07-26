# Claude Certification Prep Platform — Technical Specification (v1.0)

**Phase 1 scope:** Claude Certified Architect – Foundations (CCAR-F / "CCAF") and Claude Certified Architect – Professional (CCAR-P / "CCAP") only. Other certifications (Associate, Developer) are explicitly out of scope for this phase but the data model must not preclude adding them later.

**Audience for this document:** Claude Code, as the implementation agent. This is a build spec, not a pitch deck — every section states what to build, not why it's a good idea.

---

## 1. Purpose

An internal web platform for `@alignminds.com` / `@alignminds.in` staff to:
1. Register/login with company email, verified via OTP.
2. Study CCAF/CCAP content through a self-paced course with three reading modes.
3. Take practice exams drawn from a growing question bank, with full answer explanations.
4. Grow the question bank by uploading source documents and/or generating new questions with their own Anthropic API key.

---

## 2. User Roles

Two roles only, no more:

- **user** — default role for every registered account. Can study, take exams, upload documents, generate questions (if they've set an API key), manage their own profile.
- **admin** — a small, manually-flagged set of accounts (set directly in DB, no self-service admin signup). Can edit/curate course content, review and approve/reject questions that came from uploads or AI generation before they enter the shared pool, and deactivate bad questions. Admin is infrastructure needed to keep the question bank clean — it is not a new product feature, so keep its UI minimal (a flag-gated content review screen is enough).

---

## 3. AWS SES Verification — Do This First

Before writing any registration/OTP code, verify the `alrarea` AWS profile can actually send mail. Run these against the real AWS account (not this sandbox):

```bash
# Identify default region tied to the profile
aws configure get region --profile alrarea

# Is the account in SES sandbox mode? (sandbox = can only send to verified addresses)
aws sesv2 get-account --profile alrarea

# What sender identities (domain or email) are verified?
aws sesv2 list-email-identities --profile alrarea

# Confirm the specific identity you plan to send FROM is verified + DKIM passing
aws sesv2 get-email-identity --email-identity <planned-from-address-or-domain> --profile alrarea

# Does the IAM identity behind this profile actually have send permission?
aws sts get-caller-identity --profile alrarea
aws iam simulate-principal-policy \
  --policy-source-arn <arn-from-above> \
  --action-names ses:SendEmail ses:SendRawEmail \
  --profile alrarea
```

**Decision branch:**
- If `ProductionAccessEnabled` is `true` **and** a verified identity exists on the `alignminds.com`/`alignminds.in` domain (or the specific from-address) **and** `simulate-principal-policy` shows `ses:SendEmail` allowed → use SES via AWS SDK v3 (`@aws-sdk/client-sesv2`), profile `alrarea`, for OTP emails.
- If the account is still in **sandbox mode**: registration emails will fail for any recipient that isn't individually verified. Either request production access first, or fall back to another transactional email provider (Postmark, SES alternative, or existing company SMTP) for this phase. Do not build the OTP flow against a sandboxed SES account and assume it'll work for real users.
- If the domain identity isn't verified: verify `alignminds.com` (and `.in` if used) in SES first (DNS TXT/DKIM records), since sending from an unverified domain will bounce regardless of IAM permissions.

Record the outcome (which path was taken) at the top of the README when implementation starts.

---

## 4. Repository & Deployment Architecture

**Decisions locked in (per your answers):**
- Frontend: static SPA (React + Vite) — single Lambda remains the only backend compute.
- Database: existing PostgreSQL is publicly reachable — no VPC attachment, no NAT gateway needed for the Lambda.
- Backend infra/IaC: **AWS Amplify Gen 2**, defining both the frontend hosting and the Lambda function in one Amplify project.

**Monorepo:** `https://github.com/alrarea/claude_certification.git` — this spec assumes the repo is currently empty and will be scaffolded from scratch (e.g. via `npm create amplify@latest`). If it already has content, reconcile before starting; do not assume its structure.

**Proposed layout** (Amplify Gen 2's conventional shape — backend definition lives in `amplify/`, not a generic `infra/` folder):

```
claude_certification/
  amplify/
    backend.ts               # wires the function together; CDK escape-hatch adds the Function URL config
    functions/
      api/
        resource.ts           # defineFunction() — the one and only Lambda
        handler.ts             # Hono app entry point, mounts all internal routes
        routes/                 # auth, profile, courses, exams, questions — internal route modules
  apps/
    web/                       # frontend SPA (React + Vite), built/deployed via Amplify Hosting
  packages/
    db/                         # Prisma schema + generated client, imported by the function
    shared/                   # shared TypeScript types/zod schemas used by both web and the function
  package.json                 # npm/pnpm workspace root
```

**Frontend:** deployed via **AWS Amplify Hosting**, built from `apps/web`, using Amplify's standard git-based CI/CD on push to the connected branch.

**Backend:** a **single Lambda function**, defined with Amplify Gen 2's `defineFunction()` in `amplify/functions/api`, handling every API route internally via an in-process router (Hono) rather than one Lambda per route. This is a deliberate constraint from the requirements — do not split this into multiple functions, a Step Functions workflow, or SQS-decoupled workers unless a future spec revision explicitly asks for it.

**Amplify Gen 2 guardrails — what NOT to reach for:**
Amplify Gen 2's defaults point toward its own managed backend resources (`defineAuth` → Cognito, `defineData` → AppSync + DynamoDB). This project uses neither:
- **Auth stays fully custom**, against the `users`/`otp_codes` tables in Postgres, per Section 7 — do not wire up `defineAuth`/Cognito.
- **Data stays fully in Postgres via Prisma**, per Section 6 — do not wire up `defineData`/DynamoDB/AppSync.
- Amplify Gen 2 has no first-class "REST API in front of a function" primitive the way SAM does — but that's moot here anyway, since Section 4b resolves API exposure in favor of a **Lambda Function URL** (Always Free, no separate charge) rather than API Gateway. Enable it directly on the function's `resource.ts`/CDK definition, with CORS configured there.

**No-VPC consequence for the database connection:** because the Lambda is not VPC-attached, its outbound IP is not fixed/predictable. The RDS security group will need to allow inbound Postgres connections from the internet (or from AWS's published Lambda IP ranges, which change) rather than a narrow IP allowlist — so connection security has to come from strong credentials + enforced SSL/TLS on the Postgres connection, not network-level IP restriction. Confirm the existing instance already accepts public connections this way before assuming this "just works."

**Hard technical consequences of "single Lambda, no server-side rendering compute":**
- Lambda has no persistent local disk, so uploaded documents (Section 11) **must** go to **S3**, not local storage. `document_uploads.storage_path` is an S3 object key. Define the bucket in `backend.ts` alongside the function.
- Lambda functions are stateless per invocation — auth cannot rely on an in-memory session store; it must be a signed, stateless token (see Section 7).
- Long-running AI generation calls (Section 11) must complete within the Lambda's configured timeout (max 15 minutes). No background job queue is introduced in this phase — if a generation request would realistically run long, cap the requested question count rather than adding infrastructure to work around it.

## 4b. Cost / Free-Tier Constraints

**Requirement: $0 running cost.** Every infra decision below is chosen to fit AWS's "Always Free" tier — the ~30 services with permanent monthly caps that don't expire, regardless of when the AWS account was created — rather than a time-limited or credit-funded free allowance that quietly starts billing later.

- **API exposure: Lambda Function URL, not API Gateway.** Lambda itself (1M requests + 400,000 GB-seconds/month) is Always Free, permanently. API Gateway is not — on accounts created before July 15, 2025 it has only a 12-month free allowance; on accounts created after that date it draws down the account's one-time sign-up credit and then bills per request once that's exhausted. A Function URL supports CORS configuration directly and adds no charge beyond the Lambda invocation itself. **This resolves the "API exposure" open item from the previous round — use a Function URL, not API Gateway.**
- **Secrets: Lambda environment variables or SSM Parameter Store (Standard tier), not Secrets Manager.** Secrets Manager has no meaningful free tier (~$0.40/secret/month after a 30-day trial). Parameter Store's Standard parameters are Always Free; Advanced parameters are not. **This resolves the "secrets management" open item — use Parameter Store Standard parameters or plain Lambda env vars, never Secrets Manager, never Advanced parameters.**
- **API-key encryption: application-level AES-256-GCM with a secret from env/Parameter Store, not a KMS customer-managed key.** A CMK costs ~$1/month regardless of usage. Do not create one for this project.
- **S3 and Amplify Hosting are not on the Always-Free list.** They carry small per-GB costs once any free allowance is used up, and whether that allowance is "12 months" or "until a sign-up credit runs out" depends on when the AWS account itself was created (see the question below). At this project's realistic scale (a handful of internal users, small documents, low request volume), actual spend here should be cents-per-month at worst — but it is not contractually $0 the way Lambda is. Flagging this honestly rather than promising something AWS's own pricing doesn't guarantee.
- **RDS is out of scope for this cost analysis** — the Postgres instance already exists and isn't being newly provisioned by this project.
- **SES is usage-priced** (roughly $0.10 per 1,000 emails). At OTP-only volume for an internal team this is negligible, but it is not literally $0.
- **Recommended guardrail (not a new product feature — an ops safeguard):** set up an AWS Budget with a low threshold (e.g. $1) and an email alert, so any drift out of free-tier usage is caught immediately instead of silently accumulating.

**Still need from you:** was the AWS account behind the `alrarea` profile created before or after July 15, 2025? AWS restructured its free tier on that date — pre-July-2025 accounts keep the legacy 12-months-free model for services like S3; post-July-2025 accounts instead draw down a one-time $100–200 sign-up credit before those same services start billing. This doesn't change any decision above, but it changes how long S3/Amplify Hosting actually stay at $0.

### Scale validation — 15–20 concurrent users max

Confirmed usage pattern: an internal tool, max ~15–20 people using it at once, not public-facing. Checking that scale against every service's cap:

| Service | Always-Free cap | Realistic usage at 15–20 users | Headroom |
|---|---|---|---|
| Lambda requests | 1,000,000 / month, forever | Even at a generous 300 requests/user/day × 20 users × 30 days ≈ 180,000/month | ~5.5x under the cap |
| Lambda compute | 400,000 GB-seconds / month, forever | 180,000 requests × ~0.3s avg × 0.5GB memory ≈ 27,000 GB-seconds | ~15x under the cap |
| Parameter Store (Standard) | Free, no meaningful cap for this use | A handful of config values, read on cold start | Not a factor |
| S3 storage | 5GB free (duration depends on account type, see above) | A study platform's document uploads for ~20 people — realistically well under 1GB total | Even fully outside any free tier, ~1GB ≈ $0.02/month |
| S3 requests | 20,000 GET + 2,000 PUT/month (same duration caveat) | Uploads are occasional (admin/content curation), not per-exam-question — low tens to low hundreds/month | Trivial even priced |
| Amplify Hosting builds | 1,000 build min/month | A handful of deploys/day during active development, near-zero once stable | Large headroom |
| Amplify Hosting bandwidth | 15GB/month | 20 users loading a small SPA a few times/day ≈ low single-digit GB/month | Large headroom |
| SES | usage-priced, no free tier | OTP is one-time per registration (≤20 people ever) plus occasional resends — realistically under 100 emails/month | ≈$0.01/month at $0.10/1,000 |

**Conclusion at this scale:** Lambda, Function URL, and Parameter Store are Always Free and structurally guaranteed to stay at $0 regardless of account type or how long you run this. S3, Amplify Hosting, and SES are not contractually "Always Free," but at 15–20 users the actual usage is such a small fraction of even the paid rates that realistic total spend, in the worst case where every free allowance is already exhausted, is on the order of a few cents a month — not a number worth engineering around further. The Budget alert (above) is the appropriate safety net for that residual risk, not additional architecture.

**Guardrails so a bug can't accidentally spike usage/cost**, sized to this user count — these are defensive limits, not new features:
- Rate-limit registration/OTP/login endpoints per Section 12 (already specified) — prevents a retry loop from generating runaway Lambda invocations or SES sends.
- Cap AI-generation question-set requests to a sane per-user daily count (e.g. low double digits) — protects against an accidental loop calling the Anthropic API repeatedly; this also protects the user's own Anthropic spend, not just AWS's.
- Cap uploaded file size (already specified in Section 12) — prevents one oversized upload from being a meaningful fraction of the S3 free allowance.

## 5. Suggested Tech Stack

- **Frontend:** React + Vite (static SPA), TypeScript, Tailwind CSS, deployed via Amplify Hosting.
- **Backend:** Node.js/TypeScript Lambda defined via Amplify Gen 2's `defineFunction()`, using Hono for internal route handling.
- **Backend infra/IaC:** Amplify Gen 2 (`amplify/backend.ts`), exposing the function via a **Lambda Function URL** (not API Gateway — see Section 4b) and defining the S3 bucket via CDK escape hatch.
- **ORM:** Prisma, against the existing (publicly reachable) PostgreSQL instance, connecting over TLS. Because Lambda invocations are short-lived and can run concurrently, use Prisma's connection pooling settings conservatively (low `connection_limit` per invocation) to avoid exhausting Postgres's max connections under concurrent invocations — this is an internal tool with low expected concurrency, so this is a config setting to get right, not a reason to introduce RDS Proxy or PgBouncer in this phase.
- **Auth:** Custom credentials auth (email + password + OTP-gated registration), stateless JWT issued by the Lambda and sent as a `Bearer` token in the `Authorization` header (not a cookie — avoids cross-origin cookie/domain complications between the Amplify frontend origin and the Function URL's origin). Token stored client-side in memory + refreshed via a short-lived refresh token; exact TTLs to be set during implementation, not fixed here.
- **Secrets:** SSM Parameter Store (Standard tier) or Lambda env vars — see Section 4b. No Secrets Manager, no KMS CMK.
- **File storage:** S3, one bucket for uploaded documents, defined in `backend.ts`.
- **Email:** AWS SDK v3 SES client, profile `alrarea` (or fallback per Section 3).
- **AI calls:** Anthropic SDK (`@anthropic-ai/sdk`), called from inside the Lambda, server-side only, using the per-user stored key.

---

## 6. Data Model (PostgreSQL)

```
users
  id                    uuid PK
  email                 text UNIQUE NOT NULL           -- must end @alignminds.com or @alignminds.in
  name                  text NOT NULL
  password_hash         text NOT NULL                  -- argon2id
  is_admin              boolean DEFAULT false
  email_verified_at     timestamptz NULL
  anthropic_api_key_enc bytea NULL                      -- AES-256-GCM ciphertext
  anthropic_api_key_iv  bytea NULL
  anthropic_key_last4   text NULL                       -- for display only, never the full key
  created_at            timestamptz DEFAULT now()
  updated_at            timestamptz DEFAULT now()

otp_codes
  id            uuid PK
  email         text NOT NULL                          -- keyed on email, not user_id: user row doesn't
                                                          -- exist yet at registration time
  code_hash     text NOT NULL                           -- hash the OTP, never store plaintext
  purpose       text NOT NULL DEFAULT 'registration'
  attempts      int  DEFAULT 0                          -- lock after 5 wrong attempts
  expires_at    timestamptz NOT NULL                    -- created_at + 10 minutes
  consumed_at   timestamptz NULL
  created_at    timestamptz DEFAULT now()

certifications
  id            uuid PK
  code          text UNIQUE NOT NULL                    -- 'CCAF', 'CCAP'
  name          text NOT NULL
  description   text NULL

topics
  id                 uuid PK
  certification_id   uuid FK -> certifications
  parent_topic_id    uuid NULL FK -> topics(id)          -- self-referencing, allows subtopics
  title              text NOT NULL
  order_index        int NOT NULL
  exam_domain        text NULL                           -- maps to official exam blueprint domain

topic_content
  id            uuid PK
  topic_id      uuid FK -> topics
  mode          text NOT NULL CHECK (mode IN ('in_depth','normal','concise'))
  content_md    text NOT NULL                            -- markdown, rendered client-side
  updated_at    timestamptz DEFAULT now()
  UNIQUE (topic_id, mode)

user_topic_progress
  id                uuid PK
  user_id           uuid FK -> users
  topic_id          uuid FK -> topics
  status            text NOT NULL CHECK (status IN ('not_started','in_progress','completed'))
  last_mode         text NULL CHECK (last_mode IN ('in_depth','normal','concise'))
  last_viewed_at    timestamptz NULL
  UNIQUE (user_id, topic_id)

questions
  id                uuid PK
  certification_id  uuid FK -> certifications
  topic_id          uuid FK -> topics
  difficulty        text NOT NULL CHECK (difficulty IN ('easy','medium','hard'))
  question_text     text NOT NULL
  source            text NOT NULL CHECK (source IN ('manual','uploaded','ai_generated'))
  created_by        uuid NULL FK -> users
  is_active         boolean DEFAULT true                 -- admin can deactivate instead of delete
  review_status     text NOT NULL DEFAULT 'approved'
                      CHECK (review_status IN ('pending','approved','rejected'))
  created_at        timestamptz DEFAULT now()

question_options
  id                uuid PK
  question_id       uuid FK -> questions
  option_text       text NOT NULL
  is_correct        boolean NOT NULL
  explanation       text NOT NULL                        -- why this option is right/wrong, always populated
  order_index       int NOT NULL

document_uploads
  id                    uuid PK
  user_id               uuid FK -> users
  filename              text NOT NULL
  storage_path          text NOT NULL
  status                text NOT NULL DEFAULT 'processing'
                          CHECK (status IN ('processing','ready','failed'))
  generated_question_ct int DEFAULT 0
  created_at            timestamptz DEFAULT now()

exams
  id                uuid PK
  user_id           uuid FK -> users
  certification_id  uuid FK -> certifications
  feedback_mode     text NOT NULL CHECK (feedback_mode IN ('immediate','end_of_set'))
  difficulty        text NOT NULL CHECK (difficulty IN ('easy','medium','hard','mixed'))
  topic_scope       uuid NULL FK -> topics                -- NULL = whole certification
  question_count    int NOT NULL
  started_at        timestamptz DEFAULT now()
  completed_at      timestamptz NULL
  score_pct         numeric NULL

exam_questions
  id                    uuid PK
  exam_id               uuid FK -> exams
  question_id           uuid FK -> questions
  order_index            int NOT NULL
  selected_option_id    uuid NULL FK -> question_options
  is_correct            boolean NULL
  answered_at           timestamptz NULL
```

Notes:
- All `_id` foreign keys cascade appropriately on delete where the child record has no meaning without the parent (e.g. `question_options` on `questions`); do not cascade `users` deletes onto `exams` — soft-delete users instead if that's ever needed.
- AI-generated and uploaded-doc-derived questions default to `review_status = 'pending'` and are **not** served in exams until an admin approves them, or auto-approve if the generating user is the only one who'll ever see them — see Section 11 for the scoping decision.

---

## 7. Registration / Login Flow

**Registration:**
1. User submits name, email, password on `/register`.
2. Server validates email domain is exactly `@alignminds.com` or `@alignminds.in` — reject anything else with a clear error, don't silently allow.
3. Server validates password (minimum 8 chars; at least one letter and one number).
4. If email already exists and is verified → reject ("account exists, log in instead").
5. If email exists but unverified (abandoned registration) → allow retry, overwrite the pending OTP.
6. Create/update `users` row with `email_verified_at = NULL`, hash the password now (don't wait for OTP confirmation to hash it).
7. Generate a random 6-digit numeric OTP, hash it, store in `otp_codes` with `expires_at = now() + 10 minutes`.
8. Send OTP via email (Section 3's chosen path). Email body: plain, states the code and that it expires in 10 minutes. No links, no HTML tracking pixels.
9. User is shown an OTP entry screen. On submit:
   - Look up the latest non-consumed, non-expired `otp_codes` row for that email.
   - If `attempts >= 5` → reject, force a fresh code request.
   - Compare hash; on match, set `consumed_at`, set `users.email_verified_at = now()`, issue an access JWT + refresh JWT and return them to the client.
   - On mismatch, increment `attempts`, return generic "incorrect code" error.
10. Resend: allow one resend per 60 seconds per email (basic rate limit), max 5 sends per email per hour.

**Login:** standard email + password against `users`, reject if `email_verified_at IS NULL` (tell them to finish registration instead of "wrong password"). Issue access + refresh JWT on success (same as OTP-success path above).

**Password reset while logged out ("forgot password"):** not included in this phase — the spec only asked for password change from within the profile page. Flag this as a known gap; add later if needed.

---

## 8. Profile Page

Route: `/profile`. Authenticated only. Contains:

- **Name** — editable, saves on submit.
- **Password** — change form requiring current password + new password (not a forgot-password flow — this is while logged in).
- **Anthropic API key** — a single input field:
  - On save: encrypt with AES-256-GCM using an app-level secret key (from env, not committed), store ciphertext + IV in `users.anthropic_api_key_enc` / `_iv`, store last 4 characters in `anthropic_key_last4` for display (e.g. "sk-ant-…wXyz").
  - Display state: if a key is set, show masked value + last 4 + a "Remove key" action; never re-display the full key.
  - This key unlocks: AI question generation from uploaded docs (Section 11) and on-demand new question set generation. Without a key, the user can only use the existing question bank.
  - Validate the key works before saving (make one cheap test call to the Anthropic API; if it fails, reject the save with a clear error rather than silently storing a bad key).

---

## 9. Course / Tutorial Module

Route: `/learn/[certification]` (e.g. `/learn/ccaf`, `/learn/ccap`).

**Structure:** `certifications` → `topics` (tree via `parent_topic_id`) → `topic_content` (one row per topic per mode).

**Reading modes**, selectable per topic, persisted per user (last-used mode remembered per topic via `user_topic_progress.last_mode`, and also usable as a default for the next topic they open):

- **In-depth** — full explanation, includes real-world examples of where the concept applies in production Claude deployments.
- **Normal** — clear explanation, less elaboration, no extended examples.
- **Concise** — compressed, review/cram-style, bullet-heavy, meant for repetition rather than first-time learning.

**Content sourcing:** Migrate the user's existing minimal HTML guides for CCAF and CCAP as the initial "normal" mode content for each topic. "In-depth" and "concise" variants are either authored by hand or generated once (by admin, using the Anthropic API) from the normal-mode source, then stored as static rows — generation is a one-time content-authoring step, not something that happens live per learner request.

**Progress tracking:**
- On opening a topic, upsert `user_topic_progress` to `in_progress` if it was `not_started`.
- A topic is marked `completed` when the user explicitly marks it done (a button on the page) — do not auto-complete on scroll/time, since that's an easy way to end up with false completion signals.
- Sidebar/tree navigation shows a status indicator per topic (not started / in progress / completed) and an overall % complete per certification.

**Topic-scoped exams:** every topic page has a "Practice this topic" action that starts an exam pre-scoped to that `topic_id` (see Section 10), letting the user drill a weak area immediately instead of going through the full exam setup flow.

**Deep-linking from exam answers:** exam answer explanations link back to `/learn/[certification]/[topic]`, opening in the user's last-used mode for that topic.

---

## 10. Exam Module

Route: `/exam/new` (setup) → `/exam/[id]` (in progress) → `/exam/[id]/results`.

**Setup screen**, user selects:
- Certification (CCAF or CCAP)
- Difficulty: easy / medium / hard / mixed
- Feedback mode:
  - **Immediate** — see the correct answer + explanations right after answering each question, before moving to the next.
  - **End of set** — answer the whole set first, no feedback shown until the final question is submitted, then a full review screen.
- Number of questions (offer common presets like 10/20/40/60, plus a free-entry option)
- Optional topic scope (defaults to whole certification; pre-filled and locked when launched from a topic page per Section 9)

**Question selection logic:** pull `question_count` active, approved questions matching `certification_id` + `difficulty` (or any difficulty if "mixed") + `topic_scope` (if set) from the `questions` table, randomized, no repeats within the same exam. If the pool is smaller than the requested count, run with what's available and tell the user up front how many they'll actually get.

**Answer options:** whenever questions are authored (manual, uploaded, or AI-generated), enforce that all options for a question are of roughly similar length — this applies to authoring/validation, not answer-time UI. On manual entry, warn if one option's character count deviates more than ~40% from the others. On AI generation, this constraint is part of the prompt (Section 11) and is checked programmatically after generation, with an automatic one-shot rewrite pass if the check fails.

**Explanations:** every `question_options` row has its own `explanation` — this is what drives the "why this is right / why the others are wrong" requirement. The results/feedback UI shows all four options with their individual explanations, not just a single blurb for the correct answer.

**Jump to topic from a question:** in both feedback modes, each question's feedback includes a link to its `topic_id`'s course page (per Section 9).

**Results screen:** score %, breakdown by topic and by difficulty, list of missed questions with links to retry that topic.

---

## 11. Question Bank Growth (Upload + AI Generation)

Route: `/questions/manage` (available to any user; admin gets an extra review queue view).

**A. Upload existing documents:**
1. User uploads a file (PDF, DOCX, or HTML — matches what they already have) via `/questions/manage/upload`.
2. Store the file, create a `document_uploads` row with `status = 'processing'`.
3. Extraction path depends on whether the user has an Anthropic API key set:
   - **With key:** send the document content to the Anthropic API with a structured-output prompt (force JSON-only response, per the existing Anthropic API pattern) asking it to produce candidate questions: question text, 4 options, which is correct, and an explanation for each option, tagged with a best-guess `topic_id` (given the topic list) and `difficulty`. Insert resulting rows into `questions`/`question_options` with `source = 'ai_generated'`, `review_status = 'pending'`.
   - **Without a key:** no automatic question generation. The upload can still be used as source content for the course itself (an admin can manually pull material from it into `topic_content`), but no questions are auto-created.
4. Update `document_uploads.status` to `ready` (or `failed` with an error shown to the user) and set `generated_question_ct`.

**B. Generate a fresh set on demand (requires API key):**
1. From `/questions/manage/generate`, user picks certification, topic (optional), difficulty, and count.
2. Server calls the Anthropic API with the same structured-output contract as above (question + 4 options + correct flag + per-option explanation + topic + difficulty), enforcing the option-length balance check.
3. Inserted as `source = 'ai_generated'`.

**Review/approval scoping:** AI-generated and uploaded-derived questions land as `review_status = 'pending'` and are excluded from other users' exam pools until an admin flips them to `approved` (or `rejected`). The generating user can still practice with their own pending questions immediately — don't block them from using content they just created, just don't let it leak into the shared pool unreviewed. Admin review screen: list pending questions, show full question + options + explanations, approve/reject/edit inline.

**Manual question authoring:** a plain form (question text, topic, difficulty, 4 options with correct-flag + explanation each) for admins to add hand-written questions directly with `source = 'manual'`, `review_status = 'approved'` immediately.

---

## 12. Security Notes

- Passwords: argon2id, never logged, never returned in any API response.
- OTP codes: stored as a hash, never plaintext; 10-minute expiry; capped attempts.
- Anthropic API keys: encrypted at rest (Section 8) using an application-level secret stored in SSM Parameter Store (Standard) or a Lambda env var, per Section 4b — not a KMS customer-managed key; decrypted only in-memory, server-side, at the moment of an API call; never sent to the client after initial save.
- All DB access parameterized via the ORM — no raw string-concatenated SQL.
- Auth tokens: access JWT short-lived (e.g. 15–30 min), refresh JWT longer-lived and stored client-side only (not in a cookie, since the frontend is a separate Amplify origin from the API) — exact storage mechanism (memory vs. secure storage) to be finalized in implementation; do not use `localStorage` for the refresh token without accepting the XSS trade-off explicitly.
- Rate-limit: registration, OTP verify, login, and question-generation endpoints (the last one also naturally rate-limited by Anthropic API cost/latency, but add an app-side cap too, e.g. per-user per-day generation limit, to avoid runaway API spend on someone else's key... actually keys are per-user so this mainly protects against accidental loops, not shared cost).
- File uploads: restrict to PDF/DOCX/HTML, cap file size, scan/validate before parsing.

---

## 13. Page/Route Map

| Route | Auth | Purpose |
|---|---|---|
| `/register` | public | name + email + password → triggers OTP |
| `/register/verify` | public (mid-flow) | OTP entry |
| `/login` | public | email + password |
| `/profile` | user | name, password, Anthropic key |
| `/learn/[cert]` | user | topic tree + progress |
| `/learn/[cert]/[topic]` | user | content in selected mode, mode switcher, mark-complete, practice-this-topic |
| `/exam/new` | user | exam setup form |
| `/exam/[id]` | user | in-progress exam, feedback per configured mode |
| `/exam/[id]/results` | user | score + breakdown + missed-question review |
| `/questions/manage` | user | upload docs, generate new sets |
| `/questions/manage/review` | admin | approve/reject pending questions |

---

## 14. Out of Scope for This Phase (explicitly deferred)

- Associate (CCAO-F) and Developer (CCDV-F) certifications — data model supports adding them (just add rows to `certifications`), but no content/UI work for them now.
- "Forgot password" (logged-out) reset flow.
- Any social/SSO login.
- Leaderboards, gamification, or cross-user comparison.
- Mobile app (web only, responsive).
- Payment/billing (internal tool, not applicable).

---

## 15. Open Decisions — Not Assumed, Need Your Answer

All architecture decisions from the previous rounds are now resolved (Sections 4/4b/5): static SPA, no VPC/NAT, Amplify Gen 2, Lambda Function URL instead of API Gateway, Parameter Store/env vars instead of Secrets Manager, and a confirmed scale ceiling of ~15–20 concurrent users, which Section 4b validates against every relevant free-tier cap.

**One non-blocking item remains, asked in Section 4b:** whether the `alrarea` AWS account predates or postdates July 15, 2025 — doesn't change any decision or the cost conclusion, only the technical mechanism by which S3/Amplify Hosting stay near-$0. Doesn't need to hold up starting implementation.

Nothing in this document should be read as expanding scope beyond what was originally requested (register/login/OTP, profile, 3-mode course, 2-mode exam engine, question upload/generation) — Sections 4/4b/5 only translate that same scope onto Amplify + single-Lambda + the given repo, at $0-or-near-$0 running cost for the stated scale.

## 16. Build Order (suggested)

1. Section 3 — confirm SES path works, or pick the fallback.
2. DB schema (Section 6) + migrations.
3. Auth: register/OTP/login (Section 7).
4. Profile page incl. API key storage (Section 8).
5. Course content model + migrate existing CCAF/CCAP HTML guides into `topic_content` (normal mode) (Section 9).
6. Exam engine against manually-seeded questions first, before wiring up AI generation (Section 10), so the exam UX can be tested without depending on API keys.
7. Upload + AI generation (Section 11).
8. Admin review queue.
