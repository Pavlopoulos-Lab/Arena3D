import { beforeEach, describe, expect, it } from 'vitest'
import * as THREE from 'three'
import { Node, Layer, Scene, Edge, ctx, resetContext } from './index'

beforeEach(() => {
  resetContext()
})

describe('Node', () => {
  it('constructs a sphere mesh at the given position with defaults', () => {
    const n = new Node({
      name: 'A',
      position_x: 1,
      position_y: 2,
      position_z: 3,
    })
    expect(n.sphere).toBeInstanceOf(THREE.Mesh)
    expect(n.getPosition('x')).toBe(1)
    expect(n.getPosition()).toBeInstanceOf(THREE.Vector3)
    expect(n.color).toBe('#FFFFFF')
  })

  it('getColor follows the runtime priority source', () => {
    const n = new Node({ color: '#111111' })
    n.setColor('#222222', true /* import */, false)
    n.setColor('#333333', false, true /* cluster */)
    ctx.nodeColorPrioritySource = 'default'
    expect(n.getColor()).toBe('#222222')
    ctx.nodeColorPrioritySource = 'cluster'
    expect(n.getColor()).toBe('#333333')
  })

  it('setScale and getScale round-trip', () => {
    const n = new Node({})
    n.setScale(2.5)
    expect(n.getScale()).toBe(2.5)
  })

  it('setGeometry swaps the mesh geometry', () => {
    const n = new Node({})
    n.setGeometry('box')
    expect(n.sphere.geometry).toBeInstanceOf(THREE.BoxGeometry)
    n.setGeometry('diamond')
    expect(n.sphere.geometry).toBeInstanceOf(THREE.OctahedronGeometry)
  })
})

describe('Layer', () => {
  it('constructs a plane of the requested width', () => {
    const l = new Layer({ name: 'L1', geometry_parameters_width: 400 })
    expect(l.plane).toBeInstanceOf(THREE.Mesh)
    expect(l.getWidth()).toBe(400)
    expect(l.coordSystem).toHaveLength(3)
  })

  it('setColor updates the material color', () => {
    const l = new Layer({ geometry_parameters_width: 100 })
    l.setColor('#ff0000')
    expect(l.color).toBe('#ff0000')
    const mat = l.plane.material as THREE.MeshBasicMaterial
    expect(mat.color.getHexString()).toBe('ff0000')
  })

  it('toggleVisibility syncs plane + flag', () => {
    const l = new Layer({ geometry_parameters_width: 100 })
    l.toggleVisibility(false)
    expect(l.isVisible).toBe(false)
    expect(l.plane.visible).toBe(false)
  })

  it('getColor prefers importedColor when selected in default mode', () => {
    const l = new Layer({
      geometry_parameters_width: 100,
      floor_current_color: '#abcabc',
    })
    l.setColor('#123123')
    l.isSelected = true
    ctx.layerColorPrioritySource = 'default'
    expect(l.getColor()).toBe('#abcabc') // importedColor
    l.isSelected = false
    expect(l.getColor()).toBe('#123123') // stored color
  })

  it('setScale records last_layer_scale', () => {
    const l = new Layer({ geometry_parameters_width: 100 })
    l.setScale(3)
    expect(l.getScale()).toBe(3)
  })
})

describe('Scene', () => {
  it('constructs with pan/sphere and a 3-axis coord system', () => {
    const s = new Scene()
    expect(s.exists()).toBe(true)
    expect(s.THREE_Object).toBeInstanceOf(THREE.Scene)
    expect(s.coordSystem).toHaveLength(3)
  })

  it('zoom scales within clamps', () => {
    const s = new Scene()
    expect(s.getScale()).toBe(1)
    s.zoom(-1) // zoom in
    expect(s.getScale()).toBeCloseTo(1.1)
    s.setScale(0.2)
    s.zoom(1) // zoom out below floor -> no change
    expect(s.getScale()).toBe(0.2)
  })

  it('rotate primitives rotate the sphere', () => {
    const s = new Scene()
    s.setRotation('x', 0)
    s.rotateX(0.5)
    expect(s.getRotation('x')).toBeCloseTo(0.5)
  })
})

describe('Edge', () => {
  // Minimal populated runtime: one layer, two nodes, both on layer "L".
  function seedTwoNodeLayer(): void {
    const scene = new Scene()
    const layer = new Layer({ geometry_parameters_width: 100 })
    const a = new Node({ name: 'A', position_y: 0, position_z: 0 })
    const b = new Node({ name: 'B', position_y: 10, position_z: 10 })
    ctx.scene = scene
    ctx.layers = [layer]
    ctx.nodeObjects = [a, b]
    ctx.nodeLayerNames = ['A::L', 'B::L']
    ctx.nodeGroups = { 'A::L': 'L', 'B::L': 'L' }
    ctx.layerGroups = { L: 0 }
  }

  it('draws an intra-layer line and attaches it to the source layer', () => {
    seedTwoNodeLayer()
    const e = new Edge({ source: 'A::L', target: 'B::L', weights: [1] })
    expect(e.THREE_Object).toBeInstanceOf(THREE.Line)
    expect(e.sourceLayerIndex).toBe(0)
    expect(ctx.layers[0].plane.children).toContain(e.THREE_Object)
    expect(e.decideColor()).toBe(ctx.edgeDefaultColor)
  })

  it('attaches an inter-layer edge to the scene, not a layer', () => {
    seedTwoNodeLayer()
    const e = new Edge({
      source: 'A::L',
      target: 'B::L',
      weights: [1],
      interLayer: true,
    })
    expect(ctx.scene!.THREE_Object.children).toContain(e.THREE_Object)
  })

  it('builds a channel curve group coloured by channelColors', () => {
    seedTwoNodeLayer()
    ctx.channelColors = { ch1: '#123456' }
    ctx.channelVisibility = { ch1: true }
    const e = new Edge({
      source: 'A::L',
      target: 'B::L',
      weights: [0.5],
      channels: ['ch1'],
    })
    expect(e.THREE_Object).toBeInstanceOf(THREE.Group)
    expect(e.THREE_Object.children.length).toBeGreaterThan(0)
    expect(e.decideColor(0)).toBe('#123456')
  })

  it('decideOpacity uses weight when edgeWidthByWeight is on', () => {
    seedTwoNodeLayer()
    const e = new Edge({ source: 'A::L', target: 'B::L', weights: [0.7] })
    ctx.edgeWidthByWeight = true
    expect(e.decideOpacity(0)).toBe(0.7)
    ctx.edgeWidthByWeight = false
    expect(e.decideOpacity(0)).toBe(ctx.intraLayerEdgeOpacity)
  })
})
