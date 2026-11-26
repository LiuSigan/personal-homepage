# Removes the uneven veil of light (glare on the print when it was copied) from a scan.
# In every small region that is mostly dark, the darkest tone ought to be black; whatever it
# measures above black there is veil. Bright regions (sky, track) say nothing about the veil,
# so they are skipped and filled in from their neighbours. The veil map is smoothed, enlarged
# to the picture and subtracted, so black is the same black everywhere.
import sys, numpy as np
from PIL import Image, ImageFilter
def blur(m, s):
    r = int(s * 3) + 1; k = np.exp(-np.arange(-r, r + 1) ** 2 / (2 * s * s))
    f = lambda v: np.convolve(v, k, 'same')
    return np.apply_along_axis(f, 1, np.apply_along_axis(f, 0, m))
def veil(a, R=18, C=27):
    h, w = a.shape; D = np.zeros((R, C), np.float32); M = np.zeros((R, C), np.float32)
    for r in range(R):
        for c in range(C):
            t = a[r*h//R:(r+1)*h//R, c*w//C:(c+1)*w//C]
            if np.median(t) < 80: D[r, c] = np.percentile(t, 2.5); M[r, c] = 1
    V = blur(D * M, 1.3) / np.maximum(blur(M, 1.3), 1e-3)
    V = np.asarray(Image.fromarray(V.astype(np.float32), 'F').resize((w, h), Image.BICUBIC))
    return np.clip(V, 0, None), M.mean()
# Second pass for glare with a hard edge, which the smooth estimate cannot follow. Only inside the zones the
# first pass found veiled, and only where the picture is flat and dark (night sky), the local tone is brought
# down to the level of the same kind of sky outside those zones, so the outline of the glare patch disappears.
# Detail, lit areas and grey surfaces are untouched. Meant for night skies; pass "fine" to use it.
def residue(b, V, gate=8, dark=45, flat=45):
    u = Image.fromarray(np.clip(b, 0, 255).astype(np.uint8)); med = u.filter(ImageFilter.MedianFilter(21))
    lo = np.asarray(med.filter(ImageFilter.MinFilter(41))).astype(np.float32); hi = np.asarray(med.filter(ImageFilter.MaxFilter(41))).astype(np.float32)
    m = np.asarray(med).astype(np.float32); zone = np.asarray(Image.fromarray(((V > gate) * 255).astype(np.uint8)).filter(ImageFilter.MaxFilter(61))) > 0
    soft = np.asarray(med.filter(ImageFilter.GaussianBlur(4))).astype(np.float32); sky = (hi - lo < flat) & (m < dark); out = sky & ~zone
    base = float(np.median(soft[out])) if out.sum() > 2000 else 0.0
    feather = np.asarray(Image.fromarray(((sky & zone) * 255).astype(np.uint8)).filter(ImageFilter.GaussianBlur(9))).astype(np.float32) / 255
    return np.clip(soft - base, 0, None) * feather, feather.mean(), base
def tiles(a, R=6, C=10):
    h, w = a.shape
    return '\n'.join('  ' + ' '.join('%3d' % np.percentile(a[r*h//R:(r+1)*h//R, c*w//C:(c+1)*w//C], 2) for c in range(C)) for r in range(R))
if __name__ == '__main__':
    src, dst, gamma = sys.argv[1], sys.argv[2], float(sys.argv[3])
    a = np.asarray(Image.open(src).convert('L')).astype(np.float32)
    V, used = veil(a); print(src, 'veil max %.0f, mean %.1f, dark regions used %.0f%%' % (V.max(), V.mean(), used * 100))
    b = np.clip((a - V) * 255.0 / np.maximum(255.0 - V, 1), 0, 255)     # glare also compresses the range; restore it
    if len(sys.argv) > 4 and sys.argv[4] == 'fine':
        V2, share, base = residue(b, V, dark=float(sys.argv[5]) if len(sys.argv) > 5 else 45); b = np.clip(b - V2, 0, 255); print('second pass: %.1f%% of the picture, up to %.0f removed, sky level kept at %.0f' % (share * 100, V2.max(), base))
    print(tiles(b))
    if gamma != 1: lo, hi = np.percentile(b, .5), np.percentile(b, 99.7); b = np.clip((b - lo) / (hi - lo), 0, 1) ** gamma * 255
    Image.fromarray(b.astype(np.uint8)).save(dst, quality=88)
    Image.fromarray(np.clip(V * 4, 0, 255).astype(np.uint8)).resize((400, int(400 * a.shape[0] / a.shape[1]))).save(dst.replace('.jpg', '_veil.png'))
