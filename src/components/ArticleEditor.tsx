// ArticleEditor.tsx
import React, { useEffect, useRef, useState } from "react";
import {
  Bold,
  Italic,
  Underline,
  List,
  ListOrdered,
  Save,
  X,
  Table,
  PlusCircle,
  Highlighter,
  Square,
  Type,
  ImagePlus,
  Smartphone,
  Crosshair,
  ChevronDown,
  AlignLeft,
  AlignCenter,
  AlignRight,
  AlignJustify,
  Minimize2,
  Maximize2
} from "lucide-react";
import { Article } from "../types";

interface ArticleEditorProps {
  article?: Article;
  onSave: (article: Partial<Article>) => void;
  onUpdate: (article: Partial<Article>) => void;
  onCancel: () => void;
  saving?: boolean;
}

type DragState = {
  dragging: boolean;
  pointerId: number | null;
  startX: number;
  startY: number;
  startLeft: number;
  startTop: number;
};

const clamp = (n: number, min: number, max: number) => Math.max(min, Math.min(max, n));

// ===============================
// ✅ FONT SIZE: anti-nesting helpers
// ===============================

function isFontSizeSpan(el: Element): el is HTMLSpanElement {
  if (!(el instanceof HTMLSpanElement)) return false;
  const fs = (el.style?.fontSize || "").trim();
  return Boolean(fs);
}

function unwrapElement(el: HTMLElement) {
  const parent = el.parentNode;
  if (!parent) return;
  while (el.firstChild) parent.insertBefore(el.firstChild, el);
  parent.removeChild(el);
}

function unwrapNestedFontSizeSpansWithin(container: HTMLElement) {
  const nested = Array.from(container.querySelectorAll("span[style*='font-size']")) as HTMLSpanElement[];
  // unwrap inner-to-outer
  for (let i = nested.length - 1; i >= 0; i--) {
    const s = nested[i];
    const parent = s.parentElement;
    if (parent && parent !== container && parent.closest("span[style*='font-size']")) {
      unwrapElement(s);
    }
  }
}

function mergeAdjacentFontSizeSpans(root: HTMLElement) {
  const spans = Array.from(root.querySelectorAll("span[style*='font-size']")) as HTMLSpanElement[];

  for (const s of spans) {
    if (!s.parentNode) continue;

    // if contains nested font-size spans, unwrap them first
    if (s.querySelector("span[style*='font-size']")) {
      unwrapNestedFontSizeSpansWithin(s);
    }

    // merge with next siblings if same size
    let next = s.nextSibling;
    while (next && next.nodeType === Node.TEXT_NODE && (next.textContent ?? "") === "") {
      next = next.nextSibling;
    }

    while (next instanceof HTMLSpanElement && isFontSizeSpan(next) && next.style.fontSize === s.style.fontSize) {
      while (next.firstChild) s.appendChild(next.firstChild);
      const toRemove = next;
      next = next.nextSibling;
      toRemove.remove();
    }

    if (!s.textContent?.length && !s.children.length) s.remove();
  }
}

function cleanupAllFontSizeSpans(root: HTMLElement) {
  const spans = Array.from(root.querySelectorAll("span[style*='font-size']")) as HTMLSpanElement[];
  for (const s of spans) {
    if (s.querySelector("span[style*='font-size']")) unwrapNestedFontSizeSpansWithin(s);
  }
  mergeAdjacentFontSizeSpans(root);
}

// remove any font-size spans inside a DocumentFragment
function stripFontSizeSpansFromFragment(frag: DocumentFragment) {
  const tmp = document.createElement("div");
  tmp.appendChild(frag.cloneNode(true));
  const spans = Array.from(tmp.querySelectorAll("span[style*='font-size']")) as HTMLSpanElement[];
  for (const s of spans) unwrapElement(s);

  const cleaned = document.createDocumentFragment();
  while (tmp.firstChild) cleaned.appendChild(tmp.firstChild);
  return cleaned;
}

function closestFontSizeSpanFromSelection(root: HTMLElement): HTMLSpanElement | null {
  const sel = window.getSelection();
  if (!sel || sel.rangeCount === 0) return null;
  const node = sel.getRangeAt(0).startContainer;
  const el = node.nodeType === 1 ? (node as Element) : node.parentElement;
  if (!el) return null;
  const hit = el.closest("span[style*='font-size']") as HTMLSpanElement | null;
  if (!hit) return null;
  return root.contains(hit) ? hit : null;
}

const BLOCK_TAGS = new Set(["P", "LI", "TD", "TH", "BLOCKQUOTE", "PRE"]);

function getSelectedBlocks(range: Range, root: HTMLElement): HTMLElement[] {
  const blocks = new Set<HTMLElement>();

  const startEl =
    (range.startContainer.nodeType === 1 ? (range.startContainer as Element) : range.startContainer.parentElement) as Element | null;
  const endEl =
    (range.endContainer.nodeType === 1 ? (range.endContainer as Element) : range.endContainer.parentElement) as Element | null;

  if (!startEl || !endEl) return [];

  const selector = Array.from(BLOCK_TAGS).join(",");
  const startBlock = startEl.closest(selector) as HTMLElement | null;
  const endBlock = endEl.closest(selector) as HTMLElement | null;

  if (startBlock && root.contains(startBlock)) blocks.add(startBlock);
  if (endBlock && root.contains(endBlock)) blocks.add(endBlock);

  const walker = document.createTreeWalker(root, NodeFilter.SHOW_ELEMENT, {
    acceptNode(node) {
      if (!(node instanceof HTMLElement)) return NodeFilter.FILTER_SKIP;
      if (!BLOCK_TAGS.has(node.tagName)) return NodeFilter.FILTER_SKIP;

      const r = document.createRange();
      r.selectNodeContents(node);
      const intersects =
        range.compareBoundaryPoints(Range.END_TO_START, r) < 0 &&
        range.compareBoundaryPoints(Range.START_TO_END, r) > 0;

      return intersects ? NodeFilter.FILTER_ACCEPT : NodeFilter.FILTER_SKIP;
    },
  });

  while (walker.nextNode()) blocks.add(walker.currentNode as HTMLElement);

  return Array.from(blocks);
}

// ✅ NEW: bloque actual desde selección (para alineación cuando no hay multi-bloque)
function closestBlockFromSelection(root: HTMLElement): HTMLElement | null {
  const sel = window.getSelection();
  if (!sel || sel.rangeCount === 0) return null;
  const node = sel.getRangeAt(0).startContainer;
  const el = node.nodeType === 1 ? (node as Element) : node.parentElement;
  if (!el) return null;

  const selector = Array.from(BLOCK_TAGS).join(",");
  const block = el.closest(selector) as HTMLElement | null;
  return block && root.contains(block) ? block : null;
}

const ArticleEditor: React.FC<ArticleEditorProps> = ({
  article,
  onSave,
  onCancel,
  onUpdate,
  saving = false,
}) => {  const [title, setTitle] = useState<string>(article?.tema ?? "");
  const [content, setContent] = useState<string>(article?.contenidos?.[0] ?? "");
  const contentRef = useRef<HTMLDivElement>(null);

  const [highlightColor, setHighlightColor] = useState("#FFF3CD");
  const [borderColor, setBorderColor] = useState("#000000");
  const [textColor, setTextColor] = useState("#000000");


  // ===============================
  // ✅ IMAGE RESIZE (affects preview + saved html)
  // ===============================
  const [imgToolOpen, setImgToolOpen] = useState(false);
  const [imgToolPos, setImgToolPos] = useState<{ left: number; top: number }>({ left: 0, top: 0 });
  const [imgW, setImgW] = useState<string>(""); // px o %
  const [imgH, setImgH] = useState<string>(""); // px
  const selectedImgRef = useRef<HTMLImageElement | null>(null);
  const imgToolRef = useRef<HTMLDivElement>(null);


  // ✅ Tamaño actual (px)
  const [fontSizePx, setFontSizePx] = useState<number>(14);
  // ✅ Input controlado como texto para permitir escribir "cualquier número"
  const [fontSizeInput, setFontSizeInput] = useState<string>("14");

  const lastRangeRef = useRef<Range | null>(null);
  // ✅ Range que se usa específicamente para acciones del toolbar (input tamaño / dropdown)
  const sizeRangeRef = useRef<Range | null>(null);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const fontSizeInputRef = useRef<HTMLInputElement>(null);

  // ✅ Dropdown sizes estilo Word
  const [sizeMenuOpen, setSizeMenuOpen] = useState(false);
  const sizeMenuRef = useRef<HTMLDivElement>(null);
  const SIZES = [8, 9, 10, 11, 12, 14, 16, 18, 20, 22, 24, 26, 28, 36, 48, 72];

  // ✅ Preview (celular flotante)
  const [previewOpen, setPreviewOpen] = useState(false);
  const [previewTitle, setPreviewTitle] = useState("");
  const [previewHtml, setPreviewHtml] = useState("");

  // posición del panel flotante
  const [previewPos, setPreviewPos] = useState<{ left: number; top: number }>({ left: 24, top: 120 });
  const dragRef = useRef<DragState>({
    dragging: false,
    pointerId: null,
    startX: 0,
    startY: 0,
    startLeft: 0,
    startTop: 0,
  });

  const PHONE_W = 380;
  const PHONE_H = 720;

  function parseStyleSize(value: string | null | undefined) {
    const v = (value || "").trim();
    if (!v) return "";
    return v;
  }

  function readImgInlineSizes(img: HTMLImageElement) {
    // Lee inline style (lo que guardas)
    const w = parseStyleSize(img.style.width);
    const h = parseStyleSize(img.style.height);
    setImgW(w.replace("px", "")); // mostramos sin px si es px
    setImgH(h.replace("px", ""));
  }

  function openImgToolFor(img: HTMLImageElement) {
    const root = contentRef.current;
    if (!root) return;

    selectedImgRef.current = img;
    readImgInlineSizes(img);

    // Posición del panel: relativo al editor
    const rImg = img.getBoundingClientRect();
    const rRoot = root.getBoundingClientRect();

    const left = Math.max(8, rImg.left - rRoot.left);
    const top = Math.max(8, rImg.top - rRoot.top - 44); // arriba de la imagen

    setImgToolPos({ left, top });
    setImgToolOpen(true);
  }

  function closeImgTool() {
    setImgToolOpen(false);
    selectedImgRef.current = null;
  }

  function applyImgSize() {
    const img = selectedImgRef.current;
    if (!img) return;

    // Normaliza entradas
    const wRaw = (imgW || "").trim();
    const hRaw = (imgH || "").trim();

    // width: puede ser "300" -> 300px o "60%" -> 60%
    if (!wRaw) {
      img.style.width = "";
    } else if (wRaw.endsWith("%")) {
      img.style.width = wRaw;
    } else {
      const n = Number(wRaw);
      img.style.width = Number.isFinite(n) && n > 0 ? `${Math.round(n)}px` : "";
    }

    // height: solo px (si lo dejas vacío -> auto)
    if (!hRaw) {
      img.style.height = "auto";
    } else {
      const n = Number(hRaw);
      img.style.height = Number.isFinite(n) && n > 0 ? `${Math.round(n)}px` : "auto";
    }

    // Mantén tus constraints existentes
    img.style.maxWidth = "100%";
    img.style.objectFit = img.style.objectFit || "contain";

    handleContentChange(); // ✅ esto actualiza state => preview y guardado
  }

  function resetImgSize() {
    const img = selectedImgRef.current;
    if (!img) return;
    img.style.width = "";
    img.style.height = "auto";
    img.style.maxWidth = "100%";
    img.style.objectFit = "contain";
    setImgW("");
    setImgH("");
    handleContentChange();
  }

  function setImgPercent(pct: number) {
    setImgW(`${pct}%`);
    setImgH(""); // auto
    requestAnimationFrame(() => applyImgSize());
  }

  const rememberRangeIfInside = () => {
    const el = contentRef.current;
    const sel = window.getSelection();
    if (!el || !sel || sel.rangeCount === 0) return;
    const range = sel.getRangeAt(0);
    if (el.contains(range.startContainer) && el.contains(range.endContainer)) {
      lastRangeRef.current = range.cloneRange();
    }
  };

  const restoreRange = (rangeOverride?: Range | null) => {
    const el = contentRef.current;
    const sel = window.getSelection();
    if (!el || !sel) return false;
    const r = rangeOverride ?? lastRangeRef.current;
    if (r) {
      el.focus();
      sel.removeAllRanges();
      sel.addRange(r);
      return true;
    }
    return false;
  };

  const placeCaretAtEnd = (el: HTMLElement) => {
    const range = document.createRange();
    range.selectNodeContents(el);
    range.collapse(false);
    const sel = window.getSelection();
    sel?.removeAllRanges();
    sel?.addRange(range);
  };

  const normalizeTopLevelToParagraphs = () => {
    const root = contentRef.current;
    if (!root) return;

    rememberRangeIfInside();

    let node: ChildNode | null = root.firstChild;
    let currentP: HTMLParagraphElement | null = null;

    const isBlockKeep = (el: HTMLElement) => ["P", "UL", "OL", "TABLE", "PRE", "BLOCKQUOTE"].includes(el.tagName);

    while (node) {
      const next = node.nextSibling;

      if (node.nodeType === Node.TEXT_NODE) {
        const txtNode = node as Text;
        if (!currentP) {
          currentP = document.createElement("p");
          root.insertBefore(currentP, txtNode);
        }
        currentP.appendChild(txtNode);
      } else if (node.nodeType === Node.ELEMENT_NODE) {
        const el = node as HTMLElement;
        const tag = el.tagName;

        if (tag === "BR") {
          if (!currentP) {
            currentP = document.createElement("p");
            root.insertBefore(currentP, el);
          }
          currentP.appendChild(el);
        } else if (["DIV", "H1", "H2", "H3", "H4", "H5", "H6"].includes(tag)) {
          const p = document.createElement("p");

          // ✅ NEW: preservar alineación
          const ta = (el.style?.textAlign || "").trim();
          if (ta) p.style.textAlign = ta;

          while (el.firstChild) p.appendChild(el.firstChild);
          root.replaceChild(p, el);
          currentP = null;
        } else if (isBlockKeep(el)) {
          currentP = null;
        } else {
          if (!currentP) {
            currentP = document.createElement("p");
            root.insertBefore(currentP, el);
          }
          currentP.appendChild(el);
        }
      }

      node = next;
    }

    if (root.childElementCount === 0) {
      const p = document.createElement("p");
      p.innerHTML = "<br>";
      root.appendChild(p);
    }

    restoreRange();
  };

  useEffect(() => {
    const root = contentRef.current;
    if (!root) return;

    const onClick = (e: MouseEvent) => {
      const t = e.target as HTMLElement | null;
      if (!t) return;

      // Click dentro del panel => no cerrar
      if (imgToolRef.current && imgToolRef.current.contains(t)) return;

      // Click sobre imagen => abrir panel
      if (t.tagName === "IMG") {
        openImgToolFor(t as HTMLImageElement);
        return;
      }

      // Click fuera => cerrar
      if (imgToolOpen) closeImgTool();
    };

    root.addEventListener("click", onClick);
    return () => root.removeEventListener("click", onClick);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [imgToolOpen]);

  useEffect(() => {
    setTitle(article?.tema ?? "");
    const initial = article?.contenidos?.[0] ?? "";
    setContent(initial);
    if (contentRef.current) {
      contentRef.current.innerHTML = initial || "<p><br></p>";
      normalizeTopLevelToParagraphs();
    }
    try {
      document.execCommand("defaultParagraphSeparator", false, "p");
    } catch { }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [article]);

  useEffect(() => {
    const el = contentRef.current;
    if (!el) return;
    const onKeyUp = () => rememberRangeIfInside();
    const onMouseUp = () => rememberRangeIfInside();
    const onSelChange = () => rememberRangeIfInside();
    el.addEventListener("keyup", onKeyUp);
    el.addEventListener("mouseup", onMouseUp);
    document.addEventListener("selectionchange", onSelChange);
    return () => {
      el.removeEventListener("keyup", onKeyUp);
      el.removeEventListener("mouseup", onMouseUp);
      document.removeEventListener("selectionchange", onSelChange);
    };
  }, []);

  // cerrar dropdown size al click fuera / ESC
  useEffect(() => {
    const onDown = (e: MouseEvent) => {
      if (!sizeMenuOpen) return;
      const target = e.target as Node;
      if (sizeMenuRef.current && !sizeMenuRef.current.contains(target)) {
        setSizeMenuOpen(false);
      }
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setSizeMenuOpen(false);
    };
    document.addEventListener("mousedown", onDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [sizeMenuOpen]);

const handleContentChange = () => {
  normalizeTopLevelToParagraphs();
  if (contentRef.current) {
    cleanupAllFontSizeSpans(contentRef.current);
    cleanupAllColorSpans(contentRef.current);
    setContent(contentRef.current.innerHTML);
  }
};

  function getSingleSelectedFontSizeSpan(range: Range, root: HTMLElement): HTMLSpanElement | null {
    // Caso 1: selección exacta de un nodo <span style="font-size:...">
    const a = range.startContainer;
    const b = range.endContainer;

    if (a === b && range.startContainer.nodeType === Node.ELEMENT_NODE) {
      const el = range.startContainer as Element;
      const child = el.childNodes[range.startOffset];
      if (child instanceof HTMLSpanElement && isFontSizeSpan(child) && root.contains(child)) return child;
    }

    // Caso 2: selection dentro del mismo font-size span (aunque sea selection parcial)
    const startEl = (range.startContainer.nodeType === 1 ? (range.startContainer as Element) : range.startContainer.parentElement) as
      | Element
      | null;
    const endEl = (range.endContainer.nodeType === 1 ? (range.endContainer as Element) : range.endContainer.parentElement) as
      | Element
      | null;

    if (!startEl || !endEl) return null;

    const s1 = startEl.closest("span[style*='font-size']") as HTMLSpanElement | null;
    const s2 = endEl.closest("span[style*='font-size']") as HTMLSpanElement | null;

    if (s1 && s1 === s2 && root.contains(s1)) return s1;

    return null;
  }

  const formatText = (command: string, value?: string) => {
    const el = contentRef.current;
    if (!el) return;
    el.focus();
    if (!restoreRange()) placeCaretAtEnd(el);

    document.execCommand(command, false, value);

    if (command === "insertUnorderedList" || command === "insertOrderedList") {
      ensureListStyles();
      setTimeout(() => normalizeParagraphAfterList(), 0);
    }

    normalizeTopLevelToParagraphs();
    handleContentChange();
  };

  const ensureListStyles = () => {
    const sel = window.getSelection();
    if (!sel || sel.rangeCount === 0) return;
    let node: Node | null = sel.getRangeAt(0).startContainer;

    while (node && node !== contentRef.current) {
      if (node instanceof HTMLElement && (node.tagName === "UL" || node.tagName === "OL")) {
        const isOl = node.tagName === "OL";
        if (!node.getAttribute("style")) {
          node.setAttribute(
            "style",
            `${isOl ? "list-style: decimal;" : "list-style: disc;"} padding-left: 1.25rem; margin: 0.5rem 0;`
          );
        }
        node.querySelectorAll("li").forEach((li) => {
          if (!(li as HTMLElement).innerHTML.trim()) (li as HTMLElement).innerHTML = "&nbsp;";
        });
        break;
      }
      node = node.parentNode as Node | null;
    }
  };

  const normalizeParagraphAfterList = () => {
    const sel = window.getSelection();
    if (!sel || sel.rangeCount === 0) return;
    let node: Node | null = sel.getRangeAt(0).startContainer;

    while (node && node !== contentRef.current) {
      if (node instanceof HTMLElement && node.tagName === "P") {
        (node as HTMLElement).style.marginLeft = "0";
        (node as HTMLElement).style.paddingLeft = "0";
        (node as HTMLElement).style.textIndent = "0";
        break;
      }
      node = node.parentNode as Node | null;
    }
  };

  function escapeHtml(s: string) {
    return s
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#39;");
  }

  const handlePaste = async (e: React.ClipboardEvent<HTMLDivElement>) => {
    e.preventDefault();
    const text = e.clipboardData?.getData("text/plain") ?? "";
    const el = contentRef.current;
    if (!el) return;
    el.focus();
    if (!restoreRange()) placeCaretAtEnd(el);
    if (text) {
      document.execCommand("insertText", false, text);
      normalizeTopLevelToParagraphs();
      handleContentChange();
    }
  };

  const handleDrop = async (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    const text = e.dataTransfer.getData("text/plain") || "";
    if (text) {
      const el = contentRef.current;
      if (!el) return;
      el.focus();
      if (!restoreRange()) placeCaretAtEnd(el);
      document.execCommand("insertText", false, text);
      normalizeTopLevelToParagraphs();
      handleContentChange();
    }
  };

  function linkifyPlainUrls(html: string): string {
  if (!html) return html;

  const protectedBlocks: string[] = [];
  let protectedHtml = html;

  // Proteger bloques donde NO debemos tocar texto
  const blockRegex =
    /(<a\b[^>]*>[\s\S]*?<\/a>)|(<img\b[^>]*>)|(<script\b[^>]*>[\s\S]*?<\/script>)|(<style\b[^>]*>[\s\S]*?<\/style>)|(<code\b[^>]*>[\s\S]*?<\/code>)|(<pre\b[^>]*>[\s\S]*?<\/pre>)/gi;

  protectedHtml = protectedHtml.replace(blockRegex, (match) => {
    const token = `___HTML_BLOCK_${protectedBlocks.length}___`;
    protectedBlocks.push(match);
    return token;
  });

  // Separar tags de texto para no tocar atributos HTML
  const parts = protectedHtml.split(/(<[^>]+>)/g);

  // Detecta:
  // - http://...
  // - https://...
  // - www....
  // - dominio.com/ruta
  const urlRegex =
    /((?:https?:\/\/|www\.)[^\s<]+|(?:[a-zA-Z0-9-]+\.)+[a-zA-Z]{2,}(?:\/[^\s<]*)?)/gi;

  for (let i = 0; i < parts.length; i++) {
    const part = parts[i];

    // Si es tag, no tocar
    if (part.startsWith("<") && part.endsWith(">")) continue;

    parts[i] = part.replace(urlRegex, (rawUrl) => {
      let url = rawUrl;
      let trailing = "";

      // quitar puntuación final común
      while (/[.,;!?]+$/.test(url)) {
        trailing = url[url.length - 1] + trailing;
        url = url.slice(0, -1);
      }

      const lower = url.toLowerCase();
      const href =
        lower.startsWith("http://") || lower.startsWith("https://")
          ? url
          : `https://${url}`;

      return `<a href="${href}" target="_blank" rel="noopener noreferrer">${url}</a>${trailing}`;
    });
  }

  protectedHtml = parts.join("");

  // Restaurar bloques protegidos
  for (let i = 0; i < protectedBlocks.length; i++) {
    protectedHtml = protectedHtml.replace(`___HTML_BLOCK_${i}___`, protectedBlocks[i]);
  }

  return protectedHtml;
}


  function cleanHtml(dirty: string): string {
    if (!dirty) return "";
    const raw = dirty.replace(/\uFEFF/g, "").trim();
    const parser = new DOMParser();
    const doc = parser.parseFromString(`<div id="root">${raw}</div>`, "text/html");
    const root = doc.getElementById("root") as HTMLElement;
    if (!root) return raw;

    doc.querySelectorAll("meta, title, style, script, link").forEach((n) => n.remove());

    root.querySelectorAll("h1, h2, h3").forEach((h) => {
      if (h === root.firstElementChild && h === root.lastElementChild) {
        const frag = doc.createDocumentFragment();
        while (h.firstChild) frag.appendChild(h.firstChild);
        h.replaceWith(frag);
      }
    });

root.querySelectorAll("x-border").forEach((el) => {
  const style = el.getAttribute("style") || "";
  const borderColorMatch = style.match(/border-color\s*:\s*([^;]+)/i);
  const borderColor = borderColorMatch?.[1]?.trim() || "#000";
  el.setAttribute("style", `border-color:${borderColor};`);
});

    root.querySelectorAll<HTMLElement>("*").forEach((el) => {
      if (el.className && /(^|\s)Mso[\w-]*/i.test(el.className)) el.removeAttribute("class");

      if (el.hasAttribute("style")) {
        const css = el.getAttribute("style") || "";
        const cleaned = css
          .split(";")
          .map((s) => s.trim())
          .filter((s) => s && !s.startsWith("--tw-"))
          .join("; ");
        if (cleaned) el.setAttribute("style", cleaned);
        else el.removeAttribute("style");
      }

      if (el.tagName === "SPAN" && el.textContent?.trim() === "" && !el.children.length) el.remove();
    });

    root.querySelectorAll("ul, ol").forEach((list) => {
      if (!list.querySelector("li")) list.remove();
    });

    root.querySelectorAll("img[src]").forEach((img: Element) => {
      const src = (img as HTMLImageElement).getAttribute("src") || "";
      if (/^javascript:/i.test(src)) (img as HTMLElement).remove();
    });

    root.innerHTML = root.innerHTML
      .replace(/(&nbsp;|\s)+<\/(p|li)>/gi, "</$2>")
      .replace(/(<p>\s*<\/p>)+/gi, "<p><br></p>");

    const tempHost = document.createElement("div");
    tempHost.innerHTML = root.innerHTML;
    const top = tempHost;

    let node: ChildNode | null = top.firstChild;
    let currentP: HTMLParagraphElement | null = null;

    const isBlockKeep = (el: HTMLElement) => ["P", "UL", "OL", "TABLE", "PRE", "BLOCKQUOTE"].includes(el.tagName);

    while (node) {
      const next = node.nextSibling;

      if (node.nodeType === Node.TEXT_NODE) {
        const txt = node.textContent ?? "";
        if (txt.trim() === "") {
          top.removeChild(node);
        } else {
          if (!currentP) {
            currentP = document.createElement("p");
            top.insertBefore(currentP, node);
          }
          currentP.appendChild(node);
        }
      } else if (node.nodeType === Node.ELEMENT_NODE) {
        const el = node as HTMLElement;
        const tag = el.tagName;

        if (tag === "BR") {
          if (!currentP) {
            currentP = document.createElement("p");
            top.insertBefore(currentP, el);
          }
          currentP.appendChild(el);
        } else if (["DIV", "H1", "H2", "H3", "H4", "H5", "H6"].includes(tag)) {
          const p = document.createElement("p");

          // ✅ NEW: preservar alineación
          const ta = (el.style?.textAlign || "").trim();
          if (ta) p.style.textAlign = ta;

          while (el.firstChild) p.appendChild(el.firstChild);
          top.replaceChild(p, el);
          currentP = null;
        } else if (isBlockKeep(el)) {
          currentP = null;
        } else {
          if (!currentP) {
            currentP = document.createElement("p");
            top.insertBefore(currentP, el);
          }
          currentP.appendChild(el);
        }
      }

      node = next;
    }

    top.querySelectorAll("p").forEach((p) => {
      const onlyWhitespace = !(p.textContent ?? "").trim();
      const noChildren = p.children.length === 0;
      if (onlyWhitespace && noChildren) p.innerHTML = "<br>";
    });

    return top.innerHTML.trim();
  }

function addFlutterSpanAttrs(html: string): string {
  if (!html) return html;
  const parser = new DOMParser();
  const doc = parser.parseFromString(`<div id="root">${html}</div>`, "text/html");
  const root = doc.getElementById("root") as HTMLElement;
  if (!root) return html;

  root.querySelectorAll("span[style]").forEach((span) => {
    const style = (span.getAttribute("style") || "").toLowerCase();
    if (style.includes("background-color") && !span.hasAttribute("data-highlight")) {
      span.setAttribute("data-highlight", "1");
    }
  });

  return root.innerHTML;
}

const applyTextColor = () => {
  rememberRangeIfInside();
  applyTextColorToSelection(textColor, lastRangeRef.current);
};

  // ✅ NEW: Alineación por bloque (p/li/td/th/etc) + JUSTIFY
  type AlignMode = "left" | "center" | "right" | "justify";
  const applyAlignment = (mode: AlignMode) => {
    const el = contentRef.current;
    if (!el) return;

    el.focus();
    if (!restoreRange()) placeCaretAtEnd(el);

    const sel = window.getSelection();
    if (!sel || sel.rangeCount === 0) return;

    const range = sel.getRangeAt(0);
    const blocks = getSelectedBlocks(range, el);

    const cssAlign = mode === "left" ? "left" : mode === "center" ? "center" : mode === "right" ? "right" : "justify";

    if (blocks.length > 0) {
      blocks.forEach((b) => {
        b.style.textAlign = cssAlign;
      });
      handleContentChange();
      return;
    }

    const current = closestBlockFromSelection(el);
    if (current) {
      current.style.textAlign = cssAlign;
      handleContentChange();
      return;
    }

    el.style.textAlign = cssAlign;
    handleContentChange();
  };

  // ✅ aplica tamaño y DEVUELVE el range resultante (para seguir aplicando sobre el mismo texto)
  // ✅ FIX: no anida spans -> sobreescribe o envuelve limpio
  const applyFontSizePx = (px: number, rangeOverride?: Range | null): Range | null => {
    const el = contentRef.current;
    if (!el) return null;

    const size = clamp(px, 1, 500);

    // intenta restaurar selección: prioridad rangeOverride -> lastRange
    if (!restoreRange(rangeOverride ?? null)) {
      if (!restoreRange()) placeCaretAtEnd(el);
    }

    const sel = window.getSelection();
    if (!sel || sel.rangeCount === 0) return null;

    const range = sel.getRangeAt(0);

    // ✅ MULTI-BLOCK selection (varios <p>/<li>/etc):
    // No envuelvas todo con <span> (inválido). Aplica por bloque.
    const blocks = getSelectedBlocks(range, el);
    if (blocks.length > 1) {
      blocks.forEach((b) => {
        // comportamiento "Word": el tamaño nuevo manda
        b.style.fontSize = `${size}px`;

        // opcional pero recomendado: elimina font-size internos para que no "ganen"
        b.querySelectorAll("span[style*='font-size']").forEach((s) => {
          (s as HTMLElement).style.fontSize = "";
          // si el style queda vacío, límpialo
          const st = (s as HTMLElement).getAttribute("style") || "";
          const cleaned = st
            .split(";")
            .map((x) => x.trim())
            .filter((x) => x && !/^font-size\s*:/i.test(x))
            .join("; ");
          if (cleaned) (s as HTMLElement).setAttribute("style", cleaned);
          else (s as HTMLElement).removeAttribute("style");
        });
      });

      cleanupAllFontSizeSpans(el);
      handleContentChange();
      return range.cloneRange();
    }

    // ✅ COLLAPSED: si estás dentro de un font-size span, solo cambia ese span
    if (range.collapsed) {
      const currentSpan = closestFontSizeSpanFromSelection(el);
      if (currentSpan) {
        currentSpan.style.fontSize = `${size}px`;
        unwrapNestedFontSizeSpansWithin(currentSpan);
        cleanupAllFontSizeSpans(el);
        handleContentChange();
        const sel2 = window.getSelection();
        return sel2 && sel2.rangeCount ? sel2.getRangeAt(0).cloneRange() : null;
      }

      // si no estás dentro de span, inserta uno con ZWSP (marcador)
      document.execCommand("insertHTML", false, `<span style="font-size:${size}px;">\u200B</span>`);
      normalizeTopLevelToParagraphs();
      cleanupAllFontSizeSpans(el);
      handleContentChange();

      const sel2 = window.getSelection();
      return sel2 && sel2.rangeCount ? sel2.getRangeAt(0).cloneRange() : null;
    }

    // ✅ NON-COLLAPSED: si ya es UN span con font-size seleccionado -> solo cambia ese span
    const single = getSingleSelectedFontSizeSpan(range, el);
    if (single) {
      single.style.fontSize = `${size}px`;
      unwrapNestedFontSizeSpansWithin(single);
      cleanupAllFontSizeSpans(el);
      handleContentChange();

      // Mantén seleccionado el contenido del mismo span
      sel.removeAllRanges();
      const r2 = document.createRange();
      r2.selectNodeContents(single);
      sel.addRange(r2);
      return r2.cloneRange();
    }

    // ✅ Caso general: wrap limpio
    const extracted = range.extractContents();
    const cleanedFrag = stripFontSizeSpansFromFragment(extracted);

    const wrapper = document.createElement("span");
    wrapper.style.fontSize = `${size}px`;
    wrapper.appendChild(cleanedFrag);

    range.insertNode(wrapper);

    // 🔥 Si el wrapper quedó dentro de otro font-size span, NO anides: sube el estilo al padre y unwrap
    const parentFs = wrapper.parentElement?.closest("span[style*='font-size']") as HTMLSpanElement | null;
    if (parentFs && parentFs !== wrapper) {
      parentFs.style.fontSize = `${size}px`;
      unwrapElement(wrapper);
      unwrapNestedFontSizeSpansWithin(parentFs);
    } else {
      unwrapNestedFontSizeSpansWithin(wrapper);
    }

    sel.removeAllRanges();
    const newRange = document.createRange();
    newRange.selectNodeContents(parentFs ?? wrapper);
    sel.addRange(newRange);

    normalizeTopLevelToParagraphs();
    cleanupAllFontSizeSpans(el);
    handleContentChange();

    return newRange.cloneRange();
  };

const applyTextColorToSelection = (color: string, rangeOverride?: Range | null): Range | null => {
  const el = contentRef.current;
  if (!el) return null;

  if (!restoreRange(rangeOverride ?? null)) {
    if (!restoreRange()) placeCaretAtEnd(el);
  }

  const sel = window.getSelection();
  if (!sel || sel.rangeCount === 0) return null;

  const range = sel.getRangeAt(0);

  // MULTI-BLOCK: aplica color por bloque
  const blocks = getSelectedBlocks(range, el);
  if (blocks.length > 1) {
    blocks.forEach((b) => {
      b.style.color = color;

      b.querySelectorAll("span[style*='color']").forEach((s) => {
        (s as HTMLElement).style.color = "";
        const st = (s as HTMLElement).getAttribute("style") || "";
        const cleaned = st
          .split(";")
          .map((x) => x.trim())
          .filter((x) => x && !/^color\s*:/i.test(x))
          .join("; ");
        if (cleaned) (s as HTMLElement).setAttribute("style", cleaned);
        else (s as HTMLElement).removeAttribute("style");
      });
    });

    cleanupAllColorSpans(el);
    handleContentChange();
    return range.cloneRange();
  }

  // COLLAPSED
  if (range.collapsed) {
    const currentSpan = closestColorSpanFromSelection(el);
    if (currentSpan) {
      currentSpan.style.color = color;
      unwrapNestedColorSpansWithin(currentSpan);
      cleanupAllColorSpans(el);
      handleContentChange();

      const sel2 = window.getSelection();
      return sel2 && sel2.rangeCount ? sel2.getRangeAt(0).cloneRange() : null;
    }

    document.execCommand("insertHTML", false, `<span style="color:${color};">\u200B</span>`);
    normalizeTopLevelToParagraphs();
    cleanupAllColorSpans(el);
    handleContentChange();

    const sel2 = window.getSelection();
    return sel2 && sel2.rangeCount ? sel2.getRangeAt(0).cloneRange() : null;
  }

  // NON-COLLAPSED: si ya es un mismo span, solo cambiarlo
  const single = getSingleSelectedColorSpan(range, el);
  if (single) {
    single.style.color = color;
    unwrapNestedColorSpansWithin(single);
    cleanupAllColorSpans(el);
    handleContentChange();

    sel.removeAllRanges();
    const r2 = document.createRange();
    r2.selectNodeContents(single);
    sel.addRange(r2);
    return r2.cloneRange();
  }

  // Caso general: wrap limpio
  const extracted = range.extractContents();
  const cleanedFrag = stripColorSpansFromFragment(extracted);

  const wrapper = document.createElement("span");
  wrapper.style.color = color;
  wrapper.appendChild(cleanedFrag);

  range.insertNode(wrapper);

  const parentColor = wrapper.parentElement?.closest("span[style*='color']") as HTMLSpanElement | null;
  if (parentColor && parentColor !== wrapper) {
    parentColor.style.color = color;
    unwrapElement(wrapper);
    unwrapNestedColorSpansWithin(parentColor);
  } else {
    unwrapNestedColorSpansWithin(wrapper);
  }

  sel.removeAllRanges();
  const newRange = document.createRange();
  newRange.selectNodeContents(parentColor ?? wrapper);
  sel.addRange(newRange);

  normalizeTopLevelToParagraphs();
  cleanupAllColorSpans(el);
  handleContentChange();

  return newRange.cloneRange();
};


  // ✅ aplica tamaño desde toolbar SIN perder el cursor del input (puedes seguir tecleando)
  const applySizeFromToolbar = (n: number) => {
    const input = fontSizeInputRef.current;
    const start = input?.selectionStart ?? null;
    const end = input?.selectionEnd ?? null;

    const baseRange = sizeRangeRef.current ?? lastRangeRef.current ?? null;
    const nextRange = applyFontSizePx(n, baseRange);
    if (nextRange) sizeRangeRef.current = nextRange.cloneRange();

    requestAnimationFrame(() => {
      if (!input) return;
      input.focus();
      if (start !== null && end !== null) {
        try {
          input.setSelectionRange(start, end);
        } catch { }
      }
    });
  };

  const insertTable = (rows = 2, cols = 2, withHeader = true) => {
    const el = contentRef.current;
    if (!el) return;

    el.focus();
    if (!restoreRange()) placeCaretAtEnd(el);

    rows = clamp(rows, 1, 20);
    cols = clamp(cols, 1, 20);

    const makeCells = (count: number, tag: "th" | "td") =>
      Array.from({ length: count })
        .map(() => `<${tag}> </${tag}>`)
        .join("");

    const thead = withHeader ? `<thead><tr>${makeCells(cols, "th")}</tr></thead>` : "";
    const bodyRows = Array.from({ length: rows })
      .map(() => `<tr>${makeCells(cols, "td")}</tr>`)
      .join("");

    const tableHtml = `
      <table style="border-collapse:collapse; width:100%; margin:8px 0;">
        ${thead}
        <tbody>${bodyRows}</tbody>
      </table>
      <p><br></p>
    `.trim();

    document.execCommand("insertHTML", false, tableHtml);

    const selection = window.getSelection();
    if (selection && el.lastChild instanceof HTMLElement) {
      placeCaretAtEnd(el.lastChild as HTMLElement);
    }

    normalizeTopLevelToParagraphs();
    handleContentChange();
  };

  const isEditing = Boolean(article?._id);

  const handleSave = () => {
    const tema = title.trim();
    const htmlRaw = (contentRef.current?.innerHTML ?? "").trim();
    if (!tema || !htmlRaw) return;

    const html = cleanHtml(htmlRaw);

    if (isEditing) {
      onUpdate({ _id: article?._id, tema, contenidos: [html] });
      return;
    }
    onSave({ _id: article?._id, tema, contenidos: [html] });
  };

  const [tableModalOpen, setTableModalOpen] = useState(false);
  const [tableRows, setTableRows] = useState(2);
  const [tableCols, setTableCols] = useState(2);
  const [tableHeader, setTableHeader] = useState(true);

  const openTableModal = () => {
    rememberRangeIfInside();
    setTableModalOpen(true);
  };
  const closeTableModal = () => setTableModalOpen(false);
  const confirmInsertTable = () => {
    insertTable(tableRows, tableCols, tableHeader);
    closeTableModal();
  };

  function toRgbString(input: string): string {
    const tmp = document.createElement("span");
    tmp.style.backgroundColor = input;
    document.body.appendChild(tmp);
    const rgb = getComputedStyle(tmp).backgroundColor;
    document.body.removeChild(tmp);
    return rgb;
  }

  function forEachElementInRange(range: Range, root: HTMLElement, cb: (el: HTMLElement) => void) {
    const common = range.commonAncestorContainer;
    const walker = document.createTreeWalker(
      (common.nodeType === 1 ? common : (common.parentElement as Element)) as Element,
      NodeFilter.SHOW_ELEMENT,
      null
    );
    let node: Node | null = walker.currentNode;
    while ((node = walker.nextNode())) {
      const el = node as HTMLElement;
      if (!root.contains(el)) continue;
      const nodeRange = document.createRange();
      nodeRange.selectNodeContents(el);
      const intersects =
        range.compareBoundaryPoints(Range.END_TO_START, nodeRange) < 0 &&
        range.compareBoundaryPoints(Range.START_TO_END, nodeRange) > 0;
      if (intersects) cb(el);
    }
  }

  const toggleHighlight = () => {
    const el = contentRef.current;
    if (!el) return;
    el.focus();
    if (!restoreRange()) placeCaretAtEnd(el);

    const sel = window.getSelection();
    if (!sel || sel.rangeCount === 0) return;
    const range = sel.getRangeAt(0);

    if (range.collapsed) {
      document.execCommand("backColor", false, highlightColor);
      handleContentChange();
      return;
    }

    const targetRgb = toRgbString(highlightColor);
    const currentCmdVal = document.queryCommandValue("hiliteColor") || document.queryCommandValue("backColor") || "";
    const currentRgb = currentCmdVal ? toRgbString(currentCmdVal) : "";
    const shouldRemove = currentRgb && currentRgb === targetRgb;

    if (!shouldRemove) {
      document.execCommand("backColor", false, highlightColor);
      handleContentChange();
      return;
    }

    forEachElementInRange(range, el, (node) => {
      const bg = getComputedStyle(node).backgroundColor;
      if (bg && toRgbString(bg) === targetRgb) {
        const style = node.getAttribute("style") || "";
        if (style.includes("background-color")) {
          const cleaned = style
            .split(";")
            .map((s) => s.trim())
            .filter((s) => s && !/^background-color\s*:/i.test(s))
            .join("; ");
          if (cleaned) node.setAttribute("style", cleaned);
          else node.removeAttribute("style");
        }
      }
    });

    document.execCommand("backColor", false, "transparent");
    handleContentChange();
  };

  const insertImageAtSelection = (src: string, alt = "") => {
    const el = contentRef.current;
    if (!el) return;
    el.focus();
    if (!restoreRange()) placeCaretAtEnd(el);

    const imgHtml = `<img src="${src}" alt="${escapeHtml(alt)}" style="max-width:100%;height:auto;" />`;
    document.execCommand("insertHTML", false, `<p>${imgHtml}</p><p><br></p>`);
    normalizeTopLevelToParagraphs();
    handleContentChange();

    // ✅ NEW: abrir tool en la última imagen insertada
    requestAnimationFrame(() => {
      const imgs = el.querySelectorAll("img");
      const last = imgs[imgs.length - 1] as HTMLImageElement | undefined;
      if (last) openImgToolFor(last);
    });
  };

  const readFileAsDataURL = (file: File) =>
    new Promise<string>((resolve, reject) => {
      const r = new FileReader();
      r.onload = () => resolve(r.result as string);
      r.onerror = reject;
      r.readAsDataURL(file);
    });
function isColorSpan(el: Element): el is HTMLSpanElement {
  if (!(el instanceof HTMLSpanElement)) return false;
  const c = (el.style?.color || "").trim();
  return Boolean(c);
}

function closestColorSpanFromSelection(root: HTMLElement): HTMLSpanElement | null {
  const sel = window.getSelection();
  if (!sel || sel.rangeCount === 0) return null;

  const node = sel.getRangeAt(0).startContainer;
  const el = node.nodeType === 1 ? (node as Element) : node.parentElement;
  if (!el) return null;

  const hit = el.closest("span[style*='color']") as HTMLSpanElement | null;
  if (!hit) return null;
  return root.contains(hit) ? hit : null;
}

function unwrapNestedColorSpansWithin(container: HTMLElement) {
  const nested = Array.from(
    container.querySelectorAll("span[style*='color']")
  ) as HTMLSpanElement[];

  for (let i = nested.length - 1; i >= 0; i--) {
    const s = nested[i];
    const parent = s.parentElement;
    if (parent && parent !== container && parent.closest("span[style*='color']")) {
      unwrapElement(s);
    }
  }
}

function mergeAdjacentColorSpans(root: HTMLElement) {
  const spans = Array.from(root.querySelectorAll("span[style*='color']")) as HTMLSpanElement[];

  for (const s of spans) {
    if (!s.parentNode) continue;

    if (s.querySelector("span[style*='color']")) {
      unwrapNestedColorSpansWithin(s);
    }

    let next = s.nextSibling;
    while (next && next.nodeType === Node.TEXT_NODE && (next.textContent ?? "") === "") {
      next = next.nextSibling;
    }

    while (
      next instanceof HTMLSpanElement &&
      isColorSpan(next) &&
      next.style.color === s.style.color
    ) {
      while (next.firstChild) s.appendChild(next.firstChild);
      const toRemove = next;
      next = next.nextSibling;
      toRemove.remove();
    }

    if (!s.textContent?.length && !s.children.length) s.remove();
  }
}

function cleanupAllColorSpans(root: HTMLElement) {
  const spans = Array.from(root.querySelectorAll("span[style*='color']")) as HTMLSpanElement[];
  for (const s of spans) {
    if (s.querySelector("span[style*='color']")) unwrapNestedColorSpansWithin(s);
  }
  mergeAdjacentColorSpans(root);
}

function stripColorSpansFromFragment(frag: DocumentFragment) {
  const tmp = document.createElement("div");
  tmp.appendChild(frag.cloneNode(true));
  const spans = Array.from(tmp.querySelectorAll("span[style*='color']")) as HTMLSpanElement[];
  for (const s of spans) unwrapElement(s);

  const cleaned = document.createDocumentFragment();
  while (tmp.firstChild) cleaned.appendChild(tmp.firstChild);
  return cleaned;
}

function getSingleSelectedColorSpan(range: Range, root: HTMLElement): HTMLSpanElement | null {
  const a = range.startContainer;
  const b = range.endContainer;

  if (a === b && range.startContainer.nodeType === Node.ELEMENT_NODE) {
    const el = range.startContainer as Element;
    const child = el.childNodes[range.startOffset];
    if (child instanceof HTMLSpanElement && isColorSpan(child) && root.contains(child)) return child;
  }

  const startEl = (range.startContainer.nodeType === 1
    ? (range.startContainer as Element)
    : range.startContainer.parentElement) as Element | null;

  const endEl = (range.endContainer.nodeType === 1
    ? (range.endContainer as Element)
    : range.endContainer.parentElement) as Element | null;

  if (!startEl || !endEl) return null;

  const s1 = startEl.closest("span[style*='color']") as HTMLSpanElement | null;
  const s2 = endEl.closest("span[style*='color']") as HTMLSpanElement | null;

  if (s1 && s1 === s2 && root.contains(s1)) return s1;

  return null;
}


  const handleImageFile = async (file: File) => {
    if (!file.type.startsWith("image/")) return;
    const dataUrl = await readFileAsDataURL(file);
    insertImageAtSelection(dataUrl, file.name);
  };

  const insertImageFromUrl = () => {
    const url = window.prompt("Pega la URL de la imagen:")?.trim();
    if (!url) return;
    if (/^javascript:/i.test(url)) return;
    insertImageAtSelection(url);
  };

  // ✅ Construye HTML EXACTO como Flutter (clean + attrs + p-empty)
const buildPreview = () => {
  const tema = title.trim() || "Sin título";
  const raw = (contentRef.current?.innerHTML ?? "").trim() || "<p><br></p>";

  const cleaned0 = addFlutterSpanAttrs(cleanHtml(raw));
  const cleaned1 = cleaned0.replace(/<p><br><\/p>/gi, '<p class="p-empty"><br></p>');
  const cleaned2 = linkifyPlainUrls(cleaned1);

  setPreviewTitle(tema);
  setPreviewHtml(cleaned2);
};

  const openPreview = () => {
    buildPreview();
    setPreviewOpen(true);

    const maxLeft = Math.max(0, window.innerWidth - PHONE_W - 16);
    const maxTop = Math.max(0, window.innerHeight - PHONE_H - 16);
    setPreviewPos((p) => ({
      left: clamp(p.left, 8, maxLeft),
      top: clamp(p.top, 8, maxTop),
    }));
  };

  const closePreview = () => setPreviewOpen(false);

  const centerPreview = () => {
    const maxLeft = Math.max(0, window.innerWidth - PHONE_W);
    const maxTop = Math.max(0, window.innerHeight - PHONE_H);
    setPreviewPos({
      left: Math.max(8, Math.round(maxLeft / 2)),
      top: Math.max(8, Math.round(maxTop / 2)),
    });
  };

  const onDragStart = (e: React.PointerEvent<HTMLDivElement>) => {
    if (e.pointerType === "mouse" && e.button !== 0) return;
    const st = dragRef.current;
    st.dragging = true;
    st.pointerId = e.pointerId;
    st.startX = e.clientX;
    st.startY = e.clientY;
    st.startLeft = previewPos.left;
    st.startTop = previewPos.top;
    document.body.style.userSelect = "none";
    (e.currentTarget as HTMLDivElement).setPointerCapture(e.pointerId);
  };

  const onDragMove = (e: React.PointerEvent<HTMLDivElement>) => {
    const st = dragRef.current;
    if (!st.dragging || st.pointerId !== e.pointerId) return;

    const dx = e.clientX - st.startX;
    const dy = e.clientY - st.startY;

    const maxLeft = Math.max(0, window.innerWidth - PHONE_W - 8);
    const maxTop = Math.max(0, window.innerHeight - PHONE_H - 8);

    setPreviewPos({
      left: clamp(st.startLeft + dx, 8, maxLeft),
      top: clamp(st.startTop + dy, 8, maxTop),
    });
  };

  const onDragEnd = (e: React.PointerEvent<HTMLDivElement>) => {
    const st = dragRef.current;
    if (st.pointerId !== e.pointerId) return;
    st.dragging = false;
    st.pointerId = null;
    document.body.style.userSelect = "";
    try {
      (e.currentTarget as HTMLDivElement).releasePointerCapture(e.pointerId);
    } catch { }
  };

  // ✅ Auto refresh con debounce mientras escribes (si preview abierto)
  useEffect(() => {
    if (!previewOpen) return;
    const t = window.setTimeout(() => buildPreview(), 250);
    return () => window.clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [content, title, previewOpen]);

  return (
    <div className="bg-white rounded-lg shadow-sm border">
      <style>
        {`
          .content-editable { white-space: pre-wrap; }
          .content-editable ul, .content-editable ol {
            white-space: normal;
            padding-left: 1.25rem;
            margin: 0.5rem 0;
          }
          .content-editable ul { list-style: disc; }
          .content-editable ol { list-style: decimal; }
          .content-editable li { margin: 0.125rem 0; }

          .content-editable table { border-collapse: collapse; width: 100%; }
          .content-editable th, .content-editable td { border: 1px solid #e5e7eb; padding: 6px; vertical-align: top; }
          .content-editable thead th { background: #f3f4f6; }

          .content-editable img {
  max-width: 100%;
  height: auto;
  max-height: 180px;
  object-fit: contain;
  display: block;
  margin: 8px auto;
}
.flutter-html x-border {
  display: inline-block;
  border: 1px solid;
  padding: 2px 6px;
  border-radius: 6px;
  line-height: 1.2;
  box-sizing: border-box;
}
          .flutter-html { font-size: 14px; line-height: 1.35; }
          .flutter-html p { margin: 0 0 8px 0; }
          .flutter-html p:last-child { margin-bottom: 0; }
          .flutter-html p.p-empty { margin: 0 0 8px 0; }
          .flutter-html h1 { font-size: 26px; font-weight: 800; margin: 0 0 10px 0; }
          .flutter-html h2 { font-size: 18px; font-weight: 800; margin: 14px 0 8px 0; }
.flutter-html a {
  color: #0A66C2;
  text-decoration: underline;
  text-underline-offset: 2px;
  font-weight: 600;
  word-break: break-word;
  
} 

.flutter-html ul, .flutter-html ol { margin: 0 0 8px 0; padding-left: 1.25rem; }
          .flutter-html li { margin: 0; }
          .flutter-html table { width: 100%; border-collapse: collapse; margin: 8px 0; }
          .flutter-html th, .flutter-html td { border: 1px solid #e5e7eb; padding: 6px; vertical-align: top; }
          .flutter-html thead th { background: #f3f4f6; }
          .flutter-html img { max-width: 100%; height: auto; display: inline-block; }
          .flutter-html .pill {
            display: inline-block;
            padding: 4px 8px;
            border-radius: 999px;
            border: 1px solid #CAE3FA;
            background: #E9F2FB;
            color: #1E6BB8;
            font-weight: 800;
            font-size: 12px;
            margin: 0 6px 6px 0;
          }
          .flutter-html .muted { opacity: .75; }
        `}
      </style>

      <div className="flex items-center justify-between p-6 border-b">
        <h2 className="text-xl font-semibold text-gray-800">{isEditing ? "Editar Artículo" : "Nuevo Artículo"}</h2>
        <div className="flex gap-2">
          <button
            onClick={openPreview}
            className="px-4 py-2 bg-black text-white rounded-lg hover:bg-black/80 transition-colors flex items-center gap-2"
            title="Previsualizar como en la app"
            type="button"
          >
            <Smartphone className="w-4 h-4" />
            Previsualizar
          </button>

         <button
  onClick={handleSave}
  disabled={saving || !title.trim() || !content.trim()}
  className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex items-center gap-2"
  type="button"
>
  {saving ? (
    <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
  ) : isEditing ? (
    <Save className="w-4 h-4" />
  ) : (
    <PlusCircle className="w-4 h-4" />
  )}
  {saving ? "GUARDANDO..." : isEditing ? "ACTUALIZAR" : "CREAR"}
</button>
<button
  onClick={onCancel}
  disabled={saving}
  className="px-4 py-2 bg-gray-500 text-white rounded-lg hover:bg-gray-600 disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex items-center gap-2"
  type="button"
>
  <X className="w-4 h-4" />
  Cancelar
</button>
        </div>
      </div>

      <div className="p-6 border-b">
        <label className="block text-sm font-medium text-gray-700 mb-2">Título</label>
        <input
          type="text"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="Ingrese el título del artículo"
          className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none"
        />
      </div>

      <div className="p-6">
        <label className="block text-sm font-medium text-gray-700 mb-2">Contenido</label>

        <div className="flex flex-wrap items-center gap-2 mb-4 p-2 bg-gray-50 rounded-lg">
          <button onClick={() => formatText("bold")} className="p-2 hover:bg-gray-200 rounded" title="Negrita" type="button">
            <Bold className="w-4 h-4" />
          </button>
          <button onClick={() => formatText("italic")} className="p-2 hover:bg-gray-200 rounded" title="Cursiva" type="button">
            <Italic className="w-4 h-4" />
          </button>
          <button
            onClick={() => formatText("underline")}
            className="p-2 hover:bg-gray-200 rounded"
            title="Subrayado"
            type="button"
          >
            <Underline className="w-4 h-4" />
          </button>

          <button
            onClick={() => formatText("insertUnorderedList")}
            className="p-2 hover:bg-gray-200 rounded"
            title="Lista con viñetas"
            type="button"
          >
            <List className="w-4 h-4" />
          </button>
          <button
            onClick={() => formatText("insertOrderedList")}
            className="p-2 hover:bg-gray-200 rounded"
            title="Lista numerada"
            type="button"
          >
            <ListOrdered className="w-4 h-4" />
          </button>

          {/* ✅ NEW: ALINEACIÓN (izq/centro/der/justificar) */}
          <div className="flex items-center gap-1 ml-1">
            <button
              onClick={() => applyAlignment("left")}
              className="p-2 hover:bg-gray-200 rounded"
              title="Alinear a la izquierda"
              type="button"
            >
              <AlignLeft className="w-4 h-4" />
            </button>

            <button
              onClick={() => applyAlignment("center")}
              className="p-2 hover:bg-gray-200 rounded"
              title="Centrar"
              type="button"
            >
              <AlignCenter className="w-4 h-4" />
            </button>

            <button
              onClick={() => applyAlignment("right")}
              className="p-2 hover:bg-gray-200 rounded"
              title="Alinear a la derecha"
              type="button"
            >
              <AlignRight className="w-4 h-4" />
            </button>

            <button
              onClick={() => applyAlignment("justify")}
              className="p-2 hover:bg-gray-200 rounded"
              title="Justificar"
              type="button"
            >
              <AlignJustify className="w-4 h-4" />
            </button>
          </div>

          <button onClick={openTableModal} className="p-2 hover:bg-gray-200 rounded" title="Insertar tabla" type="button">
            <Table className="w-4 h-4" />
          </button>

          <div className="flex items-center gap-2">
            <button
              onClick={() => fileInputRef.current?.click()}
              className="p-2 hover:bg-gray-200 rounded"
              title="Insertar imagen (archivo)"
              type="button"
            >
              <ImagePlus className="w-4 h-4" />
            </button>
            <button
              onClick={insertImageFromUrl}
              className="px-2 py-1 border rounded text-sm hover:bg-gray-200"
              title="Insertar imagen desde URL"
              type="button"
            >
              URL
            </button>
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              className="hidden"
              onChange={async (e) => {
                const f = e.target.files?.[0];
                if (f) await handleImageFile(f);
                e.currentTarget.value = "";
              }}
            />
          </div>

          <div className="flex items-center gap-2">
            <button onClick={toggleHighlight} className="p-2 hover:bg-gray-200 rounded" title="Resaltar (toggle)" type="button">
              <Highlighter className="w-4 h-4" />
            </button>
            <input type="color" value={highlightColor} onChange={(e) => setHighlightColor(e.target.value)} />
          </div>

          {/* ✅ ENMARCAR */}
          <div className="flex items-center gap-2">
<button
  onMouseDown={(e) => {
    e.preventDefault();
    rememberRangeIfInside();
  }}
  onClick={() => {
    const selectedText = lastRangeRef.current?.toString() ?? "";

    formatText(
      "insertHTML",
      `<x-border style="border-color:${borderColor};">${escapeHtml(selectedText) || "&nbsp;"}</x-border>`
    );
  }}
  className="p-2 hover:bg-gray-200 rounded"
  title="Enmarcar"
  type="button"
>
  <Square className="w-4 h-4" />
</button>
            <input type="color" value={borderColor} onChange={(e) => setBorderColor(e.target.value)} />
          </div>

         <div className="flex items-center gap-2">
  <button
    onMouseDown={() => rememberRangeIfInside()}
    onClick={applyTextColor}
    className="p-2 hover:bg-gray-200 rounded"
    title="Aplicar color de texto"
    type="button"
  >
    <Type className="w-4 h-4" />
  </button>

  <input
    type="color"
    value={textColor}
    onMouseDown={() => rememberRangeIfInside()}
    onChange={(e) => {
      const c = e.target.value;
      setTextColor(c);
      applyTextColorToSelection(c, lastRangeRef.current);
    }}
  />
</div>

          {/* ✅ Tamaño estilo Word: input + dropdown */}
          <div className="flex items-center gap-2">
  <div className="relative" ref={sizeMenuRef}>
    <button
      type="button"
      className="px-2 py-1 border rounded text-sm hover:bg-gray-200 flex items-center gap-1"
      onMouseDown={() => {
        rememberRangeIfInside();
        if (lastRangeRef.current) sizeRangeRef.current = lastRangeRef.current.cloneRange();
      }}
      onClick={() => setSizeMenuOpen((s) => !s)}
      title="Tamaños"
    >
      {fontSizePx}
      <ChevronDown className="w-4 h-4" />
    </button>

    {sizeMenuOpen && (
      <div className="absolute z-50 mt-1 w-[110px] max-h-64 overflow-auto bg-white border rounded shadow">
        {SIZES.map((s) => (
          <button
            key={s}
            type="button"
            className="w-full text-left px-2 py-1 text-sm hover:bg-gray-100"
            onMouseDown={(e) => {
              e.preventDefault();
              rememberRangeIfInside();
              if (lastRangeRef.current) sizeRangeRef.current = lastRangeRef.current.cloneRange();
            }}
            onClick={() => {
              setFontSizePx(s);
              applySizeFromToolbar(s);
              setSizeMenuOpen(false);
            }}
          >
            {s}
          </button>
        ))}
      </div>
    )}
  </div>
</div>



        </div>

        <div className="relative">
          {!content && (
            <div className="absolute top-2 left-3 text-gray-400 text-sm pointer-events-none">Ingrese el contenido...</div>
          )}
          <div
            ref={contentRef}
            contentEditable
            onInput={handleContentChange}
            onPaste={handlePaste}
            onDrop={handleDrop}
            className="content-editable relative min-h-64 p-4 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none prose prose-sm max-w-none"
            style={{ minHeight: "200px", whiteSpace: "pre-wrap" }}
          />
        </div>

        {imgToolOpen && (
          <div
            ref={imgToolRef}
            className="absolute z-50 bg-white border rounded-lg shadow-lg p-2"
            style={{ left: imgToolPos.left, top: imgToolPos.top, minWidth: 260 }}
          >
            <div className="flex items-center justify-between gap-2 mb-2">
              <div className="text-xs font-semibold text-gray-700">Imagen</div>
              <button
                type="button"
                className="p-1 rounded hover:bg-gray-100"
                onClick={closeImgTool}
                title="Cerrar"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="block text-[11px] text-gray-600 mb-1">Ancho (px o %)</label>
                <input
                  value={imgW}
                  onChange={(e) => setImgW(e.target.value.replace(/[^\d%]/g, ""))}
                  className="w-full border rounded px-2 py-1 text-sm"
                  placeholder="Ej: 320 ó 60%"
                />
              </div>
              <div>
                <label className="block text-[11px] text-gray-600 mb-1">Alto (px)</label>
                <input
                  value={imgH}
                  onChange={(e) => setImgH(e.target.value.replace(/[^\d]/g, ""))}
                  className="w-full border rounded px-2 py-1 text-sm"
                  placeholder="auto"
                />
              </div>
            </div>

            <div className="flex items-center justify-between mt-2 gap-2">
              <div className="flex items-center gap-1">
                <button
                  type="button"
                  className="px-2 py-1 border rounded text-xs hover:bg-gray-100"
                  onClick={() => setImgPercent(25)}
                >
                  25%
                </button>
                <button
                  type="button"
                  className="px-2 py-1 border rounded text-xs hover:bg-gray-100"
                  onClick={() => setImgPercent(50)}
                >
                  50%
                </button>
                <button
                  type="button"
                  className="px-2 py-1 border rounded text-xs hover:bg-gray-100"
                  onClick={() => setImgPercent(75)}
                >
                  75%
                </button>
                <button
                  type="button"
                  className="px-2 py-1 border rounded text-xs hover:bg-gray-100"
                  onClick={() => setImgPercent(100)}
                >
                  100%
                </button>
              </div>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  className="px-2 py-1 border rounded text-xs hover:bg-gray-100"
                  onClick={resetImgSize}
                >
                  Reset
                </button>
                <button
                  type="button"
                  className="px-3 py-1 rounded text-xs bg-blue-600 text-white hover:bg-blue-700"
                  onClick={applyImgSize}
                >
                  Aplicar
                </button>
              </div>
            </div>
          </div>
        )}
      </div>

      {tableModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          <div className="absolute inset-0 bg-black/40" onClick={closeTableModal} />
          <div className="relative z-10 w-full max-w-sm bg-white rounded-xl shadow-lg border p-5">
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-lg font-semibold">Insertar tabla</h3>
              <button onClick={closeTableModal} className="p-1 rounded hover:bg-gray-100" type="button">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-3">
              <div>
                <label className="block text-sm text-gray-700 mb-1">Filas (1–20)</label>
                <input
                  type="number"
                  min={1}
                  max={20}
                  value={tableRows}
                  onChange={(e) => setTableRows(clamp(Number(e.target.value) || 1, 1, 20))}
                  className="w-full border rounded px-3 py-2 outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
              <div>
                <label className="block text-sm text-gray-700 mb-1">Columnas (1–20)</label>
                <input
                  type="number"
                  min={1}
                  max={20}
                  value={tableCols}
                  onChange={(e) => setTableCols(clamp(Number(e.target.value) || 1, 1, 20))}
                  className="w-full border rounded px-3 py-2 outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
              <label className="inline-flex items-center gap-2 select-none">
                <input type="checkbox" checked={tableHeader} onChange={(e) => setTableHeader(e.target.checked)} />
                <span className="text-sm text-gray-700">Encabezado</span>
              </label>
            </div>

            <div className="mt-4 flex justify-end gap-2">
              <button onClick={closeTableModal} className="px-4 py-2 rounded-lg border hover:bg-gray-50" type="button">
                Cancelar
              </button>
              <button
                onClick={confirmInsertTable}
                className="px-4 py-2 rounded-lg bg-blue-600 text-white hover:bg-blue-700"
                type="button"
              >
                Insertar
              </button>
            </div>
          </div>
        </div>
      )}

      {previewOpen && (
        <FlutterPhonePreview
          title={previewTitle}
          html={previewHtml}
          updatedAt={new Date().toISOString()}
          dark={false}
          logoSrc="/infectologia-logo.png"
          pos={previewPos}
          phoneW={PHONE_W}
          phoneH={PHONE_H}
          onClose={closePreview}
          onCenter={centerPreview}
          onRefresh={() => buildPreview()}
          onDragStart={onDragStart}
          onDragMove={onDragMove}
          onDragEnd={onDragEnd}
        />
      )}
    </div>
  );
};

export default ArticleEditor;

// ===============================
// FlutterPhonePreview
// ===============================

type FlutterPhonePreviewProps = {
  title: string;
  html: string;
  updatedAt?: string;
  dark?: boolean;
  logoSrc?: string;

  pos: { left: number; top: number };
  phoneW: number;
  phoneH: number;

  onClose: () => void;
  onCenter: () => void;
  onRefresh: () => void;

  onDragStart: (e: React.PointerEvent<HTMLDivElement>) => void;
  onDragMove: (e: React.PointerEvent<HTMLDivElement>) => void;
  onDragEnd: (e: React.PointerEvent<HTMLDivElement>) => void;
};

const FlutterPhonePreview: React.FC<FlutterPhonePreviewProps> = ({
  title,
  html,
  updatedAt,
  dark = false,
  logoSrc,
  pos,
  phoneW,
  phoneH,
  onClose,
  onCenter,
  onRefresh,
  onDragStart,
  onDragMove,
  onDragEnd,
}) => {
  const bg = dark ? "#0F1115" : "#F4F6F8";
  const text = dark ? "#FFFFFF" : "#111827";
  const muted = dark ? "rgba(255,255,255,.55)" : "rgba(17,24,39,.45)";
  const line = dark ? "rgba(255,255,255,.10)" : "rgba(17,24,39,.08)";
  const searchBg = dark ? "rgba(255,255,255,.06)" : "#FFFFFF";
  const navBg = "#0B4A8B";
  const navActive = "#F4B400";
  const navMuted = "rgba(255,255,255,.65)";

  const PHONE_RADIUS = 34;
  const notchW = 170;
  const notchH = 28;

  const [minimized, setMinimized] = useState(false);

  return (
    <div className="fixed z-[70]" style={{ left: pos.left, top: pos.top, width: phoneW }}>
      <div
        className="flex items-center justify-between gap-2 px-3 py-2 rounded-t-2xl bg-black text-white cursor-grab active:cursor-grabbing select-none"
        onPointerDown={onDragStart}
        onPointerMove={onDragMove}
        onPointerUp={onDragEnd}
        onPointerCancel={onDragEnd}
      >
        <div className="flex items-center gap-2 min-w-0">
          <Smartphone className="w-4 h-4 shrink-0" />
          <div className="text-sm font-semibold truncate">Preview App</div>
        </div>

        <div className="flex items-center gap-1">
  {/* ✅ Minimizar / Maximizar */}
  <button
    type="button"
    className="p-1.5 rounded hover:bg-white/10"
    title={minimized ? "Maximizar" : "Minimizar"}
    onPointerDown={(e) => e.stopPropagation()}
    onClick={(e) => {
      e.stopPropagation();
      setMinimized((v) => !v);
    }}
  >
    {minimized ? <Maximize2 className="w-4 h-4" /> : <Minimize2 className="w-4 h-4" />}
  </button>

  {/* ✅ Refrescar */}
  <button
    type="button"
    className="p-1.5 rounded hover:bg-white/10"
    title="Refrescar preview"
    onPointerDown={(e) => e.stopPropagation()}
    onClick={(e) => {
      e.stopPropagation();
      onRefresh();
    }}
  >
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path d="M20 12a8 8 0 1 1-2.34-5.66" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
      <path d="M20 4v6h-6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  </button>

  {/* Centrar */}
  <button
    type="button"
    className="p-1.5 rounded hover:bg-white/10"
    title="Centrar"
    onPointerDown={(e) => e.stopPropagation()}
    onClick={(e) => {
      e.stopPropagation();
      onCenter();
    }}
  >
    <Crosshair className="w-4 h-4" />
  </button>

  {/* Cerrar */}
  <button
    type="button"
    className="p-1.5 rounded hover:bg-white/10"
    title="Cerrar preview"
    onPointerDown={(e) => e.stopPropagation()}
    onClick={(e) => {
      e.stopPropagation();
      onClose();
    }}
  >
    <X className="w-4 h-4" />
  </button>
</div>

      </div>
{!minimized && (

      <div className="rounded-b-2xl border border-black/20 bg-black p-3 shadow-2xl">
        <div className="relative overflow-hidden" style={{ borderRadius: PHONE_RADIUS, background: bg, height: phoneH }}>
          <div
            style={{
              position: "absolute",
              left: "50%",
              top: 8,
              transform: "translateX(-50%)",
              width: notchW,
              height: notchH,
              background: "#000",
              borderBottomLeftRadius: 18,
              borderBottomRightRadius: 18,
              opacity: 0.92,
              zIndex: 20,
            }}
          />

          <div style={{ height: 44 }} />

          <div style={{ display: "flex", alignItems: "center", padding: "10px 14px", gap: 10, background: bg }}>
            <div
              style={{
                width: 34,
                height: 34,
                borderRadius: 10,
                display: "grid",
                placeItems: "center",
                color: text,
                background: dark ? "rgba(255,255,255,.06)" : "rgba(0,0,0,.04)",
              }}
            >
              <div style={{ width: 16 }}>
                <div style={{ height: 2, background: text, opacity: 0.8, marginBottom: 3, borderRadius: 999 }} />
                <div style={{ height: 2, background: text, opacity: 0.8, marginBottom: 3, borderRadius: 999 }} />
                <div style={{ height: 2, background: text, opacity: 0.8, borderRadius: 999 }} />
              </div>
            </div>

            <div style={{ flex: 1, display: "flex", justifyContent: "center" }}>
              {logoSrc ? (
                <img src={logoSrc} alt="logo" style={{ height: 20, objectFit: "contain", opacity: dark ? 0.95 : 0.9 }} />
              ) : (
                <div style={{ fontWeight: 800, letterSpacing: 0.3, color: text, opacity: 0.85, fontSize: 12 }}>
                  INFECTOLOGÍA
                </div>
              )}
            </div>

            <div
              style={{
                width: 34,
                height: 34,
                borderRadius: 10,
                display: "grid",
                placeItems: "center",
                color: text,
                background: dark ? "rgba(255,255,255,.06)" : "rgba(0,0,0,.04)",
              }}
              title="Dark mode (solo visual)"
            >
              <div
                style={{
                  width: 14,
                  height: 14,
                  borderRadius: 999,
                  border: `2px solid ${text}`,
                  position: "relative",
                  opacity: 0.8,
                }}
              >
                <div
                  style={{
                    position: "absolute",
                    right: -2,
                    top: -2,
                    width: 10,
                    height: 10,
                    borderRadius: 999,
                    background: bg,
                  }}
                />
              </div>
            </div>
          </div>

          <div style={{ padding: "0 14px 10px 14px" }}>
            <div
              style={{
                display: "flex",
                alignItems: "center",
                gap: 10,
                padding: "10px 12px",
                borderRadius: 16,
                background: searchBg,
                border: `1px solid ${line}`,
              }}
            >
              <div style={{ width: 18, height: 18, opacity: 0.5 }}>
                <div style={{ width: 12, height: 12, border: `2px solid ${muted}`, borderRadius: 999, position: "relative" }}>
                  <div
                    style={{
                      position: "absolute",
                      width: 8,
                      height: 2,
                      background: muted,
                      bottom: -6,
                      right: -6,
                      transform: "rotate(45deg)",
                      borderRadius: 999,
                    }}
                  />
                </div>
              </div>
              <div style={{ color: muted, fontSize: 13 }}>Buscar</div>
            </div>
          </div>

          <div style={{ padding: "6px 14px 0 14px", color: text }}>
            <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
              <div style={{ width: 28, height: 28, display: "grid", placeItems: "center", opacity: 0.9 }}>
                <div
                  style={{
                    width: 10,
                    height: 10,
                    borderLeft: `2px solid ${text}`,
                    borderBottom: `2px solid ${text}`,
                    transform: "rotate(45deg)",
                    marginLeft: 4,
                  }}
                />
              </div>
              <div style={{ fontSize: 18, fontWeight: 800, lineHeight: 1.1 }}>{title || "Sin título"}</div>
            </div>
          </div>

          <div
            style={{
              position: "absolute",
              left: 0,
              right: 0,
              top: 44 + 54 + 54 + 44,
              bottom: 76,
              overflow: "auto",
              padding: "14px 18px 18px 18px",
              color: text,
              background: bg,
            }}
          >
            <div className="flutter-html" dangerouslySetInnerHTML={{ __html: html }} />
            <div style={{ marginTop: 22, fontSize: 11, color: muted }}>{updatedAt ? `Actualizado: ${updatedAt}` : ""}</div>
          </div>

          <div
            style={{
              position: "absolute",
              left: 0,
              right: 0,
              bottom: 0,
              height: 76,
              background: navBg,
              display: "flex",
              alignItems: "center",
              justifyContent: "space-around",
              paddingBottom: 8,
            }}
          >
            <NavItem label="Guía" active />
            <NavItem label="Inicio" />
            <NavItem label="Calculadora" />
            <NavItem label="Vacunas" />

            <div
              style={{
                position: "absolute",
                left: "50%",
                bottom: 6,
                transform: "translateX(-50%)",
                width: 120,
                height: 5,
                borderRadius: 999,
                background: "rgba(255,255,255,.22)",
              }}
            />
          </div>
        </div>
      </div> )}

      <style>{`
        .nav-item {
          width: 78px;
          display: flex;
          flex-direction: column;
          align-items: center;
          gap: 6px;
          font-size: 11px;
          font-weight: 700;
        }
      `}</style>
    </div>
  );

  function NavItem({ label, active }: { label: string; active?: boolean }) {
    return (
      <div className="nav-item" style={{ color: active ? navActive : navMuted }}>
        <div
          style={{
            width: 22,
            height: 22,
            borderRadius: 7,
            border: `2px solid ${active ? navActive : navMuted}`,
            opacity: active ? 1 : 0.85,
          }}
        />
        <div>{label}</div>
      </div>
    );
  }
};

