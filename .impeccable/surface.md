# Gallery surface

Mode: Read / Experience. Audience: art and interaction collaborators, explicitly confirmed by the user.

Inherit the V2 gallery's light screenshot contact sheet, category navigation and image enlargement. This is a precisely referenced adaptation, with V3 source images and handoff details. No replacement visual-world tournament or generated mock is needed.

DESIGN_VARIANCE 4 / MOTION_INTENSITY 3 / VISUAL_DENSITY 5: predictable categories, legible real screenshots, small state transitions. The system is native CSS with Apple-inspired navigation optics, not an official Apple web design system.

Color: restrained cool white and blue. A single moving WebGL V2 selection surface tracks the active category. The scene behind that surface is explicitly supplied and rendered by the same canvas. Content and interaction remain in HTML. Full CSS fallback for unsupported WebGL, context loss, reduced transparency, and high contrast.

Opening: a compact title, categories and first screenshot row. No marketing hero. Image viewer: large screenshot beside entry, controls, states and motion notes; on mobile these stack in one scroll area. Source screenshots are captured from the running game and are never reconstructed UI.

Reference: https://silvera0218.github.io/Rotatev2-UI-Gallery/
