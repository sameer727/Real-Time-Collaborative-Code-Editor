import React, { useEffect, useRef, useState } from 'react';
import * as Y from 'yjs';
import { WebsocketProvider } from 'y-websocket';
// MonacoBinding will be loaded from CDN as YMonaco.MonacoBinding when needed

export default function CodeEditor({ roomId, language = 'javascript' }) {
  const ydocRef = useRef();
  const providerRef = useRef();
  const editorRef = useRef();
  const autosaveRef = useRef();
  const containerRef = useRef();
  const [presence, setPresence] = useState([]);

  useEffect(() => {
    const ydoc = new Y.Doc();
    ydocRef.current = ydoc;

    // Connect to the y-websocket server (replace host/port as needed)
    const provider = new WebsocketProvider('ws://localhost:5000', roomId, ydoc);
    providerRef.current = provider;

    const yText = ydoc.getText('monaco');

    // presence (awareness)
    try {
      const user = { name: `User-${Math.floor(Math.random() * 9000) + 1000}`, color: '#' + Math.floor(Math.random() * 16777215).toString(16).padStart(6, '0') };
      if (provider && provider.awareness) {
        provider.awareness.setLocalStateField('user', user);
        const updatePresence = () => {
          const states = Array.from(provider.awareness.getStates().values()).map(s => s.user).filter(Boolean);
          setPresence(states);
        };
        provider.awareness.on('change', updatePresence);
        updatePresence();
      }
    } catch (e) {
      console.warn('presence init failed', e);
    }

    // Load persisted snapshot if available
    (async () => {
      try {
        const res = await fetch(`/api/rooms/${roomId}/load`);
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

    // Expose Y.Doc and forceSave helper for tests
    try {
      window.__rtcYDocs = window.__rtcYDocs || {};
      window.__rtcForceSave = window.__rtcForceSave || (async function (rid) {
        const d = window.__rtcYDocs && window.__rtcYDocs[rid];
        if (!d) throw new Error('ydoc not found for room ' + rid);
        const update = Y.encodeStateAsUpdate(d);
        // base64 encode
        const arr = update;
        let s = '';
        const CHUNK_SIZE = 0x8000;
        for (let i = 0; i < arr.length; i += CHUNK_SIZE) {
          const slice = arr.subarray(i, i + CHUNK_SIZE);
          s += String.fromCharCode.apply(null, slice);
        }
        const b64 = btoa(s);
        await fetch(`/api/rooms/${rid}/save`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ updateBase64: b64 }) });
      });
      window.__rtcYDocs[roomId] = ydoc;
    } catch (e) {
      // ignore in non-browser envs
    }

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
            language: language || 'javascript',
            automaticLayout: true
          });
          editorRef.current = editor;
          // diagnostics
          window.__rtcDiag = window.__rtcDiag || {};
          window.__rtcDiag[roomId] = { hasMonaco: !!window.monaco, hasY: !!window.Y, hasYMonaco: !!window.YMonaco };
          console.info('RTC DIAG', window.__rtcDiag[roomId]);
          // bind if YMonaco available
          if (window.YMonaco && window.YMonaco.MonacoBinding) {
            new window.YMonaco.MonacoBinding(yText, editor.getModel(), new Set([editor]), provider.awareness);
          }
          window.__rtcEditors = window.__rtcEditors || {};
          if (roomId) window.__rtcEditors[roomId] = editor;
          return;
        }

        // Load Monaco from CDN
        const requireCfg = () => {
          // eslint-disable-next-line no-undef
          const vsPath = window.location.origin + '/vendor/monaco-editor/min/vs';
          require.config({ paths: { vs: vsPath } });
          // eslint-disable-next-line no-undef
          require(['vs/editor/editor.main'], () => {
            const editor = window.monaco.editor.create(containerRef.current, {
              value: yText.toString() || '// Start coding...\n',
              language: language || 'javascript',
              automaticLayout: true
            });
            editorRef.current = editor;

            // diagnostics
            window.__rtcDiag = window.__rtcDiag || {};
            window.__rtcDiag[roomId] = { hasMonaco: !!window.monaco, hasY: !!window.Y, hasYMonaco: !!window.YMonaco };
            console.info('RTC DIAG', window.__rtcDiag[roomId]);

            // Ensure YMonaco (MonacoBinding) is loaded via vendor or CDN and then bind
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
              s2.src = '/vendor/y-monaco/dist/y-monaco.js';
              s2.onload = onYMonacoReady;
              s2.onerror = () => {
                console.warn('Vendor y-monaco failed, falling back to CDN');
                s2.src = 'https://unpkg.com/y-monaco@1.0.0/dist/y-monaco.js';
              };
              document.body.appendChild(s2);
            }
          });
        };

        // If AMD loader not present, add it
        if (typeof window.require === 'undefined') {
          const s = document.createElement('script');
          s.src = '/vendor/monaco-editor/min/vs/loader.js';
          s.onload = requireCfg;
          s.onerror = function () {
            console.warn('Vendor monaco loader failed, falling back to CDN');
            s.src = 'https://cdn.jsdelivr.net/npm/monaco-editor@0.36.1/min/vs/loader.js';
            s.onload = requireCfg;
          };
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
      try { if (window.__rtcYDocs && roomId) delete window.__rtcYDocs[roomId]; } catch (e) {}
      try { if (provider && provider.awareness) provider.awareness.setLocalStateField('user', null); } catch (e) {}
      try { provider.destroy(); } catch (e) {}
      try { ydoc.destroy(); } catch (e) {}
      try { if (editorRef.current) editorRef.current.dispose(); } catch (e) {}
    };

    return () => dispose();
  }, [roomId, language]);

  return (
    <div style={{ height: '100vh', display: 'flex', flexDirection: 'column' }}>
      <div style={{ padding: '6px 10px', background: '#f6f8fa', borderBottom: '1px solid #e1e4e8', display: 'flex', alignItems: 'center', gap: '8px' }}>
        <div style={{ fontSize: 12, color: '#333' }}>Room: <strong>{roomId}</strong></div>
        <div style={{ marginLeft: 'auto', display: 'flex', gap: '6px' }}>
          {presence.map((p, idx) => (
            <div key={idx} title={p.name} style={{ width: 24, height: 24, borderRadius: '50%', background: p.color, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff', fontSize: 12 }}>{p.name[0]}</div>
          ))}
        </div>
      </div>
      <div ref={containerRef} style={{ flex: 1, height: '100%' }} />
    </div>
  );
}
