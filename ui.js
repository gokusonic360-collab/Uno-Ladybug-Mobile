class UI {
    constructor(game) {
        this.game = game;
        this.playerHandEl = document.getElementById('player-hand');
        this.aiHandEl = document.getElementById('ai-hand');
        this.drawPileEl = document.getElementById('draw-pile');
        this.discardPileEl = document.getElementById('discard-pile');

        if (this.drawPileEl) {
            this.drawPileEl.addEventListener('click', () => {
                // Allow draw if current player is player or if it's 1v1 and it's opponent (AI ID) turn
                if (this.game.currentPlayer === 'player' || (this.game.mode === '1v1' && this.game.currentPlayer === 'ai')) {
                    this.game.drawCardAction(this.game.currentPlayer);
                }
            });
        }

        this.unoBtn = document.getElementById('uno-btn');
        if (this.unoBtn) {
            this.unoBtn.addEventListener('click', () => {
                window.soundManager.play('uno');
                this.game.callUno('player');
                this.unoBtn.classList.add('hidden');
            });
        }

        // Modal Elements
        this.colorModal = document.getElementById('color-picker-modal');
        this.colorBtns = document.querySelectorAll('.color-btn');
        if (this.colorBtns) {
            this.colorBtns.forEach(btn => {
                btn.addEventListener('click', (e) => {
                    const color = e.target.dataset.color;
                    this.resolveWildCard(color);
                });
            });
        }

        this.pendingWildCardIndex = null;
        this.turnBlockerActive = false;

        // Final Release: Start Menu
        this.initStartScreen();
        this.initTurnBlocker();
    }

    initTurnBlocker() {
        this.turnBlockerEl = document.getElementById('turn-blocker');
        this.readyBtn = document.getElementById('ready-btn');
        if (this.readyBtn) {
            this.readyBtn.addEventListener('click', () => {
                window.soundManager.play('menu_click');
                this.hideTurnBlocker();
                if (this.onBlockerResolved) {
                    this.onBlockerResolved();
                    this.onBlockerResolved = null;
                }
            });
        }
    }

    showTurnBlocker(callback) {
        this.turnBlockerActive = true;
        this.onBlockerResolved = callback;
        const msg = document.getElementById('blocker-msg');
        const nextPlayer = this.game.currentPlayer === 'player' ? 'Player 2' : 'Player 1';
        if (msg) msg.innerText = `Pass the Device to ${nextPlayer}`;

        if (this.turnBlockerEl) {
            this.turnBlockerEl.classList.remove('hidden');
        }
        // Force hide hands while blocker is up
        this.renderHand('player', this.game.players.player.hand);
        this.renderHand('ai', this.game.players.ai.hand);
    }

    hideTurnBlocker() {
        this.turnBlockerActive = false;
        if (this.turnBlockerEl) {
            this.turnBlockerEl.classList.add('hidden');
        }
    }

    initStartScreen() {
        const startScreen = document.getElementById('start-screen');
        const playBtn = document.getElementById('start-play-btn');
        const p2Btn = document.getElementById('start-2p-btn');
        const yoyo = document.getElementById('transition-yoyo');
        const gameContainer = document.getElementById('game-container');

        const launchGame = (mode) => {
            // Play Yo-yo transition
            window.soundManager.play('menu_click'); // Click Sound
            window.soundManager.startMusic();
            yoyo.classList.remove('hidden');
            yoyo.classList.add('yoyo-animating');

            setTimeout(() => {
                startScreen.classList.add('hidden');
                gameContainer.classList.remove('hidden');
                this.game.startMatch(mode);
            }, 500);

            setTimeout(() => {
                yoyo.classList.add('hidden');
                yoyo.classList.remove('yoyo-animating');
            }, 1000);
        };

        if (playBtn) {
            playBtn.addEventListener('click', () => launchGame('bot'));
        }
        if (p2Btn) {
            p2Btn.addEventListener('click', () => launchGame('1v1'));
        }
    }

    renderHand(playerId, hand) {
        const container = playerId === 'player' ? this.playerHandEl : this.aiHandEl;
        container.innerHTML = '';
        const isPlayer = playerId === 'player';

        // In 1v1 mode, we assume shared device, so likely showing the active player's cards 
        // or keeping "Opponent" hidden until they click "Ready".
        const is1v1 = this.game.mode === '1v1';
        const isCurrent = playerId === this.game.currentPlayer;

        // VISIBILITY LOGIC (Mobile 1x1 Polish):
        // 1. If turn blocker is active -> both hands hidden.
        // 2. If 1v1 -> only current player's hand is visible.
        // 3. If BOT mode -> player hand visible, AI hand hidden.

        let showContent = false;
        if (!this.turnBlockerActive) {
            if (is1v1) {
                showContent = isCurrent;
            } else {
                showContent = isPlayer;
            }
        }

        hand.forEach((card, index) => {
            const cardEl = this.createCardElement(card, showContent);

            if (showContent) {
                // Interactive
                cardEl.addEventListener('click', () => this.handleCardClick(playerId, index, card));
                cardEl.classList.add('interactive-card');
            }

            container.appendChild(cardEl);
        });

        if (playerId === 'ai' && is1v1) {
            container.classList.add('p2-hand-active');
        }

        this.updateUnoButton(playerId, hand);
    }

    createCardElement(card, isVisible) {
        const cardEl = document.createElement('div');
        cardEl.className = 'card';

        // Set card identity
        cardEl.dataset.color = card.color;
        cardEl.dataset.value = card.value;

        if (!isVisible) {
            cardEl.classList.add('card-back');
            cardEl.innerHTML = '&nbsp;';
            return cardEl;
        }

        const content = document.createElement('div');
        content.className = 'card-content';

        const topLeft = document.createElement('span');
        topLeft.className = 'card-corner top-left';
        topLeft.innerText = card.value === 'wild' ? 'W' : (card.value === 'plus4' ? '+4' : (card.value === 'plus2' ? '+2' : card.value));

        const botRight = document.createElement('span');
        botRight.className = 'card-corner bottom-right';
        botRight.innerText = card.value === 'wild' ? 'W' : (card.value === 'plus4' ? '+4' : (card.value === 'plus2' ? '+2' : card.value));

        const centerVal = document.createElement('div');
        centerVal.className = 'card-value-center';
        centerVal.innerText = card.value;

        const symbol = document.createElement('div');
        symbol.className = 'card-symbol';

        // Handle character portraits
        const premiumValues = ['plus2', 'reverse', 'wild', 'plus4'];
        if (card.type === 'number' || premiumValues.includes(card.value)) {
            // Map colors to Portuguese folders for mobile builds
            const colorMap = {
                'red': 'vermelhas',
                'blue': 'azuis',
                'green': 'verdes',
                'yellow': 'amarelas',
                'wild': 'especiais'
            };
            const folder = colorMap[card.color] || card.color;
            const assetId = `card_${card.color}_${card.value}`;
            const individualPath = `assets/cards/${folder}/${card.value}.png`;

            // Use AssetManager to get the URL (prioritizing dynamic assets)
            window.AssetManager.getAssetUrl(assetId, individualPath).then(url => {
                symbol.style.backgroundImage = `url('${url}')`;
            });

            symbol.style.backgroundSize = 'cover';
            symbol.style.backgroundPosition = 'center';
            symbol.classList.add('individual-card');

            topLeft.style.display = 'none';
            botRight.style.display = 'none';
            centerVal.style.display = 'none';
            content.style.background = 'transparent';
        } else {
            let symbolPath = '';
            if (card.color === 'wild') symbolPath = 'assets/images/symbol-wild.svg';
            else {
                symbolPath = `assets/images/symbol-${card.color}.svg`;
            }
            symbol.style.backgroundImage = `url('${symbolPath}')`;
            symbol.style.backgroundSize = 'contain';
            symbol.style.backgroundPosition = 'center';
            symbol.style.width = '70%';
            symbol.style.height = '70%';
            centerVal.style.display = 'block';
            topLeft.style.display = 'block';
            botRight.style.display = 'block';
        }
        content.appendChild(symbol);
        content.appendChild(topLeft);
        content.appendChild(botRight);
        content.appendChild(centerVal);
        cardEl.appendChild(content);

        return cardEl;
    }

    updateDiscardPile(card) {
        this.discardPileEl.innerHTML = '';
        const cardEl = this.createCardElement(card, true);
        this.discardPileEl.appendChild(cardEl);
    }

    handleCardClick(playerId, index, card) {
        if (this.game.currentPlayer !== playerId) return;

        if (!this.game.isCardPlayable(card)) {
            window.soundManager.play('lose'); // Error sound
            const container = playerId === 'player' ? this.playerHandEl : this.aiHandEl;
            const cards = container.children;
            if (cards[index]) {
                cards[index].classList.add('anim-shake');
                setTimeout(() => cards[index].classList.remove('anim-shake'), 500);
            }
            return;
        }

        // Just selection sound? Or play logic handles "swipe"?
        // Logic splits here for Wild.
        if (card.color === 'wild') {
            this.pendingWildCardIndex = index;
            window.soundManager.play('menu_click'); // Selection click
            this.showColorModal();
        } else {
            // Normal play -> will call playCard -> animatePlay -> SWIPE sound
            this.game.playCard(playerId, index);
        }
    }

    showColorModal() {
        this.colorModal.classList.remove('hidden');
    }

    resolveWildCard(color) {
        window.soundManager.play('magic_color'); // Magic sound
        this.colorModal.classList.add('hidden');
        if (this.pendingWildCardIndex !== null) {
            this.game.playCard(this.game.currentPlayer, this.pendingWildCardIndex, color);
            this.pendingWildCardIndex = null;
        }
    }

    highlightPlayableCards(indices) {
        if (this.game.currentPlayer === 'player') {
            const cards = this.playerHandEl.children;
            for (let i = 0; i < cards.length; i++) cards[i].classList.remove('glow-playable');
            indices.forEach(idx => {
                if (cards[idx]) cards[idx].classList.add('glow-playable');
            });
        }
        else if (this.game.mode === '1v1' && this.game.currentPlayer === 'ai') {
            const cards = this.aiHandEl.children;
            for (let i = 0; i < cards.length; i++) cards[i].classList.remove('glow-playable');
            indices.forEach(idx => {
                if (cards[idx]) cards[idx].classList.add('glow-playable');
            });
        }
    }

    updateTurnIndicator(playerId) {
        const toast = document.getElementById('turn-indicator');
        const container = document.getElementById('game-container');

        let msg = "";
        if (this.game.mode === '1v1') {
            msg = playerId === 'player' ? "Player 1 Turn" : "Player 2 Turn";
        } else {
            msg = playerId === 'player' ? "Your Turn" : "Opponent's Turn";
        }

        toast.innerText = msg;
        toast.classList.remove('hidden');
        toast.style.animation = 'none';
        toast.offsetHeight;
        toast.style.animation = 'fadeInOut 2s forwards';

        if (playerId === 'player') {
            container.classList.add('active-turn');
        } else {
            container.classList.remove('active-turn');
        }

        const pAvatar = document.querySelector('.player-avatar');
        const aiAvatar = document.querySelector('.ai-avatar');

        if (playerId === 'player') {
            pAvatar.classList.add('active-turn');
            aiAvatar.classList.remove('active-turn');
        } else {
            pAvatar.classList.remove('active-turn');
            aiAvatar.classList.add('active-turn');
        }
    }

    animatePlay(playerId, card, index) {
        window.soundManager.play('card_swipe'); // Swipe Sound from request
        const isPlayer = playerId === 'player';
        const parentEl = isPlayer ? this.playerHandEl : this.aiHandEl;

        // Match card element logic
        let cardEl;
        if (isPlayer) {
            cardEl = (index !== undefined && parentEl.children[index]) ? parentEl.children[index] : null;
        } else {
            // For AI/P2, if 1v1 and interactive, we might have index
            if (this.game.mode === '1v1' && index !== undefined && parentEl.children[index]) {
                cardEl = parentEl.children[index];
            } else {
                cardEl = parentEl.lastElementChild;
            }
        }

        if (cardEl) {
            const rect = cardEl.getBoundingClientRect();
            // IMMEDIATE REMOVAL/HIDE to prevent "clones"
            cardEl.style.visibility = 'hidden';

            const flyingCard = cardEl.cloneNode(true);
            flyingCard.style.visibility = 'visible';

            // If it was a card back (AI/Hidden P2), reveal it for the throw
            if (flyingCard.classList.contains('card-back')) {
                flyingCard.classList.remove('card-back');
                // We need new content. Simplified: Reuse createCardElement
                const temp = this.createCardElement(card, true);
                flyingCard.innerHTML = temp.innerHTML;
                flyingCard.style.backgroundImage = temp.style.backgroundImage;
            }

            // Remove original from DOM
            cardEl.remove();

            // Re-render hand immediately
            this.renderHand(playerId, this.game.players[playerId].hand);

            flyingCard.classList.add('card-flying');
            flyingCard.style.position = 'fixed';
            flyingCard.style.left = rect.left + 'px';
            flyingCard.style.top = rect.top + 'px';
            flyingCard.style.width = rect.width + 'px';
            flyingCard.style.height = rect.height + 'px';
            flyingCard.style.zIndex = '10000';
            flyingCard.style.margin = '0';

            // Rotation logic
            if (!isPlayer && this.game.mode !== '1v1') flyingCard.style.transform = 'rotate(180deg)';
            else if (!isPlayer && this.game.mode === '1v1') flyingCard.style.transform = 'rotate(180deg)';

            document.body.appendChild(flyingCard);
            flyingCard.offsetHeight;

            const discardRect = this.discardPileEl.getBoundingClientRect();
            const destX = discardRect.left - rect.left + (discardRect.width - rect.width) / 2;
            const destY = discardRect.top - rect.top + (discardRect.height - rect.height) / 2;
            const limitRot = (Math.random() * 20 - 10);

            flyingCard.style.transition = 'all 0.6s cubic-bezier(0.2, 0.8, 0.2, 1)';
            flyingCard.style.transform = `translate(${destX}px, ${destY}px) rotate(${limitRot}deg) scale(1.1)`;

            flyingCard.ontransitionend = () => {
                flyingCard.remove();
                this.updateDiscardPile(card);
                this.triggerSpecialEffects(card);

                if (this.game.players[playerId].hand.length === 0) {
                    this.game.endGame(playerId);
                }
            };
        } else {
            this.updateDiscardPile(card);
            this.renderHand(playerId, this.game.players[playerId].hand);
            this.triggerSpecialEffects(card);
        }
    }

    async refreshDynamicBackground() {
        console.log('Refreshing dynamic background...');
        const bgLayer = document.querySelector('.background-layer');
        if (!bgLayer) return;

        // Tenta buscar o cenário dinâmico
        const dynamicBgUrl = await window.AssetManager.getAssetUrl('bg_gameplay_01', null);

        if (dynamicBgUrl) {
            console.log('Applying dynamic background: bg_gameplay_01');
            bgLayer.style.backgroundImage = `url('${dynamicBgUrl}')`;
        } else {
            console.log('Dynamic background not found. Using local background.');
            bgLayer.style.backgroundImage = "url('assets/images/background.png')";
        }
    }

    triggerSpecialEffects(card) {
        if (card.value === 'reverse') {
            // Maybe generic special sound?
            window.soundManager.play('magic_color');
            const container = document.getElementById('game-container');
            container.classList.remove('spin-interface');
            void container.offsetWidth;
            container.classList.add('spin-interface');
            setTimeout(() => {
                container.classList.remove('spin-interface');
            }, 1000);
            this.showToast("REVERSE!");
        } else if (card.value === 'wild') {
            window.soundManager.play('magic_color');
            this.createExplosion();
        } else if (card.value === 'plus2') {
            window.soundManager.play('special_plus2');
            // Plus 2 logic handled in game.js, but visual effect here if any?
            // Usually just toast.
        } else if (card.value === 'plus4') {
            window.soundManager.play('special_plus4');
            const chosenColor = this.game.currentColor;
            if (chosenColor === 'red') {
                // window.soundManager.play('hero_ladybug'); // If specific hero sound exists on top +4
                this.createLadybugHeroEffect();
            } else if (chosenColor === 'green') {
                // window.soundManager.play('hero_catnoir');
                this.createCatNoirHeroEffect();
            } else if (chosenColor === 'yellow') {
                this.createButterflyHeroEffect();
            } else if (chosenColor === 'blue') {
                this.createWolfHeroEffect();
            } else {
                this.createExplosion();
            }
        }
    }

    createLadybugHeroEffect() {
        this.showToast("TALISMÃ! +4 Cards!");
        const ladybug = document.createElement('div');
        ladybug.className = 'ladybug-flying';
        ladybug.innerText = "🐞";
        ladybug.style.zIndex = '2000000';
        document.body.appendChild(ladybug);
        setTimeout(() => {
            if (document.body.contains(ladybug)) ladybug.remove();
        }, 4000);
    }

    createCatNoirHeroEffect() {
        this.showToast("CATACLISMO! +4 Cards!");
        const scratch1 = document.createElement('div');
        scratch1.className = 'giant-scratch one';
        scratch1.style.zIndex = '10001';
        document.body.appendChild(scratch1);
        const scratch2 = document.createElement('div');
        scratch2.className = 'giant-scratch two';
        scratch2.style.zIndex = '10001';
        document.body.appendChild(scratch2);
        setTimeout(() => {
            scratch1.remove();
            scratch2.remove();
        }, 4000);
    }

    createWolfHeroEffect() {
        this.showToast("UIVO DO LOBO! +4 Cards!");
        const overlay = document.createElement('div');
        overlay.className = 'night-mode';
        overlay.style.zIndex = '10000';
        document.body.appendChild(overlay);
        setTimeout(() => overlay.remove(), 5000);
    }

    createButterflyHeroEffect() {
        this.showToast("AKUMATIZE! +4 Cards!");
        for (let i = 0; i < 12; i++) {
            setTimeout(() => {
                const akuma = document.createElement('div');
                akuma.className = 'akuma-particle';
                akuma.innerHTML = '🦋';
                akuma.style.top = Math.random() * 80 + 10 + 'vh';
                akuma.style.left = '-50px';
                akuma.style.color = '#e67e22';
                document.body.appendChild(akuma);
                setTimeout(() => akuma.remove(), 2100);
            }, i * 150);
        }
    }

    createExplosion() {
        const explosion = document.createElement('div');
        explosion.className = 'explosion-overlay';
        document.body.appendChild(explosion);
        setTimeout(() => explosion.remove(), 1000);
    }

    animateDraw(playerId, card) {
        window.soundManager.play('card_pop'); // Pop sound
        this.renderHand(playerId, this.game.players[playerId].hand);
    }

    updateUnoButton(playerId, hand) {
        // Simple logic: if active player has 2 cards, show UNO
        if (playerId === this.game.currentPlayer) {
            if (hand.length === 2 && !this.game.unoCalled[playerId]) {
                this.unoBtn.classList.remove('hidden');
                if (playerId === 'ai') { // P2
                    this.unoBtn.style.top = '25%';
                    this.unoBtn.style.bottom = 'auto';
                } else {
                    this.unoBtn.style.top = 'auto';
                    this.unoBtn.style.bottom = '140px';
                }
            } else {
                this.unoBtn.classList.add('hidden');
            }
        }
    }

    showToast(msg) {
        const toast = document.getElementById('turn-indicator');
        toast.innerText = msg;
        toast.classList.remove('hidden');
        toast.style.animation = 'none';
        toast.offsetHeight;
        toast.style.animation = 'fadeInOut 2s forwards';
    }

    showGameOver(winnerId) {
        window.soundManager.stopMusic();
        window.soundManager.play(winnerId === 'player' ? 'win' : 'lose');

        const modal = document.getElementById('game-end-modal');
        const content = modal.querySelector('.result-content');

        content.innerHTML = `
            <div class="result-image ${winnerId === 'player' ? 'victory-bg' : 'defeat-bg'}"></div>
            <div class="result-text-area">
                <h1 id="result-title" class="result-title">${winnerId === 'player' ? 'ZEROU!' : 'DERROTA'}</h1>
                <p id="result-message">${winnerId === 'player' ? 'Você salvou Paris de Hawkmoth!' : 'Hawkmoth venceu desta vez...'}</p>
                <button id="restart-btn" class="primary-btn" style="margin-top:20px; padding: 15px 40px; border-radius:30px; border:none; background:#ff3b3b; color:white; font-weight:900; cursor:pointer;">JOGAR NOVAMENTE</button>
            </div>
        `;

        const title = content.querySelector('#result-title');
        if (winnerId === 'player') {
            title.style.color = "var(--color-red)";
        } else {
            title.style.color = "#8e44ad";
        }

        modal.classList.remove('hidden');
        content.querySelector('#restart-btn').onclick = () => location.reload();
    }
}


