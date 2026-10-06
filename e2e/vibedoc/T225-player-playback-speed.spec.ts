// T225: the run player's speed control on Test review, on the VibeDoc dev server (VIBEDOC_URL, default :3000).
// Reads only: it watches T224's recorded run (any task with a run works); the speed cookie is this test's own.
import { test, expect } from './kit/testing/playwright-fixture'

const BASE = process.env.VIBEDOC_URL ?? 'http://localhost:3000'
test.use({ baseURL: BASE, vibedocTask: 'T225' })

test('T225 Player playback speed, remembered per browser', async ({ page, step }) => {
  const speed = page.getByRole('combobox', { name: 'Playback speed' })
  const video = page.getByLabel(/^Recording of the/)

  await step('Open Test review → All → a task with a recorded run → the player shows a "Playback speed" control set to 1×', async () => {
    await page.goto('/manual-tests?tab=all&task=T224&view=review')
    await expect(speed).toHaveValue('1')
    await expect(video).toHaveJSProperty('playbackRate', 1)
  })

  await step('Pick 0.5× → the video plays at half speed', async () => {
    await speed.selectOption('0.5')
    await expect(video).toHaveJSProperty('playbackRate', 0.5)
  })

  await step('Reload the page → the control still reads 0.5× and the video plays at half speed', async () => {
    await page.reload()
    await expect(speed).toHaveValue('0.5')
    await expect(video).toHaveJSProperty('playbackRate', 0.5)
  })
})
