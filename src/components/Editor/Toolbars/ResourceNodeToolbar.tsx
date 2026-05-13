'use client';
import React, { useState } from 'react';
import { Position, NodeToolbar as ReactFlowNodeToolbar } from '@xyflow/react';
import { ResourceNodeToolbarProps } from '../../../lib/types';
import { NodeDeletionDialog } from '../ConfirmDeletionDialog';
import { EditHandlesMenu } from '../Menus';
import { Ellipsis, Plus, Trash2 } from 'lucide-react';
import { Button } from '../../ui/button';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '../../ui/popover';

export const ResourceNodeToolbar = ({
  nodeId,
  enableDeleteNode = true,
  handlesStates,
  treeData,
}: ResourceNodeToolbarProps) => {
  const [openDeleteDialog, setOpenDeleteDialog] = useState(false);
  const [editOpen, setEditOpen] = useState<boolean>(false);
  const [menuOpen, setMenuOpen] = useState<boolean>(false);

  return (
    <>
      <ReactFlowNodeToolbar
        position={Position.Top}
        className="nodrag nopan border bg-sidebar border-sidebar-border rounded-lg"
      >
        {handlesStates && (
          <>
            <Button variant="ghost" onClick={() => setEditOpen(true)}>
              <Plus /> Add
            </Button>
            <EditHandlesMenu
              nodeId={nodeId}
              handlesStates={handlesStates}
              treeData={treeData}
              open={editOpen}
              setMenuOpen={setEditOpen}
            />
          </>
        )}
        {enableDeleteNode && (
          <>
            <Popover open={menuOpen} onOpenChange={setMenuOpen}>
              <PopoverTrigger asChild>
                <Button
                  variant="ghost"
                  onClick={() => setMenuOpen((prev) => !prev)}
                >
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
              nodeId={nodeId}
              setOpen={setOpenDeleteDialog}
            />
          </>
        )}
      </ReactFlowNodeToolbar>
    </>
  );
};
