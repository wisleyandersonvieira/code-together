/**
 * Serializa um payload para ser enviado às actions SQL como literal seguro.
 *
 * O caminho `action(..., 'SQL')` escapa aspas simples duas vezes (uma no shim
 * do @uibakery/data e outra no template da edge function), o que corromperia
 * qualquer texto com apóstrofo. Enviando o JSON em base64 — alfabeto sem aspas
 * — o valor chega intacto e é decodificado no banco com
 * `convert_from(decode(:payload, 'base64'), 'UTF8')::jsonb`.
 */
export function encodeSqlJsonPayload(payload: unknown): string {
  const json = JSON.stringify(payload ?? null);
  const bytes = new TextEncoder().encode(json);

  let binary = '';
  bytes.forEach((byte) => {
    binary += String.fromCharCode(byte);
  });

  return btoa(binary);
}
