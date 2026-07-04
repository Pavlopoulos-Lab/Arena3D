// Entry point — port of v2 www/js/on_page_load.js.
// Fetches config, sets up the Three.js renderer/camera/scene, mounts the
// canvas, wires global listeners and starts the render loop.

import 'bootstrap/dist/css/bootstrap.min.css'
import 'bootstrap' // data-bs-* tab + collapse behavior for the navbar
import './style.css'

import { fetchConfig } from './api/config'
import { initHomePanel } from './ui/home'
import { initFilePanel } from './ui/file'
import { initLayoutsPanel } from './ui/layouts'
import { initScenePanel } from './ui/scene'
import { initLayerPanel } from './ui/layer'
import { initNodePanel } from './ui/node'
import { initEdgePanel } from './ui/edge'
import { initFpsPanel } from './ui/fps'
import { initDataPanel } from './ui/data'
import { initHelpPanel } from './ui/help'
import { registerDrawerToggle } from './ui/drawer_toggle'
import { store } from './store'
import { ctx, Scene } from './three'
import { history } from './commands/base'
import { registerCanvasControls } from './actions/canvas_controls'
import { executeCommand } from './actions/right_click_menu'
import { registerLayerDragControls } from './actions/drag_controls'
import { registerLabelRendering } from './actions/labels'
import { registerNavControls } from './actions/nav_controls'
import { setRenderer, resetScreen, animate } from './actions/screen'
import { registerThemeListener } from './actions/themes'
import { registerGlobalListeners } from './event_listeners'

async function main(): Promise<void> {
  const config = await fetchConfig().catch((err: unknown) => {
    console.error('[arena3d] config fetch failed', err)
    return null
  })
  if (config) {
    store.update({ config })
    ctx.edgeDefaultColor = config.edge_default_color
  }

  setRenderer()
  resetScreen()

  ctx.scene = new Scene()
  ctx.scene.tiltDefault()
  ctx.scene.setScale(0.9)

  const app = document.getElementById('app')
  if (app && ctx.renderer) {
    ctx.renderer.setClearColor('#000000') // dark default until a theme is applied
    ctx.renderer.domElement.style.display = 'block'
    app.appendChild(ctx.renderer.domElement)
  }

  initHomePanel()
  initFilePanel()
  initLayoutsPanel()
  initScenePanel()
  initLayerPanel()
  initNodePanel()
  initEdgePanel()
  initFpsPanel()
  initDataPanel()
  initHelpPanel()
  registerDrawerToggle()
  registerGlobalListeners()
  registerThemeListener()
  registerLabelRendering()
  registerCanvasControls()
  registerLayerDragControls()
  registerNavControls()
  const year = document.getElementById('footer-year')
  if (year) year.textContent = String(new Date().getFullYear())
  animate()

  // Test hook: lets Playwright read scene state via page.evaluate (WebGL is
  // opaque to the a11y tree). See PLAN Phase 13.
  ;(window as unknown as { __arena: unknown }).__arena = {
    ctx,
    history,
    executeCommand,
  }
}

void main()
