'use client';
import React, { useState } from 'react';
import { TransformerToolbarProps } from '../../../lib/types';
import { TransformerDeletionDialog } from '../ConfirmDeletionDialog';
import { EditTransformerMenu } from '../Menus/EditTransformerMenu';
import { Pencil, Trash2 } from 'lucide-react';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '../../ui/popover';
import { Button } from '../../ui/button';

export const TransformerToolbar = ({
  edgeId,
  setTransformers,
  transformer,
  transformerIndex,
  setOpenTransformerToolbar,
}: TransformerToolbarProps) => {
  const [openDeleteDialog, setOpenDeleteDialog] = useState(false);
  const [open, setOpen] = useState<boolean>(false);

  return (
    <>
      <div className="nodrag nopan border bg-sidebar border-sidebar-border rounded-lg z-[10003]">
        <Popover open={open} onOpenChange={setOpen}>
          <PopoverTrigger asChild>
            <Button variant="ghost">
              <Pencil /> Edit
            </Button>
          </PopoverTrigger>
          <PopoverContent className="p-0">
            <EditTransformerMenu
              transformer={transformer}
              setTransformers={setTransformers}
              transformerIndex={transformerIndex}
              setOpenTransformerToolbar={setOpenTransformerToolbar}
            />
          </PopoverContent>
        </Popover>
        <Button
          variant="ghost"
          onClick={() => setOpenDeleteDialog(true)}
          className="text-destructive"
        >
          <Trash2 />
        </Button>
        <TransformerDeletionDialog
          edgeId={edgeId}
          open={openDeleteDialog}
          setOpen={setOpenDeleteDialog}
          setTransformers={setTransformers}
          transformerIndex={transformerIndex}
          setOpenTransformerToolbar={setOpenTransformerToolbar}
        />
      </div>
    </>
  );
};
