class SoundManager {
    constructor() {
        this.sounds = {
            // Requested URLs
            bgm: new Audio('https://www.soundhelix.com/examples/mp3/SoundHelix-Song-1.mp3'),
            card_swipe: new Audio('https://assets.mixkit.co/active_storage/sfx/2019/2019-preview.mp3'),

            // Other standard sounds (using previous URLs for fallback)
            menu_click: new Audio('https://assets.mixkit.co/active_storage/sfx/2568/2568-preview.mp3'),
            card_pop: new Audio('https://assets.mixkit.co/active_storage/sfx/2570/2570-preview.mp3'),
            uno_voice: new Audio('https://assets.mixkit.co/active_storage/sfx/2572/2572-preview.mp3'),
            win: new Audio('https://assets.mixkit.co/active_storage/sfx/1435/1435-preview.mp3'),
            lose: new Audio('https://assets.mixkit.co/active_storage/sfx/1434/1434-preview.mp3'),
            magic_color: new Audio('https://assets.mixkit.co/active_storage/sfx/2574/2574-preview.mp3'),
            special_plus4: new Audio('https://assets.mixkit.co/active_storage/sfx/2573/2573-preview.mp3'),
            special_plus2: new Audio('https://assets.mixkit.co/active_storage/sfx/2573/2573-preview.mp3'),

            // Placeholders for Hero Sounds
            hero_ladybug: new Audio('assets/sounds/lucky_charm.mp3'),
            hero_catnoir: new Audio('assets/sounds/cataclysm.mp3')
        };

        // BGM Configuration
        this.sounds.bgm.loop = true;
        this.sounds.bgm.volume = 0.3;

        // Preload
        Object.values(this.sounds).forEach(audio => {
            audio.load();
            audio.onerror = () => { /* Silent fail */ };
        });

        this.initialized = false;
    }

    initContext() {
        if (!this.audioContextInitialized) {
            // Mobile: Resume or create a dummy buffer to unlock audio
            const AudioContext = window.AudioContext || window.webkitAudioContext;
            if (AudioContext) {
                const ctx = new AudioContext();
                if (ctx.state === 'suspended') ctx.resume();
            }
            this.audioContextInitialized = true;
            console.log("Audio Context Initialized via user gesture");
        }
    }

    startMusic() {
        // This is called when the user clicks PLAY
        this.initContext();
        this.initialized = true;
        this.sounds.bgm.play().catch(e => {
            console.warn("BGM Play failed, waiting for more interaction:", e);
            // Fallback: Try again on next interaction
            const retry = () => {
                this.sounds.bgm.play();
                window.removeEventListener('click', retry);
                window.removeEventListener('touchstart', retry);
            };
            window.addEventListener('click', retry);
            window.addEventListener('touchstart', retry);
        });
    }

    play(soundName) {
        if (!this.initialized) return;

        if (this.sounds[soundName]) {
            // Resume Audio Context if suspended (common on mobile)
            if (window.AudioContext) {
                const ctx = new (window.AudioContext || window.webkitAudioContext)();
                if (ctx.state === 'suspended') ctx.resume();
            }

            if (soundName === 'bgm') {
                this.sounds[soundName].play().catch(e => { });
            } else {
                const clone = this.sounds[soundName].cloneNode();
                clone.volume = this.sounds[soundName].volume;
                clone.play().catch(e => { });
            }
        }
    }

    stopMusic() {
        this.sounds.bgm.pause();
        this.sounds.bgm.currentTime = 0;
        this.initialized = false;
    }

    async refreshDynamicAssets() {
        console.log('Refreshing dynamic audio assets...');
        // Example: If bgm is updated dynamically
        const dynamicBgmUrl = await window.AssetManager.getAssetUrl('bgm_01', null);
        if (dynamicBgmUrl) {
            console.log('Applying dynamic BGM');
            this.sounds.bgm = new Audio(dynamicBgmUrl);
            this.sounds.bgm.loop = true;
            this.sounds.bgm.volume = 0.3;
        }
    }
}

window.soundManager = new SoundManager();
