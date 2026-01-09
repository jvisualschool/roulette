export class AudioManager {
    private sounds: Map<string, HTMLAudioElement> = new Map();

    constructor() {
        this.loadSound('countdown', './mp3/countdown_321.mp3');
        this.loadSound('start', './mp3/start.mp3');
        this.loadSound('goal', './mp3/winner.mp3');
        this.loadSound('race_loop', './mp3/run_roop.mp3', true);
    }

    private loadSound(key: string, path: string, loop: boolean = false) {
        const audio = new Audio(path);
        audio.loop = loop;
        this.sounds.set(key, audio);
    }

    public play(key: string) {
        const sound = this.sounds.get(key);
        if (sound) {
            sound.currentTime = 0;
            sound.play().catch(e => console.warn(`Audio play failed for ${key}:`, e));
        }
    }

    public stop(key: string) {
        const sound = this.sounds.get(key);
        if (sound) {
            sound.pause();
            sound.currentTime = 0;
        }
    }

    public stopAll() {
        this.sounds.forEach(sound => {
            sound.pause();
            sound.currentTime = 0;
        });
    }
}
