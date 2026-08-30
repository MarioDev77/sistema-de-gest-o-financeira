'use client';

import { useCallback } from 'react';
import { useAuth } from '@/context/AuthContext';
import { apiFetch, apiDownload } from '@/lib/api';

/**
 * Uso: const api = useApiClient(); await api.get('/products')
 * Já injeta o token do usuário logado em toda chamada.
 */
export function useApiClient() {
  const { token } = useAuth();

  const request = useCallback(
    (path, options) => apiFetch(path, { ...options, token }),
    [token]
  );

  const download = useCallback(
    (path, filename) => apiDownload(path, { token, filename }),
    [token]
  );

  return {
    get: (path) => request(path),
    post: (path, body) => request(path, { method: 'POST', body }),
    put: (path, body) => request(path, { method: 'PUT', body }),
    patch: (path, body) => request(path, { method: 'PATCH', body }),
    delete: (path) => request(path, { method: 'DELETE' }),
    download,
  };
}
