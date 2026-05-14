'use client';
import React, { createContext, useCallback, useContext, useState } from 'react';
import {
  ActiveHandle,
  EditorAreaContextType,
  EditorAreaProviderProps,
} from '../../../lib/types';
import { Edge, Node, useEdgesState, useNodesState } from '@xyflow/react';
import { Block, BlockType } from '../../../api/types';
import type { EditorDataAdapter } from '../../../api/adapter';

const blockTypeKey = (
  apiVersion: string | undefined,
  kind: string | undefined,
): string => `${apiVersion ?? ''}|${kind ?? ''}`;

const hasNonEmptySchema = (type: BlockType): boolean => {
  const props = type.schema?.properties;
  if (!props) return false;
  return Object.values(props).some(
    (entry) =>
      typeof entry === 'object' &&
      entry !== null &&
      'properties' in entry &&
      !!(entry as { properties?: unknown }).properties,
  );
};

const noopAdapter: EditorDataAdapter = {
  getBlocks: async () => [],
  updateBlocks: async () => null,
  getBlockTypes: async () => [],
  getConfiguration: async () => null,
  getTemplate: async () => null,
  listCrossplaneProviders: async () => ({
    crossplaneProviders: [],
    totalCount: 0,
  }),
  getConfigurationData: async () => ({
    compositions: [],
    xrdBlockType: [],
    providerUrls: [],
    functionUrls: [],
  }),
  createConfiguration: async () => '',
  updateConfiguration: async () => undefined,
  createProvidersFromUrls: async () => [],
  createFunctionsFromUrls: async () => [],
};

const EditorAreaContext = createContext<EditorAreaContextType>({
  selectedBlockType: undefined,
  setSelectedBlockType: () => undefined,
  nodes: [],
  setNodes: () => undefined,
  onNodesChange: () => undefined,
  edges: [],
  setEdges: () => undefined,
  onEdgesChange: () => undefined,
  blocks: [],
  setBlocks: () => undefined,
  setBlocksLoading: () => undefined,
  blocksLoading: false,
  addNodeToCanvas: () => undefined,
  activeHandle: null,
  setActiveHandle: () => undefined,
  adapter: noopAdapter,
  entityRef: { entity: null, entityId: null },
  registerBlockTypes: () => undefined,
  resolveBlockType: () => undefined,
});

export const EditorAreaProvider: React.FC<EditorAreaProviderProps> = ({
  children,
  adapter,
  entityRef,
}) => {
  const [selectedBlockType, setSelectedBlockType] = useState<BlockType>();
  const [nodes, setNodes, onNodesChange] = useNodesState<Node>([]);
  const [edges, setEdges, onEdgesChange] = useEdgesState<Edge>([]);
  const [blocks, setBlocks] = useState<Block[]>([]);
  const [blocksLoading, setBlocksLoading] = useState<boolean>(false);
  const [activeHandle, setActiveHandle] = useState<ActiveHandle | null>(null);
  const [blockTypeRegistry, setBlockTypeRegistry] = useState<
    Record<string, BlockType>
  >({});

  const registerBlockTypes = useCallback((types: BlockType[]) => {
    if (!types.length) return;
    setBlockTypeRegistry((prev) => {
      let changed = false;
      const next = { ...prev };
      for (const type of types) {
        if (!hasNonEmptySchema(type)) continue;
        const key = blockTypeKey(type.apiVersion, type.kind);
        if (!next[key]) {
          next[key] = type;
          changed = true;
        }
      }
      return changed ? next : prev;
    });
  }, []);

  const resolveBlockType = useCallback(
    (apiVersion: string | undefined, kind: string | undefined) =>
      blockTypeRegistry[blockTypeKey(apiVersion, kind)],
    [blockTypeRegistry],
  );

  const sanitizeBaseName = (s: string): string =>
    s.replace(/[^a-z0-9-]/gi, '').toLowerCase() || 'block';

  const addNodeToCanvas = (blockType: BlockType) => {
    if (blockType.leaf) return;

    const position = { x: 100, y: 100 };
    const base = sanitizeBaseName(blockType.kind || blockType.name);

    setNodes((current) => {
      const existing = new Set(current.map((n) => n.id));
      let counter = 1;
      let candidate = `${base}${counter}`;
      while (existing.has(candidate)) {
        counter++;
        candidate = `${base}${counter}`;
      }
      const newNode: Node = {
        id: candidate,
        position,
        type: 'container',
        data: {
          name: candidate,
          connectors: [],
          childBlocks: [],
          reactFlowRef: null,
          blockType: blockType,
          kind: blockType.kind,
          apiVersion: blockType.apiVersion,
        },
      };
      return current.concat(newNode);
    });
  };

  return (
    <EditorAreaContext.Provider
      value={{
        selectedBlockType,
        setSelectedBlockType,
        nodes,
        setNodes,
        onNodesChange,
        edges,
        setEdges,
        onEdgesChange,
        blocks,
        setBlocks,
        blocksLoading,
        setBlocksLoading,
        addNodeToCanvas,
        activeHandle,
        setActiveHandle,
        adapter,
        entityRef,
        registerBlockTypes,
        resolveBlockType,
      }}
    >
      {children}
    </EditorAreaContext.Provider>
  );
};

export const useEditorAreaContext = (): EditorAreaContextType => {
  return useContext(EditorAreaContext);
};

export default EditorAreaContext;
