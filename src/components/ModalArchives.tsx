import React, { useEffect, useMemo, useState } from "react";
import { createPortal } from "react-dom";
import {
  Folder as FolderIcon,
  FileText as FileIcon,   
  FolderOpen as FolderOpenIcon,
  Star,
  X,
} from "lucide-react";

type NodeId = string;

export type DriveNode = {
  id: NodeId;           // "Lx:<mongoId>" o "ART:<id>"
  name: string;
  type: "folder" | "file";
  starred?: boolean;
};

type LoadChildren = (parentId: NodeId | null) => Promise<DriveNode[]>;

type ModalMoveDialogProps = {
  isOpen: boolean;
  itemName: string;
  currentLocationLabel?: string;
  onClose: () => void;
  // ⬇️ ahora onMove recibe fullId, level y rawId
  onMove: (target: { fullId: NodeId; level: number | null; rawId: string }) => void;
  loadChildren: LoadChildren;
  rootId?: NodeId | null;
};

export const ModalMoveDialog: React.FC<ModalMoveDialogProps> = ({
  isOpen,
  itemName,
  currentLocationLabel = "Mis Articulos",
  onClose,
  onMove,
  loadChildren,
  rootId = null,
}) => {
  const [path, setPath] = useState<{ id: NodeId | null; name: string }[]>([]);
  const [nodes, setNodes] = useState<DriveNode[]>([]);
  const [loading, setLoading] = useState(false);

  // ⬇️ ahora guardamos la selección con metadata
  const [selectedTarget, setSelectedTarget] = useState<{
    fullId: NodeId;
    level: number | null;
    rawId: string;
  } | null>(null);

  const [tab, setTab] = useState<"suggested" | "starred" | "all">("suggested");

  const currentParentId = useMemo(
    () => (path.length ? path[path.length - 1].id : rootId),
    [path, rootId]
  );

  // Helper para parsear nivel y id "limpio"
  const parseLevelAndId = (fullId?: string | null) => {
    if (!fullId) return { level: null as number | null, id: "", fullId: "" };
    const [prefix, raw] = fullId.split(":");
    const m = /^L(\d+)$/.exec(prefix ?? "");
    const level = m ? Number(m[1]) : null;
    return { level, id: raw ?? "", fullId };
  };

  // Carga de hijos al cambiar la ubicación actual
  useEffect(() => {
    if (!isOpen) return;
    setLoading(true);
    // al navegar, resetea selección explícita
    setSelectedTarget(null);

    loadChildren(currentParentId ?? null)
      .then((items) => {
        setNodes(items);
      })
      .finally(() => setLoading(false));
  }, [isOpen, currentParentId, loadChildren]);

  // Reset total al cerrar
  useEffect(() => {
    if (isOpen) return;
    setPath([]);
    setNodes([]);
    setSelectedTarget(null);
    setTab("suggested");
  }, [isOpen]);

  // ➊ Si hay artículos (files) en el nivel actual, fijamos destino = carpeta actual
  // ➋ Imprime { level, id, fullId }
  // ➊ Si la carpeta actual NO tiene subcarpetas (hoja), habilitamos el destino,
//    aunque no existan artículos todavía (permite crear el primero).
// ➋ Loggeamos { level, id, fullId } para depurar.
useEffect(() => {
  if (!isOpen || loading) return;

  const hasFolders = nodes.some((n) => n.type === "folder");
  const { level, id, fullId } = parseLevelAndId(currentParentId ?? null);

  if (!hasFolders && currentParentId) {
    // Es hoja: sin subcarpetas. Puede tener archivos o estar vacía.
    setSelectedTarget({ fullId: currentParentId, level, rawId: id });

    if (nodes.length > 0) {
      console.log("Leaf with items (files). Current folder as target:", { level, id, fullId });
    } else {
      console.log("Leaf EMPTY (no folders, no files). Current folder as target:", { level, id, fullId });
    }
  } else {
    // Hay subcarpetas: aún no es hoja → deshabilitamos hasta que bajen a una hoja
    setSelectedTarget(null);
  }
}, [isOpen, loading, nodes, currentParentId]);

  const filtered = useMemo(() => {
    if (tab === "starred") return nodes.filter((n) => n.starred);
    return nodes;
  }, [nodes, tab]);

  if (!isOpen) return null;

  // Navegar a carpeta hija
  const enterFolder = (n: DriveNode) => {
    if (n.type !== "folder") return;
    setPath((prev) => [...prev, { id: n.id, name: n.name }]);
    setSelectedTarget(null); // se recalculará cuando carguen los hijos
  };

  // Breadcrumb
  const goToIndex = (idx: number) => {
    const newPath = idx >= 0 ? path.slice(0, idx + 1) : [];
    setPath(newPath);
    setSelectedTarget(null);
  };

  return createPortal(
    <div
      className="fixed inset-0 z-50 grid place-items-center bg-black/50"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
    >
      <div
        className="w-[720px] max-w-[95vw] max-height-[85vh] bg-white rounded-xl shadow-xl overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="px-5 py-3 border-b flex items-center justify-between">
          <div className="text-sm text-gray-600">
            <div className="font-medium text-gray-900">Nombre del archivo “{itemName}”</div>
            <div className="flex items-center gap-1">
              <span className="text-xs text-gray-500">Ruta Actual:</span>
              <span className="text-xs font-medium">{currentLocationLabel}</span>
            </div>
          </div>
          <button onClick={onClose} className="p-2 rounded hover:bg-gray-100" aria-label="Close">
            <X size={18} />
          </button>
        </div>

        {/* Tabs */}
        <div className="px-5 pt-3">
          <div className="flex items-center gap-4 text-sm">
            <TabButton active={tab === "suggested"} onClick={() => setTab("suggested")}>Sugeridos</TabButton>
            <TabButton active={tab === "starred"} onClick={() => setTab("starred")}>
              <Star size={14} className="inline -mt-0.5 mr-1" /> Favoritos
            </TabButton>
            <TabButton active={tab === "all"} onClick={() => setTab("all")}>Todos</TabButton>
          </div>
        </div>

        {/* Breadcrumb */}
        <div className="px-5 pt-2 text-xs text-gray-600">
          <Breadcrumb rootLabel="Mis articulos" path={path} onCrumbClick={goToIndex} />
        </div>

        {/* Body */}
        <div className="px-5 py-2 overflow-auto" style={{ maxHeight: "52vh" }}>
          {loading ? (
            <div className="py-10 text-center text-gray-500 text-sm">Loading…</div>
          ) : filtered.length === 0 ? (
            <div className="py-10 text-center text-gray-400 text-sm">No items</div>
          ) : (
            <ul className="divide-y rounded border">
              {filtered.map((n) => (
                <li
                  key={n.id}
                  className={`flex items-center gap-3 px-3 py-2 ${
                    n.type === "folder" ? "cursor-pointer hover:bg-gray-50" : "cursor-default opacity-90"
                  }`}
                  onClick={() => (n.type === "folder" ? enterFolder(n) : undefined)}
                  title={n.type === "file" ? "Archivo" : "Carpeta"}
                >
                  {n.type === "folder" ? (
                    <FolderIcon size={18} className="text-gray-700" />
                  ) : (
                      <FileIcon size={18} className="text-gray-500" />  // 👈 aquí archivo
                  )}
                  <span className="flex-1 text-sm">{n.name}</span>
                </li>
              ))}
            </ul>
          )}
        </div>

        {/* Footer */}
        <div className="px-5 py-3 border-t flex items-center justify-end gap-2">
          <button onClick={onClose} className="px-4 py-2 text-sm rounded border hover:bg-gray-50">
            Cancel
          </button>
          <button
            onClick={() => selectedTarget && onMove(selectedTarget)}
            disabled={!selectedTarget}
            className={`px-4 py-2 text-sm rounded text-white ${
              selectedTarget ? "bg-blue-600 hover:bg-blue-700" : "bg-gray-300 cursor-not-allowed"
            }`}
            title={selectedTarget ? "Move here" : "Navigate into a leaf that contains articles"}
          >
            Confirmar
          </button>
        </div>
      </div>
    </div>,
    document.body
  );
};

const TabButton: React.FC<{ active?: boolean; onClick?: () => void; children: React.ReactNode }> = ({
  active,
  onClick,
  children,
}) => (
  <button
    onClick={onClick}
    className={`px-1.5 pb-2 border-b-2 -mb-px ${
      active ? "border-blue-600 text-blue-700" : "border-transparent text-gray-600 hover:text-gray-800"
    }`}
  >
    {children}
  </button>
);

const Breadcrumb: React.FC<{
  rootLabel: string;
  path: { id: NodeId | null; name: string }[];
  onCrumbClick: (idx: number) => void; // -1 = root
}> = ({ rootLabel, path, onCrumbClick }) => {
  return (
    <div className="flex items-center gap-1 flex-wrap">
      <button className="hover:underline" onClick={() => onCrumbClick(-1)} title={rootLabel}>
        {rootLabel}
      </button>
      {path.map((p, i) => (
        <span key={p.id ?? `root-${i}`} className="flex items-center gap-1">
          <span className="text-gray-300">/</span>
          <button className="hover:underline" onClick={() => onCrumbClick(i)}>
            {p.name}
          </button>
        </span>
      ))}
    </div>
  );
}; 