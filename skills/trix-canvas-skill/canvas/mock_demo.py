# -*- coding: utf-8 -*-
"""Mock demo: create project with 5 scenes using images from E:\desktop\photo"""

import urllib.request
import json
import os
import sys
import uuid

BASE = "http://localhost:8789/api"
PHOTO_DIR = r"E:\desktop\photo"

scenes = [
    {
        "title": "Scene 1 - City Night",
        "prompt": "Neon lights on wet streets, cinematic",
        "img": "40e165c6-1c0f-4420-a8a1-ec8c0d8e2bc4.png",
    },
    {
        "title": "Scene 2 - Enter Cafe",
        "prompt": "Pushing glass door into warm cafe",
        "img": "1769502314591-8a9ab4f9ded4846a.png",
    },
    {
        "title": "Scene 3 - Coffee Cup",
        "prompt": "Close-up hand holding coffee cup",
        "img": "37b159294c2891bbb867c3255e645590.png",
    },
    {
        "title": "Scene 4 - Rain Window",
        "prompt": "Rain drops on glass window, moody",
        "img": "2d4ef37aba13f3e8889144074a610275.png",
    },
    {
        "title": "Scene 5 - Dawn Exit",
        "prompt": "Walking out into sunrise, wide shot",
        "img": "e5df465c-a9af-43c8-a11f-daf21910599c.png",
    },
]


def api(method, path, data=None, is_multipart=False):
    if data is not None:
        if is_multipart:
            body = data
            headers = {
                "Content-Type": f"multipart/form-data; boundary={path.split('=')[-1]}"
            }
        else:
            body = json.dumps(data).encode("utf-8")
            headers = {"Content-Type": "application/json"}
        req = urllib.request.Request(BASE + path, data=body, headers=headers)
    else:
        req = urllib.request.Request(BASE + path)
    if method == "DELETE":
        req.get_method = lambda: "DELETE"
    resp = urllib.request.urlopen(req)
    return json.loads(resp.read())


# 1. Create project
print("[1] Creating project...")
proj = api(
    "POST",
    "/projects",
    {"name": "Demo Short Film - Night Cafe", "script_text": "Night city cafe story"},
)
pid = proj["id"]
print(f"    Project ID: {pid}")

# 2. Upload images as results
file_ids = []
print("[2] Uploading images...")
for i, s in enumerate(scenes):
    filepath = os.path.join(PHOTO_DIR, s["img"])
    boundary = uuid.uuid4().hex
    with open(filepath, "rb") as f:
        file_data = f.read()
    body = (
        (
            f"--{boundary}\r\n"
            f'Content-Disposition: form-data; name="project_id"\r\n\r\n'
            f"{pid}\r\n"
            f"--{boundary}\r\n"
            f'Content-Disposition: form-data; name="file"; filename="{s["img"]}"\r\n'
            f"Content-Type: image/png\r\n\r\n"
        ).encode("utf-8")
        + file_data
        + f"\r\n--{boundary}--\r\n".encode("utf-8")
    )
    # upload
    req = urllib.request.Request(
        BASE + "/upload",
        data=body,
        headers={"Content-Type": f"multipart/form-data; boundary={boundary}"},
    )
    # upload
    req = urllib.request.Request(
        BASE + "/upload",
        data=body,
        headers={"Content-Type": f"multipart/form-data; boundary={boundary}"},
    )
    resp = json.loads(urllib.request.urlopen(req).read())
    file_ids.append(resp["id"])
    print(f"    [{i + 1}] {s['img']} -> file_id={resp['id']}")

# 3. Create nodes
node_ids = []
print("[3] Creating nodes...")
for i, s in enumerate(scenes):
    nd = {
        "project_id": pid,
        "file_id": file_ids[i],
        "scene_id": i,
        "media_type": "image",
        "prompt": s["prompt"],
        "status": "done",
    }
    resp = api("POST", "/nodes", nd)
    node_ids.append(resp["id"])
    print(f"    Node {i}: {s['title']} (id={resp['id']})")

# 4. Create edges
print("[4] Creating edges...")
for i in range(len(scenes) - 1):
    ed = {
        "project_id": pid,
        "source_node_id": node_ids[i],
        "target_node_id": node_ids[i + 1],
        "edge_type": "scene_order",
    }
    api("POST", "/edges", ed)
    print(f"    Edge: node {i} -> node {i + 1}")

print()
print(f"[OK] Demo ready!")
print(f"     Open: http://localhost:8789/?project={pid}")
