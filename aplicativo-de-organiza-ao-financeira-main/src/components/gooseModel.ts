import * as THREE from 'three'

export interface GooseModel {
  /** Standing on y=0, with the bill pointing toward +Z. */
  goose: THREE.Group
  /** Rotate this joint to look around. Its origin stays inside the neck. */
  head: THREE.Group
  neck: THREE.Mesh
  accentMaterial: THREE.MeshStandardMaterial
  materials: THREE.Material[]
}

/** A small, original clay-style goose. All geometry is made locally. */
export function createGooseModel(): GooseModel {
  const goose = new THREE.Group()
  const white = new THREE.MeshStandardMaterial({ color: 0xfffbf3, roughness: .68 })
  const wingWhite = new THREE.MeshStandardMaterial({ color: 0xf1eee5, roughness: .76 })
  const featherWhite = new THREE.MeshStandardMaterial({ color: 0xe3e1d9, roughness: .82 })
  const orange = new THREE.MeshStandardMaterial({ color: 0xf5a337, roughness: .5 })
  const billLower = new THREE.MeshStandardMaterial({ color: 0xe58b28, roughness: .58 })
  const mouth = new THREE.MeshStandardMaterial({ color: 0x995526, roughness: .72 })
  const eyes = new THREE.MeshStandardMaterial({ color: 0x18222c, roughness: .15, metalness: .08 })
  const eyeLight = new THREE.MeshBasicMaterial({ color: 0xffffff })
  const blush = new THREE.MeshStandardMaterial({ color: 0xf4dfd4, roughness: .8 })
  const accentMaterial = new THREE.MeshStandardMaterial({ color: 0x9572df, roughness: .7 })
  const materials = [white, wingWhite, featherWhite, orange, billLower, mouth, eyes, eyeLight, blush, accentMaterial]

  function addMesh(parent: THREE.Object3D, geometry: THREE.BufferGeometry, material: THREE.Material) {
    const mesh = new THREE.Mesh(geometry, material)
    mesh.castShadow = true
    mesh.receiveShadow = true
    parent.add(mesh)
    return mesh
  }

  function oval(parent: THREE.Object3D, material: THREE.Material, position: [number, number, number], scale: [number, number, number], segments = 32) {
    const mesh = addMesh(parent, new THREE.SphereGeometry(1, segments, 24), material)
    mesh.position.set(...position)
    mesh.scale.set(...scale)
    return mesh
  }

  // One continuous surface runs from the rounded belly into the slim neck.
  // Each profile row is [height, width radius, depth radius, depth center].
  // Moving the center forward creates the breast and the gentle neck curve
  // without intersecting spheres or a visible seam across the chest.
  const profile = [
    [.32, 0, 0, -.09],
    [.40, .31, .40, -.10],
    [.57, .50, .65, -.11],
    [.84, .60, .79, -.09],
    [1.09, .58, .76, -.045],
    [1.31, .48, .62, .035],
    [1.49, .35, .43, .18],
    [1.67, .245, .275, .30],
    [1.87, .204, .207, .325],
    [2.09, .185, .187, .315],
    [2.29, .184, .182, .34],
    [2.43, .18, .178, .37],
    [2.51, 0, 0, .37],
  ]
  const ringSides = 48, rowsPerSection = 8
  const ringCount = (profile.length - 1) * rowsPerSection + 1
  const positions: number[] = [], indices: number[] = []
  const interpolate = (a: number, b: number, c: number, d: number, t: number) =>
    .5 * ((2 * b) + (-a + c) * t + (2 * a - 5 * b + 4 * c - d) * t * t + (-a + 3 * b - 3 * c + d) * t * t * t)
  for (let row = 0; row < ringCount; row++) {
    const section = Math.min(profile.length - 2, Math.floor(row / rowsPerSection))
    const t = (row - section * rowsPerSection) / rowsPerSection
    const p0 = profile[Math.max(0, section - 1)], p1 = profile[section]
    const p2 = profile[section + 1], p3 = profile[Math.min(profile.length - 1, section + 2)]
    const values = p1.map((_, axis) => interpolate(p0[axis], p1[axis], p2[axis], p3[axis], t))
    const [height, radiusX, radiusZ, centerZ] = values
    for (let side = 0; side <= ringSides; side++) {
      const angle = side / ringSides * Math.PI * 2
      positions.push(Math.cos(angle) * Math.max(0, radiusX), height, centerZ + Math.sin(angle) * Math.max(0, radiusZ))
      if (row < ringCount - 1 && side < ringSides) {
        const a = row * (ringSides + 1) + side, b = a + ringSides + 1
        indices.push(a, b, a + 1, b, b + 1, a + 1)
      }
    }
  }
  const bodyGeometry = new THREE.BufferGeometry()
  bodyGeometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3))
  bodyGeometry.setIndex(indices)
  bodyGeometry.computeVertexNormals()
  // Weld the lighting across the duplicated radial seam.
  const normals = bodyGeometry.attributes.normal
  const seamNormal = new THREE.Vector3()
  for (let row = 0; row < ringCount; row++) {
    const first = row * (ringSides + 1), last = first + ringSides
    seamNormal.set(normals.getX(first) + normals.getX(last), normals.getY(first) + normals.getY(last), normals.getZ(first) + normals.getZ(last)).normalize()
    normals.setXYZ(first, seamNormal.x, seamNormal.y, seamNormal.z)
    normals.setXYZ(last, seamNormal.x, seamNormal.y, seamNormal.z)
  }
  const neck = addMesh(goose, bodyGeometry, white)

  // Slim folded wings follow the long side of the body and taper at the rump.
  for (const side of [-1, 1]) {
    const wingGeometry = new THREE.SphereGeometry(1, 40, 28)
    const vertices = wingGeometry.attributes.position
    for (let i = 0; i < vertices.count; i++) {
      const x = vertices.getX(i), y = vertices.getY(i), z = vertices.getZ(i)
      const breadth = .56 + .44 * (z + 1) / 2
      vertices.setXYZ(i, x * .085, y * .265 * breadth + z * .09, z * .66)
    }
    wingGeometry.computeVertexNormals()
    const wing = addMesh(goose, wingGeometry, wingWhite)
    wing.position.set(side * .515, 1.04, -.18)
    wing.rotation.z = side * .10

    // Two subtle feather lines add texture without a stack of separate lobes.
    for (let feather = 0; feather < 2; feather++) {
      const points = [[.24, .02], [-.15, .04], [-.58, .08]].map(([z, offset]) => {
        const y = offset + feather * .32
        const breadth = .56 + .44 * (z + 1) / 2
        return new THREE.Vector3(
          side * (.085 * Math.sqrt(1 - y * y - z * z) + .001),
          y * .265 * breadth + z * .09,
          z * .66,
        )
      })
      const curve = new THREE.CatmullRomCurve3(points)
      addMesh(wing, new THREE.TubeGeometry(curve, 12, .004, 5, false), featherWhite)
    }
  }

  // The upward tail joins the rump, with a rounded tip instead of a cone.
  const tail = oval(goose, white, [0, 1.13, -.77], [.235, .19, .39])
  tail.rotation.x = .42

  // Short legs enter the belly. Wide, softly bevelled feet give a stable stance.
  for (const side of [-1, 1]) {
    const leg = oval(goose, billLower, [side * .24, .28, -.005], [.066, .24, .072])
    leg.rotation.x = -.12
    const footShape = new THREE.Shape()
    footShape.moveTo(-.068, -.10)
    footShape.quadraticCurveTo(-.09, -.04, -.18, .19)
    footShape.quadraticCurveTo(-.205, .27, -.11, .255)
    footShape.quadraticCurveTo(-.075, .25, -.052, .24)
    footShape.quadraticCurveTo(0, .32, .05, .245)
    footShape.quadraticCurveTo(.11, .28, .17, .25)
    footShape.quadraticCurveTo(.205, .23, .17, .17)
    footShape.lineTo(.07, -.10)
    footShape.quadraticCurveTo(0, -.145, -.068, -.10)
    const foot = addMesh(goose, new THREE.ExtrudeGeometry(footShape, {
      depth: .035, steps: 1, curveSegments: 12,
      bevelEnabled: true, bevelThickness: .025, bevelSize: .023, bevelSegments: 3,
    }), orange)
    foot.rotation.x = Math.PI / 2
    foot.rotation.z = -side * .12
    foot.position.set(side * .25, .105, .055)
  }

  const head = new THREE.Group()
  head.position.set(0, 2.40, .37)
  goose.add(head)
  oval(head, white, [0, .155, .045], [.32, .37, .335], 48)

  // A closed, curved bill: a broad soft bridge tapering toward a rounded tip.
  // Flattening the underside gives it a beak silhouette rather than a snout.
  const upperBillGeometry = new THREE.SphereGeometry(1, 40, 28)
  const billVertices = upperBillGeometry.attributes.position
  for (let i = 0; i < billVertices.count; i++) {
    const x = billVertices.getX(i), y = billVertices.getY(i), z = billVertices.getZ(i)
    const t = (z + 1) / 2
    billVertices.setXYZ(i, x * .205 * (1 - t * .23), y * (y > 0 ? .102 : .014) + t * .015, z * .265)
  }
  upperBillGeometry.computeVertexNormals()
  const upperBill = addMesh(head, upperBillGeometry, orange)
  upperBill.position.set(0, .083, .427)
  oval(head, mouth, [0, .071, .434], [.18, .009, .245])
  oval(head, billLower, [0, .041, .426], [.178, .033, .247])

  for (const side of [-1, 1]) {
    const eye = oval(head, eyes, [side * .235, .253, .263], [.055, .071, .027])
    eye.rotation.y = side * .64
    // Eye-local highlights stay attached to its curved surface at every angle.
    oval(eye, eyeLight, [-.23, .31, .925], [.22, .22, .085], 20)
    oval(eye, eyeLight, [.21, -.25, .945], [.09, .09, .05], 16)
    const cheek = oval(head, blush, [side * .269, .118, .217], [.046, .024, .009], 24)
    cheek.rotation.y = side * .8
    const nostril = oval(head, mouth, [side * .091, .175, .437], [.014, .007, .022], 20)
    nostril.rotation.z = -side * .25
  }

  // A tiny swept crown feather gives the face a friendly, memorable outline.
  const crown = oval(head, white, [-.065, .455, -.015], [.085, .155, .095])
  crown.rotation.z = -.45
  crown.rotation.x = -.25

  // Soft neckerchief, integrated into the lower neck, with a side knot and tail.
  const scarf = addMesh(goose, new THREE.TorusGeometry(.224, .043, 12, 48), accentMaterial)
  scarf.position.set(0, 1.97, .317)
  scarf.rotation.x = Math.PI / 2 + .07
  oval(goose, accentMaterial, [.215, 1.95, .39], [.07, .064, .07])
  const scarfEnd = oval(goose, accentMaterial, [.242, 1.78, .405], [.063, .18, .027])
  scarfEnd.rotation.z = -.2
  scarfEnd.rotation.x = -.18

  return { goose, head, neck, accentMaterial, materials }
}
