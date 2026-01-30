class LobbyManager {
    constructor() {
        this.roomsRef = null;
        if (window.db) {
            this.roomsRef = window.db.ref('rooms');
        } else {
            console.error("Firebase DB not initialized.");
        }
    }

    // Host creates a room
    createRoom(roomName, password, peerId, onSuccess, onError) {
        if (!this.roomsRef) {
            const errorMsg = "❌ Firebase Database not initialized! Check firebase_config.js";
            console.error(errorMsg);
            alert(errorMsg);
            onError(errorMsg);
            return;
        }

        console.log(`[LobbyManager] Creating room: ${roomName}`);

        // Create a unique key for the room
        const newRoomRef = this.roomsRef.push();
        const roomId = newRoomRef.key;

        const roomData = {
            id: roomId,
            name: roomName,
            password: password, // In a real app, hash this! but for now plain text is fine.
            hostId: peerId,
            status: 'WAITING',
            createdAt: window.firebase.database.ServerValue.TIMESTAMP
        };

        console.log(`[LobbyManager] Writing to Firebase path: rooms/${roomId}`);

        newRoomRef.set(roomData)
            .then(() => {
                console.log(`[LobbyManager] ✅ Room created successfully in Firebase!`);
                // Return the generated Room ID locally
                onSuccess(roomId);

                // Set up disconnect cleanup: if host closes tab, delete room
                newRoomRef.onDisconnect().remove();
            })
            .catch((err) => {
                console.error('[LobbyManager] ❌ Firebase Error:', err);
                const errorMsg = `Firebase Error: ${err.code || err.message}\n\nMost common causes:\n1. Permission Denied - Check Firebase Rules\n2. Invalid databaseURL in firebase_config.js\n3. Firebase not initialized`;
                alert(errorMsg);
                onError(err.message || err.code || 'Unknown Firebase error');
            });
    }

    // Listen for room list updates (FIXED: Using onValue for real-time sync)
    listenToRooms(onUpdate) {
        if (!this.roomsRef) return;

        // Store the unsubscribe function so we can stop listening later
        this.unsubscribe = window.db.ref('rooms').on('value', (snapshot) => {
            const data = snapshot.val();
            const roomList = [];
            if (data) {
                Object.keys(data).forEach(key => {
                    roomList.push(data[key]);
                });
            }
            console.log(`[Lobby] Found ${roomList.length} rooms`);
            onUpdate(roomList);
        });
    }

    // Stop listening
    stopListening() {
        if (!this.roomsRef) return;
        this.roomsRef.off();
    }

    // Client validates password before Peer connection
    validateRoom(roomId, inputPassword, onSuccess, onError) {
        if (!this.roomsRef) return;

        const roomRef = this.roomsRef.child(roomId);
        roomRef.once('value')
            .then((snapshot) => {
                if (!snapshot.exists()) {
                    onError("Room does not exist.");
                    return;
                }
                const data = snapshot.val();
                if (data.password == inputPassword) {
                    onSuccess(data.hostId);
                } else {
                    onError("Incorrect Password");
                }
            })
            .catch((err) => onError(err.message));
    }

    // Delete room (when game starts or host leaves)
    deleteRoom(roomId) {
        if (!this.roomsRef) return;
        this.roomsRef.child(roomId).remove();
    }
}

window.LobbyManager = new LobbyManager();
