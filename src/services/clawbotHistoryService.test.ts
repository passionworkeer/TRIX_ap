/**
 * ClawbotHistoryService Tests
 */
import { describe, it, expect, beforeEach, vi } from 'vitest';

// Mock localStorage
const createLocalStorageMock = () => {
  let store: Record<string, string> = {};
  let length = 0;

  return {
    getItem: vi.fn((key: string) => store[key] || null),
    setItem: vi.fn((key: string, value: string) => {
      if (!(key in store)) length++;
      store[key] = value;
    }),
    removeItem: vi.fn((key: string) => {
      if (key in store) {
        delete store[key];
        length--;
      }
    }),
    clear: vi.fn(() => {
      store = {};
      length = 0;
    }),
    key: vi.fn((index: number) => {
      const keys = Object.keys(store);
      return keys[index] || null;
    }),
    get length() {
      return length;
    },
  };
};

const localStorageMock = createLocalStorageMock();

Object.defineProperty(global, 'localStorage', {
  value: localStorageMock,
});

// Import after mock
import {
  loadClawbotMessageHistory,
  saveClawbotMessage,
  deleteClawbotMessage,
  ClawbotHistoryMessage
} from './clawbotHistoryService';

describe('clawbotHistoryService', () => {
  const testUserId = 'user-123';

  const createTestMessage = (
    overrides: Partial<ClawbotHistoryMessage> = {}
  ): ClawbotHistoryMessage => ({
    id: 'msg-1',
    content: 'Hello world',
    contentType: 'text',
    timestamp: 1700000000000,
    sender: 'user',
    ...overrides,
  });

  beforeEach(() => {
    // Reset localStorage mock
    localStorageMock.getItem.mockReset();
    localStorageMock.setItem.mockReset();
    localStorageMock.removeItem.mockReset();
    localStorageMock.clear.mockReset();
    localStorageMock.key.mockReset();
    localStorageMock.clear();
    vi.clearAllMocks();
  });

  // ============================================
  // loadClawbotMessageHistory Tests
  // ============================================

  describe('loadClawbotMessageHistory', () => {
    it('should return empty array when userId is empty', async () => {
      const result = await loadClawbotMessageHistory('');
      expect(result).toEqual([]);
    });

    it('should return empty array when localStorage has no data', async () => {
      vi.mocked(localStorage.getItem).mockReturnValue(null);

      const result = await loadClawbotMessageHistory(testUserId);
      expect(result).toEqual([]);
    });

    it('should return empty array when stored data is not an array', async () => {
      vi.mocked(localStorage.getItem).mockReturnValue('{"invalid": "data"}');

      const result = await loadClawbotMessageHistory(testUserId);
      expect(result).toEqual([]);
    });

    it('should return empty array when localStorage throws error', async () => {
      vi.mocked(localStorage.getItem).mockImplementation(() => {
        throw new Error('Storage error');
      });

      const result = await loadClawbotMessageHistory(testUserId);
      expect(result).toEqual([]);
    });

    it('should load and normalize messages from localStorage', async () => {
      const messages = [
        createTestMessage({ id: 'msg-1', timestamp: 1700000000000 }),
        createTestMessage({ id: 'msg-2', timestamp: 1700000001000, sender: 'bot' }),
      ];

      vi.mocked(localStorage.getItem).mockReturnValue(JSON.stringify(messages));

      const result = await loadClawbotMessageHistory(testUserId);

      expect(result).toHaveLength(2);
      expect(result[0].id).toBe('msg-1');
      expect(result[1].id).toBe('msg-2');
    });

    it('should filter out invalid messages', async () => {
      const validMessage = createTestMessage({ id: 'msg-1', timestamp: 1700000000000 });
      const invalidMessage = { invalid: 'data' }; // Missing required fields

      vi.mocked(localStorage.getItem).mockReturnValue(
        JSON.stringify([validMessage, invalidMessage])
      );

      const result = await loadClawbotMessageHistory(testUserId);

      expect(result).toHaveLength(1);
      expect(result[0].id).toBe('msg-1');
    });

    it('should sort messages by timestamp ascending', async () => {
      const messages = [
        createTestMessage({ id: 'msg-2', timestamp: 1700000002000 }),
        createTestMessage({ id: 'msg-1', timestamp: 1700000000000 }),
        createTestMessage({ id: 'msg-3', timestamp: 1700000003000 }),
      ];

      vi.mocked(localStorage.getItem).mockReturnValue(JSON.stringify(messages));

      const result = await loadClawbotMessageHistory(testUserId);

      expect(result[0].id).toBe('msg-1');
      expect(result[1].id).toBe('msg-2');
      expect(result[2].id).toBe('msg-3');
    });

    it('should use correct storage key', async () => {
      vi.mocked(localStorage.getItem).mockReturnValue(JSON.stringify([]));

      await loadClawbotMessageHistory(testUserId);

      expect(localStorage.getItem).toHaveBeenCalledWith(
        `trix_clawbot_history:${testUserId}`
      );
    });

    it('should normalize media fields correctly', async () => {
      const messageWithMedia = {
        id: 'msg-1',
        content: 'Image message',
        contentType: 'image',
        mediaUrl: 'https://example.com/image.jpg',
        mediaMimeType: 'image/jpeg',
        timestamp: 1700000000000,
        sender: 'user',
      };

      vi.mocked(localStorage.getItem).mockReturnValue(JSON.stringify([messageWithMedia]));

      const result = await loadClawbotMessageHistory(testUserId);

      expect(result[0].mediaUrl).toBe('https://example.com/image.jpg');
      expect(result[0].mediaMimeType).toBe('image/jpeg');
    });

    it('should handle snake_case media_mime_type field', async () => {
      const messageWithSnakeCase = {
        id: 'msg-1',
        content: 'Image message',
        contentType: 'image',
        mediaUrl: 'https://example.com/image.jpg',
        media_mime_type: 'image/png', // snake_case
        timestamp: 1700000000000,
        sender: 'user',
      };

      vi.mocked(localStorage.getItem).mockReturnValue(
        JSON.stringify([messageWithSnakeCase])
      );

      const result = await loadClawbotMessageHistory(testUserId);

      expect(result[0].mediaMimeType).toBe('image/png');
    });

    it('should trim whitespace from id', async () => {
      const messageWithWhitespace = {
        id: '  msg-1  ',
        content: 'Test message',
        contentType: 'text',
        timestamp: 1700000000000,
        sender: 'user',
      };

      vi.mocked(localStorage.getItem).mockReturnValue(
        JSON.stringify([messageWithWhitespace])
      );

      const result = await loadClawbotMessageHistory(testUserId);

      expect(result[0].id).toBe('msg-1');
    });
  });

  // ============================================
  // saveClawbotMessage Tests
  // ============================================

  describe('saveClawbotMessage', () => {
    it('should do nothing when userId is empty', async () => {
      const message = createTestMessage();

      await saveClawbotMessage('', message);

      expect(localStorage.setItem).not.toHaveBeenCalled();
    });

    it('should do nothing when message is invalid', async () => {
      const invalidMessage = { invalid: 'data' } as unknown as ClawbotHistoryMessage;

      await saveClawbotMessage(testUserId, invalidMessage);

      expect(localStorage.setItem).not.toHaveBeenCalled();
    });

    it('should do nothing when message has missing id', async () => {
      const messageWithoutId = {
        content: 'Test',
        contentType: 'text',
        timestamp: 1700000000000,
        sender: 'user',
      } as unknown as ClawbotHistoryMessage;

      await saveClawbotMessage(testUserId, messageWithoutId);

      expect(localStorage.setItem).not.toHaveBeenCalled();
    });

    it('should save message to localStorage', async () => {
      const message = createTestMessage();
      vi.mocked(localStorage.getItem).mockReturnValue(null);

      await saveClawbotMessage(testUserId, message);

      expect(localStorage.setItem).toHaveBeenCalled();
    });

    it('should merge with existing messages and sort by timestamp', async () => {
      const existingMessages = [
        createTestMessage({ id: 'msg-1', timestamp: 1700000000000 }),
        createTestMessage({ id: 'msg-2', timestamp: 1700000002000 }),
      ];

      vi.mocked(localStorage.getItem).mockReturnValue(
        JSON.stringify(existingMessages)
      );

      const newMessage = createTestMessage({ id: 'msg-3', timestamp: 1700000001000 });
      await saveClawbotMessage(testUserId, newMessage);

      const savedData = vi.mocked(localStorage.setItem).mock.calls[0]?.[1];
      const savedMessages = JSON.parse(savedData || '[]');

      expect(savedMessages).toHaveLength(3);
      expect(savedMessages[0].id).toBe('msg-1');
      expect(savedMessages[1].id).toBe('msg-3');
      expect(savedMessages[2].id).toBe('msg-2');
    });

    it('should update existing message with same id', async () => {
      const existingMessages = [
        createTestMessage({ id: 'msg-1', content: 'Original', timestamp: 1700000000000 }),
      ];

      vi.mocked(localStorage.getItem).mockReturnValue(
        JSON.stringify(existingMessages)
      );

      const updatedMessage = createTestMessage({
        id: 'msg-1',
        content: 'Updated',
        timestamp: 1700000001000,
      });
      await saveClawbotMessage(testUserId, updatedMessage);

      const savedData = vi.mocked(localStorage.setItem).mock.calls[0]?.[1];
      const savedMessages = JSON.parse(savedData || '[]');

      expect(savedMessages).toHaveLength(1);
      expect(savedMessages[0].content).toBe('Updated');
    });

    it('should respect maximum message limit', async () => {
      // Create 501 messages (exceeds limit of 500)
      const existingMessages = Array.from({ length: 500 }, (_, i) =>
        createTestMessage({ id: `msg-${i}`, timestamp: 1700000000000 + i })
      );

      vi.mocked(localStorage.getItem).mockReturnValue(
        JSON.stringify(existingMessages)
      );

      const newMessage = createTestMessage({
        id: 'msg-new',
        timestamp: 1700000000000 + 500,
      });
      await saveClawbotMessage(testUserId, newMessage);

      const savedData = vi.mocked(localStorage.setItem).mock.calls[0]?.[1];
      const savedMessages = JSON.parse(savedData || '[]');

      // Should keep only the most recent 500 messages
      expect(savedMessages).toHaveLength(500);
      expect(savedMessages[0].id).toBe('msg-1'); // Oldest kept
      expect(savedMessages[savedMessages.length - 1].id).toBe('msg-new'); // Newest added
    });

    it('should handle JSON parse error gracefully', async () => {
      vi.mocked(localStorage.getItem).mockReturnValue('invalid json');

      const message = createTestMessage();
      await saveClawbotMessage(testUserId, message);

      // Should save the new message as the only item
      expect(localStorage.setItem).toHaveBeenCalled();
    });

    it('should use correct storage key', async () => {
      const message = createTestMessage();
      vi.mocked(localStorage.getItem).mockReturnValue(null);

      await saveClawbotMessage(testUserId, message);

      expect(localStorage.setItem).toHaveBeenCalledWith(
        `trix_clawbot_history:${testUserId}`,
        expect.any(String)
      );
    });
  });

  // ============================================
  // deleteClawbotMessage Tests
  // ============================================

  describe('deleteClawbotMessage', () => {
    it('should do nothing when userId is empty', async () => {
      const messages = [createTestMessage()];
      vi.mocked(localStorage.getItem).mockReturnValue(JSON.stringify(messages));

      await deleteClawbotMessage('', 'msg-1');

      expect(localStorage.setItem).not.toHaveBeenCalled();
    });

    it('should do nothing when messageId is empty', async () => {
      const messages = [createTestMessage()];
      vi.mocked(localStorage.getItem).mockReturnValue(JSON.stringify(messages));

      await deleteClawbotMessage(testUserId, '');

      expect(localStorage.setItem).not.toHaveBeenCalled();
    });

    it('should delete message by id', async () => {
      const messages = [
        createTestMessage({ id: 'msg-1', timestamp: 1700000000000 }),
        createTestMessage({ id: 'msg-2', timestamp: 1700000001000 }),
      ];

      vi.mocked(localStorage.getItem).mockReturnValue(JSON.stringify(messages));

      await deleteClawbotMessage(testUserId, 'msg-1');

      const savedData = vi.mocked(localStorage.setItem).mock.calls[0]?.[1];
      const savedMessages = JSON.parse(savedData || '[]');

      expect(savedMessages).toHaveLength(1);
      expect(savedMessages[0].id).toBe('msg-2');
    });

    it('should handle deleting non-existent message', async () => {
      const messages = [createTestMessage({ id: 'msg-1' })];

      vi.mocked(localStorage.getItem).mockReturnValue(JSON.stringify(messages));

      await deleteClawbotMessage(testUserId, 'non-existent-id');

      // Should keep all messages when target doesn't exist
      const savedData = vi.mocked(localStorage.setItem).mock.calls[0]?.[1];
      const savedMessages = JSON.parse(savedData || '[]');

      expect(savedMessages).toHaveLength(1);
    });

    it('should use correct storage key', async () => {
      const messages = [createTestMessage()];
      vi.mocked(localStorage.getItem).mockReturnValue(JSON.stringify(messages));

      await deleteClawbotMessage(testUserId, 'msg-1');

      expect(localStorage.setItem).toHaveBeenCalledWith(
        `trix_clawbot_history:${testUserId}`,
        expect.any(String)
      );
    });

    it('should handle empty history gracefully', async () => {
      vi.mocked(localStorage.getItem).mockReturnValue(null);

      await deleteClawbotMessage(testUserId, 'msg-1');

      // Should not throw and should set empty array
      expect(localStorage.setItem).toHaveBeenCalledWith(
        `trix_clawbot_history:${testUserId}`,
        '[]'
      );
    });

    it('should handle JSON parse error gracefully', async () => {
      vi.mocked(localStorage.getItem).mockReturnValue('invalid json');

      await deleteClawbotMessage(testUserId, 'msg-1');

      // Should set empty array when parse fails
      expect(localStorage.setItem).toHaveBeenCalledWith(
        `trix_clawbot_history:${testUserId}`,
        '[]'
      );
    });

    it('should handle localStorage error gracefully', async () => {
      vi.mocked(localStorage.getItem).mockImplementation(() => {
        throw new Error('Storage error');
      });

      // Should not throw
      await expect(
        deleteClawbotMessage(testUserId, 'msg-1')
      ).resolves.not.toThrow();
    });
  });
});
