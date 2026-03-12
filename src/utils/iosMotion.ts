export const IOS_EASE_OUT = [0.22, 1, 0.36, 1] as const;
export const IOS_EASE_IN_OUT = [0.32, 0.72, 0, 1] as const;

export const iosSpring = {
  type: 'spring' as const,
  stiffness: 340,
  damping: 26,
  mass: 0.85,
};

export const iosQuickSpring = {
  type: 'spring' as const,
  stiffness: 420,
  damping: 30,
  mass: 0.72,
};

export const iosGentleSpring = {
  type: 'spring' as const,
  stiffness: 280,
  damping: 28,
  mass: 0.92,
};

export const iosPressableMotion = {
  whileHover: {
    y: -1.5,
    scale: 1.01,
    transition: {
      duration: 0.22,
      ease: IOS_EASE_OUT,
    },
  },
  whileTap: {
    y: 0.5,
    scale: 0.965,
    transition: {
      duration: 0.12,
      ease: IOS_EASE_IN_OUT,
    },
  },
};

export const iosIconButtonMotion = {
  whileHover: {
    y: -1,
    scale: 1.03,
    transition: {
      duration: 0.22,
      ease: IOS_EASE_OUT,
    },
  },
  whileTap: {
    y: 0.5,
    scale: 0.92,
    transition: {
      duration: 0.12,
      ease: IOS_EASE_IN_OUT,
    },
  },
};

export const iosBackdropMotion = {
  initial: { opacity: 0 },
  animate: {
    opacity: 1,
    transition: {
      duration: 0.18,
      ease: IOS_EASE_OUT,
    },
  },
  exit: {
    opacity: 0,
    transition: {
      duration: 0.14,
      ease: IOS_EASE_OUT,
    },
  },
};

export const iosSheetMotion = {
  initial: { opacity: 0, y: 28, scale: 0.96 },
  animate: {
    opacity: 1,
    y: 0,
    scale: 1,
    transition: iosGentleSpring,
  },
  exit: {
    opacity: 0,
    y: 18,
    scale: 0.98,
    transition: {
      duration: 0.16,
      ease: IOS_EASE_OUT,
    },
  },
};

export const iosFloatingMotion = {
  initial: { opacity: 0, y: 48, scale: 0.92 },
  animate: {
    opacity: 1,
    y: 0,
    scale: 1,
    transition: iosSpring,
  },
  exit: {
    opacity: 0,
    y: 30,
    scale: 0.96,
    transition: {
      duration: 0.16,
      ease: IOS_EASE_OUT,
    },
  },
};

export const iosSidePanelMotion = {
  initial: { opacity: 0, x: 24, scale: 0.985 },
  animate: {
    opacity: 1,
    x: 0,
    scale: 1,
    transition: iosGentleSpring,
  },
  exit: {
    opacity: 0,
    x: 18,
    scale: 0.99,
    transition: {
      duration: 0.16,
      ease: IOS_EASE_OUT,
    },
  },
};
