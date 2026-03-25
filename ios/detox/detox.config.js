module.exports = {
  testEnvironment: './e2e/config',

  databases: {},

  artifacts: {
    storage: {
      path: './artifacts',
    },
    plugins: {
      uiHierarchy: {
        enabled: true,
      },
      screenshot: {
        shouldTakeAutomatically: 'failure',
      },
    },
  },

  testRunner: 'jest-circus/runner',

  configs: {
    'ios.sim.debug': {
      type: 'ios.simulator',
      binaryPath: '../TRIX3DCompanion/build/Build/Products/Debug-iphonesimulator/TRIX3DCompanion.app',
      build:
        'cd ../TRIX3DCompanion && ' +
        'xcodebuild -workspace TRIX3DCompanion.xcworkspace ' +
        '-scheme TRIX3DCompanion ' +
        '-configuration Debug ' +
        '-destination "platform=iOS Simulator,name=iPhone 15 Pro" ' +
        '-derivedDataPath ./build ' +
        'build',
      device: {
        id: 'iPhone 15 Pro',
      },
      apps: ['ios.sim.debug'],
      behavior: {
        launchApp: 'single',
        startupTimeout: {
          global: 60000,
        },
        args: {
          '--skip-onboarding': true,
          '--force-logged-out': true,
          '-AppleLanguages': '(zh-Hans)',
          '-AppleLocale': 'zh-Hans_CN',
        },
      },
    },

    'ios.sim.iphone16': {
      type: 'ios.simulator',
      binaryPath: '../TRIX3DCompanion/build/Build/Products/Debug-iphonesimulator/TRIX3DCompanion.app',
      build:
        'cd ../TRIX3DCompanion && ' +
        'xcodebuild -workspace TRIX3DCompanion.xcworkspace ' +
        '-scheme TRIX3DCompanion ' +
        '-configuration Debug ' +
        '-destination "platform=iOS Simulator,name=iPhone 16" ' +
        '-derivedDataPath ./build ' +
        'build',
      device: {
        id: 'iPhone 16',
      },
      apps: ['ios.sim.debug'],
      behavior: {
        launchApp: 'single',
        startupTimeout: {
          global: 60000,
        },
        args: {
          '--skip-onboarding': true,
          '--force-logged-out': true,
          '-AppleLanguages': '(zh-Hans)',
          '-AppleLocale': 'zh-Hans_CN',
        },
      },
    },
  },
};
