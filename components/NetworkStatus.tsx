'use client';

import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { useMutateAction } from '@uibakery/data';
import checkNetworkStatusAction from '@/actions/checkNetworkStatus';
import testPublicAccessAction from '@/actions/testPublicAccess';
import { AccessLimitations } from './AccessLimitations';
import { PublicationGuide } from './PublicationGuide';

export function NetworkStatus() {
  const [testResult, setTestResult] = useState<any>(null);
  const [publicTestResult, setPublicTestResult] = useState<any>(null);
  const [checkStatus, isChecking] = useMutateAction(checkNetworkStatusAction);
  const [testPublicAccess, isTestingPublic] = useMutateAction(testPublicAccessAction);

  const handleTest = async () => {
    try {
      const result = await checkStatus({});
      setTestResult(result);
    } catch (error) {
      console.error('Network test error:', error);
      setTestResult({ error: error.message || 'Network test failed' });
    }
  };

  const handlePublicTest = async () => {
    try {
      const result = await testPublicAccess({});
      setPublicTestResult(result);
    } catch (error) {
      console.error('Public access test error:', error);
      setPublicTestResult({ error: error.message || 'Public access test failed' });
    }
  };

  return (
    <div className="space-y-6">
      <Card className="w-full max-w-md mx-auto">
        <CardHeader>
          <CardTitle>Status da Aplicação</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <p><strong>URL atual:</strong> {window.location.href}</p>
            <p><strong>Host:</strong> {window.location.host}</p>
            <p><strong>Protocol:</strong> {window.location.protocol}</p>
          </div>
          
          <div className="space-y-2">
            <Button onClick={handleTest} disabled={isChecking} className="w-full">
              {isChecking ? 'Testando...' : 'Testar Conectividade Básica'}
            </Button>

            <Button onClick={handlePublicTest} disabled={isTestingPublic} className="w-full" variant="outline">
              {isTestingPublic ? 'Testando...' : 'Testar Acesso Público'}
            </Button>
          </div>

          {testResult && (
            <div className="p-4 bg-gray-100 rounded">
              <h4 className="font-semibold mb-2">Teste Básico:</h4>
              <pre className="text-xs">{JSON.stringify(testResult, null, 2)}</pre>
            </div>
          )}

          {publicTestResult && (
            <div className="p-4 bg-green-50 rounded">
              <h4 className="font-semibold mb-2 text-green-700">Teste Público:</h4>
              <pre className="text-xs">{JSON.stringify(publicTestResult, null, 2)}</pre>
            </div>
          )}
        </CardContent>
      </Card>

      <PublicationGuide />
      <AccessLimitations />
    </div>
  );
}
