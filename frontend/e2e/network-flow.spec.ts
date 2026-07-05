import { expect, test } from '@playwright/test'

// Full flow from PLAN Phase 14: upload (example) network → apply layout →
// apply clustered layout → export session. The WebGL canvas is opaque to the
// DOM, so scene assertions read window.__arena.ctx (the Phase 12 test hook).

type NodeSnapshot = { pos: [number, number, number]; cluster: string }

function readNodes() {
  return async (): Promise<NodeSnapshot[]> => {
    const ctx = (
      window as unknown as { __arena: { ctx: { nodeObjects: unknown[] } } }
    ).__arena.ctx
    return (
      ctx.nodeObjects as {
        getPosition: (a: string) => number
        cluster: string
      }[]
    ).map((n) => ({
      pos: [n.getPosition('x'), n.getPosition('y'), n.getPosition('z')],
      cluster: n.cluster,
    }))
  }
}

test('load example → layout → clustered layout → export', async ({ page }) => {
  await page.goto('/')
  await page.waitForFunction(
    () => '__arena' in (window as unknown as Record<string, unknown>)
  )

  // --- Upload: Load Example -----------------------------------------------
  await page.getByRole('tab', { name: 'File' }).click()
  await page.getByRole('button', { name: 'Load Example' }).click()
  await expect(page.locator('#file_status')).toContainText('Loaded network')
  const nodeCount = await page.evaluate(
    () =>
      (window as unknown as { __arena: { ctx: { nodeObjects: unknown[] } } })
        .__arena.ctx.nodeObjects.length
  )
  expect(nodeCount).toBe(11)

  const before = await page.evaluate(readNodes())

  // --- Apply layout (all layers, Fruchterman-Reingold) --------------------
  // force: after load, the render loop keeps repainting DOM overlays so drawer
  // controls never settle to a "stable" box on slow CI — skip the wait.
  await page
    .getByRole('tab', { name: 'Layer Selection & Layouts' })
    .click({ force: true })
  await page.locator('#subgraph_allLayers').check({ force: true })
  await page.locator('#selectAllLayersCheckbox').check({ force: true })
  await page
    .locator('#layoutAlgorithmChoice')
    .selectOption('Fruchterman-Reingold')
  await page.locator('#runLayout').click({ force: true })
  // The #layouts_status text is identical after every run, so wait on the
  // actual scene change (a moved node) rather than the status string.
  const beforeJson = JSON.stringify(before.map((n) => n.pos))
  await page.waitForFunction(
    (prev) => {
      const ctx = (
        window as unknown as {
          __arena: {
            ctx: { nodeObjects: { getPosition: (a: string) => number }[] }
          }
        }
      ).__arena.ctx
      const now = JSON.stringify(
        ctx.nodeObjects.map((n) => [
          n.getPosition('x'),
          n.getPosition('y'),
          n.getPosition('z'),
        ])
      )
      return now !== prev
    },
    beforeJson,
    { timeout: 15_000 }
  )

  // --- Apply clustered layout (Louvain) -----------------------------------
  await page.locator('#clusteringAlgorithmChoice').selectOption('Louvain')
  await page.locator('#runLayout').click({ force: true })
  // Wait for clustering to assign ids (status text is unchanged between runs).
  await page.waitForFunction(
    () => {
      const ctx = (
        window as unknown as {
          __arena: { ctx: { nodeObjects: { cluster: string }[] } }
        }
      ).__arena.ctx
      return ctx.nodeObjects.some((n) => n.cluster !== '')
    },
    undefined,
    { timeout: 15_000 }
  )

  // --- Export session ------------------------------------------------------
  await page.getByRole('tab', { name: 'File' }).click({ force: true })
  const downloadPromise = page.waitForEvent('download')
  await page.getByRole('button', { name: 'Save Session' }).click({ force: true })
  const download = await downloadPromise
  expect(download.suggestedFilename()).toMatch(/\.json$/)
})
