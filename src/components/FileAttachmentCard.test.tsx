import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import React from 'react';
import FileAttachmentCard, { isSafeAttachmentUri } from './FileAttachmentCard';

describe('isSafeAttachmentUri', () => {
  it('allows http and https attachment URLs', () => {
    expect(isSafeAttachmentUri('https://example.com/file.pdf')).toBe(true);
    expect(isSafeAttachmentUri('http://example.com/file.pdf')).toBe(true);
  });

  it('allows blob URLs', () => {
    expect(isSafeAttachmentUri('blob:https://example.com/local-file')).toBe(true);
  });

  it('allows relative URLs', () => {
    expect(isSafeAttachmentUri('/storage/v1/object/public/file.pdf')).toBe(true);
  });

  it('rejects javascript: scheme', () => {
    expect(isSafeAttachmentUri('javascript:alert(1)')).toBe(false);
  });

  it('rejects data: scheme', () => {
    expect(isSafeAttachmentUri('data:text/html,<script>alert(1)</script>')).toBe(false);
  });

  it('rejects file: scheme', () => {
    expect(isSafeAttachmentUri('file:///etc/passwd')).toBe(false);
  });

  it('rejects empty and non-string values', () => {
    expect(isSafeAttachmentUri('')).toBe(false);
    expect(isSafeAttachmentUri('   ')).toBe(false);
    expect(isSafeAttachmentUri(undefined as unknown as string)).toBe(false);
    expect(isSafeAttachmentUri(null as unknown as string)).toBe(false);
  });
});

describe('FileAttachmentCard', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders a safe attachment as a clickable download link', () => {
    render(
      <FileAttachmentCard
        uri="https://example.com/files/report.pdf"
        mimeType="application/pdf"
        fileName="report.pdf"
        size={1024}
      />
    );

    const link = screen.getByRole('link');
    expect(link).toHaveAttribute('href', 'https://example.com/files/report.pdf');
    expect(link).toHaveAttribute('download', 'report.pdf');
  });

  it('renders an unsafe attachment as a disabled card without a link', () => {
    render(
      <FileAttachmentCard
        uri="javascript:alert(1)"
        mimeType="text/html"
        fileName="evil.html"
      />
    );

    expect(screen.queryByRole('link')).toBeNull();
    expect(screen.getByRole('group')).toHaveAttribute('aria-disabled', 'true');
  });

  it('renders a data: URI as a disabled card', () => {
    render(
      <FileAttachmentCard
        uri="data:text/html,<script>alert(1)</script>"
        mimeType="text/html"
        fileName="payload.html"
      />
    );

    expect(screen.queryByRole('link')).toBeNull();
    expect(screen.getByRole('group')).toHaveAttribute('aria-disabled', 'true');
  });
});
