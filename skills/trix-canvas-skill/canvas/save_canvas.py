# -*- coding: utf-8 -*-
"""Save canvas data URL to PNG file - handle large files."""

import base64
import sys

src = r"C:\Users\wang\.local\share\opencode\tool-output\tool_d20b6ce85001hb5zXydq6Mxt2a"
dst = r"E:\desktop\canvas_v2.png"

with open(src, "r") as f:
    data_url = f.read()

# Find the comma that separates header from data
comma_idx = data_url.index(",")
b64 = data_url[comma_idx + 1 :]

# Fix padding if needed
padding = 4 - len(b64) % 4
if padding != 4:
    b64 += "=" * padding

img_data = base64.b64decode(b64, validate=False)

with open(dst, "wb") as f:
    f.write(img_data)

sys.stdout.write(f"Saved {len(img_data)} bytes to {dst}\n")
sys.stdout.flush()
