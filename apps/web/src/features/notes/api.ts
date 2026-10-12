import { localApi } from '../../local/api';

export async function api(path: string, method = 'GET', data?: unknown, key?: string) {
  return localApi(path, method, data, key);
}

