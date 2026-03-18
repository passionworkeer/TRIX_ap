# SPDX-License-Identifier: MIT
# TRIX 3D Model Processing Script
# Run this in Blender: blender --background --python process_model.py
#
# Steps:
#   1. Decimate (1.5M → 30K triangles)
#   2. Rig with bone hierarchy for half-body character
#   3. Create animations: idle, speak, think, boring
#   4. Export with DRACO compression

import bpy
import bmesh
import math
import os
import sys

# ============================================================
# CONFIGURATION
# ============================================================
INPUT_FILE = r"E:\desktop\trix-3d-companion\3d\78dddf7affbf7d14ec867ee9757de0c5.glb"
OUTPUT_FILE = r"E:\desktop\trix-3d-companion\3d\trix_character_optimized.glb"
DECIMATION_RATIO = 0.02  # 2% of original = ~30K triangles

# ============================================================
# UTILITIES
# ============================================================
def clear_scene():
    """Remove all objects from the scene."""
    bpy.ops.object.select_all(action='SELECT')
    bpy.ops.object.delete(use_global=False)
    # Also clear materials, meshes, armatures left over
    for block in bpy.data.meshes:
        if block.users == 0:
            bpy.data.meshes.remove(block)
    for block in bpy.data.armatures:
        if block.users == 0:
            bpy.data.armatures.remove(block)
    for block in bpy.data.materials:
        if block.users == 0:
            bpy.data.materials.remove(block)
    print("[CLEAR] Scene cleared.")

def get_selected_mesh():
    """Return the first mesh object in the scene."""
    for obj in bpy.data.objects:
        if obj.type == 'MESH':
            return obj
    return None

def separate_by_materials(obj):
    """Separate mesh by material slots into distinct objects."""
    bpy.context.view_layer.objects.active = obj
    obj.select_set(True)

    # Ensure we are in object mode
    if bpy.context.active_object.mode != 'OBJECT':
        bpy.ops.object.mode_set(mode='OBJECT')

    # Separate by material
    bpy.ops.object.material_slot_remove_unused()
    num_mats = len(obj.data.materials)

    if num_mats > 1:
        bpy.ops.object.mode_set(mode='EDIT')
        bpy.ops.mesh.separate(type='MATERIAL')
        bpy.ops.object.mode_set(mode='OBJECT')
        print(f"[SEPARATE] Separated into {num_mats} parts by material.")
    else:
        print(f"[SEPARATE] Only {num_mats} material(s), no separation needed.")
    return [o for o in bpy.data.objects if o.type == 'MESH']

def decimate_object(obj, ratio):
    """Apply decimation modifier to reduce triangle count."""
    if ratio >= 1.0:
        return

    mod = obj.modifiers.new(name="Decimate", type='DECIMATE')
    mod.ratio = ratio
    mod.use_collapse_triangulate = True
    mod.use_dissolve_boundaries = True

    # Apply
    bpy.context.view_layer.objects.active = obj
    obj.select_set(True)
    bpy.ops.object.modifier_apply(modifier=mod.name)
    print(f"[DECIMATE] {obj.name}: {len(obj.data.polygons)} triangles remaining.")

def create_armature_halfbody():
    """
    Create bone hierarchy for a half-body (waist-up) character.
    Bone layout:
      Root (at waist/hip level)
        └── Spine
            └── Chest
                ├── Neck
                │   └── Head
                │       └── Jaw  ← for speaking animation
                ├── L Clavicle
                │   └── L Upper Arm
                │       └── L Forearm
                │           └── L Hand
                └── R Clavicle
                    └── R Upper Arm
                        └── R Forearm
                            └── R Hand
    """
    # Create armature
    amt = bpy.data.armatures.new("TrixArmature")
    amt_obj = bpy.data.objects.new("TrixArmature", amt)
    bpy.context.collection.objects.link(amt_obj)

    bpy.context.view_layer.objects.active = amt_obj
    amt_obj.select_set(True)
    bpy.ops.object.mode_set(mode='EDIT')

    bones_created = {}

    def add_bone(name, head, tail, parent=None):
        bone = amt.edit_bones.new(name)
        bone.head = head
        bone.tail = tail
        if parent and parent in bones_created:
            bone.parent = bones_created[parent]
        bones_created[name] = bone
        return bone

    # Root - at waist level (origin of half-body)
    add_bone("Root",    (0, 0, 0),    (0, 0.05, 0.15))

    # Spine - torso vertical
    add_bone("Spine",   (0, 0, 0.12), (0, 0.04, 0.45), parent="Root")

    # Chest - upper torso
    add_bone("Chest",   (0, 0.02, 0.43), (0, 0.05, 0.72), parent="Spine")

    # Neck
    add_bone("Neck",    (0, 0, 0.70), (0, 0, 0.82), parent="Chest")

    # Head
    add_bone("Head",    (0, 0, 0.82), (0, 0, 1.05), parent="Neck")

    # Jaw - for speaking animation (hangs from head front)
    add_bone("Jaw",     (0, 0.04, 0.88), (0, 0.04, 0.96), parent="Head")

    # Left arm chain
    add_bone("L_Clavicle", (-0.12, 0, 0.70), (-0.22, 0, 0.70), parent="Chest")
    add_bone("L_UpperArm",  (-0.28, 0, 0.68), (-0.52, 0, 0.60), parent="L_Clavicle")
    add_bone("L_Forearm",   (-0.52, 0, 0.60), (-0.75, 0, 0.52), parent="L_UpperArm")
    add_bone("L_Hand",      (-0.75, 0, 0.52), (-0.82, 0, 0.50), parent="L_Forearm")

    # Right arm chain
    add_bone("R_Clavicle", (0.12, 0, 0.70), (0.22, 0, 0.70), parent="Chest")
    add_bone("R_UpperArm",  (0.28, 0, 0.68), (0.52, 0, 0.60), parent="R_Clavicle")
    add_bone("R_Forearm",   (0.52, 0, 0.60), (0.75, 0, 0.52), parent="R_UpperArm")
    add_bone("R_Hand",      (0.75, 0, 0.50), (0.82, 0, 0.50), parent="R_Forearm")

    bpy.ops.object.mode_set(mode='OBJECT')
    print(f"[ARMATURE] Created {len(bones_created)} bones.")
    return amt_obj

def parent_mesh_to_armature(mesh_objects, amt_obj):
    """Parent mesh objects to armature with automatic weights."""
    bpy.context.view_layer.objects.active = amt_obj
    amt_obj.select_set(True)

    for mesh_obj in mesh_objects:
        if mesh_obj.name == amt_obj.name:
            continue
        mesh_obj.select_set(True)
        bpy.context.view_layer.objects.active = mesh_obj
        # Apply automatic weights
        bpy.ops.object.parent_set(type='ARMATURE_AUTO')
        print(f"[PARENT] {mesh_obj.name} → Armature (auto weights)")
        mesh_obj.select_set(False)

    amt_obj.select_set(False)
    print("[PARENT] All meshes parented to armature.")

def pose_mode_animate(amt_obj, action_name, frame_range, keyframe_fn):
    """Helper to create animations in pose mode."""
    bpy.context.view_layer.objects.active = amt_obj
    bpy.ops.object.mode_set(mode='POSE')

    # Clear existing animation on this action (if any)
    if amt_obj.animation_data and amt_obj.animation_data.action:
        amt_obj.animation_data.action = None

    action = bpy.data.actions.new(name=action_name)
    if not amt_obj.animation_data:
        amt_obj.animation_data_create()
    amt_obj.animation_data.action = action

    keyframe_fn()

    # Set frame range
    start, end = frame_range
    action.frame_range = (start, end)

    bpy.ops.pose.select_all(action='SELECT')
    bpy.ops.pose.transforms_clear()

    bpy.ops.object.mode_set(mode='OBJECT')
    return action

def animate_idle(amt_obj):
    """Idle animation: subtle breathing (chest + spine rise/fall)."""
    def keyframes():
        bones = {bone.name: bone for bone in amt_obj.pose.bones}
        start, end = 1, 60

        for frame in range(start, end + 1):
            t = (frame - start) / (end - start)
            # Breathing cycle: ~2 seconds at 30fps
            breath = math.sin(t * 2 * math.pi) * 0.006

            # Chest rises slightly
            if "Chest" in bones:
                bones["Chest"].location = (0, 0, breath)
                bones["Chest"].keyframe_insert(data_path="location", frame=frame)

            # Spine follows
            if "Spine" in bones:
                bones["Spine"].location = (0, 0, breath * 0.5)
                bones["Spine"].keyframe_insert(data_path="location", frame=frame)

            # Slight head bob
            if "Head" in bones:
                bones["Head"].location = (0, 0, breath * 0.3)
                bones["Head"].keyframe_insert(data_path="location", frame=frame)
                bones["Head"].rotation_mode = 'XYZ'
                bones["Head"].rotation_euler = (0, math.sin(t * 2 * math.pi) * 0.008, 0)
                bones["Head"].keyframe_insert(data_path="rotation_euler", frame=frame)

    pose_mode_animate(amt_obj, "Idle", (1, 60), keyframes)
    print("[ANIM] Idle created (60 frames = 2s loop)")

def animate_speak(amt_obj):
    """Speak animation: jaw opens and closes rhythmically."""
    def keyframes():
        bones = {bone.name: bone for bone in amt_obj.pose.bones}
        start, end = 1, 30

        for frame in range(start, end + 1):
            t = (frame - start) / (end - start)
            # Jaw opens in a speech rhythm: quick open, slow close
            cycle = math.sin(t * 2 * math.pi)
            jaw_open = max(0, cycle) * 0.35  # 0 to 0.35 radians

            if "Jaw" in bones:
                bones["Jaw"].rotation_mode = 'XYZ'
                bones["Jaw"].rotation_euler = (jaw_open, 0, 0)
                bones["Jaw"].keyframe_insert(data_path="rotation_euler", frame=frame)

            # Slight head nod
            if "Head" in bones:
                bones["Head"].rotation_mode = 'XYZ'
                bones["Head"].rotation_euler = (math.sin(t * 4 * math.pi) * 0.03, 0, 0)
                bones["Head"].keyframe_insert(data_path="rotation_euler", frame=frame)

    pose_mode_animate(amt_obj, "Speak", (1, 30), keyframes)
    print("[ANIM] Speak created (30 frames = 1s loop, jaw movement)")

def animate_think(amt_obj):
    """Think animation: head tilts, slight hand-to-chin gesture."""
    def keyframes():
        bones = {bone.name: bone for bone in amt_obj.pose.bones}
        start, end = 1, 90

        for frame in range(start, end + 1):
            t = (frame - start) / (end - start)
            # Head tilt left-right slowly (thinking)
            if "Head" in bones:
                bones["Head"].rotation_mode = 'XYZ'
                bones["Head"].rotation_euler = (
                    math.sin(t * math.pi) * 0.06,  # slight nod
                    math.sin(t * 2 * math.pi) * 0.08,  # tilt side to side
                    0
                )
                bones["Head"].keyframe_insert(data_path="rotation_euler", frame=frame)

            # Eyes look up (indicator of thinking)
            if "Head" in bones:
                bones["Head"].location = (0, 0, math.sin(t * math.pi) * 0.005)
                bones["Head"].keyframe_insert(data_path="location", frame=frame)

            # Left hand moves toward chin (gesture)
            if "L_Hand" in bones:
                bones["L_Hand"].location = (
                    -0.05 * math.sin(t * math.pi),
                    -0.05 * math.sin(t * math.pi),
                    0
                )
                bones["L_Hand"].keyframe_insert(data_path="location", frame=frame)

    pose_mode_animate(amt_obj, "Think", (1, 90), keyframes)
    print("[ANIM] Think created (90 frames = 3s loop)")

def animate_boring(amt_obj):
    """Boring animation: slumped posture, looking away."""
    def keyframes():
        bones = {bone.name: bone for bone in amt_obj.pose.bones}
        start, end = 1, 120

        for frame in range(start, end + 1):
            t = (frame - start) / (end - start)

            # Spine slumps forward
            if "Spine" in bones:
                bones["Spine"].rotation_mode = 'XYZ'
                bones["Spine"].rotation_euler = (
                    math.sin(t * math.pi) * 0.05,  # slight forward lean
                    0, 0
                )
                bones["Spine"].keyframe_insert(data_path="rotation_euler", frame=frame)

            # Chest drops
            if "Chest" in bones:
                bones["Chest"].rotation_mode = 'XYZ'
                bones["Chest"].rotation_euler = (
                    math.sin(t * math.pi) * 0.04,
                    0, 0
                )
                bones["Chest"].keyframe_insert(data_path="rotation_euler", frame=frame)

            # Head looks down and away
            if "Head" in bones:
                bones["Head"].rotation_mode = 'XYZ'
                bones["Head"].rotation_euler = (
                    0.1 + math.sin(t * 0.5 * math.pi) * 0.04,  # looking down
                    math.sin(t * math.pi) * 0.05,  # slight turn
                    0
                )
                bones["Head"].keyframe_insert(data_path="rotation_euler", frame=frame)

    pose_mode_animate(amt_obj, "Boring", (1, 120), keyframes)
    print("[ANIM] Boring created (120 frames = 4s loop)")

def export_glb(output_path):
    """Export scene as GLB with DRACO compression."""
    # Select everything
    bpy.ops.object.select_all(action='SELECT')

    # GLTF export with DRACO compression (if available)
    try:
        bpy.ops.export_scene.gltf(
            filepath=output_path,
            export_format='GLB',
            use_selection=False,
            export_animations=True,
            export_frame_range=True,
            export_materials='EXPORT',
            export_colors=True,
            export_normals=True,
            # DRACO compression (built into Blender 2.82+)
            export_draco_compression=True,
            export_draco_compression_level=6,
            export_draco_quantization_bits=14,
            export_yup=True,
            export_apply=True,
        )
        print(f"[EXPORT] Saved: {output_path}")
    except Exception as e:
        print(f"[EXPORT] DRACO failed ({e}), trying without DRACO...")
        bpy.ops.export_scene.gltf(
            filepath=output_path,
            export_format='GLB',
            use_selection=False,
            export_animations=True,
            export_materials='EXPORT',
            export_yup=True,
            export_apply=True,
        )
        print(f"[EXPORT] Saved (no DRACO): {output_path}")

# ============================================================
# MAIN PIPELINE
# ============================================================
def main():
    print("=" * 60)
    print("TRIX 3D Model Processing Pipeline")
    print("=" * 60)

    # Step 1: Load the GLB
    print(f"\n[STEP 1] Loading: {INPUT_FILE}")
    if not os.path.exists(INPUT_FILE):
        print(f"[ERROR] File not found: {INPUT_FILE}")
        sys.exit(1)

    clear_scene()

    # Import GLB
    bpy.ops.import_scene.gltf(filepath=INPUT_FILE)
    mesh_obj = get_selected_mesh()
    if not mesh_obj:
        print("[ERROR] No mesh found after import!")
        sys.exit(1)

    print(f"[LOAD] Imported: {mesh_obj.name}, {len(mesh_obj.data.polygons):,} triangles")

    # Step 2: Separate by material (for better rigging)
    print("\n[STEP 2] Separating by materials...")
    mesh_objects = [o for o in bpy.data.objects if o.type == 'MESH']

    # Step 3: Decimate each mesh
    print(f"\n[STEP 3] Decimating ({DECIMATION_RATIO*100:.0f}% = ~30K triangles target)...")
    for obj in mesh_objects:
        orig = len(obj.data.polygons)
        decimate_object(obj, DECIMATION_RATIO)
        new = len(obj.data.polygons)
        ratio = new / orig if orig > 0 else 0
        print(f"  {obj.name}: {orig:,} → {new:,} tris ({ratio:.1%})")

    # Step 4: Center and fix origin
    print("\n[STEP 4] Centering model...")
    for obj in mesh_objects:
        bpy.context.view_layer.objects.active = obj
        obj.select_set(True)
        bpy.ops.object.origin_set(type='ORIGIN_CENTER_OF_MASS')
        bpy.ops.object.location_clear()
        bpy.ops.object.rotation_clear()
        obj.select_set(False)

    # Step 5: Create armature
    print("\n[STEP 5] Creating bone rig (half-body)...")
    amt_obj = create_armature_halfbody()

    # Step 6: Parent mesh to armature
    print("\n[STEP 6] Parenting mesh to armature (auto weights)...")
    mesh_objects = [o for o in bpy.data.objects if o.type == 'MESH']
    parent_mesh_to_armature(mesh_objects, amt_obj)

    # Step 7: Create animations
    print("\n[STEP 7] Creating animations...")
    animate_idle(amt_obj)
    animate_speak(amt_obj)   # <-- THE KEY ONE FOR TALKING
    animate_think(amt_obj)
    animate_boring(amt_obj)

    # Step 8: Export
    print(f"\n[STEP 8] Exporting to GLB...")
    os.makedirs(os.path.dirname(OUTPUT_FILE), exist_ok=True)
    export_glb(OUTPUT_FILE)

    print("\n" + "=" * 60)
    print("Pipeline complete!")
    print(f"Output: {OUTPUT_FILE}")
    print("=" * 60)

if __name__ == "__main__":
    main()
