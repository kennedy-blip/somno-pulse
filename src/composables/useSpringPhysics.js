// useSpringPhysics.js — Hooke's law spring differential equation composable.
// stiffness: 290, damping: 26, mass: 0.85 (per spec).
// Pure ES2024 JavaScript — zero TypeScript.
import { ref, onUnmounted } from 'vue';

export function createSpring({ stiffness = 290, damping = 26, mass = 0.85 } = {}) {
  const value = ref(0);
  const velocity = ref(0);
  const target = ref(0);
  let raf = null;
  let last = 0;

  function step(now) {
    if (!last) last = now;
    const dt = Math.min((now - last) / 1000, 0.033);
    last = now;
    const force = -stiffness * (value.value - target.value) - damping * velocity.value;
    const accel = force / mass;
    velocity.value += accel * dt;
    value.value += velocity.value * dt;
    if (Math.abs(value.value - target.value) < 0.0005 && Math.abs(velocity.value) < 0.0005) {
      value.value = target.value;
      velocity.value = 0;
      raf = null;
      return;
    }
    raf = requestAnimationFrame(step);
  }

  function setTarget(t) {
    target.value = t;
    if (raf == null) {
      last = 0;
      raf = requestAnimationFrame(step);
    }
  }

  function snap(v) {
    value.value = v;
    target.value = v;
    velocity.value = 0;
  }

  onUnmounted(() => {
    if (raf != null) cancelAnimationFrame(raf);
    raf = null;
  });

  return { value, velocity, target, setTarget, snap };
}

// Convenience: spring-driven numeric display + scale for cards/rings.
export function useSpringPhysics(options) {
  return createSpring(options);
}
