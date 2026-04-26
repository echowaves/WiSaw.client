## 1. Theme Variables

- [x] 1.1 Add `--shadow-thumb` CSS custom property to `:root` in `src/index.css` with value `0 4px 6px rgba(0, 0, 0, 0.35)`
- [x] 1.2 Add `--shadow-thumb` override in the dark mode `@media (prefers-color-scheme: dark)` block with an appropriate dark-mode value
- [x] 1.3 Add `--shadow-thumb` to the `[data-theme='light']` and `[data-theme='dark']` explicit theme blocks

## 2. Thumb Card CSS

- [x] 2.1 Update `.home-thumb-card` in `src/containers/PhotosComponent.css`: set `box-shadow: var(--shadow-thumb)`, remove `border`, set `border-radius: var(--radius-xl)`
- [x] 2.2 Update `.home-thumb-card:hover` in `src/containers/PhotosComponent.css`: set `box-shadow: var(--shadow-lg)` for the enhanced hover state

## 3. Inline Style Cleanup

- [x] 3.1 Update inline `borderRadius` on the thumb card `<div>` in `src/containers/Home.js` to use `var(--radius-xl)` (or remove inline override if CSS class is sufficient)
- [x] 3.2 Verify `src/containers/SearchComponent.js` uses the same `.home-thumb-card` class and inherits the changes correctly

## 4. Verification

- [x] 4.1 Visual check: light mode — cards show resting shadow, no border, rounder corners
- [x] 4.2 Visual check: dark mode — cards show appropriate shadow for dark background
- [x] 4.3 Visual check: hover state — shadow intensifies on hover in both themes
- [x] 4.4 Confirm no lint errors via `npm run lint`
