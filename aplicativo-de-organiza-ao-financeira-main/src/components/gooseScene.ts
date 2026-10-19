import * as THREE from 'three'
import { createGooseModel } from './gooseModel'
import { gooseLookRotation } from './gooseTracking'

/** Local model and pointer interaction; no remote assets or pointer telemetry. */
export function createGooseScene(host: HTMLElement) {
  const scene = new THREE.Scene()
  const camera = new THREE.PerspectiveCamera(33, 1, .1, 30)
  camera.position.set(2.7, 2.55, 6.4)
  camera.lookAt(0, 1.46, 0)
  const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true, powerPreference: 'low-power' })
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.75))
  renderer.setClearColor(0x000000, 0)
  renderer.outputColorSpace = THREE.SRGBColorSpace
  renderer.toneMapping = THREE.ACESFilmicToneMapping
  renderer.toneMappingExposure = 1.15
  renderer.domElement.setAttribute('aria-hidden', 'true')
  host.append(renderer.domElement)
  scene.add(new THREE.HemisphereLight(0xf1f5ff, 0x685f7d, 2))
  const key = new THREE.DirectionalLight(0xfff2df, 3.4)
  key.position.set(-3, 6, 5)
  scene.add(key)
  const rim = new THREE.DirectionalLight(0xcac2ff, 2.5)
  rim.position.set(4, 3, -4)
  scene.add(rim)
  const fill = new THREE.DirectionalLight(0xe4f5ff, .7)
  fill.position.set(3, 1, 4)
  scene.add(fill)
  const { goose, head, accentMaterial, materials } = createGooseModel()
  const initialYaw = -.18
  goose.rotation.y = initialYaw
  scene.add(goose)
  const groundMaterial = new THREE.MeshStandardMaterial({ color: 0x51406e, roughness: .8 })
  const platform = new THREE.Mesh(new THREE.CylinderGeometry(1.13, 1.08, .1, 64), groundMaterial)
  platform.position.y = -.065
  scene.add(platform)
  // Soft contact shadow without expensive shadow maps.
  const pixels = new Uint8Array(64 * 64 * 4)
  for (let y = 0; y < 64; y++) for (let x = 0; x < 64; x++) {
    const radius = Math.hypot((x - 31.5) / 31.5, (y - 31.5) / 31.5)
    pixels[(y * 64 + x) * 4 + 3] = Math.round(Math.pow(Math.max(0, 1 - radius), 2) * 95)
  }
  const shadowTexture = new THREE.DataTexture(pixels, 64, 64, THREE.RGBAFormat)
  shadowTexture.needsUpdate = true
  const shadowMaterial = new THREE.MeshBasicMaterial({ map: shadowTexture, transparent: true, depthWrite: false })
  const shadow = new THREE.Mesh(new THREE.PlaneGeometry(2.15, 2.15), shadowMaterial)
  shadow.rotation.x = -Math.PI / 2
  shadow.position.y = -.009
  scene.add(shadow)
  const trackingRegion = host.closest<HTMLElement>('.goose-companion') || host
  let disposed = false, lostContext = false, visible = true, dragging = false, following = false
  let frame = 0, lastFrame = 0, pointerX = 0, targetX = 0, targetY = 0
  let activePointer: number | null = null
  const projectedHead = new THREE.Vector3()
  const reduced = matchMedia('(prefers-reduced-motion: reduce)')
  head.rotation.order = 'YXZ'
  const draw = (time: number) => {
    frame = 0
    if (disposed || lostContext || !visible || document.hidden) return
    const target = following
      ? gooseLookRotation(targetX, targetY, Math.atan2(camera.position.x, camera.position.z), goose.rotation.y)
      : { yaw: 0, pitch: 0, roll: 0 }
    // Reduced motion removes easing, but preserves direct pointer response.
    const elapsed = Math.min(50, lastFrame ? time - lastFrame : 16)
    lastFrame = time
    const blend = reduced.matches ? 1 : 1 - Math.exp(-elapsed / 85)
    head.rotation.y += (target.yaw - head.rotation.y) * blend
    head.rotation.x += (target.pitch - head.rotation.x) * blend
    head.rotation.z += (target.roll - head.rotation.z) * blend
    renderer.render(scene, camera)
    if (Math.abs(target.yaw - head.rotation.y) + Math.abs(target.pitch - head.rotation.x) + Math.abs(target.roll - head.rotation.z) > .001) schedule()
    else lastFrame = 0
  }
  function schedule() { if (!frame && !disposed && !lostContext && visible && !document.hidden) frame = requestAnimationFrame(draw) }
  const reset = () => { following = false; targetX = 0; targetY = 0; schedule() }
  const point = (event: PointerEvent) => {
    if (dragging && event.pointerId === activePointer) {
      goose.rotation.y += (event.clientX - pointerX) * .012
      pointerX = event.clientX
      schedule()
      return
    }
    if (event.pointerType === 'touch') return
    const box = host.getBoundingClientRect()
    if (!box.width || !box.height) return
    scene.updateMatrixWorld(true)
    head.getWorldPosition(projectedHead).project(camera)
    const centerX = box.left + (projectedHead.x + 1) * box.width / 2
    const centerY = box.top + (1 - projectedHead.y) * box.height / 2
    targetX = THREE.MathUtils.clamp((event.clientX - centerX) / (box.width * .55), -1, 1)
    targetY = THREE.MathUtils.clamp((event.clientY - centerY) / (box.height * .55), -1, 1)
    following = true
    schedule()
  }
  const down = (event: PointerEvent) => {
    if (!event.isPrimary || event.button !== 0) return
    dragging = true
    following = false
    pointerX = event.clientX
    activePointer = event.pointerId
    host.setPointerCapture(event.pointerId)
    host.dataset.dragging = 'true'
    schedule()
  }
  const up = () => {
    const pointer = activePointer
    dragging = false
    activePointer = null
    delete host.dataset.dragging
    if (pointer !== null && host.hasPointerCapture(pointer)) host.releasePointerCapture(pointer)
    schedule()
  }
  const rotate = (event: Event) => {
    const direction = (event as CustomEvent<number>).detail
    if (![0, -1, 1].includes(direction)) return
    goose.rotation.y = direction === 0 ? initialYaw : goose.rotation.y + direction * Math.PI / 4
    reset()
  }
  const keyboard = (event: KeyboardEvent) => {
    const targets: Record<string, [number, number]> = { ArrowLeft: [-1, 0], ArrowRight: [1, 0], ArrowUp: [0, -1], ArrowDown: [0, 1] }
    if (event.key === 'Escape') { event.preventDefault(); reset(); return }
    const target = targets[event.key]
    if (!target) return
    event.preventDefault()
    ;[targetX, targetY] = target
    following = true
    schedule()
  }
  const resize = new ResizeObserver(() => {
    const width = host.clientWidth, height = host.clientHeight
    if (!width || !height) return
    renderer.setSize(width, height)
    camera.aspect = width / height
    camera.updateProjectionMatrix()
    schedule()
  })
  resize.observe(host)
  const intersection = new IntersectionObserver(([entry]) => { visible = entry.isIntersecting; if (visible) schedule() })
  intersection.observe(host)
  const theme = () => {
    const style = getComputedStyle(host)
    accentMaterial.color.set(style.getPropertyValue('--primary').trim() || '#8b5cf6')
    groundMaterial.color.set(style.getPropertyValue('--primary-soft-strong').trim() || '#35264f')
    schedule()
  }
  const themeObserver = new MutationObserver(theme)
  themeObserver.observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme'] })
  const contextLost = (event: Event) => { event.preventDefault(); lostContext = true; host.dataset.graphics = 'fallback'; if (frame) cancelAnimationFrame(frame); frame = 0 }
  trackingRegion.addEventListener('pointermove', point)
  trackingRegion.addEventListener('pointerleave', reset)
  host.addEventListener('pointerdown', down)
  host.addEventListener('pointerup', up)
  host.addEventListener('pointercancel', up)
  host.addEventListener('lostpointercapture', up)
  host.addEventListener('goose-rotate', rotate)
  host.addEventListener('blur', reset)
  host.addEventListener('keydown', keyboard)
  document.addEventListener('visibilitychange', schedule)
  reduced.addEventListener('change', schedule)
  renderer.domElement.addEventListener('webglcontextlost', contextLost)
  theme()
  host.dataset.graphics = 'ready'
  return () => {
    disposed = true
    up()
    cancelAnimationFrame(frame)
    resize.disconnect()
    intersection.disconnect()
    themeObserver.disconnect()
    trackingRegion.removeEventListener('pointermove', point)
    trackingRegion.removeEventListener('pointerleave', reset)
    host.removeEventListener('pointerdown', down)
    host.removeEventListener('pointerup', up)
    host.removeEventListener('pointercancel', up)
    host.removeEventListener('lostpointercapture', up)
    host.removeEventListener('goose-rotate', rotate)
    host.removeEventListener('blur', reset)
    host.removeEventListener('keydown', keyboard)
    document.removeEventListener('visibilitychange', schedule)
    reduced.removeEventListener('change', schedule)
    renderer.domElement.removeEventListener('webglcontextlost', contextLost)
    scene.traverse(object => { if (object instanceof THREE.Mesh) object.geometry.dispose() })
    for (const material of [...materials, groundMaterial, shadowMaterial]) material.dispose()
    shadowTexture.dispose()
    renderer.dispose()
    renderer.forceContextLoss()
    renderer.domElement.remove()
    delete host.dataset.graphics
  }
}
