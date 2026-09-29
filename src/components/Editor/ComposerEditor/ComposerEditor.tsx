'use client';
import React, {
  forwardRef,
  useCallback,
  useEffect,
  useImperativeHandle,
  useMemo,
  type CSSProperties,
  type Ref,
} from 'react';
import {
  ReactFlowProvider,
  useReactFlow,
  type Node as RFNode,
} from '@xyflow/react';
import { PanelRight, Save } from 'lucide-react';
import type { EditorDataAdapter, EditorEntityRef } from '../../../api/adapter';
import type { Block } from '../../../api/types';
import {
  collectBlocks,
  restoreBlocks,
} from '../../../lib/compositionInputs';
import { mergeContainerIntoNodes } from '../../../lib/containerGraph';
import { Button } from '../../ui/button';
import {
  SidebarInset,
  SidebarProvider,
  SidebarTrigger,
} from '../../ui/sidebar';
import { Breadcrumbs } from '../Breadcrumbs';
import { EditorArea } from '../EditorArea';
import { EditorAreaProvider, useEditorActions } from '../EditorAreaContext';
import { EditorAreaSidebar } from '../EditorAreaSidebar';

const DEFAULT_ENTITY_ID = 'composer';

export type ComposerSavePayload = {
  // The whole configuration as one flat list of generic blocks, layout
  // included: compositions, their Spec and Status blocks, pipeline functions
  // and resources, each placed in its parent's space. Passing them back as the
  // `blocks` prop restores the same editor.
  blocks: Block[];
};

// Colours of block inputs and outputs, as any CSS colour. Spec takes the
// output colours and Status the input ones; an edge fades from the colour of
// the end its data leaves to the other. Anything left out keeps its default.
export type ComposerColors = {
  inputHandle?: string;
  inputHandleBorder?: string;
  inputEdge?: string;
  outputHandle?: string;
  outputHandleBorder?: string;
  outputEdge?: string;
};

export type ComposerEditorProps = {
  // What a previous save handed out.
  blocks: Block[];
  adapter: EditorDataAdapter;
  entityRef?: EditorEntityRef;
  onSave: (payload: ComposerSavePayload) => void;
  colors?: ComposerColors;
};

// The CSS custom property each colour sets (see editor.css).
const COLOR_PROPERTIES: Record<keyof ComposerColors, string> = {
  inputHandle: '--composer-input-handle-color',
  inputHandleBorder: '--composer-input-handle-border-color',
  inputEdge: '--composer-input-edge-color',
  outputHandle: '--composer-output-handle-color',
  outputHandleBorder: '--composer-output-handle-border-color',
  outputEdge: '--composer-output-edge-color',
};

const colorStyle = (colors: ComposerColors | undefined): CSSProperties =>
  Object.fromEntries(
    Object.entries(colors ?? {})
      .filter(([, value]) => value)
      .map(([key, value]) => [
        COLOR_PROPERTIES[key as keyof ComposerColors],
        value,
      ]),
  );

export type ComposerEditorHandle = {
  save: () => void;
};

function DocSync({ blocks }: { blocks: Block[] }) {
  const { setBlocks, setNodes, setEdges } = useEditorActions();
  useEffect(() => {
    setNodes([]);
    setEdges([]);
    setBlocks(blocks);
  }, [blocks, setBlocks, setNodes, setEdges]);
  return null;
}

type InnerProps = ComposerEditorProps & {
  forwardedRef: Ref<ComposerEditorHandle>;
};

function ComposerEditorBody({ onSave, colors, forwardedRef }: InnerProps) {
  const { getNodes, getEdges } = useReactFlow();
  const { containerSession } = useEditorActions();

  const triggerSave = useCallback(() => {
    // A save covers the whole configuration, not the level on screen: with a
    // container open, its canvas is folded back into the parked container-level
    // graph first.
    const session = containerSession.current;
    const nodes = session
      ? mergeContainerIntoNodes(
          session.nodes,
          session.containerId,
          getNodes(),
          getEdges(),
          session.connectors,
        )
      : getNodes();

    onSave({ blocks: collectBlocks(nodes as RFNode[]) });
  }, [getNodes, getEdges, containerSession, onSave]);

  useImperativeHandle(forwardedRef, () => ({ save: triggerSave }), [
    triggerSave,
  ]);

  const canvasStyle = useMemo(
    () => ({ flex: 1, minHeight: 0, ...colorStyle(colors) }),
    [colors],
  );

  return (
    <SidebarProvider defaultLeftOpen={false} defaultRightOpen={false}>
      <SidebarInset>
        <header className="sticky top-0 z-50 flex h-10 shrink-0 items-center gap-2 border-b border-border/60 px-2 backdrop-blur">
          <Breadcrumbs />
          <div className="flex-1" />
          <Button
            variant="ghost"
            size="icon"
            onClick={triggerSave}
            aria-label="Save"
          >
            <Save className="h-4 w-4" />
          </Button>
          <SidebarTrigger side="right" aria-label="Toggle blocks panel">
            <PanelRight className="h-4 w-4" />
          </SidebarTrigger>
        </header>
        <div style={canvasStyle}>
          <EditorArea />
        </div>
      </SidebarInset>
      <EditorAreaSidebar />
    </SidebarProvider>
  );
}

export const ComposerEditor = forwardRef<
  ComposerEditorHandle,
  ComposerEditorProps
>(function ComposerEditor(props, ref) {
  const restored = useMemo(() => restoreBlocks(props.blocks), [props.blocks]);

  const entityRef = props.entityRef ?? {
    entity: 'configuration' as const,
    entityId: DEFAULT_ENTITY_ID,
  };

  return (
    <ReactFlowProvider>
      <EditorAreaProvider adapter={props.adapter} entityRef={entityRef}>
        <DocSync blocks={restored} />
        <ComposerEditorBody {...props} forwardedRef={ref} />
      </EditorAreaProvider>
    </ReactFlowProvider>
  );
});
