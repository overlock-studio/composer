import { Button } from '../../ui/button';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '../../ui/tooltip';
import { Plus } from 'lucide-react';

export const BlockCard = ({
  title,
  apiVersion,
  description,
  icon,
  onDragStart,
  onMobileAdd,
}: {
  title: string;
  apiVersion?: string;
  description?: string;
  icon?: string;
  onDragStart: (e: React.DragEvent) => void;
  onMobileAdd?: () => void;
}) => {
  const card = (
    <div
      className="relative flex cursor-pointer items-center space-x-3 rounded-md border p-3 hover:bg-sidebar-accent"
      onDragStart={onDragStart}
      draggable
    >
      {icon && <img src={icon} alt="" width={24} height={24} />}
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
