declare module '@uibakery/data' {
  export function action(name: string, type: string, config: any): any;
  export function directAction(name: string, fn: (params?: Record<string, any>) => Promise<any[]>): any;
  export function useLoadAction(...args: any[]): any;
  export function useMutateAction(...args: any[]): any;
}
