//src/env.js

import { createEnv } from "@t3-oss/env-nextjs";
import { z } from "zod";

export const env = createEnv({
  /**
   * Server-side environment variables schema
   * These are only available on the server and not exposed to the client
   */
  server: {
    // Database
    DATABASE_URL: z
      .string()
      .url()
      .refine(
        (str) => !str.includes("YOUR_POSTGRES_URL_HERE"),
        "You forgot to change the default URL"
      ),

    // Node Environment
    NODE_ENV: z
      .enum(["development", "test", "production"])
      .default("development"),

    // Authentication
    NEXTAUTH_SECRET:
      process.env.NODE_ENV === "production"
        ? z.string()
        : z.string().optional(),
    NEXTAUTH_URL: z.preprocess(
      (str) => process.env.VERCEL_URL ?? str,
      process.env.VERCEL ? z.string() : z.string().url()
    ),
    AUTH_SECRET: z.string().optional(), // Compatibility with some auth providers

    // OAuth Providers
    GOOGLE_CLIENT_ID: z.string().optional(),
    GOOGLE_CLIENT_SECRET: z.string().optional(),
    AUTH_DISCORD_ID: z.string().optional(),
    AUTH_DISCORD_SECRET: z.string().optional(),

    // Redis
    REDIS_URL: z.string().url(),

    // OpenAI
    OPENAI_API_KEY: z.string().min(1),
    OPENAI_ORG_ID: z.string().optional(),
    OPENAI_DEFAULT_MODEL: z.string().optional().default("gpt-4-turbo"),

    // Anthropic
    ANTHROPIC_API_KEY: z.string().optional(),
    ANTHROPIC_DEFAULT_MODEL: z.string().optional().default("claude-3-sonnet"),

    // Google AI / Gemini
    GOOGLE_AI_API_KEY: z.string().optional(),
    GEMINI_API_KEY: z.string().optional(),
    GEMINI_DEFAULT_MODEL: z.string().optional().default("gemini-1.5-pro"),

    // Perplexity
    PERPLEXITY_API_KEY: z.string().optional(),
    PERPLEXITY_DEFAULT_MODEL: z.string().optional().default("sonar-large"),

    // Llama Configuration
    LLAMA_PROVIDER: z.enum(["replicate", "together", "groq", "local"]).optional().default("replicate"),
    LLAMA_DEFAULT_MODEL: z.string().optional().default("llama-3-70b"),
    REPLICATE_API_TOKEN: z.string().optional(),
    TOGETHER_API_KEY: z.string().optional(),
    GROQ_API_KEY: z.string().optional(),
    LOCAL_LLAMA_URL: z.string().url().optional().default("http://localhost:8080"),

    // LLM Configuration
    DEFAULT_LLM_PROVIDER: z.enum(["openai", "anthropic", "gemini", "perplexity", "llama"]).default("openai"),
    DEFAULT_LLM_MODEL: z.string().default("gpt-4-turbo"),
    DEFAULT_EMBEDDING_MODEL: z.string().default("text-embedding-3-small"),

    // LLM Rate Limiting
    LLM_RATE_LIMIT_PER_MINUTE: z.coerce.number().default(60),
    LLM_RATE_LIMIT_PER_DAY: z.coerce.number().default(1000),

    // LLM Cost Controls
    MAX_TOKENS_PER_REQUEST: z.coerce.number().default(4000),
    MAX_COST_PER_DOCUMENT: z.coerce.number().default(0.50),

    // Email Service
    RESEND_API_KEY: z.string().optional(),
    FROM_EMAIL: z.string().email().optional(),

    // File Storage
    UPLOAD_DIR: z.string().default("./uploads"),

    // General Rate Limiting
    RATE_LIMIT_MAX: z.coerce.number().default(10),
    RATE_LIMIT_WINDOW: z.coerce.number().default(60),

    // Vector Store (Future RAG)
    PINECONE_API_KEY: z.string().optional(),
    PINECONE_ENVIRONMENT: z.string().optional(),
    PGVECTOR_ENABLED: z
      .string()
      .optional()
      .transform((v) => v === "true")
      .default("true"),
  },

  /**
   * Client-side environment variables schema
   * These are exposed to the browser via Next.js
   */
  client: {
    // Application URL
    NEXT_PUBLIC_APP_URL: z.string().url().default("http://localhost:3000"),

    // Analytics
    NEXT_PUBLIC_POSTHOG_KEY: z.string().optional(),
    NEXT_PUBLIC_POSTHOG_HOST: z.string().optional(),

    // Feature Flags for Document Types
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

  /**
   * Runtime environment variable mapping
   * Maps process.env to the schema
   */
  runtimeEnv: {
    // Server - Database & Core
    DATABASE_URL: process.env.DATABASE_URL,
    NODE_ENV: process.env.NODE_ENV,
    NEXTAUTH_SECRET: process.env.NEXTAUTH_SECRET,
    NEXTAUTH_URL: process.env.NEXTAUTH_URL,
    AUTH_SECRET: process.env.AUTH_SECRET,

    // Server - OAuth
    GOOGLE_CLIENT_ID: process.env.GOOGLE_CLIENT_ID,
    GOOGLE_CLIENT_SECRET: process.env.GOOGLE_CLIENT_SECRET,
    AUTH_DISCORD_ID: process.env.AUTH_DISCORD_ID,
    AUTH_DISCORD_SECRET: process.env.AUTH_DISCORD_SECRET,

    // Server - Redis
    REDIS_URL: process.env.REDIS_URL,

    // Server - OpenAI
    OPENAI_API_KEY: process.env.OPENAI_API_KEY,
    OPENAI_ORG_ID: process.env.OPENAI_ORG_ID,
    OPENAI_DEFAULT_MODEL: process.env.OPENAI_DEFAULT_MODEL,

    // Server - Anthropic
    ANTHROPIC_API_KEY: process.env.ANTHROPIC_API_KEY,
    ANTHROPIC_DEFAULT_MODEL: process.env.ANTHROPIC_DEFAULT_MODEL,

    // Server - Google AI / Gemini
    GOOGLE_AI_API_KEY: process.env.GOOGLE_AI_API_KEY,
    GEMINI_API_KEY: process.env.GEMINI_API_KEY,
    GEMINI_DEFAULT_MODEL: process.env.GEMINI_DEFAULT_MODEL,

    // Server - Perplexity
    PERPLEXITY_API_KEY: process.env.PERPLEXITY_API_KEY,
    PERPLEXITY_DEFAULT_MODEL: process.env.PERPLEXITY_DEFAULT_MODEL,

    // Server - Llama
    LLAMA_PROVIDER: process.env.LLAMA_PROVIDER,
    LLAMA_DEFAULT_MODEL: process.env.LLAMA_DEFAULT_MODEL,
    REPLICATE_API_TOKEN: process.env.REPLICATE_API_TOKEN,
    TOGETHER_API_KEY: process.env.TOGETHER_API_KEY,
    GROQ_API_KEY: process.env.GROQ_API_KEY,
    LOCAL_LLAMA_URL: process.env.LOCAL_LLAMA_URL,

    // Server - LLM Configuration
    DEFAULT_LLM_PROVIDER: process.env.DEFAULT_LLM_PROVIDER,
    DEFAULT_LLM_MODEL: process.env.DEFAULT_LLM_MODEL,
    DEFAULT_EMBEDDING_MODEL: process.env.DEFAULT_EMBEDDING_MODEL,

    // Server - LLM Rate Limiting
    LLM_RATE_LIMIT_PER_MINUTE: process.env.LLM_RATE_LIMIT_PER_MINUTE,
    LLM_RATE_LIMIT_PER_DAY: process.env.LLM_RATE_LIMIT_PER_DAY,

    // Server - LLM Cost Controls
    MAX_TOKENS_PER_REQUEST: process.env.MAX_TOKENS_PER_REQUEST,
    MAX_COST_PER_DOCUMENT: process.env.MAX_COST_PER_DOCUMENT,

    // Server - Email
    RESEND_API_KEY: process.env.RESEND_API_KEY,
    FROM_EMAIL: process.env.FROM_EMAIL,

    // Server - Storage
    UPLOAD_DIR: process.env.UPLOAD_DIR,

    // Server - Rate Limiting
    RATE_LIMIT_MAX: process.env.RATE_LIMIT_MAX,
    RATE_LIMIT_WINDOW: process.env.RATE_LIMIT_WINDOW,

    // Server - Vector Store
    PINECONE_API_KEY: process.env.PINECONE_API_KEY,
    PINECONE_ENVIRONMENT: process.env.PINECONE_ENVIRONMENT,
    PGVECTOR_ENABLED: process.env.PGVECTOR_ENABLED,

    // Client - Application
    NEXT_PUBLIC_APP_URL: process.env.NEXT_PUBLIC_APP_URL,

    // Client - Analytics
    NEXT_PUBLIC_POSTHOG_KEY: process.env.NEXT_PUBLIC_POSTHOG_KEY,
    NEXT_PUBLIC_POSTHOG_HOST: process.env.NEXT_PUBLIC_POSTHOG_HOST,

    // Client - Feature Flags
    NEXT_PUBLIC_ENABLE_BIOGRAPHY: process.env.NEXT_PUBLIC_ENABLE_BIOGRAPHY,
    NEXT_PUBLIC_ENABLE_CASE_SUMMARY: process.env.NEXT_PUBLIC_ENABLE_CASE_SUMMARY,
    NEXT_PUBLIC_ENABLE_BUSINESS_PLAN: process.env.NEXT_PUBLIC_ENABLE_BUSINESS_PLAN,
    NEXT_PUBLIC_ENABLE_MEDICAL_REPORT: process.env.NEXT_PUBLIC_ENABLE_MEDICAL_REPORT,
    NEXT_PUBLIC_ENABLE_GRANT_PROPOSAL: process.env.NEXT_PUBLIC_ENABLE_GRANT_PROPOSAL,
  },

  /**
   * Skip validation in specific environments
   * Useful for Docker builds where env vars aren't available at build time
   */
  skipValidation: !!process.env.SKIP_ENV_VALIDATION,

  /**
   * Treat empty strings as undefined
   * Makes the schema more forgiving
   */
  emptyStringAsUndefined: true,
});