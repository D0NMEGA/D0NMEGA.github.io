class Perlin {
    constructor() {
        this.p = new Array(512);
        this.permutation = [151,160,137,91,90,15,131,13,201,95,96,53,194,233,7,225,140,36,103,30,69,142,8,99,37,240,21,10,23,
                            190,6,148,247,120,234,75,0,26,197,62,94,252,219,203,117,35,11,32,57,177,33,88,237,149,56,87,174,20,125,136,171,168,68,175,
                            74,165,71,134,139,48,27,166,77,146,158,231,83,111,229,122,60,211,133,230,220,105,92,41,55,46,245,40,244,102,143,54,65,25,63,161,1,
                            216,80,73,209,76,132,187,208,89,18,169,200,196,135,130,116,188,159,86,164,100,109,198,173,186,3,64,52,217,226,250,124,123,
                            5,202,38,147,118,126,255,82,85,212,207,206,59,227,47,16,58,17,182,189,28,42,223,183,170,213,119,248,152,2,44,154,163,70,221,153,
                            101,155,167,43,172,9,129,22,39,253,19,98,108,110,79,113,224,232,178,185,112,104,218,246,97,228,251,34,242,193,238,210,144,12,191,
                            179,162,241,81,51,145,235,249,14,239,107,49,192,214,31,181,199,106,157,184,84,204,176,115,121,50,45,127,4,150,254,138,236,205,93,
                            222,114,67,29,24,72,243,141,128,195,78,66,215,61,156,180];
        for (let i = 0; i < 256; i++) {
            this.p[256 + i] = this.p[i] = this.permutation[i];
        }
    }
    noise(x, y = 0, z = 0) {
        let X = Math.floor(x) & 255, Y = Math.floor(y) & 255, Z = Math.floor(z) & 255;
        x -= Math.floor(x); y -= Math.floor(y); z -= Math.floor(z);
        let u = this.fade(x), v = this.fade(y), w = this.fade(z);
        let A = this.p[X] + Y, AA = this.p[A] + Z, AB = this.p[A + 1] + Z,
            B = this.p[X + 1] + Y, BA = this.p[B] + Z, BB = this.p[B + 1] + Z;
        return this.lerp(w, this.lerp(v, this.lerp(u, this.grad(this.p[AA], x, y, z), this.grad(this.p[BA], x - 1, y, z)),
                               this.lerp(u, this.grad(this.p[AB], x, y - 1, z), this.grad(this.p[BB], x - 1, y - 1, z))),
                           this.lerp(v, this.lerp(u, this.grad(this.p[AA + 1], x, y, z - 1), this.grad(this.p[BA + 1], x - 1, y, z - 1)),
                               this.lerp(u, this.grad(this.p[AB + 1], x, y - 1, z - 1), this.grad(this.p[BB + 1], x - 1, y - 1, z - 1))));
    }
    fade(t) { return t * t * t * (t * (t * 6 - 15) + 10); }
    lerp(t, a, b) { return a + t * (b - a); }
    grad(hash, x, y, z) {
        let h = hash & 15;
        let u = h < 8 ? x : y, v = h < 4 ? y : h == 12 || h == 14 ? x : z;
        return ((h & 1) == 0 ? u : -u) + ((h & 2) == 0 ? v : -v);
    }
}

// Scene setup
const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 1000);
const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setSize(window.innerWidth, window.innerHeight);
document.body.appendChild(renderer.domElement);
console.log('Renderer created:', renderer.domElement);

camera.position.z = 0;

// Perlin instance
const perlin = new Perlin();
let time = 0;

// Tunnel params
const TUBE_SEGMENTS = 70;
const TUBE_RADIUS = 0.5; // Increased for visibility
const POINTS_COUNT = 5;
let curvePoints = [];
for (let i = 0; i < POINTS_COUNT; i++) {
    curvePoints.push(new THREE.Vector3(0, 0, 2.5 * (i / (POINTS_COUNT - 1))));
}
let curve = new THREE.CatmullRomCurve3(curvePoints);

// Procedural texture
const canvas = document.createElement('canvas');
canvas.width = 512; canvas.height = 512;
const ctx = canvas.getContext('2d');
for (let x = 0; x < 512; x++) {
    for (let y = 0; y < 512; y++) {
        const noise = perlin.noise(x / 100, y / 100, time / 10);
        ctx.fillStyle = `hsl(${noise * 360}, 50%, ${30 + noise * 40}%)`;
        ctx.fillRect(x, y, 1, 1);
    }
}
const texture = new THREE.CanvasTexture(canvas);
texture.wrapS = THREE.RepeatWrapping;
texture.wrapT = THREE.RepeatWrapping;
texture.repeat.set(30, 6);

// Tube mesh
const tubeGeometry = new THREE.TubeGeometry(curve, TUBE_SEGMENTS, TUBE_RADIUS, 50, false);
const tubeMaterial = new THREE.MeshBasicMaterial({ map: texture, side: THREE.BackSide });
const tube = new THREE.Mesh(tubeGeometry, tubeMaterial);
scene.add(tube);
console.log('Tube added to scene');

// Test cube
const testCube = new THREE.Mesh(
    new THREE.BoxGeometry(0.1, 0.1, 0.1),
    new THREE.MeshBasicMaterial({ color: 0xff0000 })
);
testCube.position.set(0, 0, -1);
scene.add(testCube);
console.log('Test cube added');

let speed = 0.005;
let mouse = { x: 0, y: 0 };

// Mouse and touch listeners
document.addEventListener('mousemove', (e) => {
    mouse.x = (e.clientX / window.innerWidth) * 2 - 1;
    mouse.y = -(e.clientY / window.innerHeight) * 2 + 1;
});
document.addEventListener('touchmove', (e) => {
    mouse.x = (e.touches[0].clientX / window.innerWidth) * 2 - 1;
    mouse.y = -(e.touches[0].clientY / window.innerHeight) * 2 + 1;
});

// Click to start
const info = document.getElementById('info');
const audio = document.getElementById('bgMusic');
info.addEventListener('click', () => {
    console.log('Clicked! Attempting to play audio...');
    audio.play().then(() => console.log('Audio playing')).catch(e => console.error('Audio error:', e));
    info.style.display = 'none';
});

// Resize handler
window.addEventListener('resize', () => {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
});

// Animation loop
function animate() {
    requestAnimationFrame(animate);
    time += 1;

    // Generative turns
    for (let i = 1; i < POINTS_COUNT - 1; i++) {
        const noiseX = perlin.noise(time * 0.01 + i * 0.1, 0, 0) * 0.05;
        const noiseY = perlin.noise(0, time * 0.01 + i * 0.1, 0) * 0.05;
        curvePoints[i].x = noiseX + mouse.x * 0.1 * (i / POINTS_COUNT);
        curvePoints[i].y = noiseY + mouse.y * 0.1 * (i / POINTS_COUNT);
    }
    curve = new THREE.CatmullRomCurve3(curvePoints);
    tube.geometry.dispose();
    tube.geometry = new THREE.TubeGeometry(curve, TUBE_SEGMENTS, TUBE_RADIUS, 50, false);

    // Flythrough
    texture.offset.x += speed;
    texture.needsUpdate = true;

    // Animate texture
    for (let x = 0; x < 512; x += 10) {
        for (let y = 0; y < 512; y += 10) {
            const noise = perlin.noise(x / 100, y / 100, time / 10);
            ctx.fillStyle = `hsl(${ (noise * 360 + time % 360) % 360 }, 50%, ${30 + noise * 40}%)`;
            ctx.fillRect(x, y, 10, 10);
        }
    }
    texture.needsUpdate = true;

    renderer.render(scene, camera);
}
animate();
