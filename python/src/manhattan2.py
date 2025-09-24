
import tkinter as tk
from typing import Optional, Dict, Tuple
import numpy as np
import pandas as pd
from PIL import Image, ImageDraw, ImageFilter
from io import BytesIO

def plot_manhattan(
    grin_results: dict, 
    chrom_size: pd.DataFrame,
    colors: Optional[Dict[str, str]] = None,
    plot_width: int = 1000,
    plot_height: int = 400,
    device_pixel_ratio: float = 2.0,
    png_dot_radius: int = 2,
    preview: bool = False
) -> Tuple[bytes, dict]:
    """
    Draw a Manhattan plot with Tkinter (Canvas) and export a PNG with Pillow.
    Returns (png_bytes, interactive_data). If preview=True, shows a Tk window.
    """
    if colors is None:
        colors = {'gain': '#FF4444', 'loss': '#4444FF', 'mutation': '#44AA44'}

    gene_hits = grin_results['gene.hits']

    # which mutation result columns exist
    mutation_cols = []
    for mut_type in ['gain', 'loss', 'mutation']:
        q_col = f'q.nsubj.{mut_type}'
        if q_col in gene_hits.columns:
            mutation_cols.append((mut_type, q_col))

    # cumulative chromosome offsets
    chrom_data = {}
    cumulative_pos = 0
    for _, row in chrom_size.iterrows():
        chrom = row['chrom']
        size = row['size']
        chrom_data[chrom] = {'start': cumulative_pos, 'size': size, 'center': cumulative_pos + size/2}
        cumulative_pos += size
    total_genome_length = cumulative_pos

    plot_data = {'x': [], 'y': [], 'colors': [], 'types': []}
    point_details = []

    for _, gene_row in gene_hits.iterrows():
        chrom = gene_row['chrom']
        gene_name = gene_row.get('gene', 'Unknown')
        if chrom not in chrom_data:
            continue
        gene_start = gene_row.get('loc.start', 0)
        x_pos = chrom_data[chrom]['start'] + gene_start

        for mut_type, q_col in mutation_cols:
            qv = gene_row.get(q_col, np.nan)
            if pd.isna(qv) or qv <= 0:
                continue
            neg_log10_q = -np.log10(qv)
            color = colors.get(mut_type, '#888888')
            n_subj_count = gene_row.get(f'nsubj.{mut_type}', None)

            plot_data['x'].append(x_pos)
            plot_data['y'].append(neg_log10_q)
            plot_data['colors'].append(color)
            plot_data['types'].append(mut_type)

            if qv <= 0.05:
                point_details.append({
                    'x': x_pos, 'y': neg_log10_q, 'color': color, 'type': mut_type,
                    'gene': gene_name, 'chrom': chrom, 'pos': gene_start,
                    'q_value': qv, 'nsubj': n_subj_count
                })

    # --- original buffer logic ---
    x_buffer = total_genome_length * 0.010
    y_axis_scaled = False
    scale_factor_y = 1.0
    y_min = 0.0
    if plot_data['y']:
        max_y_raw = max(plot_data['y'])
        if max_y_raw > 40:
            scale_factor_y = 40.0 / max_y_raw
            plot_data['y'] = [y * scale_factor_y for y in plot_data['y']]
            for p in point_details:
                p['y'] *= scale_factor_y
            y_max = max(plot_data['y'])
            y_axis_scaled = True
        else:
            y_max = max_y_raw
    else:
        y_max = 1.0

    # Keep same tiny y buffer but apply as pixel padding (not negative domain)
    y_buffer = plot_height * 0.0012

    # ----- Pixel-based padding derived from original domain buffers -----
    den_x = (total_genome_length + 2 * x_buffer)
    left_pad_px = (x_buffer / den_x) * plot_width if den_x > 0 else 0.0
    right_pad_px = left_pad_px

    den_y = (y_max + 2 * y_buffer)
    top_pad_px = (y_buffer / den_y) * plot_height if den_y > 0 else 0.0
    bottom_pad_px = top_pad_px

    # ----- Transforms using non-negative domains and padded ranges -----
    # x-domain: [0, total_genome_length] ; y-domain: [0, y_max]
    def x_to_px(x_raw: float) -> int:
        inner_w = plot_width - left_pad_px - right_pad_px
        if total_genome_length == 0 or inner_w <= 0:
            return int(round(left_pad_px))
        return int(round(left_pad_px + (x_raw / total_genome_length) * inner_w))

    def y_to_px(y_val: float) -> int:
        inner_h = plot_height - top_pad_px - bottom_pad_px
        if y_max == 0 or inner_h <= 0:
            return int(round(plot_height - bottom_pad_px))
        return int(round((plot_height - bottom_pad_px) - (y_val / y_max) * inner_h))

    # --- Tkinter drawing ---
    root = tk.Tk()
    if not preview:
        root.withdraw()
    canvas = tk.Canvas(root, width=plot_width, height=plot_height, bg="white", highlightthickness=0)
    canvas.pack()

    # alternating chromosome bands
    for i, (_, row) in enumerate(chrom_size.iterrows()):
        chrom = row['chrom']
        if chrom not in chrom_data:
            continue
        start = chrom_data[chrom]['start']
        end = start + chrom_data[chrom]['size']
        x0 = x_to_px(start)
        x1 = x_to_px(end)
        fill = "#FFFFFF" if i % 2 == 0 else "#D3D3D3"
        canvas.create_rectangle(x0, 0, x1, plot_height, fill=fill, outline="")

    # draw points
    r = int(png_dot_radius)
    for x_raw, y_val, color in zip(plot_data['x'], plot_data['y'], plot_data['colors']):
        cx = x_to_px(x_raw)
        cy = y_to_px(y_val)
        canvas.create_oval(cx - r, cy - r, cx + r, cy + r, fill=color, outline="")

    # Force rendering
    root.update_idletasks()
    root.update()


    # 1) Adaptive supersampling factor
    base_scale = int(round(device_pixel_ratio)) if device_pixel_ratio else 2
    render_scale = max(4, min(4, base_scale))
    if float(png_dot_radius) <= 2:
        render_scale = max(render_scale, 4)

    # hi-res sizes
    hi_w = int(plot_width * render_scale)
    hi_h = int(plot_height * render_scale)

    # 2) draw bands on an opaque hi-res canvas
    img_bands = Image.new('RGB', (hi_w, hi_h), 'white')
    drw_bands = ImageDraw.Draw(img_bands, 'RGBA')

    def S(v: float) -> int:
        return int(round(v * render_scale))

    # bands
    for i, (_, row) in enumerate(chrom_size.iterrows()):
        chrom = row['chrom']
        if chrom not in chrom_data:
            continue
        start = chrom_data[chrom]['start']
        end = start + chrom_data[chrom]['size']
        x0 = S(x_to_px(start))
        x1 = S(x_to_px(end))
        fill = (255, 255, 255, 255) if i % 2 == 0 else (211, 211, 211, 255)
        drw_bands.rectangle([x0, 0, x1, hi_h], fill=fill)

    # 2) draw points on a *transparent* hi-res layer (to avoid color bleed)
    img_pts = Image.new('RGBA', (hi_w, hi_h), (0, 0, 0, 0))
    drw_pts = ImageDraw.Draw(img_pts, 'RGBA')

    # 3) radius overshoot before downscale so final dots don't look shrunken
    base_r = float(png_dot_radius)
    R = max(1, int(round(base_r * render_scale + 0.10)))  # +0.10 overshoot is subtle and safe

    for x_raw, y_val, color in zip(plot_data['x'], plot_data['y'], plot_data['colors']):
        cx = S(x_to_px(x_raw))
        cy = S(y_to_px(y_val))
        # draw solid disc on transparent layer
        drw_pts.ellipse([cx - R, cy - R, cx + R, cy + R], fill=color, outline=None)

    # composite points over bands at hi-res (premultiplied alpha handled by alpha_composite)
    img = Image.alpha_composite(img_bands.convert('RGBA'), img_pts)

    # 5) downscale to the final size with strong antialias
    if render_scale != 1:
        img = img.resize((plot_width, plot_height), Image.LANCZOS)

    # 4) gentle unsharp mask to restore edge crispness after LANCZOS
    #    (tune 'percent' if you want more/less bite; keep 'radius' small)
    img = img.filter(ImageFilter.UnsharpMask(radius=0.6, percent=120, threshold=0))

    # encode to PNG
    buf = BytesIO()
    img.save(buf, format='PNG', optimize=True)
    buf.seek(0)
    png_bytes = buf.getvalue()

    # exact transform constants the PNG path uses
    x_scale = (plot_width - left_pad_px - right_pad_px) / max(total_genome_length, 1)
    y_scale = (plot_height - top_pad_px - bottom_pad_px) / max(y_max, 1)



    if not preview:
        try:
            root.destroy()
        except Exception:
            pass
    else:
        root.title("Manhattan Plot (Tkinter)")
        root.mainloop()

    interactive_data = {
        'points': point_details,
        'chrom_data': chrom_data,
        'y_axis_scaled': y_axis_scaled,
        'scale_factor': scale_factor_y,
        'total_genome_length': total_genome_length,
        'x_buffer': x_buffer,
        'y_buffer': y_buffer,
        'y_min': y_min,
        'y_max': y_max,
        'plot_width': plot_width,
        'plot_height': plot_height,
        'png_width': plot_width,
        'png_height': plot_height,
        'device_pixel_ratio': device_pixel_ratio,
        'dpi': None,
        'png_dot_radius': png_dot_radius,
        'interactive_padding': {
            'left_px': float(left_pad_px),
            'right_px': float(right_pad_px),
            'top_px': float(top_pad_px),
            'bottom_px': float(bottom_pad_px)
        },
        'x_domain': [0.0, float(total_genome_length)],
        'y_domain': [0.0, float(y_max)],
        # NEW: exact pixel transform for overlays
        'transform': {
            'x_offset': float(left_pad_px),
            'x_scale': float(x_scale),
            'y_offset': float(plot_height - bottom_pad_px),
            'y_scale': float(y_scale),
            'round_to_pixel': True
        }
    }


    return png_bytes, interactive_data
