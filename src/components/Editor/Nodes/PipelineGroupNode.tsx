'use client';
import React from 'react';
import { Node, NodeProps } from '@xyflow/react';
import { Layers } from 'lucide-react';
import { PipelineGroupNodeData } from '../../../lib/types';
import { PIPELINE_GROUP_HEADER_HEIGHT } from '../../../lib/editorUtils';

/**
 * One step of the container's pipeline, drawn as a subflow group. The
 * patch-and-transform step is the one that holds resource blocks — they are its
 * children, so dragging the group takes them with it. Every other step gets a
 * group of its own too, empty until its behaviour is built.
 */
const PipelineGroupNodeComponent = ({
  data,
}: NodeProps<Node<PipelineGroupNodeData>>) => (
  <div className="pipeline-group">
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
