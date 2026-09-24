// A package as the editor asks for its block types: `url:version`, with the
// range operators of a crossplane.yaml constraint dropped, or the bare url
// when there is no version. Shared with vite.config.ts, which bakes the block
// types of the sample providers into the build under these same keys.
export const packageVersion = (constraint: string): string | undefined =>
  constraint.replace(/^[>=<~^ ]+/, '') || undefined;

export const packageRef = (url: string, constraint = ''): string => {
  const version = packageVersion(constraint);
  return version ? `${url}:${version}` : url;
};
