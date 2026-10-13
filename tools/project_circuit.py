"""Project an f1-circuits track into data/circuits.json geometry.

Reproduces the projection behind data/circuits.json (redesign brief §6.3):
equirectangular with cos(mean latitude) x-scaling, rotated in 2-degree steps
to the best fit in 400x260 with 16 units of padding, points closer than
1.2 units thinned, start/finish straight measured either side of the first
coordinate until the heading changes by more than 8 degrees.

Usage (needs a clone of github.com/bacinger/f1-circuits):
  python3 tools/project_circuit.py <f1-circuits clone> data/circuits.json <id> [<id> ...]
Ids already in circuits.json are compared against the stored geometry;
new ids print the geometry to paste in. Before shipping a new circuit,
render it and confirm the red straight is the real start/finish straight,
and take the facts from the official F1 circuit page.
"""
import json, math, sys

W, H, PAD = 400, 260, 16

def project(coords):
    lat0 = sum(c[1] for c in coords) / len(coords)
    k = math.cos(math.radians(lat0))
    pts = [(c[0] * k, -c[1]) for c in coords]
    if pts[0] == pts[-1]:
        pts = pts[:-1]
    best = None
    for deg in range(0, 360, 2):
        a = math.radians(deg)
        ca, sa = math.cos(a), math.sin(a)
        r = [(x * ca - y * sa, x * sa + y * ca) for x, y in pts]
        xs, ys = [p[0] for p in r], [p[1] for p in r]
        w, h = max(xs) - min(xs), max(ys) - min(ys)
        s = min((W - 2 * PAD) / w, (H - 2 * PAD) / h)
        if best is None or s > best[0] + 1e-12:
            best = (s, deg, r, min(xs), min(ys), w, h)
    s, deg, r, mx, my, w, h = best
    ox = (W - w * s) / 2
    oy = (H - h * s) / 2
    out = [((x - mx) * s + ox, (y - my) * s + oy) for x, y in r]
    thin = [out[0]]
    for p in out[1:]:
        if math.dist(p, thin[-1]) >= 1.2:
            thin.append(p)
    if len(thin) > 2 and math.dist(thin[-1], thin[0]) < 1.2:
        thin.pop()
    return deg, thin

def heading(a, b):
    return math.degrees(math.atan2(b[1] - a[1], b[0] - a[0]))

def turn(h1, h2):
    d = (h2 - h1 + 180) % 360 - 180
    return abs(d)

def straight(pts):
    n = len(pts)
    seg = lambda i: (pts[i % n], pts[(i + 1) % n])
    h0 = heading(*seg(0))
    fwd = 0.0
    i = 0
    while i < n:
        a, b = seg(i)
        if turn(h0, heading(a, b)) > 8: break
        fwd += math.dist(a, b); i += 1
    hb = heading(*seg(-1))
    bwd = 0.0
    i = -1
    while i > -n:
        a, b = seg(i)
        if turn(hb, heading(a, b)) > 8: break
        bwd += math.dist(a, b); i -= 1
    return fwd, bwd

def build(coords, sf_len=14.0):
    deg, pts = project(coords)
    d = "M" + " L".join(f"{x:.1f} {y:.1f}" for x, y in pts) + " Z"
    length = sum(math.dist(pts[i], pts[(i + 1) % len(pts)]) for i in range(len(pts)))
    hx, hy = pts[1][0] - pts[0][0], pts[1][1] - pts[0][1]
    m = math.hypot(hx, hy); nx, ny = -hy / m, hx / m
    x0, y0 = pts[0]
    sf = [round(x0 - nx * sf_len / 2, 1), round(y0 - ny * sf_len / 2, 1), round(x0 + nx * sf_len / 2, 1), round(y0 + ny * sf_len / 2, 1)]
    fwd, bwd = straight(pts)
    return {"deg": deg, "d": d, "length": round(length, 1), "sf": sf, "sfStraight": {"fwd": round(fwd, 1), "bwd": round(bwd, 1)}}

if __name__ == "__main__":
    repo, ref = sys.argv[1], json.load(open(sys.argv[2]))["circuits"]
    for cid in sys.argv[3:]:
        g = json.load(open(f"{repo}/circuits/{cid}.geojson"))["features"][0]["geometry"]["coordinates"]
        b = build(g)
        if cid in ref:
            r = ref[cid]
            same = b["d"] == r["d"]
            print(cid, "d identical" if same else "d DIFFERS", "| len", b["length"], "vs", r["length"], "| sf", b["sf"], "vs", r["sf"], "| straight", b["sfStraight"], "vs", r["sfStraight"])
            if not same: print("  mine:", b["d"][:90]); print("  ref: ", r["d"][:90])
        else:
            print(cid, json.dumps(b))
