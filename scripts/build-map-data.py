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

依赖：numpy、tifffile（GeoTIFF 为 LZW 压缩，脚本内置解码，无需 imagecodecs）。
"""
import argparse
import json
import math
import os
from collections import defaultdict

import numpy as np
import tifffile

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


def read_dem(path):
    tf = tifffile.TiffFile(path)
    page = tf.pages[0]
    scale = page.tags['ModelPixelScaleTag'].value
    tie = page.tags['ModelTiepointTag'].value
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
    grid = np.concatenate(rows)[: width * height].reshape(height, width).astype(np.float32)
    grid = np.nan_to_num(grid, nan=0.0)
    return {'grid': grid, 'lon0': tie[3], 'lat0': tie[4], 'res': scale[0]}


def sample_dem(dem, bbox, res):
    l0, b0, l1, b1 = bbox
    w = int(round((l1 - l0) / res)) + 1
    h = int(round((b1 - b0) / res)) + 1
    lons = l0 + np.arange(w) * res
    lats = b1 - np.arange(h) * res
    fx = (lons - dem['lon0']) / dem['res']
    fy = (dem['lat0'] - lats) / dem['res']
    g = dem['grid']
    x0 = np.clip(np.floor(fx).astype(int), 0, g.shape[1] - 2)
    y0 = np.clip(np.floor(fy).astype(int), 0, g.shape[0] - 2)
    u = np.clip(fx - x0, 0, 1)[None, :]
    v = np.clip(fy - y0, 0, 1)[:, None]
    a = g[y0[:, None], x0[None, :]]
    b = g[y0[:, None], x0[None, :] + 1]
    c = g[y0[:, None] + 1, x0[None, :]]
    d = g[y0[:, None] + 1, x0[None, :] + 1]
    out = a * (1 - u) * (1 - v) + b * u * (1 - v) + c * (1 - u) * v + d * u * v
    if res > dem['res'] * 1.5:
        # 降采样时先做邻域平均，避免锯齿
        k = int(round(res / dem['res']))
        pad = np.pad(g, k, mode='edge')
        acc = np.zeros_like(out)
        for dy in range(-k // 2, k // 2 + 1):
            for dx in range(-k // 2, k // 2 + 1):
                acc += pad[np.clip(np.round(fy).astype(int) + dy + k, 0, pad.shape[0] - 1)[:, None],
                           np.clip(np.round(fx).astype(int) + dx + k, 0, pad.shape[1] - 1)[None, :]]
        out = acc / ((k // 2 * 2 + 1) ** 2)
    return np.clip(np.round(out), -9000, 9000).astype('<i2'), w, h


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
    ap.add_argument('--out', default='.')
    args = ap.parse_args()

    terrain_dir = os.path.join(args.out, 'data', 'terrain')
    map_dir = os.path.join(args.out, 'data', 'map')
    os.makedirs(terrain_dir, exist_ok=True)
    os.makedirs(map_dir, exist_ok=True)

    dem = read_dem(args.dem)
    vec = build_vectors(args.ne)
    index = {}

    grid, w, h = sample_dem(dem, OVERVIEW_BBOX, 0.1)
    grid.tofile(os.path.join(terrain_dir, 'overview.bin'))
    index['overview'] = {'bbox': OVERVIEW_BBOX, 'w': w, 'h': h, 'res': 0.1}
    overview = layer_for_bbox(vec, OVERVIEW_BBOX, 0.06, 2, 7, pad=1.0)
    overview['scs'] = layer_for_bbox(vec, SCS_BBOX, 0.05, 2, 0, pad=0.5)
    json.dump(overview, open(os.path.join(map_dir, 'overview.json'), 'w'), ensure_ascii=False, separators=(',', ':'))

    for c in json.load(open(args.campaigns)):
        l0, b0, l1, b1 = c['bbox']
        mx = max((l1 - l0) * CAMPAIGN_MARGIN, 0.4)
        my = max((b1 - b0) * CAMPAIGN_MARGIN, 0.4)
        ext = [round(l0 - mx, 2), round(b0 - my, 2), round(l1 + mx, 2), round(b1 + my, 2)]
        grid, w, h = sample_dem(dem, ext, 0.025)
        grid.tofile(os.path.join(terrain_dir, f"{c['id']}.bin"))
        index[c['id']] = {'bbox': ext, 'w': w, 'h': h, 'res': 0.025}
        layer = layer_for_bbox(vec, ext, 0.008, 3, 9, pad=0.2, with_land=False)
        json.dump(layer, open(os.path.join(map_dir, f"{c['id']}.json"), 'w'), ensure_ascii=False, separators=(',', ':'))

    json.dump(index, open(os.path.join(terrain_dir, 'index.json'), 'w'), ensure_ascii=False, indent=2)
    for name in sorted(os.listdir(terrain_dir)) + sorted(os.listdir(map_dir)):
        path = os.path.join(terrain_dir if name.endswith('.bin') or name == 'index.json' else map_dir, name)
        print(f'{name:28s} {os.path.getsize(path) / 1024:8.1f} KB')


if __name__ == '__main__':
    main()
