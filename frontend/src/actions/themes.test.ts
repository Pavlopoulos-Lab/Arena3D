import { beforeEach, describe, expect, it } from 'vitest'
import type { AppConfig } from '../api/config'
import { history } from '../commands/base'
import { ChangeThemeCommand } from '../commands/scene'
import { store } from '../store'
import { ctx, Layer, resetContext, Scene } from '../three'
import { applyTheme, registerThemeListener, THEMES } from './themes'

beforeEach(() => {
  resetContext()
  ctx.scene = new Scene()
  ctx.layers = [new Layer({ id: 0, name: 'L1' })]
  ctx.channelColors = { ch1: '#000001', ch2: '#000002' }
  store.update({
    currentTheme: 'dark',
    config: {
      channel_colors_light: ['#l1', '#l2'],
      channel_colors_dark: ['#d1', '#d2'],
    } as unknown as AppConfig,
  })
})

describe('applyTheme', () => {
  it('recolours edges/labels/channels and repaints layers with the floor color', () => {
    applyTheme('light')
    expect(ctx.edgeDefaultColor).toBe(THEMES.light.edge)
    expect(ctx.labelColor).toBe('#000000')
    expect(ctx.channelColors).toEqual({ ch1: '#d1', ch2: '#d2' })
    expect(ctx.layerColorPrioritySource).toBe('picker')
    expect(ctx.layers[0].color).toBe(THEMES.light.floor)
    expect(ctx.renderInterLayerEdgesFlag).toBe(true)
  })

  it('fromInit applies colors but skips the repaint pass', () => {
    applyTheme('dark', true)
    expect(ctx.edgeDefaultColor).toBe('#ffffff')
    expect(ctx.channelColors).toEqual({ ch1: '#l1', ch2: '#l2' })
    expect(ctx.layerColorPrioritySource).toBe('default')
    expect(ctx.renderInterLayerEdgesFlag).toBe(false)
  })

  it('unknown theme is a no-op', () => {
    applyTheme('neon')
    expect(ctx.channelColors).toEqual({ ch1: '#000001', ch2: '#000002' })
  })
})

describe('theme:changed wiring', () => {
  it('ChangeThemeCommand execute/undo re-applies themes through the bus', () => {
    registerThemeListener()
    history.execute(
      new ChangeThemeCommand(
        'light',
        () => store.get().currentTheme,
        (t) => store.update({ currentTheme: t })
      )
    )
    expect(store.get().currentTheme).toBe('light')
    expect(ctx.labelColor).toBe('#000000')

    history.undo()
    expect(store.get().currentTheme).toBe('dark')
    expect(ctx.labelColor).toBe('#ffffff')
  })
})
