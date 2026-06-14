// GLSL for the atmosphere sky shell, kept in its own module so three-scene stays
// small. A simplified single-scattering Rayleigh plus Mie limb glow.

export const ATMOSPHERE_VERTEX = /* glsl */ `
  varying vec3 vWorldNormal;
  varying vec3 vViewDir;
  void main() {
    vec4 worldPos = modelMatrix * vec4(position, 1.0);
    vWorldNormal = normalize(mat3(modelMatrix) * normal);
    vViewDir = normalize(cameraPosition - worldPos.xyz);
    gl_Position = projectionMatrix * viewMatrix * worldPos;
  }
`;

export const ATMOSPHERE_FRAGMENT = /* glsl */ `
  precision highp float;
  uniform vec3 uSunDirection;
  uniform vec3 uRayleigh;
  uniform vec3 uColor;
  uniform float uIntensity;
  varying vec3 vWorldNormal;
  varying vec3 vViewDir;

  void main() {
    // Limb brightening: glow strongest at the grazing edge (normal perpendicular
    // to the view), modulated by the sun illumination on that part of the shell.
    float rim = 1.0 - abs(dot(vWorldNormal, vViewDir));
    float limb = pow(clamp(rim, 0.0, 1.0), 2.5);
    float sun = clamp(dot(vWorldNormal, normalize(uSunDirection)) * 0.5 + 0.5, 0.0, 1.0);
    vec3 scatter = uColor * uRayleigh;
    float alpha = limb * sun * uIntensity;
    gl_FragColor = vec4(scatter * alpha, alpha);
  }
`;
