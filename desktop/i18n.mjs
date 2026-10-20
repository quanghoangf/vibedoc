// The desktop app's own text (R111), outside Next so not through useT(): en + vi, picked from the OS locale.
export const messages = {
  en: {
    using: 'Using VibeDoc at {url}',
    notRunning: 'VibeDoc isn’t running',
    notRunningTitle: 'VibeDoc isn’t running',
    notRunningBody: 'Start it in a terminal, and this window opens it as soon as it answers:',
    notRunningHint: 'Looking for VibeDoc at {url}…',
  },
  vi: {
    using: 'Đang dùng VibeDoc tại {url}',
    notRunning: 'VibeDoc chưa chạy',
    notRunningTitle: 'VibeDoc chưa chạy',
    notRunningBody: 'Hãy khởi động nó trong terminal, cửa sổ này sẽ mở VibeDoc ngay khi nó trả lời:',
    notRunningHint: 'Đang tìm VibeDoc tại {url}…',
  },
}

/** `vi` for a Vietnamese OS locale (`vi`, `vi-VN`), else `en`. */
export const pickLang = (locale) => (/^vi\b/i.test(locale || '') ? 'vi' : 'en')

/** The text for `key` in `lang` with `{name}` placeholders filled. */
export const t = (lang, key, vars = {}) =>
  (messages[lang]?.[key] ?? messages.en[key]).replace(/\{(\w+)\}/g, (_, k) => vars[k] ?? `{${k}}`)
