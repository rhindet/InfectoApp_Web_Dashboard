import React, { useEffect, useRef, useState } from 'react';
import {
  Bold, Italic, Underline, List, ListOrdered, Save, X, Table, PlusCircle, Highlighter
} from 'lucide-react';
import { Article } from '../types';

interface ArticleEditorProps {
  article?: Article;
  onSave: (article: Partial<Article>) => void;
  onCancel: () => void;
}

type Option = { value: string; label: string };

const ArticleEditor: React.FC<ArticleEditorProps> = ({ article, onSave, onCancel }) => {
  const [title, setTitle] = useState<string>(article?.tema ?? '');
  const [content, setContent] = useState<string>(article?.contenidos?.[0] ?? '');
  const contentRef = useRef<HTMLDivElement>(null);

  // Dropdowns (ocultos pero funcionales)
  const [dd1, setDd1] = useState<string>('');
  const [dd2, setDd2] = useState<string>('');
  const [dd3, setDd3] = useState<string>('');
  const [dd4, setDd4] = useState<string>('');
  const [dd1Options, setDd1Options] = useState<Option[]>([]);
  const [dd2Options, setDd2Options] = useState<Option[]>([]);
  const [dd3Options, setDd3Options] = useState<Option[]>([]);
  const [dd4Options, setDd4Options] = useState<Option[]>([]);

  // Resaltado
  const [highlightColor, setHighlightColor] = useState<string>('#FFF3CD'); // amarillo suave
  const lastRangeRef = useRef<Range | null>(null);

  const HIGHLIGHT_ATTR = 'data-highlight';

  // -------- helpers selección/caret --------
  const rememberRangeIfInside = () => {
    const el = contentRef.current;
    const sel = window.getSelection();
    if (!el || !sel || sel.rangeCount === 0) return;
    const range = sel.getRangeAt(0);
    if (el.contains(range.startContainer) && el.contains(range.endContainer)) {
      lastRangeRef.current = range.cloneRange();
    }
  };

  const restoreRange = () => {
    const el = contentRef.current;
    const sel = window.getSelection();
    if (!el || !sel) return false;
    if (lastRangeRef.current) {
      el.focus(); // foco antes de restaurar
      sel.removeAllRanges();
      sel.addRange(lastRangeRef.current);
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

  const ensureParagraph = () => {
    const el = contentRef.current;
    if (!el) return;
    const html = (el.innerHTML || '').trim();
    if (!html || html === '<br>' || html === '&nbsp;' || html === '<p><br></p>') {
      el.innerHTML = '<p><br></p>';
      placeCaretAtEnd(el);
    }
  };

  // -------- estado inicial --------
  useEffect(() => {
    const apiUrl = import.meta.env.VITE_API_URL;

    const getDropdownsInfo = async () => {
      try {
        const res = await fetch(`${apiUrl}/nivelesScraping/niveles/temas`);
        const json = await res.json();
        setDd1Options((json?.[0] ?? []).map((it: any) => ({ value: it._id, label: it.nombre })));
        setDd2Options((json?.[1] ?? []).map((it: any) => ({ value: it._id, label: it.nombre })));
        setDd3Options((json?.[2] ?? []).map((it: any) => ({ value: it._id, label: it.nombre })));
        setDd4Options((json?.[3] ?? []).map((it: any) => ({ value: it._id, label: it.nombre })));
      } catch { /* noop */ }
    };

    getDropdownsInfo();

    setTitle(article?.tema ?? '');
    const initial = article?.contenidos?.[0] ?? '';
    setContent(initial);
    if (contentRef.current) contentRef.current.innerHTML = initial;

    if (article) {
      if (article.ref_tabla_nivel0) setDd1(String(article.ref_tabla_nivel0));
      if (article.ref_tabla_nivel1) setDd2(String(article.ref_tabla_nivel1));
      if (article.ref_tabla_nivel2) setDd3(String(article.ref_tabla_nivel2));
      if (article.ref_tabla_nivel3) setDd4(String(article.ref_tabla_nivel3));
    }

    // Párrafos por defecto para execCommand
    try { document.execCommand('defaultParagraphSeparator', false, 'p'); } catch {}
  }, [article]);

  // -------- track selección dentro del editor --------
  useEffect(() => {
    const el = contentRef.current;
    if (!el) return;
    const onKeyUp = () => rememberRangeIfInside();
    const onMouseUp = () => rememberRangeIfInside();
    const onSelChange = () => rememberRangeIfInside();

    el.addEventListener('keyup', onKeyUp);
    el.addEventListener('mouseup', onMouseUp);
    document.addEventListener('selectionchange', onSelChange);

    return () => {
      el.removeEventListener('keyup', onKeyUp);
      el.removeEventListener('mouseup', onMouseUp);
      document.removeEventListener('selectionchange', onSelChange);
    };
  }, []);

  // -------- sync contenido --------
  const handleContentChange = () => {
    if (contentRef.current) setContent(contentRef.current.innerHTML);
  };

  // -------- UL/OL inline styles --------
  const ensureListInlineStyles = () => {
    const sel = window.getSelection();
    if (!sel || sel.rangeCount === 0) return;
    const range = sel.getRangeAt(0);
    let node: Node | null = range.startContainer;

    while (node && node !== contentRef.current) {
      if (node instanceof HTMLElement && (node.tagName === 'UL' || node.tagName === 'OL')) {
        const isOl = node.tagName === 'OL';
        if (!node.getAttribute('style')) {
          node.setAttribute(
            'style',
            `${isOl ? 'list-style: decimal;' : 'list-style: disc;'} padding-left: 1.25rem; margin: 0.5rem 0;`
          );
        }
        const lis = node.querySelectorAll('li');
        lis.forEach(li => {
          if (!(li as HTMLElement).innerHTML.trim()) {
            (li as HTMLElement).innerHTML = '&nbsp;';
          }
        });
        break;
      }
      node = node.parentNode;
    }
  };

  // -------- comandos (negrita, cursiva, listas, etc.) --------
  const formatText = (command: string, value?: string) => {
    const el = contentRef.current;
    if (!el) return;

    el.focus();
    if (!restoreRange()) {
      placeCaretAtEnd(el);
    }

    if (command === 'insertUnorderedList' || command === 'insertOrderedList') {
      ensureParagraph();
    }

    if (command === 'insertHTML' && value) {
      document.execCommand('insertHTML', false, value);
    } else {
      document.execCommand(command, false, value);
    }

    if (command === 'insertUnorderedList' || command === 'insertOrderedList') {
      ensureListInlineStyles();
    }

    handleContentChange();
  };

  // -------- insertar tabla --------
  const insertTableWithExec = () => {
    const rows = Math.max(1, Number(prompt('¿Cuántas filas?', '2') || 2));
    const cols = Math.max(1, Number(prompt('¿Cuántas columnas?', '2') || 2));
    const withHeader = confirm('¿Incluir fila de encabezado?');

    const header = withHeader
      ? `<tr>${Array.from({ length: cols })
          .map((_, i) => `<th style="padding:6px;border:1px solid #ccc;background:#efefef;">Columna ${i + 1}</th>`)
          .join('')}</tr>`
      : '';

    const body = Array.from({ length: rows })
      .map(() =>
        `<tr>${Array.from({ length: cols })
          .map(() => `<td style="padding:6px;border:1px solid #ccc;">&nbsp;</td>`)
          .join('')}</tr>`
      )
      .join('');

    const html =
      `<div style="overflow-x:auto;">
        <table style="min-width:600px;width:auto;border-collapse:collapse;margin:8px 0;">
          ${header}${body}
        </table>
      </div><br/>`;

    formatText('insertHTML', html);
  };

  // ===== helpers resaltado (toggle) =====
  const isHighlightSpan = (el: Element | null) =>
    !!el && el.tagName === 'SPAN' && (el as HTMLElement).hasAttribute(HIGHLIGHT_ATTR);

  const getHighlightAncestor = (start: Node, root: HTMLElement): HTMLElement | null => {
    let p: Node | null = start;
    while (p && p !== root) {
      if (p instanceof HTMLElement && isHighlightSpan(p)) return p;
      p = p.parentNode;
    }
    return null;
  };

  const unwrapSpan = (span: HTMLElement) => {
    const parent = span.parentNode;
    if (!parent) return;
    while (span.firstChild) parent.insertBefore(span.firstChild, span);
    parent.removeChild(span);
  };

  // ====== Resaltado con TOGGLE ======
  const applyHighlight = () => {
    const root = contentRef.current;
    if (!root) return;

    root.focus();
    if (!restoreRange()) {
      placeCaretAtEnd(root);
    }

    const sel = window.getSelection();
    const range = sel && sel.rangeCount > 0 ? sel.getRangeAt(0) : null;
    if (!range) return;
    if (!(root.contains(range.startContainer) && root.contains(range.endContainer))) return;

    // 1) Detectar si la selección toca LI(s)
    const treeWalker = document.createTreeWalker(
      range.commonAncestorContainer,
      NodeFilter.SHOW_ELEMENT | NodeFilter.SHOW_TEXT,
      {
        acceptNode: (node: Node) => {
          try {
            const nodeRange = document.createRange();
            nodeRange.selectNode(node.nodeType === 3 ? node : (node as Element));
            return (range.compareBoundaryPoints(Range.END_TO_START, nodeRange) < 0 &&
                    range.compareBoundaryPoints(Range.START_TO_END, nodeRange) > 0)
              ? NodeFilter.FILTER_ACCEPT
              : NodeFilter.FILTER_REJECT;
          } catch {
            return NodeFilter.FILTER_REJECT;
          }
        }
      } as any,
      false
    );

    const affectedLIs: HTMLElement[] = [];
    let n: Node | null = treeWalker.currentNode;
    while ((n = treeWalker.nextNode())) {
      let p: Node | null = n;
      while (p && p !== root) {
        if (p instanceof HTMLElement && p.tagName === 'LI') {
          if (!affectedLIs.includes(p)) affectedLIs.push(p);
          break;
        }
        p = p.parentNode;
      }
    }

    // 2) Si hay LIs => toggle por LI (no envolver <li>)
    if (affectedLIs.length > 0) {
      affectedLIs.forEach((li) => {
        // ¿ya está resaltado el contenido?
        const first = li.firstElementChild as HTMLElement | null;
        const already = isHighlightSpan(first);

        if (already) {
          // quitar resaltado: unwrap
          unwrapSpan(first!);
        } else {
          // aplicar resaltado: mover hijos dentro de wrapper
          const wrapper = document.createElement('span');
          wrapper.setAttribute(HIGHLIGHT_ATTR, '1');
          wrapper.setAttribute(
            'style',
            `background-color:${highlightColor}; padding:2px 6px; border-radius:6px; display:inline-block;`
          );
          while (li.firstChild) wrapper.appendChild(li.firstChild);
          li.appendChild(wrapper);
        }
      });

      handleContentChange();
      return;
    }

    // 3) Selección normal => toggle por rango
    // 3a) Si todo (o parte) del rango ya está dentro de span de highlight, lo quitamos
    const spansToUnwrap = new Set<HTMLElement>();
    const walker2 = document.createTreeWalker(
      range.commonAncestorContainer,
      NodeFilter.SHOW_TEXT,
      {
        acceptNode: (node: Node) => {
          try {
            const nr = document.createRange();
            nr.selectNode(node);
            const intersects =
              range.compareBoundaryPoints(Range.END_TO_START, nr) < 0 &&
              range.compareBoundaryPoints(Range.START_TO_END, nr) > 0;
            if (!intersects) return NodeFilter.FILTER_REJECT;
            const anc = getHighlightAncestor(node, root);
            return anc ? NodeFilter.FILTER_ACCEPT : NodeFilter.FILTER_REJECT;
          } catch {
            return NodeFilter.FILTER_REJECT;
          }
        },
      } as any
    );

    let t: Node | null;
    while ((t = walker2.nextNode())) {
      const anc = getHighlightAncestor(t!, root);
      if (anc) spansToUnwrap.add(anc);
    }

    if (spansToUnwrap.size > 0) {
      // quitar resaltado de todos los spans encontrados
      spansToUnwrap.forEach(unwrapSpan);
      handleContentChange();
      return;
    }

    // 3b) No hay highlight en la selección => aplicarlo
    const frag = range.cloneContents();
    const container = document.createElement('div');
    container.appendChild(frag);
    const selectedHtml = container.innerHTML || range.toString();
    const inner = selectedHtml && selectedHtml.trim().length > 0 ? selectedHtml : '&nbsp;';

    const span =
      `<span ${HIGHLIGHT_ATTR}="1" style="background-color:${highlightColor}; padding:2px 6px; border-radius:6px; display:inline-block;">${inner}</span>`;

    document.execCommand('insertHTML', false, span);
    handleContentChange();
  };

  // -------- guardar --------
  const handleSave = () => {
    const tema = title.trim();
    const html = (contentRef.current?.innerHTML ?? '').trim();
    if (!tema || !html) return;

    onSave({
      _id: article?._id,
      tema,
      contenidos: [html],
      subtemas: article?.subtemas,
      sin_categoria: article?.sin_categoria ?? false,
      ref_tabla_nivel0: dd1 || null,
      ref_tabla_nivel1: dd2 || null,
      ref_tabla_nivel2: dd3 || null,
      ref_tabla_nivel3: dd4 || null,
      fecha_creacion: article?.fecha_creacion ?? null,
      fecha_modificacion: article?.fecha_modificacion ?? null,
    });
  };

  const isEditing = Boolean(article?._id);

  return (
    <div className="bg-white rounded-lg shadow-sm border">
      {/* Header */}
      <div className="flex items-center justify-between p-6 border-b">
        <h2 className="text-xl font-semibold text-gray-800">
          {isEditing ? 'Editar Artículo' : 'Nuevo Artículo'}
        </h2>
        <div className="flex gap-2">
          <button
            onClick={handleSave}
            disabled={!title.trim() || !content.trim()}
            className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex items-center gap-2"
          >
            {isEditing ? <Save className="w-4 h-4" /> : <PlusCircle className="w-4 h-4" />}
            {isEditing ? 'ACTUALIZAR' : 'CREAR'}
          </button>
          <button
            onClick={onCancel}
            className="px-4 py-2 bg-gray-500 text-white rounded-lg hover:bg-gray-600 transition-colors flex items-center gap-2"
          >
            <X className="w-4 h-4" />
            Cancelar
          </button>
        </div>
      </div>

      {/* Title */}
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

      {/* Content */}
      <div className="p-6">
        <label className="block text-sm font-medium text-gray-700 mb-2">Contenido</label>

        {/* Toolbar */}
        <div className="flex items-center gap-2 mb-4 p-2 bg-gray-50 rounded-lg">
          <button type="button" onClick={() => formatText('bold')} className="p-2 hover:bg-gray-200 rounded" title="Negrita">
            <Bold className="w-4 h-4" />
          </button>
          <button type="button" onClick={() => formatText('italic')} className="p-2 hover:bg-gray-200 rounded" title="Cursiva">
            <Italic className="w-4 h-4" />
          </button>
          <button type="button" onClick={() => formatText('underline')} className="p-2 hover:bg-gray-200 rounded" title="Subrayado">
            <Underline className="w-4 h-4" />
          </button>

          <div className="w-px h-6 bg-gray-300 mx-2" />

          <button
            type="button"
            onClick={() => formatText('insertUnorderedList')}
            className="p-2 hover:bg-gray-200 rounded"
            title="Lista con viñetas"
          >
            <List className="w-4 h-4" />
          </button>

          <button
            type="button"
            onClick={() => formatText('insertOrderedList')}
            className="p-2 hover:bg-gray-200 rounded"
            title="Lista numerada"
          >
            <ListOrdered className="w-4 h-4" />
          </button>

          <button type="button" onClick={insertTableWithExec} className="p-2 hover:bg-gray-200 rounded" title="Insertar tabla">
            <Table className="w-4 h-4" />
          </button>

          {/* Resaltado */}
          <div className="ml-2 flex items-center gap-2">
            <button
              type="button"
              onClick={applyHighlight}
              className="p-2 hover:bg-gray-200 rounded flex items-center gap-2"
              title="Resaltar (toggle)"
            >
              <Highlighter className="w-4 h-4" />
              <span className="text-sm hidden sm:inline">Resaltar</span>
            </button>
            <input
              type="color"
              value={highlightColor}
              onChange={(e) => setHighlightColor(e.target.value)}
              className="h-8 w-8 cursor-pointer rounded border border-gray-300 p-0"
              title="Elegir color de fondo"
              onClick={() => restoreRange()}
            />
          </div>
        </div>

        {/* Estilos base visibles sólo en el editor (no se guardan) */}
        <style>
          {`
            .content-editable ul { list-style: disc; padding-left: 1.25rem; }
            .content-editable ol { list-style: decimal; padding-left: 1.25rem; }
            .content-editable li { margin: 0.125rem 0; }
          `}
        </style>

        {/* Editor */}
        <div className="relative">
          {!content && (
            <div className="absolute top-2 left-3 text-gray-400 text-sm pointer-events-none">
              Ingrese el contenido del artículo aquí...
            </div>
          )}
          <div
            ref={contentRef}
            contentEditable
            onInput={handleContentChange}
            className="content-editable relative min-h-64 p-4 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none prose prose-sm max-w-none"
            style={{ minHeight: '200px' }}
            spellCheck={false}
          />
        </div>
      </div>
    </div>
  );
};

export default ArticleEditor; 