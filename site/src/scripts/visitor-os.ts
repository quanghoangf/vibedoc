// The visitor's desktop OS for the download buttons (R112 T586), from userAgentData when the browser has it, else the
// user agent. null = a phone / tablet or unknown: nothing is highlighted. Pure. Check: node site/src/scripts/visitor-os.check.mts
export type DesktopOs = 'mac' | 'windows' | 'linux'

export function visitorOs(nav: { userAgent?: string; userAgentData?: { platform?: string; mobile?: boolean } }): DesktopOs | null {
  const ua = nav.userAgent ?? ''
  if (nav.userAgentData?.mobile || /Android|iPhone|iPad|iPod|Mobile/i.test(ua)) return null
  const p = `${nav.userAgentData?.platform ?? ''} ${ua}`
  if (/mac/i.test(p)) return 'mac'
  if (/win/i.test(p)) return 'windows'
  if (/linux|x11|cros/i.test(p)) return 'linux'
  return null
}
