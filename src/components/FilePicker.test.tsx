/**
 * Component tests for FilePicker
 *
 * Tests the file selection and preview UI component
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import React from 'react';

// Mock hooks
vi.mock('../hooks/useNotification', () => ({
  useNotification: () => ({
    showError: vi.fn(),
  }),
}));

// Mock upload service constants
vi.mock('../services/uploadService', () => ({
  ACCEPTED_IMAGE_TYPES: ['image/jpeg', 'image/png', 'image/gif', 'image/webp'],
  ACCEPTED_VIDEO_TYPES: ['video/mp4', 'video/webm'],
}));

// Mock error handler
vi.mock('../utils/errorHandler', () => ({
  getErrorMessage: vi.fn((error, defaultMsg) => defaultMsg),
}));

describe('FilePicker', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should render upload button', async () => {
    const FilePicker = (await import('../components/FilePicker')).default;

    render(
      <FilePicker
        onFileSelect={async () => {}}
      />
    );

    // Should have upload button
    const button = screen.getByRole('button', { name: '添加图片或视频' });
    expect(button).toBeDefined();
  });

  it('should call onFileSelect when valid file is chosen', async () => {
    const FilePicker = (await import('../components/FilePicker')).default;
    const onFileSelect = vi.fn().mockResolvedValue(undefined);

    render(
      <FilePicker
        onFileSelect={onFileSelect}
      />
    );

    // Get the hidden file input
    const input = screen.getByLabelText('添加图片或视频') as HTMLInputElement;

    // Create a mock file
    const mockFile = new File(['test'], 'test.png', { type: 'image/png' });

    // Simulate file selection
    fireEvent.change(input, { target: { files: [mockFile] } });

    await waitFor(() => {
      expect(onFileSelect).toHaveBeenCalledWith(mockFile);
    });
  });

  it('should show error for invalid file type', async () => {
    const FilePicker = (await import('../components/FilePicker')).default;
    const showError = vi.fn();

    // Mock the hook to return our showError
    vi.mock('../hooks/useNotification', () => ({
      useNotification: () => ({
        showError,
      }),
    }));

    render(
      <FilePicker
        onFileSelect={async () => {}}
      />
    );

    const input = screen.getByLabelText('添加图片或视频') as HTMLInputElement;

    // Create an invalid file type
    const mockFile = new File(['test'], 'test.pdf', { type: 'application/pdf' });

    fireEvent.change(input, { target: { files: [mockFile] } });

    await waitFor(() => {
      expect(showError).toHaveBeenCalledWith('请选择图片或视频文件');
    });
  });

  it('should show preview when file is selected', async () => {
    const FilePicker = (await import('../components/FilePicker')).default;

    render(
      <FilePicker
        onFileSelect={async () => {}}
      />
    );

    const input = screen.getByLabelText('添加图片或视频') as HTMLInputElement;

    // Create a valid image file
    const mockFile = new File(['test'], 'test.png', { type: 'image/png' });

    fireEvent.change(input, { target: { files: [mockFile] } });

    await waitFor(() => {
      // Should show preview
      expect(screen.getByText('图片预览')).toBeDefined();
      expect(screen.getByText('test.png')).toBeDefined();
    });
  });

  it('should show video preview for video files', async () => {
    const FilePicker = (await import('../components/FilePicker')).default;

    render(
      <FilePicker
        onFileSelect={async () => {}}
      />
    );

    const input = screen.getByLabelText('添加图片或视频') as HTMLInputElement;

    // Create a valid video file
    const mockFile = new File(['test'], 'test.mp4', { type: 'video/mp4' });

    fireEvent.change(input, { target: { files: [mockFile] } });

    await waitFor(() => {
      expect(screen.getByText('视频预览')).toBeDefined();
    });
  });

  it('should disable input when isUploading is true', async () => {
    const FilePicker = (await import('../components/FilePicker')).default;

    render(
      <FilePicker
        onFileSelect={async () => {}}
        isUploading={true}
      />
    );

    const input = screen.getByLabelText('添加图片或视频') as HTMLInputElement;
    expect(input.disabled).toBe(true);
  });

  it('should call onFileSelect error when upload fails', async () => {
    const FilePicker = (await import('../components/FilePicker')).default;
    const onFileSelect = vi.fn().mockRejectedValue(new Error('Upload failed'));
    const showError = vi.fn();

    vi.mock('../hooks/useNotification', () => ({
      useNotification: () => ({
        showError,
      }),
    }));

    render(
      <FilePicker
        onFileSelect={onFileSelect}
      />
    );

    const input = screen.getByLabelText('添加图片或视频') as HTMLInputElement;

    const mockFile = new File(['test'], 'test.png', { type: 'image/png' });

    fireEvent.change(input, { target: { files: [mockFile] } });

    await waitFor(() => {
      expect(showError).toHaveBeenCalled();
    });
  });
});
