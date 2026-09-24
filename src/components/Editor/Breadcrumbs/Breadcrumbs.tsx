'use client';

import React, { useEffect, useState } from 'react';
import { ChevronRight } from 'lucide-react';
import { useEditorAreaContext } from '../EditorAreaContext';

/**
 * Trail of the two editing levels: the configuration, and the container that
 * is open on top of it.
 */
export const Breadcrumbs = () => {
  const {
    adapter,
    entityRef,
    editorMode,
    activeContainerId,
    closeContainer,
    nodes,
  } = useEditorAreaContext();
  const { entity, entityId } = entityRef;
  const [configurationName, setConfigurationName] = useState<string | null>(
    null,
  );

  useEffect(() => {
    let cancelled = false;
    if (entity !== 'configuration' || !entityId) {
      setConfigurationName(null);
      return;
    }
    adapter
      .getConfiguration(entityId)
      .then((configuration) => {
        if (!cancelled) setConfigurationName(configuration?.name ?? null);
      })
      .catch(() => undefined);
    return () => {
      cancelled = true;
    };
  }, [adapter, entity, entityId]);

  const rootLabel = configurationName ?? entityId ?? 'Configuration';
  const container = nodes.find((node) => node.id === activeContainerId);
  const containerLabel =
    ((container?.data as { name?: string } | undefined)?.name ??
      activeContainerId) ||
    null;

  if (editorMode !== 'container' || !containerLabel) {
    return (
      <span className="text-xs font-medium text-muted-foreground">
        {rootLabel}
      </span>
    );
  }

  return (
    <nav aria-label="Breadcrumb" className="flex items-center gap-1 text-xs">
      <button
        type="button"
        onClick={closeContainer}
        className="font-medium text-muted-foreground hover:text-foreground hover:underline"
      >
        {rootLabel}
      </button>
      <ChevronRight className="h-3 w-3 text-muted-foreground" />
      <span className="font-medium">{containerLabel}</span>
    </nav>
  );
};
