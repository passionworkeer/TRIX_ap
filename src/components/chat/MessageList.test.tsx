import React from 'react';
import { render } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import MessageList from './MessageList';

describe('MessageList typing indicator', () => {
  const baseProps = {
    messages: [],
    loading: false,
    hasMoreMessages: false,
    isLoadingMore: false,
    isBot: true,
    isBotConversation: true,
    status: 'CONNECTED',
    name: 'TRIX Bot',
    avatar: '',
    onLoadMore: () => undefined,
  } as const;

  it('shows the loading bubble while the bot is thinking', () => {
    const { container } = render(
      <MessageList
        {...baseProps}
        botState="THINKING"
      />,
    );

    expect(container.querySelectorAll('.animate-bounce')).toHaveLength(3);
  });

  it('hides the loading bubble once the full bot reply is already present', () => {
    const { container } = render(
      <MessageList
        {...baseProps}
        botState="SPEAKING"
      />,
    );

    expect(container.querySelectorAll('.animate-bounce')).toHaveLength(0);
  });

  it('hides the loading bubble once the bot is idle', () => {
    const { container } = render(
      <MessageList
        {...baseProps}
        botState="IDLE"
      />,
    );

    expect(container.querySelectorAll('.animate-bounce')).toHaveLength(0);
  });
});
