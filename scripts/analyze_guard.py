"""
Analyze each individual frame of the guard spritesheet to check for overlap issues.
"""
from PIL import Image
import numpy as np

img = Image.open(r'd:\NightKeeper\public\assets\characters\enemies\gaurds.png').convert('RGBA')
arr = np.array(img)

FRAME_W = 229
FRAME_H = 229
COLS = 5
ROWS = 6

print("Frame-by-frame analysis:")
print("=" * 60)

for row in range(ROWS):
    for col in range(COLS):
        frame_idx = row * COLS + col
        y_start = row * FRAME_H
        x_start = col * FRAME_W
        frame = arr[y_start:y_start+FRAME_H, x_start:x_start+FRAME_W, :]
        alpha = frame[:, :, 3]
        
        row_has = np.any(alpha > 0, axis=1)
        if np.any(row_has):
            fy = np.argmax(row_has)
            ly = FRAME_H - 1 - np.argmax(row_has[::-1])
            # Check if there's content in the bottom 30px (potential overlap from next row)
            bottom_content = np.any(alpha[200:, :] > 0)
            # Check if there's content in the top 30px (potential overlap from prev row)
            top_content = np.any(alpha[:30, :] > 0)
            print(f"  Frame {frame_idx:2d} (R{row}C{col}): y={fy:3d}~{ly:3d} (h={ly-fy+1:3d}) top30={'Y' if top_content else 'N'} bot200+={'Y' if bottom_content else 'N'}")
        else:
            print(f"  Frame {frame_idx:2d} (R{row}C{col}): EMPTY")