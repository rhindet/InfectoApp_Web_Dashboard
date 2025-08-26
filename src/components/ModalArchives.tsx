import React, { useEffect, useMemo, useState } from "react";
import { createPortal } from "react-dom";
import { Folder as FolderIcon, FolderOpen as FolderOpenIcon, Star, X } from "lucide-react";

type NodeId = string;

export type DriveNode = {
  id: NodeId;
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
  onMove: (targetFolderId: NodeId) => void;
  loadChildren: LoadChildren;
  rootId?: NodeId | null;
};

export const ModalMoveDialog: React.FC<ModalMoveDialogProps> = ({
  isOpen,
  itemName,
  currentLocationLabel = "My Drive",
  onClose,
  onMove,
  loadChildren,
  rootId = null,
}) => {
  // Hooks SIEMPRE en el mismo orden:
  const [path, setPath] = useState<{ id: NodeId | null; name: string }[]>([]);
  const [nodes, setNodes] = useState<DriveNode[]>([]);
  const [loading, setLoading] = useState(false);
  const [selectedFolder, setSelectedFolder] = useState<NodeId | null>(null);
  const [tab, setTab] = useState<"suggested" | "starred" | "all">("suggested");

  const currentParentId = useMemo(
    () => (path.length ? path[path.length - 1].id : rootId),
    [path, rootId]
  );

  useEffect(() => {
    if (!isOpen) return;
    setLoading(true);
    setSelectedFolder(null);
    loadChildren(currentParentId)
      .then(setNodes)
      .finally(() => setLoading(false));
  }, [isOpen, currentParentId, loadChildren]);

  // Reset al cerrar
  useEffect(() => {
    if (isOpen) return;
    setPath([]);
    setNodes([]);
    setSelectedFolder(null);
    setTab("suggested");
  }, [isOpen]);

  // Debe ir antes del early-return
  const filtered = useMemo(() => {
    if (tab === "starred") return nodes.filter((n) => n.starred);
    return nodes;
  }, [nodes, tab]);

  if (!isOpen) return null;

  const enterFolder = (n: DriveNode) => {
    if (n.type !== "folder") return;
    setPath((prev) => [...prev, { id: n.id, name: n.name }]);
    setSelectedFolder(n.id);
  };

  const goToIndex = (idx: number) => {
    const newPath = idx >= 0 ? path.slice(0, idx + 1) : [];
    setPath(newPath);
    setSelectedFolder(newPath.at(-1)?.id ?? null);
  };

  return createPortal(
    <div className="fixed inset-0 z-50 grid place-items-center bg-black/50" onClick={onClose} role="dialog" aria-modal="true">
      <div className="w-[720px] max-w-[95vw] max-h-[85vh] bg-white rounded-xl shadow-xl overflow-hidden" onClick={(e) => e.stopPropagation()}>
        {/* Header */}
        <div className="px-5 py-3 border-b flex items-center justify-between">
          <div className="text-sm text-gray-600">
            <div className="font-medium text-gray-900">Move “{itemName}”</div>
            <div className="flex items-center gap-1">
              <span className="text-xs text-gray-500">Current location:</span>
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
            <TabButton active={tab === "suggested"} onClick={() => setTab("suggested")}>Suggested</TabButton>
            <TabButton active={tab === "starred"} onClick={() => setTab("starred")}>
              <Star size={14} className="inline -mt-0.5 mr-1" /> Starred
            </TabButton>
            <TabButton active={tab === "all"} onClick={() => setTab("all")}>All locations</TabButton>
          </div>
        </div>

        {/* Breadcrumb */}
        <div className="px-5 pt-2 text-xs text-gray-600">
          <Breadcrumb rootLabel="My Drive" path={path} onCrumbClick={goToIndex} />
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
                  className={`flex items-center gap-3 px-3 py-2 cursor-pointer
                    ${n.type === "folder" ? "hover:bg-gray-50" : "opacity-60 cursor-not-allowed"}`}
                  onClick={() => (n.type === "folder" ? enterFolder(n) : undefined)}
                >
                  {n.type === "folder" ? (
                    <FolderIcon size={18} className="text-gray-700" />
                  ) : (
                    <FolderOpenIcon size={18} className="text-gray-300" />
                  )}
                  <span className="flex-1 text-sm">{n.name}</span>
                </li>
              ))}
            </ul>
          )}
        </div>

        {/* Footer */}
        <div className="px-5 py-3 border-t flex items-center justify-end gap-2">
          <button onClick={onClose} className="px-4 py-2 text-sm rounded border hover:bg-gray-50">Cancel</button>
          <button
            onClick={() => selectedFolder && onMove(selectedFolder)}
            disabled={!selectedFolder}
            className={`px-4 py-2 text-sm rounded text-white
              ${selectedFolder ? "bg-blue-600 hover:bg-blue-700" : "bg-gray-300 cursor-not-allowed"}`}
          >
            Move
          </button>
        </div>
      </div>
    </div>,
    document.body
  );
};

const TabButton: React.FC<{ active?: boolean; onClick?: () => void; children: React.ReactNode }> = ({ active, onClick, children }) => (
  <button
    onClick={onClick}
    className={`px-1.5 pb-2 border-b-2 -mb-px ${active ? "border-blue-600 text-blue-700" : "border-transparent text-gray-600 hover:text-gray-800"}`}
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