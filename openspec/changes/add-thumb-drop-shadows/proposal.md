## Why

The web client's masonry thumbnail cards look flat compared to the native mobile app (WiSaw for iOS/Android). The mobile app uses prominent drop shadows on every thumbnail to create a "lifted card" effect with depth, while the web client currently has no resting shadow (only on hover) and relies on a thin border for definition. Aligning the two creates visual consistency across platforms and gives the web feed a more polished, modern feel.

## What Changes

- Add a resting `box-shadow` to `.home-thumb-card` elements matching the mobile app's shadow parameters (`shadowColor: #000`, `shadowOffset: 0 4px`, `shadowOpacity: 0.4`, `shadowRadius: 6`)
- Remove the `1px solid var(--border)` border from thumb cards (the mobile app uses no border)
- Increase thumb card `border-radius` from `var(--radius-md)` (10px) to `var(--radius-xl)` (18px) to approximate the mobile app's `borderRadius: 20`
- Ensure the shadow looks appropriate in both light and dark theme modes, using theme-aware CSS custom properties
- Enhance the hover state shadow to be a step above the new resting shadow

## Capabilities

### New Capabilities

_(none)_

### Modified Capabilities

- `photo-feed`: Feed item card visual treatment changes — adding resting drop shadow, removing border, increasing border-radius to match the mobile app's styling

## Impact

- **CSS**: `src/containers/PhotosComponent.css` — `.home-thumb-card`, `.home-thumb-card:hover`, and potentially masonry column spacing
- **Components**: `src/containers/Home.js` — inline styles on thumb card elements may need adjustment to align with CSS changes
- **Components**: `src/containers/SearchComponent.js` — uses the same card class, will inherit the changes
- **Theme variables**: `src/index.css` — may need a new `--shadow-thumb` custom property for theme-aware thumb shadows
- **No dependency changes**: pure CSS/style modifications
- **No API changes**: no GraphQL or backend impact
