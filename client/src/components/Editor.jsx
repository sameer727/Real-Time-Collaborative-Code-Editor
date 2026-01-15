import React, { useEffect, useRef, useState } from 'react';
import Editor from '@monaco-editor/react';
import * as Y from 'yjs';
import { WebsocketProvider } from 'y-websocket';
import { MonacoBinding } from 'y-monaco';

export default function CodeEditor({ roomId, onMount, language }) {
  const [editorRef, setEditorRef] = useState(null);
  const providerRef = useRef(null);
  const bindingRef = useRef(null);

  function handleEditorDidMount(editor, monaco) {
    setEditorRef(editor);
    if (onMount) onMount(editor);
  }

  useEffect(() => {
    if (!editorRef || !roomId) return;

    // 1. Create Yjs Doc
    const ydoc = new Y.Doc();
    
    // 2. Create Provider
    const provider = new WebsocketProvider('ws://localhost:5000', roomId, ydoc);
    providerRef.current = provider;

    // 3. Get Yjs Text type
    const yText = ydoc.getText('monaco');

    // 4. Create Binding
    // We need the model from the editor
    const model = editorRef.getModel();
    const binding = new MonacoBinding(yText, model, new Set([editorRef]), provider.awareness);
    bindingRef.current = binding;

    // 5. Load Snapshot (Legacy logic from previous implementation)
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

    // 6. Autosave Logic
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

    const saveInterval = setInterval(async () => {
        try {
            const update = Y.encodeStateAsUpdate(ydoc);
            const b64 = uint8ArrayToBase64(update);
            await fetch(`http://localhost:5000/api/rooms/${roomId}/save`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ updateBase64: b64 })
            });
        } catch (e) {
            console.error("Autosave failed", e);
        }
    }, 10000);

    return () => {
      clearInterval(saveInterval);
      if (providerRef.current) providerRef.current.destroy();
      if (bindingRef.current) bindingRef.current.destroy();
      ydoc.destroy();
    };
  }, [editorRef, roomId]);

  return (
    <Editor
      height="100%"
      language={language}
      defaultValue="// Loading..."
      theme="vs-dark"
      onMount={handleEditorDidMount}
      options={{
        minimap: { enabled: false },
        fontSize: 14,
        automaticLayout: true,
      }}
    />
  );
}
