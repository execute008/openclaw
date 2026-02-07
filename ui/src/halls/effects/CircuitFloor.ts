/**
 * Halls of Creation - Circuit Floor Pattern
 *
 * Animated glowing circuit patterns on the floor.
 * Inspired by Tron Legacy's grid aesthetics.
 */

import * as THREE from "three";
import { HALLS_COLORS } from "../data/types";

export class CircuitFloor {
  private scene: THREE.Scene;
  private mesh: THREE.Mesh;
  private material: THREE.ShaderMaterial;

  constructor(scene: THREE.Scene) {
    this.scene = scene;

    // Create shader material for animated circuit pattern
    this.material = new THREE.ShaderMaterial({
      uniforms: {
        time: { value: 0 },
        primaryColor: { value: new THREE.Color(HALLS_COLORS.secondary) },
        secondaryColor: { value: new THREE.Color(HALLS_COLORS.primary) },
        gridSize: { value: 20.0 },
        lineWidth: { value: 0.02 },
        pulseSpeed: { value: 1.0 },
        glowIntensity: { value: 0.5 },
      },
      vertexShader: `
        varying vec2 vUv;
        varying vec3 vWorldPos;
        
        void main() {
          vUv = uv;
          vec4 worldPos = modelMatrix * vec4(position, 1.0);
          vWorldPos = worldPos.xyz;
          gl_Position = projectionMatrix * viewMatrix * worldPos;
        }
      `,
      fragmentShader: `
        uniform float time;
        uniform vec3 primaryColor;
        uniform vec3 secondaryColor;
        uniform float gridSize;
        uniform float lineWidth;
        uniform float pulseSpeed;
        uniform float glowIntensity;
        
        varying vec2 vUv;
        varying vec3 vWorldPos;
        
        // Pseudo-random function
        float random(vec2 st) {
          return fract(sin(dot(st.xy, vec2(12.9898, 78.233))) * 43758.5453123);
        }
        
        // Grid pattern
        float grid(vec2 uv, float width) {
          vec2 grid = abs(fract(uv - 0.5) - 0.5) / fwidth(uv);
          float line = min(grid.x, grid.y);
          return 1.0 - min(line, 1.0);
        }
        
        // Circuit node pattern
        float circuitNode(vec2 uv, float size) {
          vec2 nodeUv = fract(uv * gridSize);
          vec2 nodeId = floor(uv * gridSize);
          
          // Random node probability
          float prob = random(nodeId);
          if (prob > 0.85) {
            float dist = length(nodeUv - 0.5);
            return smoothstep(size + 0.02, size, dist);
          }
          return 0.0;
        }
        
        // Animated pulse along lines
        float pulse(vec2 uv, float speed) {
          vec2 gridUv = fract(uv * gridSize);
          vec2 gridId = floor(uv * gridSize);
          
          // Pulse direction based on grid cell
          float dir = random(gridId) > 0.5 ? 1.0 : -1.0;
          float offset = random(gridId + 0.5) * 6.28;
          
          // Create moving pulse
          float pulse = sin((gridUv.x + gridUv.y) * 3.14159 + time * speed * dir + offset);
          pulse = smoothstep(0.3, 0.8, pulse);
          
          return pulse;
        }
        
        void main() {
          vec2 worldUv = vWorldPos.xz * 0.1;
          
          // Base grid
          float gridPattern = grid(worldUv * gridSize, lineWidth);
          
          // Circuit nodes
          float nodes = circuitNode(worldUv, 0.08);
          
          // Animated pulse
          float pulseEffect = pulse(worldUv, pulseSpeed);
          
          // Distance fade from center
          float distFromCenter = length(vWorldPos.xz);
          float centerFade = 1.0 - smoothstep(5.0, 40.0, distFromCenter);
          
          // Combine effects
          float pattern = gridPattern * 0.3 + nodes * 0.8;
          pattern += pulseEffect * gridPattern * 0.5;
          pattern *= centerFade;
          
          // Color mixing
          vec3 color = mix(primaryColor, secondaryColor, pulseEffect);
          color *= glowIntensity;
          
          // Final output
          float alpha = pattern * 0.6;
          gl_FragColor = vec4(color, alpha);
        }
      `,
      transparent: true,
      side: THREE.DoubleSide,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
    });

    // Create floor plane
    const geometry = new THREE.PlaneGeometry(100, 100, 1, 1);
    this.mesh = new THREE.Mesh(geometry, this.material);
    this.mesh.rotation.x = -Math.PI / 2;
    this.mesh.position.y = 0.01; // Slightly above main floor
    this.scene.add(this.mesh);
  }

  /**
   * Update animation time.
   */
  update(elapsed: number) {
    this.material.uniforms.time.value = elapsed;
  }

  /**
   * Set glow intensity (0-1).
   */
  setIntensity(value: number) {
    this.material.uniforms.glowIntensity.value = Math.max(0.1, Math.min(1, value));
  }

  /**
   * Dispose of resources.
   */
  dispose() {
    this.scene.remove(this.mesh);
    this.mesh.geometry.dispose();
    this.material.dispose();
  }
}
