(function (root) {
    'use strict';

    // 长征战役立体沙盘渲染器：原生 WebGL2，无第三方依赖。
    // 地形来自 GEBCO 2024 高程栅格，行政区界、海岸线与河流来自 Natural Earth（见 scripts/build-map-data.py），
    // 投影为中国常用的 Albers 等积圆锥投影（中央经线 105°E，标准纬线 25°N、47°N）。
    // 用法：
    //   const map = await RedWisdomSandbox.loadMap(key);
    //   RedWisdomSandbox.create({ canvas, labelLayer, campaign, map, onUnitClick, onFollowChange, onCampaignClick })
    // 返回 { setTime, setLayers, setExaggeration, exaggerationFactor, preset, setFollow, isFollowing, destroy }。

    const smooth = (t) => t * t * (3 - 2 * t);
    const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);

    function hash(i, j) {
        let h = (Math.imul(i, 374761393) + Math.imul(j, 668265263)) | 0;
        h = Math.imul(h ^ (h >>> 13), 1274126177);
        return ((h ^ (h >>> 16)) >>> 0) / 4294967295;
    }
    function vnoise(x, y) {
        const i = Math.floor(x), j = Math.floor(y), u = smooth(x - i), v = smooth(y - j);
        const a = hash(i, j), b = hash(i + 1, j), c = hash(i, j + 1), d = hash(i + 1, j + 1);
        return a + (b - a) * u + (c - a) * v + (a - b - c + d) * u * v;
    }
    function fbm(x, y, octaves = 5) {
        let s = 0, a = 0.5, f = 1, n = 0;
        for (let k = 0; k < octaves; k += 1) { s += a * vnoise(x * f + k * 17.3, y * f - k * 9.1); n += a; f *= 2.07; a *= 0.5; }
        return s / n;
    }
    const sub = (a, b) => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
    const cross = (a, b) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
    const dot = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
    const norm = (a) => { const l = Math.hypot(a[0], a[1], a[2]) || 1; return [a[0] / l, a[1] / l, a[2] / l]; };
    function persp(fov, aspect, near, far) {
        const t = 1 / Math.tan(fov / 2), nf = 1 / (near - far);
        return new Float32Array([t / aspect, 0, 0, 0, 0, t, 0, 0, 0, 0, (far + near) * nf, -1, 0, 0, 2 * far * near * nf, 0]);
    }
    function lookAt(e, c, u) {
        const z = norm(sub(e, c)), x = norm(cross(u, z)), y = cross(z, x);
        return new Float32Array([x[0], y[0], z[0], 0, x[1], y[1], z[1], 0, x[2], y[2], z[2], 0, -dot(x, e), -dot(y, e), -dot(z, e), 1]);
    }
    function mul(a, b) {
        const o = new Float32Array(16);
        for (let i = 0; i < 4; i += 1) for (let j = 0; j < 4; j += 1) { let s = 0; for (let k = 0; k < 4; k += 1) s += a[k * 4 + j] * b[i * 4 + k]; o[i * 4 + j] = s; }
        return o;
    }
    function trs(p, ry, s) {
        const c = Math.cos(ry), si = Math.sin(ry);
        return new Float32Array([c * s[0], 0, -si * s[0], 0, 0, s[1], 0, 0, si * s[2], 0, c * s[2], 0, p[0], p[1], p[2], 1]);
    }
    const I4 = new Float32Array([1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1]);
    const hex3 = (h) => { const n = parseInt(String(h).replace('#', ''), 16); return [(n >> 16 & 255) / 255, (n >> 8 & 255) / 255, (n & 255) / 255]; };
    const escapeHtml = (v) => String(v ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

    /* ---------- Albers 等积圆锥投影（km） ---------- */
    const ALBERS = (() => {
        const r = Math.PI / 180, p1 = 25 * r, p2 = 47 * r, lon0 = 105, R = 6371;
        const n = (Math.sin(p1) + Math.sin(p2)) / 2, C = Math.cos(p1) ** 2 + 2 * n * Math.sin(p1), rho0 = R * Math.sqrt(C) / n;
        return {
            fwd(lon, lat) {
                const rho = R * Math.sqrt(C - 2 * n * Math.sin(lat * r)) / n, th = n * (lon - lon0) * r;
                return [rho * Math.sin(th), rho0 - rho * Math.cos(th)];
            },
            inv(x, y) {
                const dy = rho0 - y, rho = Math.hypot(x, dy), th = Math.atan2(x, dy);
                return [lon0 + th / n / r, Math.asin(clamp((C - (rho * n / R) ** 2) / (2 * n), -1, 1)) / r];
            },
        };
    })();
    function projectedBox(bbox, steps = 24) {
        const [L0, B0, L1, B1] = bbox; let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
        for (let i = 0; i <= steps; i += 1) {
            const t = i / steps;
            for (const [lon, lat] of [[L0 + (L1 - L0) * t, B0], [L0 + (L1 - L0) * t, B1], [L0, B0 + (B1 - B0) * t], [L1, B0 + (B1 - B0) * t]]) {
                const [x, y] = ALBERS.fwd(lon, lat);
                if (x < x0) x0 = x; if (x > x1) x1 = x; if (y < y0) y0 = y; if (y > y1) y1 = y;
            }
        }
        return [x0, y0, x1, y1];
    }

    /* ---------- 数据加载 ---------- */
    const cache = new Map();
    function cached(key, make) {
        if (!cache.has(key)) { const p = make(); cache.set(key, p); p.catch(() => cache.delete(key)); }
        return cache.get(key);
    }
    function fetchOk(url) {
        return fetch(url).then((r) => { if (!r.ok) throw new Error(`${url}: ${r.status}`); return r; });
    }
    const loadIndex = () => cached('index', () => fetchOk('data/terrain/index.json').then((r) => r.json()));
    const loadVectors = (key) => cached(`vec:${key}`, () => fetchOk(`data/map/${key}.json`).then((r) => r.json()));
    function loadTerrain(key) {
        return cached(`dem:${key}`, () => Promise.all([loadIndex(), fetchOk(`data/terrain/${key}.bin`).then((r) => r.arrayBuffer())]).then(([index, buf]) => {
            const meta = index[key];
            if (!meta) throw new Error(`terrain ${key} missing from index`);
            const view = new DataView(buf), data = new Int16Array(meta.w * meta.h);
            if (data.length * 2 !== buf.byteLength) throw new Error(`terrain ${key} has unexpected size`);
            for (let i = 0; i < data.length; i += 1) data[i] = view.getInt16(i * 2, true);
            return { ...meta, data };
        }));
    }
    function loadMap(key) {
        return Promise.all([loadTerrain(key), loadVectors(key)]).then(([dem, vec]) => ({ key, dem, vec }));
    }

    /* ---------- 小地图（SVG） ---------- */
    // 用同一 Albers 投影画位置示意图或南海诸岛附图。opts: { vec, bbox, width, height, highlight:[l0,b0,l1,b1], route:[[lon,lat]...], title }
    function insetSvg(opts) {
        const { vec, width = 160, height = 120 } = opts;
        const bbox = opts.bbox || vec.bbox, [x0, y0, x1, y1] = projectedBox(bbox), pad = 4;
        const s = Math.min((width - pad * 2) / (x1 - x0), (height - pad * 2) / (y1 - y0));
        const ox = (width - (x1 - x0) * s) / 2, oy = (height - (y1 - y0) * s) / 2;
        const pt = ([lon, lat]) => { const [x, y] = ALBERS.fwd(lon, lat); return `${(ox + (x - x0) * s).toFixed(1)},${(oy + (y1 - y) * s).toFixed(1)}`; };
        const path = (lines, close) => lines.filter((l) => l.length > 1).map((l) => `M${l.map(pt).join('L')}${close ? 'Z' : ''}`).join('');
        const parts = [`<rect width="${width}" height="${height}" fill="#dfe8ea"/>`];
        if (vec.neighbors && vec.neighbors.length) parts.push(`<path d="${path(vec.neighbors, true)}" fill="#ece6d8" stroke="#c9bfa8" stroke-width=".4"/>`);
        parts.push(`<path d="${path(vec.land || [], true)}" fill="#f4ecd6" stroke="none"/>`);
        if (vec.provinces && vec.provinces.length) parts.push(`<path d="${path(vec.provinces)}" fill="none" stroke="#b49a7c" stroke-width=".4" stroke-dasharray="2 1.2"/>`);
        if (vec.coast && vec.coast.length) parts.push(`<path d="${path(vec.coast)}" fill="none" stroke="#6f93a6" stroke-width=".5"/>`);
        if (vec.border && vec.border.length) parts.push(`<path d="${path(vec.border)}" fill="none" stroke="#9b3b2e" stroke-width=".9"/>`);
        if (vec.dash && vec.dash.length) parts.push(`<path d="${path(vec.dash)}" fill="none" stroke="#9b3b2e" stroke-width="1.1"/>`);
        if (opts.route && opts.route.length > 1) parts.push(`<path d="${path([opts.route])}" fill="none" stroke="#C4281C" stroke-width="1.4" stroke-linejoin="round"/>`);
        if (opts.highlight) {
            const [a, b, c, d] = opts.highlight, ring = [];
            for (let i = 0; i <= 8; i += 1) ring.push([a + (c - a) * i / 8, b]);
            for (let i = 0; i <= 8; i += 1) ring.push([c, b + (d - b) * i / 8]);
            for (let i = 0; i <= 8; i += 1) ring.push([c - (c - a) * i / 8, d]);
            for (let i = 0; i <= 8; i += 1) ring.push([a, d - (d - b) * i / 8]);
            parts.push(`<path d="${path([ring], true)}" fill="rgba(196,40,28,.18)" stroke="#C4281C" stroke-width="1.3"/>`);
        }
        if (opts.title) parts.push(`<text x="${width - 4}" y="${height - 5}" text-anchor="end" font-size="9" fill="#5a4a3a" font-family="Noto Serif SC,serif">${escapeHtml(opts.title)}</text>`);
        return `<svg viewBox="0 0 ${width} ${height}" width="${width}" height="${height}" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">${parts.join('')}</svg>`;
    }

    /* ---------- 基本几何 ---------- */
    function gBox() {
        const p = [], n = [], i = [];
        for (let ax = 0; ax < 3; ax += 1) for (const sg of [1, -1]) {
            const N = [0, 0, 0]; N[ax] = sg;
            const U = [0, 0, 0], V = [0, 0, 0];
            U[(ax + (sg > 0 ? 1 : 2)) % 3] = 1; V[(ax + (sg > 0 ? 2 : 1)) % 3] = 1;
            const b = p.length / 3;
            for (const [a, c] of [[-1, -1], [1, -1], [1, 1], [-1, 1]]) { for (let k = 0; k < 3; k += 1) p.push(N[k] * 0.5 + U[k] * a * 0.5 + V[k] * c * 0.5); n.push(...N); }
            i.push(b, b + 1, b + 2, b, b + 2, b + 3);
        }
        return { p, n, i };
    }
    function gCyl(S = 16, top = 1) {
        const p = [], n = [], i = [];
        for (let j = 0; j <= S; j += 1) { const a = j / S * Math.PI * 2, x = Math.cos(a), z = Math.sin(a); p.push(x, 0, z, x * top, 1, z * top); n.push(x, 0.3 * (1 - top), z, x, 0.3 * (1 - top), z); }
        for (let j = 0; j < S; j += 1) { const a = j * 2; i.push(a, a + 1, a + 2, a + 2, a + 1, a + 3); }
        for (const y of [0, 1]) {
            if (y === 1 && top === 0) break;
            const c = p.length / 3; p.push(0, y, 0); n.push(0, y ? 1 : -1, 0);
            for (let j = 0; j <= S; j += 1) { const a = j / S * Math.PI * 2, r = y ? top : 1; p.push(Math.cos(a) * r, y, Math.sin(a) * r); n.push(0, y ? 1 : -1, 0); }
            for (let j = 0; j < S; j += 1) i.push(c, c + 1 + j, c + 2 + j);
        }
        return { p, n, i };
    }
    function gSphere(S = 14, R = 10) {
        const p = [], n = [], i = [];
        for (let y = 0; y <= R; y += 1) { const v = y / R * Math.PI; for (let x = 0; x <= S; x += 1) { const u = x / S * Math.PI * 2, q = [Math.sin(v) * Math.cos(u), Math.cos(v), Math.sin(v) * Math.sin(u)]; p.push(...q); n.push(...q); } }
        for (let y = 0; y < R; y += 1) for (let x = 0; x < S; x += 1) { const a = y * (S + 1) + x, b = a + S + 1; i.push(a, b, a + 1, a + 1, b, b + 1); }
        return { p, n, i };
    }
    function gDisc(inner = 0, S = 36) {
        const p = [], n = [], i = [];
        for (let j = 0; j <= S; j += 1) { const a = j / S * Math.PI * 2, c = Math.cos(a), s = Math.sin(a); p.push(c, 0, s, c * inner, 0, s * inner); n.push(0, 1, 0, 0, 1, 0); }
        for (let j = 0; j < S; j += 1) { const a = j * 2; i.push(a, a + 1, a + 2, a + 2, a + 1, a + 3); }
        return { p, n, i };
    }
    function gFlag() {
        const p = [], n = [], i = [], NX = 8;
        for (let x = 0; x <= NX; x += 1) for (const y of [0, 1]) { p.push(x / NX, y, 0); n.push(0, 0, 1); }
        for (let x = 0; x < NX; x += 1) { const a = x * 2; i.push(a, a + 2, a + 1, a + 1, a + 2, a + 3); }
        return { p, n, i };
    }

    const VSRC = `#version 300 es
in vec3 aPos;in vec3 aNor;in vec2 aUv;uniform mat4 uVP,uM;out vec3 vN;out vec2 vUv;out vec3 vW;
void main(){vec4 w=uM*vec4(aPos,1.);vW=w.xyz;vN=mat3(uM)*aNor;vUv=aUv;gl_Position=uVP*w;}`;
    const FSRC = `#version 300 es
precision highp float;in vec3 vN;in vec2 vUv;in vec3 vW;
uniform vec4 uColor;uniform sampler2D uTex;uniform float uUseTex,uUnlit,uEdge;uniform vec3 uL,uCam,uFog;uniform vec2 uFogR;out vec4 o;
void main(){vec3 n=normalize(vN);vec3 V=uCam-vW;if(dot(n,V)<0.)n=-n;
vec3 base=uUseTex>.5?texture(uTex,vUv).rgb:uColor.rgb;
float df=max(dot(n,uL),0.);float sky=.5+.5*n.y;
vec3 c=uUnlit>.5?base:base*(.5+.18*sky+.46*df);
if(uUseTex<.5&&uUnlit<.5){vec3 h=normalize(uL+normalize(V));c+=pow(max(dot(n,h),0.),24.)*.12;}
float f=smoothstep(uFogR.x,uFogR.y,length(V));c=mix(c,uFog,f*.85);
if(uUseTex>.5){float e=min(min(vUv.x,1.-vUv.x),min(vUv.y,1.-vUv.y));c=mix(uFog,c,smoothstep(0.,uEdge,e));}
o=vec4(c,uColor.a);}`;

    // 统一的分层设色：低处偏沙黄，高原偏赭褐，极高处近雪白。
    const RAMP = [[0, [206, 208, 170]], [300, [218, 210, 170]], [700, [214, 196, 150]], [1200, [200, 176, 128]], [1800, [182, 154, 110]], [2600, [162, 136, 102]], [3600, [146, 124, 98]], [4600, [152, 142, 130]], [5400, [204, 200, 194]], [6500, [240, 238, 234]]];
    function ecol(e) {
        if (e <= RAMP[0][0]) return RAMP[0][1];
        for (let i = 0; i < RAMP.length - 1; i += 1) { const a = RAMP[i], b = RAMP[i + 1]; if (e <= b[0]) { const t = (e - a[0]) / (b[0] - a[0]); return [0, 1, 2].map((j) => a[1][j] + (b[1][j] - a[1][j]) * t); } }
        return RAMP[RAMP.length - 1][1];
    }

    function create(opts) {
        const { canvas, labelLayer, campaign, map } = opts;
        const onUnitClick = opts.onUnitClick || (() => {});
        const onFollowChange = opts.onFollowChange || (() => {});
        const onCampaignClick = opts.onCampaignClick || (() => {});
        if (!map || !map.dem || !map.vec) throw new Error('map data is required');
        const gl = canvas.getContext('webgl2', { antialias: true });
        if (!gl) return null;

        const C = campaign, GEO = C.geo, VEC = map.vec, DEM = map.dem, OVERVIEW = Boolean(GEO.overview);
        const [L0, B0, L1, B1] = GEO.bbox;
        const [TL0, TB0, TL1, TB1] = DEM.bbox;

        /* ---------- 投影到场景坐标 ---------- */
        const FB = projectedBox(GEO.bbox), SCALE = 100 / Math.max(FB[2] - FB[0], FB[3] - FB[1]);
        const CX = (FB[0] + FB[2]) / 2, CY = (FB[1] + FB[3]) / 2;
        const WW = (FB[2] - FB[0]) * SCALE, DD = (FB[3] - FB[1]) * SCALE, SIZE = Math.max(WW, DD);
        const TBX = projectedBox(DEM.bbox).map((v, i) => (v - (i % 2 ? CY : CX)) * SCALE);
        const XZ = (lon, lat) => { const [x, y] = ALBERS.fwd(lon, lat); return [(x - CX) * SCALE, -(y - CY) * SCALE]; };
        const unXZ = (x, z) => ALBERS.inv(x / SCALE + CX, -z / SCALE + CY);
        let EX = 1;
        const hY = (m) => Math.max(0, m) / 1000 * SCALE * GEO.vex * EX;

        /* ---------- 高程 ---------- */
        const DW = DEM.w, DH = DEM.h, DZ = DEM.data;
        function demAt(lon, lat) {
            const fx = clamp((lon - TL0) / (TL1 - TL0), 0, 1) * (DW - 1), fy = clamp((TB1 - lat) / (TB1 - TB0), 0, 1) * (DH - 1);
            const x = Math.min(DW - 2, Math.floor(fx)), y = Math.min(DH - 2, Math.floor(fy)), u = fx - x, v = fy - y, i = y * DW + x;
            return DZ[i] * (1 - u) * (1 - v) + DZ[i + 1] * u * (1 - v) + DZ[i + DW] * (1 - u) * v + DZ[i + DW + 1] * u * v;
        }
        const GW = OVERVIEW ? Math.min(520, Math.round(DW * 0.8)) : clamp(Math.round(DW * 1.5), 220, 340);
        const GH = Math.max(2, Math.round((GW - 1) * (DH - 1) / (DW - 1)) + 1);
        const gLon = (gx) => TL0 + gx / (GW - 1) * (TL1 - TL0), gLat = (gy) => TB1 - gy / (GH - 1) * (TB1 - TB0);
        const tPx = (lon, W) => (lon - TL0) / (TL1 - TL0) * W, tPy = (lat, H) => (TB1 - lat) / (TB1 - TB0) * H;

        // 河流在高程上刻出浅谷：先把河道画到与网格同尺寸的蒙版上，再模糊。
        const allRivers = (VEC.rivers || []).map((r) => ({ name: r.name, rank: r.rank, pts: r.pts, ne: true })).concat((GEO.rivers || []).map((r) => ({ ...r, custom: true })));
        function riverMask() {
            const m = new Float32Array(GW * GH);
            if (OVERVIEW || typeof document === 'undefined') return m;
            const cv = document.createElement('canvas'); cv.width = GW; cv.height = GH;
            const ctx = cv.getContext('2d'); ctx.lineCap = 'round'; ctx.lineJoin = 'round'; ctx.strokeStyle = '#fff';
            for (const r of allRivers) {
                ctx.lineWidth = r.custom ? (r.wide ? 2.2 : 1.4) : r.rank <= 1 ? 2.4 : r.rank <= 6 ? 1.8 : 1.2;
                ctx.beginPath(); r.pts.forEach((p, i) => (i ? ctx.lineTo(tPx(p[0], GW - 1), tPy(p[1], GH - 1)) : ctx.moveTo(tPx(p[0], GW - 1), tPy(p[1], GH - 1)))); ctx.stroke();
            }
            const d = ctx.getImageData(0, 0, GW, GH).data;
            for (let i = 0; i < m.length; i += 1) m[i] = d[i * 4 + 3] / 255;
            const tmp = new Float32Array(m.length);
            for (let pass = 0; pass < 2; pass += 1) {
                for (let y = 0; y < GH; y += 1) for (let x = 0; x < GW; x += 1) { let s = 0, c = 0; for (let k = -1; k <= 1; k += 1) { const xx = x + k; if (xx >= 0 && xx < GW) { s += m[y * GW + xx]; c += 1; } } tmp[y * GW + x] = s / c; }
                for (let y = 0; y < GH; y += 1) for (let x = 0; x < GW; x += 1) { let s = 0, c = 0; for (let k = -1; k <= 1; k += 1) { const yy = y + k; if (yy >= 0 && yy < GH) { s += tmp[yy * GW + x]; c += 1; } } m[y * GW + x] = s / c; }
            }
            return m;
        }
        const EG = new Float32Array(GW * GH);
        {
            const mask = riverMask(), sc = 1 / (DEM.res * 1.2);
            for (let gy = 0; gy < GH; gy += 1) for (let gx = 0; gx < GW; gx += 1) {
                const lon = gLon(gx), lat = gLat(gy), i = gy * GW + gx;
                let e = demAt(lon, lat);
                if (!OVERVIEW) {
                    const relief = clamp((e - 200) / 1500, 0.15, 1);
                    const n = fbm(lon * sc + 3, lat * sc + 7, 4), r = 1 - Math.abs(2 * fbm(lon * sc * 2.3, lat * sc * 2.3, 3) - 1);
                    e += ((n - 0.5) * 170 + (r * r - 0.33) * 120) * relief;
                    e -= mask[i] * Math.min(320, Math.max(0, e) * 0.2);
                }
                EG[i] = e;
            }
        }
        function elev(lon, lat) {
            const fx = clamp((lon - TL0) / (TL1 - TL0), 0, 1) * (GW - 1), fy = clamp((TB1 - lat) / (TB1 - TB0), 0, 1) * (GH - 1);
            const x = Math.min(GW - 2, Math.floor(fx)), y = Math.min(GH - 2, Math.floor(fy)), u = fx - x, v = fy - y, i = y * GW + x;
            return EG[i] * (1 - u) * (1 - v) + EG[i + 1] * u * (1 - v) + EG[i + GW] * (1 - u) * v + EG[i + GW + 1] * u * v;
        }
        const P = (ll, off = 0) => { const [x, z] = XZ(ll[0], ll[1]); return [x, hY(elev(ll[0], ll[1])) + off, z]; };

        /* ---------- 贴图 ---------- */
        function catmull(pts) {
            const out = [pts[0]];
            for (let i = 0; i < pts.length - 1; i += 1) {
                const p0 = pts[i - 1] || pts[i], p1 = pts[i], p2 = pts[i + 1], p3 = pts[i + 2] || p2;
                for (let s = 1; s <= 8; s += 1) { const t = s / 8, t2 = t * t, t3 = t2 * t; out.push([0, 1].map((k) => 0.5 * ((2 * p1[k]) + (-p0[k] + p2[k]) * t + (2 * p0[k] - 5 * p1[k] + 4 * p2[k] - p3[k]) * t2 + (-p0[k] + 3 * p1[k] - 3 * p2[k] + p3[k]) * t3))); }
            }
            return out;
        }
        function contourStep() {
            const s = Array.from(EG).filter((v) => v > 0).sort((a, b) => a - b);
            if (!s.length) return 100;
            const rng = s[Math.floor(s.length * 0.98)] - s[Math.floor(s.length * 0.02)];
            return [50, 100, 200, 250, 500, 1000].find((c) => rng / c <= 28) || 1000;
        }
        function buildTexture(maxSize) {
            const midCos = Math.cos((TB0 + TB1) / 2 * Math.PI / 180), aspect = (TL1 - TL0) * midCos / (TB1 - TB0);
            const LIM = Math.min(maxSize, OVERVIEW ? 3600 : 2400);
            let TW = aspect >= 1 ? LIM : Math.round(LIM * aspect), TH = aspect >= 1 ? Math.round(LIM / aspect) : LIM;
            TW = Math.max(64, TW); TH = Math.max(64, TH);
            const cv = document.createElement('canvas'); cv.width = TW; cv.height = TH;
            const ctx = cv.getContext('2d'), img = ctx.createImageData(TW, TH), d = img.data, E = new Float32Array(TW * TH);
            for (let y = 0; y < TH; y += 1) { const lat = TB1 - y / (TH - 1) * (TB1 - TB0); for (let x = 0; x < TW; x += 1) E[y * TW + x] = elev(TL0 + x / (TW - 1) * (TL1 - TL0), lat); }
            const pxM = (TB1 - TB0) * 110570 / TH, shadeK = 0.1 * Math.min(GEO.vex, 12) / pxM, ci = contourStep();
            for (let y = 0; y < TH; y += 1) for (let x = 0; x < TW; x += 1) {
                const i = y * TW + x, e = E[i], p = i * 4;
                if (OVERVIEW && e < -2) {
                    const lon = TL0 + x / (TW - 1) * (TL1 - TL0), lat = TB1 - y / (TH - 1) * (TB1 - TB0);
                    if (!(lon > 87.5 && lon < 91 && lat > 41.8 && lat < 43.8)) { // 吐鲁番盆地低于海平面，但不是海
                        const t = clamp(-e / 3000, 0, 1);
                        d[p] = 184 - 34 * t; d[p + 1] = 206 - 22 * t; d[p + 2] = 214 - 8 * t; d[p + 3] = 255; continue;
                    }
                }
                const c = ecol(e);
                const right = E[i + (x < TW - 1 ? 1 : 0)], down = E[i + (y < TH - 1 ? TW : 0)];
                const ex = right - E[i - (x > 0 ? 1 : 0)], ey = down - E[i - (y > 0 ? TW : 0)];
                const sh = clamp(1 + (-ex - ey) * shadeK, 0.68, 1.26), g = 0.95 + 0.1 * hash(x * 7 + 3, y * 13 + 1);
                let r = c[0] * sh * g, gg = c[1] * sh * g, b = c[2] * sh * g;
                const b0 = Math.floor(e / ci), b1 = Math.floor(right / ci), b2 = Math.floor(down / ci);
                if (e > 0 && (b0 !== b1 || b0 !== b2)) { const a = Math.max(b0, b1, b2) % 5 === 0 ? 0.3 : 0.13; r *= 1 - a; gg *= 1 - a; b *= 1 - a * 0.9; }
                d[p] = r; d[p + 1] = gg; d[p + 2] = b; d[p + 3] = 255;
            }
            ctx.putImageData(img, 0, 0);

            // 线宽与字号按“场景单位”给出，换算成贴图像素，保证不同战役在屏幕上观感一致。
            const pxw = TW / (TBX[2] - TBX[0]), W = (w) => Math.max(1, w * pxw);
            const tx = (lon) => tPx(lon, TW), ty = (lat) => tPy(lat, TH);
            const line = (pts) => { ctx.beginPath(); pts.forEach((q, i) => (i ? ctx.lineTo(tx(q[0]), ty(q[1])) : ctx.moveTo(tx(q[0]), ty(q[1])))); };
            const font = (weight, size, italic) => `${italic ? 'italic ' : ''}${weight} ${Math.round(W(size))}px "Noto Serif SC",serif`;
            ctx.lineCap = 'round'; ctx.lineJoin = 'round';

            if (VEC.neighbors && VEC.neighbors.length) {
                ctx.fillStyle = 'rgba(238,233,222,.62)';
                for (const ring of VEC.neighbors) { line(ring); ctx.closePath(); ctx.fill(); }
            }
            // 经纬网
            const gs = GEO.grid || (OVERVIEW ? 10 : 0.5), fmt = (v) => String(Math.round(v * 100) / 100);
            ctx.strokeStyle = 'rgba(50,35,20,.16)'; ctx.lineWidth = W(OVERVIEW ? 0.08 : 0.1); ctx.fillStyle = 'rgba(50,35,20,.5)'; ctx.font = font(500, OVERVIEW ? 1.1 : 1.5);
            for (let lon = Math.ceil(TL0 / gs) * gs; lon <= TL1; lon += gs) { ctx.beginPath(); ctx.moveTo(tx(lon), 0); ctx.lineTo(tx(lon), TH); ctx.stroke(); if (lon >= L0 && lon <= L1) ctx.fillText(`${fmt(lon)}°E`, tx(lon) + W(0.3), ty(Math.min(B1, TB1)) + W(2)); }
            for (let lat = Math.ceil(TB0 / gs) * gs; lat <= TB1; lat += gs) { ctx.beginPath(); ctx.moveTo(0, ty(lat)); ctx.lineTo(TW, ty(lat)); ctx.stroke(); if (lat >= B0 && lat <= B1) ctx.fillText(`${fmt(lat)}°N`, tx(Math.max(L0, TL0)) + W(0.4), ty(lat) - W(0.4)); }

            // 河流：Natural Earth 干流 + 战役自绘支流
            const rw = (r) => (OVERVIEW ? (r.rank <= 1 ? 0.3 : r.rank <= 3 ? 0.22 : r.rank <= 5 ? 0.15 : 0.1) : (r.rank <= 1 ? 0.95 : r.rank <= 5 ? 0.7 : r.rank <= 7 ? 0.5 : 0.36));
            const neRivers = allRivers.filter((r) => r.ne && (!OVERVIEW || r.rank <= 6));
            for (const pass of [0, 1]) {
                for (const r of neRivers) {
                    line(r.pts);
                    ctx.strokeStyle = pass ? '#4a83aa' : 'rgba(234,238,228,.65)'; ctx.lineWidth = W(rw(r)) + (pass ? 0 : W(0.25)); ctx.stroke();
                }
                for (const r of allRivers.filter((x) => x.custom)) {
                    const pts = catmull(r.pts.map((q) => [tx(q[0]), ty(q[1])]));
                    ctx.beginPath(); pts.forEach((q, i) => (i ? ctx.lineTo(q[0], q[1]) : ctx.moveTo(q[0], q[1])));
                    ctx.strokeStyle = pass ? '#3b78a2' : 'rgba(232,236,226,.7)'; ctx.lineWidth = W(r.width * 0.15) + (pass ? 0 : W(0.3)); ctx.stroke();
                }
            }
            // 海岸、省界、国界
            if (VEC.coast && VEC.coast.length) { ctx.strokeStyle = 'rgba(70,110,140,.85)'; ctx.lineWidth = W(OVERVIEW ? 0.12 : 0.3); for (const l of VEC.coast) { line(l); ctx.stroke(); } }
            if (VEC.provinces && VEC.provinces.length) {
                const w = W(OVERVIEW ? 0.1 : 0.26);
                ctx.strokeStyle = 'rgba(244,236,214,.55)'; ctx.lineWidth = w * 2.6; for (const l of VEC.provinces) { line(l); ctx.stroke(); }
                ctx.strokeStyle = 'rgba(112,64,42,.62)'; ctx.lineWidth = w; ctx.setLineDash([w * 6, w * 3, w * 1.2, w * 3]);
                for (const l of VEC.provinces) { line(l); ctx.stroke(); }
                ctx.setLineDash([]);
            }
            const borders = (VEC.border || []).concat(VEC.dash || []);
            if (borders.length) {
                const w = W(OVERVIEW ? 0.22 : 0.5);
                ctx.strokeStyle = 'rgba(196,72,52,.22)'; ctx.lineWidth = w * 3.4; for (const l of borders) { line(l); ctx.stroke(); }
                ctx.strokeStyle = '#963a2c'; ctx.lineWidth = w; for (const l of borders) { line(l); ctx.stroke(); }
            }

            // 文字：省名、山名、河名
            const halo = (txt, x, y, color, haloColor) => { ctx.strokeStyle = haloColor; ctx.lineWidth = W(0.25); ctx.strokeText(txt, x, y); ctx.fillStyle = color; ctx.fillText(txt, x, y); };
            ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
            const regionNames = new Set((GEO.regions || []).map((r) => r[0].replace(/\s+/g, '')));
            ctx.font = font(900, OVERVIEW ? 1.9 : 4.6);
            for (const l of VEC.labels || []) {
                if (regionNames.has(l.name)) continue;
                const txt = OVERVIEW ? l.name : l.name.split('').join(' ');
                if (OVERVIEW) halo(txt, tx(l.at[0]), ty(l.at[1]), 'rgba(88,52,30,.62)', 'rgba(248,242,226,.5)');
                else { ctx.fillStyle = 'rgba(60,38,18,.2)'; ctx.fillText(txt, tx(l.at[0]), ty(l.at[1])); }
            }
            ctx.fillStyle = 'rgba(60,38,18,.2)'; ctx.font = font(900, 5.2); ctx.textAlign = 'left'; ctx.textBaseline = 'alphabetic';
            for (const [s, a, b] of GEO.regions || []) ctx.fillText(s, tx(a), ty(b));
            ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
            const custom = new Set((GEO.rivers || []).map((r) => r.name));
            const best = new Map();
            for (const r of neRivers) {
                if (!r.name || custom.has(r.name) || r.rank > (OVERVIEW ? 3 : 8)) continue;
                let len = 0; for (let i = 1; i < r.pts.length; i += 1) len += Math.hypot(r.pts[i][0] - r.pts[i - 1][0], r.pts[i][1] - r.pts[i - 1][1]);
                if (!best.has(r.name) || best.get(r.name).len < len) best.set(r.name, { r, len });
            }
            ctx.font = font(600, OVERVIEW ? 1.25 : 2.6, true);
            for (const { r } of best.values()) {
                const pts = r.pts, m = Math.floor(pts.length / 2), a = pts[Math.max(0, m - 3)], b = pts[Math.min(pts.length - 1, m + 3)];
                let ang = Math.atan2(ty(b[1]) - ty(a[1]), tx(b[0]) - tx(a[0]));
                if (ang > Math.PI / 2) ang -= Math.PI; if (ang < -Math.PI / 2) ang += Math.PI;
                ctx.save(); ctx.translate(tx(pts[m][0]), ty(pts[m][1])); ctx.rotate(ang); ctx.translate(0, -W(OVERVIEW ? 0.9 : 1.6));
                halo(r.name, 0, 0, '#2c5f86', 'rgba(240,238,226,.75)'); ctx.restore();
            }
            ctx.textAlign = 'left'; ctx.textBaseline = 'alphabetic'; ctx.font = font(600, 2.8, true);
            for (const r of GEO.rivers || []) {
                if (!r.label) continue;
                ctx.save(); ctx.translate(tx(r.label[0]), ty(r.label[1])); ctx.rotate(r.label[2] || 0); halo(r.name, 0, 0, '#2c5f86', 'rgba(240,238,226,.75)'); ctx.restore();
            }
            return cv;
        }

        /* ---------- WebGL ---------- */
        function shader(type, src) { const s = gl.createShader(type); gl.shaderSource(s, src); gl.compileShader(s); if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) throw new Error(gl.getShaderInfoLog(s)); return s; }
        const prog = gl.createProgram();
        gl.attachShader(prog, shader(gl.VERTEX_SHADER, VSRC)); gl.attachShader(prog, shader(gl.FRAGMENT_SHADER, FSRC));
        gl.bindAttribLocation(prog, 0, 'aPos'); gl.bindAttribLocation(prog, 1, 'aNor'); gl.bindAttribLocation(prog, 2, 'aUv');
        gl.linkProgram(prog);
        const U = {};
        ['uVP', 'uM', 'uColor', 'uTex', 'uUseTex', 'uUnlit', 'uEdge', 'uL', 'uCam', 'uFog', 'uFogR'].forEach((n) => { U[n] = gl.getUniformLocation(prog, n); });

        function mesh(g) {
            const vao = gl.createVertexArray(); gl.bindVertexArray(vao); const bufs = [];
            [[g.p, 3], [g.n, 3], [g.u || new Float32Array(g.p.length / 3 * 2), 2]].forEach(([a, s], i) => {
                const b = gl.createBuffer(); gl.bindBuffer(gl.ARRAY_BUFFER, b);
                gl.bufferData(gl.ARRAY_BUFFER, a instanceof Float32Array ? a : new Float32Array(a), gl.STATIC_DRAW);
                gl.enableVertexAttribArray(i); gl.vertexAttribPointer(i, s, gl.FLOAT, false, 0, 0); bufs.push(b);
            });
            const ib = gl.createBuffer(); gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, ib); gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, g.i instanceof Uint32Array ? g.i : new Uint32Array(g.i), gl.STATIC_DRAW);
            gl.bindVertexArray(null);
            return { vao, bufs, ib, count: g.i.length };
        }
        function freeMesh(m) { if (!m) return; m.bufs.forEach((b) => gl.deleteBuffer(b)); gl.deleteBuffer(m.ib); gl.deleteVertexArray(m.vao); }
        const GEOM = { box: mesh(gBox()), cyl: mesh(gCyl()), sph: mesh(gSphere()), ring: mesh(gDisc(0.78)), disc: mesh(gDisc(0)), flag: mesh(gFlag()), cone: mesh(gCyl(16, 0)) };
        const tex = gl.createTexture();
        function uploadTex(src) {
            gl.bindTexture(gl.TEXTURE_2D, tex); gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, false);
            gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, src); gl.generateMipmap(gl.TEXTURE_2D);
            gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR_MIPMAP_LINEAR); gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
            gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE); gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
            const af = gl.getExtension('EXT_texture_filter_anisotropic'); if (af) gl.texParameterf(gl.TEXTURE_2D, af.TEXTURE_MAX_ANISOTROPY_EXT, 8);
        }
        { const c0 = document.createElement('canvas'); c0.width = c0.height = 4; const x0 = c0.getContext('2d'); x0.fillStyle = '#d6cba8'; x0.fillRect(0, 0, 4, 4); uploadTex(c0); }

        /* ---------- 几何构建 ---------- */
        function terrainGeom() {
            const N = GW * GH, p = new Float32Array(N * 3), n = new Float32Array(N * 3), u = new Float32Array(N * 2), i = new Uint32Array((GW - 1) * (GH - 1) * 6);
            for (let z = 0; z < GH; z += 1) for (let x = 0; x < GW; x += 1) {
                const k = z * GW + x, [X, Z] = XZ(gLon(x), gLat(z));
                p[k * 3] = X; p[k * 3 + 1] = hY(EG[k]); p[k * 3 + 2] = Z; u[k * 2] = x / (GW - 1); u[k * 2 + 1] = z / (GH - 1);
            }
            for (let z = 0; z < GH; z += 1) for (let x = 0; x < GW; x += 1) {
                const k = z * GW + x, xl = z * GW + Math.max(0, x - 1), xr = z * GW + Math.min(GW - 1, x + 1), zu = Math.max(0, z - 1) * GW + x, zd = Math.min(GH - 1, z + 1) * GW + x;
                const dx = [p[xr * 3] - p[xl * 3], p[xr * 3 + 1] - p[xl * 3 + 1], p[xr * 3 + 2] - p[xl * 3 + 2]];
                const dz = [p[zd * 3] - p[zu * 3], p[zd * 3 + 1] - p[zu * 3 + 1], p[zd * 3 + 2] - p[zu * 3 + 2]];
                const nn = norm(cross(dz, dx)); n[k * 3] = nn[0]; n[k * 3 + 1] = nn[1]; n[k * 3 + 2] = nn[2];
            }
            let q = 0;
            for (let z = 0; z < GH - 1; z += 1) for (let x = 0; x < GW - 1; x += 1) { const a = z * GW + x, b = a + 1, c = a + GW, d = c + 1; i[q++] = a; i[q++] = c; i[q++] = b; i[q++] = b; i[q++] = c; i[q++] = d; }
            return { p, n, u, i };
        }
        const STEP = Math.min((L1 - L0) / 300, 0.05);
        function dense(nodes, times) {
            const out = [];
            for (let k = 0; k < nodes.length - 1; k += 1) {
                const a = nodes[k], b = nodes[k + 1], cs = Math.cos(a[1] * Math.PI / 180), L = Math.hypot((b[0] - a[0]) * cs, b[1] - a[1]), n = Math.max(1, Math.ceil(L / STEP));
                for (let s = 0; s < n; s += 1) { const t = s / n; out.push({ ll: [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t], t: times ? times[k] + (times[k + 1] - times[k]) * t : 0 }); }
            }
            const l = nodes[nodes.length - 1]; out.push({ ll: l, t: times ? times[times.length - 1] : 0 });
            return out;
        }
        function tubeGeom(pts, rad, R = 7) {
            const p = [], n = [], i = [];
            for (let k = 0; k < pts.length; k += 1) {
                const a = pts[Math.max(0, k - 1)], b = pts[Math.min(pts.length - 1, k + 1)], t = norm(sub(b, a));
                let nx = norm(cross(t, [0, 1, 0])); if (!Number.isFinite(nx[0])) nx = [1, 0, 0];
                const by = cross(nx, t);
                for (let j = 0; j < R; j += 1) { const an = j / R * Math.PI * 2, c = Math.cos(an), s = Math.sin(an), d = [nx[0] * c + by[0] * s, nx[1] * c + by[1] * s, nx[2] * c + by[2] * s]; p.push(pts[k][0] + d[0] * rad, pts[k][1] + d[1] * rad, pts[k][2] + d[2] * rad); n.push(...d); }
            }
            for (let k = 0; k < pts.length - 1; k += 1) for (let j = 0; j < R; j += 1) { const a = k * R + j, b = k * R + (j + 1) % R, c = a + R, d = b + R; i.push(a, c, b, b, c, d); }
            return { g: { p, n, i }, per: R * 6 };
        }
        const BOX = gBox();
        function dashGeom(pts, { w = 0.2, h = 0.14, dash = 0.9, gap = 0.55 } = {}) {
            const cum = [0]; for (let k = 1; k < pts.length; k += 1) cum.push(cum[k - 1] + Math.hypot(...sub(pts[k], pts[k - 1])));
            let seg = 1;
            const at = (s) => { while (seg < pts.length - 1 && cum[seg] < s) seg += 1; const t = clamp((s - cum[seg - 1]) / ((cum[seg] - cum[seg - 1]) || 1), 0, 1); return { p: pts[seg - 1].map((v, j) => v + (pts[seg][j] - v) * t), k: seg - 1 }; };
            const p = [], n = [], i = [], idx = [];
            for (let s = 0; s + dash <= cum[cum.length - 1]; s += dash + gap) {
                const A = at(s), B = at(s + dash), m = A.p.map((v, j) => (v + B.p[j]) / 2), z = norm(sub(B.p, A.p)), x = norm(cross([0, 1, 0], z)), y = cross(z, x), L = Math.hypot(...sub(B.p, A.p));
                const b = p.length / 3;
                for (let v = 0; v < BOX.p.length; v += 3) {
                    const q = [BOX.p[v] * w, BOX.p[v + 1] * h, BOX.p[v + 2] * L], nn = [BOX.n[v], BOX.n[v + 1], BOX.n[v + 2]];
                    for (let j = 0; j < 3; j += 1) { p.push(m[j] + x[j] * q[0] + y[j] * q[1] + z[j] * q[2]); n.push(x[j] * nn[0] + y[j] * nn[1] + z[j] * nn[2]); }
                }
                BOX.i.forEach((q) => i.push(b + q)); idx.push(A.k);
            }
            return { g: { p, n, i }, idx };
        }

        /* ---------- 部队 ---------- */
        const UNITS = C.units.map((u, index) => ({ ...u, index, from: u.from ?? -Infinity, until: u.until ?? Infinity }));
        function unitAt(u, t) {
            const k = u.k;
            if (t <= k[0][0]) return [k[0][1], k[0][2], k[0][3] ?? 1];
            for (let i = 0; i < k.length - 1; i += 1) {
                const a = k[i], b = k[i + 1];
                if (t <= b[0]) { let s = (t - a[0]) / ((b[0] - a[0]) || 1); if (!u.linear) s = smooth(s); return [a[1] + (b[1] - a[1]) * s, a[2] + (b[2] - a[2]) * s, (a[3] ?? 1) + ((b[3] ?? 1) - (a[3] ?? 1)) * s]; }
            }
            const l = k[k.length - 1]; return [l[1], l[2], l[3] ?? 1];
        }
        const MAIN = UNITS.find((u) => u.main) || UNITS[0];
        const MAIN_DENSE = dense(MAIN.k.map((k) => [k[1], k[2]]), MAIN.k.map((k) => k[0]));
        const TRAIL_SRC = UNITS.filter((u) => u !== MAIN && u.k.length > 2).map((u) => {
            const t0 = Math.max(u.k[0][0], Number.isFinite(u.from) ? u.from : u.k[0][0]), t1 = Math.min(u.k[u.k.length - 1][0], u.until), step = (C.maxDay || 1) / 170, nodes = [], times = [];
            for (let t = t0; t <= t1 + 1e-6; t += step) { const s = unitAt(u, t); nodes.push([s[0], s[1]]); times.push(t); }
            if (nodes.length < 2) { const s = unitAt(u, t1); nodes.push([s[0], s[1]]); times.push(t1); }
            return { u, d: dense(nodes, times) };
        });
        const S = OVERVIEW ? 0.7 : 1; // 全图上部队与标记略缩小

        let terrain, route, ghost, trails = [], overlayMeshes = [];
        function buildDraped() {
            freeMesh(terrain); freeMesh(route && route.m); freeMesh(ghost);
            trails.forEach((t) => freeMesh(t.m)); overlayMeshes.forEach((o) => freeMesh(o.m));
            terrain = mesh(terrainGeom());
            const tg = tubeGeom(MAIN_DENSE.map((s) => P(s.ll, 0.38 * S)), 0.3 * S); route = { m: mesh(tg.g), per: tg.per };
            ghost = mesh(dashGeom(MAIN_DENSE.map((s) => P(s.ll, 0.22 * S)), { w: 0.16 * S, h: 0.1 * S, dash: 0.55 * S, gap: 0.6 * S }).g);
            trails = TRAIL_SRC.map(({ u, d }) => { const g = dashGeom(d.map((s) => P(s.ll, 0.2 * S)), { w: 0.14 * S, h: 0.08 * S, dash: 0.4 * S, gap: 0.45 * S }); return { u, m: mesh(g.g), times: g.idx.map((k) => d[k].t) }; });
            overlayMeshes = (C.overlays || []).filter((o) => o.type === 'dash').map((o) => {
                const pts = dense(o.nodes).map((s) => P(s.ll, 0.36));
                return { o, m: mesh(dashGeom(pts, { w: 0.32, h: 0.26, dash: 1.0, gap: 0.6 }).g), tip: pts[pts.length - 1], dir: norm(sub(pts[pts.length - 1], pts[Math.max(0, pts.length - 4)])) };
            });
        }
        buildDraped();

        /* ---------- 标签 ---------- */
        const labels = [];
        function label(html, cls, pos, o = {}) {
            const e = document.createElement(o.tag || 'div'); e.className = `sb-lb ${cls}`; e.innerHTML = html; labelLayer.appendChild(e);
            const L = { e, pos, vis: true, ax: o.ax ?? -0.5, ay: o.ay ?? -1, dy: o.dy ?? 0 }; labels.push(L); return L;
        }
        const placeL = GEO.places.map(([n, a, b, major]) => label(escapeHtml(n), `place${major ? ' city' : ''}`, () => P([a, b], 0.5 * S), { dy: -6 }));
        const markerL = (C.markers || []).filter((m) => m.type !== 'bridge').map((m) => {
            let L;
            if (m.type === 'crossing') { L = label(`<i>${escapeHtml(m.n)}</i><span>${escapeHtml(m.label)}</span>`, 'xing', () => P(m.at, 3.6 * S), { ax: -0.15, dy: -2 }); L.txt = L.e.querySelector('span'); L.e.title = m.label; }
            else if (m.type === 'battle') L = label(escapeHtml(m.label), 'battle', () => P(m.at, 1.4 * S), { ax: 0, ay: -0.5 });
            else if (m.type === 'campaign') {
                L = label(`▶ ${escapeHtml(m.label)}`, 'camp', () => P(m.at, 2.6 * S), { tag: 'button', ax: -0.5, ay: -1 });
                L.e.type = 'button'; L.e.title = `进入沙盘：${m.label}`;
                L.e.addEventListener('click', () => onCampaignClick(m.id));
            } else L = label(escapeHtml(m.label), 'event', () => P(m.at, 2.4 * S), { ax: 0, ay: -0.5 });
            return { m, L };
        });
        const unitPos = new Map();
        const unitL = UNITS.map((u) => {
            const f = C.factions[u.faction];
            const L = label(escapeHtml(u.label || f.name), u.faction === 'red' ? 'redu' : 'unit', () => { const q = unitPos.get(u.index); return [q[0], q[1] + (u.faction === 'red' ? 4.3 : 3.2) * S, q[2]]; }, { ax: 0, ay: -0.5 });
            if (u.faction !== 'red') L.e.style.background = f.color;
            L.e.title = `${f.name}：点击查看档案`;
            L.e.addEventListener('click', () => onUnitClick(u.faction));
            return { u, L, text: u.label || f.name };
        });
        const noteL = (C.overlays || []).filter((o) => o.label || o.type === 'note').map((o) => {
            const at = o.type === 'note' ? o.at : o.labelAt;
            const L = label(escapeHtml(o.type === 'note' ? o.text : o.label), `note${o.tone === 'red' ? ' red' : ''}`, () => P(at, 1.5));
            if (o.type === 'dash' && o.color && o.tone !== 'red') L.e.style.background = o.color;
            return { o, L };
        });

        /* ---------- 相机 ---------- */
        const camAt = (ll) => { const [x, z] = XZ(ll[0], ll[1]); return [x, 0, z]; };
        // 竖屏时把相机拉远一些，保证全景能装下整个战场。
        const fit = () => { const r = canvas.getBoundingClientRect(), a = r.width && r.height ? r.width / r.height : 1.4; return clamp(1.3 / a, 1, 1.9); };
        const PRESETS = {
            all: () => (GEO.camera
                ? { th: GEO.camera.th ?? 0.32, ph: GEO.camera.ph ?? 0.86, r: SIZE * GEO.camera.r * fit(), tg: camAt(GEO.camera.at) }
                : { th: 0.32, ph: 0.86, r: SIZE * 1.04 * fit(), tg: [0, 0, DD * 0.04] }),
            top: () => ({ th: 0, ph: 0.06, r: SIZE * (OVERVIEW ? 0.95 : 1.18) * fit(), tg: GEO.camera ? camAt(GEO.camera.at) : [0, 0, 0] }),
            low: () => ({ th: -0.55, ph: 1.12, r: SIZE * (GEO.lowR || 0.46), tg: [mainPos[0], 0, mainPos[2]] }),
        };
        let mainPos = P([MAIN.k[0][1], MAIN.k[0][2]]);
        const cam = PRESETS.all(), camT = PRESETS.all();
        const RMIN = SIZE * (OVERVIEW ? 0.08 : 0.2), RMAX = SIZE * 2.2;
        let follow = false;
        function setFollow(v) { if (follow === v) return; follow = v; onFollowChange(v); }
        const ptrs = new Map(); let lastPinch = 0;
        const onDown = (e) => { canvas.setPointerCapture(e.pointerId); ptrs.set(e.pointerId, { x: e.clientX, y: e.clientY, b: e.button, sh: e.shiftKey }); canvas.classList.add('is-dragging'); lastPinch = 0; };
        const onMove = (e) => {
            const q = ptrs.get(e.pointerId); if (!q) return;
            const dx = e.clientX - q.x, dy = e.clientY - q.y; q.x = e.clientX; q.y = e.clientY;
            if (ptrs.size === 2) { const [a, b] = [...ptrs.values()], d = Math.hypot(a.x - b.x, a.y - b.y); if (lastPinch) camT.r = clamp(camT.r * lastPinch / d, RMIN, RMAX); lastPinch = d; pan(dx / 2, dy / 2); return; }
            if (q.b === 2 || q.sh) pan(dx, dy); else { camT.th -= dx * 0.006; camT.ph = clamp(camT.ph - dy * 0.005, 0.05, 1.38); }
        };
        const onUp = (e) => { ptrs.delete(e.pointerId); if (!ptrs.size) canvas.classList.remove('is-dragging'); lastPinch = 0; };
        const onWheel = (e) => { e.preventDefault(); camT.r = clamp(camT.r * Math.exp(e.deltaY * 0.0011), RMIN, RMAX); };
        const onCtx = (e) => e.preventDefault();
        function pan(dx, dy) {
            setFollow(false);
            const k = camT.r * 0.0016, c = Math.cos(camT.th), s = Math.sin(camT.th);
            camT.tg[0] = clamp(camT.tg[0] - (dx * c + dy * s) * k, TBX[0], TBX[2]);
            camT.tg[2] = clamp(camT.tg[2] - (-dx * s + dy * c) * k, -TBX[3], -TBX[1]);
        }
        canvas.addEventListener('pointerdown', onDown); canvas.addEventListener('pointermove', onMove);
        canvas.addEventListener('pointerup', onUp); canvas.addEventListener('pointercancel', onUp);
        canvas.addEventListener('wheel', onWheel, { passive: false }); canvas.addEventListener('contextmenu', onCtx);

        /* ---------- 渲染 ---------- */
        let T = 0, layers = { enemy: true, trail: true, ghost: true, place: true }, raf = 0, VP = I4, vw = 1, vh = 1;
        const reduce = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
        const stageColor = hex3((getComputedStyle(canvas).getPropertyValue('--stage').trim() || '#E6DFD0'));
        const COL = { red: hex3('#C4281C'), dark: [0.16, 0.13, 0.1], pole: [0.22, 0.2, 0.18], white: [1, 1, 1], gold: [0.86, 0.66, 0.2], chain: [0.18, 0.18, 0.2] };
        const EDGE = OVERVIEW ? 0.035 : 0.14;
        function draw(m, M, col, a = 1, o = {}) {
            gl.uniformMatrix4fv(U.uM, false, M); gl.uniform4f(U.uColor, col[0], col[1], col[2], a);
            gl.uniform1f(U.uUseTex, o.tex ? 1 : 0); gl.uniform1f(U.uUnlit, o.unlit ? 1 : 0);
            gl.bindVertexArray(m.vao); gl.drawElements(gl.TRIANGLES, o.count ?? m.count, gl.UNSIGNED_INT, 0);
        }
        function resize() {
            const r = canvas.getBoundingClientRect(), dpr = Math.min(window.devicePixelRatio || 1, 2);
            vw = Math.max(1, r.width); vh = Math.max(1, r.height);
            const W = Math.round(vw * dpr), H = Math.round(vh * dpr);
            if (canvas.width !== W || canvas.height !== H) { canvas.width = W; canvas.height = H; }
        }
        const fade = (t, a, b, r = 0.8) => (t < a - r || t > b + r ? 0 : t < a ? (t - (a - r)) / r : t > b ? 1 - (t - b) / r : 1);
        const dayScale = C.maxDay / 86;

        function frame(now) {
            raf = requestAnimationFrame(frame);
            const wave = reduce ? 0 : now / 1000, pulse = reduce ? 0.5 : (now / 1400) % 1;
            const m0 = unitAt(MAIN, T); mainPos = P([m0[0], m0[1]]);
            UNITS.forEach((u) => { const s = unitAt(u, T); const p = P([s[0], s[1]]); p.s = s[2]; p.on = T >= u.from && T <= u.until; unitPos.set(u.index, p); });
            if (follow) { camT.tg[0] += (mainPos[0] - camT.tg[0]) * 0.04; camT.tg[2] += (mainPos[2] - camT.tg[2]) * 0.04; }
            const kk = reduce ? 1 : 0.12;
            cam.th += (camT.th - cam.th) * kk; cam.ph += (camT.ph - cam.ph) * kk; cam.r += (camT.r - cam.r) * kk;
            for (let j = 0; j < 3; j += 1) cam.tg[j] += (camT.tg[j] - cam.tg[j]) * kk;
            { const ll = unXZ(cam.tg[0], cam.tg[2]); cam.tg[1] = hY(elev(ll[0], ll[1])) * 0.6; }
            const eye = [cam.tg[0] + cam.r * Math.sin(cam.ph) * Math.sin(cam.th), cam.tg[1] + cam.r * Math.cos(cam.ph), cam.tg[2] + cam.r * Math.sin(cam.ph) * Math.cos(cam.th)];
            resize();
            const up = Math.abs(Math.sin(cam.ph)) < 0.07 ? [-Math.sin(cam.th), 0, -Math.cos(cam.th)] : [0, 1, 0];
            VP = mul(persp(0.72, vw / vh, Math.max(0.3, cam.r * 0.02), cam.r * 4 + 400), lookAt(eye, cam.tg, up));
            gl.viewport(0, 0, canvas.width, canvas.height); gl.clearColor(stageColor[0], stageColor[1], stageColor[2], 1); gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);
            gl.enable(gl.DEPTH_TEST); gl.disable(gl.CULL_FACE); gl.useProgram(prog);
            gl.uniformMatrix4fv(U.uVP, false, VP); gl.uniform3fv(U.uL, norm([-0.55, 0.8, -0.35])); gl.uniform3fv(U.uCam, eye); gl.uniform3fv(U.uFog, stageColor);
            gl.uniform2f(U.uFogR, cam.r * 1.3, cam.r * 3 + 120); gl.uniform1f(U.uEdge, EDGE);
            gl.activeTexture(gl.TEXTURE0); gl.bindTexture(gl.TEXTURE_2D, tex); gl.uniform1i(U.uTex, 0);
            gl.disable(gl.BLEND); gl.depthMask(true);
            draw(terrain, I4, COL.white, 1, { tex: 1 });
            let seg = 0; while (seg < MAIN_DENSE.length - 1 && MAIN_DENSE[seg + 1].t <= T) seg += 1;
            if (seg) draw(route.m, I4, COL.red, 1, { count: seg * route.per });
            trails.forEach((tr) => {
                const isRed = tr.u.faction === 'red'; if (!isRed && !(layers.enemy && layers.trail)) return;
                let n = 0; while (n < tr.times.length && tr.times[n] <= T) n += 1;
                if (n) draw(tr.m, I4, hex3(C.factions[tr.u.faction].color), 1, { count: n * 36 });
            });
            for (const m of C.markers || []) {
                if (m.type === 'campaign') {
                    const p = P(m.at), act = T >= m.day && T <= (m.until ?? m.day);
                    draw(GEOM.cyl, trs(p, 0, [0.07, 2.5 * S, 0.07]), COL.pole);
                    draw(GEOM.cyl, trs(p, 0, [0.6 * S, 0.2, 0.6 * S]), act ? COL.red : [0.55, 0.32, 0.26]);
                    continue;
                }
                if (T < m.day - (m.type === 'battle' ? 0.5 * dayScale : 0)) continue;
                if (m.type === 'crossing') { const p = P(m.at); draw(GEOM.cyl, trs(p, 0, [0.11, 3.2 * S, 0.11]), COL.red); draw(GEOM.sph, trs([p[0], p[1] + 3.3 * S, p[2]], 0, [0.48 * S, 0.48 * S, 0.48 * S]), COL.red); }
                else if (m.type === 'battle') { const p = P(m.at, 0.55 * S); [0.785, -0.785].forEach((r) => draw(GEOM.box, trs(p, r, [2.1 * S, 0.24 * S, 0.24 * S]), COL.dark)); }
                else if (m.type === 'event' && T <= (m.until ?? m.day + 6 * dayScale)) { const p = P(m.at); draw(GEOM.cyl, trs(p, 0, [0.09, 2.3 * S, 0.09]), COL.pole); draw(GEOM.sph, trs([p[0], p[1] + 2.35 * S, p[2]], 0, [0.36 * S, 0.36 * S, 0.36 * S]), COL.gold); }
                else if (m.type === 'bridge') {
                    const a = P(m.a), b = P(m.b), y = Math.max(a[1], b[1]) + 0.5, mid = [(a[0] + b[0]) / 2, y, (a[2] + b[2]) / 2];
                    const L = Math.hypot(b[0] - a[0], b[2] - a[2]), ry = Math.atan2(-(b[2] - a[2]), b[0] - a[0]);
                    for (const off of [-0.18, -0.06, 0.06, 0.18]) draw(GEOM.box, trs([mid[0] - Math.sin(ry) * off, y, mid[2] - Math.cos(ry) * off], ry, [L, 0.05, 0.05]), COL.chain);
                    [a, b].forEach((q) => draw(GEOM.box, trs([q[0], (q[1] + y) / 2, q[2]], ry, [0.35, y - q[1] + 0.3, 0.6]), [0.55, 0.5, 0.45]));
                }
            }
            if (layers.place) GEO.places.forEach(([, a, b, major]) => draw(GEOM.cyl, trs(P([a, b]), 0, (major ? [0.32, 0.5, 0.32] : [0.2, 0.35, 0.2]).map((v) => v * S)), major ? [0.15, 0.13, 0.12] : [0.3, 0.27, 0.24]));
            UNITS.forEach((u) => {
                const p = unitPos.get(u.index); if (!p.on) return;
                if (u.faction === 'red') {
                    const big = (u === MAIN ? 1 : 0.72) * S;
                    draw(GEOM.cyl, trs(p, 0, [1 * big, 0.55 * big, 1 * big]), COL.red); draw(GEOM.cyl, trs([p[0], p[1] + 0.55 * big, p[2]], 0, [0.72 * big, 0.2 * big, 0.72 * big]), [0.95, 0.84, 0.55]);
                    draw(GEOM.cyl, trs(p, 0, [0.08, 3.8 * big, 0.08]), COL.pole);
                    draw(GEOM.flag, trs([p[0], p[1] + 3.8 * big - 1.15 * big, p[2]], Math.sin(wave * 1.6 + u.index) * 0.3 - 0.4, [1.9 * big, 1.15 * big, 1]), COL.red);
                    return;
                }
                if (!layers.enemy) return;
                const s = p.s, col = hex3(C.factions[u.faction].color).map((v) => v * (0.55 + 0.45 * s) + 0.27 * (1 - s)), sc = (0.65 + 0.35 * s) * S;
                draw(GEOM.box, trs([p[0], p[1] + 0.45 * sc, p[2]], 0.2 * u.index, [1.8 * sc, 0.9 * sc, 1.2 * sc]), col);
                draw(GEOM.cyl, trs([p[0] + 0.55 * sc, p[1], p[2]], 0, [0.06, 2.7 * S, 0.06]), COL.pole);
                draw(GEOM.flag, trs([p[0] + 0.55 * sc, p[1] + 1.95 * S, p[2]], Math.sin(wave * 1.3 + u.index) * 0.25, [1.25 * S, 0.72 * S, 1]), col);
            });
            gl.enable(gl.BLEND); gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA); gl.depthMask(false);
            if (layers.ghost) draw(ghost, I4, COL.red, 0.5);
            overlayMeshes.forEach(({ o, m, tip, dir }) => {
                const a = o.until != null ? fade(T, o.from ?? 0, o.until) : (T >= (o.from ?? 0) ? Math.min(1, (T - (o.from ?? 0)) / 2) : 0);
                if (!a) return;
                const col = hex3(o.color || '#C4281C'); draw(m, I4, col, 0.85 * a);
                if (o.arrow) { const Y = dir, Xv = norm(cross([0, 1, 0], Y)), Z = cross(Xv, Y), r = 0.55, len = 1.4; draw(GEOM.cone, new Float32Array([Xv[0] * r, Xv[1] * r, Xv[2] * r, 0, Y[0] * len, Y[1] * len, Y[2] * len, 0, Z[0] * r, Z[1] * r, Z[2] * r, 0, tip[0], tip[1], tip[2], 1]), col, a); }
            });
            const ring = 1.4 * S + pulse * 2.4 * S;
            draw(GEOM.ring, trs([mainPos[0], mainPos[1] + 0.12, mainPos[2]], 0, [ring, 1, ring]), COL.red, 0.55 * (1 - pulse), { unlit: 1 });
            for (const m of C.markers || []) {
                if (m.type === 'battle' && Math.abs(T - m.day) < 1.6 * dayScale) { const p = P(m.at, 0.2), r = (1.5 + pulse * 4) * S; draw(GEOM.ring, trs(p, 0, [r, 1, r]), COL.red, 0.8 * (1 - pulse), { unlit: 1 }); }
                if (m.type === 'crossing' && T >= m.day && T - m.day < 2.5 * dayScale) { const p = P(m.at, 0.15), r = (1 + pulse * 3) * S; draw(GEOM.ring, trs(p, 0, [r, 1, r]), COL.red, 0.7 * (1 - pulse), { unlit: 1 }); }
                if (m.type === 'campaign' && T >= m.day && T <= (m.until ?? m.day)) { const p = P(m.at, 0.15), r = (1.2 + pulse * 3) * S; draw(GEOM.ring, trs(p, 0, [r, 1, r]), COL.red, 0.7 * (1 - pulse), { unlit: 1 }); }
            }
            (C.overlays || []).forEach((o) => { if (o.ring && T >= (o.from ?? 0)) draw(GEOM.ring, trs(P(o.at, 0.2), 0, [2.2, 1, 2.2]), hex3('#4A5578'), 0.8, { unlit: 1 }); });
            gl.depthMask(true); gl.disable(gl.BLEND);

            placeL.forEach((L) => { L.vis = layers.place; });
            const recent = 5 * dayScale;
            markerL.forEach(({ m, L }) => {
                if (m.type === 'crossing') { L.vis = T >= m.day; L.txt.hidden = T - m.day > Math.max(recent, 1.5); }
                else if (m.type === 'battle') L.vis = T >= m.day - 0.5 * dayScale && T - m.day < 9 * dayScale + 1;
                else if (m.type === 'campaign') { L.vis = true; L.e.classList.toggle('is-active', T >= m.day && T <= (m.until ?? m.day)); }
                else L.vis = T >= m.day && T <= (m.until ?? m.day + 6 * dayScale);
            });
            unitL.forEach(({ u, L }) => {
                L.vis = unitPos.get(u.index).on && (u.faction === 'red' || layers.enemy);
                if (u.labels) { let txt = u.labels[0][1]; u.labels.forEach(([d, s]) => { if (T >= d) txt = s; }); if (L.e.textContent !== txt) L.e.textContent = txt; }
            });
            noteL.forEach(({ o, L }) => { L.vis = T >= (o.from ?? 0) && (o.until == null || T <= o.until); });
            for (const L of labels) {
                if (!L.vis) { L.e.hidden = true; continue; }
                const p = L.pos(), x = VP[0] * p[0] + VP[4] * p[1] + VP[8] * p[2] + VP[12], y = VP[1] * p[0] + VP[5] * p[1] + VP[9] * p[2] + VP[13], w = VP[3] * p[0] + VP[7] * p[1] + VP[11] * p[2] + VP[15];
                if (w <= 0.1) { L.e.hidden = true; continue; }
                const sx = (x / w * 0.5 + 0.5) * vw, sy = (1 - (y / w * 0.5 + 0.5)) * vh;
                if (sx < -60 || sx > vw + 60 || sy < -30 || sy > vh + 30) { L.e.hidden = true; continue; }
                L.e.hidden = false;
                L.e.style.transform = `translate(${sx.toFixed(1)}px,${(sy + L.dy).toFixed(1)}px) translate(${L.ax * 100}%,${L.ay * 100}%)`;
            }
        }
        raf = requestAnimationFrame(frame);

        let disposed = false;
        const glyphs = `${(GEO.regions || []).map((r) => r[0]).join('')}${(VEC.labels || []).map((l) => l.name).join('')}${allRivers.map((r) => r.name || '').join('')}°ENW0123456789.`;
        const fontsReady = document.fonts && document.fonts.load
            ? Promise.race([Promise.all([document.fonts.load('900 40px "Noto Serif SC"', glyphs), document.fonts.load('italic 600 40px "Noto Serif SC"', glyphs)]), new Promise((r) => setTimeout(r, 2500))])
            : Promise.resolve();
        fontsReady.catch(() => {}).then(() => { if (!disposed) uploadTex(buildTexture(gl.getParameter(gl.MAX_TEXTURE_SIZE) || 4096)); });

        return {
            setTime(t) { T = clamp(t, 0, C.maxDay); },
            setLayers(next) { layers = { ...layers, ...next }; },
            setExaggeration(x) { EX = x; buildDraped(); },
            exaggerationFactor(x) { return Math.round(GEO.vex * x); },
            preset(name) { const p = PRESETS[name] && PRESETS[name](); if (!p) return; Object.assign(camT, p); setFollow(name === 'low'); },
            setFollow(v) { setFollow(v); const fr = SIZE * (GEO.followR || 0.64); if (v && camT.r > fr * 1.25) camT.r = fr; },
            isFollowing() { return follow; },
            destroy() {
                disposed = true; cancelAnimationFrame(raf);
                labels.forEach((L) => L.e.remove());
                canvas.removeEventListener('pointerdown', onDown); canvas.removeEventListener('pointermove', onMove);
                canvas.removeEventListener('pointerup', onUp); canvas.removeEventListener('pointercancel', onUp);
                canvas.removeEventListener('wheel', onWheel); canvas.removeEventListener('contextmenu', onCtx);
                freeMesh(terrain); freeMesh(route && route.m); freeMesh(ghost);
                trails.forEach((t) => freeMesh(t.m)); overlayMeshes.forEach((o) => freeMesh(o.m)); Object.values(GEOM).forEach(freeMesh);
                gl.deleteTexture(tex); gl.deleteProgram(prog);
            },
        };
    }

    root.RedWisdomSandbox = { create, loadMap, loadVectors, insetSvg, ALBERS };
})(typeof globalThis !== 'undefined' ? globalThis : window);
