import * as React from 'react';
import { makAssert } from '@home/utils';

export type FileType = 'image' | 'pdf' | null;

export type FileStatus = 'pending' | 'uploading' | 'done' | 'error';

export interface FileEntry {
  id: string;
  file: File;
  fileType: 'image' | 'pdf';
  preview: string | null;
  dataUrl: string | null;
  status: FileStatus;
  error?: string;
}

export interface FileUploadState {
  files: FileEntry[];
  error: string | null;
  isProcessing: boolean;
  cropFileId: string | null;
}

function generateFileId(): string {
  // Prefer crypto.randomUUID when available for robust, non-sequential IDs
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return `file-${crypto.randomUUID()}`;
  }
  // Fallback: combine timestamp with a random base36 component
  const randomPart = Math.random().toString(36).slice(2);
  return `file-${Date.now()}-${randomPart}`;
}

export function useFileUpload() {
  const [state, setState] = React.useState<FileUploadState>({
    files: [],
    error: null,
    isProcessing: false,
    cropFileId: null,
  });

  // Track processing state with ref to prevent concurrent calls
  const isProcessingRef = React.useRef(false);

  const processFiles = React.useCallback(async (selectedFiles: File[]) => {
    if (selectedFiles.length === 0) return;

    // Prevent concurrent processing
    if (isProcessingRef.current) return;
    isProcessingRef.current = true;

    setState((s) => ({ ...s, isProcessing: true, error: null }));

    const readFileAsDataURL = (file: File): Promise<string> =>
      new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => {
          makAssert(typeof reader.result === 'string', 'Expected string from readAsDataURL');
          resolve(reader.result);
        };
        reader.onerror = () => reject(new Error('Failed to read file'));
        reader.readAsDataURL(file);
      });

    type ProcessResult = { entry: FileEntry; error: null } | { entry: null; error: string };

    // Process all files in parallel for better performance
    const filePromises = selectedFiles.map(async (file): Promise<ProcessResult> => {
      const isPdf = file.type === 'application/pdf';
      const isImage = file.type.startsWith('image/');

      if (!isPdf && !isImage) {
        return { entry: null, error: `${file.name}: not a valid image or PDF` };
      }

      try {
        const dataUrl = await readFileAsDataURL(file);

        const entry: FileEntry = {
          id: generateFileId(),
          file,
          fileType: isPdf ? 'pdf' : 'image',
          preview: isImage ? dataUrl : null,
          dataUrl,
          status: 'pending',
        };

        return { entry, error: null };
      } catch {
        return { entry: null, error: `${file.name}: failed to read file` };
      }
    });

    const results = await Promise.all(filePromises);

    const newEntries: FileEntry[] = [];
    const errors: string[] = [];

    for (const result of results) {
      if (result.entry) {
        newEntries.push(result.entry);
      }
      if (result.error) {
        errors.push(result.error);
      }
    }

    setState((s) => ({
      ...s,
      files: [...s.files, ...newEntries],
      error: errors.length > 0 ? errors.join(', ') : null,
      isProcessing: false,
    }));

    isProcessingRef.current = false;
  }, []);

  const handleFileChange = React.useCallback(
    async (e: React.ChangeEvent<HTMLInputElement>) => {
      const selectedFiles = e.target.files;
      if (!selectedFiles || selectedFiles.length === 0) return;
      await processFiles(Array.from(selectedFiles));
      // Reset input so same files can be selected again
      e.target.value = '';
    },
    [processFiles]
  );

  const handleDrop = React.useCallback(
    async (e: React.DragEvent<HTMLElement>) => {
      e.preventDefault();
      const droppedFiles = e.dataTransfer.files;
      if (!droppedFiles || droppedFiles.length === 0) return;
      await processFiles(Array.from(droppedFiles));
    },
    [processFiles]
  );

  const removeFile = React.useCallback((id: string) => {
    setState((s) => ({
      ...s,
      files: s.files.filter((f) => f.id !== id),
    }));
  }, []);

  const updateFileStatus = React.useCallback(
    (id: string, status: FileStatus, error?: string) => {
      setState((s) => ({
        ...s,
        files: s.files.map((f) =>
          f.id === id ? { ...f, status, error } : f
        ),
      }));
    },
    []
  );

  const reset = React.useCallback(() => {
    setState({
      files: [],
      error: null,
      isProcessing: false,
      cropFileId: null,
    });
  }, []);

  const clearError = React.useCallback(() => {
    setState((s) => ({ ...s, error: null }));
  }, []);

  const openCropModal = React.useCallback((id: string) => {
    setState((s) => ({ ...s, cropFileId: id }));
  }, []);

  const closeCropModal = React.useCallback(() => {
    setState((s) => ({ ...s, cropFileId: null }));
  }, []);

  const applyCrop = React.useCallback((croppedImageUrl: string) => {
    setState((s) => ({
      ...s,
      files: s.files.map((f) =>
        f.id === s.cropFileId
          ? { ...f, preview: croppedImageUrl, dataUrl: croppedImageUrl }
          : f
      ),
      cropFileId: null,
    }));
  }, []);

  const handleCameraCapture = React.useCallback((dataUrl: string) => {
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const syntheticFile = new File([], `camera-capture-${timestamp}.jpg`, {
      type: 'image/jpeg',
    });

    const newEntry: FileEntry = {
      id: generateFileId(),
      file: syntheticFile,
      fileType: 'image',
      preview: dataUrl,
      dataUrl,
      status: 'pending',
    };

    setState((s) => ({
      ...s,
      files: [...s.files, newEntry],
    }));
  }, []);

  // Computed properties for convenience
  const pendingFiles = state.files.filter((f) => f.status === 'pending');
  const hasFiles = state.files.length > 0;
  const hasPendingFiles = pendingFiles.length > 0;
  const cropFile = state.cropFileId
    ? state.files.find((f) => f.id === state.cropFileId) ?? null
    : null;

  return {
    ...state,
    handleFileChange,
    handleDrop,
    handleCameraCapture,
    removeFile,
    updateFileStatus,
    reset,
    clearError,
    openCropModal,
    closeCropModal,
    applyCrop,
    pendingFiles,
    hasFiles,
    hasPendingFiles,
    cropFile,
  };
}
