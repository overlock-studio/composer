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

export const ProviderUnassignDialog = ({
  open,
  setOpen,
  onConfirm,
}: {
  open: boolean;
  setOpen: React.Dispatch<React.SetStateAction<boolean>>;
  onConfirm: () => void;
}) => {
  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Confirm Unassign</DialogTitle>
          <DialogDescription>
            Are you sure you want to unassign this provider?
          </DialogDescription>
        </DialogHeader>
        <DialogFooter>
          <Button onClick={() => setOpen(false)} color="secondary">
            Cancel
          </Button>
          <Button onClick={onConfirm} color="destructive">
            Unassign
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
