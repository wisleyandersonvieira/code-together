import { FullSupabaseMigration } from '@/components/FullSupabaseMigration';
import { Toaster } from '@/components/ui/toaster';
import { Database } from 'lucide-react';

export default function TempMigrationApp() {
  return (
    <div className="min-h-screen bg-gray-50">
      <div className="border-b bg-white">
        <div className="container mx-auto px-4">
          <div className="flex items-center justify-between h-16">
            <div className="flex items-center gap-2">
              <Database className="h-6 w-6 text-blue-600" />
              <h1 className="text-xl font-semibold">Migração para Supabase</h1>
            </div>
          </div>
        </div>
      </div>
      
      <div className="container mx-auto px-4 py-8">
        <FullSupabaseMigration />
      </div>
      
      <Toaster />
    </div>
  );
}
