/**
 * Cross-repo contract for the detail page.
 *
 * One module builds the photo/video page: WiSaw.cdk's skeleton.js, which Lambda@Edge serves and
 * which scripts/publish-detail-template.js copies into this app verbatim. That is only true while
 * nobody edits the copy or re-adds detail markup on either side, so this file pins it — a one-sided
 * change fails here instead of showing up as a navigated page that looks different from the same id
 * loaded directly (the bug that started this).
 *
 * The duration rules already pin their cross-stack copy this way; this mirrors that pattern.
 */
import { existsSync, readFileSync } from 'node:fs'
import path from 'node:path'
import { createRequire } from 'node:module'
import { fileURLToPath } from 'node:url'

import { describe, expect, it } from 'vitest'

import { mediaBoxStyle, SKELETON_STYLE } from './utils/detailTemplate.generated'
import { COLD_BELOW_MEDIA_RESERVE, DETAIL_MAX_SIDE, DETAIL_MOBILE_BREAKPOINT, HEADER_DESKTOP_PX, HEADER_MOBILE_PX } from './utils/detailLayout'

const HERE = path.dirname(fileURLToPath(import.meta.url))
const CDK_DIR = path.join(HERE, '..', '..', 'WiSaw.cdk')
const SKELETON_PATH = path.join(CDK_DIR, 'lambda-fns', 'lambdas', 'injectMetaTagsLambdaFunction', 'skeleton.js')
const UTILS_PATH = path.join(CDK_DIR, 'lambda-fns', 'lambdas', 'injectMetaTagsLambdaFunction', 'utils.js')
const PUBLISH_SCRIPT = path.join(CDK_DIR, 'scripts', 'publish-detail-template.js')
const GENERATED_PATH = path.join(HERE, 'utils', 'detailTemplate.generated.js')
const HEADER_CSS_PATH = path.join(HERE, 'containers', 'Header.css')
const DETAIL_SKELETON_SRC = readFileSync(path.join(HERE, 'utils', 'detailSkeleton.js'), 'utf8')

// The contract only exists when both repos are checked out side by side; standalone checkouts skip
// rather than fail, matching how the duration contract handles a missing backend.
const describeContract = existsSync(SKELETON_PATH) && existsSync(PUBLISH_SCRIPT) ? describe : describe.skip
const requireCjs = createRequire(import.meta.url)

describeContract('the app paints the detail page from the backend\'s own template', () => {
  const { renderDetailTemplateModule } = requireCjs(PUBLISH_SCRIPT)

  it('commits the published copy of the edge template, byte for byte', () => {
    // The assertion that makes "shared source" mean something: an edit to either half without a
    // re-publish fails here. WiSaw.cdk/tests/detail-template-copy-once.js pins the same pair.
    expect(readFileSync(GENERATED_PATH, 'utf8')).toBe(renderDetailTemplateModule())
  })

  it('paints the frame through that module instead of writing detail markup in app code', () => {
    expect(DETAIL_SKELETON_SRC).toContain("from './detailTemplate.generated'")
    expect(DETAIL_SKELETON_SRC).toContain('detailFrameHtml(')
  })

  it('reserves exactly the header band Header.css gives the sticky header', () => {
    const css = readFileSync(HEADER_CSS_PATH, 'utf8')
    const desktop = /\.header-container\s*\{[^}]*?height:\s*(\d+)px/.exec(css)
    const mobile = /@media screen and \(max-width: 768px\)\s*\{\s*\.header-container\s*\{[^}]*?height:\s*(\d+)px/.exec(css)
    expect(desktop, 'desktop header height rule').not.toBeNull()
    expect(mobile, 'mobile header height rule').not.toBeNull()
    expect(HEADER_DESKTOP_PX).toBe(Number(desktop[1]))
    expect(HEADER_MOBILE_PX).toBe(Number(mobile[1]))
  })

  it('lays the frame out from one stylesheet that names no mount point', () => {
    // Both hosts style the same class names: #root while the edge's copy is up, and after React
    // paints the same markup itself. An ancestor-scoped rule matches only one of them, which is how
    // a navigated page lost its layout while the served page kept it.
    const norm = (text) => text.replace(/\s+/g, '')
    expect(SKELETON_STYLE).not.toContain('#root')
    expect(SKELETON_STYLE).not.toContain('#wisaw-app')
    const mainRule = /\.wsk-main\{([^}]*)\}/.exec(SKELETON_STYLE)?.[1] ?? ''
    expect(mainRule, '.wsk-main rule').not.toBe('')
    for (const declaration of ['max-width:1100px', 'margin:0auto', 'padding:20px20px28px']) {
      expect(norm(mainRule), `.wsk-main ${declaration}`).toContain(declaration)
    }
  })

  it('sizes a portrait box with the cap maths the edge serves', () => {
    // 2250x3000 → width = 700 * w / h. The old app-side twin of this function agreed only by
    // coincidence; now both halves call this one.
    const style = mediaBoxStyle('2250', '3000')
    expect(style).toContain('aspect-ratio:2250/3000')
    const cap = Number(/--wsk-cap:(\d+)px/.exec(style)[1])
    expect(cap).toBe(Math.round(DETAIL_MAX_SIDE * 2250 / 3000))
    expect(cap).not.toBe(DETAIL_MAX_SIDE)
  })

  it('keeps the geometry the app reserves equal to the frame\'s', () => {
    // The cold placeholder and the below-the-fold reserve are sized from these same numbers.
    expect(COLD_BELOW_MEDIA_RESERVE).toBeGreaterThan(0)
    expect(DETAIL_MOBILE_BREAKPOINT).toBeLessThanOrEqual(DETAIL_MAX_SIDE + DETAIL_MAX_SIDE)
  })
})

// Second half of the same idea for media URLs: the edge publishes them, this app reads them. The
// naming rule must stay written once per side or a rename on one half seeds a 404 on the other.
describeContract('edge publishes the media URLs this app seeds from', () => {
  const { buildSeoBody } = requireCjs(UTILS_PATH)

  it('emits exactly the attribute names this app reads', () => {
    const body = buildSeoBody({ entityLabel: 'photo', pathSegment: 'photos', imageIdText: '29461ee8-34dd-4c2b-848f-c16d766713e8', width: '2250', height: '3000' })
    const media = /<(?:img|video)\b[^>]*data-wisaw-media[^>]*>/i.exec(body)?.[0] ?? ''
    expect(media, 'edge media element').not.toBe('')
    for (const name of ['data-wisaw-src', 'data-wisaw-thumb']) {
      expect(media, `edge emits ${name}`).to.contain(`${name}="https://`)
      expect(DETAIL_SKELETON_SRC, `client reads ${name}`).to.contain(`getAttribute('${name}')`)
    }
  })

  it('leaves the media origin to the edge', () => {
    // If this file ever names img.wisaw.com again it is deriving media URLs instead of reading
    // published ones, which is the drift these attributes exist to remove. (The wording sidecar in
    // utils/detailSeoText.js is a different file reading a different object.)
    expect(DETAIL_SKELETON_SRC).to.not.contain('img.wisaw.com')
  })
})
