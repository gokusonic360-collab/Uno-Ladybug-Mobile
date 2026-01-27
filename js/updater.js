/**
 * Miraculous UNO - Hot Update System
 * Simulates a Roblox-style hybrid update: 
 * Load local assets by default, update via Cache API if new version on server.
 */

const UPDATER_CONFIG = {
    manifestUrl: 'hot-update-manifest.json', // In production, this would be a full URL to GitHub/Server
    cacheName: 'uno-hot-update',
    localVersionKey: 'uno_applied_version'
};

window.UnoUpdater = {
    async checkAndApplyUpdates(onProgress) {
        console.log("Checking for updates...");

        try {
            // 1. Fetch remote manifest
            // Cache busting for the manifest check
            const response = await fetch(`${UPDATER_CONFIG.manifestUrl}?t=${Date.now()}`);
            if (!response.ok) throw new Error("Could not fetch update manifest");

            const remoteManifest = await response.json();
            const localVersion = localStorage.getItem(UPDATER_CONFIG.localVersionKey) || '0.0.0';

            console.log(`Local Version: ${localVersion}, Remote Version: ${remoteManifest.version}`);

            if (this.isNewer(remoteManifest.version, localVersion)) {
                console.log("New version found! Starting hot-update...");
                await this.downloadAssets(remoteManifest.assets, remoteManifest.version, onProgress);
                return true; // Update applied
            } else {
                console.log("Game is up to date.");
                return false; // No update needed
            }
        } catch (error) {
            console.error("Update check failed:", error);
            return false;
        }
    },

    isNewer(remote, local) {
        const r = remote.split('.').map(Number);
        const l = local.split('.').map(Number);
        for (let i = 0; i < 3; i++) {
            if (r[i] > (l[i] || 0)) return true;
            if (r[i] < (l[i] || 0)) return false;
        }
        return false;
    },

    async downloadAssets(assets, version, onProgress) {
        const cache = await caches.open(UPDATER_CONFIG.cacheName);
        let downloaded = 0;
        const total = assets.length;

        for (const asset of assets) {
            try {
                // Fetch with cache: reload to force update from network
                const assetResponse = await fetch(`${asset}?v=${version}`, { cache: 'reload' });
                if (assetResponse.ok) {
                    await cache.put(asset, assetResponse);
                    downloaded++;
                    if (onProgress) onProgress(Math.round((downloaded / total) * 100));
                }
            } catch (e) {
                console.error(`Failed to download ${asset}:`, e);
            }
        }

        localStorage.setItem(UPDATER_CONFIG.localVersionKey, version);
        console.log(`Update to ${version} complete.`);
    }
};
