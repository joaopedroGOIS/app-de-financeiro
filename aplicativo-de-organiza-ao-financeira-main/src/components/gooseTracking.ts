/** Pointer offsets use screen coordinates: positive Y points down. */
export function gooseLookRotation(x: number, y: number, cameraYaw: number, bodyYaw: number) {
  const clamp = (value: number, limit: number) => Math.max(-limit, Math.min(limit, value))
  const relativeYaw = Math.atan2(Math.sin(cameraYaw - bodyYaw), Math.cos(cameraYaw - bodyYaw))
  return {
    yaw: clamp(relativeYaw + clamp(x, 1) * .8, .95),
    pitch: clamp(y, 1) * .42,
    roll: -clamp(x, 1) * .055,
  }
}
