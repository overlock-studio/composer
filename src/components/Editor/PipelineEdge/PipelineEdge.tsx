'use client';

import React, { useCallback } from 'react';
import {
  BaseEdge,
  EdgeLabelRenderer,
  EdgeProps,
  getSmoothStepPath,
} from '@xyflow/react';
import { X } from 'lucide-react';
import { useEditorActions } from '../EditorAreaContext';

/**
 * The link from one pipeline step to the next. Drawn as a dashed hint rather
 * than a data edge, with a button in its middle that unlinks the two steps.
 */
const PipelineEdgeComponent = ({
  id,
  sourceX,
  sourceY,
  targetX,
  targetY,
  sourcePosition,
  targetPosition,
  style,
}: EdgeProps) => {
  const { setEdges } = useEditorActions();
  const [path, labelX, labelY] = getSmoothStepPath({
    sourceX,
    sourceY,
    sourcePosition,
    targetX,
    targetY,
    targetPosition,
  });

  const unlink = useCallback(
    () => setEdges((eds) => eds.filter((edge) => edge.id !== id)),
    [id, setEdges],
  );

  return (
    <>
      <BaseEdge id={id} path={path} style={style} />
      <EdgeLabelRenderer>
        <button
          type="button"
          className="pipeline-edge-unlink nodrag nopan"
          style={{
            transform: `translate(-50%, -50%) translate(${labelX}px, ${labelY}px)`,
          }}
          onMouseDown={(ev) => ev.stopPropagation()}
          onClick={unlink}
          aria-label="Unlink pipeline steps"
        >
          <X />
        </button>
      </EdgeLabelRenderer>
    </>
  );
};

export const PipelineEdge = React.memo(PipelineEdgeComponent);
