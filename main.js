import * as THREE from "three";

// Game state
const gameState = {
  score: 0,
  combo: 0,
  started: false,
  notes: [],
  lanes: [
    { key: "d", color: 0xff6b6b, position: -3.0 },
    { key: "f", color: 0x4ecdc4, position: -1.0 },
    { key: "j", color: 0xffe66d, position: 1.0 },
    { key: "k", color: 0xa8e6cf, position: 3.0 },
  ],
  pressedKeys: new Set(),
  lastSpawnTime: 0,
  spawnInterval: 800, // ms between spawns
  keyMeshes: {}, // Store 3D key objects
};

// Three.js setup
const scene = new THREE.Scene();
scene.background = new THREE.Color(0x0a0a1a);
scene.fog = new THREE.Fog(0x0a0a1a, 10, 50);

const camera = new THREE.PerspectiveCamera(
  60,
  window.innerWidth / window.innerHeight,
  0.1,
  1000
);
camera.position.set(0, 4, 6);
camera.lookAt(0, 0, -10);

const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.setPixelRatio(window.devicePixelRatio);
document.getElementById("canvas-container").appendChild(renderer.domElement);

// Lighting
const ambientLight = new THREE.AmbientLight(0xffffff, 0.6);
scene.add(ambientLight);

const directionalLight = new THREE.DirectionalLight(0xffffff, 0.8);
directionalLight.position.set(5, 10, 5);
scene.add(directionalLight);

// Create lanes (visual guides)
function createLanes() {
  const laneLength = 60;
  const laneWidth = 1.4;

  gameState.lanes.forEach((lane) => {
    // Lane floor
    const geometry = new THREE.PlaneGeometry(laneWidth, laneLength);
    const material = new THREE.MeshStandardMaterial({
      color: lane.color,
      transparent: true,
      opacity: 0.15,
      emissive: lane.color,
      emissiveIntensity: 0.2,
    });
    const plane = new THREE.Mesh(geometry, material);
    plane.rotation.x = -Math.PI / 2;
    plane.position.set(lane.position, 0, -laneLength / 2);
    scene.add(plane);

    // Lane borders - thinner and less tall
    const borderGeometry = new THREE.BoxGeometry(0.03, 0.04, laneLength);
    const borderMaterial = new THREE.MeshStandardMaterial({
      color: lane.color,
      emissive: lane.color,
      emissiveIntensity: 0.5,
    });

    const borderLeft = new THREE.Mesh(borderGeometry, borderMaterial);
    borderLeft.position.set(
      lane.position - laneWidth / 2,
      0.02,
      -laneLength / 2
    );
    scene.add(borderLeft);

    const borderRight = new THREE.Mesh(borderGeometry, borderMaterial);
    borderRight.position.set(
      lane.position + laneWidth / 2,
      0.02,
      -laneLength / 2
    );
    scene.add(borderRight);
  });
}

// Create rounded rectangle shape for Mac-style keys
function createRoundedRectShape(width, height, radius) {
  const shape = new THREE.Shape();
  const x = -width / 2;
  const y = -height / 2;

  shape.moveTo(x + radius, y);
  shape.lineTo(x + width - radius, y);
  shape.quadraticCurveTo(x + width, y, x + width, y + radius);
  shape.lineTo(x + width, y + height - radius);
  shape.quadraticCurveTo(x + width, y + height, x + width - radius, y + height);
  shape.lineTo(x + radius, y + height);
  shape.quadraticCurveTo(x, y + height, x, y + height - radius);
  shape.lineTo(x, y + radius);
  shape.quadraticCurveTo(x, y, x + radius, y);

  return shape;
}

// Create canvas texture for key labels - thinner Mac-style font
function createKeyTexture(letter) {
  const canvas = document.createElement("canvas");
  canvas.width = 256;
  canvas.height = 256;
  const ctx = canvas.getContext("2d");

  // Clear canvas
  ctx.fillStyle = "transparent";
  ctx.fillRect(0, 0, 256, 256);

  // Draw letter with thinner, more Mac-like font
  ctx.fillStyle = "#eeeeee";
  ctx.font =
    "420 115px -apple-system, BlinkMacSystemFont, 'SF Pro Text', Arial, sans-serif";
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillText(letter.toUpperCase(), 128, 128);

  return new THREE.CanvasTexture(canvas);
}

// Create 3D keyboard keys at the hit zone
function create3DKeys() {
  gameState.lanes.forEach((lane) => {
    // Mac-style rounded key with ExtrudeGeometry - less tall
    const roundedShape = createRoundedRectShape(1.45, 1.3, 0.15);
    const extrudeSettings = {
      depth: 0.12,
      bevelEnabled: true,
      bevelThickness: 0.015,
      bevelSize: 0.015,
      bevelSegments: 3,
    };
    const keyGeometry = new THREE.ExtrudeGeometry(
      roundedShape,
      extrudeSettings
    );
    keyGeometry.rotateX(Math.PI / 2);

    const keyMaterial = new THREE.MeshStandardMaterial({
      color: 0x333333,
      metalness: 0.2,
      roughness: 0.7,
    });
    const keyMesh = new THREE.Mesh(keyGeometry, keyMaterial);
    keyMesh.position.set(lane.position, 0.1, 0);

    // Create letter texture and apply to top face - perfectly centered
    const texture = createKeyTexture(lane.key);
    const letterGeometry = new THREE.PlaneGeometry(1.0, 1.0);
    const letterMaterial = new THREE.MeshBasicMaterial({
      map: texture,
      transparent: true,
      opacity: 1.0,
      depthTest: true,
      depthWrite: false,
    });
    const letterPlane = new THREE.Mesh(letterGeometry, letterMaterial);
    letterPlane.rotation.x = -Math.PI / 2;
    letterPlane.position.set(0, 0.05, 0); // Centered on key top surface
    keyMesh.add(letterPlane);

    scene.add(keyMesh);

    // Store reference with original position and scale
    gameState.keyMeshes[lane.key] = {
      mesh: keyMesh,
      originalY: 0.1,
      pressedY: 0.04,
      originalScaleY: 1.0,
      pressedScaleY: 0.5, // More compression for visible press effect
    };
  });
}

// Create a note
function createNote(laneIndex) {
  const lane = gameState.lanes[laneIndex];

  // White tile with colored outline - fix z-fighting
  const noteMesh = new THREE.Group();
  noteMesh.position.set(lane.position, 0.05, -40);

  // Colored outline border (bottom layer)
  const borderGeometry = new THREE.PlaneGeometry(1.25, 1.15);
  const borderMaterial = new THREE.MeshBasicMaterial({
    color: lane.color,
    transparent: true,
    opacity: 0.9,
    side: THREE.DoubleSide,
  });
  const border = new THREE.Mesh(borderGeometry, borderMaterial);
  border.rotation.x = -Math.PI / 2;
  border.position.y = 0;
  noteMesh.add(border);

  // White center (top layer) - larger for thinner outline
  const geometry = new THREE.PlaneGeometry(1.15, 1.05);
  const material = new THREE.MeshBasicMaterial({
    color: 0xffffff,
    transparent: true,
    opacity: 0.95,
    side: THREE.DoubleSide,
  });
  const whiteTile = new THREE.Mesh(geometry, material);
  whiteTile.rotation.x = -Math.PI / 2;
  whiteTile.position.y = 0.01; // Slightly above border to prevent z-fighting
  noteMesh.add(whiteTile);

  scene.add(noteMesh);

  const note = {
    mesh: noteMesh,
    lane: laneIndex,
    speed: 0.18,
    active: true,
    hitWindow: 1.0, // Distance from hit zone where note can be hit
  };

  gameState.notes.push(note);
}

// Spawn notes
function spawnNotes(timestamp) {
  if (timestamp - gameState.lastSpawnTime > gameState.spawnInterval) {
    const randomLane = Math.floor(Math.random() * 4);
    createNote(randomLane);
    gameState.lastSpawnTime = timestamp;
  }
}

// Update notes
function updateNotes() {
  const hitZoneZ = 0; // Z position of hit zone (where keys are)

  for (let i = gameState.notes.length - 1; i >= 0; i--) {
    const note = gameState.notes[i];

    if (!note.active) continue;

    // Move note toward player
    note.mesh.position.z += note.speed;

    // Keep flat notes at consistent height
    note.mesh.position.y = 0.05;

    // Check if note passed the hit zone
    if (note.mesh.position.z > hitZoneZ + 2) {
      // Miss
      scene.remove(note.mesh);
      gameState.notes.splice(i, 1);
      gameState.combo = 0;
      updateUI();
    }
  }
}

// Check for hits
function checkHit(key) {
  const laneIndex = gameState.lanes.findIndex((lane) => lane.key === key);
  if (laneIndex === -1) return;

  const hitZoneZ = 0; // Z position where keys are
  const lane = gameState.lanes[laneIndex];

  // Find closest note in this lane
  let closestNote = null;
  let closestDistance = Infinity;

  for (const note of gameState.notes) {
    if (note.lane === laneIndex && note.active) {
      const distance = Math.abs(note.mesh.position.z - hitZoneZ);
      if (distance < closestDistance) {
        closestDistance = distance;
        closestNote = note;
      }
    }
  }

  // Check if note is within hit window
  if (closestNote && closestDistance < closestNote.hitWindow) {
    // Hit!
    scene.remove(closestNote.mesh);
    closestNote.active = false;

    // Calculate score based on accuracy
    let points = 100;
    if (closestDistance < 0.3) points = 300; // Perfect
    else if (closestDistance < 0.5) points = 200; // Great

    gameState.score += points;
    gameState.combo++;

    // Visual feedback
    createHitEffect(lane.position, lane.color);

    updateUI();
  } else {
    // Miss
    gameState.combo = 0;
    updateUI();
  }
}

// Create hit effect
function createHitEffect(x, color) {
  const geometry = new THREE.RingGeometry(0.5, 0.8, 32);
  const material = new THREE.MeshBasicMaterial({
    color: color,
    transparent: true,
    opacity: 0.9,
    side: THREE.DoubleSide,
  });
  const ring = new THREE.Mesh(geometry, material);
  ring.rotation.x = -Math.PI / 2;
  ring.position.set(x, 0.2, 0);
  scene.add(ring);

  // Animate and remove
  let scale = 1;
  const animate = () => {
    scale += 0.15;
    ring.scale.set(scale, scale, scale);
    ring.material.opacity -= 0.06;

    if (ring.material.opacity <= 0) {
      scene.remove(ring);
    } else {
      requestAnimationFrame(animate);
    }
  };
  animate();
}

// Update UI
function updateUI() {
  document.getElementById("score").textContent = `Score: ${gameState.score}`;
  document.getElementById("combo").textContent = `Combo: ${gameState.combo}`;
}

// Input handling
document.addEventListener("keydown", (e) => {
  const key = e.key.toLowerCase();

  if (key === " " && !gameState.started) {
    gameState.started = true;
    document.getElementById("start-screen").classList.add("hidden");
    gameState.lastSpawnTime = performance.now();
    return;
  }

  if (!gameState.started) return;

  if (!gameState.pressedKeys.has(key)) {
    gameState.pressedKeys.add(key);

    // Visual feedback on HTML key
    const keyElement = document.getElementById(`key-${key}`);
    if (keyElement) {
      keyElement.classList.add("active");
    }

    // Visual feedback on 3D key - compress it down
    const keyObj = gameState.keyMeshes[key];
    if (keyObj) {
      keyObj.mesh.position.y = keyObj.pressedY;
      keyObj.mesh.scale.y = keyObj.pressedScaleY;
      keyObj.mesh.material.color.setHex(0x2a2a2a);
    }

    // Check for hit
    checkHit(key);
  }
});

document.addEventListener("keyup", (e) => {
  const key = e.key.toLowerCase();
  gameState.pressedKeys.delete(key);

  // Reset HTML key visual
  const keyElement = document.getElementById(`key-${key}`);
  if (keyElement) {
    keyElement.classList.remove("active");
  }

  // Reset 3D key visual - restore height
  const keyObj = gameState.keyMeshes[key];
  if (keyObj) {
    keyObj.mesh.position.y = keyObj.originalY;
    keyObj.mesh.scale.y = keyObj.originalScaleY;
    keyObj.mesh.material.color.setHex(0x333333);
  }
});

// Handle window resize
window.addEventListener("resize", () => {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
});

// Animation loop
function animate(timestamp) {
  requestAnimationFrame(animate);

  if (gameState.started) {
    spawnNotes(timestamp);
    updateNotes();
  }

  renderer.render(scene, camera);
}

// Initialize
createLanes();
create3DKeys();
animate(0);
