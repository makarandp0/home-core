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
import { CONFIDENCE_THRESHOLD } from '../components/ExtractionBadges';
import { type FileType } from './useFileUpload';

export type ProcessingStep = 'idle' | 'extracting' | 'reextracting' | 'parsing' | 'complete' | 'error';

export interface AnalysisResults {
  extractedText: string | null;
  extractionMethod: ExtractionMethod | null;
  extractionConfidence: number | null;
  usedLLMExtraction: boolean;
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
  usedLLMExtraction: false,
  document: null,
  parseResponse: null,
};

const initialStepStatus: StepStatuses = {
  extracting: 'pending',
  reextracting: 'pending',
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
        // Step 1: Extract text using doc_processor
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
            error: docParsed.error ?? 'Failed to extract text',
            currentStep: 'error',
            stepStatus: { ...s.stepStatus, extracting: 'error' },
          }));
          return;
        }

        let finalText = docParsed.data.text;
        setState((s) => ({
          ...s,
          results: {
            ...s.results,
            extractedText: finalText,
            extractionMethod: docParsed.data!.method,
            extractionConfidence: docParsed.data!.confidence ?? null,
          },
          stepStatus: { ...s.stepStatus, extracting: 'complete' },
        }));

        // Step 2: Check if LLM re-extraction is needed
        const needsReextraction =
          fileType === 'image' &&
          docParsed.data.method === 'ocr' &&
          (docParsed.data.confidence ?? 0) < CONFIDENCE_THRESHOLD;

        if (needsReextraction) {
          setState((s) => ({
            ...s,
            currentStep: 'reextracting',
            stepStatus: { ...s.stepStatus, reextracting: 'active' },
          }));

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
              error: extractParsed.error ?? 'Failed to extract text with LLM',
              currentStep: 'error',
              stepStatus: { ...s.stepStatus, reextracting: 'skipped', parsing: 'pending' },
            }));
            return;
          }

          finalText = extractParsed.data.extractedText;
          setState((s) => ({
            ...s,
            results: {
              ...s.results,
              extractedText: finalText,
              usedLLMExtraction: true,
            },
            stepStatus: { ...s.stepStatus, reextracting: 'complete' },
          }));
        } else {
          setState((s) => ({
            ...s,
            stepStatus: { ...s.stepStatus, reextracting: 'skipped' },
          }));
        }

        // Step 3: Parse text to JSON
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
            reextracting:
              s.stepStatus.reextracting === 'active' ? 'skipped' : s.stepStatus.reextracting,
            parsing: s.stepStatus.parsing === 'active' ? 'error' : s.stepStatus.parsing,
          },
        }));
      }
    },
    []
  );

  const isProcessing = ['extracting', 'reextracting', 'parsing'].includes(state.currentStep);

  return {
    ...state,
    ...state.results,
    isProcessing,
    analyze,
    reset,
  };
}
