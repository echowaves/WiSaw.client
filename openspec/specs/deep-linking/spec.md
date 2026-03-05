## Purpose

Enables deep linking from iOS and Android devices into the native WiSaw app via Apple App Site Association and app store badges, and provides PWA installability via web app manifest.

## Requirements

### Requirement: iOS universal links
The system SHALL support iOS universal links for deep linking from iOS devices into the native app.

#### Scenario: Apple App Site Association file
- **WHEN** a request is made to `/.well-known/apple-app-site-association` or `/apple-app-site-association`
- **THEN** the server SHALL return the Apple App Site Association JSON file defining the app's associated domains and URL paths

### Requirement: Android app links
The system SHALL support Android app links for deep linking from Android devices.

#### Scenario: App store redirect
- **WHEN** a user on a mobile device accesses the site
- **THEN** the Footer SHALL display app store badges linking to both the iOS App Store and Google Play Store

### Requirement: Custom HTTP headers
The system SHALL serve custom HTTP headers for proper deep link handling.

#### Scenario: Headers configuration
- **WHEN** static assets are served
- **THEN** the `_headers` file SHALL define appropriate headers for deep link association files (content-type application/json for AASA files)

### Requirement: PWA manifest
The system SHALL provide a Progressive Web App manifest for installability.

#### Scenario: Web app manifest
- **WHEN** the application is loaded
- **THEN** the `manifest.json` SHALL define the app name, icons, start URL, display mode, and theme/background colors

#### Scenario: Site webmanifest
- **WHEN** browsers check for PWA support
- **THEN** a `site.webmanifest` file SHALL be available with app metadata
