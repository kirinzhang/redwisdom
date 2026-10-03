(function (root) {
    'use strict';

    // 长征战役立体沙盘渲染器：原生 WebGL2，无第三方依赖。
    // 用法：RedWisdomSandbox.create({ canvas, labelLayer, campaign, onUnitClick, onFollowChange })
    // 返回 { setTime, setLayers, setExaggeration, preset, setFollow, isFollowing, destroy }。

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
    function segDist(px, py, ax, ay, bx, by) {
        const dx = bx - ax, dy = by - ay;
        const u = clamp(((px - ax) * dx + (py - ay) * dy) / (dx * dx + dy * dy || 1), 0, 1);
        return Math.hypot(ax + u * dx - px, ay + u * dy - py);
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
uniform vec4 uColor;uniform sampler2D uTex;uniform float uUseTex,uUnlit;uniform vec3 uL,uCam,uFog;uniform vec2 uFogR;out vec4 o;
void main(){vec3 n=normalize(vN);vec3 V=uCam-vW;if(dot(n,V)<0.)n=-n;
vec3 base=uUseTex>.5?texture(uTex,vUv).rgb:uColor.rgb;
float df=max(dot(n,uL),0.);float sky=.5+.5*n.y;
vec3 c=uUnlit>.5?base:base*(.42+.2*sky+.58*df);
if(uUseTex<.5&&uUnlit<.5){vec3 h=normalize(uL+normalize(V));c+=pow(max(dot(n,h),0.),24.)*.12;}
float f=smoothstep(uFogR.x,uFogR.y,length(V));o=vec4(mix(c,uFog,f*.85),uColor.a);}`;

    function create(opts) {
        const { canvas, labelLayer, campaign } = opts;
        const onUnitClick = opts.onUnitClick || (() => {});
        const onFollowChange = opts.onFollowChange || (() => {});
        const gl = canvas.getContext('webgl2', { antialias: true });
        if (!gl) return null;

        const C = campaign, GEO = C.geo, TER = GEO.terrain;
        const [L0, B0, L1, B1] = GEO.bbox;
        const COS = Math.cos((B0 + B1) / 2 * Math.PI / 180);
        const kmX = (L1 - L0) * 111.32 * COS, kmZ = (B1 - B0) * 110.57, SCALE = 100 / Math.max(kmX, kmZ);
        const WW = kmX * SCALE, DD = kmZ * SCALE, SIZE = Math.max(WW, DD);
        const wx = (lon) => ((lon - L0) / (L1 - L0) - 0.5) * WW;
        const wz = (lat) => ((B1 - lat) / (B1 - B0) - 0.5) * DD;
        const unLon = (x) => L0 + (x / WW + 0.5) * (L1 - L0);
        const unLat = (z) => B1 - (z / DD + 0.5) * (B1 - B0);
        let EX = 1;
        const hY = (m) => m / 1000 * SCALE * GEO.vex * EX;

        /* ---------- 高程 ---------- */
        const RSEG = [];
        for (const r of GEO.rivers) for (let i = 0; i < r.pts.length - 1; i += 1) RSEG.push([r.pts[i][0] * COS, r.pts[i][1], r.pts[i + 1][0] * COS, r.pts[i + 1][1], r.wide ? 1.7 : 1]);
        function elevRaw(lon, lat) {
            let e = TER.base;
            for (const L of TER.layers) {
                if (L.type === 'slope') {
                    const dx = (L.to[0] - L.from[0]) * COS, dy = L.to[1] - L.from[1];
                    const u = clamp(((lon - L.from[0]) * COS * dx + (lat - L.from[1]) * dy) / (dx * dx + dy * dy), 0, 1);
                    e += L.amount * smooth(u);
                } else if (L.type === 'ridge') {
                    const d = segDist(lon * COS, lat, L.a[0] * COS, L.a[1], L.b[0] * COS, L.b[1]);
                    e += L.amount * Math.exp(-((d / L.width) ** 2));
                } else if (L.type === 'peak') {
                    const d = Math.hypot((lon - L.at[0]) * COS, lat - L.at[1]);
                    e += L.amount * Math.exp(-((d / L.radius) ** 2));
                }
            }
            const N = TER.noise, sc = N.scale;
            const n = fbm(lon * sc + 3, lat * sc + 7), r = 1 - Math.abs(2 * fbm(lon * sc * 2.5, lat * sc * 2.5, 4) - 1);
            e += (n - 0.5) * N.amp + r * r * N.ridged;
            let md = 9;
            for (const s of RSEG) { const d = segDist(lon * COS, lat, s[0], s[1], s[2], s[3]) / s[4]; if (d < md) md = d; }
            const V = TER.valley;
            const k = V.depth * Math.exp(-((md / V.width) ** 2)) + V.wideDepth * Math.exp(-((md / V.wideWidth) ** 2));
            e -= (e - V.floor) * clamp(k, 0, 0.92);
            return Math.max(TER.min, e);
        }
        const GH = 360, GW = Math.round(360 * WW / DD), EG = new Float32Array(GW * GH);
        for (let gy = 0; gy < GH; gy += 1) for (let gx = 0; gx < GW; gx += 1) EG[gy * GW + gx] = elevRaw(L0 + gx / (GW - 1) * (L1 - L0), B1 - gy / (GH - 1) * (B1 - B0));
        function elev(lon, lat) {
            const fx = clamp((lon - L0) / (L1 - L0), 0, 1) * (GW - 1), fy = clamp((B1 - lat) / (B1 - B0), 0, 1) * (GH - 1);
            const x = Math.min(GW - 2, Math.floor(fx)), y = Math.min(GH - 2, Math.floor(fy)), u = fx - x, v = fy - y, i = y * GW + x;
            return EG[i] * (1 - u) * (1 - v) + EG[i + 1] * u * (1 - v) + EG[i + GW] * (1 - u) * v + EG[i + GW + 1] * u * v;
        }
        const P = (ll, off = 0) => [wx(ll[0]), hY(elev(ll[0], ll[1])) + off, wz(ll[1])];

        /* ---------- 贴图 ---------- */
        function ecol(e) {
            const S = TER.colors;
            for (let i = 0; i < S.length - 1; i += 1) { const a = S[i], b = S[i + 1]; if (e <= b[0]) { const t = clamp((e - a[0]) / (b[0] - a[0]), 0, 1); return a[1].map((v, j) => v + (b[1][j] - v) * t); } }
            return S[S.length - 1][1];
        }
        function catmull(pts) {
            const out = [pts[0]];
            for (let i = 0; i < pts.length - 1; i += 1) {
                const p0 = pts[i - 1] || pts[i], p1 = pts[i], p2 = pts[i + 1], p3 = pts[i + 2] || p2;
                for (let s = 1; s <= 8; s += 1) { const t = s / 8, t2 = t * t, t3 = t2 * t; out.push([0, 1].map((k) => 0.5 * ((2 * p1[k]) + (-p0[k] + p2[k]) * t + (2 * p0[k] - 5 * p1[k] + 4 * p2[k] - p3[k]) * t2 + (-p0[k] + 3 * p1[k] - 3 * p2[k] + p3[k]) * t3))); }
            }
            return out;
        }
        function buildTexture() {
            const TH = 1600, TW = Math.round(1600 * WW / DD), k = TW / 1416;
            const cv = document.createElement('canvas'); cv.width = TW; cv.height = TH;
            const ctx = cv.getContext('2d'), img = ctx.createImageData(TW, TH), d = img.data, E = new Float32Array(TW * TH);
            for (let y = 0; y < TH; y += 1) for (let x = 0; x < TW; x += 1) E[y * TW + x] = elev(L0 + x / (TW - 1) * (L1 - L0), B1 - y / (TH - 1) * (B1 - B0));
            const pxM = kmZ * 1000 / TH, shadeK = 0.12 * GEO.vex / pxM, ci = TER.contour;
            for (let y = 0; y < TH; y += 1) for (let x = 0; x < TW; x += 1) {
                const i = y * TW + x, e = E[i], c = ecol(e);
                const right = E[i + (x < TW - 1 ? 1 : 0)], down = E[i + (y < TH - 1 ? TW : 0)];
                const ex = right - E[i - (x > 0 ? 1 : 0)], ey = down - E[i - (y > 0 ? TW : 0)];
                const sh = clamp(1 + (-ex - ey) * shadeK, 0.7, 1.24), g = 0.94 + 0.12 * hash(x * 7 + 3, y * 13 + 1);
                let r = c[0] * sh * g, gg = c[1] * sh * g, b = c[2] * sh * g;
                const b0 = Math.floor(e / ci), b1 = Math.floor(right / ci), b2 = Math.floor(down / ci);
                if (b0 !== b1 || b0 !== b2) { const a = Math.max(b0, b1, b2) % 5 === 0 ? 0.42 : 0.2; r *= 1 - a; gg *= 1 - a; b *= 1 - a * 0.9; }
                const p = i * 4; d[p] = r; d[p + 1] = gg; d[p + 2] = b; d[p + 3] = 255;
            }
            ctx.putImageData(img, 0, 0);
            const tx = (lon) => (lon - L0) / (L1 - L0) * TW, ty = (lat) => (B1 - lat) / (B1 - B0) * TH;
            ctx.strokeStyle = 'rgba(50,35,20,.18)'; ctx.lineWidth = 1.5; ctx.fillStyle = 'rgba(50,35,20,.55)'; ctx.font = `500 ${Math.round(22 * k)}px "Noto Serif SC",serif`;
            const gs = GEO.grid, fmt = (v) => String(Math.round(v * 100) / 100);
            for (let lon = Math.ceil(L0 / gs) * gs; lon <= L1; lon += gs) { ctx.beginPath(); ctx.moveTo(tx(lon), 0); ctx.lineTo(tx(lon), TH); ctx.stroke(); ctx.fillText(`${fmt(lon)}°E`, tx(lon) + 6, 26 * k + 4); }
            for (let lat = Math.ceil(B0 / gs) * gs; lat <= B1; lat += gs) { ctx.beginPath(); ctx.moveTo(0, ty(lat)); ctx.lineTo(TW, ty(lat)); ctx.stroke(); ctx.fillText(`${fmt(lat)}°N`, 8, ty(lat) - 8); }
            ctx.fillStyle = 'rgba(60,38,18,.2)'; ctx.font = `900 ${Math.round(92 * k)}px "Noto Serif SC",serif`;
            for (const [s, a, b] of GEO.regions || []) ctx.fillText(s, tx(a), ty(b));
            for (const r of GEO.rivers) {
                const pts = catmull(r.pts.map((p) => [tx(p[0]), ty(p[1])]));
                ctx.lineCap = 'round'; ctx.lineJoin = 'round';
                ctx.beginPath(); pts.forEach((p, i) => (i ? ctx.lineTo(p[0], p[1]) : ctx.moveTo(p[0], p[1])));
                ctx.strokeStyle = 'rgba(232,236,226,.7)'; ctx.lineWidth = (r.width * 2.2 + 5) * k; ctx.stroke();
                ctx.strokeStyle = '#3b78a2'; ctx.lineWidth = r.width * 2.2 * k; ctx.stroke();
            }
            ctx.fillStyle = '#2c5f86'; ctx.font = `italic 600 ${Math.round(40 * k)}px "Noto Serif SC",serif`;
            for (const r of GEO.rivers) {
                if (!r.label) continue;
                ctx.save(); ctx.translate(tx(r.label[0]), ty(r.label[1])); ctx.rotate(r.label[2] || 0); ctx.fillText(r.name, 0, 0); ctx.restore();
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
        ['uVP', 'uM', 'uColor', 'uTex', 'uUseTex', 'uUnlit', 'uL', 'uCam', 'uFog', 'uFogR'].forEach((n) => { U[n] = gl.getUniformLocation(prog, n); });

        function mesh(g) {
            const vao = gl.createVertexArray(); gl.bindVertexArray(vao); const bufs = [];
            [[g.p, 3], [g.n, 3], [g.u || new Float32Array(g.p.length / 3 * 2), 2]].forEach(([a, s], i) => {
                const b = gl.createBuffer(); gl.bindBuffer(gl.ARRAY_BUFFER, b);
                gl.bufferData(gl.ARRAY_BUFFER, a instanceof Float32Array ? a : new Float32Array(a), gl.STATIC_DRAW);
                gl.enableVertexAttribArray(i); gl.vertexAttribPointer(i, s, gl.FLOAT, false, 0, 0); bufs.push(b);
            });
            const ib = gl.createBuffer(); gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, ib); gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, new Uint32Array(g.i), gl.STATIC_DRAW);
            gl.bindVertexArray(null);
            return { vao, bufs, ib, count: g.i.length };
        }
        function freeMesh(m) { if (!m) return; m.bufs.forEach((b) => gl.deleteBuffer(b)); gl.deleteBuffer(m.ib); gl.deleteVertexArray(m.vao); }
        const GEOM = { box: mesh(gBox()), cyl: mesh(gCyl()), sph: mesh(gSphere()), ring: mesh(gDisc(0.78)), flag: mesh(gFlag()), cone: mesh(gCyl(16, 0)) };
        const tex = gl.createTexture();
        function uploadTex(src) {
            gl.bindTexture(gl.TEXTURE_2D, tex); gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, false);
            gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, src); gl.generateMipmap(gl.TEXTURE_2D);
            gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR_MIPMAP_LINEAR); gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
            const af = gl.getExtension('EXT_texture_filter_anisotropic'); if (af) gl.texParameterf(gl.TEXTURE_2D, af.TEXTURE_MAX_ANISOTROPY_EXT, 8);
        }
        { const c0 = document.createElement('canvas'); c0.width = c0.height = 4; const x0 = c0.getContext('2d'); x0.fillStyle = '#cbbd93'; x0.fillRect(0, 0, 4, 4); uploadTex(c0); }

        /* ---------- 几何构建 ---------- */
        const NZ = 251, NX = Math.round(251 * WW / DD);
        function terrainGeom() {
            const p = new Float32Array(NX * NZ * 3), n = new Float32Array(NX * NZ * 3), u = new Float32Array(NX * NZ * 2), i = [];
            for (let z = 0; z < NZ; z += 1) for (let x = 0; x < NX; x += 1) {
                const k = z * NX + x, lon = L0 + x / (NX - 1) * (L1 - L0), lat = B1 - z / (NZ - 1) * (B1 - B0);
                p[k * 3] = wx(lon); p[k * 3 + 1] = hY(elev(lon, lat)); p[k * 3 + 2] = wz(lat); u[k * 2] = x / (NX - 1); u[k * 2 + 1] = z / (NZ - 1);
            }
            for (let z = 0; z < NZ; z += 1) for (let x = 0; x < NX; x += 1) {
                const k = z * NX + x, xl = Math.max(0, x - 1), xr = Math.min(NX - 1, x + 1), zu = Math.max(0, z - 1), zd = Math.min(NZ - 1, z + 1);
                const dx = [p[(z * NX + xr) * 3] - p[(z * NX + xl) * 3], p[(z * NX + xr) * 3 + 1] - p[(z * NX + xl) * 3 + 1], 0];
                const dz = [0, p[(zd * NX + x) * 3 + 1] - p[(zu * NX + x) * 3 + 1], p[(zd * NX + x) * 3 + 2] - p[(zu * NX + x) * 3 + 2]];
                const nn = norm(cross(dz, dx)); n[k * 3] = nn[0]; n[k * 3 + 1] = nn[1]; n[k * 3 + 2] = nn[2];
            }
            for (let z = 0; z < NZ - 1; z += 1) for (let x = 0; x < NX - 1; x += 1) { const a = z * NX + x, b = a + 1, c = a + NX, d = c + 1; i.push(a, c, b, b, c, d); }
            return { p, n, u, i };
        }
        function skirtGeom() {
            const p = [], n = [], i = [], BOT = -1.6;
            const edges = [[0, 0, 1, 0, [0, 0, -1]], [0, NZ - 1, 1, 0, [0, 0, 1]], [0, 0, 0, 1, [-1, 0, 0]], [NX - 1, 0, 0, 1, [1, 0, 0]]];
            for (const [x0, z0, dx, dz, N] of edges) {
                const L = dx ? NX : NZ, b = p.length / 3;
                for (let s = 0; s < L; s += 1) {
                    const lon = L0 + (x0 + dx * s) / (NX - 1) * (L1 - L0), lat = B1 - (z0 + dz * s) / (NZ - 1) * (B1 - B0), X = wx(lon), Z = wz(lat);
                    p.push(X, hY(elev(lon, lat)), Z, X, BOT, Z); n.push(...N, ...N);
                }
                for (let s = 0; s < L - 1; s += 1) { const a = b + s * 2; i.push(a, a + 1, a + 2, a + 2, a + 1, a + 3); }
            }
            return { p, n, i };
        }
        const STEP = (L1 - L0) / 300;
        function dense(nodes, times) {
            const out = [];
            for (let k = 0; k < nodes.length - 1; k += 1) {
                const a = nodes[k], b = nodes[k + 1], L = Math.hypot((b[0] - a[0]) * COS, b[1] - a[1]), n = Math.max(1, Math.ceil(L / STEP));
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
            const at = (s) => { let k = 1; while (k < pts.length - 1 && cum[k] < s) k += 1; const t = clamp((s - cum[k - 1]) / ((cum[k] - cum[k - 1]) || 1), 0, 1); return { p: pts[k - 1].map((v, j) => v + (pts[k][j] - v) * t), k: k - 1 }; };
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
        const UNITS = C.units.map((u, index) => ({ ...u, index, from: u.from ?? -Infinity }));
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
            const t0 = Math.max(u.k[0][0], Number.isFinite(u.from) ? u.from : u.k[0][0]), t1 = u.k[u.k.length - 1][0], step = (C.maxDay || 1) / 170, nodes = [], times = [];
            for (let t = t0; t <= t1 + 1e-6; t += step) { const s = unitAt(u, t); nodes.push([s[0], s[1]]); times.push(t); }
            return { u, d: dense(nodes, times) };
        });

        let terrain, skirt, route, ghost, trails = [], overlayMeshes = [];
        function buildDraped() {
            freeMesh(terrain); freeMesh(skirt); freeMesh(route && route.m); freeMesh(ghost);
            trails.forEach((t) => freeMesh(t.m)); overlayMeshes.forEach((o) => freeMesh(o.m));
            terrain = mesh(terrainGeom()); skirt = mesh(skirtGeom());
            const tg = tubeGeom(MAIN_DENSE.map((s) => P(s.ll, 0.38)), 0.3); route = { m: mesh(tg.g), per: tg.per };
            ghost = mesh(dashGeom(MAIN_DENSE.map((s) => P(s.ll, 0.22)), { w: 0.16, h: 0.1, dash: 0.55, gap: 0.6 }).g);
            trails = TRAIL_SRC.map(({ u, d }) => { const g = dashGeom(d.map((s) => P(s.ll, 0.2)), { w: 0.14, h: 0.08, dash: 0.4, gap: 0.45 }); return { u, m: mesh(g.g), times: g.idx.map((k) => d[k].t) }; });
            overlayMeshes = (C.overlays || []).filter((o) => o.type === 'dash').map((o) => {
                const pts = dense(o.nodes).map((s) => P(s.ll, 0.36));
                return { o, m: mesh(dashGeom(pts, { w: 0.32, h: 0.26, dash: 1.0, gap: 0.6 }).g), tip: pts[pts.length - 1], dir: norm(sub(pts[pts.length - 1], pts[Math.max(0, pts.length - 4)])) };
            });
        }
        buildDraped();

        /* ---------- 标签 ---------- */
        const labels = [];
        function label(html, cls, pos, o = {}) {
            const e = document.createElement('div'); e.className = `sb-lb ${cls}`; e.innerHTML = html; labelLayer.appendChild(e);
            const L = { e, pos, vis: true, ax: o.ax ?? -0.5, ay: o.ay ?? -1, dy: o.dy ?? 0 }; labels.push(L); return L;
        }
        const placeL = GEO.places.map(([n, a, b, major]) => label(escapeHtml(n), `place${major ? ' city' : ''}`, () => P([a, b], 0.5), { dy: -6 }));
        const markerL = (C.markers || []).filter((m) => m.type !== 'bridge').map((m) => {
            let L;
            if (m.type === 'crossing') { L = label(`<i>${escapeHtml(m.n)}</i><span>${escapeHtml(m.label)}</span>`, 'xing', () => P(m.at, 3.6), { ax: -0.15, dy: -2 }); L.txt = L.e.querySelector('span'); L.e.title = m.label; }
            else if (m.type === 'battle') L = label(escapeHtml(m.label), 'battle', () => P(m.at, 1.4), { ax: 0, ay: -0.5 });
            else L = label(escapeHtml(m.label), 'event', () => P(m.at, 2.4), { ax: 0, ay: -0.5 });
            return { m, L };
        });
        const unitPos = new Map();
        const unitL = UNITS.map((u) => {
            const f = C.factions[u.faction];
            const L = label(escapeHtml(u.label || f.name), u.faction === 'red' ? 'redu' : 'unit', () => { const q = unitPos.get(u.index); return [q[0], q[1] + (u.faction === 'red' ? 4.3 : 3.2), q[2]]; }, { ax: 0, ay: -0.5 });
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
        const PRESETS = {
            all: () => (GEO.camera
                ? { th: GEO.camera.th ?? 0.32, ph: GEO.camera.ph ?? 0.86, r: SIZE * GEO.camera.r, tg: [wx(GEO.camera.at[0]), 0, wz(GEO.camera.at[1])] }
                : { th: 0.32, ph: 0.86, r: SIZE * 1.04, tg: [0, 0, DD * 0.04] }),
            top: () => ({ th: 0, ph: 0.06, r: SIZE * 1.18, tg: [0, 0, 0] }),
            low: () => ({ th: -0.55, ph: 1.12, r: SIZE * 0.46, tg: [mainPos[0], 0, mainPos[2]] }),
        };
        let mainPos = P([MAIN.k[0][1], MAIN.k[0][2]]);
        const cam = PRESETS.all(), camT = PRESETS.all();
        let follow = false;
        function setFollow(v) { if (follow === v) return; follow = v; onFollowChange(v); }
        const ptrs = new Map(); let lastPinch = 0;
        const onDown = (e) => { canvas.setPointerCapture(e.pointerId); ptrs.set(e.pointerId, { x: e.clientX, y: e.clientY, b: e.button, sh: e.shiftKey }); canvas.classList.add('is-dragging'); lastPinch = 0; };
        const onMove = (e) => {
            const q = ptrs.get(e.pointerId); if (!q) return;
            const dx = e.clientX - q.x, dy = e.clientY - q.y; q.x = e.clientX; q.y = e.clientY;
            if (ptrs.size === 2) { const [a, b] = [...ptrs.values()], d = Math.hypot(a.x - b.x, a.y - b.y); if (lastPinch) camT.r = clamp(camT.r * lastPinch / d, SIZE * 0.2, SIZE * 1.7); lastPinch = d; pan(dx / 2, dy / 2); return; }
            if (q.b === 2 || q.sh) pan(dx, dy); else { camT.th -= dx * 0.006; camT.ph = clamp(camT.ph - dy * 0.005, 0.05, 1.38); }
        };
        const onUp = (e) => { ptrs.delete(e.pointerId); if (!ptrs.size) canvas.classList.remove('is-dragging'); lastPinch = 0; };
        const onWheel = (e) => { e.preventDefault(); camT.r = clamp(camT.r * Math.exp(e.deltaY * 0.0011), SIZE * 0.2, SIZE * 1.7); };
        const onCtx = (e) => e.preventDefault();
        function pan(dx, dy) {
            setFollow(false);
            const k = camT.r * 0.0016, c = Math.cos(camT.th), s = Math.sin(camT.th);
            camT.tg[0] = clamp(camT.tg[0] - (dx * c + dy * s) * k, -WW / 2, WW / 2);
            camT.tg[2] = clamp(camT.tg[2] - (-dx * s + dy * c) * k, -DD / 2, DD / 2);
        }
        canvas.addEventListener('pointerdown', onDown); canvas.addEventListener('pointermove', onMove);
        canvas.addEventListener('pointerup', onUp); canvas.addEventListener('pointercancel', onUp);
        canvas.addEventListener('wheel', onWheel, { passive: false }); canvas.addEventListener('contextmenu', onCtx);

        /* ---------- 渲染 ---------- */
        let T = 0, layers = { enemy: true, trail: true, ghost: true, place: true }, raf = 0, last = performance.now(), VP = I4, vw = 1, vh = 1;
        const reduce = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
        const stageColor = hex3((getComputedStyle(canvas).getPropertyValue('--stage').trim() || '#E6DFD0'));
        const COL = { red: hex3('#C4281C'), dark: [0.16, 0.13, 0.1], wood: hex3('#5a3a22'), soil: hex3('#8a6946'), pole: [0.22, 0.2, 0.18], white: [1, 1, 1], gold: [0.86, 0.66, 0.2], chain: [0.18, 0.18, 0.2] };
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

        function frame(now) {
            raf = requestAnimationFrame(frame);
            const wave = reduce ? 0 : now / 1000, pulse = reduce ? 0.5 : (now / 1400) % 1;
            const m0 = unitAt(MAIN, T); mainPos = P([m0[0], m0[1]]);
            UNITS.forEach((u) => { const s = unitAt(u, T); const p = P([s[0], s[1]]); p.s = s[2]; p.on = T >= u.from; unitPos.set(u.index, p); });
            if (follow) { camT.tg[0] += (mainPos[0] - camT.tg[0]) * 0.04; camT.tg[2] += (mainPos[2] - camT.tg[2]) * 0.04; }
            const kk = reduce ? 1 : 0.12;
            cam.th += (camT.th - cam.th) * kk; cam.ph += (camT.ph - cam.ph) * kk; cam.r += (camT.r - cam.r) * kk;
            for (let j = 0; j < 3; j += 1) cam.tg[j] += (camT.tg[j] - cam.tg[j]) * kk;
            cam.tg[1] = hY(elev(unLon(cam.tg[0]), unLat(cam.tg[2]))) * 0.6;
            const eye = [cam.tg[0] + cam.r * Math.sin(cam.ph) * Math.sin(cam.th), cam.tg[1] + cam.r * Math.cos(cam.ph), cam.tg[2] + cam.r * Math.sin(cam.ph) * Math.cos(cam.th)];
            resize();
            const up = Math.abs(Math.sin(cam.ph)) < 0.07 ? [-Math.sin(cam.th), 0, -Math.cos(cam.th)] : [0, 1, 0];
            VP = mul(persp(0.72, vw / vh, 1, 600), lookAt(eye, cam.tg, up));
            gl.viewport(0, 0, canvas.width, canvas.height); gl.clearColor(stageColor[0], stageColor[1], stageColor[2], 1); gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);
            gl.enable(gl.DEPTH_TEST); gl.disable(gl.CULL_FACE); gl.useProgram(prog);
            gl.uniformMatrix4fv(U.uVP, false, VP); gl.uniform3fv(U.uL, norm([-0.55, 0.8, -0.35])); gl.uniform3fv(U.uCam, eye); gl.uniform3fv(U.uFog, stageColor); gl.uniform2f(U.uFogR, cam.r * 1.1, cam.r * 2.6 + 120);
            gl.activeTexture(gl.TEXTURE0); gl.bindTexture(gl.TEXTURE_2D, tex); gl.uniform1i(U.uTex, 0);
            gl.disable(gl.BLEND); gl.depthMask(true);
            draw(terrain, I4, COL.white, 1, { tex: 1 }); draw(skirt, I4, COL.soil);
            const fh = 0.35, ft = 1.3;
            [[0, -DD / 2 - ft / 2, WW + ft * 2, ft], [0, DD / 2 + ft / 2, WW + ft * 2, ft], [-WW / 2 - ft / 2, 0, ft, DD], [WW / 2 + ft / 2, 0, ft, DD]].forEach(([x, z, sx, sz]) => draw(GEOM.box, trs([x, (fh - 2.2) / 2, z], 0, [sx, fh + 2.2, sz]), COL.wood));
            draw(GEOM.box, trs([0, -2.6, 0], 0, [WW + ft * 2 + 1, 0.8, DD + ft * 2 + 1]), COL.wood.map((v) => v * 0.8));
            let seg = 0; while (seg < MAIN_DENSE.length - 1 && MAIN_DENSE[seg + 1].t <= T) seg += 1;
            if (seg) draw(route.m, I4, COL.red, 1, { count: seg * route.per });
            trails.forEach((tr) => {
                const isRed = tr.u.faction === 'red'; if (!isRed && !(layers.enemy && layers.trail)) return;
                let n = 0; while (n < tr.times.length && tr.times[n] <= T) n += 1;
                if (n) draw(tr.m, I4, hex3(C.factions[tr.u.faction].color), 1, { count: n * 36 });
            });
            for (const m of C.markers || []) {
                if (T < m.day - (m.type === 'battle' ? 0.5 : 0)) continue;
                if (m.type === 'crossing') { const p = P(m.at); draw(GEOM.cyl, trs(p, 0, [0.11, 3.2, 0.11]), COL.red); draw(GEOM.sph, trs([p[0], p[1] + 3.3, p[2]], 0, [0.48, 0.48, 0.48]), COL.red); }
                else if (m.type === 'battle') { const p = P(m.at, 0.55); [0.785, -0.785].forEach((r) => draw(GEOM.box, trs(p, r, [2.1, 0.24, 0.24]), COL.dark)); }
                else if (m.type === 'event' && T <= (m.until ?? m.day + 6)) { const p = P(m.at); draw(GEOM.cyl, trs(p, 0, [0.09, 2.3, 0.09]), COL.pole); draw(GEOM.sph, trs([p[0], p[1] + 2.35, p[2]], 0, [0.36, 0.36, 0.36]), COL.gold); }
                else if (m.type === 'bridge') {
                    const a = P(m.a), b = P(m.b), y = Math.max(a[1], b[1]) + 0.5, mid = [(a[0] + b[0]) / 2, y, (a[2] + b[2]) / 2];
                    const L = Math.hypot(b[0] - a[0], b[2] - a[2]), ry = Math.atan2(-(b[2] - a[2]), b[0] - a[0]);
                    for (const off of [-0.18, -0.06, 0.06, 0.18]) draw(GEOM.box, trs([mid[0] - Math.sin(ry) * off, y, mid[2] - Math.cos(ry) * off], ry, [L, 0.05, 0.05]), COL.chain);
                    [a, b].forEach((q) => draw(GEOM.box, trs([q[0], (q[1] + y) / 2, q[2]], ry, [0.35, y - q[1] + 0.3, 0.6]), [0.55, 0.5, 0.45]));
                }
            }
            if (layers.place) GEO.places.forEach(([, a, b, major]) => draw(GEOM.cyl, trs(P([a, b]), 0, major ? [0.32, 0.5, 0.32] : [0.2, 0.35, 0.2]), major ? [0.15, 0.13, 0.12] : [0.3, 0.27, 0.24]));
            UNITS.forEach((u) => {
                const p = unitPos.get(u.index); if (!p.on) return;
                if (u.faction === 'red') {
                    const big = u === MAIN ? 1 : 0.72;
                    draw(GEOM.cyl, trs(p, 0, [1 * big, 0.55, 1 * big]), COL.red); draw(GEOM.cyl, trs([p[0], p[1] + 0.55, p[2]], 0, [0.72 * big, 0.2, 0.72 * big]), [0.95, 0.84, 0.55]);
                    draw(GEOM.cyl, trs(p, 0, [0.08, 3.8 * big, 0.08]), COL.pole);
                    draw(GEOM.flag, trs([p[0], p[1] + 3.8 * big - 1.15 * big, p[2]], Math.sin(wave * 1.6 + u.index) * 0.3 - 0.4, [1.9 * big, 1.15 * big, 1]), COL.red);
                    return;
                }
                if (!layers.enemy) return;
                const s = p.s, col = hex3(C.factions[u.faction].color).map((v) => v * (0.55 + 0.45 * s) + 0.27 * (1 - s)), sc = 0.65 + 0.35 * s;
                draw(GEOM.box, trs([p[0], p[1] + 0.45 * sc, p[2]], 0.2 * u.index, [1.8 * sc, 0.9 * sc, 1.2 * sc]), col);
                draw(GEOM.cyl, trs([p[0] + 0.55 * sc, p[1], p[2]], 0, [0.06, 2.7, 0.06]), COL.pole);
                draw(GEOM.flag, trs([p[0] + 0.55 * sc, p[1] + 1.95, p[2]], Math.sin(wave * 1.3 + u.index) * 0.25, [1.25, 0.72, 1]), col);
            });
            gl.enable(gl.BLEND); gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA); gl.depthMask(false);
            if (layers.ghost) draw(ghost, I4, COL.red, 0.5);
            overlayMeshes.forEach(({ o, m, tip, dir }) => {
                const a = o.until != null ? fade(T, o.from ?? 0, o.until) : (T >= (o.from ?? 0) ? Math.min(1, (T - (o.from ?? 0)) / 2) : 0);
                if (!a) return;
                const col = hex3(o.color || '#C4281C'); draw(m, I4, col, 0.85 * a);
                if (o.arrow) { const Y = dir, Xv = norm(cross([0, 1, 0], Y)), Z = cross(Xv, Y), r = 0.55, len = 1.4; draw(GEOM.cone, new Float32Array([Xv[0] * r, Xv[1] * r, Xv[2] * r, 0, Y[0] * len, Y[1] * len, Y[2] * len, 0, Z[0] * r, Z[1] * r, Z[2] * r, 0, tip[0], tip[1], tip[2], 1]), col, a); }
            });
            draw(GEOM.ring, trs([mainPos[0], mainPos[1] + 0.12, mainPos[2]], 0, [1.4 + pulse * 2.4, 1, 1.4 + pulse * 2.4]), COL.red, 0.55 * (1 - pulse), { unlit: 1 });
            for (const m of C.markers || []) {
                if (m.type === 'battle' && Math.abs(T - m.day) < 1.6) { const p = P(m.at, 0.2); draw(GEOM.ring, trs(p, 0, [1.5 + pulse * 4, 1, 1.5 + pulse * 4]), COL.red, 0.8 * (1 - pulse), { unlit: 1 }); }
                if (m.type === 'crossing' && T >= m.day && T - m.day < 2.5 * (C.maxDay / 86)) { const p = P(m.at, 0.15); draw(GEOM.ring, trs(p, 0, [1 + pulse * 3, 1, 1 + pulse * 3]), COL.red, 0.7 * (1 - pulse), { unlit: 1 }); }
            }
            (C.overlays || []).forEach((o) => { if (o.ring && T >= (o.from ?? 0)) draw(GEOM.ring, trs(P(o.at, 0.2), 0, [2.2, 1, 2.2]), hex3('#4A5578'), 0.8, { unlit: 1 }); });
            gl.depthMask(true); gl.disable(gl.BLEND);

            placeL.forEach((L) => { L.vis = layers.place; });
            const recent = 5 * (C.maxDay / 86);
            markerL.forEach(({ m, L }) => {
                if (m.type === 'crossing') { L.vis = T >= m.day; L.txt.hidden = T - m.day > Math.max(recent, 1.5); }
                else if (m.type === 'battle') L.vis = T >= m.day - 0.5 && T - m.day < 9 * (C.maxDay / 86) + 1;
                else L.vis = T >= m.day && T <= (m.until ?? m.day + 6);
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
            last = now;
        }
        raf = requestAnimationFrame(frame);

        let disposed = false;
        const fontsReady = document.fonts && document.fonts.load
            ? Promise.race([document.fonts.load('900 40px "Noto Serif SC"', `${(GEO.regions || []).map((r) => r[0]).join('')}${GEO.rivers.map((r) => r.name).join('')}`), new Promise((r) => setTimeout(r, 2500))])
            : Promise.resolve();
        fontsReady.catch(() => {}).then(() => { if (!disposed) uploadTex(buildTexture()); });

        return {
            setTime(t) { T = clamp(t, 0, C.maxDay); },
            setLayers(next) { layers = { ...layers, ...next }; },
            setExaggeration(x) { EX = x; buildDraped(); },
            exaggerationFactor(x) { return Math.round(GEO.vex * x); },
            preset(name) { const p = PRESETS[name] && PRESETS[name](); if (!p) return; Object.assign(camT, p); setFollow(name === 'low'); },
            setFollow(v) { setFollow(v); if (v && camT.r > SIZE * 0.8) camT.r = SIZE * 0.64; },
            isFollowing() { return follow; },
            destroy() {
                disposed = true; cancelAnimationFrame(raf);
                labels.forEach((L) => L.e.remove());
                canvas.removeEventListener('pointerdown', onDown); canvas.removeEventListener('pointermove', onMove);
                canvas.removeEventListener('pointerup', onUp); canvas.removeEventListener('pointercancel', onUp);
                canvas.removeEventListener('wheel', onWheel); canvas.removeEventListener('contextmenu', onCtx);
                freeMesh(terrain); freeMesh(skirt); freeMesh(route && route.m); freeMesh(ghost);
                trails.forEach((t) => freeMesh(t.m)); overlayMeshes.forEach((o) => freeMesh(o.m)); Object.values(GEOM).forEach(freeMesh);
                gl.deleteTexture(tex); gl.deleteProgram(prog);
            },
        };
    }

    root.RedWisdomSandbox = { create };
})(typeof globalThis !== 'undefined' ? globalThis : window);
