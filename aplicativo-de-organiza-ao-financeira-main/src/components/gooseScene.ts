import * as THREE from 'three'

/** Local procedural model; never loads external assets or sends pointer data. */
export function createGooseScene(host: HTMLElement) {
  const scene = new THREE.Scene()
  const camera = new THREE.PerspectiveCamera(34, 1, .1, 30)
  camera.position.set(1.8, 2.2, 6.5)
  camera.lookAt(0, 1.2, 0)
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

  const white = new THREE.MeshStandardMaterial({ color: 0xf4f2ed, roughness: .5 })
  const wingMaterial = new THREE.MeshStandardMaterial({ color: 0xe5e7f0, roughness: .6 })
  const orange = new THREE.MeshStandardMaterial({ color: 0xf3a334, roughness: .42 })
  const dark = new THREE.MeshStandardMaterial({ color: 0x1b2234, roughness: .24 })
  const gleam = new THREE.MeshBasicMaterial({ color: 0xffffff })
  const scarfMaterial = new THREE.MeshStandardMaterial({ color: 0x9e74ec, roughness: .65 })
  const groundMaterial = new THREE.MeshStandardMaterial({ color: 0x8070b5, roughness: .8 })
  const goose = new THREE.Group()
  // A slight turn gives a clear view of both the face and the long neck.
  goose.rotation.y = .18
  scene.add(goose)

  function ellipsoid(parent: THREE.Group, material: THREE.Material, position: [number, number, number], scale: [number, number, number]) {
    const mesh = new THREE.Mesh(new THREE.SphereGeometry(1, 28, 20), material)
    mesh.position.set(...position)
    mesh.scale.set(...scale)
    parent.add(mesh)
    return mesh
  }
  ellipsoid(goose, white, [0, .85, 0], [.7, .64, .85])
  const leftWing = ellipsoid(goose, wingMaterial, [-.58, .92, 0], [.19, .39, .59])
  leftWing.rotation.z = -.18
  const rightWing = ellipsoid(goose, wingMaterial, [.58, .92, 0], [.19, .39, .59])
  rightWing.rotation.z = .18
  const tail = new THREE.Mesh(new THREE.ConeGeometry(.28, .65, 20), white)
  tail.position.set(0, 1, -.73)
  tail.rotation.x = -1.05
  goose.add(tail)
  ellipsoid(goose, white, [0, 1.42, .3], [.28, .74, .29])
  for (const x of [-.29, .29]) {
    ellipsoid(goose, orange, [x, .22, .12], [.075, .22, .08])
    ellipsoid(goose, orange, [x, .095, .29], [.22, .075, .32])
  }
  const head = new THREE.Group()
  head.position.set(0, 1.98, .31)
  goose.add(head)
  ellipsoid(head, white, [0, .23, .03], [.38, .4, .37])
  ellipsoid(head, orange, [0, .12, .47], [.29, .105, .3])
  ellipsoid(head, orange, [0, .04, .44], [.255, .045, .26])
  for (const side of [-1, 1]) {
    ellipsoid(head, dark, [side * .27, .3, .245], [.075, .092, .045])
    ellipsoid(head, gleam, [side * .27 + .013, .33, .281], [.019, .022, .009])
    ellipsoid(head, dark, [side * .12, .19, .58], [.018, .012, .022])
  }
  const scarf = new THREE.Mesh(new THREE.TorusGeometry(.29, .075, 12, 36), scarfMaterial)
  scarf.position.set(0, 1.69, .3)
  scarf.rotation.x = Math.PI / 2
  goose.add(scarf)
  const scarfTail = new THREE.Mesh(new THREE.BoxGeometry(.16, .4, .075), scarfMaterial)
  scarfTail.position.set(.25, 1.46, .52)
  scarfTail.rotation.z = .2
  goose.add(scarfTail)
  const platform = new THREE.Mesh(new THREE.CylinderGeometry(1.08, 1.02, .09, 48), groundMaterial)
  platform.position.y = -.045
  scene.add(platform)

  let disposed = false
  let lostContext = false
  let visible = true
  let frame = 0
  let targetX = 0
  let targetY = 0
  const reduced = matchMedia('(prefers-reduced-motion: reduce)')
  const draw = () => {
    frame = 0
    if (disposed || lostContext || !visible || document.hidden) return
    const x = targetX * .85
    const y = -targetY * .28
    head.rotation.y += (x - head.rotation.y) * (reduced.matches ? 1 : .14)
    head.rotation.x += (y - head.rotation.x) * (reduced.matches ? 1 : .14)
    renderer.render(scene, camera)
    if (Math.abs(x - head.rotation.y) + Math.abs(y - head.rotation.x) > .001) schedule()
  }
  function schedule() { if (!frame && !disposed && !lostContext && visible && !document.hidden) frame = requestAnimationFrame(draw) }
  const reset = () => { targetX = 0; targetY = 0; schedule() }
  const point = (event: PointerEvent) => {
    if (reduced.matches) return
    const box = host.getBoundingClientRect()
    targetX = Math.max(-1, Math.min(1, (event.clientX - box.left) / box.width * 2 - 1))
    targetY = Math.max(-1, Math.min(1, (event.clientY - box.top) / box.height * 2 - 1))
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
  host.addEventListener('pointerdown', point)
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
    host.removeEventListener('pointerdown', point)
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