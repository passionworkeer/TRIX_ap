const simulatorName = process.env.DETOX_DEVICE_NAME || 'iPhone 17 Pro';

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
        'xcodebuild -project TRIX3DCompanion.xcodeproj ' +
        '-scheme TRIX3DCompanion ' +
        '-configuration Debug ' +
        '-destination "generic/platform=iOS Simulator" ' +
        '-derivedDataPath ./build ' +
        'build',
      device: {
        id: simulatorName,
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
