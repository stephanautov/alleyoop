import { z } from "zod";

export const baseDocumentSchema = z.object({
    title: z.string().min(1).max(200).default(''),
    outputLength: z.enum(["short", "medium", "long"]).default("medium"),
    language: z.enum(["en", "es", "fr", "de"]).default("en"),
});
