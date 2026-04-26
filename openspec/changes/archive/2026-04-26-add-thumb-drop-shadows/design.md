## Context

The web client renders thumbnail cards in a masonry grid (Home feed and Search results) using the `.home-thumb-card` CSS class. Currently, cards have a flat appearance with `box-shadow: none` at rest, a `1px solid var(--border)` outline, and `border-radius: var(--radius-md)` (10px). A subtle shadow appears only on hover.

The native mobile app (React Native) uses a different visual treatment: each `ExpandableThumb` has a constant drop shadow (`shadowColor: #000, shadowOffset: {0, 4}, shadowOpacity: 0.4, shadowRadius: 6, elevation: 8`), no border, and `borderRadius: 20`. This creates a pronounced "lifted card" effect that gives the feed depth and dimension.

The project already has a theme system with CSS custom properties for shadows (`--shadow-sm`, `--shadow-md`, `--shadow-lg`) that vary between light and dark modes, making it straightforward to add a theme-aware thumb shadow.

## Goals / Non-Goals

**Goals:**
- Match the mobile app's drop shadow effect on masonry thumbnail cards
- Remove the border in favor of shadow-only depth
- Increase border-radius to approximate the mobile app's rounder corners
- Maintain proper visual treatment in both light and dark themes
- Apply consistently to Home feed and Search results (same CSS class)

**Non-Goals:**
- Changing the masonry grid column counts or breakpoints
- Adding press/scale animations (the mobile app has `Animated.spring` scale on press — that's a separate concern)
- Modifying the detail view card styling (`.content-container`)
- Changing thumbnail image sizing or aspect ratios

## Decisions

### 1. Introduce a `--shadow-thumb` CSS custom property

**Decision**: Add a dedicated `--shadow-thumb` variable to `:root` and dark mode overrides rather than reusing `--shadow-md`.

**Rationale**: The mobile app's thumb shadow (`0 4px 6px rgba(0,0,0,0.4)`) is stronger than the web's `--shadow-md` (`0 4px 12px rgba(15,23,42,0.12)`). A separate variable allows tuning the thumb shadow independently without affecting other components. In dark mode the shadow can be adjusted for the darker background.

**Alternative considered**: Reusing `--shadow-md` — rejected because it's too subtle and modifying it would affect all components using that variable.

### 2. Remove border, rely on shadow for depth

**Decision**: Remove `border: 1px solid var(--border)` from `.home-thumb-card`.

**Rationale**: The mobile app uses `borderWidth: 0` with `borderColor: 'transparent'`. The drop shadow provides sufficient visual separation. Keeping both border and shadow would look over-styled.

### 3. Increase border-radius to `--radius-xl` (18px)

**Decision**: Use `var(--radius-xl)` (18px) instead of the mobile app's exact 20px.

**Rationale**: The project's design system already defines `--radius-xl: 18px`. Using the existing token keeps the design system consistent. The 2px difference from the mobile app's 20px is imperceptible.

### 4. Enhanced hover shadow

**Decision**: The hover state will use `--shadow-lg` (the existing large shadow) to create a clear visual lift above the new resting shadow.

**Rationale**: With a resting shadow now present, the hover needs to be noticeably stronger to still convey interactivity. The existing `--shadow-lg` provides this step-up.

## Risks / Trade-offs

- **[Performance on large feeds]** → CSS `box-shadow` is GPU-composited; the existing `will-change` / `translateZ(0)` patterns in the codebase already optimize for this. Thousands of cards with shadows is a well-understood browser pattern with negligible impact.
- **[Shadow opacity in dark mode]** → `rgba(0,0,0,0.4)` on a near-black background is barely visible. → Mitigation: Use a lighter shadow color in dark mode (e.g. `rgba(255,255,255,0.08)`) or accept subtler depth in dark mode, similar to the mobile app's behavior.
- **[Inline style conflicts]** → `Home.js` sets `borderRadius: 'var(--radius-lg)'` inline on thumb cards, which would override the CSS class. → Mitigation: Update inline styles to use `--radius-xl` or remove them in favor of the CSS class.
