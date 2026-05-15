import { useEffect, useRef, useState } from 'react';
import {
  Button,
  ComposerEditor,
  type ComposerEditorHandle,
  type ComposerSavePayload,
} from '@overlock-studio/composer';
import '@overlock-studio/composer/styles/editor.css';
import '@xyflow/react/dist/style.css';

import { demoAdapter } from './adapter';
import { sampleFiles, sampleHashes, sampleLayout } from './sample';

type Theme = 'light' | 'dark';

export default function App() {
  const editorRef = useRef<ComposerEditorHandle>(null);
  const [lastSave, setLastSave] = useState<ComposerSavePayload | null>(null);
  const [showPayload, setShowPayload] = useState(false);
  const [theme, setTheme] = useState<Theme>(() =>
    document.documentElement.classList.contains('dark') ? 'dark' : 'light',
  );

  useEffect(() => {
    document.documentElement.classList.toggle('dark', theme === 'dark');
    localStorage.setItem('composer-demo-theme', theme);
  }, [theme]);

  const handleSave = (payload: ComposerSavePayload) => {
    setLastSave(payload);
    setShowPayload(true);
    console.log('[composer-demo] onSave payload', payload);
  };

  return (
    <div className="flex h-full w-full flex-col">
      <header className="flex items-center justify-between bg-sidebar px-4 py-2">
        <div className="flex items-baseline gap-3">
          <h1 className="text-sm font-semibold">Composer demo</h1>
          <span className="text-xs text-muted-foreground">
            Mounts ComposerEditor with a minimal XRD + Composition.
          </span>
        </div>
        <div className="flex gap-1">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => editorRef.current?.save()}
          >
            Trigger save() via ref
          </Button>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setShowPayload((v) => !v)}
          >
            {showPayload ? 'Hide' : 'Show'} last payload
          </Button>
          <Button
            variant="ghost"
            size="sm"
            aria-label="Toggle theme"
            onClick={() =>
              setTheme((t) => (t === 'dark' ? 'light' : 'dark'))
            }
          >
            {theme === 'dark' ? 'Light' : 'Dark'} mode
          </Button>
        </div>
      </header>

      <div className="flex min-h-0 flex-1">
        <div className="flex min-w-0 flex-1 flex-col">
          <ComposerEditor
            ref={editorRef}
            files={sampleFiles}
            crossplaneFile="crossplane.yaml"
            hashes={sampleHashes}
            layout={sampleLayout}
            adapter={demoAdapter}
            onSave={handleSave}
          />
        </div>
        {showPayload && (
          <aside className="w-[28rem] shrink-0 overflow-auto border-l border-border/70 bg-muted/40 p-3 text-xs">
            <div className="mb-2 flex items-center justify-between">
              <strong>onSave payload</strong>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setShowPayload(false)}
              >
                close
              </Button>
            </div>
            {lastSave ? (
              <pre className="whitespace-pre-wrap break-words font-mono">
                {JSON.stringify(lastSave, null, 2)}
              </pre>
            ) : (
              <p className="text-muted-foreground">
                Click save (header icon inside the editor, or the button above)
                to capture a payload.
              </p>
            )}
          </aside>
        )}
      </div>
    </div>
  );
}
