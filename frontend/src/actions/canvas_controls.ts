// Canvas mouse/keyboard scene controls — port of the canvas half of v2
// www/js/event_listeners.js plus the held-key/lasso helpers it pulled from
// node.js/layer.js. Shiny syncs and the 100ms update debounces dropped.
// Deferred: right-click node menu (right_click_menu.ts), DragControls layer
// dragging, nav-button/slider control table (Phase 13 UI).

import * as THREE from 'three'
import { ctx } from '../three'
import { redrawIntraLayerEdges, unselectAllEdges } from './edge'
import {
  checkHoverOverLayer,
  getSelectedLayers,
  performDoubleClickLayerSelection,
} from './layer'
import {
  checkHoverOverNode,
  decideNodeLabelFlags,
  getSelectedNodes,
  performDoubleClickNodeSelection,
  repaintNode,
  unselectAllNodes,
  updateSelectedNodesStore,
} from './node'

// v2 globals: lasso anchor (shift+click) and the lasso rectangle line.
let shiftX: number | null = null
let shiftY: number | null = null
let lasso: THREE.Line | null = null

type CanvasMouseEvent = MouseEvent & { layerX: number; layerY: number }

// on mouse wheel scroll
export function sceneZoom(event: WheelEvent): void {
  if (!ctx.scene?.exists()) return
  event.preventDefault() // keep the page from scrolling (v2 initializeCanvasDiv)
  ctx.scene.zoom(event.deltaY)
}

const ARROW_CODES: Record<string, number> = {
  ArrowLeft: 37,
  ArrowUp: 38,
  ArrowRight: 39,
  ArrowDown: 40,
}

// on z/x/c axis select (held-key layer/node transforms) or arrow-key pan
export function keyPressed(event: KeyboardEvent): void {
  if (!ctx.scene?.exists()) return
  const key = event.key.toLowerCase()
  if (key === 'z' || key === 'x' || key === 'c') ctx.scene.axisPressed = key
  else if (event.key in ARROW_CODES) {
    event.preventDefault()
    ctx.scene.translatePanWithArrow(ARROW_CODES[event.key])
  }
}

export function axisRelease(): void {
  if (ctx.scene?.exists()) ctx.scene.axisPressed = ''
}

// mouse: 0 left, 1 middle, 2 right click
export function clickDown(event: CanvasMouseEvent): void {
  if (!ctx.scene?.exists()) return
  if (event.button === 0) {
    ctx.scene.leftClickPressed = true
    ctx.scene.middleClickPressed = false
    if (event.shiftKey && shiftX === null) {
      shiftX = event.layerX - ctx.xBoundMax
      shiftY = ctx.yBoundMax - event.layerY // used in drag
    }
  } else if (event.button === 1) {
    event.preventDefault() // no middle-click autoscroll
    ctx.scene.middleClickPressed = true
    ctx.scene.leftClickPressed = false
  } else {
    ctx.scene.middleClickPressed = false
    ctx.scene.leftClickPressed = false
  }
}

// while mouse button held, drag event
export function clickDrag(event: CanvasMouseEvent): void {
  if (!ctx.scene?.exists()) return
  const distance = Math.hypot(
    ctx.mousePreviousX - event.screenX,
    ctx.mousePreviousY - event.screenY
  )

  if (distance > 10) {
    const x = event.screenX
    const y = event.screenY

    if (ctx.scene.leftClickPressed) {
      ctx.scene.dragging = true
      if (event.shiftKey) {
        ctx.lastHoveredLayerIndex = null // to be able to lasso inside a layer
        lassoSelectNodes(
          event.layerX - ctx.xBoundMax,
          ctx.yBoundMax - event.layerY
        )
      } else if (ctx.scene.axisPressed !== '' && getSelectedNodes().length > 0)
        translateNodesWithHeldKey(event)
      else if (ctx.scene.axisPressed !== '') rotateLayersWithHeldKey(event)
      else if (
        ctx.lastHoveredLayerIndex === null &&
        ctx.lastHoveredNodeIndex === null
      )
        ctx.scene.translatePanWithMouse(x, y)
    } else if (ctx.scene.middleClickPressed) {
      ctx.scene.dragging = true
      event.preventDefault()
      ctx.scene.orbitSphereWithMouse(x, y)
    }

    ctx.mousePreviousX = x
    ctx.mousePreviousY = y
  }

  if (!ctx.scene.leftClickPressed && !ctx.scene.middleClickPressed)
    if (!checkHoverOverNode(event)) checkHoverOverLayer(event)
}

export function clickUp(event: MouseEvent): void {
  if (!ctx.scene?.exists()) return
  ctx.scene.dragging = false
  if (event.button === 0) {
    ctx.scene.leftClickPressed = false
    if (lasso) {
      // nodes dimmed to 0.5 are inside the lasso -> select them
      ctx.nodeObjects.forEach((node, i) => {
        if (node.getOpacity() === 0.5) {
          node.setOpacity(1)
          node.isSelected = true
          repaintNode(i)
        }
      })
      decideNodeLabelFlags()
      updateSelectedNodesStore()
      ctx.scene.remove(lasso)
      lasso = null
    }
    shiftX = null
    shiftY = null
  } else if (event.button === 1) ctx.scene.middleClickPressed = false
}

// double click: select node -> select layer -> unselect everything
export function dblClick(event: CanvasMouseEvent): void {
  if (!ctx.scene?.exists()) return
  if (performDoubleClickNodeSelection(event)) return
  if (ctx.lastHoveredLayerIndex !== null) performDoubleClickLayerSelection()
  else {
    unselectAllNodes()
    unselectAllEdges()
    redrawIntraLayerEdges()
  }
}

// v2 node.js translateNodesWithHeldKey — z/c + drag moves selected nodes.
export function translateNodesWithHeldKey(event: {
  screenX: number
  screenY: number
}): void {
  const step =
    event.screenX - event.screenY >= ctx.mousePreviousX - ctx.mousePreviousY
      ? 20
      : -20

  for (const i of getSelectedNodes()) {
    if (ctx.scene!.axisPressed === 'z') ctx.nodeObjects[i].translateZ(step)
    else if (ctx.scene!.axisPressed === 'c') ctx.nodeObjects[i].translateY(step)
  }
  redrawIntraLayerEdges()
}

// v2 layer.js rotateLayersWithHeldKey — z/x/c + drag rotates selected layers.
export function rotateLayersWithHeldKey(event: {
  screenX: number
  screenY: number
}): void {
  const rads =
    event.screenX - event.screenY >= ctx.mousePreviousX - ctx.mousePreviousY
      ? 0.05
      : -0.05

  for (const i of getSelectedLayers()) {
    if (ctx.scene!.axisPressed === 'z') ctx.layers[i].rotateZ(rads)
    else if (ctx.scene!.axisPressed === 'x') ctx.layers[i].rotateX(rads)
    else if (ctx.scene!.axisPressed === 'c') ctx.layers[i].rotateY(rads)
  }
}

// v2 node.js lassoSelectNodes — shift + left-drag rectangle select.
export function lassoSelectNodes(x: number, y: number): void {
  if (shiftX === null || shiftY === null) return
  const minX = Math.min(shiftX, x)
  const maxX = Math.max(shiftX, x)
  const minY = Math.min(shiftY, y)
  const maxY = Math.max(shiftY, y)

  createLassoGeometry(x, y)

  for (const node of ctx.nodeObjects) {
    const nodeX = node.getWorldPosition('x')
    const nodeY = node.getWorldPosition('y')
    node.setOpacity(
      nodeX < maxX && nodeX > minX && nodeY < maxY && nodeY > minY ? 0.5 : 1
    )
  }
}

function createLassoGeometry(x: number, y: number): void {
  if (lasso) ctx.scene!.remove(lasso)
  const points = [
    new THREE.Vector3(shiftX!, shiftY!, 0),
    new THREE.Vector3(x, shiftY!, 0),
    new THREE.Vector3(x, y, 0),
    new THREE.Vector3(shiftX!, y, 0),
    new THREE.Vector3(shiftX!, shiftY!, 0),
  ]
  lasso = new THREE.Line(
    new THREE.BufferGeometry().setFromPoints(points),
    new THREE.LineBasicMaterial({ color: '#eef1b6' })
  )
  ctx.scene!.add(lasso)
}

// Called once from main.ts, after the canvas is mounted.
export function registerCanvasControls(): void {
  const canvas = ctx.renderer?.domElement
  if (!canvas) return
  canvas.tabIndex = 1 // focusable, so it receives keydown events (v2)
  canvas.addEventListener('wheel', sceneZoom)
  canvas.addEventListener('keydown', keyPressed)
  canvas.addEventListener('keyup', axisRelease)
  canvas.addEventListener('mousedown', clickDown as EventListener)
  canvas.addEventListener('mousemove', clickDrag as EventListener)
  canvas.addEventListener('mouseup', clickUp)
  canvas.addEventListener('dblclick', dblClick as EventListener)
  canvas.addEventListener('mouseleave', clickUp) // release buttons on exit (v2)
}
