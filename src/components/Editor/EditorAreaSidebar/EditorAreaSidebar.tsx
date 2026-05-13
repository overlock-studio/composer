'use client';

import React, { useEffect, useMemo, useState } from 'react';
import { useEditorAreaContext } from '../EditorAreaContext';
import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarGroupContent,
} from '../../ui/sidebar';
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from '../../ui/accordion';
import { Input } from '../../ui/input';
import { Spinner } from '../../Spinner';
import useAsync from 'react-use/esm/useAsync';
import { BlockType } from '../../../api/types';
import { BlockCard } from '../BlockCard';
import { ConfigurationDB, CrossplaneProviderDB } from '../../../api/typesDB';
import { Filter } from 'lucide-react';

export const EditorAreaSidebar = () => {
  const {
    setSelectedBlockType,
    addNodeToCanvas,
    adapter,
    entityRef,
    registerBlockTypes,
  } = useEditorAreaContext();
  const [providerBlockTypes, setProviderBlockTypes] = useState<
    { key: string; blockTypes: BlockType[] }[]
  >([]);
  const [configuration, setConfiguration] = useState<ConfigurationDB | null>();
  const [blockTypesLoadingMap, setBlockTypesLoadingMap] = useState<
    Record<string, boolean>
  >({});
  const [filterByProvider, setFilterByProvider] = useState<
    Record<string, string>
  >({});
  const { entity, entityId } = entityRef;

  const onDragStart = (
    event: React.DragEvent,
    blockType: BlockType | undefined,
  ) => {
    setSelectedBlockType(blockType);
    event.dataTransfer.effectAllowed = 'move';
  };

  const fetchConfiguration = async () => {
    if (entity === 'configuration' && entityId) {
      const configuration = await adapter.getConfiguration(entityId);
      setConfiguration(configuration);
    }
  };

  useEffect(() => {
    fetchConfiguration();
  }, [entity, entityId]);

  const { value: listCrossplaneProvidersValue } = useAsync(async () => {
    return await adapter.listCrossplaneProviders();
  }, []);

  const allProviders = listCrossplaneProvidersValue?.crossplaneProviders;

  const getProviderDisplayName = (provider: CrossplaneProviderDB): string => {
    const providerName = provider.title || provider._id.toString();

    // For default Crossplane provider, don't show family name
    if (provider._id === '0') {
      return providerName;
    }

    // For DB providers, use the familyName field
    const familyName = provider.familyName;
    return familyName ? `${familyName} - ${providerName}` : providerName;
  };

  const providers = useMemo(() => {
    if (!allProviders) return [];

    const matchedProviders = (configuration?.providers || [])
      .map((confPr) => allProviders?.find((pr) => pr._id === confPr))
      .filter((pr): pr is CrossplaneProviderDB => pr !== undefined);

    // Add default Crossplane provider at the beginning
    const defaultProvider = {
      _id: '0',
      title: 'Crossplane',
      url: 'xpkg.crossplane/crossplane/crossplane',
      version: 'v0.0.1',
      description: 'default crossplane block',
      family: 'crossplane',
      icon: './crp1.png',
    };

    return [defaultProvider, ...matchedProviders];
  }, [allProviders, configuration?.providers]);

  const fetchBlockTypes = async (url: string) => {
    if (providerBlockTypes.some((pc) => pc.key === url)) return;

    setBlockTypesLoadingMap((prev) => ({ ...prev, [url]: true }));
    try {
      const blockTypes = await adapter.getBlockTypes(url);
      setProviderBlockTypes((prev) => [...prev, { key: url, blockTypes }]);
      registerBlockTypes(blockTypes);
    } finally {
      setBlockTypesLoadingMap((prev) => ({ ...prev, [url]: false }));
    }
  };

  useEffect(() => {
    providers.forEach((pr) => {
      if (!pr.url) return;
      const fullUrl = pr.version ? `${pr.url}:${pr.version}` : pr.url;
      fetchBlockTypes(fullUrl);
    });
  }, [providers]);

  const filterBlockTypes = (
    blockTypes: BlockType[],
    providerId: string,
  ): BlockType[] => {
    const filterText = filterByProvider[providerId]?.toLowerCase() || '';
    if (!filterText) return blockTypes;

    return blockTypes.filter((blockType) => {
      const title = blockType.title?.toLowerCase() || '';
      const description = blockType.description?.toLowerCase() || '';
      const name = blockType.name?.toLowerCase() || '';

      return (
        title.includes(filterText) ||
        description.includes(filterText) ||
        name.includes(filterText)
      );
    });
  };

  const handleFilterChange = (providerId: string, value: string) => {
    setFilterByProvider((prev) => ({
      ...prev,
      [providerId]: value,
    }));
  };
  return (
    <>
      <Sidebar side="right">
        <SidebarContent className="h-full">
          <SidebarGroup className="h-full">
            <SidebarGroupContent className="h-full">
              <div className="flex flex-col h-full">
                <Accordion
                  type="single"
                  collapsible
                  onValueChange={async (v) => {
                    const provider = providers.find((pr) => pr._id === v);
                    if (provider && provider.url) {
                      const fullUrl = provider.version
                        ? `${provider.url}:${provider.version}`
                        : provider.url;
                      await fetchBlockTypes(fullUrl);
                    }
                  }}
                >
                  {providers.map((pr) => (
                    <AccordionItem value={pr._id} key={pr._id}>
                      <AccordionTrigger className="justify-start gap-3 pl-2 no-underline hover:no-underline">
                        {getProviderDisplayName(pr)}
                      </AccordionTrigger>

                      <AccordionContent className="flex flex-col gap-3">
                        <div className="relative py-1">
                          <Filter className="absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                          <Input
                            type="text"
                            placeholder="Filter"
                            className="pl-9 h-8"
                            value={filterByProvider[pr._id] || ''}
                            onChange={(e) =>
                              handleFilterChange(pr._id, e.target.value)
                            }
                          />
                        </div>

                        {(() => {
                          const providerFullUrl = pr.version
                            ? `${pr.url}:${pr.version}`
                            : pr.url;
                          return !blockTypesLoadingMap[providerFullUrl] ? (
                            filterBlockTypes(
                              providerBlockTypes.find(
                                (bt) => bt.key === providerFullUrl,
                              )?.blockTypes || [],
                              pr._id,
                            ).map((blockType) =>
                              blockType.title && blockType.description ? (
                                <BlockCard
                                  key={blockType.name}
                                  title={blockType.title}
                                  description={blockType.description}
                                  icon={blockType.icon}
                                  onDragStart={(e) => onDragStart(e, blockType)}
                                  onMobileAdd={() => addNodeToCanvas(blockType)}
                                />
                              ) : (
                                <div
                                  key={blockType.name}
                                  className="truncate px-2 py-2 text-sm cursor-pointer hover:bg-sidebar-accent"
                                  onDragStart={(e) => onDragStart(e, blockType)}
                                  draggable
                                >
                                  {blockType.name}
                                </div>
                              ),
                            )
                          ) : (
                            <Spinner size="small" />
                          );
                        })()}
                      </AccordionContent>
                    </AccordionItem>
                  ))}
                </Accordion>
              </div>
            </SidebarGroupContent>
          </SidebarGroup>
        </SidebarContent>
      </Sidebar>
    </>
  );
};
