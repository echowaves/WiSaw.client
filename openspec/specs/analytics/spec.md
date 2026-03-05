## Purpose

Tracks user engagement via Google Analytics 4 page view events on every route and reports Core Web Vitals metrics for performance monitoring.

## Requirements

### Requirement: Google Analytics 4 initialization
The system SHALL initialize Google Analytics 4 with tracking ID `G-J1W2RB0D7R` on application startup.

#### Scenario: GA4 initialization
- **WHEN** the application mounts
- **THEN** the system SHALL initialize ReactGA with the configured tracking ID

### Requirement: Page view tracking
The system SHALL track page views for every route in the application.

#### Scenario: Home page view
- **WHEN** the home page component mounts
- **THEN** the system SHALL send a GA4 pageview event for `/`

#### Scenario: Photo detail page view
- **WHEN** a photo detail page mounts
- **THEN** the system SHALL send a GA4 pageview event for `/photos/{photoId}`

#### Scenario: Video detail page view
- **WHEN** a video detail page mounts
- **THEN** the system SHALL send a GA4 pageview event for `/videos/{photoId}`

#### Scenario: Search page view
- **WHEN** the search page mounts with a search term
- **THEN** the system SHALL send a GA4 pageview event for `/search/{searchTerm}`

#### Scenario: Static page views
- **WHEN** any static page (About, Contact, Terms) mounts
- **THEN** the system SHALL send a GA4 pageview event for the corresponding route

### Requirement: Core Web Vitals reporting
The system SHALL report Core Web Vitals metrics to Google Analytics.

#### Scenario: Web Vitals measurement
- **WHEN** a Web Vital metric (CLS, LCP, FID, TTFB) is captured
- **THEN** the system SHALL send it as a non-interaction GA4 event with category "Web Vitals"
- **THEN** the event SHALL include the metric's delta value
