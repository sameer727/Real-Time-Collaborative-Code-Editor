import React, { useEffect, useRef } from 'react';
import * as Y from 'yjs';
import { WebsocketProvider } from 'y-websocket';
// MonacoBinding will be loaded from CDN as YMonaco.MonacoBinding when needed

export default function CodeEditor({ roomId }) {
  const ydocRef = useRef();
  const providerRef = useRef();
  const editorRef = useRef();
  const autosaveRef = useRef();
  const containerRef = useRef();

  useEffect(() => {
    const ydoc = new Y.Doc();
    ydocRef.current = ydoc;

    // Connect to the y-websocket server (replace host/port as needed)
    const provider = new WebsocketProvider('ws://localhost:5000', roomId, ydoc);
    providerRef.current = provider;

    const yText = ydoc.getText('monaco');

    // Load persisted snapshot if available
    (async () => {
      try {
        const res = await fetch(`http://localhost:5000/api/rooms/${roomId}/load`);
        if (res.ok) {
          const data = await res.json();
          if (data && data.updateBase64) {
            const b64 = data.updateBase64;
            const str = atob(b64);
            const arr = new Uint8Array(str.length);
            for (let i = 0; i < str.length; i++) arr[i] = str.charCodeAt(i);
            Y.applyUpdate(ydoc, arr);
          }
        }
      } catch (err) {
        console.error('Failed to load snapshot', err);
      }
    })();

    // Autosave every 10s
    function uint8ArrayToBase64(u8) {
      const CHUNK_SIZE = 0x8000;
      let index = 0;
      const length = u8.length;
      let result = '';
      while (index < length) {
        const slice = u8.subarray(index, Math.min(index + CHUNK_SIZE, length));
        result += String.fromCharCode.apply(null, slice);
        index += CHUNK_SIZE;
      }
      return btoa(result);
    }

    autosaveRef.current = setInterval(async () => {
      try {
        const update = Y.encodeStateAsUpdate(ydoc);
        const b64 = uint8ArrayToBase64(update);
        await fetch(`http://localhost:5000/api/rooms/${roomId}/save`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ updateBase64: b64 })
        });
      } catch (err) {
        console.error('Autosave failed', err);
      }
    }, 10000);

    const handleBeforeUnload = async () => {
      try {
        const update = Y.encodeStateAsUpdate(ydoc);
        const b64 = uint8ArrayToBase64(update);
        await fetch(`http://localhost:5000/api/rooms/${roomId}/save`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ updateBase64: b64 })
        });
      } catch (err) {
        console.error('Final save failed', err);
      }
    };

    window.addEventListener('beforeunload', handleBeforeUnload);

    // Create Monaco editor via CDN loader (works without bundling @monaco-editor/react)
    (function loadMonacoAndBind() {
      try {
        // If monaco already available, create directly
        if (window.monaco) {
          const editor = window.monaco.editor.create(containerRef.current, {
            value: yText.toString() || '// Start coding...\n',
            language: 'javascript',
            automaticLayout: true
          });
          editorRef.current = editor;
          new MonacoBinding(yText, editor.getModel(), new Set([editor]), provider.awareness);
          window.__rtcEditors = window.__rtcEditors || {};
          if (roomId) window.__rtcEditors[roomId] = editor;
          return;
        }

        // Load Monaco from CDN
        const requireCfg = () => {
          // eslint-disable-next-line no-undef
          require.config({ paths: { vs: 'https://cdn.jsdelivr.net/npm/monaco-editor@0.36.1/min/vs' } });
          // eslint-disable-next-line no-undef
          require(['vs/editor/editor.main'], () => {
            const editor = window.monaco.editor.create(containerRef.current, {
              value: yText.toString() || '// Start coding...\n',
              language: 'javascript',
              automaticLayout: true
            });
            editorRef.current = editor;

            // Ensure YMonaco (MonacoBinding) is loaded via CDN and then bind
            function onYMonacoReady() {
              try {
                const MonacoBinding = window.YMonaco && window.YMonaco.MonacoBinding;
                if (MonacoBinding) {
                  new MonacoBinding(yText, editor.getModel(), new Set([editor]), provider.awareness);
                } else {
                  console.warn('YMonaco.MonacoBinding not found');
                }
                window.__rtcEditors = window.__rtcEditors || {};
                if (roomId) window.__rtcEditors[roomId] = editor;
              } catch (e) {
                console.error('Failed to bind Monaco with Yjs', e);
              }
            }

            if (window.YMonaco) {
              onYMonacoReady();
            } else {
              const s2 = document.createElement('script');
              s2.src = 'https://unpkg.com/y-monaco@1.0.0/dist/y-monaco.js';
              s2.onload = onYMonacoReady;
              document.body.appendChild(s2);
            }
          });
        };

        // If AMD loader not present, add it
        if (typeof window.require === 'undefined') {
          const s = document.createElement('script');
          s.src = 'https://cdn.jsdelivr.net/npm/monaco-editor@0.36.1/min/vs/loader.js';
          s.onload = requireCfg;
          document.body.appendChild(s);
        } else {
          requireCfg();
        }
      } catch (err) {
        console.error('Failed to load Monaco from CDN', err);
      }
    })();

    const dispose = () => {
      clearInterval(autosaveRef.current);
      window.removeEventListener('beforeunload', handleBeforeUnload);
      try {
        if (window.__rtcEditors && roomId) delete window.__rtcEditors[roomId];
      } catch (e) {}
      try { provider.destroy(); } catch (e) {}
      try { ydoc.destroy(); } catch (e) {}
      try { if (editorRef.current) editorRef.current.dispose(); } catch (e) {}
    };

    return () => dispose();
  }, [roomId]);

  return (
    <div style={{ height: '100vh' }}>
      <div ref={containerRef} style={{ height: '100%' }} />
    </div>
  );
}
