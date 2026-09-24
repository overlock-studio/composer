import type { Block } from '@overlock-studio/composer';
import sampleBlocks from './samples/blocks.json';

// The dev server keeps the last save in memory, seeded from
// samples/blocks.json when it starts. A build is static files with no server
// behind it, so it starts from the same sample and keeps saves in the
// visitor's own browser instead.
const BLOCKS_URL = '/api/blocks';
const STORAGE_KEY = 'composer-demo-blocks';

export const blocksStoredIn = import.meta.env.DEV
  ? "the dev server's memory"
  : 'this browser';

export const loadBlocks = async (): Promise<Block[]> => {
  if (import.meta.env.DEV) {
    return (await fetch(BLOCKS_URL)).json() as Promise<Block[]>;
  }
  const saved = localStorage.getItem(STORAGE_KEY);
  return saved
    ? (JSON.parse(saved) as Block[])
    : (sampleBlocks as unknown as Block[]);
};

export const storeBlocks = async (blocks: Block[]): Promise<void> => {
  if (import.meta.env.DEV) {
    await fetch(BLOCKS_URL, {
      method: 'PUT',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(blocks),
    });
    return;
  }
  localStorage.setItem(STORAGE_KEY, JSON.stringify(blocks));
};
