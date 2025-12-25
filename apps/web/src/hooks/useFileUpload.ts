import * as React from 'react';
import { makAssert } from '@home/utils';
import { compressImage } from '../utils/compressImage';

export type FileType = 'image' | 'pdf' | null;

export interface FileUploadState {
  file: File | null;
  fileType: FileType;
  filePreview: string | null;
  fileDataUrl: string | null;
  error: string | null;
  isProcessing: boolean;
}

export function useFileUpload() {
  const [state, setState] = React.useState<FileUploadState>({
    file: null,
    fileType: null,
    filePreview: null,
    fileDataUrl: null,
    error: null,
    isProcessing: false,
  });

  const processFile = React.useCallback(async (selectedFile: File) => {
    const isPdf = selectedFile.type === 'application/pdf';
    const isImage = selectedFile.type.startsWith('image/');

    if (!isPdf && !isImage) {
      setState((s) => ({ ...s, error: 'Please select an image or PDF file', isProcessing: false }));
      return;
    }

    // Reset state for new file
    setState({
      file: selectedFile,
      fileType: isPdf ? 'pdf' : 'image',
      filePreview: null,
      fileDataUrl: null,
      error: null,
      isProcessing: true,
    });

    if (isImage) {
      try {
        const compressed = await compressImage(selectedFile);
        setState((s) => ({
          ...s,
          filePreview: compressed,
          fileDataUrl: compressed,
          isProcessing: false,
        }));
      } catch {
        setState((s) => ({ ...s, error: 'Failed to process image file', isProcessing: false }));
      }
    } else {
      // For PDFs, read as base64
      const reader = new FileReader();
      reader.onload = () => {
        makAssert(typeof reader.result === 'string', 'Expected string from readAsDataURL');
        const dataUrl = reader.result;
        setState((s) => ({ ...s, fileDataUrl: dataUrl, isProcessing: false }));
      };
      reader.onerror = () => {
        setState((s) => ({ ...s, error: 'Failed to read PDF file', isProcessing: false }));
      };
      reader.readAsDataURL(selectedFile);
    }
  }, []);

  const handleFileChange = React.useCallback(
    async (e: React.ChangeEvent<HTMLInputElement>) => {
      const selectedFile = e.target.files?.[0];
      if (!selectedFile) return;
      await processFile(selectedFile);
    },
    [processFile]
  );

  const handleDrop = React.useCallback(
    async (e: React.DragEvent<HTMLElement>) => {
      e.preventDefault();
      const droppedFile = e.dataTransfer.files?.[0];
      if (!droppedFile) return;
      await processFile(droppedFile);
    },
    [processFile]
  );

  const reset = React.useCallback(() => {
    setState({
      file: null,
      fileType: null,
      filePreview: null,
      fileDataUrl: null,
      error: null,
      isProcessing: false,
    });
  }, []);

  const clearError = React.useCallback(() => {
    setState((s) => ({ ...s, error: null }));
  }, []);

  return {
    ...state,
    handleFileChange,
    handleDrop,
    reset,
    clearError,
  };
}
