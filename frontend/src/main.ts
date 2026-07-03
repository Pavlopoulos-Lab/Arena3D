// Entry point — port of v2 www/js/on_page_load.js.
// Fetches config, sets up the Three.js renderer/camera/scene, mounts the
// canvas, wires global listeners and starts the render loop.

import { fetchConfig } from './api/config'
import { store } from './store'
import { ctx, Scene } from './three'
import { history } from './commands/base'
import { setRenderer, resetScreen, animate } from './actions/screen'
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

  registerGlobalListeners()
  animate()

  // Test hook: lets Playwright read scene state via page.evaluate (WebGL is
  // opaque to the a11y tree). See PLAN Phase 13.
  ;(window as unknown as { __arena: unknown }).__arena = { ctx, history }
}

void main()
