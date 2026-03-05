## Purpose

Displays a single photo or video in full detail with comments, AI recognition labels, and sequential prev/next navigation. Includes media preloading, request deduplication, and data caching for smooth browsing.

## Requirements

### Requirement: Single photo/video detail view
The system SHALL display a detailed view of a single photo or video at `/photos/:photoId` and `/videos/:photoId`.

#### Scenario: Photo detail load
- **WHEN** a user navigates to `/photos/:photoId`
- **THEN** the system SHALL fetch the photo data using the `getPhotoAllCurr` GraphQL query
- **THEN** the system SHALL display the full-size image with responsive dimensions calculated from the photo's width/height metadata

#### Scenario: Video detail load
- **WHEN** a user navigates to `/videos/:photoId`
- **THEN** the system SHALL fetch the video data using the `getPhotoAllCurr` GraphQL query
- **THEN** the system SHALL display a native video player with the video URL

### Requirement: Previous/next navigation
The system SHALL support navigating between photos/videos sequentially.

#### Scenario: Load adjacent photos
- **WHEN** a photo detail page loads
- **THEN** the system SHALL concurrently fetch the next and previous photos using `getPhotoAllNext` and `getPhotoAllPrev` queries

#### Scenario: Navigate to next photo
- **WHEN** the user clicks the "next" navigation button
- **THEN** the system SHALL navigate to the next photo's detail page

#### Scenario: Navigate to previous photo
- **WHEN** the user clicks the "previous" navigation button
- **THEN** the system SHALL navigate to the previous photo's detail page

#### Scenario: No next/previous available
- **WHEN** there is no next or previous photo in the sequence
- **THEN** the corresponding navigation button SHALL be hidden or disabled

### Requirement: Comments display
The system SHALL display comments associated with the photo.

#### Scenario: Photo has comments
- **WHEN** the photo has associated comments
- **THEN** the system SHALL display each comment with its content

#### Scenario: Photo has no comments
- **WHEN** the photo has no associated comments
- **THEN** the system SHALL not render a comments section

### Requirement: AI recognition labels
The system SHALL display AI-generated labels from AWS Rekognition metadata.

#### Scenario: Labels display with confidence-based styling
- **WHEN** the photo has recognition metadata with Labels
- **THEN** the system SHALL display up to 10 labels
- **THEN** labels at positions 0-2 SHALL be rendered in h1 (largest) heading
- **THEN** labels at positions 3-5 SHALL be rendered in h2 heading
- **THEN** labels at positions 6-8 SHALL be rendered in h3 heading
- **THEN** each label's opacity, font-size, and weight SHALL reflect its confidence score

#### Scenario: Label search navigation
- **WHEN** the user clicks on a recognition label
- **THEN** the system SHALL navigate to `/search/{labelName}`

#### Scenario: Text detection display
- **WHEN** the photo has TextDetections in recognition metadata
- **THEN** the system SHALL display detected text lines (filtered by Type === 'LINE')

#### Scenario: Moderation labels
- **WHEN** the photo has ModerationLabels in recognition metadata
- **THEN** the system SHALL display the moderation labels

### Requirement: Video playback
The system SHALL support video playback for video content.

#### Scenario: Video player rendering
- **WHEN** the photo is a video (has a videoUrl)
- **THEN** the system SHALL render a native `<video>` element with the video source

#### Scenario: Video play button
- **WHEN** the video is loaded and ready
- **THEN** the system SHALL display a play button overlay

#### Scenario: Video load error
- **WHEN** the video fails to load
- **THEN** the system SHALL display an error message to the user

### Requirement: Media preloading and caching
The system SHALL preload adjacent media and cache fetched data for smooth navigation.

#### Scenario: Next/previous media preloading
- **WHEN** the current photo detail loads successfully
- **THEN** the system SHALL preload the images/thumbnails of the next and previous photos using async image decoding

#### Scenario: Request deduplication
- **WHEN** a GraphQL query for a photoId is already in-flight
- **THEN** the system SHALL NOT send a duplicate request; it SHALL await the existing in-flight request

#### Scenario: Page data caching
- **WHEN** photo data (curr/next/prev triplet) has been fetched
- **THEN** the system SHALL cache the data so re-navigating to that photo does not trigger a new fetch

### Requirement: Detail page fetch error handling
The system SHALL handle fetch errors gracefully.

#### Scenario: GraphQL query failure
- **WHEN** any of the photo detail queries fail
- **THEN** the system SHALL log the error and display available data without crashing
