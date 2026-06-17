from PIL import Image

img = Image.open(r'd:\NightKeeper\public\assets\characters\enemies\gaurds.png').convert('RGBA')
for i in range(5):
    frame = img.crop((i*229, 916, (i+1)*229, 1145))
    frame.save(f'd:\\NightKeeper\\scripts\\atk_frame{i}.png')
    print(f'Saved atk_frame{i}.png')
