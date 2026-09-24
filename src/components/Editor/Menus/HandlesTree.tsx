'use client';
import React, { useCallback, useMemo, useState } from 'react';
import { ChevronDown, ChevronRight } from 'lucide-react';
import { Checkbox } from '../../ui/checkbox';
import { HandleTreeNode, HandlesTreeProps } from '../../../lib/types';
import { cn } from '../../../lib/utils';

type CheckState = 'checked' | 'unchecked' | 'indeterminate';

const hasChildren = (node: HandleTreeNode): boolean =>
  !!node.children && node.children.length > 0;

const subtreeValues = (node: HandleTreeNode): string[] => [
  node.value,
  ...(node.children ?? []).flatMap(subtreeValues),
];

// The top level holds the schema's sections rather than fields, so it stays
// open and is never picked as a key of its own.
const isOpen = (
  node: HandleTreeNode,
  depth: number,
  expanded: Set<string>,
): boolean => hasChildren(node) && (depth === 0 || expanded.has(node.value));

/**
 * What a node's box shows. An open parent sums up the rows below it; a closed
 * one is either picked as a key of its own or, when only fields hidden inside
 * it are, part-way.
 */
const getCheckState = (
  node: HandleTreeNode,
  depth: number,
  checked: Set<string>,
  expanded: Set<string>,
): CheckState => {
  if ((depth > 0 || !hasChildren(node)) && checked.has(node.value))
    return 'checked';
  if (!hasChildren(node)) return 'unchecked';
  if (!isOpen(node, depth, expanded)) {
    return subtreeValues(node).some((value) => checked.has(value))
      ? 'indeterminate'
      : 'unchecked';
  }

  const states = (node.children ?? [])
    .filter((child) => !child.disabled)
    .map((child) => getCheckState(child, depth + 1, checked, expanded));
  if (states.length === 0) return 'unchecked';
  if (states.every((state) => state === 'checked')) return 'checked';
  if (states.every((state) => state === 'unchecked')) return 'unchecked';
  return 'indeterminate';
};

/**
 * Picks what the user can see: a closed parent is taken as a key of its own,
 * standing in for anything picked inside it, and an open one hands the pick
 * down to the rows below it.
 */
const toggleNode = (
  node: HandleTreeNode,
  depth: number,
  next: boolean,
  checked: Set<string>,
  expanded: Set<string>,
): void => {
  if (node.disabled) return;
  if (!isOpen(node, depth, expanded)) {
    subtreeValues(node).forEach((value) => checked.delete(value));
    if (next) checked.add(node.value);
    return;
  }
  checked.delete(node.value);
  (node.children ?? []).forEach((child) =>
    toggleNode(child, depth + 1, next, checked, expanded),
  );
};

type TreeRowProps = {
  node: HandleTreeNode;
  depth: number;
  checkedSet: Set<string>;
  expanded: Set<string>;
  onToggleExpanded: (value: string) => void;
  onToggleChecked: (node: HandleTreeNode, depth: number, next: boolean) => void;
};

const TreeRow = ({
  node,
  depth,
  checkedSet,
  expanded,
  onToggleExpanded,
  onToggleChecked,
}: TreeRowProps) => {
  const open = isOpen(node, depth, expanded);
  const collapsible = hasChildren(node) && depth > 0;
  const state = getCheckState(node, depth, checkedSet, expanded);

  return (
    <div>
      <div
        className="flex items-center gap-2 py-1"
        style={{ paddingLeft: depth * 16 }}
      >
        <button
          type="button"
          onClick={() => collapsible && onToggleExpanded(node.value)}
          aria-label={open ? 'Collapse' : 'Expand'}
          className={cn(
            'flex h-4 w-4 shrink-0 items-center justify-center text-muted-foreground',
            !collapsible && 'invisible',
          )}
        >
          {open ? (
            <ChevronDown className="h-4 w-4" />
          ) : (
            <ChevronRight className="h-4 w-4" />
          )}
        </button>
        <Checkbox
          id={`handle-${node.value}`}
          checked={
            state === 'indeterminate' ? 'indeterminate' : state === 'checked'
          }
          disabled={node.disabled}
          onCheckedChange={(value) =>
            onToggleChecked(node, depth, value === true)
          }
        />
        <label
          htmlFor={`handle-${node.value}`}
          title={node.title}
          className="cursor-pointer select-none truncate text-sm"
        >
          {node.label}
        </label>
      </div>
      {open && (
        <div>
          {(node.children ?? []).map((child) => (
            <TreeRow
              key={child.value}
              node={child}
              depth={depth + 1}
              checkedSet={checkedSet}
              expanded={expanded}
              onToggleExpanded={onToggleExpanded}
              onToggleChecked={onToggleChecked}
            />
          ))}
        </div>
      )}
    </div>
  );
};

/**
 * Schema fields as a checkbox tree. A parent's box picks what is on screen
 * under it: closed, the parent itself as one key, so two blocks sharing a
 * structure can be wired by that key alone; open, every visible row below it.
 */
export const HandlesTree = ({
  treeData,
  checked,
  onCheckedChange,
}: HandlesTreeProps) => {
  const checkedSet = useMemo(() => new Set(checked), [checked]);
  const [expanded, setExpanded] = useState<Set<string>>(() => new Set());

  const onToggleExpanded = useCallback((value: string) => {
    setExpanded((prev) => {
      const next = new Set(prev);
      if (!next.delete(value)) next.add(value);
      return next;
    });
  }, []);

  const onToggleChecked = useCallback(
    (node: HandleTreeNode, depth: number, next: boolean) => {
      const updated = new Set(checkedSet);
      toggleNode(node, depth, next, updated, expanded);
      onCheckedChange([...updated]);
    },
    [checkedSet, expanded, onCheckedChange],
  );

  return (
    <div className="text-sm">
      {treeData.map((node) => (
        <TreeRow
          key={node.value}
          node={node}
          depth={0}
          checkedSet={checkedSet}
          expanded={expanded}
          onToggleExpanded={onToggleExpanded}
          onToggleChecked={onToggleChecked}
        />
      ))}
    </div>
  );
};
