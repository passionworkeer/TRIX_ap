"""
TRIX 3D Companion — Comprehensive UI Audit
Tests: Web (http://localhost:5173) + Desktop (Electron)

Usage:
    # Test Web only
    python tests/comprehensive_audit.py --web-only

    # Test Desktop only
    python tests/comprehensive_audit.py --desktop-only

    # Test both (default)
    python tests/comprehensive_audit.py
"""

import argparse
import subprocess
import sys
import time
import json
from pathlib import Path
import os

# Fix Windows GBK encoding
os.environ["PYTHONIOENCODING"] = "utf-8"
sys.stdout.reconfigure(encoding="utf-8", errors="replace")
sys.stderr.reconfigure(encoding="utf-8", errors="replace")

# Add project root to path
PROJECT_ROOT = Path(__file__).parent.parent
sys.path.insert(0, str(PROJECT_ROOT))

from playwright.sync_api import sync_playwright, expect


def wait_for_url(page, url, timeout=10000):
    """Wait for specific URL pattern."""
    from playwright.sync_api import WebSocketRoute
    try:
        page.wait_for_url(url, timeout=timeout)
        return True
    except Exception:
        return False


def console_collector(page):
    """Collect console messages."""
    logs = []
    page.on("console", lambda msg: logs.append(f"[{msg.type}] {msg.text}"))
    return logs


# ─────────────────────────────────────────────
# WEB TESTS
# ─────────────────────────────────────────────

def test_web_landing(page):
    """Test landing page loads correctly."""
    print("\n>> [WEB] Testing landing page...")
    page.goto("http://localhost:5173/", wait_until="networkidle")

    # Check title or main content
    title = page.title()
    print(f"   Page title: {title}")

    # Check main heading or app element exists
    body = page.locator("body")
    assert body.is_visible(), "Body should be visible"

    # Check for any visible text
    text = page.locator("body").inner_text()
    print(f"   Body text preview: {text[:100]}...")

    print("   [OK] Landing page loaded")


def test_web_navigation(page):
    """Test main navigation elements."""
    print("\n>> [WEB] Testing navigation...")

    # Look for nav, header, or main navigation elements
    selectors_to_try = [
        "nav",
        "header",
        "[class*='nav']",
        "[class*='header']",
        "[role='navigation']",
        "a",
    ]

    found_nav = None
    for sel in selectors_to_try:
        elements = page.locator(sel).all()
        if elements:
            print(f"   Found {len(elements)} <{sel}> element(s)")
            found_nav = elements
            break

    if found_nav:
        # Try clicking first link
        links = page.locator("a[href]").all()
        print(f"   Found {len(links)} links total")
        if links:
            first_link = links[0]
            href = first_link.get_attribute("href")
            print(f"   First link: {href}")


def test_web_auth_flows(page):
    """Test sign in and sign up UI flows."""
    print("\n>> [WEB] Testing auth flows...")

    # Look for sign in / sign up buttons
    auth_selectors = [
        "text=Sign in",
        "text=登录",
        "text=Sign In",
        "text=Login",
        "button:has-text('Sign')",
        "button:has-text('登录')",
        "[href*='sign']",
        "[href*='login']",
        "[href*='auth']",
    ]

    for sel in auth_selectors:
        btns = page.locator(sel).all()
        if btns:
            print(f"   Found auth element: {sel} ({len(btns)} matches)")
            try:
                if btns[0].is_visible():
                    print(f"   [OK] Clicking: {sel}")
                    btns[0].click()
                    page.wait_for_timeout(1000)
                    print(f"   Current URL: {page.url}")
                    break
            except Exception as e:
                print(f"   [WARN] Could not click {sel}: {e}")


def test_web_settings(page):
    """Test settings page if accessible."""
    print("\n>> [WEB] Testing settings page...")

    settings_selectors = [
        "text=Settings",
        "text=设置",
        "[href*='settings']",
        "[href*='setting']",
        "[aria-label*='setting']",
        "[aria-label*='Settings']",
    ]

    for sel in settings_selectors:
        elems = page.locator(sel).all()
        visible = [e for e in elems if e.is_visible()]
        if visible:
            print(f"   Found settings: {sel}")
            try:
                visible[0].click()
                page.wait_for_timeout(1500)
                print(f"   Navigated to: {page.url}")
                break
            except Exception as e:
                print(f"   [WARN] {sel}: {e}")


def test_web_achievements(page):
    """Test achievements panel."""
    print("\n>> [WEB] Testing achievements...")

    ach_selectors = [
        "text=Achievement",
        "text=成就",
        "[href*='achievement']",
        "[class*='achievement']",
        "text=TRIX",
    ]

    for sel in ach_selectors:
        elems = page.locator(sel).all()
        if elems:
            print(f"   Found achievements: {sel}")
            break


def test_web_dark_mode(page):
    """Test dark mode toggle."""
    print("\n>> [WEB] Testing dark mode...")

    dark_selectors = [
        "[class*='dark']",
        "[class*='theme']",
        "[class*='mode']",
        "[aria-label*='dark']",
        "[aria-label*='Dark']",
        "button",
        "text=Dark",
        "text=深色",
    ]

    for sel in dark_selectors:
        btns = page.locator(sel).all()
        dark_btns = [b for b in btns if b.is_visible()]
        if dark_btns:
            print(f"   Found theme buttons: {sel} ({len(dark_btns)} visible)")
            break


def test_web_responsive(page):
    """Test responsive breakpoints."""
    print("\n>> [WEB] Testing responsive design...")

    breakpoints = [
        (390, 844, "iPhone 14"),
        (768, 1024, "iPad"),
        (1440, 900, "Desktop"),
    ]

    for width, height, name in breakpoints:
        page.set_viewport_size({"width": width, "height": height})
        page.wait_for_timeout(500)
        body = page.locator("body")
        visible = body.is_visible()
        print(f"   {name} ({width}x{height}): {'[OK] visible' if visible else '[FAIL] broken'}")


def test_web_console_errors(page):
    """Capture console errors with URL for debugging."""
    print("\n>> [WEB] Checking console errors...")

    errors = []
    warnings = []

    def handle_console(msg):
        loc = msg.location or {}
        prefix = f"[{msg.type}] {loc.get('url','?')}:{loc.get('lineNumber','?')} — "
        if msg.type == "error":
            errors.append(prefix + msg.text)
        elif msg.type == "warning":
            warnings.append(msg.text)

    page.on("console", handle_console)
    page.goto("http://localhost:5173/", wait_until="networkidle")
    page.wait_for_timeout(3000)

    if errors:
        print(f"   [FAIL] {len(errors)} console ERROR(S):")
        for e in errors:
            print(f"      - {e[:300]}")
    else:
        print("   [OK] No console errors")

    if warnings:
        print(f"   [WARN] {len(warnings)} warning(s) (first 3):")
        for w in warnings[:3]:
            print(f"      - {w[:100]}")


def test_web_network_requests(page):
    """Check network requests for failures."""
    print("\n>> [WEB] Checking network requests...")

    failed_requests = []

    def handle_response(response):
        if response.status >= 400:
            failed_requests.append(f"{response.status} {response.url}")

    page.on("response", handle_response)
    page.goto("http://localhost:5173/", wait_until="networkidle")
    page.wait_for_timeout(2000)

    if failed_requests:
        print(f"   [FAIL] {len(failed_requests)} failed request(s):")
        for r in failed_requests[:5]:
            print(f"      - {r[:120]}")
    else:
        print("   [OK] All requests OK")


# ─────────────────────────────────────────────
# DESKTOP TESTS (Electron)
# ─────────────────────────────────────────────

def get_dist_executable():
    """Find the packaged Electron executable."""
    paths = [
        PROJECT_ROOT / "desktop" / "release2" / "win-unpacked" / "TRIX Companion.exe",
        PROJECT_ROOT / "desktop" / "release" / "win-unpacked" / "TRIX Companion.exe",
        PROJECT_ROOT / "dist" / "win-unpacked" / "TRIX Companion.exe",
        PROJECT_ROOT / "dist" / "win-unpacked" / "trix-3d-companion.exe",
    ]
    for p in paths:
        if p.exists():
            return str(p)
    return None


def test_desktop_launch(electron_app, executable_path):
    """Test Desktop app launches."""
    print("\n>> [DESKTOP] Testing Electron launch...")

    # electron_app is provided by playwright-desktop fixture
    window = electron_app.windows()[0]
    print(f"   Window title: {window.title}")
    print(f"   Window visible: {window.is_visible()}")

    # Wait for app to fully load
    try:
        window.wait_for_selector("body", timeout=10000)
        print("   [OK] App window loaded")
    except Exception as e:
        print(f"   [WARN] Body not found: {e}")


def test_desktop_float_window(electron_app):
    """Test float window functionality."""
    print("\n>> [DESKTOP] Testing float window...")

    try:
        windows = electron_app.windows()
        print(f"   Total windows: {len(windows)}")
        for w in windows:
            print(f"   - '{w.title}' visible={w.is_visible()}")
    except Exception as e:
        print(f"   [WARN] Could not enumerate windows: {e}")


def test_desktop_ui_elements(electron_app):
    """Test desktop UI elements."""
    print("\n>> [DESKTOP] Testing UI elements...")

    try:
        page = electron_app.windows()[0]
        # Take a screenshot
        screenshot_path = PROJECT_ROOT / "audit-desktop-screenshot.png"
        page.screenshot(path=str(screenshot_path))
        print(f"   >> Screenshot saved: {screenshot_path}")

        # Check for common elements
        selectors = ["button", "input", "[class*='panel']", "[class*='window']"]
        for sel in selectors:
            count = page.locator(sel).count()
            if count > 0:
                print(f"   {sel}: {count} found")
    except Exception as e:
        print(f"   [WARN] UI check failed: {e}")


def test_desktop_settings_ipc(electron_app):
    """Test Settings IPC communication."""
    print("\n>> [DESKTOP] Testing Settings IPC...")

    try:
        # Try to evaluate JS in the renderer
        page = electron_app.windows()[0]
        result = page.evaluate("() => document.title")
        print(f"   Page title: {result}")

        # Try to access electron API
        result = page.evaluate("""
            () => {
                if (window.electronAPI) return 'electronAPI exists';
                return 'no electronAPI';
            }
        """)
        print(f"   Electron API: {result}")
    except Exception as e:
        print(f"   [WARN] IPC test failed: {e}")


# ─────────────────────────────────────────────
# MAIN
# ─────────────────────────────────────────────

def run_web_tests():
    """Run all web tests."""
    print("=" * 60)
    print(">> WEB UI AUDIT — http://localhost:5173")
    print("=" * 60)

    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True)
        page = browser.new_page(viewport={"width": 1440, "height": 900})

        test_web_landing(page)
        test_web_navigation(page)
        test_web_auth_flows(page)
        test_web_settings(page)
        test_web_achievements(page)
        test_web_dark_mode(page)
        test_web_responsive(page)
        test_web_console_errors(page)
        test_web_network_requests(page)

        # Take final screenshot
        screenshot_path = PROJECT_ROOT / "audit-web-screenshot.png"
        page.screenshot(path=str(screenshot_path), full_page=True)
        print(f"\n>> Full page screenshot: {screenshot_path}")

        browser.close()

    print("\n[OK] Web audit complete!")


def run_desktop_tests():
    """Run all desktop tests using Playwright electron."""
    print("=" * 60)
    print(">> DESKTOP AUDIT — Electron")
    print("=" * 60)

    executable = get_dist_executable()
    if not executable:
        print("[FAIL] No Electron executable found. Build with: npm run build:desktop")
        return

    print(f"Executable: {executable}")

    with sync_playwright() as p:
        try:
            electron_app = p.electron.launch(executable=executable, headless=False)
        except Exception as e:
            print(f"[FAIL] Could not launch Electron: {e}")
            return

        test_desktop_launch(electron_app, executable)
        test_desktop_float_window(electron_app)
        test_desktop_ui_elements(electron_app)
        test_desktop_settings_ipc(electron_app)

        electron_app.kill()

    print("\n[OK] Desktop audit complete!")


def main():
    parser = argparse.ArgumentParser(description="TRIX 3D Companion Comprehensive Audit")
    parser.add_argument("--web-only", action="store_true", help="Only run web tests")
    parser.add_argument("--desktop-only", action="store_true", help="Only run desktop tests")
    args = parser.parse_args()

    if args.desktop_only:
        run_desktop_tests()
    elif args.web_only:
        run_web_tests()
    else:
        run_web_tests()
        print("\n" + "=" * 60)
        run_desktop_tests()

    print("\n" + "=" * 60)
    print(">> AUDIT COMPLETE — Review screenshots above")
    print("=" * 60)


if __name__ == "__main__":
    main()
