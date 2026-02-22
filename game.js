import * as THREE from 'three';
import { PointerLockControls } from 'three/addons/controls/PointerLockControls.js';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';

// --- SAVE SYSTEM ---
let balance = parseInt(localStorage.getItem('tycoon_money')) || 0;
let boughtItems = JSON.parse(localStorage.getItem('tycoon_items')) || [];
let globalMultiplier = 1;

function saveData() {
    localStorage.setItem('tycoon_money', balance);
    localStorage.setItem('tycoon_items', JSON.stringify(boughtItems));
    document.getElementById('money').innerText = balance;
}

// --- SHOP DATA ---
// UPDATED: Dropper4 and Upgrader4 now sit on z: -2.5 (The second lane!)
const shopItems = [
    { id: 'dropper1', name: 'Starter Dropper', cost: 0, type: 'dropper', val: 5, speed: 2000, modelUrl: 'models/dropper.glb', x: -5.5, y: 1.5, z: 0, req: null },
    { id: 'conveyor_rails', name: 'Conveyor Rails', cost: 25, type: 'deco', modelUrl: 'models/rails.glb', x: -1, y: 0.25, z: 0, req: 'dropper1' },
    { id: 'walls1', name: 'Factory Pillars', cost: 50, type: 'structure', req: 'conveyor_rails' },
    { id: 'upgrader1', name: 'Basic Scanner (x2)', cost: 100, type: 'upgrader', mult: 2, modelUrl: 'models/upgrader_basic.glb', x: -3.5, y: 0.5, z: 0, req: 'walls1' },
    { id: 'dropper2', name: 'Heavy Dropper', cost: 350, type: 'dropper', val: 20, speed: 1500, modelUrl: 'models/dropper_iron.glb', x: -2, y: 1.5, z: 0, req: 'upgrader1' },
    { id: 'lights1', name: 'Factory Lights', cost: 600, type: 'deco', req: 'dropper2' },
    { id: 'upgrader2', name: 'Plasma Gate (x3)', cost: 1200, type: 'upgrader', mult: 3, modelUrl: 'models/upgrader_plasma.glb', x: -0.5, y: 0.5, z: 0, req: 'lights1' },
    { id: 'walls2', name: 'Steel Walls', cost: 2500, type: 'structure', req: 'upgrader2' },
    { id: 'dropper3', name: 'Quantum Dropper', cost: 5000, type: 'dropper', val: 100, speed: 1000, x: 1, y: 1.5, z: 0, req: 'walls2' },
    { id: 'upgrader3', name: 'Antimatter Chamber (x5)', cost: 12000, type: 'upgrader', mult: 5, modelUrl: 'models/upgrader_antimatter.glb', x: 2.5, y: 0.5, z: 0, req: 'dropper3' },
    { id: 'roof', name: 'Glass Factory Roof', cost: 25000, type: 'structure', req: 'upgrader3' },
    
    // NEW COORDINATES AND COLORS FOR THE VOID LANE
    { id: 'dropper4', name: 'Void Extractor', cost: 50000, type: 'dropper', val: 500, speed: 500, x: -5, y: 1.5, z: -2.5, req: 'roof' },
    { id: 'upgrader4', name: 'The Singularity (x10)', cost: 100000, type: 'upgrader', mult: 10, color: 0xaa00ff, x: 2, y: 0.5, z: -2.5, req: 'dropper4' }
];

const moneyCubes = [];
const activeMachines = [];

// --- THREE.JS SETUP ---
const scene = new THREE.Scene();
scene.background = new THREE.Color(0x0a0a14);

const camera = new THREE.PerspectiveCamera(50, window.innerWidth / window.innerHeight, 0.1, 1000);
camera.position.set(0, 2, 8); 

const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
document.body.appendChild(renderer.domElement);

const controls = new PointerLockControls(camera, document.body);
scene.add(controls.getObject());

renderer.domElement.addEventListener('click', () => controls.lock());

const velocity = new THREE.Vector3();
const direction = new THREE.Vector3();
const moveState = { forward: false, backward: false, left: false, right: false, canJump: false };
let prevTime = performance.now();

document.addEventListener('keydown', (e) => {
    switch (e.code) {
        case 'KeyW': moveState.forward = true; break;
        case 'KeyA': moveState.left = true; break;
        case 'KeyS': moveState.backward = true; break;
        case 'KeyD': moveState.right = true; break;
        case 'Space': if (moveState.canJump) { velocity.y += 25; moveState.canJump = false; } break;
    }
});
document.addEventListener('keyup', (e) => {
    switch (e.code) {
        case 'KeyW': moveState.forward = false; break;
        case 'KeyA': moveState.left = false; break;
        case 'KeyS': moveState.backward = false; break;
        case 'KeyD': moveState.right = false; break;
    }
});

// --- LIGHTING ---
const ambientLight = new THREE.AmbientLight(0xffffff, 0.6);
scene.add(ambientLight);

const interiorLight = new THREE.DirectionalLight(0xffffff, 1.5);
interiorLight.position.set(5, 10, 5); 
interiorLight.target.position.set(0, 0, 0);
interiorLight.castShadow = true;
interiorLight.shadow.camera.left = -20; interiorLight.shadow.camera.right = 20;
interiorLight.shadow.camera.top = 20; interiorLight.shadow.camera.bottom = -20;
interiorLight.shadow.camera.near = 0.5; interiorLight.shadow.camera.far = 50;
interiorLight.shadow.mapSize.width = 2048; interiorLight.shadow.mapSize.height = 2048;
interiorLight.shadow.bias = -0.001; 
scene.add(interiorLight); scene.add(interiorLight.target);

// --- PROCEDURAL TEXTURES ---
function createProceduralTexture(type) {
    const canvas = document.createElement('canvas'); canvas.width = 256; canvas.height = 256; const ctx = canvas.getContext('2d');
    if (type === 'floor') {
        ctx.fillStyle = '#222'; ctx.fillRect(0, 0, 256, 256);
        ctx.fillStyle = '#2a2a2a'; ctx.fillRect(0, 0, 128, 128); ctx.fillRect(128, 128, 128, 128);
    } else if (type === 'wall') {
        ctx.fillStyle = '#3b4248'; ctx.fillRect(0, 0, 256, 256);
        ctx.fillStyle = '#2f353a'; for(let i=0; i<256; i+=32) { ctx.fillRect(i, 0, 4, 256); }
    }
    const tex = new THREE.CanvasTexture(canvas); tex.wrapS = THREE.RepeatWrapping; tex.wrapT = THREE.RepeatWrapping;
    if (type === 'floor') tex.repeat.set(20, 20); if (type === 'wall') tex.repeat.set(10, 2);
    return tex;
}

// --- FACTORY PROGRESSION ---
const factoryUpgrades = { walls1: new THREE.Group(), walls2: new THREE.Group(), roof: new THREE.Group() };
factoryUpgrades.walls1.visible = false; factoryUpgrades.walls2.visible = false; factoryUpgrades.roof.visible = false;
scene.add(factoryUpgrades.walls1); scene.add(factoryUpgrades.walls2); scene.add(factoryUpgrades.roof);

function buildFactoryEnvironment() {
    const floor = new THREE.Mesh(new THREE.BoxGeometry(40, 1, 40), new THREE.MeshStandardMaterial({ map: createProceduralTexture('floor'), roughness: 0.9, metalness: 0.1 }));
    floor.position.y = -0.5; floor.receiveShadow = true; scene.add(floor);

    const wallHeight = 12; const wallMat = new THREE.MeshStandardMaterial({ map: createProceduralTexture('wall'), roughness: 0.7, metalness: 0.4 });
    const pillarMat = new THREE.MeshStandardMaterial({ color: 0x111111, roughness: 0.5, metalness: 0.8 });
    [[-10,-10], [10,-10], [-10,10], [10,10], [-19,-19], [19,-19], [-19,19], [19,19]].forEach(pos => {
        const pillar = new THREE.Mesh(new THREE.BoxGeometry(1.5, wallHeight, 1.5), pillarMat); pillar.position.set(pos[0], wallHeight/2, pos[1]);
        pillar.castShadow = true; pillar.receiveShadow = true; factoryUpgrades.walls1.add(pillar);
    });

    const addWall = (w,h,d, x,y,z) => { const m = new THREE.Mesh(new THREE.BoxGeometry(w,h,d), wallMat); m.position.set(x,y,z); m.castShadow=true; m.receiveShadow=true; factoryUpgrades.walls2.add(m); };
    addWall(40, wallHeight, 1, 0, wallHeight/2, -19.5); addWall(1, wallHeight, 40, -19.5, wallHeight/2, 0); addWall(1, wallHeight, 40, 19.5, wallHeight/2, 0);
    addWall(15, wallHeight, 1, -12.5, wallHeight/2, 19.5); addWall(15, wallHeight, 1, 12.5, wallHeight/2, 19.5); addWall(10, 4, 1, 0, 10, 19.5);

    const roof = new THREE.Mesh(new THREE.BoxGeometry(40.5, 0.5, 40.5), new THREE.MeshStandardMaterial({ color: 0x88ccff, transparent: true, opacity: 0.2, roughness: 0.1, metalness: 0.9, side: THREE.DoubleSide }));
    roof.position.y = wallHeight + 0.25; factoryUpgrades.roof.add(roof);
}
buildFactoryEnvironment();

// --- GAME LOGIC MESHES ---
const conveyor = new THREE.Mesh(new THREE.BoxGeometry(10.5, 0.7, 1.3), new THREE.MeshStandardMaterial({ color: 0x111111, roughness: 1 }));
conveyor.position.set(-1, 0.07, 0); conveyor.receiveShadow = true; scene.add(conveyor);

// UPDATED: Collector is now much wider to catch both lanes!
const collectorMat = new THREE.MeshStandardMaterial({ color: 0xff2222, emissive: 0x550000, roughness: 0.2, metalness: 0.8 });
const collector = new THREE.Mesh(new THREE.BoxGeometry(1, 0.4, 4.5), collectorMat);
collector.position.set(4.75, 0.2, -1.25); // Center it between z:0 and z:-2.5
collector.receiveShadow = true; collector.castShadow = true; scene.add(collector);

const audioCtx = new (window.AudioContext || window.webkitAudioContext)();
function playCoinSound() {
    if (audioCtx.state === 'suspended') return;
    const osc = audioCtx.createOscillator(); const gain = audioCtx.createGain();
    osc.type = 'sine'; osc.frequency.setValueAtTime(1000, audioCtx.currentTime); osc.frequency.exponentialRampToValueAtTime(1500, audioCtx.currentTime + 0.1);
    gain.gain.setValueAtTime(0.05, audioCtx.currentTime); gain.gain.exponentialRampToValueAtTime(0.001, audioCtx.currentTime + 0.1);
    osc.connect(gain); gain.connect(audioCtx.destination); osc.start(); osc.stop(audioCtx.currentTime + 0.1);
}

function createFloatingText(amount, pos3D) {
    const vector = pos3D.clone().project(camera);
    const div = document.createElement('div'); div.className = 'floating-text'; div.innerText = `+$${amount}`;
    div.style.left = `${(vector.x * .5 + .5) * window.innerWidth}px`; div.style.top = `${(vector.y * -.5 + .5) * window.innerHeight}px`;
    document.body.appendChild(div); setTimeout(() => div.remove(), 1000);
}

// --- BUILDING LOGIC ---
let masterCoinModel = null;
const gltfLoader = new GLTFLoader();

gltfLoader.load('models/money_stack.glb', (gltf) => {
    masterCoinModel = gltf.scene;
    masterCoinModel.traverse((child) => { if (child.isMesh) { child.castShadow = true; child.receiveShadow = true; }});
}, undefined, (e) => console.warn("No money model found."));

function spawnMoney(machineData) {
    let coin;
    if (masterCoinModel) {
        coin = masterCoinModel.clone();
        coin.traverse((child) => { if (child.isMesh) { coin.scale.set(0.5, 0.5, 0.5); child.geometry.computeBoundingBox(); child.geometry.center(); }});
    } else {
        coin = new THREE.Mesh(new THREE.BoxGeometry(0.3, 0.3, 0.3), new THREE.MeshStandardMaterial({ color: 0x2ecc71 }));
        coin.scale.set(0.5, 0.5, 0.5); coin.geometry.computeBoundingBox(); coin.geometry.center();
    }
    coin.position.set(machineData.x, machineData.y - 0.8, machineData.z);
    coin.castShadow = true;
    // UPDATED: Tell the cube which Z-lane it belongs to!
    coin.userData = { value: machineData.val, upgradedBy: [], targetZ: machineData.z }; 
    scene.add(coin); moneyCubes.push(coin);
}

function createFallbackMesh(item) {
    let mesh; const baseMat = new THREE.MeshStandardMaterial({ color: item.color || 0x888888, metalness: 0.7, roughness: 0.3 });
    if (item.type === 'dropper') {
        mesh = new THREE.Mesh(new THREE.BoxGeometry(1.2, 2, 1.2), baseMat);
        const spout = new THREE.Mesh(new THREE.BoxGeometry(0.6, 0.5, 0.6), new THREE.MeshStandardMaterial({ color: 0x333333 }));
        spout.position.set(0, -1, 0); mesh.add(spout);
    } else if (item.type === 'upgrader') {
        mesh = new THREE.Mesh(new THREE.TorusGeometry(0.8, 0.2, 8, 20), new THREE.MeshStandardMaterial({ color: item.color || 0x00ffff, emissive: item.color || 0x00ffff, emissiveIntensity: 0.5, wireframe: true }));
        mesh.rotation.y = Math.PI / 2;
    } else { mesh = new THREE.Mesh(new THREE.BoxGeometry(2, 2, 2), baseMat); }
    mesh.position.set(item.x, item.y, item.z); mesh.castShadow = true; mesh.receiveShadow = true; return mesh;
}

function buildItem(item) {
    if (item.id === 'walls1') { factoryUpgrades.walls1.visible = true; return; }
    if (item.id === 'walls2') { factoryUpgrades.walls2.visible = true; return; }
    if (item.id === 'roof') { factoryUpgrades.roof.visible = true; return; }

    if (item.id === 'lights1') {
        const lightsGroup = new THREE.Group();
        const zPositions = [-8, 8]; const xPositions = [-12, -6, 0, 6, 12];
        const tubeMat = new THREE.MeshStandardMaterial({ emissive: 0xffffff, emissiveIntensity: 2, color: 0xffffff });
        const housingMat = new THREE.MeshStandardMaterial({ color: 0x222222, metalness: 0.8 });
        const ropeMat = new THREE.MeshStandardMaterial({ color: 0x111111, roughness: 0.9 }); 
        const tubeGeo = new THREE.CylinderGeometry(0.1, 0.1, 4, 8);
        const housingGeo = new THREE.BoxGeometry(4.2, 0.3, 0.6);
        const ropeGeo = new THREE.CylinderGeometry(0.02, 0.02, 3, 4);

        for (let r = 0; r < zPositions.length; r++) {
            for (let c = 0; c < xPositions.length; c++) {
                const fixture = new THREE.Group(); fixture.position.set(xPositions[c], 9, zPositions[r]); 
                const tube = new THREE.Mesh(tubeGeo, tubeMat); tube.rotation.z = Math.PI / 2; fixture.add(tube);
                const housing = new THREE.Mesh(housingGeo, housingMat); housing.position.y = 0.2; fixture.add(housing);
                const rope1 = new THREE.Mesh(ropeGeo, ropeMat); rope1.position.set(-1.8, 1.65, 0); fixture.add(rope1);
                const rope2 = new THREE.Mesh(ropeGeo, ropeMat); rope2.position.set(1.8, 1.65, 0); fixture.add(rope2);
                const light = new THREE.PointLight(0xffffee, 3, 20); light.position.y = -0.5; fixture.add(light);
                lightsGroup.add(fixture);
            }
        }
        scene.add(lightsGroup); return; 
    }

    if (item.id === 'dropper3') {
        gltfLoader.load('models/dropper.glb', (gltf) => {
            const model = gltf.scene;
            const canvas = document.createElement('canvas'); canvas.width = 512; canvas.height = 512; const ctx = canvas.getContext('2d');
            ctx.fillStyle = '#050810'; ctx.fillRect(0, 0, 512, 512); ctx.strokeStyle = '#00ffff'; ctx.shadowBlur = 15; ctx.shadowColor = '#00ffff'; ctx.lineWidth = 4;
            for (let x = 0; x <= 512; x += 64) {
                for (let y = 0; y <= 512; y += 64) {
                    ctx.globalAlpha = 0.2; ctx.strokeRect(x, y, 64, 64); ctx.globalAlpha = 1.0;
                    if ((x + y) % 128 === 0) { ctx.beginPath(); ctx.arc(x + 32, y + 32, 14, 0, Math.PI * 2); ctx.fillStyle = '#00ffff'; ctx.fill(); ctx.beginPath(); ctx.moveTo(x + 32, y + 32); ctx.lineTo(x + 64, y + 64); ctx.stroke(); } 
                    else if (Math.abs(x - y) % 128 === 0) { ctx.beginPath(); ctx.arc(x + 32, y + 32, 6, 0, Math.PI * 2); ctx.fillStyle = '#ffffff'; ctx.fill(); }
                }
            }
            const quantumTex = new THREE.CanvasTexture(canvas); quantumTex.wrapS = THREE.RepeatWrapping; quantumTex.wrapT = THREE.RepeatWrapping;
            quantumTex.repeat.set(3, 3); quantumTex.needsUpdate = true; quantumTex.colorSpace = THREE.SRGBColorSpace;
            const sciFiMat = new THREE.MeshStandardMaterial({ color: 0x11111a, metalness: 0.9, roughness: 0.2, map: quantumTex, emissiveMap: quantumTex, emissive: 0x00ffff, emissiveIntensity: 1.5 });
            model.position.set(item.x, item.y, item.z);
            model.traverse((child) => { if (child.isMesh) { child.castShadow = true; child.receiveShadow = true; child.material = sciFiMat; }});
            scene.add(model);
            const timerId = setInterval(() => spawnMoney(item), item.speed); activeMachines.push({ mesh: model, type: 'dropper', timer: timerId });
        }, undefined, (error) => { console.error("Failed to load base dropper.", error); });
        return; 
    }

    // --- NEW: THE VOID EXTRACTOR (Cube with glowing hole + new belt) ---
    // --- UPDATED: THE VOID EXTRACTOR (Archway / Doorway) ---
    if (item.id === 'dropper4') {
        const group = new THREE.Group();
        group.position.set(item.x, item.y, item.z);

        const mat = new THREE.MeshStandardMaterial({ color: 0x111115, metalness: 0.9, roughness: 0.2 });
        const glowMat = new THREE.MeshStandardMaterial({ color: 0xaa00ff, emissive: 0xaa00ff, emissiveIntensity: 3 });

        // The base of the group is at Y=1.5. The floor is at Y=-0.5. 
        // This means we need walls that go down exactly 2.0 units to touch the floor.
        const floorY = -0.25; // Center Y for a 3.5 tall box to touch the ground
        const wallHeight = 3.5;

        // 1. Left and Right Pillars (Going all the way to the floor)
        const left = new THREE.Mesh(new THREE.BoxGeometry(2.5, wallHeight, 0.5), mat);
        left.position.set(-0.25, floorY, -0.95);
        
        const right = new THREE.Mesh(new THREE.BoxGeometry(2.5, wallHeight, 0.5), mat);
        right.position.set(-0.25, floorY, 0.95);

        // 2. The Roof (Sitting on top of the pillars)
        const top = new THREE.Mesh(new THREE.BoxGeometry(2.5, 0.5, 2.4), mat);
        top.position.set(-0.25, 1.75, 0);

        // 3. The Solid Back Wall (Closing the machine from behind)
        const back = new THREE.Mesh(new THREE.BoxGeometry(0.5, 4.0, 2.4), mat);
        back.position.set(-1.25, 0, 0);

        // 4. The Neon Purple Archway Trim (Door frame)
        const trimL = new THREE.Mesh(new THREE.BoxGeometry(0.1, wallHeight, 0.1), glowMat);
        trimL.position.set(1.0, floorY, -0.7);
        
        const trimR = new THREE.Mesh(new THREE.BoxGeometry(0.1, wallHeight, 0.1), glowMat);
        trimR.position.set(1.0, floorY, 0.7);
        
        const trimTop = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.1, 1.5), glowMat);
        trimTop.position.set(1.0, 1.55, 0);

        // 5. The Pitch Black Void (Placed deep inside the archway)
        const voidPlane = new THREE.Mesh(new THREE.PlaneGeometry(1.4, wallHeight), new THREE.MeshBasicMaterial({ color: 0x000000 }));
        voidPlane.rotation.y = Math.PI / 2;
        voidPlane.position.set(-0.99, floorY, 0); 

        group.add(left, right, top, back, trimL, trimR, trimTop, voidPlane);
        group.traverse(c => { if(c.isMesh) { c.castShadow = true; c.receiveShadow = true; }});

        // 6. The 2nd Conveyor Belt (Tucked perfectly inside the void)
        const conveyor2 = new THREE.Mesh(new THREE.BoxGeometry(10.5, 0.7, 1.3), new THREE.MeshStandardMaterial({ color: 0x111111, roughness: 1 }));
        conveyor2.position.set(4, -1.43, 0); 
        conveyor2.receiveShadow = true;
        group.add(conveyor2);

        scene.add(group);
        const timerId = setInterval(() => spawnMoney(item), item.speed);
        activeMachines.push({ mesh: group, type: 'dropper', timer: timerId });
        return;
    }

    // --- UPDATED: THE SINGULARITY ---
    if (item.id === 'upgrader4') {
        const group = new THREE.Group();
        group.position.set(item.x, item.y, item.z);

        const coreMat = new THREE.MeshStandardMaterial({ color: 0x000000, emissive: 0xdd88ff, emissiveIntensity: 2, wireframe: true });
        const outerMat = new THREE.MeshStandardMaterial({ color: 0x111111, emissive: 0x7700ff, emissiveIntensity: 1, transparent: true, opacity: 0.8 });

        const spinnerGroup = new THREE.Group();
        // Lowered the center to exactly match the height of the money cubes
        spinnerGroup.position.y = 0.2; 
        
        for(let i=0; i<4; i++) {
            const angle = (i / 4) * Math.PI * 2;
            const objGroup = new THREE.Group();
            
            // MATH FIX: Plot the cubes in a circle around the Y and Z axes!
            objGroup.position.set(0, Math.cos(angle) * 1.5, Math.sin(angle) * 1.5);

            const innerCube = new THREE.Mesh(new THREE.BoxGeometry(0.4, 0.4, 0.4), coreMat);
            const outerCube = new THREE.Mesh(new THREE.BoxGeometry(0.6, 0.6, 0.6), outerMat);
            
            objGroup.add(innerCube, outerCube);
            objGroup.userData = { inner: innerCube, outer: outerCube };
            spinnerGroup.add(objGroup);
        }

        group.add(spinnerGroup);
        scene.add(group);
        
        activeMachines.push({ mesh: group, spinner: spinnerGroup, type: 'singularity', data: item });
        return;
    }

    const setupMachineLogic = (mesh) => {
        scene.add(mesh);
        if (item.type === 'dropper') {
            const timerId = setInterval(() => spawnMoney(item), item.speed);
            activeMachines.push({ mesh, type: 'dropper', timer: timerId });
        } else if (item.type === 'upgrader') {
            activeMachines.push({ mesh, type: 'upgrader', data: item });
        } else if (item.id === 'conveyor_rails') {
            mesh.scale.set(3.5, 2.5, 0.45); mesh.position.y = 0; 
        }
    };

    if (item.modelUrl) {
        gltfLoader.load(item.modelUrl, (gltf) => {
            const model = gltf.scene; model.position.set(item.x, item.y, item.z);
            model.traverse((child) => { if (child.isMesh) { child.castShadow = true; child.receiveShadow = true; }});
            setupMachineLogic(model);
        }, undefined, () => setupMachineLogic(createFallbackMesh(item)));
    } else { setupMachineLogic(createFallbackMesh(item)); }
}

function updateShopUI() {
    const container = document.getElementById('shop-items'); container.innerHTML = ''; let nextItemFound = false;
    for (const item of shopItems) {
        if (boughtItems.includes(item.id)) continue;
        if (item.req === null || boughtItems.includes(item.req)) {
            const btn = document.createElement('button'); btn.className = 'shop-btn';
            btn.innerHTML = `<span>${item.name}</span> <span class="price">$${item.cost}</span>`;
            if (balance < item.cost) btn.disabled = true;
            else {
                btn.onclick = () => {
                    if (audioCtx.state === 'suspended') audioCtx.resume();
                    balance -= item.cost; boughtItems.push(item.id); buildItem(item); saveData(); updateShopUI(); 
                };
            }
            container.appendChild(btn); nextItemFound = true; break; 
        }
    }
    if (!nextItemFound) container.innerHTML = '<div style="text-align:center; color:#888; padding: 20px;">All upgrades purchased!</div>';
}

document.getElementById('money').innerText = balance;
boughtItems.forEach(id => { const itemData = shopItems.find(i => i.id === id); if (itemData) buildItem(itemData); });
updateShopUI(); 

document.getElementById('resetBtn').onclick = () => { localStorage.clear(); location.reload(); };

const raycaster = new THREE.Raycaster(); const mouse = new THREE.Vector2();
window.addEventListener('pointerdown', () => {
    if (!controls.isLocked) return;
    mouse.x = 0; mouse.y = 0; raycaster.setFromCamera(mouse, camera);
    if (raycaster.intersectObject(collector).length > 0) {
        balance += globalMultiplier; saveData(); document.getElementById('money').innerText = balance;
        createFloatingText(globalMultiplier, collector.position); playCoinSound();
        collector.scale.set(1.4, 0.6, 1.4); updateShopUI();
    }
});

function animate() {
    requestAnimationFrame(animate);
    const time = performance.now();
    
    if (controls.isLocked) {
        const delta = (time - prevTime) / 1000;
        velocity.x -= velocity.x * 10.0 * delta; velocity.z -= velocity.z * 10.0 * delta; velocity.y -= 9.8 * 10.0 * delta; 
        direction.z = Number(moveState.forward) - Number(moveState.backward); direction.x = Number(moveState.right) - Number(moveState.left); direction.normalize(); 
        if (moveState.forward || moveState.backward) velocity.z -= direction.z * 40.0 * delta;
        if (moveState.left || moveState.right) velocity.x -= direction.x * 40.0 * delta;
        controls.moveRight(-velocity.x * delta); controls.moveForward(-velocity.z * delta);
        controls.getObject().position.y += (velocity.y * delta);

        const pos = controls.getObject().position;
        if (pos.y < 2) { velocity.y = 0; pos.y = 2; moveState.canJump = true; }
        const limit = 18.5; 
        if (pos.x < -limit) { pos.x = -limit; velocity.x = 0; }
        if (pos.x > limit) { pos.x = limit; velocity.x = 0; }
        if (pos.z < -limit) { pos.z = -limit; velocity.z = 0; }
        if (pos.z > limit) {
            if (pos.x < -4 || pos.x > 4) { pos.z = limit; velocity.z = 0; } 
            else if (pos.z > 30) { pos.z = 30; velocity.z = 0; }
        }
    }
    prevTime = time;

    // UPDATED: Animate the Singularity
    // UPDATED: Animate the Singularity
    activeMachines.forEach(mach => { 
        if (mach.type === 'upgrader') mach.mesh.rotation.x += 0.02; 
        if (mach.type === 'singularity') {
            mach.spinner.rotation.x -= 0.03;
            mach.spinner.children.forEach(obj => {
                // Spin the individual cubes
                obj.userData.inner.rotation.x += 0.05; obj.userData.inner.rotation.y += 0.05;
                obj.userData.outer.rotation.x -= 0.02; obj.userData.outer.rotation.y -= 0.02;
            });
        }
    });

    collector.scale.lerp(new THREE.Vector3(1, 1, 1), 0.1);

    for (let i = moneyCubes.length - 1; i >= 0; i--) {
        const cube = moneyCubes[i]; 
        
        // Move towards the collector
        if (cube.position.x < collector.position.x) cube.position.x += 0.05;
        
        // UPDATED: Keep the cube exactly in the lane it spawned in!
        if (cube.position.z > cube.userData.targetZ + 0.05) cube.position.z -= 0.02;
        else if (cube.position.z < cube.userData.targetZ - 0.05) cube.position.z += 0.02;
        
        cube.rotation.y += 0.02;

        activeMachines.forEach(mach => {
            // Check upgrades (Both normal and singularity)
            if ((mach.type === 'upgrader' || mach.type === 'singularity') && !cube.userData.upgradedBy.includes(mach.data.id)) {
                // Ensure the machine and cube are in the same lane using Z!
                if (Math.abs(cube.position.x - mach.mesh.position.x) < 0.4 && Math.abs(cube.position.z - mach.mesh.position.z) < 0.5) {
                    cube.userData.value *= mach.data.mult; 
                    cube.userData.upgradedBy.push(mach.data.id);
                    
                    const glowColor = mach.data.color || 0x00ffff;
                    cube.traverse((child) => {
                        if (child.isMesh) {
                            const makeGlow = (mat) => { const n = mat.clone(); n.emissive.setHex(glowColor); n.emissiveIntensity = 0.5; return n; };
                            child.material = Array.isArray(child.material) ? child.material.map(makeGlow) : makeGlow(child.material);
                        }
                    });
                }
            }
        });

        // Collect the money
        if (Math.abs(cube.position.x - collector.position.x) < 0.5 && Math.abs(cube.position.z - collector.position.z) < 2) {
            balance += cube.userData.value * globalMultiplier;
            createFloatingText(cube.userData.value * globalMultiplier, cube.position);
            playCoinSound(); collector.scale.set(1.4, 0.6, 1.4);
            scene.remove(cube); moneyCubes.splice(i, 1);
            saveData(); updateShopUI();
        }
    }
    renderer.render(scene, camera);
}

animate();

window.addEventListener('resize', () => {
    camera.aspect = window.innerWidth / window.innerHeight; camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
});