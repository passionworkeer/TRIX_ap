#!/usr/bin/env python3
"""
测试配对流程 - 服务器端验证
测试 pairing is not defined 错误是否已修复
"""

import socketio
import time

# 配置
SERVER_URL = 'http://47.243.55.130:8765'
DEVICE_ID = 'test_bot_001'
USER_ID = 'bd49b054-7e8d-45e0-863e-0a7d89d51bf3'

print("🧪 开始测试配对流程...")
print(f"服务器: {SERVER_URL}")
print(f"设备 ID: {DEVICE_ID}")
print(f"用户 ID: {USER_ID}")
print("-" * 50)

# 创建 Socket.io 客户端
sio = socketio.Client()

pairing_code = None
pairing_id = None
test_passed = False

@sio.event
def connect():
    print("✅ 已连接到服务器")

@sio.on('connect_error')
def on_connect_error(data):
    print(f"❌ 连接错误: {data}")

@sio.on('pairing_info')
def on_pairing_info(data):
    global pairing_code, pairing_id
    pairing_code = data['pairingCode']
    pairing_id = data['pairingId']
    print(f"📋 收到配对信息")
    print(f"   配对码: {pairing_code}")
    print(f"   配对 ID: {pairing_id}")

@sio.on('pairing_success')
def on_pairing_success(data):
    global test_passed
    print(f"🎉 配对成功！")
    print(f"   设备 ID: {data.get('deviceId')}")
    print(f"   设备名称: {data.get('deviceName')}")
    print(f"   配对 ID: {data.get('pairingId')}")
    test_passed = True

@sio.on('error')
def on_error(data):
    print(f"❌ 服务器错误: {data}")

@sio.on('disconnect')
def on_disconnect():
    print("🔌 已断开连接")

# 连接服务器
try:
    sio.connect(SERVER_URL)
    time.sleep(1)

    # 步骤 1：Bot 请求配对
    print("\n步骤 1: Bot 请求配对...")
    sio.emit('bot_request_pairing', {'deviceId': DEVICE_ID})
    time.sleep(2)

    if not pairing_code:
        print("❌ 未收到配对码")
        sio.disconnect()
        exit(1)

    # 步骤 2：App 使用配对码配对
    print(f"\n步骤 2: App 使用配对码 {pairing_code} 配对...")

    # 使用 callback 来接收结果
    def on_pair_result(response):
        print(f"📦 配对结果: {response}")

    sio.emit('pair_with_code', {
        'code': pairing_code,
        'userId': USER_ID
    }, callback=on_pair_result)

    time.sleep(3)

    # 验证结果
    print("\n" + "=" * 50)
    if test_passed:
        print("✅ 测试通过！配对流程正常工作")
        print("✅ 'pairing is not defined' 错误已修复")
    else:
        print("⚠️ 测试未完成或失败")
        print("   请检查服务器日志")

    print("=" * 50)

    sio.disconnect()

except Exception as e:
    print(f"❌ 测试失败: {e}")
    import traceback
    traceback.print_exc()
