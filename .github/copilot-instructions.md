# Copilot Instructions — WiSaw.client

## Project Overview

WiSaw ("What I Saw") is a React 18 single-page application that serves as the web client for a photo/video sharing platform. It displays a feed of user-uploaded photos and videos with infinite scroll, image recognition labels, and text search. The production site is **https://wisaw.com**.

## Tech Stack

- **Framework**: React 18.3 (Create React App via `react-scripts 5`)
- **Language**: JavaScript (`.js` files only — no TypeScript in source code despite a `tsconfig.json` present for linting tooling)
- **Routing**: React Router DOM v6 (`BrowserRouter`, `Routes`, `Route`)
- **API**: Apollo Client 3 + GraphQL against AWS AppSync (`@apollo/client`, `graphql`)
- **UI Library**: React Bootstrap 2 + Bootstrap 5
- **State Management**: React hooks only (`useState`, `useEffect`, `useCallback`, `useRef`) — no Redux or other state libraries
- **SEO**: `react-helmet-async` for dynamic `<head>` management (Open Graph, Twitter Cards, JSON-LD structured data)
- **Analytics**: Google Analytics 4 via `react-ga4` (tracking ID: `G-J1W2RB0D7R`)
- **Layout**: `react-masonry-css` for grid layouts, `react-infinite-scroll-component` for pagination
- **Media**: Native `<video>` element for video playback, `react-player` available as dependency
- **Linting**: `ts-standard` (StandardJS style with TypeScript ESLint parser)
- **Build**: CRA default (`react-scripts build`); build script also fetches sitemap from production

## Project Structure

```
src/
├── index.js              # App entry point, renders <App /> in StrictMode
├── App.js                # Root component with HelmetProvider + BrowserRouter + lazy routes
├── App.css               # Global app styles (gradient background, animations)
├── index.css             # CSS reset, base typography, scrollbar styles
├── consts.js             # Apollo Client setup, API endpoint + API key constants
├── reportWebVitals.js    # Web Vitals reporting
├── setupTests.js         # Jest/RTL setup
├── App.test.js           # Minimal test placeholder
├── containers/           # All page/feature components
│   ├── Home.js           # Landing page with infinite-scroll photo/video feed
│   ├── PhotosComponent.js # Single photo/video detail view with prev/next navigation
│   ├── SearchComponent.js # Text search with infinite-scroll results
│   ├── Header.js         # Sticky header with hamburger menu (mobile responsive)
│   ├── Footer.js         # Footer with app store links, company info
│   ├── About.js          # Static about page
│   ├── Contact.js        # Static contact page
│   ├── Terms.js          # Static terms page
│   ├── NoMatch.js        # 404 fallback
│   ├── PhotosComponent.css # Main component styles (shared by Home, Search, Photos)
│   ├── Header.css        # Header-specific styles
│   └── Footer.css        # Footer-specific styles
└── utils/
    └── imageUtils.js     # Thumbnail dimension calculation helpers
```

## Code Conventions

### Component Pattern
- **Function declarations** (not arrow functions) for top-level components: `const Component = function () { ... }`
- Exception: static pages like `About.js` use arrow functions: `const About = () => { ... }`
- **Default exports** for all components: `export default ComponentName`
- **Lazy loading** for all route-level components via `React.lazy()` + `<Suspense>`
- Footer is lazy-loaded within individual page components

### Naming
- Component files: **PascalCase** (e.g., `PhotosComponent.js`, `SearchComponent.js`)
- Utility files: **camelCase** (e.g., `imageUtils.js`)
- CSS files: named after their component (e.g., `PhotosComponent.css`)
- Constants module: `consts.js` imported as `* as CONST`

### State Management
- All state via React hooks (`useState`, `useEffect`, `useCallback`, `useRef`)
- No external state management libraries
- Complex state grouped into a single object where appropriate (e.g., `internalState` in `PhotosComponent`)
- `useRef` for caching (e.g., `photoPageCache`, `inflightPhotoRequests`, `preloadedMedia`)

### GraphQL / API
- Apollo Client configured in `src/consts.js` with AWS AppSync endpoint and `X-Api-Key` auth header
- GraphQL queries defined inline using `gql` template literals (in `PhotosComponent.js`, `Home.js`) or as module-level constants (in `SearchComponent.js`)
- Direct `CONST.gqlClient.query()` calls — not using Apollo's `useQuery` hook
- Exported client: `export const gqlClient`

### Styling
- **Plain CSS** files — no CSS-in-JS, Sass, or CSS Modules
- Heavy use of **inline styles** for dynamic/component-specific styling
- Design system gradient: `linear-gradient(135deg, #00ff94 0%, #720cf0 100%)` (green to purple)
- **Glassmorphism** effects: `backdrop-filter: blur()`, semi-transparent backgrounds
- Responsive via CSS `@media` queries and JS `window.innerWidth` checks
- System font stack: `-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, ...`
- Colors: primary text `#1a202c`, accent purple `#4c1d95`, gradient green `#00ff94`, gradient purple `#720cf0`

### SEO
- Every page sets `<Helmet prioritizeSeoTags>` with title, description, canonical URL, OG tags, and Twitter cards
- `PhotosComponent` generates JSON-LD `VideoObject` structured data for video content
- Canonical URLs use `https://wisaw.com/...`

### Error Handling
- `try/catch` around all GraphQL queries
- `console.log({ err })` or `console.error(...)` for error logging
- Graceful fallbacks: return empty arrays/null on failure, show fallback images on load errors
- `eslint-disable-line` comments used to suppress specific lint warnings

### Performance Patterns
- Image/media preloading via `useCallback` + `useRef` cache sets
- In-flight request deduplication with `inflightPhotoRequests` ref Map
- Page data caching with `photoPageCache` ref Map
- Lazy component loading for code splitting
- `will-change` and `translateZ(0)` for GPU-accelerated animations
- Responsive image dimensions calculated from GraphQL width/height data

### Accessibility
- ARIA labels on interactive elements (`role="button"`, `aria-label`, `aria-expanded`)
- Keyboard event handlers alongside click handlers (`onKeyDown` for Enter/Space)
- `tabIndex={0}` on custom interactive elements
- Loading indicators with `aria-label`

## Routes

| Path | Component | Description |
|------|-----------|-------------|
| `/` | `Home` | Recent photo/video feed with infinite scroll |
| `/photos/:photoId` | `PhotosComponent` | Single photo detail with prev/next navigation |
| `/videos/:photoId` | `PhotosComponent` | Single video detail with prev/next navigation |
| `/search/:searchString` | `SearchComponent` | Search results with infinite scroll |
| `/search` | `SearchComponent` | Search page (empty state) |
| `/about` | `About` | Static about page |
| `/contact` | `Contact` | Static contact page |
| `/terms` | `Terms` | Static terms page |
| `*` | Redirects to `/` | Catch-all redirect |

## GraphQL Queries Used

- `feedRecent(pageNumber, batch)` — paginated recent feed (Home)
- `feedForTextSearch(searchTerm, pageNumber, batch)` — text search feed (SearchComponent)
- `getPhotoAllCurr(photoId)` — current photo with comments + recognitions
- `getPhotoAllNext(photoId)` — next photo in sequence
- `getPhotoAllPrev(photoId)` — previous photo in sequence

## Scripts

- `npm start` — development server
- `npm run build` — fetches sitemap from production + CRA build
- `npm test` — Jest test runner
- `npm run lint` — `ts-standard` linting
- `npm run lint:fix` — auto-fix lint issues

## Key Guidelines for AI

1. **JavaScript only** — do not convert files to TypeScript
2. **Functional components with hooks** — do not use class components
3. **StandardJS style** — no semicolons, single quotes, 2-space indentation
4. **No new state management libraries** — use React hooks
5. **Apollo Client direct queries** — use `CONST.gqlClient.query()`, not `useQuery` hooks
6. **Plain CSS** for styling — avoid CSS-in-JS or preprocessors
7. **Lazy load** new route-level components
8. **SEO metadata** via `react-helmet-async` on every page
9. **Google Analytics** tracking via `ReactGA.send()` for page views
10. **Graceful error handling** — always wrap async/API calls in try/catch
11. **Maintain the glassmorphism design** — use the established gradient, blur, and transparency patterns
12. **Keep `consts.js`** as the single source for API configuration
13. **No CI/CD pipeline exists** — the project builds locally and deploys static files
14. **Deep linking support** — the app supports iOS/Android universal links (see `apple-app-site-association` and `_headers`)
15. **Import constants** as namespace: `import * as CONST from '../consts'`

## Related Instructions

- `.github/instructions/codacy.instructions.md` — Codacy MCP Server integration rules (auto-analyze edited files, security checks on dependency changes)
