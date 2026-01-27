class AI {
    constructor(game) {
        this.game = game;
    }

    takeTurn() {
        if (this.game.currentPlayer !== 'ai' || this.game.gameOver) return;

        const hand = this.game.players.ai.hand;
        const playableIndices = [];

        // Find all playable cards
        hand.forEach((card, index) => {
            if (this.game.isCardPlayable(card)) {
                playableIndices.push(index);
            }
        });

        if (playableIndices.length > 0) {
            // Strategy: 
            // 1. Play +2/+4 if player has low cards (<=3)
            // 2. Play Action cards if available to delay
            // 3. Play number cards matching color
            // 4. Play number cards matching value
            // 5. Play Wilds last unless necessary

            // Score cards
            let bestIndex = -1;
            let maxScore = -100;

            playableIndices.forEach(idx => {
                const card = hand[idx];
                let score = 0;

                // Base score
                if (card.type === 'number') score = 10;
                if (card.type === 'action') score = 20;
                if (card.color === 'wild') score = 5; // Save wilds

                // Contextual modifiers
                if (this.game.players.player.hand.length <= 3) {
                    if (card.value === 'plus2') score += 50;
                    if (card.value === 'plus4') score += 50;
                    if (card.value === 'reverse') score += 30;
                }

                if (score > maxScore) {
                    maxScore = score;
                    bestIndex = idx;
                }
            });

            const chosenIndex = bestIndex;
            const card = hand[chosenIndex];

            // Decide Wild Color
            let chosenColor = null;
            if (card.color === 'wild') {
                chosenColor = this.chooseBestColor(hand);
            }

            // Simulate thinking time
            setTimeout(() => {
                this.game.playCard('ai', chosenIndex, chosenColor);
            }, 1000);

        } else {
            // Draw card
            setTimeout(() => {
                const drawnCard = this.game.aiDraw();
                if (drawnCard) {
                    // Simple play-immediately if valid logic for AI
                    if (this.game.isCardPlayable(drawnCard)) {
                        let color = null;
                        if (drawnCard.color === 'wild') color = this.chooseBestColor(this.game.players.ai.hand);
                        setTimeout(() => {
                            // Last index is new card
                            this.game.playCard('ai', this.game.players.ai.hand.length - 1, color);
                        }, 1000);
                    } else {
                        setTimeout(() => this.game.switchTurn(), 1000);
                    }
                } else {
                    // Deck empty?
                    this.game.switchTurn();
                }
            }, 1000);
        }

        // AI UNO Logic
        if (hand.length === 2 && !this.game.unoCalled['ai']) {
            // AI always remembers to call UNO (it's perfect, or make it 90% chance)
            if (Math.random() > 0.1) {
                this.game.unoCalled['ai'] = true;
                this.game.ui.showToast("AI calls UNO!");
            }
        }
    }

    chooseBestColor(hand) {
        const counts = { red: 0, green: 0, blue: 0, yellow: 0 };
        hand.forEach(c => {
            if (c.color !== 'wild') counts[c.color]++;
        });
        // Return color with max count
        return Object.keys(counts).reduce((a, b) => counts[a] > counts[b] ? a : b);
    }
}
