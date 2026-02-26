# iOS CI Workflow

## Swift CI for TRIX 3D Companion

```yaml
name: iOS CI

on:
  push:
    branches: [main, develop, 'feat/**']
    paths:
      - 'ios/**'
  pull_request:
    branches: [main, develop]
    paths:
      - 'ios/**'

jobs:
  build:
    runs-on: macos-latest

    steps:
      - name: Checkout code
        uses: actions/checkout@v4

      - name: Select Xcode
        run: sudo xcode-select -s /Applications/Xcode.app/Contents/Developer

      - name: Show Xcode version
        run: xcodebuild -version

      - name: Cache Swift packages
        uses: actions/cache@v3
        with:
          path: |
            ~/Library/Developer/Xcode/DerivedData
            .build
          key: ${{ runner.os }}-spm-${{ hashFiles('**/Package.resolved') }}
          restore-keys: |
            ${{ runner.os }}-spm-

      - name: Build iOS
        run: |
          cd ios/TRIX3DCompanion
          xcodebuild -project TRIX3DCompanion.xcodeproj \
            -scheme TRIX3DCompanion \
            -configuration Debug \
            -destination 'platform=iOS Simulator,name=iPhone 14 Pro' \
            build

  test:
    runs-on: macos-latest

    steps:
      - name: Checkout code
        uses: actions/checkout@v4

      - name: Select Xcode
        run: sudo xcode-select -s /Applications/Xcode.app/Contents/Developer

      - name: Run tests
        run: |
          cd ios/TRIX3DCompanion
          xcodebuild -project TRIX3DCompanion.xcodeproj \
            -scheme TRIX3DCompanion \
            -configuration Debug \
            -destination 'platform=iOS Simulator,name=iPhone 14 Pro' \
            test

      - name: Upload coverage
        uses: codecov/codecov-action@v3
        with:
          directory: ios/
          flags: ios
          name: ios-coverage

  swiftlint:
    runs-on: ubuntu-latest

    steps:
      - name: Checkout code
        uses: actions/checkout@v4

      - name: Run SwiftLint
        uses: norio-nomura/action-swiftlint@main

  audit:
    runs-on: macos-latest

    steps:
      - name: Checkout code
        uses: actions/checkout@v4

      - name: Run Swift Package Audit
        run: |
          cd ios/TRIX3DCompanion
          swift package audit

  dependency-review:
    runs-on: ubuntu-latest
    permissions:
      actions: read
      contents: read
      security-events: write

    steps:
      - name: Checkout code
        uses: actions/checkout@v4

      - name: Dependency Review
        uses: actions/dependency-review-action@v4

  notify:
    needs: [build, test, swiftlint]
    runs-on: ubuntu-latest

    steps:
      - name: Success notification
        if: success()
        run: echo "iOS CI completed successfully"

      - name: Failure notification
        if: failure()
        run: echo "iOS CI failed - check logs"
```

---

## SwiftLint Configuration

Create `.swiftlint.yml` in the ios directory:

```yaml
disabled_rules:
  - trailing_whitespace
  - line_length

opt_in_rules:
  - empty_count
  - explicit_init
  - closure_spacing
  - redundant_nil_coalescing

excluded:
  - .build
  - DerivedData
  - Package.resolved
  - TRIX3DCompanion.xcodeproj

line_length:
  warning: 120
  error: 200
  ignores_function_declarations: true
  ignores_comments: true

type_body_length:
  warning: 300
  error: 400

file_length:
  warning: 500
  error: 1000

function_body_length:
  warning: 50
  error: 100

cyclomatic_complexity:
  warning: 15
  error: 25
```

---

## Code Coverage Configuration

Add to your scheme in Xcode:
1. Select Product → Scheme → Edit Scheme
2. Enable "Gather Code Coverage" for Test action
3. Add `xcpretty` for formatted output

```bash
# Install xcpretty for better output
brew install xcpretty

# Run tests with coverage
xcodebuild test \
  -scheme TRIX3DCompanion \
  -destination 'platform=iOS Simulator,name=iPhone 14 Pro' \
  -enableCodeCoverage YES \
  | xcpretty --color --report json-compilation-database --output ./report.json
```

---

## Usage

This workflow will:
1. **Build** - Build the iOS project on macOS latest
2. **Test** - Run unit tests
3. **SwiftLint** - Check code style
4. **Audit** - Check for vulnerabilities
5. **Dependency Review** - Review dependencies

---

*Generated: 2026-02-26*
