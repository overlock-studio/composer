'use client';
import React, { useState } from 'react';
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
import { Position, NodeToolbar as ReactFlowNodeToolbar } from '@xyflow/react';
import { Ellipsis, Plus, Trash2, Edit } from 'lucide-react';
import { EditConnectorsMenu } from '../Menus';
import { Button } from '../../ui/button';
import { Input } from '../../ui/input';
import { ContainerNodeToolbarProps } from '../../../lib/types';
import { NodeDeletionDialog } from '../ConfirmDeletionDialog';

export const ContainerNodeToolbar = ({
  setConnectors,
  id,
  name,
  onNameChange,
  kind,
  apiVersion,
  onKindChange,
  onApiVersionChange,
}: ContainerNodeToolbarProps) => {
  const [addOpen, setAddOpen] = useState<boolean>(false);
  const [menuOpen, setMenuOpen] = useState<boolean>(false);
  const [editOpen, setEditOpen] = useState<boolean>(false);
  const [openDeleteDialog, setOpenDeleteDialog] = useState(false);
  const [editName, setEditName] = useState<string>(name || '');
  const [editKind, setEditKind] = useState<string>(kind || '');
  const [editApiVersion, setEditApiVersion] = useState<string>(
    apiVersion || '',
  );

  const handleSave = () => {
    if (editName.trim() && editName !== name) {
      onNameChange(editName.trim());
    }
    if (editKind.trim() !== kind) {
      onKindChange(editKind.trim());
    }
    if (editApiVersion.trim() !== apiVersion) {
      onApiVersionChange(editApiVersion.trim());
    }
    setEditOpen(false);
  };

  return (
    <ReactFlowNodeToolbar
      position={Position.Top}
      className="nodrag nopan border bg-sidebar border-sidebar-border rounded-lg"
    >
      <Button variant="ghost" onClick={() => setAddOpen(true)}>
        <Plus />
      </Button>
      <Dialog open={addOpen} onOpenChange={setAddOpen}>
        <DialogContent className="sm:max-w-[500px]">
          <DialogHeader>
            <DialogTitle>Add Connector</DialogTitle>
          </DialogHeader>
          <EditConnectorsMenu
            setOpen={setAddOpen}
            setConnectors={setConnectors}
          />
        </DialogContent>
      </Dialog>

      <Popover open={editOpen} onOpenChange={setEditOpen}>
        <PopoverTrigger asChild>
          <Button
            variant="ghost"
            onClick={() => {
              setEditName(name || '');
              setEditKind(kind || '');
              setEditApiVersion(apiVersion || '');
              setEditOpen(true);
            }}
          >
            <Edit />
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-80">
          <div className="space-y-4">
            <div>
              <label className="text-sm font-medium">Composition Name</label>
              <Input
                value={editName}
                onChange={(e) => setEditName(e.target.value)}
                placeholder="Enter composition name"
              />
            </div>
            <div>
              <label className="text-sm font-medium">Kind</label>
              <Input
                value={editKind}
                onChange={(e) => setEditKind(e.target.value)}
                placeholder="Enter kind (e.g. XMyResource)"
              />
            </div>
            <div>
              <label className="text-sm font-medium">API Version</label>
              <Input
                value={editApiVersion}
                onChange={(e) => setEditApiVersion(e.target.value)}
                placeholder="Enter API version (e.g. example.org/v1alpha1)"
              />
            </div>
            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={() => setEditOpen(false)}>
                Cancel
              </Button>
              <Button onClick={handleSave}>Save</Button>
            </div>
          </div>
        </PopoverContent>
      </Popover>

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
              setOpenDeleteDialog(true);
              setMenuOpen(false);
            }}
            className="w-full text-destructive"
          >
            <Trash2 />
            Delete
          </Button>
        </PopoverContent>
      </Popover>
      <NodeDeletionDialog
        open={openDeleteDialog}
        nodeId={id}
        setOpen={setOpenDeleteDialog}
      />
    </ReactFlowNodeToolbar>
  );
};
