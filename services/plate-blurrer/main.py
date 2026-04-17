"""
Plate Blurrer — FastAPI microservice
3 méthodes de détection en cascade :
  1. Haar cascade      → rapide, plaques EU frontales
  2. Quad perspective  → plaques en biais (inspiré de ikajdan/license-plate-recognition, MIT)
  3. Contour fallback  → dernier recours, ratio 4.73:1 (plaque française)

Run locally:
  uvicorn main:app --host 0.0.0.0 --port 8001 --reload

Endpoints:
  POST /blur    → multipart file → JPEG avec plaques floutées
  POST /detect  → multipart file → JSON bounding boxes
  GET  /health  → {"status":"ok", "cascades": N}
"""

import logging

import cv2
import numpy as np
from fastapi import FastAPI, File, HTTPException, UploadFile
from fastapi.responses import Response

logging.basicConfig(level=logging.INFO, format="%(levelname)s  %(message)s")
log = logging.getLogger(__name__)

app = FastAPI(title="Plate Blurrer", version="1.1.0")

# ──────────────────────────────────────────────────────────────
# Haar cascades (inclus dans opencv-python-headless)
# haarcascade_russian_plate_number.xml → plaques EU / françaises
# ──────────────────────────────────────────────────────────────
CASCADES: list[cv2.CascadeClassifier] = []
for _name in ["haarcascade_russian_plate_number.xml"]:
    _clf = cv2.CascadeClassifier(cv2.data.haarcascades + _name)
    if not _clf.empty():
        CASCADES.append(_clf)
        log.info("Cascade chargée : %s", _name)
log.info("Total cascades : %d", len(CASCADES))


# ──────────────────────────────────────────────────────────────
# Helpers communs
# ──────────────────────────────────────────────────────────────

def _decode(data: bytes) -> np.ndarray:
    arr = np.frombuffer(data, np.uint8)
    img = cv2.imdecode(arr, cv2.IMREAD_COLOR)
    if img is None:
        raise ValueError("Impossible de décoder l'image")
    return img


def _iou(a: tuple, b: tuple) -> float:
    ax, ay, aw, ah = a
    bx, by, bw, bh = b
    ix = max(0, min(ax + aw, bx + bw) - max(ax, bx))
    iy = max(0, min(ay + ah, by + bh) - max(ay, by))
    inter = ix * iy
    union = aw * ah + bw * bh - inter
    return inter / union if union > 0 else 0.0


def _nms(boxes: list[tuple], threshold: float = 0.45) -> list[tuple]:
    """Non-maximum suppression — supprime les détections qui se chevauchent."""
    if not boxes:
        return []
    boxes = sorted(boxes, key=lambda b: b[2] * b[3], reverse=True)
    kept: list[tuple] = []
    for box in boxes:
        if all(_iou(box, k) < threshold for k in kept):
            kept.append(box)
    return kept


# ──────────────────────────────────────────────────────────────
# Méthode 1 — Haar cascade
# ──────────────────────────────────────────────────────────────

def _detect_cascade(gray: np.ndarray) -> list[tuple[int, int, int, int]]:
    boxes: list[tuple[int, int, int, int]] = []
    for clf in CASCADES:
        dets = clf.detectMultiScale(
            gray,
            scaleFactor=1.08,
            minNeighbors=3,
            minSize=(55, 14),
            maxSize=(600, 180),
        )
        if len(dets) > 0:
            boxes.extend((int(x), int(y), int(w), int(h)) for x, y, w, h in dets)
    return boxes


# ──────────────────────────────────────────────────────────────
# Méthode 2 — Détection de quadrilatères (plaques en biais)
# Inspiré de ikajdan/license-plate-recognition (MIT License)
# Idée clé : approxPolyDP → quad 4 coins → ratio plaque → flou par masque
# ──────────────────────────────────────────────────────────────

def _order_quad(pts: np.ndarray) -> np.ndarray:
    """
    Ordonne 4 points : haut-gauche, haut-droite, bas-droite, bas-gauche.
    Même logique que ikajdan/roi.py.
    """
    pts = pts.reshape(4, 2).astype(np.float32)
    s = pts.sum(axis=1)
    diff = np.diff(pts, axis=1).ravel()
    ordered = np.zeros((4, 2), dtype=np.float32)
    ordered[0] = pts[np.argmin(s)]    # haut-gauche  (x+y minimal)
    ordered[2] = pts[np.argmax(s)]    # bas-droite   (x+y maximal)
    ordered[1] = pts[np.argmin(diff)] # haut-droite  (y-x minimal)
    ordered[3] = pts[np.argmax(diff)] # bas-gauche   (y-x maximal)
    return ordered


def _quad_to_bbox(pts: np.ndarray) -> tuple[int, int, int, int]:
    x, y, w, h = cv2.boundingRect(pts.astype(np.int32))
    return int(x), int(y), int(w), int(h)


def _detect_quads(gray: np.ndarray, color: np.ndarray) -> list[np.ndarray]:
    """
    Trouve les quadrilatères ressemblant à des plaques (ratio 2.5–7, taille cohérente).
    Retourne une liste de tableaux (4, 2) — un par plaque candidate.
    """
    h_img, w_img = gray.shape

    blurred = cv2.GaussianBlur(gray, (5, 5), 0)
    edges = cv2.Canny(blurred, 50, 200)
    kernel = cv2.getStructuringElement(cv2.MORPH_RECT, (3, 3))
    edges = cv2.dilate(edges, kernel, iterations=2)

    contours, _ = cv2.findContours(edges, cv2.RETR_LIST, cv2.CHAIN_APPROX_SIMPLE)
    # Trier par aire décroissante, garder les 60 plus grandes
    contours = sorted(contours, key=cv2.contourArea, reverse=True)[:60]

    quads: list[np.ndarray] = []
    seen_bboxes: list[tuple] = []

    for cnt in contours:
        if cv2.contourArea(cnt) < 400:
            continue

        peri = cv2.arcLength(cnt, True)
        approx = cv2.approxPolyDP(cnt, 0.02 * peri, True)

        if len(approx) != 4:
            continue

        x, y, w, h = cv2.boundingRect(approx)
        if h == 0:
            continue
        ratio = w / h
        area_frac = (w * h) / (w_img * h_img)

        if not (2.5 <= ratio <= 7.0):
            continue
        if not (0.003 <= area_frac <= 0.15):
            continue

        # Vérification luminosité (plaques blanches/claires)
        region = color[y : y + h, x : x + w]
        if region.size == 0:
            continue
        brightness = float(np.mean(cv2.cvtColor(region, cv2.COLOR_BGR2GRAY)))
        if brightness < 110:
            continue

        bbox = (x, y, w, h)
        # NMS rapide sur les bboxes déjà retenues
        if any(_iou(bbox, s) > 0.45 for s in seen_bboxes):
            continue

        ordered = _order_quad(approx)
        quads.append(ordered)
        seen_bboxes.append(bbox)

    return quads


# ──────────────────────────────────────────────────────────────
# Méthode 3 — Contour fallback (ratio seul)
# ──────────────────────────────────────────────────────────────

def _detect_contours(gray: np.ndarray, color: np.ndarray) -> list[tuple[int, int, int, int]]:
    h_img, w_img = gray.shape

    blurred = cv2.bilateralFilter(gray, 11, 17, 17)
    edges = cv2.Canny(blurred, 30, 200)
    kernel = cv2.getStructuringElement(cv2.MORPH_RECT, (3, 3))
    edges = cv2.dilate(edges, kernel, iterations=1)

    contours, _ = cv2.findContours(edges, cv2.RETR_LIST, cv2.CHAIN_APPROX_SIMPLE)

    candidates: list[tuple[int, int, int, int]] = []
    for cnt in contours:
        x, y, w, h = cv2.boundingRect(cnt)
        if w < 50 or h < 12:
            continue
        if w > w_img * 0.95 or h > h_img * 0.5:
            continue
        ratio = w / h
        area_frac = (w * h) / (w_img * h_img)
        if not (2.5 <= ratio <= 7.0):
            continue
        if not (0.003 <= area_frac <= 0.15):
            continue
        region = color[y : y + h, x : x + w]
        brightness = float(np.mean(cv2.cvtColor(region, cv2.COLOR_BGR2GRAY)))
        if brightness < 120:
            continue
        candidates.append((x, y, w, h))

    return _nms(candidates)


# ──────────────────────────────────────────────────────────────
# Flou
# ──────────────────────────────────────────────────────────────

def _pixelate_blur(patch: np.ndarray) -> np.ndarray:
    """
    Flou maximal — 3 passes :
      1. Pixelisation ÷16 → irréversible (aucun caractère lisible)
      2. Gaussian fort
      3. Deuxième Gaussian pour effacer les bords de pixels
    """
    h, w = patch.shape[:2]

    # Passe 1 : pixelisation très agressive (÷16)
    scale = max(1, min(w, h) // 16)
    small = cv2.resize(patch, (max(1, w // scale), max(1, h // scale)))
    pix = cv2.resize(small, (w, h), interpolation=cv2.INTER_NEAREST)

    # Passe 2 : Gaussian fort
    ksize = max(75, (min(w, h) // 2) | 1)  # doit être impair
    out = cv2.GaussianBlur(pix, (ksize, ksize), 40)

    # Passe 3 : deuxième Gaussian pour effacer toute structure résiduelle
    out = cv2.GaussianBlur(out, (ksize, ksize), 40)

    return out


def _blur_rect(img: np.ndarray, x: int, y: int, w: int, h: int, pad: int = 6) -> None:
    """Floute un rectangle dans l'image (en place)."""
    ih, iw = img.shape[:2]
    x1, y1 = max(0, x - pad), max(0, y - pad)
    x2, y2 = min(iw, x + w + pad), min(ih, y + h + pad)
    rw, rh = x2 - x1, y2 - y1
    if rw <= 0 or rh <= 0:
        return
    img[y1:y2, x1:x2] = _pixelate_blur(img[y1:y2, x1:x2])


def _blur_polygon(img: np.ndarray, pts: np.ndarray, pad: int = 8) -> None:
    """
    Floute un quadrilatère en biais avec un masque polygone (en place).
    Les pixels hors du quad ne sont pas modifiés → flou précis même sur plaque inclinée.
    """
    ih, iw = img.shape[:2]

    # Légère expansion du polygone autour de son centre
    center = pts.mean(axis=0)
    expanded = (center + (pts - center) * 1.12).astype(np.int32)
    expanded[:, 0] = np.clip(expanded[:, 0], 0, iw - 1)
    expanded[:, 1] = np.clip(expanded[:, 1], 0, ih - 1)

    x, y, w, h = cv2.boundingRect(expanded)
    x1, y1 = max(0, x - pad), max(0, y - pad)
    x2, y2 = min(iw, x + w + pad), min(ih, y + h + pad)
    rw, rh = x2 - x1, y2 - y1
    if rw <= 0 or rh <= 0:
        return

    # Masque polygone dans le repère du patch
    mask = np.zeros((ih, iw), dtype=np.uint8)
    cv2.fillPoly(mask, [expanded], 255)
    mask_roi = mask[y1:y2, x1:x2]

    blurred_patch = _pixelate_blur(img[y1:y2, x1:x2].copy())

    # Appliquer uniquement à l'intérieur du polygone
    img[y1:y2, x1:x2] = np.where(
        mask_roi[:, :, np.newaxis] > 0,
        blurred_patch,
        img[y1:y2, x1:x2],
    )


# ──────────────────────────────────────────────────────────────
# Pipeline principal
# ──────────────────────────────────────────────────────────────

def process_image(data: bytes) -> tuple[bytes, list[dict]]:
    """
    Détecte et floute toutes les plaques.
    Retourne (jpeg_bytes, liste_de_boîtes).
    """
    img = _decode(data)
    gray = cv2.cvtColor(img, cv2.COLOR_BGR2GRAY)

    result_boxes: list[dict] = []

    # ── Méthode 1 : Haar cascade ────────────────────────────────
    cascade_boxes = _detect_cascade(gray)
    for x, y, w, h in _nms(cascade_boxes):
        _blur_rect(img, x, y, w, h)
        result_boxes.append({"x": x, "y": y, "w": w, "h": h, "method": "cascade"})

    # ── Méthode 2 : Quads en biais (perspective) ────────────────
    # Ne cherche que dans les zones non encore floutées
    already: list[tuple] = [(b["x"], b["y"], b["w"], b["h"]) for b in result_boxes]
    quads = _detect_quads(gray, img)
    for quad in quads:
        bbox = _quad_to_bbox(quad)
        # Ignorer si recouvre une zone déjà traitée
        if any(_iou(bbox, a) > 0.3 for a in already):
            continue
        _blur_polygon(img, quad)
        x, y, w, h = bbox
        result_boxes.append({"x": x, "y": y, "w": w, "h": h, "method": "quad"})
        already.append(bbox)

    # ── Méthode 3 : Contour fallback ────────────────────────────
    if not result_boxes:
        for x, y, w, h in _detect_contours(gray, img):
            _blur_rect(img, x, y, w, h)
            result_boxes.append({"x": x, "y": y, "w": w, "h": h, "method": "contour"})

    if result_boxes:
        methods = ", ".join(set(b["method"] for b in result_boxes))
        log.info("Flouté %d plaque(s) — méthode(s) : %s", len(result_boxes), methods)
    else:
        log.info("Aucune plaque détectée — image inchangée")

    _, buf = cv2.imencode(".jpg", img, [cv2.IMWRITE_JPEG_QUALITY, 92])
    return buf.tobytes(), result_boxes


# ──────────────────────────────────────────────────────────────
# Routes
# ──────────────────────────────────────────────────────────────

@app.post("/blur")
async def blur(file: UploadFile = File(...)):
    """Retourne un JPEG avec toutes les plaques floutées."""
    data = await file.read()
    try:
        jpeg, boxes = process_image(data)
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc))
    return Response(
        content=jpeg,
        media_type="image/jpeg",
        headers={"X-Plates-Found": str(len(boxes))},
    )


@app.post("/detect")
async def detect(file: UploadFile = File(...)):
    """Retourne les bounding boxes sans modifier l'image (pour l'UI d'ajustement manuel)."""
    data = await file.read()
    try:
        img = _decode(data)
        gray = cv2.cvtColor(img, cv2.COLOR_BGR2GRAY)
        ih, iw = img.shape[:2]

        cascade_boxes = _detect_cascade(gray)
        quads = _detect_quads(gray, img)
        quad_bboxes = [_quad_to_bbox(q) for q in quads]

        all_boxes = _nms(cascade_boxes + quad_bboxes) or _detect_contours(gray, img)
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc))

    detections = [
        {
            "score": 0.95,
            "label": "license-plate",
            "box": {"xmin": x, "ymin": y, "xmax": x + w, "ymax": y + h},
        }
        for x, y, w, h in all_boxes
    ]
    return {"detections": detections, "image_size": {"width": iw, "height": ih}}


@app.get("/health")
async def health():
    return {"status": "ok", "cascades": len(CASCADES)}
