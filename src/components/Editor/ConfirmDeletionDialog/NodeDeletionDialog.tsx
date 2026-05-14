'use client';
import React from 'react';
import { NodeDeletionDialogProps } from '../../../lib/types';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '../../ui/dialog';
import { useEditorAreaContext } from '../EditorAreaContext/EditorAreaContext';
import { Button } from '../../ui/button';

export const NodeDeletionDialog = ({
  open,
  nodeId,
  setOpen,
}: NodeDeletionDialogProps) => {
  const { onNodesChange, nodes } = useEditorAreaContext();

  const getAllChildNodeIds = (parentId: string): string[] => {
    const children = nodes.filter((n) => n.parentId === parentId);
    return children.flatMap((child) => [
      child.id,
      ...getAllChildNodeIds(child.id),
    ]);
  };

  const handleCancelDelete = () => {
    if (open) {
      setOpen(false);
    }
  };

  const handleConfirmDelete = () => {
    const childIds = getAllChildNodeIds(nodeId);
    const allIdsToRemove = [nodeId, ...childIds];

    onNodesChange(allIdsToRemove.map((id) => ({ id, type: 'remove' })));
    setOpen(false);
  };

  return (
    <Dialog open={open} onOpenChange={handleCancelDelete}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Confirm Deletion</DialogTitle>
          <DialogDescription>
            Are you sure you want to delete this node and all its children?
          </DialogDescription>
        </DialogHeader>
        <DialogFooter>
          <Button onClick={handleCancelDelete} variant="outline">
            Cancel
          </Button>
          <Button onClick={handleConfirmDelete} variant="destructive">
            Delete
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
