declare module '@uibakery/data' {
  export function action(name: string, type: string, config: any): any;
  export function directAction(name: string, fn: (params?: Record<string, any>) => Promise<any[]>): any;
  export function useLoadAction(...args: any[]): any;
  export function useMutateAction(...args: any[]): any;
  /**
   * Liga um observador notificado a cada requisição concluída (nome da ação,
   * duração em ms, se falhou). `null` desliga. Devolve o observador anterior.
   * Usado pelo cronômetro de salvamento da Modelagem Financeira.
   */
  export function observarRequisicoes(
    fn: ((nome: string, ms: number, erro: boolean) => void) | null,
  ): ((nome: string, ms: number, erro: boolean) => void) | null;
}
