'use client';
import React, { useMemo, useState } from 'react';
import { Node, NodeProps, Position, useReactFlow } from '@xyflow/react';
import {
  Box,
  ChevronDown,
  ChevronRight,
  FileText,
  Trash2,
} from 'lucide-react';
import { Button } from '../../ui/button';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '../../ui/dialog';
import { CustomHandle } from '../CustomHandle';
import { NodeDeletionDialog } from '../ConfirmDeletionDialog';
import { useNodeDeleteShortcut } from '../../../lib/useNodeDeleteShortcut';
import { HandleTreeNode, XrdNodeData } from '../../../lib/types';
import { buildTreeData } from '../../../lib/editorUtils';
import { parseXrdYaml } from '../../../lib/crossplaneCore';
import { cn } from '../../../lib/utils';

const XRD_NODE_WIDTH = 320;
const ROW_HEIGHT = 28;

type XrdTreeRowProps = {
  node: HandleTreeNode;
  depth: number;
  expanded: Record<string, boolean>;
  onToggle: (path: string) => void;
};

const XrdTreeRow = ({
  node,
  depth,
  expanded,
  onToggle,
}: XrdTreeRowProps) => {
  const hasChildren = !!node.children && node.children.length > 0;
  const isOpen = expanded[node.value] ?? false;

  return (
    <div>
      <div
        className="relative flex items-center gap-1 pr-5"
        style={{
          height: ROW_HEIGHT,
          paddingLeft: 8 + depth * 14,
        }}
      >
        <button
          type="button"
          onClick={() => hasChildren && onToggle(node.value)}
          aria-label={isOpen ? 'Collapse' : 'Expand'}
          className={cn(
            'flex h-4 w-4 shrink-0 items-center justify-center text-muted-foreground',
            !hasChildren && 'invisible',
          )}
        >
          {isOpen ? (
            <ChevronDown className="h-3.5 w-3.5" />
          ) : (
            <ChevronRight className="h-3.5 w-3.5" />
          )}
        </button>
        <span
          className="truncate text-xs"
          title={node.title}
        >
          {node.label}
        </span>
        <CustomHandle
          id={node.value}
          type="target"
          position={Position.Right}
          path={node.value}
          description={node.title ?? ''}
          variant="inline"
          isConnectable
          style={{ right: 0, left: 'auto' }}
        />
      </div>
      {hasChildren && (
        <div
          style={
            isOpen
              ? undefined
              : {
                  height: 0,
                  overflow: 'hidden',
                  visibility: 'hidden',
                  pointerEvents: 'none',
                }
          }
          aria-hidden={!isOpen}
        >
          {(node.children ?? []).map((child) => (
            <XrdTreeRow
              key={child.value}
              node={child}
              depth={depth + 1}
              expanded={expanded}
              onToggle={onToggle}
            />
          ))}
        </div>
      )}
    </div>
  );
};

const XrdNodeComponent = ({
  id,
  data,
  selected,
}: NodeProps<Node<XrdNodeData>>) => {
  const [openDeleteDialog, setOpenDeleteDialog] = useState(false);
  const [expanded, setExpanded] = useState<Record<string, boolean>>({});
  const [attachOpen, setAttachOpen] = useState(false);
  const [yamlInput, setYamlInput] = useState(data.xrdSource ?? '');
  const [yamlError, setYamlError] = useState<string | null>(null);
  const { setNodes } = useReactFlow();
  useNodeDeleteShortcut(selected, () => setOpenDeleteDialog(true));

  const treeData = useMemo<HandleTreeNode[]>(
    () =>
      data.treeData && data.treeData.length > 0
        ? data.treeData
        : data.blockType?.schema
          ? buildTreeData(data.blockType.schema)
          : [],
    [data.treeData, data.blockType],
  );

  const handleToggle = (path: string) => {
    setExpanded((prev) => ({ ...prev, [path]: !prev[path] }));
  };

  const openAttach = () => {
    setYamlInput(data.xrdSource ?? '');
    setYamlError(null);
    setAttachOpen(true);
  };

  const handleApplyXrd = () => {
    try {
      const parsed = parseXrdYaml(yamlInput);
      const tree = buildTreeData(parsed.schema);
      setNodes((nds) =>
        nds.map((node) =>
          node.id === id
            ? {
                ...node,
                data: {
                  ...node.data,
                  xrdSource: yamlInput,
                  xrdName: parsed.name,
                  treeData: tree,
                },
              }
            : node,
        ),
      );
      setAttachOpen(false);
    } catch (err) {
      setYamlError(err instanceof Error ? err.message : String(err));
    }
  };

  const { blockType, name, xrdName } = data;
  const icon = blockType?.icon;
  const displayName = xrdName ?? name;

  return (
    <div
      className="node-body"
      data-parent-id={id}
      style={{ width: XRD_NODE_WIDTH }}
    >
      <div className="flex items-center border-b-[2px] border-muted-foreground/20 px-2 py-1 rounded-t-lg">
        <div className="w-10 flex items-center">
          {icon ? (
            <img
              src={icon}
              alt=""
              width={20}
              height={20}
              draggable={false}
            />
          ) : (
            <Box
              className="text-muted-foreground"
              width={20}
              height={20}
            />
          )}
        </div>
        <div className="flex-1 text-center">
          <div className="text-sm font-medium">{displayName}</div>
          {blockType?.apiVersion && (
            <div className="text-[0.625rem] text-muted-foreground">
              {blockType.apiVersion}
            </div>
          )}
        </div>
        <div className="flex gap-0.5">
          <Button
            size="icon"
            variant="ghost"
            className="h-6 w-6 [&_svg]:size-3.5"
            onClick={openAttach}
            title="Attach XRD YAML"
          >
            <FileText />
          </Button>
          <Button
            size="icon"
            variant="ghost"
            className="h-6 w-6 [&_svg]:size-3.5 hover:text-red-400"
            onClick={() => setOpenDeleteDialog(true)}
          >
            <Trash2 />
          </Button>
        </div>
      </div>
      <div className="py-1">
        {treeData.length === 0 ? (
          <div className="px-3 py-2 text-[0.625rem] text-muted-foreground">
            No schema fields
          </div>
        ) : (
          treeData.map((node) => (
            <XrdTreeRow
              key={node.value}
              node={node}
              depth={0}
              expanded={expanded}
              onToggle={handleToggle}
            />
          ))
        )}
      </div>
      <Dialog open={attachOpen} onOpenChange={setAttachOpen}>
        <DialogContent className="sm:max-w-[640px]">
          <DialogHeader>
            <DialogTitle>Attach XRD YAML</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <textarea
              value={yamlInput}
              onChange={(e) => setYamlInput(e.target.value)}
              placeholder="Paste a CompositeResourceDefinition YAML here..."
              className="h-72 w-full resize-none rounded-md border bg-background p-3 font-mono text-xs"
              spellCheck={false}
            />
            {yamlError && (
              <div className="text-xs text-red-500">{yamlError}</div>
            )}
            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={() => setAttachOpen(false)}>
                Cancel
              </Button>
              <Button onClick={handleApplyXrd}>Apply</Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
      <NodeDeletionDialog
        open={openDeleteDialog}
        nodeId={id}
        setOpen={setOpenDeleteDialog}
      />
    </div>
  );
};

export const XrdNode = React.memo(XrdNodeComponent);
