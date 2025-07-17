// src/server/services/llm/prompts/medical-report.ts
// ============================================

import { z } from 'zod';
import { medicalReportSchema } from '~/config/schemas/medical-report';

type MedicalReportInput = z.infer<typeof medicalReportSchema>;

export const medicalReportPrompts = {
    // System prompts optimized per provider
    systemPrompts: {
        openai: `You are an experienced medical professional skilled in creating clear, accurate medical reports. You excel at organizing clinical information in a logical manner while maintaining HIPAA compliance and medical accuracy. Note: All generated content is for educational or template purposes only.`,

        anthropic: `You are a thoughtful medical writer who creates comprehensive, patient-centered medical reports. You balance clinical precision with clarity, ensuring reports are both medically accurate and understandable. Note: All generated content is for educational or template purposes only.`,

        gemini: `You are a detail-oriented medical documentation specialist who creates thorough, well-organized medical reports. You ensure all relevant clinical information is included while maintaining professional standards. Note: All generated content is for educational or template purposes only.`,

        perplexity: `You are a research-focused medical writer who creates evidence-based medical reports with proper references to current medical literature and guidelines. Note: All generated content is for educational or template purposes only.`,

        llama: `You are a practical medical report writer who creates clear, standardized medical documentation. You focus on essential clinical information and follow established medical reporting formats. Note: All generated content is for educational or template purposes only.`
    },

    // Outline generation prompt
    outline: (input: MedicalReportInput, provider: string) => {
        const reportType = input.reportType;
        const specialty = input.specialty;

        let providerSpecific = '';

        if (provider === 'perplexity') {
            providerSpecific = `\n\nIMPORTANT: Include references to relevant clinical guidelines and medical literature where appropriate.`;
        }

        return `Create a detailed outline for a ${reportType} medical report template.

IMPORTANT DISCLAIMER: This is for creating a template/educational example only. 
No real patient data should be used. Use placeholder information marked clearly as [PLACEHOLDER].

Report Details:
- Report Type: ${reportType}
- Medical Specialty: ${specialty}
- Purpose: ${input.reportPurpose}
- Setting: ${input.clinicalSetting}
- Include Sections: ${input.includeSections.join(', ')}

Requirements:
- Comply with HIPAA standards (use placeholders for all PHI)
- Follow ${specialty} specialty conventions
- Include standard medical terminology
- Maintain professional medical documentation standards
${providerSpecific}

Generate a JSON outline with the following structure:
{
  "title": "${reportType} Report Template",
  "header": {
    "patient_info": "[PLACEHOLDER: Patient demographics]",
    "report_info": "[PLACEHOLDER: Report ID, dates, provider info]"
  },
  "sections": {
    "chief_complaint": {
      "title": "Chief Complaint",
      "content_type": "narrative",
      "required": true
    },
    "history_present_illness": {
      "title": "History of Present Illness",
      "content_points": ["Onset", "Location", "Duration", "Character", "Associated symptoms", "Modifying factors"],
      "format": "OLDCART_method"
    },
    "past_medical_history": {
      "title": "Past Medical History",
      "subsections": ["Medical conditions", "Surgical history", "Medications", "Allergies"],
      "format": "structured_list"
    },
    "physical_examination": {
      "title": "Physical Examination",
      "subsections": ["Vital signs", "General appearance", "System-specific findings"],
      "specialty_focus": "${specialty}"
    },
    "diagnostic_results": {
      "title": "Diagnostic Results",
      "content_points": ["Laboratory results", "Imaging findings", "Other diagnostics"],
      "format": "tabular_where_appropriate"
    },
    "assessment_plan": {
      "title": "Assessment and Plan",
      "format": "problem_based",
      "include": ["Diagnosis", "Treatment plan", "Follow-up", "Patient education"]
    }
  }
}`;
    },

    // Section generation for medical reports
    section: (
        sectionId: string,
        sectionOutline: any,
        fullOutline: any,
        originalInput: MedicalReportInput,
        previousSections?: Record<string, string>
    ) => {
        return `Write the "${sectionOutline.title}" section of the medical report template.

REMINDER: Use [PLACEHOLDER] for any patient-specific information.
This is a template for ${originalInput.reportType} in ${originalInput.specialty}.

Section Requirements:
${JSON.stringify(sectionOutline, null, 2)}

Writing Requirements:
1. Use standard medical terminology
2. Follow ${originalInput.specialty} documentation conventions
3. Include all required elements for this section
4. Maintain clinical objectivity
5. Use appropriate medical abbreviations
6. Structure for clarity and completeness

Format: ${sectionOutline.format || 'narrative'}

Example format:
"The patient is a [PLACEHOLDER: age] year old [PLACEHOLDER: gender] who presents with..."`;
    },

    // Refinement for medical reports
    refinement: (content: string, input: MedicalReportInput) => {
        return `Review and refine this ${input.reportType} medical report template.

Current content:
${content}

Refinement goals:
1. Ensure all placeholders are clearly marked
2. Verify medical terminology is accurate and current
3. Check compliance with standard medical documentation practices
4. Ensure appropriate level of detail for ${input.specialty}
5. Verify logical flow and organization
6. Confirm all required sections are complete
7. Add disclaimer about template/educational use if not present

Maintain professional medical documentation standards throughout.`;
    }
};



