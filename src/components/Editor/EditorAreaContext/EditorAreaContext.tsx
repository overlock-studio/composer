'use client';
import React, {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useRef,
  useState,
} from 'react';
import {
  ActiveHandle,
  ContainerSession,
  EditorActionsContextType,
  EditorAreaContextType,
  EditorAreaProviderProps,
  EditorGraphContextType,
  EditorMode,
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

const EditorActionsContext = createContext<EditorActionsContextType>({
  selectedBlockType: undefined,
  setSelectedBlockType: () => undefined,
  setNodes: () => undefined,
  onNodesChange: () => undefined,
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
  editorMode: 'containers',
  activeContainerId: null,
  containerSession: { current: null },
  openContainer: () => undefined,
  closeContainer: () => undefined,
  resolveBlockType: () => undefined,
});

const EditorGraphContext = createContext<EditorGraphContextType>({
  nodes: [],
  edges: [],
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
  const [activeContainerId, setActiveContainerId] = useState<string | null>(
    null,
  );
  // Lives here rather than in the editor area so saving can reach it without
  // caring which level is on screen.
  const containerSession = useRef<ContainerSession | null>(null);
  const editorMode: EditorMode = activeContainerId ? 'container' : 'containers';

  const openContainer = useCallback((containerId: string) => {
    setActiveContainerId(containerId);
  }, []);

  const closeContainer = useCallback(() => {
    setActiveContainerId(null);
  }, []);

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

  const addNodeToCanvas = useCallback(
    (blockType: BlockType) => {
    if (blockType.leaf) return;

    const sanitizeBaseName = (s: string): string =>
      s.replace(/[^a-z0-9-]/gi, '').toLowerCase() || 'block';

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
    },
    [setNodes],
  );

  // Stable slice — referentially stable while nodes/edges churn (drags), so
  // node/handle/edge components subscribing here do not re-render per frame.
  const actionsValue = useMemo<EditorActionsContextType>(
    () => ({
      selectedBlockType,
      setSelectedBlockType,
      setNodes,
      onNodesChange,
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
      editorMode,
      activeContainerId,
      containerSession,
      openContainer,
      closeContainer,
      resolveBlockType,
    }),
    [
      selectedBlockType,
      setNodes,
      onNodesChange,
      setEdges,
      onEdgesChange,
      blocks,
      setBlocks,
      blocksLoading,
      addNodeToCanvas,
      activeHandle,
      adapter,
      entityRef,
      registerBlockTypes,
      editorMode,
      activeContainerId,
      openContainer,
      closeContainer,
      resolveBlockType,
    ],
  );

  const graphValue = useMemo<EditorGraphContextType>(
    () => ({ nodes, edges }),
    [nodes, edges],
  );

  return (
    <EditorActionsContext.Provider value={actionsValue}>
      <EditorGraphContext.Provider value={graphValue}>
        {children}
      </EditorGraphContext.Provider>
    </EditorActionsContext.Provider>
  );
};

/**
 * Stable subset of the editor context (setters, adapter, block-type registry,
 * activeHandle). Prefer this in components rendered per-node/edge/handle — it
 * does NOT change when nodes/edges change, so it won't re-render on every drag
 * frame. It intentionally does not expose `nodes`/`edges`; read those
 * non-reactively via React Flow's `getNodes()`/`getEdges()` when needed.
 */
export const useEditorActions = (): EditorActionsContextType => {
  return useContext(EditorActionsContext);
};

/**
 * Full editor context including reactive `nodes`/`edges`. Use only where you
 * must re-render on graph changes (e.g. the ReactFlow host, serialization).
 */
export const useEditorAreaContext = (): EditorAreaContextType => {
  const actions = useContext(EditorActionsContext);
  const graph = useContext(EditorGraphContext);
  return { ...actions, ...graph };
};

export default EditorActionsContext;
