// src/server/services/llm/providers/openai.ts
import OpenAI from "openai";
import type {
  LLMProvider,
  CompletionParams,
  CompletionResponse,
} from "../base";
import { env } from "~/env";

export class OpenAIProvider implements LLMProvider {
  name = "openai";
  private client: OpenAI;

  constructor(apiKey?: string) {
    this.client = new OpenAI({
      apiKey: apiKey || env.OPENAI_API_KEY,
    });
  }

  async generateCompletion(
    params: CompletionParams,
  ): Promise<CompletionResponse> {
    const messages: OpenAI.Chat.ChatCompletionMessageParam[] = [];

    if (params.systemPrompt) {
      messages.push({ role: "system", content: params.systemPrompt });
    }

    messages.push({ role: "user", content: params.prompt });

    const completion = await this.client.chat.completions.create({
      model: params.model || "gpt-4-turbo-preview",
      messages,
      temperature: params.temperature ?? 0.7,
      max_tokens: params.maxTokens,
    });

    const response = completion.choices[0]?.message?.content || "";
    const usage = completion.usage || {
      prompt_tokens: 0,
      completion_tokens: 0,
      total_tokens: 0,
    };

    return {
      content: response,
      promptTokens: usage.prompt_tokens,
      completionTokens: usage.completion_tokens,
      totalTokens: usage.total_tokens,
      model: completion.model,
    };
  }

  countTokens(text: string): number {
    // Rough estimation: ~4 characters per token
    return Math.ceil(text.length / 4);
  }

  estimateCost(tokens: number, model: string): number {
    const pricing: Record<string, { input: number; output: number }> = {
      "gpt-4-turbo-preview": { input: 0.01, output: 0.03 },
      "gpt-4": { input: 0.03, output: 0.06 },
      "gpt-3.5-turbo": { input: 0.001, output: 0.002 },
    };

    const modelPricing = pricing[model] || pricing["gpt-4-turbo-preview"];
    // Assume 60/40 split between input/output tokens
    return (
      (tokens * 0.6 * modelPricing.input + tokens * 0.4 * modelPricing.output) /
      1000
    );
  }
}
