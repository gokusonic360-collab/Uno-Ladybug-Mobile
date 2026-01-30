class MultiplayerManager {
    constructor(game) {
        this.game = game;
        this.db = window.db;
        this.roomId = null;
        this.localPlayerId = null; // 'host' or 'client'
        this.turnListener = null;
        this.moveListener = null;
        this.isMyTurn = false;
    }

    init(roomId, localPlayerId) {
        this.roomId = roomId;
        this.localPlayerId = localPlayerId;
        console.log(`[MultiplayerManager] Initialized for Room: ${roomId}, Local Player: ${localPlayerId}`);

        // Initialize Listeners
        this.listenForTurnChanges();
        this.listenForMoves();

        // Host sets initial turn
        if (this.localPlayerId === 'host') {
            console.log('[MultiplayerManager] Host setting initial turn to host');
            this.updateTurnInFirebase('host');
        }
    }

    // 1. Update Turn in Firebase
    updateTurnInFirebase(nextPlayerId) {
        if (!this.db || !this.roomId) return;

        console.log(`[MultiplayerManager] Updating turn to: ${nextPlayerId}`);
        this.db.ref(`rooms/${this.roomId}/currentTurn`).set(nextPlayerId)
            .catch(err => console.error("Error updating turn:", err));
    }

    // 2. Listen for Turn Changes
    listenForTurnChanges() {
        if (!this.db || !this.roomId) return;

        console.log("[MultiplayerManager] Listening for turn changes...");
        const turnRef = this.db.ref(`rooms/${this.roomId}/currentTurn`);

        this.turnListener = turnRef.on('value', (snapshot) => {
            const currentTurn = snapshot.val();
            console.log(`[MultiplayerManager] Turn Update: ${currentTurn}`);

            if (currentTurn === this.localPlayerId) {
                this.isMyTurn = true;
                this.game.ui.showToast("Your Turn!");
                this.enableControls();
            } else {
                this.isMyTurn = false;
                // Only show toast if it's not null (game start)
                if (currentTurn) this.game.ui.showToast(`Opponent's Turn (${currentTurn})`);
                this.disableControls();
            }

            // Sync local game state current player
            if (this.game) {
                // If it's my turn, game.currentPlayer should be 'player'
                // If it's opponent's turn, game.currentPlayer should be 'ai'
                this.game.currentPlayer = this.isMyTurn ? 'player' : 'ai';
                this.game.ui.updateTurnIndicator(this.game.currentPlayer);
                this.game.checkPlayableCards();
            }
        });
    }

    // 3. Sync Move to Firebase
    syncMove(cardIndex, card, chosenWildColor = null) {
        if (!this.db || !this.roomId) return;

        const moveData = {
            playerId: this.localPlayerId,
            cardIndex: cardIndex,
            card: card,
            chosenWildColor: chosenWildColor,
            timestamp: Date.now(),
            type: 'PLAY'
        };

        console.log("[MultiplayerManager] Syncing move:", moveData);
        this.db.ref(`rooms/${this.roomId}/lastMove`).set(moveData);
    }

    // Sync Draw Action
    syncDraw() {
        if (!this.db || !this.roomId) return;
        const moveData = {
            playerId: this.localPlayerId,
            type: 'DRAW',
            timestamp: Date.now()
        };
        this.db.ref(`rooms/${this.roomId}/lastMove`).set(moveData);
    }

    // Listen for Moves (Opponent Actions)
    listenForMoves() {
        if (!this.db || !this.roomId) return;

        const moveRef = this.db.ref(`rooms/${this.roomId}/lastMove`);
        this.moveListener = moveRef.on('value', (snapshot) => {
            const data = snapshot.val();
            if (!data) return;

            // Ignore my own moves
            if (data.playerId === this.localPlayerId) return;

            console.log("[MultiplayerManager] Opponent move received:", data);

            // Apply move to 'ai' (opponent)
            if (data.type === 'PLAY') {
                // Determine card index in AI Hand
                // Since we don't sync exact indices perfectly in real-time blindly (unless we do),
                // we can just pick the FIRST matching card or the index if it's strictly synced.
                // Trusting index for now as decks are identical.
                this.game.applyMove('ai', data.cardIndex, data.chosenWildColor);
            } else if (data.type === 'DRAW') {
                this.game.aiDraw();
            }
        });
    }

    enableControls() {
        console.log("[MultiplayerManager] Controls Enabled");
        if (this.game.ui.playerHandEl) {
            this.game.ui.playerHandEl.style.pointerEvents = 'auto';
            this.game.ui.playerHandEl.style.opacity = '1';
        }
        if (this.game.ui.drawPileEl) {
            this.game.ui.drawPileEl.style.pointerEvents = 'auto';
        }
    }

    disableControls() {
        console.log("[MultiplayerManager] Controls Disabled");
        if (this.game.ui.playerHandEl) {
            this.game.ui.playerHandEl.style.pointerEvents = 'none';
            this.game.ui.playerHandEl.style.opacity = '0.7';
        }
        if (this.game.ui.drawPileEl) {
            // this.game.ui.drawPileEl.style.pointerEvents = 'none'; 
            // Optional: Disable draw pile too? Yes.
            this.game.ui.drawPileEl.style.pointerEvents = 'none';
        }
    }
}

window.MultiplayerManager = MultiplayerManager;
