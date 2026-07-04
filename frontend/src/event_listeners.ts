// Global event listeners. Port of v2 www/js/event_listeners.js (window-level
// bits) plus new Ctrl+Z / Ctrl+Shift+Z undo/redo.
//
// ponytail: the canvas mouse/keyboard scene controls (clickDown/Drag/Up,
// sceneZoom, keyPressed, right-click menu) live in canvas_controls — deferred
// until that action lands. Only the window-level listeners are wired here.

import { Collapse } from 'bootstrap'
import { bus } from './bus'
import { history } from './commands/base'
import { resetScreen } from './actions/screen'

export function registerGlobalListeners(): void {
  window.addEventListener('resize', resetScreen)
  window.addEventListener('keydown', handleUndoRedo)
  wireHistoryButtons()
  wireMobileNavCollapse()
}

// On small screens the navbar is a collapsed menu; picking a tab should close
// it so the chosen panel/scene isn't left buried under the open menu.
function wireMobileNavCollapse(): void {
  const menu = document.getElementById('navbarTabs')
  if (!menu) return
  for (const link of menu.querySelectorAll('.navbar-nav .nav-link')) {
    link.addEventListener('click', () => {
      if (menu.classList.contains('show')) {
        Collapse.getOrCreateInstance(menu).hide()
      }
    })
  }
}

function wireHistoryButtons(): void {
  const undo = document.getElementById('undoButton') as HTMLButtonElement | null
  const redo = document.getElementById('redoButton') as HTMLButtonElement | null
  if (!undo || !redo) return
  undo.addEventListener('click', () => history.undo())
  redo.addEventListener('click', () => history.redo())
  bus.on('history:changed', ({ canUndo, canRedo }) => {
    undo.disabled = !canUndo
    redo.disabled = !canRedo
  })
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
