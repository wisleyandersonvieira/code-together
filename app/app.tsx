'use client';

import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { 
  Users, 
  UserPlus, 
  Settings, 
  BarChart3, 
  Building, 
  Building2, 
  UserCheck, 
  Truck, 
  Home,
  Plus,
  ChevronDown,
  FolderOpen,
  CreditCard,
  Calculator,
  Banknote,
  Receipt,
  DollarSign,
  ArrowLeftRight,
  FileText,
  Package,
  File,
  PieChart,
  LogOut,
  User as UserIcon,
  Server,
  Zap
} from 'lucide-react';
import { UserList } from '@/components/UserList';
import { UserForm } from '@/components/UserForm';
import { ClienteList } from '@/components/ClienteList';
import { ClienteForm } from '@/components/ClienteForm';
import { EmpresaList } from '@/components/EmpresaList';
import { GrupoList } from '@/components/GrupoList';
import { FornecedorList } from '@/components/FornecedorList';
import { ProjetoForm } from '@/components/ProjetoForm';
import { ProjetoList } from '@/components/ProjetoList';
import { Dashboard } from '@/components/Dashboard';
import { ContaList } from '@/components/ContaList';
import { GrupoContabilList } from '@/components/GrupoContabilList';
import { SubgrupoContabilList } from '@/components/SubgrupoContabilList';
import { ProductList } from '@/components/ProductList';
import { TipoDocumentoList } from '@/components/TipoDocumentoList';
import { ContasPagarList } from '@/components/ContasPagarList';
import { ContasReceberList } from '@/components/ContasReceberList';
import { TransferenciaList } from '@/components/TransferenciaList';
import { ExtratosList } from '@/components/ExtratosList';
import { ParametrosList } from '@/components/ParametrosList';
import { RelatorioCliente } from '@/components/RelatorioCliente';
import { RelatorioExtratoCliente } from '@/components/RelatorioExtratoCliente';
import { RelatorioFinanceiroSaidas } from '@/components/RelatorioFinanceiroSaidas';
import { RelatorioFinanceiroEntradas } from '@/components/RelatorioFinanceiroEntradas';
import { RelatorioProjetosGeral } from '@/components/RelatorioProjetosGeral';
import { SociosList } from '@/components/SociosList';
import { MatrizesList } from '@/components/MatrizesList';
import { AportesList } from '@/components/AportesList';
import { RetiradasList } from '@/components/RetiradasList';
import { EstruturasDreList } from '@/components/EstruturasDreList';
import { EstruturaDreForm } from '@/components/EstruturaDreForm';
import { RelatorioDre } from '@/components/RelatorioDre';
import { RelatorioDreProjeto } from '@/components/RelatorioDreProjeto';
import { Kanban } from '@/components/Kanban';
import { FullSupabaseMigration } from '@/components/FullSupabaseMigration';

import { LoginForm } from '@/components/LoginForm';
import { NetworkStatus } from '@/components/NetworkStatus';
import { DatabaseBackup } from '@/components/DatabaseBackup';
import { DatabaseConnectionStatus } from '@/components/DatabaseConnectionStatus';
import { RDSMigration } from '@/components/RDSMigration';
import { IncrementalSync } from '@/components/IncrementalSync';
import type { User } from '@/types/user';
import { SetPasswordForm } from '@/components/SetPasswordForm';
import { Toaster } from '@/components/ui/toaster';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Database, Github } from 'lucide-react';
import { ProvisonLogo } from '@/components/ProvisonLogo';
import { ExportProject } from '@/components/ExportProject';

type TabType = 
  | 'dashboard' 
  | 'users' 
  | 'create-user'
  | 'set-password'
  | 'clientes' 
  | 'create-cliente'
  | 'empresas'
  | 'create-empresa'
  | 'grupos'
  | 'create-grupo'
  | 'fornecedores'
  | 'create-fornecedor'
  | 'contas'
  | 'grupos-contabeis'
  | 'subgrupos-contabeis'
  | 'projetos'
  | 'create-projeto'
  | 'contas-pagar'
  | 'contas-receber'
  | 'transferencias'
  | 'extratos'
  | 'produtos'
  | 'tipos-documento'
  | 'parametros'
  | 'relatorio-cliente'
  | 'relatorio-extrato-cliente'
  | 'relatorio-financeiro-saidas'
  | 'relatorio-financeiro-entradas'
  | 'relatorio-projetos-geral'
  | 'socios'
  | 'matrizes'
  | 'kanban'
  | 'aportes'
  | 'retiradas'
  | 'estruturas-dre'
  | 'create-estrutura-dre'
  | 'relatorio-dre'
  | 'relatorio-dre-projeto'
  | 'supabase-migration'
  | 'rds-migration'
  | 'incremental-sync'
  | 'export-project';

function App() {
  const [activeTab, setActiveTab] = useState<TabType>('dashboard');
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [showRegistration, setShowRegistration] = useState(false);
  const [editingEstrutura, setEditingEstrutura] = useState<{ id: number; nome: string } | undefined>(undefined);

  const handleLogin = (user: User) => {
    setCurrentUser(user);
    setShowRegistration(false);
  };

  const handleLogout = () => {
    setCurrentUser(null);
    setActiveTab('dashboard');
    setShowRegistration(false);
  };

  // Verificar se deve mostrar página de status
  const showStatus = typeof window !== 'undefined' && new URLSearchParams(window.location.search).get('status') === 'true';
  const showBackup = typeof window !== 'undefined' && new URLSearchParams(window.location.search).get('backup') === 'true';
  const showRDSMigration = typeof window !== 'undefined' && new URLSearchParams(window.location.search).get('rds') === 'true';

  if (showStatus) {
    return (
      <>
        <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
          <NetworkStatus />
        </div>
        <Toaster />
      </>
    );
  }

  if (showBackup) {
    return (
      <>
        <div className="min-h-screen bg-gray-50 p-4">
          <div className="max-w-4xl mx-auto">
            <DatabaseBackup />
          </div>
        </div>
        <Toaster />
      </>
    );
  }

  if (showRDSMigration) {
    return (
      <>
        <div className="min-h-screen bg-gray-50 p-4">
          <div className="max-w-4xl mx-auto">
            <RDSMigration />
          </div>
        </div>
        <Toaster />
      </>
    );
  }

  // If no user is logged in, show login form or registration form
  if (!currentUser) {
    
    if (showRegistration) {
      return (
        <>
          <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
            <div className="w-full max-w-2xl">
              <UserForm
                onSuccess={() => setShowRegistration(false)}
                onCancel={() => setShowRegistration(false)}
              />
            </div>
          </div>
          <Toaster />
        </>
      );
    }

    return (
      <>
        <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
          <div className="w-full max-w-md space-y-6">
            <LoginForm onLogin={handleLogin} />
            <div className="text-center">
              <Button 
                variant="outline" 
                onClick={() => setShowRegistration(true)}
                className="w-full"
              >
                <UserPlus className="mr-2 h-4 w-4" />
                Cadastrar Novo Usuário
              </Button>
            </div>
          </div>
        </div>
        <Toaster />
      </>
    );
  }


  
  const cadastroTabs: TabType[] = ['clientes', 'empresas', 'grupos', 'fornecedores', 'users', 'contas', 'grupos-contabeis', 'subgrupos-contabeis', 'produtos', 'tipos-documento', 'parametros'];
  const isCadastroActive = cadastroTabs.includes(activeTab);
  
  const financeiroTabs: TabType[] = ['contas-pagar', 'contas-receber', 'transferencias', 'extratos'];
  const isFinanceiroActive = financeiroTabs.includes(activeTab);
  
  const relatorioTabs: TabType[] = ['relatorio-cliente', 'relatorio-extrato-cliente', 'relatorio-financeiro-saidas', 'relatorio-financeiro-entradas', 'relatorio-projetos-geral'];
  const isRelatorioActive = relatorioTabs.includes(activeTab);
  
  const matrizTabs: TabType[] = ['socios', 'matrizes', 'kanban', 'aportes', 'retiradas', 'estruturas-dre', 'create-estrutura-dre', 'relatorio-dre', 'export-project'];
  const isMatrizActive = matrizTabs.includes(activeTab);

  const renderContent = () => {
    switch (activeTab) {
      case 'users':
        return <UserList />;
      case 'create-user':
        return (
          <UserForm
            onSuccess={() => setActiveTab('users')}
            onCancel={() => setActiveTab('users')}
            isAdminView={true}
          />
        );
      case 'set-password':
        return <SetPasswordForm />;
      case 'clientes':
        return <ClienteList />;
      case 'create-cliente':
        return (
          <ClienteForm
            onSuccess={() => setActiveTab('clientes')}
            onCancel={() => setActiveTab('clientes')}
          />
        );
      case 'empresas':
        return <EmpresaList />;
      case 'grupos':
        return <GrupoList />;
      case 'fornecedores':
        return <FornecedorList />;
      case 'contas':
        return <ContaList />;
      case 'grupos-contabeis':
        return <GrupoContabilList />;
      case 'subgrupos-contabeis':
        return <SubgrupoContabilList />;
      case 'produtos':
        return <ProductList />;
      case 'tipos-documento':
        return <TipoDocumentoList />;
      case 'parametros':
        return <ParametrosList />;
      case 'create-projeto':
        return (
          <ProjetoForm
            onSuccess={() => setActiveTab('projetos')}
            onCancel={() => setActiveTab('projetos')}
          />
        );
      case 'projetos':
        return <ProjetoList onCreateNew={() => setActiveTab('create-projeto')} />;
      case 'contas-pagar':
        return <ContasPagarList />;
      case 'contas-receber':
        return <ContasReceberList />;
      case 'transferencias':
        return <TransferenciaList />;
      case 'extratos':
        return <ExtratosList />;
      case 'relatorio-cliente':
        return <RelatorioCliente />;
      case 'relatorio-extrato-cliente':
        return <RelatorioExtratoCliente />;
      case 'relatorio-financeiro-saidas':
        return <RelatorioFinanceiroSaidas />;
      case 'relatorio-financeiro-entradas':
        return <RelatorioFinanceiroEntradas />;
      case 'relatorio-projetos-geral':
        return <RelatorioProjetosGeral />;
      case 'socios':
        return <SociosList />;
      case 'matrizes':
        return <MatrizesList />;
      case 'aportes':
        return <AportesList />;
      case 'retiradas':
        return <RetiradasList />;
      case 'estruturas-dre':
        return (
          <EstruturasDreList
            onCreateNew={() => {
              setEditingEstrutura(undefined);
              setActiveTab('create-estrutura-dre');
            }}
            onEdit={(estrutura) => {
              setEditingEstrutura(estrutura);
              setActiveTab('create-estrutura-dre');
            }}
          />
        );
      case 'create-estrutura-dre':
        return (
          <EstruturaDreForm
            estrutura={editingEstrutura}
            onSuccess={() => {
              setEditingEstrutura(undefined);
              setActiveTab('estruturas-dre');
            }}
            onCancel={() => {
              setEditingEstrutura(undefined);
              setActiveTab('estruturas-dre');
            }}
          />
        );
      case 'relatorio-dre':
        return <RelatorioDre />;
      case 'kanban':
        return <Kanban />;
      case 'relatorio-dre-projeto':
        return <RelatorioDreProjeto />;
      case 'supabase-migration':
        return <FullSupabaseMigration />;
      case 'rds-migration':
        return <RDSMigration />;
      case 'incremental-sync':
        return <IncrementalSync />;
      case 'export-project':
        return <ExportProject />;

      case 'dashboard':
      default:
        return <Dashboard onNavigate={(tab) => setActiveTab(tab as TabType)} />;
    }
  };

  const getActiveButtonVariant = (tab: TabType) => {
    return activeTab === tab ? 'default' : 'ghost';
  };

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Database Connection Status - only show if there's an error */}
      <div className="container mx-auto p-4">
        <DatabaseConnectionStatus />
      </div>
      
      <div className="border-b bg-white">
        <div className="container mx-auto px-4">
          <div className="flex items-center justify-between h-16">
            <div className="flex items-center gap-3">
              <div className="bg-black p-2 rounded">
                <ProvisonLogo className="w-8 h-8" />
              </div>
              <h1 className="text-2xl font-bold text-gray-900">PROVISON</h1>
            </div>
            <div className="flex items-center gap-4">
              <div className="flex items-center gap-2">
                <Badge variant="outline">{currentUser.role}</Badge>
                <span className="text-sm text-gray-600">{currentUser.name}</span>
              </div>

              <Button 
                variant="ghost" 
                size="sm" 
                onClick={handleLogout}
                className="text-gray-600 hover:text-gray-900"
              >
                <LogOut className="h-4 w-4 mr-2" />
                Sair
              </Button>
            </div>
          </div>
        </div>
      </div>

      <div className="border-b bg-white overflow-x-auto">
        <div className="container mx-auto px-4">
          <div className="flex gap-1 h-12 min-w-max">
            <Button
              variant={getActiveButtonVariant('dashboard')}
              className="rounded-none border-b-2 border-transparent data-[state=active]:border-blue-600"
              onClick={() => setActiveTab('dashboard')}
            >
              <BarChart3 className="mr-2 h-4 w-4" />
              Dashboard
            </Button>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button
                  variant={isCadastroActive ? 'default' : 'ghost'}
                  className="rounded-none border-b-2 border-transparent data-[state=open]:border-blue-600"
                  style={{ borderBottomColor: isCadastroActive ? '#2563eb' : 'transparent' }}
                >
                  <FolderOpen className="mr-2 h-4 w-4" />
                  Cadastros
                  <ChevronDown className="ml-2 h-4 w-4" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="start">
                <DropdownMenuItem onClick={() => setActiveTab('clientes')}>
                  <UserCheck className="mr-2 h-4 w-4" />
                  Clientes
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => setActiveTab('empresas')}>
                  <Building className="mr-2 h-4 w-4" />
                  Empresas
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => setActiveTab('grupos')}>
                  <Building2 className="mr-2 h-4 w-4" />
                  Grupos
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => setActiveTab('fornecedores')}>
                  <Truck className="mr-2 h-4 w-4" />
                  Fornecedores
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => setActiveTab('users')}>
                  <Users className="mr-2 h-4 w-4" />
                  Usuários
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => setActiveTab('set-password')}>
                  <UserPlus className="mr-2 h-4 w-4" />
                  Definir Senha
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => setActiveTab('contas')}>
                  <CreditCard className="mr-2 h-4 w-4" />
                  Contas
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => setActiveTab('grupos-contabeis')}>
                  <Calculator className="mr-2 h-4 w-4" />
                  Grupos Contábeis
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => setActiveTab('subgrupos-contabeis')}>
                  <Calculator className="mr-2 h-4 w-4" />
                  Subgrupos Contábeis
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => setActiveTab('produtos')}>
                  <Package className="mr-2 h-4 w-4" />
                  Produtos/Serviços
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => setActiveTab('tipos-documento')}>
                  <File className="mr-2 h-4 w-4" />
                  Tipos de Documento
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => setActiveTab('parametros')}>
                  <Settings className="mr-2 h-4 w-4" />
                  Parâmetros
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
            <Button
              variant={getActiveButtonVariant('projetos')}
              className="rounded-none border-b-2 border-transparent data-[state=active]:border-blue-600"
              onClick={() => setActiveTab('projetos')}
            >
              <Home className="mr-2 h-4 w-4" />
              Projetos
            </Button>
            <Button
              variant={getActiveButtonVariant('kanban')}
              className="rounded-none border-b-2 border-transparent data-[state=active]:border-blue-600"
              onClick={() => setActiveTab('kanban')}
            >
              <BarChart3 className="mr-2 h-4 w-4" />
              Painel
            </Button>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button
                  variant={isFinanceiroActive ? 'default' : 'ghost'}
                  className="rounded-none border-b-2 border-transparent data-[state=open]:border-blue-600"
                  style={{ borderBottomColor: isFinanceiroActive ? '#2563eb' : 'transparent' }}
                >
                  <Banknote className="mr-2 h-4 w-4" />
                  Financeiro
                  <ChevronDown className="ml-2 h-4 w-4" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="start">
                <DropdownMenuItem onClick={() => setActiveTab('contas-pagar')}>
                  <Receipt className="mr-2 h-4 w-4" />
                  Cadastro de Contas a Pagar
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => setActiveTab('contas-receber')}>
                  <DollarSign className="mr-2 h-4 w-4" />
                  Cadastro de Contas a Receber
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => setActiveTab('transferencias')}>
                  <ArrowLeftRight className="mr-2 h-4 w-4" />
                  Transferência
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => setActiveTab('extratos')}>
                  <FileText className="mr-2 h-4 w-4" />
                  Extratos
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button
                  variant={isRelatorioActive ? 'default' : 'ghost'}
                  className="rounded-none border-b-2 border-transparent data-[state=open]:border-blue-600"
                  style={{ borderBottomColor: isRelatorioActive ? '#2563eb' : 'transparent' }}
                >
                  <PieChart className="mr-2 h-4 w-4" />
                  Relatórios
                  <ChevronDown className="ml-2 h-4 w-4" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="start">
                <DropdownMenuItem onClick={() => setActiveTab('relatorio-cliente')}>
                  <UserCheck className="mr-2 h-4 w-4" />
                  Relatório por Projeto
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => setActiveTab('relatorio-extrato-cliente')}>
                  <FileText className="mr-2 h-4 w-4" />
                  Extrato do Cliente
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => setActiveTab('relatorio-financeiro-saidas')}>
                  <Receipt className="mr-2 h-4 w-4" />
                  Relatório Financeiro Saídas
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => setActiveTab('relatorio-financeiro-entradas')}>
                  <DollarSign className="mr-2 h-4 w-4" />
                  Relatório Financeiro Entradas
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => setActiveTab('relatorio-projetos-geral')}>
                  <BarChart3 className="mr-2 h-4 w-4" />
                  Relatório Projetos Geral
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button
                  variant={isMatrizActive ? 'default' : 'ghost'}
                  className="rounded-none border-b-2 border-transparent data-[state=open]:border-blue-600"
                  style={{ borderBottomColor: isMatrizActive ? '#2563eb' : 'transparent' }}
                >
                  <Building className="mr-2 h-4 w-4" />
                  Matriz
                  <ChevronDown className="ml-2 h-4 w-4" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="start">
                <DropdownMenuItem onClick={() => setActiveTab('socios')}>
                  <User className="mr-2 h-4 w-4" />
                  Cadastrar Sócio
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => setActiveTab('matrizes')}>
                  <Building className="mr-2 h-4 w-4" />
                  Cadastrar Matriz
                </DropdownMenuItem>

                <DropdownMenuItem onClick={() => setActiveTab('aportes')}>
                  <DollarSign className="mr-2 h-4 w-4" />
                  Aporte
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => setActiveTab('retiradas')}>
                  <DollarSign className="mr-2 h-4 w-4" />
                  Retirada
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => setActiveTab('estruturas-dre')}>
                  <FileText className="mr-2 h-4 w-4" />
                  Estrutura DRE
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => setActiveTab('relatorio-dre')}>
                  <PieChart className="mr-2 h-4 w-4" />
                  Relatório DRE
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => setActiveTab('export-project')}>
                  <Github className="mr-2 h-4 w-4" />
                  Exportar para GitHub
                </DropdownMenuItem>

              </DropdownMenuContent>
            </DropdownMenu>

          </div>
        </div>
      </div>

      <div className="container mx-auto px-4 py-8">
        {renderContent()}
      </div>
      
      <Toaster />
    </div>
  );
}

export default App;
