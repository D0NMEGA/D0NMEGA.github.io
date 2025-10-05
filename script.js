import * as THREE from 'three';

let scene, camera, renderer;
let hallSegments = [];
let moveSpeed = 0.2;
let direction = new THREE.Vector3(0, 0, -1);
let active = false;

const startBtn = document.getElementById('start');
startBtn.addEventListener('click', init);

function init() {
  startBtn.style.display = 'none';

  // Scene setup
  scene = new THREE.Scene();
  camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 1000);
  camera.position.set(0, 0, 5);

  renderer = new THREE.WebGLRenderer({ antialias: true });
  renderer.setSize(window.innerWidth, window.innerHeight);
  renderer.outputColorSpace = THREE.SRGBColorSpace; // ✅ modern replacement
  document.body.appendChild(renderer.domElement);

  const light = new THREE.AmbientLight(0xffffff, 0.8);
  scene.add(light);

  // Generate first few hallway segments
  for (let i = 0; i < 10; i++) addHallSegment(i * -20);

  active = true;
  animate();
}

function addHallSegment(z) {
  const width = 10, height = 10, depth = 20;
  const material = new THREE.MeshStandardMaterial({ color: 0x444444, side: THREE.BackSide });

  const box = new THREE.Mesh(new THREE.BoxGeometry(width, height, depth), material);
  box.position.z = z - depth / 2;
  scene.add(box);
  hallSegments.push(box);
}

function animate() {
  if (!active) return;

  requestAnimationFrame(animate);

  // Move forward
  camera.position.addScaledVector(direction, moveSpeed);

  // Recycle segments
  hallSegments.forEach(seg => {
    if (seg.position.z - camera.position.z > 30) {
      seg.position.z -= 200; // push it far ahead
    }
  });

  renderer.render(scene, camera);
}
