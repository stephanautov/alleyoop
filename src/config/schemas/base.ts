import { z } from "zod";

export const baseDocumentSchema = z.object({
<<<<<<< HEAD
    title: z.string().min(1).max(200).default(''),
    outputLength: z.enum(["short", "medium", "long"]).default("medium"),
    language: z.enum(["en", "es", "fr", "de"]).default("en"),
=======
  title: z.string().min(1).max(200).default(""),
  outputLength: z.enum(["short", "medium", "long"]).default("medium"),
  language: z.enum(["en", "es", "fr", "de"]).default("en"),
>>>>>>> 274f729c831bd20c718b4330ccf805c6875e082e
});
