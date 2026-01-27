const Updater = {
    currentVersionKey: 'uno_ladybug_version',
    assetsStoreName: 'uno_assets',
    dbName: 'UnoLadybugDB',
    dbVersion: 1,

    async initDB() {
        return new Promise((resolve, reject) => {
            const request = indexedDB.open(this.dbName, this.dbVersion);
            request.onerror = () => reject('Error opening IndexedDB');
            request.onupgradeneeded = (event) => {
                const db = event.target.result;
                if (!db.objectStoreNames.contains(this.assetsStoreName)) {
                    db.createObjectStore(this.assetsStoreName, { keyPath: 'name' });
                }
            };
            request.onsuccess = (event) => resolve(event.target.result);
        });
    },

    async getCurrentVersion() {
        return parseFloat(localStorage.getItem(this.currentVersionKey)) || 1.0;
    },

    async checkForUpdates() {
        const serverUrl = "https://gokusonic360-collab.github.io/Uno-Ladybug-Mobile";
        console.log('Checking for updates at:', serverUrl);
        try {
            const response = await fetch(`${serverUrl}/update.json?t=${Date.now()}`);
            if (!response.ok) throw new Error('Failed to fetch update.json');

            const manifest = await response.json();
            const localVersion = await this.getCurrentVersion();

            if (manifest.latest_version > localVersion) {
                console.log('Update found! Version:', manifest.latest_version);

                if (manifest.mensagem_boot) {
                    const statusEl = document.getElementById('boot-status');
                    if (statusEl) statusEl.innerText = manifest.mensagem_boot;
                }

                await this.startUpdate(manifest);
                localStorage.setItem(this.currentVersionKey, manifest.latest_version);
                return true;
            }
            console.log('Game is up to date.');
            return false;
        } catch (error) {
            console.error('Update check failed:', error);
            return false;
        }
    },

    async startUpdate(manifest) {
        const db = await this.initDB();
        const transaction = db.transaction([this.assetsStoreName], 'readwrite');
        const store = transaction.objectStore(this.assetsStoreName);

        for (const asset of manifest.assets_obrigatorios) {
            try {
                console.log(`Downloading asset: ${asset.id}...`);
                const response = await fetch(asset.url);
                const blob = await response.blob();

                store.put({
                    name: asset.id,
                    data: blob,
                    timestamp: Date.now()
                });
                console.log(`Asset ${asset.id} stored.`);
            } catch (err) {
                console.error(`Failed to download ${asset.id}:`, err);
            }
        }
    }
};

window.Updater = Updater;
