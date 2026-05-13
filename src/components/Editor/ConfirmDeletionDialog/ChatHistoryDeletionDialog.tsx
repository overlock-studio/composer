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
import { Button } from '../../ui/button';

interface ChatHistoryDeletionDialogProps {
  open: boolean;
  onCancel: () => void;
  onConfirm: () => void;
}

export const ChatHistoryDeletionDialog = ({
  open,
  onCancel,
  onConfirm,
}: ChatHistoryDeletionDialogProps) => {
  return (
    <Dialog open={open} onOpenChange={onCancel}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Delete Chat History</DialogTitle>
          <DialogDescription>
            Are you sure you want to delete all chat messages?
          </DialogDescription>
        </DialogHeader>
        <DialogFooter>
          <Button onClick={onCancel} variant="outline">
            Cancel
          </Button>
          <Button onClick={onConfirm} variant="destructive">
            Delete
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
