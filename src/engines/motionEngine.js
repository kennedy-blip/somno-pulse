// DeviceMotion visualization only. This is not a sleep-stage or medical sensor.
const GRAVITY = 9.80665;

export function motionMagnitudeMg(acceleration) {
  if (!acceleration || !['x', 'y', 'z'].every((key) => Number.isFinite(acceleration[key]))) return null;
  return Math.hypot(acceleration.x, acceleration.y, acceleration.z) / GRAVITY * 1000;
}

export class MotionEngine {
  constructor(target = window, onStatus = () => {}) {
    this.target = target;
    this.onStatus = onStatus;
    this.active = false;
    this.lastMg = null;
    this.lastTime = 0;
    this.gravity = null;
    this.generation = 0;
    this.timer = null;
    this.handleMotion = this.handleMotion.bind(this);
  }

  async start() {
    this.stop();
    const generation = this.generation;
    const Motion = this.target.DeviceMotionEvent;
    if (!Motion) { this.onStatus('Motion sensors are unavailable in this browser.'); return; }
    try {
      if (typeof Motion.requestPermission === 'function') {
        const result = await Motion.requestPermission();
        if (generation !== this.generation) return;
        if (result !== 'granted') { this.onStatus('Motion permission denied.'); return; }
      }
      if (generation !== this.generation) return;
      this.active = true;
      this.target.addEventListener('devicemotion', this.handleMotion);
      this.onStatus('Waiting for motion samples…');
      // Some desktop browsers expose the API but have no sensor or never dispatch data.
      this.timer = setTimeout(() => {
        if (this.active && !this.lastTime) this.onStatus('No motion data received. Check sensor permissions and device support.');
      }, 5000);
    } catch (error) {
      if (generation === this.generation) this.onStatus(`Motion unavailable: ${error.message}`);
    }
  }

  handleMotion(event) {
    let acceleration = event.acceleration;
    if (!acceleration || !['x', 'y', 'z'].every((key) => Number.isFinite(acceleration[key]))) {
      const raw = event.accelerationIncludingGravity;
      if (!raw || !['x', 'y', 'z'].every((key) => Number.isFinite(raw[key]))) return;
      // Approximate gravity removal when only the including-gravity sensor is available.
      if (!this.gravity) this.gravity = { x: raw.x, y: raw.y, z: raw.z };
      acceleration = {};
      for (const key of ['x', 'y', 'z']) {
        this.gravity[key] = 0.9 * this.gravity[key] + 0.1 * raw[key];
        acceleration[key] = raw[key] - this.gravity[key];
      }
    }
    const magnitude = motionMagnitudeMg(acceleration);
    if (magnitude === null) return;
    const first = !this.lastTime;
    this.lastMg = magnitude;
    this.lastTime = Date.now();
    if (first) this.onStatus('Motion sensor active · magnitude in milli-g (not sleep staging).');
  }

  sample(now = Date.now()) {
    return this.active && this.lastTime && now - this.lastTime < 2000 ? this.lastMg : null;
  }

  stop() {
    this.generation++;
    if (this.active) this.target.removeEventListener('devicemotion', this.handleMotion);
    clearTimeout(this.timer);
    this.timer = null;
    this.active = false;
    this.gravity = null;
    this.lastMg = null;
    this.lastTime = 0;
  }
}
