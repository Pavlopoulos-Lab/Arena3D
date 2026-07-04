// Layer-plane dragging — port of v2 www/js/three/drag_controls.js (itself a
// tweaked copy of three.js DragControls; its matrix4.js shim is replaced by
// npm three's Matrix4). v2 tweaks kept: dragging only engages while the left
// button is down over a hovered layer, and label render flags are raised
// while dragging. Added: inter-layer edge redraw + layer:moved on release
// (v2 did this through its Shiny syncs).

import * as THREE from 'three'
import { bus } from '../bus'
import { ctx } from '../three'
import { findIndexByUuid } from '../utils'

const _plane = new THREE.Plane()
const _pointer = new THREE.Vector2()
const _offset = new THREE.Vector3()
const _intersection = new THREE.Vector3()
const _worldPosition = new THREE.Vector3()
const _inverseMatrix = new THREE.Matrix4()
const _raycaster = new THREE.Raycaster()

let selected: THREE.Object3D | null = null
let hovered: THREE.Object3D | null = null
let surface: DragSurface | null = null

// Structural subset of HTMLCanvasElement, so tests can drive a fake surface.
export interface DragSurface {
  getBoundingClientRect(): {
    left: number
    top: number
    width: number
    height: number
  }
  addEventListener(type: string, listener: EventListener): void
  style: { cursor: string; touchAction: string }
}

type PointerLikeEvent = {
  clientX: number
  clientY: number
  pointerType?: string
}

function updatePointer(event: PointerLikeEvent): void {
  const rect = surface!.getBoundingClientRect()
  _pointer.x = ((event.clientX - rect.left) / rect.width) * 2 - 1
  _pointer.y = (-(event.clientY - rect.top) / rect.height) * 2 + 1
}

function layerPlanes(): THREE.Object3D[] {
  return ctx.layers.map(({ plane }) => plane)
}

export function onPointerDown(event: PointerLikeEvent): void {
  if (!surface || !ctx.camera) return
  updatePointer(event)
  _raycaster.setFromCamera(_pointer, ctx.camera)
  const planes = layerPlanes()
  const intersections = _raycaster.intersectObjects(planes, true)
  if (intersections.length === 0) return

  // The recursive ray often hits a plane child first (coord-system line,
  // intra-layer edge, label sphere) — resolve up to the owning plane so the
  // drag gate's uuid check doesn't silently fail. Node spheres keep the v2
  // behavior of not engaging a layer drag.
  const hit = intersections[0].object
  if (ctx.nodeObjects.some(({ sphere }) => sphere.uuid === hit.uuid)) return
  let owner: THREE.Object3D | null = hit
  while (owner && findIndexByUuid(planes, owner.uuid) === -1)
    owner = owner.parent
  if (!owner) return

  selected = owner
  _plane.setFromNormalAndCoplanarPoint(
    ctx.camera.getWorldDirection(_plane.normal),
    _worldPosition.setFromMatrixPosition(selected.matrixWorld)
  )
  if (_raycaster.ray.intersectPlane(_plane, _intersection)) {
    _inverseMatrix.copy(selected.parent!.matrixWorld).invert()
    _offset
      .copy(_intersection)
      .sub(_worldPosition.setFromMatrixPosition(selected.matrixWorld))
  }
  surface.style.cursor = 'move'
}

export function onPointerMove(event: PointerLikeEvent): void {
  if (!surface || !ctx.camera) return
  updatePointer(event)
  _raycaster.setFromCamera(_pointer, ctx.camera)

  // v2 gate: only drag while the left button is held over a hovered layer
  if (
    selected &&
    ctx.lastHoveredLayerIndex !== null &&
    ctx.scene?.leftClickPressed &&
    findIndexByUuid(layerPlanes(), selected.uuid) !== -1
  ) {
    if (_raycaster.ray.intersectPlane(_plane, _intersection)) {
      ctx.renderLayerLabelsFlag = true
      ctx.renderNodeLabelsFlag = true
      ctx.renderInterLayerEdgesFlag = true // edges follow the dragged layer
      selected.position.copy(
        _intersection.sub(_offset).applyMatrix4(_inverseMatrix)
      )
    }
    return
  }

  // hover cursor support
  if (event.pointerType === 'mouse' || event.pointerType === 'pen') {
    const intersections = _raycaster.intersectObjects(layerPlanes(), true)
    if (intersections.length > 0) {
      const object = intersections[0].object
      _plane.setFromNormalAndCoplanarPoint(
        ctx.camera.getWorldDirection(_plane.normal),
        _worldPosition.setFromMatrixPosition(object.matrixWorld)
      )
      if (hovered !== object) {
        surface.style.cursor = 'pointer'
        hovered = object
      }
    } else if (hovered !== null) {
      surface.style.cursor = 'auto'
      hovered = null
    }
  }
}

export function onPointerCancel(): void {
  if (!surface) return
  if (selected) {
    const layerIndex = findIndexByUuid(layerPlanes(), selected.uuid)
    selected = null
    // redraw what the drag displaced (v2 routed this through Shiny syncs)
    ctx.renderInterLayerEdgesFlag = true
    if (layerIndex !== -1) bus.emit('layer:moved', { layerIndex })
  }
  surface.style.cursor = hovered ? 'pointer' : 'auto'
}

export function attachLayerDragControls(el: DragSurface): void {
  surface = el
  selected = null
  hovered = null
  el.style.touchAction = 'none' // disable touch scroll
  el.addEventListener('pointermove', onPointerMove as unknown as EventListener)
  el.addEventListener('pointerdown', onPointerDown as unknown as EventListener)
  el.addEventListener('pointerup', onPointerCancel as EventListener)
  el.addEventListener('pointerleave', onPointerCancel as EventListener)
}

// Called once from main.ts, after the canvas is mounted. v2 recreated
// DragControls per network load; the planes list is read live from ctx, so
// one registration survives reloads.
export function registerLayerDragControls(): void {
  const el = ctx.renderer?.domElement
  if (el) attachLayerDragControls(el)
}
