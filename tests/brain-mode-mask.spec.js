// @ts-check
import { test, expect } from '@playwright/test'

test.describe('Brain Mode - 6dock mask before/after', () => {
  const containerSelector = '[data-testid="brain-heatmap-container"]'

  test('capture before (mask off) and after (mask on) screenshots', async ({ page }) => {
    // Before: mask disabled (use search param before hash so App.vue matches #training)
    await page.goto('/?sixDockMask=0#training')
    const container = page.locator(containerSelector)
    await expect(container).toBeVisible({ timeout: 15000 })
    // 等待渲染稳定
    await page.waitForTimeout(1500)
    await container.screenshot({ path: 'test_screenshots/brain-mask-before.png' })

    // After: mask enabled
    await page.goto('/?sixDockMask=1#training')
    await expect(container).toBeVisible({ timeout: 15000 })
    await page.waitForTimeout(1500)
    await container.screenshot({ path: 'test_screenshots/brain-mask-after.png' })
  })
})
