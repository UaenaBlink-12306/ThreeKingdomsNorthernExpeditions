// 复古木质机械音效工具
import { reportConsoleError } from "./errorLogger";

let audioContext: AudioContext | null = null;
let selectedSoundUrl: string | null = null;

const SOUND_STORAGE_KEY = "zhuge_selected_sound";

function getAudioContext(): AudioContext {
  if (!audioContext) {
    audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();
  }
  return audioContext;
}

/**
 * 从 localStorage 加载用户选择的音效
 */
function loadSelectedSound(): string | null {
  if (typeof window === "undefined") return null;
  const saved = localStorage.getItem(SOUND_STORAGE_KEY);
  if (saved) {
    selectedSoundUrl = saved;
    return saved;
  }
  return null;
}

/**
 * 保存用户选择的音效到 localStorage
 */
export function saveSelectedSound(url: string): void {
  if (typeof window === "undefined") return;
  localStorage.setItem(SOUND_STORAGE_KEY, url);
  selectedSoundUrl = url;
}

/**
 * 获取当前选择的音效 URL
 */
export function getSelectedSound(): string | null {
  if (!selectedSoundUrl) {
    loadSelectedSound();
  }
  return selectedSoundUrl;
}

/**
 * 播放音效文件
 */
async function playSoundFile(url: string): Promise<void> {
  try {
    const audio = new Audio(url);
    audio.volume = 0.6;
    await audio.play();
  } catch (error) {
    reportConsoleError("sound.file_playback_failed", error, { url });
  }
}

/**
 * 生成木质机械咔咔声（备用方案）
 */
function createWoodenClickSound(ctx: AudioContext, duration: number = 0.08): void {
  const now = ctx.currentTime;
  
  // 创建白噪声缓冲区
  const bufferSize = ctx.sampleRate * duration;
  const buffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
  const data = buffer.getChannelData(0);
  
  for (let i = 0; i < bufferSize; i++) {
    const progress = i / bufferSize;
    const envelope = Math.exp(-progress * 15) * (1 - progress * 0.5);
    data[i] = (Math.random() * 2 - 1) * envelope * 0.4;
  }
  
  const noiseSource = ctx.createBufferSource();
  noiseSource.buffer = buffer;
  
  const filter = ctx.createBiquadFilter();
  filter.type = 'bandpass';
  filter.frequency.value = 800 + Math.random() * 400;
  filter.Q.value = 8;
  
  const lowpass = ctx.createBiquadFilter();
  lowpass.type = 'lowpass';
  lowpass.frequency.value = 2000;
  lowpass.Q.value = 1;
  
  const gainNode = ctx.createGain();
  gainNode.gain.setValueAtTime(0.5, now);
  gainNode.gain.exponentialRampToValueAtTime(0.01, now + duration);
  
  noiseSource.connect(filter);
  filter.connect(lowpass);
  lowpass.connect(gainNode);
  gainNode.connect(ctx.destination);
  
  noiseSource.start(now);
  noiseSource.stop(now + duration);
  
  const clickOsc = ctx.createOscillator();
  const clickGain = ctx.createGain();
  clickOsc.type = 'sine';
  clickOsc.frequency.setValueAtTime(150, now);
  clickOsc.frequency.exponentialRampToValueAtTime(80, now + 0.02);
  
  clickGain.gain.setValueAtTime(0.15, now);
  clickGain.gain.exponentialRampToValueAtTime(0.01, now + 0.02);
  
  clickOsc.connect(clickGain);
  clickGain.connect(ctx.destination);
  
  clickOsc.start(now);
  clickOsc.stop(now + 0.02);
}

/**
 * 播放复古木质机械点击音效
 */
export function playMechanicalClick(): void {
  const soundUrl = getSelectedSound();
  if (soundUrl) {
    playSoundFile(soundUrl).catch(() => {
      // 如果文件播放失败，回退到生成的音效
      try {
        const ctx = getAudioContext();
        createWoodenClickSound(ctx, 0.06);
      } catch (error) {
        reportConsoleError("sound.click_fallback_failed", error);
      }
    });
  } else {
    // 如果没有选择音效，使用生成的音效
    try {
      const ctx = getAudioContext();
      createWoodenClickSound(ctx, 0.06);
    } catch (error) {
      reportConsoleError("sound.click_playback_failed", error);
    }
  }
}

/**
 * 播放复古木质机械按钮按下音效
 */
export function playMechanicalPress(): void {
  const soundUrl = getSelectedSound();
  if (soundUrl) {
    playSoundFile(soundUrl).catch(() => {
      try {
        const ctx = getAudioContext();
        createWoodenClickSound(ctx, 0.08);
        setTimeout(() => {
          try {
            createWoodenClickSound(ctx, 0.06);
          } catch (e) {
            reportConsoleError("sound.press_secondary_click_failed", e);
          }
        }, 30);
      } catch (error) {
        reportConsoleError("sound.press_fallback_failed", error);
      }
    });
  } else {
    try {
      const ctx = getAudioContext();
      createWoodenClickSound(ctx, 0.08);
      setTimeout(() => {
        try {
          createWoodenClickSound(ctx, 0.06);
        } catch (e) {
          reportConsoleError("sound.press_secondary_click_failed", e);
        }
      }, 30);
    } catch (error) {
      reportConsoleError("sound.press_playback_failed", error);
    }
  }
}

/**
 * 播放复古木质机械确认音效
 */
export function playMechanicalConfirm(): void {
  const soundUrl = getSelectedSound();
  if (soundUrl) {
    playSoundFile(soundUrl).catch(() => {
      try {
        const ctx = getAudioContext();
        createWoodenClickSound(ctx, 0.07);
        setTimeout(() => {
          try {
            createWoodenClickSound(ctx, 0.05);
          } catch (e) {
            reportConsoleError("sound.confirm_secondary_click_failed", e);
          }
        }, 40);
      } catch (error) {
        reportConsoleError("sound.confirm_fallback_failed", error);
      }
    });
  } else {
    try {
      const ctx = getAudioContext();
      createWoodenClickSound(ctx, 0.07);
      setTimeout(() => {
        try {
          createWoodenClickSound(ctx, 0.05);
        } catch (e) {
          reportConsoleError("sound.confirm_secondary_click_failed", e);
        }
      }, 40);
    } catch (error) {
      reportConsoleError("sound.confirm_playback_failed", error);
    }
  }
}
