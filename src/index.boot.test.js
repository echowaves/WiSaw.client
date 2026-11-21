/**
 * Boot-sequence pin for src/index.js.
 *
 * The seam tests replicate the boot steps by hand; nothing used to execute the real entry module,
 * so deleting captureDetailSkeleton() or mounting back into #root would ship green. This file
 * imports index.js under jsdom with ReactDOM stubbed (App never renders — the fake root records
 * the container and drops the element) and pins the branches that matter:
 *   1. skeleton on a detail route -> captured, #root left byte-intact, app mounts into #wisaw-app;
 *   2. no skeleton but a first frame in #root -> the frame is marked for handoff, not cleared: it is
 *      what the visitor is looking at, and AppShell removes it once the route has committed (the
 *      removal itself is pinned against the real shell in src/a11yLandmarks.test.js);
 *   3. an empty mount point -> left unmarked, so the Suspense fallback still owns that case;
 *   4. no mount point at all -> boot survives and still finds/creates the app container.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const renderSpy = vi.hoisted(() => vi.fn())
const createRootSpy = vi.hoisted(() => vi.fn(() => ({ render: renderSpy })))

vi.mock('react-dom/client', () => ({ default: { createRoot: createRootSpy }, createRoot: createRootSpy }))
vi.mock('./consts', () => ({ gqlClient: { query: vi.fn() } }))
vi.mock('react-ga4', () => ({ default: { initialize: vi.fn(), send: vi.fn() } }))

// The attribute index.js stamps and AppShell clears are one contract; pin it from the same export.
const { STATIC_FRAME_ATTRIBUTE } = await import('./App')

const PHOTO_ID = '29461ee8-34dd-4c2b-848f-c16d766713e8'
const THUMB = `https://img.wisaw.com/${PHOTO_ID}-thumb.webp`

// index.js runs its top-level code once per module instance; resetModules gives each case a
// fresh entry module and a fresh utils/detailSkeleton singleton to assert against.
async function boot () {
  vi.resetModules()
  await import('./index.js')
  return import('./utils/detailSkeleton')
}

describe('index.js boot sequence', () => {
  beforeEach(() => {
    createRootSpy.mockClear()
    renderSpy.mockClear()
  })

  afterEach(() => {
    document.body.innerHTML = ''
    window.history.pushState({}, '', '/')
  })

  it('captures the edge skeleton, leaves #root intact and mounts beside it', async () => {
    document.body.innerHTML = `
      <div id="root">
        <div class="wsk">
          <div data-wisaw-slot="header"></div>
          <main class="wsk-main">
            <div class="wsk-box" style="position:relative">
              <img data-wisaw-media data-wisaw-id="${PHOTO_ID}" src="${THUMB}" width="2250" height="3000" alt="" />
            </div>
            <div data-wisaw-slot="below"></div>
          </main>
          <div data-wisaw-slot="footer"></div>
        </div>
      </div>
      <div id="wisaw-app"></div>
    `
    window.history.pushState({}, '', `/photos/${PHOTO_ID}`)
    const paintedMarkup = document.getElementById('root').innerHTML

    const detailSkeleton = await boot()

    expect(detailSkeleton.getDetailSkeleton()).not.toBeNull()
    // Capture's only sanctioned additions are the empty out-of-flow nav anchor and the column's
    // positioning rule (see detailSkeleton.js). Undoing exactly those two, every painted node,
    // attribute and byte of the static frame must survive — anything else React touched fails here.
    const root = document.getElementById('root')
    const navAnchor = root.querySelector('[data-wisaw-nav]')
    expect(navAnchor).not.toBeNull()
    navAnchor.remove()
    const column = root.querySelector('.wsk-main')
    expect(column.style.position).toBe('relative')
    column.removeAttribute('style')
    expect(root.innerHTML).toBe(paintedMarkup)
    expect(createRootSpy).toHaveBeenCalledWith(document.getElementById('wisaw-app'))
    expect(renderSpy).toHaveBeenCalled()
  })

  it('hands the static first frame back to App when no skeleton is served', async () => {
    document.body.innerHTML = `
      <div id="root">
        <header id="header"><span class="header-container">WiSaw</span></header>
        <main class="ff-page"><h1>Unaltered Photos and Videos, Taken with Phone Cameras.</h1></main>
      </div>
      <div id="wisaw-app"></div>
    `
    window.history.pushState({}, '', '/')

    const detailSkeleton = await boot()

    expect(detailSkeleton.getDetailSkeleton()).toBeNull()
    const root = document.getElementById('root')
    // The frame is stamped rather than emptied: it already looks like the app, and clearing it here
    // is exactly the blank / "Loading..." interlude this replaces. AppShell removes it in the commit
    // where Header and route content land.
    expect(root.hasAttribute(STATIC_FRAME_ATTRIBUTE)).toBe(true)
    expect(root.querySelector('.ff-page h1')).not.toBeNull()
    expect(createRootSpy).toHaveBeenCalledWith(document.getElementById('wisaw-app'))
  })

  it('hands the frame back on a detail route the edge did not paint', async () => {
    // Old edge cache: #root holds the template's own frame instead of an adoptable skeleton, so
    // nothing can be captured. The frame still has to go - once React has something better to show.
    document.body.innerHTML = `
      <div id="root"><main class="ff-page"><h1>Unaltered Photos and Videos, Taken with Phone Cameras.</h1></main></div>
      <div id="wisaw-app"></div>
    `
    window.history.pushState({}, '', `/photos/${PHOTO_ID}`)

    const detailSkeleton = await boot()

    expect(detailSkeleton.getDetailSkeleton()).toBeNull()
    expect(document.getElementById('root').hasAttribute(STATIC_FRAME_ATTRIBUTE)).toBe(true)
    expect(createRootSpy).toHaveBeenCalledWith(document.getElementById('wisaw-app'))
  })

  it('leaves an empty mount point unmarked so the loading fallback keeps that case', async () => {
    // Nothing to hand back: adopting here would leave a transparent shell over an empty page.
    document.body.innerHTML = '<div id="root"></div><div id="wisaw-app"></div>'
    window.history.pushState({}, '', '/')

    const detailSkeleton = await boot()

    expect(detailSkeleton.getDetailSkeleton()).toBeNull()
    expect(document.getElementById('root').hasAttribute(STATIC_FRAME_ATTRIBUTE)).toBe(false)
    expect(createRootSpy).toHaveBeenCalledWith(document.getElementById('wisaw-app'))
  })

  it('still boots when the served page has no mount point at all', async () => {
    document.body.innerHTML = '<p>a page without a mount point</p>'
    window.history.pushState({}, '', '/')

    const detailSkeleton = await boot()

    expect(detailSkeleton.getDetailSkeleton()).toBeNull()
    expect(createRootSpy).toHaveBeenCalledTimes(1)
    const container = createRootSpy.mock.calls[0][0]
    expect(container.id).toBe('wisaw-app')
    expect(document.body.contains(container)).toBe(true)
  })
})
