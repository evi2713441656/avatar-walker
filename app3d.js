import * as THREE from 'https://unpkg.com/three@0.179.1/build/three.module.js';

const $ = (id) => document.getElementById(id);
const rad = THREE.MathUtils.degToRad;

const CYCLE = 1.05;
const THIGH = 1.72;
const SHIN = 2.2;
const BASE_HIP_Y = 4.02;
const STORAGE_KEY = 'motion-character-3d';

// These are the tuned gait keys from the original app.js, unchanged.
const KEYS = {
  thigh: [[0, 24], [0.15, 19], [0.30, 4], [0.45, -12], [0.55, -20], [0.72, -8], [0.88, 20], [1, 24]],
  knee: [[0, -5], [0.15, -2], [0.30, 0], [0.45, -10], [0.55, -55], [0.72, -48], [0.88, -12], [1, -5]],
  foot: [[0, -5], [0.15, 0], [0.30, 0], [0.45, 18], [0.55, 14], [0.70, 10], [0.82, 2], [0.92, -8], [1, -5]],
};

const DATA = {
  hair: {
    short: { name: '层次短发' }, long: { name: '柔顺长发' }, curly: { name: '侧分波波头' },
    pony: { name: '高马尾' }, buzz: { name: '利落寸头' }, bun: { name: '丸子头' },
  },
  top: {
    tshirt: { name: '落肩T恤', color: '#e76549' }, suit: { name: '廓形西装', color: '#34414c' },
    hoodie: { name: '连帽卫衣', color: '#67a174' }, cardigan: { name: '学院开衫', color: '#7b678f' },
    jacket: { name: '机能夹克', color: '#55789b' },
  },
  bottom: {
    pants: { name: '直筒长裤', color: '#45546b' }, shorts: { name: '休闲短裤', color: '#c9825b' },
    skirt: { name: '百褶短裙', color: '#ad607c' }, sweatpants: { name: '束脚运动裤', color: '#596371' },
  },
  shoes: {
    sneakers: { name: '厚底球鞋', color: '#f2f0e9', sole: '#d8ff4f' }, boots: { name: '高帮帆布鞋', color: '#465b78', sole: '#f0eee8' },
    leather: { name: '德比皮鞋', color: '#292a2c', sole: '#151515' }, sandals: { name: '运动凉鞋', color: '#b9895c', sole: '#383733' },
  },
  face: {
    happy: { name: '开心' }, calm: { name: '松弛' }, cool: { name: '酷感' }, wink: { name: '眨眼' }, laugh: { name: '笑眯眼' },
  },
};

const SKINS = ['#f6d2b8', '#e8b98f', '#c8875d', '#8d5c43'];
const HAIR_COLORS = ['#24252a', '#573b2e', '#a94b32', '#c89b43', '#725b9d', '#ded7cc'];
const DEFAULT_CONFIG = { hair: 'short', top: 'tshirt', bottom: 'pants', shoes: 'sneakers', face: 'happy', skin: SKINS[1], hairColor: HAIR_COLORS[1] };

const config = loadConfig();
let paused = false;
let speed = 1;
let elapsed = 0;
let lastTime = performance.now();
let pointerYaw = 0;
let pointerTarget = 0;
let previewBackup = null;
let dragState = null;
let dragGhost = null;

function loadConfig() {
  try {
    const saved = JSON.parse(localStorage.getItem(STORAGE_KEY));
    if (saved && Object.keys(DEFAULT_CONFIG).every((key) => saved[key])) {
      const next = { ...DEFAULT_CONFIG, ...saved };
      Object.keys(DATA).forEach((kind) => { if (!DATA[kind][next[kind]]) next[kind] = DEFAULT_CONFIG[kind]; });
      if (!SKINS.includes(next.skin)) next.skin = DEFAULT_CONFIG.skin;
      if (!HAIR_COLORS.includes(next.hairColor)) next.hairColor = DEFAULT_CONFIG.hairColor;
      return next;
    }
  } catch (_) { /* Local storage is optional. */ }
  return { ...DEFAULT_CONFIG };
}

function saveConfig() {
  try { localStorage.setItem(STORAGE_KEY, JSON.stringify(config)); } catch (_) { /* Local storage is optional. */ }
}

function previewOption(kind, key) {
  if (!previewBackup) previewBackup = { ...config };
  config[kind] = key;
  applyConfig();
}

function clearPreview() {
  if (!previewBackup) return;
  Object.assign(config, previewBackup);
  previewBackup = null;
  applyConfig();
}

function commitOption(kind, key) {
  previewBackup = null;
  config[kind] = key;
  saveConfig();
  applyConfig();
}

function sample(keys, phase) {
  let i = 0;
  while (i < keys.length - 2 && phase > keys[i + 1][0]) i++;
  const [p0, v0] = keys[i];
  const [p1, v1] = keys[i + 1];
  const t = (phase - p0) / (p1 - p0);
  const eased = (1 - Math.cos(Math.PI * t)) / 2;
  return THREE.MathUtils.lerp(v0, v1, eased);
}

function stanceWeight(phase) {
  if (phase <= 0.45) return 1;
  if (phase <= 0.50) return (0.50 - phase) / 0.05;
  if (phase >= 0.96) return (phase - 0.96) / 0.04;
  return 0;
}

function legTargets(phase) {
  const thigh = sample(KEYS.thigh, phase);
  return { thigh, shin: thigh + sample(KEYS.knee, phase), foot: sample(KEYS.foot, phase) };
}

function createMaterial(color, options = {}) {
  return new THREE.MeshPhysicalMaterial({
    color,
    roughness: options.roughness ?? 0.58,
    metalness: options.metalness ?? 0,
    clearcoat: options.clearcoat ?? 0.08,
    clearcoatRoughness: 0.72,
    sheen: options.sheen ?? 0.12,
    sheenRoughness: 0.8,
    side: THREE.DoubleSide,
  });
}

function mesh(geometry, material, position = [0, 0, 0], scale = [1, 1, 1]) {
  const item = new THREE.Mesh(geometry, material);
  item.position.set(...position);
  item.scale.set(...scale);
  item.castShadow = true;
  item.receiveShadow = true;
  return item;
}

function capsule(radius, length, material) {
  return mesh(new THREE.CapsuleGeometry(radius, Math.max(0.02, length - radius * 2), 8, 20), material);
}

function roundedBody(radiusTop, radiusBottom, height, material, segments = 32) {
  const points = [];
  for (let i = 0; i <= 12; i++) {
    const y = -height / 2 + (height * i) / 12;
    const t = i / 12;
    const bulge = Math.sin(Math.PI * t) * 0.06;
    points.push(new THREE.Vector2(THREE.MathUtils.lerp(radiusBottom, radiusTop, t) + bulge, y));
  }
  return mesh(new THREE.LatheGeometry(points, segments), material);
}

const stage = $('stage');
const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(37, 1, 0.1, 100);
camera.position.set(3.85, 3.55, 14.1);
camera.lookAt(0, 3.85, 0);

const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true, preserveDrawingBuffer: true, powerPreference: 'high-performance' });
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
renderer.setClearColor(0x000000, 0);
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.08;
stage.appendChild(renderer.domElement);

const hemi = new THREE.HemisphereLight(0xe9fff9, 0x746b61, 2.15);
scene.add(hemi);
const keyLight = new THREE.DirectionalLight(0xfff2df, 4.2);
keyLight.position.set(-4.5, 8, 7);
keyLight.castShadow = true;
keyLight.shadow.mapSize.set(2048, 2048);
keyLight.shadow.camera.left = -5;
keyLight.shadow.camera.right = 5;
keyLight.shadow.camera.top = 8;
keyLight.shadow.camera.bottom = -2;
keyLight.shadow.bias = -0.0004;
scene.add(keyLight);
const rimLight = new THREE.DirectionalLight(0xa7c9ff, 2.2);
rimLight.position.set(5, 5, -5);
scene.add(rimLight);

const floor = mesh(new THREE.CircleGeometry(4.2, 64), new THREE.ShadowMaterial({ color: 0x425c57, opacity: 0.2 }), [0, -0.06, 0]);
floor.rotation.x = -Math.PI / 2;
floor.receiveShadow = true;
floor.castShadow = false;
scene.add(floor);

const mats = {
  skin: createMaterial(config.skin, { roughness: 0.62, sheen: 0.25 }),
  hair: createMaterial(config.hairColor, { roughness: 0.42, sheen: 0.5 }),
  top: createMaterial(DATA.top[config.top].color, { roughness: 0.72, sheen: 0.35 }),
  bottom: createMaterial(DATA.bottom[config.bottom].color, { roughness: 0.78 }),
  shoe: createMaterial(DATA.shoes[config.shoes].color, { roughness: 0.5 }),
  sole: createMaterial(DATA.shoes[config.shoes].sole, { roughness: 0.82 }),
  dark: createMaterial('#242526', { roughness: 0.48 }),
  white: createMaterial('#faf8f2', { roughness: 0.48 }),
  mouth: createMaterial('#8e3f42', { roughness: 0.7 }),
  blush: new THREE.MeshBasicMaterial({ color: '#e98d87', transparent: true, opacity: 0.32, side: THREE.DoubleSide }),
};

const rig = buildCharacter();
scene.add(rig.root);
applyConfig();
buildPanel();
bindControls();
resize();
new ResizeObserver(resize).observe(stage);
requestAnimationFrame(frame);

function buildCharacter() {
  const root = new THREE.Group();
  root.position.y = BASE_HIP_Y;
  root.rotation.y = -0.05;

  const body = new THREE.Group();
  root.add(body);

  const pelvis = roundedBody(0.63, 0.68, 0.72, mats.bottom);
  pelvis.position.y = 0.08;
  pelvis.scale.z = 0.72;
  body.add(pelvis);

  const torso = new THREE.Group();
  torso.position.y = 0.34;
  body.add(torso);

  const topStyles = buildTopSilhouettes(torso);
  const torsoCore = topStyles.tshirt.children[0];

  const topDetails = new THREE.Group();
  topDetails.position.y = 0.02;
  topDetails.scale.y = 0.84;
  torso.add(topDetails);
  buildTopDetails(topDetails);

  const neck = capsule(0.25, 0.52, mats.skin);
  neck.position.y = 2.03;
  torso.add(neck);

  const headPivot = new THREE.Group();
  headPivot.position.y = 2.87;
  torso.add(headPivot);

  const head = mesh(new THREE.SphereGeometry(0.92, 40, 32), mats.skin, [0, 0, 0], [0.88, 1.05, 0.92]);
  headPivot.add(head);

  const leftEar = mesh(new THREE.SphereGeometry(0.19, 20, 16), mats.skin, [-0.79, -0.02, 0], [0.62, 1, 0.55]);
  const rightEar = leftEar.clone();
  rightEar.position.x = 0.79;
  headPivot.add(leftEar, rightEar);

  const faceGroup = new THREE.Group();
  faceGroup.position.z = 0.84;
  headPivot.add(faceGroup);
  const expressions = buildFace(faceGroup);

  const hairGroup = new THREE.Group();
  headPivot.add(hairGroup);
  const hairstyles = buildHair(hairGroup);

  const leftLeg = buildLeg(-0.37);
  const rightLeg = buildLeg(0.37);
  body.add(leftLeg.hip, rightLeg.hip);

  const leftArm = buildArm(-0.79);
  const rightArm = buildArm(0.79);
  torso.add(leftArm.shoulder, rightArm.shoulder);

  return { root, body, pelvis, torso, torsoCore, topStyles, topDetails, headPivot, hairstyles, expressions, leftLeg, rightLeg, leftArm, rightArm };
}

function buildTopSilhouettes(parent) {
  const specs = {
    tshirt: { top: 0.8, bottom: 0.64, height: 1.78, y: 0.92, depth: 0.69 },
    suit: { top: 0.88, bottom: 0.67, height: 1.96, y: 0.94, depth: 0.73 },
    hoodie: { top: 0.88, bottom: 0.73, height: 2.02, y: 0.93, depth: 0.77 },
    cardigan: { top: 0.84, bottom: 0.68, height: 1.9, y: 0.93, depth: 0.73 },
    jacket: { top: 0.89, bottom: 0.72, height: 1.86, y: 0.99, depth: 0.76 },
  };
  const styles = {};
  Object.entries(specs).forEach(([key, spec]) => {
    const group = new THREE.Group();
    group.name = `top-${key}`;
    group.visible = false;
    const body = roundedBody(spec.top, spec.bottom, spec.height, mats.top);
    body.position.y = spec.y;
    body.scale.z = spec.depth;
    group.add(body);

    if (key === 'suit' || key === 'jacket') {
      const hem = mesh(new THREE.TorusGeometry(spec.bottom * 0.86, 0.045, 8, 36), mats.top, [0, spec.y - spec.height / 2 + 0.08, 0], [1, 1, spec.depth]);
      hem.rotation.x = Math.PI / 2;
      group.add(hem);
    }
    if (key === 'cardigan' || key === 'hoodie') {
      const cuff = mesh(new THREE.TorusGeometry(spec.bottom * 0.84, 0.055, 8, 36), mats.top, [0, spec.y - spec.height / 2 + 0.1, 0], [1, 1, spec.depth]);
      cuff.rotation.x = Math.PI / 2;
      group.add(cuff);
    }
    parent.add(group);
    styles[key] = group;
  });
  return styles;
}

function buildLeg(x) {
  const hip = new THREE.Group();
  hip.position.set(x, 0.12, 0);

  const upper = capsule(0.3, THIGH + 0.12, mats.bottom);
  upper.position.y = -THIGH / 2 + 0.03;
  upper.scale.z = 0.88;
  hip.add(upper);

  const shorts = capsule(0.335, 0.92, mats.bottom);
  shorts.position.y = -0.42;
  shorts.scale.z = 0.93;
  shorts.visible = false;
  hip.add(shorts);

  const knee = new THREE.Group();
  knee.position.y = -THIGH;
  hip.add(knee);

  const lower = capsule(0.275, SHIN + 0.18, mats.bottom);
  lower.position.y = -SHIN / 2 + 0.07;
  lower.scale.z = 0.88;
  knee.add(lower);

  const foot = new THREE.Group();
  foot.position.y = -SHIN;
  knee.add(foot);

  const shoeGroups = buildShoes(foot);
  return { hip, upper, shorts, knee, lower, foot, shoeGroups };
}

function buildShoes(parent) {
  const groups = {};
  Object.keys(DATA.shoes).forEach((key) => {
    const group = new THREE.Group();
    group.visible = false;
    parent.add(group);
    groups[key] = group;

    if (key === 'sneakers') {
      const upper = mesh(new THREE.CapsuleGeometry(0.28, 0.5, 6, 18), mats.shoe, [0, -0.12, 0.29], [1, 0.65, 1.38]);
      upper.rotation.x = Math.PI / 2;
      const sole = mesh(new THREE.BoxGeometry(0.61, 0.11, 0.96, 4, 2, 4), mats.sole, [0, -0.31, 0.29]);
      const lace = mesh(new THREE.BoxGeometry(0.32, 0.025, 0.32), mats.white, [0, 0.01, 0.39]);
      lace.rotation.x = -0.18;
      group.add(upper, sole, lace);
    } else if (key === 'boots') {
      const shaft = capsule(0.285, 0.62, mats.shoe);
      shaft.position.y = -0.03;
      shaft.scale.z = 0.9;
      const toe = mesh(new THREE.CapsuleGeometry(0.29, 0.46, 6, 18), mats.shoe, [0, -0.3, 0.31], [1, 0.64, 1.32]);
      toe.rotation.x = Math.PI / 2;
      const sole = mesh(new THREE.BoxGeometry(0.63, 0.11, 0.98), mats.sole, [0, -0.45, 0.31]);
      const toeCap = mesh(new THREE.SphereGeometry(0.2, 20, 14), mats.sole, [0, -0.25, 0.72], [1.15, 0.55, 0.72]);
      const lace1 = mesh(new THREE.BoxGeometry(0.31, 0.02, 0.025), mats.sole, [0, 0.08, 0.29]);
      const lace2 = lace1.clone(); lace2.position.y = -0.05;
      const lace3 = lace1.clone(); lace3.position.y = -0.18;
      group.add(shaft, toe, sole, toeCap, lace1, lace2, lace3);
    } else if (key === 'leather') {
      const upper = mesh(new THREE.CapsuleGeometry(0.3, 0.55, 6, 18), mats.shoe, [0, -0.24, 0.36], [1.05, 0.68, 1.45]);
      upper.rotation.x = Math.PI / 2;
      const sole = mesh(new THREE.BoxGeometry(0.68, 0.12, 1.12), mats.sole, [0, -0.42, 0.36]);
      group.add(upper, sole);
    } else {
      const sole = mesh(new THREE.BoxGeometry(0.67, 0.13, 1.08), mats.sole, [0, -0.38, 0.34]);
      const strap = mesh(new THREE.TorusGeometry(0.27, 0.09, 10, 24, Math.PI), mats.shoe, [0, -0.1, 0.38], [1, 1.2, 1]);
      strap.rotation.set(Math.PI / 2, 0, 0);
      group.add(sole, strap);
    }
  });
  return groups;
}

function buildArm(x) {
  const shoulder = new THREE.Group();
  shoulder.position.set(x, 1.69, 0);

  const upper = capsule(0.245, 1.34, mats.top);
  upper.position.y = -0.65;
  shoulder.add(upper);

  const elbow = new THREE.Group();
  elbow.position.y = -1.3;
  shoulder.add(elbow);

  const forearm = capsule(0.205, 1.28, mats.skin);
  forearm.position.y = -0.62;
  elbow.add(forearm);

  const hand = capsule(0.225, 0.52, mats.skin);
  hand.position.y = -1.28;
  hand.scale.z = 0.72;
  elbow.add(hand);
  return { shoulder, upper, elbow, forearm, hand };
}

function buildTopDetails(group) {
  const dark = mats.dark;
  const light = mats.white;
  const collar = mesh(new THREE.TorusGeometry(0.27, 0.045, 10, 32, Math.PI * 1.55), light, [0, 2.12, 0.51]);
  collar.rotation.set(Math.PI / 2, 0, -Math.PI * 0.77);
  collar.name = 'disabled-collar';
  collar.castShadow = false;
  group.add(collar);

  const lapelL = mesh(new THREE.BoxGeometry(0.24, 0.82, 0.05), light, [-0.21, 1.78, 0.68]);
  lapelL.rotation.z = -0.38;
  lapelL.name = 'suit';
  const lapelR = lapelL.clone();
  lapelR.position.x = 0.21;
  lapelR.rotation.z = 0.38;
  lapelR.name = 'suit';
  const button1 = mesh(new THREE.SphereGeometry(0.055, 14, 10), dark, [0, 1.38, 0.7]);
  button1.name = 'suit';
  const button2 = button1.clone(); button2.position.y = 1.13; button2.name = 'suit';
  group.add(lapelL, lapelR, button1, button2);

  const hood = mesh(new THREE.TorusGeometry(0.62, 0.19, 12, 40, Math.PI * 1.55), mats.top, [0, 2.15, -0.12]);
  hood.rotation.x = Math.PI / 2;
  hood.rotation.z = -Math.PI * 0.78;
  hood.name = 'hoodie';
  const pocket = mesh(new THREE.BoxGeometry(0.82, 0.34, 0.08), mats.top, [0, 0.72, 0.67]);
  pocket.name = 'hoodie';
  const drawstringL = capsule(0.018, 0.44, mats.white);
  drawstringL.position.set(-0.14, 1.72, 0.68);
  drawstringL.name = 'hoodie';
  const drawstringR = drawstringL.clone();
  drawstringR.position.x = 0.14;
  drawstringR.name = 'hoodie';
  group.add(hood, pocket, drawstringL, drawstringR);

  const trimL = mesh(new THREE.BoxGeometry(0.1, 1.58, 0.045), light, [-0.085, 1.13, 0.66]);
  trimL.rotation.z = -0.035;
  trimL.name = 'cardigan';
  const trimR = trimL.clone(); trimR.position.x = 0.085; trimR.rotation.z = 0.035; trimR.name = 'cardigan';
  const collarL = mesh(new THREE.BoxGeometry(0.13, 0.68, 0.05), light, [-0.2, 1.82, 0.67]);
  collarL.rotation.z = -0.52; collarL.name = 'cardigan';
  const collarR = collarL.clone(); collarR.position.x = 0.2; collarR.rotation.z = 0.52; collarR.name = 'cardigan';
  group.add(trimL, trimR, collarL, collarR);
  for (let i = 0; i < 4; i++) {
    const button = mesh(new THREE.SphereGeometry(0.04, 12, 8), dark, [0, 1.42 - i * 0.28, 0.7]);
    button.name = 'cardigan';
    group.add(button);
  }

  const zipper = mesh(new THREE.BoxGeometry(0.035, 1.7, 0.04), light, [0, 1.22, 0.69]);
  zipper.name = 'jacket';
  const pocketL = mesh(new THREE.BoxGeometry(0.34, 0.035, 0.04), dark, [-0.36, 0.92, 0.69]);
  pocketL.rotation.z = 0.22; pocketL.name = 'jacket';
  const pocketR = pocketL.clone(); pocketR.position.x = 0.36; pocketR.rotation.z = -0.22; pocketR.name = 'jacket';
  group.add(zipper, pocketL, pocketR);
}

function buildFace(group) {
  const all = {};
  Object.keys(DATA.face).forEach((key) => {
    const expression = new THREE.Group();
    expression.name = key;
    group.add(expression);
    all[key] = expression;

    const eyeY = 0.16;
    const eyeL = mesh(new THREE.SphereGeometry(0.125, 20, 14), mats.white, [-0.27, eyeY, 0], [0.84, 1, 0.42]);
    const eyeR = eyeL.clone(); eyeR.position.x = 0.28;
    const pupilL = mesh(new THREE.SphereGeometry(0.058, 18, 12), mats.dark, [-0.255, eyeY, 0.075], [0.8, 1, 0.42]);
    const pupilR = pupilL.clone(); pupilR.position.x = 0.295;
    const glintL = mesh(new THREE.SphereGeometry(0.014, 10, 8), mats.white, [-0.238, eyeY + 0.027, 0.1]);
    const glintR = glintL.clone(); glintR.position.x = 0.312;
    expression.add(eyeL, eyeR, pupilL, pupilR, glintL, glintR);

    const browL = mesh(new THREE.BoxGeometry(0.19, 0.028, 0.03), mats.dark, [-0.27, 0.36, -0.01]);
    const browR = browL.clone(); browR.position.x = 0.28;
    expression.add(browL, browR);

    if (key === 'wink') {
      eyeR.scale.y = 0.12;
      eyeR.rotation.z = -0.15;
      pupilR.visible = false;
      glintR.visible = false;
    }
    if (key === 'laugh') {
      eyeL.material = mats.dark;
      eyeR.material = mats.dark;
      eyeL.scale.y = 0.1;
      eyeR.scale.y = 0.1;
      pupilL.visible = false;
      pupilR.visible = false;
      glintL.visible = false;
      glintR.visible = false;
    }
    if (key === 'cool') {
      browL.rotation.z = -0.18;
      browR.rotation.z = 0.18;
      const glasses = mesh(new THREE.BoxGeometry(0.72, 0.22, 0.04), new THREE.MeshPhysicalMaterial({ color: 0x24282b, roughness: 0.18, metalness: 0.35, transparent: true, opacity: 0.86 }), [0, 0.15, 0.05]);
      expression.add(glasses);
    }

    const mouth = createMouth(key);
    expression.add(mouth);

    const nose = mesh(new THREE.SphereGeometry(0.07, 16, 10), mats.skin, [0.03, -0.04, 0.07], [0.75, 1, 0.6]);
    expression.add(nose);

    if (key === 'happy' || key === 'wink' || key === 'laugh') {
      const blushL = mesh(new THREE.CircleGeometry(0.13, 24), mats.blush, [-0.46, -0.1, -0.012], [1.25, 0.62, 1]);
      const blushR = blushL.clone(); blushR.position.x = 0.46;
      expression.add(blushL, blushR);
    }
  });
  return all;
}

function createMouth(key) {
  if (key === 'laugh') {
    const curve = new THREE.QuadraticBezierCurve3(
      new THREE.Vector3(-0.1, -0.2, 0.03),
      new THREE.Vector3(0, -0.285, 0.045),
      new THREE.Vector3(0.1, -0.2, 0.03),
    );
    return mesh(new THREE.TubeGeometry(curve, 18, 0.012, 8, false), mats.mouth);
  }
  if (key === 'calm' || key === 'cool') {
    const line = mesh(new THREE.BoxGeometry(key === 'cool' ? 0.105 : 0.085, 0.014, 0.014), mats.dark, [0, -0.22, 0.03]);
    line.rotation.z = key === 'cool' ? -0.08 : 0;
    return line;
  }
  const curve = new THREE.QuadraticBezierCurve3(
    new THREE.Vector3(-0.078, -0.205, 0.03),
    new THREE.Vector3(0, -0.258, 0.042),
    new THREE.Vector3(0.078, -0.205, 0.03),
  );
  return mesh(new THREE.TubeGeometry(curve, 18, 0.01, 8, false), mats.dark);
}

function buildHair(parent) {
  const all = {};
  Object.keys(DATA.hair).forEach((key) => {
    const group = new THREE.Group();
    group.name = key;
    group.visible = false;
    parent.add(group);
    all[key] = group;

    const cap = mesh(new THREE.SphereGeometry(0.98, 36, 24, 0, Math.PI * 2, 0, Math.PI * 0.41), mats.hair, [0, 0.08, -0.015], [0.92, 1.08, 1.01]);
    group.add(cap);

    if (key === 'buzz') {
      cap.geometry.dispose();
      cap.geometry = new THREE.SphereGeometry(0.965, 36, 22, 0, Math.PI * 2, 0, Math.PI * 0.34);
      cap.scale.set(0.91, 1.04, 0.99);
      return;
    }

    if (key === 'short') cap.rotation.z = -0.075;

    if (key === 'long') {
      [-0.62, -0.34, 0.34, 0.62].forEach((x) => {
        const lock = capsule(0.24, 1.62 - Math.abs(x) * 0.25, mats.hair);
        lock.position.set(x, -0.5, -0.18);
        lock.rotation.z = x * 0.12;
        group.add(lock);
      });
    }

    if (key === 'curly') {
      cap.rotation.z = 0.055;
      const back = mesh(new THREE.SphereGeometry(1, 28, 20), mats.hair, [0, -0.16, -0.34], [0.78, 0.82, 0.34]);
      const sideL = mesh(new THREE.SphereGeometry(1, 24, 18), mats.hair, [-0.66, -0.1, -0.02], [0.25, 0.68, 0.3]);
      sideL.rotation.z = -0.08;
      const sideR = mesh(new THREE.SphereGeometry(1, 24, 18), mats.hair, [0.66, -0.08, -0.02], [0.25, 0.65, 0.3]);
      sideR.rotation.z = 0.08;
      group.add(back, sideL, sideR);
    }

    if (key === 'pony') {
      const tie = mesh(new THREE.TorusGeometry(0.16, 0.06, 8, 24), mats.dark, [0, 0.42, -0.86]);
      tie.rotation.x = Math.PI / 2;
      const ponyTop = mesh(new THREE.SphereGeometry(1, 24, 18), mats.hair, [0, 0.08, -1.02], [0.34, 0.5, 0.32]);
      const ponyMid = mesh(new THREE.SphereGeometry(1, 24, 18), mats.hair, [0, -0.48, -1.05], [0.3, 0.46, 0.28]);
      const ponyEnd = mesh(new THREE.SphereGeometry(1, 24, 18), mats.hair, [0.02, -0.9, -1.01], [0.23, 0.35, 0.21]);
      group.add(tie, ponyTop, ponyMid, ponyEnd);
    }

    if (key === 'bun') {
      const bun = mesh(new THREE.SphereGeometry(0.46, 28, 20), mats.hair, [0, 1.03, -0.08], [1, 0.88, 1]);
      const band = mesh(new THREE.TorusGeometry(0.34, 0.045, 8, 28), mats.dark, [0, 0.83, -0.08]);
      band.rotation.x = Math.PI / 2;
      group.add(bun, band);
    }
  });
  return all;
}

function applyConfig() {
  mats.skin.color.set(config.skin);
  mats.hair.color.set(config.hairColor);
  mats.top.color.set(DATA.top[config.top].color);
  mats.bottom.color.set(DATA.bottom[config.bottom].color);
  mats.shoe.color.set(DATA.shoes[config.shoes].color);
  mats.sole.color.set(DATA.shoes[config.shoes].sole);

  Object.entries(rig.hairstyles).forEach(([key, item]) => { item.visible = key === config.hair; });
  Object.entries(rig.expressions).forEach(([key, item]) => { item.visible = key === config.face; });
  Object.entries(rig.topStyles).forEach(([key, item]) => { item.visible = key === config.top; });
  rig.topDetails.children.forEach((item) => { item.visible = item.name === config.top; });

  const isShort = config.bottom === 'shorts' || config.bottom === 'skirt';
  [rig.leftLeg, rig.rightLeg].forEach((leg) => {
    leg.upper.material = isShort ? mats.skin : mats.bottom;
    leg.shorts.visible = config.bottom === 'shorts';
    leg.lower.material = isShort ? mats.skin : mats.bottom;
    Object.entries(leg.shoeGroups).forEach(([key, item]) => { item.visible = key === config.shoes; });
  });

  let skirt = rig.body.getObjectByName('skirt');
  if (!skirt) {
    skirt = mesh(new THREE.CylinderGeometry(0.72, 1.02, 1.18, 36, 3, true), mats.bottom, [0, -0.34, 0]);
    skirt.name = 'skirt';
    skirt.scale.z = 0.77;
    rig.body.add(skirt);
  }
  skirt.visible = config.bottom === 'skirt';
  rig.pelvis.visible = config.bottom !== 'skirt';

  const longSleeve = config.top !== 'tshirt';
  const sleeveScale = { tshirt: 0.96, suit: 1.02, hoodie: 1.09, cardigan: 1.04, jacket: 1.07 }[config.top];
  [rig.leftArm, rig.rightArm].forEach((arm) => {
    arm.upper.material = mats.top;
    arm.upper.scale.set(sleeveScale, 1, sleeveScale);
    arm.forearm.material = longSleeve ? mats.top : mats.skin;
  });

  updateTip();
  document.querySelectorAll('.chip').forEach((button) => button.classList.toggle('active', config[button.dataset.kind] === button.dataset.key));
  document.querySelectorAll('.swatch').forEach((swatch) => swatch.classList.toggle('active', config[swatch.dataset.kind] === swatch.dataset.value));
}

function buildPanel() {
  const sectionNames = { hair: '发型', top: '上衣', bottom: '下装', shoes: '鞋子', face: '表情' };
  const sections = $('sections');
  sections.innerHTML = '';
  Object.entries(sectionNames).forEach(([kind, title]) => {
    const section = document.createElement('section');
    section.className = 'section';
    const heading = document.createElement('h2');
    heading.textContent = title;
    const row = document.createElement('div');
    row.className = 'chip-row';
    Object.entries(DATA[kind]).forEach(([key, value]) => {
      const button = document.createElement('button');
      button.type = 'button';
      button.className = 'chip';
      button.draggable = true;
      button.dataset.kind = kind;
      button.dataset.key = key;
      const preview = document.createElement('span');
      preview.className = `item-preview preview-${kind} preview-${kind}-${key}`;
      preview.setAttribute('aria-hidden', 'true');
      if (value.color) preview.style.setProperty('--preview-color', value.color);
      const label = document.createElement('span');
      label.textContent = value.name;
      button.append(preview, label);
      button.addEventListener('click', () => commitOption(kind, key));
      button.addEventListener('dragstart', (event) => {
        dragState = { kind, key, committed: false };
        button.classList.add('dragging');
        event.dataTransfer.effectAllowed = 'copy';
        event.dataTransfer.setData('text/plain', `${kind}:${key}`);
        dragGhost = document.createElement('div');
        dragGhost.className = 'drag-ghost';
        dragGhost.append(preview.cloneNode(true), document.createTextNode(value.name));
        document.body.appendChild(dragGhost);
        event.dataTransfer.setDragImage(dragGhost, 20, 20);
      });
      button.addEventListener('dragend', () => {
        button.classList.remove('dragging');
        stage.classList.remove('drop-hover');
        if (dragState && !dragState.committed) clearPreview();
        dragState = null;
        dragGhost?.remove();
        dragGhost = null;
      });
      row.appendChild(button);
    });
    section.append(heading, row);
    sections.appendChild(section);
  });

  buildSwatches('skinSwatches', SKINS, 'skin', '肤色');
  buildSwatches('hairSwatches', HAIR_COLORS, 'hairColor', '发色');

  stage.addEventListener('dragenter', (event) => {
    event.preventDefault();
    stage.classList.add('drop-hover');
    if (dragState) previewOption(dragState.kind, dragState.key);
  });
  stage.addEventListener('dragover', (event) => { event.preventDefault(); event.dataTransfer.dropEffect = 'copy'; });
  stage.addEventListener('dragleave', (event) => {
    if (!stage.contains(event.relatedTarget)) {
      stage.classList.remove('drop-hover');
      if (dragState && !dragState.committed) clearPreview();
    }
  });
  stage.addEventListener('drop', (event) => {
    event.preventDefault();
    stage.classList.remove('drop-hover');
    try {
      const [kind, key] = event.dataTransfer.getData('text/plain').split(':');
      if (DATA[kind]?.[key]) {
        if (dragState) dragState.committed = true;
        commitOption(kind, key);
      }
    } catch (_) { /* Ignore unrelated drops. */ }
  });
  applyConfig();
}

function buildSwatches(id, colors, kind, label) {
  const row = $(id);
  row.innerHTML = '';
  colors.forEach((color, index) => {
    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'swatch';
    button.style.background = color;
    button.dataset.kind = kind;
    button.dataset.value = color;
    button.setAttribute('aria-label', `${label} ${index + 1}`);
    button.addEventListener('click', () => { config[kind] = color; saveConfig(); applyConfig(); });
    row.appendChild(button);
  });
}

function bindControls() {
  $('toggleBtn').addEventListener('click', () => {
    paused = !paused;
    const button = $('toggleBtn');
    button.classList.toggle('paused', paused);
    button.setAttribute('aria-pressed', String(paused));
    button.querySelector('.toggle-label').textContent = paused ? '继续' : '暂停';
    if (!paused) lastTime = performance.now();
  });
  $('speedRange').addEventListener('input', (event) => {
    speed = Number(event.target.value);
    $('speedVal').textContent = `${Number(speed.toFixed(2))}x`;
  });
  $('randomBtn').addEventListener('click', () => {
    Object.keys(DATA).forEach((kind) => {
      const keys = Object.keys(DATA[kind]);
      config[kind] = keys[Math.floor(Math.random() * keys.length)];
    });
    config.skin = SKINS[Math.floor(Math.random() * SKINS.length)];
    config.hairColor = HAIR_COLORS[Math.floor(Math.random() * HAIR_COLORS.length)];
    saveConfig(); applyConfig();
  });
  $('resetBtn').addEventListener('click', () => { Object.assign(config, DEFAULT_CONFIG); saveConfig(); applyConfig(); });

  stage.addEventListener('pointerdown', (event) => {
    if (event.button !== 0 && event.pointerType === 'mouse') return;
    stage.setPointerCapture(event.pointerId);
    stage.dataset.pointerX = String(event.clientX);
    stage.classList.add('is-rotating');
  });
  stage.addEventListener('pointermove', (event) => {
    if (!stage.hasPointerCapture(event.pointerId)) return;
    const previous = Number(stage.dataset.pointerX || event.clientX);
    pointerTarget += (event.clientX - previous) * 0.009;
    stage.dataset.pointerX = String(event.clientX);
  });
  const finishRotation = (event) => {
    if (stage.hasPointerCapture(event.pointerId)) stage.releasePointerCapture(event.pointerId);
    stage.classList.remove('is-rotating');
  };
  stage.addEventListener('pointerup', finishRotation);
  stage.addEventListener('pointercancel', finishRotation);
  stage.addEventListener('dblclick', () => { pointerTarget = 0; });
}

const pose = { thighR: 0, shinR: 0, footR: 0, thighL: 0, shinL: 0, footL: 0, armR: 0, armL: 0, hip: 0 };

function frame(now) {
  const dt = Math.min(0.05, (now - lastTime) / 1000);
  lastTime = now;
  if (!paused) elapsed += dt * speed;

  const phaseR = (elapsed / CYCLE) % 1;
  const phaseL = (phaseR + 0.5) % 1;
  const right = legTargets(phaseR);
  const left = legTargets(phaseL);
  const target = {
    thighR: right.thigh, shinR: right.shin, footR: right.foot,
    thighL: left.thigh, shinL: left.shin, footL: left.foot,
    armR: 0.85 * right.thigh, armL: 0.85 * left.thigh,
  };
  const smoothing = 1 - Math.exp(-dt * 16);
  Object.keys(target).forEach((key) => { pose[key] += (target[key] - pose[key]) * smoothing; });

  const wR = stanceWeight(phaseR);
  const wL = stanceWeight(phaseL);
  const hipR = 3.7 - (THIGH * Math.cos(rad(pose.thighR)) + SHIN * Math.cos(rad(pose.shinR)));
  const hipL = 3.7 - (THIGH * Math.cos(rad(pose.thighL)) + SHIN * Math.cos(rad(pose.shinL)));
  if (wR + wL > 0.02) pose.hip += ((wR * hipR + wL * hipL) / (wR + wL) - pose.hip) * smoothing;

  rig.root.position.y = BASE_HIP_Y - pose.hip;
  rig.rightLeg.hip.rotation.x = rad(-pose.thighR);
  rig.rightLeg.knee.rotation.x = rad(pose.thighR - pose.shinR);
  rig.rightLeg.foot.rotation.x = rad(pose.footR + pose.shinR);
  rig.leftLeg.hip.rotation.x = rad(-pose.thighL);
  rig.leftLeg.knee.rotation.x = rad(pose.thighL - pose.shinL);
  rig.leftLeg.foot.rotation.x = rad(pose.footL + pose.shinL);
  rig.rightArm.shoulder.rotation.x = rad(pose.armR);
  rig.leftArm.shoulder.rotation.x = rad(pose.armL);
  rig.rightArm.elbow.rotation.x = rad(-28 + pose.armR * 0.45);
  rig.leftArm.elbow.rotation.x = rad(-28 + pose.armL * 0.45);
  rig.torso.rotation.z = rad(Math.sin(phaseR * Math.PI * 2) * 1.4);
  rig.headPivot.rotation.z = rad(Math.sin(phaseR * Math.PI * 2) * -1.2);

  pointerYaw += (pointerTarget - pointerYaw) * (1 - Math.exp(-dt * 8));
  rig.root.rotation.y = -0.05 + pointerYaw;
  renderer.render(scene, camera);
  requestAnimationFrame(frame);
}

function updateTip() {
  $('stateTip').textContent = `${DATA.hair[config.hair].name} · ${DATA.top[config.top].name} · ${DATA.bottom[config.bottom].name}`;
}

function resize() {
  const width = Math.max(1, stage.clientWidth);
  const height = Math.max(1, stage.clientHeight);
  renderer.setSize(width, height, false);
  camera.aspect = width / height;
  if (width < 500) {
    camera.position.set(3.3, 3.65, 14.8);
  } else {
    camera.position.set(3.85, 3.55, 14.1);
  }
  camera.lookAt(0, 3.85, 0);
  camera.updateProjectionMatrix();
}
