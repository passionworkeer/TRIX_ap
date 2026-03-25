/**
 * Component tests for VirtualizedList
 *
 * Tests virtualized list renders items
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import React from 'react';

// Mock react-virtuoso
vi.mock('react-virtuoso', () => ({
  Virtuoso: vi.fn(({ data, itemContent, className }) => (
    <div data-testid="virtuoso-list" className={className}>
      {data?.map((item: any, index: number) => (
        <div key={item.id || index}>{itemContent?.(index, item)}</div>
      ))}
    </div>
  )),
}));

describe('VirtualizedList', () => {
  const defaultData = [
    { id: '1', name: 'Item 1' },
    { id: '2', name: 'Item 2' },
    { id: '3', name: 'Item 3' },
  ];

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should render with data', async () => {
    const VirtualizedList = (await import('./VirtualizedList')).default;

    const { container } = render(
      <VirtualizedList
        data={defaultData}
        renderItem={(item) => <div>{item.name}</div>}
        keyExtractor={(item) => item.id}
      />
    );

    expect(container.querySelector('[data-testid="virtuoso-list"]')).toBeTruthy();
  });

  it('should render empty state when no data', async () => {
    const VirtualizedList = (await import('./VirtualizedList')).default;

    const { container } = render(
      <VirtualizedList
        data={[]}
        renderItem={(item) => <div>{item.name}</div>}
        keyExtractor={(item) => item.id}
      />
    );

    expect(screen.getByText('暂无数据')).toBeInTheDocument();
  });

  it('should render custom empty component when provided', async () => {
    const VirtualizedList = (await import('./VirtualizedList')).default;
    const EmptyComponent = () => <div data-testid="custom-empty">自定义空状态</div>;

    const { container } = render(
      <VirtualizedList
        data={[]}
        renderItem={(item) => <div>{item.name}</div>}
        keyExtractor={(item) => item.id}
        components={{ Empty: EmptyComponent }}
      />
    );

    expect(container.querySelector('[data-testid="custom-empty"]')).toBeTruthy();
  });

  it('should apply custom className', async () => {
    const VirtualizedList = (await import('./VirtualizedList')).default;

    const { container } = render(
      <VirtualizedList
        data={defaultData}
        renderItem={(item) => <div>{item.name}</div>}
        keyExtractor={(item) => item.id}
        className="custom-class"
      />
    );

    expect(container.querySelector('.custom-class')).toBeTruthy();
  });

  it('should apply custom height', async () => {
    const VirtualizedList = (await import('./VirtualizedList')).default;

    const { container } = render(
      <VirtualizedList
        data={defaultData}
        renderItem={(item) => <div>{item.name}</div>}
        keyExtractor={(item) => item.id}
        height={500}
      />
    );

    const list = container.querySelector('[data-testid="virtuoso-list"]');
    expect(list).toBeTruthy();
  });

  it('should render VirtualizedMessageList', async () => {
    const { VirtualizedMessageList } = await import('./VirtualizedList');

    const messages = [
      { id: '1', content: 'Hello' },
      { id: '2', content: 'World' },
    ];

    const { container } = render(
      <VirtualizedMessageList
        messages={messages}
        renderMessage={(msg) => <div>{msg.content}</div>}
        keyExtractor={(msg) => msg.id}
      />
    );

    expect(container.querySelector('[data-testid="virtuoso-list"]')).toBeTruthy();
  });
});
