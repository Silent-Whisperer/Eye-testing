import * as React from 'react';
import { useState, useEffect } from 'react';
import { supabase, handleSupabaseError, OperationType } from '../../lib/supabase';
import { Patient } from '../../types';
import { Input } from '@/components/ui/input';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import { Search, UserCircle, FileText, ChevronRight, Edit2, Trash2 } from 'lucide-react';
import { format } from 'date-fns';
import PatientDetail from './PatientDetail';
import PatientForm from './PatientForm';
import { toast } from 'sonner';

export default function PatientList({ onSelectPatient }: { onSelectPatient?: (p: Patient) => void }) {
  const [patients, setPatients] = useState<Patient[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [selectedPatient, setSelectedPatient] = useState<Patient | null>(null);
  const [editingPatient, setEditingPatient] = useState<Patient | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [isPurging, setIsPurging] = useState(false);

  useEffect(() => {
    let active = true;

    async function fetchPatients() {
      try {
        const { data, error } = await supabase
          .from('patients')
          .select('*')
          .order('createdAt', { ascending: false })
          .limit(100);

        if (error) throw error;
        if (active) {
          // Normalize the timestamp or handle it
          const formattedPatients = (data || []).map(p => ({
            ...p,
            createdAt: p.createdAt ? new Date(p.createdAt).getTime() : Date.now(),
            lastExamDate: p.lastExamDate ? new Date(p.lastExamDate).getTime() : null,
          }));
          setPatients(formattedPatients as Patient[]);
          setLoading(false);
        }
      } catch (err) {
        if (active) {
          handleSupabaseError(err, OperationType.LIST, 'patients');
          setLoading(false);
        }
      }
    }

    fetchPatients();

    const channel = supabase
      .channel('patients-changes')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'patients' }, () => {
        fetchPatients();
      })
      .subscribe();

    return () => {
      active = false;
      supabase.removeChannel(channel);
    };
  }, []);

  const handlePurge = async () => {
    if (!deletingId) return;
    setIsPurging(true);
    try {
      const { error } = await supabase
        .from('patients')
        .delete()
        .eq('id', deletingId);

      if (error) throw error;
      toast.success('Patient record purge completed');
      setDeletingId(null);
    } catch (err) {
      handleSupabaseError(err, OperationType.DELETE, `patients/${deletingId}`);
    } finally {
      setIsPurging(false);
    }
  };

  const handleEdit = (e: React.MouseEvent, patient: Patient) => {
    e.stopPropagation();
    setEditingPatient(patient);
  };

  const filteredPatients = patients.filter(p => 
    p.fullName.toLowerCase().includes(search.toLowerCase()) || 
    p.patientId.toLowerCase().includes(search.toLowerCase())
  );

  if (editingPatient) {
    return <PatientForm initialData={editingPatient} onCancel={() => setEditingPatient(null)} onSuccess={() => setEditingPatient(null)} />;
  }

  if (selectedPatient) {
    return <PatientDetail patient={selectedPatient} onBack={() => setSelectedPatient(null)} />;
  }

  return (
    <div className="space-y-10 relative">
      {deletingId && (
        <div className="fixed inset-0 bg-white/80 backdrop-blur-sm z-50 flex items-center justify-center p-6 animate-in fade-in duration-300">
          <div className="bg-white border-2 border-editorial-text shadow-[20px_20px_0px_#000] p-10 max-w-md w-full animate-in zoom-in-95 duration-300">
            <h3 className="font-serif text-3xl italic mb-4">Confirm Purge</h3>
            <p className="text-sm font-bold text-gray-600 mb-8 uppercase tracking-widest leading-loose">
              You are about to irreversibly remove this patient record and all clinical history from the primary ledger. This action cannot be undone.
            </p>
            <div className="flex gap-4">
              <Button 
                variant="outline" 
                onClick={() => setDeletingId(null)}
                className="flex-1 rounded-none border-2 border-editorial-text font-bold uppercase tracking-widest text-[10px] h-12"
              >
                Cancel
              </Button>
              <Button 
                onClick={handlePurge}
                disabled={isPurging}
                className="flex-1 bg-red-600 text-white hover:bg-red-700 rounded-none border-2 border-red-700 font-bold uppercase tracking-widest text-[10px] h-12 shadow-[4px_4px_0px_#600]"
              >
                {isPurging ? 'Purging...' : 'Confirm Purge'}
              </Button>
            </div>
          </div>
        </div>
      )}

      <div className="flex flex-col md:flex-row md:items-end justify-between gap-6 border-b-2 border-editorial-text pb-6">
        <div>
          <h1 className="font-serif text-5xl tracking-tighter italic text-editorial-text">Patient Registry</h1>
          <p className="text-secondary-foreground text-xs uppercase tracking-[0.3em] font-bold mt-2">Active Examination Ledger & History</p>
        </div>
        <div className="relative max-w-sm w-full">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-editorial-muted" size={16} />
          <Input 
            placeholder="SEARCH DATABASE..." 
            className="pl-10 h-11 border-editorial-border bg-white rounded-none focus-visible:ring-1 focus-visible:ring-editorial-text uppercase text-[10px] tracking-widest font-bold"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
      </div>

      <div className="bg-white border border-editorial-border shadow-[4px_4px_0px_rgba(26,26,26,0.05)]">
        <Table>
          <TableHeader className="bg-editorial-sidebar border-b border-editorial-border">
            <TableRow className="hover:bg-transparent">
              <TableHead className="text-[10px] uppercase tracking-[0.2em] font-bold text-editorial-muted h-12">Registry Name</TableHead>
              <TableHead className="text-[10px] uppercase tracking-[0.2em] font-bold text-editorial-muted h-12">Clinic Identifier</TableHead>
              <TableHead className="text-[10px] uppercase tracking-[0.2em] font-bold text-editorial-muted h-12">Last Diagnostic</TableHead>
              <TableHead className="text-[10px] uppercase tracking-[0.2em] font-bold text-editorial-muted h-12">Physician</TableHead>
              <TableHead className="text-right text-[10px] uppercase tracking-[0.2em] font-bold text-editorial-muted h-12">Action</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {loading ? (
              Array.from({ length: 5 }).map((_, i) => (
                <TableRow key={i}>
                  <TableCell colSpan={5} className="h-16 animate-pulse bg-editorial-sidebar/50" />
                </TableRow>
              ))
            ) : filteredPatients.length === 0 ? (
              <TableRow>
                <TableCell colSpan={5} className="text-center py-20 text-editorial-muted font-serif italic text-xl">
                  No records found in the current session.
                </TableCell>
              </TableRow>
            ) : (
              filteredPatients.map((patient) => (
                <TableRow key={patient.id} className="cursor-pointer hover:bg-editorial-sidebar transition-colors group" onClick={() => setSelectedPatient(patient)}>
                  <TableCell>
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 bg-editorial-sidebar flex items-center justify-center text-editorial-text border border-editorial-border group-hover:border-editorial-text transition-colors">
                        <UserCircle size={18} />
                      </div>
                      <div>
                        <p className="font-bold text-sm tracking-tight">{patient.fullName}</p>
                        <p className="text-[10px] text-editorial-muted uppercase tracking-wider">{patient.age}Y • {patient.gender}</p>
                      </div>
                    </div>
                  </TableCell>
                  <TableCell>
                    <code className="text-[11px] bg-editorial-sidebar px-2 py-1 border border-editorial-border font-mono text-editorial-text">
                      {patient.patientId}
                    </code>
                  </TableCell>
                  <TableCell className="text-xs">
                    {patient.lastExamDate ? format(patient.lastExamDate, 'MMM d, yyyy') : <span className="text-editorial-muted italic">No diagnostics</span>}
                  </TableCell>
                  <TableCell className="text-xs font-medium uppercase tracking-tight">{patient.doctorName}</TableCell>
                  <TableCell className="text-right">
                    <div className="flex justify-end gap-2">
                      <Button 
                        variant="ghost" 
                        size="icon" 
                        onClick={(e) => handleEdit(e, patient)}
                        className="h-8 w-8 hover:bg-editorial-text hover:text-white rounded-none border border-editorial-border"
                      >
                        <Edit2 size={12} />
                      </Button>
                      <Button 
                        variant="ghost" 
                        size="icon" 
                        onClick={(e) => { e.stopPropagation(); setDeletingId(patient.id); }}
                        className="h-8 w-8 hover:bg-red-600 hover:text-white rounded-none border border-editorial-border"
                      >
                        <Trash2 size={12} />
                      </Button>
                      <Button variant="ghost" size="sm" className="text-[10px] uppercase tracking-widest font-bold h-8 hover:bg-editorial-text hover:text-white transition-all rounded-none border border-editorial-border">
                         View <ChevronRight size={12} className="ml-1" />
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
