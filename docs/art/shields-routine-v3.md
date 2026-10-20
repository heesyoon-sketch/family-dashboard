# Routine-integrated shield artwork v3

## Visual system

The shield frame carries rarity. The sculpted face carries routine type:
- Morning: an eight-ray sun with a large warm amber/orange field.
- Evening: a thick crescent opening right with an uncluttered navy field.
- Bonus: a large four-point sparkle with an emerald field.

The type emblem is baked into the artwork, not an overlaid corner badge. Each symbol fills most of the inner face and remains visible when the artwork is reduced to 30–48 px. Dark recesses separate the raised pale symbol from its colored face. Large color fields provide a second cue when fine material texture disappears.

Rarity silhouettes remain: round wooden Bronze, long silver kite, broad gold heater, angular violet crystal Epic, crowned ivory-winged Legendary. Legendary's original ruby center is replaced by the routine centerpiece while retaining its crown and wings.

All 15 tier/type combinations have 256 px and 512 px transparent WebP exports under `public/shields/routine-v3/{tier}-{type}-{size}.webp`. ShieldEmblem uses the type-specific art in the dashboard, Shield Wall, details, progress, and history. Tier-only reward receipts retain generic rarity art because their data carries no routine type.

Dashboard member-card, habit sizing, and shield slot positions are unchanged. The existing 48 px dashboard and 30 px compact display sizes are retained.

## Generation

## Validation

- All 15 variants reviewed at 48 px and 30 px, plus a 48 px grayscale comparison in a 360 px browser viewport.
- All 48 comparison images loaded; no horizontal overflow or corner badge elements.
- All 30 WebP exports have real alpha and the expected 256/512 dimensions. Every tier/type source path resolves to an existing asset.
- Existing 155 tests, targeted ESLint, production build, and git diff checks pass.

## Generation method and prompt set

Built-in image_gen, transparent_background=true; one edit per variant. Each tier's `public/shields/aaa-v2/{tier}-512.webp` is the edit target. Original outputs are retained in the image-generation archive; optimized copies are in the repository. Export manifest records each source filename.

### Shared prompt

Use case: precise-object-edit. Asset type: FamBit AAA fantasy RPG inventory shield, small UI item icon. Edit the supplied shield (reference image) into ONE single standalone routine-type variant. Keep this exact rarity's OUTER SILHOUETTE, shape, frame, material craftsmanship, outline proportions, and overall equipment identity. Keep front view, sculpted depth, premium realistic metal/wood, controlled studio lighting. Replace the original center emblem / lion / gem / boss / red panel with the NEW BIG routine centerpiece described below. The routine symbol must be structural sculpture INTEGRATED into the face itself, NOT a pasted flat icon, NOT a tiny corner badge, NO floating circle or corner marker. It occupies 55–65% of the shield's available CENTRAL FACE width and height. Simplify the center into VERY BOLD recognizable masses, visibly shaped even at 30–48 pixels. One very large central symbol with a clean dark contrasting recess behind it; no micro-ornaments crossing or fragmenting the symbol. Outer frame still communicates rarity: round wood bronze, tall silver kite, broad gold heater, angular violet epic, crowned winged legendary. The three routine types must remain instantly distinguishable by BOTH central silhouette and a LARGE colored face area (about half the face) at tiny size. Frame material remains original. Transparent background, no backdrop, no floor shadow, no particles, no diffuse aura, no text/letters/labels/numbers/watermark, no black rectangle, no checkerboard. Single shield centered on square canvas, full object intact, 5% safe margin.

## Rarity invariants

### bronze

BRONZE: keep perfectly ROUND rustic wooden buckler, honey oak planks clearly visible in outer annulus, worn dark bronze rim and bolts, humble low ornament. Remove original central round boss and cross reinforcement where it conflicts with huge type emblem. Wood still reads as wood.

### silver

SILVER: keep LONG NARROW KITE silhouette, pointed top/bottom, cool polished silver perimeter; central type emblem fills practically all inner width, contrasting type enamel face is elongated to follow kite. Remove original small blue gem and busy inner engravings.

### gold

GOLD: keep BROAD HEATER silhouette, wide upper corners, broad bottom point, rich yellow-gold outer frame and refined embossed edges. Completely REMOVE lion and original sun-like lion ornament to make space for single new type symbol and wide enamel field.

### epic

EPIC: keep angular broad DIAMOND / hexagonal frame with pronounced left/right crystal points, violet crystals and cool metal OUTER RIM, rare arcane identity. Replace entire central purple gem and busy violet interior with routine-type colored field and huge routine symbol. Preserve violet only on outer crystals/frame, do not tint blue night or green bonus back to violet.

### legendary

LEGENDARY: keep huge flaring IVORY-WHITE feather-blade WINGS, three-point GOLD CROWN, broad crowned-winged silhouette, radiant gold trim. These MUST remain, clearly apex rarity. REPLACE central ruby and crimson field with requested routine field/symbol; no ruby blocking routine identity. Large central face occupying half full object width, nearly two-thirds height, symbol fills this central face. This is an extraordinary divine artifact, dramatically grander than Gold.

## Routine prompts

### morning

MORNING / DAWN. Replace center with ONE LARGE raised IVORY-GOLD SUN: a solid circular disk and 8 short broad triangular rays, a bold unmistakable round sun silhouette, NOT a star or faceted gem. Radiant warm amber/orange enamel on the central face behind the pale sun, dark burnt-orange recess separating pale bright sun and warm field. Sun disk large and rays short and thick, not thin filigree. Sunrise warm ivory + orange face distinct from evening's navy and bonus emerald. For bronze: weathered wooden circle retained around central sun, rough cast sun, not magical fancy gems. For legendary: keep original large white feather wings and gold crown, replace ruby central field with amber-orange and majestic giant ivory sun. No crescent and no bonus star.

### evening

EVENING / MOONLIGHT. Replace center with ONE HUGE raised SILVERY-ICE-BLUE CRESCENT MOON, very thick body on LEFT and two broad tapered tips opening to the RIGHT, dark clear concavity with plenty of negative space. The outline must be an unmistakable C, NOT a full moon, NOT a circular boss, NOT a gem or tiny star. Strong midnight NAVY / COBALT enamel field across the central face behind moon, large icy blue silver moon occupies 60% available face. Keep dark navy concavity clean, no stars or jewels filling it. Night navy + ice blue dominant center distinct from warm morning and emerald bonus. For bronze: retain weathered wooden circle around rough cast silver-blue crescent, dignified rustic. For legendary: keep giant white feather wings and gold crown, replace ruby field with deep navy and divine ice crescent. No sun rays and no bonus stars.

### bonus

BONUS / EXTRA ACHIEVEMENT. Replace center with ONE HUGE luminous MINT-WHITE FOUR-POINT SPARK STAR, vertically elongated top and bottom points and broad horizontal left/right points, concave shoulders: a clearly recognizable 4-point plus-shaped diamond sparkle. Solid wide center, four broad bold points. NOT five-point star, NOT circular sun with many rays, NOT a tiny faceted jewel. Strong saturated EMERALD / TEAL enamel field covers central face behind raised mint-white star. Mint star has sculpted pale jade material with restrained metallic bevel and subtle internal light, not cartoon. Bonus emerald + pale mint is distinct from both blue evening and orange morning. For bronze: retain wooden round body around rough cast pale mint four-point centerpiece. For legendary: keep original giant white wings and crown, replace ruby field with deep emerald and monumental four-point mint star. No crescent and no sun disk/rays.

