## Purpose

Defines the application shell: React Router v6 client-side routing with lazy-loaded routes, a sticky glassmorphism header with responsive hamburger menu, a lazy-loaded footer, the design system (CSS custom properties, gradients, blur effects), and baseline accessibility.

## Requirements

### Requirement: Client-side routing
The system SHALL use React Router v6 with `BrowserRouter` for client-side navigation.

#### Scenario: Route definitions
- **WHEN** the application renders
- **THEN** the system SHALL define routes for: `/` (Home), `/photos/:photoId`, `/videos/:photoId`, `/search/:searchString`, `/search`, `/about`, `/contact`, `/terms`, and a catch-all `*` that redirects to `/`

#### Scenario: Route code splitting
- **WHEN** a user navigates to a route
- **THEN** the route component SHALL be loaded lazily via `React.lazy()` with a `<Suspense>` boundary

### Requirement: Sticky header
The system SHALL display a persistent sticky header across all pages.

#### Scenario: Header positioning
- **WHEN** any page is displayed
- **THEN** a sticky header SHALL be fixed at the top of the viewport with `z-index: 1000`
- **THEN** the header height SHALL be 72px

#### Scenario: Header elements
- **WHEN** the header is rendered
- **THEN** it SHALL display the WiSaw logo (linking to `/`), navigation links (About, Contact, Terms), and a theme selector dropdown

#### Scenario: Active route highlighting
- **WHEN** a navigation link matches the current route
- **THEN** the link SHALL be visually highlighted as active

### Requirement: Responsive hamburger menu
The system SHALL provide a hamburger menu for mobile viewports.

#### Scenario: Mobile menu toggle
- **WHEN** the viewport is narrow enough to collapse navigation
- **THEN** a hamburger menu button SHALL be displayed
- **THEN** the button SHALL have `aria-expanded` reflecting the menu open/closed state

#### Scenario: Menu open
- **WHEN** the user clicks or presses Enter/Space on the hamburger button
- **THEN** the navigation menu SHALL expand and display all navigation links

#### Scenario: Keyboard accessibility
- **WHEN** the hamburger button is focused
- **THEN** the button SHALL be activatable via Enter or Space key
- **THEN** the button SHALL have `tabIndex={0}` and `role="button"`

### Requirement: Lazy-loaded footer
The system SHALL display a footer on all pages, loaded lazily.

#### Scenario: Footer display
- **WHEN** a page component renders
- **THEN** the Footer component SHALL be lazy-loaded via `React.lazy()`

#### Scenario: Embedded mode
- **WHEN** the URL contains `?embedded=true` query parameter
- **THEN** the Footer SHALL NOT be rendered

#### Scenario: Footer content
- **WHEN** the footer is rendered
- **THEN** it SHALL display: app store badges (iOS App Store, Google Play), company links (About, Blog via Echowaves), support links (Help, Contact), community links (Gallery, social media), and a copyright notice with the current year

### Requirement: Glassmorphism design system
The system SHALL use a consistent glassmorphism design language.

#### Scenario: Header glassmorphism
- **WHEN** the header is rendered
- **THEN** it SHALL apply `backdrop-filter: blur(20px)` with a semi-transparent background

#### Scenario: Design gradient
- **WHEN** accent gradient styling is applied
- **THEN** the system SHALL use the brand gradient `linear-gradient(135deg, #00ff94 0%, #720cf0 100%)`

#### Scenario: CSS custom properties
- **WHEN** styling is applied
- **THEN** the system SHALL use defined CSS custom properties for colors (`--bg`, `--text-primary`, `--accent`), spacing (`--radius-sm/md/lg/xl`), shadows (`--shadow-sm/md/lg/glow`), and animations (`--ease-out`, `--ease-spring`)

### Requirement: Accessibility foundations
The system SHALL provide baseline accessibility across all interactive elements.

#### Scenario: ARIA labels on interactive elements
- **WHEN** custom interactive elements are rendered (search inputs, loading spinners, hamburger menu, theme selector)
- **THEN** each element SHALL have an appropriate `aria-label`

#### Scenario: Semantic HTML structure
- **WHEN** the page layout is rendered
- **THEN** the system SHALL use semantic HTML elements: `<header>`, `<footer>`, `<nav>` where appropriate

#### Scenario: Image alt text
- **WHEN** images are rendered
- **THEN** each image SHALL have descriptive `alt` text
