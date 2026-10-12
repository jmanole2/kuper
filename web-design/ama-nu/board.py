# Builds the presentation board PNG and the PDF from out/desktop.png and out/mobile.png.
from PIL import Image, ImageDraw
d = Image.open('out/desktop.png').convert('RGB'); m = Image.open('out/mobile.png').convert('RGB')
BG = (43, 38, 32)
def rounded(im, r):
    mask = Image.new('L', im.size, 0); ImageDraw.Draw(mask).rounded_rectangle((0, 0, im.width - 1, im.height - 1), r, fill=255); return mask
DW, MW, P = 1400, 340, 80
dd = d.resize((DW, int(d.height * DW / d.width)), Image.LANCZOS)
mm = m.resize((MW, int(m.height * MW / m.width)), Image.LANCZOS)
board = Image.new('RGB', (P + DW + 60 + MW + P, max(dd.height, mm.height) + 2 * P), BG)
board.paste(dd, (P, P), rounded(dd, 24)); board.paste(mm, (P + DW + 60, P), rounded(mm, 28))
board.save('out/ama-nu-board.png', optimize=True)
pages, SL = [], 1800
for y in range(0, d.height, SL):
    pg = Image.new('RGB', (d.width, SL), (244, 239, 231)); pg.paste(d.crop((0, y, d.width, min(d.height, y + SL))), (0, 0)); pages.append(pg)
cols = 3; ch = -(-m.height // cols)
mp = Image.new('RGB', (cols * m.width + (cols + 1) * 120, ch + 240), BG)
for i in range(cols):
    c = m.crop((0, i * ch, m.width, min(m.height, (i + 1) * ch))); mp.paste(c, (120 + i * (m.width + 120), 120), rounded(c, 30))
pages.append(mp)
pages[0].save('out/ama-nu-diseno.pdf', save_all=True, append_images=pages[1:], resolution=150)
print(board.size, len(pages))
