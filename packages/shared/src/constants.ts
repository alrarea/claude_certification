export const ALLOWED_EMAIL_DOMAINS = ["alignminds.com", "alignminds.in"] as const;

export const OTP_LENGTH = 6;
export const OTP_EXPIRY_MINUTES = 10;
export const OTP_MAX_ATTEMPTS = 5;
export const OTP_RESEND_COOLDOWN_SECONDS = 60;
export const OTP_MAX_SENDS_PER_HOUR = 5;

export const ACCESS_TOKEN_TTL_MINUTES = 20;
export const REFRESH_TOKEN_TTL_DAYS = 14;

export const PASSWORD_MIN_LENGTH = 8;
