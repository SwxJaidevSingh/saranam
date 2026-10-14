import React, { useEffect, useState } from 'react';
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Mail, Send } from 'lucide-react';

export function EmailModal({ open, onClose, patient, onSend }) {
    const [subject, setSubject] = useState('');
    const [body, setBody] = useState('');
    const [loading, setLoading] = useState(false);

    useEffect(() => {
        if (open && patient) {
            const name = patient.full_name || patient.name || 'Patient';
            setSubject('Follow-up: Outreach from Saranam');
            setBody(
                `Dear ${name},\n\nWe tried reaching out to you regarding your healthcare follow-up. Please let us know a convenient time to connect.\n\nBest regards,\nSaranam Team`
            );
        }
    }, [open, patient]);

    const handleSend = async () => {
        if (!patient?.id) return;
        setLoading(true);
        try {
            await onSend(patient.id, subject, body);
            onClose();
        } catch (error) {
            console.error('Failed to send email:', error);
        } finally {
            setLoading(false);
        }
    };

    if (!open || !patient) return null;

    return (
        <Dialog open={open} onOpenChange={(isOpen) => { if (!isOpen) onClose(); }}>
            <DialogContent className="sm:max-w-[500px] rounded-[2rem] border-white/5 bg-white/90 backdrop-blur-xl shadow-2xl">
                <DialogHeader>
                    <DialogTitle className="flex items-center gap-3 text-2xl font-black tracking-tight">
                        <div className="p-2 bg-primary/10 rounded-xl text-primary">
                            <Mail size={20} />
                        </div>
                        Send Email
                    </DialogTitle>
                    <DialogDescription className="font-medium text-muted-foreground">
                        Compose a follow-up email for <strong>{patient.full_name || patient.name}</strong>.
                    </DialogDescription>
                </DialogHeader>

                <div className="space-y-6 py-4">
                    <div className="space-y-2">
                        <Label htmlFor="subject" className="text-xs font-bold uppercase tracking-widest text-muted-foreground ml-1">
                            Subject
                        </Label>
                        <Input
                            id="subject"
                            value={subject}
                            onChange={(e) => setSubject(e.target.value)}
                            placeholder="Email subject..."
                            className="rounded-2xl border-primary/10 focus:border-primary/30 h-12 font-medium"
                        />
                    </div>

                    <div className="space-y-2">
                        <Label htmlFor="body" className="text-xs font-bold uppercase tracking-widest text-muted-foreground ml-1">
                            Message Body
                        </Label>
                        <Textarea
                            id="body"
                            value={body}
                            onChange={(e) => setBody(e.target.value)}
                            placeholder="Write your message here..."
                            rows={8}
                            className="rounded-2xl border-primary/10 focus:border-primary/30 font-medium resize-none p-4"
                        />
                    </div>
                </div>

                <DialogFooter className="flex gap-3 sm:gap-0 mt-2">
                    <Button
                        variant="ghost"
                        onClick={onClose}
                        className="rounded-2xl font-bold px-6 hover:bg-slate-100"
                        disabled={loading}
                    >
                        Cancel
                    </Button>
                    <Button
                        onClick={handleSend}
                        disabled={loading || !subject.trim() || !body.trim()}
                        className="rounded-2xl font-bold px-8 shadow-lg shadow-primary/20 bg-primary hover:bg-primary/90"
                    >
                        {loading ? (
                            'Sending...'
                        ) : (
                            <>
                                <Send size={16} className="mr-2" />
                                Send Email
                            </>
                        )}
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}
