import { Checkbox } from '../../ui/checkbox';

export const ProviderCard = ({
  title,
  description,
  icon,
  checked,
  onChange,
  disabled,
}: {
  title: string;
  description: string;
  icon?: string;
  checked: boolean;
  onChange: () => void;
  disabled?: boolean;
}) => (
  <div
    className="flex items-center space-x-3 rounded-md border p-3 hover:bg-sidebar-accent cursor-pointer"
    onClick={!disabled ? onChange : undefined}
  >
    {icon && <img src={icon} alt="" width={24} height={24} />}
    <div className="flex-1 space-y-1">
      <p className="truncate text-xs font-medium">{title}</p>
      <p className="line-clamp-3 text-xs text-muted-foreground">
        {description}
      </p>
    </div>
    <Checkbox
      checked={checked}
      onCheckedChange={onChange}
      disabled={disabled}
    />
  </div>
);
