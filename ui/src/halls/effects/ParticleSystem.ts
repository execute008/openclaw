/**
 * Halls of Creation - Particle System
 *
 * Floating particles that add life and atmosphere to the space.
 * Intensity responds to workflow activity.
 */

import * as THREE from "three";
import { HALLS_COLORS, type HallsConfig } from "../data/types";

interface Particle {
  position: THREE.Vector3;
  velocity: THREE.Vector3;
  life: number;
  maxLife: number;
  size: number;
}

export class ParticleSystem {
  private scene: THREE.Scene;
  private config: HallsConfig;
  private particles: Particle[] = [];
  private geometry: THREE.BufferGeometry;
  private material: THREE.PointsMaterial;
  private points: THREE.Points;
  private intensity = 0.5;

  constructor(scene: THREE.Scene, config: HallsConfig) {
    this.scene = scene;
    this.config = config;

    // Create particle geometry
    this.geometry = new THREE.BufferGeometry();
    const positions = new Float32Array(config.particleCount * 3);
    const sizes = new Float32Array(config.particleCount);
    const colors = new Float32Array(config.particleCount * 3);

    // Initialize particles
    const baseColor = new THREE.Color(HALLS_COLORS.particle);
    const secondaryColor = new THREE.Color(HALLS_COLORS.hologram);

    for (let i = 0; i < config.particleCount; i++) {
      // Random position within bounds
      const x = (Math.random() - 0.5) * 60;
      const y = Math.random() * 15 + 1;
      const z = (Math.random() - 0.5) * 60;

      positions[i * 3] = x;
      positions[i * 3 + 1] = y;
      positions[i * 3 + 2] = z;

      sizes[i] = Math.random() * 2 + 0.5;

      // Mix colors
      const colorMix = Math.random();
      const color = baseColor.clone().lerp(secondaryColor, colorMix);
      colors[i * 3] = color.r;
      colors[i * 3 + 1] = color.g;
      colors[i * 3 + 2] = color.b;

      this.particles.push({
        position: new THREE.Vector3(x, y, z),
        velocity: new THREE.Vector3(
          (Math.random() - 0.5) * 0.5,
          (Math.random() - 0.3) * 0.2,
          (Math.random() - 0.5) * 0.5,
        ),
        life: Math.random() * 10,
        maxLife: 10 + Math.random() * 5,
        size: sizes[i],
      });
    }

    this.geometry.setAttribute("position", new THREE.BufferAttribute(positions, 3));
    this.geometry.setAttribute("size", new THREE.BufferAttribute(sizes, 1));
    this.geometry.setAttribute("color", new THREE.BufferAttribute(colors, 3));

    // Create material with custom shader for variable sizes
    this.material = new THREE.PointsMaterial({
      size: 0.15,
      sizeAttenuation: true,
      transparent: true,
      opacity: 0.6,
      vertexColors: true,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
    });

    this.points = new THREE.Points(this.geometry, this.material);
    this.scene.add(this.points);
  }

  /**
   * Set particle intensity (0-1).
   */
  setIntensity(value: number) {
    this.intensity = Math.max(0, Math.min(1, value));
    this.material.opacity = 0.3 + this.intensity * 0.5;
  }

  /**
   * Update particle positions.
   */
  update(delta: number, camera: THREE.Camera) {
    const positions = this.geometry.attributes.position.array as Float32Array;
    const sizes = this.geometry.attributes.size.array as Float32Array;
    const cameraPos = camera.position;

    for (let i = 0; i < this.particles.length; i++) {
      const particle = this.particles[i];

      // Update life
      particle.life += delta;

      // Respawn if life exceeded
      if (particle.life > particle.maxLife) {
        this.respawnParticle(particle, cameraPos);
      }

      // Apply velocity with intensity modulation
      const speedMultiplier = 0.5 + this.intensity * 0.5;
      particle.position.x += particle.velocity.x * delta * speedMultiplier;
      particle.position.y += particle.velocity.y * delta * speedMultiplier;
      particle.position.z += particle.velocity.z * delta * speedMultiplier;

      // Add slight upward drift
      particle.position.y += delta * 0.1 * this.intensity;

      // Add subtle swirl
      const swirl = Math.sin(particle.life * 2) * 0.01;
      particle.position.x += swirl;
      particle.position.z += Math.cos(particle.life * 2) * 0.01;

      // Boundary check
      if (Math.abs(particle.position.x) > 35) {
        particle.position.x = -Math.sign(particle.position.x) * 35;
      }
      if (particle.position.y > 18 || particle.position.y < 0.5) {
        particle.position.y = 1 + Math.random() * 5;
      }
      if (Math.abs(particle.position.z) > 35) {
        particle.position.z = -Math.sign(particle.position.z) * 35;
      }

      // Update geometry
      positions[i * 3] = particle.position.x;
      positions[i * 3 + 1] = particle.position.y;
      positions[i * 3 + 2] = particle.position.z;

      // Pulse size based on life
      const lifeRatio = particle.life / particle.maxLife;
      const pulse = Math.sin(lifeRatio * Math.PI) * 0.5 + 0.5;
      sizes[i] = particle.size * pulse * (0.5 + this.intensity * 0.5);
    }

    this.geometry.attributes.position.needsUpdate = true;
    this.geometry.attributes.size.needsUpdate = true;
  }

  /**
   * Respawn a particle near the camera or at a random location.
   */
  private respawnParticle(particle: Particle, cameraPos: THREE.Vector3) {
    // 30% chance to spawn near camera, 70% random
    if (Math.random() < 0.3) {
      particle.position.set(
        cameraPos.x + (Math.random() - 0.5) * 20,
        Math.random() * 10 + 2,
        cameraPos.z + (Math.random() - 0.5) * 20,
      );
    } else {
      particle.position.set(
        (Math.random() - 0.5) * 60,
        Math.random() * 15 + 1,
        (Math.random() - 0.5) * 60,
      );
    }

    particle.velocity.set(
      (Math.random() - 0.5) * 0.5,
      (Math.random() - 0.3) * 0.2,
      (Math.random() - 0.5) * 0.5,
    );

    particle.life = 0;
    particle.maxLife = 10 + Math.random() * 5;
  }

  /**
   * Update configuration.
   */
  updateConfig(config: HallsConfig) {
    this.config = config;

    if (!config.enableParticles) {
      this.points.visible = false;
    } else {
      this.points.visible = true;
    }
  }

  /**
   * Dispose of resources.
   */
  dispose() {
    this.scene.remove(this.points);
    this.geometry.dispose();
    this.material.dispose();
  }
}
