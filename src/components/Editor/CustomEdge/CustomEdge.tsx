'use client';

import React, { useCallback, useEffect, useState } from 'react';
import {
  EdgeLabelRenderer,
  getBezierPath,
  Position,
  EdgeProps,
  useStore,
  useViewport,
} from '@xyflow/react';
import {
  CustomEdgeData,
  GetControlWithCurvatureParams,
  Transformer as ApiTransformer,
} from '../../../lib/types';
import { generateBezierPoints } from '../../../lib/editorUtils';
import { CustomEdgeToolbar } from '../Toolbars';
import { Transformer } from '../Transformer';
import { useEditorActions } from '../EditorAreaContext';

const CustomEdgeComponent = ({
  id,
  source,
  target,
  sourceHandleId,
  targetHandleId,
  sourceX,
  sourceY,
  targetX,
  targetY,
  sourcePosition,
  targetPosition,
  style = {},
  selected,
  data,
}: EdgeProps & { data: CustomEdgeData }) => {
  const CURVATURE = 0.25;

  const [transformers, setTransformers] = useState<
    ApiTransformer[] | undefined
  >(data?.transformers);

  const { setEdges, activeHandle } = useEditorActions();

  const isHandleFlowActive =
    !!activeHandle &&
    ((activeHandle.type === 'source' &&
      activeHandle.nodeId === source &&
      activeHandle.handleId === (sourceHandleId ?? '')) ||
      (activeHandle.type === 'target' &&
        activeHandle.nodeId === target &&
        activeHandle.handleId === (targetHandleId ?? '')));

  const isSourceSelected = useStore(
    (s) => s.nodeLookup.get(source)?.selected ?? false,
  );
  const isTargetSelected = useStore(
    (s) => s.nodeLookup.get(target)?.selected ?? false,
  );

  const isFlowActive = isHandleFlowActive || isSourceSelected || isTargetSelected;

  useEffect(() => {
    setEdges((eds) =>
      eds.map((ed) =>
        ed.id === id &&
        JSON.stringify(ed?.data?.transformers) !== JSON.stringify(transformers)
          ? { ...ed, data: { ...data, transformers } }
          : ed,
      ),
    );
  }, [transformers, data, id, setEdges]);

  const [openEdgeToolbar, setOpenEdgeToolbar] = useState<boolean>(false);
  const [toolbarPosition, setToolbarPosition] = useState<{
    x: number;
    y: number;
  }>({ x: 0, y: 0 });
  const { zoom, x: viewPortX, y: viewPortY } = useViewport();

  const [openTransformerToolbar, setOpenTransformerToolbar] =
    useState<boolean>(false);

  const [edgePath] = getBezierPath({
    sourceX,
    sourceY,
    sourcePosition,
    targetX,
    targetY,
    targetPosition,
    curvature: CURVATURE,
  });

  function calculateControlOffset(distance: number, curvature: number): number {
    if (distance >= 0) {
      return 0.5 * distance;
    }
    return curvature * 25 * Math.sqrt(Math.abs(distance));
  }

  function getControlWithCurvature({
    pos,
    x1,
    y1,
    x2,
    y2,
    c,
  }: GetControlWithCurvatureParams): [number, number] {
    switch (pos) {
      case Position.Left:
        return [x1 - calculateControlOffset(x1 - x2, c), y1];
      case Position.Right:
        return [x1 + calculateControlOffset(x2 - x1, c), y1];
      case Position.Top:
        return [x1, y1 - calculateControlOffset(y1 - y2, c)];
      case Position.Bottom:
        return [x1, y1 + calculateControlOffset(y2 - y1, c)];
      default:
        return [0, 0];
    }
  }

  const [sourceControlX, sourceControlY] = getControlWithCurvature({
    pos: sourcePosition,
    x1: sourceX,
    y1: sourceY,
    x2: targetX,
    y2: targetY,
    c: CURVATURE,
  });

  const [targetControlX, targetControlY] = getControlWithCurvature({
    pos: targetPosition,
    x1: targetX,
    y1: targetY,
    x2: sourceX,
    y2: sourceY,
    c: CURVATURE,
  });

  const onPathClick = useCallback(
    (ev: React.MouseEvent<SVGPathElement, globalThis.MouseEvent>) => {
      if (data.reactFlowRef?.current) {
        const bounds = data.reactFlowRef.current.getBoundingClientRect();
        const x = (ev.clientX - bounds.left - viewPortX) / zoom;
        const y = (ev.clientY - bounds.top - viewPortY) / zoom;
        setToolbarPosition({ x, y });
      }
    },
    [data, viewPortX, viewPortY, zoom],
  );

  useEffect(() => {
    setOpenEdgeToolbar(Boolean(selected));
  }, [selected]);

  useEffect(() => {
    if (!transformers || transformers.length === 0) {
      setOpenTransformerToolbar(false);
    }
  }, [transformers]);

  const renderTransformers = () => {
    if (!transformers) {
      return null;
    }

    const points = generateBezierPoints(
      [sourceX, sourceY],
      [sourceControlX, sourceControlY],
      [targetControlX, targetControlY],
      [targetX, targetY],
      transformers.length,
    );

    return transformers.map((transformer, index) => {
      const [positionX, positionY] = points[index];
      return (
        <Transformer
          key={index}
          transformerIndex={index}
          edgeId={id}
          transformer={transformer}
          setTransformers={setTransformers}
          positionX={positionX}
          positionY={positionY}
          setOpenTransformerToolbar={setOpenTransformerToolbar}
        />
      );
    });
  };

  return (
    <>
      <path
        id={id}
        style={style}
        className={`react-flow__edge-path nopan nodrag ${isFlowActive ? 'edge-flow-animated' : ''}`}
        d={edgePath}
        onClick={(ev) => onPathClick(ev)}
      />
      <EdgeLabelRenderer>
        {renderTransformers()}
        {!openTransformerToolbar && openEdgeToolbar && (
          <CustomEdgeToolbar
            edgeId={id}
            setTransformers={setTransformers}
            toolbarPosition={toolbarPosition}
          />
        )}
      </EdgeLabelRenderer>
    </>
  );
};

export const CustomEdge = React.memo(CustomEdgeComponent);
