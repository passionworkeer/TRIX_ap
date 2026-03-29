# TRIX Native Plugin Publish And Install

## Verified status as of 2026-03-29

- Package name: `@wangjianjun0531/trix-native`
- Package version: `0.1.0`
- Local fallback tarball:
  `E:\desktop\trix-3d-companion\packages\trix-openclaw-native\wangjianjun0531-trix-native-0.1.0.tgz`
- Latest packaged desktop app:
  `E:\desktop\TRIX-Setup-v3\win-unpacked\TRIX Companion.exe`

Verified locally on the current codebase:

- `npm run build` passes
- `npm run build:desktop` passes
- `npm run test` passes
- `npm pack` passes for the plugin package
- `npm publish --dry-run --access public` passes
- real Electron Playwright desktop tests pass
- packaged desktop app can do real conversation listing plus text/image/file/audio send
- real Web accounts can complete:
  - login
  - friend messaging both ways
  - image messaging
  - study room create/join/start
  - map page check
  - achievements page
  - points mall

## Current publish blocker

The package is not published to npm yet.

Real publish was attempted from:

```powershell
E:\desktop\trix-3d-companion\packages\trix-openclaw-native
```

Result:

- `npm whoami` returned `E401 Unauthorized`
- `npm publish --access public` ran tests and packing successfully, then failed at the registry step with:
  - `404 Not Found - PUT https://registry.npmjs.org/@wangjianjun0531%2ftrix-native`

This indicates the package contents are fine, but the current terminal session is not accepted by npm for publishing.

## Fastest path on a new OpenClaw machine

If you just want the plugin working on a new machine, do not wait for npm publish.
Use the local `.tgz` directly.

### 1. Install the plugin from the tarball

```powershell
openclaw plugins install E:\desktop\trix-3d-companion\packages\trix-openclaw-native\wangjianjun0531-trix-native-0.1.0.tgz
```

### 2. Configure the channel

Replace `YOUR_SERVICE_TOKEN` with your real token:

```powershell
openclaw config set channels.trix-native.enabled true --strict-json
openclaw config set channels.trix-native.defaultAccount default
openclaw config set channels.trix-native.accounts.default.name "TRIX Native"
openclaw config set channels.trix-native.accounts.default.serviceUrl "http://127.0.0.1:8788"
openclaw config set channels.trix-native.accounts.default.serviceToken "YOUR_SERVICE_TOKEN"
openclaw config set channels.trix-native.accounts.default.transport ws
```

### 3. Restart OpenClaw gateway

```powershell
openclaw gateway restart
```

### 4. Confirm the plugin is loaded

```powershell
openclaw plugins inspect trix-native
openclaw channels status --deep
```

### 5. Start login or pairing

```powershell
openclaw channels login --channel trix-native --verbose
```

The plugin exposes:

- pairing code
- QR login start
- QR login wait

### 6. Use the verified desktop app

```powershell
E:\desktop\TRIX-Setup-v3\win-unpacked\TRIX Companion.exe
```

## Publish to npm after auth is fixed

Run these commands in the plugin package directory:

```powershell
cd E:\desktop\trix-3d-companion\packages\trix-openclaw-native
npm login
npm whoami
```

Do not continue until `npm whoami` returns:

```text
wangjianjun0531
```

Then publish:

```powershell
npm publish --access public
```

Verify:

```powershell
npm view @wangjianjun0531/trix-native version
```

## If you want to publish under another scope later

Update these fields in `packages/trix-openclaw-native/package.json`:

- `name`
- `openclaw.install.npmSpec`

Example:

```json
{
  "name": "@your-scope/trix-native",
  "openclaw": {
    "install": {
      "npmSpec": "@your-scope/trix-native"
    }
  }
}
```

Then run the same publish flow again.

## Important note about multimodal behavior

The transport and native channel path are verified for:

- text
- image
- file
- audio

If OpenClaw still cannot understand some image content after the message arrives successfully, that is very likely an OpenClaw-side interpretation issue rather than a TRIX Web or native transport issue.
