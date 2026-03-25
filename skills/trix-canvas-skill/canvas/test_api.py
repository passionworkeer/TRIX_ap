# -*- coding: utf-8 -*-
"""Comprehensive API test for Canvas server."""

import urllib.request
import json
import http.client
import sys

BASE = "http://localhost:8789"
passed = 0
failed = 0


def test(name, url, method="GET", data=None, expected_status=200):
    global passed, failed
    try:
        conn = http.client.HTTPConnection("localhost", 8789)
        body = json.dumps(data) if data else None
        headers = {"Content-Type": "application/json"} if data else {}
        conn.request(method, url, body=body, headers=headers)
        resp = conn.getresponse()
        resp_body = resp.read().decode("utf-8", errors="replace")
        conn.close()

        if resp.status == expected_status:
            passed += 1
            sys.stdout.write(f"  [PASS] {name} ({resp.status})\n")
            return json.loads(resp_body) if resp_body else None
        else:
            failed += 1
            sys.stdout.write(
                f"  [FAIL] {name} - expected {expected_status}, got {resp.status}\n"
            )
            sys.stdout.write(f"         {resp_body[:200]}\n")
            return None
    except Exception as e:
        failed += 1
        sys.stdout.write(f"  [FAIL] {name} - {e}\n")
        return None
    finally:
        sys.stdout.flush()


sys.stdout.write("=== Canvas Server API Tests ===\n\n")

# 1. Projects
sys.stdout.write("[Projects]\n")
projects = test("List projects", "/api/projects")
proj = test("Get project 7", "/api/projects/7")
if proj:
    sys.stdout.write(
        f"  Project: {proj.get('name')}, nodes={len(proj.get('nodes', []))}, edges={len(proj.get('edges', []))}\n"
    )
    sys.stdout.flush()

new_proj = test(
    "Create project",
    "/api/projects",
    "POST",
    {"name": "API Test Project", "script_text": "test script"},
    201,
)
if new_proj:
    pid = new_proj["id"]
    test("Delete project", f"/api/projects/{pid}", "DELETE", expected_status=200)

# 2. Files
sys.stdout.write("\n[Files]\n")
file_info = test("Get file 11", "/api/files/11")
if file_info:
    sys.stdout.write(
        f"  File: {file_info.get('filename')}, thumb={file_info.get('thumbnail_path', '')[:30]}\n"
    )
    sys.stdout.flush()

# 3. Nodes
sys.stdout.write("\n[Nodes]\n")
node = test("Get node 18", "/api/nodes/18")
if node:
    sys.stdout.write(
        f"  Node: status={node.get('status')}, prompt={node.get('prompt', '')[:30]}\n"
    )
    sys.stdout.flush()

test(
    "Patch node 18",
    "/api/nodes/18",
    "PATCH",
    {"prompt": "Updated prompt for testing"},
    200,
)

# Verify patch
node_after = test("Verify patch", "/api/nodes/18")
if node_after and node_after.get("prompt") == "Updated prompt for testing":
    passed += 1
    sys.stdout.write("  [PASS] Patch verification\n")
    sys.stdout.flush()
else:
    failed += 1
    sys.stdout.write("  [FAIL] Patch verification\n")
    sys.stdout.flush()

# Restore original
test(
    "Restore node 18",
    "/api/nodes/18",
    "PATCH",
    {"prompt": "Neon lights on wet streets, cinematic"},
    200,
)

# 4. Edges
sys.stdout.write("\n[Edges]\n")
test(
    "Create edge",
    "/api/edges",
    "POST",
    {
        "project_id": 7,
        "source_node_id": 18,
        "target_node_id": 19,
        "edge_type": "scene_order",
    },
    201,
)

# 5. Media serving
sys.stdout.write("\n[Media]\n")
conn = http.client.HTTPConnection("localhost", 8789)
conn.request(
    "GET", "/media/thumbnails/a56e9725_40e165c6-1c0f-4420-a8a1-ec8c0d8e2bc4_thumb.png"
)
resp = conn.getresponse()
resp.read()
conn.close()
if resp.status == 200:
    passed += 1
    sys.stdout.write(f"  [PASS] Thumbnail serving ({resp.status})\n")
else:
    failed += 1
    sys.stdout.write(f"  [FAIL] Thumbnail serving ({resp.status})\n")
sys.stdout.flush()

# 6. Export
sys.stdout.write("\n[Export]\n")
test("Export subtitle", "/api/projects/7/export/subtitle")

# Summary
sys.stdout.write(f"\n=== Results: {passed} passed, {failed} failed ===\n")
sys.stdout.flush()

if failed > 0:
    sys.exit(1)
