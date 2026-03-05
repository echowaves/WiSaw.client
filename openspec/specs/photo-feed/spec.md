## Purpose

Provides the main landing experience — an infinite-scroll feed of the most recently uploaded photos and videos displayed in a responsive masonry grid.

## Requirements

### Requirement: Paginated recent photo/video feed
The system SHALL display a paginated feed of recently uploaded photos and videos on the home page (`/`), loading content progressively via infinite scroll.

#### Scenario: Initial page load
- **WHEN** a user navigates to the home page
- **THEN** the system fetches the first page of recent photos/videos using the `feedRecent` GraphQL query with `pageNumber: 1` and `batch: "yes"`

#### Scenario: Infinite scroll pagination
- **WHEN** the user scrolls to the bottom of the current feed
- **THEN** the system fetches the next page of photos/videos by incrementing the page number
- **THEN** the new items are appended to the existing feed

#### Scenario: End of feed
- **WHEN** the `feedRecent` query returns an empty array
- **THEN** the system SHALL stop requesting additional pages and display an end-of-content message

#### Scenario: Feed fetch error
- **WHEN** the `feedRecent` query fails
- **THEN** the system SHALL log the error and return an empty result without crashing

### Requirement: Masonry grid layout
The system SHALL render the photo/video feed in a responsive masonry grid layout.

#### Scenario: Desktop viewport
- **WHEN** the viewport width is 1100px or greater
- **THEN** the grid SHALL display 4 columns

#### Scenario: Medium viewport
- **WHEN** the viewport width is between 700px and 1099px
- **THEN** the grid SHALL display 3 columns

#### Scenario: Small viewport
- **WHEN** the viewport width is between 500px and 699px
- **THEN** the grid SHALL display 2 columns

#### Scenario: Mobile viewport
- **WHEN** the viewport width is less than 500px
- **THEN** the grid SHALL display 1 column

### Requirement: Feed item display
Each item in the feed SHALL display a thumbnail image with contextual information.

#### Scenario: Photo thumbnail rendering
- **WHEN** a feed item is rendered
- **THEN** the system SHALL display the thumbnail image with lazy loading enabled (`loading='lazy'`)
- **THEN** the thumbnail SHALL link to the photo detail page (`/photos/:photoId`) or video detail page (`/videos/:photoId`)

#### Scenario: Video indicator
- **WHEN** a feed item represents a video (the `video` field is truthy)
- **THEN** the system SHALL display a video indicator badge overlay on the thumbnail

#### Scenario: Last comment preview
- **WHEN** a feed item has a `lastComment` value
- **THEN** the system SHALL display the last comment text below the thumbnail

#### Scenario: Thumbnail image fallback
- **WHEN** a thumbnail image fails to load
- **THEN** the system SHALL display `/logo192.png` as a fallback image

### Requirement: Integrated search form
The home page SHALL include a search form for navigating to search results.

#### Scenario: Search submission
- **WHEN** a user enters a search term and submits the form
- **THEN** the system SHALL navigate to `/search/{searchTerm}`
