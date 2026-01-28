/**
 * Halls of Creation - Voice Command Recognizer
 *
 * Wraps the Web Speech API for voice recognition.
 * Provides a clean interface for starting/stopping recognition
 * and handling results.
 */

import type {
  VoiceRecognitionStatus,
  VoiceRecognitionResult,
  VoiceConfig,
  VoiceEventHandler,
} from "./types";
import { matchCommand } from "./commands";

// Web Speech API types (not fully typed in TypeScript)
interface SpeechRecognitionEvent extends Event {
  results: SpeechRecognitionResultList;
  resultIndex: number;
}

interface SpeechRecognitionResultList {
  length: number;
  item(index: number): SpeechRecognitionResult;
  [index: number]: SpeechRecognitionResult;
}

interface SpeechRecognitionResult {
  length: number;
  isFinal: boolean;
  item(index: number): SpeechRecognitionAlternative;
  [index: number]: SpeechRecognitionAlternative;
}

interface SpeechRecognitionAlternative {
  transcript: string;
  confidence: number;
}

interface SpeechRecognitionErrorEvent extends Event {
  error: string;
  message: string;
}

interface SpeechRecognition extends EventTarget {
  continuous: boolean;
  interimResults: boolean;
  lang: string;
  maxAlternatives: number;
  onresult: ((event: SpeechRecognitionEvent) => void) | null;
  onerror: ((event: SpeechRecognitionErrorEvent) => void) | null;
  onend: (() => void) | null;
  onstart: (() => void) | null;
  start(): void;
  stop(): void;
  abort(): void;
}

declare global {
  interface Window {
    SpeechRecognition?: new () => SpeechRecognition;
    webkitSpeechRecognition?: new () => SpeechRecognition;
  }
}

export interface VoiceRecognizerOptions {
  config: VoiceConfig;
  onResult: (result: VoiceRecognitionResult) => void;
  onStatusChange: (status: VoiceRecognitionStatus) => void;
  onError: (error: string) => void;
}

export class VoiceCommandRecognizer {
  private recognition: SpeechRecognition | null = null;
  private status: VoiceRecognitionStatus = "inactive";
  private config: VoiceConfig;
  private onResult: (result: VoiceRecognitionResult) => void;
  private onStatusChange: (status: VoiceRecognitionStatus) => void;
  private onError: (error: string) => void;
  private shouldRestart = false;

  constructor(options: VoiceRecognizerOptions) {
    this.config = options.config;
    this.onResult = options.onResult;
    this.onStatusChange = options.onStatusChange;
    this.onError = options.onError;

    this.initRecognition();
  }

  /**
   * Check if Web Speech API is available.
   */
  static isSupported(): boolean {
    return !!(window.SpeechRecognition || window.webkitSpeechRecognition);
  }

  /**
   * Initialize the speech recognition instance.
   */
  private initRecognition() {
    const SpeechRecognitionConstructor =
      window.SpeechRecognition || window.webkitSpeechRecognition;

    if (!SpeechRecognitionConstructor) {
      this.onError("Speech recognition is not supported in this browser");
      return;
    }

    this.recognition = new SpeechRecognitionConstructor();
    this.recognition.continuous = true;
    this.recognition.interimResults = true;
    this.recognition.lang = this.config.language;
    this.recognition.maxAlternatives = 1;

    this.recognition.onstart = () => {
      this.setStatus("listening");
    };

    this.recognition.onresult = (event: SpeechRecognitionEvent) => {
      const resultIndex = event.resultIndex;
      const result = event.results[resultIndex];

      if (!result) return;

      const alternative = result[0];
      if (!alternative) return;

      const transcript = alternative.transcript;
      const confidence = alternative.confidence;
      const isFinal = result.isFinal;

      // Only process if confidence meets threshold or it's an interim result
      if (isFinal && confidence < this.config.confidenceThreshold) {
        return;
      }

      // Match against command registry
      const command = isFinal
        ? matchCommand(transcript, this.config.confidenceThreshold)
        : undefined;

      const recognitionResult: VoiceRecognitionResult = {
        transcript,
        confidence,
        command,
        isFinal,
      };

      this.onResult(recognitionResult);

      // Set status to processing while matching
      if (isFinal) {
        this.setStatus("processing");
        // Return to listening after processing
        setTimeout(() => {
          if (this.status === "processing") {
            this.setStatus("listening");
          }
        }, 300);
      }
    };

    this.recognition.onerror = (event: SpeechRecognitionErrorEvent) => {
      // Ignore "no-speech" errors - these are common and not critical
      if (event.error === "no-speech") {
        return;
      }

      // Ignore "aborted" when we're intentionally stopping
      if (event.error === "aborted" && !this.shouldRestart) {
        return;
      }

      this.setStatus("error");
      this.onError(`Speech recognition error: ${event.error}`);
    };

    this.recognition.onend = () => {
      // Auto-restart if we should be listening
      if (this.shouldRestart && this.status !== "error") {
        try {
          this.recognition?.start();
        } catch {
          // Recognition might already be started
        }
      } else {
        this.setStatus("inactive");
      }
    };
  }

  /**
   * Start voice recognition.
   */
  start(): boolean {
    if (!this.recognition) {
      this.onError("Speech recognition not initialized");
      return false;
    }

    if (this.status === "listening") {
      return true;
    }

    try {
      this.shouldRestart = true;
      this.recognition.start();
      return true;
    } catch (error) {
      this.onError(`Failed to start recognition: ${error}`);
      return false;
    }
  }

  /**
   * Stop voice recognition.
   */
  stop() {
    this.shouldRestart = false;
    if (this.recognition && this.status !== "inactive") {
      try {
        this.recognition.stop();
      } catch {
        // Ignore errors when stopping
      }
    }
    this.setStatus("inactive");
  }

  /**
   * Get current recognition status.
   */
  getStatus(): VoiceRecognitionStatus {
    return this.status;
  }

  /**
   * Update configuration.
   */
  updateConfig(config: VoiceConfig) {
    this.config = config;
    if (this.recognition) {
      this.recognition.lang = config.language;
    }
  }

  /**
   * Set status and notify listeners.
   */
  private setStatus(status: VoiceRecognitionStatus) {
    if (this.status !== status) {
      this.status = status;
      this.onStatusChange(status);
    }
  }

  /**
   * Dispose of resources.
   */
  dispose() {
    this.stop();
    this.recognition = null;
  }
}
