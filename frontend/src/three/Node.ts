import * as THREE from 'three'
import {
  SPHERE_RADIUS,
  SPHERE_WIDTHSEGMENTS,
  SPHERE_HEIGHTSEGMENTS,
  BOX_SIZE,
  DIAMOND_RADIUS,
  CONE_RADIUS,
  CONE_HEIGHT,
  BLOOM_LAYER,
} from './constants'
import { ctx } from './runtime'

export type Axis = 'x' | 'y' | 'z'
export type NodeGeometryType = 'sphere' | 'box' | 'diamond' | 'cone'

export interface NodeOptions {
  id?: number
  name?: string
  layer?: string
  nodeLayerName?: string
  position_x?: number
  position_y?: number
  position_z?: number
  scale?: number
  color?: string
  url?: string
  descr?: string
}

export class Node {
  sphere!: THREE.Mesh

  id: number
  name: string
  layer: string
  nodeLayerName: string
  color: string
  importedColor: string
  clusterColor: string
  url: string
  descr: string

  isSelected = false
  showLabel = false
  cluster = ''

  constructor({
    id = 0,
    name = '',
    layer = '',
    nodeLayerName = '',
    position_x = 0,
    position_y = 0,
    position_z = 0,
    scale = 1,
    color = '#FFFFFF',
    url = '',
    descr = '',
  }: NodeOptions) {
    this.id = id
    this.name = name
    this.layer = layer
    this.nodeLayerName = nodeLayerName
    this.color = color
    this.importedColor = color
    this.clusterColor = color
    this.url = url
    this.descr = descr

    this.createSphere(color)
    this.initTranslate(position_x, position_y, position_z)
    this.setScale(scale)
  }

  createSphere(nodeColor: string): void {
    const geometry = new THREE.SphereGeometry(
      SPHERE_RADIUS,
      SPHERE_WIDTHSEGMENTS,
      SPHERE_HEIGHTSEGMENTS
    )
    const material = new THREE.MeshStandardMaterial({
      color: nodeColor,
      transparent: true,
    })
    this.sphere = new THREE.Mesh(geometry, material)
    // Nodes are the only thing that glows. enable(), not set(): the sphere
    // stays on layer 0 so the default-masked raycaster still picks it.
    this.sphere.layers.enable(BLOOM_LAYER)
  }

  initTranslate(x: number, y: number, z: number): void {
    this.setPosition('x', x)
    this.setPosition('y', y)
    this.setPosition('z', z)
  }

  // transformations
  translateX(x: number): void {
    this.sphere.translateX(x)
  }
  translateY(y: number): void {
    this.sphere.translateY(y)
  }
  translateZ(z: number): void {
    this.sphere.translateZ(z)
  }

  // setters and getters
  getName(): string {
    return this.name
  }

  getLayer(): string {
    return this.layer
  }

  getNodeLayerName(): string {
    return this.nodeLayerName
  }

  getPosition(): THREE.Vector3
  getPosition(axis: Axis): number
  getPosition(axis?: Axis): THREE.Vector3 | number {
    return axis === undefined
      ? this.sphere.position
      : this.sphere.position[axis]
  }

  getWorldPosition(): THREE.Vector3
  getWorldPosition(axis: Axis): number
  getWorldPosition(axis?: Axis): THREE.Vector3 | number {
    const world = this.sphere.getWorldPosition(new THREE.Vector3())
    return axis === undefined ? world : world[axis]
  }

  getOpacity(): number {
    return (this.sphere.material as THREE.MeshStandardMaterial).opacity
  }

  getColor(): string {
    let color = this.color
    if (ctx.nodeColorPrioritySource === 'default') color = this.importedColor
    else if (ctx.nodeColorPrioritySource === 'cluster')
      color = this.clusterColor
    return color
  }

  getScale(): number {
    return this.sphere.scale.x
  }

  getCluster(): string {
    return this.cluster
  }

  setPosition(axis: Axis, value: number): void {
    this.sphere.position[axis] = value
  }

  setOpacity(value: number): void {
    ;(this.sphere.material as THREE.MeshStandardMaterial).opacity = value
  }

  setGeometry(type: NodeGeometryType): void {
    let geometry: THREE.BufferGeometry
    switch (type) {
      case 'sphere':
        geometry = new THREE.SphereGeometry(
          SPHERE_RADIUS,
          SPHERE_WIDTHSEGMENTS,
          SPHERE_HEIGHTSEGMENTS
        )
        break
      case 'box':
        geometry = new THREE.BoxGeometry(BOX_SIZE, BOX_SIZE, BOX_SIZE)
        break
      case 'diamond':
        geometry = new THREE.OctahedronGeometry(DIAMOND_RADIUS, 0)
        break
      case 'cone':
        geometry = new THREE.ConeGeometry(CONE_RADIUS, CONE_HEIGHT, CONE_RADIUS)
        break
      default:
        console.error(`Unknown geometry type: ${type as string}`)
        return
    }
    this.sphere.geometry.dispose()
    this.sphere.geometry = geometry
  }

  setColor(hexColor: string, importMode = false, clusterMode = false): void {
    ;(this.sphere.material as THREE.MeshStandardMaterial).color =
      new THREE.Color(hexColor)
    this.color = hexColor
    if (importMode) this.importedColor = hexColor
    if (clusterMode) this.clusterColor = hexColor
  }

  setScale(value: number): void {
    this.sphere.scale.x = this.sphere.scale.y = this.sphere.scale.z = value
  }

  setCluster(clusterName: string): void {
    this.cluster = clusterName
  }
}
