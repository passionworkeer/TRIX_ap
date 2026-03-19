## macOS launchd templates

These templates are for a Mac that runs the OpenClaw Gateway locally and connects to a remote Trix Service.

Before loading them, replace:

- `__HOME__` with your macOS home directory
- `__OPENCLAW_JS__` with your installed `openclaw/dist/index.js` path
- `__REPO_ROOT__` with the local checkout root

Suggested install steps:

```bash
mkdir -p ~/Library/LaunchAgents
cp ai.openclaw.gateway.plist ~/Library/LaunchAgents/
cp ai.openclaw.profile-backup.plist ~/Library/LaunchAgents/

launchctl bootstrap "gui/$(id -u)" ~/Library/LaunchAgents/ai.openclaw.gateway.plist
launchctl bootstrap "gui/$(id -u)" ~/Library/LaunchAgents/ai.openclaw.profile-backup.plist
launchctl enable "gui/$(id -u)/ai.openclaw.gateway"
launchctl enable "gui/$(id -u)/ai.openclaw.profile-backup"
```
