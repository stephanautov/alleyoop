-- Add missing role field to User table (if not exists)
ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "role" TEXT DEFAULT 'USER';

-- Create GeneratorMetrics table if needed for the enhanced generator system
CREATE TABLE IF NOT EXISTS "GeneratorMetrics" (
    "id" TEXT NOT NULL,
    "generator" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "success" BOOLEAN NOT NULL DEFAULT true,
    "duration" INTEGER NOT NULL,
    "filesGenerated" INTEGER NOT NULL DEFAULT 0,
    "error" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "GeneratorMetrics_pkey" PRIMARY KEY ("id")
);

-- Create GeneratorError table if needed
CREATE TABLE IF NOT EXISTS "GeneratorError" (
    "id" TEXT NOT NULL,
    "generator" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "error" TEXT NOT NULL,
    "stack" TEXT,
    "context" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "GeneratorError_pkey" PRIMARY KEY ("id")
);

-- Add indexes
CREATE INDEX IF NOT EXISTS "GeneratorMetrics_userId_idx" ON "GeneratorMetrics"("userId");
CREATE INDEX IF NOT EXISTS "GeneratorMetrics_generator_idx" ON "GeneratorMetrics"("generator");
CREATE INDEX IF NOT EXISTS "GeneratorError_userId_idx" ON "GeneratorError"("userId");

-- Add foreign key constraints
ALTER TABLE "GeneratorMetrics" ADD CONSTRAINT "GeneratorMetrics_userId_fkey" 
    FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "GeneratorError" ADD CONSTRAINT "GeneratorError_userId_fkey" 
    FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;