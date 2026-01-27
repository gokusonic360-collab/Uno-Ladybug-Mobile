/**
 * AssetManager - Handles prioritized asset loading.
 * Checks IndexedDB first, falls back to local files.
 */

const AssetManager = {
    assetsStoreName: 'uno_assets',
    dbName: 'UnoLadybugDB',

    async initDB() {
        return new Promise((resolve, reject) => {
            const request = indexedDB.open(this.dbName, 1);
            request.onsuccess = (event) => resolve(event.target.result);
            request.onerror = () => reject('Error opening IndexedDB');
        });
    },

    async getAssetUrl(assetId, defaultPath) {
        try {
            const db = await this.initDB();
            const transaction = db.transaction([this.assetsStoreName], 'readonly');
            const store = transaction.objectStore(this.assetsStoreName);

            return new Promise((resolve) => {
                const request = store.get(assetId);
                request.onsuccess = () => {
                    if (request.result) {
                        console.log(`Using dynamic asset for ${assetId}`);
                        const url = URL.createObjectURL(request.result.data);
                        resolve(url);
                    } else {
                        resolve(defaultPath);
                    }
                };
                request.onerror = () => resolve(defaultPath);
            });
        } catch (e) {
            console.warn(`AssetManager: Falling back to default for ${assetId}`, e);
            return defaultPath;
        }
    }
};

window.AssetManager = AssetManager;
