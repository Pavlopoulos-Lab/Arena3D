// Port of v2 www/js/object_actions/themes.js. The theme buttons (Phase 13
// UI) dispatch ChangeThemeCommand; its theme:changed event lands here and
// applyTheme does the concrete recolour. Channel palettes come from
// /api/config (v2 CHANNEL_COLORS_LIGHT/DARK).

import { bus } from '../bus'
import { store } from '../store'
import { ctx } from '../three'
import { assignChannelColorsFromPalette, redrawIntraLayerEdges } from './edge'
import { repaintLayers } from './layer'
import { setRendererColor } from './screen'

export interface Theme {
  background: string
  floor: string
  edge: string
  channelPalette: 'light' | 'dark'
  label: string
}

// v2 attachThemeButtons' three presets.
export const THEMES: Record<string, Theme> = {
  light: {
    background: '#ffffff',
    floor: '#8aa185',
    edge: '#5c5c5c',
    channelPalette: 'dark',
    label: '#000000',
  },
  dark: {
    background: '#000000',
    floor: '#777777',
    edge: '#ffffff',
    channelPalette: 'light',
    label: '#ffffff',
  },
  gray: {
    background: '#999999',
    floor: '#1d4991',
    edge: '#6e2a5a',
    channelPalette: 'light',
    label: '#ffffff',
  },
}

export function applyTheme(name: string, fromInit = false): void {
  const theme = THEMES[name]
  if (!theme || !ctx.scene?.exists()) return

  setRendererColor(theme.background)
  ctx.edgeDefaultColor = theme.edge
  ctx.labelColor = theme.label

  const config = store.get().config
  const palette =
    theme.channelPalette === 'dark'
      ? config?.channel_colors_dark
      : config?.channel_colors_light
  if (palette) assignChannelColorsFromPalette(palette)

  if (!fromInit) {
    // v2 repaintLayersFromPicker: switch layers to picker priority with the
    // theme's floor color
    ctx.layerColorPrioritySource = 'picker'
    repaintLayers(theme.floor)
    redrawIntraLayerEdges()
    ctx.renderInterLayerEdgesFlag = true
    // v2 also rebuilt the channel edit list + label colors — Phase 13 UI /
    // labels.ts react to the same theme:changed event
  }
}

// Called once from main.ts.
export function registerThemeListener(): void {
  bus.on('theme:changed', ({ theme }) => applyTheme(theme))
}
