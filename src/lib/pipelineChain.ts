import type { Edge as RFEdge, Node as RFNode } from '@xyflow/react';
import type { Pipeline } from '../api/types';
import type { PipelineGroupNodeData } from './types';
import { PIPELINE_IN_HANDLE, PIPELINE_OUT_HANDLE } from './editorUtils';

// The chain between pipeline steps: one edge from a step to the step that runs
// after it. The order these edges describe is the pipeline order.

const isPipelineEdge = (edge: RFEdge): boolean =>
  edge.sourceHandle === PIPELINE_OUT_HANDLE &&
  edge.targetHandle === PIPELINE_IN_HANDLE;

/** The edge running from one step to the next. */
export const pipelineEdge = (source: string, target: string): RFEdge => ({
  id: `pipeline-${source}-${target}`,
  source,
  sourceHandle: PIPELINE_OUT_HANDLE,
  target,
  targetHandle: PIPELINE_IN_HANDLE,
  type: 'pipelineEdge',
  selectable: false,
  focusable: false,
  reconnectable: false,
  className: 'pipeline-step-edge',
});

/**
 * `edges` with `source` linked to `target`. A step leads to one next step and
 * follows one previous step, so whatever `source` led to and whatever led to
 * `target` are unlinked first.
 */
export const linkPipelineSteps = (
  edges: RFEdge[],
  source: string,
  target: string,
): RFEdge[] => [
  ...edges.filter(
    (edge) =>
      !(
        isPipelineEdge(edge) &&
        (edge.source === source || edge.target === target)
      ),
  ),
  pipelineEdge(source, target),
];

/** Whether linking `source` to `target` would make the pipeline loop. */
export const closesPipelineLoop = (
  edges: RFEdge[],
  source: string,
  target: string,
): boolean => {
  if (source === target) return true;
  // The chain as it would be once the link replaced what it replaces.
  const next = new Map<string, string>();
  for (const edge of edges) {
    if (!isPipelineEdge(edge)) continue;
    if (edge.source === source || edge.target === target) continue;
    next.set(edge.source, edge.target);
  }
  const seen = new Set<string>();
  let id: string | undefined = target;
  while (id && !seen.has(id)) {
    if (id === source) return true;
    seen.add(id);
    id = next.get(id);
  }
  return false;
};

/**
 * `edges` without the step `groupId`, its neighbours linked to each other so
 * the steps around it keep their order.
 */
export const unlinkPipelineStep = (
  edges: RFEdge[],
  groupId: string,
): RFEdge[] => {
  const before = edges.find(
    (edge) => isPipelineEdge(edge) && edge.target === groupId,
  )?.source;
  const after = edges.find(
    (edge) => isPipelineEdge(edge) && edge.source === groupId,
  )?.target;
  const rest = edges.filter(
    (edge) => edge.source !== groupId && edge.target !== groupId,
  );
  return before && after ? linkPipelineSteps(rest, before, after) : rest;
};

/** `base`, or `base-2`, `base-3`… if a step is already called that. */
export const uniqueStepName = (taken: string[], base: string): string => {
  const names = new Set(taken);
  if (!names.has(base)) return base;
  let suffix = 2;
  while (names.has(`${base}-${suffix}`)) suffix++;
  return `${base}-${suffix}`;
};

/** The name a function package is referenced by: its last path segment. */
export const functionRefName = (url: string): string =>
  (url.split('/').pop() ?? url).split(':')[0] || url;

/**
 * The pipeline as the canvas describes it: the steps of its groups in the order
 * their chain runs, each chain followed from a group nothing leads to. Groups
 * that are not linked, or caught in a loop, follow in canvas order.
 */
export const collectPipeline = (
  graphNodes: RFNode[],
  graphEdges: RFEdge[],
): Pipeline[] => {
  const groups = graphNodes.filter((node) => node.type === 'pipelineGroup');
  const byId = new Map(groups.map((group) => [group.id, group]));
  const next = new Map<string, string>();
  const hasPrevious = new Set<string>();
  for (const edge of graphEdges) {
    if (!isPipelineEdge(edge)) continue;
    if (!byId.has(edge.source) || !byId.has(edge.target)) continue;
    next.set(edge.source, edge.target);
    hasPrevious.add(edge.target);
  }

  const ordered: RFNode[] = [];
  const seen = new Set<string>();
  for (const start of groups) {
    if (hasPrevious.has(start.id)) continue;
    let id: string | undefined = start.id;
    while (id && !seen.has(id)) {
      const group = byId.get(id);
      if (!group) break;
      seen.add(id);
      ordered.push(group);
      id = next.get(id);
    }
  }

  return [...ordered, ...groups.filter((group) => !seen.has(group.id))].map(
    (group) => {
      const { fn, step } = group.data as PipelineGroupNodeData;
      return { ...fn, step };
    },
  );
};
