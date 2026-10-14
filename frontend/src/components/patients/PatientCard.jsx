/**
 * PatientCard Component
 * Displays patient information in a modern card format
 */

import React from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { 
  User, 
  Phone, 
  MapPin, 
  Calendar, 
  CreditCard, 
  X,
  ChevronRight,
  ClipboardList
} from 'lucide-react';
import { cn } from '@/lib/utils';

const PatientCard = ({ patient, variant = 'detailed', showActions = false, onRemove, onClick }) => {
  if (!patient) return null;

  const calculateAge = (dob) => {
    if (!dob) return null;
    const today = new Date();
    const birthDate = new Date(dob);
    let age = today.getFullYear() - birthDate.getFullYear();
    const monthDiff = today.getMonth() - birthDate.getMonth();
    if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birthDate.getDate())) {
      age--;
    }
    return age;
  };

  const age = patient.age || calculateAge(patient.date_of_birth);

  if (variant === 'compact') {
    return (
      <Card
        className={cn(
          "group relative overflow-hidden transition-all duration-300 hover:shadow-md border-border/50",
          onClick && "cursor-pointer hover:border-primary/30"
        )}
        onClick={onClick}
      >
        <CardContent className="p-4">
          <div className="flex justify-between items-center">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center text-primary">
                <User size={20} />
              </div>
              <div>
                <div className="flex items-center gap-1.5">
                  <h4 className="font-semibold text-foreground group-hover:text-primary transition-colors">
                    {patient.full_name}
                  </h4>
                  {/* Compact status dot — only shown for non-default states */}
                  {patient.is_deceased ? (
                    <span className="inline-block px-1.5 py-[1px] rounded text-[9px] font-bold bg-slate-800 text-white">
                      DECEASED
                    </span>
                  ) : patient.care_status === 'inactive' ? (
                    <span className="inline-block px-1.5 py-[1px] rounded text-[9px] font-bold bg-slate-200 text-slate-700">
                      INACTIVE{patient.home_care_decline_reason ? ` (${patient.home_care_decline_reason})` : ''}
                    </span>
                  ) : patient.is_contacted === false ? (
                    <span className="inline-block px-1.5 py-[1px] rounded text-[9px] font-bold bg-red-100 dark:bg-red-950/40 text-red-700 dark:text-red-300 border border-red-200 dark:border-red-800">
                      NOT CONTACTED
                    </span>
                  ) : null}
                </div>
                <p className="text-[11px] font-mono text-muted-foreground">
                  {patient.homecare_code ? `${patient.homecare_code} ` : ''}
                  {patient.uhid || '—'}
                  {patient.hospital_uhid ? ` • H#${patient.hospital_uhid}` : ''}
                </p>
                <p className="text-xs text-muted-foreground">
                  {patient.gender}{age ? `, ${age}y` : ''} {patient.city ? `• ${patient.city}` : ''}
                </p>
              </div>
            </div>
            {showActions && onRemove ? (
              <button
                onClick={(e) => { e.stopPropagation(); onRemove(); }}
                className="p-1 hover:bg-destructive/10 hover:text-destructive rounded-full transition-colors text-muted-foreground"
              >
                <X size={16} />
              </button>
            ) : (
              <ChevronRight size={16} className="text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity" />
            )}
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card
      className={cn(
        "group relative overflow-hidden transition-all duration-300 hover:shadow-xl border-border/50 bg-card/50 backdrop-blur-sm",
        onClick && "cursor-pointer hover:border-primary/30 transform hover:-translate-y-1"
      )}
      onClick={onClick}
    >
      {/* Decorative gradient background */}
      <div className="absolute top-0 right-0 w-32 h-32 bg-primary/5 rounded-full -mr-16 -mt-16 transition-transform group-hover:scale-150 duration-500" />
      
      <CardContent className="p-6 relative z-10">
        <div className="flex justify-between items-start mb-4">
          <div className="space-y-3">
            <div>
              <h3 className="text-xl font-bold tracking-tight text-foreground group-hover:text-primary transition-colors">
                {patient.full_name}
              </h3>
              <p className="text-xs font-mono text-muted-foreground mt-0.5">
                {patient.homecare_code ? `${patient.homecare_code} ` : ''}
                {patient.uhid || '—'}
                {patient.hospital_uhid ? ` • H#${patient.hospital_uhid}` : ''}
              </p>
            </div>
            <div className="flex flex-wrap gap-2">
              {/* Three-state patient status badge (§3, 2026-04-14) */}
              {patient.is_deceased ? (
                <Badge className="bg-slate-800 text-white border-slate-800 hover:bg-slate-700">
                  Deceased{patient.date_of_death ? ` · ${new Date(patient.date_of_death).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })}` : ''}
                </Badge>
              ) : patient.care_status === 'inactive' ? (
                <Badge className="bg-slate-300 text-slate-900 border-slate-300 hover:bg-slate-400">
                  Alive & Inactive{patient.home_care_decline_reason ? ` (${patient.home_care_decline_reason})` : ''}
                </Badge>
              ) : (
                <Badge className="bg-green-500/15 text-green-600 border-green-500/30 hover:bg-green-500/25">
                  Alive & Active
                </Badge>
              )}
              {patient.is_contacted === false && (
                <Badge className="bg-red-500/10 text-red-500 border-red-500/20 hover:bg-red-500/20">
                  Not Contacted
                </Badge>
              )}
              {patient.gender && (
                <Badge variant="secondary" className="bg-primary/5 text-primary border-primary/10 hover:bg-primary/10">
                  {patient.gender}
                </Badge>
              )}
              {age && (
                <Badge variant="secondary" className="bg-secondary/50 text-secondary-foreground border-border/50">
                  {age} years
                </Badge>
              )}
              {patient.has_abha && (
                <Badge className="bg-blue-500/10 text-blue-500 border-blue-500/20 hover:bg-blue-500/20">
                  <CreditCard size={12} className="mr-1" />
                  ABHA
                </Badge>
              )}
            </div>
          </div>
          {showActions && onRemove && (
            <button
              onClick={(e) => { e.stopPropagation(); onRemove(); }}
              className="p-2 hover:bg-destructive/10 hover:text-destructive rounded-xl transition-colors text-muted-foreground"
            >
              <X size={20} />
            </button>
          )}
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-y-4 gap-x-6 mt-6">
          {patient.contact && (
            <div className="flex items-center gap-2.5 text-sm text-muted-foreground">
              <div className="w-8 h-8 rounded-lg bg-secondary/50 flex items-center justify-center group-hover:bg-primary/10 group-hover:text-primary transition-colors">
                <Phone size={14} />
              </div>
              <span className="font-medium">{patient.contact}</span>
            </div>
          )}

          {patient.address && (
            <div className="flex items-start gap-2.5 text-sm text-muted-foreground col-span-full">
              <div className="w-8 h-8 rounded-lg bg-secondary/50 flex items-center justify-center shrink-0 group-hover:bg-primary/10 group-hover:text-primary transition-colors">
                <MapPin size={14} />
              </div>
              <span className="leading-relaxed truncate max-w-[280px]" title={patient.address}>
                {patient.address}
              </span>
            </div>
          )}

          {patient.submission_count !== undefined && (
            <div className="flex items-center gap-2.5 text-sm text-muted-foreground col-span-full pt-4 border-t border-border/50">
              <div className="w-8 h-8 rounded-lg bg-secondary/50 flex items-center justify-center group-hover:bg-primary/10 group-hover:text-primary transition-colors">
                <ClipboardList size={14} />
              </div>
              <span>
                <span className="font-bold text-foreground">
                  {patient.submission_count}
                </span>
                {patient.submission_count === 1 ? ' submission' : ' submissions'}
                {patient.last_submission && (
                  <span className="ml-2 text-xs">
                    • Last: <span className="text-foreground/70">{new Date(patient.last_submission).toLocaleDateString()}</span>
                  </span>
                )}
              </span>
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
};

export default PatientCard;
