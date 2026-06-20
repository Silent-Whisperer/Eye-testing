import { useState } from 'react';
import { Patient, EyeFile, ExtractedData } from '../../types';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { storage, db, handleFirestoreError, OperationType } from '../../lib/firebase';
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import { collection, addDoc, updateDoc, doc } from 'firebase/firestore';
import { Upload, File, X, BrainCircuit, FileType, CheckCircle2, AlertCircle, Loader2 } from 'lucide-react';
import { toast } from 'sonner';

interface ReportUploadZoneProps {
  patient: Patient;
  onComplete: () => void;
}

const fileToBase64 = (file: File): Promise<string> => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.readAsDataURL(file);
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = error => reject(error);
  });
};

export default function ReportUploadZone({ patient, onComplete }: ReportUploadZoneProps) {
  const [rightEyeFiles, setRightEyeFiles] = useState<File[]>([]);
  const [leftEyeFiles, setLeftEyeFiles] = useState<File[]>([]);
  const [testType, setTestType] = useState<'acuity' | 'contrast' | 'field' | 'other'>('acuity');
  const [status, setStatus] = useState<'idle' | 'uploading' | 'analyzing' | 'generating_pdf' | 'completed'>('idle');
  const [progress, setProgress] = useState(0);

  const handleFileChange = (eye: 'right' | 'left', files: FileList | null) => {
    if (!files) return;
    const newFiles = Array.from(files);
    if (eye === 'right') {
      setRightEyeFiles(prev => [...prev, ...newFiles]);
    } else {
      setLeftEyeFiles(prev => [...prev, ...newFiles]);
    }
  };

  const removeFile = (eye: 'right' | 'left', index: number) => {
    if (eye === 'right') {
      setRightEyeFiles(prev => prev.filter((_, i) => i !== index));
    } else {
      setLeftEyeFiles(prev => prev.filter((_, i) => i !== index));
    }
  };

  const processReport = async () => {
    if (rightEyeFiles.length === 0 && leftEyeFiles.length === 0) {
      toast.error('Please upload at least one file');
      return;
    }

    setStatus('uploading');
    try {
      // 1. Upload files to Firebase Storage
      const uploadResults: { right: EyeFile[], left: EyeFile[] } = { right: [], left: [] };

      const uploadEyeFiles = async (files: File[], eye: 'right' | 'left') => {
        const results: EyeFile[] = [];
        for (const file of files) {
          const fileRef = ref(storage, `exams/${patient.id}/${Date.now()}_${eye}_${file.name}`);
          await uploadBytes(fileRef, file);
          const url = await getDownloadURL(fileRef);
          results.push({
            url,
            name: file.name,
            type: file.type,
            size: file.size,
            createdAt: Date.now()
          });
        }
        return results;
      };

      try {
        uploadResults.right = await uploadEyeFiles(rightEyeFiles, 'right');
        uploadResults.left = await uploadEyeFiles(leftEyeFiles, 'left');
      } catch (err) {
        toast.error('Storage upload failed: Check your connection');
        throw err;
      }

      // 2. Analyze with Gemini
      setStatus('analyzing');
      const rightFilesWithContent = await Promise.all(
        rightEyeFiles.map(async (file, idx) => {
          const content = await fileToBase64(file);
          return { ...uploadResults.right[idx], content, eye: 'right' };
        })
      );
      const leftFilesWithContent = await Promise.all(
        leftEyeFiles.map(async (file, idx) => {
          const content = await fileToBase64(file);
          return { ...uploadResults.left[idx], content, eye: 'left' };
        })
      );

      const analysisResponse = await fetch('/api/analyze', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          patientInfo: patient,
          files: [...rightFilesWithContent, ...leftFilesWithContent]
        })
      });
      
      const { data: extractedData } = await analysisResponse.json();

      // 3. Save initial report to Firestore
      let reportRef;
      try {
        reportRef = await addDoc(collection(db, 'reports'), {
          patientId: patient.id,
          testType,
          examDate: Date.now(),
          rightEyeFiles: uploadResults.right,
          leftEyeFiles: uploadResults.left,
          extractedData,
          whatsappStatus: 'pending',
          createdAt: Date.now()
        });
      } catch (err) {
        handleFirestoreError(err, OperationType.CREATE, 'reports');
        return;
      }

      // 4. Generate PDF
      setStatus('generating_pdf');
      const pdfResponse = await fetch('/api/generate-pdf', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ report: { id: reportRef!.id, extractedData }, patient })
      });
      
      const { pdfBase64 } = await pdfResponse.json();
      
      // Upload PDF to Storage
      let pdfUrl;
      try {
        const pdfBlob = await (await fetch(`data:application/pdf;base64,${pdfBase64}`)).blob();
        const pdfRef = ref(storage, `reports/${patient.id}/${reportRef!.id}.pdf`);
        await uploadBytes(pdfRef, pdfBlob);
        pdfUrl = await getDownloadURL(pdfRef);
      } catch (err) {
        toast.error('PDF storage failed');
        throw err;
      }

      // Update Firestore with PDF URL
      try {
        await updateDoc(reportRef!, { pdfUrl });
      } catch (err) {
        handleFirestoreError(err, OperationType.UPDATE, `reports/${reportRef!.id}`);
      }

      // 5. Send WhatsApp (if configured)
      try {
        const waResponse = await fetch('/api/send-whatsapp', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            to: patient.whatsappNumber,
            pdfUrl,
            patientName: patient.fullName
          })
        });
        
        if (waResponse.ok) {
          try {
            await updateDoc(reportRef!, { whatsappStatus: 'sent' });
          } catch (e) {
            console.error('Failed to update WHATSAPP status', e);
          }
          toast.success('Report sent via Automated WhatsApp');
        } else {
          throw new Error('Auto-send skipped: Credentials not found');
        }
      } catch (e) {
        console.warn("Automated WhatsApp skipped", e);
        try {
          await updateDoc(reportRef!, { whatsappStatus: 'pending' });
        } catch (updateErr) {
          console.error('Fallback status update failed', updateErr);
        }
        toast.info('Auto-send skipped. Use "Free Share" in history for zero-cost messaging.');
      }

      setStatus('completed');
      toast.success('Investigation completed and report archived');
      setTimeout(onComplete, 2000);

    } catch (error: any) {
      if (error.message && error.message.startsWith('{')) {
        // Already handled by handleFirestoreError
      } else {
        toast.error(error.message);
      }
      setStatus('idle');
    }
  };

  if (status !== 'idle') {
    return (
      <Card className="shadow-sm border-2 border-dashed border-blue-200 bg-blue-50/30">
        <CardContent className="py-16 flex flex-col items-center justify-center space-y-6 text-center">
          {status === 'completed' ? (
            <div className="animate-in zoom-in duration-500">
              <CheckCircle2 className="w-16 h-16 text-green-500 mx-auto" />
              <h3 className="text-xl font-bold mt-4">Analysis Complete!</h3>
              <p className="text-slate-500">The report has been saved to the patient record and sent to WhatsApp.</p>
            </div>
          ) : (
            <>
              <div className="relative">
                <Loader2 className="w-16 h-16 text-blue-500 animate-spin" />
                <BrainCircuit className="w-8 h-8 text-blue-600 absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2" />
              </div>
              <div className="space-y-1">
                <h3 className="text-xl font-bold capitalize">
                  {status.replace(/_/g, ' ')}...
                </h3>
                <p className="text-slate-500 max-w-xs mx-auto">
                  {status === 'uploading' && "Uploading VR diagnostic files to secure storage..."}
                  {status === 'analyzing' && "Gemini AI is extracting visual acuity results from eye tests..."}
                  {status === 'generating_pdf' && "Building a professional clinical report..."}
                </p>
              </div>
            </>
          )}
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      <div className="bg-white border border-editorial-text shadow-[6px_6px_0px_rgba(26,26,26,0.05)] p-8">
        <div className="flex flex-col md:flex-row justify-between items-start md:items-end mb-10 gap-4">
          <div>
            <h2 className="font-serif text-4xl tracking-tighter italic">Diagnostic Intake</h2>
            <p className="text-editorial-muted text-xs uppercase tracking-widest mt-1">Upload VR Diagnostic Assets for Analysis</p>
          </div>
          <div className="flex flex-col items-end gap-3">
            <div className="flex flex-col items-end">
              <span className="text-[10px] uppercase tracking-widest text-editorial-muted">Select Eye Test</span>
              <Select value={testType} onValueChange={(v) => setTestType(v as any)}>
                <SelectTrigger className="w-[180px] h-8 rounded-none border-editorial-border text-[10px] uppercase font-bold tracking-widest mt-1">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent className="rounded-none">
                  <SelectItem value="acuity">Visual Acuity</SelectItem>
                  <SelectItem value="contrast">Contrast Sensitivity</SelectItem>
                  <SelectItem value="field">Visual Field</SelectItem>
                  <SelectItem value="other">Other VR Test</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="text-right">
              <span className="text-[10px] uppercase tracking-widest text-editorial-muted">Session State</span>
              <div className="flex items-center gap-2 mt-1">
                <div className={`w-2 h-2 rounded-full ${rightEyeFiles.length || leftEyeFiles.length ? 'bg-amber-400' : 'bg-editorial-border'}`}></div>
                <span className="font-mono text-[10px] uppercase">{rightEyeFiles.length || leftEyeFiles.length ? 'Media Buffered' : 'Awaiting Files'}</span>
              </div>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-10">
          {/* Right Eye */}
          <div className="flex flex-col">
            <div className="flex justify-between items-center mb-4">
              <span className="text-2xl font-serif italic text-editorial-text">01. Right Eye (OD)</span>
              <span className="text-[9px] font-mono text-editorial-muted uppercase tracking-wider">{rightEyeFiles.length} Selections</span>
            </div>
            <div className="group relative flex-1 border border-editorial-border hover:border-editorial-text transition-colors bg-editorial-bg p-8 min-h-[160px] flex flex-col items-center justify-center text-center">
              <input 
                type="file" 
                multiple 
                className="absolute inset-0 w-full h-full opacity-0 cursor-pointer z-10"
                onChange={(e) => handleFileChange('right', e.target.files)}
              />
              <div className="w-10 h-10 mb-4 border border-editorial-border group-hover:border-editorial-text flex items-center justify-center transition-colors">
                <span className="text-xl font-light">+</span>
              </div>
              <span className="text-[10px] uppercase tracking-[0.2em] font-bold">Import Media</span>
              <p className="text-[9px] text-editorial-muted mt-2 uppercase">Drag & Drop Binary Assets</p>
            </div>
            <div className="mt-4 space-y-2 overflow-y-auto max-h-40">
              {rightEyeFiles.map((f, i) => (
                <div key={`right-${i}-${f.name}`} className="animate-in fade-in slide-in-from-left-2 duration-300">
                  <FileItem file={f} onRemove={() => removeFile('right', i)} />
                </div>
              ))}
            </div>
          </div>

          {/* Left Eye */}
          <div className="flex flex-col">
            <div className="flex justify-between items-center mb-4">
              <span className="text-2xl font-serif italic text-editorial-text">02. Left Eye (OS)</span>
              <span className="text-[9px] font-mono text-editorial-muted uppercase tracking-wider">{leftEyeFiles.length} Selections</span>
            </div>
            <div className="group relative flex-1 border border-editorial-border hover:border-editorial-text transition-colors bg-editorial-bg p-8 min-h-[160px] flex flex-col items-center justify-center text-center">
              <input 
                type="file" 
                multiple 
                className="absolute inset-0 w-full h-full opacity-0 cursor-pointer z-10"
                onChange={(e) => handleFileChange('left', e.target.files)}
              />
              <div className="w-10 h-10 mb-4 border border-editorial-border group-hover:border-editorial-text flex items-center justify-center transition-colors">
                <span className="text-xl font-light">+</span>
              </div>
              <span className="text-[10px] uppercase tracking-[0.2em] font-bold">Import Media</span>
              <p className="text-[9px] text-editorial-muted mt-2 uppercase">Drag & Drop Binary Assets</p>
            </div>
            <div className="mt-4 space-y-2 overflow-y-auto max-h-40">
              {leftEyeFiles.map((f, i) => (
                <div key={`left-${i}-${f.name}`} className="animate-in fade-in slide-in-from-left-2 duration-300">
                  <FileItem file={f} onRemove={() => removeFile('left', i)} />
                </div>
              ))}
            </div>
          </div>
        </div>

        <div className="mt-12 pt-8 border-t border-editorial-border flex flex-col lg:flex-row items-center justify-between gap-6">
          <div className="flex gap-8">
            <div className="space-y-1">
              <div className="text-[9px] uppercase tracking-[0.2em] text-editorial-muted font-bold">Analysis Core</div>
              <div className="text-[11px] font-bold">GEMINI-1.5-FLASH INFRASTRUCTURE</div>
            </div>
            <div className="space-y-1">
              <div className="text-[9px] uppercase tracking-[0.2em] text-editorial-muted font-bold">Output Gateway</div>
              <div className="text-[11px] font-bold">PATIENT WHATSAPP SECURE PORTAL</div>
            </div>
          </div>
          <div className="flex gap-4 w-full lg:w-auto">
            <Button 
              className="flex-1 lg:flex-none h-12 px-10 bg-editorial-text text-white hover:bg-editorial-text/90 rounded-none text-[10px] uppercase tracking-[0.2em] font-bold transition-all disabled:opacity-30" 
              onClick={processReport}
              disabled={rightEyeFiles.length === 0 && leftEyeFiles.length === 0}
            >
              Process & Generate Report
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}

function FileItem({ file, onRemove }: { file: File, onRemove: () => void }) {
  return (
    <div className="flex items-center justify-between p-3 bg-white border border-editorial-border rounded-none text-[10px] gap-3 group/item hover:border-editorial-text transition-colors">
      <div className="flex items-center gap-3 truncate">
        <div className="w-8 h-8 bg-editorial-sidebar flex items-center justify-center text-[8px] font-mono font-bold border border-editorial-border">
          {file.type.split('/')[1]?.toUpperCase() || 'DATA'}
        </div>
        <div className="truncate">
          <p className="font-bold uppercase tracking-tight truncate">{file.name}</p>
          <p className="text-editorial-muted font-mono leading-none mt-1">{(file.size / 1024).toFixed(1)} KB • READY</p>
        </div>
      </div>
      <button onClick={onRemove} className="text-editorial-muted hover:text-red-500 transition-colors p-1">
        <X size={14} />
      </button>
    </div>
  );
}
