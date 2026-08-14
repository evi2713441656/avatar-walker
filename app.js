(() => {
  'use strict';

  // ============ 全局常量与资�?============
  const INK = '#333';
  const STORAGE_KEY = 'avatar-walker-config';

  const THIGH = 17, SHIN = 22, ARM_U = 17, ARM_F = 16.5;
  const ANKLE_GROUND = 37;   // 脚踝中心应贴地的 y
  const GROUND_Y = 39.5;     // 地面线
  const CYCLE = 1.05;        // 一个步态循环的基础秒数（左右各一步），约 57 步/分钟，慢速休闲走

  const SKIN_TONES = ['#ffe0c2', '#f0c296', '#d9a87c', '#c08a56'];
  const HAIR_COLORS = ['#3a3a44', '#6b4a33', '#c96a2f', '#d9b45a', '#f0f0f0'];

  const HAIRS = {
    short: { name: '短发' },
    long: { name: '长发' },
    curly: { name: '卷发' },
    pony: { name: '马尾' },
    buzz: { name: '寸头' },
  };

  const TOPS = {
    tshirt: { name: '短袖T恤', color: '#4f9cf0', forearm: 'skin' },
    suit: { name: '西装', color: '#2f3b52', forearm: 'cloth' },
    hoodie: { name: '卫衣', color: '#7ac96f', forearm: 'cloth' },
    sweater: { name: '毛衣', color: '#e58a6f', forearm: 'cloth' },
  };

  const BOTTOMS = {
    pants: { name: '长裤', color: '#5f7084', type: 'full' },
    shorts: { name: '短裤', color: '#d9b45a', type: 'thigh' },
    skirt: { name: '短裙', color: '#c97a9a', type: 'skirt' },
    sweatpants: { name: '运动裤', color: '#7a8699', type: 'full' },
  };

  const SHOES = {
    sneakers: { name: '运动鞋', color: '#f5f5f5', sole: '#d9d9d9', shaft: false },
    boots: { name: '靴子', color: '#7a4a2b', sole: '#5a3418', shaft: true },
    leather: { name: '皮鞋', color: '#2b2b2b', sole: '#111111', shaft: false },
  };

  const FACES = {
    happy: { name: '开心' },
    calm: { name: '平静' },
    cool: { name: '冷酷' },
    wink: { name: '眨眼' },
  };

  // ============ 走路关键帧（度）。p∈[0,1)：一条腿的完整步态（着地→支撑→蹬地→摆腿→再着地） ============
  // 参考真实步态数据（着地髋�?0-30°/膝屈5°/踝中�?�?支撑中期膝全�?�?蹬地踝跖�?�?摆动期踝背屈防拖地）
  const KEYS = {
    thigh: [[0, 24], [0.15, 19], [0.30, 4], [0.45, -12], [0.55, -20], [0.72, -8], [0.88, 20], [1, 24]],
    knee: [[0, -5], [0.15, -2], [0.30, 0], [0.45, -10], [0.55, -55], [0.72, -48], [0.88, -12], [1, -5]],
    foot: [[0, -5], [0.15, 0], [0.30, 0], [0.45, 18], [0.55, 14], [0.70, 10], [0.82, 2], [0.92, -8], [1, -5]],
  };

  // 支撑�?= [0, 0.45]（着地→蹬地），环绕 [0.96, 1) 让摆动末期提前承重。支撑相约占周期 50%（卡通节奏）
  const stanceWeight = (q) => {
    if (q <= 0.45) return 1;
    if (q <= 0.50) return (0.50 - q) / 0.05;
    if (q >= 0.96) return (q - 0.96) / 0.04;
    return 0;
  };

  const rad = (deg) => (deg * Math.PI) / 180;
  const $ = (id) => document.getElementById(id);

  const sample = (keys, p) => {
    const n = keys.length;
    let i = 0;
    while (i < n - 2 && p > keys[i + 1][0]) i++;
    const p0 = keys[i][0], v0 = keys[i][1];
    const p1 = keys[i + 1][0], v1 = keys[i + 1][1];
    const t = (p - p0) / (p1 - p0);
    const e = (1 - Math.cos(Math.PI * t)) / 2;
    return v0 + (v1 - v0) * e;
  };

  // 相位 p 处：某条腿进入支撑期的权重（0~1），用于把髋部高度钉在地面上
  // 髋部应处高度：支撑腿脚踝贴地反推
  const hipFromLeg = (T, S) => ANKLE_GROUND - (THIGH * Math.cos(rad(T)) + SHIN * Math.cos(rad(S)));

  const shade = (hex, f) => {
    const n = parseInt(hex.slice(1), 16);
    const r = Math.min(255, Math.round(((n >> 16) & 255) * f));
    const g = Math.min(255, Math.round(((n >> 8) & 255) * f));
    const b = Math.min(255, Math.round((n & 255) * f));
    return '#' + ((1 << 24) + (r << 16) + (g << 8) + b).toString(16).slice(1);
  };

  // ============ 骨架（SVG 静态结构，颜色运行时设置） ============
  // 坐标：髋关节为原�?(0,0)，面向右 (+x)，y 向下。地�?y�?9.5
  const seg = (x1, y1, x2, y2, w, id) =>
    `<path d="M ${x1},${y1} L ${x2},${y2}" stroke="${INK}" stroke-width="${w + 2.2}" stroke-linecap="round" fill="none"/>
     <path id="${id}" d="M ${x1},${y1} L ${x2},${y2}" stroke="#fff" stroke-width="${w}" stroke-linecap="round" fill="none"/>`;

  const legSVG = (side) => `
    <g id="leg${side}">
      <path id="thighFill${side}" d="M -3.8,0 L 3.8,0 L 3.15,${THIGH - 2.2} Q 0,${THIGH + 0.4} -3.15,${THIGH - 2.2} Z" fill="#fff" stroke="${INK}" stroke-width="1.2" stroke-linejoin="round"/>
      <g id="knee${side}" transform="translate(0,${THIGH})">
        <path id="shinFill${side}" d="M -3.05,1.0 Q 0,0.2 3.05,1.0 L 2.35,${SHIN - 1.4} Q 0,${SHIN + 0.2} -2.35,${SHIN - 1.4} Z" fill="#fff" stroke="${INK}" stroke-width="1.2" stroke-linejoin="round"/>
        <g id="shaft${side}" opacity="0">
          <path id="shaftFill${side}" d="M -2.7,${SHIN - 10} L 2.7,${SHIN - 10} L 3.2,${SHIN + 0.6} L -3.2,${SHIN + 0.6} Z" fill="#fff" stroke="${INK}" stroke-width="1.2" stroke-linejoin="round"/>
        </g>
        <g id="foot${side}" transform="translate(0,${SHIN})">
          ${seg(0, 0, 8.5, 0, 4.4, 'shoeFill' + side)}
          <rect id="sole${side}" x="-1" y="1.4" width="10.5" height="1.5" rx="0.75" fill="#d9d9d9"/>
          <circle id="toe${side}" cx="8.2" cy="-0.4" r="1.8" fill="#fff"/>
        </g>
      </g>
    </g>`;

  const armSVG = (side, sx) => `
    <g id="arm${side}" transform="translate(${sx},-28)">
      ${seg(0, 3, 0, ARM_U, 4.6, 'sleeve' + side)}
      <g id="forearm${side}" transform="translate(0,${ARM_U})">
        ${seg(0, 0, 0, ARM_F, 4.2, 'forearmFill' + side)}
        <circle id="hand${side}" cx="0" cy="${ARM_F}" r="2.6" fill="#f0c296" stroke="${INK}" stroke-width="1.2"/>
      </g>
    </g>`;

  const SKELETON = `
  <svg id="avatar" viewBox="-44 -52 88 100" role="img" aria-label="换装小人走路动画">
    <line x1="-30" y1="${GROUND_Y}" x2="32" y2="${GROUND_Y}" stroke="rgba(255,255,255,0.18)" stroke-width="1.6" stroke-linecap="round"/>
    <ellipse id="shadow" cx="6" cy="${GROUND_Y}" rx="20" ry="3.6" fill="rgba(0,0,0,0.22)"/>
    <g id="bodyGroup">
      ${legSVG('L')}
      <g id="torso">
        <g id="armLwrap">
          ${armSVG('L', -1)}
        </g>
        <path id="torsoSkin" d="M -4,0 C -5.2,-8 -4.6,-18 -3.8,-26 C -2.6,-29.4 2.8,-29.4 4,-26 C 5.8,-17 6.2,-7 5,-0.5 Q 4.4,0.2 2.6,0.2 L -2.6,0.2 Q -3.8,0.2 -4,0 Z" fill="#f0c296" stroke="${INK}" stroke-width="1.4" stroke-linejoin="round"/>
        <path id="neck" d="M 0.5,-27 L 1.5,-31" stroke="#f0c296" stroke-width="6" stroke-linecap="round" fill="none"/>
        <path id="torsoCloth" d="M -4,0 C -5.2,-8 -4.6,-18 -3.8,-26 C -2.6,-29.4 2.8,-29.4 4,-26 C 5.8,-17 6.2,-7 5,-0.5 Q 4.4,0.2 2.6,0.2 L -2.6,0.2 Q -3.8,0.2 -4,0 Z" fill="#4f9cf0" stroke="${INK}" stroke-width="1.4" stroke-linejoin="round"/>
        <path id="clothShade" d="M -4,0 C -5.2,-8 -4.6,-18 -3.8,-26 C -2.6,-29.4 2.8,-29.4 4,-26 C 5.8,-17 6.2,-7 5,-0.5 Q 4.4,0.2 2.6,0.2 L 1,0.2 C 1.2,-8 1.4,-18 0.8,-26.5 C 0.4,-28 0,-28 0,-28 C -1.6,-25 -3,-14 -3,0 Z" fill="rgba(0,0,0,0.16)"/>
        <path d="M -3.8,-26 Q 0.2,-29.4 4,-26" stroke="rgba(0,0,0,0.25)" stroke-width="1.2" fill="none"/>
        <g id="torsoDetails"></g>
        <g id="headGroup" transform="translate(2,-37)">
          <g id="hairBack"></g>
          <circle id="headFace" cx="0" cy="0" r="8.5" fill="#f0c296" stroke="${INK}" stroke-width="1.4"/>
          <g id="faceWrap">
            <path d="M 5,-0.5 L 6.5,0.5 L 5,1.5 Z" fill="#d9a87c"/>
            <g id="features"></g>
            <g id="hairFront"></g>
          </g>
        </g>
        <g id="armRwrap">
          ${armSVG('R', 1.5)}
        </g>
      </g>
      ${legSVG('R')}
    </g>
  </svg>`;

  // ============ 部件绘制（发�?/ 表情 / 衣服细节�?============
  const hairCap = (c) => `<path d="M -7.5,-4 A 8.5 8.5 0 0 1 7.5,-4 Z" fill="${c}"/>`;

  const hairBackOf = (key, c) => {
    switch (key) {
      case 'long':
        return `<path d="M -9,-3 C -13,-2 -14,3 -12,8 C -11,12 -8.5,11 -8,7 L -8,-3 Z" fill="${c}"/>`;
      case 'pony':
        return `<path d="M -9,-4 C -13.5,-3 -14,2 -11.5,5 C -9.5,8 -7,7 -8,3 L -8,-4 Z" fill="${c}"/>
                <circle cx="-9.5" cy="0.5" r="1.5" fill="#e5484d"/>`;
      default:
        return '';
    }
  };

  const hairFrontOf = (key, c) => {
    const dark = shade(c, 0.8);
    switch (key) {
      case 'short':
        return hairCap(c) +
          `<path d="M -8.3,-4 Q -8.6,-1.5 -8.2,0.4 L -6.1,0.4 Q -6.6,-1.5 -6.2,-4 Z" fill="${c}"/>
           <path d="M 1,-4 L 3,-8.5 L 5,-4 Z" fill="${c}"/>`;
      case 'long':
        return hairCap(c) +
          `<path d="M 2,-4 Q 4,-8 6,-4 Z" fill="${c}"/>
           <path d="M 5,-3.5 Q 7,-6 8,-3 Z" fill="${c}"/>`;
      case 'curly':
        return `<circle cx="-4" cy="-8" r="4.5" fill="${c}"/>
                <circle cx="0" cy="-10" r="5" fill="${c}"/>
                <circle cx="4.5" cy="-8" r="4.5" fill="${c}"/>
                <circle cx="-7" cy="-4" r="3.2" fill="${c}"/>
                <circle cx="7" cy="-4" r="3.2" fill="${c}"/>`;
      case 'pony':
        return hairCap(c) +
          `<path d="M 2,-4 Q 4,-8 6,-4 Z" fill="${c}"/>`;
      case 'buzz':
        return `<path d="M -8.12,-2.5 A 8.5 8.5 0 0 1 8.12,-2.5 A 7.8 7.8 0 0 0 -8.12,-2.5 Z" fill="${c}"/>`;
    }
  };

  const faceOf = (key) => {
    const line = 'stroke="#333" stroke-width="1.5" stroke-linecap="round" fill="none"';
    const nostril = `<path d="M 6.2,0.5 Q 7.2,1.2 6.6,2" stroke="#d9a87c" stroke-width="1.2" stroke-linecap="round" fill="none"/>`;
    switch (key) {
      case 'happy':
        return `<path d="M 3.5,-3 Q 5,-1.8 6.5,-2.8" ${line}/>
                <path d="M 2.5,1.8 Q 4.5,3.8 6.8,2.6" ${line}/>
                <path d="M 3.5,0.3 Q 4.5,1.6 5.8,0.9" stroke="#d9a87c" stroke-width="1.1" stroke-linecap="round" fill="none"/>
                <ellipse cx="2.8" cy="1.5" rx="2" ry="1.2" fill="#ffb3a7" opacity="0.85"/>`;
      case 'calm':
        return `<circle cx="5" cy="-2.6" r="1.3" fill="#333"/>
                <path d="M 2.5,1.8 Q 4.5,3 6.8,2.4" ${line}/>
                <path d="M 6.1,0.3 Q 7,1 6.5,1.8" stroke="#d9a87c" stroke-width="1.2" stroke-linecap="round" fill="none"/>`;
      case 'cool':
        return `<rect x="2.8" y="-4" width="5" height="3" rx="1.5" fill="#232323"/>
                <path d="M 2.8,-2.5 h -2" stroke="#232323" stroke-width="1.3"/>
                <path d="M 2.8,-3.4 L 7.8,-1.2" stroke="#4f9cf0" stroke-width="1.4"/>
                <path d="M 2.5,1.8 Q 4.5,3.4 6.8,2.6" ${line}/>
                <path d="M 6.2,0.4 Q 7.1,1.1 6.6,1.9" stroke="#d9a87c" stroke-width="1.2" stroke-linecap="round" fill="none"/>`;
      case 'wink':
        return `<path d="M 3.5,-3 Q 5,-1.8 6.5,-2.8" ${line}/>
                <path d="M 4.5,-2.4 Q 5.2,-1.8 5.9,-2.4" stroke="#333" stroke-width="1.3" stroke-linecap="round" fill="none"/>
                <path d="M 2.5,1.8 Q 4.5,3.8 6.8,2.6" ${line}/>
                <path d="M 3.5,0.3 Q 4.5,1.6 5.8,0.9" stroke="#d9a87c" stroke-width="1.1" stroke-linecap="round" fill="none"/>`;
    }
  };

  const topDetailsOf = (key, d) => {
    switch (key) {
      case 'tshirt':
        return `<path d="M -2.5,-27 L 0,-24 L 2.5,-27 Z" fill="#fff" opacity="0.9"/>
                <rect x="1.2" y="-18" width="3" height="3.4" rx="1" fill="${d}"/>
                <path d="M -3.6,-6 L 4.4,-6" stroke="rgba(0,0,0,0.2)" stroke-width="1.1" stroke-linecap="round"/>`;
      case 'suit':
        return `<path d="M -2,-26 L 0,-22 L 2,-26 Z" fill="#f5f5f5"/>
                <path d="M -4,-26 L -1,-20 L -4,-14 Z" fill="${d}"/>
                <path d="M 3,-26 L 0.5,-21 L 3,-15 Z" fill="${shade(d, 0.8)}" opacity="0.85"/>
                <rect x="-0.8" y="-24" width="1.6" height="6" rx="0.8" fill="#d94343"/>
                <circle cx="0.9" cy="-22.5" r="0.7" fill="#d94343"/>
                <circle cx="0.9" cy="-19.5" r="0.7" fill="#d94343"/>
                <circle cx="0.9" cy="-16.5" r="0.7" fill="#d94343"/>`;
      case 'hoodie':
        return `<path d="M -4,-27 Q -2,-32 2,-30 Q 5,-28 4,-26 Q 2,-28 -1,-28 Q -3,-28 -4,-27 Z" fill="${d}"/>
                <path d="M -1,-27 v 3.2 M 1,-27 v 3.2" stroke="#fff" stroke-width="1.1" stroke-linecap="round"/>
                <rect x="-3" y="-9" width="6" height="5" rx="2.5" fill="${d}"/>
                <path d="M -3,-9 L -4.2,-9.4 M 3,-9 L 4.2,-9.4" stroke="${d}" stroke-width="1.4" stroke-linecap="round"/>`;
      case 'sweater':
        return `<rect x="-3" y="-27" width="6" height="3" rx="1.5" fill="${d}"/>
                <path d="M -2,-23 Q 0,-21 -2,-19 Q -4,-17 -2,-15" stroke="${shade(d, 0.78)}" stroke-width="1.4" fill="none"/>
                <path d="M 2,-23 Q 0,-21 2,-19 Q 4,-17 2,-15" stroke="${shade(d, 0.78)}" stroke-width="1.4" fill="none"/>
                <circle cx="0" cy="-17.5" r="0.9" fill="#fff"/><circle cx="0" cy="-14.5" r="0.9" fill="#fff"/>
                <circle cx="0" cy="-11.5" r="0.9" fill="#fff"/>`;
    }
  };

  const bottomDetailsOf = (key, d) => {
    switch (key) {
      case 'pants':
        return `<rect x="-4.5" y="-0.8" width="9" height="2.4" rx="1" fill="${d}"/>
                <path d="M -3.4,1.2 L -3.4,3.5 M 3.4,1.2 L 3.4,3.5" stroke="${d}" stroke-width="2.4" stroke-linecap="round"/>
                <path d="M -4.2,3.4 L 4.2,3.4" stroke="rgba(0,0,0,0.18)" stroke-width="1" stroke-linecap="round"/>`;
      case 'shorts':
        return `<rect x="-4.5" y="-0.8" width="9" height="2.4" rx="1" fill="${d}"/>
                <path d="M -4.6,7 L 4.6,7" stroke="${d}" stroke-width="3.2" stroke-linecap="round"/>
                <path d="M -4.6,7 L -4.6,9.2 M 4.6,7 L 4.6,9.2" stroke="${shade(d, 0.8)}" stroke-width="2" stroke-linecap="round"/>`;
      case 'sweatpants':
        return `<rect x="-4.5" y="-0.8" width="9" height="2.4" rx="1" fill="${d}"/>
                <path d="M -2.6,1.2 L -2.6,3.5 M 2.6,1.2 L 2.6,3.5" stroke="#fff" stroke-width="1.2" stroke-linecap="round"/>`;
      case 'skirt':
        return `<path d="M -6,-0.5 L 6,-0.5 L 9,9 L -9,9 Z" fill="${BOTTOMS.skirt.color}" stroke="${INK}" stroke-width="1.2" stroke-linejoin="round"/>
                <rect x="-4.5" y="-1" width="9" height="2.2" rx="1.1" fill="${d}"/>
                <path d="M -3.5,1 L -5,8 M 0,1 L 0,8.5 M 3.5,1 L 5,8" stroke="rgba(0,0,0,0.15)" stroke-width="1.2"/>`;
    }
  };

  // ============ 状�?============
  const load = () => {
    try {
      const s = JSON.parse(localStorage.getItem(STORAGE_KEY));
      if (s && HAIRS[s.hair] && TOPS[s.top] && BOTTOMS[s.bottom] && SHOES[s.shoes] && FACES[s.face]) return s;
    } catch (e) { /* 忽略 */ }
    return { hair: 'short', top: 'tshirt', bottom: 'pants', shoes: 'sneakers', face: 'happy', skin: '#f0c296', hairColor: '#6b4a33' };
  };

  const config = load();
  const els = {};

  const save = () => {
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify(config)); } catch (e) { /* 忽略 */ }
  };

  const applyConfig = () => {
    const skin = config.skin;
    const skinD = shade(skin, 0.85);
    const top = TOPS[config.top];
    const topD = shade(top.color, 0.8);
    const bottom = BOTTOMS[config.bottom];
    const bottomD = shade(bottom.color, 0.8);
    const shoes = SHOES[config.shoes];
    const shoesD = shade(shoes.color, 0.82);

    // 肤色
    els.headFace.setAttribute('fill', skin);
    els.neck.setAttribute('stroke', skin);
    els.torsoSkin.setAttribute('fill', skin);
    ['L', 'R'].forEach((s) => {
      els['hand' + s].setAttribute('fill', skin);
    });

    // 上衣
    els.torsoCloth.setAttribute('fill', top.color);
    els.torsoSkin.setAttribute('display', 'none');
    ['L', 'R'].forEach((s) => {
      els['sleeve' + s].setAttribute('stroke', s === 'L' ? topD : top.color);
      const isCloth = top.forearm === 'cloth';
      els['forearmFill' + s].setAttribute('stroke', isCloth ? (s === 'L' ? topD : top.color) : (s === 'L' ? skinD : skin));
    });
    els.torsoDetails.innerHTML = topDetailsOf(config.top, topD);

    // 下装
    const thighC = bottom.type === 'skirt' ? skin : bottom.color;
    const shinC = (bottom.type === 'full') ? bottom.color : skin;
    ['L', 'R'].forEach((s) => {
      els['thighFill' + s].setAttribute('fill', s === 'L' ? shade(thighC, 0.85) : thighC);
      els['shinFill' + s].setAttribute('fill', s === 'L' ? shade(shinC, 0.85) : shinC);
    });
    // 鞋子
    ['L', 'R'].forEach((s) => {
      els['shoeFill' + s].setAttribute('stroke', s === 'L' ? shoesD : shoes.color);
      els['sole' + s].setAttribute('fill', shoes.sole);
      els['toe' + s].setAttribute('fill', s === 'L' ? shoesD : shoes.color);
      els['shaftFill' + s].setAttribute('fill', s === 'L' ? shade(shoes.color, 0.78) : shoes.color);
      els['shaft' + s].setAttribute('opacity', shoes.shaft ? 1 : 0);
    });

    // 发型 & 表情
    els.hairBack.innerHTML = hairBackOf(config.hair, config.hairColor);
    els.hairFront.innerHTML = hairFrontOf(config.hair, config.hairColor);
    els.features.innerHTML = faceOf(config.face);

    // 下装细节（腰带 / 裙摆）画在躯干与腿之间
    const bd = bottomDetailsOf(config.bottom, bottomD);
    els.bottomDetails.innerHTML = bd;
  };

  // ============ 动画 ============
  let t = 0;
  let last = performance.now();
  let speed = 1;
  let paused = false;

  const pose = {
    TR: 0, SR: 0, FR: 0, TL: 0, SL: 0, FL: 0,
    armR: 0, armL: 0, torso: 8, head: 0, hip: -2, drift: 0,
  };

  const legTargets = (p) => {
    const T = sample(KEYS.thigh, p);
    const S = T + sample(KEYS.knee, p);
    const F = sample(KEYS.foot, p);
    return { T, S, F };
  };

  const targetOf = (p) => {
    const r = legTargets(p);
    const l = legTargets((p + 0.5) % 1);
    return {
      TR: r.T, SR: r.S, FR: r.F,
      TL: l.T, SL: l.S, FL: l.F,
      armR: -0.85 * r.T, armL: -0.85 * l.T,
      torso: 5 + 2.5 * Math.sin(p * 4 * Math.PI),
      head: -2.5 * Math.sin(p * 4 * Math.PI) * 0.4,
      hip: null,
      drift: 0,
    };
  };

  const frame = (now) => {
    const dt = Math.min((now - last) / 1000, 0.05);
    last = now;
    if (!paused) t += dt * speed;

    const p = (t / CYCLE) % 1;
    const target = targetOf(p);
    const k = 1 - Math.exp(-dt * 16);
    Object.keys(pose).forEach((key) => {
      if (key === 'hip') return;
      pose[key] += (target[key] - pose[key]) * k;
    });

    // 髋部高度：由支撑腿的当前（已缓动）角度反推，脚踝钉在地面
    const wR = stanceWeight(p);
    const wL = stanceWeight((p + 0.5) % 1);
    const hR = hipFromLeg(pose.TR, pose.SR);
    const hL = hipFromLeg(pose.TL, pose.SL);
    if (wR + wL > 0.02) pose.hip += ((wR * hR + wL * hL) / (wR + wL) - pose.hip) * k;

    els.bodyGroup.setAttribute('transform', `translate(${pose.drift.toFixed(2)},${pose.hip.toFixed(2)})`);
    els.legR.setAttribute('transform', `rotate(${(-pose.TR).toFixed(2)})`);
    els.kneeR.setAttribute('transform', `translate(0,${THIGH}) rotate(${(pose.TR - pose.SR).toFixed(2)})`);
    els.footR.setAttribute('transform', `translate(0,${SHIN}) rotate(${(pose.FR + pose.SR).toFixed(2)})`);
    els.legL.setAttribute('transform', `rotate(${(-pose.TL).toFixed(2)})`);
    els.kneeL.setAttribute('transform', `translate(0,${THIGH}) rotate(${(pose.TL - pose.SL).toFixed(2)})`);
    els.footL.setAttribute('transform', `translate(0,${SHIN}) rotate(${(pose.FL + pose.SL).toFixed(2)})`);
    els.torso.setAttribute('transform', `rotate(${pose.torso.toFixed(2)})`);
    els.armR.setAttribute('transform', `translate(1.5,-28) rotate(${(-pose.armR).toFixed(2)})`);
    els.armL.setAttribute('transform', `translate(-1,-28) rotate(${(-pose.armL).toFixed(2)})`);
    els.forearmR.setAttribute('transform', `translate(0,${ARM_U}) rotate(${(-35 + pose.armR * 0.6).toFixed(2)})`);
    els.forearmL.setAttribute('transform', `translate(0,${ARM_U}) rotate(${(-35 + pose.armL * 0.6).toFixed(2)})`);
    els.headGroup.setAttribute('transform', `translate(2,-37) rotate(${pose.head.toFixed(2)})`);
    els.shadow.setAttribute('rx', (20 - pose.hip * 0.6).toFixed(2));

    requestAnimationFrame(frame);
  };

  // ============ 截图 ============
  const downloadShot = () => {
    const svg = $('avatar');
    const clone = svg.cloneNode(true);
    clone.setAttribute('width', '600');
    clone.setAttribute('height', '682');
    const xml = new XMLSerializer().serializeToString(clone);
    const blob = new Blob([xml], { type: 'image/svg+xml;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const img = new Image();
    img.onload = () => {
      const c = document.createElement('canvas');
      c.width = 600; c.height = 682;
      const ctx = c.getContext('2d');
      ctx.fillStyle = '#22304d';
      ctx.fillRect(0, 0, 600, 682);
      ctx.drawImage(img, 0, 0, 600, 682);
      URL.revokeObjectURL(url);
      const a = document.createElement('a');
      a.download = 'avatar.png';
      a.href = c.toDataURL('image/png');
      a.click();
    };
    img.src = url;
  };

  // ============ UI ============
  const SECTION_CFG = [
    { label: '发型', key: 'hair', items: HAIRS, boxId: 'sec-hair' },
    { label: '上衣', key: 'top', items: TOPS, boxId: 'sec-top' },
    { label: '下装', key: 'bottom', items: BOTTOMS, boxId: 'sec-bottom' },
    { label: '鞋子', key: 'shoes', items: SHOES, boxId: 'sec-shoes' },
    { label: '表情', key: 'face', items: FACES, boxId: 'sec-face' },
  ];

  const buildSections = () => {
    const root = $('sections');
    SECTION_CFG.forEach((cfg) => {
      const sec = document.createElement('div');
      sec.className = 'section';
      const label = document.createElement('span');
      label.className = 'section-label';
      label.textContent = cfg.label;
      const box = document.createElement('div');
      box.className = 'chips';
      box.id = cfg.boxId;
      sec.appendChild(label);
      sec.appendChild(box);
      root.appendChild(sec);

      Object.entries(cfg.items).forEach(([val, meta]) => {
        const b = document.createElement('button');
        b.type = 'button';
        b.className = 'chip' + (config[cfg.key] === val ? ' active' : '');
        b.dataset.value = val;
        b.draggable = true;
        b.textContent = meta.name;
        b.addEventListener('dragstart', (e) => {
          e.dataTransfer.setData('text/plain', `${cfg.key}:${val}`);
          e.dataTransfer.effectAllowed = 'copy';
          b.classList.add('dragging');
        });
        b.addEventListener('dragend', () => b.classList.remove('dragging'));
        b.addEventListener('click', () => {
          config[cfg.key] = val;
          save();
          box.querySelectorAll('.chip').forEach((c) => c.classList.remove('active'));
          b.classList.add('active');
          applyConfig();
        });
        box.appendChild(b);
      });
    });
  };

  const buildSwatches = (containerId, colors, key) => {
    const box = $(containerId);
    colors.forEach((c) => {
      const s = document.createElement('span');
      s.className = 'swatch' + (config[key] === c ? ' active' : '');
      s.dataset.value = c;
      s.style.background = c;
      s.title = c;
      s.draggable = true;
      s.addEventListener('dragstart', (e) => {
        e.dataTransfer.setData('text/plain', `${key}:${c}`);
        e.dataTransfer.effectAllowed = 'copy';
        s.classList.add('dragging');
      });
      s.addEventListener('dragend', () => s.classList.remove('dragging'));
      s.addEventListener('click', () => {
        config[key] = c;
        save();
        box.querySelectorAll('.swatch').forEach((x) => x.classList.remove('active'));
        s.classList.add('active');
        applyConfig();
      });
      box.appendChild(s);
    });
  };

  const syncUI = () => {
    SECTION_CFG.forEach((cfg) => {
      $(cfg.boxId).querySelectorAll('.chip').forEach((c) => {
        c.classList.toggle('active', c.dataset.value === config[cfg.key]);
      });
    });
    ['skinSwatches', 'hairSwatches'].forEach((id) => {
      const key = id === 'skinSwatches' ? 'skin' : 'hairColor';
      $(id).querySelectorAll('.swatch').forEach((s) => {
        s.classList.toggle('active', s.dataset.value === config[key]);
      });
    });
  };

  const init = () => {
    $('stage').innerHTML = SKELETON;
    ['bodyGroup', 'legR', 'kneeR', 'footR', 'legL', 'kneeL', 'footL',
      'torso', 'armR', 'armL', 'forearmR', 'forearmL', 'headGroup', 'shadow',
      'torsoCloth', 'torsoSkin', 'torsoDetails', 'neck', 'headFace', 'hairBack', 'hairFront', 'features',
      'thighFillL', 'shinFillL', 'thighFillR', 'shinFillR',
      'shoeFillL', 'shoeFillR', 'soleL', 'soleR', 'toeL', 'toeR', 'shaftL', 'shaftR',
      'shaftFillL', 'shaftFillR',
      'sleeveL', 'sleeveR', 'forearmFillL', 'forearmFillR', 'handL', 'handR'].forEach((id) => {
        els[id] = $(id);
      });

    // 下装细节容器（裙�?腰带）插在躯干和近腿之后，让裙摆盖住大腿根部
    const bd = document.createElement('g');
    bd.id = 'bottomDetails';
    els.legR.parentNode.appendChild(bd);
    els.bottomDetails = bd;

    buildSections();
    buildSwatches('skinSwatches', SKIN_TONES, 'skin');
    buildSwatches('hairSwatches', HAIR_COLORS, 'hairColor');

    $('speedRange').addEventListener('input', (e) => {
      speed = parseFloat(e.target.value);
      $('speedVal').textContent = speed.toFixed(1) + 'x';
    });

    $('toggleBtn').addEventListener('click', () => {
      paused = !paused;
      const btn = $('toggleBtn');
      btn.textContent = paused ? '走路中' : '暂停';
      btn.classList.toggle('paused', paused);
      $('stateTip').textContent = paused ? '走路中' : '已暂停';
    });

    $('randomBtn').addEventListener('click', () => {
      const pick = (o) => Object.keys(o)[Math.floor(Math.random() * Object.keys(o).length)];
      config.hair = pick(HAIRS);
      config.top = pick(TOPS);
      config.bottom = pick(BOTTOMS);
      config.shoes = pick(SHOES);
      config.face = pick(FACES);
      config.skin = SKIN_TONES[Math.floor(Math.random() * SKIN_TONES.length)];
      config.hairColor = HAIR_COLORS[Math.floor(Math.random() * HAIR_COLORS.length)];
      save();
      applyConfig();
      syncUI();
    });

    $('shotBtn').addEventListener('click', downloadShot);

    // 拖拽换装：把衣柜里的部件拖到小人身上
    const stageEl = $('stage');
    stageEl.addEventListener('dragover', (e) => {
      e.preventDefault();
      e.dataTransfer.dropEffect = 'copy';
      stageEl.classList.add('drop-hover');
    });
    stageEl.addEventListener('dragleave', () => stageEl.classList.remove('drop-hover'));
    stageEl.addEventListener('drop', (e) => {
      e.preventDefault();
      stageEl.classList.remove('drop-hover');
      const raw = e.dataTransfer.getData('text/plain');
      const idx = raw.indexOf(':');
      if (idx < 0) return;
      const key = raw.slice(0, idx);
      const val = raw.slice(idx + 1);
      if (key === 'skin' || key === 'hairColor') {
        if (!SKIN_TONES.includes(val) && !HAIR_COLORS.includes(val)) return;
        config[key] = val;
      } else {
        const map = { hair: HAIRS, top: TOPS, bottom: BOTTOMS, shoes: SHOES, face: FACES }[key];
        if (!map || !map[val]) return;
        config[key] = val;
      }
      save();
      applyConfig();
      syncUI();
    });

    applyConfig();
    requestAnimationFrame(frame);
  };

  init();
})();
