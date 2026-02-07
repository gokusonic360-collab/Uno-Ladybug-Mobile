class Game {
    constructor() {
        this.deck = [];
        this.discardPile = [];
        this.players = {
            player: { hand: [], isBot: false, id: 'player' },
            ai: { hand: [], isBot: true, id: 'ai' } // In 1v1, this is Player 2
        };
        this.currentPlayer = null;
        this.direction = 1;
        this.currentColor = null;
        this.currentValue = null;
        this.gameOver = false;
        this.unoCalled = { player: false, ai: false }; // ai key used for P2
        this.mode = 'bot'; // 'bot' or '1v1'

        this.ui = new UI(this);
        this.ai = new AI(this);

        // Don't auto start. UI handles it.
        window.multiplayer = new MultiplayerManager(this);
    }

    async startMatch(mode) {
        this.mode = mode;
        this.players.ai.isBot = (mode === 'bot');

        // Reset states
        this.deck = [];
        this.discardPile = [];
        this.players.player.hand = [];
        this.players.ai.hand = [];
        this.gameOver = false;
        this.unoCalled = { player: false, ai: false };

        if (mode === 'online') {
            // Online start logic handled by OnlineManager syncing
            this.ui.showToast("Waiting for Host to deal...");
            if (window.onlineManager && window.onlineManager.isHost) {
                // Host initializes everything
                this.createDeck();
                this.shuffleDeck();
                this.dealCards();
                // Send initial state
                window.onlineManager.sendData({
                    type: 'INIT_GAME',
                    deck: this.deck,
                    players: this.players,
                    discardPile: this.discardPile,
                    currentColor: this.currentColor,
                    currentValue: this.currentValue,
                    currentPlayer: this.currentPlayer
                });
                this.startGame();
            }
        } else {
            this.createDeck();
            this.shuffleDeck();
            this.dealCards();
            this.startGame();
        }
    }

    createDeck() {
        const colors = ['red', 'green', 'blue', 'yellow'];
        const specialValues = ['reverse', 'plus2'];

        colors.forEach(color => {
            this.deck.push({ color, value: '0', type: 'number' });
            for (let i = 1; i <= 9; i++) {
                this.deck.push({ color, value: i.toString(), type: 'number' });
                this.deck.push({ color, value: i.toString(), type: 'number' });
            }
            specialValues.forEach(val => {
                this.deck.push({ color, value: val, type: 'action' });
                this.deck.push({ color, value: val, type: 'action' });
            });
        });

        for (let i = 0; i < 4; i++) {
            this.deck.push({ color: 'wild', value: 'wild', type: 'wild' });
            this.deck.push({ color: 'wild', value: 'plus4', type: 'wild' });
        }
        for (let i = 0; i < 2; i++) {
            this.deck.push({ color: 'wild', value: 'miraculous_race', type: 'wild' });
        }
    }

    shuffleDeck() {
        for (let i = this.deck.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [this.deck[i], this.deck[j]] = [this.deck[j], this.deck[i]];
        }
    }

    dealCards() {
        for (let i = 0; i < 7; i++) {
            this.players.player.hand.push(this.drawCardFromDeck());
            this.players.ai.hand.push(this.drawCardFromDeck());
        }

        let initialCard = this.drawCardFromDeck();
        while (initialCard.color === 'wild') {
            this.deck.push(initialCard);
            this.shuffleDeck();
            initialCard = this.drawCardFromDeck();
        }

        this.discardPile.push(initialCard);
        this.currentColor = initialCard.color;
        this.currentValue = initialCard.value;

        this.ui.updateDiscardPile(initialCard);
        this.ui.renderHand('player', this.players.player.hand);
        this.ui.renderHand('ai', this.players.ai.hand);
    }

    drawCardFromDeck() {
        if (this.deck.length === 0) {
            this.reshuffleDiscard();
        }
        if (this.deck.length === 0) return null;
        return this.deck.pop();
    }

    reshuffleDiscard() {
        if (this.discardPile.length <= 1) return;
        const topCard = this.discardPile.pop();
        const newDeck = this.discardPile;
        this.discardPile = [topCard];
        this.deck = newDeck;
        this.shuffleDeck();
    }

    startGame() {
        this.currentPlayer = 'player'; // Host always starts? Or random? Standardizing Host = Player 1
        this.ui.updateTurnIndicator(this.currentPlayer);
        this.checkPlayableCards();

        // Initialize turn synchronization for online mode
        // Initialize turn synchronization for online mode
        if (this.mode === 'online' && window.multiplayer && window.onlineManager) {
            console.log('[Game] Initializing online turn system');
            // Pass dbRoomId and localPlayerId from OnlineManager
            window.multiplayer.init(window.onlineManager.dbRoomId, window.onlineManager.localPlayerId);
        }
    }

    checkPlayableCards() {
        if (this.gameOver) return;

        // Online Mode Logic
        if (this.mode === 'online') {
            const isMyTurn = (window.onlineManager.isHost && this.currentPlayer === 'player') ||
                (!window.onlineManager.isHost && this.currentPlayer === 'ai'); // 'ai' represents 'Player 2/Remote' locally?

            // Correction: In Online Mode:
            // Host is 'player' locally. Remote is 'ai'.
            // Client is 'player' locally. Remote (Host) is 'ai'.
            // BUT, to keep state synced, we need to know who is who.
            // Let's stick to: 'player' is Local User. 'ai' is Remote User.
            // When Host says "Player 1 Turn", Client should see "Remote Turn".

            // Wait, syncing STATE means 'player' in Host data is 'ai' in Client data?
            // Easier approach: 'currentTurn' is 'host' or 'client'.
            // Let's map: 
            // Host View: Player = Host, AI = Client.
            // Client View: Player = Client, AI = Host.

            if (this.isLocalTurn()) {
                const playableIndices = this.getPlayableIndices('player');
                this.ui.highlightPlayableCards(playableIndices);
            } else {
                this.ui.highlightPlayableCards([]); // Clear highlights
                this.ui.showToast("Waiting for opponent...");
            }
            return;
        }

        if (this.currentPlayer === 'player') {
            const playableIndices = this.getPlayableIndices('player');
            this.ui.highlightPlayableCards(playableIndices);
        } else {
            // AI Turn or Player 2 Turn
            if (this.mode === 'bot') {
                setTimeout(() => this.ai.takeTurn(), 1000);
            } else {
                // Player 2 (Human) Local
                const playableIndices = this.getPlayableIndices('ai');
                this.ui.highlightPlayableCards(playableIndices);
            }
        }
    }

    isLocalTurn() {
        if (this.mode !== 'online') return this.currentPlayer === 'player';

        // Online:
        // Host: player=Host. currentPlayer='player' -> True.
        // Client: player=Client. currentPlayer... wait.

        // If we sync 'currentPlayer' string literal 'player'/'ai' it gets confused.
        // Let's change currentPlayer to 'host' / 'client' internally for Online?
        // Or keep 'player' / 'ai' but swap them when receiving data?

        // Better: OnlineManager handles the translation.
        // If Host sends "It is 'player' turn", Client receives "It is 'ai' turn".
        // See handleData in OnlineManager.

        return this.currentPlayer === 'player';
    }

    getPlayableIndices(playerId) {
        const hand = this.players[playerId].hand;
        return hand.map((card, index) => {
            if (this.isCardPlayable(card)) return index;
            return -1;
        }).filter(index => index !== -1);
    }

    isCardPlayable(card) {
        if (card.color === 'wild') return true;
        if (card.color === this.currentColor) return true;
        if (card.value === this.currentValue) return true;
        return false;
    }

    playCard(playerId, cardIndex, chosenWildColor = null) {
        if (this.mode === 'online' && playerId !== 'player') return; // Cannot play for remote
        if (playerId !== this.currentPlayer) return;

        const hand = this.players[playerId].hand;
        const card = hand[cardIndex];

        if (!this.isCardPlayable(card)) return;

        // If Online, sync move to Firebase
        // If Online, sync move to Firebase
        if (this.mode === 'online' && window.multiplayer) {
            console.log('[Game] Syncing move to Firebase');
            window.multiplayer.syncMove(cardIndex, card, chosenWildColor);
        }

        this.applyMove(playerId, cardIndex, chosenWildColor);
    }

    applyMove(playerId, cardIndex, chosenWildColor = null) {
        const hand = this.players[playerId].hand;
        const card = hand[cardIndex];

        hand.splice(cardIndex, 1);
        this.discardPile.push(card);
        this.ui.animatePlay(playerId, card, cardIndex);

        this.currentValue = card.value;
        if (card.value !== 'miraculous_race') {
            this.currentColor = (card.color === 'wild') ? chosenWildColor : card.color;
        }
        // If it's miraculous_race, currentColor stays as is.

        this.handleCardEffect(card);

        if (hand.length === 0) return;

        this.unoCalled[playerId] = false;
    }

    handleCardEffect(card) {
        const opponent = this.currentPlayer === 'player' ? 'ai' : 'player';

        if (card.value === 'reverse') {
            this.ui.showToast(card.value.toUpperCase() + "! Play Again!");
            this.checkPlayableCards();
        } else if (card.value === 'plus2') {
            if (this.mode === 'online') {
                // The drawer is the NEXT player (opponent)
                // We don't draw for them locally unless we are Host?
                // Simpler: Just handle turns. The drawing happens in drawCards logic.
                // We need to sync the DRAW action too.
            }
            this.drawCards(opponent, 2);
            this.ui.showToast("+2! " + (opponent === 'ai' ? 'Opponent' : opponent) + " draws 2 & loses turn!");
            this.checkPlayableCards(); // Current player plays again in 2P 1v1 rules usually? 
            // Wait, existing logic said: "+2 means opponent draws and turn stays?"
            // Usually in 2P, +2 skips the other person, so turn returns to p1.
            // Existing logic does recursively checkPlayableCards for current player. Correct.
        } else if (card.value === 'plus4') {
            this.drawCards(opponent, 4);
            this.ui.showToast("+4! " + (opponent === 'ai' ? 'Opponent' : opponent) + " draws 4 & loses turn!");
            this.checkPlayableCards();
        } else if (card.value === 'miraculous_race') {
            const launcher = this.currentPlayer;
            // The opponent is the one who has to survive or fail
            this.ui.startMinigame(opponent, (result) => {
                if (result === 'lose') {
                    // Failed: opponent draws 1
                    this.drawCards(opponent, 1);
                    this.ui.showToast("Falha na Corrida! Compra 1.");
                } else {
                    // Survived: launcher draws 2 (as requested)
                    this.drawCards(launcher, 2);
                    this.ui.showToast("Corrida Vencida! Lançador compra 2.");
                }
                this.switchTurn();
            });
        } else {
            this.switchTurn();
        }
    }

    drawCards(playerId, count) {
        for (let i = 0; i < count; i++) {
            const card = this.drawCardFromDeck();
            if (card) {
                this.players[playerId].hand.push(card);
                this.ui.animateDraw(playerId, card);
            }
        }
    }

    playerDraw() {
        if (this.currentPlayer !== 'player') return;

        if (this.mode === 'online' && window.multiplayer) {
            window.multiplayer.syncDraw();
        }

        this.drawCardAction('player');
    }

    // Generalized draw action 
    drawCardAction(playerId) {
        const card = this.drawCardFromDeck();
        if (card) {
            this.players[playerId].hand.push(card);
            this.ui.animateDraw(playerId, card);

            // Per instructions: "Playable card drawn!" logic?
            // In online mode, we must accept if they play it.
            // This is local logic only for displaying options.
            if (playerId === 'player') { // Only show toast if it's ME
                if (this.isCardPlayable(card)) {
                    this.ui.showToast("Playable card drawn!");
                    this.checkPlayableCards();
                } else {
                    this.ui.showToast("No playable card.");
                    setTimeout(() => this.switchTurn(), 1000);
                }
            } else {
                // Remote player drew.
                // If they can play, they will send a MOVE.
                // If they can't, they will send SKIP (or we timeout switch?).
                // "Simple" implementation: Auto-skip if bad card?
                // For 'ai' (remote), we just wait for next message.
                // If they drew and it's not playable, they should send 'PASS_TURN'?
                // We need a PASS_TURN event.
            }
        }
    }

    aiDraw() {
        const card = this.drawCardFromDeck();
        if (card) {
            this.players.ai.hand.push(card);
            this.ui.animateDraw('ai', card);
            return card;
        }
        return null;
    }

    switchTurn() {
        if (this.mode === '1v1') {
            this.ui.showTurnBlocker(() => {
                this.currentPlayer = this.currentPlayer === 'player' ? 'ai' : 'player';
                this.ui.updateTurnIndicator(this.currentPlayer);
                this.checkPlayableCards();
            });
        } else if (this.mode === 'online') {
            this.currentPlayer = this.currentPlayer === 'player' ? 'ai' : 'player';
            this.ui.updateTurnIndicator(this.currentPlayer);
            this.checkPlayableCards();

            // Update turn in Firebase
            // Update turn in Firebase
            if (window.multiplayer) {
                // Convert local player ID to Firebase player ID
                const nextFirebasePlayer = this.currentPlayer === 'player' ?
                    window.multiplayer.localPlayerId :
                    (window.multiplayer.localPlayerId === 'host' ? 'client' : 'host');

                console.log(`[Game] Switching turn to: ${this.currentPlayer} (Firebase: ${nextFirebasePlayer})`);
                window.multiplayer.updateTurnInFirebase(nextFirebasePlayer);
            }
        } else {
            this.currentPlayer = this.currentPlayer === 'player' ? 'ai' : 'player';
            this.ui.updateTurnIndicator(this.currentPlayer);
            this.checkPlayableCards();
        }
    }

    endGame(winnerId) {
        this.gameOver = true;
        this.ui.showGameOver(winnerId);
    }

    callUno(playerId) {
        this.unoCalled[playerId] = true;
        if (this.mode === 'online' && playerId === 'player') {
            window.onlineManager.sendData({ type: 'UNO_CALL' });
        }
        this.ui.showToast("UNO!");
    }
}

window.onload = () => {
    window.game = new Game();
};
