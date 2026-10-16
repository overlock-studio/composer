'use client';

import React, { useEffect, useMemo, useState } from 'react';
import { useEditorActions } from '../EditorAreaContext';
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
import {
  ConfigurationDB,
  CrossplaneFunctionDB,
  CrossplaneProviderDB,
} from '../../../api/typesDB';
import { Box, Filter, Layers, RefreshCw } from 'lucide-react';
import { Button } from '../../ui/button';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '../../ui/tooltip';

// Accordion value and filter key of the Functions section, apart from the
// provider ids the other sections use.
const FUNCTIONS_SECTION = '__functions';
import crossplaneIcon from '../../../assets/crossplane-icon.svg';

export const EditorAreaSidebar = () => {
  const {
    setSelectedBlockType,
    setSelectedFunction,
    addNodeToCanvas,
    adapter,
    entityRef,
    registerBlockTypes,
    editorMode,
  } = useEditorActions();
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

  // Whichever card is being dragged is the one a drop adds.
  const onDragStart = (blockType: BlockType) => {
    setSelectedFunction(undefined);
    setSelectedBlockType(blockType);
  };

  const onFunctionDragStart = (fn: CrossplaneFunctionDB) => {
    setSelectedBlockType(undefined);
    setSelectedFunction(fn);
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
      icon: crossplaneIcon,
    };

    return [defaultProvider, ...matchedProviders];
  }, [allProviders, configuration?.providers]);

  // The functions registered for the configuration, resolved through the
  // adapter the same way providers are.
  const { value: listCrossplaneFunctionsValue } = useAsync(async () => {
    return await adapter.listCrossplaneFunctions();
  }, []);

  const functions = useMemo(() => {
    const allFunctions = listCrossplaneFunctionsValue?.crossplaneFunctions;
    if (!allFunctions) return [];
    return (configuration?.functions || [])
      .map((id) => allFunctions.find((fn) => fn._id === id))
      .filter((fn): fn is CrossplaneFunctionDB => fn !== undefined);
  }, [listCrossplaneFunctionsValue, configuration?.functions]);

  const filteredFunctions = useMemo(() => {
    const filterText = filterByProvider[FUNCTIONS_SECTION]?.toLowerCase() || '';
    if (!filterText) return functions;
    return functions.filter((fn) =>
      [fn.title, fn.description, fn.url].some((text) =>
        text?.toLowerCase().includes(filterText),
      ),
    );
  }, [functions, filterByProvider]);

  // A provider's block types are fetched once; `force` fetches them again
  // and puts them in place of the ones already loaded.
  const fetchBlockTypes = async (
    url: string,
    providerIcon?: string,
    force = false,
  ) => {
    if (!force && providerBlockTypes.some((pc) => pc.key === url)) return;

    setBlockTypesLoadingMap((prev) => ({ ...prev, [url]: true }));
    try {
      const fetched = await adapter.getBlockTypes(url);
      const blockTypes = providerIcon
        ? fetched.map((bt) => ({ ...bt, icon: bt.icon ?? providerIcon }))
        : fetched;
      setProviderBlockTypes((prev) => [
        ...prev.filter((pc) => pc.key !== url),
        { key: url, blockTypes },
      ]);
      registerBlockTypes(blockTypes, force);
    } finally {
      setBlockTypesLoadingMap((prev) => ({ ...prev, [url]: false }));
    }
  };

  const fetchProvidersBlockTypes = (force = false) => {
    providers.forEach((pr) => {
      if (!pr.url) return;
      const fullUrl = pr.version ? `${pr.url}:${pr.version}` : pr.url;
      fetchBlockTypes(fullUrl, pr.icon, force);
    });
  };

  useEffect(() => {
    fetchProvidersBlockTypes();
  }, [providers]);

  const refreshing = Object.values(blockTypesLoadingMap).some(Boolean);

  // The container-level canvas only takes containers; provider blocks are
  // added inside a container, on its own canvas.
  const blockTypesForMode = (blockTypes: BlockType[]): BlockType[] =>
    blockTypes.filter((blockType) =>
      editorMode === 'containers' ? !blockType.leaf : blockType.leaf,
    );

  const filterBlockTypes = (
    blockTypes: BlockType[],
    providerId: string,
  ): BlockType[] => {
    const filterText = filterByProvider[providerId]?.toLowerCase() || '';
    if (!filterText) return blockTypesForMode(blockTypes);

    return blockTypesForMode(blockTypes).filter((blockType) => {
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
                <div className="flex items-center gap-1 px-2 pt-2 pb-3">
                  <h2 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                    {editorMode === 'containers'
                      ? 'Containers'
                      : 'Block library'}
                  </h2>
                  {/* Providers publish new blocks while the editor is open;
                      this fetches them again without reloading the page. */}
                  {editorMode === 'container' && (
                    <TooltipProvider>
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-6 w-6 text-muted-foreground [&_svg]:size-3.5"
                            aria-label="Refresh block library"
                            disabled={refreshing}
                            onClick={() => fetchProvidersBlockTypes(true)}
                          >
                            <RefreshCw
                              className={refreshing ? 'animate-spin' : ''}
                            />
                          </Button>
                        </TooltipTrigger>
                        <TooltipContent side="left">
                          Refresh block library
                        </TooltipContent>
                      </Tooltip>
                    </TooltipProvider>
                  )}
                </div>
                <Accordion
                  type="single"
                  collapsible
                  className="flex flex-col gap-2"
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
                  {/* Functions become pipeline steps, so they are only offered
                      inside a container. */}
                  {editorMode === 'container' && functions.length > 0 && (
                    <AccordionItem
                      value={FUNCTIONS_SECTION}
                      className="border border-sidebar-border rounded-md px-2 last:border-b"
                    >
                      <AccordionTrigger className="justify-start gap-3 no-underline hover:no-underline py-3">
                        <Layers
                          className="text-muted-foreground"
                          width={20}
                          height={20}
                        />
                        Functions
                      </AccordionTrigger>

                      <AccordionContent className="flex flex-col gap-3 pb-3">
                        <div className="relative py-1">
                          <Filter className="absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                          <Input
                            type="text"
                            placeholder="Filter"
                            className="pl-9 h-8"
                            value={filterByProvider[FUNCTIONS_SECTION] || ''}
                            onChange={(e) =>
                              handleFilterChange(
                                FUNCTIONS_SECTION,
                                e.target.value,
                              )
                            }
                          />
                        </div>

                        {filteredFunctions.map((fn) => (
                          <BlockCard
                            key={fn._id}
                            title={fn.title}
                            apiVersion={fn.version}
                            description={fn.description}
                            onDragStart={() => onFunctionDragStart(fn)}
                          />
                        ))}
                      </AccordionContent>
                    </AccordionItem>
                  )}
                  {providers.map((pr) => {
                    const providerFullUrl = pr.version
                      ? `${pr.url}:${pr.version}`
                      : pr.url;
                    const loaded = providerBlockTypes.find(
                      (bt) => bt.key === providerFullUrl,
                    );
                    if (
                      loaded &&
                      blockTypesForMode(loaded.blockTypes).length === 0
                    ) {
                      return null;
                    }
                    const headerIcon =
                      pr.icon || loaded?.blockTypes.find((b) => b.icon)?.icon;
                    return (
                    <AccordionItem
                      value={pr._id}
                      key={pr._id}
                      className="border border-sidebar-border rounded-md px-2 last:border-b"
                    >
                      <AccordionTrigger className="justify-start gap-3 no-underline hover:no-underline py-3">
                        {headerIcon ? (
                          <img
                            src={headerIcon}
                            alt=""
                            width={20}
                            height={20}
                            draggable={false}
                          />
                        ) : (
                          <Box
                            className="text-muted-foreground"
                            width={24}
                            height={24}
                          />
                        )}
                        {getProviderDisplayName(pr)}
                      </AccordionTrigger>

                      <AccordionContent className="flex flex-col gap-3 pb-3">
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
                          return !blockTypesLoadingMap[providerFullUrl] ? (
                            filterBlockTypes(
                              loaded?.blockTypes || [],
                              pr._id,
                            ).map((blockType) =>
                              blockType.title ? (
                                <BlockCard
                                  key={blockType.name}
                                  title={blockType.title}
                                  apiVersion={blockType.apiVersion}
                                  description={blockType.description}
                                  onDragStart={() => onDragStart(blockType)}
                                  onMobileAdd={() => addNodeToCanvas(blockType)}
                                />
                              ) : (
                                <BlockCard
                                  key={blockType.name}
                                  title={blockType.name}
                                  onDragStart={() => onDragStart(blockType)}
                                />
                              ),
                            )
                          ) : (
                            <Spinner size="small" />
                          );
                        })()}
                      </AccordionContent>
                    </AccordionItem>
                    );
                  })}
                </Accordion>
              </div>
            </SidebarGroupContent>
          </SidebarGroup>
        </SidebarContent>
      </Sidebar>
    </>
  );
};
