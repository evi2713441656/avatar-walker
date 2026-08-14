(() => {
  // ============ 常量与数据 ============
  const INK = '#2a2730';
  const GROUND_Y = 3.4;
  const THIGH = 18;
  const SHIN = 21;
  const ARM_U = 15.5;
  const ARM_F = 15;
  const CYCLE = 1.05;
  const STORAGE_KEY = 'avatar2-config';

  const HAIRS = { short: '短发', long: '长发', pony: '马尾', curly: '卷发', buzz: '板寸', bun: '丸子头' };
  const TOPS = {
    tshirt: { name: 'T恤', color: '#5aa7f5', forearm: 'skin' },
    suit: { name: '西装', color: '#3d4350', forearm: 'cloth' },
    hoodie: { name: '卫衣', color: '#4f9c6a', forearm: 'cloth' },
    sweater: { name: '毛衣', color: '#c9b37e', forearm: 'cloth' },
    jacket: { name: '夹克', color: '#b57d4f', forearm: 'cloth' },
  };
  const BOTTOMS = {
    pants: { name: '长裤', color: '#4a5878' },
    shorts: { name: '短裤', color: '#c96f4a' },
    skirt: { name: '短裙', color: '#b85a7c' },
    sweatpants: { name: '运动裤', color: '#5a6a8a' },
  };
  const SHOES = {
    sneakers: { name: '运动鞋', color: '#e8e8f0', sole: '#ffffff' },
    boots: { name: '靴子', color: '#6b4a33', sole: '#403b49' },
    leather: { name: '皮鞋', color: '#2c2c34', sole: '#403b49' },
    sandals: { name: '凉鞋', color: '#c8a97a', sole: '#c8a97a' },
  };
  const FACES = { happy: '开心', cool: '墨镜', wink: '眨眼', laugh: '大笑', calm: '淡定' };
  const SKINS = ['#ffe3c9', '#f0c296', '#d99a6c', '#8d6e63'];
  const HAIR_COLORS = ['#3a3a44', '#6b4a33', '#c0392b', '#f0b41c', '#7a6cf0', '#e8e8ec'];
  const DEFAULT_CONFIG = { hair: 'short', top: 'tshirt', bottom: 'pants', shoes: 'sneakers', face: 'happy', skin: SKINS[1], hairColor: HAIR_COLORS[1] };
  const LABELS = {
    hair: { short: '短发', long: '长发', pony: '马尾', curly: '卷发', buzz: '寸头', bun: '丸子头' },
    top: { tshirt: 'T恤', suit: '西装', hoodie: '卫衣', sweater: '毛衣', jacket: '夹克' },
    bottom: { pants: '长裤', shorts: '短裤', skirt: '短裙', sweatpants: '运动裤' },
    shoes: { sneakers: '运动鞋', boots: '短靴', leather: '皮鞋', sandals: '凉鞋' },
    face: { happy: '开心', cool: '酷感', wink: '眨眼', laugh: '大笑', calm: '平静' },
  };
  const SHOE_COLORS = { sneakers: '#f4f3ef', boots: '#76513a', leather: '#2f3033', sandals: '#c79b69' };

  const shade = (hex, f) => {
    const n = parseInt(hex.slice(1), 16);
    const r = Math.min(255, Math.round(((n >> 16) & 255) * f));
    const g = Math.min(255, Math.round(((n >> 8) & 255) * f));
    const b = Math.min(255, Math.round((n & 255) * f));
    return '#' + ((1 << 24) + (r << 16) + (g << 8) + b).toString(16).slice(1);
  };

  // ============ 姿态关键帧 ============
  const KEYS = {
    thigh: [[0, -20], [0.25, 0], [0.5, 20], [0.75, 0], [1, -20]],
    shin: [[0, -10], [0.25, -3], [0.5, -10], [0.75, -3], [1, -10]],
    foot: [[0, -5], [0.15, 0], [0.30, 0], [0.45, 18], [0.55, 14], [0.70, 10], [0.82, 2], [0.92, -8], [1, -5]],
    arm: [[0, 28], [0.25, 0], [0.5, -28], [0.75, 0], [1, 28]],
  };

  const valAt = (keys, p) => {
    for (let i = 0; i < keys.length - 1; i++) {
      const k0 = keys[i], k1 = keys[i + 1];
      if (p <= k1[0]) {
        const k = (p - k0[0]) / (k1[0] - k0[0]);
        return k0[1] + (k1[1] - k0[1]) * k;
      }
    }
    return keys[keys.length - 1][1];
  };

  const poseAt = (p) => {
    const s = Math.sin(2 * Math.PI * p);
    return {
      TR: -valAt(KEYS.thigh, p),
      SR: valAt(KEYS.shin, p),
      FR: valAt(KEYS.foot, p) + valAt(KEYS.thigh, p) * 0.3,
      armR: -valAt(KEYS.arm, p),
      bob: Math.abs(s) * 2.6,
      sway: s * 2.2,
    };
  };

  // ============ 部件绘制 ============
  const hairCap = (c) => `<path d="M -8.8,-2.4 A 10.4 10.4 0 0 1 8.9,-3.6 Z" fill="url(#gradHair)" stroke="${INK}" stroke-width="1.3" stroke-linejoin="round"/>`;

  const fringe = (c) => `<path d="M 4.8,-5.2 L 6.8,-8.6 L 8.8,-5.1 C 9.1,-3.7 7.9,-3 6.8,-3.4 C 5.8,-2.6 4.5,-3.8 4.8,-5.2 Z" fill="url(#gradHair)" stroke="${INK}" stroke-width="1.2" stroke-linejoin="round"/>
    <path d="M 1,-5 L 3,-8.2 L 4.8,-4.7 C 5.1,-3.5 3.7,-3.2 2.8,-3.7 C 1.7,-3 0.5,-3.7 1,-5 Z" fill="url(#gradHair)" stroke="${INK}" stroke-width="1.2" stroke-linejoin="round"/>`;

  const sideburns = (c) => `<path d="M 8.4,-2.8 Q 8.9,-0.8 8.5,0.6 L 7.2,0.4 Q 7.5,-1 7.7,-2.2 Z" fill="url(#gradHair)" stroke="${INK}" stroke-width="1.2" stroke-linejoin="round"/>
    <path d="M -7.7,-2.6 Q -8.3,-1 -7.9,1.2 L -6.4,1 Q -6.9,-0.8 -6.6,-2.4 Z" fill="url(#gradHair)" stroke="${INK}" stroke-width="1.2" stroke-linejoin="round"/>`;

  const hairFrontOf = (key, c) => {
    switch (key) {
      case 'short':
        return hairCap(c) + fringe(c) + sideburns(c);
      case 'long':
        return hairCap(c) + fringe(c) + sideburns(c) +
          `<path d="M 8.2,-2.6 C 10.6,0.2 11.2,4.8 9.8,9.4 C 9.2,11.8 7.4,11.2 7.2,8.8 L 7.6,-3.4 Z" fill="url(#gradHair)" stroke="${INK}" stroke-width="1.2" stroke-linejoin="round"/>`;
      case 'pony':
        return hairCap(c) + fringe(c) + sideburns(c);
      case 'curly':
        return `<circle cx="-4.6" cy="-8.2" r="4.4" fill="url(#gradHair)" stroke="${INK}" stroke-width="1.3"/>
                <circle cx="0.3" cy="-10.4" r="4.8" fill="url(#gradHair)" stroke="${INK}" stroke-width="1.3"/>
                <circle cx="4.9" cy="-8.4" r="4.4" fill="url(#gradHair)" stroke="${INK}" stroke-width="1.3"/>
                <circle cx="-6.8" cy="-4.6" r="3.1" fill="url(#gradHair)" stroke="${INK}" stroke-width="1.2"/>
                <circle cx="7" cy="-4.8" r="3.1" fill="url(#gradHair)" stroke="${INK}" stroke-width="1.2"/>`;
      case 'buzz':
        return `<path d="M -9.1,-2 A 10 10 0 0 1 9.1,-2.6 A 9.2 9.2 0 0 0 -9.1,-2 Z" fill="url(#gradHair)" stroke="${INK}" stroke-width="1.3" stroke-linejoin="round"/>`;
      case 'bun':
        return hairCap(c) + fringe(c);
    }
  };

  const hairBackOf = (key, c) => {
    switch (key) {
      case 'long':
        return `<path d="M -6.5,-3.2 C -10.5,-1.4 -11.6,3.6 -9.8,9.6 C -9,13.4 -6.6,12.8 -6.2,9.4 L -5.9,-3.2 Z" fill="url(#gradHair)" stroke="${INK}" stroke-width="1.3" stroke-linejoin="round"/>`;
      case 'pony':
        return `<path d="M -6,-5.6 C -9.6,-7 -11.6,-11 -11.8,-14.4 C -10.9,-16.6 -8.2,-16 -7.5,-14.2 C -6.4,-10.7 -5.5,-7.2 -5.6,-4.8 Z" fill="url(#gradHair)" stroke="${INK}" stroke-width="1.3" stroke-linejoin="round"/>
                <circle cx="-9.6" cy="-8.6" r="1.4" fill="#e5484d"/>`;
      case 'bun':
        return `<ellipse cx="3" cy="-11.6" rx="3.4" ry="3.8" transform="rotate(-18 3 -11.6)" fill="url(#gradHair)" stroke="${INK}" stroke-width="1.3"/>
                <circle cx="2.6" cy="-8.4" r="2" fill="url(#gradHair)" stroke="${INK}" stroke-width="1.2"/>`;
      default:
        return '';
    }
  };

  const faceOf = (key) => {
    const line = `stroke="${INK}" stroke-width="1.2" stroke-linecap="round" fill="none"`;
    switch (key) {
      case 'happy':
        return `<path d="M 5.6,-5.3 Q 7,-6.4 8.4,-5.2" ${line}/>
                <path d="M 1.2,-4.5 Q 2.4,-5.4 3.6,-4.7" ${line}/>
                <ellipse cx="6.5" cy="-1.7" rx="2.1" ry="2.5" fill="#fff" stroke="${INK}" stroke-width="1.1"/>
                <circle cx="7" cy="-1.5" r="1.3" fill="#3f5c8f"/><circle cx="7.3" cy="-1.9" r="0.42" fill="#fff"/>
                <ellipse cx="2.2" cy="-0.9" rx="1.45" ry="1.75" fill="#fff" stroke="${INK}" stroke-width="1"/>
                <circle cx="2.5" cy="-0.8" r="0.88" fill="#3f5c8f"/><circle cx="2.7" cy="-1.1" r="0.3" fill="#fff"/>
                <path d="M 4.4,-3.7 Q 6.2,-4.9 8.3,-3" ${line}/>
                <path d="M 1.2,-2.4 Q 2.3,-2.6 3.3,-2.4" ${line}/>
                <path d="M 9.8,-0.4 Q 10.7,0.9 9.9,1.8" ${line}/>
                <path d="M 7.2,2.6 Q 9.4,4.7 11.2,2.4" ${line}/>
                <ellipse cx="5.2" cy="2.9" rx="1.9" ry="1.1" fill="rgba(230,110,110,0.34)"/>
                <ellipse cx="-2.7" cy="2.2" rx="1.3" ry="0.85" fill="rgba(230,110,110,0.28)"/>`;
      case 'cool':
        return `<path d="M 5.2,-1.2 L 8.8,-2 L 9.5,-0.8 L 8.6,0.5 L 5.3,1.6 L 4.4,0.4 Z" fill="#23202b" stroke="${INK}" stroke-width="1.2"/>
                <path d="M 2.9,-0.9 L 1.5,-1.1 C 0.4,-1.2 -0.3,-0.4 -0.2,0.6 L 0.6,0.8 C 0.8,-0.3 1.9,-0.7 2.6,0.6 L 3.7,1.1 L 4.4,0.4 Z" fill="#23202b" stroke="${INK}" stroke-width="1.1"/>
                <path d="M 5.6,-0.9 L 8.5,-1.6" stroke="rgba(255,255,255,0.5)" stroke-width="1.2" stroke-linecap="round"/>
                <path d="M 9.8,-0.4 Q 10.7,0.9 9.9,1.8" ${line}/>
                <path d="M 6.9,2.7 Q 8.9,4.4 10.6,2.3" ${line}/>`;
      case 'wink':
        return `<path d="M 5.6,-5.3 Q 7,-6.4 8.4,-5.2" ${line}/>
                <path d="M 1.2,-4.5 Q 2.4,-5.4 3.6,-4.7" ${line}/>
                <path d="M 4.6,-1.6 Q 6.4,0.1 8.3,-1.9" ${line}/>
                <ellipse cx="2.2" cy="-0.9" rx="1.45" ry="1.75" fill="#fff" stroke="${INK}" stroke-width="1"/>
                <circle cx="2.5" cy="-0.8" r="0.88" fill="#3f5c8f"/><circle cx="2.7" cy="-1.1" r="0.3" fill="#fff"/>
                <path d="M 9.8,-0.4 Q 10.7,0.9 9.9,1.8" ${line}/>
                <path d="M 7.2,2.4 Q 9.2,4.3 10.9,2.2" ${line}/>`;
      case 'laugh':
        return `<path d="M 5.6,-5.3 Q 7,-6.4 8.4,-5.2" ${line}/>
                <path d="M 1.2,-4.5 Q 2.4,-5.4 3.6,-4.7" ${line}/>
                <ellipse cx="6.5" cy="-1.7" rx="2.1" ry="2.5" fill="#fff" stroke="${INK}" stroke-width="1.1"/>
                <circle cx="7" cy="-1.5" r="1.3" fill="#3f5c8f"/><circle cx="7.3" cy="-1.9" r="0.42" fill="#fff"/>
                <ellipse cx="2.2" cy="-0.9" rx="1.45" ry="1.75" fill="#fff" stroke="${INK}" stroke-width="1"/>
                <circle cx="2.5" cy="-0.8" r="0.88" fill="#3f5c8f"/><circle cx="2.7" cy="-1.1" r="0.3" fill="#fff"/>
                <path d="M 8,-1 Q 8.9,0.3 8.1,1.2" ${line}/>
                <path d="M 10,-0.2 Q 10.9,1 10.1,1.9" ${line}/>
                <path d="M 6.6,2.6 Q 9.6,5.4 12,2.8 Z" fill="#fff" stroke="${INK}" stroke-width="1.1"/>
                <path d="M 9.2,3.9 L 9.6,3.4 M 10.4,3.2 L 10.8,2.7" stroke="${INK}" stroke-width="1.2" stroke-linecap="round"/>`;
      case 'calm':
        return `<path d="M 5.6,-5.3 Q 7,-6.1 8.4,-5.2" ${line}/>
                <path d="M 1.2,-4.5 Q 2.4,-5.1 3.6,-4.7" ${line}/>
                <ellipse cx="6.5" cy="-1.6" rx="2" ry="1.9" fill="#fff" stroke="${INK}" stroke-width="1.1"/>
                <circle cx="6.9" cy="-1.5" r="1.15" fill="#3f5c8f"/><circle cx="7.2" cy="-1.9" r="0.4" fill="#fff"/>
                <ellipse cx="2.2" cy="-0.8" rx="1.35" ry="1.3" fill="#fff" stroke="${INK}" stroke-width="1"/>
                <circle cx="2.5" cy="-0.8" r="0.8" fill="#3f5c8f"/><circle cx="2.7" cy="-1" r="0.28" fill="#fff"/>
                <path d="M 9.8,-0.4 Q 10.7,0.9 9.9,1.8" ${line}/>
                <path d="M 7.3,2.8 Q 9.1,3.4 10.7,2.8" ${line}/>`;
    }
  };

  // ============ 肢体 ============
  const legSVG = (side) => {
    const offX = side === 'R' ? 1.6 : -0.8;
    return `<g id="leg${side}" transform="translate(${offX},-42)">
      <g id="thigh${side}">
        <path id="thighFill${side}" d="M -3.5,0 C -4,-5 -4.3,-11 -4,-17 L 4,-17 C 4.3,-11 4,-5 3.5,0 Z" fill="url(#gradSkin)" stroke="${INK}" stroke-width="1.4" stroke-linejoin="round"/>
        <path id="shortCap${side}" d="M -3.5,-0.4 C -3.8,-4 -4.2,-8 -4,-12 L 4,-12 C 4.2,-8 3.8,-4 3.5,-0.4 Q 0,1.7 -3.5,-0.4 Z" fill="url(#gradBottom)" stroke="${INK}" stroke-width="1.3" stroke-linejoin="round" opacity="0"/>
        <g id="knee${side}" transform="translate(0,${THIGH})">
          <g id="shin${side}">
            <path id="shinFill${side}" d="M -3.1,1.2 C -3.4,-5 -3.7,-12 -3.3,-19.4 L 3.3,-19.4 C 3.7,-12 3.4,-5 3.1,1.2 Z" fill="url(#gradSkin)" stroke="${INK}" stroke-width="1.4" stroke-linejoin="round"/>
            <path id="cuff${side}" d="M -3.5,-19.4 L 3.5,-19.4 L 3.8,-17.4 L -3.8,-17.4 Z" fill="url(#gradBottom)" stroke="${INK}" stroke-width="1.2" stroke-linejoin="round" opacity="0"/>
            <g id="foot${side}" transform="translate(0,${SHIN})">
              <path id="shoeFill${side}" d="M -4.4,-0.8 C -5.3,0.2 -5.6,2.6 -4.6,4.4 L 6.4,4.4 C 7.2,3.6 7.3,1.6 6.6,0.4 L 4.3,-0.8 Z" fill="url(#gradShoe)" stroke="${INK}" stroke-width="1.3" stroke-linejoin="round"/>
              <path id="toe${side}" d="M -1.6,-0.8 L 0.3,-3.4 L 2.5,-0.7 C 2.6,0.1 1.4,0.4 0.4,-0.2 C -0.4,0.5 -1.4,0.1 -1.6,-0.8 Z" fill="#ffffff" stroke="${INK}" stroke-width="1.1" stroke-linejoin="round"/>
              <rect id="sole${side}" x="-4.9" y="4.4" width="11.9" height="2" rx="1" fill="#ffffff" stroke="${INK}" stroke-width="1.1"/>
              <path id="stripe${side}" d="M -4,1.2 L 5,1.5" stroke="rgba(255,255,255,0.85)" stroke-width="1.4" stroke-linecap="round"/>
            </g>
          </g>
        </g>
      </g>
    </g>`;
  };

  const footwearOf = (key) => {
    switch (key) {
      case 'boots':
        return `<path d="M -3.1,-5.6 L 3.3,-5.6 C 3.9,-3.4 4.2,-1 4,1.6 L 6.4,2.4 L 6.4,5.2 L -4.2,5.2 L -4.6,2.2 C -4.8,-0.4 -4.4,-3 -3.1,-5.6 Z" fill="url(#gradShoe)" stroke="${INK}" stroke-width="1.3" stroke-linejoin="round"/>
        <rect x="-4.8" y="5.2" width="11.7" height="2" rx="0.9" fill="${SHOES[key].sole}" stroke="${INK}" stroke-width="1.1"/>
        <path d="M -3.1,-5.6 L 3.3,-5.6" stroke="${INK}" stroke-width="1.6" stroke-linecap="round"/>`;
      case 'leather':
        return `<path d="M -4.6,-1.6 C -5.4,-0.6 -5.4,1.6 -4.8,3.4 L -2.2,3 L 6.9,4.8 L 7,5.6 L -4.4,5.6 L -4.9,-0.5 Z" fill="url(#gradShoe)" stroke="${INK}" stroke-width="1.3" stroke-linejoin="round"/>
        <rect x="-5" y="5.6" width="12.3" height="1.9" rx="0.9" fill="${SHOES[key].sole}" stroke="${INK}" stroke-width="1.1"/>
        <path d="M 1.2,-0.9 L 2.4,-0.3 M 3.6,0 L 4.8,0.6" stroke="${INK}" stroke-width="1.2" stroke-linecap="round"/>`;
      case 'sandals':
        return `<rect x="-4.8" y="2.1" width="11.4" height="2" rx="1" fill="${SHOES[key].sole}" stroke="${INK}" stroke-width="1.1"/>
        <path d="M -3.4,2 L -1.3,-1.1 L 0.1,-1.1 L 1.6,2 Z" fill="url(#gradShoe)" stroke="${INK}" stroke-width="1.1" stroke-linejoin="round"/>
        <path d="M -1,2 L 0.4,-2.3 L 1.7,-2.3 L 3.4,2 Z" fill="url(#gradShoe)" stroke="${INK}" stroke-width="1.1" stroke-linejoin="round"/>
        <path d="M 2.6,1.9 Q 4.5,0.6 5.3,1.9" stroke="${INK}" stroke-width="1.2" fill="none" stroke-linecap="round"/>`;
      default:
        return '';
    }
  };

  const armSVG = (side) => {
    const shX = side === 'R' ? 6 : -5.6;
    return `<g id="arm${side}" transform="translate(${shX},-64.6)">
      <path id="sleeve${side}" d="M -2.4,0 C -2.8,-5 -2.9,-10.5 -2.6,-15.5 L 2.6,-15.5 C 2.9,-10.5 2.8,-5 2.4,0 Z" fill="url(#gradSleeve)" stroke="${INK}" stroke-width="1.3" stroke-linejoin="round"/>
      <g id="forearm${side}" transform="translate(0,-${ARM_U})">
        <path id="forearmFill${side}" d="M -2.1,0.8 C -2.4,-4 -2.5,-9 -2.3,-13.5 L 2.3,-13.5 C 2.5,-9 2.4,-4 2.1,0.8 Z" fill="url(#gradSkin)" stroke="${INK}" stroke-width="1.3" stroke-linejoin="round"/>
        <circle id="hand${side}" cx="0" cy="-15" r="2.7" fill="url(#gradSkin)" stroke="${INK}" stroke-width="1.2"/>
      </g>
    </g>`;
  };

  // ============ 躯干 ============
  const topDetailsOf = (key, d) => {
    switch (key) {
      case 'tshirt':
        return `<path d="M -2.2,-66.4 L 0.4,-63.5 L 3,-66.4 Z" fill="#ffffff" opacity="0.92" stroke="${INK}" stroke-width="0.9" stroke-linejoin="round"/>
                <path d="M -2.2,-42.6 L 4,-42.6" stroke="rgba(0,0,0,0.22)" stroke-width="1.2" stroke-linecap="round"/>`;
      case 'suit':
        return `<path d="M -1.4,-66.5 L 0.6,-63.4 L 2.6,-66.5 Z" fill="#f5f5f5" stroke="${INK}" stroke-width="0.9" stroke-linejoin="round"/>
                <path d="M -4.4,-66.3 L -1.6,-60.8 L -4.2,-55.2 Z" fill="${shade(d, 0.75)}" stroke="${INK}" stroke-width="1.1" stroke-linejoin="round"/>
                <path d="M 3.8,-66.3 L 1.1,-61.2 L 3.6,-56.1 Z" fill="${shade(d, 0.62)}" stroke="${INK}" stroke-width="1.1" stroke-linejoin="round"/>
                <rect x="0.1" y="-64.5" width="1.5" height="6" rx="0.75" fill="#d94343"/>
                <circle cx="1" cy="-56.5" r="0.7" fill="#d94343"/>
                <circle cx="1" cy="-53.5" r="0.7" fill="#d94343"/>
                <circle cx="1" cy="-50.5" r="0.7" fill="#d94343"/>
                <path d="M -2.9,-63.8 L -0.6,-60.1 M -2.4,-52.8 L 0.4,-50.1" stroke="rgba(0,0,0,0.16)" stroke-width="1.1" stroke-linecap="round"/>`;
      case 'hoodie':
        return `<path d="M -4,-66.6 Q -2,-71.4 2,-69.5 Q 5,-67.7 4.2,-65.7 Q 2.2,-67.7 -1,-67.8 Q -3,-67.8 -4,-66.6 Z" fill="${d}" stroke="${INK}" stroke-width="1.1" stroke-linejoin="round"/>
                <path d="M -0.8,-68.5 L -0.8,-65 M 1,-68.4 L 1,-65" stroke="${shade(d, 0.85)}" stroke-width="1.3" stroke-linecap="round"/>
                <rect x="-3.6" y="-51" width="7" height="5.4" rx="2.4" fill="${d}" stroke="${INK}" stroke-width="1"/>
                <path d="M -3.6,-51 L -5.2,-51.4 M 3.6,-51 L 5.2,-51.4" stroke="${d}" stroke-width="1.5" stroke-linecap="round"/>`;
      case 'sweater':
        return `<rect x="-3.4" y="-67.6" width="6.8" height="4" rx="1.8" fill="${d}" stroke="${INK}" stroke-width="1.1"/>
                <path d="M -2.4,-62.5 Q -0.4,-60.8 -2.4,-59.1 Q -4.4,-57.5 -2.4,-55.8 Q -0.4,-54.2 -2.4,-52.5 Q -4.4,-50.9 -2.4,-49.2" stroke="${shade(d, 0.6)}" stroke-width="1.5" fill="none" stroke-linecap="round"/>
                <path d="M 2.5,-62.5 Q 0.5,-60.8 2.5,-59.1 Q 4.5,-57.5 2.5,-55.8 Q 0.5,-54.2 2.5,-52.5 Q 4.5,-50.9 2.5,-49.2" stroke="${shade(d, 0.6)}" stroke-width="1.5" fill="none" stroke-linecap="round"/>
                <circle cx="0" cy="-57.6" r="0.9" fill="#ffffff"/>
                <circle cx="0" cy="-54.2" r="0.9" fill="#ffffff"/>
                <circle cx="0" cy="-50.8" r="0.9" fill="#ffffff"/>
                <circle cx="0" cy="-47.4" r="0.9" fill="#ffffff"/>`;
      case 'jacket':
        return `<path d="M -0.3,-66.5 L -0.3,-44.8" stroke="${shade(d, 0.72)}" stroke-width="2" stroke-linecap="round"/>
                <path d="M 1.8,-4.9 Q 2.8,-3.9 1.8,-2.9" stroke="#ffffff" stroke-width="1" fill="none" stroke-linecap="round"/>
                <rect x="-3.3" y="-59.5" width="6.6" height="4.6" rx="2" fill="${d}" stroke="${INK}" stroke-width="1"/>
                <circle cx="0" cy="-62.8" r="0.55" fill="#ffffff" opacity="0.85"/>`;
    }
  };

  const bottomDetailsOf = (key, d) => {
    switch (key) {
      case 'pants':
      case 'sweatpants':
        return `<rect x="-4" y="-42.4" width="11.4" height="3" rx="1.3" fill="${shade(d, 0.7)}" stroke="${INK}" stroke-width="1.2"/>
                <path d="M 0.4,-42.6 L 0.4,-40" stroke="rgba(0,0,0,0.2)" stroke-width="1.2" stroke-linecap="round"/>`;
      case 'shorts':
        return `<rect x="-4" y="-42.4" width="11.4" height="2.8" rx="1.2" fill="${shade(d, 0.7)}" stroke="${INK}" stroke-width="1.2"/>
                <path d="M -2.6,-38 L 2.8,-38" stroke="${shade(d, 0.75)}" stroke-width="1.4" stroke-linecap="round"/>`;
      case 'skirt':
        return `<path d="M -5.2,-41.6 L 7,-41.6 C 8.4,-31.6 7.4,-22.4 6.4,-18.2 L -2,-18.2 C -4.3,-20.2 -6.3,-29 -5.2,-41.6 Z" fill="url(#gradBottom)" stroke="${INK}" stroke-width="1.4" stroke-linejoin="round"/>
                <path d="M -1.8,-41.3 L -1,-19.2 M 1.4,-41.4 L 2.2,-20.6" stroke="rgba(0,0,0,0.15)" stroke-width="1.2" stroke-linecap="round"/>`;
    }
  };

  const SKELETON = `
  <svg id="avatar" viewBox="-56 -92 112 104" role="img" aria-label="侧身小人走路动画">
    <defs>
      <linearGradient id="gradSkin" x1="0" y1="0" x2="0" y2="1"><stop id="gS1" offset="0.06" stop-color="#ffe3c9"/><stop id="gS2" offset="0.94" stop-color="#e0a87c"/></linearGradient>
      <linearGradient id="gradTop" x1="0" y1="0" x2="0" y2="1"><stop id="gT1" offset="0.06" stop-color="#6fb3f7"/><stop id="gT2" offset="0.94" stop-color="#3d7fc8"/></linearGradient>
      <linearGradient id="gradSleeve" x1="0" y1="0" x2="0" y2="1"><stop id="gV1" offset="0.06" stop-color="#5f9fdd"/><stop id="gV2" offset="0.94" stop-color="#3d7fc8"/></linearGradient>
      <linearGradient id="gradBottom" x1="0" y1="0" x2="0" y2="1"><stop id="gB1" offset="0.06" stop-color="#5a6a8a"/><stop id="gB2" offset="0.94" stop-color="#3e4c66"/></linearGradient>
      <linearGradient id="gradHair" x1="0" y1="-0.3" x2="0" y2="1"><stop id="gH1" offset="0.06" stop-color="#7a5c47"/><stop id="gH2" offset="0.94" stop-color="#54392a"/></linearGradient>
      <linearGradient id="gradShoe" x1="0" y1="0" x2="0" y2="1"><stop id="gO1" offset="0.06" stop-color="#ffffff"/><stop id="gO2" offset="0.94" stop-color="#d8d4de"/></linearGradient>
    </defs>
    <line x1="-30" y1="${GROUND_Y}" x2="34" y2="${GROUND_Y}" stroke="rgba(255,255,255,0.22)" stroke-width="1.6" stroke-linecap="round"/>
    <ellipse id="shadow" cx="6" cy="${GROUND_Y}" rx="21" ry="4" fill="rgba(0,0,0,0.22)"/>
    <g id="pack">
      ${legSVG('L')}
      ${legSVG('R')}
      <g id="bottomDetails"></g>
      ${armSVG('L')}
      <g id="torso">
        <path id="torsoCloth" d="M -4.6,-42 C -5.6,-49 -5.8,-58 -5.2,-63.8 C -5,-66 -4,-66.5 -2,-66.7 L 4,-66.7 C 5.8,-66.4 6.4,-64.6 6.1,-61.6 C 5.8,-55 6,-49 5.4,-43.6 C 5.2,-42.6 4.4,-42 3.2,-42 L -2.8,-42 Z" fill="url(#gradTop)" stroke="${INK}" stroke-width="1.4" stroke-linejoin="round"/>
        <path id="neck" d="M 1,-66.8 L 3.2,-71" stroke="url(#gradSkin)" stroke-width="6.4" stroke-linecap="round" fill="none"/>
        <g id="torsoDetails"></g>
        <g id="headGroup" transform="translate(4,-76)">
          <g id="hairBack"></g>
          <circle id="headFace" cx="0" cy="0" r="10" fill="url(#gradSkin)" stroke="${INK}" stroke-width="1.4"/>
          <path id="ear" d="M 8.6,-0.6 C 10,-1.8 10.9,0 10.2,1.2 C 9.7,2 8.4,2.2 8.2,1 C 8,0.2 8.2,-0.2 8.6,-0.6 Z" fill="url(#gradSkin)" stroke="${INK}" stroke-width="1.2" stroke-linejoin="round"/>
          <g id="features"></g>
          <g id="hairFront"></g>
        </g>
      </g>
      <g id="armRwrap">
      ${armSVG('R')}
      </g>
    </g>
  </svg>`;

  // ============ 交互与状态 ============
  const $ = (id) => document.getElementById(id);

  const load = () => {
    try {
      const s = JSON.parse(localStorage.getItem(STORAGE_KEY));
      if (s && HAIRS[s.hair] && TOPS[s.top] && BOTTOMS[s.bottom] && SHOES[s.shoes] && FACES[s.face]) {
        if (!SKINS.includes(s.skin)) s.skin = SKINS[0];
        if (!HAIR_COLORS.includes(s.hairColor)) s.hairColor = HAIR_COLORS[1];
        return s;
      }
    } catch (e) { /* 忽略 */ }
    return { ...DEFAULT_CONFIG };
  };

  const config = load();
  const els = {};

  const stopCol = (id, val) => {
    const el = document.getElementById(id);
    if (el) el.setAttribute('stop-color', val);
  };

  const applyConfig = () => {
    const skin = config.skin;
    const top = TOPS[config.top];
    const bottom = BOTTOMS[config.bottom];
    const shoes = SHOES[config.shoes];
    const topCol = top.color;
    const bottomCol = BOTTOMS[config.bottom].color;
    const shoeCol = shoes.color || SHOE_COLORS[config.shoes];

    stopCol('gS1', skin); stopCol('gS2', shade(skin, 0.82));
    stopCol('gT1', topCol); stopCol('gT2', shade(topCol, 0.68));
    stopCol('gV1', shade(topCol, 0.92)); stopCol('gV2', shade(topCol, 0.72));
    stopCol('gB1', bottomCol); stopCol('gB2', shade(bottomCol, 0.7));
    stopCol('gH1', config.hairColor); stopCol('gH2', shade(config.hairColor, 0.75));
    stopCol('gO1', shoeCol); stopCol('gO2', shade(shoeCol, 0.7));

    const skinC = 'url(#gradSkin)';
    const bottomC = 'url(#gradBottom)';
    ['L', 'R'].forEach((s) => {
      els['sleeve' + s].setAttribute('fill', 'url(#gradSleeve)');
      const isCloth = top.forearm === 'cloth';
      els['forearmFill' + s].setAttribute('fill', isCloth ? 'url(#gradSleeve)' : skinC);
      els['thighFill' + s].setAttribute('fill', config.bottom === 'skirt' ? skinC : bottomC);
      els['shinFill' + s].setAttribute('fill', (config.bottom === 'pants' || config.bottom === 'sweatpants') ? bottomC : skinC);
      els['shortCap' + s].setAttribute('opacity', config.bottom === 'shorts' ? 1 : 0);
      els['cuff' + s].setAttribute('opacity', config.bottom === 'sweatpants' ? 1 : 0);
      els['shoeFill' + s].setAttribute('d', footwearPath(config.shoes));
      els['toe' + s].setAttribute('opacity', config.shoes === 'sneakers' ? 1 : 0);
      els['stripe' + s].setAttribute('opacity', config.shoes === 'sneakers' ? 1 : 0);
      els['sole' + s].setAttribute('fill', shoes.sole);
      els['toe' + s].setAttribute('fill', shade(shoeCol, 0.85));
    });
    els.torsoDetails.innerHTML = topDetailsOf(config.top, shade(topCol, 0.85));
    els.bottomDetails.innerHTML = bottomDetailsOf(config.bottom, bottomCol);
    els.hairBack.innerHTML = hairBackOf(config.hair, config.hairColor);
    els.hairFront.innerHTML = hairFrontOf(config.hair, config.hairColor);
    els.features.innerHTML = faceOf(config.face);
  };

  let footwearPath = (key) => {
    const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    svg.innerHTML = footwearOf(key);
    const first = svg.querySelector('path');
    return first ? first.getAttribute('d') : '';
  };

  // ============ 主流程 ============
  document.addEventListener('DOMContentLoaded', () => {
    const stage = $('stage');
    stage.innerHTML = SKELETON;
    ['thighFill', 'shinFill', 'shortCap', 'cuff', 'shoeFill', 'toe', 'sole', 'stripe', 'sleeve', 'forearmFill', 'hand'].forEach((k) => {
      ['L', 'R'].forEach((s) => { els[k + s] = $(k + s); });
    });
    els.torsoDetails = $('torsoDetails');
    els.bottomDetails = $('bottomDetails');
    els.hairBack = $('hairBack');
    els.hairFront = $('hairFront');
    els.features = $('features');
    applyConfig();
    buildPanel();
    startAnimation();
  });

  // ============ 面板 ============
  const buildPanel = () => {
    const sections = $('sections');
    sections.innerHTML = '';
    const categoryTitles = { hair: '发型', top: '上衣', bottom: '下装', shoes: '鞋子', face: '表情' };
    const defs = [
      ['发型', HAIRS, 'hair'],
      ['上衣', TOPS, 'top'],
      ['下装', BOTTOMS, 'bottom'],
      ['鞋子', SHOES, 'shoes'],
      ['表情', FACES, 'face'],
    ];
    const nameOf = (cfgKey, key) => LABELS[cfgKey][key];
    defs.forEach(([title, map, cfgKey]) => {
      const sec = document.createElement('section');
      sec.className = 'section';
      const h = document.createElement('h2');
      h.textContent = categoryTitles[cfgKey];
      const row = document.createElement('div');
      row.className = 'chip-row';
      Object.keys(map).forEach((key) => {
        const b = document.createElement('button');
        b.type = 'button';
        b.className = 'chip' + (key === config[cfgKey] ? ' active' : '');
        b.textContent = nameOf(cfgKey, key);
        b.draggable = true;
        b.dataset.key = key;
        b.dataset.cfg = cfgKey;
        b.addEventListener('click', () => {
          config[cfgKey] = key;
          save(); refreshActive(); updateTip();
        });
        b.addEventListener('dragstart', (e) => {
          e.dataTransfer.setData('text/plain', cfgKey + ':' + key);
          b.classList.add('dragging');
        });
        b.addEventListener('dragend', () => b.classList.remove('dragging'));
        row.appendChild(b);
      });
      sec.appendChild(h);
      sec.appendChild(row);
      sections.appendChild(sec);
    });

    const swatchRow = (id, list, cfgKey) => {
      const row = $(id);
      row.innerHTML = '';
      list.forEach((val) => {
        const s = document.createElement('span');
        s.className = 'swatch' + (val === config[cfgKey] ? ' active' : '');
        s.title = cfgKey === 'skin' ? '选择肤色' : '选择发色';
        s.tabIndex = 0;
        s.setAttribute('role', 'button');
        s.dataset.cfg = cfgKey;
        s.dataset.value = val;
        s.style.background = val;
        s.draggable = true;
        const selectSwatch = () => { config[cfgKey] = val; save(); refreshActive(); updateTip(); };
        s.addEventListener('click', selectSwatch);
        s.addEventListener('keydown', (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); selectSwatch(); } });
        s.addEventListener('dragstart', (e) => {
          e.dataTransfer.setData('text/plain', cfgKey + ':' + val);
          s.classList.add('dragging');
        });
        s.addEventListener('dragend', () => s.classList.remove('dragging'));
        row.appendChild(s);
      });
    };
    swatchRow('skinSwatches', SKINS, 'skin');
    swatchRow('hairSwatches', HAIR_COLORS, 'hairColor');

    const stage = $('stage');
    ['dragover', 'dragenter'].forEach((ev) => {
      stage.addEventListener(ev, (e) => { e.preventDefault(); stage.classList.add('drop-hover'); });
    });
    ['dragleave', 'dragend'].forEach((ev) => {
      stage.addEventListener(ev, (e) => { if (ev === 'dragleave' && e.target !== stage) return; stage.classList.remove('drop-hover'); });
    });
    stage.addEventListener('drop', (e) => {
      e.preventDefault();
      stage.classList.remove('drop-hover');
      const pair = e.dataTransfer.getData('text/plain');
      if (!pair) return;
      const idx = pair.indexOf(':');
      if (idx < 0) return;
      const k = pair.slice(0, idx), v = pair.slice(idx + 1);
      if (['hair', 'top', 'bottom', 'shoes', 'face', 'skin', 'hairColor'].includes(k)) {
        config[k] = v;
        save(); refreshActive(); updateTip();
      }
    });

    $('toggleBtn').addEventListener('click', () => {
      paused = !paused;
      $('toggleBtn').textContent = paused ? '继续' : '暂停';
      if (!paused) last = performance.now();
      const toggle = $('toggleBtn');
      toggle.classList.toggle('paused', paused);
      toggle.setAttribute('aria-pressed', String(paused));
      toggle.innerHTML = `<span class="pause-icon" aria-hidden="true"></span><span class="toggle-label">${paused ? '继续' : '暂停'}</span>`;
    });
    $('speedRange').addEventListener('input', (e) => {
      speed = parseFloat(e.target.value);
      $('speedVal').textContent = speed.toFixed(2).replace(/0+$/, '').replace(/\.$/, '') + 'x';
    });
    $('randomBtn').addEventListener('click', () => {
      const pick = (o) => Object.keys(o)[Math.floor(Math.random() * Object.keys(o).length)];
      config.hair = pick(HAIRS);
      config.top = pick(TOPS);
      config.bottom = pick(BOTTOMS);
      config.shoes = pick(SHOES);
      config.face = pick(FACES);
      config.skin = SKINS[Math.floor(Math.random() * SKINS.length)];
      config.hairColor = HAIR_COLORS[Math.floor(Math.random() * HAIR_COLORS.length)];
      save(); refreshActive(); updateTip();
    });
    $('resetBtn').addEventListener('click', () => {
      Object.assign(config, DEFAULT_CONFIG);
      save(); refreshActive(); updateTip();
    });

    refreshActive(); updateTip();
  };

  const refreshActive = () => {
    document.querySelectorAll('.chip').forEach((b) => {
      const k = b.dataset.key;
      const cfgKey = b.dataset.cfg;
      b.classList.toggle('active', k === config[cfgKey]);
    });
    document.querySelectorAll('.swatch').forEach((s) => {
      s.classList.toggle('active', s.dataset.value === config[s.dataset.cfg]);
    });
    applyConfig();
  };

  let paused = false;
  let speed = 1;
  let t = 0;
  let last = performance.now();

  const startAnimation = () => {
    const legR = $('legR'), legL = $('legL');
    const thighR = $('thighR'), kneeR = $('kneeR');
    const footR = $('footR'), footL = $('footL');
    const armR = $('armR'), armL = $('armL');
    const foreR = $('forearmR'), foreL = $('forearmL');
    const pack = $('pack'), head = $('headGroup');
    if (!$('thighR')) return;
    const step = (now) => {
      const dt = Math.min(0.05, (now - last) / 1000);
      last = now;
      if (!paused) t += dt * speed;
      const pR = (t / CYCLE) % 1;
      const pL = (pR + 0.5) % 1;
      const a = poseAt(pR), b = poseAt(pL);
      $('thighR').setAttribute('transform', `rotate(${a.TR.toFixed(2)} 0 0)`);
      $('shinR').setAttribute('transform', `rotate(${a.SR.toFixed(2)} 0 0)`);
      $('footR').setAttribute('transform', `translate(0,${SHIN}) rotate(${a.FR.toFixed(2)})`);
      $('thighL').setAttribute('transform', `rotate(${b.TR.toFixed(2)} 0 0)`);
      $('shinL').setAttribute('transform', `rotate(${b.SR.toFixed(2)} 0 0)`);
      $('footL').setAttribute('transform', `translate(0,${SHIN}) rotate(${b.FR.toFixed(2)})`);
      $('armR').setAttribute('transform', `translate(6,-64.6) rotate(${a.armR.toFixed(2)} 0 0)`);
      $('armL').setAttribute('transform', `translate(-5.6,-64.6) rotate(${-a.armR.toFixed(2)} 0 0)`);
      $('forearmR').setAttribute('transform', `translate(0,-${ARM_U}) rotate(-30)`);
      $('forearmL').setAttribute('transform', `translate(0,-${ARM_U}) rotate(-30)`);
      $('pack').setAttribute('transform', `translate(0,${(-a.bob).toFixed(2)})`);
      $('headGroup').setAttribute('transform', `translate(4,-76) rotate(${a.sway.toFixed(2)} 0 0)`);
      requestAnimationFrame(step);
    };
    requestAnimationFrame(step);
  };

  const save = () => {
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify(config)); } catch (e) { /* 忽略 */ }
  };

  const updateTip = () => {
    const tip = $('stateTip');
    if (tip) tip.textContent = [LABELS.hair[config.hair], LABELS.top[config.top], LABELS.bottom[config.bottom], LABELS.shoes[config.shoes]].join(' · ');
    return;
    if (tip) tip.textContent = [HAIRS[config.hair], TOPS[config.top], BOTTOMS[config.bottom], SHOES[config.shoes].name, FACES[config.face]].join(' · ');
  };
})();
