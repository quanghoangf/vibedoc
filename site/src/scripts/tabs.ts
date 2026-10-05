// ARIA tabs for every [data-tabs] box: click or ←/→/Home/End select a tab and show its panel (aria-controls).
// Without JavaScript the first panel shows.
export function setupTabs(root: ParentNode = document) {
  for (const box of root.querySelectorAll<HTMLElement>('[data-tabs]')) {
    // every component that has tabs calls this; wire each box once
    if (box.dataset.tabsReady) continue
    box.dataset.tabsReady = '1'
    const tabs = [...box.querySelectorAll<HTMLButtonElement>('[role="tab"]')]
    const select = (tab: HTMLButtonElement, focus = false) => {
      for (const t of tabs) {
        const on = t === tab
        const wasOn = t.getAttribute('aria-selected') === 'true'
        t.setAttribute('aria-selected', String(on))
        t.tabIndex = on ? 0 : -1
        const panel = document.getElementById(t.getAttribute('aria-controls') ?? '')
        if (!panel) continue
        panel.hidden = !on
        // The new panel settles in (a short fade with reduced motion), so the switch reads as one change
        if (on && !wasOn) {
          const still = matchMedia('(prefers-reduced-motion: reduce)').matches
          panel.animate(
            still ? [{ opacity: 0 }, { opacity: 1 }] : [{ opacity: 0, transform: 'translateY(8px)', filter: 'blur(3px)' }, { opacity: 1, transform: 'none', filter: 'blur(0)' }],
            { duration: still ? 120 : 260, easing: 'cubic-bezier(0.16, 1, 0.3, 1)' },
          )
        }
      }
      if (focus) tab.focus()
    }
    tabs.forEach((tab, i) => {
      tab.addEventListener('click', () => select(tab))
      tab.addEventListener('keydown', (e) => {
        const next = e.key === 'ArrowRight' ? i + 1 : e.key === 'ArrowLeft' ? i - 1 : e.key === 'Home' ? 0 : e.key === 'End' ? tabs.length - 1 : null
        if (next === null) return
        e.preventDefault()
        select(tabs[(next + tabs.length) % tabs.length], true)
      })
    })
  }
}
