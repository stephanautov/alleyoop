import { EventEmitter } from 'events';
import { LLMService } from './index'; // Your existing service

export class LLMServiceWithEvents extends EventEmitter {
    private llmService: LLMService;

    constructor(config: any) {
        super();
        this.llmService = new LLMService(config);
    }

    async generateDocument(params: any) {
        this.emit('progress', { progress: 0, message: 'Starting' });

        // Call your existing methods
        const outline = await this.llmService.generateOutline(params);
        this.emit('progress', { progress: 30, message: 'Outline complete' });

        const sections = await this.llmService.generateSections(params, outline);
        this.emit('progress', { progress: 80, message: 'Sections complete' });

        const content = await this.llmService.generateFinalContent(params, sections);
        this.emit('progress', { progress: 100, message: 'Complete' });

        return { outline, sections, content };
    }

    // Proxy other methods as needed
    async generateOutline(params: any) {
        return this.llmService.generateOutline(params);
    }

    async generateSection(params: any) {
        return this.llmService.generateSection(params);
    }
}