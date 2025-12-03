import React, { useEffect, useMemo, useState } from "react";
import { createPortal } from "react-dom";
import {
  Plus,
  Folder as FolderIcon,
  FileText as FileIcon,
  Star,
  X,
  Pencil,
} from "lucide-react";

type NodeId = string;

export type DriveNode = {
  id: NodeId;
  name: string;
  type: "folder" | "file";
  starred?: boolean;
  level?: string | number;
};

type LoadChildren = (parentId: NodeId | null) => Promise<DriveNode[]>;

type ModalMode = "topic" | "move";

type ModalMoveDialogProps = {
  mode: ModalMode; 
  isOpen: boolean;
  itemName: string;
  currentLocationLabel?: string;
  onClose: () => void;
  onMove: (target: { fullId: NodeId; level: number | null; rawId: string }) => void;
  loadChildren: LoadChildren;
  rootId?: NodeId | null;
};

export const ModalMoveDialog: React.FC<ModalMoveDialogProps> = ({
  mode,
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

  const [selectedTarget, setSelectedTarget] = useState<{
    fullId: NodeId;
    level: number | null;
    rawId: string;
  } | null>(null);

  const [tab, setTab] = useState<"suggested" | "starred" | "all">("suggested");

  // 👉 Estados de creación/edición (solo realmente útiles en modo "topic")
  const [isAdding, setIsAdding] = useState(false);
  const [newName, setNewName] = useState("");
  const [editingId, setEditingId] = useState<NodeId | null>(null);
  const [editingName, setEditingName] = useState("");

  const currentParentId = useMemo(
    () => (path.length ? path[path.length - 1].id : rootId),
    [path, rootId]
  );

  const parseLevelAndId = (fullId?: string | null) => {
    console.log("fullId",fullId)


    if (!fullId) return { level: 0 as number | null, id: "", fullId: "" };

    const [prefix, raw] = fullId.split(":");
    console.log(raw)
    const m = /^L(\d+)$/.exec(prefix ?? "");
    const level = m ? Number(m[1]) : null;

    const fixlevel = level + 1

    return { level:fixlevel, id: raw ?? "", fullId };
  };

   const parseLevelAndIdGuardar = (fullId?: string | null) => {
    console.log("fullId",fullId)


    if (!fullId) return { level: 0 as number | null, id: "", fullId: "" };

    const [prefix, raw] = fullId.split(":");
    console.log(raw)
    const m = /^L(\d+)$/.exec(prefix ?? "");
    const level = m ? Number(m[1]) : null;

    return { level, id: raw ?? "", fullId };
  };


  // Carga de hijos al cambiar la ubicación actual
  useEffect(() => {
    if (!isOpen) return;
    setLoading(true);
    setSelectedTarget(null);
    setEditingId(null);
    setEditingName("");
    setIsAdding(false);
    setNewName("");

    loadChildren(currentParentId ?? null)
      .then((items) => setNodes(items))
      .finally(() => setLoading(false));
  }, [isOpen, currentParentId, loadChildren]);

  // Reset al cerrar
  useEffect(() => {
    if (isOpen) return;
    setPath([]);
    setNodes([]);
    setSelectedTarget(null);
    setTab("suggested");
    setIsAdding(false);
    setNewName("");
    setEditingId(null);
    setEditingName("");
  }, [isOpen]);

  // Selección por defecto: hoja (como antes)
  useEffect(() => {
    if (!isOpen || loading) return;

    const hasFolders = nodes.some((n) => n.type === "folder");
    const { level, id, fullId } = parseLevelAndId(currentParentId ?? null);

    

    if (!hasFolders && currentParentId) {
      setSelectedTarget({ fullId: currentParentId, level, rawId: id });
    } else {
      setSelectedTarget(null);
    }
  }, [isOpen, loading, nodes, currentParentId]);

  const filtered = useMemo(() => {
    if (tab === "starred") return nodes.filter((n) => n.starred);
    return nodes;
  }, [nodes, tab]);

  const isFileLevel = useMemo(
    () => nodes.length > 0 && nodes.every((n) => n.type === "file"),
    [nodes]
  );

  const disableAdd = isAdding || isFileLevel;

  if (!isOpen) return null;

  const enterFolder = (n: DriveNode) => {
    if (n.type !== "folder") return;
    setPath((prev) => [...prev, { id: n.id, name: n.name }]);
    setSelectedTarget(null);
  };

  const goToIndex = (idx: number) => {
    const newPath = idx >= 0 ? path.slice(0, idx + 1) : [];
    setPath(newPath);
    setSelectedTarget(null);
  };

  // --------- AGREGAR NUEVO ELEMENTO (modo "topic") ---------
  const handleStartAdd = () => {
    if (mode !== "topic") return; // solo en addTopic
    if (disableAdd) return;
    setIsAdding(true);
    setNewName("");
  };

  const handleCancelAdd = () => {
    setIsAdding(false);
    setNewName("");
  };

  const handleConfirmAdd = async () => {
    if (mode !== "topic") return;

    const name = newName.trim();
    if (!name) return;

    const { level, id: parentRawId } = parseLevelAndId(currentParentId ?? null);
    console.log("level",level)
    

    const parentId =
      parentRawId && parentRawId.trim() !== ""
        ? parentRawId
        : (crypto.randomUUID?.() ?? Math.random().toString(36).slice(2));


    const data = {
      name,
      parentId,
      type: "folder",
      level: level,
    };

    console.log("POST /nivelesScraping/niveles/temas/crear", data);

    try {
      const apiUrl = import.meta.env.VITE_API_URL;
      const res = await fetch(`${apiUrl}/nivelesScraping/niveles/temas/crear`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });

      if (!res.ok) {
        const txt = await res.text().catch(() => "");
        throw new Error(`HTTP ${res.status} ${txt}`);
      }

      const created = await res.json();

      const newNode: DriveNode = {
        id: created.fullId ?? `L${level}:${created._id}`,
        name: created.name ?? name,
        type: "folder",
      };

      setNodes((prev) => [...prev, newNode]);
      setIsAdding(false);
      setNewName("");
    } catch (err) {
      console.error("Error creando nivel:", err);
    }
  };

  // --------- EDITAR INLINE (opcional) ---------
  const startInlineEdit = (node: DriveNode) => {
    setEditingId(node.id);
    setEditingName(node.name);
  };

  const cancelInlineEdit = () => {
    setEditingId(null);
    setEditingName("");
  };

  const confirmInlineEdit = async (id, level) => {
    const name = editingName.trim();
    if (!name || !editingId) {
      cancelInlineEdit();
      return;
    }

    const data = {
      level,
      name
    }

    try {
      const apiUrl = import.meta.env.VITE_API_URL;
      const res = await fetch(`${apiUrl}/nivelesScraping/actualizarThema/${id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });

      if (!res.ok) {
        const txt = await res.text().catch(() => "");
        throw new Error(`HTTP ${res.status} ${txt}`);
      }

      const updated = await res.json();
      console.log(updated)

    } catch (e) {
      console.log("error")
    }

    setNodes((prev) =>
      prev.map((n) => (n.id === editingId ? { ...n, name } : n))
    );
    cancelInlineEdit();
  };

  // --------- CLICK EN CONFIRMAR SEGÚN MODO ---------
  const handleConfirmButton = () => {
    if (mode === "topic") {
      // en addTopic: Confirmar = crear carpeta/tema
      if (isAdding) {
        handleConfirmAdd();
      }
      return;
    }

    // modo "move": viejo comportamiento
    if (selectedTarget) {
      onMove(selectedTarget);
    }
  };

  const isConfirmDisabled =
    mode === "topic"
      ? !isAdding || newName.trim() === ""
      : !selectedTarget;

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
            <div className="font-medium text-gray-900">
              {mode === "topic"
                ? `Selecciona donde crear el tema`
                : `Nombre del archivo “${itemName}”`}
            </div>
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
            <TabButton active={tab === "suggested"} onClick={() => setTab("suggested")}>
              Sugeridos
            </TabButton>
            <TabButton active={tab === "starred"} onClick={() => setTab("starred")}>
              <Star size={14} className="inline -mt-0.5 mr-1" /> Favoritos
            </TabButton>
            <TabButton active={tab === "all"} onClick={() => setTab("all")}>
              Todos
            </TabButton>
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
            <ul className="divide-y rounded border mb-3">
              {filtered.map((n) => {
                const isEditing = editingId === n.id;

                return (
                  <li
                    key={n.id}
                    className={`flex items-center gap-3 px-3 py-2 ${n.type === "folder"
                      ? "cursor-pointer hover:bg-gray-50"
                      : "cursor-default opacity-90"
                      }`}
                    onClick={() =>
                      n.type === "folder" && !isEditing ? enterFolder(n) : undefined
                    }
                    title={n.type === "file" ? "Archivo" : "Carpeta"}
                  >
                    {n.type === "folder" ? (
                      <FolderIcon size={18} className="text-gray-700" />
                    ) : (
                      <FileIcon size={18} className="text-gray-500" />
                    )}

                    {isEditing ? (
                      <input
                        className="flex-1 border rounded px-2 py-1 text-sm"
                        value={editingName}
                        onChange={(e) => setEditingName(e.target.value)}
                        autoFocus
                        onKeyDown={(e) => {
                          if (e.key === "Enter") {
                            e.preventDefault();
                            console.log(editingId)
                            const { id, level } = parseLevelAndIdGuardar(editingId);
                            console.log(id)
                            console.log(level)
                            confirmInlineEdit(id, level);
                          }
                          if (e.key === "Escape") {
                            e.preventDefault();
                            cancelInlineEdit();
                          }
                        }}
                      />
                    ) : (
                      <span className="flex-1 text-sm truncate">{n.name}</span>
                    )}

                    {mode === "topic" && n.type === "folder" && !isEditing && (
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          startInlineEdit(n);
                        }}
                        className="p-1 rounded hover:bg-gray-100"
                        title="Modificar"
                      >
                        <Pencil size={16} className="text-gray-600" />
                      </button>
                    )}
                  </li>
                );
              })}
            </ul>
          )}

          {/* Input para nuevo elemento (solo en "topic") */}
          {mode === "topic" && isAdding && !isFileLevel && (
            <div className="mt-3 flex items-center gap-2">
              <input
                autoFocus
                value={newName}
                onChange={(e) => setNewName(e.target.value)}
                placeholder="Nombre del nuevo elemento"
                className="flex-1 border rounded px-2 py-1 text-sm"
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    e.preventDefault();
                    handleConfirmAdd();
                  }
                }}
              />
              <button
                onClick={handleConfirmAdd}
                className="px-3 py-1 text-sm rounded bg-green-600 text-white hover:bg-green-700"
              >
                Guardar
              </button>
              <button
                onClick={handleCancelAdd}
                className="px-3 py-1 text-sm rounded border border-gray-300 hover:bg-gray-50"
              >
                Cancelar
              </button>
            </div>
          )}

          {/* Botón Agregar (solo en "topic") */}
          {mode === "topic" && (
            <div className="mt-4">
              <button
                onClick={handleStartAdd}
                disabled={disableAdd}
                className={`flex items-center gap-2 px-4 py-2 rounded-full text-white ${disableAdd ? "bg-gray-400 cursor-not-allowed" : "bg-blue-600 hover:bg-blue-700"
                  }`}
              >
                <Plus size={20} />
                Agregar
              </button>
            </div>
          )}
        </div>

        {mode !== 'topic' && (
          <div className="px-5 py-3 border-t flex items-center justify-end gap-2">
            <button onClick={onClose} className="px-4 py-2 text-sm rounded border hover:bg-gray-50">
              Cancelar
            </button>
            <button
              onClick={handleConfirmButton}
              disabled={isConfirmDisabled}
              className={`px-4 py-2 text-sm rounded text-white ${!isConfirmDisabled ? "bg-blue-600 hover:bg-blue-700" : "bg-gray-300 cursor-not-allowed"
                }`}
            >
              Confirmar
            </button>
          </div>
        )}
        {/* Footer */}



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
    className={`px-1.5 pb-2 border-b-2 -mb-px ${active ? "border-blue-600 text-blue-700" : "border-transparent text-gray-600 hover:text-gray-800"
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