export const ALLOWED_EMAIL_DOMAINS = ["alignminds.com", "alignminds.in"] as const;

export const OTP_LENGTH = 6;
export const OTP_EXPIRY_MINUTES = 10;
export const OTP_MAX_ATTEMPTS = 5;
export const OTP_RESEND_COOLDOWN_SECONDS = 60;
export const OTP_MAX_SENDS_PER_HOUR = 5;

export const ACCESS_TOKEN_TTL_MINUTES = 20;
export const REFRESH_TOKEN_TTL_DAYS = 14;

export const PASSWORD_MIN_LENGTH = 8;

export const EXAM_QUESTION_COUNT_PRESETS = [10, 20, 40, 60] as const;
export const OPTION_LENGTH_IMBALANCE_THRESHOLD = 0.4; // 40%, per spec Section 10

export const MAX_AI_GENERATION_COUNT = 20; // per-request cap, spec Section 4b guardrail
export const MAX_AI_GENERATIONS_PER_DAY = 20; // per-user daily cap, spec Section 12

// 4MB raw file - uploads go through the Lambda Function URL as a base64 JSON
// field (no separate multipart/S3-presigned-upload path in this phase), and
// base64 inflates size ~33%; Lambda Function URLs cap synchronous request
// bodies at 6MB, so this leaves headroom for the JSON wrapper too.
export const MAX_UPLOAD_SIZE_BYTES = 4 * 1024 * 1024;
export const ALLOWED_UPLOAD_EXTENSIONS = [".pdf", ".docx", ".html"] as const;
