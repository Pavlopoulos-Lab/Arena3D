import { expect, test } from '@playwright/test'

// Theme bar (v2 port): buttons appear after a network loads; clicking a
// preset recolours the scene; undo restores the previous theme. The canvas
// is opaque to the DOM, so assertions read window.__arena.ctx (applyTheme
// sets ctx.edgeDefaultColor, distinct per theme).

function edgeColor() {
  return () =>
    (window as unknown as { __arena: { ctx: { edgeDefaultColor: string } } })
      .__arena.ctx.edgeDefaultColor
}

test('theme buttons attach on load and switch scene theme (undoable)', async ({
  page,
}) => {
  await page.goto('/')
  await page.waitForFunction(
    () => '__arena' in (window as unknown as Record<string, unknown>)
  )

  // No buttons before a network exists.
  await expect(page.locator('#themeDiv .themeButton')).toHaveCount(0)

  await page.getByRole('tab', { name: 'File' }).click()
  await page.getByRole('button', { name: 'Load Example' }).click()
  await expect(page.locator('#file_status')).toContainText('Loaded network')

  await expect(page.locator('#themeDiv .themeButton')).toHaveCount(3)

  // dispatchEvent, not click(): once a network loads the WebGL render loop
  // saturates the main thread on headless CI, so Playwright's actionability
  // wait (visible/stable/receives-events) times out. Firing the handler
  // directly on the element sidesteps that and the drawer-overlay hit-test.
  await page.locator('#lightThemeButton').dispatchEvent('click')
  expect(await page.evaluate(edgeColor())).toBe('#5c5c5c')
  // Regression: floor_color input is the picker-path source of truth, so a
  // theme toggle must update it — otherwise hover-exit repaint reverts layers
  // to the stale (dark) color.
  await expect(page.locator('#floor_color')).toHaveValue('#8aa185')

  await page.locator('#grayThemeButton').dispatchEvent('click')
  expect(await page.evaluate(edgeColor())).toBe('#6e2a5a')

  await page.locator('#darkThemeButton').dispatchEvent('click')
  expect(await page.evaluate(edgeColor())).toBe('#ffffff')

  // Undo walks back dark → gray.
  await page.locator('#undoButton').dispatchEvent('click')
  expect(await page.evaluate(edgeColor())).toBe('#6e2a5a')
})
