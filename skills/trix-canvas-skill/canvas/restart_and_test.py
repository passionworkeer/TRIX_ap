# -*- coding: utf-8 -*-
"""Restart canvas server and verify _file in project response."""

import subprocess
import time
import urllib.request
import json
import sys

# Kill existing canvas server
result = subprocess.run(
    ["wmic", "process", "where", "name='python.exe'", "get", "processid,commandline"],
    capture_output=True,
    text=True,
)
for line in result.stdout.split("\n"):
    if "canvas_server" in line:
        parts = line.strip().split()
        if parts:
            pid = parts[-1]
            print(f"Killing PID {pid}")
            subprocess.run(["taskkill", "/F", "/PID", pid], capture_output=True)

time.sleep(1)

# Start new server
print("Starting server...")
subprocess.Popen(
    [
        r"D:\python\python.exe",
        r"E:\desktop\trix-3d-companion\skills\trix-canvas-skill\canvas\canvas_server.py",
    ],
    creationflags=0x08000000,
)
time.sleep(3)

# Test
print("Testing...")
resp = urllib.request.urlopen("http://localhost:8789/api/projects/7")
data = json.loads(resp.read())
node = data["nodes"][0]
print(f"Node keys: {list(node.keys())}")
if "_file" in node:
    f = node["_file"]
    print(f"filepath: {f.get('filepath')}")
    print(f"thumbnail_path: {f.get('thumbnail_path')}")
else:
    print("ERROR: _file NOT in node")
