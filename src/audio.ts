import Phaser from 'phaser';
import { gameStore } from './state';

type Cue = 'confirm'|'cancel'|'step'|'grass'|'door'|'heal'|'capture'|'victory'|'thud'|'slice'|'shine'|'gust'|'leaf'|'vine'|'spore'|'drain'|'leaf-heavy'|'fire'|'puff'|'fire-heavy'|'rumble'|'bubble'|'chime'|'barrier'|'wave'|'beam'|'rock'|'slice-heavy';

class AudioDirector {
  private current: Phaser.Sound.BaseSound | null = null;
  private musicKey = '';
  private context: AudioContext | null = null;
  unlocked = false;
  unlock() {
    if (this.unlocked) return;
    this.context ??= new AudioContext();
    void this.context.resume();
    this.unlocked = true;
  }
  playMusic(scene: Phaser.Scene, key: string) {
    if (!this.unlocked || gameStore.save?.options.muted || this.musicKey === key) return;
    this.current?.stop();
    this.musicKey = key;
    this.current = scene.sound.add(`music-${key}`, { loop: true, volume: gameStore.save?.options.musicVolume ?? .42 });
    this.current.play();
  }
  refreshMusic() {
    const volume = gameStore.save?.options.muted ? 0 : gameStore.save?.options.musicVolume ?? .42;
    if (this.current && 'setVolume' in this.current) (this.current as Phaser.Sound.WebAudioSound).setVolume(volume);
  }
  stopMusic() { this.current?.stop(); this.current = null; this.musicKey = ''; }
  sfx(cue: Cue | string) {
    if (!this.unlocked || gameStore.save?.options.muted) return;
    const context = this.context;
    if (!context) return;
    const volume = (gameStore.save?.options.sfxVolume ?? .65) * .07;
    const now = context.currentTime;
    const recipes: Record<string, [number, number, number, OscillatorType]> = {
      confirm:[620,920,.065,'square'],cancel:[360,220,.08,'square'],step:[130,90,.025,'triangle'],grass:[780,260,.07,'sawtooth'],door:[180,95,.11,'square'],
      heal:[520,1040,.28,'sine'],capture:[340,1260,.3,'square'],victory:[520,1320,.42,'square'],thud:[110,48,.12,'square'],slice:[920,240,.09,'sawtooth'],
      shine:[680,1280,.18,'sine'],gust:[460,100,.17,'sawtooth'],leaf:[780,310,.12,'triangle'],vine:[210,520,.15,'square'],spore:[840,460,.2,'sine'],
      drain:[300,900,.26,'sine'],'leaf-heavy':[620,130,.24,'sawtooth'],fire:[240,740,.18,'sawtooth'],puff:[150,70,.16,'triangle'],'fire-heavy':[170,920,.3,'sawtooth'],
      rumble:[90,38,.3,'square'],bubble:[420,820,.14,'sine'],chime:[740,1480,.2,'sine'],barrier:[260,1100,.2,'square'],wave:[190,560,.26,'sine'],beam:[980,120,.32,'sawtooth'],
      rock:[150,70,.14,'square'],'slice-heavy':[760,100,.2,'sawtooth'],
    };
    const [from,to,duration,type] = recipes[cue] ?? recipes.confirm;
    const oscillator = context.createOscillator();
    const gain = context.createGain();
    oscillator.type = type; oscillator.frequency.setValueAtTime(from, now); oscillator.frequency.exponentialRampToValueAtTime(Math.max(20,to), now + duration);
    gain.gain.setValueAtTime(volume, now); gain.gain.exponentialRampToValueAtTime(.0001, now + duration);
    oscillator.connect(gain).connect(context.destination); oscillator.start(now); oscillator.stop(now + duration);
  }
}

export const audio = new AudioDirector();
