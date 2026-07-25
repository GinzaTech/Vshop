import { flowTracer } from './flowTracer';

interface AxiosLikeInstance {
  interceptors: {
    request: { use: (handler: (config: any) => any) => void };
    response: { use: (success: (response: any) => any, failure: (error: any) => Promise<never>) => void };
  };
}

export function attachAxiosTracer(apiClient: AxiosLikeInstance) {
  apiClient.interceptors.request.use((config) => {
    flowTracer.track({
      type: 'API_REQUEST',
      label: `${config.method?.toUpperCase() ?? 'GET'} ${config.url}`,
      input: {
        url: config.url,
        method: config.method,
        data: config.data,
        headers: config.headers,
      },
      tool: 'Axios',
    });

    return config;
  });

  apiClient.interceptors.response.use(
    (response) => {
      flowTracer.track({
        type: 'API_RESPONSE',
        label: `Response ${response.status} ${response.config?.url ?? ''}`,
        output: {
          status: response.status,
          data: response.data,
        },
        tool: 'Axios',
      });

      return response;
    },
    (error) => {
      flowTracer.track({
        type: 'API_ERROR',
        label: `API Error ${error.config?.url ?? ''}`,
        status: 'error',
        error: {
          message: error.message,
          code: error.response?.status,
        },
        tool: 'Axios',
      });

      return Promise.reject(error);
    },
  );
}
