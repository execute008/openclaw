/**
 * Halls of Creation - Atmosphere System
 *
 * Fog, volumetric lighting effects, and ambient atmosphere.
 */

import * as THREE from "three";
import { HALLS_COLORS, type HallsConfig } from "../data/types";

export class AtmosphereSystem {
  private scene: THREE.Scene;
  private config: HallsConfig;

  // Light shafts
  private lightShafts: THREE.Mesh[] = [];
  private lightShaftMaterial: THREE.ShaderMaterial;

  constructor(scene: THREE.Scene, config: HallsConfig) {
    this.scene = scene;
    this.config = config;

    // Setup fog
    if (config.enableFog) {
      this.scene.fog = new THREE.FogExp2(HALLS_COLORS.bgDeep, config.fogDensity);
    }

    // Create light shaft shader
    this.lightShaftMaterial = new THREE.ShaderMaterial({
      uniforms: {
        time: { value: 0 },
        color: { value: new THREE.Color(HALLS_COLORS.secondary) },
        opacity: { value: 0.15 },
      },
      vertexShader: `
        varying vec2 vUv;
        varying vec3 vPosition;
        void main() {
          vUv = uv;
          vPosition = position;
          gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
        }
      `,
      fragmentShader: `
        uniform float time;
        uniform vec3 color;
        uniform float opacity;
        varying vec2 vUv;
        varying vec3 vPosition;
        
        void main() {
          // Gradient from bottom to top
          float gradient = 1.0 - vUv.y;
          gradient = pow(gradient, 2.0);
          
          // Horizontal variation
          float noise = sin(vUv.x * 10.0 + time) * 0.1 + 0.9;
          
          // Shimmer effect
          float shimmer = sin(time * 2.0 + vPosition.y * 0.5) * 0.2 + 0.8;
          
          float alpha = gradient * noise * shimmer * opacity;
          gl_FragColor = vec4(color, alpha);
        }
      `,
      transparent: true,
      side: THREE.DoubleSide,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
    });

    this.createLightShafts();
  }

  /**
   * Create volumetric light shaft effects.
   */
  private createLightShafts() {
    // Light shaft positions (from ceiling lights)
    const shaftPositions = [
      { x: 0, z: 0, scale: 1.2 },
      { x: 10, z: 10, scale: 0.8 },
      { x: -10, z: 10, scale: 0.8 },
      { x: 10, z: -10, scale: 0.8 },
      { x: -10, z: -10, scale: 0.8 },
    ];

    shaftPositions.forEach((pos) => {
      const geometry = new THREE.ConeGeometry(3 * pos.scale, 15, 32, 1, true);
      const material = this.lightShaftMaterial.clone();
      const shaft = new THREE.Mesh(geometry, material);
      shaft.position.set(pos.x, 10, pos.z);
      shaft.rotation.x = Math.PI; // Point downward
      this.scene.add(shaft);
      this.lightShafts.push(shaft);
    });
  }

  /**
   * Update atmosphere effects.
   */
  update(delta: number) {
    // Update light shaft shaders
    this.lightShafts.forEach((shaft) => {
      const material = shaft.material as THREE.ShaderMaterial;
      material.uniforms.time.value += delta;
    });

    // Subtle fog density variation
    if (this.scene.fog instanceof THREE.FogExp2) {
      const baseDensity = this.config.fogDensity;
      const variation = Math.sin(Date.now() * 0.0005) * 0.002;
      this.scene.fog.density = baseDensity + variation;
    }
  }

  /**
   * Update configuration.
   */
  updateConfig(config: HallsConfig) {
    this.config = config;

    if (config.enableFog) {
      if (!this.scene.fog) {
        this.scene.fog = new THREE.FogExp2(HALLS_COLORS.bgDeep, config.fogDensity);
      } else if (this.scene.fog instanceof THREE.FogExp2) {
        this.scene.fog.density = config.fogDensity;
      }
    } else {
      this.scene.fog = null;
    }
  }

  /**
   * Dispose of resources.
   */
  dispose() {
    this.lightShafts.forEach((shaft) => {
      this.scene.remove(shaft);
      shaft.geometry.dispose();
      (shaft.material as THREE.ShaderMaterial).dispose();
    });
    this.lightShafts = [];
  }
}
