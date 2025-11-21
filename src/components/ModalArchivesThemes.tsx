import React, { useEffect, useMemo, useState } from "react";
import { createPortal } from "react-dom";
import {
  Plus,
  Folder as FolderIcon,
  FileText as FileIcon,
  Star,
  X,
  Pencil,
  Trash2,
} from "lucide-react";

type NodeId = string;

export type DriveNode = {
  id: NodeId;
  name: string;
  type: "folder" | "file";
  starred?: boolean;
  level?:string | Number
};

type LoadChildren = (parentId: NodeId | null) => Promise<DriveNode[]>;

type ModalMoveDialogProps = {
  isOpen: boolean;
  itemName: string;
  currentLocationLabel?: string;
  onClose: () => void;
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

  const [selectedTarget, setSelectedTarget] = useState<{
    fullId: NodeId;
    level: number | null;
    rawId: string;
  } | null>(null);

  const [tab, setTab] = useState<"suggested" | "starred" | "all">("suggested");

  // estado para agregar nuevo elemento
  const [isAdding, setIsAdding] = useState(false);
  const [newName, setNewName] = useState("");
    const [Level, setLevel] = useState(0);


  // estado para editar inline
  const [editingId, setEditingId] = useState<NodeId | null>(null);
  const [editingName, setEditingName] = useState("");

  const currentParentId = useMemo(
    () => (path.length ? path[path.length - 1].id : rootId),
    [path, rootId]
  );

  // Helper para parsear nivel y id "limpio"
  const parseLevelAndId = (fullId?: string | null) => {
  if (!fullId) return { level: null as number | null, id: "", fullId: "" };

  const [prefix, raw] = fullId.split(":");
  const m = /^L(\d+)$/.exec(prefix ?? "");
  const level = m ? Number(m[1]) : null; // nivel REAL (0,1,2,3...)

  return { level, id: raw ?? "", fullId };
};

  // Carga de hijos al cambiar la ubicación actual
  useEffect(() => {
    if (!isOpen) return;
    setLoading(true);
    setSelectedTarget(null);
    setEditingId(null);
    setEditingName("");

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
    setIsAdding(false);
    setNewName("");
    setEditingId(null);
    setEditingName("");
  }, [isOpen]);

  // Si la carpeta actual es "hoja" (sin subcarpetas), la usamos como destino por defecto
  useEffect(() => {
    if (!isOpen || loading) return;

    const hasFolders = nodes.some((n) => n.type === "folder");
    const { level, id, fullId } = parseLevelAndId(currentParentId ?? null);
        
     setLevel(0)

    if (!hasFolders && currentParentId) {
       setLevel(level!)

       setSelectedTarget({ fullId: currentParentId, level, rawId: id });

      if (nodes.length > 0) {
        console.log("Leaf with items (files). Current folder as target:", { level, id, fullId });
      } else {
        console.log("Leaf EMPTY (no folders, no files). Current folder as target:", { level, id, fullId });
      }
    } else {
      setSelectedTarget(null);
    }
  }, [isOpen, loading, nodes, currentParentId]);

  const filtered = useMemo(() => {
    if (tab === "starred") return nodes.filter((n) => n.starred);
    return nodes;
  }, [nodes, tab]);

  // nivel “solo archivos”: no hay carpetas
  const isFileLevel = useMemo(
    () => nodes.length > 0 && nodes.every((n) => n.type === "file"),
    [nodes]
  );

  // deshabilitar agregar si ya estamos en nivel de solo files
  const disableAdd = isAdding || isFileLevel;

  if (!isOpen) return null;

  // Navegar a carpeta hija
  const enterFolder = (n: DriveNode) => {
    if (n.type !== "folder") return;
    setPath((prev) => [...prev, { id: n.id, name: n.name }]);
    setSelectedTarget(null);
  };

  // Breadcrumb
  const goToIndex = (idx: number) => {
    const newPath = idx >= 0 ? path.slice(0, idx + 1) : [];
    setPath(newPath);
    setSelectedTarget(null);
  };

  // --------- AGREGAR NUEVO ELEMENTO ---------

  const handleStartAdd = () => {
    if (disableAdd) return;
    setIsAdding(true);
    setNewName("");
    

  };

  const handleCancelAdd =  ()  =>   {
    setIsAdding(false);
    setNewName("");
  };

  const handleConfirmAdd = async () => {
  const name = newName.trim();
  if (!name) return;

  // Obtener nivel e id del padre actual (puede ser null en raíz)
  const { level, id: parentRawId } = parseLevelAndId(currentParentId ?? null);

  // Si no hay parentRawId, generamos uno random único para parentId
  const parentId =
    parentRawId && parentRawId.trim() !== ""
      ? parentRawId
      : (crypto.randomUUID?.() ?? Math.random().toString(36).slice(2));

  // Nivel del nuevo nodo:
  // - si estamos en raíz (level === null) → 0
  // - si estamos dentro de L0 → hijo será nivel 1
  // - si estamos dentro de L1 → hijo será nivel 2
  const newLevel = level == null ? 0 : level + 1;

  // Payload que se manda al backend
  const data = {
    name,
    parentId,
    type: "folder",
    level: newLevel, 
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

    // Nodo que se verá en el árbol del modal
    const newNode: DriveNode = {
      id: created.fullId ?? `L${newLevel}:${created._id}`,
      name: created.name ?? name,
      type: "folder",
    };

    setNodes((prev) => [...prev, newNode]);
    setIsAdding(false);
    setNewName("");
  } catch (err) {
    console.error("Error creando nivel:", err);
    // aquí puedes poner algún toast si quieres
  }
};

  // --------- EDITAR INLINE / ELIMINAR ELEMENTOS ---------

  const startInlineEdit = (node: DriveNode) => {
    setEditingId(node.id);
    setEditingName(node.name);
  };

  const cancelInlineEdit = () => {
    setEditingId(null);
    setEditingName("");
  };

  const confirmInlineEdit = () => {
    const name = editingName.trim();
    if (!name || !editingId) {
      cancelInlineEdit();
      return;
    }

    setNodes((prev) =>
      prev.map((n) => (n.id === editingId ? { ...n, name } : n))
    );
    cancelInlineEdit();
  };

  const handleDeleteNode = (node: DriveNode) => {
    const ok = window.confirm(`¿Eliminar "${node.name}"?`);
    if (!ok) return;

    setNodes((prev) => prev.filter((n) => n.id !== node.id));
  };

  // ------------------------------------------

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
                    className={`flex items-center gap-3 px-3 py-2 ${
                      n.type === "folder"
                        ? "cursor-pointer hover:bg-gray-50"
                        : "cursor-default opacity-90"
                    }`}
                    onClick={() => (n.type === "folder" && !isEditing ? enterFolder(n) : undefined)}
                    title={n.type === "file" ? "Archivo" : "Carpeta"}
                  >
                    {n.type === "folder" ? (
                      <FolderIcon size={18} className="text-gray-700" />
                    ) : (
                      <FileIcon size={18} className="text-gray-500" />
                    )}

                    {/* Nombre o input de edición */}
                    {isEditing ? (
                      <input
                        className="flex-1 border rounded px-2 py-1 text-sm"
                        value={editingName}
                        onChange={(e) => setEditingName(e.target.value)}
                        autoFocus
                        onKeyDown={(e) => {
                          if (e.key === "Enter") {
                            e.preventDefault();
                            confirmInlineEdit();
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

                    <div className="flex items-center gap-1">
                      {n.type === "folder" && !isEditing && (
                        <>
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
                         
                       </>
                      )}

                      {n.type === "folder" && isEditing && (
                        <>
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              confirmInlineEdit();
                            }}
                            className="px-2 py-1 text-xs rounded bg-green-600 text-white hover:bg-green-700"
                          >
                            Guardar
                          </button>
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              cancelInlineEdit();
                            }}
                            className="px-2 py-1 text-xs rounded border border-gray-300 hover:bg-gray-50"
                          >
                            Cancelar
                          </button>
                        </>
                      )}
                    </div>
                  </li>
                );
              })}
            </ul>
          )}




          {/* Input para nuevo elemento con GUARDAR (verde) y CANCELAR */}
          {isAdding && !isFileLevel && (
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

          

          {/* Botón Agregar */}
          <div className="mt-4">
            <button
              onClick={handleStartAdd}
              disabled={disableAdd}
              className={`flex items-center gap-2 px-4 py-2 rounded-full text-white ${
                disableAdd ? "bg-gray-400 cursor-not-allowed" : "bg-blue-600 hover:bg-blue-700"
              }`}
            >
              <Plus size={20} />
              Agregar
            </button>
          </div>
        </div>

        {/* Footer vacío */}
        <div className="px-5 py-3 border-t flex items-center justify-end gap-2" />
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

