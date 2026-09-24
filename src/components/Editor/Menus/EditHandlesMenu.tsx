'use client';
import React, { useEffect, useState } from 'react';
import { useUpdateNodeInternals } from '@xyflow/react';
import { Button } from '../../ui/button';
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '../../ui/dialog';
import { ScrollArea } from '../../ui/scroll-area';
import {
  EditHandlesMenuProps,
  Handle,
  HandleTreeNode,
} from '../../../lib/types';
import { useEditorActions } from '../EditorAreaContext';
import { HandlesTree } from './HandlesTree';

// Every node in tree order: a picked parent is a key just like a picked field.
const flattenNodes = (nodes: HandleTreeNode[]): HandleTreeNode[] =>
  nodes.flatMap((node) => [node, ...flattenNodes(node.children ?? [])]);

export const EditHandlesMenu = ({
  nodeId,
  handlesStates: { setHandles, handles },
  treeData,
  open,
  setMenuOpen,
}: EditHandlesMenuProps) => {
  const updateNodeInternals = useUpdateNodeInternals();
  const { setEdges } = useEditorActions();

  const [checked, setChecked] = useState<string[]>(
    handles.map((handle) => handle.path),
  );

  useEffect(() => {
    if (open) {
      setChecked(handles.map((handle) => handle.path));
    }
  }, [open, handles]);

  const handleSave = () => {
    const removedHandles = handles.filter(
      (handle) => !checked.includes(handle.path),
    );

    setEdges((edges) =>
      edges.filter(
        (edge) =>
          !removedHandles.some(
            (removedHandle) =>
              (edge.sourceHandle === removedHandle.path &&
                edge.source === nodeId) ||
              (edge.targetHandle === removedHandle.path &&
                edge.target === nodeId),
          ),
      ),
    );

    const checkedSet = new Set(checked);
    const updatedHandles: Handle[] = flattenNodes(treeData)
      .filter((node) => checkedSet.has(node.value))
      .map((node) => ({
        path: node.value,
        description: node.title || '',
        type: node.value.startsWith('spec') ? 'target' : 'source',
      }));

    setHandles(updatedHandles);
    setMenuOpen(false);
    updateNodeInternals(nodeId);
  };

  return (
    <Dialog open={open} onOpenChange={setMenuOpen}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Edit handles</DialogTitle>
        </DialogHeader>
        <ScrollArea className="h-[400px] rounded-md border px-3 py-2">
          <HandlesTree
            treeData={treeData}
            checked={checked}
            onCheckedChange={setChecked}
          />
        </ScrollArea>
        <DialogFooter>
          <Button variant="outline" onClick={() => setMenuOpen(false)}>
            Cancel
          </Button>
          <Button onClick={handleSave}>Save</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
