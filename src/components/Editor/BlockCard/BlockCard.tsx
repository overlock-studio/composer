import { Button } from '../../ui/button';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '../../ui/tooltip';
import { Plus } from 'lucide-react';
import { RefObject, useEffect, useRef, useState } from 'react';
import { useDraggable } from '@neodrag/react';

export const BlockCard = ({
  title,
  apiVersion,
  description,
  onDragStart,
  onMobileAdd,
}: {
  title: string;
  apiVersion?: string;
  description?: string;
  onDragStart: () => void;
  onMobileAdd?: () => void;
}) => {
  const cardRef = useRef<HTMLDivElement>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const [position, setPosition] = useState({ x: 0, y: 0 });
  const rafRef = useRef<number | null>(null);
  const pendingPosRef = useRef({ x: 0, y: 0 });

  const onDragStartRef = useRef(onDragStart);
  useEffect(() => {
    onDragStartRef.current = onDragStart;
  }, [onDragStart]);

  useDraggable(cardRef as RefObject<HTMLDivElement>, {
    position,
    cancel: buttonRef as RefObject<HTMLElement>,
    onDragStart: ({ rootNode }) => {
      const rect = rootNode.getBoundingClientRect();
      rootNode.style.position = 'fixed';
      rootNode.style.top = `${rect.top}px`;
      rootNode.style.left = `${rect.left}px`;
      rootNode.style.width = `${rect.width}px`;
      rootNode.style.zIndex = '9999';
      onDragStartRef.current();
    },
    onDrag: ({ offsetX, offsetY }) => {
      pendingPosRef.current = { x: offsetX, y: offsetY };
      if (rafRef.current !== null) return;
      rafRef.current = requestAnimationFrame(() => {
        rafRef.current = null;
        setPosition(pendingPosRef.current);
      });
    },
    onDragEnd: ({ event, currentNode, rootNode }) => {
      if (rafRef.current !== null) {
        cancelAnimationFrame(rafRef.current);
        rafRef.current = null;
      }
      const prev = currentNode.style.visibility;
      currentNode.style.visibility = 'hidden';
      const target = document.elementFromPoint(event.clientX, event.clientY);
      currentNode.style.visibility = prev;
      rootNode.style.position = '';
      rootNode.style.top = '';
      rootNode.style.left = '';
      rootNode.style.width = '';
      rootNode.style.zIndex = '';
      setPosition({ x: 0, y: 0 });
      document.dispatchEvent(
        new CustomEvent('composer-touch-drop', {
          detail: {
            clientX: event.clientX,
            clientY: event.clientY,
            target,
          },
        }),
      );
    },
  });

  const card = (
    <div
      ref={cardRef}
      className="relative flex cursor-grab items-center space-x-3 rounded-md border bg-black/5 p-3 hover:bg-sidebar-accent dark:bg-white/[0.06] touch-none select-none active:cursor-grabbing"
    >
      <div className="flex-1 space-y-1 min-w-0">
        <p className="truncate text-xs font-medium">{title}</p>
        {apiVersion && (
          <p className="truncate text-[0.625rem] text-muted-foreground">
            {apiVersion}
          </p>
        )}
      </div>

      {onMobileAdd && (
        <Button
          ref={buttonRef}
          variant="secondary"
          size="icon"
          className="absolute top-2 right-2 size-6 md:hidden"
          onClick={(e) => {
            e.preventDefault();
            e.stopPropagation();
            onMobileAdd();
          }}
        >
          <Plus className="h-3 w-3" />
        </Button>
      )}
    </div>
  );

  if (!description) return card;

  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>{card}</TooltipTrigger>
        <TooltipContent side="left" className="max-w-[280px]">
          {description}
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
};
