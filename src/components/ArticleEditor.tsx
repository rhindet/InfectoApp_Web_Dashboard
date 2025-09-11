import React, { useEffect, useRef, useState } from 'react';
import {
  Bold, Italic, Underline, List, ListOrdered, Save, X, Table,
  PlusCircle, Highlighter, Square, Type, ImagePlus
} from 'lucide-react';
import { Article } from '../types';

interface ArticleEditorProps {
  article?: Article;
  onSave: (article: Partial<Article>) => void;
  onUpdate: (article: Partial<Article>) => void;
  onCancel: () => void;
}

const ArticleEditor: React.FC<ArticleEditorProps> = ({ article, onSave, onCancel, onUpdate }) => {
  const [title, setTitle] = useState<string>(article?.tema ?? '');
  const [content, setContent] = useState<string>(article?.contenidos?.[0] ?? '');
  const contentRef = useRef<HTMLDivElement>(null);

  // colores / tipografía (toolbar)
  const [highlightColor, setHighlightColor] = useState('#FFF3CD');
  const [borderColor, setBorderColor] = useState('#000000');
  const [textColor, setTextColor] = useState('#000000');
  const [fontSize, setFontSize] = useState('3'); // 1..7 (execCommand)

  const lastRangeRef = useRef<Range | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

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

  // ---------- Normalización: forzar <p> en top-level ----------
  const normalizeTopLevelToParagraphs = () => {
    const root = contentRef.current;
    if (!root) return;

    rememberRangeIfInside();

    let node: ChildNode | null = root.firstChild;
    let currentP: HTMLParagraphElement | null = null;

    const isBlockKeep = (el: HTMLElement) =>
      ['P', 'UL', 'OL', 'TABLE', 'PRE', 'BLOCKQUOTE'].includes(el.tagName);

    while (node) {
      const next = node.nextSibling;

      if (node.nodeType === Node.TEXT_NODE) {
        const txt = node.textContent ?? '';
        if (txt.trim() === '') {
          root.removeChild(node);
        } else {
          if (!currentP) {
            currentP = document.createElement('p');
            root.insertBefore(currentP, node);
          }
          currentP.appendChild(node);
        }
      } else if (node.nodeType === Node.ELEMENT_NODE) {
        const el = node as HTMLElement;
        const tag = el.tagName;

        if (tag === 'BR') {
          if (!currentP) {
            currentP = document.createElement('p');
            root.insertBefore(currentP, el);
          }
          currentP.appendChild(el);
        } else if (['DIV','H1','H2','H3','H4','H5','H6'].includes(tag)) {
          const p = document.createElement('p');
          while (el.firstChild) p.appendChild(el.firstChild);
          root.replaceChild(p, el);
          currentP = null;
        } else if (isBlockKeep(el)) {
          currentP = null;
        } else {
          if (!currentP) {
            currentP = document.createElement('p');
            root.insertBefore(currentP, el);
          }
          currentP.appendChild(el);
        }
      }

      node = next;
    }

    root.querySelectorAll('p').forEach(p => {
      const onlyWhitespace = !(p.textContent ?? '').trim();
      const noChildren = p.children.length === 0;
      if (onlyWhitespace && noChildren) p.innerHTML = '<br>';
    });

    restoreRange();
  };

  // ---------- ciclo de vida ----------
  useEffect(() => {
    setTitle(article?.tema ?? '');
    const initial = article?.contenidos?.[0] ?? '';
    setContent(initial);
    if (contentRef.current) {
      contentRef.current.innerHTML = initial;
      normalizeTopLevelToParagraphs();
    }
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

  // ---------- helpers UI ----------
  const handleContentChange = () => {
    normalizeTopLevelToParagraphs();
    if (contentRef.current) setContent(contentRef.current.innerHTML);
  };

  const formatText = (command: string, value?: string) => {
    const el = contentRef.current;
    if (!el) return;
    el.focus();
    if (!restoreRange()) placeCaretAtEnd(el);

    document.execCommand(command, false, value);

    if (command === 'insertUnorderedList' || command === 'insertOrderedList') {
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
      if (node instanceof HTMLElement && (node.tagName === 'UL' || node.tagName === 'OL')) {
        const isOl = node.tagName === 'OL';
        if (!node.getAttribute('style')) {
          node.setAttribute(
            'style',
            `${isOl ? 'list-style: decimal;' : 'list-style: disc;'} padding-left: 1.25rem; margin: 0.5rem 0;`
          );
        }
        node.querySelectorAll('li').forEach(li => {
          if (!(li as HTMLElement).innerHTML.trim()) (li as HTMLElement).innerHTML = '&nbsp;';
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
      if (node instanceof HTMLElement && node.tagName === 'P') {
        node.style.marginLeft = '0';
        node.style.paddingLeft = '0';
        node.style.textIndent = '0';
        break;
      }
      node = node.parentNode as Node | null;
    }
  };

  // ---------- PEGADO/ARRASTRE ----------
  function escapeHtml(s: string) {
    return s
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }
  function textToHtmlPreserveWhitespace(text: string) {
    if (!text) return '';
    let t = text.replace(/\r\n?/g, '\n');
    t = t.replace(/\t/g, '    ');
    t = escapeHtml(t);
    t = t.replace(/ {2,}/g, (m) => '&nbsp;'.repeat(m.length - 1) + ' ');
    t = t.replace(/\n/g, '<br>');
    return t;
  }

  // === Saneador que CONSERVA bold/italic/underline y font-size (y ahora IMG) ===
  const ALLOWED_TAGS = new Set([
    'P','BR','B','STRONG','I','EM','U','SPAN',
    'H1','H2','H3','H4','H5','H6',
    'UL','OL','LI',
    'A',
    'TABLE','THEAD','TBODY','TFOOT','TR','TH','TD',
    'IMG'
  ]);

  const ALLOWED_ATTRS: Record<string, Set<string>> = {
    'A': new Set(['href','title','target','rel']),
    'TH': new Set(['colspan','rowspan','scope']),
    'TD': new Set(['colspan','rowspan']),
    'IMG': new Set(['src','alt','width','height'])
  };

  const ALLOWED_STYLES = new Set([
    'font-weight',
    'font-style',
    'text-decoration',
    'font-size',
    'max-width','width','height'
  ]);

  function keepOnlyAllowedStyles(styleValue: string): string {
    if (!styleValue) return '';
    const kept: string[] = [];
    const rules = styleValue.split(';');
    for (let rule of rules) {
      rule = rule.trim();
      if (!rule) continue;
      const [propRaw, ...valueParts] = rule.split(':');
      if (!propRaw || valueParts.length === 0) continue;
      const prop = propRaw.trim().toLowerCase();
      const val = valueParts.join(':').trim();

      if (prop.startsWith('--tw-')) continue;
      if (ALLOWED_STYLES.has(prop)) {
        kept.push(`${prop}: ${val}`);
      }
    }
    return kept.join('; ');
  }

  function sanitizeClipboardHtml(html: string): string {
    const parser = new DOMParser();
    const doc = parser.parseFromString(`<div id="__root">${html}</div>`, 'text/html');
    const root = doc.getElementById('__root') as HTMLElement;
    if (!root) return html;

    doc.querySelectorAll('meta, title, style, script, link').forEach(n => n.remove());

    const walker = doc.createTreeWalker(root, NodeFilter.SHOW_ELEMENT, null);
    const toUnwrap: Element[] = [];
    const toRemove: Element[] = [];

    while (walker.nextNode()) {
      const el = walker.currentNode as HTMLElement;

      if (el.className && /(^|\s)Mso[\w-]*/i.test(el.className)) {
        el.removeAttribute('class');
      }

      if (!ALLOWED_TAGS.has(el.tagName)) {
        if (el.tagName !== 'SCRIPT' && el.tagName !== 'STYLE' && el.tagName !== 'LINK') {
          toUnwrap.push(el);
        } else {
          toRemove.push(el);
        }
        continue;
      }

      [...el.attributes].forEach(attr => {
        const name = attr.name.toLowerCase();

        if (name === 'style') {
          const kept = keepOnlyAllowedStyles(attr.value);
          if (kept) el.setAttribute('style', kept);
          else el.removeAttribute('style');
          return;
        }

        if (el.tagName === 'A') {
          if (!ALLOWED_ATTRS['A'].has(attr.name)) {
            el.removeAttribute(attr.name);
          } else if (attr.name === 'href') {
            const v = attr.value.trim();
            if (/^javascript:/i.test(v)) el.removeAttribute('href');
          }
          return;
        }

        if ((el.tagName === 'TH' || el.tagName === 'TD')) {
          if (!ALLOWED_ATTRS[el.tagName]?.has(attr.name)) {
            el.removeAttribute(attr.name);
          }
          return;
        }

        if (el.tagName === 'IMG') {
          if (!ALLOWED_ATTRS['IMG'].has(attr.name)) {
            el.removeAttribute(attr.name);
          } else if (attr.name === 'src') {
            const v = attr.value.trim();
            if (/^javascript:/i.test(v)) el.removeAttribute('src');
          }
          return;
        }

        el.removeAttribute(attr.name);
      });
    }

    toRemove.forEach(n => n.remove());
    toUnwrap.forEach(el => {
      const frag = doc.createDocumentFragment();
      while (el.firstChild) frag.appendChild(el.firstChild);
      el.replaceWith(frag);
    });

    root.querySelectorAll('p').forEach(p => {
      const htmlP = p.innerHTML
        .replace(/&nbsp;/gi, '')
        .replace(/\s+/g, '')
        .replace(/<br\s*\/?>/gi, '');
      if (!htmlP) p.remove();
    });

    return root.innerHTML;
  }

  // >>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>
  // PASTE FIX: priorizamos HTML, luego texto, y files al final.
  const handlePaste = async (e: React.ClipboardEvent<HTMLDivElement>) => {
    e.preventDefault();

    const dt = e.clipboardData;

    // 1) Si viene HTML (Word/Docs), úsalo primero
    const htmlClip = dt.getData('text/html');
    if (htmlClip && htmlClip.trim()) {
      const safe = sanitizeClipboardHtml(htmlClip);
      document.execCommand('insertHTML', false, safe);
      normalizeTopLevelToParagraphs();
      handleContentChange();
      return;
    }

    // 2) Si no hay HTML, intenta texto plano
    const text = dt.getData('text/plain');
    if (text && text.trim()) {
      const html = textToHtmlPreserveWhitespace(text);
      document.execCommand('insertHTML', false, html);
      normalizeTopLevelToParagraphs();
      handleContentChange();
      return;
    }

    // 3) Si no hay HTML ni texto, revisa archivos (imágenes del portapapeles)
    const files = dt?.files;
    if (files && files.length) {
      for (const f of Array.from(files)) {
        if (f.type.startsWith('image/')) {
          await handleImageFile(f);
        }
      }
      return;
    }
  };
  // <<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<

  const handleDrop = async (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();

    // Archivos arrastrados
    if (e.dataTransfer?.files?.length) {
      for (const f of Array.from(e.dataTransfer.files)) {
        if (f.type.startsWith('image/')) await handleImageFile(f);
      }
      return;
    }

    // Texto/URL arrastrado
    const text = e.dataTransfer.getData('text/plain') || '';
    if (/^https?:\/\/.+\.(png|jpe?g|gif|webp|svg)(\?.*)?$/i.test(text)) {
      insertImageAtSelection(text);
      return;
    }

    const html = textToHtmlPreserveWhitespace(text);
    document.execCommand('insertHTML', false, html);
    normalizeTopLevelToParagraphs();
    handleContentChange();
  };

  // ---------- Sanitizador antes de guardar ----------
  function cleanHtml(dirty: string): string {
    if (!dirty) return '';

    const raw = dirty.replace(/\uFEFF/g, '').trim();

    const parser = new DOMParser();
    const doc = parser.parseFromString(`<div id="root">${raw}</div>`, 'text/html');
    const root = doc.getElementById('root') as HTMLElement;
    if (!root) return raw;

    doc.querySelectorAll('meta, title, style, script, link').forEach(n => n.remove());

    // Unwrap h1..h3 si envuelven TODO
    root.querySelectorAll('h1, h2, h3').forEach(h => {
      if (h === root.firstElementChild && h === root.lastElementChild) {
        const frag = doc.createDocumentFragment();
        while (h.firstChild) frag.appendChild(h.firstChild);
        h.replaceWith(frag);
      }
    });

    root.querySelectorAll<HTMLElement>('*').forEach(el => {
      if (el.className && /(^|\s)Mso[\w-]*/i.test(el.className)) el.removeAttribute('class');

      if (el.hasAttribute('style')) {
        const css = el.getAttribute('style') || '';
        const cleaned = css
          .split(';')
          .map(s => s.trim())
          .filter(s => s && !s.startsWith('--tw-'))
          .join('; ');
        if (cleaned) el.setAttribute('style', cleaned);
        else el.removeAttribute('style');
      }

      if (el.tagName === 'SPAN' && el.textContent?.trim() === '' && !el.children.length) {
        el.remove();
      }
    });

    root.querySelectorAll('ul, ol').forEach(list => {
      if (!list.querySelector('li')) list.remove();
    });

    // Seguridad adicional para IMG
    root.querySelectorAll('img[src]').forEach((img: Element) => {
      const src = (img as HTMLImageElement).getAttribute('src') || '';
      if (/^javascript:/i.test(src)) (img as HTMLElement).remove();
      // Si no quieres permitir data: en persistencia final, descomenta:
      // if (/^data:/i.test(src)) (img as HTMLElement).remove();
    });

    root.innerHTML = root.innerHTML
      .replace(/(&nbsp;|\s)+<\/(p|li)>/gi, '</$2>')
      .replace(/(<p>\s*<\/p>)+/gi, '<p><br></p>');

    // Normaliza top-level a <p> antes de devolver
    const tempHost = document.createElement('div');
    tempHost.innerHTML = root.innerHTML;
    const top = tempHost;

    let node: ChildNode | null = top.firstChild;
    let currentP: HTMLParagraphElement | null = null;

    const isBlockKeep = (el: HTMLElement) =>
      ['P','UL','OL','TABLE','PRE','BLOCKQUOTE'].includes(el.tagName);

    while (node) {
      const next = node.nextSibling;

      if (node.nodeType === Node.TEXT_NODE) {
        const txt = node.textContent ?? '';
        if (txt.trim() === '') {
          top.removeChild(node);
        } else {
          if (!currentP) {
            currentP = document.createElement('p');
            top.insertBefore(currentP, node);
          }
          currentP.appendChild(node);
        }
      } else if (node.nodeType === Node.ELEMENT_NODE) {
        const el = node as HTMLElement;
        const tag = el.tagName;
        if (tag === 'BR') {
          if (!currentP) {
            currentP = document.createElement('p');
            top.insertBefore(currentP, el);
          }
          currentP.appendChild(el);
        } else if (['DIV','H1','H2','H3','H4','H5','H6'].includes(tag)) {
          const p = document.createElement('p');
          while (el.firstChild) p.appendChild(el.firstChild);
          top.replaceChild(p, el);
          currentP = null;
        } else if (isBlockKeep(el)) {
          currentP = null;
        } else {
          if (!currentP) {
            currentP = document.createElement('p');
            top.insertBefore(currentP, el);
          }
          currentP.appendChild(el);
        }
      }

      node = next;
    }

    top.querySelectorAll('p').forEach(p => {
      const onlyWhitespace = !(p.textContent ?? '').trim();
      const noChildren = p.children.length === 0;
      if (onlyWhitespace && noChildren) p.innerHTML = '<br>';
    });

    return top.innerHTML.trim();
  }

  // ---------- toolbar helpers ----------
  const applyTextColor = () => formatText('foreColor', textColor);
  const applyFontSize = () => formatText('fontSize', fontSize);

  // ---------- INSERTAR TABLA ----------
  const insertTable = (rows = 2, cols = 2, withHeader = true) => {
    const el = contentRef.current;
    if (!el) return;

    el.focus();
    if (!restoreRange()) placeCaretAtEnd(el);

    const clamp = (n: number, min: number, max: number) => Math.max(min, Math.min(max, n));
    rows = clamp(rows, 1, 20);
    cols = clamp(cols, 1, 20);

    const makeCells = (count: number, tag: 'th' | 'td') =>
      Array.from({ length: count })
        .map(() => `<${tag}> </${tag}>`)
        .join('');

    const thead = withHeader ? `<thead><tr>${makeCells(cols, 'th')}</tr></thead>` : '';
    const bodyRows = Array.from({ length: rows })
      .map(() => `<tr>${makeCells(cols, 'td')}</tr>`)
      .join('');

    const tableHtml = `
      <table style="border-collapse:collapse; width:100%; margin:8px 0;">
        ${thead}
        <tbody>${bodyRows}</tbody>
      </table>
      <p><br></p>
    `.trim();

    document.execCommand('insertHTML', false, tableHtml);

    const selection = window.getSelection();
    if (selection && el.lastChild instanceof HTMLElement) {
      placeCaretAtEnd(el.lastChild as HTMLElement);
    }

    normalizeTopLevelToParagraphs();
    handleContentChange();
  };

  // ---------- guardar ----------
  const handleSave = () => {
    const tema = title.trim();
    const htmlRaw = (contentRef.current?.innerHTML ?? '').trim();
    if (!tema || !htmlRaw) return;

    const html = cleanHtml(htmlRaw);

    if (isEditing) {
      onUpdate({ _id: article?._id, tema, contenidos: [html] });
      return;
    }
    onSave({ _id: article?._id, tema, contenidos: [html] });
  };

  const isEditing = Boolean(article?._id);

  // ---------- Estado del modal de tabla ----------
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

  // ---------- Helpers de resaltado (toggle) ----------
  function toRgbString(input: string): string {
    const tmp = document.createElement('span');
    tmp.style.backgroundColor = input;
    document.body.appendChild(tmp);
    const rgb = getComputedStyle(tmp).backgroundColor;
    document.body.removeChild(tmp);
    return rgb;
  }

  function forEachElementInRange(range: Range, root: HTMLElement, cb: (el: HTMLElement) => void) {
    const common = range.commonAncestorContainer;
    const walker = document.createTreeWalker(
      (common.nodeType === 1 ? common : common.parentElement!) as Element,
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
      document.execCommand('backColor', false, highlightColor);
      handleContentChange();
      return;
    }

    const targetRgb = toRgbString(highlightColor);
    const currentCmdVal =
      document.queryCommandValue('hiliteColor') || document.queryCommandValue('backColor') || '';
    const currentRgb = currentCmdVal ? toRgbString(currentCmdVal) : '';

    const shouldRemove = currentRgb && currentRgb === targetRgb;

    if (!shouldRemove) {
      document.execCommand('backColor', false, highlightColor);
      handleContentChange();
      return;
    }

    forEachElementInRange(range, el, (node) => {
      const bg = getComputedStyle(node).backgroundColor;
      if (bg && toRgbString(bg) === targetRgb) {
        const style = node.getAttribute('style') || '';
        if (style.includes('background-color')) {
          const cleaned = style
            .split(';')
            .map(s => s.trim())
            .filter(s => s && !/^background-color\s*:/i.test(s))
            .join('; ');
          if (cleaned) node.setAttribute('style', cleaned);
          else node.removeAttribute('style');
        }
      }
    });

    document.execCommand('backColor', false, 'transparent');
    handleContentChange();
  };

  // ---------- IMÁGENES ----------
  const insertImageAtSelection = (src: string, alt = '') => {
    const el = contentRef.current;
    if (!el) return;
    el.focus();
    if (!restoreRange()) placeCaretAtEnd(el);

    const imgHtml = `<img src="${src}" alt="${escapeHtml(alt)}" style="max-width:100%;height:auto;" />`;
    document.execCommand('insertHTML', false, `<p>${imgHtml}</p><p><br></p>`);
    normalizeTopLevelToParagraphs();
    handleContentChange();
  };

  const readFileAsDataURL = (file: File) =>
    new Promise<string>((resolve, reject) => {
      const r = new FileReader();
      r.onload = () => resolve(r.result as string);
      r.onerror = reject;
      r.readAsDataURL(file);
    });

  const handleImageFile = async (file: File) => {
    if (!file.type.startsWith('image/')) return;
    // Reemplaza por upload a tu backend si lo prefieres:
    const dataUrl = await readFileAsDataURL(file);
    insertImageAtSelection(dataUrl, file.name);
  };

  const chooseImageFromDisk = () => fileInputRef.current?.click();

  const insertImageFromUrl = () => {
    const url = window.prompt('Pega la URL de la imagen:')?.trim();
    if (!url) return;
    if (/^javascript:/i.test(url)) return;
    insertImageAtSelection(url);
  };

  return (
    <div className="bg-white rounded-lg shadow-sm border">
      {/* CSS SOLO PARA EL EDITOR (no se guarda) */}
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

          /* Estilos para tablas dentro del editor */
          .content-editable table { border-collapse: collapse; width: 100%; }
          .content-editable th, .content-editable td { border: 1px solid #e5e7eb; padding: 6px; vertical-align: top; }
          .content-editable thead th { background: #f3f4f6; }

          /* Imágenes responsivas */
          .content-editable img {
            max-width: 100%;
            height: auto;
            display: inline-block;
          }
        `}
      </style>

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

          {/* Tabla -> abre modal */}
          <button
            onClick={openTableModal}
            className="p-2 hover:bg-gray-200 rounded"
            title="Insertar tabla"
          >
            <Table className="w-4 h-4" />
          </button>

          {/* Imagen */}
          <div className="flex items-center gap-2">
            <button
              onClick={chooseImageFromDisk}
              className="p-2 hover:bg-gray-200 rounded"
              title="Insertar imagen (archivo)"
            >
              <ImagePlus className="w-4 h-4" />
            </button>
            <button
              onClick={insertImageFromUrl}
              className="px-2 py-1 border rounded text-sm hover:bg-gray-200"
              title="Insertar imagen desde URL"
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
                e.currentTarget.value = '';
              }}
            />
          </div>

          {/* Resaltar (toggle) */}
          <div className="flex items-center gap-2">
            <button onClick={toggleHighlight} className="p-2 hover:bg-gray-200 rounded" title="Resaltar (toggle)">
              <Highlighter className="w-4 h-4" />
            </button>
            <input type="color" value={highlightColor} onChange={(e) => setHighlightColor(e.target.value)} />
          </div>

          {/* Enmarcar (simple) */}
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
            style={{ minHeight: '200px', whiteSpace: 'pre-wrap' }}
          />
        </div>
      </div>

      {/* Modal de configuración de tabla */}
      {tableModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          {/* backdrop */}
          <div className="absolute inset-0 bg-black/40" onClick={closeTableModal} />
          {/* dialog */}
          <div className="relative z-10 w-full max-w-sm bg-white rounded-xl shadow-lg border p-5">
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-lg font-semibold">Insertar tabla</h3>
              <button onClick={closeTableModal} className="p-1 rounded hover:bg-gray-100">
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
                  onChange={(e) => setTableRows(Math.max(1, Math.min(20, Number(e.target.value) || 1)))}
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
                  onChange={(e) => setTableCols(Math.max(1, Math.min(20, Number(e.target.value) || 1)))}
                  className="w-full border rounded px-3 py-2 outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
              <label className="inline-flex items-center gap-2 select-none">
                <input
                  type="checkbox"
                  checked={tableHeader}
                  onChange={(e) => setTableHeader(e.target.checked)}
                />
                <span className="text-sm text-gray-700">Encabezado</span>
              </label>
            </div>

            <div className="mt-4 flex justify-end gap-2">
              <button
                onClick={closeTableModal}
                className="px-4 py-2 rounded-lg border hover:bg-gray-50"
              >
                Cancelar
              </button>
              <button
                onClick={confirmInsertTable}
                className="px-4 py-2 rounded-lg bg-blue-600 text-white hover:bg-blue-700"
              >
                Insertar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default ArticleEditor;