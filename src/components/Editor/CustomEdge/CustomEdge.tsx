'use client';

import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  EdgeLabelRenderer,
  getBezierPath,
  Position,
  EdgeProps,
  useStore,
} from '@xyflow/react';
import {
  CustomEdgeData,
  GetControlWithCurvatureParams,
  Transformer as ApiTransformer,
} from '../../../lib/types';
import {
  cubicBezierPoint,
  edgeMenuPointT,
  generateBezierPoints,
  touchesActiveHandle,
} from '../../../lib/editorUtils';
import { CustomEdgeToolbar } from '../Toolbars';
import { connectorGroupId } from '../../../lib/containerGraph';
import { useFocusedEdges } from '../../../lib/edgeFocus';
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

  const { setNodes, setEdges, activeHandle, setActiveHandle } =
    useEditorActions();

  const isHandleFlowActive = touchesActiveHandle(activeHandle, {
    source,
    target,
    sourceHandle: sourceHandleId,
    targetHandle: targetHandleId,
  });

  const isSourceSelected = useStore(
    (s) => s.nodeLookup.get(source)?.selected ?? false,
  );
  const isTargetSelected = useStore(
    (s) => s.nodeLookup.get(target)?.selected ?? false,
  );

  // Edges carrying a selected block's outputs on through Status touch neither
  // end of the selection, so the canvas says which they are (see EditorArea);
  // they flow like the selection's own.
  const isRelayed = useFocusedEdges().has(id);
  const isFlowActive =
    isHandleFlowActive || isSourceSelected || isTargetSelected || isRelayed;

  // An edge starts in the colour of the handle its flow leaves, violet from
  // Status and blue from Spec or a block output, and fades into the other
  // colour, so it shows where its data comes from.
  const fromStatus = source === connectorGroupId('output');
  const gradientId = `edge-gradient-${id.replace(/[^\w-]/g, '_')}`;

  // While other edges are active this one steps back; the canvas decides
  // whether any are (see `edges-focused` in EditorArea).
  const inactiveClass = isFlowActive || selected ? '' : 'edge-inactive';

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

  // The menu opens from its own point rather than from wherever the path was
  // clicked, so it always lands in the same spot relative to the edge.
  const [menuX, menuY] = useMemo(
    () =>
      cubicBezierPoint(
        edgeMenuPointT(transformers?.length ?? 0),
        [sourceX, sourceY],
        [sourceControlX, sourceControlY],
        [targetControlX, targetControlY],
        [targetX, targetY],
      ),
    [
      transformers,
      sourceX,
      sourceY,
      sourceControlX,
      sourceControlY,
      targetControlX,
      targetControlY,
      targetX,
      targetY,
    ],
  );

  const onMenuPointClick = useCallback(
    (ev: React.MouseEvent) => {
      // Without this the click reaches the pane, which clears the selection
      // and closes the menu again.
      ev.stopPropagation();
      const open = !openEdgeToolbar;
      setOpenEdgeToolbar(open);
      setEdges((eds) =>
        eds.map((ed) => (ed.id === id ? { ...ed, selected: open } : ed)),
      );
      if (!open) return;
      // Same reason as the handles: the click never reaches the pane, so the
      // edge takes the focus from whatever was holding it.
      setActiveHandle(null);
      setNodes((nds) =>
        nds.map((node) =>
          node.selected ? { ...node, selected: false } : node,
        ),
      );
    },
    [id, openEdgeToolbar, setActiveHandle, setEdges, setNodes],
  );

  // Selecting the edge only highlights it; losing the selection closes a menu
  // opened from the point.
  useEffect(() => {
    if (!selected) {
      setOpenEdgeToolbar(false);
    }
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
          className={inactiveClass}
        />
      );
    });
  };

  return (
    <>
      {/* Anchored to the ends themselves, so the colours follow the flow
          whichever way the edge runs on the canvas. */}
      <defs>
        <linearGradient
          id={gradientId}
          gradientUnits="userSpaceOnUse"
          x1={sourceX}
          y1={sourceY}
          x2={targetX}
          y2={targetY}
        >
          <stop
            offset="0%"
            style={{
              stopColor: fromStatus
                ? 'var(--edge-input-color)'
                : 'var(--edge-output-color)',
            }}
          />
          <stop
            offset="100%"
            style={{
              stopColor: fromStatus
                ? 'var(--edge-output-color)'
                : 'var(--edge-input-color)',
            }}
          />
        </linearGradient>
      </defs>
      <path
        id={id}
        style={{ ...style, stroke: `url(#${gradientId})` }}
        className={`react-flow__edge-path nopan nodrag ${isFlowActive ? 'edge-flow-animated' : ''} ${inactiveClass}`}
        d={edgePath}
      />
      <EdgeLabelRenderer>
        {renderTransformers()}
        <button
          type="button"
          // Active only while its own menu is open: opening a transformer's
          // menu selects the edge too, and that should not light this up.
          className={`edge-menu-point nodrag nopan ${
            openEdgeToolbar ? 'is-active' : ''
          } ${inactiveClass}`}
          style={{
            transform: `translate(-50%, -50%) translate(${menuX}px, ${menuY}px)`,
          }}
          onMouseDown={(ev) => ev.stopPropagation()}
          onClick={onMenuPointClick}
          aria-label="Open edge menu"
        />
        {!openTransformerToolbar && openEdgeToolbar && (
          <CustomEdgeToolbar
            edgeId={id}
            setTransformers={setTransformers}
            toolbarPosition={{ x: menuX, y: menuY }}
          />
        )}
      </EdgeLabelRenderer>
    </>
  );
};

export const CustomEdge = React.memo(CustomEdgeComponent);
