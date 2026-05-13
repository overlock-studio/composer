'use client';
import React, { useCallback, useEffect, useState } from 'react';
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
import { EditHandlesMenuProps, Handle, HandleTreeNode } from '../../../lib/types';
import { useEditorAreaContext } from '../EditorAreaContext';
import { HandlesTree } from './HandlesTree';

const collectLeafNodes = (nodes: HandleTreeNode[]): HandleTreeNode[] => {
  const result: HandleTreeNode[] = [];
  const visit = (node: HandleTreeNode) => {
    if (!node.children || node.children.length === 0) {
      result.push(node);
      return;
    }
    node.children.forEach(visit);
  };
  nodes.forEach(visit);
  return result;
};

export const EditHandlesMenu = ({
  nodeId,
  handlesStates: { setHandles, handles },
  treeData,
  open,
  setMenuOpen,
}: EditHandlesMenuProps) => {
  const updateNodeInternals = useUpdateNodeInternals();
  const { setEdges } = useEditorAreaContext();

  const [checked, setChecked] = useState<string[]>(
    handles.map((handle) => handle.path),
  );

  useEffect(() => {
    if (open) {
      setChecked(handles.map((handle) => handle.path));
    }
  }, [open, handles]);

  const handleCheckChange = useCallback((path: string, isChecked: boolean) => {
    setChecked((prev) => {
      if (isChecked) {
        if (prev.includes(path)) return prev;
        return [...prev, path];
      }
      return prev.filter((p) => p !== path);
    });
  }, []);

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
    const updatedHandles: Handle[] = collectLeafNodes(treeData)
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
            onCheckChange={handleCheckChange}
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
