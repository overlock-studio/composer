'use client';
import React, { useMemo, useState } from 'react';
import { ChevronDown, ChevronRight } from 'lucide-react';
import { Checkbox } from '../../ui/checkbox';
import { HandleTreeNode, HandlesTreeProps } from '../../../lib/types';
import { cn } from '../../../lib/utils';

type CheckState = 'checked' | 'unchecked' | 'indeterminate';

const collectLeafValues = (node: HandleTreeNode): string[] => {
  if (!node.children || node.children.length === 0) {
    return [node.value];
  }
  return node.children.flatMap(collectLeafValues);
};

const getCheckState = (
  node: HandleTreeNode,
  checked: Set<string>,
): CheckState => {
  const leaves = collectLeafValues(node);
  if (leaves.length === 0) return 'unchecked';
  const checkedCount = leaves.filter((leaf) => checked.has(leaf)).length;
  if (checkedCount === 0) return 'unchecked';
  if (checkedCount === leaves.length) return 'checked';
  return 'indeterminate';
};

type TreeRowProps = {
  node: HandleTreeNode;
  checkedSet: Set<string>;
  onCheckChange: (path: string, checked: boolean) => void;
  depth: number;
};

const TreeRow = ({ node, checkedSet, onCheckChange, depth }: TreeRowProps) => {
  const hasChildren = !!node.children && node.children.length > 0;
  const [expanded, setExpanded] = useState(false);
  const state = getCheckState(node, checkedSet);

  const handleToggleChecked = (next: boolean) => {
    if (hasChildren) {
      const leaves = collectLeafValues(node);
      leaves.forEach((leaf) => onCheckChange(leaf, next));
    } else {
      onCheckChange(node.value, next);
    }
  };

  return (
    <div>
      <div
        className="flex items-center gap-2 py-1"
        style={{ paddingLeft: depth * 16 }}
      >
        <button
          type="button"
          onClick={() => hasChildren && setExpanded((v) => !v)}
          aria-label={expanded ? 'Collapse' : 'Expand'}
          className={cn(
            'flex h-4 w-4 shrink-0 items-center justify-center text-muted-foreground',
            !hasChildren && 'invisible',
          )}
        >
          {expanded ? (
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
          onCheckedChange={(value) => handleToggleChecked(value === true)}
        />
        <label
          htmlFor={`handle-${node.value}`}
          title={node.title}
          className="cursor-pointer select-none truncate text-sm"
        >
          {node.label}
        </label>
      </div>
      {hasChildren && expanded && (
        <div>
          {(node.children ?? []).map((child) => (
            <TreeRow
              key={child.value}
              node={child}
              checkedSet={checkedSet}
              onCheckChange={onCheckChange}
              depth={depth + 1}
            />
          ))}
        </div>
      )}
    </div>
  );
};

export const HandlesTree = ({
  treeData,
  checked,
  onCheckChange,
}: HandlesTreeProps) => {
  const checkedSet = useMemo(() => new Set(checked), [checked]);

  return (
    <div className="text-sm">
      {treeData.map((node) => (
        <TreeRow
          key={node.value}
          node={node}
          checkedSet={checkedSet}
          onCheckChange={onCheckChange}
          depth={0}
        />
      ))}
    </div>
  );
};
