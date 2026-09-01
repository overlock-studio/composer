'use client';
import React, { useState, useMemo } from 'react';
import { ContainerNodeData } from '../../../lib/types';
import { Node, NodeProps, Position } from '@xyflow/react';
import { Box, Pencil, Settings, Trash2 } from 'lucide-react';
import { NodeDeletionDialog } from '../ConfirmDeletionDialog';
import { useNodeDeleteShortcut } from '../../../lib/useNodeDeleteShortcut';
import { ContainerNodeFooter } from './ContainerNodeFooter';
import { CustomHandle } from '../CustomHandle';
import { Button } from '../../ui/button';
import { Input } from '../../ui/input';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '../../ui/dialog';
import {
  connectorLabels,
  CONTAINER_HANDLE_SPACING,
  CONTAINER_NODE_WIDTH,
} from '../../../lib/editorUtils';
import { useEditorActions } from '../EditorAreaContext/EditorAreaContext';

const ContainerNodeComponent = ({
  id: containerId,
  data,
  selected,
}: NodeProps<Node<ContainerNodeData>>) => {
  const [openDeleteDialog, setOpenDeleteDialog] = useState(false);
  const [editOpen, setEditOpen] = useState<boolean>(false);
  useNodeDeleteShortcut(selected, () => setOpenDeleteDialog(true));
  const connectors = data.connectors;
  const { setNodes, resolveBlockType, openContainer } = useEditorActions();

  const labels = useMemo(() => connectorLabels(connectors), [connectors]);

  const { name, blockType, functions } = data;
  const kind = data.kind ?? blockType?.kind ?? '';
  const apiVersion = data.apiVersion ?? blockType?.apiVersion ?? '';
  const resolvedBlockType = useMemo(
    () => resolveBlockType(apiVersion, kind),
    [apiVersion, kind, resolveBlockType],
  );
  const icon = resolvedBlockType?.icon ?? blockType?.icon;

  const inputs = useMemo(
    () => (connectors || []).filter((c) => c.connection !== 'output'),
    [connectors],
  );
  const outputs = useMemo(
    () => (connectors || []).filter((c) => c.connection === 'output'),
    [connectors],
  );

  const updateData = (patch: Partial<ContainerNodeData>) => {
    setNodes((nds) =>
      nds.map((node) =>
        node.id === containerId
          ? { ...node, data: { ...node.data, ...patch } }
          : node,
      ),
    );
  };

  const [editName, setEditName] = useState<string>('');
  const [editKind, setEditKind] = useState<string>('');
  const [editApiVersion, setEditApiVersion] = useState<string>('');

  const openEditDialog = () => {
    setEditName(name || '');
    setEditKind(kind || '');
    setEditApiVersion(apiVersion || '');
    setEditOpen(true);
  };

  const handleEditSave = () => {
    const patch: Partial<ContainerNodeData> = {};
    if (editName.trim() && editName !== name) patch.name = editName.trim();
    if (editKind.trim() !== kind) patch.kind = editKind.trim();
    if (editApiVersion.trim() !== apiVersion) {
      patch.apiVersion = editApiVersion.trim();
    }
    if (Object.keys(patch).length) updateData(patch);
    setEditOpen(false);
  };


  return (
    // A container is at least square, so it keeps a block-like footprint even
    // with few connectors.
    <div className="node-body" style={{ minHeight: CONTAINER_NODE_WIDTH }}>
      <div className="flex items-center border-b-[2px] border-muted-foreground/20 px-2 py-1 rounded-t-lg">
        <div className="w-14 flex items-center">
          {icon ? (
            <img src={icon} alt="" width={20} height={20} draggable={false} />
          ) : (
            <Box className="text-muted-foreground" width={20} height={20} />
          )}
        </div>
        <div className="flex-1 text-center">
          <div className="text-sm font-medium">{name}</div>
          {apiVersion && (
            <div className="text-[0.625rem] text-muted-foreground">
              {apiVersion}
            </div>
          )}
        </div>
        <div className="flex gap-0.5">
          <Button
            size="icon"
            variant="ghost"
            className="h-6 w-6 [&_svg]:size-3.5"
            onClick={openEditDialog}
            aria-label="Composition settings"
          >
            <Settings />
          </Button>
          <Button
            size="icon"
            variant="ghost"
            className="h-6 w-6 [&_svg]:size-3.5"
            onClick={() => openContainer(containerId)}
            aria-label="Edit container"
          >
            <Pencil />
          </Button>
          <Button
            size="icon"
            variant="ghost"
            className="h-6 w-6 [&_svg]:size-3.5 hover:text-red-400"
            onClick={() => setOpenDeleteDialog(true)}
          >
            <Trash2 />
          </Button>
        </div>
      </div>
      <div className="flex flex-row justify-between">
        <div className="flex flex-col">
          {inputs.map((connector, index) => (
            <CustomHandle
              key={connector.path}
              type="target"
              position={Position.Left}
              id={connector.path}
              style={{ top: `${CONTAINER_HANDLE_SPACING * (index + 2)}px` }}
              isConnectableStart={false}
              inactiveClass={'opacity-30'}
              description={connector.description}
              path={connector.path}
              label={labels[connector.path]}
              variant="block"
            />
          ))}
        </div>
        <div className="flex flex-col">
          {outputs.map((connector, index) => (
            <CustomHandle
              key={connector.path}
              type="source"
              position={Position.Right}
              id={connector.path}
              style={{ top: `${CONTAINER_HANDLE_SPACING * (index + 2)}px` }}
              isConnectableStart={false}
              isConnectableEnd={false}
              inactiveClass={'opacity-30'}
              description={connector.description}
              path={connector.path}
              label={labels[connector.path]}
              variant="block"
            />
          ))}
        </div>
      </div>
      <Dialog open={editOpen} onOpenChange={setEditOpen}>
        <DialogContent className="sm:max-w-[500px]">
          <DialogHeader>
            <DialogTitle>Edit Composition</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <label className="text-sm font-medium">Composition Name</label>
              <Input
                value={editName}
                onChange={(e) => setEditName(e.target.value)}
                placeholder="Enter composition name"
              />
            </div>
            <div>
              <label className="text-sm font-medium">Kind</label>
              <Input
                value={editKind}
                onChange={(e) => setEditKind(e.target.value)}
                placeholder="Enter kind (e.g. XMyResource)"
              />
            </div>
            <div>
              <label className="text-sm font-medium">API Version</label>
              <Input
                value={editApiVersion}
                onChange={(e) => setEditApiVersion(e.target.value)}
                placeholder="Enter API version (e.g. example.org/v1alpha1)"
              />
            </div>
            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={() => setEditOpen(false)}>
                Cancel
              </Button>
              <Button onClick={handleEditSave}>Save</Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
      <ContainerNodeFooter functions={functions} />
      <NodeDeletionDialog
        open={openDeleteDialog}
        nodeId={containerId}
        setOpen={setOpenDeleteDialog}
      />
    </div>
  );
};

export const ContainerNode = React.memo(ContainerNodeComponent);
