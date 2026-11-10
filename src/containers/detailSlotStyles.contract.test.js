import { readFileSync } from 'node:fs'
import { join } from 'node:path'

import { describe, expect, it } from 'vitest'

// The detail page reserves its skeleton slots with CSS rather than JS measurements,
// so these style invariants are what keep Cumulative Layout Shift at zero. jsdom does
// not apply the stylesheet to rendered components, hence the source-level contract.
const css = readFileSync(join(import.meta.dirname, 'PhotosComponent.css'), 'utf8')

const block = (selector) => {
  const escaped = selector.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
  return css.match(new RegExp(escaped + ' \\{([^}]*)\\}'))?.[1] ?? ''
}

describe('detail page slot stylesheet contract', () => {
  it('overrides card chrome with selectors specific enough to win the cascade', () => {
    // `.comments-section { background: … }` is declared later in the file, so a
    // single-class `.comments-section--slot` rule would lose and paint an empty panel.
    expect(css).toMatch(/\.recognition-tags\.recognition-tags--slot/)
    expect(css).toMatch(/\.comments-section\.comments-section--slot/)
  })

  it('reserves one label row that cannot wrap and floors it at a full-size pill', () => {
    expect(block('.recognition-tags .skeleton-pill-row')).toContain('white-space: nowrap')
    expect(block('.recognition-tags .recognition-tags-h1')).toMatch(/min-height: calc\(1\.4em/)
  })

  it('builds the placeholder pill from the same box metrics as a real label pill', () => {
    const real = block('.recognition-tags a')
    const placeholder = block('.recognition-tags .skeleton-pill')
    // Padding, border width and margins are what make the two rows equally tall.
    for (const declaration of ['padding: 5px 14px', 'margin: 0 4px 6px 0', 'border: 1px solid']) {
      expect(real).toContain(declaration)
      expect(placeholder).toContain(declaration)
    }
  })

  it('stabilises the scrollbar gutter so crossing one viewport cannot shift sideways', () => {
    const indexCss = readFileSync(join(import.meta.dirname, '../index.css'), 'utf8')
    expect(indexCss).toMatch(/scrollbar-gutter:\s*stable/)
  })
})
