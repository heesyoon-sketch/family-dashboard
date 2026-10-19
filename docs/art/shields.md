# FamBit shield artwork — AAA v1

Approved artwork: [concept sheet](./shields-concept-v1.png).

Production files: `public/shields/aaa-v1/{bronze,silver,gold,epic,legendary}-{256,512}.webp`.
`shields-asset-manifest.json` records the exports and generated PNG source names.

Generated with the built-in image generation tool. The original five-shield sheet was approved by the user. Each tier was extracted separately with real alpha transparency; the existing metallic face, engraving, central gem and silhouette were preserved. Exports were normalized to a common 90.6% height on square canvases and encoded as WebP with alpha. The 256px assets serve compact UI; 512px assets serve details. Morning, evening and bonus marks are separate UI overlays so the approved rarity artwork stays intact.

## Extraction prompt

Reference image: `shields-concept-v1.png` (edit target).

> Precise object extraction / background extraction. This attached concept sheet is the APPROVED FamBit game art. Extract ONLY the [TARGET]. Output ONE standalone production game UI asset, not a collection. Preserve this exact shield's approved silhouette, proportions, symmetrical sculpted construction, central gemstone, ornamental metal engravings, material texture, studio lighting, colors and wing/flame details where present. DO NOT redesign the shield. Remove all other shields and the entire near-black backdrop. GENUINELY TRANSPARENT alpha background, no opaque black or gray, no checkerboard pattern baked into pixels, no text, labels or watermarks. Square 1024×1024 canvas. Center the entire shield with overall visible height approximately 90% of canvas, small safe margins, nothing clipped. Crisp antialiased edges. Preserve interior dark metallic surfaces as opaque; do not erase dark shield recesses. Keep tightly contained gemstone glow/flames for the magical tiers with soft alpha edges, but no large background aura, no ground/shadow plane, no detached particles. Exact cutout from the approved sheet, for a premium dark game UI at 30–140px sizes.

Targets:
- Bronze: first/leftmost shield, worn bronze, dark recessed face, amber gem.
- Silver: second shield, polished cool silver, blue gemstone, etched vine filigree, dark navy face.
- Gold: center shield, rich sculpted gold leaf filigree, amber gemstone, dark slate face.
- Epic: fourth shield, amethyst center, purple arcane energy, four smaller violet crystals.
- Legendary: rightmost shield, celestial gold wings, ruby red core, controlled gold flames.

The Bronze prompt used the same extraction constraints with its specific target named directly.
