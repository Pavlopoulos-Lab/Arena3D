import * as THREE from 'three'
import { SELECTED_DEFAULT_COLOR } from './constants'
import { ctx } from './runtime'

export interface EdgeOptions {
  id?: number
  source?: string
  target?: string
  colors?: string[]
  weights?: number[]
  channels?: string[]
  interLayer?: boolean
}

export class Edge {
  THREE_Object!: THREE.Object3D
  sourceNodeIndex = -1
  targetNodeIndex = -1
  sourceLayerIndex = -1
  targetLayerIndex = -1

  id: number
  source: string
  target: string
  name: string
  colors: string[]
  importedColors: string[]
  weights: number[]
  channels: string[]
  interLayer: boolean

  isSelected = false

  constructor({
    id = 0,
    source = '',
    target = '',
    colors,
    weights = [],
    channels = [],
    interLayer = false,
  }: EdgeOptions) {
    this.id = id
    this.source = source
    this.target = target
    this.name = this.source.concat('---').concat(this.target)
    this.colors = colors ?? [ctx.edgeDefaultColor]
    this.importedColors = [...this.colors] // distinct array: baseline for file-color priority
    this.weights = weights
    this.channels = channels
    this.interLayer = interLayer

    this.initIndexVariables()
    this.drawEdge()
  }

  initIndexVariables(): void {
    this.sourceNodeIndex = ctx.nodeLayerNames.indexOf(this.source)
    this.targetNodeIndex = ctx.nodeLayerNames.indexOf(this.target)
    this.sourceLayerIndex =
      ctx.layerGroups[ctx.nodeGroups[ctx.nodeLayerNames[this.sourceNodeIndex]]]
    this.targetLayerIndex =
      ctx.layerGroups[ctx.nodeGroups[ctx.nodeLayerNames[this.targetNodeIndex]]]
  }

  drawEdge(): void {
    const points = this.decidePoints()

    if (this.channels.length === 0) this.createEdge(points)
    else this.createChannels(points)

    if (this.interLayer) ctx.scene!.add(this.THREE_Object)
    else ctx.layers[this.sourceLayerIndex].addEdge(this.THREE_Object)
  }

  decidePoints(): THREE.Vector3[] {
    const points: THREE.Vector3[] = []
    if (this.interLayer)
      points.push(
        ctx.nodeObjects[this.sourceNodeIndex].getWorldPosition(),
        ctx.nodeObjects[this.targetNodeIndex].getWorldPosition()
      )
    else
      points.push(
        ctx.nodeObjects[this.sourceNodeIndex].getPosition(),
        ctx.nodeObjects[this.targetNodeIndex].getPosition()
      )
    return points
  }

  createEdge(points: THREE.Vector3[]): void {
    const geometry = new THREE.BufferGeometry().setFromPoints(points)
    const color = this.decideColor()
    const opacity = this.decideOpacity()
    const material = new THREE.LineBasicMaterial({
      color: color,
      alphaTest: 0.05,
      transparent: true,
      opacity: opacity,
    })

    this.THREE_Object = new THREE.Line(geometry, material)

    if (ctx.isDirectionEnabled && opacity !== 0) this.createArrow(points, color)
  }

  decideColor(i = 0, forExport = false): string {
    let color = ctx.edgeDefaultColor

    if (!forExport && this.isSelected && ctx.selectedEdgeColorFlag)
      color = SELECTED_DEFAULT_COLOR
    else if (this.channels.length > 0 && !ctx.edgeFileColorPriority)
      // a channel missing from the registry would make THREE.Color throw/white
      color = ctx.channelColors[this.channels[i]] ?? ctx.edgeDefaultColor
    else if (ctx.edgeFileColorPriority) color = this.importedColors[i]

    return color
  }

  decideOpacity(i = 0): number {
    let opacity: number
    if (ctx.edgeWidthByWeight) opacity = this.weights[i]
    else
      opacity = this.interLayer
        ? ctx.interLayerEdgeOpacity
        : ctx.intraLayerEdgeOpacity
    return opacity
  }

  createArrow(points: THREE.Vector3[], arrowColor: string): void {
    const THREE_arrowHelper = this.createArrowHelper(points, arrowColor)
    const THREE_Group = new THREE.Group()
    THREE_Group.add(this.THREE_Object)
    THREE_Group.add(THREE_arrowHelper)
    this.THREE_Object = THREE_Group
  }

  createArrowHelper(
    points: THREE.Vector3[],
    edgeColor: string
  ): THREE.ArrowHelper {
    const direction = points[1].clone().sub(points[0])
    const origin = points[1]
    const length = 1
    let headLength = this.interLayer
      ? ctx.interDirectionArrowSize
      : ctx.intraDirectionArrowSize
    headLength = headLength * 6
    const headWidth = headLength / 4

    return new THREE.ArrowHelper(
      direction.normalize(),
      origin,
      length,
      edgeColor,
      headLength,
      headWidth
    )
  }

  // Channels ======
  createChannels(points: THREE.Vector3[]): void {
    let THREE_curveGroup = new THREE.Group()
    let pushForce = 0
    let pushForceFlag = false
    let direction = 1
    const curveFactor = this.interLayer
      ? ctx.interChannelCurvature
      : ctx.intraChannelCurvature

    const verticalPushConstant =
      (points[0].distanceTo(points[1]) * curveFactor) / 400
    if (this.channels.length % 2 == 0) pushForce = 1 // skip straight line

    for (let i = 0; i < this.channels.length; i++) {
      direction = -1 * direction // flipping direction

      if (pushForceFlag) pushForce = pushForce + 1
      pushForceFlag = !pushForceFlag // flipping flag to increase pushForce next round

      const verticalPush = direction * (verticalPushConstant * pushForce)
      const color = this.decideColor(i)
      const opacity = this.decideOpacity(i)

      THREE_curveGroup = this.createCurve(
        THREE_curveGroup,
        points[0],
        points[1],
        verticalPush,
        color,
        this.channels[i],
        opacity
      )
    }

    this.THREE_Object = THREE_curveGroup
  }

  createCurve(
    curveGroup: THREE.Group,
    p1: THREE.Vector3,
    p2: THREE.Vector3,
    verticalPush: number,
    color: string,
    channelName: string,
    opacity: number
  ): THREE.Group {
    const p3 = p1.clone()
    const p4 = p2.clone()
    const points = 50

    p3.addScalar(verticalPush)
    p4.addScalar(verticalPush)

    let curve: THREE.CubicBezierCurve3
    if (!this.interLayer)
      curve = new THREE.CubicBezierCurve3(
        p1,
        this.transformMiddlePointOnLayer(p3),
        this.transformMiddlePointOnLayer(p4),
        p2
      )
    else curve = new THREE.CubicBezierCurve3(p1, p3, p4, p2)

    const curvePoints = curve.getPoints(points)
    const curveGeometry = new THREE.BufferGeometry().setFromPoints(curvePoints)
    const curveMaterial = new THREE.LineBasicMaterial({
      color: color,
      alphaTest: 0.05,
      transparent: true,
      opacity: opacity,
    })
    const curveLine = new THREE.Line(curveGeometry, curveMaterial)
    curveLine.userData.tag = channelName
    curveLine.visible = ctx.channelVisibility[channelName]
    curveGroup.add(curveLine)

    if (ctx.isDirectionEnabled && opacity !== 0)
      curveGroup = this.createCurvedArrow(
        curveGroup,
        curvePoints,
        points,
        color,
        channelName
      )

    return curveGroup
  }

  // Helps place arrow lines onto the layer instead of through it.
  transformMiddlePointOnLayer(point: THREE.Vector3): THREE.Vector3 {
    point.x = 0
    return point
  }

  createCurvedArrow(
    curveGroup: THREE.Group,
    curvePoints: THREE.Vector3[],
    points: number,
    color: string,
    channelName: string
  ): THREE.Group {
    const arrowHelper = this.createArrowHelper(
      [curvePoints[points - 4], curvePoints[points - 1]],
      color
    )
    arrowHelper.userData.tag = channelName
    arrowHelper.visible = ctx.channelVisibility[channelName]
    curveGroup.add(arrowHelper)
    return curveGroup
  }

  // On animate ======
  redrawEdge(): void {
    if (this.interLayer) ctx.scene!.remove(this.THREE_Object)
    else ctx.layers[this.sourceLayerIndex].removeEdge(this.THREE_Object)

    if (!this.interLayer || (this.interLayer && this.areLayersNotHidden()))
      this.drawEdge()
  }

  areLayersNotHidden(): boolean {
    return (
      ctx.layers[this.sourceLayerIndex].isVisible &&
      ctx.layers[this.targetLayerIndex].isVisible
    )
  }

  select(): void {
    this.isSelected = true
  }

  deselect(): void {
    this.isSelected = false
  }
}
