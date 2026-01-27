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
    }

    startMatch(mode) {
        this.mode = mode;
        this.players.ai.isBot = (mode === 'bot');

        // Reset states
        this.deck = [];
        this.discardPile = [];
        this.players.player.hand = [];
        this.players.ai.hand = [];
        this.gameOver = false;

        this.createDeck();
        this.shuffleDeck();
        this.dealCards();
        this.startGame();
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
        this.currentPlayer = 'player';
        this.ui.updateTurnIndicator(this.currentPlayer);
        this.checkPlayableCards();
    }

    checkPlayableCards() {
        if (this.gameOver) return;

        if (this.currentPlayer === 'player') {
            const playableIndices = this.getPlayableIndices('player');
            this.ui.highlightPlayableCards(playableIndices);
        } else {
            // AI Turn or Player 2 Turn
            if (this.mode === 'bot') {
                setTimeout(() => this.ai.takeTurn(), 1000);
            } else {
                // Player 2 (Human)
                const playableIndices = this.getPlayableIndices('ai');
                this.ui.highlightPlayableCards(playableIndices);
                // We create a toast or indicator? Handled by updateTurnIndicator
            }
        }
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
        if (playerId !== this.currentPlayer) return;

        const hand = this.players[playerId].hand;
        const card = hand[cardIndex];

        if (!this.isCardPlayable(card)) return;

        hand.splice(cardIndex, 1);
        this.discardPile.push(card);
        this.ui.animatePlay(playerId, card, cardIndex);

        this.currentValue = card.value;
        this.currentColor = (card.color === 'wild') ? chosenWildColor : card.color;

        this.handleCardEffect(card);

        if (hand.length === 0) return;

        // UNO Check Logic
        // In this simplified version, we just check if flag was set.
        // If they have 1 card left now, they should have pressed UNO BEFORE playing?
        // Rules vary. Let's say if they have 1 card left AFTER playing, and didn't call UNO...
        // But the button logic is "Call UNO" when you preserve button.
        // Let's keep it simple: Reset flag.
        if (this.unoCalled[playerId]) {
            // Good job
        } else if (hand.length === 1) {
            // Failure to call UNO -> Penalty?
            // Implementing basic penalty: 2 cards
            // setTimeout(() => {
            //    this.ui.showToast("Forgot UNO! +2 Cards");
            //    this.drawCards(playerId, 2);
            // }, 1000);
            // Leaving out for user satisfaction unless requested stricter rules.
        }
        this.unoCalled[playerId] = false;
    }

    handleCardEffect(card) {
        const opponent = this.currentPlayer === 'player' ? 'ai' : 'player';

        if (card.value === 'reverse') {
            // In 2 player, reverse acts like skip -> play again
            this.ui.showToast(card.value.toUpperCase() + "! Play Again!");
            this.checkPlayableCards();
        } else if (card.value === 'plus2') {
            this.drawCards(opponent, 2);
            this.ui.showToast("+2! " + (opponent === 'ai' && this.mode === '1v1' ? 'P2' : opponent) + " draws 2 & loses turn!");
            this.drawAndSkip(opponent, 0); // Logic handled in drawCards, but we need to keep turn?
            // Standard UNO: +2 means opponent draws and loses turn. So Current Player plays again? 
            // Yes, in 2 player match.
            this.checkPlayableCards();
        } else if (card.value === 'plus4') {
            this.drawCards(opponent, 4);
            this.ui.showToast("+4! " + (opponent === 'ai' && this.mode === '1v1' ? 'P2' : opponent) + " draws 4 & loses turn!");
            this.checkPlayableCards();
        } else {
            // Normal card or Wild (without effect on turn order usually, but Wild is just play)
            // Wild +4 is handled above. Ordinary Wild is just color change.
            // Check if it was a Skip card? No 'skip' value in createDeck? 
            // Ah, specialValues = ['reverse', 'plus2']. Skip is missing in createDeck?
            // "Skip" symbol usually exists.
            // If card.value === 'block' or 'skip'?
            // createDeck had: const specialValues = ['reverse', 'plus2'];
            // It seems 'skip' was missing in ORIGINAL code too? 
            // Checking original file... 
            // Line 31: const specialValues = ['reverse', 'plus2'];
            // It seems the original code forgot Skip cards! 
            // The prompt didn't ask to fix it, so I won't add them to avoid texture missing issues.

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
        if (this.currentPlayer !== 'player') return; // Strict turn check
        this.drawCardAction('player');
    }

    // Generalized draw action 
    drawCardAction(playerId) {
        const card = this.drawCardFromDeck();
        if (card) {
            this.players[playerId].hand.push(card);
            this.ui.animateDraw(playerId, card);

            if (this.isCardPlayable(card)) {
                this.ui.showToast("Playable card drawn!");
                // Let them play it if they want.
                this.checkPlayableCards();
            } else {
                this.ui.showToast("No playable card.");
                setTimeout(() => this.switchTurn(), 1000);
            }
        }
    }

    aiDraw() {
        // Only used by AI logic
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
            // Show turn blocker before switching officially
            this.ui.showTurnBlocker(() => {
                this.currentPlayer = this.currentPlayer === 'player' ? 'ai' : 'player';
                this.ui.updateTurnIndicator(this.currentPlayer);
                this.checkPlayableCards();
            });
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
        this.ui.showToast("UNO!");
    }
}

window.onload = () => {
    window.game = new Game();
};
