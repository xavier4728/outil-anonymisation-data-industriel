/** Aperçu d'une page de plan, avec ses masques, et tracé de rectangles à la souris. */
import { useEffect, useRef, useState, type PointerEvent as PE } from "react";
import { rendrePage, versBlob } from "../lib/plans";
import type { Fichier, PagePlan, Rect } from "../lib/types";

const LARGEUR_APERCU = 1400;
const cache = new Map<string, Promise<string>>();

export function urlApercu(f: Fichier, page: PagePlan): Promise<string> {
  let p = cache.get(page.id);
  if (!p) {
    p = rendrePage(f, page, LARGEUR_APERCU)
      .then((c) => versBlob(c, "image/jpeg", 0.85))
      .then((b) => URL.createObjectURL(b));
    p.catch(() => cache.delete(page.id));
    cache.set(page.id, p);
  }
  return p;
}

export function viderApercus(): void {
  for (const p of cache.values()) p.then((u) => URL.revokeObjectURL(u)).catch(() => undefined);
  cache.clear();
}

export interface RectAffiche extends Rect {
  cle: string;
  classe: "zone" | "terme" | "motif" | "manuel" | "retire" | "trace";
  titre?: string;
  onRetirer?: () => void;
  onClic?: () => void;
}

interface Props {
  fichier: Fichier;
  page: PagePlan;
  rects: RectAffiche[];
  avant?: boolean;
  onTrace?: (r: Rect) => void;
  hauteurMax?: string;
}

export function Apercu({ fichier, page, rects, avant, onTrace, hauteurMax }: Props) {
  const [url, setUrl] = useState<string | null>(null);
  const [erreur, setErreur] = useState<string | null>(null);
  const [trace, setTrace] = useState<Rect | null>(null);
  const depart = useRef<{ x: number; y: number } | null>(null);
  const calque = useRef<HTMLDivElement>(null);

  useEffect(() => {
    let vivant = true;
    setUrl(null);
    setErreur(null);
    urlApercu(fichier, page).then(
      (u) => vivant && setUrl(u),
      (err) => vivant && setErreur(String(err)),
    );
    return () => {
      vivant = false;
    };
  }, [fichier, page]);

  const point = (ev: PE) => {
    const b = calque.current!.getBoundingClientRect();
    return { x: Math.min(1, Math.max(0, (ev.clientX - b.left) / b.width)), y: Math.min(1, Math.max(0, (ev.clientY - b.top) / b.height)) };
  };
  const bas = (ev: PE) => {
    if (!onTrace || ev.target !== calque.current) return;
    calque.current!.setPointerCapture(ev.pointerId);
    depart.current = point(ev);
    setTrace({ ...depart.current, w: 0, h: 0 });
  };
  const bouge = (ev: PE) => {
    if (!depart.current) return;
    const p = point(ev);
    const d = depart.current;
    setTrace({ x: Math.min(d.x, p.x), y: Math.min(d.y, p.y), w: Math.abs(p.x - d.x), h: Math.abs(p.y - d.y) });
  };
  const haut = () => {
    if (trace && trace.w > 0.004 && trace.h > 0.004) onTrace?.(trace);
    depart.current = null;
    setTrace(null);
  };

  const ratio = page.hauteurPt / page.largeurPt;
  const style = hauteurMax ? { maxWidth: `calc(${hauteurMax} / ${ratio})`, margin: "0 auto" } : undefined;

  if (erreur) return <div className="panneau-alerte">Aperçu impossible : {erreur}</div>;
  if (!url)
    return (
      <div className="chargement" style={{ ...style, aspectRatio: `${1 / ratio}` }}>
        <span className="libelle">Préparation de l'aperçu…</span>
      </div>
    );
  return (
    <div className={`apercu${avant ? " avant" : ""}`} style={style}>
      <img src={url} alt={`Page ${page.index + 1}`} draggable={false} />
      <div ref={calque} className="calque" onPointerDown={bas} onPointerMove={bouge} onPointerUp={haut} style={{ cursor: onTrace ? "crosshair" : "default" }}>
        {rects.map((r) => (
          <div
            key={r.cle}
            className={`r ${r.classe}`}
            title={r.titre}
            onClick={r.onClic}
            style={{ left: `${r.x * 100}%`, top: `${r.y * 100}%`, width: `${r.w * 100}%`, height: `${r.h * 100}%`, cursor: r.onClic ? "pointer" : undefined }}
          >
            {r.onRetirer && (
              <button
                type="button"
                title="Retirer"
                onPointerDown={(ev) => ev.stopPropagation()}
                onClick={(ev) => {
                  ev.stopPropagation();
                  r.onRetirer?.();
                }}
              >
                ×
              </button>
            )}
          </div>
        ))}
        {trace && (
          <div className="r trace" style={{ left: `${trace.x * 100}%`, top: `${trace.y * 100}%`, width: `${trace.w * 100}%`, height: `${trace.h * 100}%` }} />
        )}
      </div>
    </div>
  );
}
