import { z } from "zod";

export const baseDocumentSchema = z.object({
  title: z.string().min(1).max(200).default("Untitled Document"),
  outputLength: z.enum(["short", "medium", "long"]).default("medium"),
  language: z.enum(["en", "es", "fr", "de"]).default("en"),
});
