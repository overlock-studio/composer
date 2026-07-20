'use client';
import React from 'react';
import { EdgeDeletionDialogProps } from '../../../lib/types';
import { useEditorActions } from '../EditorAreaContext/EditorAreaContext';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '../../ui/dialog';
import { Button } from '../../ui/button';

export const EdgeDeletionDialog = ({
  open,
  edgeId,
  setOpen,
}: EdgeDeletionDialogProps) => {
  const { setEdges } = useEditorActions();

  const handleConfirmDelete = () => {
    setEdges((eds) => eds.filter((ed) => ed.id !== edgeId));
    setOpen(false);
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Confirm Deletion</DialogTitle>
          <DialogDescription>
            Are you sure you want to delete this edge?
          </DialogDescription>
        </DialogHeader>
        <DialogFooter>
          <Button onClick={() => setOpen(false)} variant="outline">
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
