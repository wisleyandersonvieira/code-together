import { action } from '@uibakery/data';

function loadMatrizSocios() {
  return action('loadMatrizSocios', 'SQL', {
    databaseName: 'provision',
    query: `
      SELECT 
        ms.id,
        ms.matriz_id,
        ms.socio_id,
        ms.percentual_participacao,
        s.nome as socio_nome,
        s.email as socio_email,
        s.cpf as socio_cpf
      FROM matriz_socios ms
      JOIN socios s ON ms.socio_id = s.id
      WHERE ms.matriz_id = {{params.matrizId}}
      ORDER BY s.nome;
    `,
  });
}

export default loadMatrizSocios;
