'use client';

import React from 'react';
import { Pipeline } from '../../../api/types';
import { Button } from '../../ui/button';

interface ContainerNodeFooterProps {
  functions?: Pipeline[];
}

export const ContainerNodeFooter: React.FC<ContainerNodeFooterProps> = ({
  functions,
}) => {
  if (!functions || functions.length === 0) {
    return null;
  }

  return (
    <div className="mt-auto border-t border-muted-foreground/20 p-2 bg-muted/50 rounded-b-lg">
      <div className="flex flex-col gap-1">
        {functions.map((fn, index) => (
          <Button
            key={`${fn.step}-${index}`}
            variant="outline"
            size="sm"
            className="w-full justify-start text-xs"
          >
            {fn.step}
          </Button>
        ))}
      </div>
    </div>
  );
};
