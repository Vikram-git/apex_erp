import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { App } from 'antd';
import { api, getErrorMessage } from '../api/client';
import type { ListParams, Paginated } from '../api/types';

const cleanParams = (params?: ListParams) =>
  Object.fromEntries(Object.entries(params ?? {}).filter(([, v]) => v !== undefined && v !== ''));

export function usePaginated<T>(resource: string, params: ListParams, enabled = true) {
  return useQuery({
    queryKey: [resource, 'list', cleanParams(params)],
    queryFn: async () => (await api.get<Paginated<T>>(resource, { params: cleanParams(params) })).data,
    placeholderData: keepPreviousData,
    enabled,
  });
}

export function useList<T>(resource: string, params?: ListParams, enabled = true) {
  return useQuery({
    queryKey: [resource, 'all', cleanParams(params)],
    queryFn: async () => (await api.get<T[]>(resource, { params: cleanParams(params) })).data,
    enabled,
  });
}

export function useRecord<T>(resource: string, id: string | undefined) {
  return useQuery({
    queryKey: [resource, 'detail', id],
    queryFn: async () => (await api.get<T>(`${resource}/${id}`)).data,
    enabled: Boolean(id),
  });
}

/** Fetches every active record for dropdowns (first 200, which suits master data volumes). */
export function useOptions<T>(resource: string, enabled = true) {
  return useQuery({
    queryKey: [resource, 'options'],
    queryFn: async () =>
      (await api.get<Paginated<T>>(resource, { params: { pageSize: 200, isActive: true } })).data.data,
    staleTime: 60_000,
    enabled,
  });
}

interface MutationOptions<TVars, TResult> {
  request: (vars: TVars) => Promise<TResult>;
  invalidate: string[];
  successMessage?: string;
  onSuccess?: (result: TResult) => void;
}

export function useApiMutation<TVars = void, TResult = unknown>(options: MutationOptions<TVars, TResult>) {
  const queryClient = useQueryClient();
  const { message } = App.useApp();

  return useMutation({
    mutationFn: options.request,
    onSuccess: async (result) => {
      await Promise.all(options.invalidate.map((key) => queryClient.invalidateQueries({ queryKey: [key] })));
      if (options.successMessage) message.success(options.successMessage);
      options.onSuccess?.(result);
    },
    onError: (error) => {
      message.error(getErrorMessage(error));
    },
  });
}
