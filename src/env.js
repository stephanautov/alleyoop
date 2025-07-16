//src/env.js

import { createEnv } from "@t3-oss/env-nextjs";
import { z } from "zod";

export const env = createEnv({
  server: {
    DATABASE_URL: z
      .string()
      .url()
      .refine(
        (str) => !str.includes("YOUR_POSTGRES_URL_HERE"),
        "You forgot to change the default URL"
      ),
    NODE_ENV: z
      .enum(["development", "test", "production"])
      .default("development"),
    NEXTAUTH_SECRET:
      process.env.NODE_ENV === "production"
        ? z.string()
        : z.string().optional(),
    NEXTAUTH_URL: z.preprocess(
      (str) => process.env.VERCEL_URL ?? str,
      process.env.VERCEL ? z.string() : z.string().url()
    ),
    GOOGLE_CLIENT_ID: z.string().optional(),
    GOOGLE_CLIENT_SECRET: z.string().optional(),
    REDIS_URL: z.string().url(),
    OPENAI_API_KEY: z.string().min(1),
    ANTHROPIC_API_KEY: z.string().optional(),
    RESEND_API_KEY: z.string().optional(),
    FROM_EMAIL: z.string().email().optional(),
    UPLOAD_DIR: z.string().default("./uploads"),
    RATE_LIMIT_MAX: z.coerce.number().default(10),
    RATE_LIMIT_WINDOW: z.coerce.number().default(60),
    // Remove feature flags from here
  },

  client: {
    NEXT_PUBLIC_APP_URL: z.string().url().default("http://localhost:3000"),
    NEXT_PUBLIC_POSTHOG_KEY: z.string().optional(),
    NEXT_PUBLIC_POSTHOG_HOST: z.string().optional(),

    // Add feature flags here with NEXT_PUBLIC_ prefix
    NEXT_PUBLIC_ENABLE_BIOGRAPHY: z
      .string()
      .transform((v) => v === "true")
      .default("true"),
    NEXT_PUBLIC_ENABLE_CASE_SUMMARY: z
      .string()
      .transform((v) => v === "true")
      .default("true"),
    NEXT_PUBLIC_ENABLE_BUSINESS_PLAN: z
      .string()
      .transform((v) => v === "true")
      .default("true"),
    NEXT_PUBLIC_ENABLE_MEDICAL_REPORT: z
      .string()
      .transform((v) => v === "true")
      .default("true"),
    NEXT_PUBLIC_ENABLE_GRANT_PROPOSAL: z
      .string()
      .transform((v) => v === "true")
      .default("true"),
  },

  runtimeEnv: {
    // Server
    DATABASE_URL: process.env.DATABASE_URL,
    NODE_ENV: process.env.NODE_ENV,
    NEXTAUTH_SECRET: process.env.NEXTAUTH_SECRET,
    NEXTAUTH_URL: process.env.NEXTAUTH_URL,
    GOOGLE_CLIENT_ID: process.env.GOOGLE_CLIENT_ID,
    GOOGLE_CLIENT_SECRET: process.env.GOOGLE_CLIENT_SECRET,
    REDIS_URL: process.env.REDIS_URL,
    OPENAI_API_KEY: process.env.OPENAI_API_KEY,
    ANTHROPIC_API_KEY: process.env.ANTHROPIC_API_KEY,
    RESEND_API_KEY: process.env.RESEND_API_KEY,
    FROM_EMAIL: process.env.FROM_EMAIL,
    UPLOAD_DIR: process.env.UPLOAD_DIR,
    RATE_LIMIT_MAX: process.env.RATE_LIMIT_MAX,
    RATE_LIMIT_WINDOW: process.env.RATE_LIMIT_WINDOW,

    // Client
    NEXT_PUBLIC_APP_URL: process.env.NEXT_PUBLIC_APP_URL,
    NEXT_PUBLIC_POSTHOG_KEY: process.env.NEXT_PUBLIC_POSTHOG_KEY,
    NEXT_PUBLIC_POSTHOG_HOST: process.env.NEXT_PUBLIC_POSTHOG_HOST,
    NEXT_PUBLIC_ENABLE_BIOGRAPHY: process.env.NEXT_PUBLIC_ENABLE_BIOGRAPHY,
    NEXT_PUBLIC_ENABLE_CASE_SUMMARY: process.env.NEXT_PUBLIC_ENABLE_CASE_SUMMARY,
    NEXT_PUBLIC_ENABLE_BUSINESS_PLAN: process.env.NEXT_PUBLIC_ENABLE_BUSINESS_PLAN,
    NEXT_PUBLIC_ENABLE_MEDICAL_REPORT: process.env.NEXT_PUBLIC_ENABLE_MEDICAL_REPORT,
    NEXT_PUBLIC_ENABLE_GRANT_PROPOSAL: process.env.NEXT_PUBLIC_ENABLE_GRANT_PROPOSAL,
  },

  skipValidation: !!process.env.SKIP_ENV_VALIDATION,
  emptyStringAsUndefined: true,
});