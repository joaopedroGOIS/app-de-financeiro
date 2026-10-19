import { test } from 'node:test'
import assert from 'node:assert/strict'
import * as THREE from 'three'
import { createGooseModel } from './components/gooseModel'
import { gooseLookRotation } from './components/gooseTracking'

function gaze(x: number, y: number, cameraYaw = 0, bodyYaw = 0) {
  const look = gooseLookRotation(x, y, cameraYaw, bodyYaw)
  return new THREE.Vector3(0, 0, 1)
    .applyEuler(new THREE.Euler(look.pitch, look.yaw, look.roll, 'YXZ'))
    .applyAxisAngle(new THREE.Vector3(0, 1, 0), bodyYaw)
}

test('goose looks toward the pointer vertically and horizontally instead of reversing its head', () => {
  assert.ok(gaze(1, 0).x > 0, 'pointer right turns the bill right')
  assert.ok(gaze(-1, 0).x < 0, 'pointer left turns the bill left')
  assert.ok(gaze(0, -1).y > 0, 'a pointer above the head raises the bill')
  assert.ok(gaze(0, 1).y < 0, 'a pointer below the head lowers the bill')
  assert.ok(gaze(0, 0).distanceTo(new THREE.Vector3(0, 0, 1)) < 1e-12)
})

test('goose gaze follows the camera after body rotation and remains stable after full turns', () => {
  const cameraYaw = .7, bodyYaw = .4
  const cameraDirection = new THREE.Vector3(Math.sin(cameraYaw), 0, Math.cos(cameraYaw))
  assert.ok(gaze(0, 0, cameraYaw, bodyYaw).distanceTo(cameraDirection) < 1e-12)

  const original = gooseLookRotation(-.2, .3, cameraYaw, bodyYaw)
  for (const turns of [-10, -1, 1, 10]) {
    const afterTurn = gooseLookRotation(-.2, .3, cameraYaw, bodyYaw + turns * 2 * Math.PI)
    assert.ok(Math.abs(afterTurn.yaw - original.yaw) < 1e-12)
    assert.equal(afterTurn.pitch, original.pitch)
    assert.equal(afterTurn.roll, original.roll)
  }
})

test('pointer movement outside the pet stage and a backward body cannot twist the neck around', () => {
  for (const bodyYaw of [-Math.PI, -Math.PI / 2, 0, Math.PI / 2, Math.PI]) {
    for (const x of [-1000, -1, 0, 1, 1000]) {
      for (const y of [-1000, -1, 0, 1, 1000]) {
        const look = gooseLookRotation(x, y, .4, bodyYaw)
        assert.ok(Number.isFinite(look.yaw) && Math.abs(look.yaw) < Math.PI / 3)
        assert.ok(Number.isFinite(look.pitch) && Math.abs(look.pitch) < Math.PI / 6)
        assert.ok(Number.isFinite(look.roll) && Math.abs(look.roll) < Math.PI / 12)
      }
    }
  }
  assert.deepEqual(gooseLookRotation(100, -100, 0, 0), gooseLookRotation(1, -1, 0, 0))
})

test('procedural goose geometry is finite, contained in its stage, and has a stable head joint', t => {
  const model = createGooseModel()
  t.after(() => {
    model.goose.traverse(object => { if (object instanceof THREE.Mesh) object.geometry.dispose() })
    for (const material of model.materials) material.dispose()
  })
  let meshCount = 0
  model.goose.traverse(object => {
    if (!(object instanceof THREE.Mesh)) return
    meshCount++
    for (const name of ['position', 'normal']) {
      const attribute: THREE.BufferAttribute = object.geometry.getAttribute(name) as THREE.BufferAttribute
      assert.ok(attribute && attribute.count > 0, `mesh has ${name}`)
      assert.ok(Array.from(attribute.array).every(Number.isFinite), `${name} contains no NaN or infinity`)
    }
    for (const material of Array.isArray(object.material) ? object.material : [object.material]) {
      assert.ok(model.materials.includes(material), 'all mesh materials are registered for scene disposal')
    }
  })
  assert.ok(meshCount > 0)
  const bounds = new THREE.Box3().setFromObject(model.goose)
  assert.ok(bounds.min.y >= 0, 'feet stay above the platform')
  assert.ok(bounds.max.y < 3.3 && bounds.max.y > 2.7, 'the complete goose fits the camera composition')
  assert.ok(bounds.getSize(new THREE.Vector3()).x < 1.6)

  const jointBefore = model.head.getWorldPosition(new THREE.Vector3())
  const billDirectionBefore = model.head.localToWorld(new THREE.Vector3(0, .1, .65))
  model.head.rotation.set(-.3, .7, .03, 'YXZ')
  const jointAfter = model.head.getWorldPosition(new THREE.Vector3())
  const billDirectionAfter = model.head.localToWorld(new THREE.Vector3(0, .1, .65))
  assert.ok(jointBefore.distanceTo(jointAfter) < 1e-12, 'looking around does not translate or detach the head joint')
  assert.ok(billDirectionBefore.distanceTo(billDirectionAfter) > .1, 'the visible bill actually follows the joint')
})

test('separate goose cards have independent models and theme materials', t => {
  const first = createGooseModel(), second = createGooseModel()
  t.after(() => {
    for (const model of [first, second]) {
      model.goose.traverse(object => { if (object instanceof THREE.Mesh) object.geometry.dispose() })
      for (const material of model.materials) material.dispose()
    }
  })
  assert.notEqual(first.goose, second.goose)
  assert.notEqual(first.head, second.head)
  assert.notEqual(first.accentMaterial, second.accentMaterial)
  const originalColor = second.accentMaterial.color.getHex()
  first.accentMaterial.color.set(0x247ad1)
  assert.equal(second.accentMaterial.color.getHex(), originalColor)
})
