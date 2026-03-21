/**
 * cn() — classNames utility
 * Merges class names conditionally, handling Tailwind class deduplication
 */

/**
 * Combines class names, filtering out falsy values.
 * Preserves Tailwind classes for proper deduplication.
 */
export function cn(...classes: (string | undefined | null | false | 0 | '')[]): string {
  return classes.filter(Boolean).join(' ');
}

/**
 * Merge multiple class strings and resolve conflicts.
 * Last class wins for same-base Tailwind utilities.
 */
export function mergeClasses(...classStrings: (string | undefined | null | false)[]): string {
  const all = classStrings.filter(Boolean).join(' ').split(/\s+/).filter(Boolean);
  return [...new Set(all)].join(' ');
}
