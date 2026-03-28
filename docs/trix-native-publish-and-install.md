# TRIX Native Plugin Publish And Install

## Current compatibility result

- Plugin package: `@wangjianjun0531/trix-native@0.1.0`
- Local repo OpenClaw dependency checked: `2026.3.12`
- Local global OpenClaw checked: `2026.3.24`
- Result: compatible with current OpenClaw plugin runtime

Verified locally:

- `npm pack` succeeds
- package tests pass
- plugin entry can register a channel with:
  - `setup`
  - `gateway.loginWithQrStart`
  - `gateway.loginWithQrWait`
- `openclaw plugins install <local .tgz>` can load the plugin on OpenClaw `2026.3.24`

What was not fully exercised in this check:

- a live end-to-end pairing against a real TRIX service
- the full web UI flow on a fresh machine

## Before publish

If you want to publish under your own npm scope, update these two fields in `packages/trix-openclaw-native/package.json` first:

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

## Publish commands

Run in:

```powershell
cd E:\desktop\trix-3d-companion\packages\trix-openclaw-native
```

Check login:

```powershell
npm whoami
```

Publish:

```powershell
npm publish --access public --otp <6-digit-code>
```

Verify:

```powershell
npm view @your-scope/trix-native version
```

## New machine install

Install plugin:

```powershell
openclaw plugins install @your-scope/trix-native
```

Restart gateway:

```powershell
openclaw gateway restart
```

Confirm plugin is loaded:

```powershell
openclaw plugins inspect trix-native
```

## New machine config

Minimal channel config:

```powershell
openclaw config set channels.trix-native.enabled true --strict-json
openclaw config set channels.trix-native.defaultAccount default
openclaw config set channels.trix-native.accounts.default.name "TRIX Native"
openclaw config set channels.trix-native.accounts.default.serviceUrl "http://127.0.0.1:8788"
openclaw config set channels.trix-native.accounts.default.serviceToken "YOUR_SERVICE_TOKEN"
openclaw config set channels.trix-native.accounts.default.transport ws
```

Then restart gateway again:

```powershell
openclaw gateway restart
```

Check channel/plugin state:

```powershell
openclaw plugins inspect trix-native
openclaw channels status --deep
```

## Pairing

After the channel config is present, the plugin code exposes:

- pairing code output
- QR login start
- QR login wait

CLI login entry:

```powershell
openclaw channels login --channel trix-native --verbose
```

If your OpenClaw web UI already surfaces plugin-provided channel login, it should use the same login hooks.

## Notes

- OpenClaw currently still loads this plugin successfully even though `package.json` contains `openclaw.setupEntry`; the main channel plugin already exposes `setup`, so current versions still work.
- On a fresh machine, the fastest path is: publish -> install plugin -> set `serviceUrl` and `serviceToken` -> restart gateway -> run channel login.
