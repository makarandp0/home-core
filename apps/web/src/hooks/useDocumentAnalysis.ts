// Copyright (c) 2025 Makarand Patwardhan
// SPDX-License-Identifier: AGPL-3.0-only

import * as React from 'react';
import {
  DocumentUploadDataSchema,
  type DocumentData,
  type ExtractionMethod,
  type ApiError,
} from '@ohs/types';
import { type FileType } from './useFileUpload';
import { api, getErrorMessage } from '@/lib/api';

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

      // Single API call for extract + parse
      const result = await api.post('/api/documents/upload', DocumentUploadDataSchema, {
        file: fileDataUrl,
        filename: fileName,
        provider,
        ...(apiKey?.trim() && { apiKey: apiKey.trim() }),
        ...(prompt?.trim() && { prompt: prompt.trim() }),
      });

      if (result.ok) {
        const data = result.data;
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
      } else {
        setState({
          currentStep: 'error',
          results: initialResults,
          error: getErrorMessage(result.error),
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
