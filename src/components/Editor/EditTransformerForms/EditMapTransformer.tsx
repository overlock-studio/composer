'use client';

import React from 'react';
import { useForm, FormProvider } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Button } from '../../ui/button';
import { Input } from '../../ui/input';
import { XCircle, Plus, Save } from 'lucide-react';
import {
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '../../ui/form';
import { EditMapTransformerProps } from '../../../lib/types';
import { ScrollArea } from '../../ui/scroll-area';

const mapTransformerSchema = z.object({
  entries: z.array(
    z.object({
      key: z.string().min(1, 'Key is required'),
      value: z.string().min(1, 'Value is required'),
    }),
  ),
});

type MapTransformerFormValues = z.infer<typeof mapTransformerSchema>;

export const EditMapTransformer = ({
  transformerIndex,
  transformer,
  setTransformers,
  setOpenTransformerToolbar,
}: EditMapTransformerProps) => {
  const defaultValues: MapTransformerFormValues = {
    entries: Object.entries(transformer.map ?? {}).map(([key, value]) => ({
      key,
      value,
    })),
  };

  const form = useForm<MapTransformerFormValues>({
    resolver: zodResolver(mapTransformerSchema),
    defaultValues,
  });

  const onSubmit = (data: MapTransformerFormValues) => {
    setTransformers((prev) => {
      const updatedTransformers = [...(prev ?? [])];
      updatedTransformers[transformerIndex] = {
        ...transformer,
        map: data.entries.reduce<Record<string, string>>(
          (acc, { key, value }) => {
            acc[key] = value;
            return acc;
          },
          {},
        ),
      };
      return updatedTransformers;
    });
    setOpenTransformerToolbar(false);
  };

  const addEntry = () => {
    const newEntry = { key: '', value: '' };
    form.setValue('entries', [...form.getValues('entries'), newEntry]);
  };

  const removeEntry = (index: number) => {
    const entries = form.getValues('entries');
    entries.splice(index, 1);
    form.setValue('entries', entries);
  };

  return (
    <ScrollArea className="h-[375px] rounded-md">
      <FormProvider {...form}>
        <form className="space-y-8 p-4" onSubmit={form.handleSubmit(onSubmit)}>
          <h3 className="text-lg font-medium">Map Transformer</h3>

          {form.watch('entries').map((_, index) => (
            <div key={`entry-${index}`} className="flex items-start gap-1">
              <FormField
                control={form.control}
                name={`entries.${index}.key`}
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Key</FormLabel>
                    <FormControl>
                      <Input placeholder="Key" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name={`entries.${index}.value`}
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Value</FormLabel>
                    <FormControl>
                      <Input placeholder="Value" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              {form.watch('entries').length > 1 && (
                <Button
                  className="mt-2 mt-[33px]"
                  onClick={() => removeEntry(index)}
                  variant="destructive"
                >
                  <XCircle className="h-4 w-4" />
                </Button>
              )}
            </div>
          ))}

          <Button
            onClick={addEntry}
            variant="outline"
            size="sm"
            className="w-full"
          >
            <Plus className="mr-2 h-4 w-4" />
            Add Entry
          </Button>

          <Button
            type="submit"
            variant="default"
            size="sm"
            className="w-full bg-chart-1"
          >
            <Save className="mr-2 h-4 w-4" />
            Save
          </Button>
        </form>
      </FormProvider>
    </ScrollArea>
  );
};
