#!/usr/bin/env python3
"""生成长征沙盘使用的真实地图数据。

输入（需要预先下载到本机）：
  --dem   GEBCO 2024 中国区域高程 GeoTIFF（0.05°，WGS84），来自 https://github.com/Rimagination/ggmapcn-data 的 data/gebco_2024_China.tif
          原始数据：GEBCO Compilation Group (2024) GEBCO 2024 Grid, doi:10.5285/1c44ce99-0a0d-5f4f-e063-7086abc0ea0f
  --ne    Natural Earth 矢量数据目录（https://github.com/nvkelso/natural-earth-vector 的 geojson/），需要：
          ne_10m_admin_0_countries_chn.geojson（中国视角国界）、
          ne_10m_admin_0_boundary_lines_maritime_indicator_chn.geojson（南海断续线）、
          ne_10m_admin_1_states_provinces.geojson、ne_10m_rivers_lake_centerlines.geojson
  --campaigns  战役 bbox 列表 JSON，可这样导出：
               node -e "const d=require('./js/campaign-data.js');console.log(JSON.stringify(d.CAMPAIGNS.map(c=>({id:c.id,bbox:c.geo.bbox}))))" > campaigns.json

输出：
  data/terrain/index.json、data/terrain/*.bin（Int16 小端高程，单位米，行从北到南）
  data/map/overview.json（长征全图，较粗简化，含南海诸岛附图图层 scs）、data/map/<战役id>.json（战役范围内的细节图层）

  --vege  中国植被图 1km 栅格（可选），同一仓库的 data/vege_1km_projected.tif
          原始数据：张新时等（2007）《中华人民共和国植被图（1:1000000）》，地质出版社；方位等距投影（105°E, 35°N）

地形处理：战役范围按 0.01°（约 1 公里）双三次插值，再叠加两类细节——
按局部起伏缩放的分形起伏，以及由高程推算的汇流网络刻出的沟谷。这些细节是
“按真实地势补出来的”，用于让立体沙盘可读，不代表 1 公里尺度的实测地貌。

依赖：numpy、scipy、tifffile、Pillow（GeoTIFF 为 LZW 压缩，脚本内置解码，无需 imagecodecs）。
"""
import argparse
import json
import math
import os
from collections import defaultdict

import heapq
import zlib
import struct

import numpy as np
import tifffile
from scipy import ndimage
from PIL import Image, ImageDraw

OVERVIEW_BBOX = [72.0, 15.0, 136.0, 54.5]
SCS_BBOX = [105.0, 2.5, 125.0, 25.0]
CAMPAIGN_MARGIN = 0.35

RIVER_ZH = {
    'Chang Jiang': '长江', 'Yangtze': '长江', 'Jinsha': '金沙江', 'Tongtian': '通天河', 'Huang': '黄河',
    'Wu': '乌江', 'Dadu': '大渡河', 'Xiang': '湘江', 'Gan': '赣江', 'Han': '汉江', 'Jialing': '嘉陵江',
    'Yalong': '雅砻江', 'Lancang': '澜沧江', 'Nu': '怒江', 'Yuan': '沅江', 'Wei': '渭河', 'Xi': '西江',
    'Hongshui': '红水河', 'Nanpan': '南盘江', 'Huai': '淮河', 'Hai': '海河', 'Yongding': '永定河', 'Fen': '汾河',
    'Liu': '柳江', 'Zi': '资水', 'Tuo': '沱江', 'Jing': '泾河', 'Wuding': '无定河', 'Brahmaputra': '雅鲁藏布江',
    'Yarlung': '雅鲁藏布江', 'Bei': '北江', 'Dong': '东江', 'Qiantang': '钱塘江', 'Fuchun': '富春江', 'Sanggan': '桑干河',
    'Luan': '滦河', 'Liao': '辽河', 'Songhua': '松花江', 'Heilong': '黑龙江', 'Nen': '嫩江', 'Tarim': '塔里木河',
    'Yi': '沂河', 'Hong': '红河', 'Yong': '邕江', 'You': '右江', 'Zuo': '左江', 'Xun': '浔江', 'Qin': '沁河', 'Duliu': '都柳江',
}


# ---------- GeoTIFF（LZW，无预测）----------
def lzw_decode(data):
    out = bytearray()
    table = [bytes([i]) for i in range(256)] + [b'', b'']
    bitpos = 0
    nbits = 9
    prev = None
    total = len(data) * 8
    while True:
        if bitpos + nbits > total:
            break
        byte = bitpos >> 3
        chunk = int.from_bytes(data[byte:byte + 4].ljust(4, b'\0'), 'big')
        code = (chunk >> (32 - (bitpos & 7) - nbits)) & ((1 << nbits) - 1)
        bitpos += nbits
        if code == 257:
            break
        if code == 256:
            table = table[:258]
            nbits = 9
            prev = None
            continue
        if prev is None:
            entry = table[code]
        elif code < len(table):
            entry = table[code]
            table.append(prev + entry[:1])
        else:
            entry = prev + prev[:1]
            table.append(entry)
        out += entry
        prev = entry
        size = len(table)
        nbits = 12 if size >= 2047 else 11 if size >= 1023 else 10 if size >= 511 else 9
    return bytes(out)


def read_lzw_tiff(path):
    tf = tifffile.TiffFile(path)
    page = tf.pages[0]
    height, width = page.shape
    dtype = '<f4' if tf.byteorder == '<' else '>f4'
    rows = []
    fh = tf.filehandle
    for offset, count in zip(page.dataoffsets, page.databytecounts):
        fh.seek(offset)
        raw = fh.read(count)
        if page.compression == 5:
            raw = lzw_decode(raw)
        rows.append(np.frombuffer(raw, dtype=dtype, count=len(raw) // 4))
    return page, np.concatenate(rows)[: width * height].reshape(height, width).astype(np.float32)


def read_dem(path):
    page, grid = read_lzw_tiff(path)
    scale = page.tags['ModelPixelScaleTag'].value
    tie = page.tags['ModelTiepointTag'].value
    return {'grid': np.nan_to_num(grid, nan=0.0), 'lon0': tie[3], 'lat0': tie[4], 'res': scale[0]}


def bicubic(dem, bbox, res):
    l0, b0, l1, b1 = bbox
    w = int(round((l1 - l0) / res)) + 1
    h = int(round((b1 - b0) / res)) + 1
    lons = l0 + np.arange(w) * res
    lats = b1 - np.arange(h) * res
    fx = (lons - dem['lon0']) / dem['res'] - 0.5   # GeoTIFF 像元中心
    fy = (dem['lat0'] - lats) / dem['res'] - 0.5
    yy, xx = np.meshgrid(fy, fx, indexing='ij')
    out = ndimage.map_coordinates(dem['grid'], [yy, xx], order=3, mode='nearest')
    return out.astype(np.float64), w, h, lons, lats


def lattice_noise(lons, lats, wavelength, seed):
    """按绝对经纬度取格点随机值再双三次插值，相邻战役范围的细节一致。"""
    i0 = int(math.floor(lons[0] / wavelength)) - 2
    i1 = int(math.ceil(lons[-1] / wavelength)) + 2
    j0 = int(math.floor(lats[-1] / wavelength)) - 2
    j1 = int(math.ceil(lats[0] / wavelength)) + 2
    ii, jj = np.meshgrid(np.arange(i0, i1 + 1), np.arange(j0, j1 + 1), indexing='xy')
    hsh = (ii.astype(np.int64) * 374761393 + jj.astype(np.int64) * 668265263 + seed * 2654435761) & 0xFFFFFFFF
    hsh = ((hsh ^ (hsh >> 13)) * 1274126177) & 0xFFFFFFFF
    vals = ((hsh ^ (hsh >> 16)) & 0xFFFFFF) / float(0xFFFFFF)
    fx = lons / wavelength - i0
    fy = lats / wavelength - j0
    yy, xx = np.meshgrid(fy, fx, indexing='ij')
    return ndimage.map_coordinates(vals, [yy, xx], order=3, mode='nearest')


def priority_flood(z):
    """填洼，保证每个格点都有向外的流路。"""
    h, w = z.shape
    filled = z.copy()
    done = np.zeros(z.shape, bool)
    heap = []
    for y in range(h):
        for x in (0, w - 1):
            heap.append((filled[y, x], y, x)); done[y, x] = True
    for x in range(1, w - 1):
        for y in (0, h - 1):
            heap.append((filled[y, x], y, x)); done[y, x] = True
    heapq.heapify(heap)
    nb = [(-1, -1), (-1, 0), (-1, 1), (0, -1), (0, 1), (1, -1), (1, 0), (1, 1)]
    while heap:
        e, y, x = heapq.heappop(heap)
        for dy, dx in nb:
            yy, xx = y + dy, x + dx
            if 0 <= yy < h and 0 <= xx < w and not done[yy, xx]:
                done[yy, xx] = True
                if filled[yy, xx] <= e:
                    filled[yy, xx] = e + 1e-3
                heapq.heappush(heap, (filled[yy, xx], yy, xx))
    return filled


def flow_accumulation(z):
    h, w = z.shape
    f = priority_flood(z)
    pad = np.pad(f, 1, mode='edge')
    best = np.zeros(z.shape)
    recv = np.arange(h * w).reshape(h, w)
    yy, xx = np.mgrid[0:h, 0:w]
    for dy, dx in [(-1, -1), (-1, 0), (-1, 1), (0, -1), (0, 1), (1, -1), (1, 0), (1, 1)]:
        drop = (f - pad[1 + dy:1 + dy + h, 1 + dx:1 + dx + w]) / math.hypot(dy, dx)
        ty, tx = np.clip(yy + dy, 0, h - 1), np.clip(xx + dx, 0, w - 1)
        better = drop > best
        best[better] = drop[better]
        recv[better] = (ty * w + tx)[better]
    order = np.argsort(-f, axis=None)
    acc = np.ones(h * w)
    r = recv.ravel()
    for i in order:
        j = r[i]
        if j != i:
            acc[j] += acc[i]
    return acc.reshape(h, w)


def synth_terrain(dem, bbox, res):
    """战役范围的细化地形：双三次插值 + 起伏相关的分形细节 + 汇流沟谷。"""
    base, w, h, lons, lats = bicubic(dem, bbox, res)
    # 轻度锐化：原始栅格约 5 公里，插值后山脊和谷地偏圆，适当拉开
    base = base + (base - ndimage.gaussian_filter(base, 0.035 / res)) * 0.6
    win = max(3, int(round(0.08 / res)))
    mean = ndimage.uniform_filter(base, win)
    std = np.sqrt(np.maximum(ndimage.uniform_filter(base * base, win) - mean * mean, 0))
    amp = np.clip(0.3 * std + 25, 18, 260)
    # 坐标扰动让细节不呈规则的圆斑
    wx = (lattice_noise(lons, lats, 0.2, 3) - 0.5) * 0.09
    wy = (lattice_noise(lons, lats, 0.2, 5) - 0.5) * 0.09
    detail = np.zeros_like(base)
    a, total, wl, k = 1.0, 0.0, 0.06, 0
    while wl >= res * 1.5:
        lo = lons[None, :] + wx
        la = lats[:, None] + wy
        i0 = np.floor(lo.min() / wl) - 2; j0 = np.floor(la.min() / wl) - 2
        i1 = np.ceil(lo.max() / wl) + 2; j1 = np.ceil(la.max() / wl) + 2
        ii, jj = np.meshgrid(np.arange(i0, i1 + 1), np.arange(j0, j1 + 1), indexing='xy')
        hsh = (ii.astype(np.int64) * 374761393 + jj.astype(np.int64) * 668265263 + (11 + k) * 2654435761) & 0xFFFFFFFF
        hsh = ((hsh ^ (hsh >> 13)) * 1274126177) & 0xFFFFFFFF
        vals = ((hsh ^ (hsh >> 16)) & 0xFFFFFF) / float(0xFFFFFF)
        n = ndimage.map_coordinates(vals, [la / wl - j0, lo / wl - i0], order=3, mode='nearest')
        ridge = (1 - np.abs(2 * np.clip(n, 0, 1) - 1)) ** 1.5
        detail += a * (ridge - 0.42)
        total += a
        a *= 0.62; wl /= 2; k += 1
    z = base + amp * detail / max(total, 1e-6) * 1.15
    acc = flow_accumulation(z)
    depth = amp * 1.2 * np.clip(np.log10(acc) / 2.2, 0, 1.5)
    depth[acc < 3] = 0
    depth = ndimage.gaussian_filter(depth, 0.55)
    z = z - depth
    return np.clip(np.round(z), -9000, 9000).astype('<i2'), w, h


# ---------- 植被 ----------
WGS_A = 6378137.0
WGS_F = 1 / 298.257223563
WGS_B = WGS_A * (1 - WGS_F)


def vincenty_inverse(lat1, lon1, lat2, lon2):
    r = math.pi / 180
    L = (lon2 - lon1) * r
    U1 = np.arctan((1 - WGS_F) * np.tan(lat1 * r))
    U2 = np.arctan((1 - WGS_F) * np.tan(lat2 * r))
    sU1, cU1, sU2, cU2 = np.sin(U1), np.cos(U1), np.sin(U2), np.cos(U2)
    lam = L.copy()
    for _ in range(60):
        sl, cl = np.sin(lam), np.cos(lam)
        ss = np.sqrt((cU2 * sl) ** 2 + (cU1 * sU2 - sU1 * cU2 * cl) ** 2)
        cs = sU1 * sU2 + cU1 * cU2 * cl
        sig = np.arctan2(ss, cs)
        sa = cU1 * cU2 * sl / np.where(ss == 0, 1, ss)
        c2a = 1 - sa ** 2
        c2sm = np.where(c2a == 0, 0, cs - 2 * sU1 * sU2 / np.where(c2a == 0, 1, c2a))
        C = WGS_F / 16 * c2a * (4 + WGS_F * (4 - 3 * c2a))
        prev = lam
        lam = L + (1 - C) * WGS_F * sa * (sig + C * ss * (c2sm + C * cs * (-1 + 2 * c2sm ** 2)))
        if np.max(np.abs(lam - prev)) < 1e-12:
            break
    u2 = c2a * (WGS_A ** 2 - WGS_B ** 2) / WGS_B ** 2
    Ak = 1 + u2 / 16384 * (4096 + u2 * (-768 + u2 * (320 - 175 * u2)))
    Bk = u2 / 1024 * (256 + u2 * (-128 + u2 * (74 - 47 * u2)))
    ds = Bk * ss * (c2sm + Bk / 4 * (cs * (-1 + 2 * c2sm ** 2) - Bk / 6 * c2sm * (-3 + 4 * ss ** 2) * (-3 + 4 * c2sm ** 2)))
    s = WGS_B * Ak * (sig - ds)
    az = np.arctan2(cU2 * np.sin(lam), cU1 * sU2 - sU1 * cU2 * np.cos(lam))
    return s, az


def read_vege(path):
    page, grid = read_lzw_tiff(path)
    scale = page.tags['ModelPixelScaleTag'].value
    tie = page.tags['ModelTiepointTag'].value
    params = page.tags['GeoDoubleParamsTag'].value  # (中心纬度, 中心经度, 东偏, 北偏, 1/f, a)
    classes = np.where(np.isnan(grid), 255, grid).astype(np.uint8)
    return {'grid': classes, 'x0': tie[3], 'y0': tie[4], 'res': scale[0], 'lat0': params[0], 'lon0': params[1]}


def sample_vege(vege, bbox, res, china_rings):
    """取植被类型（0–11）；中国境内无数据的格点是湖泊等水面，记 254；境外记 255。"""
    l0, b0, l1, b1 = bbox
    w = int(round((l1 - l0) / res)) + 1
    h = int(round((b1 - b0) / res)) + 1
    lon, lat = np.meshgrid(l0 + np.arange(w) * res, b1 - np.arange(h) * res)
    s, az = vincenty_inverse(np.full(lon.size, vege['lat0']), np.full(lon.size, vege['lon0']), lat.ravel(), lon.ravel())
    px = np.floor((s * np.sin(az) - vege['x0']) / vege['res']).astype(int)
    py = np.floor((vege['y0'] - s * np.cos(az)) / vege['res']).astype(int)
    g = vege['grid']
    ok = (px >= 0) & (px < g.shape[1]) & (py >= 0) & (py < g.shape[0])
    out = np.full(px.shape, 255, np.uint8)
    out[ok] = g[py[ok], px[ok]]
    out = out.reshape(h, w)
    mask = Image.new('L', (w, h), 0)
    draw = ImageDraw.Draw(mask)
    for ring in china_rings:
        draw.polygon([((p[0] - l0) / res, (b1 - p[1]) / res) for p in ring], fill=1)
    inside = np.array(mask, bool)
    out[(out == 255) & inside] = 254
    return out


def write_gray_png(path, arr):
    h, w = arr.shape
    raw = b''.join(b'\x00' + arr[y].tobytes() for y in range(h))
    def chunk(tag, data):
        return struct.pack('>I', len(data)) + tag + data + struct.pack('>I', zlib.crc32(tag + data) & 0xFFFFFFFF)
    with open(path, 'wb') as fh:
        fh.write(b'\x89PNG\r\n\x1a\n' + chunk(b'IHDR', struct.pack('>IIBBBBB', w, h, 8, 0, 0, 0, 0))
                 + chunk(b'IDAT', zlib.compress(raw, 9)) + chunk(b'IEND', b''))


# ---------- 矢量 ----------
def rings_of(geom):
    if geom['type'] == 'Polygon':
        return [r for r in geom['coordinates']]
    if geom['type'] == 'MultiPolygon':
        return [r for poly in geom['coordinates'] for r in poly]
    return []


def lines_of(geom):
    if geom['type'] == 'LineString':
        return [geom['coordinates']]
    if geom['type'] == 'MultiLineString':
        return geom['coordinates']
    return []


def dp(points, tol):
    if len(points) < 3:
        return points
    pts = np.asarray(points, dtype=float)
    keep = np.zeros(len(pts), bool)
    keep[0] = keep[-1] = True
    stack = [(0, len(pts) - 1)]
    while stack:
        i, j = stack.pop()
        if j <= i + 1:
            continue
        a, b = pts[i], pts[j]
        seg = b - a
        seg_len = math.hypot(*seg) or 1e-12
        rel = pts[i + 1:j] - a
        dist = np.abs(seg[0] * rel[:, 1] - seg[1] * rel[:, 0]) / seg_len
        k = int(np.argmax(dist))
        if dist[k] > tol:
            keep[i + 1 + k] = True
            stack += [(i, i + 1 + k), (i + 1 + k, j)]
    return pts[keep].tolist()


def in_bbox(p, bbox, pad=0.0):
    return bbox[0] - pad <= p[0] <= bbox[2] + pad and bbox[1] - pad <= p[1] <= bbox[3] + pad


def clip_line(points, bbox, pad=0.2):
    """按 bbox 切出落在范围内的连续片段（保留越界的第一个点，保证线条延伸到边缘）。"""
    parts, cur = [], []
    for p in points:
        if in_bbox(p, bbox, pad):
            cur.append(p)
        else:
            if cur:
                cur.append(p)
                parts.append(cur)
                cur = []
    if cur:
        parts.append(cur)
    return [c for c in parts if len(c) >= 2]


def q(points, digits):
    return [[round(x, digits), round(y, digits)] for x, y in points]


def chain_segments(segments):
    """把无序线段拼成折线：在度数不为 2 的端点处断开。"""
    adj = defaultdict(list)
    for a, b in segments:
        adj[a].append(b)
        adj[b].append(a)
    used = set()
    lines = []

    def walk(start, nxt):
        line = [start, nxt]
        used.add(edge_key(start, nxt))
        cur = nxt
        while len(adj[cur]) == 2:
            cand = [n for n in adj[cur] if edge_key(cur, n) not in used]
            if not cand:
                break
            used.add(edge_key(cur, cand[0]))
            line.append(cand[0])
            cur = cand[0]
        return line

    for node in adj:
        if len(adj[node]) != 2:
            for n in adj[node]:
                if edge_key(node, n) not in used:
                    lines.append(walk(node, n))
    for node in adj:
        for n in adj[node]:
            if edge_key(node, n) not in used:
                lines.append(walk(node, n))
    return [[list(p) for p in line] for line in lines]


def edge_key(a, b):
    return (a, b) if a < b else (b, a)


def build_vectors(ne_dir):
    countries = json.load(open(os.path.join(ne_dir, 'ne_10m_admin_0_countries_chn.geojson')))
    maritime = json.load(open(os.path.join(ne_dir, 'ne_10m_admin_0_boundary_lines_maritime_indicator_chn.geojson')))
    admin1 = json.load(open(os.path.join(ne_dir, 'ne_10m_admin_1_states_provinces.geojson')))
    rivers = json.load(open(os.path.join(ne_dir, 'ne_10m_rivers_lake_centerlines.geojson')))

    china_codes = {'CHN', 'HKG', 'MAC'}
    china_rings, other = [], []
    for f in countries['features']:
        code = f['properties'].get('ADM0_A3')
        rs = rings_of(f['geometry'])
        if code in china_codes:
            china_rings += rs
        else:
            other.append((code, rs))

    # 国界：中国多边形的边与邻国多边形共享的部分；其余为海岸线
    def rkey(p):
        return (round(p[0], 5), round(p[1], 5))
    china_edges = set()
    for r in china_rings:
        for a, b in zip(r, r[1:]):
            china_edges.add(edge_key(rkey(a), rkey(b)))
    neighbor_edges = set()
    for _, rs in other:
        for r in rs:
            for a, b in zip(r, r[1:]):
                k = edge_key(rkey(a), rkey(b))
                if k in china_edges:
                    neighbor_edges.add(k)
    land_border = chain_segments(sorted(neighbor_edges))
    coast_segments = sorted(china_edges - neighbor_edges)
    coastline = chain_segments(coast_segments)

    neighbors = []
    for code, rs in other:
        for r in rs:
            if any(in_bbox(p, [60, 0, 150, 60]) for p in r):
                neighbors.append(r)

    # 省界：只保留两个省共享的内部边，外缘用国界与海岸线表示
    provinces = [f for f in admin1['features'] if f['properties'].get('adm0_a3') == 'CHN']
    edge_count = defaultdict(int)
    labels = []
    for f in provinces:
        name = f['properties'].get('name_zh') or ''
        short = name
        for suffix in ('壮族自治区', '回族自治区', '维吾尔自治区', '自治区', '省', '市'):
            if short.endswith(suffix):
                short = short[: -len(suffix)]
                break
        rs = rings_of(f['geometry'])
        for r in rs:
            for a, b in zip(r, r[1:]):
                edge_count[edge_key(rkey(a), rkey(b))] += 1
        biggest = max(rs, key=len)
        lon = f['properties'].get('longitude')
        lat = f['properties'].get('latitude')
        if lon is None:
            arr = np.asarray(biggest)
            lon, lat = float(arr[:, 0].mean()), float(arr[:, 1].mean())
        if short and short != '西沙群岛':
            labels.append({'name': short, 'at': [round(lon, 2), round(lat, 2)]})
    labels.append({'name': '台湾', 'at': [120.95, 23.75]})
    labels.append({'name': '香港', 'at': [114.17, 22.32], 'small': True})
    labels.append({'name': '澳门', 'at': [113.55, 22.17], 'small': True})
    province_lines = chain_segments(sorted(k for k, n in edge_count.items() if n >= 2))

    dash = [l for f in maritime['features'] if 'dash' in str(f['properties'].get('COMMENT', '')).lower() for l in lines_of(f['geometry'])]

    river_lines = []
    for f in rivers['features']:
        p = f['properties']
        name_en = p.get('name') or p.get('name_en') or ''
        rank = p.get('scalerank') or 10
        for line in lines_of(f['geometry']):
            if not any(in_bbox(pt, [70, 15, 138, 55]) for pt in line):
                continue
            zh = RIVER_ZH.get(name_en, '')
            if name_en == 'Min':
                zh = '岷江' if line[0][0] < 110 else '闽江'
            river_lines.append({'name': zh, 'rank': rank, 'pts': line})

    return {
        'china': china_rings, 'border': land_border, 'coast': coastline, 'neighbors': neighbors,
        'provinces': province_lines, 'labels': labels, 'dash': dash, 'rivers': river_lines,
    }


def layer_for_bbox(vec, bbox, tol, digits, river_rank, pad=0.3, with_land=True):
    def lines(collection):
        out = []
        for line in collection:
            for part in clip_line(line, bbox, pad):
                s = dp(part, tol)
                if len(s) >= 2:
                    out.append(q(s, digits))
        return out

    def polys(collection, coarse_tol):
        out = []
        for ring in collection:
            if not any(in_bbox(p, bbox, pad + 2) for p in ring):
                continue
            half = len(ring) // 2
            s = dp(ring[: half + 1], coarse_tol)[:-1] + dp(ring[half:], coarse_tol)
            if len(s) >= 4:
                out.append(q(s, digits))
        return out

    rivers = []
    for r in vec['rivers']:
        if r['rank'] > river_rank:
            continue
        for part in clip_line(r['pts'], bbox, pad):
            s = dp(part, tol)
            if len(s) >= 2:
                rivers.append({'name': r['name'], 'rank': r['rank'], 'pts': q(s, digits)})
    return {
        'bbox': bbox,
        'land': polys(vec['china'], tol) if with_land else [],
        'neighbors': polys(vec['neighbors'], tol * 2) if with_land else [],
        'border': lines(vec['border']),
        'coast': lines(vec['coast']),
        'provinces': lines(vec['provinces']),
        'dash': lines(vec['dash']),
        'labels': [l for l in vec['labels'] if in_bbox(l['at'], bbox, 0.2)],
        'rivers': rivers,
    }


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('--dem', required=True)
    ap.add_argument('--ne', required=True)
    ap.add_argument('--campaigns', required=True)
    ap.add_argument('--vege', default=None)
    ap.add_argument('--out', default='.')
    args = ap.parse_args()

    terrain_dir = os.path.join(args.out, 'data', 'terrain')
    map_dir = os.path.join(args.out, 'data', 'map')
    os.makedirs(terrain_dir, exist_ok=True)
    os.makedirs(map_dir, exist_ok=True)

    dem = read_dem(args.dem)
    vec = build_vectors(args.ne)
    index = {}

    vege = read_vege(args.vege) if args.vege else None
    china_rings = vec['china']

    def save_landcover(key, bbox, res, meta):
        if not vege:
            return
        write_gray_png(os.path.join(terrain_dir, f'{key}.lc.png'), sample_vege(vege, bbox, res, china_rings))
        meta['landcover'] = f'{key}.lc.png'

    base, w, h, _, _ = bicubic(dem, OVERVIEW_BBOX, 0.05)
    np.clip(np.round(base), -9000, 9000).astype('<i2').tofile(os.path.join(terrain_dir, 'overview.bin'))
    index['overview'] = {'bbox': OVERVIEW_BBOX, 'w': w, 'h': h, 'res': 0.05}
    save_landcover('overview', OVERVIEW_BBOX, 0.05, index['overview'])
    overview = layer_for_bbox(vec, OVERVIEW_BBOX, 0.06, 2, 7, pad=1.0)
    overview['scs'] = layer_for_bbox(vec, SCS_BBOX, 0.05, 2, 0, pad=0.5)
    json.dump(overview, open(os.path.join(map_dir, 'overview.json'), 'w'), ensure_ascii=False, separators=(',', ':'))

    for c in json.load(open(args.campaigns)):
        l0, b0, l1, b1 = c['bbox']
        mx = max((l1 - l0) * CAMPAIGN_MARGIN, 0.4)
        my = max((b1 - b0) * CAMPAIGN_MARGIN, 0.4)
        ext = [round(l0 - mx, 2), round(b0 - my, 2), round(l1 + mx, 2), round(b1 + my, 2)]
        grid, w, h = synth_terrain(dem, ext, 0.01)
        grid.tofile(os.path.join(terrain_dir, f"{c['id']}.bin"))
        index[c['id']] = {'bbox': ext, 'w': w, 'h': h, 'res': 0.01}
        save_landcover(c['id'], ext, 0.01, index[c['id']])
        layer = layer_for_bbox(vec, ext, 0.008, 3, 9, pad=0.2, with_land=False)
        json.dump(layer, open(os.path.join(map_dir, f"{c['id']}.json"), 'w'), ensure_ascii=False, separators=(',', ':'))

    json.dump(index, open(os.path.join(terrain_dir, 'index.json'), 'w'), ensure_ascii=False, indent=2)
    for name in sorted(os.listdir(terrain_dir)) + sorted(os.listdir(map_dir)):
        path = os.path.join(terrain_dir if name.endswith(('.bin', '.png')) or name == 'index.json' else map_dir, name)
        print(f'{name:28s} {os.path.getsize(path) / 1024:8.1f} KB')


if __name__ == '__main__':
    main()
