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

        // Minigame
        this.minigameOverlay = document.getElementById('minigame-overlay');
        this.minigame = new MinigameRunner('minigame-canvas', 'minigame-timer');
    }

    // CRITICAL FIX: launchGame as class method so it's accessible everywhere
    launchGame(mode) {
        const startScreen = document.getElementById('start-screen');
        const gameContainer = document.getElementById('game-container');
        const yoyo = document.getElementById('transition-yoyo');

        console.log(`[UI] Launching game in mode: ${mode}`);

        // Play Yo-yo transition
        window.soundManager.play('menu_click');
        window.soundManager.startMusic();
        yoyo.classList.remove('hidden');
        yoyo.classList.add('yoyo-animating');

        setTimeout(() => {
            startScreen.classList.add('hidden');
            gameContainer.classList.remove('hidden');
            this.game.startMatch(mode);
            console.log(`[UI] Game container visible, match started`);
        }, 500);

        setTimeout(() => {
            yoyo.classList.add('hidden');
            yoyo.classList.remove('yoyo-animating');
        }, 1000);
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

        // launchGame is now a class method - removed local definition

        if (playBtn) {
            playBtn.addEventListener('click', () => this.launchGame('bot'));
        }
        if (p2Btn) {
            p2Btn.addEventListener('click', () => this.launchGame('1v1'));
        }

        // Online Mode Elements
        const onlineBtn = document.createElement('button');
        onlineBtn.className = 'play-btn-large';
        onlineBtn.style.background = '#2980b9';
        onlineBtn.innerText = "ONLINE";
        onlineBtn.style.marginTop = '15px';

        const onlineMenu = document.createElement('div');
        onlineMenu.className = 'hidden';
        onlineMenu.style.display = 'flex';
        onlineMenu.style.flexDirection = 'column';
        onlineMenu.style.gap = '10px';
        onlineMenu.style.alignItems = 'center';

        // Check URL for room param (Legacy Link Support)
        const urlParams = new URLSearchParams(window.location.search);
        const roomParam = urlParams.get('room');

        // New Lobby UI Structure
        onlineMenu.innerHTML = `
            <h2 style="color:white; margin:0;">Lobby</h2>
            <div id="lobby-list" style="width:90%; height:200px; background:rgba(0,0,0,0.5); border-radius:10px; overflow-y:auto; padding:10px; text-align:left; color:white;">
                <div style="text-align:center; padding-top:80px; color:#bdc3c7;">Loading Rooms...</div>
            </div>
            
            <div style="display:flex; gap:10px; margin-top:10px; width:90%; justify-content:center;">
                 <button id="open-create-modal-btn" class="play-btn-large" style="background:#e67e22; font-size:1rem; padding:10px 20px; flex:1;">CREATE ROOM</button>
            </div>
            
            <button id="back-menu-btn" style="background:transparent; border:none; color:white; text-decoration:underline; margin-top:5px;">Back</button>
            
            <!-- Modals -->
            <div id="create-room-modal" class="hidden" style="position:absolute; top:0; left:0; width:100%; height:100%; background:rgba(0,0,0,0.85); display:flex; flex-direction:column; justify-content:center; align-items:center; z-index:100;">
                <h3 style="color:white;">Create Room</h3>
                <input type="text" id="new-room-name" placeholder="Room Name" style="padding:10px; font-size:1.2rem; border-radius:5px; margin-bottom:10px; width:80%;">
                <input type="number" id="new-room-pass" placeholder="Password (4 digits)" style="padding:10px; font-size:1.2rem; border-radius:5px; margin-bottom:10px; width:80%;" maxlength="4">
                <button id="confirm-create-btn" class="play-btn-large" style="background:#2ecc71;">CREATE</button>
                <button id="cancel-create-btn" style="color:white; background:transparent; border:none; margin-top:10px; text-decoration:underline;">Cancel</button>
                <div id="create-status" style="color:yellow; margin-top:5px;"></div>
            </div>

            <div id="password-prompt-modal" class="hidden" style="position:absolute; top:0; left:0; width:100%; height:100%; background:rgba(0,0,0,0.85); display:flex; flex-direction:column; justify-content:center; align-items:center; z-index:100;">
                <h3 style="color:white;">Enter Password for <span id="target-room-name"></span></h3>
                <input type="number" id="join-room-pass" placeholder="Password" style="padding:10px; font-size:1.2rem; border-radius:5px; margin-bottom:10px; width:80%;" maxlength="4">
                <button id="confirm-join-btn" class="play-btn-large" style="background:#3498db;">JOIN</button>
                <button id="cancel-join-btn" style="color:white; background:transparent; border:none; margin-top:10px; text-decoration:underline;">Cancel</button>
                <div id="join-status" style="color:yellow; margin-top:5px;"></div>
            </div>
        `;

        p2Btn.parentNode.appendChild(onlineBtn);
        p2Btn.parentNode.appendChild(onlineMenu);

        // Elements
        const lobbyList = onlineMenu.querySelector('#lobby-list');
        const openCreateBtn = onlineMenu.querySelector('#open-create-modal-btn');
        const createModal = onlineMenu.querySelector('#create-room-modal');
        const confirmCreateBtn = onlineMenu.querySelector('#confirm-create-btn');
        const cancelCreateBtn = onlineMenu.querySelector('#cancel-create-btn');
        const newRoomName = onlineMenu.querySelector('#new-room-name');
        const newRoomPass = onlineMenu.querySelector('#new-room-pass');
        const createStatus = onlineMenu.querySelector('#create-status');

        const passModal = onlineMenu.querySelector('#password-prompt-modal');
        const targetRoomName = onlineMenu.querySelector('#target-room-name');
        const joinPass = onlineMenu.querySelector('#join-room-pass');
        const confirmJoinBtn = onlineMenu.querySelector('#confirm-join-btn');
        const cancelJoinBtn = onlineMenu.querySelector('#cancel-join-btn');
        const joinStatus = onlineMenu.querySelector('#join-status');

        let selectedRoomId = null;

        // --- Logic ---

        onlineBtn.addEventListener('click', () => {
            console.log('[UI] ONLINE button clicked');
            playBtn.classList.add('hidden');
            p2Btn.classList.add('hidden');
            onlineBtn.classList.add('hidden');
            onlineMenu.classList.remove('hidden');

            // Start Listening to Rooms
            if (window.LobbyManager) {
                console.log('[UI] Starting to listen for rooms...');
                window.LobbyManager.listenToRooms((rooms) => {
                    console.log(`[UI] Received ${rooms.length} rooms from Firebase`);

                    if (rooms.length === 0) {
                        lobbyList.innerHTML = `<div style="text-align:center; padding-top:80px; color:#bdc3c7;">No rooms found. Create one!</div>`;
                    } else {
                        lobbyList.innerHTML = '';
                        rooms.forEach(room => {
                            console.log(`[UI] Creating button for room: ${room.name} (ID: ${room.id})`);

                            const item = document.createElement('div');
                            item.style.background = 'rgba(255,255,255,0.1)';
                            item.style.padding = '10px';
                            item.style.marginBottom = '5px';
                            item.style.borderRadius = '5px';
                            item.style.display = 'flex';
                            item.style.justifyContent = 'space-between';
                            item.style.alignItems = 'center';
                            item.innerHTML = `<span>${room.name}</span> <button class="join-btn" data-id="${room.id}" data-name="${room.name}" style="background:#3498db; border:none; color:white; padding:5px 15px; border-radius:5px; cursor:pointer;">Join</button>`;
                            lobbyList.appendChild(item);

                            // CRITICAL: Add event listener to the dynamically created button
                            const joinBtn = item.querySelector('.join-btn');
                            joinBtn.addEventListener('click', (e) => {
                                console.log(`[UI] Join button clicked for room: ${e.target.dataset.name}`);
                                selectedRoomId = e.target.dataset.id;
                                targetRoomName.innerText = e.target.dataset.name;
                                passModal.classList.remove('hidden');
                                joinPass.value = '';
                                joinPass.focus();
                                passModal.style.display = 'flex'; // Ensure flex
                            });
                        });
                    }
                });
            } else {
                console.error('[UI] LobbyManager not found!');
                lobbyList.innerHTML = `<div style="color:red; text-align:center; padding-top:80px;">Lobby System Error (Missing DB)</div>`;
            }
        });

        const closeOnlineMenu = () => {
            playBtn.classList.remove('hidden');
            p2Btn.classList.remove('hidden');
            onlineBtn.classList.remove('hidden');
            onlineMenu.classList.add('hidden');
            if (window.LobbyManager) window.LobbyManager.stopListening();
        };

        onlineMenu.querySelector('#back-menu-btn').addEventListener('click', closeOnlineMenu);

        // CREATE ROOM FLOW
        openCreateBtn.addEventListener('click', () => {
            console.log('[UI] Create Room button clicked');
            createModal.classList.remove('hidden');
            createModal.style.display = 'flex';
            newRoomName.value = '';
            newRoomPass.value = '';
            createStatus.innerText = '';
        });

        cancelCreateBtn.addEventListener('click', () => {
            console.log('[UI] Cancel Create button clicked');
            createModal.classList.add('hidden');
            createModal.style.display = 'none';
        });

        confirmCreateBtn.addEventListener('click', () => {
            const name = newRoomName.value;
            const pass = newRoomPass.value;

            console.log(`[UI] Confirm Create clicked - Name: "${name}", Pass: "${pass}"`);

            if (!name || !pass) {
                createStatus.innerText = "Name and Password required!";
                return;
            }

            createStatus.innerText = "Initializing Host...";

            if (!window.OnlineManager) {
                createStatus.innerText = "Error: OnlineManager missing";
                console.error('[UI] OnlineManager class not found!');
                return;
            }

            // 1. Init Peer Host
            if (!window.onlineManager) {
                console.log('[UI] Creating new OnlineManager instance');
                window.onlineManager = new window.OnlineManager(this.game);
            }

            let currentDbRoomId = null;

            console.log('[UI] Initializing Peer as Host...');
            window.onlineManager.init(true, null, (status, data) => {
                console.log(`[Host] Status Update: ${status}`, data);

                if (status === 'ROOM_CREATED') {
                    // 2. Peer Ready, Create in Lobby
                    createStatus.innerText = "Registering Room...";
                    console.log(`[Host] Peer ID created: ${data}, registering in Firebase...`);

                    window.LobbyManager.createRoom(name, pass, data, (dbRoomId) => {
                        currentDbRoomId = dbRoomId;
                        console.log(`[Host] Room registered in Firebase with ID: ${dbRoomId}`);

                        // CRITICAL: Update OnlineManager with the Firebase Room ID
                        window.onlineManager.dbRoomId = dbRoomId;

                        createStatus.innerText = "Waiting for player...";

                        // UI stays blocked until player joins
                        createModal.innerHTML = `<h3 style="color:white;">Room: ${name}</h3><div style="color:#f1c40f;">Waiting for player...</div>`;
                    }, (err) => {
                        console.error('[Host] Firebase error:', err);
                        createStatus.innerText = "DB Error: " + err;
                    });
                } else if (status === 'CONNECTED') {
                    // Player joined!
                    console.log('[Host] Client connected to peer!');
                    createStatus.innerText = "Player Connected! Starting...";
                } else if (status === 'GAME_STARTING') {
                    console.log('[Host] Game starting, cleaning up lobby...');
                    createModal.classList.add('hidden');

                    // Note: Room cleanup is now handled in OnlineManager.markGameStarted()

                    setTimeout(() => this.launchGame('online'), 500);
                }
            }, pass); // pass is not strictly needed for Host peer verification now, but good to keep state
        });

        // JOIN FLOW
        cancelJoinBtn.addEventListener('click', () => {
            passModal.classList.add('hidden');
            passModal.style.display = 'none';
        });

        confirmJoinBtn.addEventListener('click', () => {
            const pass = joinPass.value;
            if (!pass) return;

            joinStatus.innerText = "Validating...";

            window.LobbyManager.validateRoom(selectedRoomId, pass, (hostPeerId) => {
                joinStatus.innerText = "Password Correct! Connecting...";

                if (!window.onlineManager) window.onlineManager = new window.OnlineManager(this.game);

                // CRITICAL: Set the Firebase Room ID for Player 2
                window.onlineManager.dbRoomId = selectedRoomId;

                // Connect to Host Peer
                window.onlineManager.init(false, hostPeerId, (status, data) => {
                    console.log(`[Client] Status: ${status}`);

                    if (status === 'CONNECTED') {
                        joinStatus.innerText = "Connected! Waiting for host...";
                    } else if (status === 'WAITING_FOR_HOST') {
                        joinStatus.innerText = "Handshaking...";
                        // Player 2 is now listening for game start via Firebase
                    } else if (status === 'ERROR') {
                        joinStatus.innerText = "Connection Error: " + data;
                    }
                }, pass, selectedRoomId); // Pass Firebase Room ID as 5th parameter

            }, (err) => {
                joinStatus.innerText = err;
            });
        });
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
        botRight.innerText = card.value === 'wild' ? 'W' : (card.value === 'plus4' ? '+4' : (card.value === 'plus2' ? '+2' : (card.value === 'miraculous_race' ? '🚗' : card.value)));

        const centerVal = document.createElement('div');
        centerVal.className = 'card-value-center';
        centerVal.innerText = card.value === 'miraculous_race' ? 'RACE' : card.value;

        const symbol = document.createElement('div');
        symbol.className = 'card-symbol';

        // Handle character portraits
        const premiumValues = ['plus2', 'reverse', 'wild', 'plus4', 'miraculous_race'];
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
            let individualPath = `assets/cards/${folder}/${card.value}.png`;

            if (card.value === 'miraculous_race') {
                individualPath = 'assets/images/miraculous_race.png'; // New Official Art
            }

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
            if (card.value === 'miraculous_race') {
                // Skip color selection for this card
                this.game.playCard(playerId, index);
            } else {
                this.pendingWildCardIndex = index;
                window.soundManager.play('menu_click'); // Selection click
                this.showColorModal();
            }
        } else {
            // Normal play -> will call playCard -> animatePlay -> SWIPE sound
            this.game.playCard(playerId, index);
        }
    }

    showColorModal() {
        this.colorModal.classList.remove('hidden');
    }

    resolveWildCard(color) {
        // Mobile Fix: Ensure context is initialized on user gesture
        if (window.soundManager) window.soundManager.initContext();

        // character voice based on color
        const voiceMap = {
            'red': 'VOICE_LADYBUG',
            'green': 'VOICE_CATNOIR',
            'blue': 'VOICE_VIPERION',
            'yellow': 'VOICE_QUEENBEE'
        };

        const voiceId = voiceMap[color];

        // Get the card to check if it's a +4 (Coringa)
        const player = this.game.players[this.game.currentPlayer];
        const card = player.hand[this.pendingWildCardIndex];
        const isPlus4 = card && card.value === 'plus4';

        if (voiceId && isPlus4) {
            window.soundManager.play(voiceId);
        } else if (isPlus4) {
            window.soundManager.play('magic_color'); // Fallback for +4
        } else {
            // For regular Wild or Miraculous Race, just play a subtle selection sound
            window.soundManager.play('menu_click');
        }

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

    startMinigame(targetPlayerId, callback) {
        console.log(`[UI] Starting Minigame for: ${targetPlayerId}`);
        const isBot = this.game.players[targetPlayerId].isBot;

        if (isBot) {
            this.showToast("BOT EM FUGA! OBSERVE!");
        } else {
            const playerTag = (targetPlayerId === 'player') ? 'PLAYER 1' : 'PLAYER 2';
            this.showToast(`CONTROLE PARA: ${playerTag}!`);
        }

        // Brief delay for the toast and mental preparation
        setTimeout(() => {
            if (this.minigameOverlay) {
                this.minigameOverlay.classList.remove('hidden');
            }

            this.minigame.start(isBot, (result) => {
                if (this.minigameOverlay) {
                    this.minigameOverlay.classList.add('hidden');
                }
                callback(result);
            });
        }, 2000);
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


