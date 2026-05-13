import React from 'react';
import { ConnectorNodeDeletionDialogProps } from '../../../lib/types';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '../../ui/dialog';
import { Button } from '../../ui/button';

export const ConnectorNodeDeletionDialog = ({
  open,
  nodeId,
  setOpen,
  setConnectors,
}: ConnectorNodeDeletionDialogProps) => {
  const handleCancelDelete = () => {
    if (open) {
      setOpen(false);
    }
  };

  const handleConfirmDelete = () => {
    setConnectors((conns) => {
      return conns.filter((conn) => conn.path !== nodeId);
    });
    setOpen(false);
  };

  return (
    <Dialog open={open} onOpenChange={handleCancelDelete}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Confirm Deletion</DialogTitle>
          <DialogDescription>
            Are you sure you want to delete this connector?
          </DialogDescription>
        </DialogHeader>
        <DialogFooter>
          <Button onClick={handleCancelDelete} color="primary">
            Cancel
          </Button>
          <Button onClick={handleConfirmDelete} color="primary">
            Delete
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
