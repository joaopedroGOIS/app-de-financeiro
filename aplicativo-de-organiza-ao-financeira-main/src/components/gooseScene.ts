import * as THREE from 'three'

/** Local procedural model; never loads external assets or sends pointer data. */
export function createGooseScene(host: HTMLElement) {
  const scene = new THREE.Scene()
  const camera = new THREE.PerspectiveCamera(34, 1, .1, 30)
  camera.position.set(2.6, 2.1, 7.1)
  camera.lookAt(0, 1.35, 0)
  const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true, powerPreference: 'low-power' })
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.75))
  renderer.setClearColor(0x000000, 0)
  renderer.outputColorSpace = THREE.SRGBColorSpace
  renderer.domElement.setAttribute('aria-hidden', 'true')
  host.append(renderer.domElement)
  scene.add(new THREE.HemisphereLight(0xeaf3ff, 0x54516b, 2.5))
  const key = new THREE.DirectionalLight(0xfff3de, 3)
  key.position.set(-3, 5, 4)
  scene.add(key)
  const rim = new THREE.DirectionalLight(0xb6a8ff, 2)
  rim.position.set(3, 3, -3)
  scene.add(rim)

  const white = new THREE.MeshStandardMaterial({ color: 0xf4f2ed, roughness: .8, flatShading: true })
  const wingMaterial = new THREE.MeshStandardMaterial({ color: 0xe5e7f0, roughness: .8, flatShading: true })
  const orange = new THREE.MeshStandardMaterial({ color: 0xf3a334, roughness: .7, flatShading: true })
  const dark = new THREE.MeshStandardMaterial({ color: 0x1b2234, roughness: .24 })
  const gleam = new THREE.MeshBasicMaterial({ color: 0xffffff })
  const scarfMaterial = new THREE.MeshStandardMaterial({ color: 0x9e74ec, roughness: .65 })
  const groundMaterial = new THREE.MeshStandardMaterial({ color: 0x8070b5, roughness: .8 })
  const goose = new THREE.Group()
  // A slight turn gives a clear view of both the face and the long neck.
  goose.rotation.y = -.45
  scene.add(goose)

  function ellipsoid(parent: THREE.Group, material: THREE.Material, position: [number, number, number], scale: [number, number, number]) {
    const mesh = new THREE.Mesh(new THREE.SphereGeometry(1, 20, 14), material)
    mesh.position.set(...position)
    mesh.scale.set(...scale)
    parent.add(mesh)
    return mesh
  }
  ellipsoid(goose, white, [0, .87, -.08], [.53, .64, .96])
  const leftWing = ellipsoid(goose, wingMaterial, [-.45, .94, -.2], [.13, .36, .66])
  leftWing.rotation.z = -.12
  const rightWing = ellipsoid(goose, wingMaterial, [.45, .94, -.2], [.13, .36, .66])
  rightWing.rotation.z = .12
  const tail = new THREE.Mesh(new THREE.ConeGeometry(.25, .58, 12), white)
  tail.position.set(0, 1.13, -.89)
  tail.rotation.x = -.95
  goose.add(tail)
  // Curved tapering neck follows the long silhouette of the reference.
  const neckPath = new THREE.CatmullRomCurve3([
    new THREE.Vector3(0, 1.03, .38), new THREE.Vector3(0, 1.46, .52),
    new THREE.Vector3(0, 1.91, .28), new THREE.Vector3(0, 2.25, .42),
  ])
  const neckGeometry = new THREE.TubeGeometry(neckPath, 28, 1, 14, false)
  const positions = neckGeometry.attributes.position
  // TubeGeometry supplies rings: taper from the breast to the head.
  const ringSize = 15
  for (let i = 0; i < positions.count; i++) {
    const t = Math.floor(i / ringSize) / 28
    const center = neckPath.getPointAt(t)
    const radius = .27 - t * .11
    positions.setXYZ(i, center.x + (positions.getX(i) - center.x) * radius,
      center.y + (positions.getY(i) - center.y) * radius,
      center.z + (positions.getZ(i) - center.z) * radius)
  }
  neckGeometry.computeVertexNormals()
  goose.add(new THREE.Mesh(neckGeometry, white))
  for (const x of [-.23, .23]) {
    ellipsoid(goose, orange, [x, .25, .07], [.048, .25, .05])
    const footShape = new THREE.Shape()
    footShape.moveTo(-.06, -.1)
    footShape.lineTo(-.18, .24)
    footShape.lineTo(-.07, .19)
    footShape.lineTo(0, .3)
    footShape.lineTo(.08, .2)
    footShape.lineTo(.18, .24)
    footShape.lineTo(.065, -.1)
    footShape.closePath()
    const foot = new THREE.Mesh(new THREE.ExtrudeGeometry(footShape, { depth: .045, bevelEnabled: true, bevelSize: .018, bevelThickness: .018, bevelSegments: 1, steps: 1 }), orange)
    foot.rotation.x = Math.PI / 2
    foot.position.set(x, .09, .18)
    goose.add(foot)
  }
  const head = new THREE.Group()
  head.position.set(0, 2.23, .42)
  goose.add(head)
  ellipsoid(head, white, [0, .16, .025], [.235, .3, .255])
  // Flat orange bill with a small open lower jaw.
  const billGeometry = new THREE.ConeGeometry(.18, .43, 4)
  const upperBill = new THREE.Mesh(billGeometry, orange)
  upperBill.rotation.x = Math.PI / 2
  upperBill.rotation.y = Math.PI / 4
  upperBill.scale.x = 1.15
  upperBill.scale.z = .42
  upperBill.position.set(0, .12, .37)
  head.add(upperBill)
  const lowerBill = ellipsoid(head, orange, [0, .025, .34], [.15, .035, .20])
  for (const side of [-1, 1]) {
    ellipsoid(head, dark, [side * .195, .22, .13], [.033, .038, .025])
    ellipsoid(head, gleam, [side * .205, .232, .148], [.008, .009, .006])
  }
  const scarf = new THREE.Mesh(new THREE.TorusGeometry(.17, .035, 8, 28), scarfMaterial)
  scarf.position.set(0, 2.08, .36)
  scarf.rotation.x = Math.PI / 2
  goose.add(scarf)
  const platform = new THREE.Mesh(new THREE.CylinderGeometry(1.08, 1.02, .09, 48), groundMaterial)
  platform.position.y = -.045
  scene.add(platform)

  let disposed = false
  let lostContext = false
  let visible = true
  let frame = 0
  let dragging = false
  let pointerX = 0
  let activePointer: number | null = null
  let targetX = 0
  let targetY = 0
  const reduced = matchMedia('(prefers-reduced-motion: reduce)')
  const draw = () => {
    frame = 0
    if (disposed || lostContext || !visible || document.hidden) return
    const cameraAngle = Math.atan2(camera.position.x, camera.position.z)
    const relative = Math.atan2(Math.sin(cameraAngle - goose.rotation.y), Math.cos(cameraAngle - goose.rotation.y))
    const x = Math.max(-.95, Math.min(.95, relative + targetX * .7))
    const y = -targetY * .28
    head.rotation.y += (x - head.rotation.y) * (reduced.matches ? 1 : .14)
    head.rotation.x += (y - head.rotation.x) * (reduced.matches ? 1 : .14)
    renderer.render(scene, camera)
    if (Math.abs(x - head.rotation.y) + Math.abs(y - head.rotation.x) > .001) schedule()
  }
  function schedule() { if (!frame && !disposed && !lostContext && visible && !document.hidden) frame = requestAnimationFrame(draw) }
  const reset = () => { targetX = 0; targetY = 0; schedule() }
  const point = (event: PointerEvent) => {
    if (dragging && event.pointerId === activePointer) {
      goose.rotation.y += (event.clientX - pointerX) * .012
      pointerX = event.clientX
      schedule()
      return
    }
    if (reduced.matches) return
    const box = host.getBoundingClientRect()
    targetX = Math.max(-1, Math.min(1, (event.clientX - box.left) / box.width * 2 - 1))
    targetY = Math.max(-1, Math.min(1, (event.clientY - box.top) / box.height * 2 - 1))
    schedule()
  }
  const down = (event: PointerEvent) => {
    if (!event.isPrimary || event.button !== 0) return
    dragging = true
    pointerX = event.clientX
    activePointer = event.pointerId
    host.setPointerCapture(event.pointerId)
    host.dataset.dragging = 'true'
  }
  const up = () => {
    if (activePointer !== null && host.hasPointerCapture(activePointer)) host.releasePointerCapture(activePointer)
    dragging = false
    activePointer = null
    delete host.dataset.dragging
    schedule()
  }
  const rotate = (event: Event) => {
    const direction = (event as CustomEvent<number>).detail
    if (direction === 0) { goose.rotation.y = -.45; targetX = 0; targetY = 0 }
    else goose.rotation.y += direction * Math.PI / 4
    schedule()
  }
  const keyboard = (event: KeyboardEvent) => {
    const targets: Record<string, [number, number]> = { ArrowLeft: [-1, 0], ArrowRight: [1, 0], ArrowUp: [0, -1], ArrowDown: [0, 1], Escape: [0, 0] }
    const target = targets[event.key]
    if (!target) return
    event.preventDefault()
    ;[targetX, targetY] = target
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
    scarfMaterial.color.set(style.getPropertyValue('--primary').trim() || '#8b5cf6')
    groundMaterial.color.set(style.getPropertyValue('--primary-soft-strong').trim() || '#35264f')
    schedule()
  }
  const themeObserver = new MutationObserver(theme)
  themeObserver.observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme'] })
  const contextLost = (event: Event) => { event.preventDefault(); lostContext = true; host.dataset.graphics = 'fallback'; if (frame) cancelAnimationFrame(frame); frame = 0 }
  host.addEventListener('pointermove', point)
  host.addEventListener('pointerdown', down)
  host.addEventListener('pointerup', up)
  host.addEventListener('pointercancel', up)
  host.addEventListener('goose-rotate', rotate)
  host.addEventListener('pointerleave', reset)
  host.addEventListener('blur', reset)
  host.addEventListener('keydown', keyboard)
  document.addEventListener('visibilitychange', schedule)
  reduced.addEventListener('change', reset)
  renderer.domElement.addEventListener('webglcontextlost', contextLost)
  theme()
  host.dataset.graphics = 'ready'

  return () => {
    disposed = true
    cancelAnimationFrame(frame)
    resize.disconnect()
    intersection.disconnect()
    themeObserver.disconnect()
    host.removeEventListener('pointermove', point)
    host.removeEventListener('pointerdown', down)
    host.removeEventListener('pointerup', up)
    host.removeEventListener('pointercancel', up)
    host.removeEventListener('goose-rotate', rotate)
    host.removeEventListener('pointerleave', reset)
    host.removeEventListener('blur', reset)
    host.removeEventListener('keydown', keyboard)
    document.removeEventListener('visibilitychange', schedule)
    reduced.removeEventListener('change', reset)
    renderer.domElement.removeEventListener('webglcontextlost', contextLost)
    scene.traverse(object => {
      if (object instanceof THREE.Mesh) object.geometry.dispose()
    })
    for (const material of [white, wingMaterial, orange, dark, gleam, scarfMaterial, groundMaterial]) material.dispose()
    renderer.dispose()
    renderer.forceContextLoss()
    renderer.domElement.remove()
    delete host.dataset.graphics
  }
}