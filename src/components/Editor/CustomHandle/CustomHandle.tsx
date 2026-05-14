import React from 'react';
import {
  Handle,
  HandleProps,
  useNodeConnections,
  useNodeId,
  useStore,
} from '@xyflow/react';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '../../ui/tooltip';
import { Badge } from '../../ui/badge';
import { useEditorAreaContext } from '../EditorAreaContext';

interface IHandleProps extends HandleProps {
  connectionCount?: number;
  inactiveClass?: string;
  path: string;
  description: string;
  variant?: 'block' | 'container';
  label?: string;
}

export const CustomHandle = ({
  id,
  type,
  isConnectable,
  className,
  connectionCount = 0,
  inactiveClass = '',
  path,
  description,
  variant = 'block',
  label,
  ...props
}: IHandleProps) => {
  const displayLabel = label ?? path.split('.').pop();
  const connections = useNodeConnections({
    id: id || undefined,
    handleType: type,
  });

  const nodeId = useNodeId();
  const { activeHandle, setActiveHandle } = useEditorAreaContext();
  const isOwnerSelected = useStore((s) =>
    nodeId ? (s.nodeLookup.get(nodeId)?.selected ?? false) : false,
  );
  const isActiveByClick =
    !!activeHandle &&
    activeHandle.nodeId === nodeId &&
    activeHandle.handleId === (id ?? '') &&
    activeHandle.type === type;
  const isActiveBySelection = isOwnerSelected && connections.length > 0;
  const isHandleActive = isActiveByClick || isActiveBySelection;

  const handleClick = (e: React.MouseEvent) => {
    if (!nodeId) return;
    e.stopPropagation();
    if (isActiveByClick) {
      setActiveHandle(null);
    } else {
      setActiveHandle({
        nodeId,
        handleId: id ?? '',
        type: type as 'source' | 'target',
      });
    }
  };

  const isConnectableValue =
    isConnectable &&
    (connectionCount === 0 || connections.length < connectionCount);

  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          <div>
            {type === 'source' && variant === 'block' && (
              <div className="text-[10px] text-foreground opacity-80 h-[30px] leading-[30px] py-[1px] pl-[10px] pr-[10px] w-1/2">
                {displayLabel}
              </div>
            )}
            {type === 'source' && variant === 'container' && (
              <div className="absolute right-full -mr-[7px] text-[10px] text-foreground opacity-80 h-[48px] leading-[48px]">
                {displayLabel}
              </div>
            )}
            <Handle
              {...props}
              id={id}
              type={type}
              isConnectable={isConnectableValue}
              onClick={handleClick}
              className={`${className || ''} ${!isConnectableValue ? inactiveClass : ''} ${isHandleActive ? 'is-active' : ''}`}
            />
            {type === 'target' && variant === 'block' && (
              <div className="text-[10px] text-foreground opacity-80 h-[30px] leading-[30px] py-[1px] pl-[10px] w-1/2">
                {displayLabel}
              </div>
            )}
            {type === 'target' && variant === 'container' && (
              <div className="absolute left-full -ml-[7px] text-[10px] text-foreground opacity-80 h-[48px] leading-[48px]">
                {displayLabel}
              </div>
            )}
          </div>
        </TooltipTrigger>
        <TooltipContent className="min-w-[240px]">
          <div className="mb-1">
            <span className="font-bold mr-1">Type:</span>
            <Badge variant={type}>
              {variant === 'container'
                ? type === 'target'
                  ? 'output'
                  : 'input'
                : type === 'target'
                  ? 'input'
                  : 'output'}
            </Badge>
          </div>
          <div className="mb-1">
            <span className="font-bold mr-1">Path:</span>
            {path}
          </div>
          {description !== '' && (
            <div className="mb-1 max-w-[240px]">
              <span className="font-bold mr-1">Description:</span>
              {description}
            </div>
          )}
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
};
