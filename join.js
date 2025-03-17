const sessionKey = document.getElementById('session-key');
const startCoopBtn = document.getElementById('start-coop');

function generateSessionKey() {
    return 'COOP-' + Math.random().toString(36).substr(2, 9).toUpperCase();
}

function joinCoop() {
    const key = generateSessionKey();
    sessionKey.textContent = `Session Key: ${key}`;
    console.log(`Joining co-op session: ${key}`);
    // Mock co-op mode since Firestore is disabled
    startCoopBtn.dispatchEvent(new Event('click')); // Trigger game start
}

startCoopBtn.addEventListener('click', joinCoop);


function waitForFirebase(callback) {
    if (window.firebase && window.firebase.initialized) {
        callback(window.firebase.db);
    } else {
        console.warn('Waiting for Firebase initialization...');
        setTimeout(() => waitForFirebase(callback), 100);
    }
}

waitForFirebase(db => {
    console.log('Firebase available, enabling co-op mode');

    const updateStats = async () => {
        try {
            const playersRef = window.firebase.collection(db, 'players');
            const statsRef = window.firebase.doc(window.firebase.collection(db, 'stats'), 'global');
            const statsSnap = await window.firebase.getDoc(statsRef);
            const playerCount = (await window.firebase.getDocs(playersRef)).size;
            document.getElementById('visitor-count').textContent = playerCount;
            if (statsSnap.exists()) {
                const topPlayer = statsSnap.data().topPlayer || { username: 'None' };
                document.getElementById('top-player').textContent = topPlayer.username;
            }
        } catch (error) {
            console.error('Error updating stats:', error);
        }
        sessionKey.textContent = 'Session Key: None';
    };

    window.joinCoop = (player, settings, callback) => {
        const playersRef = window.firebase.collection(db, 'players');
        const playerDoc = window.firebase.doc(playersRef, player.id);

        window.firebase.onSnapshot(playersRef, snapshot => {
            settings.players.forEach(p => {
                if (!snapshot.docs.some(doc => doc.id === p.id)) p.el.remove();
            });
            settings.players = [];
            snapshot.forEach(doc => {
                const data = doc.data();
                if (data.id !== player.id && data.online) {
                    let otherPlayer = settings.players.find(p => p.id === data.id);
                    if (!otherPlayer) {
                        otherPlayer = {
                            id: data.id,
                            x: data.x,
                            y: data.y,
                            move: { x: 0, y: 0 },
                            el: Object.assign(document.createElement('div'), {
                                className: 'sprite-container player',
                                innerHTML: '<div class="bear sprite"></div><div class="username"></div>',
                            }),
                            buffer: 20,
                        };
                        settings.map.el.appendChild(otherPlayer.el);
                        settings.players.push(otherPlayer);
                    }
                    otherPlayer.x = data.x;
                    otherPlayer.y = data.y;
                    otherPlayer.el.style.transition = 'left 0.2s ease, top 0.2s ease';
                    otherPlayer.el.style.left = `${otherPlayer.x}px`;
                    otherPlayer.el.style.top = `${otherPlayer.y}px`;
                    otherPlayer.el.style.zIndex = otherPlayer.y;
                    otherPlayer.el.querySelector('.username').textContent = `${data.username} (${data.hugs} hugs)`;
                    otherPlayer.el.title = `Progress: ${data.progress}% | Time: ${Math.floor(data.timePlayed / 1000)}s`;
                }
            });
            document.getElementById('online-players').textContent = settings.players.length + 1;

            let topPlayer = { username: 'None', timePlayed: 0 };
            snapshot.forEach(doc => {
                const data = doc.data();
                if (data.timePlayed > topPlayer.timePlayed) topPlayer = data;
            });
            window.firebase.setDoc(window.firebase.doc(db, 'stats', 'global'), { topPlayer })
                .catch(error => console.error('Error updating stats:', error));
            if (callback) callback();
        }, error => console.error('Error subscribing to players:', error));

        window.addEventListener('unload', () => {
            window.firebase.setDoc(playerDoc, { online: false }, { merge: true });
        });

        updateStats();
    };

    window.addEventListener('DOMContentLoaded', updateStats);
});