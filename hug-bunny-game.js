

// Audio
let audioContext = null;
const soundBuffers = {};

function preloadSounds(sounds) {
  sounds.forEach(sound => {
    const request = new XMLHttpRequest();
    request.open('GET', sound.url, true);
    request.responseType = 'arraybuffer';
    request.onload = () => {
      audioContext.decodeAudioData(request.response, buffer => {
        soundBuffers[sound.name] = buffer;
      }, error => console.error(`Error decoding audio ${sound.name}:`, error));
    };
    request.onerror = () => console.error(`Error loading sound ${sound.url}`);
    request.send();
  });
}

// Creepy phrases
const phrases = [
  "The bunnies scream in the dark...",
  "Blood stains the fluffy fur...",
  "You can’t escape the circle...",
  "Death whispers your name...",
  "The hugs were a lie..."
];

function playSound(name, volume = 0.1) {
  if (!audioContext || !soundBuffers[name]) return;
  const source = audioContext.createBufferSource();
  source.buffer = soundBuffers[name];
  const gainNode = audioContext.createGain();
  gainNode.gain.value = volume;
  const convolver = audioContext.createConvolver();
  const impulse = createImpulseResponse(1, 2);
  convolver.buffer = impulse;
  source.connect(gainNode);
  gainNode.connect(convolver);
  convolver.connect(audioContext.destination);
  source.start(0);
}

function createImpulseResponse(duration, decay) {
  const sampleRate = audioContext.sampleRate;
  const length = sampleRate * duration;
  const impulse = audioContext.createBuffer(2, length, sampleRate);
  const left = impulse.getChannelData(0);
  const right = impulse.getChannelData(1);
  for (let i = 0; i < length; i++) {
    const n = length - i;
    left[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / length, decay);
    right[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / length, decay);
  }
  return impulse;
}

function setCookie(name, value, days) {
  const expires = new Date(Date.now() + days * 864e5).toUTCString();
  document.cookie = `${name}=${encodeURIComponent(value)}; expires=${expires}; path=/`;
}

function getCookie(name) {
  const matches = document.cookie.match(new RegExp(`(?:^|; )${name}=([^;]*)`));
  return matches ? decodeURIComponent(matches[1]) : null;
}

function generateSessionKey() {
  return Math.random().toString(36).substr(2, 10) + Date.now().toString(36);
}

function initGame() {
  const isFirebaseAvailable = window.firebase && window.firebase.initialized && window.firebase.db;
  const db = isFirebaseAvailable ? window.firebase.db : null;
  if (!isFirebaseAvailable) console.warn('Firebase unavailable, running in offline mode');

  const elements = {
    wrapper: document.querySelector('.wrapper'),
    mapCover: document.querySelector('.map-cover'),
    indicator: document.querySelector('.indicator'),
    bunnyRadar: document.querySelector('.circle'),
    bunnyPos: [],
    menu: document.querySelector('.menu'),
    startSolo: document.getElementById('start-solo'),
    startCoop: document.getElementById('start-coop'),
    map: document.querySelector('.map'),
    notificationsContainer: document.querySelector('.notifications-container'),
    onlinePlayers: document.getElementById('online-players'),
    hugCount: document.getElementById('hug-count'),
    progress: document.getElementById('progress'),
    sessionKeyDisplay: document.getElementById('session-key'),
    hellCircle: document.getElementById('hell-circle'), 
    creepyPhrases: document.getElementById('creepy-phrases')
  };

  const radToDeg = rad => Math.round(rad * (180 / Math.PI));
  const distanceBetween = (a, b) => Math.round(Math.sqrt(Math.pow((a.x - b.x), 2) + Math.pow((a.y - b.y), 2)));
  const randomN = max => Math.ceil(Math.random() * max);
  const px = n => `${n}px`;
  const setPos = ({ el, x, y }) => {
    el.style.transition = 'left 0.1s ease, top 0.1s ease';
    Object.assign(el.style, { left: `${x}px`, top: `${y}px` });
  };

  const config = {
    mapSize: 8000,
    playerSpeed: 20,
    bunnyCount: 60,
    treeCount: 150,
    bushCount: 80,
    itemCount: 5,
    hugGoal: 15,
  };

  let sessionKey = getCookie('sessionKey');
  if (!sessionKey) {
    sessionKey = generateSessionKey();
    setCookie('sessionKey', sessionKey, 30);
  }
  elements.sessionKeyDisplay.textContent = `Your Key: ${sessionKey}`;

  const player = {
    id: sessionKey,
    x: randomN(config.mapSize) - config.mapSize / 2,
    y: randomN(config.mapSize) - config.mapSize / 2,
    move: { x: 0, y: 0 },
    frameOffset: 1,
    animationTimer: null,
    el: document.createElement('div'),
    sprite: { el: null, x: 0, y: 0 },
    walkingDirection: '',
    walkingInterval: null,
    pause: false,
    buffer: 20,
    hugs: 0,
    progress: 0,
    username: `Subject_${sessionKey.slice(0, 5)}`,
    timePlayed: 0,
    lastActive: Date.now(),
  };

  const settings = {
    d: config.playerSpeed,
    offsetPos: { x: 0, y: 0 },
    elements: [],
    bunnies: [],
    players: [],
    items: [],
    secrets: [],
    map: { el: elements.map, walls: [], w: config.mapSize, h: config.mapSize, x: 0, y: 0 },
    isWindowActive: true,
    controlPos: { x: 0, y: 0 },
    bunnyRadarSize: 0,
    sadBunnies: [],
    mode: 'solo',
    notifications: [],
    worldId: 'default_world', // Единый ID мира для синхронизации
  };

  async function loadWorldFromFirestore() {
    if (!isFirebaseAvailable) return;

    const worldDoc = window.firebase.doc(window.firebase.collection(db, 'worlds'), settings.worldId);
    const worldSnap = await window.firebase.getDoc(worldDoc);

    if (!worldSnap.exists()) {
      // Создаём новый мир, если его нет
      await window.firebase.setDoc(worldDoc, {
        bunnies: [],
        trees: [],
        bushes: [],
        items: [],
        lastUpdated: Date.now(),
      });
    }

    // Загружаем данные игрока
    const playerDoc = window.firebase.doc(window.firebase.collection(db, 'players'), sessionKey);
    const playerSnap = await window.firebase.getDoc(playerDoc);
    if (playerSnap.exists()) {
      const data = playerSnap.data();
      player.x = data.x || player.x;
      player.y = data.y || player.y;
      player.hugs = data.hugs || 0;
      player.progress = data.progress || 0;
      player.timePlayed = data.timePlayed || 0;
    } else {
      await window.firebase.setDoc(playerDoc, {
        id: player.id,
        x: player.x,
        y: player.y,
        username: player.username,
        hugs: player.hugs,
        progress: player.progress,
        timePlayed: player.timePlayed,
        online: true,
        lastActive: Date.now(),
      });
    }
    elements.hugCount.textContent = player.hugs;
    elements.progress.style.width = `${Math.min(player.progress, 100)}%`;
    setPos(player);

    // Синхронизация мира
    window.firebase.onSnapshot(worldDoc, snapshot => {
      const data = snapshot.data();
      syncWorld(data);
    });
  }


  function enterHellMode() {
    document.body.classList.add('dark');
    elements.wrapper.classList.add('dark');
    playSound('god_eye');
    setTimeout(() => {
      elements.hellCircle.classList.remove('hidden');
      elements.hellCircle.classList.add('active');
      elements.creepyPhrases.classList.remove('hidden');
      elements.creepyPhrases.textContent = phrases[Math.floor(Math.random() * phrases.length)];
      playSound('fire');

      // Reset after hell mode
      setTimeout(() => {
        document.body.classList.remove('dark');
        elements.wrapper.classList.remove('dark');
        elements.hellCircle.classList.remove('active');
        elements.hellCircle.classList.add('hidden');
        elements.creepyPhrases.classList.add('hidden');
        player.progress = 0;
        elements.hugCount.textContent = 0;

      }, 4000);
    }, 1000);
  }

  function syncWorld(data) {
    // Очистка текущего состояния
    settings.bunnies.forEach(b => b.el.remove());
    settings.elements.forEach(e => e.el.remove());
    settings.items.forEach(i => i.el.remove());
    settings.bunnies = [];
    settings.elements = [];
    settings.items = [];

    // Синхронизация зайцев
    data.bunnies.forEach(b => {
      const bunny = {
        id: b.id,
        x: b.x,
        y: b.y,
        move: { x: 0, y: 0 },
        frameOffset: 1,
        animationTimer: null,
        el: Object.assign(document.createElement('div'), {
          className: `sprite-container ${b.sad ? 'sad' : ''}`,
          innerHTML: `<div class="bunny sprite"></div><div class="username">${b.name}</div>`,
        }),
        sprite: { el: null, x: 0, y: 0 },
        sad: b.sad,
        buffer: 30,
        owner: b.owner,
        behavior: b.behavior,
      };
      bunny.sprite.el = bunny.el.querySelector('.bunny');
      settings.bunnies.push(bunny);
      settings.map.el.appendChild(bunny.el);
      bunny.el.style.zIndex = bunny.y;
      setPos(bunny);
      if (b.sad) triggerBunnyWalk(bunny);
    });

    // Синхронизация деревьев
    data.trees.forEach(t => {
      const tree = {
        id: t.id,
        x: t.x,
        y: t.y,
        el: Object.assign(document.createElement('div'), { className: 'tree', innerHTML: '<div></div>' }),
        buffer: 40,
      };
      settings.elements.push(tree);
      settings.map.el.appendChild(tree.el);
      tree.el.style.zIndex = tree.y;
      setPos(tree);
    });

    // Синхронизация кустов
    data.bushes.forEach(b => {
      const bush = {
        id: b.id,
        x: b.x,
        y: b.y,
        el: Object.assign(document.createElement('div'), { className: 'bush', innerHTML: '<div></div>' }),
        buffer: 30,
      };
      settings.elements.push(bush);
      settings.map.el.appendChild(bush.el);
      bush.el.style.zIndex = bush.y;
      setPos(bush);
    });

    // Синхронизация предметов
    data.items.forEach(i => {
      const item = {
        id: i.id,
        x: i.x,
        y: i.y,
        el: Object.assign(document.createElement('div'), { className: 'secret-item', innerHTML: '<div></div>' }),
        buffer: 20,
        message: i.message,
      };
      settings.items.push(item);
      settings.map.el.appendChild(item.el);
      item.el.style.zIndex = item.y;
      setPos(item);
    });

    updateSadBunnyCount();
  }

  player.el.className = 'sprite-container player';
  player.el.innerHTML = `<div class="bear sprite"></div><div class="username">${player.username}</div>`;
  player.sprite.el = player.el.querySelector('.bear');
  elements.map.appendChild(player.el);

  const noWall = actor => {
    if (!actor.move) actor.move = { x: 0, y: 0 };
    const newPos = { ...actor, x: actor.x + actor.move.x, y: actor.y + actor.move.y };
    const collisions = [...settings.bunnies, ...settings.elements, ...settings.players, ...settings.items]
      .filter(el => el.id !== actor.id)
      .some(el => distanceBetween(el, newPos) <= el.buffer && distanceBetween(el, actor) > el.buffer);
    if (actor === player && !player.pause) {
      const bunnyToHug = settings.bunnies.find(el => el.sad && distanceBetween(el, newPos) <= el.buffer);
      if (bunnyToHug) {
        hugBunny(bunnyToHug);
        stopSprite(player);
        return false;
      }
    }
    return !collisions;
  };

  const resizeBunnyRadar = () => {
    const { innerWidth: w, innerHeight: h } = window;
    settings.bunnyRadarSize = Math.min(w, h) - 20;
    ['width', 'height'].forEach(param => elements.bunnyRadar.style[param] = px(settings.bunnyRadarSize));
  };

  const bunnyNames = [
    'Lost One', 'Silent Hop', 'Broken Tail', 'Echo Bunny', 'Shadow Paws',
    'Faded Hope', 'Whisper Fur', 'Lonely Ears', 'Crimson Eyes', 'Void Hopper'
  ];
  const bunnyBehaviors = {
    wander: bunny => setInterval(() => {
      const dir = ['up', 'down', 'right', 'left'][randomN(4) - 1];
      bunny.move = { x: dir === 'left' ? -settings.d : dir === 'right' ? settings.d : 0, y: dir === 'up' ? -settings.d : dir === 'down' ? settings.d : 0 };
      walk(bunny, dir);
    }, 2000),
    flee: bunny => setInterval(() => {
      const dx = bunny.x - player.x;
      const dy = bunny.y - player.y;
      const dir = Math.abs(dx) > Math.abs(dy) ? (dx > 0 ? 'right' : 'left') : (dy > 0 ? 'down' : 'up');
      bunny.move = { x: dir === 'left' ? -settings.d : dir === 'right' ? settings.d : 0, y: dir === 'up' ? -settings.d : dir === 'down' ? settings.d : 0 };
      walk(bunny, dir);
    }, 1000),
    still: () => { },
  };

  const triggerBunnyWalk = bunny => {
    bunny.animationTimer = bunnyBehaviors[bunny.behavior](bunny);
  };

  const getRandomPos = () => ({ x: randomN(config.mapSize) - config.mapSize / 2, y: randomN(config.mapSize) - config.mapSize / 2 });

  const addBunny = (isNPC = true) => {
    const bunny = {
      id: `bunny-${settings.bunnies.length + 1}`,
      x: getRandomPos().x,
      y: getRandomPos().y,
      move: { x: 0, y: 0 },
      frameOffset: 1,
      animationTimer: null,
      el: Object.assign(document.createElement('div'), {
        className: 'sprite-container sad',
        innerHTML: `<div class="bunny sprite"></div><div class="username">${isNPC ? bunnyNames[randomN(bunnyNames.length) - 1] : 'Hugged'}</div>`,
      }),
      sprite: { el: null, x: 0, y: 0 },
      sad: isNPC,
      buffer: 30,
      owner: isNPC ? null : player.id,
      behavior: Object.keys(bunnyBehaviors)[randomN(3) - 1],
    };
    settings.bunnies.push(bunny);
    settings.map.el.appendChild(bunny.el);
    bunny.sprite.el = bunny.el.querySelector('.bunny');
    bunny.el.style.zIndex = bunny.y;
    setPos(bunny);
    if (isNPC && settings.mode === 'solo') triggerBunnyWalk(bunny);
    saveWorldToFirestore();
  };

  const addTree = () => {
    const tree = {
      id: `tree-${settings.elements.length + 1}`,
      x: getRandomPos().x,
      y: getRandomPos().y,
      el: Object.assign(document.createElement('div'), { className: 'tree', innerHTML: '<div></div>' }),
      buffer: 40,
    };
    settings.elements.push(tree);
    settings.map.el.appendChild(tree.el);
    tree.el.style.zIndex = tree.y;
    setPos(tree);
    saveWorldToFirestore();
  };

  const addBush = () => {
    const bush = {
      id: `bush-${settings.elements.length + 1}`,
      x: getRandomPos().x,
      y: getRandomPos().y,
      el: Object.assign(document.createElement('div'), { className: 'bush', innerHTML: '<div></div>' }),
      buffer: 30,
    };
    settings.elements.push(bush);
    settings.map.el.appendChild(bush.el);
    bush.el.style.zIndex = bush.y;
    setPos(bush);
    saveWorldToFirestore();
  };

  const addSecretItem = () => {
    const messages = [
      'Why are you here?', 'You can’t escape.', 'They see you.', 'The key is a lie.',
      'Subject failed.', 'Run while you can.', 'It’s too late.', 'We’re watching.',

    ];
    const item = {
      id: `item-${settings.items.length + 1}`,
      x: getRandomPos().x,
      y: getRandomPos().y,
      el: Object.assign(document.createElement('div'), { className: 'secret-item', innerHTML: '<div></div>' }),
      buffer: 20,
      message: messages[randomN(messages.length) - 1],
    };
    settings.items.push(item);
    settings.map.el.appendChild(item.el);
    item.el.style.zIndex = item.y;
    setPos(item);
    saveWorldToFirestore();
  };

  const animateSprite = (actor, dir) => {
    const h = -32 * 2;
    actor.sprite.y = { down: 0, up: h, right: h * 2, left: h * 3 }[dir];
    actor.frameOffset = actor.frameOffset === 1 ? 2 : 1;
    actor.sprite.x = actor.frameOffset * (2 * -20);
    actor.sprite.el.style.backgroundPosition = `${actor.sprite.x}px ${actor.sprite.y}px`;
    playSound(randomN(2) === 1 ? 'tick' : 'tick2');
  };

  const triggerBunnyMessage = (bunny, classToAdd) => {
    const messages = [
      'Thanks...?', 'I+U...? 💕', 'So cute...', 'Why are you here?',
      'You can’t leave.', 'They’re watching.', 'All is recorded.', 'Find the key.'
    ];
    const message = messages[randomN(messages.length) - 1];
    bunny.el.setAttribute('message', message);
    bunny.el.classList.add(classToAdd);
    setTimeout(() => bunny.el.classList.remove(classToAdd), 800);
    showNotification(message);
  };

  const updateSadBunnyCount = () => {
    const sadBunnyCount = settings.bunnies.filter(b => b.sad).length;
    elements.indicator.innerHTML = sadBunnyCount ? `x ${sadBunnyCount}` : 'All hugged...?';
    if (settings.mode === 'solo' && player.hugs >= config.hugGoal) triggerHorror();
  };

  const hugBunny = bunny => {
    const classToAdd = bunny.x > player.x ? 'hug-bear-bunny' : 'hug-bunny-bear';
    player.el.classList.add('d-none');
    bunny.el.classList.add(classToAdd);
    clearInterval(bunny.animationTimer);
    player.pause = true;
    bunny.sad = false;
    bunny.owner = player.id;
    player.hugs++;
    player.progress += 5;
    elements.hugCount.textContent = player.hugs;
    elements.progress.style.width = `${Math.min(player.progress, 100)}%`;

    const heart = document.createElement('div');
    heart.className = 'heart-effect';
    heart.style.left = `${bunny.x}px`;
    heart.style.top = `${bunny.y - 20}px`;
    settings.map.el.appendChild(heart);
    setTimeout(() => heart.remove(), 1000);

    player.y = bunny.y;
    if (classToAdd === 'hug-bear-bunny') {
      player.x = bunny.x - 40;
      animateSprite(player, 'right');
      animateSprite(bunny, 'left');
    } else {
      player.x = bunny.x + 40;
      animateSprite(player, 'left');
      animateSprite(bunny, 'right');
    }
    positionMap();
    settings.map.el.classList.add('slow-transition');
    setPos(settings.map);
    player.el.style.zIndex = player.y;

    setTimeout(() => {
      player.el.classList.remove('d-none');
      [classToAdd, 'sad'].forEach(c => bunny.el.classList.remove(c));
      stopSprite(bunny);
      triggerBunnyWalk(bunny);
      player.pause = false;
      settings.map.el.classList.remove('slow-transition');
      triggerBunnyMessage(bunny, classToAdd === 'hug-bear-bunny' ? 'happy-left' : 'happy-right');
      updateSadBunnyCount();
      savePlayerData();
      saveWorldToFirestore();
    }, 1800);

    if (player.progress >= 100) {
      enterHellMode();
    }
  };

  const triggerHorror = () => {
    if (settings.mode !== 'solo') return;
    const horror = document.createElement('div');
    horror.className = 'horror-effect';
    horror.innerHTML = `
      <div class="blood"></div>
      <div class="pentagram"></div>
      <p>Subject *${player.username}* terminated. No escape.</p>
    `;
    settings.map.el.appendChild(horror);
    setTimeout(() => horror.remove(), 3000);
    showNotification('You thought this was a game?');
    setTimeout(() => {
      document.body.classList.add('glitch');
      setTimeout(() => document.body.classList.remove('glitch'), 2000);
    }, 1000);
  };

  const walk = (actor, dir) => {
    if (!dir || (actor === player && player.pause) || !settings.isWindowActive) return;
    if (!actor.move) actor.move = { x: 0, y: 0 };
    if (noWall(actor)) {
      animateSprite(actor, dir);
      actor.x += actor.move.x;
      actor.y += actor.move.y;
      if (actor === player) {
        positionMap();
        setPos(settings.map);
        setPos(actor);
        actor.el.style.zIndex = actor.y;
        const item = settings.items.find(i => distanceBetween(i, actor) <= i.buffer);
        if (item) {
          item.el.remove();
          settings.items = settings.items.filter(i => i.id !== item.id);
          player.progress += 20;
          elements.progress.style.width = `${Math.min(player.progress, 100)}%`;
          showNotification(item.message);
          const sparkle = document.createElement('div');
          sparkle.className = 'sparkle-effect';
          sparkle.style.left = `${item.x}px`;
          sparkle.style.top = `${item.y}px`;
          settings.map.el.appendChild(sparkle);
          setTimeout(() => sparkle.remove(), 800);
          savePlayerData();
          saveWorldToFirestore();
        }
      } else {
        setPos(actor);
        actor.el.style.zIndex = actor.y;
      }
      if (actor === player) savePlayerData();
    } else {
      stopSprite(actor);
    }
  };

  const updateOffset = () => {
    const { width, height } = elements.wrapper.getBoundingClientRect();
    settings.offsetPos = { x: width / 2, y: height / 2 };
  };

  const positionMap = () => {
    settings.map.x = settings.offsetPos.x - player.x;
    settings.map.y = settings.offsetPos.y - player.y;
  };

  const resizeAndRepositionMap = () => {
    updateOffset();
    positionMap();
    setPos(settings.map);
    setPos(player);
  };

  const stopSprite = actor => {
    actor.sprite.x = 0;
    actor.sprite.el.style.backgroundPosition = `${actor.sprite.x}px ${actor.sprite.y}px`;
    clearInterval(actor.walkingInterval);
  };

  const handleWalk = () => {
    let dir = 'right';
    player.walkingInterval = setInterval(() => {
      if (Math.abs(player.y - settings.controlPos.y) > 20) {
        player.move.y = player.y > settings.controlPos.y ? -settings.d : settings.d;
        dir = player.move.y === -settings.d ? 'up' : 'down';
      } else {
        player.move.y = 0;
      }
      if (Math.abs(player.x - settings.controlPos.x) > 20) {
        player.move.x = player.x > settings.controlPos.x ? -settings.d : settings.d;
        dir = player.move.x === -settings.d ? 'left' : 'right';
      } else {
        player.move.x = 0;
      }
      if (player.move.x || player.move.y) {
        walk(player, dir);
      } else {
        stopSprite(player);
        playSound('click');
        savePlayerData();
      }
    }, 150);
  };

  const savePlayerData = () => {
    if (!isFirebaseAvailable) return;
    player.lastActive = Date.now();
    const playerDoc = window.firebase.doc(window.firebase.collection(db, 'players'), sessionKey);
    window.firebase.setDoc(playerDoc, {
      id: player.id,
      x: player.x,
      y: player.y,
      username: player.username,
      hugs: player.hugs,
      progress: player.progress,
      timePlayed: player.timePlayed,
      online: true,
      lastActive: player.lastActive,
    }, { merge: true }).catch(error => console.error('Error saving player data:', error));
  };

  const saveWorldToFirestore = () => {
    if (!isFirebaseAvailable) return;
    const worldDoc = window.firebase.doc(window.firebase.collection(db, 'worlds'), settings.worldId);
    const worldData = {
      bunnies: settings.bunnies.map(b => ({
        id: b.id,
        x: b.x,
        y: b.y,
        sad: b.sad,
        owner: b.owner,
        name: b.el.querySelector('.username').textContent,
        behavior: b.behavior,
      })),
      trees: settings.elements.filter(e => e.id.startsWith('tree')).map(t => ({ id: t.id, x: t.x, y: t.y })),
      bushes: settings.elements.filter(e => e.id.startsWith('bush')).map(b => ({ id: b.id, x: b.x, y: b.y })),
      items: settings.items.map(i => ({ id: i.id, x: i.x, y: i.y, message: i.message })),
      lastUpdated: Date.now(),
    };
    window.firebase.setDoc(worldDoc, worldData).catch(error => console.error('Error saving world:', error));
  };

  document.addEventListener('click', e => {
    if (!audioContext) {
      audioContext = new (window.AudioContext || window.webkitAudioContext)();
      preloadSounds([
        { name: 'click', url: 'sounds/click.wav' },
        { name: 'tick', url: 'sounds/tick.mp3' },
        { name: 'tick2', url: 'sounds/tick2.mp3' },
        { name: 'connect', url: 'sounds/connect.wav' },
      ]);
    }
    stopSprite(player);
    const { left, top } = settings.map.el.getBoundingClientRect();
    settings.controlPos = e.targetTouches ?
      { x: e.targetTouches[0].pageX - left, y: e.targetTouches[0].pageY - top } :
      { x: e.pageX - left, y: e.pageY - top };
    handleWalk();
    playSound('click');

    const drop = document.createElement('div');
    drop.className = 'click-drop';
    drop.style.left = `${e.pageX - 5}px`;
    drop.style.top = `${e.pageY - 5}px`;
    document.body.appendChild(drop);
    setTimeout(() => drop.remove(), 500);
  });

  const elAngle = pos => radToDeg(Math.atan2(pos.y - player.y, pos.x - player.x)) - 90;

  new Array(5).fill('').forEach(() => {
    const bunnyPos = Object.assign(document.createElement('div'), { className: 'bunny-pos' });
    elements.bunnyPos.push(bunnyPos);
    elements.bunnyRadar.appendChild(bunnyPos);
  });

  const findSadBunnies = () => {
    settings.sadBunnies = settings.bunnies.filter(el => el.sad).map(el => ({
      el,
      distance: distanceBetween(el, player),
    })).sort((a, b) => a.distance - b.distance).slice(0, 5);
  };

  setInterval(() => {
    findSadBunnies();
    elements.bunnyPos.forEach((indicator, i) => {
      const bunny = settings.sadBunnies[i]?.el;
      if (bunny) {
        const angle = elAngle(bunny);
        const distance = distanceBetween(bunny, player);
        indicator.innerHTML = `<div class="bunny-indicator" style="transform: rotate(${angle * -1}deg)">${distance - 40}px</div>`;
        indicator.style.setProperty('--size', px(distance > (settings.bunnyRadarSize / 2) ? settings.bunnyRadarSize : distance));
        indicator.style.transform = `rotate(${angle}deg)`;
        indicator.classList.remove('d-none');
      } else {
        indicator.classList.add('d-none');
      }
    });
  }, 1000);

  const showNotification = message => {
    const notification = document.createElement('div');
    notification.className = 'notification active';
    notification.textContent = message;
    notification.style.zIndex = 1000 + settings.notifications.length;

    elements.notificationsContainer.appendChild(notification);
    settings.notifications.unshift(notification);

    setTimeout(() => {
      notification.style.opacity = '1';
      notification.style.transform = 'translate(-50%, -50%) scale(1)';
    }, 10);

    settings.notifications.forEach((notif, index) => {
      if (index === 0) {
        notif.style.width = '300px';
        notif.style.height = '100px';
        notif.style.fontSize = '1.2em';
        notif.style.top = '40%'; // Уведомления выше середины
        notif.style.left = '50%';
        notif.style.transform = 'translate(-50%, -50%) scale(1)';
      } else {
        notif.classList.remove('active');
        notif.style.width = '200px';
        notif.style.height = '60px';
        notif.style.fontSize = '0.9em';
        notif.style.top = `${40 + index * 70}px`; // Сдвиг вниз от 40%
        notif.style.left = 'calc(50% + 320px)';
        notif.style.transform = 'translate(0, 0) scale(0.8)';
      }
    });

    setTimeout(() => {
      notification.style.opacity = '0';
      notification.style.transform = 'translate(-50%, -50%) scale(0)';
      setTimeout(() => {
        notification.remove();
        settings.notifications = settings.notifications.filter(n => n !== notification);
        settings.notifications.forEach((notif, index) => {
          if (index === 0 && settings.notifications.length > 0) {
            notif.style.width = '300px';
            notif.style.height = '100px';
            notif.style.fontSize = '1.2em';
            notif.style.top = '40%';
            notif.style.left = '50%';
            notif.style.transform = 'translate(-50%, -50%) scale(1)';
            notif.classList.add('active');
          } else {
            notif.style.top = `${40 + index * 70}px`;
          }
        });
      }, 500);
    }, 5000);
  };

  window.addEventListener('focus', () => settings.isWindowActive = true);
  window.addEventListener('blur', () => {
    settings.isWindowActive = false;
    if (settings.mode === 'solo' && Math.random() < 0.3) {
      setTimeout(() => showNotification('_where did you go?_'), 5000);
    }
  });
  window.addEventListener('resize', () => {
    resizeAndRepositionMap();
    resizeBunnyRadar();
  });

  elements.startSolo.addEventListener('click', () => {
    if (!audioContext) {
      audioContext = new (window.AudioContext || window.webkitAudioContext)();
      preloadSounds([
        { name: 'click', url: 'sounds/click.wav' },
        { name: 'tick', url: 'sounds/tick.mp3' },
        { name: 'tick2', url: 'sounds/tick2.mp3' },
        { name: 'connect', url: 'sounds/connect.wav' },
      ]);
    }
    settings.mode = 'solo';
    elements.menu.style.display = 'none';
    elements.wrapper.style.pointerEvents = 'auto';
    playSound('click');
    if (!isFirebaseAvailable || settings.bunnies.length === 0) {
      new Array(config.bunnyCount).fill('').forEach(() => addBunny());
      new Array(config.treeCount).fill('').forEach(() => addTree());
      new Array(config.bushCount).fill('').forEach(() => addBush());
      new Array(config.itemCount).fill('').forEach(() => addSecretItem());
    }
  });

  elements.startCoop.addEventListener('click', () => {
    if (!audioContext) {
      audioContext = new (window.AudioContext || window.webkitAudioContext)();
      preloadSounds([
        { name: 'click', url: 'sounds/click.wav' },
        { name: 'tick', url: 'sounds/tick.mp3' },
        { name: 'tick2', url: 'sounds/tick2.mp3' },
        { name: 'connect', url: 'sounds/connect.wav' },
      ]);
    }
    settings.mode = 'coop';
    elements.menu.style.display = 'none';
    elements.wrapper.style.pointerEvents = 'auto';
    playSound('click');
    if (isFirebaseAvailable && typeof window.joinCoop === 'function') {
      window.joinCoop(player, settings, () => playSound('connect'));
    } else {
      showNotification('Co-op unavailable in offline mode');
      if (settings.bunnies.length === 0) {
        new Array(config.bunnyCount).fill('').forEach(() => addBunny());
        new Array(config.treeCount).fill('').forEach(() => addTree());
        new Array(config.bushCount).fill('').forEach(() => addBush());
        new Array(config.itemCount).fill('').forEach(() => addSecretItem());
      }
    }
  });

  resizeAndRepositionMap();
  resizeBunnyRadar();
  if (isFirebaseAvailable) loadWorldFromFirestore();
  else {
    new Array(config.bunnyCount).fill('').forEach(() => addBunny());
    new Array(config.treeCount).fill('').forEach(() => addTree());
    new Array(config.bushCount).fill('').forEach(() => addBush());
    new Array(config.itemCount).fill('').forEach(() => addSecretItem());
  }
  updateSadBunnyCount();

  setInterval(() => {
    player.timePlayed += 1000;
    if (settings.mode === 'solo' && Math.random() < 0.05) {
      showNotification('Are you alone? Something’s watching...');
    }
    savePlayerData();
  }, 1000);

  if (isFirebaseAvailable) {
    setInterval(() => {
      window.firebase.onSnapshot(window.firebase.collection(db, 'players'), snapshot => {
        snapshot.forEach(doc => {
          const data = doc.data();
          if (Date.now() - data.lastActive > 30 * 60 * 1000) doc.ref.delete();
        });
      });
    }, 60000);
  }

}




const animateSprite = (actor, dir) => {
  const h = -64; // Высота спрайта bear (64px)
  actor.sprite.y = { down: 0, up: h, right: h * 2, left: h * 3 }[dir];
  actor.frameOffset = actor.frameOffset === 1 ? 2 : 1;
  actor.sprite.x = actor.frameOffset * (-40); // Ширина шага (40px)
  actor.sprite.el.style.backgroundPosition = `${actor.sprite.x}px ${actor.sprite.y}px`;

  // Добавляем класс walking и направление для анимации
  actor.sprite.el.classList.add('walking', dir);
  playSound(randomN(2) === 1 ? 'tick' : 'tick2');
};

const stopSprite = actor => {
  actor.sprite.x = 0;
  actor.sprite.el.style.backgroundPosition = `${actor.sprite.x}px ${actor.sprite.y}px`;
  actor.sprite.el.classList.remove('walking', 'up', 'down', 'left', 'right'); // Убираем классы
  clearInterval(actor.walkingInterval);
};

const walk = (actor, dir) => {
  if (!dir || (actor === player && player.pause) || !settings.isWindowActive) return;
  if (!actor.move) actor.move = { x: 0, y: 0 };
  if (noWall(actor)) {
    animateSprite(actor, dir); // Запускаем анимацию ходьбы и крови
    actor.x += actor.move.x;
    actor.y += actor.move.y;
    if (actor === player) {
      positionMap();
      setPos(settings.map);
      setPos(actor);
      actor.el.style.zIndex = actor.y;
      const item = settings.items.find(i => distanceBetween(i, actor) <= i.buffer);
      if (item) {
        item.el.remove();
        settings.items = settings.items.filter(i => i.id !== item.id);
        player.progress += 20;
        elements.progress.style.width = `${Math.min(player.progress, 100)}%`;
        showNotification(item.message);
        const sparkle = document.createElement('div');
        sparkle.className = 'sparkle-effect';
        sparkle.style.left = `${item.x}px`;
        sparkle.style.top = `${item.y}px`;
        settings.map.el.appendChild(sparkle);
        setTimeout(() => sparkle.remove(), 800);
        savePlayerData();
        saveWorldToFirestore();
      }
    } else {
      setPos(actor);
      actor.el.style.zIndex = actor.y;
    }
    if (actor === player) savePlayerData();
  } else {
    stopSprite(actor); // Останавливаем анимацию
  }
};



// Initialize
function init() {
  player.refreshes = parseInt(localStorage.getItem('refreshes') || '0') + 1;
  localStorage.setItem('refreshes', player.refreshes);
  player.visitors = parseInt(localStorage.getItem('visitors') || '0') + 1;
  localStorage.setItem('visitors', player.visitors);
}

window.addEventListener('DOMContentLoaded', () => {
  if (!document.getElementById('start-solo') || !document.getElementById('start-coop')) {
    console.error('Menu buttons not found');
    return;
  }
  initGame();
});