import { generate } from "short-uuid";

export enum RESOURCE_TYPE {
  FILE = 'file',
  SCAN = 'scan',
  AV = 'av',
  AV_RESULT = 'av_result',
}

export function generateResourceId(type: RESOURCE_TYPE, id?: string) {
  id ??= generate();
  return `${type}_${id}`;
}   