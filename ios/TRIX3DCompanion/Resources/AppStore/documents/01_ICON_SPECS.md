# TRIX 3D Companion - App Icon Design Specifications

## Overview
Complete icon design requirements for TRIX 3D Companion iOS app submission.

---

## Required Icon Sizes (11 total)

### Primary Store Icon
| Size | Usage | Format | Notes |
|------|-------|--------|-------|
| **1024 x 1024** | App Store Display | PNG | Required for upload |

### iOS App Icons (App Icon Set)
| Size | Usage | Scale | Format |
|------|-------|-------|--------|
| **180 x 180** | iPhone App Icon | @3x | PNG |
| **120 x 120** | iPhone App Icon | @2x | PNG |
| **167 x 167** | iPad Pro App Icon | @2x | PNG |
| **152 x 152** | iPad App Icon | @2x | PNG |
| **144 x 144** | iPad App Icon | @2x | PNG (iPad mini) |
| **128 x 128** | iPad App Icon | @1x | PNG |
| **76 x 76** | iPad App Icon | @2x | PNG |
| **72 x 72** | iPad App Icon | @1x | PNG |
| **40 x 40** | iPhone Spotlight | @2x | PNG |
| **40 x 40** | iPhone Spotlight | @3x | PNG |
| **80 x 80** | iPad Spotlight | @2x | PNG |
| **29 x 29** | iPhone Settings | @2x | PNG |
| **29 x 29** | iPhone Settings | @3x | PNG |
| **58 x 58** | iPad Settings | @2x | PNG |
| **20 x 20** | iPhone Notification | @2x | PNG |
| **20 x 20** | iPhone Notification | @3x | PNG |
| **40 x 40** | iPad Notification | @2x | PNG |

---

## Design Guidelines

### Brand Colors
```
Primary Purple: #8B5CF6 (RGB: 139, 92, 246)
Primary Pink:   #EC4899 (RGB: 236, 72, 153)
White:          #FFFFFF (RGB: 255, 255, 255)
Black:          #000000 (RGB: 0, 0, 0)
```

### Design Principles
1. **Simplicity**: Clean, recognizable shape even at small sizes
2. **Unique**: Distinct from other education/study apps
3. **Scalable**: Works at all sizes from 20px to 1024px
4. **No Text**: Icon should be universally understandable
5. **3D Theme**: Subtle depth or dimensionality to reflect "3D" in name

### Recommended Design Concepts

#### Option 1: Geometric 3D Cube
- Isometric cube with gradient (purple to pink)
- Subtle shadow for depth
- Rounded corners for friendly feel

#### Option 2: Stacked Layers
- 3 horizontal stacked planes
- Each plane with gradient (purple → pink)
- Connected by vertical lines
- Represents study/focus layers

#### Option 3: Abstract T + 3D
- Stylized "T" lettermark
- 3D extrusion effect
- Gradient from purple to pink
- Minimal and modern

#### Option 4: Study Elements
- Open book with 3D pages
- Subtle gradient spine
- Simple icon, no text
- Clear at small sizes

---

## Technical Requirements

### File Format
- **Format**: PNG (no transparency on main icon)
- **Color Space**: sRGB
- **Compression**: Lossless (PNG-24)
- **Transparency**: Allowed on all except 1024x1024 store icon

### Edge Handling
- **Rounded Corners**: iOS applies automatically (don't include in design)
- **Safe Area**: Keep critical elements within 80% of canvas
- **Stroke Width**: Minimum 2px at 1024px scale

### Testing Checklist
- [ ] Icon is recognizable at 20px (Settings icon size)
- [ ] Icon looks good on both light and dark backgrounds
- [ ] No transparency on 1024x1024 store icon
- [ ] All sizes export without artifacts
- [ ] Consistent appearance across all sizes
- [ ] Passes Apple's Human Interface Guidelines

---

## Asset File Naming

```
AppIcon-1024.png          # App Store
AppIcon-60@2x.png         # 120x120
AppIcon-60@3x.png         # 180x180
AppIcon-76@2x.png         # 152x152 (iPad)
AppIcon-83.5@2x.png       # 167x167 (iPad Pro)
... (following Xcode naming conventions)
```

---

## Design Tools

### Recommended Tools
- **Figma**: Best for vector design and export
- **Sketch**: macOS native, good icon design
- **Adobe Illustrator**: Professional vector work
- **Photopea**: Free online Photoshop alternative

### Export Presets (Figma)
1. Create 1024x1024 artboard
2. Design icon at full resolution
3. Use Export panel with these settings:
   - Scale: 1x, 2x, 3x
   - Suffix: @2x, @3x
   - Format: PNG

---

## Review Checklist Before Submission

### Design Review
- [ ] Icon is original and doesn't infringe existing designs
- [ ] Design is appropriate for all ages (4+ rating)
- [ ] No copyrighted material or trademarks
- [ ] Consistent with app's brand identity

### Technical Review
- [ ] All 11+ sizes generated
- [ ] PNG format for all icons
- [ ] sRGB color space
- [ ] No transparency on store icon (1024x1024)
- [ ] File sizes reasonable (<500KB each)

### Platform Compliance
- [ ] Follows Apple Human Interface Guidelines
- [ ] No text or app name in icon
- [ ] No superfluous details or photos
- [ ] No iOS UI elements or hardware

---

## References

- [Apple App Store Icon Guidelines](https://developer.apple.com/design/human-interface-guidelines/app-store-overview/)

---

*Created: 2026-02-26*
*Last Updated: 2026-02-26*
