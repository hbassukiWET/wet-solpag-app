import { Shield, LogOut } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { UserProfile } from "@/types/payment";

interface HeaderProps {
  user: UserProfile;
  onLogout: () => void;
  activeTab: 'form' | 'admin' | 'kpis';
  onTabChange: (tab: 'form' | 'admin' | 'kpis') => void;
}

const Header = ({ user, onLogout, activeTab, onTabChange }: HeaderProps) => {
  return (
    <header className="border-b border-border bg-card/80 backdrop-blur-sm sticky top-0 z-50">
      <div className="max-w-5xl mx-auto px-4 sm:px-6 py-3 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-primary flex items-center justify-center">
            <Shield className="w-5 h-5 text-primary-foreground" />
          </div>
          <div>
            <h1 className="text-sm font-heading font-bold leading-tight">Solicitud de Pago</h1>
            <p className="text-xs text-muted-foreground">Grupo Wilbur Eagle</p>
          </div>
        </div>

        <nav className="hidden sm:flex items-center gap-1 bg-muted rounded-lg p-1">
          <button
            onClick={() => onTabChange('form')}
            className={`px-4 py-1.5 rounded-md text-sm font-medium transition-colors ${
              activeTab === 'form'
                ? 'bg-card text-foreground shadow-sm'
                : 'text-muted-foreground hover:text-foreground'
            }`}
          >
            Nueva Solicitud
          </button>
          <button
            onClick={() => onTabChange('admin')}
            className={`px-4 py-1.5 rounded-md text-sm font-medium transition-colors ${
              activeTab === 'admin'
                ? 'bg-card text-foreground shadow-sm'
                : 'text-muted-foreground hover:text-foreground'
            }`}
          >
            Administración
          </button>
          <button
            onClick={() => onTabChange('kpis')}
            className={`px-4 py-1.5 rounded-md text-sm font-medium transition-colors ${
              activeTab === 'kpis'
                ? 'bg-card text-foreground shadow-sm'
                : 'text-muted-foreground hover:text-foreground'
            }`}
          >
            KPIs de Pagos
          </button>
        </nav>

        <div className="flex items-center gap-3">
          <div className="hidden sm:flex flex-col text-right leading-tight">
            <span className="text-xs font-medium">{user.name}</span>
            <span className="text-[10px] text-muted-foreground">{user.email}</span>
          </div>
          <Button variant="ghost" size="sm" onClick={onLogout} className="gap-2">
            <LogOut className="w-4 h-4" />
            <span className="hidden sm:inline">Salir</span>
          </Button>
        </div>
      </div>

      {/* Mobile tabs */}
      <div className="sm:hidden flex border-t border-border">
        <button
          onClick={() => onTabChange('form')}
          className={`flex-1 py-2.5 text-sm font-medium text-center transition-colors ${
            activeTab === 'form'
              ? 'text-primary border-b-2 border-primary'
              : 'text-muted-foreground'
          }`}
        >
          Nueva Solicitud
        </button>
        <button
          onClick={() => onTabChange('admin')}
          className={`flex-1 py-2.5 text-sm font-medium text-center transition-colors ${
            activeTab === 'admin'
              ? 'text-primary border-b-2 border-primary'
              : 'text-muted-foreground'
          }`}
        >
          Administración
        </button>
        <button
          onClick={() => onTabChange('kpis')}
          className={`flex-1 py-2.5 text-sm font-medium text-center transition-colors ${
            activeTab === 'kpis'
              ? 'text-primary border-b-2 border-primary'
              : 'text-muted-foreground'
          }`}
        >
          KPIs
        </button>
      </div>
    </header>
  );
};

export default Header;
