# -*- coding: utf-8 -*-
"""Set node positions to spread them out horizontally."""

import http.client
import json

positions = [
    (13, 50, 50),
    (14, 350, 50),
    (15, 650, 50),
    (16, 950, 50),
    (17, 1250, 50),
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
    resp.read()  # consume body
    print(f"  Node {nid} -> ({x}, {y}) [{resp.status}]")

conn.close()
print("Done!")
