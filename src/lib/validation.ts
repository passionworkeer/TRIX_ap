/**
 * Validation Rules
 *
 * Centralized validation rules for all user inputs across the application.
 * These rules enforce length limits and format constraints to ensure data integrity.
 *
 * IMPORTANT: These rules must be consistent with:
 * 1. Database schema constraints (CHECK constraints in Supabase)
 * 2. Frontend form validation (React components)
 * 3. API validation (if any backend API exists)
 */

// ============================================
// Validation Rule Types
// ============================================

export interface StringValidationRule {
  min: number;
  max: number;
  pattern?: RegExp;
  required?: boolean;
}

export interface NumericValidationRule {
  min?: number;
  max?: number;
  required?: boolean;
}

export interface ValidationRules {
  strings?: Record<string, StringValidationRule>;
  numbers?: Record<string, NumericValidationRule>;
}

// ============================================
// Application-Specific Validation Rules
// ============================================

/**
 * Authentication & User Profile Validation
 */
export const AUTH_VALIDATION = {
  username: {
    min: 1,
    max: 20,
    pattern: /^[a-zA-Z0-9_\u4e00-\u9fa5]+$/, // Alphanumeric, underscore, and Chinese characters
    required: true,
  },
  password: {
    min: 8,
    max: 128,
    required: true,
  },
  email: {
    min: 5,
    max: 255,
    pattern: /^[^\s@]+@[^\s@]+\.[^\s@]+$/,
    required: true,
  },
  fullName: {
    min: 1,
    max: 100,
    required: false,
  },
  bio: {
    min: 0,
    max: 500,
    required: false,
  },
  website: {
    min: 0,
    max: 500,
    pattern: /^https?:\/\/.+/,
    required: false,
  },
  avatarUrl: {
    min: 0,
    max: 2048, // Allow long URLs
    required: false,
  },
} as const satisfies Record<string, StringValidationRule>;

/**
 * Chat & Messaging Validation
 */
export const CHAT_VALIDATION = {
  messageText: {
    min: 0,
    max: 5000,
    required: false, // Allow empty text when sending media
  },
  conversationId: {
    min: 1,
    max: 100, // UUID format: uuid_uuid
    required: true,
  },
  mediaUri: {
    min: 1,
    max: 2048,
    required: true,
  },
  mediaType: {
    min: 1,
    max: 100,
    required: true,
  },
} as const satisfies Record<string, StringValidationRule>;

/**
 * Friends & Social Validation
 */
export const FRIEND_VALIDATION = {
  account: {
    // Email or username for adding friends
    min: 1,
    max: 255,
    required: true,
  },
  name: {
    min: 1,
    max: 100,
    required: true,
  },
  status: {
    min: 1,
    max: 20, // 'online' | 'offline' | 'busy' | 'away'
    required: true,
  },
} as const satisfies Record<string, StringValidationRule>;

/**
 * Study Room & Sessions Validation
 */
export const STUDY_VALIDATION = {
  subject: {
    min: 0,
    max: 100,
    required: false,
  },
  notes: {
    min: 0,
    max: 5000,
    required: false,
  },
  pairingCode: {
    min: 6,
    max: 6,
    pattern: /^[A-Z0-9]{6}$/i,
    required: true,
  },
  roomId: {
    min: 1,
    max: 100,
    required: true,
  },
} as const satisfies Record<string, StringValidationRule>;

/**
 * Todo & Task Validation
 */
export const TODO_VALIDATION = {
  title: {
    min: 1,
    max: 200,
    required: true,
  },
  description: {
    min: 0,
    max: 2000,
    required: false,
  },
  priority: {
    min: 1,
    max: 20, // 'high' | 'medium' | 'low'
    required: true,
  },
  dueDate: {
    min: 1,
    max: 50, // ISO date string
    required: false,
  },
} as const satisfies Record<string, StringValidationRule>;

/**
 * Schedule & Calendar Validation
 */
export const SCHEDULE_VALIDATION = {
  title: {
    min: 1,
    max: 200,
    required: true,
  },
  description: {
    min: 0,
    max: 2000,
    required: false,
  },
  location: {
    min: 0,
    max: 500,
    required: false,
  },
} as const satisfies Record<string, StringValidationRule>;

/**
 * Location & Places Validation
 */
export const LOCATION_VALIDATION = {
  placeName: {
    min: 1,
    max: 200,
    required: true,
  },
  address: {
    min: 0,
    max: 500,
    required: false,
  },
  category: {
    min: 1,
    max: 50,
    required: true,
  },
} as const satisfies Record<string, StringValidationRule>;

/**
 * Notification Validation
 */
export const NOTIFICATION_VALIDATION = {
  title: {
    min: 1,
    max: 200,
    required: true,
  },
  content: {
    min: 1,
    max: 5000,
    required: true,
  },
  type: {
    min: 1,
    max: 50, // 'message' | 'system' | 'friend_request' | 'study' | 'achievement'
    required: true,
  },
} as const satisfies Record<string, StringValidationRule>;

/**
 * Pairing & QR Code Validation
 */
export const PAIRING_VALIDATION = {
  code: {
    min: 6,
    max: 6,
    pattern: /^[A-Z0-9]{6}$/i,
    required: true,
  },
  deviceId: {
    min: 1,
    max: 255,
    required: true,
  },
  deviceName: {
    min: 1,
    max: 100,
    required: true,
  },
} as const satisfies Record<string, StringValidationRule>;

/**
 * Points Mall Validation
 */
export const MALL_VALIDATION = {
  itemName: {
    min: 1,
    max: 200,
    required: true,
  },
  orderNotes: {
    min: 0,
    max: 500,
    required: false,
  },
} as const satisfies Record<string, StringValidationRule>;

/**
 * Wardrobe Validation
 */
export const WARDROBE_VALIDATION = {
  itemName: {
    min: 1,
    max: 100,
    required: true,
  },
  category: {
    min: 1,
    max: 50,
    required: true,
  },
} as const satisfies Record<string, StringValidationRule>;

// ============================================
// Consolidated Validation Rules
// ============================================

/**
 * Master validation rules object
 * Use this for easy access to all validation rules
 */
export const VALIDATION_RULES = {
  ...AUTH_VALIDATION,
  ...CHAT_VALIDATION,
  ...FRIEND_VALIDATION,
  ...STUDY_VALIDATION,
  ...TODO_VALIDATION,
  ...SCHEDULE_VALIDATION,
  ...LOCATION_VALIDATION,
  ...NOTIFICATION_VALIDATION,
  ...PAIRING_VALIDATION,
  ...MALL_VALIDATION,
  ...WARDROBE_VALIDATION,
} as const;

// ============================================
// Validation Helper Functions
// ============================================

/**
 * Validation error interface
 */
export interface ValidationError {
  field: string;
  message: string;
  value?: unknown;
}

/**
 * Validate a string value against a rule
 */
export function validateString(
  value: string,
  rule: StringValidationRule,
  fieldName: string
): ValidationError | null {
  const trimmedValue = value.trim();

  // Check required
  if (rule.required && !trimmedValue) {
    return {
      field: fieldName,
      message: `${fieldName} is required`,
      value,
    };
  }

  // Skip further validation if not required and empty
  if (!rule.required && !trimmedValue) {
    return null;
  }

  // Check min length
  if (trimmedValue.length < rule.min) {
    return {
      field: fieldName,
      message: `${fieldName} must be at least ${rule.min} character${rule.min > 1 ? 's' : ''}`,
      value,
    };
  }

  // Check max length
  if (trimmedValue.length > rule.max) {
    return {
      field: fieldName,
      message: `${fieldName} must be no more than ${rule.max} character${rule.max > 1 ? 's' : ''}`,
      value,
    };
  }

  // Check pattern
  if (rule.pattern && !rule.pattern.test(trimmedValue)) {
    return {
      field: fieldName,
      message: `${fieldName} format is invalid`,
      value,
    };
  }

  return null;
}

/**
 * Validate an object with multiple fields
 */
export function validateObject<T extends Record<string, unknown>>(
  data: T,
  rules: Record<keyof T, StringValidationRule>
): ValidationError[] {
  const errors: ValidationError[] = [];

  for (const [field, rule] of Object.entries(rules)) {
    const value = data[field];
    if (typeof value === 'string') {
      const error = validateString(value, rule, field);
      if (error) {
        errors.push(error);
      }
    } else if (rule.required && (!value || (typeof value === 'string' && !value.trim()))) {
      errors.push({
        field,
        message: `${field} is required`,
        value,
      });
    }
  }

  return errors;
}

/**
 * Sanitize a string input by trimming and limiting length
 */
export function sanitizeString(value: string, maxLength: number): string {
  return value.trim().slice(0, maxLength);
}

/**
 * Truncate a string to a maximum length and add ellipsis if needed
 */
export function truncateString(value: string, maxLength: number, suffix = '...'): string {
  if (value.length <= maxLength) {
    return value;
  }
  return value.slice(0, maxLength - suffix.length) + suffix;
}

/**
 * Check if a value is within a valid length range
 */
export function isValidLength(value: string, min: number, max: number): boolean {
  const length = value.trim().length;
  return length >= min && length <= max;
}

/**
 * Get a user-friendly error message for common validation failures
 */
export function getValidationErrorMessage(error: ValidationError): string {
  const { field, message } = error;

  // Map technical field names to user-friendly messages
  const fieldMessages: Record<string, string> = {
    username: '用户名',
    password: '密码',
    email: '邮箱',
    fullName: '姓名',
    bio: '个人简介',
    messageText: '消息内容',
    account: '账号',
    title: '标题',
    description: '描述',
    notes: '备注',
    code: '验证码',
    pairingCode: '配对码',
  };

  const fieldName = fieldMessages[field] || field;

  // Generate user-friendly message
  if (message.includes('required')) {
    return `请输入${fieldName}`;
  }
  if (message.includes('at least')) {
    const match = message.match(/at least (\d+) character/);
    const min = match?.[1];
    return `${fieldName}至少需要${min}个字符`;
  }
  if (message.includes('no more than')) {
    const match = message.match(/no more than (\d+) character/);
    const max = match?.[1];
    return `${fieldName}不能超过${max}个字符`;
  }
  if (message.includes('format is invalid')) {
    return `${fieldName}格式不正确`;
  }

  return message;
}
