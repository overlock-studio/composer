import {
  Edge,
  Node,
  OnEdgesChange,
  OnNodesChange,
  Position,
} from '@xyflow/react';
import { LucideIcon } from 'lucide-react';
import { Dispatch, ReactNode, SetStateAction } from 'react';
import { Block, BlockType, Connector, Pipeline } from '../api/types';
import { EditorDataAdapter, EditorEntityRef } from '../api/adapter';
import { JSONSchemaProps } from './jsonSchema';

export type JsonPrimitive = number | string | boolean | null;

export type JsonObject = { [key in string]?: JsonValue };
/* eslint-disable */
export interface JsonArray extends Array<JsonValue> {}
/* eslint-enable */
export type JsonValue = JsonObject | JsonArray | JsonPrimitive;

export type Schema = {
  properties: {
    spec: JSONSchemaProps;
    status: JSONSchemaProps;
    metadata: JSONSchemaProps;
  };
  required?: string[];
};

export type Handle = {
  path: string;
  description: string;
  type: 'source' | 'target';
  schemaType?: string;
  required?: boolean;
};

export type HandleTreeNode = {
  value: string;
  label: string;
  title?: string;
  disabled?: boolean;
  children?: HandleTreeNode[];
};

export type CompositionData = {
  id: string;
  parentId: string;
  schema: JsonObject | null;
  type: string;
  edges: Edge[] | null;
};

export type Transformer =
  | { type: 'map'; map: Record<string, string> }
  | { type: 'string'; string: StringTransform }
  | { type: 'math'; math: MathTransform }
  | { type: 'match'; match: MatchTransform };
export type StringTransform =
  | { type: 'Convert'; convert: 'ToUpper' | 'ToLower' }
  | { type: 'Format'; fmt: string }
  | { type: 'Join'; join: { separator: string } }
  | { type: 'Regexp'; regexp: { match: string; group: number } }
  | { type: 'TrimPrefix'; trim: string }
  | { type: 'TrimSuffix'; trim: string };
export type MathTransform =
  | { type: 'clampMin'; clampMin: number }
  | { type: 'clampMax'; clampMax: number }
  | { type: 'multiply'; multiply: number };
export type MatchTransform = {
  patterns: Array<
    | { type: 'literal'; literal: string; result: string }
    | { type: 'regexp'; regexp: string; result: string }
  >;
  fallbackTo?: 'Value' | 'Input';
  fallbackValue?: string;
};

export type ActiveHandle = {
  nodeId: string;
  handleId: string;
  type: 'source' | 'target';
};

export type EditorAreaContextType = {
  selectedBlockType: BlockType | undefined;
  setSelectedBlockType: Dispatch<SetStateAction<BlockType | undefined>>;
  nodes: Node[];
  setNodes: React.Dispatch<React.SetStateAction<Node[]>>;
  onNodesChange: OnNodesChange<Node>;
  edges: Edge[];
  setEdges: React.Dispatch<React.SetStateAction<Edge[]>>;
  onEdgesChange: OnEdgesChange<Edge>;
  blocks: Block[];
  setBlocks: React.Dispatch<React.SetStateAction<Block[]>>;
  setBlocksLoading: React.Dispatch<React.SetStateAction<boolean>>;
  blocksLoading: boolean;
  addNodeToCanvas: (blockType: BlockType) => void;
  activeHandle: ActiveHandle | null;
  setActiveHandle: React.Dispatch<React.SetStateAction<ActiveHandle | null>>;
  adapter: EditorDataAdapter;
  entityRef: EditorEntityRef;
  registerBlockTypes: (types: BlockType[]) => void;
  resolveBlockType: (
    apiVersion: string | undefined,
    kind: string | undefined,
  ) => BlockType | undefined;
};

export type EditorAreaProviderProps = {
  children: ReactNode;
  adapter: EditorDataAdapter;
  entityRef: EditorEntityRef;
};

export type MonitoringAreaContextType = {
  nodes: Node[];
  setNodes: React.Dispatch<React.SetStateAction<Node[]>>;
  onNodesChange: OnNodesChange<Node>;
  edges: Edge[];
  setEdges: React.Dispatch<React.SetStateAction<Edge[]>>;
  onEdgesChange: OnEdgesChange<Edge>;
};

export type MonitoringAreaProviderProps = {
  children: ReactNode;
};

export type ResourceNodeData = {
  label: string;
  setNodes: React.Dispatch<React.SetStateAction<Node[]>>;
  onNodesChange: OnNodesChange<Node>;
  initialHandles: Handle[];
  currentHandles?: Handle[];
  treeData: HandleTreeNode[];
  blockType: BlockType;
};

export type HandlesSetter = React.Dispatch<React.SetStateAction<Handle[]>>;

export type ContainerNodeData = {
  setNodes: React.Dispatch<React.SetStateAction<Node[]>>;
  onNodesChange: OnNodesChange<Node>;
  name: string;
  connectors: Connector[];
  childBlocks: Block[];
  reactFlowRef: React.MutableRefObject<HTMLDivElement | null>;
  initialWidth?: number;
  initialHeight?: number;
  kind?: string;
  apiVersion?: string;
  blockType?: BlockType;
  functions?: Pipeline[];
};

export type ConnectorNodeData = {
  connector: Connector;
  nodeId: string;
  setConnectors: React.Dispatch<React.SetStateAction<Connector[]>>;
  label?: string;
};

export type HandlesStates = {
  handles: Handle[];
  setHandles: HandlesSetter;
};

export type ResourceNodeToolbarProps = {
  enableDeleteNode?: boolean;
  addHandles?: (id: string | null) => void;
  handlesStates?: HandlesStates;
  nodeId: string;
  treeData: HandleTreeNode[];
  onRequestDelete: () => void;
};

export type ContainerNodeToolbarProps = {
  setConnectors: React.Dispatch<React.SetStateAction<Connector[]>>;
  id: string;
  name: string;
  onNameChange: (newName: string) => void;
  kind?: string;
  apiVersion?: string;
  onKindChange: (newKind: string) => void;
  onApiVersionChange: (newApiVersion: string) => void;
  onRequestDelete: () => void;
};

export type ConnectorNodeToolbarProps = {
  connector: Connector;
  setConnectors: React.Dispatch<React.SetStateAction<Connector[]>>;
  onRequestDelete: () => void;
};

export type EditConnectorsMenuProps = {
  setOpen: React.Dispatch<React.SetStateAction<boolean>>;
  connector?: Connector;
  setConnectors: React.Dispatch<React.SetStateAction<Connector[]>>;
};

export type EditHandlesMenuProps = {
  nodeId: string;
  handlesStates: HandlesStates;
  treeData: HandleTreeNode[];
  open: boolean;
  setMenuOpen: React.Dispatch<React.SetStateAction<boolean>>;
};

export type HandlesTreeProps = {
  treeData: HandleTreeNode[];
  checked: string[];
  onCheckChange: (path: string, checked: boolean) => void;
};

export type NodeDeletionDialogProps = {
  open: boolean;
  nodeId: string;
  setOpen: React.Dispatch<React.SetStateAction<boolean>>;
};

export type EdgeDeletionDialogProps = {
  open: boolean;
  edgeId: string;
  setOpen: React.Dispatch<React.SetStateAction<boolean>>;
};

export type ConnectorNodeDeletionDialogProps = {
  open: boolean;
  setOpen: React.Dispatch<React.SetStateAction<boolean>>;
  nodeId: string;
  setConnectors: React.Dispatch<React.SetStateAction<Connector[]>>;
};

export type SaveConfigurationDialogProps = {
  open: boolean;
  setOpen: React.Dispatch<React.SetStateAction<boolean>>;
  configurationId: string;
};

export type CustomEdgeData = {
  isHovered?: boolean;
  transformers?: Transformer[];
  reactFlowRef: React.MutableRefObject<HTMLDivElement | null>;
};

export type CustomEdgeToolbarProps = {
  edgeId: string;
  toolbarPosition: { x: number; y: number };
  setTransformers?: React.Dispatch<
    React.SetStateAction<Transformer[] | undefined>
  >;
};

/** @public */
export interface BlockApi {
  getCompositionData: (id: string) => Promise<CompositionData[]>;
  setCompositionData: (id: string, data: CompositionData[]) => Promise<string>;
}

export type GetControlWithCurvatureParams = {
  pos: Position;
  x1: number;
  y1: number;
  x2: number;
  y2: number;
  c: number;
};

export type TransformerProps = {
  edgeId: string;
  positionX: number;
  positionY: number;
  transformer: Transformer;
  setTransformers: React.Dispatch<
    React.SetStateAction<Transformer[] | undefined>
  >;
  setOpenTransformerToolbar: React.Dispatch<React.SetStateAction<boolean>>;
  transformerIndex: number;
};

export type TransformerToolbarProps = {
  edgeId: string;
  setTransformers: React.Dispatch<
    React.SetStateAction<Transformer[] | undefined>
  >;
  transformer: Transformer;
  transformerIndex: number;
  setOpenTransformerToolbar: React.Dispatch<React.SetStateAction<boolean>>;
};

export type TransformerDeletionDialogProps = {
  open: boolean;
  setOpen: React.Dispatch<React.SetStateAction<boolean>>;
  setTransformers: React.Dispatch<
    React.SetStateAction<Transformer[] | undefined>
  >;
  edgeId: string;
  transformerIndex: number;
  setOpenTransformerToolbar: React.Dispatch<React.SetStateAction<boolean>>;
};

export type EditTransformersMenuProps = {
  transformer: Transformer;
  setTransformers: React.Dispatch<
    React.SetStateAction<Transformer[] | undefined>
  >;
  transformerIndex: number;
  setOpenTransformerToolbar: React.Dispatch<React.SetStateAction<boolean>>;
};

export type EditMathTransformerProps = {
  transformerIndex: number;
  transformer: { type: 'math'; math: MathTransform };
  setTransformers: React.Dispatch<
    React.SetStateAction<Transformer[] | undefined>
  >;
  setOpenTransformerToolbar: React.Dispatch<React.SetStateAction<boolean>>;
};

export type EditMatchTransformerProps = {
  transformerIndex: number;
  transformer: { type: 'match'; match: MatchTransform };
  setTransformers: React.Dispatch<
    React.SetStateAction<Transformer[] | undefined>
  >;
  setOpenTransformerToolbar: React.Dispatch<React.SetStateAction<boolean>>;
};

export type EditStringTransformerProps = {
  transformerIndex: number;
  transformer: { type: 'string'; string: StringTransform };
  setTransformers: React.Dispatch<
    React.SetStateAction<Transformer[] | undefined>
  >;
  setOpenTransformerToolbar: React.Dispatch<React.SetStateAction<boolean>>;
};

export type EditMapTransformerProps = {
  transformerIndex: number;
  transformer: {
    type: 'map';
    map: Record<string, string>;
  };
  setTransformers: React.Dispatch<
    React.SetStateAction<Transformer[] | undefined>
  >;
  setOpenTransformerToolbar: React.Dispatch<React.SetStateAction<boolean>>;
};

export type TransformersType = 'map' | 'string' | 'math' | 'match';

export type ConfigurationTableData = {
  id: string;
  name: string;
};

export type ProviderFamilyTableData = {
  id: string;
  name: string;
};

export type ProvidersTableData = {
  id: string;
  name: string;
  icon?: string;
  description?: string;
  family?: string;
  url?: string;
  version?: string;
};

export type FunctionsTableData = {
  id: string;
  name: string;
  description?: string;
  url?: string;
  version?: string;
};

export type TransactionsTableData = {
  date: string;
  reason: string;
  amount: string;
};

export type TreeDataItem = {
  value: string;
  label: string;
  icon?: LucideIcon;
  children?: TreeDataItem[];
  checked: boolean;
  disabled: boolean;
};

export interface DragPosition {
  x: number;
  y: number;
}

export interface DragState {
  isDragging: boolean;
  startPos: DragPosition;
  initialPos: DragPosition;
}

export type DefaultPosition = 'right' | 'left' | 'center' | DragPosition;

export interface NodeInspectionResult {
  id: string;
  type: string;
  label?: string;
  position?: { x: number; y: number };
  parentId?: string;
  childIds?: string[];
  connections?: {
    incoming: Array<{
      from: string;
      sourceHandle?: string;
      targetHandle?: string;
    }>;
    outgoing: Array<{
      to: string;
      sourceHandle?: string;
      targetHandle?: string;
    }>;
  };
  properties?: {
    blockType?: BlockType;
    connectors?: Array<{ id: string; name: string }>;
    childBlocks?: Array<{ id: string; name: string }>;
    handles?: Array<{
      path: string;
      description: string;
      type: 'source' | 'target';
    }>;
    treeData?: Array<{ value: string; label: string }>;
    draggable?: boolean;
    visibility?: string;
  };
}

export interface InspectionSummary {
  totalNodes: number;
  containerNodes: number;
  resourceNodes: number;
  totalEdges: number;
  availableContainers: Array<{ id: string; label: string; childCount: number }>;
  orphanedNodes: string[];
  nodeHierarchy: Array<{
    containerId: string;
    containerLabel: string;
    children: Array<{ id: string; label: string; type: string }>;
  }>;
}
