'use client';
import React from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '../../ui/dialog';
import { TransformerDeletionDialogProps } from '../../../lib/types';
import { Button } from '../../ui/button';
import { useEditorActions } from '../EditorAreaContext/EditorAreaContext';

export const TransformerDeletionDialog = ({
  open,
  setOpen,
  setTransformers,
  transformerIndex,
  setOpenTransformerToolbar,
  edgeId,
}: TransformerDeletionDialogProps) => {
  const { setEdges } = useEditorActions();

  const handleCancelDelete = () => {
    setOpen(false);
  };

  const handleConfirmDelete = () => {
    setTransformers((transformers) => {
      if (transformers) {
        return transformers.filter((_, index) => index !== transformerIndex);
      }
      return undefined;
    });

    setOpenTransformerToolbar(false);
    setEdges((eds) =>
      eds.map((ed) => (ed.id === edgeId ? { ...ed, selected: false } : ed)),
    );
    setOpen(false);
  };

  return (
    <Dialog open={open} onOpenChange={handleCancelDelete}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Confirm Deletion</DialogTitle>
          <DialogDescription>
            Are you sure you want to delete this transformer?
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
