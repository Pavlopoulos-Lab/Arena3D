// FPS panel — port of v2 views/fps.R. Sets ctx.fps, which the render loop
// (screen.ts animate) reads each frame. Default checked = current ctx.fps.

import { ctx } from '../three'

const FPS_HTML = `
<div class="col-md-4 col-lg-3">
  <label class="form-label">FPS:</label>
  ${[15, 30, 60]
    .map(
      (f) => `
  <div class="form-check">
    <input class="form-check-input" type="radio" name="fps" id="fps_${f}" value="${f}" ${f === ctx.fps ? 'checked' : ''} />
    <label class="form-check-label" for="fps_${f}">${f}FPS</label>
  </div>`
    )
    .join('')}
</div>
`

export function initFpsPanel(): void {
  const pane = document.getElementById('panel-fps')
  if (!pane) return
  pane.innerHTML = FPS_HTML
  for (const radio of document.querySelectorAll<HTMLInputElement>('input[name="fps"]')) {
    radio.addEventListener('change', () => {
      ctx.fps = Number(radio.value) || 30
    })
  }
}
