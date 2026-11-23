// hypnagogic_delta_waves.glsl — WebGL2 Delta/Theta Neural Sleep-Wave Shader
// Uniforms: u_time, u_stage (0=N3 deep, 1=REM, 2=arousal), u_res
precision highp float;
uniform float u_time;
uniform float u_stage;
uniform vec2 u_res;
uniform vec2 u_mouse;

float wave(vec2 uv, float t, float freq) {
  return sin(uv.x * freq + sin(uv.y * 3.0 + t * 0.6) * 1.4 + t * freq * 0.35);
}

void main() {
  vec2 uv = (gl_FragCoord.xy / u_res) * 2.0 - 1.0;
  uv.x *= u_res.x / u_res.y;
  float t = u_time * (u_stage > 1.5 ? 2.4 : u_stage > 0.5 ? 1.3 : 0.55);
  vec2 m = (u_mouse * 2.0 - 1.0);
  m.x *= u_res.x / u_res.y;
  float d = length(uv - m * 0.35);

  float w1 = wave(uv, t, 3.0 + u_stage * 2.0);
  float w2 = wave(uv * 1.7, t * 0.7, 5.0);
  float glow = exp(-d * 1.6) * 0.55;
  float v = 0.5 + 0.28 * w1 + 0.22 * w2 + glow;

  vec3 deep = vec3(0.02, 0.71, 0.83) * 0.35 + vec3(0.08, 0.72, 0.65) * 0.3 + vec3(0.23, 0.51, 0.96) * 0.35;
  vec3 rem = vec3(0.55, 0.36, 0.96) * 0.4 + vec3(0.66, 0.33, 0.97) * 0.3 + vec3(0.96, 0.62, 0.04) * 0.3;
  vec3 arousal = vec3(0.94, 0.27, 0.27) * 0.45 + vec3(0.96, 0.25, 0.37) * 0.3 + vec3(0.98, 0.45, 0.09) * 0.25;

  vec3 col = u_stage < 0.5 ? deep : u_stage < 1.5 ? rem : arousal;
  col *= (0.35 + v * 0.9);
  col += glow * vec3(0.4, 0.9, 1.0) * 0.25;
  float vign = smoothstep(1.6, 0.2, length(uv));
  col *= mix(0.55, 1.0, vign);
  gl_FragColor = vec4(col, 1.0);
}
