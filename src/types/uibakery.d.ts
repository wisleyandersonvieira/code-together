declare module '@uibakery/data' {
  export function action(name: string, type: string, config: any): any;
  export function directAction(name: string, fn: (params?: Record<string, any>) => Promise<any[]>): any;
  export function useLoadAction(...args: any[]): any;
  export function useMutateAction(...args: any[]): any;
  /**
   * O que o execute-sql relatou sobre a própria execução, lido dos headers
   * `Server-Timing` e `X-Exec-Boot`. Ausente quando a resposta não os trouxe.
   */
  export interface TemposServidor {
    boot: string;
    seq: number;
    totalMs: number;
    authMs: number;
    conexaoMs: number;
    queryMs: number;
  }

  /**
   * Liga um observador notificado a cada requisição concluída (nome da ação,
   * duração em ms, se falhou, e o que o servidor relatou de si). `null`
   * desliga. Devolve o observador anterior. Usado pelo cronômetro de
   * salvamento da Modelagem Financeira.
   */
  export function observarRequisicoes(
    fn: ((nome: string, ms: number, erro: boolean, servidor?: TemposServidor) => void) | null,
  ): ((nome: string, ms: number, erro: boolean, servidor?: TemposServidor) => void) | null;
}
