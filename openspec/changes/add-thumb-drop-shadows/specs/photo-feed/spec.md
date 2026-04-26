## MODIFIED Requirements

### Requirement: Feed item display
Each item in the feed SHALL display a thumbnail image inside a card with a visible drop shadow, rounded corners, and contextual information.

#### Scenario: Photo thumbnail rendering
- **WHEN** a feed item is rendered
- **THEN** the system SHALL display the thumbnail image with lazy loading enabled (`loading='lazy'`)
- **THEN** the thumbnail SHALL link to the photo detail page (`/photos/:photoId`) or video detail page (`/videos/:photoId`)

#### Scenario: Thumbnail card resting shadow
- **WHEN** a feed item card is rendered at rest (no interaction)
- **THEN** the card SHALL display a drop shadow using the `--shadow-thumb` CSS custom property
- **THEN** the card SHALL NOT have a visible border

#### Scenario: Thumbnail card border-radius
- **WHEN** a feed item card is rendered
- **THEN** the card SHALL use `border-radius: var(--radius-xl)` (18px)

#### Scenario: Thumbnail card hover shadow
- **WHEN** the user hovers over a feed item card
- **THEN** the card SHALL display an enhanced shadow (`--shadow-lg`) to indicate interactivity

#### Scenario: Thumbnail card dark mode shadow
- **WHEN** the dark theme is active
- **THEN** the `--shadow-thumb` property SHALL use a value appropriate for dark backgrounds

#### Scenario: Video indicator
- **WHEN** a feed item represents a video (the `video` field is truthy)
- **THEN** the system SHALL display a video indicator badge overlay on the thumbnail

#### Scenario: Last comment preview
- **WHEN** a feed item has a `lastComment` value
- **THEN** the system SHALL display the last comment text below the thumbnail

#### Scenario: Thumbnail image fallback
- **WHEN** a thumbnail image fails to load
- **THEN** the system SHALL display `/logo192.png` as a fallback image
