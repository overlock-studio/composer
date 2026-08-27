'use client';
import React from 'react';
import { Handle, Node, NodeProps, NodeResizer, Position } from '@xyflow/react';
import { Layers } from 'lucide-react';
import { PipelineGroupNodeData } from '../../../lib/types';
import {
  PIPELINE_GROUP_HEADER_HEIGHT,
  PIPELINE_GROUP_MIN_HEIGHT,
  PIPELINE_GROUP_MIN_WIDTH,
  PIPELINE_IN_HANDLE,
  PIPELINE_OUT_HANDLE,
} from '../../../lib/editorUtils';

/**
 * One step of the container's pipeline, drawn as a subflow group. The
 * patch-and-transform step is the one that holds resource blocks — they are its
 * children, so dragging the group takes them with it. Every other step gets a
 * group of its own too, empty until its behaviour is built.
 *
 * The handles top and bottom carry the chain between consecutive steps, which
 * run down the canvas in pipeline order. That order comes from the composition,
 * so they are not wired by hand.
 */
const CHAIN_HANDLE_STYLE = {
  left: '50%',
  right: 'unset',
  transform: 'translateX(-50%)',
} as const;
const CHAIN_IN_STYLE = { ...CHAIN_HANDLE_STYLE, top: -5, bottom: 'unset' };
const CHAIN_OUT_STYLE = { ...CHAIN_HANDLE_STYLE, top: 'unset', bottom: -5 };

const PipelineGroupNodeComponent = ({
  data,
  selected,
}: NodeProps<Node<PipelineGroupNodeData>>) => (
  <div className="pipeline-group">
    {/* A step is sized to fit its blocks on open; from there it is the user's
        to resize. Children are kept inside, so the floor leaves room for a
        block. */}
    <NodeResizer
      isVisible={selected}
      minWidth={PIPELINE_GROUP_MIN_WIDTH}
      minHeight={PIPELINE_GROUP_MIN_HEIGHT}
      lineClassName="pipeline-group-resize-line"
      handleClassName="pipeline-group-resize-handle"
    />
    {/* Centred top and bottom, clear of the data edges that cross the group
        left to right. Set inline because the shared handle rules pin every
        handle to a side. */}
    <Handle
      type="target"
      position={Position.Top}
      id={PIPELINE_IN_HANDLE}
      isConnectable={false}
      className="pipeline-group-handle"
      style={CHAIN_IN_STYLE}
    />
    <Handle
      type="source"
      position={Position.Bottom}
      id={PIPELINE_OUT_HANDLE}
      isConnectable={false}
      className="pipeline-group-handle"
      style={CHAIN_OUT_STYLE}
    />
    <div
      className="pipeline-group-header"
      style={{ height: PIPELINE_GROUP_HEADER_HEIGHT }}
    >
      <Layers className="size-3 shrink-0 text-muted-foreground" />
      <span className="truncate text-xs font-medium">{data.step}</span>
      {data.functionName && (
        <span className="truncate text-[10px] text-muted-foreground">
          {data.functionName}
        </span>
      )}
    </div>
    {!data.holdsResources && (
      <div className="pipeline-group-empty">
        No blocks — this step is configured on its own
      </div>
    )}
  </div>
);

export const PipelineGroupNode = React.memo(PipelineGroupNodeComponent);
