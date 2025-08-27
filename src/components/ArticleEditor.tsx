import React, { useEffect, useRef, useState } from 'react';
import {
  Bold, Italic, Underline, List, ListOrdered, Save, X, Table,
  PlusCircle, Highlighter, Square, Type
} from 'lucide-react';
import { Article } from '../types';

interface ArticleEditorProps {
  article?: Article;
  onSave: (article: Partial<Article>) => void;
  onUpdate: (article: Partial<Article>) => void;
  onCancel: () => void;
}

type Option = { value: string; label: string };

const ArticleEditor: React.FC<ArticleEditorProps> = ({ article, onSave, onCancel, onUpdate }) => {
  const [title, setTitle] = useState<string>(article?.tema ?? '');
  const [content, setContent] = useState<string>(article?.contenidos?.[0] ?? '');
  const contentRef = useRef<HTMLDivElement>(null);

  // colores / tipografía
  const [highlightColor, setHighlightColor] = useState('#FFF3CD');
  const [borderColor, setBorderColor] = useState('#000000');
  const [textColor, setTextColor] = useState('#000000');
  const [fontSize, setFontSize] = useState('3'); // 1..7 (execCommand)

  const lastRangeRef = useRef<Range | null>(null);
  const HIGHLIGHT_ATTR = 'data-highlight';
  const BORDER_ATTR = 'data-border';

  // ---------- selección ----------
  const rememberRangeIfInside = () => {
    const el = contentRef.current;
    const sel = window.getSelection();
    if (!el || !sel || sel.rangeCount === 0) return;
    const range = sel.getRangeAt(0);
    if (el.contains(range.startContainer) && el.contains(range.endContainer)) {
      lastRangeRef.current = range.cloneRange();
    }
  };

  // 1) Sanitizador antes de guardar
function cleanHtml(dirty: string): string {
  if (!dirty) return '';

  // Quitar BOM/espacios raros
  const raw = dirty.replace(/\uFEFF/g, '').trim();

  // Parsear a DOM
  const parser = new DOMParser();
  const doc = parser.parseFromString(`<div id="root">${raw}</div>`, 'text/html');
  const root = doc.getElementById('root') as HTMLElement;
  if (!root) return raw;

  // a) Fuera cosas globales que a veces se cuelan
  // (por si pegaste HTML "completo" con head)
  doc.querySelectorAll('meta, title, style').forEach(n => n.remove());

  // b) Desenvolver H1/H2/H3 (si envuelven todo)
  root.querySelectorAll('h1, h2, h3').forEach(h => {
    const frag = doc.createDocumentFragment();
    while (h.firstChild) frag.appendChild(h.firstChild);
    h.replaceWith(frag);
  });

  // c) Remover clases de Word y atributos no deseados
  const all = root.querySelectorAll<HTMLElement>('*');
  all.forEach(el => {
    // Clases Mso* (Word/Outlook)
    if (el.className && /(^|\s)Mso[\w-]*/i.test(el.className)) {
      el.removeAttribute('class');
    }

    // style con variables de tailwind u otros estilos ruidosos
    if (el.hasAttribute('style')) {
      const css = el.getAttribute('style') || '';
      // quitar reglas --tw-*
      const cleaned = css
        .split(';')
        .map(s => s.trim())
        .filter(s => s && !s.startsWith('--tw-'))
        .join('; ');
      if (cleaned) el.setAttribute('style', cleaned);
      else el.removeAttribute('style');
    }

    // atributos “data-” que no usas -> quítalos (opcional)
    // [...el.attributes].forEach(attr => {
    //   if (attr.name.startsWith('data-') && attr.name !== 'data-border' && attr.name !== 'data-highlight') {
    //     el.removeAttribute(attr.name);
    //   }
    // });

    // <span> vacío => eliminar
    if (el.tagName === 'SPAN' && el.textContent?.trim() === '' && !el.children.length) {
      el.remove();
    }
  });

  // d) Quitar wrappers <ol/ul> vacíos que a veces deja Word
  root.querySelectorAll('ul, ol').forEach(list => {
    if (!list.querySelector('li')) list.remove();
  });

  // e) Normalizar &nbsp; excesivos
  root.innerHTML = root.innerHTML
    .replace(/(&nbsp;|\s)+<\/(p|li)>/gi, '</$2>')
    .replace(/(<p>\s*<\/p>)+/gi, '<p><br></p>');

  // f) Trim final
  const cleaned = root.innerHTML.trim();

  return cleaned;
}

  const restoreRange = () => {
    const el = contentRef.current;
    const sel = window.getSelection();
    if (!el || !sel) return false;
    if (lastRangeRef.current) {
      el.focus();
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

  // ---------- ciclo de vida ----------
  useEffect(() => {
    setTitle(article?.tema ?? '');
    const initial = article?.contenidos?.[0] ?? '';
    setContent(initial);
    if (contentRef.current) contentRef.current.innerHTML = initial;
    try { document.execCommand('defaultParagraphSeparator', false, 'p'); } catch {}
  }, [article]);

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

  // ---------- helpers ----------
  const handleContentChange = () => {
    if (contentRef.current) setContent(contentRef.current.innerHTML);
  };

  const formatText = (command: string, value?: string) => {
    const el = contentRef.current;
    if (!el) return;
    el.focus();
    if (!restoreRange()) placeCaretAtEnd(el);
    document.execCommand(command, false, value);
    handleContentChange();
  };

  // Color de texto
  const applyTextColor = () => formatText('foreColor', textColor);

  // Tamaño de texto (1..7)
  const applyFontSize = () => formatText('fontSize', fontSize);

  // ---------- PEGADO/ARRASTRE LIMPIO (SIN FORMATO) ----------
  const insertPlainTextAtCursor = (text: string) => {
    const el = contentRef.current;
    if (!el) return;
    el.focus();

    // Normaliza saltos de línea (CRLF, CR -> LF)
    const plain = text.replace(/\r\n?/g, '\n');

    const sel = window.getSelection();
    if (!sel) return;

    if (sel.rangeCount > 0) {
      const range = sel.getRangeAt(0);
      range.deleteContents();
      const node = document.createTextNode(plain);
      range.insertNode(node);
      // mover caret al final del texto insertado
      range.setStartAfter(node);
      range.setEndAfter(node);
      sel.removeAllRanges();
      sel.addRange(range);
    } else {
      // fallback
      document.execCommand('insertText', false, plain);
    }

    handleContentChange();
  };

  // --- 2) Pegado y arrastre limpios que preservan espacios ---
const handlePaste = (e: React.ClipboardEvent<HTMLDivElement>) => {
  e.preventDefault();
  const text = e.clipboardData.getData('text/plain') || '';
  const html = textToHtmlPreserveWhitespace(text);
  document.execCommand('insertHTML', false, html);
  handleContentChange();
};

  const handleDrop = (e: React.DragEvent<HTMLDivElement>) => {
  // Si arrastran texto, trátalo parecido al paste
  const dt = e.dataTransfer;
  // Evita que el navegador inserte HTML con estilos raros
  e.preventDefault();
  const text = dt.getData('text/plain') || '';
  const html = textToHtmlPreserveWhitespace(text);
  document.execCommand('insertHTML', false, html);
  handleContentChange();
};

  // --- 1) Helpers para preservar espacios en blanco ---
function escapeHtml(s: string) {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

/**
 * Convierte texto plano a HTML preservando:
 * - Múltiples espacios (convierte n>=2 en &nbsp; ... + ' ')
 * - Tabs (4 espacios)
 * - Saltos de línea (\n -> <br>)
 */
function textToHtmlPreserveWhitespace(text: string) {
  if (!text) return '';
  // Normaliza finales de línea
  let t = text.replace(/\r\n?/g, '\n');
  // Tabs → 4 espacios (ajusta si quieres otro ancho)
  t = t.replace(/\t/g, '    ');
  // Escapar HTML
  t = escapeHtml(t);
  // Preservar múltiples espacios: para cada racha de 2+ espacios,
  // reemplaza por (&nbsp;) repetidos y termina en un espacio normal.
  t = t.replace(/ {2,}/g, (m) => '&nbsp;'.repeat(m.length - 1) + ' ');
  // Saltos de línea -> <br>
  t = t.replace(/\n/g, '<br>');
  return t;
}

  // ---------- guardar ----------
  const handleSave = () => {
  const tema = title.trim();
  const htmlRaw = (contentRef.current?.innerHTML ?? '').trim();
  if (!tema || !htmlRaw) return;

  const html = cleanHtml(htmlRaw); // <<< SANITIZA ANTES DE GUARDAR

  if (isEditing) {
    onUpdate({ _id: article?._id, tema, contenidos: [html] });
    return;
  }
  onSave({ _id: article?._id, tema, contenidos: [html] });
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
        <div className="flex flex-wrap items-center gap-2 mb-4 p-2 bg-gray-50 rounded-lg">
          {/* Bold/Italic/Underline */}
          <button onClick={() => formatText('bold')} className="p-2 hover:bg-gray-200 rounded" title="Negrita">
            <Bold className="w-4 h-4" />
          </button>
          <button onClick={() => formatText('italic')} className="p-2 hover:bg-gray-200 rounded" title="Cursiva">
            <Italic className="w-4 h-4" />
          </button>
          <button onClick={() => formatText('underline')} className="p-2 hover:bg-gray-200 rounded" title="Subrayado">
            <Underline className="w-4 h-4" />
          </button>

          {/* Listas */}
          <button onClick={() => formatText('insertUnorderedList')} className="p-2 hover:bg-gray-200 rounded" title="Lista con viñetas">
            <List className="w-4 h-4" />
          </button>
          <button onClick={() => formatText('insertOrderedList')} className="p-2 hover:bg-gray-200 rounded" title="Lista numerada">
            <ListOrdered className="w-4 h-4" />
          </button>

          {/* Tabla (si ya tenías lógica, ponla aquí) */}
          <button onClick={() => { /* tu lógica para insertar tabla */ }} className="p-2 hover:bg-gray-200 rounded" title="Insertar tabla">
            <Table className="w-4 h-4" />
          </button>

          {/* Resaltar */}
          <div className="flex items-center gap-2">
            <button onClick={() => formatText('backColor', highlightColor)} className="p-2 hover:bg-gray-200 rounded" title="Resaltar">
              <Highlighter className="w-4 h-4" />
            </button>
            <input type="color" value={highlightColor} onChange={(e) => setHighlightColor(e.target.value)} />
          </div>

          {/* Enmarcar (simple; opcional mejorar con selección) */}
          <div className="flex items-center gap-2">
            <button
              onClick={() => formatText(
                'insertHTML',
                `<span style="border:1px solid ${borderColor};padding:2px 6px;border-radius:6px;display:inline-block;">${window.getSelection()?.toString() || '&nbsp;'}</span>`
              )}
              className="p-2 hover:bg-gray-200 rounded"
              title="Enmarcar"
            >
              <Square className="w-4 h-4" />
            </button>
            <input type="color" value={borderColor} onChange={(e) => setBorderColor(e.target.value)} />
          </div>

          {/* Color de texto */}
          <div className="flex items-center gap-2">
            <button onClick={applyTextColor} className="p-2 hover:bg-gray-200 rounded" title="Color de texto">
              <Type className="w-4 h-4" />
            </button>
            <input type="color" value={textColor} onChange={(e) => setTextColor(e.target.value)} />
          </div>

          {/* Tamaño de texto */}
          <select
            value={fontSize}
            onChange={(e) => setFontSize(e.target.value)}
            onBlur={applyFontSize}
            className="border rounded p-1 text-sm"
            title="Tamaño de texto"
          >
            <option value="1">Muy pequeño</option>
            <option value="2">Pequeño</option>
            <option value="3">Normal</option>
            <option value="4">Grande</option>
            <option value="5">Muy grande</option>
            <option value="6">Extra grande</option>
            <option value="7">Gigante</option>
          </select>
        </div>

        {/* Editor */}
        <div className="relative">
          {!content && <div className="absolute top-2 left-3 text-gray-400 text-sm pointer-events-none">Ingrese el contenido...</div>}
          <div
  ref={contentRef}
  contentEditable
  onInput={handleContentChange}
  onPaste={handlePaste}
  onDrop={handleDrop}
  className="content-editable relative min-h-64 p-4 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none prose prose-sm max-w-none"
  style={{
    minHeight: '200px',
    whiteSpace: 'pre-wrap', // 3) respeta espacios/saltos al renderizar
  }}
/>
        </div>
      </div>
    </div>
  );
};

export default ArticleEditor; 