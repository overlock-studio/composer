'use client';

import React from 'react';
import { z } from 'zod';
import { useForm, FormProvider } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { Button } from '../../ui/button';
import { Input } from '../../ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '../../ui/select';
import { Save } from 'lucide-react';
import {
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '../../ui/form';
import { EditStringTransformerProps, StringTransform } from '../../../lib/types';
import { ScrollArea } from '../../ui/scroll-area';

export const EditStringTransformer = ({
  transformerIndex,
  transformer,
  setTransformers,
  setOpenTransformerToolbar,
}: EditStringTransformerProps) => {
  const stringTransformerSchema = z.union([
    z.object({
      type: z.literal('Convert'),
      convert: z.enum(['ToUpper', 'ToLower']),
    }),
    z.object({
      type: z.literal('Format'),
      fmt: z.string(),
    }),
    z.object({
      type: z.literal('Join'),
      join: z.object({
        separator: z.string(),
      }),
    }),
    z.object({
      type: z.literal('Regexp'),
      regexp: z.object({
        match: z.string(),
        group: z.string(),
      }),
    }),
    z.object({
      type: z.literal('TrimPrefix'),
      trim: z.string(),
    }),
    z.object({
      type: z.literal('TrimSuffix'),
      trim: z.string(),
    }),
  ]);

  type StringTransformerFormValues = z.infer<typeof stringTransformerSchema>;

  const defaultValues: StringTransformerFormValues = {
    type: transformer.string?.type ?? 'Convert',
    convert:
      transformer.string?.type === 'Convert'
        ? (transformer.string.convert ?? 'ToUpper')
        : 'ToUpper',
    fmt:
      transformer.string?.type === 'Format'
        ? (transformer.string.fmt ?? '')
        : '',
    join:
      transformer.string?.type === 'Join' && transformer.string.join
        ? { separator: transformer.string.join.separator ?? '' }
        : { separator: '' },
    regexp:
      transformer.string?.type === 'Regexp' && transformer.string.regexp
        ? {
            match: transformer.string.regexp.match ?? '',
            group: String(transformer.string.regexp.group ?? '0'),
          }
        : { match: '', group: '0' },
    trim:
      transformer.string?.type === 'TrimPrefix' ||
      transformer.string?.type === 'TrimSuffix'
        ? (transformer.string.trim ?? '')
        : '',
  };

  const form = useForm<StringTransformerFormValues>({
    resolver: zodResolver(stringTransformerSchema),
    defaultValues,
  });

  const onSubmit = (data: StringTransformerFormValues) => {
    const { type, ...rest } = data;

    let transformedData: Partial<StringTransform> = { type };

    if (type === 'Convert') {
      const { convert } = rest as { convert: 'ToUpper' | 'ToLower' };
      transformedData = { type, convert };
    } else if (type === 'Format') {
      const { fmt } = rest as { fmt: string };
      transformedData = { type, fmt };
    } else if (type === 'Join') {
      const { join } = rest as { join: { separator: string } };
      transformedData = { type, join };
    } else if (type === 'Regexp') {
      const { regexp } = rest as { regexp: { match: string; group: string } };
      transformedData = {
        type,
        regexp: { match: regexp.match, group: Number(regexp.group) },
      };
    } else if (type === 'TrimPrefix' || type === 'TrimSuffix') {
      const { trim } = rest as { trim: string };
      transformedData = { type, trim };
    }

    setTransformers((prev) => {
      const updatedTransformers = [...(prev ?? [])];
      updatedTransformers[transformerIndex] = {
        type: 'string',
        string: transformedData as StringTransform,
      };
      return updatedTransformers;
    });

    setOpenTransformerToolbar(false);
  };
  return (
    <ScrollArea className="h-[375px] rounded-md">
      <FormProvider {...form}>
        <form className="space-y-8 p-4" onSubmit={form.handleSubmit(onSubmit)}>
          <h3 className="text-lg font-medium">String Transformer</h3>

          <FormField
            control={form.control}
            name="type"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Type</FormLabel>
                <FormControl>
                  <Select value={field.value} onValueChange={field.onChange}>
                    <SelectTrigger>
                      <SelectValue placeholder="Select type" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="Convert">Convert</SelectItem>
                      <SelectItem value="Format">Format</SelectItem>
                      <SelectItem value="Join">Join</SelectItem>
                      <SelectItem value="Regexp">Regexp</SelectItem>
                      <SelectItem value="TrimPrefix">TrimPrefix</SelectItem>
                      <SelectItem value="TrimSuffix">TrimSuffix</SelectItem>
                    </SelectContent>
                  </Select>
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

          {form.watch('type') === 'Convert' && (
            <FormField
              control={form.control}
              name="convert"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Convert</FormLabel>
                  <FormControl>
                    <Select value={field.value} onValueChange={field.onChange}>
                      <SelectTrigger>
                        <SelectValue placeholder="Select conversion" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="ToUpper">ToUpper</SelectItem>
                        <SelectItem value="ToLower">ToLower</SelectItem>
                      </SelectContent>
                    </Select>
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
          )}

          {form.watch('type') === 'Format' && (
            <FormField
              control={form.control}
              name="fmt"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Format</FormLabel>
                  <FormControl>
                    <Input placeholder="Format" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
          )}

          {form.watch('type') === 'Join' && (
            <FormField
              control={form.control}
              name="join.separator"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Separator</FormLabel>
                  <FormControl>
                    <Input placeholder="Separator" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
          )}

          {form.watch('type') === 'Regexp' && (
            <>
              <FormField
                control={form.control}
                name="regexp.match"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Match</FormLabel>
                    <FormControl>
                      <Input placeholder="Match" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="regexp.group"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Group</FormLabel>
                    <FormControl>
                      <Input placeholder="Group" type="number" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </>
          )}

          {(form.watch('type') === 'TrimPrefix' ||
            form.watch('type') === 'TrimSuffix') && (
            <FormField
              control={form.control}
              name="trim"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Trim</FormLabel>
                  <FormControl>
                    <Input placeholder="Trim" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
          )}

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
