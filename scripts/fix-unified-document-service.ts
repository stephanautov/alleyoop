// scripts/fix-unified-document-service.ts
// Run with: npx tsx scripts/fix-unified-document-service.ts

import fs from 'fs/promises';
import path from 'path';

const WRAPPER_CLASS = `
// LLM Service Wrapper to add EventEmitter capabilities
class LLMServiceWrapper extends EventEmitter {
    constructor(private llmService: LLMService) {
        super();
    }

    async generateDocument(params: any): Promise<any> {
        const documentId = params.config?.documentId;
        
        // Emit initial progress
        this.emit('progress', {
            documentId,
            stage: 'initializing',
            progress: 0,
            message: 'Starting document generation...'
        });

        try {
            // Call the actual LLM service method
            const result = await this.llmService.generate(params);

            // Emit completion
            this.emit('progress', {
                documentId,
                stage: 'complete',
                progress: 100,
                message: 'Document generation complete'
            });

            return result;
        } catch (error) {
            this.emit('error', { documentId, error });
            throw error;
        }
    }
}
`;

async function fixUnifiedDocumentService() {
    const filePath = path.join(process.cwd(), 'src/server/services/document/unified-document-service.ts');

    try {
        // Read the file
        let content = await fs.readFile(filePath, 'utf-8');

        // Backup original
        await fs.writeFile(filePath + '.backup', content);
        console.log('✅ Created backup file');

        // Apply fixes
        console.log('🔧 Applying fixes...');

        // Fix 1: CacheService constructor
        content = content.replace(
            /new CacheService\(db\)/g,
            'getCacheService()'
        );
        console.log('✅ Fixed CacheService initialization');

        // Fix 2: Add CacheType to imports
        if (!content.includes('CacheType')) {
            content = content.replace(
                /import \{ getCacheService.*? \} from '\.\.\/cache'/,
                "import { getCacheService, getCacheManager, CacheType } from '../cache'"
            );
            console.log('✅ Added CacheType import');
        }

        // Fix 3: Add EventEmitter import if missing
        if (!content.includes("import { EventEmitter }")) {
            const lastImportIndex = content.lastIndexOf('import');
            const nextLineIndex = content.indexOf('\n', lastImportIndex);
            content = content.slice(0, nextLineIndex + 1) +
                "import { EventEmitter } from 'events';\n" +
                content.slice(nextLineIndex + 1);
            console.log('✅ Added EventEmitter import');
        }

        // Fix 4: Add LLMServiceWrapper class after imports
        if (!content.includes('class LLMServiceWrapper')) {
            const classIndex = content.indexOf('export class UnifiedDocumentService');
            content = content.slice(0, classIndex) +
                WRAPPER_CLASS + '\n' +
                content.slice(classIndex);
            console.log('✅ Added LLMServiceWrapper class');
        }

        // Fix 5: Fix cached.estimatedCost
        content = content.replace(
            /cached\.estimatedCost/g,
            'cached.metadata.costSaved'
        );
        console.log('✅ Fixed cache cost access');

        // Fix 6: Remove systemPromptStyle from cache key
        content = content.replace(
            /systemPromptStyle: config\.systemPrompt,?\n?\s*/g,
            ''
        );
        console.log('✅ Removed systemPromptStyle from cache keys');

        // Fix 7: Fix ragEnabled to ragContext
        content = content.replace(
            /ragEnabled: config\.useRAG,/g,
            'ragContext: config.useRAG ? { enabled: true, threshold: config.ragThreshold } : null,'
        );
        console.log('✅ Fixed ragEnabled to ragContext');

        // Fix 8: Fix content field to sections
        content = content.replace(
            /^\s*content: result\.content,$/gm,
            '                sections: result.sections || { fullContent: result.content },'
        );
        console.log('✅ Fixed content to sections field');

        // Fix 9: Add type annotation for styleModifiers
        content = content.replace(
            /const styleModifiers = \{/g,
            'const styleModifiers: Record<string, string> = {'
        );
        console.log('✅ Added styleModifiers type annotation');

        // Fix 10: Fix metadata object in error handler
        content = content.replace(
            /metadata: \{\s*error: error\.message,\s*provider: config\.provider,\s*model: config\.model,\s*\}/g,
            'error: error.message,\n                failedAt: new Date(),\n                provider: config.provider,\n                model: config.model,'
        );
        console.log('✅ Fixed metadata fields in error handler');

        // Fix 11: Update generateWithProgress to use wrapper
        const generateWithProgressMatch = content.match(/private async generateWithProgress\([^{]*\{/);
        if (generateWithProgressMatch) {
            const startIndex = generateWithProgressMatch.index! + generateWithProgressMatch[0].length;
            const functionContent = extractFunctionBody(content, startIndex);

            // Replace llmService with wrapped version
            let newFunctionContent = functionContent;

            // Add wrapper creation
            if (!newFunctionContent.includes('LLMServiceWrapper')) {
                newFunctionContent = '\n        // Create wrapped LLM service with event emitter\n' +
                    '        const wrappedLLMService = new LLMServiceWrapper(this.llmService);\n\n' +
                    newFunctionContent;
            }

            // Replace this.llmService with wrappedLLMService
            newFunctionContent = newFunctionContent.replace(
                /this\.llmService\.on\(/g,
                'wrappedLLMService.on('
            );
            newFunctionContent = newFunctionContent.replace(
                /this\.llmService\.generateDocument\(/g,
                'wrappedLLMService.generateDocument('
            );
            newFunctionContent = newFunctionContent.replace(
                /this\.llmService\.removeAllListeners\(/g,
                'wrappedLLMService.removeAllListeners('
            );

            // Replace in content
            content = content.slice(0, startIndex) +
                newFunctionContent +
                content.slice(startIndex + functionContent.length);

            console.log('✅ Updated generateWithProgress to use wrapper');
        }

        // Write the fixed content
        await fs.writeFile(filePath, content);
        console.log('\n✅ All fixes applied!');

        console.log('\n📋 Next steps:');
        console.log('1. Review the changes');
        console.log('2. Run: npm run build');
        console.log('3. Fix any remaining type errors manually');

    } catch (error) {
        console.error('❌ Error:', error);
        console.log('\n💡 Alternative: Use the complete fixed version from the artifacts');
    }
}

function extractFunctionBody(content: string, startIndex: number): string {
    let braceCount = 1;
    let i = startIndex;

    while (i < content.length && braceCount > 0) {
        if (content[i] === '{') braceCount++;
        if (content[i] === '}') braceCount--;
        i++;
    }

    return content.slice(startIndex, i - 1);
}

// Run the fix
fixUnifiedDocumentService().catch(console.error);