'use client';
import React, { useCallback } from 'react';
import { EditConnectorsMenuProps } from '../../../lib/types';
import {
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '../../ui/form';
import { Input } from '../../ui/input';
import { Checkbox } from '../../ui/checkbox';
import { RadioGroup, RadioGroupItem } from '../../ui/radio-group';
import { Button } from '../../ui/button';
import { FormProvider, useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Textarea } from '../../ui/textarea';
import { Badge } from '../../ui/badge';
import { Card, CardContent } from '../../ui/card';
import { Separator } from '../../ui/separator';
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '../../ui/select';
import { Settings, FileText, Check, X } from 'lucide-react';
import { useEditorAreaContext } from '../EditorAreaContext';

export const EditConnectorsMenu = ({
  setOpen,
  connector,
  setConnectors,
}: EditConnectorsMenuProps) => {
  const editConnectorsFormSchema = z.object({
    connection: z.enum(['input', 'output'], {
      required_error: 'You need to select an option',
    }),
    path: z.string().min(1, 'Path is required'),
    type: z.string().min(1, 'Type is required'),
    description: z.string(),
    required: z.boolean().default(false),
  });

  type EditConnectorsFormValues = z.infer<typeof editConnectorsFormSchema>;

  const form = useForm<EditConnectorsFormValues>({
    resolver: zodResolver(editConnectorsFormSchema),
    mode: 'onChange',
    defaultValues: {
      connection: connector?.connection ?? 'input',
      path: connector?.path.replace(/^(spec\.|status\.)/, '') ?? '',
      type: connector?.type ?? '',
      description: connector?.description ?? '',
      required: connector?.required ?? false,
    },
  });

  const fieldTypes = [
    {
      value: 'string',
      label: 'String',
      icon: FileText,
      description: 'Text value',
    },
    {
      value: 'integer',
      label: 'Integer',
      icon: Settings,
      description: 'Whole number',
    },
    {
      value: 'number',
      label: 'Number',
      icon: Settings,
      description: 'Decimal number',
    },
    {
      value: 'boolean',
      label: 'Boolean',
      icon: Check,
      description: 'True/false value',
    },
    {
      value: 'array',
      label: 'Array',
      icon: Settings,
      description: 'List of values',
    },
    {
      value: 'object',
      label: 'Object',
      icon: Settings,
      description: 'Complex structure',
    },
  ];

  const editConnectorsClose = useCallback(() => {
    setOpen(false);
  }, [setOpen]);

  const { setEdges } = useEditorAreaContext();

  const onSubmit = (data: EditConnectorsFormValues) => {
    const connection = data.connection;
    const pathWithPrefix =
      connection === 'output' ? `status.${data.path}` : `spec.${data.path}`;

    if (connector && connector.path !== pathWithPrefix) {
      setEdges((eds) => {
        return eds.filter(
          (ed) => ed.source !== connector.path && ed.target !== connector.path,
        );
      });
    }

    setConnectors((prevConnectors) => {
      const newConnector = { ...data, path: pathWithPrefix };

      const updatedConnectors = connector
        ? prevConnectors.map((conn) =>
            conn.path === connector.path ? newConnector : conn,
          )
        : prevConnectors.find(
              (conn) =>
                conn.path === newConnector.path &&
                conn.connection === newConnector.connection,
            )
          ? prevConnectors
          : [...prevConnectors, newConnector];

      return updatedConnectors;
    });

    editConnectorsClose();
  };

  return (
    <div className="space-y-6">
      <Card className="border-0 shadow-none bg-transparent">
        <CardContent className="px-0 pb-0">
          <FormProvider {...form} key={connector?.path}>
            <form className="space-y-6" onSubmit={form.handleSubmit(onSubmit)}>
              {/* Direction Section */}
              <div className="space-y-3">
                <FormField
                  control={form.control}
                  name="connection"
                  render={({ field }) => (
                    <FormItem className="space-y-3">
                      <FormLabel className="text-sm font-medium">
                        Direction
                      </FormLabel>
                      <FormControl>
                        <RadioGroup
                          value={field.value}
                          className="flex flex-row gap-6"
                          onValueChange={field.onChange}
                        >
                          <div className="flex items-center space-x-2">
                            <RadioGroupItem value="input" />
                            <FormLabel className="cursor-pointer">
                              Input
                            </FormLabel>
                          </div>
                          <div className="flex items-center space-x-2">
                            <RadioGroupItem value="output" />
                            <FormLabel className="cursor-pointer">
                              Output
                            </FormLabel>
                          </div>
                        </RadioGroup>
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>

              <Separator />

              {/* Path and Type Section */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <FormField
                  control={form.control}
                  name="path"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel className="text-sm font-medium">
                        Path
                      </FormLabel>
                      <FormControl>
                        <Input
                          placeholder="e.g. metadata.name"
                          className="font-mono text-sm"
                          {...field}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="type"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel className="text-sm font-medium">
                        Data Type
                      </FormLabel>
                      <FormControl>
                        <Select
                          value={field.value}
                          onValueChange={field.onChange}
                        >
                          <SelectTrigger>
                            <SelectValue placeholder="Choose data type" />
                          </SelectTrigger>
                          <SelectContent className="w-full">
                            <SelectGroup>
                              {fieldTypes.map((ft) => {
                                const IconComponent = ft.icon;
                                return (
                                  <SelectItem key={ft.value} value={ft.value}>
                                    <div className="flex items-center gap-2">
                                      <IconComponent className="h-4 w-4" />
                                      <span>{ft.label}</span>
                                      <Badge
                                        variant="secondary"
                                        className="text-xs"
                                      >
                                        {ft.description}
                                      </Badge>
                                    </div>
                                  </SelectItem>
                                );
                              })}
                            </SelectGroup>
                          </SelectContent>
                        </Select>
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>

              {/* Configuration Section */}
              <div className="space-y-4">
                <FormField
                  control={form.control}
                  name="required"
                  render={({ field }) => (
                    <FormItem className="flex flex-row items-center justify-between rounded-lg border p-4 space-y-0">
                      <div className="space-y-0.5">
                        <FormLabel className="text-sm font-medium cursor-pointer">
                          Required Field
                        </FormLabel>
                        <div className="text-sm text-muted-foreground">
                          This field must be provided when using this handle
                        </div>
                      </div>
                      <FormControl>
                        <Checkbox
                          checked={field.value}
                          onCheckedChange={field.onChange}
                          className="data-[state=checked]:bg-green-600 data-[state=checked]:border-green-600"
                        />
                      </FormControl>
                    </FormItem>
                  )}
                />
              </div>

              {/* Description Section */}
              <FormField
                control={form.control}
                name="description"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel className="text-sm font-medium">
                      Description
                      <Badge variant="outline" className="text-xs ml-2">
                        Optional
                      </Badge>
                    </FormLabel>
                    <FormControl>
                      <Textarea
                        placeholder="Describe what this handle is used for..."
                        className="min-h-[80px]"
                        {...field}
                      />
                    </FormControl>
                    <div className="text-xs text-muted-foreground">
                      {field.value?.length || 0} characters
                    </div>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <Separator />

              {/* Action Buttons */}
              <div className="flex justify-end gap-3 pt-2">
                <Button
                  type="button"
                  variant="outline"
                  onClick={editConnectorsClose}
                  className="flex items-center gap-2"
                >
                  <X className="h-4 w-4" />
                  Cancel
                </Button>
                <Button type="submit" className="flex items-center gap-2">
                  <Check className="h-4 w-4" />
                  Save Configuration
                </Button>
              </div>
            </form>
          </FormProvider>
        </CardContent>
      </Card>
    </div>
  );
};
