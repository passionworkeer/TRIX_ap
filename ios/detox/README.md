# TRIX3DCompanion - Detox E2E Testing

This directory contains Detox end-to-end (E2E) tests for the TRIX3DCompanion iOS app.

Detox runs tests **outside** the Xcode build process using a JavaScript/TypeScript test runner (Jest). This complements the existing XCUITest suite in `../TRIX3DUITests/`.

## Prerequisites

- **Node.js** >= 18.x
- **npm** >= 9.x
- **Xcode** >= 15.0
- **xcodebuild** (from Xcode command line tools)
- **CocoaPods** (if the project uses Pods)

## Quick Start

### 1. Install dependencies

```bash
cd /Users/jiajingqiu/TRIX_ap/ios/detox
npm install
```

### 2. Set test credentials

Create a `.env` file or export environment variables:

```bash
export TRIX_TEST_EMAIL="your-test-email@example.com"
export TRIX_TEST_PASSWORD="your-test-password"
```

Alternatively, create a config file at `/tmp/trix-ui-config.json`:

```json
{
  "email": "your-test-email@example.com",
  "password": "your-test-password",
  "screenshotDirectory": "/tmp/detox-screenshots"
}
```

### 3. Build the app

```bash
# Using Detox build (recommended)
npm run build

# Or manually via xcodebuild
xcodebuild -workspace ../TRIX3DCompanion.xcworkspace \
  -scheme TRIX3DCompanion \
  -configuration Debug \
  -destination 'platform=iOS Simulator,name=iPhone 15 Pro' \
  build
```

### 4. Run tests

```bash
# Run all tests
npm test

# Run with verbose output
npm run test:debug

# Run on iPhone 16 simulator
npm run test:iphone16

# Run a specific test file
npx detox test e2e/AuthFlow.detox.ts

# Run a specific test
npx detox test e2e/AuthFlow.detox.ts --testNamePattern "should succeed login"
```

## Project Structure

```
detox/
├── package.json          # npm dependencies and scripts
├── detox.config.js       # Detox configuration (legacy .detoxrc format)
├── tsconfig.json         # TypeScript configuration
├── .detoxignore          # Files to exclude from test bundle
├── e2e/
│   ├── config.ts         # Shared test configuration (timeouts, credentials)
│   ├── helpers.ts        # Shared helper functions and AppUIIdentifiers mirror
│   ├── AuthFlow.detox.ts
│   ├── Navigation.detox.ts
│   ├── ChatFlow.detox.ts
│   ├── StudyRoom.detox.ts
│   ├── HomeScreen.detox.ts
│   └── ProfileSettings.detox.ts
└── README.md             # This file
```

## Configuration

The main configuration lives in `detox.config.js`. Two simulator configurations are provided:

| Configuration      | Simulator    | Use case                    |
|--------------------|--------------|-----------------------------|
| `ios.sim.debug`    | iPhone 15 Pro| Default / CI                |
| `ios.sim.iphone16` | iPhone 16    | Latest hardware testing     |

To switch configurations:

```bash
detox test --configuration ios.sim.iphone16
```

## Accessibility Identifiers

Detox tests rely on `accessibilityIdentifier` set in the SwiftUI views. The test helpers (`e2e/helpers.ts`) mirror the `AppUIIdentifiers` enum from `TRIX3DUITests/RealAppTestSupport.swift`.

**If a test fails** because an element cannot be found, check:
1. Does the Swift view have `.accessibilityIdentifier("id")`?
2. Is the identifier string in `helpers.ts` (`AppUI` object) correct?

Some identifiers may need to be added to the Swift source. These are marked with `TODO:` comments in the test files.

## Troubleshooting

### M-Series Mac (Apple Silicon) Issues

On M1/M2/M3 Macs, if you encounter build errors:

```bash
# Clean DerivedData
rm -rf ~/Library/Developer/Xcode/DerivedData/TRIX3DCompanion-*

# Rebuild with correct architecture
xcodebuild -workspace ../TRIX3DCompanion.xcworkspace \
  -scheme TRIX3DCompanion \
  -configuration Debug \
  -destination 'platform=iOS Simulator,name=iPhone 15 Pro,OS=18.0' \
  -arch arm64 \
  build
```

### Detox Cannot Find Element

SwiftUI renders elements asynchronously. If an element appears after a delay:

```typescript
// Use retryInteraction for flaky elements
await retryInteraction(() => tapElement('my.button.id'));
```

### App Fails to Launch (Timeout)

If `device.launchApp()` times out:

1. Check the app binary exists:
   ```bash
   ls ../TRIX3DCompanion/build/Build/Products/Debug-iphonesimulator/TRIX3DCompanion.app
   ```

2. Verify simulator is available:
   ```bash
   xcrun simctl list devices available | grep "iPhone 15"
   ```

3. Check launch arguments in `detox.config.js` are valid for the app.

### JavaScript Heap Out of Memory

If npm install fails with memory error:

```bash
NODE_OPTIONS="--max-old-space-size=4096" npm install
```

### "Module not found" after updating dependencies

```bash
npm install
npx detox clean-framework-cache
npx detox build
```

## CI/CD

For GitHub Actions or other CI systems:

```yaml
- name: Run Detox E2E Tests
  env:
    TRIX_TEST_EMAIL: ${{ secrets.TRIX_TEST_EMAIL }}
    TRIX_TEST_PASSWORD: ${{ secrets.TRIX_TEST_PASSWORD }}
  run: |
    cd ios/detox
    npm install
    npm run build
    npm test -- --record-logs all
```

## Relationship to XCUITest Suite

| Feature              | XCUITest (`../TRIX3DUITests/`) | Detox (`e2e/`)           |
|----------------------|-------------------------------|---------------------------|
| Language             | Swift                         | TypeScript / JavaScript   |
| Runs inside Xcode    | Yes                           | No                        |
| Build dependency     | Compiled with app             | Separate binary build     |
| Test execution       | `xcodebuild test`             | `detox test`             |
| Parallel execution   | Limited                       | Native via Jest           |
| Debugging            | Xcode debugger                | Node.js tools / Jest      |
| CI integration       | xcpretty / xcresult           | Native Jest reporters     |

Both suites use the same `accessibilityIdentifier` strings from `AppUIIdentifiers` in `RealAppTestSupport.swift`. Changes to identifiers must be reflected in both test harnesses.

## Updating Det

When upgrading Detox to a new major version:

1. Update `package.json` version
2. Review [Detox Migration Guide](https://wix.github.io/Detox/docs/guide/migration/)
3. Update `detox.config.js` syntax if API changed
4. Re-run `npm install`
5. Rebuild the app: `npm run build`
6. Run a subset of tests to verify: `npx detox test e2e/AuthFlow.detox.ts`
