import * as THREE from "three";

// Game state
export const gameState = {
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
  selectedSong: null,
  songDifficulties: {
    easy: { spawnInterval: 1200 },
    medium: { spawnInterval: 800 },
    hard: { spawnInterval: 500 },
    custom: { spawnInterval: 800 },
  },
};

// Three.js setup
let scene, camera, renderer;

export function initGame() {
  scene = new THREE.Scene();
  scene.background = new THREE.Color(0x0a0a1a);
  scene.fog = new THREE.Fog(0x0a0a1a, 10, 50);

  camera = new THREE.PerspectiveCamera(
    60,
    window.innerWidth / window.innerHeight,
    0.1,
    1000
  );
  camera.position.set(0, 4, 6);
  camera.lookAt(0, 0, -10);

  renderer = new THREE.WebGLRenderer({ antialias: true });
  renderer.setSize(window.innerWidth, window.innerHeight);
  renderer.setPixelRatio(window.devicePixelRatio);
  document.getElementById("canvas-container").appendChild(renderer.domElement);

  // Lighting
  const ambientLight = new THREE.AmbientLight(0xffffff, 0.6);
  scene.add(ambientLight);

  const directionalLight = new THREE.DirectionalLight(0xffffff, 0.8);
  directionalLight.position.set(5, 10, 5);
  scene.add(directionalLight);

  // Initialize game
  createLanes();
  create3DKeys();
  setupInput();
  animate(0);

  // Handle window resize
  window.addEventListener("resize", () => {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
  });
}

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

// Create white caret texture for long press notes (chevron pointing down)
function createCaretTexture() {
  const canvas = document.createElement("canvas");
  canvas.width = 128;
  canvas.height = 128;
  const ctx = canvas.getContext("2d");

  // Clear canvas
  ctx.fillStyle = "transparent";
  ctx.fillRect(0, 0, 128, 128);

  // Draw white caret/chevron pointing up (no stem, just the ^ shape)
  ctx.strokeStyle = "#ffffff";
  ctx.lineWidth = 18; // Thicker
  ctx.lineCap = "butt"; // Square edges instead of rounded
  ctx.lineJoin = "miter"; // Sharp corners instead of rounded

  ctx.beginPath();
  ctx.moveTo(35, 85); // left point (bottom)
  ctx.lineTo(64, 50); // top point
  ctx.lineTo(93, 85); // right point (bottom)
  ctx.stroke();

  return new THREE.CanvasTexture(canvas);
}

// Create a note
function createNote(laneIndex, isLongPress = false) {
  const lane = gameState.lanes[laneIndex];
  const frontSquareSize = 1.15; // Size of the front square
  const bodyLength = isLongPress ? 4.0 - frontSquareSize : 0; // Body length (excluding front square)
  const totalLength = isLongPress ? 4.0 : 1.15;

  // Main group
  const noteMesh = new THREE.Group();
  noteMesh.position.set(lane.position, 0.01, -40);

  if (isLongPress) {
    // FRONT SQUARE: Solid colored square with white caret
    const frontSquareGeometry = new THREE.PlaneGeometry(1.25, 1.25);
    const frontSquareMaterial = new THREE.MeshBasicMaterial({
      color: lane.color,
      transparent: true,
      opacity: 0.95,
      side: THREE.DoubleSide,
    });
    const frontSquare = new THREE.Mesh(
      frontSquareGeometry,
      frontSquareMaterial
    );
    frontSquare.rotation.x = -Math.PI / 2;
    frontSquare.position.set(0, 0, totalLength / 2 - frontSquareSize / 2); // At the front
    noteMesh.add(frontSquare);

    // White caret on the front square
    const caretTexture = createCaretTexture();
    const caretGeometry = new THREE.PlaneGeometry(0.8, 0.8);
    const caretMaterial = new THREE.MeshBasicMaterial({
      map: caretTexture,
      transparent: true,
      opacity: 1.0,
      side: THREE.DoubleSide,
    });
    const caret = new THREE.Mesh(caretGeometry, caretMaterial);
    caret.rotation.x = -Math.PI / 2;
    caret.position.set(0, 0.01, totalLength / 2 - frontSquareSize / 2); // On top of front square
    noteMesh.add(caret);

    // BODY: Normal white center with colored outline (shrinkable part)
    const bodyGroup = new THREE.Group();
    const bodyCenter = -(frontSquareSize / 2); // Position behind the front square
    bodyGroup.position.z = bodyCenter;

    // Colored outline border
    const bodyBorderGeometry = new THREE.PlaneGeometry(1.25, bodyLength);
    const bodyBorderMaterial = new THREE.MeshBasicMaterial({
      color: lane.color,
      transparent: true,
      opacity: 0.9,
      side: THREE.DoubleSide,
    });
    const bodyBorder = new THREE.Mesh(bodyBorderGeometry, bodyBorderMaterial);
    bodyBorder.rotation.x = -Math.PI / 2;
    bodyBorder.position.y = 0;
    bodyGroup.add(bodyBorder);

    // White center
    const bodyWhiteGeometry = new THREE.PlaneGeometry(1.15, bodyLength - 0.1);
    const bodyWhiteMaterial = new THREE.MeshBasicMaterial({
      color: 0xffffff,
      transparent: true,
      opacity: 0.95,
      side: THREE.DoubleSide,
    });
    const bodyWhite = new THREE.Mesh(bodyWhiteGeometry, bodyWhiteMaterial);
    bodyWhite.rotation.x = -Math.PI / 2;
    bodyWhite.position.y = 0.01;
    bodyGroup.add(bodyWhite);

    noteMesh.add(bodyGroup);
  } else {
    // Regular note - simple white center with colored outline
    const borderGeometry = new THREE.PlaneGeometry(1.25, totalLength);
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

    const whiteGeometry = new THREE.PlaneGeometry(1.15, totalLength - 0.1);
    const whiteMaterial = new THREE.MeshBasicMaterial({
      color: 0xffffff,
      transparent: true,
      opacity: 0.95,
      side: THREE.DoubleSide,
    });
    const whiteTile = new THREE.Mesh(whiteGeometry, whiteMaterial);
    whiteTile.rotation.x = -Math.PI / 2;
    whiteTile.position.y = 0.01;
    noteMesh.add(whiteTile);
  }

  scene.add(noteMesh);

  // Calculate hold duration based on note length and speed
  // At 60fps, speed 0.18 per frame = 10.8 units/second
  const holdDuration = isLongPress ? totalLength / (0.18 * 60) : 0;

  const note = {
    mesh: noteMesh,
    lane: laneIndex,
    speed: 0.18,
    active: true,
    hitWindow: isLongPress ? 3.0 : 1.0, // Larger hit window for long press notes - more forgiving
    isLongPress: isLongPress,
    noteLength: totalLength,
    frontSquareSize: frontSquareSize,
    bodyLength: bodyLength,
    initialBodyLength: bodyLength,
    holdDuration: holdDuration,
    holdStartTime: null,
    isHolding: false,
    holdComplete: false,
    lockPosition: null, // Z position where front square locks
  };

  gameState.notes.push(note);
}

// Spawn notes
function spawnNotes(timestamp) {
  if (timestamp - gameState.lastSpawnTime > gameState.spawnInterval) {
    const randomLane = Math.floor(Math.random() * 4);
    const isLongPress = Math.random() < 0.15; // 15% chance of long press note - not too overwhelming
    createNote(randomLane, isLongPress);
    gameState.lastSpawnTime = timestamp;
  }
}

// Update notes
function updateNotes() {
  const hitZoneZ = 0; // Z position of hit zone (where keys are)
  const currentTime = performance.now();

  for (let i = gameState.notes.length - 1; i >= 0; i--) {
    const note = gameState.notes[i];

    if (!note.active) continue;

    // Move note toward player (unless it's locked)
    if (note.isLongPress && note.isHolding && note.lockPosition !== null) {
      // Keep note locked at the hit zone
      note.mesh.position.z = note.lockPosition;
    } else {
      note.mesh.position.z += note.speed;
    }

    // Keep flat notes at consistent height
    note.mesh.position.y = 0.01;

    // Handle long press notes
    if (note.isLongPress && note.isHolding) {
      const holdTime = (currentTime - note.holdStartTime) / 1000; // Convert to seconds
      const lane = gameState.lanes[note.lane];

      // Check if player released early
      if (!gameState.pressedKeys.has(lane.key)) {
        // Released early - miss
        scene.remove(note.mesh);
        gameState.notes.splice(i, 1);
        gameState.combo = 0;
        updateHUD();
        continue;
      }

      // Check if hold completed
      if (holdTime >= note.holdDuration) {
        note.holdComplete = true;
        scene.remove(note.mesh);
        gameState.notes.splice(i, 1);

        // Perfect hold!
        gameState.score += 500;
        gameState.combo++;

        const laneObj = gameState.lanes[note.lane];
        createHitEffect(laneObj.position, laneObj.color);
        updateHUD();
        continue;
      }

      // Shrink the body from the back as progress indicator
      const progress = holdTime / note.holdDuration;
      const remainingBodyLength = note.initialBodyLength * (1 - progress);

      // Get the body group (4th child in the mesh: frontSquare, caret, bodyGroup)
      const bodyGroup = note.mesh.children[2]; // bodyGroup is the 3rd child (index 2)

      if (bodyGroup) {
        // Update both border and white center geometries
        const bodyBorder = bodyGroup.children[0];
        const bodyWhite = bodyGroup.children[1];

        if (bodyBorder && bodyWhite && remainingBodyLength > 0) {
          // Dispose old geometries
          bodyBorder.geometry.dispose();
          bodyWhite.geometry.dispose();

          // Create new shrunk geometries
          bodyBorder.geometry = new THREE.PlaneGeometry(
            1.25,
            remainingBodyLength
          );
          bodyWhite.geometry = new THREE.PlaneGeometry(
            1.15,
            remainingBodyLength - 0.1
          );

          // Reposition body group to shrink from the back
          // Body center should move forward as it shrinks
          const shrinkAmount = note.initialBodyLength - remainingBodyLength;
          bodyGroup.position.z = -(note.frontSquareSize / 2) + shrinkAmount / 2;
        }
      }
    }

    // Check if note passed the hit zone
    // For long press notes, check if back of note passed without being held
    let missZone = hitZoneZ + 2;
    if (note.isLongPress && !note.isHolding) {
      // For long notes not being held, check when the back passes
      missZone = hitZoneZ + note.noteLength + 1;
    }

    if (note.mesh.position.z > missZone) {
      // Miss
      scene.remove(note.mesh);
      gameState.notes.splice(i, 1);
      gameState.combo = 0;
      updateHUD();
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
      // For long press notes, check distance to the front of the note (where arrow is)
      // But allow hitting anywhere along the note's length
      let notePosition = note.mesh.position.z;
      let distance;

      if (note.isLongPress) {
        const frontPos = notePosition + note.noteLength / 2;
        const backPos = notePosition - note.noteLength / 2;

        // If hit zone is within the note's range, distance is 0
        if (hitZoneZ >= backPos && hitZoneZ <= frontPos) {
          distance = 0;
        } else {
          // Otherwise check distance to closest edge
          distance = Math.min(
            Math.abs(frontPos - hitZoneZ),
            Math.abs(backPos - hitZoneZ)
          );
        }
      } else {
        distance = Math.abs(notePosition - hitZoneZ);
      }

      if (distance < closestDistance) {
        closestDistance = distance;
        closestNote = note;
      }
    }
  }

  // Check if note is within hit window
  if (closestNote && closestDistance < closestNote.hitWindow) {
    // Handle long press notes
    if (closestNote.isLongPress) {
      if (!closestNote.isHolding) {
        // Start holding - lock front square at hit zone
        closestNote.isHolding = true;
        closestNote.holdStartTime = performance.now();

        // Lock the note position so front square stays just in front of the keys
        // Front square is at: notePosition + (noteLength/2) - (frontSquareSize/2)
        // Position it slightly in front of the hit zone (keys)
        const frontSquareTargetZ = hitZoneZ - 1.2; // Position in front of keys
        const frontSquareOffset =
          closestNote.noteLength / 2 - closestNote.frontSquareSize / 2;
        closestNote.lockPosition = frontSquareTargetZ - frontSquareOffset;
        closestNote.mesh.position.z = closestNote.lockPosition;

        // Give initial points for starting the hold
        gameState.score += 100;
        updateHUD();
      }
      // Don't remove the note - body will shrink as you hold
      return;
    }

    // Regular note - hit!
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

    // Update HUD
    updateHUD();
  } else {
    // Miss
    gameState.combo = 0;
    updateHUD();
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

// Input handling
function setupInput() {
  document.addEventListener("keydown", (e) => {
    const key = e.key.toLowerCase();

    if (!gameState.started) return;

    if (!gameState.pressedKeys.has(key)) {
      gameState.pressedKeys.add(key);

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

    // Reset 3D key visual - restore height
    const keyObj = gameState.keyMeshes[key];
    if (keyObj) {
      keyObj.mesh.position.y = keyObj.originalY;
      keyObj.mesh.scale.y = keyObj.originalScaleY;
      keyObj.mesh.material.color.setHex(0x333333);
    }
  });
}

// Animation loop
function animate(timestamp) {
  requestAnimationFrame(animate);

  if (gameState.started) {
    spawnNotes(timestamp);
    updateNotes();
  }

  renderer.render(scene, camera);
}

// Update HUD with direct DOM manipulation for performance
function updateHUD() {
  const scoreEl = document.getElementById("score");
  const comboEl = document.getElementById("combo");

  if (scoreEl) {
    scoreEl.textContent = `Score: ${gameState.score}`;
  }

  if (comboEl) {
    comboEl.textContent =
      gameState.combo > 0 ? `${gameState.combo}x Combo!` : "";
  }
}

// Export functions for React to use
export function selectSong(song) {
  gameState.selectedSong = song;
  gameState.spawnInterval = gameState.songDifficulties[song].spawnInterval;
}

export function startGame() {
  gameState.started = true;
  gameState.lastSpawnTime = performance.now();

  // Show HUD
  const hudEl = document.getElementById("hud");
  if (hudEl) {
    hudEl.classList.remove("hidden");
  }
}
