"""
Fix attack frames (20-22, 24) that had their heads cut off.
Strategy: Copy the head (hat + face) from the walk_down frames (Row 0)
and paste it onto the attack frames at the appropriate position.

Actually, a better approach: since the attack animation is very short (560ms windup)
and the game renders at 0.21x scale, we'll just use frame 23 (which is complete)
as the primary attack frame, and duplicate it for the other frames.
"""
from PIL import Image
import numpy as np

img = Image.open(r'd:\NightKeeper\public\assets\characters\enemies\gaurds.png').convert('RGBA')
arr = np.array(img)

FRAME_W = 229
FRAME_H = 229

# Frame 23 (R4C3) is the complete attack frame (guard bending down to strike)
# Let's use it as a reference and also check frame 22
# Actually, let's look at what we have:
# Frame 20 (R4C0): headless standing guard with baton
# Frame 21 (R4C1): headless standing guard with baton  
# Frame 22 (R4C2): headless guard
# Frame 23 (R4C3): COMPLETE - guard bending to strike (has head)
# Frame 24 (R4C4): headless standing guard

# Best approach: duplicate frame 23 content into frames 20-22 and 24
# This gives a simpler but complete attack animation

# Actually, let's be smarter - use frame 0 (standing front) head and paste onto attack frames
# Extract head region from frame 0
frame0 = arr[0:FRAME_H, 0:FRAME_W, :].copy()
alpha0 = frame0[:, :, 3]
# Head is roughly the top 60px of content in frame 0
# Frame 0 content starts at y=14, head is approximately y=14 to y=70
head_region = frame0[10:75, :, :].copy()

# For attack frames 20, 21, 22, 24 - paste head at top
# But this won't look right because the body pose is different...

# Better approach: just use frame 23 for all attack frames
# Frame 23 is the "strike" pose which looks good as a single attack frame
frame23 = arr[916:916+FRAME_H, 3*FRAME_W:4*FRAME_W, :].copy()

# Replace frames 20, 21, 22 with frame 23 (the complete strike frame)
# Keep frame 24 as-is (it's the "recovery" frame, headless is less noticeable)
for col in [0, 1, 2]:
    x_start = col * FRAME_W
    arr[916:916+FRAME_H, x_start:x_start+FRAME_W, :] = frame23

# For frame 24, also use frame 23
arr[916:916+FRAME_H, 4*FRAME_W:5*FRAME_W, :] = frame23

# Save
out = Image.fromarray(arr)
out.save(r'd:\NightKeeper\public\assets\characters\enemies\gaurds.png')
print('Fixed attack frames - all now use the complete strike pose (frame 23)')
print('Attack animation will show the guard in striking pose throughout')
