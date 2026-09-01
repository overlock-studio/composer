'use client';
import React, { useState } from 'react';
import { TransformerProps } from '../../../lib/types';
import { Rotate3d } from 'lucide-react';
import { TransformerToolbar } from '../Toolbars';
import { Popover, PopoverTrigger } from '../../ui/popover';
import { PopoverContent } from '@radix-ui/react-popover';
import { useViewport } from '@xyflow/react';
import { useEditorActions } from '../EditorAreaContext/EditorAreaContext';

export const Transformer = ({
  edgeId,
  transformer,
  positionX,
  positionY,
  setTransformers,
  transformerIndex,
  setOpenTransformerToolbar,
}: TransformerProps) => {
  const { zoom } = useViewport();
  const { setEdges } = useEditorActions();

  const [open, isOpen] = useState(false);

  return (
    <>
      <div
        className="transformer-wrapper"
        style={{
          transform: `translate(-50%, -50%) translate(${positionX}px, ${positionY}px)`,
          zIndex: open ? 10003 : undefined,
        }}
      >
        <div className="transformer">
          <Popover
            open={open}
            onOpenChange={(open) => {
              setOpenTransformerToolbar(open);
              isOpen(open);
              if (!open) {
                setEdges((eds) =>
                  eds.map((ed) =>
                    ed.id === edgeId ? { ...ed, selected: false } : ed,
                  ),
                );
              }
            }}
          >
            <PopoverTrigger asChild>
              <div className="inner">
                <Rotate3d className="nopan nodrag" />
              </div>
            </PopoverTrigger>
            <PopoverContent
              side="top"
              sideOffset={4}
              // Anchored to the chip rather than lifted by a fixed distance, so
              // the menu keeps its gap whatever size the chip is drawn at.
              style={{
                transform: `scale(${1 / zoom})`,
                transformOrigin: 'bottom center',
                zIndex: 10003,
              }}
            >
              <TransformerToolbar
                edgeId={edgeId}
                transformer={transformer}
                setTransformers={setTransformers}
                transformerIndex={transformerIndex}
                setOpenTransformerToolbar={isOpen}
              />
            </PopoverContent>
          </Popover>
        </div>
      </div>
    </>
  );
};
