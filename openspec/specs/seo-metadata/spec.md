## Purpose

Ensures every page has comprehensive SEO metadata including title, description, canonical URLs, Open Graph tags, Twitter Cards, and JSON-LD structured data for search engine visibility and social sharing.

## Requirements

### Requirement: Per-page SEO metadata
Every page in the application SHALL set comprehensive SEO metadata using `react-helmet-async` with `prioritizeSeoTags`.

#### Scenario: Home page metadata
- **WHEN** the home page is rendered
- **THEN** the system SHALL set the page title to "Free Stock Photos & Videos -- What I Saw"
- **THEN** the system SHALL set the meta description for stock photos/videos
- **THEN** the system SHALL set the canonical URL to `https://wisaw.com/`

#### Scenario: Photo detail metadata
- **WHEN** a photo detail page is rendered
- **THEN** the system SHALL set a dynamic title including the photo ID
- **THEN** the system SHALL set the canonical URL to `https://wisaw.com/photos/{photoId}` or `https://wisaw.com/videos/{photoId}`

#### Scenario: Search page metadata
- **WHEN** a search page is rendered with a search term
- **THEN** the system SHALL set the title to "WiSaw: searching for {searchTerm}"
- **THEN** the system SHALL set the canonical URL to `https://wisaw.com/search/{searchTerm}`

#### Scenario: Static page metadata
- **WHEN** any static page (About, Contact, Terms) is rendered
- **THEN** the system SHALL set the appropriate page-specific title, description, and canonical URL

#### Scenario: 404 page metadata
- **WHEN** the 404 page is rendered
- **THEN** the system SHALL set `noindex, follow` meta robots directive
- **THEN** the system SHALL set the canonical URL to `https://wisaw.com/`

### Requirement: Open Graph and Twitter Card tags
Every page SHALL include Open Graph and Twitter Card metadata for social sharing.

#### Scenario: Open Graph tags
- **WHEN** any page is rendered
- **THEN** the system SHALL include `og:title`, `og:description`, `og:url`, and `og:type` meta tags

#### Scenario: Photo detail Open Graph image
- **WHEN** a photo detail page is rendered
- **THEN** the system SHALL set `og:image` to the photo's thumbnail URL

#### Scenario: Twitter Card tags
- **WHEN** any page is rendered
- **THEN** the system SHALL include `twitter:card`, `twitter:title`, and `twitter:description` meta tags

### Requirement: JSON-LD structured data
The system SHALL output JSON-LD structured data for search engine understanding.

#### Scenario: Home page structured data
- **WHEN** the home page is rendered
- **THEN** the system SHALL include JSON-LD `WebSite` schema with a `SearchAction` pointing to `/search/{search_term_string}`
- **THEN** the system SHALL include JSON-LD `Organization` schema with name, URL, logo, and social media links
- **THEN** the system SHALL include JSON-LD `CollectionPage` schema

#### Scenario: Video structured data
- **WHEN** a video detail page is rendered
- **THEN** the system SHALL include JSON-LD `VideoObject` schema with the video's metadata
