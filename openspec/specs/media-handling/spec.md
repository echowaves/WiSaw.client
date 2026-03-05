## Purpose

Handles all image and video rendering concerns: responsive thumbnail sizing, lazy loading, fallback images, media preloading for adjacent photos, GraphQL request deduplication, photo data caching, and route-level code splitting.

## Requirements

### Requirement: Responsive thumbnail dimensions
The system SHALL calculate responsive thumbnail dimensions that preserve aspect ratio.

#### Scenario: Standard thumbnail sizing
- **WHEN** a photo has width and height metadata from the GraphQL response
- **THEN** the system SHALL calculate display dimensions using a 244px default container width
- **THEN** the maximum thumbnail height SHALL be 300px
- **THEN** the minimum thumbnail width SHALL be 150px
- **THEN** the aspect ratio SHALL be preserved

#### Scenario: Search grid dimensions
- **WHEN** thumbnails are rendered in a search result grid
- **THEN** the system SHALL calculate responsive grid dimensions based on the current screen size

### Requirement: Image lazy loading
The system SHALL defer loading of off-screen images.

#### Scenario: Native lazy loading
- **WHEN** thumbnail images are rendered in the feed or search results
- **THEN** each image SHALL have the `loading='lazy'` HTML attribute
- **THEN** each image SHALL specify explicit `width` and `height` attributes to prevent layout shift

### Requirement: Image fallback handling
The system SHALL handle failed image loads gracefully.

#### Scenario: Thumbnail load failure
- **WHEN** a thumbnail image fails to load (onerror event)
- **THEN** the system SHALL replace the image source with `/logo192.png`

### Requirement: Media preloading
The system SHALL preload media for adjacent photos to enable smooth navigation.

#### Scenario: Preload next/previous images
- **WHEN** a photo detail page loads
- **THEN** the system SHALL create `new Image()` instances for the next and previous photo's images and thumbnails
- **THEN** image decoding SHALL use `decoding='async'` for non-blocking decode

#### Scenario: Preloaded media tracking
- **WHEN** a media item is preloaded
- **THEN** the system SHALL track it in a `loadedMedia` Set ref
- **THEN** the system SHALL maintain strong references in `inflightMediaPreloads` Map to prevent garbage collection during download

### Requirement: Request deduplication
The system SHALL deduplicate concurrent GraphQL requests for the same resource.

#### Scenario: Duplicate request prevention
- **WHEN** a GraphQL query for a specific `photoId` is already in-flight
- **THEN** the system SHALL return the existing promise instead of initiating a new request

#### Scenario: In-flight tracking cleanup
- **WHEN** a GraphQL query completes (success or failure)
- **THEN** the system SHALL remove the entry from the `inflightPhotoRequests` tracking Map

### Requirement: Photo data caching
The system SHALL cache fetched photo data to avoid redundant network requests.

#### Scenario: Cache populated on fetch
- **WHEN** a photo's curr/next/prev data triplet is fetched
- **THEN** the system SHALL store the triplet in a `photoPageCache` Map keyed by photoId

#### Scenario: Cache hit on navigation
- **WHEN** the user navigates to a photo that exists in the cache
- **THEN** the system SHALL use the cached data instead of making a new GraphQL request

### Requirement: Code splitting
The system SHALL split code by route to reduce initial bundle size.

#### Scenario: Lazy-loaded route components
- **WHEN** the application initializes
- **THEN** all route-level components (Home, PhotosComponent, SearchComponent, About, Contact, Terms, NoMatch) SHALL be loaded via `React.lazy()`
- **THEN** each lazy component SHALL be wrapped in a `<Suspense>` boundary

#### Scenario: Footer lazy loading
- **WHEN** a page component renders
- **THEN** the Footer component SHALL be lazy-loaded within each page component
