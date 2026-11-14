import * as THREE from 'three';

const root = document.getElementById('game-root');
const scoreEl = document.getElementById('score');
const healthEl = document.getElementById('health');
const timeEl = document.getElementById('time');
const startButton = document.getElementById('start-button');
const messagePanel = document.getElementById('message-panel');
const overlayTitle = document.getElementById('overlay-title');
const overlayText = document.getElementById('overlay-text');

const keyState = {};
const world = {
  enemies: [],
  crystals: [],
  stars: [],
};

const config = {
  maxHealth: 5,
  missionTime: 60,
  playerSpeed: 7.5,
  enemySpawnRate: 1.25,
  crystalSpawnRate: 2.2,
};

const state = {
  running: false,
  score: 0,
  health: config.maxHealth,
  timeLeft: config.missionTime,
  elapsed: 0,
  enemyCooldown: 0,
  crystalCooldown: 0,
};

let scene;
let camera;
let renderer;
let player;
let floor;
let clock;

function clamp(value, min, max) {
  return Math.min(Math.max(value, min), max);
}

function setOverlay(title, text, buttonLabel) {
  overlayTitle.textContent = title;
  overlayText.textContent = text;
  startButton.textContent = buttonLabel;
  messagePanel.classList.remove('hidden');
}

function hideOverlay() {
  messagePanel.classList.add('hidden');
}

function updateHud() {
  scoreEl.textContent = String(state.score);
  healthEl.textContent = String(state.health);
  timeEl.textContent = String(Math.ceil(state.timeLeft));
}

function buildBackground() {
  const starGeometry = new THREE.BufferGeometry();
  const starCount = 500;
  const positions = new Float32Array(starCount * 3);

  for (let i = 0; i < starCount; i += 1) {
    const idx = i * 3;
    positions[idx] = (Math.random() - 0.5) * 70;
    positions[idx + 1] = Math.random() * 25 + 3;
    positions[idx + 2] = (Math.random() - 0.5) * 70;
  }

  starGeometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
  const starMaterial = new THREE.PointsMaterial({
    color: 0x9ad7ff,
    size: 0.16,
    transparent: true,
    opacity: 0.9,
  });

  const stars = new THREE.Points(starGeometry, starMaterial);
  stars.rotation.x = Math.PI * 0.12;
  world.stars.push(stars);
  scene.add(stars);
}

function createFloor() {
  const floorGeometry = new THREE.CircleGeometry(18, 64);
  const floorMaterial = new THREE.MeshStandardMaterial({
    color: 0x091423,
    emissive: 0x0c1e2f,
    metalness: 0.2,
    roughness: 0.95,
  });

  floor = new THREE.Mesh(floorGeometry, floorMaterial);
  floor.rotation.x = -Math.PI / 2;
  floor.position.y = -0.25;
  scene.add(floor);

  const grid = new THREE.GridHelper(30, 30, 0x3ab2ff, 0x183350);
  grid.position.y = -0.15;
  grid.material.transparent = true;
  grid.material.opacity = 0.6;
  scene.add(grid);
}

function createPlayer() {
  const group = new THREE.Group();

  const hullMaterial = new THREE.MeshStandardMaterial({
    color: 0x7ee7ff,
    emissive: 0x1a648d,
    metalness: 0.4,
    roughness: 0.35,
  });

  const body = new THREE.Mesh(new THREE.SphereGeometry(0.7, 24, 24), hullMaterial);
  const wingLeft = new THREE.Mesh(new THREE.BoxGeometry(0.75, 0.12, 2), hullMaterial);
  const wingRight = wingLeft.clone();
  const nose = new THREE.Mesh(new THREE.ConeGeometry(0.32, 1.1, 16), hullMaterial);
  const engineGlow = new THREE.Mesh(
    new THREE.SphereGeometry(0.18, 18, 18),
    new THREE.MeshStandardMaterial({ color: 0xffdf80, emissive: 0xffae42, emissiveIntensity: 1.8 })
  );

  wingLeft.position.set(-0.9, 0, 0);
  wingRight.position.set(0.9, 0, 0);
  nose.position.set(0, 0, 1.1);
  nose.rotation.x = Math.PI / 2;
  engineGlow.position.set(0, 0, -1.1);

  group.add(body, wingLeft, wingRight, nose, engineGlow);
  group.position.set(0, 0.9, 0);
  scene.add(group);
  player = group;
}

function removeObjects(list) {
  for (const item of list) {
    if (item && item.mesh) {
      scene.remove(item.mesh);
    }
  }
  list.length = 0;
}

function spawnEnemy() {
  const geometry = new THREE.IcosahedronGeometry(0.7 + Math.random() * 0.6, 0);
  const material = new THREE.MeshStandardMaterial({
    color: 0xff7a7a,
    emissive: 0xa72323,
    emissiveIntensity: 0.9,
    metalness: 0.2,
    roughness: 0.45,
  });
  const mesh = new THREE.Mesh(geometry, material);

  const angle = Math.random() * Math.PI * 2;
  const radius = 16 + Math.random() * 8;
  mesh.position.set(Math.cos(angle) * radius, 0.75, Math.sin(angle) * radius);
  scene.add(mesh);

  world.enemies.push({
    mesh,
    speed: 2.2 + Math.random() * 1.4,
    drift: (Math.random() - 0.5) * 0.8,
  });
}

function spawnCrystal() {
  const geometry = new THREE.OctahedronGeometry(0.45, 0);
  const material = new THREE.MeshStandardMaterial({
    color: 0x7ef7b9,
    emissive: 0x1abf88,
    emissiveIntensity: 1.1,
    metalness: 0.35,
    roughness: 0.3,
  });
  const mesh = new THREE.Mesh(geometry, material);

  const angle = Math.random() * Math.PI * 2;
  const radius = 5 + Math.random() * 7;
  mesh.position.set(Math.cos(angle) * radius, 0.9 + Math.random() * 0.8, Math.sin(angle) * radius);
  mesh.userData.baseY = mesh.position.y;
  scene.add(mesh);

  world.crystals.push({ mesh, spin: Math.random() * 5 + 1.5 });
}

function damagePlayer() {
  state.health -= 1;
  if (state.health <= 0) {
    state.health = 0;
    state.running = false;
    setOverlay('Mission Failed', 'The meteor storm overwhelmed your ship. Try another run.', 'Retry Mission');
  }
  updateHud();
}

function collectCrystal(crystal) {
  state.score += 10;
  scene.remove(crystal.mesh);
  const index = world.crystals.indexOf(crystal);
  if (index >= 0) {
    world.crystals.splice(index, 1);
  }
  updateHud();
}

function updatePlayer(dt) {
  const moveX = (keyState.KeyD || keyState.ArrowRight ? 1 : 0) - (keyState.KeyA || keyState.ArrowLeft ? 1 : 0);
  const moveZ = (keyState.KeyS || keyState.ArrowDown ? 1 : 0) - (keyState.KeyW || keyState.ArrowUp ? 1 : 0);

  const direction = new THREE.Vector3(moveX, 0, moveZ);
  if (direction.lengthSq() > 0) {
    direction.normalize().multiplyScalar(config.playerSpeed * dt);
    player.position.add(direction);
  }

  player.position.x = clamp(player.position.x, -9.2, 9.2);
  player.position.z = clamp(player.position.z, -9.2, 9.2);
  player.position.y = 0.9 + Math.sin(clock.elapsedTime * 7) * 0.08;

  const targetX = player.position.x * 0.18;
  const targetZ = player.position.z + 12;
  camera.position.x += (targetX - camera.position.x) * 0.08;
  camera.position.z += (targetZ - camera.position.z) * 0.08;
  camera.lookAt(player.position.x, 0.8, player.position.z);
}

function updateEnemies(dt) {
  for (let i = world.enemies.length - 1; i >= 0; i -= 1) {
    const enemy = world.enemies[i];

    enemy.mesh.rotation.x += dt * 2.2;
    enemy.mesh.rotation.y += dt * 2.8;
    enemy.mesh.position.y += Math.sin(clock.elapsedTime * 6 + i) * 0.004;

    const toPlayer = player.position.clone().sub(enemy.mesh.position);
    toPlayer.y = 0;
    if (toPlayer.lengthSq() > 0.001) {
      toPlayer.normalize().multiplyScalar(enemy.speed * dt);
      enemy.mesh.position.add(toPlayer);
    }

    if (enemy.mesh.position.distanceTo(player.position) < 1.4) {
      scene.remove(enemy.mesh);
      world.enemies.splice(i, 1);
      damagePlayer();
    }
  }
}

function updateCrystals(dt) {
  for (let i = world.crystals.length - 1; i >= 0; i -= 1) {
    const crystal = world.crystals[i];
    crystal.mesh.rotation.x += dt * crystal.spin;
    crystal.mesh.rotation.y += dt * crystal.spin * 0.8;
    crystal.mesh.position.y = crystal.mesh.userData.baseY + Math.sin(clock.elapsedTime * 4 + i) * 0.3;

    if (crystal.mesh.position.distanceTo(player.position) < 1.15) {
      collectCrystal(crystal);
    }
  }
}

function handleGameState(dt) {
  state.elapsed += dt;
  state.timeLeft = Math.max(0, config.missionTime - state.elapsed);

  state.enemyCooldown -= dt;
  if (state.enemyCooldown <= 0) {
    spawnEnemy();
    state.enemyCooldown = config.enemySpawnRate * (0.8 + Math.random() * 0.7);
  }

  state.crystalCooldown -= dt;
  if (state.crystalCooldown <= 0) {
    if (world.crystals.length < 5) {
      spawnCrystal();
    }
    state.crystalCooldown = config.crystalSpawnRate;
  }

  updateHud();

  if (state.timeLeft <= 0) {
    state.running = false;
    setOverlay('Sector Cleared!', `Excellent run! You scored ${state.score} points and protected the lane.`, 'Play Again');
  }
}

function animate() {
  requestAnimationFrame(animate);
  const dt = clock.getDelta();

  if (state.running) {
    updatePlayer(dt);
    updateEnemies(dt);
    updateCrystals(dt);
    handleGameState(dt);
  } else {
    player.position.y = 0.9 + Math.sin(clock.elapsedTime * 4) * 0.08;
  }

  for (const star of world.stars) {
    star.rotation.y += dt * 0.025;
  }

  renderer.render(scene, camera);
}

function resetGame() {
  state.score = 0;
  state.health = config.maxHealth;
  state.elapsed = 0;
  state.timeLeft = config.missionTime;
  state.enemyCooldown = 0.7;
  state.crystalCooldown = 0.9;
  player.position.set(0, 0.9, 0);

  removeObjects(world.enemies);
  removeObjects(world.crystals);
  world.enemies.length = 0;
  world.crystals.length = 0;

  updateHud();
}

function startGame() {
  hideOverlay();
  resetGame();
  state.running = true;
}

function bindKeyboard() {
  const handleKey = (event, pressed) => {
    if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Space'].includes(event.code)) {
      event.preventDefault();
    }
    keyState[event.code] = pressed;
  };

  document.addEventListener('keydown', (event) => handleKey(event, true));
  document.addEventListener('keyup', (event) => handleKey(event, false));
}

function bindTouchControls() {
  const buttons = document.querySelectorAll('.control');

  for (const button of buttons) {
    const key = button.dataset.key;
    const setActive = (active) => {
      button.classList.toggle('active', active);
      keyState[key] = active;
    };

    button.addEventListener('pointerdown', (event) => {
      event.preventDefault();
      setActive(true);
    });

    ['pointerup', 'pointerleave', 'pointercancel'].forEach((name) => {
      button.addEventListener(name, () => setActive(false));
    });
  }
}

function createRenderer() {
  scene = new THREE.Scene();
  scene.background = new THREE.Color(0x040b17);
  scene.fog = new THREE.Fog(0x040b17, 16, 38);

  camera = new THREE.PerspectiveCamera(58, window.innerWidth / window.innerHeight, 0.1, 100);
  camera.position.set(0, 8, 14);

  renderer = new THREE.WebGLRenderer({ antialias: true });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  renderer.setSize(window.innerWidth, window.innerHeight);
  root.appendChild(renderer.domElement);

  const ambient = new THREE.AmbientLight(0x9cb8ff, 1.3);
  const directional = new THREE.DirectionalLight(0xffffff, 1.2);
  directional.position.set(5, 10, 7);

  scene.add(ambient, directional);

  buildBackground();
  createFloor();
  createPlayer();
}

function onResize() {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
}

function init() {
  clock = new THREE.Clock();
  createRenderer();
  bindKeyboard();
  bindTouchControls();
  updateHud();
  setOverlay('Star Drift', 'Collect energy cores and survive the meteor storm for 60 seconds.', 'Start Mission');
  startButton.addEventListener('click', startGame);
  window.addEventListener('resize', onResize);
  animate();
}

init();
