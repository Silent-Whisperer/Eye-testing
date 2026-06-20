import * as React from 'react';
import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Eye, EyeOff } from 'lucide-react';
import { toast } from 'sonner';

interface AuthPageProps {
  onLogin: (user: { email: string }) => void;
}

export default function AuthPage({ onLogin }: AuthPageProps) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    
    try {
      const response = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username: email, password })
      });
      const data = await response.json();
      if (response.ok && data.success) {
        toast.success('Admin authorization granted');
        onLogin({ email: email });
      } else {
        toast.error(data.error || 'Invalid clinical credentials');
      }
    } catch (err: any) {
      toast.error('Clinical authentication request failed');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-editorial-bg flex flex-col md:flex-row font-sans text-editorial-text selection:bg-editorial-text selection:text-white">
      {/* Visual Side */}
      <div className="md:w-1/2 relative bg-[#1A1A1A] overflow-hidden flex flex-col p-12 justify-between min-h-[400px]">
        <div className="relative z-10">
          <div className="flex items-center gap-3 mb-12">
            <div className="w-10 h-10 border-2 border-white flex items-center justify-center p-1">
              <div className="w-full h-full border-2 border-white rotate-45"></div>
            </div>
            <span className="font-serif italic text-2xl text-white font-bold tracking-tighter">VisionClinic AI</span>
          </div>
          
          <h1 className="text-6xl lg:text-8xl font-serif text-white italic tracking-tighter leading-none mb-8 animate-in fade-in slide-in-from-left-8 duration-1000">
            Precision<br/>Ophthalmology
          </h1>
          <p className="text-white/60 text-sm uppercase tracking-[0.3em] font-medium max-w-sm leading-relaxed animate-in fade-in slide-in-from-left-8 duration-1000 delay-200">
            Automated ETDRS scoring and diagnostic report generation powered by clinical-grade AI.
          </p>
        </div>

        <div className="relative z-10 space-y-6">
          <div className="flex gap-10">
            <div>
              <div className="text-[10px] uppercase tracking-[0.2em] text-white/40 mb-1">Analysis Core</div>
              <div className="text-xs text-white font-bold uppercase">Gemini-1.5-Flash Infrastructure</div>
            </div>
            <div>
              <div className="text-[10px] uppercase tracking-[0.2em] text-white/40 mb-1">Secure Layer</div>
              <div className="text-xs text-white font-bold uppercase">Biometric Authenticated</div>
            </div>
          </div>
          <div className="h-[1px] w-full bg-white/10"></div>
          <div className="flex justify-between items-center text-[9px] uppercase tracking-[0.4em] text-white/30">
            <span>&copy; 2026 Registry Systems</span>
            <span>OPHTHAL-V3_STABLE</span>
          </div>
        </div>

        {/* Decorative elements */}
        <div className="absolute top-1/2 right-0 -translate-y-1/2 w-96 h-96 border border-white/5 rounded-full -mr-48"></div>
        <div className="absolute bottom-0 left-0 w-64 h-64 border border-white/5 rounded-full -ml-32 -mb-32"></div>
      </div>

      {/* Logic Side */}
      <div className="md:w-1/2 flex items-center justify-center p-8 bg-editorial-bg">
        <div className="max-w-md w-full animate-in fade-in slide-in-from-right-8 duration-700">
          <div className="mb-12">
            <h2 className="font-serif text-4xl italic mb-3">Staff Authorization</h2>
            <p className="text-editorial-muted text-xs uppercase tracking-widest">Access the clinical diagnostic portal</p>
          </div>

          <div className="bg-white border border-editorial-text shadow-[12px_12px_0px_#1A1A1A] p-10 space-y-8">
            <div className="flex border-b border-editorial-border">
              <div className="flex-1 py-4 text-[10px] uppercase tracking-widest font-bold text-editorial-text border-b-2 border-editorial-text text-center">
                Administrator Access
              </div>
            </div>

            <form onSubmit={handleSubmit} className="space-y-6">
              <div className="space-y-2">
                <Label className="text-[10px] uppercase tracking-[0.2em] font-bold text-editorial-muted" htmlFor="email">Admin ID</Label>
                <Input 
                  id="email" 
                  type="text" 
                  placeholder="USERNAME" 
                  required 
                  className="rounded-none border-editorial-border h-12 focus-visible:ring-editorial-text font-bold text-xs uppercase"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label className="text-[10px] uppercase tracking-[0.2em] font-bold text-editorial-muted" htmlFor="password">Security Key</Label>
                <div className="relative">
                  <Input 
                    id="password" 
                    type={showPassword ? "text" : "password"} 
                    required 
                    className="rounded-none border-editorial-border h-12 focus-visible:ring-editorial-text"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                  />
                  <button
                    type="button"
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-editorial-muted hover:text-editorial-text"
                    onClick={() => setShowPassword(!showPassword)}
                  >
                    {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                  </button>
                </div>
              </div>
              
              <Button className="w-full h-12 bg-editorial-text text-white hover:bg-editorial-text/90 rounded-none text-xs uppercase tracking-[0.2em] font-bold transition-all mt-4" type="submit" disabled={loading}>
                {loading ? 'Verifying Credentials...' : 'Authenticate Admin'}
              </Button>
            </form>

            <div className="pt-4 text-center">
              <p className="text-[9px] text-editorial-muted uppercase tracking-[0.3em]">
                Secure single sign-on enabled • AES-256
              </p>
            </div>
          </div>
          
          <div className="mt-12 flex items-center gap-6 justify-center grayscale opacity-10">
             <div className="w-8 h-8 rounded-full border-2 border-editorial-text"></div>
             <div className="w-8 h-8 rounded-full border-2 border-editorial-text"></div>
             <div className="w-8 h-8 rounded-full border-2 border-editorial-text"></div>
          </div>
        </div>
      </div>
    </div>
  );
}
