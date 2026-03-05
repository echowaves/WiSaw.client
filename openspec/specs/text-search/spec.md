## Purpose

Allows users to search for photos and videos by text query, displaying paginated results in an infinite-scroll masonry grid identical to the home feed.

## Requirements

### Requirement: Text search with paginated results
The system SHALL allow users to search for photos/videos by text and display paginated results at `/search/:searchString`.

#### Scenario: Search by URL parameter
- **WHEN** a user navigates to `/search/{searchTerm}`
- **THEN** the system SHALL execute the `feedForTextSearch` GraphQL query with the search term
- **THEN** the system SHALL display matching results in a masonry grid with infinite scroll

#### Scenario: Search form submission
- **WHEN** a user enters a search term in the search form and submits
- **THEN** the system SHALL navigate to `/search/{searchTerm}`
- **THEN** the search input SHALL reflect the active search term

#### Scenario: Empty search state
- **WHEN** a user navigates to `/search` without a search term
- **THEN** the system SHALL display an empty state message prompting the user to search

#### Scenario: No results found
- **WHEN** the `feedForTextSearch` query returns no matching results
- **THEN** the system SHALL display a "Nothing found" message

#### Scenario: Search pagination
- **WHEN** the user scrolls to the bottom of search results
- **THEN** the system SHALL fetch the next page of results by incrementing the page number
- **THEN** new results SHALL be appended to the existing list

#### Scenario: End of search results
- **WHEN** the `feedForTextSearch` query returns an empty array
- **THEN** the system SHALL stop requesting additional pages

### Requirement: Search result item display
Each search result item SHALL display consistently with the home feed.

#### Scenario: Result thumbnail rendering
- **WHEN** a search result item is rendered
- **THEN** the system SHALL display the thumbnail image with lazy loading
- **THEN** the thumbnail SHALL link to the photo or video detail page

#### Scenario: Video indicator on search results
- **WHEN** a search result item represents a video
- **THEN** the system SHALL display a video indicator badge

#### Scenario: Last comment on search results
- **WHEN** a search result item has a `lastComment` value
- **THEN** the system SHALL display the last comment text below the thumbnail

### Requirement: Search loading indicator
The system SHALL display a loading indicator during search operations.

#### Scenario: Loading spinner display
- **WHEN** a search query is in progress
- **THEN** the system SHALL display a spinner (Bars loader component)

#### Scenario: Loading complete
- **WHEN** the search query completes
- **THEN** the spinner SHALL be removed and results displayed

### Requirement: Search error handling
The system SHALL handle search query failures gracefully.

#### Scenario: Search query failure
- **WHEN** the `feedForTextSearch` query fails
- **THEN** the system SHALL log the error and display available data without crashing
