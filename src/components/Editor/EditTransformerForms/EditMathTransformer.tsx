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
import { EditMathTransformerProps, MathTransform } from '../../../lib/types';

export const EditMathTransformer = ({
  transformerIndex,
  transformer,
  setTransformers,
  setOpenTransformerToolbar,
}: EditMathTransformerProps) => {
  const mathTransformerSchema = z.object({
    type: z.enum(['clampMin', 'clampMax', 'multiply'], {
      required_error: 'Type is required',
    }),
    clampMin: z.number().optional(),
    clampMax: z.number().optional(),
    multiply: z.number().optional(),
  });

  type MathTransformerFormValues = z.infer<typeof mathTransformerSchema>;

  const defaultValues: MathTransformerFormValues = {
    type: transformer.math?.type ?? 'clampMin',
    clampMin:
      transformer.math?.type === 'clampMin' ? transformer.math.clampMin : 0,
    clampMax:
      transformer.math?.type === 'clampMax' ? transformer.math.clampMax : 0,
    multiply:
      transformer.math?.type === 'multiply' ? transformer.math.multiply : 1,
  };

  const form = useForm<MathTransformerFormValues>({
    resolver: zodResolver(mathTransformerSchema),
    defaultValues,
  });
  const onSubmit = (data: MathTransformerFormValues) => {
    const mathTransform: MathTransform =
      data.type === 'clampMin'
        ? { type: 'clampMin', clampMin: data.clampMin ?? 0 }
        : data.type === 'clampMax'
          ? { type: 'clampMax', clampMax: data.clampMax ?? 0 }
          : { type: 'multiply', multiply: data.multiply ?? 1 };

    setTransformers((prev) => {
      const updatedTransformers = [...(prev ?? [])];
      updatedTransformers[transformerIndex] = {
        type: 'math',
        math: mathTransform,
      };
      return updatedTransformers;
    });
    setOpenTransformerToolbar(false);
  };

  return (
    <FormProvider {...form}>
      <form className="space-y-8 p-4" onSubmit={form.handleSubmit(onSubmit)}>
        <h3 className="text-lg font-medium">Math Transformer</h3>

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
                    <SelectItem value="clampMin">Clamp Min</SelectItem>
                    <SelectItem value="clampMax">Clamp Max</SelectItem>
                    <SelectItem value="multiply">Multiply</SelectItem>
                  </SelectContent>
                </Select>
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        {form.watch('type') === 'clampMin' && (
          <FormField
            control={form.control}
            name="clampMin"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Clamp Min Value</FormLabel>
                <FormControl>
                  <Input type="number" placeholder="Clamp Min" {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
        )}

        {form.watch('type') === 'clampMax' && (
          <FormField
            control={form.control}
            name="clampMax"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Clamp Max Value</FormLabel>
                <FormControl>
                  <Input type="number" placeholder="Clamp Max" {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
        )}

        {form.watch('type') === 'multiply' && (
          <FormField
            control={form.control}
            name="multiply"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Multiply Value</FormLabel>
                <FormControl>
                  <Input type="number" placeholder="Multiply" {...field} />
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
  );
};
