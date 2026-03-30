import React from 'react';

const MOTION_PROP_NAMES = new Set([
  'animate',
  'drag',
  'dragConstraints',
  'dragElastic',
  'dragMomentum',
  'exit',
  'initial',
  'layout',
  'layoutId',
  'onAnimationComplete',
  'onDragEnd',
  'onDragStart',
  'onHoverEnd',
  'onHoverStart',
  'transition',
  'variants',
  'viewport',
  'whileDrag',
  'whileFocus',
  'whileHover',
  'whileInView',
  'whileTap',
]);

function stripMotionProps(props: Record<string, unknown>) {
  return Object.fromEntries(
    Object.entries(props).flatMap(([key, value]) => {
      if (key === 'onHoverStart') {
        return [['onMouseEnter', value]];
      }

      if (key === 'onHoverEnd') {
        return [['onMouseLeave', value]];
      }

      if (MOTION_PROP_NAMES.has(key)) {
        return [];
      }

      return [[key, value]];
    }),
  );
}

function createMotionComponent(tag: string) {
  return ({ children, ...props }: React.PropsWithChildren<Record<string, unknown>>) =>
    React.createElement(tag, stripMotionProps(props), children);
}

export function createFramerMotionMock() {
  return {
    motion: new Proxy(
      {},
      {
        get: (_target, tag: string) => createMotionComponent(tag),
      },
    ),
    AnimatePresence: ({ children }: { children: React.ReactNode }) => <>{children}</>,
    LayoutGroup: ({ children }: { children: React.ReactNode }) => <>{children}</>,
  };
}
