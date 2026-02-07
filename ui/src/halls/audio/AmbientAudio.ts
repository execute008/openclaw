/**
 * Halls of Creation - Ambient Audio System
 *
 * Generates procedural ambient soundscape using Web Audio API.
 * No external audio files required - creates atmosphere through synthesis.
 */

import type { HallsConfig } from "../data/types";

export class AmbientAudio {
  private config: HallsConfig;
  private audioContext: AudioContext | null = null;
  private masterGain: GainNode | null = null;
  private isPlaying = false;

  // Oscillators and nodes for ambient sound
  private droneOsc: OscillatorNode | null = null;
  private droneGain: GainNode | null = null;
  private subOsc: OscillatorNode | null = null;
  private subGain: GainNode | null = null;
  private noiseSource: AudioBufferSourceNode | null = null;
  private noiseGain: GainNode | null = null;
  private filterNode: BiquadFilterNode | null = null;

  // LFOs for modulation
  private lfoOsc: OscillatorNode | null = null;
  private lfoGain: GainNode | null = null;

  constructor(config: HallsConfig) {
    this.config = config;
  }

  /**
   * Start ambient audio.
   */
  async start() {
    if (this.isPlaying || !this.config.enableAudio) return;

    try {
      // Create audio context (requires user interaction first)
      this.audioContext = new AudioContext();

      // Master gain
      this.masterGain = this.audioContext.createGain();
      this.masterGain.gain.value = this.config.masterVolume * this.config.ambientVolume;
      this.masterGain.connect(this.audioContext.destination);

      // Create ambient layers
      this.createDroneLayer();
      this.createSubBassLayer();
      this.createNoiseLayer();
      this.createLFOModulation();

      this.isPlaying = true;

      // Fade in
      this.masterGain.gain.setValueAtTime(0, this.audioContext.currentTime);
      this.masterGain.gain.linearRampToValueAtTime(
        this.config.masterVolume * this.config.ambientVolume,
        this.audioContext.currentTime + 2,
      );
    } catch (err) {
      console.warn("[AmbientAudio] Failed to start:", err);
    }
  }

  /**
   * Create the main drone layer - low humming industrial sound.
   */
  private createDroneLayer() {
    if (!this.audioContext || !this.masterGain) return;

    // Main drone oscillator
    this.droneOsc = this.audioContext.createOscillator();
    this.droneOsc.type = "sawtooth";
    this.droneOsc.frequency.value = 55; // Low A

    // Drone gain
    this.droneGain = this.audioContext.createGain();
    this.droneGain.gain.value = 0.03;

    // Low-pass filter for warmth
    const filter = this.audioContext.createBiquadFilter();
    filter.type = "lowpass";
    filter.frequency.value = 200;
    filter.Q.value = 1;

    // Connect
    this.droneOsc.connect(filter);
    filter.connect(this.droneGain);
    this.droneGain.connect(this.masterGain);

    this.droneOsc.start();

    // Add a second detuned oscillator for richness
    const drone2 = this.audioContext.createOscillator();
    drone2.type = "sawtooth";
    drone2.frequency.value = 55.5; // Slightly detuned

    const gain2 = this.audioContext.createGain();
    gain2.gain.value = 0.02;

    drone2.connect(filter);
    drone2.start();
  }

  /**
   * Create sub-bass layer for depth.
   */
  private createSubBassLayer() {
    if (!this.audioContext || !this.masterGain) return;

    this.subOsc = this.audioContext.createOscillator();
    this.subOsc.type = "sine";
    this.subOsc.frequency.value = 30; // Sub bass

    this.subGain = this.audioContext.createGain();
    this.subGain.gain.value = 0.05;

    this.subOsc.connect(this.subGain);
    this.subGain.connect(this.masterGain);

    this.subOsc.start();
  }

  /**
   * Create filtered noise layer for atmosphere.
   */
  private createNoiseLayer() {
    if (!this.audioContext || !this.masterGain) return;

    // Generate noise buffer
    const bufferSize = this.audioContext.sampleRate * 2;
    const noiseBuffer = this.audioContext.createBuffer(1, bufferSize, this.audioContext.sampleRate);
    const output = noiseBuffer.getChannelData(0);

    for (let i = 0; i < bufferSize; i++) {
      output[i] = Math.random() * 2 - 1;
    }

    // Create noise source
    this.noiseSource = this.audioContext.createBufferSource();
    this.noiseSource.buffer = noiseBuffer;
    this.noiseSource.loop = true;

    // Band-pass filter for wind-like sound
    this.filterNode = this.audioContext.createBiquadFilter();
    this.filterNode.type = "bandpass";
    this.filterNode.frequency.value = 400;
    this.filterNode.Q.value = 0.5;

    // Noise gain
    this.noiseGain = this.audioContext.createGain();
    this.noiseGain.gain.value = 0.01;

    // Connect
    this.noiseSource.connect(this.filterNode);
    this.filterNode.connect(this.noiseGain);
    this.noiseGain.connect(this.masterGain);

    this.noiseSource.start();
  }

  /**
   * Create LFO for subtle modulation.
   */
  private createLFOModulation() {
    if (!this.audioContext || !this.droneGain || !this.filterNode) return;

    // LFO for drone volume modulation
    this.lfoOsc = this.audioContext.createOscillator();
    this.lfoOsc.type = "sine";
    this.lfoOsc.frequency.value = 0.1; // Very slow

    this.lfoGain = this.audioContext.createGain();
    this.lfoGain.gain.value = 0.005; // Subtle

    this.lfoOsc.connect(this.lfoGain);
    this.lfoGain.connect(this.droneGain.gain);

    this.lfoOsc.start();

    // LFO for filter modulation
    const filterLfo = this.audioContext.createOscillator();
    filterLfo.type = "sine";
    filterLfo.frequency.value = 0.05;

    const filterLfoGain = this.audioContext.createGain();
    filterLfoGain.gain.value = 100;

    filterLfo.connect(filterLfoGain);
    filterLfoGain.connect(this.filterNode.frequency);

    filterLfo.start();
  }

  /**
   * Play a notification chime.
   */
  playNotification() {
    if (!this.audioContext || !this.masterGain || !this.config.enableAudio) return;

    const now = this.audioContext.currentTime;

    // Create a short melodic chime
    const osc = this.audioContext.createOscillator();
    osc.type = "sine";
    osc.frequency.value = 880; // A5

    const gain = this.audioContext.createGain();
    gain.gain.value = 0;

    // Envelope
    gain.gain.setValueAtTime(0, now);
    gain.gain.linearRampToValueAtTime(this.config.effectsVolume * 0.1, now + 0.01);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.5);

    // Pitch slide
    osc.frequency.setValueAtTime(880, now);
    osc.frequency.linearRampToValueAtTime(1320, now + 0.1);

    osc.connect(gain);
    gain.connect(this.masterGain);

    osc.start(now);
    osc.stop(now + 0.5);
  }

  /**
   * Play a completion sound.
   */
  playCompletion() {
    if (!this.audioContext || !this.masterGain || !this.config.enableAudio) return;

    const now = this.audioContext.currentTime;

    // Create ascending arpeggio
    const notes = [440, 554, 659, 880]; // A4, C#5, E5, A5

    notes.forEach((freq, i) => {
      const osc = this.audioContext!.createOscillator();
      osc.type = "triangle";
      osc.frequency.value = freq;

      const gain = this.audioContext!.createGain();
      gain.gain.value = 0;

      const startTime = now + i * 0.1;
      gain.gain.setValueAtTime(0, startTime);
      gain.gain.linearRampToValueAtTime(this.config.effectsVolume * 0.08, startTime + 0.02);
      gain.gain.exponentialRampToValueAtTime(0.001, startTime + 0.3);

      osc.connect(gain);
      gain.connect(this.masterGain!);

      osc.start(startTime);
      osc.stop(startTime + 0.3);
    });
  }

  /**
   * Play an error sound.
   */
  playError() {
    if (!this.audioContext || !this.masterGain || !this.config.enableAudio) return;

    const now = this.audioContext.currentTime;

    const osc = this.audioContext.createOscillator();
    osc.type = "square";
    osc.frequency.value = 200;

    const gain = this.audioContext.createGain();
    gain.gain.value = 0;

    // Harsh attack, quick decay
    gain.gain.setValueAtTime(0, now);
    gain.gain.linearRampToValueAtTime(this.config.effectsVolume * 0.05, now + 0.01);
    gain.gain.linearRampToValueAtTime(this.config.effectsVolume * 0.03, now + 0.05);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.2);

    // Pitch bend down
    osc.frequency.setValueAtTime(200, now);
    osc.frequency.linearRampToValueAtTime(100, now + 0.1);

    osc.connect(gain);
    gain.connect(this.masterGain);

    osc.start(now);
    osc.stop(now + 0.2);
  }

  /**
   * Stop ambient audio.
   */
  stop() {
    if (!this.isPlaying || !this.audioContext || !this.masterGain) return;

    // Fade out
    const now = this.audioContext.currentTime;
    this.masterGain.gain.linearRampToValueAtTime(0, now + 1);

    // Stop after fade
    setTimeout(() => {
      this.cleanup();
    }, 1100);
  }

  /**
   * Clean up audio nodes.
   */
  private cleanup() {
    this.droneOsc?.stop();
    this.subOsc?.stop();
    this.noiseSource?.stop();
    this.lfoOsc?.stop();

    this.audioContext?.close();
    this.audioContext = null;
    this.masterGain = null;
    this.droneOsc = null;
    this.droneGain = null;
    this.subOsc = null;
    this.subGain = null;
    this.noiseSource = null;
    this.noiseGain = null;
    this.filterNode = null;
    this.lfoOsc = null;
    this.lfoGain = null;

    this.isPlaying = false;
  }

  /**
   * Update configuration.
   */
  updateConfig(config: HallsConfig) {
    this.config = config;

    if (this.masterGain) {
      this.masterGain.gain.value = config.masterVolume * config.ambientVolume;
    }

    if (!config.enableAudio && this.isPlaying) {
      this.stop();
    }
  }

  /**
   * Dispose of resources.
   */
  dispose() {
    this.stop();
  }
}
