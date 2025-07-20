'use client';

import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@clerk/nextjs';
import { api } from '~/trpc/react';
import { DocumentType } from '@prisma/client';
import {
  FileText,
  Briefcase,
  Gavel,
  Heart,
  FileCheck,
  ArrowRight,
  Loader2,
  DollarSign,
  Info
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

// Import existing components
import { FormGenerator } from '~/components/forms/form-generator';
import { ProviderSelector } from '~/components/llm/provider-selector';
import { DocumentFormWithRAG } from '~/components/forms/rag-integration';
import { ProgressModal } from '~/components/progress/progress-modal';

// Document type configuration
const DOCUMENT_TYPES = [
  {
    type: DocumentType.BIOGRAPHY,
    name: 'Biography',
    description: 'Create compelling life stories and personal narratives',
    icon: FileText,
    color: 'blue',
    estimatedTime: '5-10 min',
  },
  {
    type: DocumentType.BUSINESS_PLAN,
    name: 'Business Plan',
    description: 'Comprehensive business strategies and financial projections',
    icon: Briefcase,
    color: 'green',
    estimatedTime: '10-15 min',
  },
  {
    type: DocumentType.CASE_SUMMARY,
    name: 'Case Summary',
    description: 'Legal case analysis and summaries',
    icon: Gavel,
    color: 'purple',
    estimatedTime: '5-10 min',
  },
  {
    type: DocumentType.GRANT_PROPOSAL,
    name: 'Grant Proposal',
    description: 'Funding applications and research proposals',
    icon: Heart,
    color: 'red',
    estimatedTime: '10-20 min',
  },
  {
    type: DocumentType.MEDICAL_REPORT,
    name: 'Medical Report',
    description: 'Clinical reports and medical documentation',
    icon: FileCheck,
    color: 'yellow',
    estimatedTime: '5-10 min',
  },
];

export default function NewDocumentPage() {
  const router = useRouter();
  const { userId } = useAuth();
  const [step, setStep] = useState(1); // 1: Type, 2: Form, 3: Config, 4: Generating
  const [selectedType, setSelectedType] = useState<DocumentType | null>(null);
  const [formData, setFormData] = useState({});
  const [llmConfig, setLLMConfig] = useState({
    provider: 'openai',
    model: 'gpt-4-turbo',
  });
  const [ragConfig, setRAGConfig] = useState({
    ragEnabled: false,
    knowledgeSourceIds: [],
    autoSelect: true,
  });
  const [documentId, setDocumentId] = useState<string | null>(null);
  const [showProgress, setShowProgress] = useState(false);

  // Get document schema and config
  const { data: schemaData } = api.document.getSchema.useQuery(
    { type: selectedType! },
    { enabled: !!selectedType }
  );

  // Check RAG availability
  const { data: ragStatus } = api.knowledge.checkAvailability.useQuery(
    undefined,
    { enabled: step >= 2 }
  );

  // Create document mutation
  const createMutation = api.document.create.useMutation({
    onSuccess: (data) => {
      setDocumentId(data.id);
      setShowProgress(true);
      setStep(4);
    },
    onError: (error) => {
      console.error('Document creation error:', error);
    },
  });

  // Calculate estimated cost
  const estimatedCost = React.useMemo(() => {
    if (!selectedType || !llmConfig.model) return null;

    // Rough estimates based on document type and model
    const baseCosts = {
      'gpt-4-turbo': 0.03,
      'gpt-3.5-turbo': 0.002,
      'claude-3-opus': 0.045,
      'claude-3-sonnet': 0.009,
      'gemini-1.5-pro': 0.01,
    };

    const typeMultipliers = {
      [DocumentType.BIOGRAPHY]: 2,
      [DocumentType.BUSINESS_PLAN]: 3,
      [DocumentType.CASE_SUMMARY]: 1.5,
      [DocumentType.GRANT_PROPOSAL]: 2.5,
      [DocumentType.MEDICAL_REPORT]: 1,
    };

    const base = baseCosts[llmConfig.model] || 0.01;
    const multiplier = typeMultipliers[selectedType] || 1;
    const ragMultiplier = ragConfig.ragEnabled ? 1.2 : 1;

    return (base * multiplier * ragMultiplier).toFixed(3);
  }, [selectedType, llmConfig.model, ragConfig.ragEnabled]);

  const handleTypeSelect = (type: DocumentType) => {
    setSelectedType(type);
    setStep(2);
  };

  const handleFormSubmit = (data: any) => {
    setFormData(data);
    setStep(3);
  };

  const handleGenerate = () => {
    createMutation.mutate({
      type: selectedType!,
      input: formData,
      provider: llmConfig.provider,
      model: llmConfig.model,
      ragEnabled: ragConfig.ragEnabled,
      knowledgeSourceIds: ragConfig.knowledgeSourceIds,
      autoSelectSources: ragConfig.autoSelect,
    });
  };

  const handleComplete = () => {
    if (documentId) {
      router.push(`/documents/${documentId}`);
    }
  };

  return (
    <div className="container mx-auto py-8 px-4 max-w-6xl">
      {/* Progress Steps */}
      <div className="mb-8">
        <div className="flex items-center justify-center space-x-4">
          {[
            { num: 1, label: 'Choose Type' },
            { num: 2, label: 'Enter Details' },
            { num: 3, label: 'Configure AI' },
            { num: 4, label: 'Generate' },
          ].map((s, idx) => (
            <React.Fragment key={s.num}>
              <div className="flex items-center">
                <div
                  className={`w-10 h-10 rounded-full flex items-center justify-center font-medium ${step >= s.num
                    ? 'bg-blue-500 text-white'
                    : 'bg-gray-200 text-gray-500'
                    }`}
                >
                  {step > s.num ? '✓' : s.num}
                </div>
                <span className={`ml-2 ${step >= s.num ? 'text-gray-900' : 'text-gray-500'
                  }`}>
                  {s.label}
                </span>
              </div>
              {idx < 3 && (
                <div className={`flex-1 h-0.5 ${step > s.num ? 'bg-blue-500' : 'bg-gray-200'
                  }`} />
              )}
            </React.Fragment>
          ))}
        </div>
      </div>

      <AnimatePresence mode="wait">
        {/* Step 1: Document Type Selection */}
        {step === 1 && (
          <motion.div
            key="step1"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
          >
            <h1 className="text-3xl font-bold text-gray-900 mb-2 text-center">
              What would you like to create?
            </h1>
            <p className="text-gray-600 text-center mb-8">
              Choose a document type to get started
            </p>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {DOCUMENT_TYPES.map((doc) => {
                const Icon = doc.icon;
                return (
                  <motion.button
                    key={doc.type}
                    whileHover={{ scale: 1.02 }}
                    whileTap={{ scale: 0.98 }}
                    onClick={() => handleTypeSelect(doc.type)}
                    className={`p-6 rounded-xl border-2 text-left transition-all hover:shadow-lg ${selectedType === doc.type
                      ? 'border-blue-500 bg-blue-50'
                      : 'border-gray-200 hover:border-gray-300'
                      }`}
                  >
                    <div className={`inline-flex p-3 rounded-lg bg-${doc.color}-100 text-${doc.color}-600 mb-4`}>
                      <Icon className="h-6 w-6" />
                    </div>
                    <h3 className="font-semibold text-gray-900 mb-1">
                      {doc.name}
                    </h3>
                    <p className="text-sm text-gray-600 mb-3">
                      {doc.description}
                    </p>
                    <div className="flex items-center text-xs text-gray-500">
                      <span>⏱ {doc.estimatedTime}</span>
                    </div>
                  </motion.button>
                );
              })}
            </div>
          </motion.div>
        )}

        {/* Step 2: Document Form */}
        {step === 2 && selectedType && schemaData && (
          <motion.div
            key="step2"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
          >
            <div className="max-w-3xl mx-auto">
              <h2 className="text-2xl font-bold text-gray-900 mb-6">
                Enter Document Details
              </h2>

              <DocumentFormWithRAG
                documentType={selectedType}
                formData={formData}
                onRAGConfigChange={setRAGConfig}
              >
                <FormGenerator
                  schema={schemaData.schema}
                  onSubmit={handleFormSubmit}
                  className="space-y-6"
                >
                  <div className="flex justify-between pt-6">
                    <button
                      type="button"
                      onClick={() => setStep(1)}
                      className="px-6 py-2 text-gray-600 hover:text-gray-900"
                    >
                      Back
                    </button>
                    <button
                      type="submit"
                      className="px-6 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 flex items-center space-x-2"
                    >
                      <span>Continue</span>
                      <ArrowRight className="h-4 w-4" />
                    </button>
                  </div>
                </FormGenerator>
              </DocumentFormWithRAG>
            </div>
          </motion.div>
        )}

        {/* Step 3: AI Configuration */}
        {step === 3 && (
          <motion.div
            key="step3"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            className="max-w-4xl mx-auto"
          >
            <h2 className="text-2xl font-bold text-gray-900 mb-6">
              Configure AI Settings
            </h2>

            {/* Provider Selection */}
            <div className="mb-8">
              <h3 className="text-lg font-medium text-gray-900 mb-4">
                Choose AI Provider & Model
              </h3>
              <ProviderSelector
                value={llmConfig}
                onChange={setLLMConfig}
                documentType={selectedType!}
                showCosts={true}
                showCapabilities={true}
              />
            </div>

            {/* Cost Estimate */}
            <div className="bg-gray-50 rounded-lg p-6 mb-8">
              <div className="flex items-start space-x-3">
                <DollarSign className="h-5 w-5 text-green-600 mt-0.5" />
                <div>
                  <h4 className="font-medium text-gray-900">Estimated Cost</h4>
                  <p className="text-2xl font-bold text-green-600 mt-1">
                    ${estimatedCost}
                  </p>
                  <p className="text-sm text-gray-600 mt-1">
                    This is an estimate. Actual cost may vary based on document length and complexity.
                  </p>
                  {ragConfig.ragEnabled && (
                    <p className="text-sm text-blue-600 mt-2">
                      +20% for RAG enhancement
                    </p>
                  )}
                </div>
              </div>
            </div>

            {/* Generation Summary */}
            <div className="bg-blue-50 rounded-lg p-6 mb-8">
              <h4 className="font-medium text-blue-900 mb-3">
                Ready to Generate:
              </h4>
              <ul className="space-y-2 text-sm text-blue-800">
                <li>• Document Type: {DOCUMENT_TYPES.find(d => d.type === selectedType)?.name}</li>
                <li>• AI Provider: {llmConfig.provider}</li>
                <li>• Model: {llmConfig.model}</li>
                <li>• RAG Enhancement: {ragConfig.ragEnabled ? 'Enabled' : 'Disabled'}</li>
                {ragConfig.ragEnabled && (
                  <li>• Knowledge Sources: {ragConfig.autoSelect ? 'Auto-select' : `${ragConfig.knowledgeSourceIds.length} selected`}</li>
                )}
              </ul>
            </div>

            {/* Action Buttons */}
            <div className="flex justify-between">
              <button
                onClick={() => setStep(2)}
                className="px-6 py-2 text-gray-600 hover:text-gray-900"
              >
                Back
              </button>
              <button
                onClick={handleGenerate}
                disabled={createMutation.isLoading}
                className="px-8 py-3 bg-blue-500 text-white rounded-lg hover:bg-blue-600 disabled:opacity-50 disabled:cursor-not-allowed flex items-center space-x-2 text-lg font-medium"
              >
                {createMutation.isLoading ? (
                  <>
                    <Loader2 className="h-5 w-5 animate-spin" />
                    <span>Preparing...</span>
                  </>
                ) : (
                  <>
                    <span>Generate Document</span>
                    <ArrowRight className="h-5 w-5" />
                  </>
                )}
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Progress Modal */}
      {showProgress && documentId && (
        <ProgressModal
          documentId={documentId}
          onComplete={handleComplete}
          onError={(error) => {
            console.error('Generation error:', error);
            setShowProgress(false);
          }}
        />
      )}
    </div>
  );
}