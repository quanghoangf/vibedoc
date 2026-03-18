export function extractHeadings(content: string): { level: number; text: string; anchor: string }[] {
  return content
    .split('\n')
    .filter(line => /^#{1,3} /.test(line))
    .flatMap(line => {
      const match = line.match(/^(#{1,3}) (.+)/)
      if (!match) return []
      const text = match[2].trim()
      const anchor = text.toLowerCase().replace(/[^\w\s-]/g, '').replace(/\s+/g, '-')
      return [{ level: match[1].length, text, anchor }]
    })
}
