<template>
  <canvas id="neural-canvas" ref="canvasRef"></canvas>
</template>

<script setup>
import { ref, onMounted, onUnmounted, watch } from 'vue';
import fragSrc from '../shaders/hypnagogic_delta_waves.glsl?raw';

const props = defineProps({ stage: { type: Number, default: 0 } });
const canvasRef = ref(null);
let raf = null;
let gl = null;
let prog = null;
let uTime = null, uStage = null, uRes = null, uMouse = null;
let resizeHandler, moveHandler;
const mouse = { x: 0.5, y: 0.5 };

const VERT = `#version 300 es
layout(location=0) in vec2 a_pos;
void main(){ gl_Position = vec4(a_pos, 0.0, 1.0); }`;

function compile(type, src) {
  const s = gl.createShader(type);
  gl.shaderSource(s, src);
  gl.compileShader(s);
  if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) {
    console.warn(gl.getShaderInfoLog(s));
  }
  return s;
}

function init() {
  const canvas = canvasRef.value;
  if (!canvas) return;
  gl = canvas.getContext('webgl2', { antialias: false, alpha: false });
  if (!gl) return;
  const vs = compile(gl.VERTEX_SHADER, VERT);
  const fs = compile(gl.FRAGMENT_SHADER, fragSrc);
  prog = gl.createProgram();
  gl.attachShader(prog, vs);
  gl.attachShader(prog, fs);
  gl.linkProgram(prog);
  gl.useProgram(prog);
  const buf = gl.createBuffer();
  gl.bindBuffer(gl.ARRAY_BUFFER, buf);
  gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 3, -1, -1, 3]), gl.STATIC_DRAW);
  gl.enableVertexAttribArray(0);
  gl.vertexAttribPointer(0, 2, gl.FLOAT, false, 0, 0);
  uTime = gl.getUniformLocation(prog, 'u_time');
  uStage = gl.getUniformLocation(prog, 'u_stage');
  uRes = gl.getUniformLocation(prog, 'u_res');
  uMouse = gl.getUniformLocation(prog, 'u_mouse');
  const resize = () => {
    canvas.width = Math.floor(window.innerWidth * 0.5);
    canvas.height = Math.floor(window.innerHeight * 0.5);
    gl.viewport(0, 0, canvas.width, canvas.height);
  };
  resize();
  resizeHandler = resize;
  window.addEventListener('resize', resizeHandler);
  const onMove = (e) => {
    mouse.x = e.clientX / window.innerWidth;
    mouse.y = 1 - e.clientY / window.innerHeight;
  };
  moveHandler = onMove;
  window.addEventListener('pointermove', moveHandler);
  const t0 = performance.now();
  const loop = (now) => {
    gl.uniform1f(uTime, (now - t0) / 1000);
    gl.uniform1f(uStage, props.stage);
    gl.uniform2f(uRes, canvas.width, canvas.height);
    gl.uniform2f(uMouse, mouse.x, mouse.y);
    gl.drawArrays(gl.TRIANGLES, 0, 3);
    raf = requestAnimationFrame(loop);
  };
  raf = requestAnimationFrame(loop);
}

onMounted(init);
onUnmounted(() => {
  if (raf) cancelAnimationFrame(raf);
  if (resizeHandler) window.removeEventListener('resize', resizeHandler);
  if (moveHandler) window.removeEventListener('pointermove', moveHandler);
});
watch(() => props.stage, () => {});
</script>
