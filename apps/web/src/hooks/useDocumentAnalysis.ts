import * as React from 'react';
import {
  apiResponse,
  VisionExtractTextResponseSchema,
  VisionParseResponseSchema,
  DocumentProcessResponseSchema,
  type DocumentData,
  type ExtractionMethod,
  type ApiError,
} from '@home/types';
import { type StepStatuses } from '../components/StepProgress';
import { type FileType } from './useFileUpload';

export type ProcessingStep = 'idle' | 'extracting' | 'parsing' | 'complete' | 'error';

export interface AnalysisResults {
  extractedText: string | null;
  extractionMethod: ExtractionMethod | null;
  extractionConfidence: number | null;
  document: DocumentData | null;
  parseResponse: string | null;
}

export interface AnalysisState {
  currentStep: ProcessingStep;
  stepStatus: StepStatuses;
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

const initialStepStatus: StepStatuses = {
  extracting: 'pending',
  parsing: 'pending',
};

export function useDocumentAnalysis() {
  const [state, setState] = React.useState<AnalysisState>({
    currentStep: 'idle',
    stepStatus: initialStepStatus,
    results: initialResults,
    error: null,
  });

  const reset = React.useCallback(() => {
    setState({
      currentStep: 'idle',
      stepStatus: initialStepStatus,
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
      const { fileDataUrl, fileName, fileType, provider, apiKey, prompt } = params;

      // Reset and start
      setState({
        currentStep: 'extracting',
        stepStatus: { ...initialStepStatus, extracting: 'active' },
        results: initialResults,
        error: null,
      });

      try {
        let finalText: string;
        let extractionMethod: ExtractionMethod;
        let extractionConfidence: number | null = null;

        // Step 1: Extract text
        // For images: use LLM vision directly
        // For PDFs: use doc_processor (native + OCR fallback)
        if (fileType === 'image') {
          // Use LLM directly for images
          const extractRes = await fetch('/api/vision/extract-text', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              image: fileDataUrl,
              provider,
              ...(apiKey?.trim() && { apiKey: apiKey.trim() }),
            }),
          });

          const extractJson = await extractRes.json();
          const extractParsed = apiResponse(VisionExtractTextResponseSchema).parse(extractJson);

          if (!extractParsed.ok || !extractParsed.data) {
            setState((s) => ({
              ...s,
              error: extractParsed.error ?? 'Failed to extract text from image',
              currentStep: 'error',
              stepStatus: { ...s.stepStatus, extracting: 'error' },
            }));
            return;
          }

          finalText = extractParsed.data.extractedText;
          extractionMethod = 'llm';
        } else {
          // Use doc_processor for PDFs
          const base64Content = fileDataUrl.replace(/^data:[^;]+;base64,/, '');

          const docRes = await fetch('/api/documents/process', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              file: base64Content,
              filename: fileName,
            }),
          });

          const docJson = await docRes.json();
          const docParsed = DocumentProcessResponseSchema.parse(docJson);

          if (!docParsed.ok || !docParsed.data) {
            setState((s) => ({
              ...s,
              error: docParsed.error ?? 'Failed to extract text from PDF',
              currentStep: 'error',
              stepStatus: { ...s.stepStatus, extracting: 'error' },
            }));
            return;
          }

          finalText = docParsed.data.text;
          extractionMethod = docParsed.data.method;
          extractionConfidence = docParsed.data.confidence ?? null;
        }

        setState((s) => ({
          ...s,
          results: {
            ...s.results,
            extractedText: finalText,
            extractionMethod,
            extractionConfidence,
          },
          stepStatus: { ...s.stepStatus, extracting: 'complete' },
        }));

        // Step 2: Parse text to JSON
        setState((s) => ({
          ...s,
          currentStep: 'parsing',
          stepStatus: { ...s.stepStatus, parsing: 'active' },
        }));

        const parseRes = await fetch('/api/vision/parse', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            text: finalText,
            provider,
            ...(apiKey?.trim() && { apiKey: apiKey.trim() }),
            ...(prompt?.trim() && { prompt: prompt.trim() }),
          }),
        });

        const parseJson = await parseRes.json();
        const parseParsed = apiResponse(VisionParseResponseSchema).parse(parseJson);

        if (!parseParsed.ok || !parseParsed.data) {
          setState((s) => ({
            ...s,
            error: parseParsed.error ?? 'Failed to parse document',
            currentStep: 'error',
            stepStatus: { ...s.stepStatus, parsing: 'error' },
          }));
          return;
        }

        setState((s) => ({
          ...s,
          results: {
            ...s.results,
            document: parseParsed.data!.document ?? null,
            parseResponse: parseParsed.data!.response,
          },
          stepStatus: { ...s.stepStatus, parsing: 'complete' },
          currentStep: 'complete',
        }));
      } catch (err) {
        setState((s) => ({
          ...s,
          error: err instanceof Error ? err.message : 'An error occurred',
          currentStep: 'error',
          stepStatus: {
            extracting: s.stepStatus.extracting === 'active' ? 'error' : s.stepStatus.extracting,
            parsing: s.stepStatus.parsing === 'active' ? 'error' : s.stepStatus.parsing,
          },
        }));
      }
    },
    []
  );

  const isProcessing = ['extracting', 'parsing'].includes(state.currentStep);

  return {
    ...state,
    ...state.results,
    isProcessing,
    analyze,
    reset,
  };
}
