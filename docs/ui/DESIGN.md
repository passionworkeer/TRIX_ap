# Design System Document

## 1. Overview & Creative North Star: "The Digital Architect"

This design system is not a collection of templates; it is a framework for precision and authority. Our Creative North Star is **"The Digital Architect."** It embodies the clarity of a blueprint and the prestige of a high-end gallery. 

To move beyond the "standard" SaaS aesthetic, we utilize **intentional asymmetry** and **high-contrast scale**. Large-scale headlines are offset against expansive negative space, creating a sense of confidence and "breathing room." By overlapping glassmorphic containers with sophisticated typography, we simulate the depth of physical layers, making the AI-powered experience feel tangible, curated, and premium.

---

## 2. Colors: Tonal Depth & The "No-Line" Rule

The palette is rooted in a monochromatic spectrum that values texture over decoration. We define structure through value, not outlines.

### The Palette
- **Background (`#131313`):** The deep foundation for all content.
- **Primary (`#ffffff`):** Reserved for core interactions and key text.
- **Surface Tiers:**
    - `surface_container_lowest` (`#0e0e0e`): Used for "cut-out" or recessed areas.
    - `surface_container_low` (`#1c1b1b`): Standard section background.
    - `surface_container_highest` (`#353534`): Used for elevated or active interactive elements.

### The "No-Line" Rule
Sectioning must be achieved through **background color shifts**, never 1px solid borders. To separate a hero section from a feature grid, transition from `surface` to `surface_container_low`. This creates a sophisticated, seamless flow that feels architectural rather than boxed-in.

### The "Glass & Gradient" Rule
To add "soul" to the minimalist aesthetic, utilize subtle radial gradients in the background (e.g., a soft bleed from `primary` to `primary_container` at 5% opacity). For floating navigation or modal overlays, use a **Glassmorphism** effect: 
- **Fill:** `surface_variant` at 40-60% opacity.
- **Effect:** `backdrop-blur` (20px - 40px).
- **Edge:** A "Ghost Border" (see Section 4).

---

## 3. Typography: Editorial Authority

We use a high-contrast typographic scale to establish an editorial hierarchy that feels both modern and professional.

- **Display & Headlines (Syncopate):** These are our "statement" styles. Use `display-lg` and `display-md` with generous tracking (letter-spacing) to command attention. This font represents the "AI intelligence"—authoritative and cutting-edge.
- **Titles & Body (Inter / Geist):** While headlines capture the vibe, the body text delivers the value. We use a tight hierarchy from `title-lg` down to `body-sm` to ensure readability. 
- **Hierarchy Role:** Use `Syncopate` for headers to create a "Signature Look," while `Inter` remains the workhorse for all data-heavy and instructional content to maintain accessibility.

---

## 4. Elevation & Depth: Tonal Layering

Traditional drop shadows are forbidden. We define depth through the **Layering Principle**.

### Tonal Layering
Instead of shadows, stack surface tokens. A `surface_container_high` card sitting on a `surface` background provides all the visual separation required for a premium feel.

### Ambient Shadows
When an element must "float" (like a primary CTA or a floating nav bar), use an **Ambient Shadow**:
- **Color:** `on_surface` (Alpha 4%).
- **Blur:** 60px - 100px.
- **Spread:** -10px.
This mimics natural light dispersion rather than a digital "drop shadow."

### The "Ghost Border" Fallback
If visual separation is mathematically required for accessibility, use a **Ghost Border**:
- **Stroke:** 1px.
- **Color:** `outline_variant` at 15% opacity.
- **Result:** A border that is felt rather than seen.

---

## 5. Components: Precision Primitives

### Buttons
- **Primary:** Full-rounded (`9999px`), `primary` background, `on_primary` text. No border.
- **Secondary:** Full-rounded, transparent background, 1px `Ghost Border`, `primary` text.
- **States:** On hover, primary buttons should shift to `primary_container`.

### Cards & Lists
- **Radius:** `1rem` (16px) for standard cards; `2rem` for hero containers.
- **Structure:** Forbid divider lines. Use vertical white space (`spacing-8` or `spacing-10`) to separate list items.
- **Glass Effect:** Use a backdrop-blur on cards that overlay background gradients to maintain the "frosted glass" aesthetic.

### Input Fields
- **Style:** Minimalist. Only a bottom-border using the `Ghost Border` (20% opacity) that animates to 100% opacity `primary` on focus. 
- **Label:** `label-md` floating above the input.

### Signature Component: The "AI Pulse"
For AI-driven insights, use a container with a subtle, slow-pulsing radial gradient background (`surface_bright` to `surface_dim`) to indicate active processing or "intelligence."

---

## 6. Do's and Don'ts

### Do
- **Do** use asymmetrical layouts. Place text in the bottom-left of a large empty container to create a high-end editorial feel.
- **Do** use the full range of the spacing scale. Negative space is a design element, not "empty" space.
- **Do** ensure 4.5:1 contrast ratios for all `body` and `label` text against their respective surface containers.

### Don't
- **Don't** use 100% black (`#000000`) for backgrounds; use `surface_container_lowest` or `surface` to allow for subtle depth layering.
- **Don't** use standard "Material Design" shadows. They feel "out of the box" and cheapen the premium aesthetic.
- **Don't** use divider lines to separate content sections. Let the tonal shift of the background do the work.
- **Don't** crowd the Syncopate headlines. They require significant white space to maintain their architectural impact.