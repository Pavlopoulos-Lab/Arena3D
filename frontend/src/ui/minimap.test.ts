import { describe, it, expect } from 'vitest'
import { computeFit, project, unproject } from './minimap'

describe('minimap projection', () => {
  it('centers a symmetric bbox at the canvas middle', () => {
    const fit = computeFit([
      { x: -10, y: -10 },
      { x: 10, y: 10 },
    ])
    expect(fit.cx).toBe(0)
    expect(fit.cy).toBe(0)
    const c = project(0, 0, fit)
    expect(c.x).toBeCloseTo(100) // W/2
    expect(c.y).toBeCloseTo(75) // H/2
  })

  it('flips Y (world up -> canvas up)', () => {
    const fit = computeFit([
      { x: -10, y: -10 },
      { x: 10, y: 10 },
    ])
    const top = project(0, 10, fit)
    const bottom = project(0, -10, fit)
    expect(top.y).toBeLessThan(bottom.y)
  })

  it('project/unproject round-trip', () => {
    const fit = computeFit([
      { x: -5, y: -3 },
      { x: 7, y: 9 },
    ])
    const p = project(2, 4, fit)
    const back = unproject(p.x, p.y, fit)
    expect(back.x).toBeCloseTo(2)
    expect(back.y).toBeCloseTo(4)
  })

  it('degenerate input does not divide by zero', () => {
    const fit = computeFit([{ x: 5, y: 5 }])
    expect(Number.isFinite(fit.scale)).toBe(true)
    const p = project(5, 5, fit)
    expect(Number.isFinite(p.x)).toBe(true)
    expect(Number.isFinite(p.y)).toBe(true)
  })
})
