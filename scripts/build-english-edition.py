#!/usr/bin/env python3
"""生成英文版《毛泽东选集》数据（来源：Marxists Internet Archive，marxists.org）。

  python3 scripts/build-english-edition.py [--cache DIR] [--out .]

输出：
  data/en/catalog.json        五卷目录（每篇带 marxists.org 原址与对应的中文篇目文件名 zh）
  data/en/articles/*.md       每篇正文（Markdown，文末为 Notes）
  data/en/quotes.json         英文语录卡（取自 Quotations from Chairman Mao Tse-tung，附出处）
  data/en/text-edition.json   版本说明
运行后再执行 node scripts/build-search-index.mjs --edition en 生成英文检索索引。

英文本为外文出版社（北京）1965—1977 年《毛泽东选集》第一至五卷英译本，
由 Maoist Documentation Project 录入、marxists.org 校订发布。
"""
import argparse
import html
import json
import os
import re
import time
import urllib.request
from html.parser import HTMLParser

BASE = 'https://www.marxists.org/reference/archive/mao/'
SW = BASE + 'selected-works/'
RED_BOOK = BASE + 'works/red-book/'
VOLUME_LABELS = ['Volume I', 'Volume II', 'Volume III', 'Volume IV', 'Volume V']
VOLUME_PERIODS = [
    'The First Revolutionary Civil War Period and the Second Revolutionary Civil War Period',
    'The Period of the War of Resistance Against Japan (I)',
    'The Period of the War of Resistance Against Japan (II)',
    'The Period of the Third Revolutionary Civil War',
    'The Period of the Socialist Revolution and Socialist Construction (I)',
]
# 1991 年中文第二版第一卷收入的《反对本本主义》在外文出版社英译本中没有
ZH_ONLY = {'反对本本主义'}


def fetch(url, cache_dir):
    name = re.sub(r'[^A-Za-z0-9._-]+', '_', url[len(BASE):])
    path = os.path.join(cache_dir, name)
    if os.path.exists(path):
        raw = open(path, 'rb').read()
    else:
        req = urllib.request.Request(url, headers={'User-Agent': 'redwisdom-english-edition/1.0 (study site; contact via github.com/kirinzhang/redwisdom)'})
        for attempt in range(3):
            try:
                raw = urllib.request.urlopen(req, timeout=60).read()
                break
            except Exception:  # 网络抖动时重试
                if attempt == 2:
                    raise
                time.sleep(2)
        open(path, 'wb').write(raw)
        time.sleep(0.3)
    m = re.search(rb'charset=["\']?([A-Za-z0-9_-]+)', raw[:2000])
    enc = (m.group(1).decode() if m else 'utf-8').lower()
    if enc in ('iso-8859-1', 'latin-1', 'latin1'):
        enc = 'cp1252'
    try:
        return raw.decode(enc)
    except (UnicodeDecodeError, LookupError):
        return raw.decode('utf-8', errors='replace')


def clean(text):
    text = html.unescape(re.sub(r'<[^>]+>', ' ', text))
    return re.sub(r'\s+', ' ', text).strip()


def title_case(text):
    return clean(text).strip(' .')


def slugify(text):
    s = re.sub(r'[^a-z0-9]+', '-', text.lower()).strip('-')
    return s[:60].strip('-') or 'article'


# ---------- 日期与中英篇目对照 ----------
MONTHS = {m: i for i, m in enumerate(['january', 'february', 'march', 'april', 'may', 'june', 'july', 'august', 'september', 'october', 'november', 'december'], 1)}
ZH_DIGITS = {'〇': 0, '零': 0, '一': 1, '二': 2, '三': 3, '四': 4, '五': 5, '六': 6, '七': 7, '八': 8, '九': 9}


def en_date_key(text):
    t = text.lower()
    y = re.search(r'(1[89]\d\d)', t)
    m = re.search(r'(' + '|'.join(MONTHS) + r')(?:\s+(\d{1,2}))?', t)
    return (int(y.group(1)) if y else None, MONTHS[m.group(1)] if m else None, int(m.group(2)) if m and m.group(2) else None)


def zh_number(s):
    if not s:
        return None
    if '十' in s:
        a, _, b = s.partition('十')
        return (ZH_DIGITS.get(a, 1) if a else 1) * 10 + (ZH_DIGITS.get(b, 0) if b else 0)
    return ZH_DIGITS.get(s)


def zh_date_key(markdown):
    m = re.search(r'（([〇零一二三四五六七八九]{4})年(?:([一二三四五六七八九十]{1,3})月)?(?:([一二三四五六七八九十]{1,3})日)?', markdown[:600])
    if not m:
        return (None, None, None)
    year = int(''.join(str(ZH_DIGITS[c]) for c in m.group(1)))
    return (year, zh_number(m.group(2)), zh_number(m.group(3)))


def pair_volume(en_entries, zh_entries):
    """中英文篇目默认按同一位置对照；只有当同位置日期对不上、而相邻篇目的年月日完全一致时才调换。"""
    n = len(en_entries)
    pairs = list(range(n))
    ek = [en_date_key(e['date']) for e in en_entries]
    zk = [z['dateKey'] for z in zh_entries]
    def exact(a, b):
        return a[0] and a == b and a[2]
    for i in range(n - 1):
        a, b = pairs[i], pairs[i + 1]
        if not exact(ek[i], zk[a]) and not exact(ek[i + 1], zk[b]) and exact(ek[i], zk[b]) and exact(ek[i + 1], zk[a]):
            pairs[i], pairs[i + 1] = b, a
    return [zh_entries[k] for k in pairs]


# 外文出版社英译本中的个别篇名与正文标题不一致（目录页有错字），以正文标题为准
SMALL_WORDS = {'a', 'an', 'the', 'and', 'or', 'nor', 'but', 'of', 'in', 'on', 'to', 'for', 'by', 'with', 'at', 'from', 'as', 'into', 'than', 'its', 'is', 'are', 'be'}


def smart_title(upper):
    words = re.split(r'(\s+)', clean(upper).strip(' .'))
    out = []
    for k, w in enumerate(words):
        if not w.strip():
            out.append(w)
            continue
        lw = w.lower()
        core = re.sub(r'[^a-z]', '', lw)
        if re.fullmatch(r'(?:[A-Z]\.){2,}[A-Z]?\.?', w) or core in ('ussr', 'cpc', 'kmt'):
            out.append(w)
        elif k and core in SMALL_WORDS and not re.search(r'[:—-]\s*$', ''.join(out).rstrip()):
            out.append(lw)
        else:
            word = re.sub(r'(^|[“"(‘])([a-z])', lambda m: m.group(1) + m.group(2).upper(), lw)
            word = re.sub(r'-([a-z]{5,})', lambda m: '-' + (m.group(1) if m.group(1) in HYPHEN_LOWER else m.group(1).capitalize()), word)
            out.append(word)
    return ''.join(out)


def article_heading(src):
    m = re.search(r'(?is)<h1[^>]*>(.*?)</h1>', src)
    return re.sub(r'\s*\[\s*\d+\s*\]\s*', ' ', clean(m.group(1))).strip() if m else ''


TITLE_FIXES = {'Wllliam': 'William', 'Film the Life': 'Film The Life'}
# 目录页上错得太多、无法自动判断的篇名
INDEX_TITLE_FIXES = {'Methods of Work Committtees': 'Methods of Work of Party Committees'}
HYPHEN_LOWER = {'operation', 'operative', 'revolutionaries', 'revolutionary', 'arrest', 'establishment'}


def better_title(index_title, heading):
    """目录页篇名有截断或错字时改用正文标题（只在两者基本一致时替换）。"""
    import difflib
    a, b = norm_title(index_title), norm_title(heading)
    if not b or a == b:
        return index_title
    if b.startswith(a) or difflib.SequenceMatcher(None, a, b).ratio() > 0.9:
        title = smart_title(heading)
        for wrong, right in TITLE_FIXES.items():
            title = title.replace(wrong, right)
        return title
    return index_title


# ---------- 目录 ----------
def parse_volume_index(src):
    entries, seen = [], set()
    for m in re.finditer(r'(?is)<a\s+href="(mswv\d+_\d+\.htm)"\s*>(.*?)</a>(.*?)(?=<a\s|<p|$)', src):
        href, label, tail = m.group(1), m.group(2), m.group(3)
        if href in seen:
            continue
        seen.add(href)
        date = ''
        dm = re.search(r'(?is)<(?:i|em)>\s*\((.*?)\)\s*</(?:i|em)>', tail)
        if dm:
            date = clean(dm.group(1))
        entries.append({'href': href, 'title': title_case(label), 'date': date})
    return entries


# ---------- 正文 HTML → Markdown ----------
class ArticleParser(HTMLParser):
    BLOCK = {'p', 'h1', 'h2', 'h3', 'h4', 'h5', 'blockquote', 'li', 'div', 'br', 'hr', 'table', 'tr', 'td'}

    def __init__(self):
        super().__init__(convert_charrefs=True)
        self.blocks = []      # (kind, cls, id, text)
        self.cur = None
        self.stack = []
        self.skip = 0

    def start_block(self, kind, attrs):
        self.flush()
        a = dict(attrs)
        self.cur = [kind, (a.get('class') or '').lower(), a.get('id') or '', []]

    def flush(self):
        if self.cur is not None:
            text = re.sub(r'[ \t\r\n]+', ' ', ''.join(self.cur[3])).strip()
            if text:
                self.blocks.append((self.cur[0], self.cur[1], self.cur[2], text))
        self.cur = None

    def handle_starttag(self, tag, attrs):
        tag = tag.lower()
        if tag in ('script', 'style', 'head', 'title'):
            self.skip += 1
            return
        if tag == 'hr':
            self.flush()
            self.blocks.append(('hr', '', '', ''))
            return
        if tag in ('p', 'h1', 'h2', 'h3', 'h4', 'h5', 'li', 'blockquote'):
            self.start_block(tag, attrs)
            return
        if tag == 'br':
            if self.cur is not None:
                self.cur[3].append(' ')
            return
        if self.cur is None:
            self.start_block('p', [])
        if tag in ('i', 'em'):
            self.cur[3].append('\x01')
        elif tag in ('b', 'strong'):
            self.cur[3].append('\x03')
        elif tag == 'a':
            href = dict(attrs).get('href') or ''
            m = re.match(r'#bm(\d+)', href)
            self.stack.append('note' if m else 'a')
        elif tag == 'sup':
            pass

    def handle_endtag(self, tag):
        tag = tag.lower()
        if tag in ('script', 'style', 'head', 'title'):
            self.skip = max(0, self.skip - 1)
            return
        if tag in ('p', 'h1', 'h2', 'h3', 'h4', 'h5', 'li', 'blockquote'):
            self.flush()
            return
        if self.cur is None:
            return
        if tag in ('i', 'em'):
            self.cur[3].append('\x02')
        elif tag in ('b', 'strong'):
            self.cur[3].append('\x04')
        elif tag == 'a' and self.stack:
            self.stack.pop()

    def handle_data(self, data):
        if self.skip:
            return
        if self.cur is None:
            if not data.strip():
                return
            self.start_block('p', [])
        self.cur[3].append(data)

    def close(self):
        super().close()
        self.flush()


def tidy_inline(text):
    # 斜体 \x01…\x02、粗体 \x03…\x04：把标记内侧的空白挪到外侧，去掉空标记和不成对的标记，再换成 Markdown
    for o, c in (('\x01', '\x02'), ('\x03', '\x04')):
        for _ in range(3):
            text = re.sub(o + r'(\s+)', r'\1' + o, text)
            text = re.sub(r'(\s+)' + c, c + r'\1', text)
            text = text.replace(o + c, '').replace(c + o, '')
        out, depth = [], 0
        for ch in text:
            if ch == o:
                depth += 1
                if depth == 1:
                    out.append(ch)
            elif ch == c:
                if depth == 1:
                    out.append(ch)
                depth = max(0, depth - 1)
            else:
                out.append(ch)
        if depth:
            out.append(c)
        text = ''.join(out)
    text = re.sub('[\x01\x02]', '*', text)
    text = re.sub('[\x03\x04]', '**', text)
    text = text.replace('*', '') if text.count('*') % 2 else text
    text = re.sub(r'\[\s*(\d+)\s*\]', r'[\1]', text)
    return re.sub(r'\s+', ' ', text).strip()


def article_markdown(src, fallback_title, date):
    p = ArticleParser()
    p.feed(src)
    p.close()
    blocks = p.blocks
    title = fallback_title
    body, notes, intro = [], [], []
    seen_h1 = False
    for kind, cls, bid, text in blocks:
        text = tidy_inline(text)
        if kind == 'hr' or not text:
            continue
        plain = clean(text.replace('*', ''))
        if re.match(r'(?i)^transcription', plain) or plain.startswith('Selected Works of Mao Tse-tung') and kind == 'p' and 'title' in cls:
            continue
        if kind == 'h1':
            seen_h1 = True
            continue
        if not seen_h1:
            continue
        nm = re.match(r'^bm(\d+)$', bid)
        if nm or ('information' in cls and re.match(r'^\*?\d+\.\s', plain)):
            n = nm.group(1) if nm else re.match(r'^\*?(\d+)\.', plain).group(1)
            note = re.sub(r'^\*?\d+\.\s*', '', text).strip()
            notes.append(f'[{n}] {note}')
            continue
        if 'title' in cls and not body and not intro:
            if not date and re.search(r'\d{4}', plain):
                date = plain  # 目录里没有日期时，用正文开头的日期行
            continue
        if date and len(body) <= 1 and plain.strip('() ') == re.sub(r'^\(|\)$', '', date).strip():
            continue  # 副标题后重复的日期行
        if 'information' in cls and not body:
            intro.append(text)
            continue
        if re.match(r'(?i)^notes?$', plain):
            continue
        if kind in ('h2', 'h3', 'h4', 'h5'):
            body.append(f'## {plain}')
        elif 'quote' in cls or kind == 'blockquote':
            body.append(f'> {text}')
        else:
            body.append(text)
    lines = [f'# {title}', '']
    if date:
        date = re.sub(r'^\(|\)$', '', date).strip()
        lines += [f'*{date}*', '']
    for t in intro:
        lines += [f'> {t}', '']
    for t in body:
        lines += [t, '']
    if notes:
        lines += ['## Notes', '']
        for t in notes:
            lines += [t, '']
    return '\n'.join(lines).strip() + '\n', len(body), date


# ---------- 语录（红宝书） ----------
def parse_red_book_chapter(src):
    title_m = re.search(r'(?is)<h3>(.*?)</h3>', src)
    chapter = clean(title_m.group(1)) if title_m else ''
    body = src[title_m.end():] if title_m else src
    quotes, buf = [], []
    for m in re.finditer(r'(?is)<p([^>]*)>(.*?)(?=<p[\s>]|</body>)', body):
        attrs, inner = m.group(1).lower(), m.group(2)
        text = clean(inner)
        if 'skip' in attrs or not text:
            continue
        if 'inline' in attrs:
            if buf:
                quotes.append({'paragraphs': buf, 'citation': text})
            buf = []
        else:
            buf.append(text)
    return chapter, quotes


def norm_title(t):
    t = html.unescape(t).lower()
    t = re.sub(r'[“”"\'’‘]', '', t)
    return re.sub(r'[^a-z0-9]+', ' ', t).strip()


def match_article(citation, by_title):
    m = re.match(r'^[“"](.+?)[”"]', citation)
    key = norm_title(m.group(1) if m else re.sub(r'\s*\(.*$', '', citation))
    if not key:
        return None
    if key in by_title:
        return by_title[key]
    for k, art in by_title.items():
        if len(key) > 12 and (k.startswith(key) or key.startswith(k)):
            return art
    return None


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('--cache', default='.cache/marxists')
    ap.add_argument('--out', default='.')
    args = ap.parse_args()
    os.makedirs(args.cache, exist_ok=True)
    out_dir = os.path.join(args.out, 'data', 'en')
    art_dir = os.path.join(out_dir, 'articles')
    os.makedirs(art_dir, exist_ok=True)
    zh_catalog = json.load(open(os.path.join(args.out, 'data', 'catalog.json'), encoding='utf-8'))
    zh_volumes = list(zh_catalog['volumes'].values())

    catalog = {'volumes': {}}
    by_title = {}
    texts = {}
    index = 0
    for v in range(5):
        url = f'{SW}volume-{v + 1}/index.htm'
        entries = parse_volume_index(fetch(url, args.cache))
        zh = [dict(a, dateKey=zh_date_key(open(os.path.join(args.out, 'data', 'articles', a['filename']), encoding='utf-8').read()))
              for a in zh_volumes[v] if a['title'] not in ZH_ONLY]
        if len(zh) != len(entries):
            raise SystemExit(f'volume {v + 1}: {len(entries)} English vs {len(zh)} Chinese articles')
        srcs = [fetch(f'{SW}volume-{v + 1}/{e["href"]}', args.cache) for e in entries]
        for e, src in zip(entries, srcs):
            e['title'] = better_title(INDEX_TITLE_FIXES.get(e['title'], e['title']), article_heading(src))
        zh_pairs = pair_volume([dict(e, date=e['date'] or clean(re.sub(r'(?is).*?</h1>', '', src, count=1)[:200])) for e, src in zip(entries, srcs)], zh)
        label = f'{VOLUME_LABELS[v]} · {VOLUME_PERIODS[v]}'
        catalog['volumes'][label] = []
        for i, e in enumerate(entries):
            src = srcs[i]
            filename = f'{index:03d}-{slugify(e["title"])}.md'
            md, n_body, art_date = article_markdown(src, e['title'], e['date'])
            if n_body == 0:
                raise SystemExit(f'empty article: {e["href"]}')
            open(os.path.join(art_dir, filename), 'w', encoding='utf-8').write(md)
            texts[filename] = md
            entry = {'index': index, 'title': e['title'], 'filename': filename, 'date': art_date,
                     'source': f'{SW}volume-{v + 1}/{e["href"]}', 'zh': zh_pairs[i]['filename']}
            catalog['volumes'][label].append(entry)
            by_title[norm_title(e['title'])] = entry
            index += 1
    json.dump(catalog, open(os.path.join(out_dir, 'catalog.json'), 'w', encoding='utf-8'), ensure_ascii=False, indent=1)

    # 语录卡只取适合日常思考的章节与篇幅：去掉以战争、军队、阶级斗争、帝国主义为主题的章节和过长的段落
    CARD_EXCLUDED_CHAPTERS = {1, 2, 3, 5, 6, 8, 9, 12, 13, 14, 15, 16, 18, 26}
    CARD_EXCLUDED_WORDS = re.compile(r'(?i)imperialis|reactionar|running dogs|wipe (?:him|them|it) out|annihilat|atom bomb|U\.S\. aggress|\barmy\b|troops|military|enemy|counter-revolution|class struggle|bourgeois|landlord|Kuomintang')
    quotes = []
    prev = None
    for ch in range(1, 34):
        chapter, items = parse_red_book_chapter(fetch(f'{RED_BOOK}ch{ch:02d}.htm', args.cache))
        chapter_name = re.sub(r'^\d+\.\s*', '', chapter).replace('Critism', 'Criticism')
        for item in items:
            content = '\n\n'.join(item['paragraphs'])
            citation = item['citation'].replace(' *', '').rstrip('*').strip()
            if re.match(r'(?i)^ibid', citation) and prev:
                art, source, date = prev['art'], prev['source'], prev['date']
            else:
                art = match_article(citation, by_title)
                m = re.match(r'^[“"](.+?)[”"]', citation)
                source = art['title'] if art else (m.group(1) if m else re.sub(r'\s*\(.*$', '', citation).strip(' .'))
                dm = re.search(r'\(([^)]*\d{4}[^)]*)\)', citation)
                date = dm.group(1) if dm else ''
            prev = {'art': art, 'source': source, 'date': date}
            card = (ch not in CARD_EXCLUDED_CHAPTERS and len(content) <= 360 and content.count('\n\n') <= 1
                    and not CARD_EXCLUDED_WORDS.search(content))
            quotes.append({
                'id': len(quotes) + 1,
                'content': content,
                'citation': citation,
                'source': source,
                'date': date,
                'chapter': ch,
                'category': chapter_name,
                'card': card,
                'articleFilename': art['filename'] if art else '',
                'inSelectedWorks': bool(art),
            })
    json.dump({'metadata': {
        'source': 'Quotations from Chairman Mao Tse-tung (Foreign Languages Press, Peking, 1966)',
        'url': RED_BOOK + 'index.htm',
        'note': 'Each quotation keeps the citation printed in the book; quotations from the Selected Works link to the article in this edition.',
    }, 'quotes': quotes}, open(os.path.join(out_dir, 'quotes.json'), 'w', encoding='utf-8'), ensure_ascii=False, indent=1)

    edition = {
        'displayName': 'Selected Works of Mao Tse-tung, Volumes I–V (English)',
        'articleCount': index,
        'publisher': 'Foreign Languages Press, Peking (Vols. I–IV 1965–1969, Vol. V 1977)',
        'source': SW + 'index.htm',
        'transcription': 'Transcribed by the Maoist Documentation Project; HTML revised by the Marxists Internet Archive (marxists.org).',
        'verificationStatus': 'Converted automatically from marxists.org; check the printed edition for formal citation.',
        'notice': 'Text from the Marxists Internet Archive (marxists.org). Chinese article titles are linked for comparison; the English translation follows the Foreign Languages Press edition and differs from the 1991 Chinese second edition in places (e.g. "Oppose Book Worship" is not in English Volume I).',
    }
    json.dump(edition, open(os.path.join(out_dir, 'text-edition.json'), 'w', encoding='utf-8'), ensure_ascii=False, indent=1)
    linked = sum(1 for q in quotes if q['articleFilename'])
    cards = sum(1 for q in quotes if q['card'])
    print(f'{index} articles, {len(quotes)} quotations ({linked} linked to the Selected Works, {cards} used as cards)')


if __name__ == '__main__':
    main()
