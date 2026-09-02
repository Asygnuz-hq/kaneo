// ASYGNUZ: dibuja las flechas de dependencia ("blocks") entre barras del
// Gantt. Puramente presentacional -- gantt.tsx mide las posiciones reales
// (vía getBoundingClientRect de cada barra) y le pasa las coordenadas ya
// calculadas, para no duplicar lógica de medición aquí.

export type DependencyLine = {
  id: string;
  // Punto de salida: borde derecho de la barra que bloquea (source).
  x1: number;
  y1: number;
  // Punto de llegada: borde izquierdo de la barra bloqueada (target).
  x2: number;
  y2: number;
};

type GanttDependencyOverlayProps = {
  lines: DependencyLine[];
  width: number;
  height: number;
};

const ARROW_ID = "gantt-dependency-arrow";

export function GanttDependencyOverlay({
  lines,
  width,
  height,
}: GanttDependencyOverlayProps) {
  if (lines.length === 0 || width <= 0 || height <= 0) return null;

  return (
    <svg
      className="pointer-events-none absolute inset-0 z-[5] overflow-visible"
      width={width}
      height={height}
      aria-hidden="true"
    >
      <defs>
        <marker
          id={ARROW_ID}
          viewBox="0 0 8 8"
          refX="7"
          refY="4"
          markerWidth="6"
          markerHeight="6"
          orient="auto-start-reverse"
        >
          <path d="M0,0 L8,4 L0,8 Z" className="fill-primary/60" />
        </marker>
      </defs>
      {lines.map((line) => {
        // Curva simple en "S": sale a la derecha de la barra origen, entra
        // por la izquierda de la barra destino, con un tramo horizontal
        // corto en cada punta para que la flecha no nazca pegada al borde.
        const midX = (line.x1 + line.x2) / 2;
        const path =
          line.x2 >= line.x1 + 16
            ? `M ${line.x1} ${line.y1} L ${midX} ${line.y1} L ${midX} ${line.y2} L ${line.x2 - 6} ${line.y2}`
            : `M ${line.x1} ${line.y1} L ${line.x1 + 10} ${line.y1} L ${line.x1 + 10} ${(line.y1 + line.y2) / 2} L ${line.x2 - 16} ${(line.y1 + line.y2) / 2} L ${line.x2 - 16} ${line.y2} L ${line.x2 - 6} ${line.y2}`;
        return (
          <path
            key={line.id}
            d={path}
            fill="none"
            className="stroke-primary/60"
            strokeWidth={1.5}
            markerEnd={`url(#${ARROW_ID})`}
          />
        );
      })}
    </svg>
  );
}
