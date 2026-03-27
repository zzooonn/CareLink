#!/usr/bin/env python3
"""
draw.io (mxGraph XML) → PNG 변환 스크립트
thesis/diagrams/*.drawio 파일을 파싱하여 thesis/figures/*.png 로 내보냄
"""

import os
import re
import xml.etree.ElementTree as ET
import matplotlib
matplotlib.use('Agg')
import matplotlib.pyplot as plt
import matplotlib.patches as mpatches
from matplotlib.patches import FancyBboxPatch, FancyArrowPatch
import matplotlib.patheffects as pe
from matplotlib.lines import Line2D
from matplotlib import font_manager
import numpy as np
import html

# CJK 폰트 설정
_CJK_FONT_PATH = '/usr/share/fonts/truetype/wqy/wqy-zenhei.ttc'
if os.path.exists(_CJK_FONT_PATH):
    font_manager.fontManager.addfont(_CJK_FONT_PATH)
    plt.rcParams['font.family'] = ['WenQuanYi Zen Hei', 'DejaVu Sans']

# ─── 경로 설정 ────────────────────────────────────────────────────────────────
DIAGRAMS_DIR = os.path.join(os.path.dirname(__file__), '..', 'thesis', 'diagrams')
FIGURES_DIR  = os.path.join(os.path.dirname(__file__), '..', 'thesis', 'figures')
os.makedirs(FIGURES_DIR, exist_ok=True)

# ─── 색상 팔레트 ───────────────────────────────────────────────────────────────
C_BLUE   = '#dae8fc'
C_BLUE_S = '#6c8ebf'
C_PURPLE = '#e1d5e7'
C_PURPLE_S = '#9673a6'
C_GREEN  = '#d5e8d4'
C_GREEN_S = '#82b366'
C_YELLOW = '#fff2cc'
C_YELLOW_S = '#d6b656'
C_RED    = '#f8cecc'
C_RED_S  = '#b85450'
C_GRAY   = '#f5f5f5'
C_GRAY_S = '#666666'
C_ORANGE = '#ffe6cc'
C_ORANGE_S = '#d79b00'
C_WHITE  = '#ffffff'

def clean_html(text):
    """HTML 태그 및 엔티티 제거"""
    if not text:
        return ''
    text = html.unescape(text)
    text = re.sub(r'<br\s*/?>', '\n', text, flags=re.IGNORECASE)
    text = re.sub(r'<[^>]+>', '', text)
    return text.strip()


def parse_mxgraph_cells(drawio_path):
    """drawio XML 파싱 → cells dict 반환"""
    tree = ET.parse(drawio_path)
    root = tree.getroot()
    cells = {}
    for cell in root.iter('mxCell'):
        cid   = cell.get('id', '')
        value = clean_html(cell.get('value', ''))
        style = cell.get('style', '')
        geo   = cell.find('mxGeometry')
        vertex = cell.get('vertex') == '1'
        edge   = cell.get('edge') == '1'
        source = cell.get('source', '')
        target = cell.get('target', '')
        x, y, w, h = 0, 0, 0, 0
        if geo is not None:
            x = float(geo.get('x', 0))
            y = float(geo.get('y', 0))
            w = float(geo.get('width', 0))
            h = float(geo.get('height', 0))
        cells[cid] = dict(id=cid, value=value, style=style,
                          x=x, y=y, w=w, h=h,
                          vertex=vertex, edge=edge,
                          source=source, target=target)
    return cells


def style_to_colors(style):
    """style 문자열에서 fillColor / strokeColor 추출"""
    fill   = C_WHITE
    stroke = '#000000'
    font_color = '#000000'
    m = re.search(r'fillColor=([^;]+)', style)
    if m:
        fill = m.group(1).strip()
    m = re.search(r'strokeColor=([^;]+)', style)
    if m:
        stroke = m.group(1).strip()
    m = re.search(r'fontColor=([^;]+)', style)
    if m:
        font_color = m.group(1).strip()
    return fill, stroke, font_color


def is_rhombus(style):
    return 'rhombus' in style


def is_text_only(style):
    return 'text;' in style or style.startswith('text;')


def render_diagram(cells, title, figw=14, figh=10, dpi=150):
    """cells dict를 matplotlib figure 로 렌더링"""
    # 좌표 범위 계산
    verts = [c for c in cells.values() if c['vertex'] and c['w'] > 0 and c['h'] > 0 and c['id'] not in ('0','1')]
    if not verts:
        fig, ax = plt.subplots(figsize=(figw, figh))
        ax.text(0.5, 0.5, 'No vertices', ha='center', va='center', fontsize=14)
        return fig

    xs = [c['x'] for c in verts]
    ys = [c['y'] for c in verts]
    ws = [c['w'] for c in verts]
    hs = [c['h'] for c in verts]
    min_x = min(xs) - 20
    max_x = max(x+w for x,w in zip(xs,ws)) + 20
    min_y = min(ys) - 20
    max_y = max(y+h for y,h in zip(ys,hs)) + 20

    total_w = max_x - min_x
    total_h = max_y - min_y

    fig, ax = plt.subplots(figsize=(figw, figh), dpi=dpi)
    ax.set_xlim(min_x, max_x)
    ax.set_ylim(max_y, min_y)   # y축 뒤집기 (drawio는 위→아래)
    ax.set_aspect('equal')
    ax.axis('off')
    ax.set_facecolor(C_WHITE)
    fig.patch.set_facecolor(C_WHITE)

    # --- draw vertices ---
    id_to_center = {}   # edge 연결용
    for c in sorted(verts, key=lambda c: c['y']):
        x, y, w, h = c['x'], c['y'], c['w'], c['h']
        cx, cy = x + w/2, y + h/2
        id_to_center[c['id']] = (cx, cy)
        style = c['style']
        value = c['value']
        fill, stroke, fc = style_to_colors(style)

        # skip 완전 투명
        if fill in ('none', '') and stroke in ('none', ''):
            if value:
                fs = 10 if total_w > 800 else 11
                ax.text(cx, cy, value, ha='center', va='center',
                        fontsize=fs, fontweight='bold' if 'fontStyle=1' in style else 'normal',
                        color=fc, wrap=True, multialignment='center')
            continue

        if is_rhombus(style):
            diamond_x = [cx, x+w, cx, x, cx]
            diamond_y = [y, cy, y+h, cy, y]
            ax.fill(diamond_x, diamond_y, color=fill, zorder=2)
            ax.plot(diamond_x, diamond_y, color=stroke, linewidth=1.2, zorder=3)
        else:
            # 모서리 둥글기
            radius = 5 if 'rounded=1' in style or 'rounded=2' in style else 2
            fancy = FancyBboxPatch(
                (x, y), w, h,
                boxstyle=f"round,pad=0,rounding_size={radius}",
                facecolor=fill, edgecolor=stroke, linewidth=1.2, zorder=2
            )
            ax.add_patch(fancy)

        # 텍스트
        if value:
            lines = value.split('\n')
            fs = max(7, min(11, int(140 / max(len(l) for l in lines if l) + 1)))
            ax.text(cx, cy, value, ha='center', va='center',
                    fontsize=fs,
                    fontweight='bold' if 'fontStyle=1' in style else 'normal',
                    color=fc, wrap=True, multialignment='center',
                    zorder=4, clip_on=True,
                    bbox=dict(boxstyle='round,pad=0.1', facecolor='none', edgecolor='none'))

    # --- draw edges ---
    for c in cells.values():
        if not c['edge']:
            continue
        src = id_to_center.get(c['source'])
        tgt = id_to_center.get(c['target'])
        if src and tgt:
            ax.annotate('', xy=tgt, xytext=src,
                        arrowprops=dict(arrowstyle='->', color='#555555',
                                        lw=1.5, connectionstyle='arc3,rad=0.05'),
                        zorder=5)
            # edge label
            if c['value']:
                mx, my = (src[0]+tgt[0])/2, (src[1]+tgt[1])/2
                ax.text(mx, my, c['value'], ha='center', va='center',
                        fontsize=8, color='#333333',
                        bbox=dict(boxstyle='round,pad=0.2', facecolor='white',
                                  edgecolor='lightgray', alpha=0.85), zorder=6)

    fig.suptitle(title, fontsize=13, fontweight='bold', y=0.98)
    plt.tight_layout(rect=[0, 0, 1, 0.96])
    return fig


# ──────────────────────────────────────────────────────────────────────────────
# 각 다이어그램 파일 처리
# ──────────────────────────────────────────────────────────────────────────────
DIAGRAM_CONFIGS = {
    'fig3_1_system_architecture.drawio': {
        'title': 'Fig 3.1  CareLink 시스템 총체 아키텍처',
        'w': 16, 'h': 10
    },
    'fig3_4_er_diagram.drawio': {
        'title': 'Fig 3.4  Entity-Relationship Diagram',
        'w': 18, 'h': 13
    },
    'fig4_2_jwt_auth_flow.drawio': {
        'title': 'Fig 4.2  JWT 이중 토큰 인증 흐름',
        'w': 16, 'h': 11
    },
    'fig4_3_cnn_cbam_gru_model.drawio': {
        'title': 'Fig 4.3  CNN-CBAM-GRU 모델 아키텍처',
        'w': 16, 'h': 10
    },
    'fig4_4_ecg_sequence.drawio': {
        'title': 'Fig 4.4  ECG 분석 시퀀스 다이어그램',
        'w': 16, 'h': 12
    },
    'fig4_5_cbam_detail.drawio': {
        'title': 'Fig 4.5  CBAM 어텐션 모듈 세부 구조',
        'w': 14, 'h': 9
    },
    'fig4_6_anomaly_alert_flow.drawio': {
        'title': 'Fig 4.6  이상 감지 및 보호자 알림 흐름',
        'w': 16, 'h': 11
    },
}


def main():
    success = []
    failed  = []

    for fname, cfg in DIAGRAM_CONFIGS.items():
        src_path = os.path.join(DIAGRAMS_DIR, fname)
        out_name = fname.replace('.drawio', '.png')
        out_path = os.path.join(FIGURES_DIR, out_name)

        if not os.path.exists(src_path):
            print(f'  ⚠ 파일 없음: {fname}')
            failed.append(fname)
            continue

        try:
            cells = parse_mxgraph_cells(src_path)
            fig   = render_diagram(cells, cfg['title'], figw=cfg['w'], figh=cfg['h'])
            fig.savefig(out_path, dpi=150, bbox_inches='tight',
                        facecolor='white', edgecolor='none')
            plt.close(fig)
            print(f'  ✅ {out_name}')
            success.append(out_name)
        except Exception as e:
            print(f'  ❌ {fname}: {e}')
            import traceback; traceback.print_exc()
            failed.append(fname)

    print(f'\n완료: {len(success)}개 성공, {len(failed)}개 실패')
    if success:
        print('생성된 파일:', ', '.join(success))


if __name__ == '__main__':
    main()
