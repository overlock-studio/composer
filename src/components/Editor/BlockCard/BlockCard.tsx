import { Button } from '../../ui/button';
import { Plus } from 'lucide-react';

export const BlockCard = ({
  title,
  description,
  icon,
  onDragStart,
  onMobileAdd,
}: {
  title: string;
  description: string;
  icon?: string;
  onDragStart: (e: React.DragEvent) => void;
  onMobileAdd?: () => void;
}) => (
  <div
    className="relative flex cursor-pointer items-center space-x-3 rounded-md border p-3 hover:bg-sidebar-accent"
    onDragStart={onDragStart}
    draggable
  >
    {icon && <img src={icon} alt="" width={24} height={24} />}
    <div className="flex-1 space-y-1">
      <p className="truncate text-xs font-medium">{title}</p>
      <p className="line-clamp-3 text-xs text-muted-foreground">
        {description}
      </p>
    </div>

    {/* Mobile Add Button - shown only on mobile */}
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
