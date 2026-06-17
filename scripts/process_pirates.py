"""
Process pirates.png:
1. Remove green background (chroma key)
2. Detect sprite frames
3. Rearrange into 5 cols x 6 rows grid (229x229 per frame)
   - Row 1: Walk down (5 frames)
   - Row 2: Walk right (5 frames)
   - Row 3: Walk up (5 frames)
   - Row 4: Walk left (5 frames)
   - Row 5: Attack (5 frames)
   - Row 6: Hurt/death (5 frames)

Output: pirates_processed.png in the same directory
"""

from PIL import Image
import numpy as np
import os

INPUT = os.path.join(os.path.dirname(__file__), '..', 'public', 'assets', 'characters', 'enemies', 'pirates.png')
OUTPUT = os.path.join(os.path.dirname(__file__), '..', 'public', 'assets', 'characters', 'enemies', 'pirates_processed.png')

FRAME_W = 229
FRAME_H = 229
COLS = 5
ROWS = 6

def remove_green_bg(img):
    """Remove green background using color distance threshold."""
    arr = np.array(img.convert('RGBA'))
    r, g, b, a = arr[:,:,0], arr[:,:,1], arr[:,:,2], arr[:,:,3]
    
    # The background color is approximately (144, 210, 144) / light green
    bg_r, bg_g, bg_b = 144, 210, 144
    
    # Method 1: Color distance from known background color
    # Calculate Euclidean distance from the background color
    dist = np.sqrt(
        (r.astype(float) - bg_r) ** 2 + 
        (g.astype(float) - bg_g) ** 2 + 
        (b.astype(float) - bg_b) ** 2
    )
    color_dist_mask = dist < 80  # generous threshold
    
    # Method 2: General green-dominant detection (catches variations)
    green_mask = (
        (g > 120) & 
        (g > r + 20) & 
        (g > b + 20) &
        (r < 210) &
        (b < 210)
    )
    
    # Method 3: Catch light/pastel green edges (anti-aliasing artifacts)
    light_green_mask = (
        (g > 180) &
        (r > 120) & (r < 230) &
        (b > 120) & (b < 230) &
        (g >= r) &
        (g >= b) &
        ((g.astype(int) - r.astype(int) + g.astype(int) - b.astype(int)) > 20)
    )
    
    # Combine all masks
    combined_mask = color_dist_mask | green_mask | light_green_mask
    
    # Apply: make matched pixels fully transparent
    arr[combined_mask] = [0, 0, 0, 0]
    
    # Additional pass: remove semi-transparent greenish edge pixels
    # These are anti-aliased pixels that blend green bg with sprite
    remaining_alpha = arr[:,:,3] > 0
    remaining_r = arr[:,:,0].astype(float)
    remaining_g = arr[:,:,1].astype(float)
    remaining_b = arr[:,:,2].astype(float)
    
    # Detect pixels with noticeable green tint that are likely edge artifacts
    edge_green = (
        remaining_alpha &
        (remaining_g > remaining_r + 10) &
        (remaining_g > remaining_b + 10) &
        (remaining_g > 100)
    )
    
    # For edge pixels, reduce alpha based on how "green" they are
    green_ratio = np.where(
        edge_green,
        np.clip((remaining_g - np.maximum(remaining_r, remaining_b)) / 80.0, 0, 1),
        0
    )
    arr[:,:,3] = np.where(
        edge_green,
        (arr[:,:,3].astype(float) * (1 - green_ratio * 0.8)).astype(np.uint8),
        arr[:,:,3]
    )
    
    # Final cleanup: remove very low alpha pixels (nearly invisible)
    low_alpha = arr[:,:,3] < 15
    arr[low_alpha] = [0, 0, 0, 0]
    
    return Image.fromarray(arr)


def find_sprite_rows(img):
    """
    Analyze the image to find rows of sprites.
    Returns list of (y_start, y_end) for each detected row.
    """
    arr = np.array(img)
    # A row has content if it has non-transparent pixels
    alpha = arr[:, :, 3]
    row_has_content = np.any(alpha > 10, axis=1)
    
    rows = []
    in_row = False
    start = 0
    for y in range(len(row_has_content)):
        if row_has_content[y] and not in_row:
            start = y
            in_row = True
        elif not row_has_content[y] and in_row:
            if y - start > 20:  # minimum row height
                rows.append((start, y))
            in_row = False
    if in_row:
        rows.append((start, len(row_has_content)))
    
    return rows


def find_frames_in_row(img, y_start, y_end):
    """
    Find individual frames within a row by detecting vertical gaps.
    Returns list of (x_start, x_end) for each frame.
    """
    arr = np.array(img)
    alpha = arr[y_start:y_end, :, 3]
    col_has_content = np.any(alpha > 10, axis=0)
    
    frames = []
    in_frame = False
    start = 0
    for x in range(len(col_has_content)):
        if col_has_content[x] and not in_frame:
            start = x
            in_frame = True
        elif not col_has_content[x] and in_frame:
            if x - start > 15:  # minimum frame width
                frames.append((start, x))
            in_frame = False
    if in_frame:
        frames.append((start, len(col_has_content)))
    
    return frames


def extract_frame(img, x1, y1, x2, y2, target_w, target_h):
    """
    Extract a frame from the image and center it in a target_w x target_h canvas.
    """
    frame = img.crop((x1, y1, x2, y2))
    fw, fh = frame.size
    
    # Scale if too large
    scale = min(target_w / fw, target_h / fh, 1.0)
    if scale < 1.0:
        new_w = int(fw * scale)
        new_h = int(fh * scale)
        frame = frame.resize((new_w, new_h), Image.LANCZOS)
        fw, fh = new_w, new_h
    
    # Center on canvas
    canvas = Image.new('RGBA', (target_w, target_h), (0, 0, 0, 0))
    ox = (target_w - fw) // 2
    oy = (target_h - fh) // 2
    # Align to bottom (feet on ground)
    oy = target_h - fh - 5
    canvas.paste(frame, (ox, oy), frame)
    return canvas


def main():
    print(f"Loading: {INPUT}")
    img = Image.open(INPUT).convert('RGBA')
    print(f"Original size: {img.size}")
    
    # Step 1: Remove green background
    print("Removing green background...")
    img = remove_green_bg(img)
    
    # Step 2: Detect sprite rows
    print("Detecting sprite rows...")
    sprite_rows = find_sprite_rows(img)
    print(f"Found {len(sprite_rows)} rows:")
    
    all_row_frames = []
    for i, (y1, y2) in enumerate(sprite_rows):
        frames = find_frames_in_row(img, y1, y2)
        print(f"  Row {i+1}: y=[{y1},{y2}], height={y2-y1}, frames={len(frames)}")
        all_row_frames.append((y1, y2, frames))
    
    # Step 3: Map rows to our target layout
    # Based on visual analysis of the pirates.png:
    # Original rows (7 detected):
    #   Row 0: Walk down (small, ~10 frames) 
    #   Row 1: Walk up/back (small, ~10 frames)
    #   Row 2: Walk right (medium, ~10 frames)
    #   Row 3: Walk left (medium, ~10 frames)  
    #   Row 4: Attack right with sword (large, ~8 frames)
    #   Row 5: Attack left / mixed (large, ~8 frames)
    #   Row 6: Hurt/death (large, ~5 frames)
    #
    # Target layout (5 cols x 6 rows):
    #   Row 0: Walk down (pick 5 evenly spaced frames)
    #   Row 1: Walk right (pick 5)
    #   Row 2: Walk up (pick 5)
    #   Row 3: Walk left (pick 5)
    #   Row 4: Attack (pick 5)
    #   Row 5: Hurt/death (pick 5)
    
    # We need at least 6 source rows; if fewer, we'll adapt
    print(f"\nMapping to {COLS}x{ROWS} grid ({FRAME_W}x{FRAME_H} per frame)...")
    
    # Define mapping: (source_row_index, description)
    # Adjust based on actual detected rows
    num_src_rows = len(all_row_frames)
    
    if num_src_rows >= 7:
        # Ideal case: 7 rows detected
        row_mapping = [
            (0, "walk_down"),
            (2, "walk_right"),
            (1, "walk_up"),
            (3, "walk_left"),
            (4, "attack"),
            (6, "hurt"),
        ]
    elif num_src_rows >= 6:
        row_mapping = [
            (0, "walk_down"),
            (2, "walk_right"),
            (1, "walk_up"),
            (3, "walk_left"),
            (4, "attack"),
            (5, "hurt"),
        ]
    else:
        # Fallback: use what we have
        row_mapping = []
        for i in range(min(ROWS, num_src_rows)):
            row_mapping.append((i, f"row_{i}"))
        # Pad with duplicates if needed
        while len(row_mapping) < ROWS:
            row_mapping.append((0, "duplicate"))
    
    # Step 4: Build output spritesheet
    output = Image.new('RGBA', (COLS * FRAME_W, ROWS * FRAME_H), (0, 0, 0, 0))
    
    for target_row, (src_row_idx, desc) in enumerate(row_mapping):
        if src_row_idx >= len(all_row_frames):
            print(f"  Target row {target_row} ({desc}): source row {src_row_idx} not available, skipping")
            continue
            
        y1, y2, frames = all_row_frames[src_row_idx]
        num_frames = len(frames)
        
        if num_frames == 0:
            print(f"  Target row {target_row} ({desc}): no frames found, skipping")
            continue
        
        # Pick 5 evenly spaced frames
        if num_frames >= COLS:
            indices = [int(i * (num_frames - 1) / (COLS - 1)) for i in range(COLS)]
        else:
            # Fewer frames than needed: use all and pad with last
            indices = list(range(num_frames))
            while len(indices) < COLS:
                indices.append(num_frames - 1)
        
        print(f"  Target row {target_row} ({desc}): using source row {src_row_idx}, "
              f"{num_frames} frames available, picking indices {indices}")
        
        for col, frame_idx in enumerate(indices):
            x1, x2 = frames[frame_idx]
            frame = extract_frame(img, x1, y1, x2, y2, FRAME_W, FRAME_H)
            output.paste(frame, (col * FRAME_W, target_row * FRAME_H))
    
    # Save
    print(f"\nSaving to: {OUTPUT}")
    output.save(OUTPUT)
    print(f"Output size: {output.size} ({COLS}x{ROWS} grid, {FRAME_W}x{FRAME_H} per frame)")
    print("Done!")


if __name__ == '__main__':
    main()
