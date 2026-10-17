#!/usr/bin/env python3
"""Original synthetic QA artwork; no player photos or invented football facts."""
from pathlib import Path
from PIL import Image, ImageDraw, ImageFont

out = Path('/workspace/ff90-tools/fixtures')
out.mkdir(parents=True, exist_ok=True)
font = '/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf'
kinds = 'general breaking transfer preview result standings stats tactics team competition infographic youth feature'.split()
for index, kind in enumerate(kinds):
    image = Image.new('RGB', (1280, 720), (12 + index * 2, 24 + index * 2, 44 + index * 3))
    draw = ImageDraw.Draw(image)
    draw.rectangle((18, 18, 1262, 702), outline='#f5e7b7', width=6)
    draw.line((44, 644, 1236, 644), fill='#576c8a', width=2)
    draw.ellipse((840, -140, 1450, 470), outline='#465b76', width=6)
    draw.ellipse((930, 50, 1370, 490), outline='#465b76', width=2)
    draw.rectangle((60, 68, 150, 76), fill='#ff718a')
    for pos, text, size, color in [
        ((60, 115), 'FF90', 148, 'white'),
        ((66, 300), kind.upper(), 55, '#ff8ba0'),
        ((66, 406), 'THE FOOTBALL EDIT', 25, '#c8d6e6'),
        ((66, 535), 'SYNTHETIC QA ARTWORK / NOT NEWS', 22, '#c8d6e6'),
        ((66, 662), '1280 x 720  |  FULL FRAME / DO NOT CROP', 17, '#f5e7b7')
    ]:
        draw.text(pos, text, font=ImageFont.truetype(font, size), fill=color)
    image.save(out / (kind + '.png'))
print(f'Generated {len(kinds)} original QA banners at {out}')

# Original ad upload fixture for native Customizer media-picker QA.
ad = Image.new('RGB', (970, 120), '#15273e')
draw = ImageDraw.Draw(ad)
draw.rectangle((3, 3, 966, 116), outline='#ff8ba0', width=3)
draw.text((28, 30), 'FF90 / QA ADVERTISEMENT / 970 x 120', font=ImageFont.truetype(font, 28), fill='white')
ad.save(out / 'qa-sale-banner.png')
