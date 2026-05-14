'use client';
import React, { useState } from 'react';
import { Button } from '../../ui/button';
import { Position, NodeToolbar as ReactFlowNodeToolbar } from '@xyflow/react';
import { ConnectorNodeToolbarProps } from '../../../lib/types';
import { Ellipsis, Pencil, Trash2 } from 'lucide-react';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '../../ui/popover';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '../../ui/dialog';
import { EditConnectorsMenu } from '../Menus';

export const ConnectorNodeToolbar = ({
  connector,
  setConnectors,
  onRequestDelete,
}: ConnectorNodeToolbarProps) => {
  const [editOpen, setEditOpen] = useState<boolean>(false);
  const [menuOpen, setMenuOpen] = useState<boolean>(false);

  return (
    <ReactFlowNodeToolbar
      position={Position.Top}
      className="nodrag nopan border bg-sidebar border-sidebar-border rounded-lg"
    >
      <Button variant="ghost" onClick={() => setEditOpen(true)}>
        <Pencil /> Edit
      </Button>
      <Dialog open={editOpen} onOpenChange={setEditOpen}>
        <DialogContent className="sm:max-w-[500px]">
          <DialogHeader>
            <DialogTitle>Edit Connector</DialogTitle>
          </DialogHeader>
          <EditConnectorsMenu
            setOpen={setEditOpen}
            connector={connector}
            setConnectors={setConnectors}
          />
        </DialogContent>
      </Dialog>

      <Popover open={menuOpen} onOpenChange={setMenuOpen}>
        <PopoverTrigger asChild>
          <Button variant="ghost" onClick={() => setMenuOpen((prev) => !prev)}>
            <Ellipsis />
          </Button>
        </PopoverTrigger>
        <PopoverContent className="p-0 w-auto min-w-0" align="start">
          <Button
            variant="ghost"
            onClick={() => {
              setMenuOpen(false);
              onRequestDelete();
            }}
            className="w-full text-destructive"
          >
            <Trash2 />
            Delete
          </Button>
        </PopoverContent>
      </Popover>
    </ReactFlowNodeToolbar>
  );
};
