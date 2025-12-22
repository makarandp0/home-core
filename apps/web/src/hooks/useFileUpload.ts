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
}

export function useFileUpload() {
  const [state, setState] = React.useState<FileUploadState>({
    file: null,
    fileType: null,
    filePreview: null,
    fileDataUrl: null,
    error: null,
  });

  const handleFileChange = React.useCallback(
    async (e: React.ChangeEvent<HTMLInputElement>) => {
      const selectedFile = e.target.files?.[0];
      if (!selectedFile) return;

      const isPdf = selectedFile.type === 'application/pdf';
      const isImage = selectedFile.type.startsWith('image/');

      if (!isPdf && !isImage) {
        setState((s) => ({ ...s, error: 'Please select an image or PDF file' }));
        return;
      }

      // Reset state for new file
      setState({
        file: selectedFile,
        fileType: isPdf ? 'pdf' : 'image',
        filePreview: null,
        fileDataUrl: null,
        error: null,
      });

      if (isImage) {
        try {
          const compressed = await compressImage(selectedFile);
          setState((s) => ({
            ...s,
            filePreview: compressed,
            fileDataUrl: compressed,
          }));
        } catch {
          setState((s) => ({ ...s, error: 'Failed to process image file' }));
        }
      } else {
        // For PDFs, read as base64
        const reader = new FileReader();
        reader.onload = () => {
          makAssert(typeof reader.result === 'string', 'Expected string from readAsDataURL');
          const dataUrl = reader.result;
          setState((s) => ({ ...s, fileDataUrl: dataUrl }));
        };
        reader.readAsDataURL(selectedFile);
      }
    },
    []
  );

  const reset = React.useCallback(() => {
    setState({
      file: null,
      fileType: null,
      filePreview: null,
      fileDataUrl: null,
      error: null,
    });
  }, []);

  const clearError = React.useCallback(() => {
    setState((s) => ({ ...s, error: null }));
  }, []);

  return {
    ...state,
    handleFileChange,
    reset,
    clearError,
  };
}
