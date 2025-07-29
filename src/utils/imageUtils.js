/**
 * Helper function to calculate optimized thumbnail dimensions
 * Uses width and height from GraphQL to calculate efficient thumbnail sizes
 */
export const getOptimizedThumbnailDimensions = (photo, containerWidth = 244) => {
  if (!photo.width || !photo.height) return { width: containerWidth, height: 200 }
  
  const aspectRatio = photo.width / photo.height
  const maxHeight = 300 // Maximum height for thumbnails
  const minWidth = 150 // Minimum width for thumbnails
  
  let width = Math.min(containerWidth, photo.width)
  let height = width / aspectRatio
  
  if (height > maxHeight) {
    height = maxHeight
    width = height * aspectRatio
  }
  
  // Ensure minimum width for better layout
  if (width < minWidth) {
    width = minWidth
    height = width / aspectRatio
  }
  
  return {
    width: Math.round(width),
    height: Math.round(height)
  }
}

/**
 * Helper function specifically for search component flexible grid layout
 * Calculates dimensions that work well in a flexible grid with variable sizes
 */
export const getSearchGridDimensions = (photo, maxWidth) => {
  if (!photo.width || !photo.height) return { width: 200, height: 150 }
  
  // Responsive max width based on screen size
  if (!maxWidth) {
    const screenWidth = typeof window !== 'undefined' ? window.innerWidth : 1200
    maxWidth = screenWidth < 768 ? 160 : screenWidth < 1024 ? 220 : 280
  }
  
  const aspectRatio = photo.width / photo.height
  const maxHeight = typeof window !== 'undefined' && window.innerWidth < 768 ? 200 : 250
  const minWidth = typeof window !== 'undefined' && window.innerWidth < 768 ? 120 : 160
  const minHeight = typeof window !== 'undefined' && window.innerWidth < 768 ? 90 : 120
  
  let width = Math.min(maxWidth, photo.width * 0.3) // Scale down for grid display
  let height = width / aspectRatio
  
  // Apply height constraints
  if (height > maxHeight) {
    height = maxHeight
    width = height * aspectRatio
  }
  
  if (height < minHeight) {
    height = minHeight
    width = height * aspectRatio
  }
  
  // Apply width constraints
  if (width < minWidth) {
    width = minWidth
    height = width / aspectRatio
  }
  
  return {
    width: Math.round(width),
    height: Math.round(height)
  }
}
