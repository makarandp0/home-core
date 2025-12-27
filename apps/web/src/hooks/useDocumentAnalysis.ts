import * as React from 'react';
import {
  apiResponse,
  DocumentUploadDataSchema,
  type DocumentData,
  type ExtractionMethod,
  type ApiError,
} from '@home/types';
import { type FileType } from './useFileUpload';

export type ProcessingStep = 'idle' | 'processing' | 'complete' | 'error';

export interface AnalysisResults {
  extractedText: string | null;
  extractionMethod: ExtractionMethod | null;
  extractionConfidence: number | null;
  document: DocumentData | null;
  parseResponse: string | null;
}

export interface AnalysisState {
  currentStep: ProcessingStep;
  results: AnalysisResults;
  error: ApiError | null;
}

const initialResults: AnalysisResults = {
  extractedText: null,
  extractionMethod: null,
  extractionConfidence: null,
  document: null,
  parseResponse: null,
};

export function useDocumentAnalysis() {
  const [state, setState] = React.useState<AnalysisState>({
    currentStep: 'idle',
    results: initialResults,
    error: null,
  });

  const reset = React.useCallback(() => {
    setState({
      currentStep: 'idle',
      results: initialResults,
      error: null,
    });
  }, []);

  const analyze = React.useCallback(
    async (params: {
      fileDataUrl: string;
      fileName: string;
      fileType: FileType;
      provider: string;
      apiKey?: string;
      prompt?: string;
    }) => {
      const { fileDataUrl, fileName, provider, apiKey, prompt } = params;

      // Reset and start processing
      setState({
        currentStep: 'processing',
        results: initialResults,
        error: null,
      });

      try {
        // Single API call for extract + parse
        const response = await fetch('/api/documents/upload', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            file: fileDataUrl,
            filename: fileName,
            provider,
            ...(apiKey?.trim() && { apiKey: apiKey.trim() }),
            ...(prompt?.trim() && { prompt: prompt.trim() }),
          }),
        });

        const json = await response.json();
        const parsed = apiResponse(DocumentUploadDataSchema).parse(json);

        if (!parsed.ok || !parsed.data) {
          setState({
            currentStep: 'error',
            results: initialResults,
            error: parsed.error ?? 'Failed to process document',
          });
          return;
        }

        const data = parsed.data;
        setState({
          currentStep: 'complete',
          results: {
            extractedText: data.extractedText,
            extractionMethod: data.extractionMethod,
            extractionConfidence: data.extractionConfidence ?? null,
            document: data.document ?? null,
            parseResponse: data.response,
          },
          error: null,
        });
      } catch (err) {
        setState({
          currentStep: 'error',
          results: initialResults,
          error: err instanceof Error ? err.message : 'An error occurred',
        });
      }
    },
    []
  );

  const isProcessing = state.currentStep === 'processing';

  return {
    ...state,
    ...state.results,
    isProcessing,
    analyze,
    reset,
  };
}
