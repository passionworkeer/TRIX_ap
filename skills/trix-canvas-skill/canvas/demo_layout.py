# -*- coding: utf-8 -*-
"""Set nice zigzag layout for demo nodes."""

import http.client
import json
import sys

# Node IDs 18-22, zigzag layout
positions = [
    (18, 50, 60),
    (19, 420, 60),
    (20, 790, 60),
    (21, 1160, 60),
    (22, 1530, 60),
]

conn = http.client.HTTPConnection("localhost", 8789)

for nid, x, y in positions:
    body = json.dumps({"x": float(x), "y": float(y)})
    conn.request(
        "PATCH",
        f"/api/nodes/{nid}",
        body=body,
        headers={"Content-Type": "application/json"},
    )
    resp = conn.getresponse()
    resp.read()
    sys.stdout.write(f"  Node {nid} -> ({x}, {y}) [{resp.status}]\n")
    sys.stdout.flush()

conn.close()
sys.stdout.write("Done!\n")
