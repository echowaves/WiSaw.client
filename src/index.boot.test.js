/**
 * Boot-sequence pin for src/index.js.
 *
 * The seam tests replicate the boot steps by hand; nothing used to execute the real entry module,
 * so deleting captureDetailSkeleton() or mounting back into #root would ship green. This file
 * imports index.js under jsdom with ReactDOM stubbed (App never renders — the fake root records
 * the container and drops the element) and pins the three branches that matter:
 *   1. skeleton on a detail route -> captured, #root left byte-intact, app mounts into #wisaw-app;
 *   2. no skeleton -> #root's static fallback cleared (it would duplicate the React page);
 *   3. no mount point at all -> boot survives and still finds/creates the app container.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const renderSpy = vi.hoisted(() => vi.fn())
const createRootSpy = vi.hoisted(() => vi.fn(() => ({ render: renderSpy })))

vi.mock('react-dom/client', () => ({ default: { createRoot: createRootSpy }, createRoot: createRootSpy }))
vi.mock('./consts', () => ({ gqlClient: { query: vi.fn() } }))
vi.mock('react-ga4', () => ({ default: { initialize: vi.fn(), send: vi.fn() } }))

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
        <div data-wisaw-slot="header"></div>
        <div class="wsk-box" style="position:relative">
          <img data-wisaw-media data-wisaw-id="${PHOTO_ID}" src="${THUMB}" width="2250" height="3000" alt="" />
        </div>
        <div data-wisaw-slot="below"></div>
      </div>
      <div id="wisaw-app"></div>
    `
    window.history.pushState({}, '', `/photos/${PHOTO_ID}`)
    const paintedMarkup = document.getElementById('root').innerHTML

    const detailSkeleton = await boot()

    expect(detailSkeleton.getDetailSkeleton()).not.toBeNull()
    expect(document.getElementById('root').innerHTML).toBe(paintedMarkup)
    expect(createRootSpy).toHaveBeenCalledWith(document.getElementById('wisaw-app'))
    expect(renderSpy).toHaveBeenCalled()
  })

  it('clears the static fallback and boots client-side when no skeleton is served', async () => {
    document.body.innerHTML = `
      <div id="root"><h1>Unaltered Photos and Videos, Taken with Phone Cameras.</h1></div>
      <div id="wisaw-app"></div>
    `
    window.history.pushState({}, '', `/photos/${PHOTO_ID}`)

    const detailSkeleton = await boot()

    expect(detailSkeleton.getDetailSkeleton()).toBeNull()
    expect(document.getElementById('root')).toBeEmptyDOMElement()
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
