"""
测试 TRIX 3D Companion 应用的可访问性和响应式设计
"""

import sys
import io

# Fix UTF-8 encoding on Windows
if sys.platform == 'win32':
    sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding='utf-8')
    sys.stderr = io.TextIOWrapper(sys.stderr.buffer, encoding='utf-8')

from playwright.sync_api import sync_playwright
import json
import time

def test_accessibility_and_responsive():
    """测试可访问性和响应式设计"""

    with sync_playwright() as p:
        browser = p.chromium.launch(headless=False)

        # 测试不同的视口尺寸
        viewports = [
            {'width': 375, 'height': 667, 'name': 'iPhone SE'},
            {'width': 768, 'height': 1024, 'name': 'iPad'},
            {'width': 1920, 'height': 1080, 'name': 'Desktop'}
        ]

        results = {
            'accessibility': {},
            'responsive': {},
            'color_contrast': {}
        }

        for viewport in viewports:
            print(f"\n{'='*60}")
            print(f"测试 {viewport['name']} ({viewport['width']}x{viewport['height']})")
            print('='*60)

            page = browser.new_page()
            page.set_viewport_size({"width": viewport['width'], "height": viewport['height']})

            # 访问首页
            print("访问首页...")
            page.goto('http://localhost:5173')
            page.wait_for_load_state('networkidle')
            time.sleep(2)  # 等待动画完成

            # 截图
            screenshot_path = f'/tmp/trix-home-{viewport["name"]}.png'
            page.screenshot(path=screenshot_path, full_page=True)
            print(f"✅ 截图已保存: {screenshot_path}")

            # 检查可访问性 - 手动检查
            print("运行可访问性审计...")

            # 检查 ARIA 标签
            buttons = page.locator('button').all()
            buttons_without_labels = []
            for btn in buttons[:20]:  # 只检查前20个按钮
                aria_label = btn.get_attribute('aria-label')
                text_content = btn.text_content()
                if not aria_label and not text_content:
                    buttons_without_labels.append('Button without label')

            # 统计可访问性问题
            violations = []
            if buttons_without_labels:
                violations.append({
                    'id': 'missing-aria-labels',
                    'description': f'{len(buttons_without_labels)} 个按钮缺少 aria-label 或文本内容',
                    'impact': 'serious'
                })

            results['accessibility'][viewport['name']] = {
                'violations_count': len(violations),
                'violations': violations[:5]  # 只保留前5个
            }

            if violations:
                print(f"⚠️  发现 {len(violations)} 个可访问性问题:")
                for i, violation in enumerate(violations[:5], 1):
                    print(f"  {i}. {violation.get('description', 'Unknown')}")
            else:
                print("✅ 未发现可访问性问题")

            # 检查响应式元素
            print("检查响应式元素...")
            buttons = page.locator('button').all()
            clickable_divs = page.locator('div[onclick], div[role="button"]').all()
            inputs = page.locator('input').all()

            results['responsive'][viewport['name']] = {
                'buttons': len(buttons),
                'clickable_divs': len(clickable_divs),
                'inputs': len(inputs)
            }

            print(f"  按钮: {len(buttons)}")
            print(f"  可点击 div: {len(clickable_divs)}")
            print(f"  输入框: {len(inputs)}")

            # 检查 ARIA 标签
            buttons_with_label = 0
            for button in buttons[:10]:  # 只检查前10个
                aria_label = button.get_attribute('aria-label')
                if aria_label:
                    buttons_with_label += 1

            print(f"  前10个按钮中有 aria-label 的: {buttons_with_label}")

            # 检查触摸目标大小（只针对移动端）
            if viewport['width'] <= 768:
                print("\n检查触摸目标大小...")
                small_buttons = 0
                for button in buttons[:20]:
                    box = button.bounding_box()
                    if box:
                        width = box['width'] or 0
                        height = box['height'] or 0
                        if width < 44 or height < 44:
                            small_buttons += 1

                results['responsive'][viewport['name']]['small_touch_targets'] = small_buttons
                print(f"  触摸目标小于 44px 的按钮: {small_buttons}/20")

            # 测试键盘导航
            if viewport['name'] == 'Desktop':
                print("\n测试键盘导航...")
                try:
                    # Tab 键导航
                    page.keyboard.press('Tab')
                    time.sleep(0.5)
                    focused = page.evaluate('document.activeElement.tagName')
                    print(f"  Tab 后聚焦的元素: {focused}")

                    # 检查焦点指示器
                    has_focus_indicator = page.evaluate(
                        '() => { const el = document.activeElement; '
                        'return window.getComputedStyle(el).outline !== "none" || '
                        'window.getComputedStyle(el).boxShadow !== "none"; }'
                    )
                    print(f"  有焦点指示器: {has_focus_indicator}")
                except Exception as e:
                    print(f"  ⚠️  键盘导航测试失败: {e}")

            # 测试登录页面
            print("\n访问登录页面...")
            try:
                # 尝试找到登录链接或直接导航
                login_link = page.locator('text=登录, a[href*="login"], a[href*="auth"]').first
                if login_link.is_visible():
                    login_link.click()
                    page.wait_for_load_state('networkidle')
                    time.sleep(1)

                # 截图登录页面
                login_screenshot = f'/tmp/trix-login-{viewport["name"]}.png'
                page.screenshot(path=login_screenshot)
                print(f"✅ 登录页面截图: {login_screenshot}")

                # 检查登录表单
                email_input = page.locator('input[type="email"]').first
                password_input = page.locator('input[type="password"]').first

                if email_input.is_visible():
                    email_label = email_input.get_attribute('aria-label') or \
                                  email_input.get_attribute('placeholder') or \
                                  email_input.evaluate('el => { const label = el.closest("label")?.textContent; return label || "none"; }')
                    print(f"  邮箱输入框标签: {email_label}")

                if password_input.is_visible():
                    password_label = password_input.get_attribute('aria-label') or \
                                      password_input.get_attribute('placeholder') or 'none'
                    print(f"  密码输入框标签: {password_label}")

            except Exception as e:
                print(f"⚠️  无法访问登录页面: {e}")

            page.close()

        # 保存结果
        with open('/tmp/trix-test-results.json', 'w') as f:
            json.dump(results, f, indent=2)

        print("\n" + "="*60)
        print("测试总结")
        print("="*60)

        # 汇总可访问性问题
        total_violations = sum(
            r['violations_count']
            for r in results['accessibility'].values()
        )
        print(f"\n可访问性问题总数: {total_violations}")

        if total_violations > 0:
            print("\n主要问题类型:")
            for vp_name, vp_results in results['accessibility'].items():
                if vp_results['violations_count'] > 0:
                    print(f"\n{vp_name}:")
                    for v in vp_results['violations'][:3]:
                        print(f"  - {v.get('description', 'Unknown')}")

        # 汇总响应式问题
        print("\n响应式测试结果:")
        for vp_name, vp_results in results['responsive'].items():
            print(f"\n{vp_name} ({vp_results.get('buttons', 0)} 个按钮):")
            if vp_results.get('small_touch_targets', 0) > 0:
                print(f"  ⚠️  {vp_results['small_touch_targets']} 个触摸目标过小")
            else:
                print(f"  ✅ 触摸目标大小符合要求")

        browser.close()

        print(f"\n✅ 测试完成，结果已保存到 /tmp/trix-test-results.json")

if __name__ == '__main__':
    test_accessibility_and_responsive()
