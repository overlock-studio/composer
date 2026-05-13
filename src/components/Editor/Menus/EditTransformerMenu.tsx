'use client';
import React from 'react';
import { EditTransformersMenuProps, Transformer } from '../../../lib/types';
import {
  EditMapTransformer,
  EditMatchTransformer,
  EditMathTransformer,
  EditStringTransformer,
} from '../EditTransformerForms';

export const EditTransformerMenu = ({
  transformer,
  setTransformers,
  transformerIndex,
  setOpenTransformerToolbar,
}: EditTransformersMenuProps) => {
  const renderTransformerEditForm = (trans: Transformer) => {
    switch (trans.type) {
      case 'map':
        return (
          <EditMapTransformer
            transformer={trans}
            transformerIndex={transformerIndex}
            setTransformers={setTransformers}
            setOpenTransformerToolbar={setOpenTransformerToolbar}
          />
        );
      case 'match':
        return (
          <EditMatchTransformer
            transformer={trans}
            transformerIndex={transformerIndex}
            setTransformers={setTransformers}
            setOpenTransformerToolbar={setOpenTransformerToolbar}
          />
        );
      case 'math':
        return (
          <EditMathTransformer
            transformer={trans}
            transformerIndex={transformerIndex}
            setTransformers={setTransformers}
            setOpenTransformerToolbar={setOpenTransformerToolbar}
          />
        );
      case 'string':
        return (
          <EditStringTransformer
            transformer={trans}
            transformerIndex={transformerIndex}
            setTransformers={setTransformers}
            setOpenTransformerToolbar={setOpenTransformerToolbar}
          />
        );
      default:
        return null;
    }
  };

  return renderTransformerEditForm(transformer);
};
