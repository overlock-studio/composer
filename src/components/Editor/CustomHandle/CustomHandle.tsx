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
import { useEditorActions } from '../EditorAreaContext';

interface IHandleProps extends HandleProps {
  connectionCount?: number;
  inactiveClass?: string;
  path: string;
  description: string;
  variant?: 'block' | 'container';
  label?: React.ReactNode;
  // Replaces the width/padding of the label slot, for nodes whose rows are not
  // the two half-width columns of a block.
  labelClassName?: string;
}

const CustomHandleComponent = ({
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
  labelClassName,
  ...props
}: IHandleProps) => {
  const displayLabel = label ?? path.split('.').pop();
  const blockLabel = `text-[10px] text-foreground opacity-80 h-[30px] leading-[30px] py-[1px] ${
    labelClassName ?? 'pl-[10px] pr-[10px] w-1/2'
  }`;
  const connections = useNodeConnections({
    id: id || undefined,
    handleType: type,
  });

  const nodeId = useNodeId();
  const { activeHandle, setActiveHandle } = useEditorActions();
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
              <div className={blockLabel}>{displayLabel}</div>
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
              <div className={blockLabel}>{displayLabel}</div>
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

export const CustomHandle = React.memo(CustomHandleComponent);
