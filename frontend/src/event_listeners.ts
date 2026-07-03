// Global event listeners. Port of v2 www/js/event_listeners.js (window-level
// bits) plus new Ctrl+Z / Ctrl+Shift+Z undo/redo.
//
// ponytail: the canvas mouse/keyboard scene controls (clickDown/Drag/Up,
// sceneZoom, keyPressed, right-click menu) live in canvas_controls — deferred
// until that action lands. Only the window-level listeners are wired here.

import { history } from './commands/base'
import { resetScreen } from './actions/screen'

export function registerGlobalListeners(): void {
  window.addEventListener('resize', resetScreen)
  window.addEventListener('keydown', handleUndoRedo)
}

function handleUndoRedo(e: KeyboardEvent): void {
  if (!(e.ctrlKey || e.metaKey)) return
  const key = e.key.toLowerCase()
  if (key === 'z' && !e.shiftKey) {
    e.preventDefault()
    history.undo()
  } else if ((key === 'z' && e.shiftKey) || key === 'y') {
    e.preventDefault()
    history.redo()
  }
}
