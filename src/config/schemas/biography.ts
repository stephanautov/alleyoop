// src/config/schemas/biography.ts
import { z } from "zod";
import { baseDocumentSchema } from "./base";

export const biographySchema = baseDocumentSchema.extend({
    subject: z.object({
        name: z.string().min(1).default(''),
        occupation: z.string().optional().default(''),
        birthDate: z.string().optional().default(''),
        birthPlace: z.string().optional().default(''),
    }).default({
        name: '',
        occupation: '',
        birthDate: '',
        birthPlace: ''
    }),
    purpose: z.enum(["professional", "academic", "personal", "wikipedia"]).default("professional"),
    tone: z.enum(["formal", "conversational", "inspirational"]).default("formal"),
    focusAreas: z.array(z.enum([
        "early_life",
        "education",
        "career",
        "achievements",
        "personal_life",
        "legacy",
        "publications",
        "awards"
    ])).default(["early_life", "education", "career", "achievements"]),
    additionalInfo: z.string().optional().default(''),
});

export const biographyFieldConfig = {
    "subject.name": {
        label: "Subject's Full Name",
        placeholder: "Enter the person's full name",
    },
    "subject.occupation": {
        label: "Occupation/Title",
        placeholder: "e.g., Software Engineer, CEO, Artist",
    },
    "subject.birthDate": {
        label: "Birth Date (Optional)",
        type: "date",
    },
    "subject.birthPlace": {
        label: "Birth Place (Optional)",
        placeholder: "City, Country",
    },
    purpose: {
        label: "Biography Purpose",
        options: [
            { value: "professional", label: "Professional (LinkedIn, Resume)" },
            { value: "academic", label: "Academic (Research, Publication)" },
            { value: "personal", label: "Personal (Family, Memorial)" },
            { value: "wikipedia", label: "Wikipedia Style" },
        ],
    },
    tone: {
        label: "Writing Tone",
        options: [
            { value: "formal", label: "Formal" },
            { value: "conversational", label: "Conversational" },
            { value: "inspirational", label: "Inspirational" },
        ],
    },
    focusAreas: {
        label: "Areas to Cover",
        description: "Select which aspects of their life to include",
        multiple: true,
        options: [
            { value: "early_life", label: "Early Life & Background" },
            { value: "education", label: "Education" },
            { value: "career", label: "Career Journey" },
            { value: "achievements", label: "Major Achievements" },
            { value: "personal_life", label: "Personal Life" },
            { value: "legacy", label: "Legacy & Impact" },
            { value: "publications", label: "Publications & Works" },
            { value: "awards", label: "Awards & Recognition" },
        ],
    },
    additionalInfo: {
        label: "Additional Information",
        placeholder: "Any specific details, anecdotes, or requirements",
        type: "textarea",
        rows: 4,
    },
};