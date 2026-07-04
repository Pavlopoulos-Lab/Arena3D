import * as THREE from 'three'
import {
  PLANE_WIDTHSEGMENTS,
  PLANE_HEIGHTSEGMENTS,
  LAYER_DEFAULT_COLOR,
} from './constants'
import { ctx } from './runtime'
import type { Axis } from './Node'

export interface LayerOptions {
  id?: number
  name?: string
  position_x?: number
  position_y?: number
  position_z?: number
  last_layer_scale?: number
  rotation_x?: number
  rotation_y?: number
  rotation_z?: number
  floor_current_color?: string
  geometry_parameters_width?: number
}

export class Layer {
  plane!: THREE.Mesh
  sphere!: THREE.Mesh

  id: number
  name: string
  last_layer_scale: number
  geometry_parameters_width: number
  importedColor: string
  color: string

  showNodeLabels = false
  isSelected = false
  isVisible = true
  coordSystem: THREE.Line[] = []

  constructor({
    id = 1,
    name = 'Layer1',
    position_x = 0,
    position_y = 0,
    position_z = 0,
    last_layer_scale = 1,
    rotation_x = 0,
    rotation_y = 0,
    rotation_z = 0,
    floor_current_color = LAYER_DEFAULT_COLOR,
    geometry_parameters_width = 2 * ctx.yBoundMax,
  }: LayerOptions) {
    this.id = id
    this.name = name
    this.last_layer_scale = last_layer_scale
    this.geometry_parameters_width = geometry_parameters_width
    this.importedColor = floor_current_color
    this.color = floor_current_color

    this.createPlane(geometry_parameters_width, floor_current_color)
    this.appendCoordSystem()
    this.addLabelSphere(geometry_parameters_width, last_layer_scale)
    this.initTranslate(position_x, position_y, position_z)
    this.initRotate(rotation_x, rotation_y, rotation_z)
    this.initScale(last_layer_scale)
  }

  // inits
  createPlane(width: number, color: string): void {
    const planeGeometry = new THREE.PlaneGeometry(
      width,
      width,
      PLANE_WIDTHSEGMENTS,
      PLANE_HEIGHTSEGMENTS
    )
    planeGeometry.rotateY(THREE.MathUtils.degToRad(90))
    const planeMaterial = new THREE.MeshBasicMaterial({
      color: color,
      alphaTest: 0.05,
      wireframe: false,
      transparent: true,
      opacity: 0.6,
      side: THREE.DoubleSide,
    })
    this.plane = new THREE.Mesh(planeGeometry, planeMaterial)
  }

  appendCoordSystem(): void {
    this.coordSystem[0] = this.appendLine(150, 0, 0, '#FB3D2A') // red
    this.coordSystem[1] = this.appendLine(0, 150, 0, '#46FB2A') // green
    this.coordSystem[2] = this.appendLine(0, 0, 150, '#2AC2FB') // blue
    this.toggleCoords(false)
  }

  appendLine(x: number, y: number, z: number, color: string): THREE.Line {
    const points = [
      this.plane.position,
      new THREE.Vector3(x, y, z),
      this.plane.position,
      new THREE.Vector3(-x, -y, -z),
    ]
    const geometry = new THREE.BufferGeometry().setFromPoints(points)
    const material = new THREE.LineBasicMaterial({ color: color })
    const line = new THREE.Line(geometry, material)
    this.plane.add(line)
    return line
  }

  addLabelSphere(width: number, scale: number): void {
    // label will be attached here
    const threeSphere = this.createSphere()
    this.plane.add(threeSphere)
    threeSphere.translateY(-width / 2)
    threeSphere.translateZ(width / 2)
    threeSphere.position.y = threeSphere.position.y * scale
    threeSphere.position.z = threeSphere.position.z * scale
    this.sphere = threeSphere
  }

  createSphere(): THREE.Mesh {
    const geometry = new THREE.SphereGeometry()
    const material = new THREE.MeshBasicMaterial({
      color: 'white',
      transparent: true,
      opacity: 0,
    })
    return new THREE.Mesh(geometry, material)
  }

  initTranslate(x: number, y: number, z: number): void {
    this.setPosition('x', x)
    this.setPosition('y', y)
    this.setPosition('z', z)
  }

  initRotate(x: number, y: number, z: number): void {
    this.setRotation('x', x)
    this.setRotation('y', y)
    this.setRotation('z', z)
  }

  initScale(value: number): void {
    this.plane.geometry.scale(1, Number(value), Number(value))
  }

  addNode(sphere: THREE.Object3D): void {
    this.plane.add(sphere)
  }

  addEdge(line: THREE.Object3D): void {
    this.plane.add(line)
  }

  removeEdge(line: THREE.Object3D): void {
    this.plane.remove(line)
  }

  // toggle functions
  toggleSelection(): void {
    this.isSelected = !this.isSelected
  }

  toggleVisibility(flag: boolean): void {
    this.plane.visible = flag
    this.isVisible = flag
  }

  toggleCoords(layerCoordsSwitch: boolean): void {
    this.coordSystem[0].visible =
      this.coordSystem[1].visible =
      this.coordSystem[2].visible =
        layerCoordsSwitch
  }

  toggleWireframe(flag: boolean): void {
    ;(this.plane.material as THREE.MeshBasicMaterial).wireframe = flag
  }

  // transformations
  translateX(x: number): void {
    this.plane.translateX(x)
  }
  translateY(y: number): void {
    this.plane.translateY(y)
  }
  translateZ(z: number): void {
    this.plane.translateZ(z)
  }

  rotateX(x: number): void {
    this.plane.rotateX(x)
  }
  rotateY(y: number): void {
    this.plane.rotateY(y)
  }
  rotateZ(z: number): void {
    this.plane.rotateZ(z)
  }

  // setters and getters
  getName(): string {
    return this.name
  }

  setPosition(axis: Axis, value: number): void {
    this.plane.position[axis] = value
  }

  getPosition(axis: Axis): number {
    return this.plane.position[axis]
  }

  setRotation(axis: Axis, value: number): void {
    this.plane.rotation[axis] = value
  }

  getRotation(axis: Axis): number {
    return this.plane.rotation[axis]
  }

  getWidth(): number {
    return (this.plane.geometry as THREE.PlaneGeometry).parameters.width
  }

  setScale(value: number | string): void {
    const newScaleValue = parseFloat(String(value)) / this.getScale()
    this.plane.geometry.scale(1, newScaleValue, newScaleValue)
    this.last_layer_scale = parseFloat(String(value))
  }

  getScale(): number {
    return this.last_layer_scale
  }

  setColor(color: string): void {
    this.color = color
    ;(this.plane.material as THREE.MeshBasicMaterial).color = new THREE.Color(
      color
    )
  }

  getColor(): string {
    let color = LAYER_DEFAULT_COLOR
    if (this.isSelected) {
      if (ctx.layerColorPrioritySource === 'default') color = this.importedColor
      else if (ctx.layerColorPrioritySource === 'picker')
        // ponytail: DOM picker read; the input only exists in the browser UI
        // (Phase 13). Guarded so headless/tests fall back to the stored color.
        color =
          (typeof document !== 'undefined' &&
            (document.getElementById('floor_color') as HTMLInputElement | null)
              ?.value) ||
          this.color
    } else color = this.color
    return color
  }

  setOpacity(value: number): void {
    ;(this.plane.material as THREE.MeshBasicMaterial).opacity = value
  }
}
