'use client';

import { REPORT_REASONS, type ReportReason, type ReportTargetType } from '@vogn/types';
import { useMutation } from '@tanstack/react-query';
import { useState } from 'react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { RadioCard, RadioGroup } from '@/components/ui/controls';
import { Dialog, DialogContent, DialogFooter, DialogHeader } from '@/components/ui/dialog';
import { Field } from '@/components/ui/field';
import { Textarea } from '@/components/ui/input';
import { useErrorMessage } from '@/components/ui/states';
import { api } from '@/lib/api';

const REASON_LABELS: Record<ReportReason, string> = {
  spam: 'Spam or scams',
  harassment: 'Harassment or bullying',
  hate: 'Hate speech',
  violence: 'Violence or threats',
  sexual_content: 'Sexual content',
  doxxing: 'Sharing private information (doxxing)',
  impersonation: 'Impersonation',
  scam: 'Fraud',
  illegal: 'Illegal activity',
  self_harm: 'Self-harm',
  other: 'Something else',
};

export function ReportDialog({
  open,
  onOpenChange,
  targetType,
  targetId,
  label,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  targetType: ReportTargetType;
  targetId: string;
  label: string;
}) {
  const [reason, setReason] = useState<ReportReason>('spam');
  const [details, setDetails] = useState('');
  const errorMessage = useErrorMessage();
  const mutation = useMutation({
    mutationFn: () => api.reports.create({ targetType, targetId, reason, details: details || null }),
    onSuccess: () => {
      toast.success('Report sent. Thank you for keeping VOGN safe.');
      onOpenChange(false);
      setDetails('');
    },
    onError: (e) => toast.error(errorMessage(e)),
  });
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader title={`Report ${label}`} description="Reports are confidential. Moderators see the reported content and your reason, not your other activity." />
        <RadioGroup value={reason} onValueChange={(v) => setReason(v as ReportReason)} className="max-h-72 overflow-y-auto pr-1">
          {REPORT_REASONS.map((r) => (
            <RadioCard key={r} value={r} title={REASON_LABELS[r]} />
          ))}
        </RadioGroup>
        <Field label="Details" optional>
          {(p) => <Textarea {...p} value={details} onChange={(e) => setDetails(e.target.value)} maxLength={1000} placeholder="Anything that helps moderators understand the problem" />}
        </Field>
        <DialogFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button variant="danger" loading={mutation.isPending} onClick={() => mutation.mutate()}>
            Send report
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
