/**
 * VirtualizedList - 虚拟化列表组件
 * ================================
 * 使用 react-virtuoso 实现高性能列表渲染
 * 适用于大量数据的列表（消息、积分记录等）
 */

import React, { useCallback, memo, CSSProperties } from 'react';
import { Virtuoso, VirtuosoHandle } from 'react-virtuoso';

interface VirtualizedListProps<T> {
  data: T[];
  renderItem: (item: T, index: number) => React.ReactNode;
  itemContent?: (index: number, item: T) => React.ReactNode;
  keyExtractor: (item: T, index: number) => string | number;
  className?: string;
  style?: CSSProperties;
  height?: number | string;
  overscan?: number;
  initialTopMostItemIndex?: number;
  followOutput?: boolean | 'auto';
  atBottomStateChange?: (atBottom: boolean) => void;
  components?: {
    Empty?: React.ComponentType;
    List?: React.ComponentType<{ style: CSSProperties; children: React.ReactNode }>;
    Item?: React.ComponentType<{ 'data-index': number; style: CSSProperties; children: React.ReactNode }>;
    Footer?: React.ComponentType;
  };
  loadMore?: () => void;
  hasMore?: boolean;
  isLoading?: boolean;
  loadingComponent?: React.ReactNode;
  endMessage?: React.ReactNode;
}

// 虚拟化列表组件
function VirtualizedList<T>({
  data,
  renderItem,
  keyExtractor,
  className = '',
  style,
  height = '100%',
  overscan = 200,
  initialTopMostItemIndex,
  followOutput = 'auto',
  atBottomStateChange,
  components,
  loadMore,
  hasMore = false,
  isLoading = false,
  loadingComponent,
  endMessage,
}: VirtualizedListProps<T>) {
  const listRef = React.useRef<VirtuosoHandle>(null);
  const [atBottom, setAtBottom] = React.useState(true);

  // 滚动到底部
  const scrollToBottom = useCallback(() => {
    listRef.current?.scrollToIndex({
      index: data.length - 1,
      align: 'end',
      behavior: 'smooth',
    });
  }, [data.length]);

  // 监听底部状态变化
  const handleAtBottomStateChange = useCallback((isAtBottom: boolean) => {
    setAtBottom(isAtBottom);
    atBottomStateChange?.(isAtBottom);

    // 自动加载更多
    if (!isAtBottom && !isLoading && hasMore && loadMore) {
      // 用户向上滚动，可以触发加载更多
    }

    if (isAtBottom && hasMore && loadMore) {
      // 已经在底部，加载更多
      loadMore();
    }
  }, [atBottomStateChange, hasMore, loadMore, isLoading]);

  // 列表为空
  if (!data || data.length === 0) {
    if (components?.Empty) {
      const EmptyComponent = components.Empty;
      return <EmptyComponent />;
    }
    return (
      <div className={`flex items-center justify-center ${className}`} style={style}>
        <p className="text-slate-400">暂无数据</p>
      </div>
    );
  }

  return (
    <Virtuoso
      ref={listRef}
      className={className}
      style={{ height, ...style }}
      data={data}
      overscan={overscan}
      initialTopMostItemIndex={initialTopMostItemIndex}
      followOutput={followOutput}
      atBottomStateChange={handleAtBottomStateChange}
      components={components}
      itemContent={(index, item) => renderItem(item, index)}
    />
  );
}

// 虚拟化消息列表
interface VirtualizedMessageListProps<T> {
  messages: T[];
  renderMessage: (message: T, index: number) => React.ReactNode;
  keyExtractor: (message: T, index: number) => string | number;
  className?: string;
  style?: CSSProperties;
  height?: number | string;
  isLoading?: boolean;
  loadingComponent?: React.ReactNode;
  endMessage?: React.ReactNode;
}

export const VirtualizedMessageList = memo(function VirtualizedMessageList<T>({
  messages,
  renderMessage,
  keyExtractor,
  className = '',
  style,
  height = '100%',
  isLoading = false,
  loadingComponent,
  endMessage,
}: VirtualizedMessageListProps<T>) {
  const listRef = React.useRef<VirtuosoHandle>(null);

  // 滚动到底部
  const scrollToBottom = useCallback((smooth = false) => {
    listRef.current?.scrollToIndex({
      index: messages.length - 1,
      align: 'end',
      behavior: smooth ? 'smooth' : 'auto',
    });
  }, [messages.length]);

  // 组件暴露方法
  React.useImperativeHandle(
    React.useRef<{ scrollToBottom: (smooth?: boolean) => void } | null>(null),
    () => ({ scrollToBottom }),
    [scrollToBottom]
  );

  return (
    <Virtuoso
      ref={listRef}
      className={className}
      style={{ height, ...style }}
      data={messages}
      overscan={200}
      followOutput="auto"
      itemContent={(index, message) => (
        <div className="py-2">
          {renderMessage(message, index)}
        </div>
      )}
      components={{
        Footer: () => {
          if (isLoading && loadingComponent) {
            return <>{loadingComponent}</>;
          }
          if (endMessage) {
            return <>{endMessage}</>;
          }
          return null;
        },
      }}
    />
  );
});

export default memo(VirtualizedList);
