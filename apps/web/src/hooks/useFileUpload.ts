import * as React from 'react';
import { makAssert } from '@home/utils';

export type FileType = 'image' | 'pdf' | null;

export interface FileUploadState {
  file: File | null;
  fileType: FileType;
  filePreview: string | null;
  fileDataUrl: string | null;
  error: string | null;
  isProcessing: boolean;
  showCropModal: boolean;
}

export function useFileUpload() {
  const [state, setState] = React.useState<FileUploadState>({
    file: null,
    fileType: null,
    filePreview: null,
    fileDataUrl: null,
    error: null,
    isProcessing: false,
    showCropModal: false,
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
      showCropModal: false,
    });

    // Read file as data URL (server handles resizing if needed)
    const reader = new FileReader();
    reader.onload = () => {
      makAssert(typeof reader.result === 'string', 'Expected string from readAsDataURL');
      const dataUrl = reader.result;
      setState((s) => ({
        ...s,
        filePreview: isImage ? dataUrl : null,
        fileDataUrl: dataUrl,
        isProcessing: false,
      }));
    };
    reader.onerror = () => {
      setState((s) => ({
        ...s,
        error: `Failed to read ${isImage ? 'image' : 'PDF'} file`,
        isProcessing: false,
      }));
    };
    reader.readAsDataURL(selectedFile);
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
      showCropModal: false,
    });
  }, []);

  const clearError = React.useCallback(() => {
    setState((s) => ({ ...s, error: null }));
  }, []);

  const handleCameraCapture = React.useCallback((dataUrl: string) => {
    // Create a synthetic file object for camera captures
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const syntheticFile = new File([], `camera-capture-${timestamp}.jpg`, {
      type: 'image/jpeg',
    });

    setState({
      file: syntheticFile,
      fileType: 'image',
      filePreview: dataUrl,
      fileDataUrl: dataUrl,
      error: null,
      isProcessing: false,
      showCropModal: false,
    });
  }, []);

  const openCropModal = React.useCallback(() => {
    setState((s) => ({ ...s, showCropModal: true }));
  }, []);

  const closeCropModal = React.useCallback(() => {
    setState((s) => ({ ...s, showCropModal: false }));
  }, []);

  const applyCrop = React.useCallback((croppedImageUrl: string) => {
    setState((s) => ({
      ...s,
      filePreview: croppedImageUrl,
      fileDataUrl: croppedImageUrl,
      showCropModal: false,
    }));
  }, []);

  return {
    ...state,
    handleFileChange,
    handleDrop,
    handleCameraCapture,
    reset,
    clearError,
    openCropModal,
    closeCropModal,
    applyCrop,
  };
}
