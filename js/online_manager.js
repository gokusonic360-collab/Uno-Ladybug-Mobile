class OnlineManager {
    constructor(game) {
        this.game = game;
        this.peer = null;
        this.conn = null;
        this.roomId = null;
        this.dbRoomId = null; // Firebase Database Room ID
        this.isHost = false;
        this.statusCallback = null;
        this.roomStatusListener = null; // Firebase listener
        this.turnListener = null; // Turn change listener
        this.moveListener = null; // Move sync listener
        this.localPlayerId = null; // 'host' or 'client'
    }

    init(isHost, roomId = null, onStatusChange, password = "", dbRoomId = null) {
        this.isHost = isHost;
        this.statusCallback = onStatusChange;
        this.password = password; // Store password
        this.dbRoomId = dbRoomId; // Firebase Database Room ID
        this.localPlayerId = isHost ? 'host' : 'client'; // Set local player ID

        // Load PeerJS from CDN if not existing
        if (!window.Peer) {
            const script = document.createElement('script');
            script.src = "https://unpkg.com/peerjs@1.5.2/dist/peerjs.min.js";
            script.onload = () => this.setupPeer(roomId);
            document.head.appendChild(script);
        } else {
            this.setupPeer(roomId);
        }
    }

    setupPeer(targetRoomId) {
        if (this.isHost) {
            // Generate valid Peer ID (alphanumeric for PeerJS cloud)
            // Format: UNO-XXXX
            const randomCode = Math.floor(1000 + Math.random() * 9000);
            this.roomId = `UNO-${randomCode}`;
        } else {
            this.roomId = targetRoomId;
        }

        console.log(`Initializing Peer. ID: ${this.isHost ? this.roomId : 'Client'}`);

        // Note: PeerJS Cloud service cleanup: ID must be unique.
        // If Host: use roomId. If Client: user random ID.
        const peerId = this.isHost ? this.roomId : null;

        this.peer = new Peer(peerId, {
            debug: 2
        });

        this.peer.on('open', (id) => {
            console.log('My Peer ID is: ' + id);
            this.updateStatus(this.isHost ? 'WAITING_FOR_PLAYER' : 'CONNECTING_TO_HOST');

            if (this.isHost) {
                // Wait for connection
                this.updateStatus('ROOM_CREATED', this.roomId);
            } else {
                // Connect to Host
                this.connectToPeer(this.roomId);
            }
        });

        this.peer.on('connection', (conn) => {
            // Received connection (Host side usually)
            this.handleConnection(conn);
        });

        this.peer.on('error', (err) => {
            console.error('Peer Error:', err);
            this.updateStatus('ERROR', err.type);
        });
    }

    connectToPeer(hostId) {
        console.log(`Connecting to Host: ${hostId}`);
        const conn = this.peer.connect(hostId);
        this.handleConnection(conn);
    }

    handleConnection(conn) {
        this.conn = conn;

        this.conn.on('open', () => {
            console.log("Connected to: " + this.conn.peer);
            this.updateStatus('CONNECTED');

            // Sync initial state if Client joining Host
            // NOW: Send Join Request containing Password
            if (!this.isHost) {
                this.sendData({ type: 'JOIN_REQUEST', password: this.password });
                // Mark as ready in Firebase
                this.markPlayerReady();
            }
            // Host does nothing until it receives JOIN_REQUEST
        });

        this.conn.on('data', (data) => {
            console.log('Received data:', data);
            this.handleData(data);
        });

        this.conn.on('close', () => {
            this.updateStatus('DISCONNECTED');
            // Handle opponent drop
        });
    }

    sendData(data) {
        if (this.conn && this.conn.open) {
            this.conn.send(data);
        }
    }

    handleData(data) {
        // console.log("Received:", data);
        switch (data.type) {
            case 'JOIN_REQUEST':
                if (this.isHost) {
                    // Host validates password (CLIENT already validated with DB, but this is the P2P handshake)
                    if (data.password === this.password) {
                        console.log("Password Correct. Auto-Starting Game...");

                        // 1. Send Acceptance
                        this.sendData({ type: 'PASSWORD_ACCEPTED' });

                        // 2. Mark game as started in Firebase
                        this.markGameStarted();

                        // 3. Update Local Status -> Triggers UI to Launch Game -> Triggers INIT_GAME
                        this.updateStatus('GAME_STARTING');

                    } else {
                        this.sendData({ type: 'ERROR', message: 'Incorrect Password' });
                        setTimeout(() => { if (this.conn) this.conn.close(); }, 500);
                    }
                }
                break;

            case 'PASSWORD_ACCEPTED':
                if (!this.isHost) {
                    this.updateStatus('WAITING_FOR_HOST');
                    // Start listening for game start in Firebase
                    this.listenForGameStart();
                }
                break;

            case 'ERROR':
                this.updateStatus('ERROR', data.message);
                break;

            case 'INIT_GAME':
                // Client receives initial state from Host
                if (!this.isHost) {
                    this.game.mode = 'online';
                    this.game.players.ai.isBot = false;

                    // Sync Decks
                    this.game.deck = data.deck;
                    this.game.discardPile = data.discardPile;
                    this.game.currentColor = data.currentColor;
                    this.game.currentValue = data.currentValue;

                    // Sync Hands (IMPORTANT: Host 'player' is Client 'ai', Host 'ai' is Client 'player'?)
                    // NO. The data sent by Host:
                    // players.player.hand -> Host's Hand
                    // players.ai.hand -> Client's Hand

                    // Client needs to map:
                    // My 'player.hand' = data.players.ai.hand
                    // My 'ai.hand' = data.players.player.hand

                    this.game.players.player.hand = data.players.ai.hand;
                    this.game.players.ai.hand = data.players.player.hand;

                    // Host says currentPlayer='player' (Host). 
                    // Client sees this as 'ai' (Remote).
                    if (data.currentPlayer === 'player') {
                        this.game.currentPlayer = 'ai';
                    } else {
                        this.game.currentPlayer = 'player';
                    }

                    // Update UI
                    this.game.ui.updateDiscardPile(this.game.discardPile[this.game.discardPile.length - 1]);
                    this.game.ui.renderHand('player', this.game.players.player.hand);
                    this.game.ui.renderHand('ai', this.game.players.ai.hand);
                    this.game.startGame();
                    this.game.ui.showToast("Game Started!");
                }
                break;

            case 'MOVE':
                // Opponent played a card.
                // data.cardIndex -> The index in THEIR hand.
                // In my local view, their hand is 'ai.hand'.
                // So I apply playCard('ai', data.cardIndex)
                this.game.applyMove('ai', data.cardIndex, data.chosenWildColor);
                break;

            case 'DRAW_ACTION':
                // Opponent drew a card.
                // I need to simulate 'ai' drawing.
                // BUT, deck sync?
                // Ideally, Host sends the CARD drawn if it's deterministic?
                // Or we just pop from our local deck (which should be identical if seeded or synced).
                // "Simple" P2P: We assume decks stay synced if we perform same actions.
                // Risky if random shuffle happens? 
                // Host shuffled -> sent deck -> synced.
                // Both pop(). Should be same card.
                this.game.aiDraw();
                break;

            case 'UNO_CALL':
                this.game.callUno('ai');
                break;

            case 'TURN_UPDATE':
                // Received turn update from Firebase (via other player)
                console.log('[OnlineManager] Turn update received:', data.currentTurn);
                break;
        }
    }

    updateStatus(status, data = null) {
        if (this.statusCallback) {
            this.statusCallback(status, data);
        }
    }

    // Mark Player 2 as ready in Firebase
    markPlayerReady() {
        if (!window.db || !this.dbRoomId) {
            console.warn('[OnlineManager] Cannot mark ready: Firebase DB or dbRoomId missing');
            return;
        }

        console.log(`[OnlineManager] Marking Player 2 as ready in room ${this.dbRoomId}`);
        window.db.ref(`rooms/${this.dbRoomId}/player2Ready`).set(true)
            .then(() => console.log('[OnlineManager] ✅ Player 2 marked as ready'))
            .catch(err => console.error('[OnlineManager] ❌ Error marking ready:', err));
    }

    // Host marks game as started in Firebase
    markGameStarted() {
        if (!window.db || !this.dbRoomId) {
            console.warn('[OnlineManager] Cannot mark started: Firebase DB or dbRoomId missing');
            return;
        }

        console.log(`[OnlineManager] Marking game as started in room ${this.dbRoomId}`);
        window.db.ref(`rooms/${this.dbRoomId}/started`).set(true)
            .then(() => {
                console.log('[OnlineManager] ✅ Game marked as started');
                // Clean up the room from lobby after game starts
                if (window.LobbyManager) {
                    window.LobbyManager.deleteRoom(this.dbRoomId);
                }
            })
            .catch(err => console.error('[OnlineManager] ❌ Error marking started:', err));
    }

    // Player 2 listens for game start
    listenForGameStart() {
        if (!window.db || !this.dbRoomId) {
            console.warn('[OnlineManager] Cannot listen for start: Firebase DB or dbRoomId missing');
            return;
        }

        console.log(`[OnlineManager] Player 2 listening for game start in room ${this.dbRoomId}`);

        this.roomStatusListener = window.db.ref(`rooms/${this.dbRoomId}/started`).on('value', (snapshot) => {
            const started = snapshot.val();
            console.log(`[OnlineManager] Game started status: ${started}`);

            if (started === true) {
                console.log('[OnlineManager] 🎮 Game started! Launching game for Player 2...');
                // Stop listening
                this.stopListeningForGameStart();
                // Trigger game launch
                if (this.game && this.game.ui && this.game.ui.launchGame) {
                    this.game.ui.launchGame('online');
                } else {
                    console.error('[OnlineManager] Cannot launch game: ui.launchGame not found');
                }
            }
        });
    }

    // Stop listening for game start
    stopListeningForGameStart() {
        if (this.roomStatusListener && window.db && this.dbRoomId) {
            window.db.ref(`rooms/${this.dbRoomId}/started`).off('value', this.roomStatusListener);
            this.roomStatusListener = null;
            console.log('[OnlineManager] Stopped listening for game start');
        }
    }

    // ========== TURN SYNCHRONIZATION SYSTEM ==========

    /**
     * Update the current turn in Firebase
     * @param {string} nextPlayer - 'host' or 'client'
     */
    updateTurnInFirebase(nextPlayer) {
        if (!window.db || !this.dbRoomId) {
            console.warn('[OnlineManager] Cannot update turn: Firebase DB or dbRoomId missing');
            return;
        }

        console.log(`[OnlineManager] Updating turn in Firebase: ${nextPlayer}`);

        window.db.ref(`rooms/${this.dbRoomId}/currentTurn`).set(nextPlayer)
            .then(() => {
                console.log(`[OnlineManager] ✅ Turn updated to: ${nextPlayer}`);
            })
            .catch(err => {
                console.error('[OnlineManager] ❌ Error updating turn:', err);
            });
    }

    /**
     * Listen for turn changes in Firebase
     * Enables/disables controls based on whose turn it is
     */
    listenForTurnChanges() {
        if (!window.db || !this.dbRoomId) {
            console.warn('[OnlineManager] Cannot listen for turns: Firebase DB or dbRoomId missing');
            return;
        }

        console.log(`[OnlineManager] Listening for turn changes in room ${this.dbRoomId}`);

        this.turnListener = window.db.ref(`rooms/${this.dbRoomId}/currentTurn`).on('value', (snapshot) => {
            const currentTurn = snapshot.val();
            console.log(`[OnlineManager] Current turn from Firebase: ${currentTurn}, Local player: ${this.localPlayerId}`);

            if (!currentTurn) {
                console.log('[OnlineManager] No turn data yet, waiting...');
                return;
            }

            // Check if it's this player's turn
            const isMyTurn = (currentTurn === this.localPlayerId);

            if (isMyTurn) {
                console.log('[OnlineManager] 🎮 It\'s MY turn! Enabling controls...');
                this.enableControls();
            } else {
                console.log('[OnlineManager] ⏸️ It\'s OPPONENT\'s turn. Disabling controls...');
                this.disableControls();
            }
        });
    }

    /**
     * Stop listening for turn changes
     */
    stopListeningForTurns() {
        if (this.turnListener && window.db && this.dbRoomId) {
            window.db.ref(`rooms/${this.dbRoomId}/currentTurn`).off('value', this.turnListener);
            this.turnListener = null;
            console.log('[OnlineManager] Stopped listening for turn changes');
        }
    }

    /**
     * Sync a move to Firebase so the other player can see it
     * @param {number} cardIndex - Index of card played
     * @param {object} card - Card object
     * @param {string} chosenWildColor - Color chosen for wild cards
     */
    syncMove(cardIndex, card, chosenWildColor = null) {
        if (!window.db || !this.dbRoomId) {
            console.warn('[OnlineManager] Cannot sync move: Firebase DB or dbRoomId missing');
            return;
        }

        const moveData = {
            playerId: this.localPlayerId,
            cardIndex: cardIndex,
            card: card,
            chosenWildColor: chosenWildColor,
            timestamp: Date.now()
        };

        console.log('[OnlineManager] Syncing move to Firebase:', moveData);

        window.db.ref(`rooms/${this.dbRoomId}/lastMove`).set(moveData)
            .then(() => {
                console.log('[OnlineManager] ✅ Move synced to Firebase');
            })
            .catch(err => {
                console.error('[OnlineManager] ❌ Error syncing move:', err);
            });
    }

    /**
     * Listen for opponent moves in Firebase
     */
    listenForMoves() {
        if (!window.db || !this.dbRoomId) {
            console.warn('[OnlineManager] Cannot listen for moves: Firebase DB or dbRoomId missing');
            return;
        }

        console.log(`[OnlineManager] Listening for moves in room ${this.dbRoomId}`);

        this.moveListener = window.db.ref(`rooms/${this.dbRoomId}/lastMove`).on('value', (snapshot) => {
            const moveData = snapshot.val();

            if (!moveData) return;

            // Ignore our own moves
            if (moveData.playerId === this.localPlayerId) {
                console.log('[OnlineManager] Ignoring own move');
                return;
            }

            console.log('[OnlineManager] 📥 Received opponent move:', moveData);

            // Apply the opponent's move to our local game state
            // In our local view, opponent is 'ai'
            if (this.game && this.game.applyMove) {
                this.game.applyMove('ai', moveData.cardIndex, moveData.chosenWildColor);
            }
        });
    }

    /**
     * Stop listening for moves
     */
    stopListeningForMoves() {
        if (this.moveListener && window.db && this.dbRoomId) {
            window.db.ref(`rooms/${this.dbRoomId}/lastMove`).off('value', this.moveListener);
            this.moveListener = null;
            console.log('[OnlineManager] Stopped listening for moves');
        }
    }

    /**
     * Enable game controls (player can interact)
     */
    enableControls() {
        console.log('[OnlineManager] Enabling controls');

        // Enable card clicking
        if (this.game && this.game.ui && this.game.ui.playerHandEl) {
            this.game.ui.playerHandEl.style.pointerEvents = 'auto';
            this.game.ui.playerHandEl.style.opacity = '1';
        }

        // Enable draw pile
        if (this.game && this.game.ui && this.game.ui.drawPileEl) {
            this.game.ui.drawPileEl.style.pointerEvents = 'auto';
            this.game.ui.drawPileEl.style.opacity = '1';
        }

        // Update game state
        if (this.game) {
            this.game.currentPlayer = 'player';
            if (this.game.ui && this.game.ui.updateTurnIndicator) {
                this.game.ui.updateTurnIndicator('player');
            }
            if (this.game.checkPlayableCards) {
                this.game.checkPlayableCards();
            }
        }
    }

    /**
     * Disable game controls (opponent's turn)
     */
    disableControls() {
        console.log('[OnlineManager] Disabling controls');

        // Disable card clicking
        if (this.game && this.game.ui && this.game.ui.playerHandEl) {
            this.game.ui.playerHandEl.style.pointerEvents = 'none';
            this.game.ui.playerHandEl.style.opacity = '0.5';
        }

        // Disable draw pile
        if (this.game && this.game.ui && this.game.ui.drawPileEl) {
            this.game.ui.drawPileEl.style.pointerEvents = 'none';
            this.game.ui.drawPileEl.style.opacity = '0.5';
        }

        // Update game state
        if (this.game) {
            this.game.currentPlayer = 'ai';
            if (this.game.ui && this.game.ui.updateTurnIndicator) {
                this.game.ui.updateTurnIndicator('ai');
            }
        }
    }

    /**
     * Initialize turn system when game starts
     * Host always starts first
     */
    initializeTurnSystem() {
        if (!window.db || !this.dbRoomId) {
            console.warn('[OnlineManager] Cannot initialize turns: Firebase DB or dbRoomId missing');
            return;
        }

        console.log('[OnlineManager] Initializing turn system...');

        // Start listening for turn changes
        this.listenForTurnChanges();

        // Start listening for opponent moves
        this.listenForMoves();

        // Host sets initial turn
        if (this.isHost) {
            console.log('[OnlineManager] Host setting initial turn to host');
            this.updateTurnInFirebase('host');
        }
    }
}

window.OnlineManager = OnlineManager;
