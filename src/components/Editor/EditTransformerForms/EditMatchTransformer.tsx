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
import { XCircle, Plus, Save } from 'lucide-react';
import {
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '../../ui/form';
import { EditMatchTransformerProps } from '../../../lib/types';
import { TRANSFORMERS_DEFAULT } from '../../../lib/editorUtils';
import { ScrollArea } from '../../ui/scroll-area';

export const EditMatchTransformer = ({
  transformerIndex,
  transformer,
  setTransformers,
  setOpenTransformerToolbar,
}: EditMatchTransformerProps) => {
  const matchTransformerSchema = z.object({
    fallbackTo: z.enum(['Value', 'Input'], {
      required_error: 'Fallback option is required',
    }),
    fallbackValue: z.string().optional(),
    patterns: z.array(
      z.union([
        z.object({
          type: z.literal('literal'),
          literal: z.string(),
          result: z.string().min(1, 'Result is required'),
        }),
        z.object({
          type: z.literal('regexp'),
          regexp: z.string(),
          result: z.string().min(1, 'Result is required'),
        }),
      ]),
    ),
  });

  type MatchTransformerFormValues = z.infer<typeof matchTransformerSchema>;

  const defaultValues: MatchTransformerFormValues = {
    fallbackTo: transformer.match?.fallbackTo ?? 'Value',
    fallbackValue: transformer.match?.fallbackValue ?? '',
    patterns: transformer.match?.patterns.map((pattern) => {
      if (pattern.type === 'literal') {
        return {
          type: 'literal',
          literal: pattern.literal ?? '',
          result: pattern.result ?? '',
        };
      } else if (pattern.type === 'regexp') {
        return {
          type: 'regexp',
          regexp: pattern.regexp ?? '',
          result: pattern.result ?? '',
        };
      }
      return pattern;
    }) ?? [
      {
        type: 'literal',
        literal: '',
        result: '',
      },
    ],
  };

  const form = useForm<MatchTransformerFormValues>({
    resolver: zodResolver(matchTransformerSchema),
    defaultValues,
  });

  const onSubmit = (data: MatchTransformerFormValues) => {
    setTransformers((prev) => {
      const updatedTransformers = [...(prev ?? [])];
      updatedTransformers[transformerIndex] = {
        ...transformer,
        match: data,
      };
      return updatedTransformers;
    });
    setOpenTransformerToolbar(false);
  };

  const addPattern = () => {
    const newPattern = TRANSFORMERS_DEFAULT.match.match.patterns[0];
    form.setValue('patterns', [...form.getValues('patterns'), newPattern]);
  };

  const removePattern = (index: number) => {
    const patterns = form.getValues('patterns');
    patterns.splice(index, 1);
    form.setValue('patterns', patterns);
  };

  return (
    <ScrollArea className="h-[580px] rounded-md">
      <FormProvider {...form}>
        <form className="space-y-8 p-4" onSubmit={form.handleSubmit(onSubmit)}>
          <h3 className="text-lg font-medium">Match Transformer</h3>

          <FormField
            control={form.control}
            name="fallbackTo"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Fallback to</FormLabel>
                <FormControl>
                  <Select value={field.value} onValueChange={field.onChange}>
                    <SelectTrigger>
                      <SelectValue placeholder="Select fallback" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="Value">Value</SelectItem>
                      <SelectItem value="Input">Input</SelectItem>
                    </SelectContent>
                  </Select>
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

          <FormField
            control={form.control}
            name="fallbackValue"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Fallback value</FormLabel>
                <FormControl>
                  <Input placeholder="Fallback value" {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

          {form.watch('patterns').map((pattern, index) => (
            <div key={`pattern-${index}`} className="space-y-4">
              <FormField
                control={form.control}
                name={`patterns.${index}.type`}
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Pattern Type</FormLabel>
                    <FormControl>
                      <Select
                        value={field.value}
                        onValueChange={field.onChange}
                      >
                        <SelectTrigger>
                          <SelectValue placeholder="Select pattern type" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="literal">Literal</SelectItem>
                          <SelectItem value="regexp">Regexp</SelectItem>
                        </SelectContent>
                      </Select>
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <div className="flex items-start gap-1">
                <FormField
                  control={form.control}
                  name={`patterns.${index}.${pattern.type}`}
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel className="capitalize">
                        {pattern.type}
                      </FormLabel>
                      <FormControl>
                        <Input
                          className="capitalize"
                          placeholder={pattern.type}
                          {...field}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name={`patterns.${index}.result`}
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Result</FormLabel>
                      <FormControl>
                        <Input placeholder="Result" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                {form.watch('patterns').length > 1 && (
                  <Button
                    className="mt-[33px]"
                    onClick={() => removePattern(index)}
                    variant="destructive"
                  >
                    <XCircle className="h-4 w-4" />
                  </Button>
                )}
              </div>
            </div>
          ))}

          <Button
            onClick={addPattern}
            variant="outline"
            size="sm"
            className="w-full"
          >
            <Plus className="mr-2 h-4 w-4" />
            Add Pattern
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
