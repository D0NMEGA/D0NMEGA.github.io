// Simple Perlin noise
class Perlin {
    constructor() {
        this.p = new Array(512);
        this.permutation = [151,160,137,91,90,15,131,13,201,95,96,53,194,233,7,225,140,36,103,30,69,142,8,99,37,240,21,10,23,190,6,148,247,120,234,75,0,26,197,62,94,252,219,203,117,35,11,32,57,177,33,88,237,149,56,87,174,20,125,136,171,168,68,175,74,165,71,134,139,48,27,166,77,146,158,231,83,111,229,122,60,211,133,230,220,105,92,41,55,46,245,40,244,102,143,54,65,25,63,161,1,216,80,73,209,76,132,187,208,89,18,169,200,196,135,130,116,188,159,86,164,100,109,198,173,186,3,64,52,217,226,250,124,123,5,202,38,147,118,126,255,82,85,212,207,206,59,227,47,16,58,17,182,189,28,42,223,183,170,213,119,248,152,2,44,154,163,70,221,153,101,155,167,43,172,9,129,22,39,253,19,98,108,110,79,113,224,232,178,185,112,104,218,246,97,228,251,34,242,193,238,210,144,12,191,179,162,241,81,51,145,235,249,14,239,107,49,192,214,31,181,199,106,157,184,84,204,176,115,121,50,45,127,4,150,254,138,236,205,93,222,114,67,29,24,72,243,141,128,195,78,66,215,61,156,180];
        for (let i = 0; i < 256; i++) {
            this.p[256 + i] = this.p[i] = this.permutation[i];
        }
    }
    
    noise(x, y, z) {
        y = y || 0;
        z = z || 0;
        let X = Math.floor(x) & 255;
        let Y = Math.floor(y) & 255;
        let Z = Math.floor(z) & 255;
        x -= Math.floor(x);
        y -= Math.floor(y);
        z -= Math.floor(z);
        let u = this.fade(x);
        let v = this.fade(y);
        let w = this.fade(z);
        let A = this.p[X] + Y;
        let AA = this.p[A] + Z;
        let AB = this.p[A + 1] + Z;
        let B = this.p[X + 1] + Y;
        let BA = this.p[B] + Z;
        let BB = this.p[B + 1] + Z;
        return this.lerp(w, 
            this.lerp(v, 
                this.lerp(u, this.grad(this.p[AA], x, y, z), this.grad(this.p[BA], x - 1, y, z)),
                this.lerp(u, this.grad(this.p[AB], x, y - 1, z), this.grad(this.p[BB], x - 1, y - 1, z))
            ),
            this.lerp(v, 
                this.lerp(u, this.grad(this.p[AA + 1], x, y, z - 1), this.grad(this.p[BA + 1], x - 1, y, z - 1)),
                this.lerp(u, this.grad(this.p[AB + 1], x, y - 1, z - 1), this.grad(this.p[BB + 1], x - 1, y - 1, z - 1))
            )
        );
    }
    
    fade(t) {
        return t * t * t * (t * (t * 6 - 15) + 10);
    }
    
    lerp(t, a, b) {
        return a + t * (b - a);
    }
    
    grad(hash, x, y, z) {
        let h = hash & 15;
        let u = h < 8 ? x : y;
        let v = h < 4 ? y : h == 12 || h == 14 ? x : z;
        return ((h & 1) == 0 ? u : -u) + ((h & 2) == 0 ? v : -v);
    }
}

// Scene setup
const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 1000);
const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setSize(window.innerWidth, window.innerHeight);
document.body.appendChild(renderer.domElement);

camera.position.z = 0;

let composer = null;
let distortionPass = null;
if (typeof THREE.EffectComposer !== 'undefined' && typeof THREE.RenderPass !== 'undefined' && typeof THREE.ShaderPass !== 'undefined') {
    composer = new THREE.EffectComposer(renderer);
    const renderPass = new THREE.RenderPass(scene, camera);
    composer.addPass(renderPass);

    const distortionShader = {
        uniforms: {
            'tDiffuse': { value: null },
            'time': { value: 0 },
            'distortion': { value: 0.1 }
        },
        vertexShader: `
            varying vec2 vUv;
            void main() {
                vUv = uv;
                gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
            }
        `,
        fragmentShader: `
            uniform sampler2D tDiffuse;
            uniform float time;
            uniform float distortion;
            varying vec2 vUv;
            void main() {
                vec2 uv = vUv;
                uv += vec2(sin(uv.y * 10.0 + time) * distortion, cos(uv.x * 10.0 + time) * distortion);
                gl_FragColor = texture2D(tDiffuse, uv);
            }
        `
    };
    distortionPass = new THREE.ShaderPass(distortionShader);
    distortionPass.enabled = false;
    composer.addPass(distortionPass);
    composer.setSize(window.innerWidth, window.innerHeight); // Initialize size
}

// Perlin instance
const perlin = new Perlin();
let time = 0;
let isStarted = false;
let warpStart = -Infinity;

// Tunnel params
const TUBE_SEGMENTS = 70;
const TUBE_RADIUS = 0.02;
const POINTS_COUNT = 5;
let curvePoints = [];

for (let i = 0; i < POINTS_COUNT; i++) {
    curvePoints.push(new THREE.Vector3(0, 0, 2.5 * (i / (POINTS_COUNT - 1))));
}

let curve = new THREE.CatmullRomCurve3(curvePoints);

// Load cement texture
const loader = new THREE.TextureLoader();
const texture = loader.load('https://t3.ftcdn.net/jpg/03/44/99/56/360_F_344995605_ZYccAvf3Dq5oiO8VsCdfXQr4VCFWI2Ph.jpg');
texture.wrapS = THREE.RepeatWrapping;
texture.wrapT = THREE.RepeatWrapping;
texture.repeat.set(30, 6);

// Square shape for boxy tunnel
const shape = new THREE.Shape();
shape.moveTo(-TUBE_RADIUS, -TUBE_RADIUS);
shape.lineTo(TUBE_RADIUS, -TUBE_RADIUS);
shape.lineTo(TUBE_RADIUS, TUBE_RADIUS);
shape.lineTo(-TUBE_RADIUS, TUBE_RADIUS);
shape.lineTo(-TUBE_RADIUS, -TUBE_RADIUS);

// Extrude settings
const extrudeSettings = {
    steps: TUBE_SEGMENTS,
    bevelEnabled: false,
    extrudePath: curve
};

// Tube mesh
const tubeGeometry = new THREE.ExtrudeGeometry(shape, extrudeSettings);
const tubeMaterial = new THREE.MeshBasicMaterial({ map: texture, side: THREE.BackSide });
const tube = new THREE.Mesh(tubeGeometry, tubeMaterial);
scene.add(tube);

// Tesseract class
class Tesseract {
    constructor(size = 0.01, d = 2) {
        this.size = size;
        this.d = d;
        this.lines = new THREE.LineSegments(new THREE.BufferGeometry(), new THREE.LineBasicMaterial({color: 0x00ff00}));
        this.position = new THREE.Vector3(0, 0, 2.5); // Start far ahead
        this.lines.position.copy(this.position);
        this.updateProjection();
        scene.add(this.lines);
    }

    updateProjection() {
        const half = this.size / 2;
        const vertices4D = [];
        for (let x = -1; x <= 1; x += 2) {
            for (let y = -1; y <= 1; y += 2) {
                for (let z = -1; z <= 1; z += 2) {
                    for (let w = -1; w <= 1; w += 2) {
                        vertices4D.push(new THREE.Vector4(x * half, y * half, z * half, w * half));
                    }
                }
            }
        }

        const cos = Math.cos(time * 0.05);
        const sin = Math.sin(time * 0.05);
        vertices4D.forEach(v => {
            const x = v.x * cos - v.w * sin;
            const w = v.x * sin + v.w * cos;
            v.x = x;
            v.w = w;
        });

        const projected = vertices4D.map(v => {
            const scale = this.d / (this.d - v.w);
            return new THREE.Vector3(v.x * scale, v.y * scale, v.z * scale);
        });

        const indices = [];
        for (let i = 0; i < 16; i++) {
            for (let j = i + 1; j < 16; j++) {
                let diff = 0;
                const arrI = vertices4D[i].toArray();
                const arrJ = vertices4D[j].toArray();
                for (let k = 0; k < 4; k++) {
                    if (arrI[k] !== arrJ[k]) diff++;
                }
                if (diff === 1) indices.push(i, j);
            }
        }

        const geometry = new THREE.BufferGeometry();
        geometry.setAttribute('position', new THREE.Float32BufferAttribute(projected.flatMap(v => v.toArray()), 3));
        geometry.setIndex(indices);
        this.lines.geometry.dispose();
        this.lines.geometry = geometry;
    }
}

const tesseract = new Tesseract();

let speed = 0.005;
let mouse = { x: 0, y: 0 };
let lastBranchTime = 0;
const branchInterval = 4; // Every 4 seconds

// Mouse listener
document.addEventListener('mousemove', function(e) {
    mouse.x = (e.clientX / window.innerWidth) * 2 - 1;
    mouse.y = -(e.clientY / window.innerHeight) * 2 + 1;
});

// Click to start
const info = document.getElementById('info');
const audio = document.getElementById('bgMusic');

info.addEventListener('click', function() {
    audio.play().then(function() {
        console.log('Audio started successfully');
    }).catch(function(err) {
        console.log('Audio play failed:', err);
    });
    
    info.style.display = 'none';
    isStarted = true;
});

// Resize handler
window.addEventListener('resize', function() {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
    if (composer) composer.setSize(window.innerWidth, window.innerHeight);
});

// Animation loop
function animate() {
    requestAnimationFrame(animate);
    
    if (!isStarted) {
        if (composer) composer.render();
        else renderer.render(scene, camera);
        return;
    }
    
    time += 0.016; // Approximate delta for 60fps

    // Generative turns (enhanced for fractal feel)
    for (let i = 1; i < POINTS_COUNT - 1; i++) {
        const noiseX = perlin.noise(time * 0.01 + i * 0.1, 0, 0) * 0.2;
        const noiseY = perlin.noise(0, time * 0.01 + i * 0.1, 0) * 0.2;
        curvePoints[i].x = noiseX + mouse.x * 0.2 * (i / POINTS_COUNT);
        curvePoints[i].y = noiseY + mouse.y * 0.2 * (i / POINTS_COUNT);
    }

    // Discrete branch/turn every 4 seconds based on mouse
    if (time - lastBranchTime > branchInterval) {
        lastBranchTime = time;
        let branchOffsetX = 0;
        let branchOffsetY = 0;
        if (Math.abs(mouse.x) > Math.abs(mouse.y)) {
            if (mouse.x > 0.3) branchOffsetX = 0.5;
            else if (mouse.x < -0.3) branchOffsetX = -0.5;
        } else {
            if (mouse.y > 0.3) branchOffsetY = 0.5;
            else if (mouse.y < -0.3) branchOffsetY = -0.5;
        }
        for (let i = 1; i < POINTS_COUNT - 1; i++) {
            curvePoints[i].x += branchOffsetX * (Math.random() * 0.5 + 0.5);
            curvePoints[i].y += branchOffsetY * (Math.random() * 0.5 + 0.5);
        }
    }
    
    curve = new THREE.CatmullRomCurve3(curvePoints);
    tube.geometry.dispose();
    extrudeSettings.extrudePath = curve;
    tube.geometry = new THREE.ExtrudeGeometry(shape, extrudeSettings);

    // Flythrough
    texture.offset.x += speed;

    // Tesseract update and warp check
    tesseract.lines.position.z -= speed;
    if (tesseract.lines.position.z < -0.1) {
        tesseract.lines.position.z = 2.5;
    }
    tesseract.updateProjection();
    if (Math.abs(tesseract.lines.position.z) < 0.1 && time - warpStart > 2) {
        warpStart = time;
    }
    if (time - warpStart < 2 && composer && distortionPass) {
        distortionPass.enabled = true;
        distortionPass.uniforms.time.value = time * 5;
        distortionPass.uniforms.distortion.value = 0.1 * (1 - (time - warpStart) / 2);
    } else if (composer && distortionPass) {
        distortionPass.enabled = false;
    }

    if (composer) composer.render();
    else renderer.render(scene, camera);
}

animate();
