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

  // colores
  const [highlightColor, setHighlightColor] = useState('#FFF3CD');
  const [borderColor, setBorderColor] = useState('#000000');
  const [textColor, setTextColor] = useState('#000000'); // nuevo: color de texto
  const [fontSize, setFontSize] = useState('3'); // nuevo: tamaño de texto (1-7)

  const lastRangeRef = useRef<Range | null>(null);
  const HIGHLIGHT_ATTR = 'data-highlight';
  const BORDER_ATTR = 'data-border';

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

  // aplicar color de texto
  const applyTextColor = () => {
    formatText('foreColor', textColor);
  };

  // aplicar tamaño de texto
  const applyFontSize = () => {
    formatText('fontSize', fontSize);
  };

  const handleSave = () => {
    const tema = title.trim();
    const html = (contentRef.current?.innerHTML ?? '').trim();
    if (!tema || !html) return;

    if (isEditing) {
      onUpdate({
        _id: article?._id,
        tema,
        contenidos: [html],
      });
      return;
    }

    onSave({
      _id: article?._id,
      tema,
      contenidos: [html],
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

          {/* Tabla */}
          <button onClick={() => {}} className="p-2 hover:bg-gray-200 rounded" title="Insertar tabla">
            <Table className="w-4 h-4" />
          </button>

          {/* Resaltar */}
          <div className="flex items-center gap-2">
            <button onClick={() => formatText('backColor', highlightColor)} className="p-2 hover:bg-gray-200 rounded" title="Resaltar">
              <Highlighter className="w-4 h-4" />
            </button>
            <input type="color" value={highlightColor} onChange={(e) => setHighlightColor(e.target.value)} />
          </div>

          {/* Enmarcar */}
          <div className="flex items-center gap-2">
            <button onClick={() => formatText('insertHTML', `<span style="border:1px solid ${borderColor};padding:2px 6px;border-radius:6px;">${window.getSelection()}</span>`)} className="p-2 hover:bg-gray-200 rounded" title="Enmarcar">
              <Square className="w-4 h-4" />
            </button>
            <input type="color" value={borderColor} onChange={(e) => setBorderColor(e.target.value)} />
          </div>

          {/* Nuevo: Color texto */}
          <div className="flex items-center gap-2">
            <button onClick={applyTextColor} className="p-2 hover:bg-gray-200 rounded" title="Color de texto">
              <Type className="w-4 h-4" />
            </button>
            <input type="color" value={textColor} onChange={(e) => setTextColor(e.target.value)} />
          </div>

          {/* Nuevo: Tamaño texto */}
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
            className="content-editable relative min-h-64 p-4 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none prose prose-sm max-w-none"
            style={{ minHeight: '200px' }}
          />
        </div>
      </div>
    </div>
  );
};

export default ArticleEditor;