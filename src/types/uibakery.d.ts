declare module '@uibakery/data' {
  export function action(name: string, type: string, config: any): any;
  export function useLoadAction(name: string, options?: any): any;
  export function useMutateAction(name: string, options?: any): any;
}
