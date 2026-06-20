import { useState, useEffect } from 'react';
import { supabase } from '../../lib/supabase';
import { Patient, Report } from '../../types';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { FileText, Download, Send, Clock, CheckCircle, XCircle, AlertCircle, History, MessageSquare, Mail } from 'lucide-react';
import { format } from 'date-fns';
import { Badge } from '@/components/ui/badge';
import { toast } from 'sonner';

export default function ReportHistory({ patient }: { patient: Patient }) {
  const [reports, setReports] = useState<Report[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;

    async function fetchReports() {
      try {
        const { data, error } = await supabase
          .from('reports')
          .select('*')
          .eq('patientId', patient.id)
          .order('createdAt', { ascending: false });

        if (error) throw error;
        if (active) {
          const formattedReports = (data || []).map(r => ({
            ...r,
            examDate: r.examDate ? new Date(r.examDate).getTime() : Date.now(),
            createdAt: r.createdAt ? new Date(r.createdAt).getTime() : Date.now(),
          }));
          setReports(formattedReports as Report[]);
          setLoading(false);
        }
      } catch (err) {
        console.error('Error fetching reports:', err);
        if (active) setLoading(false);
      }
    }

    fetchReports();

    const channel = supabase
      .channel(`reports-changes-${patient.id}`)
      .on('postgres_changes', { 
        event: '*', 
        schema: 'public', 
        table: 'reports', 
        filter: `patientId=eq.${patient.id}` 
      }, () => {
        fetchReports();
      })
      .subscribe();

    return () => {
      active = false;
      supabase.removeChannel(channel);
    };
  }, [patient.id]);

  if (loading) {
    return (
      <div className="space-y-4">
        {Array.from({ length: 2 }).map((_, i) => (
          <div key={i} className="h-32 bg-editorial-sidebar animate-pulse border border-editorial-border" />
        ))}
      </div>
    );
  }

  if (reports.length === 0) {
    return (
      <div className="py-20 text-center border-2 border-dashed border-editorial-border bg-editorial-bg">
        <FileText className="w-12 h-12 text-editorial-border mx-auto mb-4" />
        <p className="font-serif italic text-xl text-editorial-muted">The archive is currently empty for this patient.</p>
        <p className="text-[10px] uppercase tracking-widest text-editorial-muted mt-2">Initialize diagnostic to populate records</p>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      <div className="flex justify-between items-end border-b border-editorial-border pb-4">
        <h2 className="font-serif text-3xl italic">Examination Archive</h2>
        <span className="text-[10px] font-mono text-editorial-muted uppercase tracking-widest">{reports.length} Verified Records</span>
      </div>
      
      {reports.map((report) => (
        <div key={report.id} className="group bg-white border border-editorial-border hover:border-editorial-text transition-all p-6 shadow-[4px_4px_0px_rgba(26,26,26,0.02)] hover:shadow-[6px_6px_0px_rgba(26,26,26,0.05)]">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
            <div className="flex items-start gap-4">
              <div className="w-12 h-12 bg-editorial-sidebar border border-editorial-border flex items-center justify-center text-editorial-text group-hover:bg-editorial-text group-hover:text-white transition-colors">
                <FileText size={20} />
              </div>
              <div>
                <div className="flex items-center gap-2 mb-1">
                  <h3 className="font-bold text-sm uppercase tracking-tight">
                    {report.testType === 'acuity' && 'Visual Acuity Report'}
                    {report.testType === 'contrast' && 'Contrast Sensitivity Report'}
                    {report.testType === 'field' && 'Visual Field Report'}
                    {report.testType === 'other' && 'Clinical VR Diagnostic'}
                    {!report.testType && 'Diagnostic Report'}
                  </h3>
                  <WhatsappStatusBadge status={report.whatsappStatus} />
                </div>
                <p className="text-[10px] text-editorial-muted font-mono uppercase tracking-wider">
                  {format(report.examDate, 'MMM d, yyyy')} • {format(report.createdAt, 'HH:mm:ss')}
                </p>
              </div>
            </div>
            
              <div className="flex items-center gap-4">
                {report.pdfUrl ? (
                  <Button asChild size="sm" variant="outline" className="rounded-none border-editorial-border text-[10px] uppercase tracking-widest font-bold h-9 px-4 hover:border-editorial-text">
                    <a href={report.pdfUrl} target="_blank" rel="noopener noreferrer">
                      <Download size={14} className="mr-2" /> Download
                    </a>
                  </Button>
                ) : (
                  <div className="text-[10px] font-mono text-amber-600 animate-pulse uppercase">Encrypting PDF...</div>
                )}
                
                {/* Free Client-Side Share */}
                {report.pdfUrl && (
                  <Button 
                    variant="outline" 
                    size="sm" 
                    className="rounded-none border-emerald-600 text-emerald-700 hover:bg-emerald-600 hover:text-white text-[10px] uppercase tracking-widest font-bold h-9 px-4 transition-all"
                    onClick={() => {
                      const text = encodeURIComponent(`Hello ${patient.fullName}, your Vision Clinic report is ready: ${report.pdfUrl}`);
                      window.open(`https://wa.me/${patient.whatsappNumber.replace(/\+/g, '')}?text=${text}`, '_blank');
                    }}
                  >
                    <MessageSquare size={14} className="mr-2" /> Free Share
                  </Button>
                )}

                {report.pdfUrl && (
                  <Button 
                    variant="outline" 
                    size="sm" 
                    className="rounded-none border-blue-600 text-blue-700 hover:bg-blue-600 hover:text-white text-[10px] uppercase tracking-widest font-bold h-9 px-4 transition-all"
                    onClick={async () => {
                      try {
                        toast.info("Fetching report PDF for email dispatch...");
                        const pdfRes = await fetch(report.pdfUrl!);
                        const blob = await pdfRes.blob();
                        const reader = new FileReader();
                        reader.readAsDataURL(blob);
                        reader.onloadend = async () => {
                          const base64data = (reader.result as string).split(',')[1];
                          const emailRes = await fetch('/api/email/send-results', {
                            method: 'POST',
                            headers: { 'Content-Type': 'application/json' },
                            body: JSON.stringify({
                              patient,
                              pdfBase64: base64data,
                              testType: report.testType
                            })
                          });
                          if (emailRes.ok) {
                            toast.success("Diagnostic report emailed to patient");
                          } else {
                            toast.error("Failed to send report email");
                          }
                        };
                      } catch (err) {
                        console.error(err);
                        toast.error("Failed to dispatch email");
                      }
                    }}
                  >
                    <Mail size={14} className="mr-2" /> Email Results
                  </Button>
                )}

                <Button size="sm" className="rounded-none border-editorial-border text-[10px] uppercase tracking-widest font-bold h-9 px-4 hover:bg-editorial-text hover:text-white transition-colors" onClick={() => handleResend(report, patient)}>
                  <Send size={14} className="mr-2" /> Auto-Send
                </Button>
              </div>
          </div>
          
          <div className="mt-6 pt-4 border-t border-editorial-border grid grid-cols-1 md:grid-cols-2 gap-8">
            <div className="space-y-2">
              <p className="text-[9px] uppercase tracking-[0.2em] text-editorial-muted font-bold">Right Eye Analysis (OD)</p>
              <div className="flex items-baseline gap-4">
                <div className="flex flex-col">
                  <span className="text-[10px] text-editorial-muted uppercase tracking-wider">Acuity</span>
                  <span className="font-serif italic text-lg">{report.extractedData.rightEye?.visualAcuity || '---'}</span>
                </div>
                <div className="flex flex-col border-l border-editorial-border pl-4">
                  <span className="text-[10px] text-editorial-muted uppercase tracking-wider">Score</span>
                  <span className="font-mono text-sm font-bold">{report.extractedData.rightEye?.etdrsScore || '---'}</span>
                </div>
              </div>
            </div>
            <div className="space-y-2">
              <p className="text-[9px] uppercase tracking-[0.2em] text-editorial-muted font-bold">Left Eye Analysis (OS)</p>
              <div className="flex items-baseline gap-4">
                <div className="flex flex-col">
                  <span className="text-[10px] text-editorial-muted uppercase tracking-wider">Acuity</span>
                  <span className="font-serif italic text-lg">{report.extractedData.leftEye?.visualAcuity || '---'}</span>
                </div>
                <div className="flex flex-col border-l border-editorial-border pl-4">
                  <span className="text-[10px] text-editorial-muted uppercase tracking-wider">Score</span>
                  <span className="font-mono text-sm font-bold">{report.extractedData.leftEye?.etdrsScore || '---'}</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}

async function handleResend(report: Report, patient: Patient) {
  if (!report.pdfUrl) return;
  try {
    const res = await fetch('/api/send-whatsapp', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        to: patient.whatsappNumber,
        pdfUrl: report.pdfUrl,
        patientName: patient.fullName
      })
    });
    if (res.ok) toast.success('Report resent successfully');
  } catch (e) {
    toast.error('Failed to resend report');
  }
}

function WhatsappStatusBadge({ status }: { status: Report['whatsappStatus'] }) {
  switch (status) {
    case 'sent':
      return <span className="text-[8px] uppercase tracking-widest font-bold bg-green-50 text-green-700 px-2 py-0.5 border border-green-200">Delivered</span>;
    case 'failed':
      return <span className="text-[8px] uppercase tracking-widest font-bold bg-red-50 text-red-700 px-2 py-0.5 border border-red-200">Incomplete</span>;
    case 'pending':
      return <span className="text-[8px] uppercase tracking-widest font-bold bg-amber-50 text-amber-700 px-2 py-0.5 border border-amber-200">Pending</span>;
    default:
      return null;
  }
}
