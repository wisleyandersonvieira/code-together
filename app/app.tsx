'use client';

import { lazy, Suspense, useEffect, useState } from 'react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Toaster } from '@/components/ui/toaster';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  ArrowLeftRight,
  Banknote,
  BarChart3,
  Building,
  Building2,
  Calculator,
  ChevronDown,
  CreditCard,
  DollarSign,
  File,
  FileText,
  FolderOpen,
  Github,
  Home,
  LogOut,
  Package,
  PieChart,
  Receipt,
  Settings,
  Truck,
  User as UserIcon,
  UserCheck,
  UserPlus,
  Users,
} from 'lucide-react';
import { LoginForm } from '@/components/LoginForm';
import { NetworkStatus } from '@/components/NetworkStatus';
import { DatabaseBackup } from '@/components/DatabaseBackup';
import { DatabaseConnectionStatus } from '@/components/DatabaseConnectionStatus';
import { RDSMigration } from '@/components/RDSMigration';
import { ProvisonLogo } from '@/components/ProvisonLogo';
import { cn } from '@/lib/utils';
import type { User } from '@/types/user';
import { authSecondaryButtonClassName } from '@/components/AuthShell';

type TabType =
  | 'dashboard'
  | 'users'
  | 'create-user'
  | 'set-password'
  | 'clientes'
  | 'create-cliente'
  | 'empresas'
  | 'grupos'
  | 'fornecedores'
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

type RouteDefinition = {
  path: string;
  title: string;
};

const routes: Record<TabType, RouteDefinition> = {
  dashboard: { path: '/', title: 'Dashboard' },
  users: { path: '/cadastros/usuarios', title: 'Usuários' },
  'create-user': { path: '/cadastros/usuarios/novo', title: 'Novo Usuário' },
  'set-password': { path: '/cadastros/usuarios/definir-senha', title: 'Definir Senha' },
  clientes: { path: '/cadastros/clientes', title: 'Clientes' },
  'create-cliente': { path: '/cadastros/clientes/novo', title: 'Novo Cliente' },
  empresas: { path: '/cadastros/empresas', title: 'Empresas' },
  grupos: { path: '/cadastros/grupos', title: 'Grupos' },
  fornecedores: { path: '/cadastros/fornecedores', title: 'Fornecedores' },
  contas: { path: '/cadastros/contas', title: 'Contas' },
  'grupos-contabeis': { path: '/cadastros/grupos-contabeis', title: 'Grupos Contabeis' },
  'subgrupos-contabeis': { path: '/cadastros/subgrupos-contabeis', title: 'Subgrupos Contabeis' },
  projetos: { path: '/projetos', title: 'Projetos' },
  'create-projeto': { path: '/projetos/novo', title: 'Novo Projeto' },
  'contas-pagar': { path: '/financeiro/contas-a-pagar', title: 'Contas a Pagar' },
  'contas-receber': { path: '/financeiro/contas-a-receber', title: 'Contas a Receber' },
  transferencias: { path: '/financeiro/transferencias', title: 'Transferencias' },
  extratos: { path: '/financeiro/extratos', title: 'Extratos' },
  produtos: { path: '/cadastros/produtos-servicos', title: 'Produtos e Servicos' },
  'tipos-documento': { path: '/cadastros/tipos-documento', title: 'Tipos de Documento' },
  parametros: { path: '/cadastros/parametros', title: 'Parametros' },
  'relatorio-cliente': { path: '/relatorios/projeto', title: 'Relatorio por Projeto' },
  'relatorio-extrato-cliente': { path: '/relatorios/extrato-cliente', title: 'Extrato do Cliente' },
  'relatorio-financeiro-saidas': { path: '/relatorios/financeiro-saidas', title: 'Relatorio Financeiro Saidas' },
  'relatorio-financeiro-entradas': { path: '/relatorios/financeiro-entradas', title: 'Relatorio Financeiro Entradas' },
  'relatorio-projetos-geral': { path: '/relatorios/projetos-geral', title: 'Relatorio Projetos Geral' },
  socios: { path: '/matriz/socios', title: 'Socios' },
  matrizes: { path: '/matriz/matrizes', title: 'Matrizes' },
  kanban: { path: '/painel', title: 'Painel' },
  aportes: { path: '/matriz/aportes', title: 'Aportes' },
  retiradas: { path: '/matriz/retiradas', title: 'Retiradas' },
  'estruturas-dre': { path: '/matriz/estrutura-dre', title: 'Estrutura DRE' },
  'create-estrutura-dre': { path: '/matriz/estrutura-dre/editar', title: 'Editar Estrutura DRE' },
  'relatorio-dre': { path: '/matriz/relatorio-dre', title: 'Relatorio DRE' },
  'relatorio-dre-projeto': { path: '/matriz/relatorio-dre-projeto', title: 'Relatorio DRE Projeto' },
  'supabase-migration': { path: '/sistema/supabase-migration', title: 'Migracao Supabase' },
  'rds-migration': { path: '/sistema/rds-migration', title: 'Migracao RDS' },
  'incremental-sync': { path: '/sistema/incremental-sync', title: 'Sincronizacao Incremental' },
  'export-project': { path: '/matriz/exportar-github', title: 'Exportar para GitHub' },
};

const pathToTab = Object.entries(routes).reduce<Record<string, TabType>>((acc, [tab, route]) => {
  acc[route.path] = tab as TabType;
  return acc;
}, {});

const cadastroTabs: TabType[] = [
  'clientes',
  'create-cliente',
  'empresas',
  'grupos',
  'fornecedores',
  'users',
  'create-user',
  'set-password',
  'contas',
  'grupos-contabeis',
  'subgrupos-contabeis',
  'produtos',
  'tipos-documento',
  'parametros',
];

const financeiroTabs: TabType[] = ['contas-pagar', 'contas-receber', 'transferencias', 'extratos'];

const relatorioTabs: TabType[] = [
  'relatorio-cliente',
  'relatorio-extrato-cliente',
  'relatorio-financeiro-saidas',
  'relatorio-financeiro-entradas',
  'relatorio-projetos-geral',
];

const matrizTabs: TabType[] = [
  'socios',
  'matrizes',
  'aportes',
  'retiradas',
  'estruturas-dre',
  'create-estrutura-dre',
  'relatorio-dre',
  'relatorio-dre-projeto',
  'export-project',
];

const Dashboard = lazy(() => import('@/components/Dashboard').then((module) => ({ default: module.Dashboard })));
const UserList = lazy(() => import('@/components/UserList').then((module) => ({ default: module.UserList })));
const UserForm = lazy(() => import('@/components/UserForm').then((module) => ({ default: module.UserForm })));
const SetPasswordForm = lazy(() => import('@/components/SetPasswordForm').then((module) => ({ default: module.SetPasswordForm })));
const ClienteList = lazy(() => import('@/components/ClienteList').then((module) => ({ default: module.ClienteList })));
const ClienteForm = lazy(() => import('@/components/ClienteForm').then((module) => ({ default: module.ClienteForm })));
const EmpresaList = lazy(() => import('@/components/EmpresaList').then((module) => ({ default: module.EmpresaList })));
const GrupoList = lazy(() => import('@/components/GrupoList').then((module) => ({ default: module.GrupoList })));
const FornecedorList = lazy(() => import('@/components/FornecedorList').then((module) => ({ default: module.FornecedorList })));
const ContaList = lazy(() => import('@/components/ContaList').then((module) => ({ default: module.ContaList })));
const GrupoContabilList = lazy(() => import('@/components/GrupoContabilList').then((module) => ({ default: module.GrupoContabilList })));
const SubgrupoContabilList = lazy(() => import('@/components/SubgrupoContabilList').then((module) => ({ default: module.SubgrupoContabilList })));
const ProductList = lazy(() => import('@/components/ProductList').then((module) => ({ default: module.ProductList })));
const TipoDocumentoList = lazy(() => import('@/components/TipoDocumentoList').then((module) => ({ default: module.TipoDocumentoList })));
const ParametrosList = lazy(() => import('@/components/ParametrosList').then((module) => ({ default: module.ParametrosList })));
const ProjetoForm = lazy(() => import('@/components/ProjetoForm').then((module) => ({ default: module.ProjetoForm })));
const ProjetoList = lazy(() => import('@/components/ProjetoList').then((module) => ({ default: module.ProjetoList })));
const ContasPagarList = lazy(() => import('@/components/ContasPagarList').then((module) => ({ default: module.ContasPagarList })));
const ContasReceberList = lazy(() => import('@/components/ContasReceberList').then((module) => ({ default: module.ContasReceberList })));
const TransferenciaList = lazy(() => import('@/components/TransferenciaList').then((module) => ({ default: module.TransferenciaList })));
const ExtratosList = lazy(() => import('@/components/ExtratosList').then((module) => ({ default: module.ExtratosList })));
const RelatorioCliente = lazy(() => import('@/components/RelatorioCliente').then((module) => ({ default: module.RelatorioCliente })));
const RelatorioExtratoCliente = lazy(() => import('@/components/RelatorioExtratoCliente').then((module) => ({ default: module.RelatorioExtratoCliente })));
const RelatorioFinanceiroSaidas = lazy(() => import('@/components/RelatorioFinanceiroSaidas').then((module) => ({ default: module.RelatorioFinanceiroSaidas })));
const RelatorioFinanceiroEntradas = lazy(() => import('@/components/RelatorioFinanceiroEntradas').then((module) => ({ default: module.RelatorioFinanceiroEntradas })));
const RelatorioProjetosGeral = lazy(() => import('@/components/RelatorioProjetosGeral').then((module) => ({ default: module.RelatorioProjetosGeral })));
const SociosList = lazy(() => import('@/components/SociosList').then((module) => ({ default: module.SociosList })));
const MatrizesList = lazy(() => import('@/components/MatrizesList').then((module) => ({ default: module.MatrizesList })));
const Kanban = lazy(() => import('@/components/Kanban').then((module) => ({ default: module.Kanban })));
const AportesList = lazy(() => import('@/components/AportesList').then((module) => ({ default: module.AportesList })));
const RetiradasList = lazy(() => import('@/components/RetiradasList').then((module) => ({ default: module.RetiradasList })));
const EstruturasDreList = lazy(() => import('@/components/EstruturasDreList').then((module) => ({ default: module.EstruturasDreList })));
const EstruturaDreForm = lazy(() => import('@/components/EstruturaDreForm').then((module) => ({ default: module.EstruturaDreForm })));
const RelatorioDre = lazy(() => import('@/components/RelatorioDre').then((module) => ({ default: module.RelatorioDre })));
const RelatorioDreProjeto = lazy(() => import('@/components/RelatorioDreProjeto').then((module) => ({ default: module.RelatorioDreProjeto })));
const FullSupabaseMigration = lazy(() => import('@/components/FullSupabaseMigration').then((module) => ({ default: module.FullSupabaseMigration })));
const IncrementalSync = lazy(() => import('@/components/IncrementalSync').then((module) => ({ default: module.IncrementalSync })));
const ExportProject = lazy(() => import('@/components/ExportProject').then((module) => ({ default: module.ExportProject })));

function LoadingPage() {
  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-8 shadow-sm">
      <div className="space-y-3 animate-pulse">
        <div className="h-6 w-56 rounded bg-slate-200" />
        <div className="h-4 w-full rounded bg-slate-100" />
        <div className="h-4 w-5/6 rounded bg-slate-100" />
      </div>
    </div>
  );
}

function getTabFromLocation() {
  if (typeof window === 'undefined') {
    return 'dashboard' as TabType;
  }

  return pathToTab[window.location.pathname] ?? 'dashboard';
}

function App() {
  const [activeTab, setActiveTab] = useState<TabType>(() => getTabFromLocation());
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [showRegistration, setShowRegistration] = useState(false);
  const [editingEstrutura, setEditingEstrutura] = useState<{ id: number; nome: string } | undefined>(undefined);

  useEffect(() => {
    const syncTabWithLocation = () => {
      setActiveTab(getTabFromLocation());
    };

    syncTabWithLocation();
    window.addEventListener('popstate', syncTabWithLocation);

    return () => window.removeEventListener('popstate', syncTabWithLocation);
  }, []);

  useEffect(() => {
    document.title = `${routes[activeTab].title} | Provison`;
  }, [activeTab]);

  const isCadastroActive = cadastroTabs.includes(activeTab);
  const isFinanceiroActive = financeiroTabs.includes(activeTab);
  const isRelatorioActive = relatorioTabs.includes(activeTab);
  const isMatrizActive = matrizTabs.includes(activeTab);

  const navigateTo = (tab: TabType, options?: { replace?: boolean }) => {
    const targetPath = routes[tab].path;

    if (typeof window !== 'undefined') {
      const currentPath = window.location.pathname;

      if (currentPath !== targetPath) {
        const method = options?.replace ? 'replaceState' : 'pushState';
        window.history[method](window.history.state, '', targetPath);
      }
    }

    setActiveTab(tab);
  };

  const handleLogin = (user: User) => {
    setCurrentUser(user);
    setShowRegistration(false);
  };

  const handleLogout = () => {
    setCurrentUser(null);
    setShowRegistration(false);
    setEditingEstrutura(undefined);
    navigateTo('dashboard', { replace: true });
  };

  const renderContent = () => {
    switch (activeTab) {
      case 'users':
        return <UserList />;
      case 'create-user':
        return (
          <UserForm
            onSuccess={() => navigateTo('users')}
            onCancel={() => navigateTo('users')}
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
            onSuccess={() => navigateTo('clientes')}
            onCancel={() => navigateTo('clientes')}
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
            onSuccess={() => navigateTo('projetos')}
            onCancel={() => navigateTo('projetos')}
          />
        );
      case 'projetos':
        return <ProjetoList onCreateNew={() => navigateTo('create-projeto')} />;
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
      case 'kanban':
        return <Kanban />;
      case 'aportes':
        return <AportesList />;
      case 'retiradas':
        return <RetiradasList />;
      case 'estruturas-dre':
        return (
          <EstruturasDreList
            onCreateNew={() => {
              setEditingEstrutura(undefined);
              navigateTo('create-estrutura-dre');
            }}
            onEdit={(estrutura) => {
              setEditingEstrutura(estrutura);
              navigateTo('create-estrutura-dre');
            }}
          />
        );
      case 'create-estrutura-dre':
        return (
          <EstruturaDreForm
            estrutura={editingEstrutura}
            onSuccess={() => {
              setEditingEstrutura(undefined);
              navigateTo('estruturas-dre');
            }}
            onCancel={() => {
              setEditingEstrutura(undefined);
              navigateTo('estruturas-dre');
            }}
          />
        );
      case 'relatorio-dre':
        return <RelatorioDre />;
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
        return <Dashboard onNavigate={(tab) => navigateTo(tab as TabType)} />;
    }
  };

  const getNavItemClasses = (isActive: boolean) =>
    cn(
      'h-10 rounded-xl border border-transparent bg-transparent px-4 text-sm font-medium text-slate-700 transition-all duration-200 hover:border-slate-200 hover:bg-slate-100 hover:text-slate-950',
      isActive &&
        'border-slate-900 bg-slate-900 text-white shadow-sm hover:border-slate-800 hover:bg-slate-800 hover:text-white',
    );

  const searchParams = typeof window !== 'undefined' ? new URLSearchParams(window.location.search) : null;
  const showStatus = searchParams?.get('status') === 'true';
  const showBackup = searchParams?.get('backup') === 'true';
  const showRDSMigration = searchParams?.get('rds') === 'true';

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

  if (!currentUser) {
    if (showRegistration) {
      return (
        <>
          <div className="relative min-h-screen overflow-hidden bg-[radial-gradient(circle_at_top,#f8fafc_0%,#f3f4f6_45%,#eef2f7_100%)] px-4 py-8 sm:px-6 lg:px-8">
            <div className="pointer-events-none absolute inset-0">
              <div className="absolute left-1/2 top-0 h-[320px] w-[320px] -translate-x-1/2 rounded-full bg-slate-200/40 blur-3xl" />
              <div className="absolute bottom-0 left-0 h-[280px] w-[280px] rounded-full bg-slate-300/20 blur-3xl" />
            </div>
            <div className="relative mx-auto flex min-h-[calc(100vh-4rem)] w-full max-w-2xl items-center justify-center">
              <Suspense fallback={<LoadingPage />}>
                <UserForm
                  onSuccess={() => setShowRegistration(false)}
                  onCancel={() => setShowRegistration(false)}
                />
              </Suspense>
            </div>
          </div>
          <Toaster />
        </>
      );
    }

    return (
      <>
        <div className="relative min-h-screen overflow-hidden bg-[radial-gradient(circle_at_top,#f8fafc_0%,#f3f4f6_45%,#eef2f7_100%)] px-4 py-8 sm:px-6 lg:px-8">
          <div className="pointer-events-none absolute inset-0">
            <div className="absolute left-1/2 top-0 h-[320px] w-[320px] -translate-x-1/2 rounded-full bg-slate-200/40 blur-3xl" />
            <div className="absolute bottom-0 right-0 h-[280px] w-[280px] rounded-full bg-slate-300/20 blur-3xl" />
          </div>

          <div className="relative mx-auto flex min-h-[calc(100vh-4rem)] w-full max-w-5xl items-center justify-center">
            <div className="grid w-full items-center gap-10 lg:grid-cols-[1.05fr_0.95fr]">
              <div className="hidden lg:block">
                <div className="max-w-xl space-y-8">
                  <div className="inline-flex items-center gap-4 rounded-full border border-white/80 bg-white/75 px-5 py-3 shadow-sm backdrop-blur">
                    <div className="rounded-2xl bg-gradient-to-br from-slate-900 via-slate-800 to-slate-700 p-3 shadow-[0_18px_30px_rgba(15,23,42,0.18)]">
                      <ProvisonLogo className="h-10 w-10" />
                    </div>
                    <div>
                      <p className="text-xs font-semibold uppercase tracking-[0.35em] text-slate-400">Provision</p>
                      <p className="text-sm font-medium text-slate-600">Sistema de Gestao</p>
                    </div>
                  </div>

                  <div className="space-y-5">
                    <h2 className="max-w-lg text-5xl font-semibold tracking-[-0.06em] text-slate-950">
                      Gestao premium com uma experiencia mais clara, elegante e eficiente.
                    </h2>
                    <p className="max-w-xl text-lg leading-8 text-slate-600">
                      Acesse o ambiente da Provision com o mesmo padrao visual refinado aplicado nas areas internas do sistema.
                    </p>
                  </div>

                  <div className="grid gap-4 sm:grid-cols-2">
                    <div className="rounded-3xl border border-white/80 bg-white/70 p-5 shadow-sm backdrop-blur">
                      <p className="text-sm font-semibold text-slate-900">Visual corporativo</p>
                      <p className="mt-2 text-sm leading-6 text-slate-600">
                        Interface limpa, hierarquia bem definida e interacoes mais agradaveis.
                      </p>
                    </div>
                    <div className="rounded-3xl border border-white/80 bg-white/70 p-5 shadow-sm backdrop-blur">
                      <p className="text-sm font-semibold text-slate-900">Acesso seguro</p>
                      <p className="mt-2 text-sm leading-6 text-slate-600">
                        Continue usando toda a logica atual de autenticacao com uma apresentacao muito mais sofisticada.
                      </p>
                    </div>
                  </div>
                </div>
              </div>

              <div className="mx-auto w-full max-w-md space-y-5">
                <LoginForm onLogin={handleLogin} />

                <div className="rounded-[24px] border border-white/80 bg-white/80 p-4 shadow-[0_18px_40px_rgba(15,23,42,0.06)] backdrop-blur">
                  <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                    <div className="space-y-1">
                      <p className="text-sm font-semibold text-slate-900">Primeiro acesso?</p>
                      <p className="text-sm leading-6 text-slate-500">
                        Cadastre um novo usuario e comece a usar a plataforma.
                      </p>
                    </div>
                    <div className="sm:min-w-[210px]">
                      <Button
                        variant="outline"
                        onClick={() => setShowRegistration(true)}
                        className={`w-full ${authSecondaryButtonClassName}`}
                      >
                        <UserPlus className="mr-2 h-4 w-4" />
                        Cadastrar Novo Usuário
                      </Button>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
        <Toaster />
      </>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50">
      <div className="container mx-auto p-4">
        <DatabaseConnectionStatus />
      </div>

      <div className="border-b border-slate-200 bg-white/95 shadow-sm backdrop-blur supports-[backdrop-filter]:bg-white/85">
        <div className="container mx-auto px-4">
          <div className="flex h-20 items-center justify-between">
            <div className="flex items-center gap-4">
              <div className="rounded-xl bg-gradient-to-br from-slate-900 to-slate-700 p-2.5 shadow-sm">
                <ProvisonLogo className="w-8 h-8" />
              </div>
              <h1 className="text-2xl font-bold tracking-tight text-slate-900">PROVISON</h1>
            </div>
            <div className="flex items-center gap-5">
              <div className="flex items-center gap-3 rounded-full border border-slate-200 bg-slate-50 px-3 py-1.5">
                <Badge variant="outline" className="border-slate-300 bg-white text-slate-700">
                  {currentUser.role}
                </Badge>
                <span className="text-sm font-medium text-slate-600">{currentUser.name}</span>
              </div>

              <Button
                variant="ghost"
                size="sm"
                onClick={handleLogout}
                className="h-10 rounded-xl border border-slate-200 px-4 text-slate-600 hover:border-slate-300 hover:bg-slate-100 hover:text-slate-900"
              >
                <LogOut className="h-4 w-4 mr-2" />
                Sair
              </Button>
            </div>
          </div>
        </div>
      </div>

      <div className="border-b border-slate-200 bg-white/80 shadow-[0_1px_0_rgba(15,23,42,0.04)] overflow-x-auto">
        <div className="container mx-auto px-4">
          <div className="flex min-w-max items-center gap-2 py-3">
            <Button
              variant="ghost"
              className={getNavItemClasses(activeTab === 'dashboard')}
              onClick={() => navigateTo('dashboard')}
            >
              <BarChart3 className="mr-2 h-4 w-4" />
              Dashboard
            </Button>

            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" className={getNavItemClasses(isCadastroActive)}>
                  <FolderOpen className="mr-2 h-4 w-4" />
                  Cadastros
                  <ChevronDown className="ml-2 h-4 w-4" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="start" className="rounded-xl border-slate-200 bg-white p-1.5 shadow-lg">
                <DropdownMenuItem onClick={() => navigateTo('clientes')}>
                  <UserCheck className="mr-2 h-4 w-4" />
                  Clientes
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => navigateTo('empresas')}>
                  <Building className="mr-2 h-4 w-4" />
                  Empresas
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => navigateTo('grupos')}>
                  <Building2 className="mr-2 h-4 w-4" />
                  Grupos
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => navigateTo('fornecedores')}>
                  <Truck className="mr-2 h-4 w-4" />
                  Fornecedores
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => navigateTo('users')}>
                  <Users className="mr-2 h-4 w-4" />
                  Usuários
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => navigateTo('set-password')}>
                  <UserPlus className="mr-2 h-4 w-4" />
                  Definir Senha
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => navigateTo('contas')}>
                  <CreditCard className="mr-2 h-4 w-4" />
                  Contas
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => navigateTo('grupos-contabeis')}>
                  <Calculator className="mr-2 h-4 w-4" />
                  Grupos Contábeis
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => navigateTo('subgrupos-contabeis')}>
                  <Calculator className="mr-2 h-4 w-4" />
                  Subgrupos Contábeis
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => navigateTo('produtos')}>
                  <Package className="mr-2 h-4 w-4" />
                  Produtos/Serviços
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => navigateTo('tipos-documento')}>
                  <File className="mr-2 h-4 w-4" />
                  Tipos de Documento
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => navigateTo('parametros')}>
                  <Settings className="mr-2 h-4 w-4" />
                  Parâmetros
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>

            <Button
              variant="ghost"
              className={getNavItemClasses(activeTab === 'projetos' || activeTab === 'create-projeto')}
              onClick={() => navigateTo('projetos')}
            >
              <Home className="mr-2 h-4 w-4" />
              Projetos
            </Button>

            <Button
              variant="ghost"
              className={getNavItemClasses(activeTab === 'kanban')}
              onClick={() => navigateTo('kanban')}
            >
              <BarChart3 className="mr-2 h-4 w-4" />
              Painel
            </Button>

            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" className={getNavItemClasses(isFinanceiroActive)}>
                  <Banknote className="mr-2 h-4 w-4" />
                  Financeiro
                  <ChevronDown className="ml-2 h-4 w-4" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="start" className="rounded-xl border-slate-200 bg-white p-1.5 shadow-lg">
                <DropdownMenuItem onClick={() => navigateTo('contas-pagar')}>
                  <Receipt className="mr-2 h-4 w-4" />
                  Cadastro de Contas a Pagar
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => navigateTo('contas-receber')}>
                  <DollarSign className="mr-2 h-4 w-4" />
                  Cadastro de Contas a Receber
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => navigateTo('transferencias')}>
                  <ArrowLeftRight className="mr-2 h-4 w-4" />
                  Transferência
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => navigateTo('extratos')}>
                  <FileText className="mr-2 h-4 w-4" />
                  Extratos
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>

            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" className={getNavItemClasses(isRelatorioActive)}>
                  <PieChart className="mr-2 h-4 w-4" />
                  Relatórios
                  <ChevronDown className="ml-2 h-4 w-4" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="start" className="rounded-xl border-slate-200 bg-white p-1.5 shadow-lg">
                <DropdownMenuItem onClick={() => navigateTo('relatorio-cliente')}>
                  <UserCheck className="mr-2 h-4 w-4" />
                  Relatório por Projeto
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => navigateTo('relatorio-extrato-cliente')}>
                  <FileText className="mr-2 h-4 w-4" />
                  Extrato do Cliente
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => navigateTo('relatorio-financeiro-saidas')}>
                  <Receipt className="mr-2 h-4 w-4" />
                  Relatório Financeiro Saídas
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => navigateTo('relatorio-financeiro-entradas')}>
                  <DollarSign className="mr-2 h-4 w-4" />
                  Relatório Financeiro Entradas
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => navigateTo('relatorio-projetos-geral')}>
                  <BarChart3 className="mr-2 h-4 w-4" />
                  Relatório Projetos Geral
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>

            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" className={getNavItemClasses(isMatrizActive)}>
                  <Building className="mr-2 h-4 w-4" />
                  Matriz
                  <ChevronDown className="ml-2 h-4 w-4" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="start" className="rounded-xl border-slate-200 bg-white p-1.5 shadow-lg">
                <DropdownMenuItem onClick={() => navigateTo('socios')}>
                  <UserIcon className="mr-2 h-4 w-4" />
                  Cadastrar Sócio
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => navigateTo('matrizes')}>
                  <Building className="mr-2 h-4 w-4" />
                  Cadastrar Matriz
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => navigateTo('aportes')}>
                  <DollarSign className="mr-2 h-4 w-4" />
                  Aporte
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => navigateTo('retiradas')}>
                  <DollarSign className="mr-2 h-4 w-4" />
                  Retirada
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => navigateTo('estruturas-dre')}>
                  <FileText className="mr-2 h-4 w-4" />
                  Estrutura DRE
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => navigateTo('relatorio-dre')}>
                  <PieChart className="mr-2 h-4 w-4" />
                  Relatório DRE
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => navigateTo('export-project')}>
                  <Github className="mr-2 h-4 w-4" />
                  Exportar para GitHub
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>
      </div>

      <div className="container mx-auto px-4 py-8">
        <Suspense fallback={<LoadingPage />}>{renderContent()}</Suspense>
      </div>

      <Toaster />
    </div>
  );
}

export default App;
