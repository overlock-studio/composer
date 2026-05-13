export type JSONSchemaProps = {
  type?: string;
  title?: string;
  description?: string;
  required?: string[];
  properties?: Record<string, JSONSchemaProps>;
  items?: JSONSchemaProps;
  enum?: unknown[];
  default?: unknown;
  format?: string;
  nullable?: boolean;
  additionalProperties?: boolean | JSONSchemaProps;
};
