#!/usr/bin/env python3
"""Compiles the Administrator User Guide into its offline print edition (Sprint 6S).

    python scripts/admin_guide_pdf.py                       docs/ADMIN_USER_GUIDE.md -> docs/ADMIN_USER_GUIDE.pdf
    python scripts/admin_guide_pdf.py --input X.md --output Y.pdf

Reads the Markdown guide and lays it out with ReportLab: a title page, the guide's own sections with clickable
contents links and PDF bookmarks, its tables and screen captures, a page footer, and the informational disclaimer as
the closing footnote. The text is the Markdown text, word for word; nothing is rewritten on the way.

Before it writes anything, the script checks the guide's wording (check_nomenclature): the renamed screens must
appear under their current names ('Council Artifacts', 'Donations History', 'Credentials Vault'), and retired screen
names and corporate jargon must not. A failed check prints each offending line and exits with status 2.

Fonts: Arial (Windows) or DejaVu Sans (Linux) for text, with Segoe UI Symbol or DejaVu Sans as the fallback for
symbols such as the warning sign and arrows. Without either, Helvetica is used and characters it cannot draw are
left out, which the script reports.
"""
from __future__ import annotations

import argparse
import datetime as dt
import io
import re
import sys
from pathlib import Path
from xml.sax.saxutils import escape

from reportlab.lib import colors
from reportlab.lib.enums import TA_CENTER
from reportlab.lib.pagesizes import LETTER
from reportlab.lib.styles import ParagraphStyle
from reportlab.lib.units import inch
from reportlab.lib.utils import ImageReader
from reportlab.pdfbase import pdfmetrics
from reportlab.pdfbase.ttfonts import TTFont
from reportlab.platypus import (
    BaseDocTemplate,
    Frame,
    HRFlowable,
    Image,
    KeepTogether,
    ListFlowable,
    ListItem,
    PageBreak,
    PageTemplate,
    Paragraph,
    Spacer,
    Table,
    TableStyle,
)

ROOT = Path(__file__).resolve().parent.parent
DEFAULT_INPUT = ROOT / 'docs' / 'ADMIN_USER_GUIDE.md'
DEFAULT_OUTPUT = ROOT / 'docs' / 'ADMIN_USER_GUIDE.pdf'

DOCUMENT_TITLE = 'Administrator User Guide'
DOCUMENT_SUBTITLE = 'Knights of Columbus Tracking Platform'

# The closing footnote of the print edition. Kept here, in one place, so it can be replaced word for word.
DISCLAIMER = (
    'Informational notice. This guide describes the Knights of Columbus Tracking Platform for the council officers '
    'and administrators who run it. It is provided for information only. It is not an official publication of the '
    'Knights of Columbus Supreme Council, and it does not replace the Charter, Constitution and Laws of the Order, the '
    "council's bylaws, the forms the Supreme Council prescribes, or the advice of a qualified accountant, auditor or "
    'attorney. Screens, roles and rules can change between releases. Where this guide and the portal differ, the '
    'portal and the governing documents of the Order prevail.'
)

# The screens renamed before the pilot: the guide must use these names.
REQUIRED_SCREEN_NAMES = ('Council Artifacts', 'Donations History', 'Credentials Vault')

# Retired screen names and corporate jargon the guide must not contain. 'Enterprise' alone is allowed: the Drive
# archive's real root folder is named 'Fraternal Enterprise Suite' (DRIVE_VAULT_ROOT) and the guide must match it.
BANNED_TERMS = (
    (r'\bBulletins?\b', "the retired name of 'Council Artifacts'"),
    (r'\bGYST\b', "the retired name of the 'Microsoft Co-Pilot'"),
    (r'\bDonations Ledger\b', "the retired name of 'Donations History'"),
    (r'\bstakeholders?\b', 'corporate jargon'),
    (r'\bsynerg\w*', 'corporate jargon'),
    (r'\bleverag\w*', 'corporate jargon'),
    (r'\bfintech\b', 'corporate jargon'),
    (r'\benterprise[- ]grade\b', 'corporate jargon'),
    (r'\bB2B\b', 'corporate jargon'),
    (r'\bSaaS\b', 'corporate jargon'),
    (r'\bKPIs?\b', 'corporate jargon'),
    (r'\bROI\b', 'corporate jargon'),
    (r'\bcustomers?\b', "corporate wording; the guide speaks of members and councils"),
)

NAVY = colors.HexColor('#002855')
GOLD = colors.HexColor('#D6A420')
LINE = colors.HexColor('#C9D1DC')
MUTED = colors.HexColor('#4A5568')
QUOTE_BG = colors.HexColor('#F3F5F8')

PAGE_W, PAGE_H = LETTER
MARGIN = 0.75 * inch
CONTENT_W = PAGE_W - 2 * MARGIN
MAX_IMAGE_H = 6.0 * inch


# ---- wording check ----------------------------------------------------------------------------------------------------

def check_nomenclature(markdown: str) -> list[str]:
    """Every problem with the guide's wording, as 'line N: ...' messages; empty when the guide is clean."""
    problems = [f'missing screen name: {name!r}' for name in REQUIRED_SCREEN_NAMES if name not in markdown]
    for number, text in enumerate(markdown.splitlines(), start=1):
        if text.lstrip().startswith('<!--'):
            continue
        for pattern, why in BANNED_TERMS:
            for match in re.finditer(pattern, text, flags=re.IGNORECASE):
                problems.append(f'line {number}: {match.group(0)!r} is {why}')
    return problems


# ---- fonts ------------------------------------------------------------------------------------------------------------

class Fonts:
    """The text, bold, italic, mono and symbol-fallback faces, with the characters each can draw."""

    def __init__(self) -> None:
        self.regular, self.bold, self.italic, self.bold_italic = 'Helvetica', 'Helvetica-Bold', 'Helvetica-Oblique', 'Helvetica-BoldOblique'
        self.mono = 'Courier'
        self.symbol: str | None = None
        self.text_chars: set[int] | None = None
        self.symbol_chars: set[int] = set()
        self.dropped: set[str] = set()
        candidates = [
            ('C:/Windows/Fonts', ('arial.ttf', 'arialbd.ttf', 'ariali.ttf', 'arialbi.ttf'), ('consola.ttf', 'cour.ttf')),
            ('/usr/share/fonts/truetype/dejavu', ('DejaVuSans.ttf', 'DejaVuSans-Bold.ttf', 'DejaVuSans-Oblique.ttf', 'DejaVuSans-BoldOblique.ttf'), ('DejaVuSansMono.ttf',)),
        ]
        for folder, faces, monos in candidates:
            paths = [Path(folder) / f for f in faces]
            if all(p.exists() for p in paths):
                names = ('GuideSans', 'GuideSans-Bold', 'GuideSans-Italic', 'GuideSans-BoldItalic')
                for name, path in zip(names, paths):
                    pdfmetrics.registerFont(TTFont(name, str(path)))
                pdfmetrics.registerFontFamily('GuideSans', normal=names[0], bold=names[1], italic=names[2], boldItalic=names[3])
                self.regular, self.bold, self.italic, self.bold_italic = names
                self.text_chars = set(pdfmetrics.getFont(names[0]).face.charToGlyph.keys())
                for mono in monos:
                    if (Path(folder) / mono).exists():
                        pdfmetrics.registerFont(TTFont('GuideMono', str(Path(folder) / mono)))
                        self.mono = 'GuideMono'
                        break
                break
        for path in ('C:/Windows/Fonts/seguisym.ttf', '/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf'):
            if Path(path).exists():
                pdfmetrics.registerFont(TTFont('GuideSymbol', path))
                self.symbol = 'GuideSymbol'
                self.symbol_chars = set(pdfmetrics.getFont('GuideSymbol').face.charToGlyph.keys())
                break

    def drawable(self, ch: str) -> str:
        """'text', 'symbol' or 'drop' for one character."""
        code = ord(ch)
        if code in (0xFE0F, 0xFE0E, 0x200D):  # emoji presentation selectors and joiners carry no glyph of their own
            return 'drop'
        if self.text_chars is None:
            return 'text' if code < 256 else ('symbol' if code in self.symbol_chars else 'drop')
        if code in self.text_chars or code < 32:
            return 'text'
        if code in self.symbol_chars:
            return 'symbol'
        return 'drop'


FONTS: Fonts


def with_fallback(markup: str) -> str:
    """Wraps characters the text font lacks in the symbol font, skipping tags and entities; drops what neither has."""
    out: list[str] = []
    i = 0
    while i < len(markup):
        ch = markup[i]
        if ch == '<':
            end = markup.find('>', i)
            out.append(markup[i:end + 1])
            i = end + 1
            continue
        if ch == '&':
            end = markup.find(';', i)
            out.append(markup[i:end + 1])
            i = end + 1
            continue
        kind = FONTS.drawable(ch)
        if kind == 'text':
            out.append(ch)
        elif kind == 'symbol':
            out.append(f'<font name="{FONTS.symbol}">{ch}</font>')
        else:
            if ord(ch) not in (0xFE0F, 0xFE0E, 0x200D):
                FONTS.dropped.add(ch)
        i += 1
    return ''.join(out)


# ---- inline Markdown --------------------------------------------------------------------------------------------------

def slug(heading: str) -> str:
    """The GitHub anchor of a heading, which the guide's own contents links use."""
    text = re.sub(r'[*`]', '', heading).strip().lower()
    text = re.sub(r'[^\w\- ]', '', text)
    return text.replace(' ', '-')


def inline(text: str) -> str:
    """One line of Markdown as ReportLab paragraph markup."""
    parts: list[str] = []
    pos = 0
    # Code spans first, so nothing inside them is read as Markdown.
    for match in re.finditer(r'`([^`]+)`', text):
        parts.append(_inline_plain(text[pos:match.start()]))
        parts.append(f'<font name="{FONTS.mono}" size="8.5">{escape(match.group(1))}</font>')
        pos = match.end()
    parts.append(_inline_plain(text[pos:]))
    return with_fallback(''.join(parts))


def _inline_plain(text: str) -> str:
    out = escape(text)

    def link(match: re.Match[str]) -> str:
        label, href = match.group(1), match.group(2)
        if href.startswith('#'):
            return f'<link href="{href}" color="#002855"><u>{label}</u></link>'
        if href.startswith(('http://', 'https://', 'mailto:')):
            return f'<link href="{href}" color="#002855"><u>{label}</u></link>'
        return f'<i>{label}</i>'  # a sibling Markdown file: named, not linked, in print

    out = re.sub(r'\[([^\]]+)\]\(([^)\s]+)\)', link, out)
    return emphasis(out)


def emphasis(text: str) -> str:
    """
    **bold** and *italic*, nested either way ('**Needs *n***'). Each run of asterisks first closes what is open (the
    innermost first), then opens bold for two and italic for one. A run with spaces on both sides is a literal
    asterisk; a line whose markers do not pair up is left as typed.
    """
    out: list[str] = []
    stack: list[str] = []
    pos = 0
    for match in re.finditer(r'\*+', text):
        out.append(text[pos:match.start()])
        pos = match.end()
        before = text[match.start() - 1] if match.start() > 0 else ' '
        after = text[match.end()] if match.end() < len(text) else ' '
        if before.isspace() and after.isspace():
            out.append(match.group(0))
            continue
        left = len(match.group(0))
        while left and stack:
            need = 2 if stack[-1] == 'b' else 1
            if left < need:
                break
            out.append(f'</{stack.pop()}>')
            left -= need
        if left >= 2 and not after.isspace():
            out.append('<b>')
            stack.append('b')
            left -= 2
        if left >= 1 and not after.isspace():
            out.append('<i>')
            stack.append('i')
            left -= 1
        if left:
            return text  # unpaired markers
    out.append(text[pos:])
    return text if stack else ''.join(out)


# ---- styles -----------------------------------------------------------------------------------------------------------

def styles() -> dict[str, ParagraphStyle]:
    base = ParagraphStyle('body', fontName=FONTS.regular, fontSize=10, leading=13.5, textColor=colors.black, spaceAfter=5)
    return {
        'body': base,
        'h1': ParagraphStyle('h1', parent=base, fontName=FONTS.bold, fontSize=20, leading=24, textColor=NAVY, spaceBefore=4, spaceAfter=10),
        'h2': ParagraphStyle('h2', parent=base, fontName=FONTS.bold, fontSize=15, leading=19, textColor=NAVY, spaceBefore=6, spaceAfter=8),
        'h3': ParagraphStyle('h3', parent=base, fontName=FONTS.bold, fontSize=12, leading=15.5, textColor=NAVY, spaceBefore=10, spaceAfter=5),
        'cell': ParagraphStyle('cell', parent=base, fontSize=8.5, leading=11, spaceAfter=0),
        'head': ParagraphStyle('head', parent=base, fontName=FONTS.bold, fontSize=8.5, leading=11, textColor=colors.white, spaceAfter=0),
        'quote': ParagraphStyle('quote', parent=base, fontSize=9.5, leading=13, spaceAfter=2),
        'list': ParagraphStyle('list', parent=base, spaceAfter=2),
        'caption': ParagraphStyle('caption', parent=base, fontSize=8, leading=10, textColor=MUTED, alignment=TA_CENTER, spaceAfter=8),
        'title': ParagraphStyle('title', parent=base, fontName=FONTS.bold, fontSize=30, leading=36, textColor=NAVY, alignment=TA_CENTER),
        'subtitle': ParagraphStyle('subtitle', parent=base, fontSize=14, leading=18, textColor=NAVY, alignment=TA_CENTER),
        'meta': ParagraphStyle('meta', parent=base, fontSize=10, leading=14, textColor=MUTED, alignment=TA_CENTER),
        'disclaimer_head': ParagraphStyle('dh', parent=base, fontName=FONTS.bold, fontSize=9, leading=12, textColor=NAVY, spaceAfter=3),
        'disclaimer': ParagraphStyle('disclaimer', parent=base, fontSize=8.5, leading=11.5, textColor=colors.black, spaceAfter=0),
    }


# ---- block Markdown ---------------------------------------------------------------------------------------------------

IMAGE_ONLY = re.compile(r'^\s*!\[([^\]]*)\]\(([^)\s]+)\)\s*$')


def image_flowable(alt: str, src: str, base: Path, max_w: float, max_h: float) -> Image | None:
    path = (base / src).resolve()
    if not path.exists():
        print(f'warning: image not found, left out: {src}', file=sys.stderr)
        return None
    w, h = ImageReader(str(path)).getSize()
    scale = min(max_w / w, max_h / h)
    img = Image(print_copy(path, w * scale), width=w * scale, height=h * scale)
    img.hAlign = 'CENTER'
    return img


PRINT_DPI = 150


def print_copy(path: Path, width_pt: float):
    """
    The image resampled to PRINT_DPI at the width it is printed, so full-size screen captures do not bloat the file.
    Returns the path itself when Pillow is missing or the image is already small enough.
    """
    try:
        from PIL import Image as PILImage
    except ImportError:
        return str(path)
    target = max(1, round(width_pt / 72 * PRINT_DPI))
    with PILImage.open(path) as source:
        if source.width <= target:
            return str(path)
        ratio = target / source.width
        resized = source.convert('RGBA' if source.mode in ('RGBA', 'LA', 'P') else 'RGB').resize((target, max(1, round(source.height * ratio))), PILImage.LANCZOS)
        if resized.mode == 'RGBA':
            flat = PILImage.new('RGB', resized.size, 'white')
            flat.paste(resized, mask=resized.split()[3])
            resized = flat
        buffer = io.BytesIO()
        resized.save(buffer, format='PNG', optimize=True)
        buffer.seek(0)
        return buffer


def split_row(line: str) -> list[str]:
    cells = line.strip().strip('|').split('|')
    return [c.strip() for c in cells]


def table_flowable(rows: list[list[str]], st: dict[str, ParagraphStyle], base: Path) -> Table:
    width = max(len(r) for r in rows)
    rows = [r + [''] * (width - len(r)) for r in rows]

    def cell(text: str, header: bool):
        m = IMAGE_ONLY.match(text)
        if m and not header:
            img = image_flowable(m.group(1), m.group(2), base, 1.1 * inch, 1.1 * inch)
            if img is not None:
                return img
        return Paragraph(inline(text), st['head' if header else 'cell'])

    data = [[cell(c, i == 0) for c in r] for i, r in enumerate(rows)]
    # Columns share the width by their longest text, within limits, so short code columns stay narrow.
    lengths = [max(min(len(re.sub(r'[*`]', '', r[c])), 60) for r in rows) + 6 for c in range(width)]
    total = sum(lengths)
    widths = [CONTENT_W * n / total for n in lengths]
    table = Table(data, colWidths=widths, repeatRows=1, hAlign='LEFT')
    table.setStyle(
        TableStyle(
            [
                ('BACKGROUND', (0, 0), (-1, 0), NAVY),
                ('GRID', (0, 0), (-1, -1), 0.5, LINE),
                ('VALIGN', (0, 0), (-1, -1), 'TOP'),
                ('LEFTPADDING', (0, 0), (-1, -1), 4),
                ('RIGHTPADDING', (0, 0), (-1, -1), 4),
                ('TOPPADDING', (0, 0), (-1, -1), 3),
                ('BOTTOMPADDING', (0, 0), (-1, -1), 3),
                ('ROWBACKGROUNDS', (0, 1), (-1, -1), [colors.white, colors.HexColor('#F7F8FA')]),
            ]
        )
    )
    return table


def quote_flowable(lines: list[str], st: dict[str, ParagraphStyle]) -> Table:
    paras = [Paragraph(inline(line), st['quote']) for line in lines if line.strip()]
    box = Table([[p] for p in paras], colWidths=[CONTENT_W - 10], hAlign='LEFT')
    box.setStyle(
        TableStyle(
            [
                ('BACKGROUND', (0, 0), (-1, -1), QUOTE_BG),
                ('LINEBEFORE', (0, 0), (0, -1), 3, GOLD),
                ('LEFTPADDING', (0, 0), (-1, -1), 8),
                ('TOPPADDING', (0, 0), (-1, -1), 2),
                ('BOTTOMPADDING', (0, 0), (-1, -1), 2),
            ]
        )
    )
    return box


class Heading(Paragraph):
    """A heading paragraph that also becomes a PDF bookmark."""

    def __init__(self, text: str, style: ParagraphStyle, level: int, key: str):
        super().__init__(f'<a name="{key}"/>{inline(text)}', style)
        self.outline_text = re.sub(r'[*`]', '', text)
        self.outline_level = level
        self.outline_key = key


def build_story(markdown: str, base: Path, st: dict[str, ParagraphStyle]) -> list:
    story: list = []
    lines = markdown.splitlines()
    i = 0
    first_h2 = True
    para: list[str] = []

    def flush_para() -> None:
        if para:
            story.append(Paragraph(inline(' '.join(para)), st['body']))
            para.clear()

    while i < len(lines):
        line = lines[i]
        stripped = line.strip()

        if stripped.startswith('<!--'):  # editorial markers such as KEEP_IMAGE
            flush_para()
            i += 1
            continue
        if not stripped:
            flush_para()
            i += 1
            continue
        if re.fullmatch(r'-{3,}', stripped):
            flush_para()
            story.append(HRFlowable(width='100%', thickness=0.75, color=LINE, spaceBefore=6, spaceAfter=8))
            i += 1
            continue

        heading = re.match(r'^(#{1,6})\s+(.*)$', stripped)
        if heading:
            flush_para()
            level = len(heading.group(1))
            text = heading.group(2).strip()
            if level == 1:
                story.append(Heading(text, st['h1'], 0, slug(text)))
            elif level == 2:
                # Every numbered part starts on a new page; the contents and the reading note stay together.
                if not first_h2 and re.match(r'^(\d+\.|Appendix)', text):
                    story.append(PageBreak())
                first_h2 = False
                story.append(Heading(text, st['h2'], 0, slug(text)))
            else:
                story.append(Heading(text, st['h3'], 1, slug(text)))
            i += 1
            continue

        image = IMAGE_ONLY.match(stripped)
        if image:
            flush_para()
            img = image_flowable(image.group(1), image.group(2), base, CONTENT_W, MAX_IMAGE_H)
            if img is not None:
                story.append(KeepTogether([Spacer(1, 4), img, Paragraph(inline(image.group(1)), st['caption'])]))
            i += 1
            continue

        if stripped.startswith('|'):
            flush_para()
            rows: list[list[str]] = []
            while i < len(lines) and lines[i].strip().startswith('|'):
                row = split_row(lines[i])
                if not all(re.fullmatch(r':?-{3,}:?', c) for c in row if c):
                    rows.append(row)
                i += 1
            story.append(table_flowable(rows, st, base))
            story.append(Spacer(1, 8))
            continue

        if stripped.startswith('>'):
            flush_para()
            quoted: list[str] = []
            while i < len(lines) and lines[i].strip().startswith('>'):
                quoted.append(lines[i].strip()[1:].strip())
                i += 1
            story.append(quote_flowable(quoted, st))
            story.append(Spacer(1, 6))
            continue

        bullet = re.match(r'^[-*]\s+(.*)$', stripped)
        numbered = re.match(r'^(\d+)\.\s+(.*)$', stripped)
        if bullet or numbered:
            flush_para()
            items: list[ListItem] = []
            ordered = bool(numbered)
            start = int(numbered.group(1)) if numbered else 1
            pattern = r'^(\d+)\.\s+(.*)$' if ordered else r'^[-*]\s+(.*)$'
            while i < len(lines):
                m = re.match(pattern, lines[i].strip())
                if not m:
                    break
                items.append(ListItem(Paragraph(inline(m.group(m.lastindex)), st['list'])))
                i += 1
            if ordered:
                story.append(ListFlowable(items, bulletType='1', start=start, bulletFormat='%s.', leftIndent=18, bulletFontName=FONTS.regular, bulletFontSize=10))
            else:
                story.append(ListFlowable(items, bulletType='bullet', start='\u2022', leftIndent=14, bulletFontName=FONTS.regular, bulletFontSize=9))
            story.append(Spacer(1, 4))
            continue

        para.append(stripped)
        i += 1

    flush_para()
    return story


# ---- document ---------------------------------------------------------------------------------------------------------

class GuideDocument(BaseDocTemplate):
    def __init__(self, filename: str, generated: str):
        super().__init__(
            filename,
            pagesize=LETTER,
            leftMargin=MARGIN,
            rightMargin=MARGIN,
            topMargin=MARGIN,
            bottomMargin=MARGIN,
            title=f'{DOCUMENT_TITLE} - {DOCUMENT_SUBTITLE}',
            author='Knights of Columbus Tracking Platform',
            subject='Offline print edition of the Administrator User Guide',
            creator='scripts/admin_guide_pdf.py (ReportLab)',
        )
        self.generated = generated
        frame = Frame(MARGIN, MARGIN, CONTENT_W, PAGE_H - 2 * MARGIN, id='body', leftPadding=0, rightPadding=0, topPadding=0, bottomPadding=0)
        self.addPageTemplates([PageTemplate(id='page', frames=[frame], onPage=self._decorate)])

    def _decorate(self, canvas, doc) -> None:
        canvas.saveState()
        canvas.setStrokeColor(GOLD)
        canvas.setLineWidth(1)
        canvas.line(MARGIN, MARGIN - 14, PAGE_W - MARGIN, MARGIN - 14)
        canvas.setFont(FONTS.regular, 8)
        canvas.setFillColor(MUTED)
        canvas.drawString(MARGIN, MARGIN - 26, f'{DOCUMENT_SUBTITLE} \u00b7 {DOCUMENT_TITLE} \u00b7 Print edition {self.generated}')
        canvas.drawRightString(PAGE_W - MARGIN, MARGIN - 26, f'Page {doc.page}')
        canvas.restoreState()

    def afterFlowable(self, flowable) -> None:
        if isinstance(flowable, Heading):
            self.canv.bookmarkPage(flowable.outline_key)
            self.canv.addOutlineEntry(flowable.outline_text, flowable.outline_key, level=flowable.outline_level, closed=flowable.outline_level > 0)


def title_page(st: dict[str, ParagraphStyle], generated: str) -> list:
    return [
        Spacer(1, 2.4 * inch),
        HRFlowable(width='60%', thickness=2, color=GOLD, spaceAfter=18),
        Paragraph(DOCUMENT_TITLE, st['title']),
        Spacer(1, 10),
        Paragraph(DOCUMENT_SUBTITLE, st['subtitle']),
        HRFlowable(width='60%', thickness=2, color=GOLD, spaceBefore=18, spaceAfter=24),
        Paragraph('Offline print edition', st['meta']),
        Paragraph(f'Compiled {generated} from docs/ADMIN_USER_GUIDE.md', st['meta']),
        PageBreak(),
    ]


def disclaimer_footnote(st: dict[str, ParagraphStyle]) -> list:
    box = Table(
        [[Paragraph('Disclaimer', st['disclaimer_head'])], [Paragraph(with_fallback(escape(DISCLAIMER)), st['disclaimer'])]],
        colWidths=[CONTENT_W],
        hAlign='LEFT',
    )
    box.setStyle(
        TableStyle(
            [
                ('BOX', (0, 0), (-1, -1), 0.75, NAVY),
                ('BACKGROUND', (0, 0), (-1, -1), QUOTE_BG),
                ('LEFTPADDING', (0, 0), (-1, -1), 8),
                ('RIGHTPADDING', (0, 0), (-1, -1), 8),
                ('TOPPADDING', (0, 0), (-1, -1), 4),
                ('BOTTOMPADDING', (0, 0), (-1, -1), 6),
            ]
        )
    )
    return [Spacer(1, 18), HRFlowable(width='100%', thickness=1, color=GOLD, spaceAfter=8), KeepTogether([box])]


def compile_guide(source: Path, output: Path) -> None:
    global FONTS
    markdown = source.read_text(encoding='utf-8')
    problems = check_nomenclature(markdown)
    if problems:
        print(f'{source}: the wording check failed:', file=sys.stderr)
        for problem in problems:
            print(f'  {problem}', file=sys.stderr)
        sys.exit(2)
    FONTS = Fonts()
    st = styles()
    generated = dt.date.today().isoformat()
    story = title_page(st, generated) + build_story(markdown, source.parent, st) + disclaimer_footnote(st)
    output.parent.mkdir(parents=True, exist_ok=True)
    doc = GuideDocument(str(output), generated)
    doc.multiBuild(story)
    if FONTS.dropped:
        print('note: no installed font draws these characters, so they were left out: ' + ' '.join(sorted(FONTS.dropped)), file=sys.stderr)
    print(f'wrote {output} ({output.stat().st_size // 1024} KB, {doc.page} pages)')


def main(argv: list[str] | None = None) -> None:
    parser = argparse.ArgumentParser(description=__doc__.splitlines()[0])
    parser.add_argument('--input', type=Path, default=DEFAULT_INPUT)
    parser.add_argument('--output', type=Path, default=DEFAULT_OUTPUT)
    parser.add_argument('--check', action='store_true', help='run the wording check only; write nothing')
    args = parser.parse_args(argv)
    if args.check:
        problems = check_nomenclature(args.input.read_text(encoding='utf-8'))
        for problem in problems:
            print(problem)
        sys.exit(2 if problems else 0)
    compile_guide(args.input, args.output)


if __name__ == '__main__':
    main()
