## Purpose

Provides a multi-mode theme system (light, dark, system) with persistent user preference storage via localStorage and cookies, and automatic system preference detection.

## Requirements

### Requirement: Multi-mode theme switching
The system SHALL support three theme modes: light, dark, and system (auto-detect).

#### Scenario: Light theme selection
- **WHEN** the user selects "Light" from the theme selector
- **THEN** the application SHALL apply the light theme by setting `data-theme="light"` on the document
- **THEN** the theme preference SHALL be persisted to localStorage and a cookie

#### Scenario: Dark theme selection
- **WHEN** the user selects "Dark" from the theme selector
- **THEN** the application SHALL apply the dark theme by setting `data-theme="dark"` on the document
- **THEN** the theme preference SHALL be persisted to localStorage and a cookie

#### Scenario: System theme selection
- **WHEN** the user selects "System" from the theme selector
- **THEN** the application SHALL detect the OS color scheme preference using `matchMedia('(prefers-color-scheme: dark)')`
- **THEN** the application SHALL apply the matching theme (light or dark)

#### Scenario: System preference changes
- **WHEN** the theme mode is "system" and the OS color scheme preference changes
- **THEN** the application SHALL automatically update the applied theme to match

### Requirement: Theme persistence
The system SHALL persist the user's theme preference across sessions.

#### Scenario: Persistence on selection
- **WHEN** the user selects a theme mode
- **THEN** the system SHALL store the mode in both localStorage and a cookie with a one-year expiration and `SameSite=Lax` attribute

#### Scenario: Restoration on page load
- **WHEN** the application loads
- **THEN** the system SHALL resolve the persisted theme from localStorage first, falling back to cookies
- **THEN** if no persisted preference exists, the system SHALL default to "system" mode

### Requirement: CSS custom properties for theming
The system SHALL use CSS custom properties (`data-theme` attribute) to define theme-specific styles.

#### Scenario: Light theme variables
- **WHEN** the light theme is active
- **THEN** the CSS custom properties SHALL use light palette values (e.g., `--bg: #f5f7fb`, `--text-primary: #111827`)

#### Scenario: Dark theme variables
- **WHEN** the dark theme is active
- **THEN** the CSS custom properties SHALL use dark palette values (e.g., `--bg: #111113`, `--text-primary: #ececf0`)

### Requirement: Theme selector UI
The system SHALL provide a theme selector in the header.

#### Scenario: Theme dropdown display
- **WHEN** the header is rendered
- **THEN** a theme dropdown selector SHALL be displayed with three options: Light (☀️), Dark (🌙), System (◐)

#### Scenario: Current theme indication
- **WHEN** a theme mode is active
- **THEN** the theme selector SHALL show the corresponding icon for the active mode
