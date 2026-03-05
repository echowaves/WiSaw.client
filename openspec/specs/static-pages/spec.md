## Purpose

Provides static informational pages (About, Contact, Terms & Conditions) and a 404 Not Found handler, each with consistent SEO metadata, analytics tracking, and lazy-loaded footer.

## Requirements

### Requirement: About page
The system SHALL display a static About page at `/about`.

#### Scenario: About page content
- **WHEN** a user navigates to `/about`
- **THEN** the system SHALL display the WiSaw mission statement, community values, and a call-to-action for mobile app downloads

#### Scenario: About page structure
- **WHEN** the About page is rendered
- **THEN** it SHALL include SEO metadata (title, description, OG tags, canonical URL)
- **THEN** it SHALL include a lazy-loaded Footer
- **THEN** it SHALL send a GA4 pageview event

### Requirement: Contact page
The system SHALL display a static Contact page at `/contact`.

#### Scenario: Contact page content
- **WHEN** a user navigates to `/contact`
- **THEN** the system SHALL display support links (Echowaves), social media links (Facebook, X/Twitter, LinkedIn), and email contact information

#### Scenario: Contact page structure
- **WHEN** the Contact page is rendered
- **THEN** it SHALL include SEO metadata (title, description, OG tags, canonical URL)
- **THEN** it SHALL include a lazy-loaded Footer
- **THEN** it SHALL send a GA4 pageview event

### Requirement: Terms and Conditions page
The system SHALL display a static Terms page at `/terms`.

#### Scenario: Terms page content
- **WHEN** a user navigates to `/terms`
- **THEN** the system SHALL display terms and conditions covering: content usage, user-generated content, liability, changes policy, and contact information (7 sections total)

#### Scenario: Terms page structure
- **WHEN** the Terms page is rendered
- **THEN** it SHALL include SEO metadata (title, description, OG tags, canonical URL)
- **THEN** it SHALL include a lazy-loaded Footer
- **THEN** it SHALL send a GA4 pageview event

### Requirement: 404 Not Found page
The system SHALL display a 404 page for unmatched routes.

#### Scenario: 404 page display
- **WHEN** a user navigates to an unmatched route
- **THEN** the system SHALL display the unmatched pathname to the user

#### Scenario: 404 redirect
- **WHEN** the catch-all route (`*`) matches
- **THEN** the system SHALL redirect the user to the home page (`/`)

#### Scenario: 404 SEO handling
- **WHEN** the 404 page is rendered
- **THEN** it SHALL set `noindex, follow` meta robots directive
- **THEN** the canonical URL SHALL point to `https://wisaw.com/`
