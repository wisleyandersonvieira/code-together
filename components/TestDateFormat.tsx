import React from 'react';
import { useLoadAction } from '@uibakery/data';
import { formatDateForDisplay } from '@/utils/timezone';
import debugExtratoAction from '@/actions/debugExtrato';

export function TestDateFormat() {
  const [debugData] = useLoadAction(debugExtratoAction, []);

  console.log('Debug data:', debugData);

  return (
    <div className="p-4">
      <h3 className="text-lg font-bold mb-4">Debug Date Format</h3>
      {debugData && debugData.length > 0 ? (
        <div className="space-y-2">
          {debugData.map((item: any, index: number) => (
            <div key={index} className="border p-2 rounded">
              <p><strong>Tipo:</strong> {item.tipo}</p>
              <p><strong>Data Original:</strong> {item.data_pagamento || item.data_recebimento || item.data_transferencia || item.data_aporte || item.data_retirada || 'N/A'}</p>
              <p><strong>Data Texto:</strong> {item.data_texto}</p>
              <p><strong>Data Formatada:</strong> {formatDateForDisplay(item.data_texto)}</p>
              <p><strong>Status:</strong> {item.status}</p>
              <p><strong>Conta ID:</strong> {item.conta_id}</p>
            </div>
          ))}
        </div>
      ) : (
        <p>No data found</p>
      )}
    </div>
  );
}
