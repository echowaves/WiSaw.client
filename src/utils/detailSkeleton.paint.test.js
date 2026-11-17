import { afterEach, beforeEach, describe, expect, it } from 'vitest'

import { detailFrameHtml } from './detailTemplate.generated'
import { __resetDetailSkeletonForTests, clearDetailSkeleton, getActiveDetailFrame, paintClientDetailFrame } from './detailSkeleton'

// The client half of the shared-template claim: what this app paints into #root is exactly what
// Lambda@Edge serves for the same record, and the nodes the enhancement layer portals into come back
// the same way capture returns them.

const ID = '29461ee8-34dd-4c2b-848f-c16d766713e8'
const OTHER_ID = '4d2f6a18-9c3b-4e7a-8f52-1b6d0c9e3a71'

const partsFor = (id, extra = {}) => ({
  entityLabel: 'photo',
  mediaId: id,
  imageUrl: `https://img.wisaw.com/${id}.webp`,
  previewUrl: `https://img.wisaw.com/${id}-thumb.webp`,
  videoUrl: '',
  altText: 'A heron at dawn',
  width: '2250',
  height: '3000',
  title: 'Heron at dawn — photo · WiSaw',
  description: 'A heron standing in shallow water at sunrise.',
  labels: ['Heron', 'Wetland'],
  ...extra
})

const mountHosts = () => {
  document.body.innerHTML = "<div id='root'></div><div id='wisaw-app'></div>"
}

describe('client-side paint of the shared detail template', () => {
  beforeEach(() => {
    __resetDetailSkeletonForTests()
    mountHosts()
  })

  afterEach(() => {
    document.body.innerHTML = ''
  })

  it('paints exactly the frame the edge would serve for the same record', () => {
    const parts = partsFor(ID)
    const frame = paintClientDetailFrame(parts)

    expect(frame).not.toBeNull()
    expect(frame.source).toBe('client')

    // Same markup as the shared template builds (compared through one serializer on each side, so a
    // difference is structure, not quoting), and only its stylesheet kept out of #root — that goes
    // into <head> once, rather than being re-inserted per navigation.
    const expected = document.createElement('div')
    expected.innerHTML = detailFrameHtml({ ...parts, withStyle: false })
    const painted = document.getElementById('root')
    // The enhancement anchors this module adds are not part of the template's own output.
    painted.querySelector('[data-wisaw-nav]').remove()
    painted.querySelector('.wsk-main').removeAttribute('style')
    expect(painted.innerHTML).toBe(expected.innerHTML)
  })

  it('hands back every node the enhancement layer portals into', () => {
    const frame = paintClientDetailFrame(partsFor(ID))

    expect(frame.mediaNode.hasAttribute('data-wisaw-media')).toBe(true)
    expect(frame.mediaBox.contains(frame.mediaNode)).toBe(true)
    expect(frame.headerSlot.getAttribute('data-wisaw-slot')).toBe('header')
    expect(frame.belowSlot.getAttribute('data-wisaw-slot')).toBe('below')
    // Nav anchors to the column, ahead of the media box, so prev/next land where they always did.
    expect(frame.navContainer.parentElement).toBe(frame.mediaBox.parentElement)
    expect(frame.mediaBox.parentElement.style.position).toBe('relative')
    expect(getActiveDetailFrame()).toBe(frame)
  })

  it('installs the frame stylesheet once, however many photos are painted', () => {
    paintClientDetailFrame(partsFor(ID))
    const first = document.getElementById('wisaw-frame-style')
    paintClientDetailFrame(partsFor(OTHER_ID))

    expect(document.querySelectorAll('#wisaw-frame-style')).toHaveLength(1)
    expect(document.getElementById('wisaw-frame-style')).toBe(first)
  })

  it('replaces the previous photo in one step when the id changes', () => {
    const first = paintClientDetailFrame(partsFor(ID))
    const second = paintClientDetailFrame(partsFor(OTHER_ID))

    expect(second.mediaNode).not.toBe(first.mediaNode)
    expect(document.contains(first.mediaNode)).toBe(false)
    expect(getActiveDetailFrame().photoId).toBe(OTHER_ID)
    expect(document.querySelectorAll('#root .wsk')).toHaveLength(1)
  })

  it('keeps the painted media node when only the wording arrived for the same photo', () => {
    const frame = paintClientDetailFrame(partsFor(ID, { description: '', labels: [], altText: '' }))
    const mediaNode = frame.mediaNode
    const h1 = document.querySelector('#root .wsk-main h1')

    const again = paintClientDetailFrame(partsFor(ID))

    // Same node: re-decoding the picture would blink, and a playing video would restart.
    expect(again).toBe(frame)
    expect(document.querySelector('#root [data-wisaw-media]')).toBe(mediaNode)
    expect(document.querySelector('#root .wsk-main h1')).not.toBe(h1)
    expect(document.querySelector('#root .wsk-main p').textContent).toContain('shallow water')
    expect(document.querySelectorAll("#root .wsk-main a[rel='tag']")).toHaveLength(2)
    expect(mediaNode.getAttribute('alt')).toBe('A heron at dawn')
  })

  it('leaves the below slot and its portalled content alone during a wording refresh', () => {
    const frame = paintClientDetailFrame(partsFor(ID))
    const marker = document.createElement('div')
    marker.id = 'portalled'
    frame.belowSlot.appendChild(marker)

    paintClientDetailFrame(partsFor(ID, { description: 'Reworded.' }))

    expect(frame.belowSlot.querySelector('#portalled')).toBe(marker)
  })

  it('hands #root back for either producer', () => {
    paintClientDetailFrame(partsFor(ID))
    clearDetailSkeleton()

    expect(document.getElementById('root').innerHTML).toBe('')
    expect(getActiveDetailFrame()).toBeNull()
    expect(() => clearDetailSkeleton()).not.toThrow()
  })

  it('declines to paint without a host or an id', () => {
    document.body.innerHTML = "<div id='wisaw-app'></div>"
    expect(paintClientDetailFrame(partsFor(ID))).toBeNull()
    mountHosts()
    expect(paintClientDetailFrame({ ...partsFor(ID), mediaId: '' })).toBeNull()
  })

  it('paints a video frame with the player, not an image', () => {
    const frame = paintClientDetailFrame(partsFor(ID, { entityLabel: 'video', videoUrl: `https://img.wisaw.com/${ID}.mp4` }))

    expect(frame.kind).toBe('videos')
    expect(frame.mediaNode.tagName).toBe('VIDEO')
    expect(frame.mediaNode.getAttribute('src')).toBe(`https://img.wisaw.com/${ID}.mp4`)
    expect(frame.mediaNode.getAttribute('poster')).toBe(`https://img.wisaw.com/${ID}-thumb.webp`)
  })
})
