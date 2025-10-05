// Endless hallway - simplified, no Perlin noise.
// Author: ChatGPT (starter). Drop into repo with index.html + style.css + aphex-track.mp3

// ---- Config ----
const SEGMENT_LENGTH = 10;     // length of one corridor segment (units)
const SEGMENT_COUNT = 12;      // how many segments kept in memory
const HALL_WIDTH = 6;          // width of corridor
const HALL_HEIGHT = 4;         // height of corridor
const CAMERA_OFFSET = 1.5;     // camera height above floor
const FORWARD_SPEED = 4.0;     // units per second
const FOG_NEAR = 15;           // start of visible fade (approx 15 ft as requested)
const FOG_FAR = 40;            // fully dark by this distance
const TURN_THRESHOLD = 0.45;   // how far to move mouse to trigger turn
const TURN_COOLDOWN = 0.6;     // seconds between queued turns

// ---- Scene ----
const scene = new THREE.Scene();
scene.fog = new THREE.Fog(0x000000, FOG_NEAR, FOG_FAR);

const camera = new THREE.PerspectiveCamera(65, window.innerWidth / window.innerHeight, 0.1, 1000);
camera.position.set(0, CAMERA_OFFSET, 0);

// Renderer
const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.outputEncoding = THREE.sRGBEncoding;
document.body.appendChild(renderer.domElement);

// Lighting: ambient + point near camera so immediate area is lit, fades into fog
const amb = new THREE.AmbientLight(0x808080, 0.6);
scene.add(amb);

const point = new THREE.PointLight(0xfff7e6, 0.9, 40);
point.position.copy(camera.position);
scene.add(point);

// Texture - concrete tile (public image). You may replace with your local texture.
const textureURL = 'https://cdn.pixabay.com/photo/2016/11/29/10/07/concrete-1869220_1280.jpg';
const loader = new THREE.TextureLoader();
loader.crossOrigin = '';
const concreteTex = loader.load(textureURL, tex => {
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
  tex.repeat.set(2, 2);
  tex.anisotropy = renderer.capabilities.getMaxAnisotropy();
});

// Material for walls/floor/ceiling
const wallMat = new THREE.MeshStandardMaterial({
  map: concreteTex,
  roughness: 1,
  metalness: 0,
  side: THREE.DoubleSide
});

// Helper to create a single corridor segment (group containing floor, ceiling, left/right walls)
function makeSegment() {
  const g = new THREE.Group();

  const floorGeo = new THREE.PlaneGeometry(HALL_WIDTH, SEGMENT_LENGTH);
  const floor = new THREE.Mesh(floorGeo, wallMat);
  floor.rotation.x = -Math.PI / 2;
  floor.position.y = 0;
  floor.position.z = -SEGMENT_LENGTH / 2; // plane centered; we want segment's end at negative z
  floor.receiveShadow = true;
  g.add(floor);

  const ceiling = new THREE.Mesh(floorGeo, wallMat);
  ceiling.rotation.x = Math.PI / 2;
  ceiling.position.y = HALL_HEIGHT;
  ceiling.position.z = -SEGMENT_LENGTH / 2;
  g.add(ceiling);

  const wallGeo = new THREE.PlaneGeometry(SEGMENT_LENGTH, HALL_HEIGHT);
  const left = new THREE.Mesh(wallGeo, wallMat);
  left.rotation.y = Math.PI / 2;
  left.position.x = -HALL_WIDTH / 2;
  left.position.y = HALL_HEIGHT / 2;
  left.position.z = -SEGMENT_LENGTH / 2;
  g.add(left);

  const right = left.clone();
  right.position.x = HALL_WIDTH / 2;
  g.add(right);

  // scale the texture per face for variety
  if (concreteTex) {
    const scaleU = 1 + Math.random() * 2;
    const scaleV = 1 + Math.random() * 2;
    concreteTex.repeat.set(scaleU, scaleV);
  }

  return g;
}

// Corridor state: segments array, path direction, and current world position for next segment
let segments = [];
let currentPos = new THREE.Vector3(0, 0, 0);
let forward = new THREE.Vector3(0, 0, -1); // initial forward is -Z
let up = new THREE.Vector3(0, 1, 0);
let lastTurnTime = -999;
let queuedTurn = null; // { axis: 'y'|'x', angle: +/-Math.PI/2 }

// Build initial straight corridor
function initSegments() {
  segments.forEach(s => scene.remove(s.group));
  segments = [];
  currentPos.set(0, 0, 0);
  forward.set(0,0,-1);

  for (let i = 0; i < SEGMENT_COUNT; i++) {
    const seg = makeSegment();
    seg.position.copy(currentPos);
    scene.add(seg);
    segments.push({ group: seg, pos: currentPos.clone(), forward: forward.clone() });

    // advance position for next segment
    const next = forward.clone().multiplyScalar(SEGMENT_LENGTH);
    currentPos = currentPos.clone().add(next);
  }
}
initSegments();

// Mouse tracking (normalized -1..1)
const mouse = { x: 0, y: 0 };
window.addEventListener('mousemove', (e) => {
  mouse.x = (e.clientX / window.innerWidth) * 2 - 1;
  mouse.y = -(e.clientY / window.innerHeight) * 2 + 1;
});

// On pointer leave, reset a bit
window.addEventListener('mouseleave', () => { mouse.x = 0; mouse.y = 0; });

// Window resize
window.addEventListener('resize', () => {
  camera.aspect = window.innerWidth/window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
});

// Decide queue based on mouse - called every tick but respects cooldown
function maybeQueueTurn(now) {
  if (now - lastTurnTime < TURN_COOLDOWN) return;
  // left/right preference
  if (mouse.x > TURN_THRESHOLD) {
    queuedTurn = { axis: 'y', angle: -Math.PI/2 }; // turn right (camera yaw negative)
    lastTurnTime = now;
  } else if (mouse.x < -TURN_THRESHOLD) {
    queuedTurn = { axis: 'y', angle: Math.PI/2 }; // turn left
    lastTurnTime = now;
  } else if (mouse.y > TURN_THRESHOLD) {
    queuedTurn = { axis: 'x', angle: -Math.PI/2 }; // turn up (pitch negative)
    lastTurnTime = now;
  } else if (mouse.y < -TURN_THRESHOLD) {
    queuedTurn = { axis: 'x', angle: Math.PI/2 }; // turn down (pitch positive)
    lastTurnTime = now;
  }
}

// Add new segment at currentPos with optional rotation (apply queuedTurn)
function spawnNextSegment() {
  // If there's a queued turn, rotate forward and up accordingly BEFORE placing the segment,
  // this means the next segment extends in the new direction (turn happens between segments).
  if (queuedTurn) {
    const q = new THREE.Quaternion();
    if (queuedTurn.axis === 'y') { // yaw (left/right)
      q.setFromAxisAngle(up, queuedTurn.angle);
      forward.applyQuaternion(q);
    } else if (queuedTurn.axis === 'x') { // pitch (up/down)
      // compute local right axis
      const right = new THREE.Vector3().crossVectors(forward, up).normalize();
      q.setFromAxisAngle(right, queuedTurn.angle);
      forward.applyQuaternion(q);
      up.applyQuaternion(q);
    }
    queuedTurn = null;
  }

  const seg = makeSegment();
  seg.position.copy(currentPos);
  scene.add(seg);
  segments.push({ group: seg, pos: currentPos.clone(), forward: forward.clone() });

  // advance position for following segment
  const next = forward.clone().multiplyScalar(SEGMENT_LENGTH);
  currentPos = currentPos.clone().add(next);
}

// Remove segments behind the camera (older ones)
function cleanupSegments(cameraZ) {
  // We'll remove if camera has passed beyond segment's end by a safe margin.
  while (segments.length > 0) {
    const first = segments[0];
    // Compute vector from first.pos to camera
    const toCam = camera.position.clone().sub(first.pos);
    // dot with that segment's forward to get forward-distance
    const d = first.forward.clone().dot(toCam);
    if (d > SEGMENT_LENGTH * 1.5) {
      scene.remove(first.group);
      segments.shift();
    } else break;
  }
  // Keep a minimum number of segments
  while (segments.length < SEGMENT_COUNT) spawnNextSegment();
}

// Camera smoothing: we maintain a target orientation and interpolate to it when turns happen
let cameraTargetQuaternion = camera.quaternion.clone();
function updateCameraOrientation(delta) {
  // The camera should look along the current segment forward vector.
  // Determine which segment camera is currently in (use last segment as forward)
  const seg = segments.length ? segments[segments.length-1] : null;
  // We compute desired look direction from forward vector of the segment camera is approaching.
  // Simpler: desired look is the forward vector of the segment in front of camera.
  let desiredForward = forward.clone();
  if (segments.length > 0) {
    // find a segment whose position is just ahead of camera
    for (let i = 0; i < segments.length; i++) {
      const s = segments[i];
      const rel = s.pos.clone().sub(camera.position);
      if (s.forward.dot(rel) < 5) { // camera is before or inside
        desiredForward = s.forward.clone();
        break;
      }
    }
  }

  // Build desired quaternion: camera should be at height CAMERA_OFFSET and look in desiredForward
  const targetPos = new THREE.Vector3().addVectors(camera.position, desiredForward);
  camera.lookAt(targetPos);
  const desiredQ = camera.quaternion.clone();

  // Smooth interpolation
  camera.quaternion.slerp(desiredQ, Math.min(1, delta * 2.5));
}

// Movement state
let clock = new THREE.Clock();
let distanceAccumulator = 0;

// Start / audio handling
let isStarted = false;
const info = document.getElementById('info');
const audioEl = document.getElementById('bgMusic');

info.addEventListener('click', async () => {
  try {
    await audioEl.play();
  } catch(e) {
    // autoplay blocking, but click should allow it
    console.warn('audio play issue', e);
  }
  info.style.display = 'none';
  isStarted = true;
});

// Animation loop
function animate() {
  requestAnimationFrame(animate);
  const delta = clock.getDelta();
  const now = clock.elapsedTime;

  if (!isStarted) {
    renderer.render(scene, camera);
    return;
  }

  // update point light to camera
  point.position.copy(camera.position);

  // maybe queue a turn from mouse
  maybeQueueTurn(now);

  // move camera forward along current forward vector
  const moveStep = FORWARD_SPEED * delta;
  const stepVec = forward.clone().multiplyScalar(moveStep);
  camera.position.add(stepVec);

  // camera height (keep stable relative to floor)
  // compute desired camera y = floor height + CAMERA_OFFSET (floor at 0)
  // but when pitch turns (up/down) the floor might rotate with segment; keeping global y gives a sense of movement
  // We'll leave camera.y unchanged to avoid sudden jumps, but clamp to reasonable range:
  camera.position.y = THREE.MathUtils.clamp(camera.position.y, -10, 50);

  distanceAccumulator += moveStep;
  // spawn new segment when we've advanced one segment length beyond last spawn
  if (distanceAccumulator >= SEGMENT_LENGTH / 2) {
    distanceAccumulator = 0;
    spawnNextSegment();
  }

  // remove old segments behind camera
  cleanupSegments(camera.position.z);

  // smooth orientation to face forward direction
  updateCameraOrientation(delta);

  renderer.render(scene, camera);
}

animate();
