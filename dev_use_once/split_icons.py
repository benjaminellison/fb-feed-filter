"""One-shot helper: split icon_sheet.png into icons/icon{16,32,48,128}.png."""
import os
import numpy as np
from PIL import Image

src = Image.open("icon_sheet.png").convert("RGB")
arr = np.array(src)
h, w = arr.shape[:2]

# Mask of red pixels (the icon backgrounds)
red = (arr[:, :, 0] > 180) & (arr[:, :, 1] < 80) & (arr[:, :, 2] < 80)

# Find horizontal runs of columns that contain red
col_has_red = red.any(axis=0)
runs = []
in_run = False
start = 0
for x in range(w):
    if col_has_red[x] and not in_run:
        start = x
        in_run = True
    elif not col_has_red[x] and in_run:
        runs.append((start, x - 1))
        in_run = False
if in_run:
    runs.append((start, w - 1))

# For each horizontal run, get vertical extent
boxes = []
for x0, x1 in runs:
    sub = red[:, x0 : x1 + 1]
    if not sub.any():
        continue
    ys = np.where(sub.any(axis=1))[0]
    y0, y1 = int(ys.min()), int(ys.max())
    boxes.append((x0, y0, x1, y1))

# Sort smallest -> largest by width
boxes.sort(key=lambda b: b[2] - b[0])
print(f"Found {len(boxes)} icon regions:")
for b in boxes:
    print(f"  ({b[0]},{b[1]}) -> ({b[2]},{b[3]})  {b[2]-b[0]+1}x{b[3]-b[1]+1}")

assert len(boxes) >= 4, "Expected at least 4 icon regions in the sheet"

target_sizes = [16, 32, 48, 128]
os.makedirs("icons", exist_ok=True)
for size, (x0, y0, x1, y1) in zip(target_sizes, boxes[:4]):
    bw, bh = x1 - x0 + 1, y1 - y0 + 1
    side = max(bw, bh)
    cx, cy = (x0 + x1) / 2, (y0 + y1) / 2
    sx0 = max(0, int(round(cx - side / 2)))
    sy0 = max(0, int(round(cy - side / 2)))
    sx1 = min(w, sx0 + side)
    sy1 = min(h, sy0 + side)
    cropped = src.crop((sx0, sy0, sx1, sy1))
    resized = cropped.resize((size, size), Image.LANCZOS)
    out = f"icons/icon{size}.png"
    resized.save(out, "PNG")
    print(f"  wrote {out}  (square crop {sx1-sx0}x{sy1-sy0} -> {size}x{size})")
