# Claude Code Hooks for End-to-End Delivery

This directory contains quality gate hooks for the `end-to-end-delivery` skill.

## Available Hooks

### Pre-Commit Hooks
- **check-tests-pass.sh** - Blocks commit if tests fail
- **check-lint-pass.sh** - Blocks write operations if linting fails

### Pre-Push Hooks
- **check-build-pass.sh** - Blocks push if build fails
- **check-e2e-pass.sh** - Blocks push if E2E tests fail

### Post-Deployment Hooks
- **smoke-test.sh** - Verifies deployment health after push

## How to Configure Hooks

Add these hooks to your Claude Code configuration file (`.claude/config.json`):

```json
{
  "hooks": {
    "PreToolUse": {
      "Write": {
        "pattern": "**/*.{ts,tsx,js,jsx}",
        "command": "bash .claude/hooks/check-lint-pass.sh"
      },
      "Bash": {
        "pattern": "git commit",
        "command": "bash .claude/hooks/check-tests-pass.sh"
      }
    },
    "userPromptSubmit": {
      "pattern": "git push",
      "command": "bash .claude/hooks/check-build-pass.sh && bash .claude/hooks/check-e2e-pass.sh"
    },
    "PostToolUse": {
      "Bash": {
        "pattern": "git push",
        "command": "bash .claude/hooks/smoke-test.sh"
      }
    }
  }
}
```

## Hook Descriptions

### check-tests-pass.sh
**When**: Before git commit
**What**: Runs `npm test` to ensure all tests pass
**Why**: Prevent committing broken code
**Exit**: 1 if tests fail, 0 if all pass

### check-build-pass.sh
**When**: Before git push
**What**: Runs `npm run build` to ensure project builds successfully
**Why**: Prevent pushing code that can't be built
**Exit**: 1 if build fails, 0 if build succeeds

### check-lint-pass.sh
**When**: Before writing code files
**What**: Runs `npm run lint` to ensure code quality
**Why**: Maintain code quality standards
**Exit**: 1 if linting fails, 0 if linting passes

### check-e2e-pass.sh
**When**: Before git push (after build check)
**What**: Runs Playwright E2E tests
**Why**: Ensure user flows work before deploying
**Exit**: 1 if E2E tests fail, 0 if all pass

### smoke-test.sh
**When**: After git push completes
**What**: Pings the deployment URL to verify it's responding
**Why**: Catch deployment failures immediately
**Exit**: 1 if deployment unhealthy, 0 if healthy

## Environment Variables

### For smoke-test.sh
- `DEPLOY_URL` - Your deployment URL (default: http://localhost:3000)
- `HEALTH_CHECK_PATH` - Health check endpoint (default: /health)
- `MAX_RETRIES` - Max retry attempts (default: 30)
- `RETRY_DELAY` - Seconds between retries (default: 2)

**Example**:
```bash
export DEPLOY_URL="https://myapp.com"
export HEALTH_CHECK_PATH="/api/health"
```

## Making Hooks Executable

On Unix-like systems (Linux, macOS, Git Bash):
```bash
chmod +x .claude/hooks/*.sh
```

On Windows (Git Bash or WSL):
```bash
bash chmod +x .claude/hooks/*.sh
```

## Customizing Hooks

### Disabling Specific Hooks

If a hook doesn't apply to your project, you can:

**Option 1**: Remove it from config.json
**Option 2**: Make the hook exit 0 immediately:
```bash
#!/bin/bash
# Disabled for this project
exit 0
```

### Adding New Hooks

Create a new `.sh` file in this directory and reference it in `config.json`.

**Example: Type checking hook**
```bash
#!/bin/bash
# .claude/hooks/check-types.sh
echo "🔍 Running type check..."
if npm run type-check 2>&1; then
  echo "✅ Type check passed"
  exit 0
else
  echo "❌ Type check failed"
  exit 1
fi
```

## Testing Hooks

Test hooks manually before relying on them:

```bash
# Test test hook
bash .claude/hooks/check-tests-pass.sh

# Test build hook
bash .claude/hooks/check-build-pass.sh

# Test lint hook
bash .claude/hooks/check-lint-pass.sh

# Test E2E hook
bash .claude/hooks/check-e2e-pass.sh

# Test smoke test hook
bash .claude/hooks/smoke-test.sh
```

## Troubleshooting

### Hook runs but doesn't block operations

**Problem**: Hook exits with 0 but should exit with 1
**Solution**: Ensure hook uses `set -e` at the top to exit on errors

### Hook permissions denied

**Problem**: `Permission denied` when running hooks
**Solution**: Make hooks executable: `chmod +x .claude/hooks/*.sh`

### Hook not found

**Problem**: Claude can't find the hook script
**Solution**: Use absolute paths or paths relative to project root:
```json
{
  "command": "bash ./.claude/hooks/check-tests-pass.sh"
}
```

### Hook slows down development

**Problem**: Hooks take too long to run
**Solutions**:
1. Run less comprehensive tests in hooks, full tests in CI
2. Use `--parallel` flag if your test runner supports it
3. Cache dependencies to speed up tests
4. Only run expensive hooks on push, not on every commit

## Best Practices

1. **Fast Feedback**: Keep hooks fast (< 30 seconds)
2. **Fail Fast**: Check cheapest things first (lint → types → tests → build → E2E)
3. **Clear Messages**: Print what's being checked and result
4. **Helpful Errors**: Tell users how to fix failures
5. **Skip Gracefully**: If a tool isn't configured, skip with a warning

## Integration with CI/CD

These hooks complement but don't replace CI/CD:

- **Hooks**: Fast feedback during development, prevent broken code locally
- **CI/CD**: Comprehensive testing, run on all platforms, deploy on success

Use both for maximum quality!
