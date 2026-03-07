/**
 * HTML Escape Utility
 * 用于防止 XSS 攻击
 */

/**
 * 转义 HTML 特殊字符
 * @param text - 要转义的文本
 * @returns 转义后的文本
 */
export function escapeHtml(text: string): string {
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}

/**
 * 转义可能用于 URL 的字符
 * @param text - 要转义的文本
 * @returns 转义后的文本
 */
export function escapeUrl(text: string): string {
  return encodeURIComponent(text);
}

export default escapeHtml;
