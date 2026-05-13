'use client';
import React, { useCallback, useState } from 'react';
import { useViewport } from '@xyflow/react';
import {
  CustomEdgeToolbarProps,
  TransformersType,
  Transformer as ApiTransformer,
} from '../../../lib/types';
import { EdgeDeletionDialog } from '../ConfirmDeletionDialog';
import { Plus, Trash2 } from 'lucide-react';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '../../ui/popover';
import { Button } from '../../ui/button';
import { TRANSFORMERS_DEFAULT } from '../../../lib/editorUtils';
import { useEditorAreaContext } from '../EditorAreaContext';

export const CustomEdgeToolbar = ({
  edgeId,
  setTransformers,
  toolbarPosition,
}: CustomEdgeToolbarProps) => {
  const [openDeleteDialog, setOpenDeleteDialog] = useState(false);
  const { zoom } = useViewport();

  const handleDeleteEdgeClick = useCallback(() => {
    setOpenDeleteDialog(true);
  }, []);

  const [openAddTransformers, setOpenAddTransformers] =
    useState<boolean>(false);

  const { setEdges } = useEditorAreaContext();

  const addTransformersClose = useCallback(() => {
    setEdges((eds) =>
      eds.map((ed) => (ed.id === edgeId ? { ...ed, selected: false } : ed)),
    );
  }, [edgeId, setEdges]);

  const handleMenuItemClick = useCallback(
    (type: TransformersType) => {
      const transformer = TRANSFORMERS_DEFAULT[type] as ApiTransformer;
      addTransformersClose();
      if (setTransformers)
        setTransformers((prev) =>
          prev ? [...prev, transformer] : [transformer],
        );
    },
    [setTransformers, addTransformersClose],
  );

  return (
    <>
      <div
        style={{
          left: `${toolbarPosition.x}px`,
          top: `${toolbarPosition.y}px`,
          transform: `translate(-50%, -50%) scale(${1 / zoom}) translateY(-50px)`,
          pointerEvents: 'all',
        }}
        className="nodrag nopan absolute z-[10003] border bg-sidebar border-sidebar-border rounded-lg"
      >
        {setTransformers && (
          <Popover
            open={openAddTransformers}
            onOpenChange={setOpenAddTransformers}
          >
            <PopoverTrigger asChild>
              <Button
                variant="ghost"
                onClick={() => {
                  if (openAddTransformers) {
                    addTransformersClose();
                  }
                  setOpenAddTransformers((prev) => !prev);
                }}
              >
                <Plus /> Add
              </Button>
            </PopoverTrigger>
            <PopoverContent>
              {Object.keys(TRANSFORMERS_DEFAULT).map((type) => (
                <div
                  key={type}
                  onClick={() => handleMenuItemClick(type as TransformersType)}
                  className={
                    'cursor-pointer gap-2 rounded-sm px-2 py-1.5 text-sm hover:bg-accent'
                  }
                >
                  {type}
                </div>
              ))}
            </PopoverContent>
          </Popover>
        )}
        <Button
          variant="ghost"
          onClick={handleDeleteEdgeClick}
          className="text-destructive"
        >
          <Trash2 />
        </Button>
      </div>

      <EdgeDeletionDialog
        open={openDeleteDialog}
        edgeId={edgeId}
        setOpen={setOpenDeleteDialog}
      />
    </>
  );
};
