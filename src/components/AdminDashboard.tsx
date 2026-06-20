import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { LogOut } from 'lucide-react';
import PatientList from './patients/PatientList';
import PatientForm from './patients/PatientForm';
import { toast } from 'sonner';
import { AppUser } from '../App';

export default function AdminDashboard({ user, onLogout }: { user: AppUser, onLogout: () => void }) {
  const [activeTab, setActiveTab] = useState('patients');

  const handleLogout = () => {
    onLogout();
    toast.success('Logged out');
  };

  return (
    <div className="flex flex-col min-h-screen bg-editorial-bg text-editorial-text">
      {/* Navbar */}
      <nav className="flex items-center justify-between px-8 py-4 border-b border-editorial-border bg-editorial-bg sticky top-0 z-10">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 bg-editorial-text flex items-center justify-center rounded-sm">
            <div className="w-4 h-4 border-2 border-white rotate-45"></div>
          </div>
          <span className="font-serif italic text-xl tracking-tight font-bold">VisionClinic AI</span>
        </div>
        
        <div className="flex items-center gap-6 text-[11px] font-bold uppercase tracking-widest">
          <button 
            onClick={() => setActiveTab('patients')} 
            className={`transition-all border-b-4 py-1 hover:text-editorial-text cursor-pointer ${activeTab === 'patients' ? 'border-editorial-text text-editorial-text' : 'border-transparent text-editorial-muted'}`}
          >
            Ledger
          </button>
          <button 
            onClick={() => setActiveTab('add-patient')} 
            className={`transition-all border-b-4 py-1 hover:text-editorial-text cursor-pointer ${activeTab === 'add-patient' ? 'border-editorial-text text-editorial-text' : 'border-transparent text-editorial-muted'}`}
          >
            Enrollment
          </button>
          <button 
            onClick={() => setActiveTab('settings')} 
            className={`transition-all border-b-4 py-1 hover:text-editorial-text cursor-pointer ${activeTab === 'settings' ? 'border-editorial-text text-editorial-text' : 'border-transparent text-editorial-muted'}`}
          >
            Logistics
          </button>
          <div className="h-4 w-[1px] bg-editorial-border ml-2"></div>
          <div className="flex items-center gap-3 pl-2">
            <div className="text-right hidden md:block">
              <span className="text-[10px] text-editorial-muted block leading-none mb-1">Authenticated</span>
              <span className="text-[11px] font-bold block leading-none">{user.email?.split('@')[0]}</span>
            </div>
            <Button variant="ghost" size="icon" onClick={handleLogout} className="text-editorial-muted hover:text-red-600 h-8 w-8">
              <LogOut size={16} />
            </Button>
          </div>
        </div>
      </nav>

      <main className="flex-1 flex overflow-hidden">
        {/* Main Content Area */}
        <div className="flex-1 overflow-y-auto bg-editorial-bg">
          <div className="container mx-auto px-10 py-10 max-w-6xl">
            {activeTab === 'patients' && (
              <div className="animate-in fade-in slide-in-from-bottom-2 duration-500">
                <PatientList onSelectPatient={(p) => console.log('Selected', p)} />
              </div>
            )}

            {activeTab === 'add-patient' && (
              <div className="animate-in fade-in slide-in-from-bottom-2 duration-500 max-w-2xl mx-auto">
                <div className="mb-10 flex items-end justify-between border-b-2 border-editorial-text pb-6">
                  <div>
                    <h1 className="font-serif text-5xl tracking-tighter italic text-editorial-text">Enrollment</h1>
                    <p className="text-secondary-foreground text-xs uppercase tracking-widest font-bold mt-1">Diagnostic Registry Intake</p>
                  </div>
                  <Button 
                    variant="ghost" 
                    onClick={() => setActiveTab('patients')}
                    className="text-[10px] uppercase font-bold tracking-widest border border-editorial-border rounded-none h-10 hover:bg-editorial-text hover:text-white cursor-pointer"
                  >
                    <LogOut size={14} className="mr-1 rotate-180" /> View All
                  </Button>
                </div>
                <PatientForm onSuccess={() => setActiveTab('patients')} onCancel={() => setActiveTab('patients')} />
              </div>
            )}

            {activeTab === 'settings' && (
              <div className="animate-in fade-in slide-in-from-bottom-2 duration-500 max-w-2xl mx-auto">
                <div className="mb-10">
                  <h1 className="font-serif text-5xl tracking-tighter mb-2 italic text-editorial-text">System</h1>
                  <p className="text-secondary-foreground text-sm uppercase tracking-widest font-bold">Clinic Configuration & Logistics</p>
                </div>
                <div className="bg-white border-2 border-editorial-text shadow-[10px_10px_0px_#1A1A1A] p-8 space-y-8">
                  <h2 className="font-serif text-3xl italic border-b border-editorial-border pb-4">Status & Protocols</h2>
                  <div className="space-y-6">
                    <div className="flex justify-between items-center border-b border-editorial-border pb-4">
                      <span className="text-[10px] uppercase tracking-widest font-bold text-editorial-muted">AI Diagnostic Core</span>
                      <span className="font-mono text-xs font-bold bg-editorial-sidebar px-3 py-1 border border-editorial-border">Gemini-1.5-Flash-002</span>
                    </div>
                    <div className="flex justify-between items-center border-b border-editorial-border pb-4">
                      <span className="text-[10px] uppercase tracking-widest font-bold text-editorial-muted">Vault Persistence</span>
                      <span className="font-mono text-xs font-bold bg-editorial-sidebar px-3 py-1 border border-editorial-border">Supabase DB & Storage</span>
                    </div>
                    <div className="flex justify-between items-center border-b border-editorial-border pb-4">
                      <span className="text-[10px] uppercase tracking-widest font-bold text-editorial-muted">Messaging Gateway</span>
                      <span className="font-mono text-xs font-bold bg-green-50 text-green-700 px-3 py-1 border border-green-200">WhatsApp (Twilio Production Active)</span>
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="text-[10px] uppercase tracking-widest font-bold text-editorial-muted">Email Transporter</span>
                      <span className="font-mono text-xs font-bold bg-blue-50 text-blue-700 px-3 py-1 border border-blue-200">Nodemailer SMTP (Gmail Active)</span>
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      </main>

      {/* Footer */}
      <footer className="px-8 py-3 bg-editorial-text text-white flex justify-between items-center text-[9px] uppercase tracking-[0.3em]">
        <div>Session Status: Operational</div>
        <div className="flex gap-6">
          <span className="hidden sm:inline">Supabase Secure</span>
          <span className="hidden sm:inline">AI Analysis Active</span>
          <span>&copy; 2026 VisionClinic</span>
        </div>
      </footer>
    </div>
  );
}
