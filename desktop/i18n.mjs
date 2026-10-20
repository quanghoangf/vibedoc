// The desktop app's own text (R111), outside Next so not through useT(): en + vi, picked from the OS locale.
export const messages = {
  en: {
    using: 'Using VibeDoc at {url}',
    owned: 'VibeDoc at {url} · started by this app',
    notRunning: 'VibeDoc isn’t running',
    startingTitle: 'Starting VibeDoc…',
    startingBody: 'Nothing was running, so the app starts VibeDoc. The board opens as soon as it answers.',
    failedTitle: 'VibeDoc couldn’t start',
    failedLog: 'Full output: {path}',
    stopped: 'VibeDoc stopped (exit code {code}).',
    retry: 'Try again',
  },
  vi: {
    using: 'Đang dùng VibeDoc tại {url}',
    owned: 'VibeDoc tại {url} · do app này khởi động',
    notRunning: 'VibeDoc chưa chạy',
    startingTitle: 'Đang khởi động VibeDoc…',
    startingBody: 'Chưa có VibeDoc nào chạy, nên app tự khởi động nó. Board sẽ mở ngay khi VibeDoc trả lời.',
    failedTitle: 'Không khởi động được VibeDoc',
    failedLog: 'Toàn bộ output: {path}',
    stopped: 'VibeDoc đã dừng (mã thoát {code}).',
    retry: 'Thử lại',
  },
}

/** `vi` for a Vietnamese OS locale (`vi`, `vi-VN`), else `en`. */
export const pickLang = (locale) => (/^vi\b/i.test(locale || '') ? 'vi' : 'en')

/** The text for `key` in `lang` with `{name}` placeholders filled. */
export const t = (lang, key, vars = {}) =>
  (messages[lang]?.[key] ?? messages.en[key]).replace(/\{(\w+)\}/g, (_, k) => vars[k] ?? `{${k}}`)
