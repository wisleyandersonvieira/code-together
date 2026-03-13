declare module '@uibakery/data' {
  export function action(name: string, type: string, config: any): any;
  export function useLoadAction(...args: any[]): any;
  export function useMutateAction(...args: any[]): any;
}
