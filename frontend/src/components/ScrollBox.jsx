/**
 * Scrollable container with custom (non-native) vertical/horizontal
 * scrollbar thumbs, used to wrap tables and lists so their scrollbars match
 * the app's styling instead of the browser default.
 */
import { useEffect, useRef, useState } from 'react'

export default function ScrollBox({ maxHeight, wrapClassName = '', children }) {
  const containerRef = useRef(null)
  const [vThumb, setVThumb] = useState({ height: 0, top: 0, visible: false })
  const [hThumb, setHThumb] = useState({ width: 0, left: 0, visible: false })

  /**
   * - Recomputes custom scrollbar thumb size/position from the real
   *   scroll/client dimensions of the inner container.
   *   - height/width are floored at 24px so a small thumb stays clickable.
   *   - Marks a thumb not visible when content doesn't overflow that axis.
   */
  function updateThumbs() {
    const el = containerRef.current
    if (!el) return
    const { scrollHeight, clientHeight, scrollTop, scrollWidth, clientWidth, scrollLeft } = el

    if (scrollHeight <= clientHeight) {
      setVThumb({ height: 0, top: 0, visible: false })
    } else {
      const thumbHeight = Math.max((clientHeight / scrollHeight) * clientHeight, 24)
      const maxTop = clientHeight - thumbHeight
      const maxScroll = scrollHeight - clientHeight
      const top = maxScroll > 0 ? (scrollTop / maxScroll) * maxTop : 0
      setVThumb({ height: thumbHeight, top, visible: true })
    }

    if (scrollWidth <= clientWidth) {
      setHThumb({ width: 0, left: 0, visible: false })
    } else {
      const thumbWidth = Math.max((clientWidth / scrollWidth) * clientWidth, 24)
      const maxLeft = clientWidth - thumbWidth
      const maxScroll = scrollWidth - clientWidth
      const left = maxScroll > 0 ? (scrollLeft / maxScroll) * maxLeft : 0
      setHThumb({ width: thumbWidth, left, visible: true })
    }
  }

  // Re-measure whenever the scrolled content changes (e.g. table rows load in).
  useEffect(() => {
    updateThumbs()
  }, [children])

  // Re-measure on container resize (e.g. window resize, layout shifts).
  useEffect(() => {
    const el = containerRef.current
    if (!el || typeof ResizeObserver === 'undefined') return
    const observer = new ResizeObserver(updateThumbs)
    observer.observe(el)
    return () => observer.disconnect()
  }, [])

  return (
    <div className={`scroll-box-wrap ${wrapClassName}`}>
      <div
        className="scroll-box"
        style={{ maxHeight }}
        ref={containerRef}
        onScroll={updateThumbs}
      >
        {children}
      </div>
      {vThumb.visible && (
        <div className="scroll-box-track scroll-box-track-v">
          <div
            className="scroll-box-thumb scroll-box-thumb-v"
            style={{ height: vThumb.height, top: vThumb.top }}
          />
        </div>
      )}
      {hThumb.visible && (
        <div className="scroll-box-track scroll-box-track-h">
          <div
            className="scroll-box-thumb scroll-box-thumb-h"
            style={{ width: hThumb.width, left: hThumb.left }}
          />
        </div>
      )}
    </div>
  )
}
