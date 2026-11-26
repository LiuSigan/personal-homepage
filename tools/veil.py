# Removes the uneven veil of light (glare on the print when it was copied) from a scan.
# In every small region that is mostly dark, the darkest tone ought to be black; whatever it
# measures above black there is veil. Bright regions (sky, track) say nothing about the veil,
# so they are skipped and filled in from their neighbours. The veil map is smoothed, enlarged
# to the picture and subtracted, so black is the same black everywhere.
import sys, numpy as np
from PIL import Image
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
def tiles(a, R=6, C=10):
    h, w = a.shape
    return '\n'.join('  ' + ' '.join('%3d' % np.percentile(a[r*h//R:(r+1)*h//R, c*w//C:(c+1)*w//C], 2) for c in range(C)) for r in range(R))
if __name__ == '__main__':
    src, dst, gamma = sys.argv[1], sys.argv[2], float(sys.argv[3])
    a = np.asarray(Image.open(src).convert('L')).astype(np.float32)
    V, used = veil(a); print(src, 'veil max %.0f, mean %.1f, dark regions used %.0f%%' % (V.max(), V.mean(), used * 100))
    b = np.clip((a - V) * 255.0 / np.maximum(255.0 - V, 1), 0, 255)     # glare also compresses the range; restore it
    print(tiles(b))
    if gamma != 1: lo, hi = np.percentile(b, .5), np.percentile(b, 99.7); b = np.clip((b - lo) / (hi - lo), 0, 1) ** gamma * 255
    Image.fromarray(b.astype(np.uint8)).save(dst, quality=88)
    Image.fromarray(np.clip(V * 4, 0, 255).astype(np.uint8)).resize((400, int(400 * a.shape[0] / a.shape[1]))).save(dst.replace('.jpg', '_veil.png'))
