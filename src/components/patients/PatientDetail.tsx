import { useState } from 'react';
import { Patient } from '../../types';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { ArrowLeft, User, Phone, MessageSquare, Calendar, Stethoscope, PlusCircle, History } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import ReportUploadZone from '../reports/ReportUploadZone';
import ReportHistory from '../reports/ReportHistory';

interface PatientDetailProps {
  patient: Patient;
  onBack: () => void;
}

export default function PatientDetail({ patient, onBack }: PatientDetailProps) {
  const [showNewExam, setShowNewExam] = useState(false);

  return (
    <div className="space-y-10">
      <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-6 border-b border-editorial-border pb-8">
        <div>
          <button 
            onClick={onBack}
            className="text-[10px] uppercase tracking-widest font-bold text-editorial-text hover:translate-x-[-4px] transition-transform flex items-center gap-2 mb-4"
          >
            <ArrowLeft size={12} />
            Return to Registry
          </button>
          <h1 className="font-serif text-5xl tracking-tighter italic text-editorial-text">{patient.fullName}</h1>
          <p className="text-secondary-foreground text-xs uppercase tracking-[0.3em] mt-2 font-bold bg-editorial-text text-white inline-block px-3 py-1">{patient.patientId}</p>
        </div>
        <div className="flex gap-4">
          <Button 
            onClick={() => setShowNewExam(!showNewExam)} 
            variant="outline" 
            className="rounded-none border-2 border-editorial-text text-editorial-text hover:bg-editorial-text hover:text-white uppercase text-[10px] tracking-widest font-bold px-8 h-14 transition-all shadow-[8px_8px_0px_#000]"
          >
            {showNewExam ? "Session History" : "New Diagnostic Intake"}
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-4 gap-10">
        {/* Patient Sidebar */}
        <div className="lg:col-span-1 space-y-8">
          <section className="space-y-4">
            <h3 className="text-[10px] uppercase tracking-[0.3em] font-bold text-editorial-text border-b border-editorial-text pb-2">Patient Profile</h3>
            <div className="space-y-4">
              <div className="flex justify-between items-baseline">
                <span className="text-[11px] uppercase tracking-widest font-bold text-editorial-muted">Age</span>
                <span className="font-serif italic text-lg text-editorial-text">{patient.age}</span>
              </div>
              <div className="flex justify-between items-baseline border-t border-editorial-border pt-4">
                <span className="text-[11px] uppercase tracking-widest font-bold text-editorial-muted">Gender</span>
                <span className="font-serif italic text-lg capitalize text-editorial-text">{patient.gender}</span>
              </div>
              <div className="flex justify-between items-baseline border-t border-editorial-border pt-4">
                <span className="text-[11px] uppercase tracking-widest font-bold text-editorial-muted">Clinician</span>
                <span className="font-serif italic text-lg uppercase text-editorial-text">Dr. {patient.doctorName.split(' ').pop()}</span>
              </div>
            </div>
          </section>

          <section className="space-y-4">
            <h3 className="text-[10px] uppercase tracking-[0.3em] font-bold text-editorial-text border-b border-editorial-text pb-2">Communications</h3>
            <div className="p-4 bg-editorial-sidebar border-2 border-editorial-text space-y-4">
              <div className="flex items-center gap-3 text-xs">
                <div className="w-6 h-6 border border-editorial-text flex items-center justify-center">
                  <Phone size={12} className="text-editorial-text" />
                </div>
                <span className="font-bold text-editorial-text">{patient.phoneNumber}</span>
              </div>
              <div className="flex items-center gap-3 text-xs">
                <div className="w-6 h-6 border border-green-600 flex items-center justify-center">
                  <MessageSquare size={12} className="text-green-600" />
                </div>
                <span className="font-bold text-green-700">{patient.whatsappNumber}</span>
              </div>
            </div>
          </section>
          
          {patient.notes && (
            <section className="space-y-4">
              <h3 className="text-[10px] uppercase tracking-[0.3em] font-bold text-editorial-text border-b border-editorial-text pb-2">Clinical Context</h3>
              <p className="text-sm font-serif italic text-editorial-text leading-relaxed bg-editorial-sidebar p-4 border border-editorial-border">
                "{patient.notes}"
              </p>
            </section>
          )}
        </div>

        {/* Main Area */}
        <div className="lg:col-span-3">
          {showNewExam ? (
            <div className="animate-in fade-in zoom-in-95 duration-500">
              <ReportUploadZone patient={patient} onComplete={() => setShowNewExam(false)} />
            </div>
          ) : (
            <div className="animate-in fade-in slide-in-from-right-4 duration-500">
              <ReportHistory patient={patient} />
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
