//src/lib/ai/index.ts

import { OpenAI } from "openai";
import Anthropic from "@anthropic-ai/sdk";
import { env } from "~/env";
import { DocumentType } from "@prisma/client";
import { getDocumentConfig } from "~/config/documents";
import { z } from "zod";

// Initialize AI clients
const openai = new OpenAI({
  apiKey: env.OPENAI_API_KEY,
});

const anthropic = env.ANTHROPIC_API_KEY
  ? new Anthropic({
      apiKey: env.ANTHROPIC_API_KEY,
    })
  : null;

// AI Provider types
export type AIProvider = "openai" | "anthropic";
export type AIModel =
  | "gpt-4-turbo-preview"
  | "gpt-3.5-turbo"
  | "claude-3-opus"
  | "claude-3-sonnet";

// Response types
export interface AIResponse {
  content: string;
  model: AIModel;
  promptTokens: number;
  completionTokens: number;
  totalTokens: number;
}

export interface OutlineSection {
  id: string;
  title: string;
  description: string;
  keyPoints: string[];
  estimatedWords: number;
}

export interface GeneratedSection {
  id: string;
  content: string;
  wordCount: number;
}

// Cost calculation
const MODEL_COSTS = {
  "gpt-4-turbo-preview": { input: 0.01, output: 0.03 }, // per 1k tokens
  "gpt-3.5-turbo": { input: 0.0005, output: 0.0015 },
  "claude-3-opus": { input: 0.015, output: 0.075 },
  "claude-3-sonnet": { input: 0.003, output: 0.015 },
};

export function calculateTokenCost(
  model: AIModel,
  promptTokens: number,
  completionTokens: number,
): number {
  const costs = MODEL_COSTS[model];
  if (!costs) return 0;

  return (
    (promptTokens / 1000) * costs.input +
    (completionTokens / 1000) * costs.output
  );
}

/**
 * Main AI service class
 */
export class AIService {
  private provider: AIProvider;
  private model: AIModel;

  constructor(provider: AIProvider = "openai", model?: AIModel) {
    this.provider = provider;
    this.model =
      model ||
      (provider === "openai" ? "gpt-4-turbo-preview" : "claude-3-sonnet");
  }

  /**
   * Generate a completion using the configured AI provider
   */
  async generateCompletion(
    systemPrompt: string,
    userPrompt: string,
    options?: {
      temperature?: number;
      maxTokens?: number;
      format?: "text" | "json";
    },
  ): Promise<AIResponse> {
    if (this.provider === "openai") {
      return this.generateOpenAICompletion(systemPrompt, userPrompt, options);
    } else if (this.provider === "anthropic" && anthropic) {
      return this.generateAnthropicCompletion(
        systemPrompt,
        userPrompt,
        options,
      );
    } else {
      throw new Error(`AI provider ${this.provider} is not available`);
    }
  }

  private async generateOpenAICompletion(
    systemPrompt: string,
    userPrompt: string,
    options?: {
      temperature?: number;
      maxTokens?: number;
      format?: "text" | "json";
    },
  ): Promise<AIResponse> {
    const completion = await openai.chat.completions.create({
      model: this.model as string,
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: userPrompt },
      ],
      temperature: options?.temperature ?? 0.7,
      max_tokens: options?.maxTokens ?? 2000,
      response_format:
        options?.format === "json" ? { type: "json_object" } : undefined,
    });

    const message = completion.choices[0]?.message;
    if (!message?.content) {
      throw new Error("No response from OpenAI");
    }

    return {
      content: message.content,
      model: this.model,
      promptTokens: completion.usage?.prompt_tokens ?? 0,
      completionTokens: completion.usage?.completion_tokens ?? 0,
      totalTokens: completion.usage?.total_tokens ?? 0,
    };
  }

  private async generateAnthropicCompletion(
    systemPrompt: string,
    userPrompt: string,
    options?: {
      temperature?: number;
      maxTokens?: number;
      format?: "text" | "json";
    },
  ): Promise<AIResponse> {
    if (!anthropic) {
      throw new Error("Anthropic client not initialized");
    }

    const response = await anthropic.messages.create({
      model: this.model as any,
      system: systemPrompt,
      messages: [{ role: "user", content: userPrompt }],
      temperature: options?.temperature ?? 0.7,
      max_tokens: options?.maxTokens ?? 2000,
    });

    const content = response.content[0];
    if (!content || content.type !== "text") {
      throw new Error("No text response from Anthropic");
    }

    // Anthropic doesn't provide token counts in the same way
    // Estimate based on content length (rough approximation)
    const estimatedTokens = Math.ceil(
      (systemPrompt.length + userPrompt.length + content.text.length) / 4,
    );

    return {
      content: content.text,
      model: this.model,
      promptTokens: Math.ceil((systemPrompt.length + userPrompt.length) / 4),
      completionTokens: Math.ceil(content.text.length / 4),
      totalTokens: estimatedTokens,
    };
  }

  /**
   * Generate document outline
   */
  async generateOutline(
    documentType: DocumentType,
    input: any,
  ): Promise<{ outline: OutlineSection[]; tokens: number }> {
    const config = getDocumentConfig(documentType);
    const systemPrompt = this.getOutlineSystemPrompt(documentType);
    const userPrompt = this.buildOutlinePrompt(documentType, input, config);

    const response = await this.generateCompletion(systemPrompt, userPrompt, {
      temperature: 0.6,
      maxTokens: 1500,
      format: "json",
    });

    // Parse the JSON response
    const outlineData = JSON.parse(response.content);
    const outline = this.validateOutline(outlineData);

    return {
      outline,
      tokens: response.totalTokens,
    };
  }

  /**
   * Generate a document section
   */
  async generateSection(
    documentType: DocumentType,
    sectionId: string,
    sectionName: string,
    outline: OutlineSection[],
    input: any,
  ): Promise<GeneratedSection & { tokens: number }> {
    const systemPrompt = this.getSectionSystemPrompt(documentType);
    const userPrompt = this.buildSectionPrompt(
      documentType,
      sectionId,
      sectionName,
      outline,
      input,
    );

    const response = await this.generateCompletion(systemPrompt, userPrompt, {
      temperature: 0.7,
      maxTokens: 3000,
    });

    const wordCount = response.content.split(/\s+/).length;

    return {
      id: sectionId,
      content: response.content,
      wordCount,
      tokens: response.totalTokens,
    };
  }

  /**
   * Get system prompts for different document types
   */
  private getOutlineSystemPrompt(documentType: DocumentType): string {
    const basePrompt = `You are an expert document writer specializing in creating high-quality ${documentType.toLowerCase().replace("_", " ")} documents. Your task is to create a detailed outline that will guide the creation of a comprehensive document.

Return your response as a JSON object with the following structure:
{
  "sections": [
    {
      "id": "section_id",
      "title": "Section Title",
      "description": "Brief description of what this section will cover",
      "keyPoints": ["Key point 1", "Key point 2", "Key point 3"],
      "estimatedWords": 500
    }
  ]
}`;

    // Add document-type specific instructions
    const typeSpecificPrompts: Record<DocumentType, string> = {
      [DocumentType.BIOGRAPHY]:
        "\n\nFor biographies, ensure the outline captures the subject's life chronologically while highlighting their most significant achievements and contributions.",
      [DocumentType.CASE_SUMMARY]:
        "\n\nFor case summaries, ensure the outline follows legal writing conventions and includes all essential elements of case analysis.",
      [DocumentType.BUSINESS_PLAN]:
        "\n\nFor business plans, ensure the outline addresses all key aspects investors and stakeholders would expect, with emphasis on market opportunity and financial projections.",
      [DocumentType.MEDICAL_REPORT]:
        "\n\nFor medical reports, ensure the outline follows standard medical documentation practices and includes appropriate disclaimers.",
      [DocumentType.GRANT_PROPOSAL]:
        "\n\nFor grant proposals, ensure the outline demonstrates clear need, feasibility, and impact, following standard grant writing best practices.",
    };

    return basePrompt + (typeSpecificPrompts[documentType] ?? "");
  }

  private getSectionSystemPrompt(documentType: DocumentType): string {
    return `You are an expert document writer creating a ${documentType.toLowerCase().replace("_", " ")}. Write the requested section following the outline provided. 

Guidelines:
- Write in a clear, professional, and engaging style
- Use appropriate formatting (paragraphs, lists where suitable)
- Ensure accuracy and attention to detail
- Maintain consistency with the document type and purpose
- Follow any specific requirements mentioned in the input`;
  }

  /**
   * Build prompts for outline generation
   */
  private buildOutlinePrompt(
    documentType: DocumentType,
    input: any,
    config: any,
  ): string {
    const sections = config.sections.map((s: any) => s.name).join(", ");

    return `Create a detailed outline for a ${config.name} with the following specifications:

Input Details:
${JSON.stringify(input, null, 2)}

Required Sections:
${sections}

Output Length: ${input.outputLength ?? "medium"}
Purpose: ${input.purpose ?? "general"}

Please create an outline that:
1. Covers all required sections comprehensively
2. Is tailored to the specific input provided
3. Maintains appropriate depth for the output length specified
4. Follows best practices for ${config.name} documents`;
  }

  /**
   * Build prompts for section generation
   */
  private buildSectionPrompt(
    documentType: DocumentType,
    sectionId: string,
    sectionName: string,
    outline: OutlineSection[],
    input: any,
  ): string {
    const section = outline.find((s) => s.id === sectionId);
    const outlineText = outline
      .map((s) => `- ${s.title}: ${s.description}`)
      .join("\n");

    return `Write the "${sectionName}" section for this document.

Document Outline:
${outlineText}

Current Section Details:
${section ? `- ${section.title}: ${section.description}\n- Key Points: ${section.keyPoints.join(", ")}\n- Target Length: ${section.estimatedWords} words` : sectionName}

Input Details:
${JSON.stringify(input, null, 2)}

Requirements:
1. Write approximately ${section?.estimatedWords || 500} words
2. Cover all key points mentioned
3. Maintain consistency with the overall document structure
4. Use appropriate formatting and structure
5. Ensure smooth transitions from previous sections`;
  }

  /**
   * Validate outline structure
   */
  private validateOutline(data: any): OutlineSection[] {
    const outlineSchema = z.object({
      sections: z.array(
        z.object({
          id: z.string(),
          title: z.string(),
          description: z.string(),
          keyPoints: z.array(z.string()),
          estimatedWords: z.number(),
        }),
      ),
    });

    const validated = outlineSchema.parse(data);
    return validated.sections;
  }

  /**
   * Enhance content with citations (if needed)
   */
  async enhanceWithCitations(
    content: string,
    citationStyle: "apa" | "mla" | "chicago" | "bluebook",
  ): Promise<string> {
    const systemPrompt = `You are an expert in ${citationStyle.toUpperCase()} citation format. Add appropriate placeholder citations to the provided content where academic sources would typically be cited.`;

    const userPrompt = `Add ${citationStyle.toUpperCase()} style citations to this content. Use placeholder citations like [Author, Year] or [1] as appropriate for the style. Do not invent specific sources, just indicate where citations would go.

Content:
${content}`;

    const response = await this.generateCompletion(systemPrompt, userPrompt, {
      temperature: 0.3,
      maxTokens: content.length + 500,
    });

    return response.content;
  }

  /**
   * Generate title suggestions
   */
  async generateTitleSuggestions(
    documentType: DocumentType,
    input: any,
    count = 5,
  ): Promise<string[]> {
    const config = getDocumentConfig(documentType);
    const systemPrompt = `You are an expert at creating compelling titles for ${config.name} documents.`;

    const userPrompt = `Generate ${count} title suggestions for a ${config.name} based on:
${JSON.stringify(input, null, 2)}

Return a JSON array of title strings. Make them specific, professional, and engaging.`;

    const response = await this.generateCompletion(systemPrompt, userPrompt, {
      temperature: 0.8,
      maxTokens: 500,
      format: "json",
    });

    const titles = JSON.parse(response.content);
    return Array.isArray(titles) ? titles : titles.titles || [];
  }

  /**
   * Summarize document
   */
  async summarizeDocument(
    sections: Array<{ content: string }>,
    maxLength = 500,
  ): Promise<string> {
    const fullContent = sections.map((s) => s.content).join("\n\n");

    const systemPrompt =
      "You are an expert at creating concise, informative summaries.";
    const userPrompt = `Create a ${maxLength}-word executive summary of this document:

${fullContent.substring(0, 8000)} // Limit input to avoid token limits

Requirements:
- Maximum ${maxLength} words
- Cover all main points
- Professional tone
- Clear and concise`;

    const response = await this.generateCompletion(systemPrompt, userPrompt, {
      temperature: 0.5,
      maxTokens: Math.ceil(maxLength * 1.5),
    });

    return response.content;
  }
}

// Export singleton instance
export const aiService = new AIService();
