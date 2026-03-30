import { useEditor, EditorContent } from '@tiptap/react'
import StarterKit from '@tiptap/starter-kit'
import Underline from '@tiptap/extension-underline'
import TextAlign from '@tiptap/extension-text-align'
import Highlight from '@tiptap/extension-highlight'
import Image from '@tiptap/extension-image'
import Link from '@tiptap/extension-link'
import MergeTagPicker from './MergeTagPicker.jsx'
import { mergeTemplate, buildMergeData } from '../lib/mergeTemplate.js'
import { useState, useRef } from 'react'

const SAMPLE_PREVIEW_DATA = {
  job: {
    name: '26-13874-WTR-ONT',
    customer: 'John & Jane Smith',
    address_1: '1234 Oak Street',
    city: 'Ontario',
    state: 'CA',
    zip_code: '91764',
    mailing_address_1: '',
    mailing_city: '',
    mailing_state: '',
    mailing_zip_code: '',
    total_invoice_amount: 12500,
    total_payment_amount: 2000,
  },
  settings: {
    company_name: 'Allied Restoration Services',
    address_line1: '3120 E Garvey Ave S',
    city: 'West Covina',
    state: 'CA',
    zip: '91791',
    license_org: 'CSLB',
    license_number: '908870',
    logo_url: null,
  },
  member: {
    display_name: 'Tim Bauer',
    rep_phone: '(626) 555-0100',
    rep_email: 'tim@alliedrestoration.com',
  },
  dueDate: '05/15/2026',
}

// Patterns that look like forgotten/malformed merge tags
const SUSPICIOUS_TAG_PATTERNS = [
  { regex: /<<[^>]+>>/g, label: '<<…>>' },
  { regex: /\[\[[^\]]+\]\]/g, label: '[[…]]' },
  { regex: /\[\{[^}]+\}\]/g, label: '[{…}]' },
  // Single-brace {word} but NOT {{word}} — use negative lookahead/lookbehind
  { regex: /(?<!\{)\{(?!\{)[A-Za-z]\w*\}(?!\})/g, label: '{…}' },
]

function findSuspiciousTags(html) {
  // Strip HTML tags for pattern matching
  const text = html.replace(/<[^>]+>/g, ' ')
  const found = []
  for (const { regex, label } of SUSPICIOUS_TAG_PATTERNS) {
    const matches = text.match(regex)
    if (matches) {
      matches.forEach(m => {
        if (!found.includes(m)) found.push(m)
      })
    }
  }
  return found
}

export default function TemplateEditor({ value, onChange, previewData }) {
  const [showPreview, setShowPreview] = useState(false)
  const [suspiciousTags, setSuspiciousTags] = useState([])
  const [warnDismissed, setWarnDismissed] = useState(false)
  const [highlightColor, setHighlightColor] = useState('#ffff00')
  const [showImageInput, setShowImageInput] = useState(false)
  const [imageUrl, setImageUrl] = useState('')
  const [imageWidth, setImageWidth] = useState('100')
  const imageUrlRef = useRef(null)
  const [showLinkInput, setShowLinkInput] = useState(false)
  const [linkUrl, setLinkUrl] = useState('')
  const [linkText, setLinkText] = useState('')
  const linkUrlRef = useRef(null)

  const editor = useEditor({
    extensions: [
      StarterKit,
      Underline,
      TextAlign.configure({ types: ['heading', 'paragraph'] }),
      Highlight.configure({ multicolor: true }),
      Image.configure({ inline: false, allowBase64: false }),
      Link.configure({ openOnClick: false, HTMLAttributes: { target: '_blank', rel: 'noopener noreferrer' } }),
    ],
    content: value || '',
    editorProps: {
      attributes: { class: 'letter-body' },
      handleKeyDown(view, event) {
        if (event.key === 'Tab') {
          event.preventDefault()
          // Insert 4 non-breaking spaces so indentation survives HTML rendering
          view.dispatch(view.state.tr.insertText('\u00a0\u00a0\u00a0\u00a0'))
          return true
        }
        return false
      },
    },
    onUpdate: ({ editor }) => {
      const html = editor.getHTML()
      onChange(html)
      const found = findSuspiciousTags(html)
      setSuspiciousTags(found)
      if (found.length > 0) setWarnDismissed(false)
    },
  })

  function handleInsertTag(tag) {
    editor?.chain().focus().insertContent(tag).run()
  }

  function openLinkInput() {
    // Pre-fill with selected text and existing link href if any
    const selectedText = editor?.state.doc.textBetween(
      editor.state.selection.from,
      editor.state.selection.to,
      ''
    ) || ''
    const existingHref = editor?.getAttributes('link').href || ''
    setLinkText(selectedText)
    setLinkUrl(existingHref)
    setShowLinkInput(true)
    setShowImageInput(false)
    setTimeout(() => linkUrlRef.current?.focus(), 50)
  }

  function insertLink() {
    const href = linkUrl.trim()
    if (!href) { editor?.chain().focus().unsetLink().run(); setShowLinkInput(false); return }
    if (linkText && !editor?.state.selection.empty) {
      // Replace selection with link
      editor?.chain().focus().setLink({ href }).run()
    } else if (linkText) {
      // Insert new linked text at cursor
      editor?.chain().focus().insertContent(`<a href="${href}">${linkText}</a>`).run()
    } else {
      editor?.chain().focus().setLink({ href }).run()
    }
    setShowLinkInput(false)
    setLinkUrl('')
    setLinkText('')
  }

  function insertImage() {
    const src = imageUrl.trim()
    if (!src) return
    const w = parseInt(imageWidth, 10)
    const style = (w > 0 && w <= 100) ? ` style="width:${w}%"` : ''
    editor?.chain().focus().insertContent(`<img src="${src}"${style} />`).run()
    setShowImageInput(false)
    setImageUrl('')
  }

  const activePreviewData = previewData || SAMPLE_PREVIEW_DATA
  const previewHtml = showPreview
    ? mergeTemplate(editor?.getHTML() || '', buildMergeData(activePreviewData))
    : null

  if (!editor) return null

  const showWarning = suspiciousTags.length > 0 && !warnDismissed

  return (
    <div>
      <div style={{
        display: 'flex', flexWrap: 'wrap', gap: 4, marginBottom: 8,
        padding: '6px 8px', background: 'var(--color-bg)', border: '1px solid var(--color-border)',
        borderRadius: 'var(--radius)', alignItems: 'center',
      }}>
        <ToolBtn active={editor.isActive('bold')} onClick={() => editor.chain().focus().toggleBold().run()}>B</ToolBtn>
        <ToolBtn active={editor.isActive('italic')} onClick={() => editor.chain().focus().toggleItalic().run()}><i>I</i></ToolBtn>
        <ToolBtn active={editor.isActive('underline')} onClick={() => editor.chain().focus().toggleUnderline().run()}><u>U</u></ToolBtn>
        <div style={{ width: 1, background: 'var(--color-border)', height: 20, margin: '0 4px' }} />
        <ToolBtn active={editor.isActive({ textAlign: 'left' })} onClick={() => editor.chain().focus().setTextAlign('left').run()}>
          <svg width="14" height="14" viewBox="0 0 14 14" fill="currentColor">
            <rect x="0" y="1" width="14" height="2"/>
            <rect x="0" y="6" width="9" height="2"/>
            <rect x="0" y="11" width="11" height="2"/>
          </svg>
        </ToolBtn>
        <ToolBtn active={editor.isActive({ textAlign: 'center' })} onClick={() => editor.chain().focus().setTextAlign('center').run()}>
          <svg width="14" height="14" viewBox="0 0 14 14" fill="currentColor">
            <rect x="0" y="1" width="14" height="2"/>
            <rect x="2.5" y="6" width="9" height="2"/>
            <rect x="1.5" y="11" width="11" height="2"/>
          </svg>
        </ToolBtn>
        <ToolBtn active={editor.isActive({ textAlign: 'right' })} onClick={() => editor.chain().focus().setTextAlign('right').run()}>
          <svg width="14" height="14" viewBox="0 0 14 14" fill="currentColor">
            <rect x="0" y="1" width="14" height="2"/>
            <rect x="5" y="6" width="9" height="2"/>
            <rect x="3" y="11" width="11" height="2"/>
          </svg>
        </ToolBtn>
        <div style={{ width: 1, background: 'var(--color-border)', height: 20, margin: '0 4px' }} />

        {/* Highlight */}
        <div style={{ display: 'inline-flex', alignItems: 'center', gap: 2 }}>
          <ToolBtn
            active={editor.isActive('highlight')}
            onClick={() => editor.chain().focus().toggleHighlight({ color: highlightColor }).run()}
            title="Highlight text"
          >
            <span style={{ position: 'relative', fontWeight: 700, lineHeight: 1 }}>
              A
              <span style={{
                position: 'absolute', bottom: -2, left: 0, right: 0, height: 3,
                background: highlightColor, borderRadius: 1,
              }} />
            </span>
          </ToolBtn>
          <input
            type="color"
            value={highlightColor}
            onChange={e => setHighlightColor(e.target.value)}
            title="Highlight color"
            style={{ width: 20, height: 20, padding: 0, border: 'none', borderRadius: 3, cursor: 'pointer', background: 'none' }}
          />
        </div>

        {/* Link */}
        <ToolBtn
          active={editor.isActive('link') || showLinkInput}
          onClick={() => editor.isActive('link') ? editor.chain().focus().unsetLink().run() : openLinkInput()}
          title={editor.isActive('link') ? 'Remove link' : 'Insert link'}
        >
          <svg width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round">
            <path d="M5.5 8.5a3.5 3.5 0 005 0l1.5-1.5a3.5 3.5 0 00-5-5L6.5 2.5"/>
            <path d="M8.5 5.5a3.5 3.5 0 00-5 0L2 7a3.5 3.5 0 005 5l.5-.5"/>
          </svg>
        </ToolBtn>

        {/* Image */}
        <ToolBtn
          active={showImageInput}
          onClick={() => { setShowImageInput(v => !v); setShowLinkInput(false); setImageUrl(''); setTimeout(() => imageUrlRef.current?.focus(), 50) }}
          title="Insert image"
        >
          <svg width="14" height="14" viewBox="0 0 14 14" fill="currentColor">
            <rect x="0" y="0" width="14" height="14" rx="2" fill="none" stroke="currentColor" strokeWidth="1.5"/>
            <circle cx="4.5" cy="4.5" r="1.5"/>
            <path d="M0 10l3.5-3.5 2.5 2.5 2-2 4 4" fill="none" stroke="currentColor" strokeWidth="1.5"/>
          </svg>
        </ToolBtn>

        <div style={{ width: 1, background: 'var(--color-border)', height: 20, margin: '0 4px' }} />
        <MergeTagPicker onInsert={handleInsertTag} />
        <div style={{ flex: 1 }} />
        <button
          type="button"
          className="btn-secondary"
          style={{ fontSize: 12, padding: '4px 10px' }}
          onClick={() => setShowPreview(p => !p)}
        >
          {showPreview ? 'Edit' : 'Preview'}
        </button>
      </div>

      {showLinkInput && (
        <div style={{
          display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap',
          padding: '8px 10px', background: 'var(--color-bg)',
          border: '1px solid var(--color-border)', borderRadius: 'var(--radius)',
          marginBottom: 8,
        }}>
          <input
            ref={linkUrlRef}
            value={linkUrl}
            onChange={e => setLinkUrl(e.target.value)}
            placeholder="URL (https://…)"
            style={{ flex: 2, minWidth: 200, fontSize: 12 }}
            onKeyDown={e => {
              if (e.key === 'Enter') { e.preventDefault(); insertLink() }
              if (e.key === 'Escape') setShowLinkInput(false)
            }}
          />
          <input
            value={linkText}
            onChange={e => setLinkText(e.target.value)}
            placeholder="Link text (optional)"
            style={{ flex: 1, minWidth: 130, fontSize: 12 }}
            onKeyDown={e => {
              if (e.key === 'Enter') { e.preventDefault(); insertLink() }
              if (e.key === 'Escape') setShowLinkInput(false)
            }}
          />
          <button type="button" className="btn-primary" style={{ fontSize: 12, padding: '4px 12px' }} onClick={insertLink}>
            Insert
          </button>
          <button type="button" className="btn-secondary" style={{ fontSize: 12, padding: '4px 10px' }} onClick={() => setShowLinkInput(false)}>
            Cancel
          </button>
        </div>
      )}

      {showImageInput && (
        <div style={{
          display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap',
          padding: '8px 10px', background: 'var(--color-bg)',
          border: '1px solid var(--color-border)', borderRadius: 'var(--radius)',
          marginBottom: 8,
        }}>
          <input
            ref={imageUrlRef}
            value={imageUrl}
            onChange={e => setImageUrl(e.target.value)}
            placeholder="Image URL (https://…)"
            style={{ flex: 2, minWidth: 200, fontSize: 12 }}
            onKeyDown={e => {
              if (e.key === 'Enter') { e.preventDefault(); insertImage() }
              if (e.key === 'Escape') setShowImageInput(false)
            }}
          />
          <input
            type="number"
            value={imageWidth}
            onChange={e => setImageWidth(e.target.value)}
            min="10"
            max="100"
            style={{ width: 60, fontSize: 12 }}
            title="Width %"
          />
          <span style={{ fontSize: 12, color: 'var(--color-text-muted)' }}>% wide</span>
          <button type="button" className="btn-primary" style={{ fontSize: 12, padding: '4px 12px' }} onClick={insertImage}>
            Insert
          </button>
          <button type="button" className="btn-secondary" style={{ fontSize: 12, padding: '4px 10px' }} onClick={() => setShowImageInput(false)}>
            Cancel
          </button>
        </div>
      )}

      {showWarning && (
        <div style={{
          display: 'flex', alignItems: 'flex-start', gap: 8,
          background: '#fef9c3', border: '1px solid #fde047',
          borderRadius: 'var(--radius)', padding: '8px 12px',
          marginBottom: 8, fontSize: 12, color: '#713f12',
        }}>
          <span style={{ flex: 1 }}>
            <strong>Possible malformed merge tags detected:</strong>{' '}
            {suspiciousTags.map((t, i) => (
              <code key={i} style={{ background: '#fde047', padding: '1px 4px', borderRadius: 3, marginRight: 4 }}>{t}</code>
            ))}
            {' '}— Use the "Insert merge tag" dropdown to insert tags correctly as <code style={{ background: '#fde047', padding: '1px 4px', borderRadius: 3 }}>{'{{Tag}}'}</code>.
          </span>
          <button
            type="button"
            onClick={() => setWarnDismissed(true)}
            style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 14, color: '#713f12', lineHeight: 1, padding: 0, flexShrink: 0 }}
            aria-label="Dismiss warning"
          >
            ✕
          </button>
        </div>
      )}

      {showPreview && previewHtml ? (
        <div
          className="letter-body"
          style={{
            border: '1px solid var(--color-border)', borderRadius: 'var(--radius)',
            padding: '24px 28px', minHeight: 300, background: '#fff',
            fontFamily: 'Georgia, serif', fontSize: 13, lineHeight: 1.7,
          }}
          dangerouslySetInnerHTML={{ __html: previewHtml }}
        />
      ) : (
        <EditorContent
          editor={editor}
          style={{
            border: '1px solid var(--color-border)',
            borderRadius: 'var(--radius)',
            padding: '16px 20px',
            minHeight: 300,
            background: '#fff',
          }}
        />
      )}
    </div>
  )
}

function ToolBtn({ active, onClick, children }) {
  return (
    <button
      type="button"
      onClick={onClick}
      style={{
        padding: '3px 8px',
        fontSize: 13,
        fontWeight: 700,
        background: active ? 'var(--color-primary)' : 'transparent',
        color: active ? '#fff' : 'var(--color-text)',
        border: 'none',
        borderRadius: 4,
        cursor: 'pointer',
        display: 'inline-flex',
        alignItems: 'center',
        justifyContent: 'center',
      }}
    >
      {children}
    </button>
  )
}
