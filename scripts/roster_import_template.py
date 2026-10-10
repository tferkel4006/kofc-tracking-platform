#!/usr/bin/env python3
# =========================================================================
# Roster import template (Sprint 7A).
#
# Compiles the Excel workbook council Admins fill in to onboard members:
#
#   apps/web/public/templates/roster_import_template.xlsx   (served by the portal at /templates/roster_import_template.xlsx)
#
#   py scripts/roster_import_template.py            (write the workbook)
#   py scripts/roster_import_template.py --check    (exit 1 if the committed workbook differs from a fresh build)
#
# Sheet 'Roster': one header row, then a fully filled sample row on line 2 (replace it with real members). The headers
# are the ones the portal's roster import reads (parseSupremeRosterCsv in packages/shared/src/onboarding.ts), so the
# sheet saved as CSV loads on Supreme Sync > 'Supreme roster sync'. Excel enforces drop-downs on Role (every office in
# the election lookup definitions, packages/shared/src/elections.ts, plus 'Member'), Degree (1-4) and Charter Member
# (Yes/No), and dates on Birth Date and Date Joined.
#
# The Role column is a planning aid: the import does not assign offices. Offices are filled through elections and the
# Grand Knight's appointments, so they keep their history.
#
# Sheet 'Lists' holds the drop-down choices (hidden); sheet 'Instructions' explains each column.
# Requires: pip install -r scripts/requirements.txt (openpyxl).
# =========================================================================
import argparse
import datetime as dt
import io
import re
import sys
import zipfile
from pathlib import Path

from openpyxl import Workbook, load_workbook
from openpyxl.styles import Alignment, Border, Font, PatternFill, Side
from openpyxl.utils import get_column_letter
from openpyxl.worksheet.datavalidation import DataValidation

ROOT = Path(__file__).resolve().parent.parent
OUTPUT = ROOT / 'apps' / 'web' / 'public' / 'templates' / 'roster_import_template.xlsx'
ELECTIONS = ROOT / 'packages' / 'shared' / 'src' / 'elections.ts'

# Brand tokens (packages/shared/src/theme.ts BRAND).
NAVY = '002855'
GOLD = 'D6A420'
WHITE = 'FFFFFF'

# A fixed timestamp keeps the workbook byte-for-byte reproducible, so --check can compare builds.
BUILT_AT = dt.datetime(2026, 10, 10, 12, 0, 0)

# Rows Excel validates (the header is row 1; the sample is row 2).
LAST_ROW = 1000

# (header, width, sample value, instruction). Headers match parseSupremeRosterCsv's ROSTER_HEADERS keys.
COLUMNS = [
    ('Member Number', 15, 1234567, 'Required. The member number from Supreme, a whole number. A number already on the council roster only updates Date Joined.'),
    ('First Name', 16, 'Joseph', 'Required. At most 100 characters.'),
    ('Last Name', 18, 'Kowalski', 'Required. At most 100 characters.'),
    ('Email', 30, 'joseph.kowalski@example.org', 'Required. Becomes the member\'s login; must not belong to another member. At most 50 characters.'),
    ('Phone', 16, '(555) 201-4477', 'Required. At most 50 characters.'),
    ('Street', 28, '410 Columbus Avenue', 'Required. At most 255 characters.'),
    ('Street 2', 16, 'Apt 2B', 'Optional. At most 255 characters.'),
    ('City', 16, 'Springfield', 'Required. At most 50 characters.'),
    ('State', 8, 'IL', 'Required. At most 20 characters.'),
    ('Zip', 10, '62701', 'Required. Keep it as text so a leading zero survives. At most 15 characters.'),
    ('Birth Date', 13, dt.date(1978, 3, 19), 'Required. A date in the past (YYYY-MM-DD).'),
    ('Degree', 9, 3, 'Optional. 1 to 4 from the drop-down; blank means First Degree.'),
    ('Date Joined', 13, dt.date(2026, 9, 12), 'Required. The day the member joined the council, not in the future (YYYY-MM-DD). Drives the New Member badge.'),
    ('Charter Member', 15, 'No', 'Optional. Yes for a brother who founded the council; blank means No.'),
    ('Role', 24, 'Member', 'Planning aid only, from the drop-down. The import does not assign offices: fill them through elections and the Grand Knight\'s appointments.'),
]


def _string_array(source: str, name: str, consts: dict) -> list:
    """The values of `export const NAME = [ ... ]`, resolving string constants such as GRAND_KNIGHT_ROLE."""
    match = re.search(rf'export const {name}\b[^=]*=\s*\[(.*?)\]', source, re.S)
    if not match:
        sys.exit(f'{ELECTIONS} has no {name} array.')
    values = []
    for token in re.split(r',', match.group(1)):
        token = re.sub(r'//.*', '', token).strip()
        if not token:
            continue
        if token.startswith('...'):
            values += consts[token[3:]]
        elif token[0] in '\'"':
            values.append(token[1:-1])
        elif token in consts:
            values.append(consts[token])
        else:
            sys.exit(f'{ELECTIONS}: cannot resolve {token!r} in {name}.')
    return values


def role_choices() -> list:
    """Every office in the election lookup definitions (OFFICE_ROLE_NAMES order), then 'Member'."""
    source = ELECTIONS.read_text(encoding='utf8')
    consts = dict(re.findall(r"export const ([A-Z_]+_ROLE)\s*=\s*'([^']+)';", source))
    for name in ('ELECTED_ROLE_NAMES', 'TRUSTEE_ROLE_NAMES', 'APPOINTED_ROLE_NAMES'):
        consts[name] = _string_array(source, name, consts)
    offices = _string_array(source, 'OFFICE_ROLE_NAMES', consts)
    if len(offices) != len(set(offices)) or not offices:
        sys.exit(f'{ELECTIONS}: OFFICE_ROLE_NAMES is empty or repeats a role.')
    return offices + ['Member']


def build() -> bytes:
    roles = role_choices()
    wb = Workbook()
    wb.properties.creator = 'KofC Tracking Platform'
    wb.properties.title = 'Roster import template'
    wb.properties.created = BUILT_AT
    wb.properties.modified = BUILT_AT

    ws = wb.active
    ws.title = 'Roster'
    thin = Side(style='thin', color=NAVY)
    for i, (header, width, sample, _) in enumerate(COLUMNS, start=1):
        letter = get_column_letter(i)
        ws.column_dimensions[letter].width = width
        head = ws.cell(row=1, column=i, value=header)
        head.font = Font(name='Arial', bold=True, color=WHITE)
        head.fill = PatternFill('solid', fgColor=NAVY)
        head.alignment = Alignment(horizontal='center', vertical='center', wrap_text=True)
        head.border = Border(bottom=Side(style='thick', color=GOLD))
        cell = ws.cell(row=2, column=i, value=sample)
        cell.font = Font(name='Arial')
        cell.border = Border(bottom=thin)
        if isinstance(sample, dt.date):
            for row in range(2, LAST_ROW + 1):
                ws.cell(row=row, column=i).number_format = 'yyyy-mm-dd'
        if header in ('Zip', 'Phone'):
            for row in range(2, LAST_ROW + 1):
                ws.cell(row=row, column=i).number_format = '@'
    ws.row_dimensions[1].height = 30
    ws.freeze_panes = 'A2'

    lists = wb.create_sheet('Lists')
    lists['A1'] = 'Role'
    for r, role in enumerate(roles, start=2):
        lists.cell(row=r, column=1, value=role)
    lists['B1'] = 'Charter Member'
    lists['B2'], lists['B3'] = 'Yes', 'No'
    lists.sheet_state = 'hidden'

    col = {header: get_column_letter(i) for i, (header, *_rest) in enumerate(COLUMNS, start=1)}
    span = lambda header: f'{col[header]}2:{col[header]}{LAST_ROW}'  # noqa: E731

    role_dv = DataValidation(type='list', formula1=f"=Lists!$A$2:$A${len(roles) + 1}", allow_blank=True)
    role_dv.error, role_dv.errorTitle = 'Choose a role from the list (election lookup definitions).', 'Unknown role'
    role_dv.prompt, role_dv.promptTitle = 'Office from the election lookup definitions, or Member.', 'Role'
    charter_dv = DataValidation(type='list', formula1='=Lists!$B$2:$B$3', allow_blank=True)
    charter_dv.error, charter_dv.errorTitle = 'Choose Yes or No.', 'Charter Member'
    degree_dv = DataValidation(type='whole', operator='between', formula1='1', formula2='4', allow_blank=True)
    degree_dv.error, degree_dv.errorTitle = 'Degree is a whole number from 1 to 4.', 'Degree'
    member_dv = DataValidation(type='whole', operator='greaterThan', formula1='0', allow_blank=False)
    member_dv.error, member_dv.errorTitle = 'Member Number is a whole number above 0.', 'Member Number'
    date_dv = DataValidation(type='date', operator='greaterThan', formula1='DATE(1882,3,29)', allow_blank=True)
    date_dv.error, date_dv.errorTitle = 'Enter a date (YYYY-MM-DD).', 'Date'
    for dv, headers in (
        (role_dv, ['Role']),
        (charter_dv, ['Charter Member']),
        (degree_dv, ['Degree']),
        (member_dv, ['Member Number']),
        (date_dv, ['Birth Date', 'Date Joined']),
    ):
        dv.showErrorMessage = True
        dv.showInputMessage = bool(dv.prompt)
        for header in headers:
            dv.add(span(header))
        ws.add_data_validation(dv)

    guide = wb.create_sheet('Instructions')
    guide['A1'] = 'Roster import template'
    guide['A1'].font = Font(name='Arial', bold=True, size=14, color=NAVY)
    guide['A2'] = (
        'Fill one row per member on the Roster sheet; row 2 is a sample to replace. Save the Roster sheet as CSV '
        '(File > Save As > CSV UTF-8) and load it on Supreme Sync > Supreme roster sync. New members get the welcome email '
        'with a one-time setup code and join the council-wide distribution lists.'
    )
    guide['A2'].alignment = Alignment(wrap_text=True, vertical='top')
    guide.merge_cells('A2:B2')
    guide.row_dimensions[2].height = 60
    guide['A4'], guide['B4'] = 'Column', 'What to enter'
    for c in ('A4', 'B4'):
        guide[c].font = Font(name='Arial', bold=True, color=WHITE)
        guide[c].fill = PatternFill('solid', fgColor=NAVY)
    for r, (header, _w, _s, note) in enumerate(COLUMNS, start=5):
        guide.cell(row=r, column=1, value=header).font = Font(name='Arial', bold=True)
        guide.cell(row=r, column=2, value=note).alignment = Alignment(wrap_text=True, vertical='top')
    guide.column_dimensions['A'].width = 18
    guide.column_dimensions['B'].width = 100

    buffer = io.BytesIO()
    wb.save(buffer)
    return _normalized(buffer.getvalue())


def _normalized(data: bytes) -> bytes:
    """Rewrites the zip with fixed entry dates so two builds of the same workbook are identical.

    openpyxl stamps docProps/core.xml's modified time with the clock on every save, so it is pinned to BUILT_AT too.
    """
    src = zipfile.ZipFile(io.BytesIO(data))
    out = io.BytesIO()
    stamp = BUILT_AT.strftime('%Y-%m-%dT%H:%M:%SZ').encode()
    with zipfile.ZipFile(out, 'w', zipfile.ZIP_DEFLATED) as dst:
        for info in src.infolist():
            fixed = zipfile.ZipInfo(info.filename, date_time=BUILT_AT.timetuple()[:6])
            fixed.compress_type = zipfile.ZIP_DEFLATED
            fixed.external_attr = info.external_attr
            body = src.read(info.filename)
            if info.filename == 'docProps/core.xml':
                body = re.sub(rb'(<dcterms:modified[^>]*>)[^<]*(<)', rb'\g<1>' + stamp + rb'\g<2>', body)
            dst.writestr(fixed, body)
    return out.getvalue()


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--check', action='store_true', help='exit 1 if the committed workbook is stale')
    args = parser.parse_args()
    data = build()
    if args.check:
        current = OUTPUT.read_bytes() if OUTPUT.exists() else b''
        if current != data:
            print(f'{OUTPUT.relative_to(ROOT)} is stale; run py scripts/roster_import_template.py', file=sys.stderr)
            return 1
        print(f'{OUTPUT.relative_to(ROOT)} is up to date')
        return 0
    OUTPUT.parent.mkdir(parents=True, exist_ok=True)
    OUTPUT.write_bytes(data)
    # Read it back so a broken workbook fails here, not in an Admin's Excel.
    sheet = load_workbook(OUTPUT)['Roster']
    headers = [c.value for c in sheet[1]]
    print(f'wrote {OUTPUT.relative_to(ROOT)}: {len(headers)} columns, sample row 2, {len(role_choices())} role choices')
    return 0


if __name__ == '__main__':
    sys.exit(main())
