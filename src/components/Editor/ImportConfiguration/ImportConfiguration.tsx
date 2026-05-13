import { useState } from 'react';
import { Button } from '../../ui/button';
import { Input } from '../../ui/input';
import { Import } from 'lucide-react';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { FormProvider, useForm } from 'react-hook-form';
import {
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '../../ui/form';
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from '../../ui/accordion';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '../../ui/dialog';

import { ConfigurationImportData } from '../../../api/types';
import { useToast } from '../../../hooks/use-toast';
import { useEditorAreaContext } from '../EditorAreaContext';
import logger from '../../../lib/logger';

export function ImportConfiguration({
  open,
  onSuccess,
  onClose,
}: {
  open: boolean;
  onSuccess: (configurationId: string) => void;
  onClose: () => void;
}) {
  const [isAccordionOpen, setIsAccordionOpen] = useState(false);

  const { toast } = useToast();
  const { adapter } = useEditorAreaContext();

  const importConfiguration = async (
    name: string,
    importData: ConfigurationImportData,
  ) => {
    try {
      const fetchedBlocks = await adapter.getBlocks({ importData });

      // Create configuration in database
      const configurationId = await adapter.createConfiguration(name);

      // Save blocks to database
      await adapter.updateBlocks(configurationId, fetchedBlocks);

      // Get provider and function URLs from configuration data (single fetch)
      const configData = await adapter.getConfigurationData(importData);
      const providerIds = await adapter.createProvidersFromUrls(
        configData.providerUrls,
      );
      const functionIds = await adapter.createFunctionsFromUrls(
        configData.functionUrls,
      );

      // Assign providers and functions to configuration
      if (providerIds.length > 0 || functionIds.length > 0) {
        await adapter.updateConfiguration({
          id: configurationId,
          name,
          providers: providerIds,
          functions: functionIds,
        });
      }

      onSuccess(configurationId);
    } catch (e) {
      logger.info(e);
      toast({
        title: 'Unable to retrieve data from this Package URL',
        description: `${e}`,
        variant: 'destructive',
      });
    }
  };

  const ImportBlocksFormSchema = z.object({
    name: z.string().min(1, 'Configuration name is required'),
    packageUrl: z
      .string()
      .regex(
        /^[a-z0-9.-]+\/[a-z0-9.-]+\/[a-z0-9.-]+:[a-z0-9.-]+$/i,
        'Package URL is not valid',
      ),
    username: isAccordionOpen
      ? z.string().min(1, 'Add username')
      : z.string().optional(),
    password: isAccordionOpen
      ? z.string().min(1, 'Add password')
      : z.string().optional(),
  });

  type ImportBlocksFormValues = z.infer<typeof ImportBlocksFormSchema>;

  const form = useForm<ImportBlocksFormValues>({
    resolver: zodResolver(ImportBlocksFormSchema),
    defaultValues: { name: '', packageUrl: '', username: '', password: '' },
  });

  const onSubmit = form.handleSubmit((data) =>
    importConfiguration(data.name, {
      packageUrl: data.packageUrl,
      username: data.username,
      password: data.password,
    }),
  );

  return (
    <Dialog open={open} onOpenChange={(isOpen) => !isOpen && onClose()}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle>Import Blocks</DialogTitle>
        </DialogHeader>

        <FormProvider {...form}>
          <form className="flex flex-col gap-4" onSubmit={onSubmit}>
            <FormField
              control={form.control}
              name="name"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Configuration Name</FormLabel>
                  <FormControl>
                    <Input placeholder="Enter configuration name" {...field} />
                  </FormControl>
                  <FormMessage className="text-xs mt-1" />
                </FormItem>
              )}
            />
            <div className="flex items-end gap-2">
              <FormField
                control={form.control}
                name="packageUrl"
                render={({ field }) => (
                  <FormItem className="flex-1">
                    <FormLabel>Package URL</FormLabel>
                    <FormControl>
                      <Input placeholder="Package URL" {...field} />
                    </FormControl>
                    <FormMessage className="text-xs mt-1" />
                  </FormItem>
                )}
              />
              <Button type="submit" size="icon" className="min-w-9">
                <Import />
              </Button>
            </div>

            <Accordion
              type="single"
              collapsible
              className="w-full"
              onValueChange={(value) => setIsAccordionOpen(value === 'item-1')}
            >
              <AccordionItem value="item-1">
                <AccordionTrigger>Authentication</AccordionTrigger>
                <AccordionContent>
                  <FormField
                    control={form.control}
                    name="username"
                    render={({ field }) => (
                      <FormItem className="mb-4">
                        <FormLabel>Username</FormLabel>
                        <FormControl>
                          <Input placeholder="Username" {...field} />
                        </FormControl>
                        <FormMessage className="text-xs mt-1" />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="password"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Password</FormLabel>
                        <FormControl>
                          <Input
                            type="password"
                            placeholder="Password"
                            {...field}
                          />
                        </FormControl>
                        <FormMessage className="text-xs mt-1" />
                      </FormItem>
                    )}
                  />
                </AccordionContent>
              </AccordionItem>
            </Accordion>
          </form>
        </FormProvider>
      </DialogContent>
    </Dialog>
  );
}
