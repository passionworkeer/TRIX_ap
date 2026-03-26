import { pushBotState } from './window-state';
import log from 'electron-log/main';

/**
 * PetStateManager — listens to OpenClaw channel messages in the main process
 * and pushes bot state (IDLE / THINKING / SPEAKING) to the float window.
 *
 * State machine:
 *   IDLE ──(message sent)──▶ THINKING ──(AI responds)──▶ SPEAKING ──(done)──▶ IDLE
 */
export class PetStateManager {
  private state: 'IDLE' | 'THINKING' | 'SPEAKING' = 'IDLE';
  private speakingTimer: ReturnType<typeof setTimeout> | null = null;

  /** Called by IPC when a new inbound message arrives (user → bot) */
  onInboundMessage(): void {
    this.setState('THINKING');
  }

  /** Called by IPC when AI starts generating a response */
  onAiThinking(): void {
    this.setState('THINKING');
  }

  /** Called by IPC when AI sends a message / chunk */
  onAiSpeaking(): void {
    if (this.speakingTimer) clearTimeout(this.speakingTimer);
    this.setState('SPEAKING');
    // If no more chunks come in for 3s, return to IDLE
    this.speakingTimer = setTimeout(() => {
      this.setState('IDLE');
    }, 3000);
  }

  /** Called by IPC when AI response is complete */
  onAiDone(): void {
    if (this.speakingTimer) clearTimeout(this.speakingTimer);
    this.setState('IDLE');
  }

  private setState(state: 'IDLE' | 'THINKING' | 'SPEAKING'): void {
    if (this.state === state) return;
    this.state = state;
    log.info(`[PetState] → ${state}`);
    pushBotState(state);
  }

  /** Push initial IDLE state when float window is ready */
  init(): void {
    this.setState('IDLE');
  }
}

// Singleton instance
export const petStateManager = new PetStateManager();
