"""
Fix guard spritesheet: Remove orphaned hat/head fragments at the bottom of each frame.
These fragments are from adjacent rows that leaked into the current frame.

Strategy: For each frame, scan from top to bottom. If we find a horizontal gap
(empty rows) within the frame, remove everything below that gap.
This works because the guard body is always one continuous region from top,
and the leaked content is always at the bottom separated by a gap.
"""
from PIL import Image
import numpy as np

img = Image.open(r'd:\NightKeeper\public\assets\characters\enemies\gaurds.png').convert('RGBA')
arr = np.array(img)

FRAME_W = 229
FRAME_H = 229
COLS = 5
ROWS = 6

print("Fixing guard spritesheet - removing leaked content below gaps")
print("=" * 60)

fixed_count = 0

for row in range(ROWS):
    for col in range(COLS):
        frame_idx = row * COLS + col
        y_start = row * FRAME_H
        x_start = col * FRAME_W
        
        frame = arr[y_start:y_start+FRAME_H, x_start:x_start+FRAME_W, :]
        alpha = frame[:, :, 3]
        
        if not np.any(alpha > 0):
            continue
        
        # Find rows with content
        row_has_content = np.any(alpha > 0, axis=1)
        
        # Find the first content row
        first_content = np.argmax(row_has_content)
        
        # Scan from first content row downward, looking for a gap of 3+ empty rows
        # that indicates the boundary between the main body and leaked content
        gap_start = -1
        consecutive_empty = 0
        
        for y in range(first_content, FRAME_H):
            if not row_has_content[y]:
                consecutive_empty += 1
                if consecutive_empty >= 3 and gap_start == -1:
                    gap_start = y - consecutive_empty + 1
            else:
                if gap_start != -1:
                    # We found a gap and now there's content below it - this is leaked content
                    # Remove everything from gap_start onwards
                    frame[gap_start:, :, :] = 0
                    arr[y_start:y_start+FRAME_H, x_start:x_start+FRAME_W, :] = frame
                    fixed_count += 1
                    print(f"  Frame {frame_idx:2d} (R{row}C{col}): Removed content below gap at y={gap_start}")
                    break
                consecutive_empty = 0

print(f"\nFixed {fixed_count} frames")

# Save
out = Image.fromarray(arr)
out.save(r'd:\NightKeeper\public\assets\characters\enemies\gaurds.png')
print('Saved fixed gaurds.png')