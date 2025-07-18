// src/config/schemas/medical-report.ts
import { z } from "zod";
import { baseDocumentSchema } from "./base";

export const medicalReportSchema = baseDocumentSchema.extend({
    reportType: z
        .enum([
            "consultation",
            "progress_note",
            "discharge_summary",
            "history_physical",
            "operative_report",
            "diagnostic_report",
            "procedure_note",
            "emergency_report",
        ])
        .default("consultation"),

    specialty: z
        .enum([
            "general_practice",
            "internal_medicine",
            "cardiology",
            "neurology",
            "orthopedics",
            "pediatrics",
            "psychiatry",
            "radiology",
            "emergency_medicine",
            "surgery",
            "obstetrics_gynecology",
            "dermatology",
            "ophthalmology",
            "other",
        ])
        .default("general_practice"),

    reportPurpose: z
        .enum([
            "initial_consultation",
            "follow_up",
            "second_opinion",
            "pre_operative",
            "post_operative",
            "diagnostic",
            "treatment_summary",
            "insurance_documentation",
            "referral",
            "legal_documentation",
        ])
        .default("initial_consultation"),

    clinicalSetting: z
        .enum([
            "hospital_inpatient",
            "hospital_outpatient",
            "emergency_department",
            "private_clinic",
            "specialty_clinic",
            "urgent_care",
            "telemedicine",
            "home_visit",
        ])
        .default("hospital_outpatient"),

    includeSections: z
        .array(
            z.enum([
                "chief_complaint",
                "history_present_illness",
                "past_medical_history",
                "medications",
                "allergies",
                "social_history",
                "family_history",
                "review_of_systems",
                "physical_examination",
                "diagnostic_results",
                "assessment",
                "plan",
                "prognosis",
                "recommendations",
                "follow_up",
            ])
        )
        .default([
            "chief_complaint",
            "history_present_illness",
            "physical_examination",
            "assessment",
            "plan",
        ]),

    includeDisclaimer: z
        .boolean()
        .default(true)
        .describe("Include disclaimer about AI-generated content"),

    templateOnly: z
        .boolean()
        .default(true)
        .describe("Generate as template with placeholders for PHI"),
});

export const medicalReportFieldConfig = {
    reportType: {
        label: "Report Type",
        description: "Select the type of medical report to generate",
        options: [
            { value: "consultation", label: "Consultation Report" },
            { value: "progress_note", label: "Progress Note" },
            { value: "discharge_summary", label: "Discharge Summary" },
            { value: "history_physical", label: "History & Physical (H&P)" },
            { value: "operative_report", label: "Operative Report" },
            { value: "diagnostic_report", label: "Diagnostic Report" },
            { value: "procedure_note", label: "Procedure Note" },
            { value: "emergency_report", label: "Emergency Department Report" },
        ],
    },

    specialty: {
        label: "Medical Specialty",
        description: "Select the medical specialty for appropriate terminology and focus",
        options: [
            { value: "general_practice", label: "General Practice" },
            { value: "internal_medicine", label: "Internal Medicine" },
            { value: "cardiology", label: "Cardiology" },
            { value: "neurology", label: "Neurology" },
            { value: "orthopedics", label: "Orthopedics" },
            { value: "pediatrics", label: "Pediatrics" },
            { value: "psychiatry", label: "Psychiatry" },
            { value: "radiology", label: "Radiology" },
            { value: "emergency_medicine", label: "Emergency Medicine" },
            { value: "surgery", label: "General Surgery" },
            { value: "obstetrics_gynecology", label: "Obstetrics & Gynecology" },
            { value: "dermatology", label: "Dermatology" },
            { value: "ophthalmology", label: "Ophthalmology" },
            { value: "other", label: "Other Specialty" },
        ],
    },

    reportPurpose: {
        label: "Report Purpose",
        description: "What is the primary purpose of this report?",
        options: [
            { value: "initial_consultation", label: "Initial Consultation" },
            { value: "follow_up", label: "Follow-up Visit" },
            { value: "second_opinion", label: "Second Opinion" },
            { value: "pre_operative", label: "Pre-operative Assessment" },
            { value: "post_operative", label: "Post-operative Report" },
            { value: "diagnostic", label: "Diagnostic Findings" },
            { value: "treatment_summary", label: "Treatment Summary" },
            { value: "insurance_documentation", label: "Insurance Documentation" },
            { value: "referral", label: "Referral Documentation" },
            { value: "legal_documentation", label: "Legal Documentation" },
        ],
    },

    clinicalSetting: {
        label: "Clinical Setting",
        description: "Where is this report being generated?",
        options: [
            { value: "hospital_inpatient", label: "Hospital - Inpatient" },
            { value: "hospital_outpatient", label: "Hospital - Outpatient" },
            { value: "emergency_department", label: "Emergency Department" },
            { value: "private_clinic", label: "Private Clinic" },
            { value: "specialty_clinic", label: "Specialty Clinic" },
            { value: "urgent_care", label: "Urgent Care Center" },
            { value: "telemedicine", label: "Telemedicine Visit" },
            { value: "home_visit", label: "Home Visit" },
        ],
    },

    includeSections: {
        label: "Sections to Include",
        description: "Select which sections to include in the report",
        multiple: true,
        options: [
            { value: "chief_complaint", label: "Chief Complaint" },
            { value: "history_present_illness", label: "History of Present Illness" },
            { value: "past_medical_history", label: "Past Medical History" },
            { value: "medications", label: "Current Medications" },
            { value: "allergies", label: "Allergies" },
            { value: "social_history", label: "Social History" },
            { value: "family_history", label: "Family History" },
            { value: "review_of_systems", label: "Review of Systems" },
            { value: "physical_examination", label: "Physical Examination" },
            { value: "diagnostic_results", label: "Diagnostic Results" },
            { value: "assessment", label: "Assessment" },
            { value: "plan", label: "Plan" },
            { value: "prognosis", label: "Prognosis" },
            { value: "recommendations", label: "Recommendations" },
            { value: "follow_up", label: "Follow-up Instructions" },
        ],
    },

    includeDisclaimer: {
        label: "Include AI Disclaimer",
        description: "Add a disclaimer that this is AI-generated content for educational/template purposes",
    },

    templateOnly: {
        label: "Generate as Template",
        description: "Create with placeholders for patient information (HIPAA compliant)",
    },
};

// Export type for use in other files
export type MedicalReportInput = z.infer<typeof medicalReportSchema>;