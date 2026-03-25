# -*- coding: utf-8 -*-
"""Set node positions for project 7."""
import http.client
import json
import sys

positions = [
    (18, 50, 50),
    (19, 350, 50),
    (20, 650, 50),
    (21, 950, 50),
    (22, 1250, 50),
]

conn = http.client.HTTPConnection("localhost", 8789)

for nid, x, y in positions:
    body = json.dumps({"x": float(x), "y": float(y)})
    conn.request("PATCH", f"/api/nodes/{nid}", body=body, headers={"Content-Type": "application/json"})
    resp = conn.getresponse()
    resp.read()
    sys.stdout.write(f"  Node {nid} -> ({x}, {y}) [{resp.status}]\n")
    sys.stdout.flush()

conn.close()
sys.stdout.write("Done!\n")
sys.stdout.flush()
