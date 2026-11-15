/**
 * Geometry contract with the edge skeleton (WiSaw.cdk skeleton.js).
 *
 * The Lambda@Edge detail skeleton reserves a header band, a media cap and below-fold space from
 * its own copies of this app's numbers; adopted pages only stay CLS-clean while both sides agree.
 * The duration rules already pin their cross-stack copy this way (the pattern this file mirrors):
 * read the real backend module and assert against it, so a one-sided edit fails here rather than
 * shifting content on production detail pages. Nothing pinned the two copies together before
 * this file existed.
 */
import { existsSync, readFileSync } from 'node:fs'
import path from 'node:path'
import { createRequire } from 'node:module'
import { fileURLToPath } from 'node:url'

import { describe, expect, it } from 'vitest'

import { COLD_BELOW_MEDIA_RESERVE, DETAIL_MAX_SIDE, DETAIL_MOBILE_BREAKPOINT } from './utils/detailLayout'

const HERE = path.dirname(fileURLToPath(import.meta.url))
const SKELETON_PATH = path.join(HERE, '..', '..', 'WiSaw.cdk', 'lambda-fns', 'lambdas', 'injectMetaTagsLambdaFunction', 'skeleton.js')
const HEADER_CSS_PATH = path.join(HERE, 'containers', 'Header.css')
const CONTENT_CSS_PATH = path.join(HERE, 'containers', 'PhotosComponent.css')

// The contract only exists when both repos are checked out side by side; standalone checkouts
// skip rather than fail, matching how the duration contract handles a missing backend.
const describeContract = existsSync(SKELETON_PATH) ? describe : describe.skip

describeContract('edge skeleton geometry mirrors the app geometry', () => {
  const requireCjs = createRequire(import.meta.url)
  const skeleton = requireCjs(SKELETON_PATH)

  it('caps the media box at the app long side and breakpoint', () => {
    expect(skeleton.DETAIL_MAX_SIDE).toBe(DETAIL_MAX_SIDE)
    expect(skeleton.DETAIL_MOBILE_BREAKPOINT).toBe(DETAIL_MOBILE_BREAKPOINT)
  })

  it('reserves under the fold what the cold skeleton reserves', () => {
    expect(skeleton.BELOW_MEDIA_RESERVE_PX).toBe(COLD_BELOW_MEDIA_RESERVE)
  })

  it('reserves exactly the header band Header.css gives the sticky header', () => {
    const css = readFileSync(HEADER_CSS_PATH, 'utf8')
    const desktop = /\.header-container\s*\{[^}]*?height:\s*(\d+)px/.exec(css)
    const mobile = /@media screen and \(max-width: 768px\)\s*\{\s*\.header-container\s*\{[^}]*?height:\s*(\d+)px/.exec(css)
    expect(desktop, 'desktop header height rule').not.toBeNull()
    expect(mobile, 'mobile header height rule').not.toBeNull()
    expect(skeleton.HEADER_DESKTOP_PX).toBe(Number(desktop[1]))
    expect(skeleton.HEADER_MOBILE_PX).toBe(Number(mobile[1]))
  })

  it('sizes portrait boxes with the same long-side cap maths as computeDisplayDimensions', () => {
    // 2250x3000 portrait: width = 700 * w / h, exactly what computeDisplayDimensions returns at a
    // desktop viewport. The edge cannot call the client function, so it re-derives it — both must
    // keep landing on the same number.
    const boxStyle = skeleton.mediaBoxStyle('2250', '3000')
    const cap = Number(/--wsk-cap:(\d+)px/.exec(boxStyle)[1])
    expect(cap).toBe(Math.round(700 * 2250 / 3000))
    expect(cap).not.toBe(DETAIL_MAX_SIDE)
  })

  it('lays the nav anchor column out like the app content container', () => {
    // Prev/next are absolutely positioned at the same offsets on both render paths: against
    // <main class="content-container"> when React renders the page, against the edge's .wsk-main
    // while the painted skeleton is adopted. Same numbers in the two rules is what makes them land
    // in the same place across the handoff; a one-sided edit reopens the visible jump.
    const norm = (text) => text.replace(/\s+/g, '')
    const edgeRule = /#root \.wsk-main\{([^}]*)\}/.exec(skeleton.SKELETON_STYLE)?.[1] ?? ''
    const appRule = /\.content-container\s*\{([^}]*)\}/.exec(readFileSync(CONTENT_CSS_PATH, 'utf8'))?.[1] ?? ''
    expect(edgeRule, '.wsk-main rule in the edge skeleton').not.toBe('')
    expect(appRule, '.content-container rule in PhotosComponent.css').not.toBe('')
    for (const declaration of ['max-width:1100px', 'margin:0auto', 'padding:20px20px28px']) {
      expect(norm(edgeRule), `edge .wsk-main ${declaration}`).toContain(declaration)
      expect(norm(appRule), `app .content-container ${declaration}`).toContain(declaration)
    }
  })
})
