import React, { useMemo } from 'react';
import { Pill, Users } from 'lucide-react';
import { ChartCard } from '@/components/analytics/ChartCard';
import PainLadderRails from './PainLadderRails';
import { Popover, PopoverTrigger, PopoverContent } from '@/components/ui/popover';

const getPct = (value, total) => {
  if (!total) return '0.0';
  return ((value / total) * 100).toFixed(1);
};

const PainLadderTable = ({ data = [] }) => {
  const steps = ["No Analgesic", "Step 1 (Non-Opioid)", "Step 2 (Weak Opioid)", "Step 3 (Strong Opioid)"];

  return (
    <div className="border border-border rounded-lg overflow-x-auto bg-card custom-scrollbar">
      <table className="min-w-full divide-y divide-border text-xs text-left">
        <thead className="bg-muted/50">
          <tr>
            <th className="p-3 font-semibold text-muted-foreground">Pain Intensity Tier</th>
            {steps.map(step => (
              <th key={step} className="p-3 font-semibold text-muted-foreground text-right">{step}</th>
            ))}
            <th className="p-3 font-semibold text-muted-foreground text-right">Total</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-border">
          {data.map((row, idx) => {
            const rowTotal = steps.reduce((sum, step) => sum + (row[step] || 0), 0);
            return (
              <tr key={idx} className="hover:bg-muted/10 transition-colors">
                <td className="p-3 font-medium text-foreground">{row.pain_tier}</td>
                {steps.map(step => (
                  <td key={step} className="p-3 text-right font-mono text-foreground">{row[step] || 0}</td>
                ))}
                <td className="p-3 text-right font-bold font-mono text-foreground">{rowTotal}</td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
};

export default function AnalgesicPainLadder({ 
  ladderData = [], 
  medDetails = {}, 
  othersBreakdown = {},
  isLoading = false,
  headerAction,
  viewMode = 'chart'
}) {
  const painDistData = useMemo(() => {
    if (!ladderData || ladderData.length === 0) return { total: 0, items: [] };
    
    let total = 0;
    const items = ladderData.map(item => {
      const sum = (item["No Analgesic"] || 0) + 
                  (item["Step 1 (Non-Opioid)"] || 0) + 
                  (item["Step 2 (Weak Opioid)"] || 0) + 
                  (item["Step 3 (Strong Opioid)"] || 0);
      total += sum;
      return {
        name: item.pain_tier,
        value: sum,
      };
    });
    
    const itemsWithPct = items.map(item => ({
      ...item,
      percentage: total > 0 ? ((item.value / total) * 100).toFixed(1) : '0.0'
    }));
    
    return {
      total,
      items: itemsWithPct
    };
  }, [ladderData]);

  const painItems = painDistData.items;

  // De-duplicated step totals from the main matrix (ladderData)
  const step3Count = useMemo(() => {
    return ladderData.reduce((sum, item) => sum + (item["Step 3 (Strong Opioid)"] || 0), 0);
  }, [ladderData]);

  const step2Count = useMemo(() => {
    return ladderData.reduce((sum, item) => sum + (item["Step 2 (Weak Opioid)"] || 0), 0);
  }, [ladderData]);

  const step1Count = useMemo(() => {
    return ladderData.reduce((sum, item) => sum + (item["Step 1 (Non-Opioid)"] || 0), 0);
  }, [ladderData]);

  // Severe (Step 3) Stats
  const severeTotal = painItems.find(x => x.name === 'Severe (7-10)')?.value || 0;
  const severePct = getPct(step3Count, painDistData.total);
  const morphine = medDetails['Severe (7-10)']?.morphine || 0;
  const fentanyl = medDetails['Severe (7-10)']?.fentanyl || 0;
  const oxycodone = medDetails['Severe (7-10)']?.oxycodone || 0;
  const buprenorphine = medDetails['Severe (7-10)']?.buprenorphine || 0;
  const severeOthers = medDetails['Severe (7-10)']?.others || 0;

  // Moderate (Step 2) Stats
  const moderateTotal = painItems.find(x => x.name === 'Moderate (4-6)')?.value || 0;
  const moderatePct = getPct(step2Count, painDistData.total);
  const tramadol = medDetails['Moderate (4-6)']?.tramadol || 0;
  const codeine = medDetails['Moderate (4-6)']?.codeine || 0;
  const tapentadol = medDetails['Moderate (4-6)']?.tapentadol || 0;
  const moderateOthers = medDetails['Moderate (4-6)']?.others || 0;

  // Mild (Step 1) Stats
  const mildTotal = painItems.find(x => x.name === 'Mild (1-3)')?.value || 0;
  const mildPct = getPct(step1Count, painDistData.total);
  const paracetamol = medDetails['Mild (1-3)']?.paracetamol || 0;
  const ibuprofen = medDetails['Mild (1-3)']?.ibuprofen || 0;
  const diclofenac = medDetails['Mild (1-3)']?.diclofenac || 0;
  const mildOthers = medDetails['Mild (1-3)']?.others || 0;

  return (
    <ChartCard
      id="who-pain-ladder-container"
      title="WHO Analgesic Pain Ladder"
      description="Dynamic patient classification and analgesic medication breakdown"
      isLoading={isLoading}
      headerAction={headerAction}
    >
      {viewMode === 'table' ? (
        <PainLadderTable data={ladderData} />
      ) : (
        <div className="flex gap-2 sm:gap-6 items-stretch py-6 select-none overflow-x-auto min-w-[320px]">
          
          {/* Left Arrow: Pain Intensity */}
          <div className="flex flex-col items-center justify-between py-6 shrink-0 w-12 sm:w-20 border-r border-border pr-2 sm:pr-4 relative">
            <span className="text-[8px] sm:text-[10px] font-bold text-muted-foreground uppercase tracking-wider text-center block mb-2 select-none">
              Pain Intensity
            </span>
            <div className="flex-1 relative w-2 sm:w-3 rounded-full bg-gradient-to-t from-emerald-400 via-amber-400 to-rose-500 my-2">
              {/* Arrow head */}
              <div className="absolute -top-1.5 left-1/2 -translate-x-1/2 w-0 h-0 border-l-[5px] border-l-transparent border-r-[5px] border-r-transparent border-b-[8px] border-b-rose-500" />
              
              {/* Severe */}
              <div className="absolute top-[8%] left-3 sm:left-5 flex flex-col whitespace-nowrap">
                <span className="text-[10px] sm:text-xs font-bold text-rose-600 dark:text-rose-400">Severe</span>
                <span className="text-[8px] sm:text-[10px] text-muted-foreground">7 - 10</span>
              </div>

              {/* Moderate */}
              <div className="absolute top-[50%] -translate-y-1/2 left-3 sm:left-5 flex flex-col whitespace-nowrap">
                <span className="text-[10px] sm:text-xs font-bold text-amber-600 dark:text-amber-400">Moderate</span>
                <span className="text-[8px] sm:text-[10px] text-muted-foreground">4 - 6</span>
              </div>

              {/* Mild */}
              <div className="absolute bottom-[8%] left-3 sm:left-5 flex flex-col whitespace-nowrap">
                <span className="text-[10px] sm:text-xs font-bold text-emerald-600 dark:text-emerald-400">Mild</span>
                <span className="text-[8px] sm:text-[10px] text-muted-foreground">1 - 3</span>
              </div>
            </div>
          </div>

          {/* Ladder Area */}
          <div className="flex-1 relative flex flex-col gap-8 px-4 sm:px-12 py-8 overflow-hidden rounded-xl bg-slate-50/50 dark:bg-slate-900/30 border border-slate-200/50 dark:border-slate-800/50">
            {/* Background SVG for Slanted Rails */}
            <PainLadderRails />

            {/* STEP 3 - STRONG OPIOIDS */}
            <div className="relative z-10 w-[78%] sm:w-[68%] mx-auto my-2">

              
              {/* Step Badge */}
              <div className="absolute -left-4 sm:-left-5 top-1/2 -translate-y-1/2 w-8 h-8 sm:w-10 sm:h-10 rounded-full flex items-center justify-center text-white font-extrabold text-xs sm:text-base shadow-md z-20 bg-[#EF4444]">
                3
              </div>

              {/* Card */}
              <div className="relative z-10 rounded-xl border border-rose-200/60 dark:border-rose-900/30 bg-card shadow-sm overflow-hidden flex flex-col">
                <div className="pl-6 pr-4 py-2 text-white font-bold text-center text-[10px] sm:text-xs md:text-sm tracking-wide uppercase bg-[#EF4444]">
                  STEP 3 – STRONG OPIOIDS
                </div>
                <div className="pl-6 pr-4 py-4 flex flex-col md:flex-row gap-4 items-center justify-between">
                  <div className="w-10 h-10 rounded-full flex-shrink-0 flex items-center justify-center bg-rose-50 dark:bg-rose-900/20">
                    <Pill className="h-5 w-5 text-[#EF4444]" />
                  </div>
                  <div className="flex-1 w-full space-y-2">
                    <div className="text-[10px] font-semibold text-rose-600 dark:text-rose-400">
                      Pain Score: 7 – 10
                    </div>
                    
                    {/* Morphine */}
                    <div className="flex items-center gap-3 text-[10px] sm:text-xs">
                      <span className="w-16 sm:w-20 truncate font-medium text-foreground">Morphine</span>
                      <div className="flex-1 h-1.5 rounded-full bg-secondary overflow-hidden">
                        <div className="h-full rounded-full bg-[#EF4444]" style={{ width: `${getPct(morphine, step3Count)}%` }} />
                      </div>
                      <span className="w-14 text-right font-semibold text-foreground">
                        {morphine} <span className="text-[9px] text-muted-foreground">({getPct(morphine, step3Count)}%)</span>
                      </span>
                    </div>

                    {/* Fentanyl */}
                    <div className="flex items-center gap-3 text-[10px] sm:text-xs">
                      <span className="w-16 sm:w-20 truncate font-medium text-foreground">Fentanyl</span>
                      <div className="flex-1 h-1.5 rounded-full bg-secondary overflow-hidden">
                        <div className="h-full rounded-full bg-[#EF4444]" style={{ width: `${getPct(fentanyl, step3Count)}%` }} />
                      </div>
                      <span className="w-14 text-right font-semibold text-foreground">
                        {fentanyl} <span className="text-[9px] text-muted-foreground">({getPct(fentanyl, step3Count)}%)</span>
                      </span>
                    </div>

                    {/* Oxycodone */}
                    <div className="flex items-center gap-3 text-[10px] sm:text-xs">
                      <span className="w-16 sm:w-20 truncate font-medium text-foreground">Oxycodone</span>
                      <div className="flex-1 h-1.5 rounded-full bg-secondary overflow-hidden">
                        <div className="h-full rounded-full bg-[#EF4444]" style={{ width: `${getPct(oxycodone, step3Count)}%` }} />
                      </div>
                      <span className="w-14 text-right font-semibold text-foreground">
                        {oxycodone} <span className="text-[9px] text-muted-foreground">({getPct(oxycodone, step3Count)}%)</span>
                      </span>
                    </div>

                    {/* Buprenorphine */}
                    <div className="flex items-center gap-3 text-[10px] sm:text-xs">
                      <span className="w-16 sm:w-20 truncate font-medium text-foreground">Buprenorphine</span>
                      <div className="flex-1 h-1.5 rounded-full bg-secondary overflow-hidden">
                        <div className="h-full rounded-full bg-[#EF4444]" style={{ width: `${getPct(buprenorphine, step3Count)}%` }} />
                      </div>
                      <span className="w-14 text-right font-semibold text-foreground">
                        {buprenorphine} <span className="text-[9px] text-muted-foreground">({getPct(buprenorphine, step3Count)}%)</span>
                      </span>
                    </div>

                    {/* Others */}
                    <div className="flex items-center gap-3 text-[10px] sm:text-xs">
                      {severeOthers > 0 ? (
                        <Popover>
                          <PopoverTrigger asChild>
                            <span className="w-16 sm:w-20 truncate font-medium text-foreground border-b border-dashed border-muted-foreground/40 hover:text-[#EF4444] transition-colors cursor-pointer select-none">
                              Others
                            </span>
                          </PopoverTrigger>
                          <PopoverContent className="w-64 rounded-xl border border-border bg-popover p-3 shadow-xl text-left z-50" align="start" side="top" sideOffset={8}>
                            <div className="font-bold text-xs border-b border-border pb-1.5 mb-1.5 text-foreground flex items-center justify-between">
                              <span>Medications in "Others"</span>
                              <span className="text-[10px] font-normal text-rose-500">Step 3</span>
                            </div>
                            <ul className="space-y-1.5 max-h-40 overflow-y-auto pr-1">
                              {Object.entries(othersBreakdown['Severe (7-10)'] || {})
                                .sort((a, b) => b[1] - a[1])
                                .slice(0, 20)
                                .map(([med, count]) => (
                                  <li key={med} className="flex justify-between items-center text-[10px]">
                                    <span className="capitalize text-muted-foreground truncate max-w-[180px]">{med}</span>
                                    <span className="font-bold text-foreground bg-secondary/80 px-1.5 py-0.5 rounded text-[9px]">{count}</span>
                                  </li>
                                ))
                              }
                              {Object.keys(othersBreakdown['Severe (7-10)'] || {}).length > 20 && (
                                <li className="text-[9px] text-muted-foreground italic text-center pt-1 border-t border-border/50">
                                  + {Object.keys(othersBreakdown['Severe (7-10)'] || {}).length - 20} more medications
                                </li>
                              )}
                              {Object.keys(othersBreakdown['Severe (7-10)'] || {}).length === 0 && (
                                <li className="text-[10px] text-muted-foreground italic">No details available</li>
                              )}
                            </ul>
                          </PopoverContent>
                        </Popover>
                      ) : (
                        <span className="w-16 sm:w-20 truncate font-medium text-foreground">Others</span>
                      )}
                      <div className="flex-1 h-1.5 rounded-full bg-secondary overflow-hidden">
                        <div className="h-full rounded-full bg-[#EF4444]" style={{ width: `${getPct(severeOthers, step3Count)}%` }} />
                      </div>
                      <span className="w-14 text-right font-semibold text-foreground">
                        {severeOthers} <span className="text-[9px] text-muted-foreground">({getPct(severeOthers, step3Count)}%)</span>
                      </span>
                    </div>

                    <div className="text-[9px] font-semibold text-[#EF4444]">
                      % of all patients: {severePct}%
                    </div>
                  </div>
                  <div className="flex flex-col items-center justify-center p-2 border-t md:border-t-0 md:border-l border-border min-w-[80px] shrink-0 w-full md:w-auto">
                    <span className="text-[8px] text-muted-foreground uppercase font-bold tracking-wider">Total Patients</span>
                    <div className="flex items-center gap-1 mt-0.5">
                      <span className="text-lg font-extrabold text-foreground">{step3Count}</span>
                      <Users className="h-3.5 w-3.5 text-muted-foreground" />
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* STEP 2 - WEAK OPIOIDS */}
            <div className="relative z-10 w-[84%] sm:w-[75%] mx-auto my-2">

              
              {/* Step Badge */}
              <div className="absolute -left-4 sm:-left-5 top-1/2 -translate-y-1/2 w-8 h-8 sm:w-10 sm:h-10 rounded-full flex items-center justify-center text-white font-extrabold text-xs sm:text-base shadow-md z-20 bg-[#F59E0B]">
                2
              </div>

              {/* Card */}
              <div className="relative z-10 rounded-xl border border-amber-200/60 dark:border-amber-900/30 bg-card shadow-sm overflow-hidden flex flex-col">
                <div className="pl-6 pr-4 py-2 text-white font-bold text-center text-[10px] sm:text-xs md:text-sm tracking-wide uppercase bg-[#F59E0B]">
                  STEP 2 – WEAK OPIOIDS
                </div>
                <div className="pl-6 pr-4 py-4 flex flex-col md:flex-row gap-4 items-center justify-between">
                  <div className="w-10 h-10 rounded-full flex-shrink-0 flex items-center justify-center bg-amber-50 dark:bg-amber-950/20">
                    <Pill className="h-5 w-5 text-[#F59E0B]" />
                  </div>
                  <div className="flex-1 w-full space-y-2">
                    <div className="text-[10px] font-semibold text-amber-600 dark:text-amber-400">
                      Pain Score: 4 – 6
                    </div>
                    
                    {/* Tramadol */}
                    <div className="flex items-center gap-3 text-[10px] sm:text-xs">
                      <span className="w-16 sm:w-20 truncate font-medium text-foreground">Tramadol</span>
                      <div className="flex-1 h-1.5 rounded-full bg-secondary overflow-hidden">
                        <div className="h-full rounded-full bg-[#F59E0B]" style={{ width: `${getPct(tramadol, step2Count)}%` }} />
                      </div>
                      <span className="w-14 text-right font-semibold text-foreground">
                        {tramadol} <span className="text-[9px] text-muted-foreground">({getPct(tramadol, step2Count)}%)</span>
                      </span>
                    </div>

                    {/* Codeine */}
                    <div className="flex items-center gap-3 text-[10px] sm:text-xs">
                      <span className="w-16 sm:w-20 truncate font-medium text-foreground">Codeine</span>
                      <div className="flex-1 h-1.5 rounded-full bg-secondary overflow-hidden">
                        <div className="h-full rounded-full bg-[#F59E0B]" style={{ width: `${getPct(codeine, step2Count)}%` }} />
                      </div>
                      <span className="w-14 text-right font-semibold text-foreground">
                        {codeine} <span className="text-[9px] text-muted-foreground">({getPct(codeine, step2Count)}%)</span>
                      </span>
                    </div>

                    {/* Tapentadol */}
                    <div className="flex items-center gap-3 text-[10px] sm:text-xs">
                      <span className="w-16 sm:w-20 truncate font-medium text-foreground">Tapentadol</span>
                      <div className="flex-1 h-1.5 rounded-full bg-secondary overflow-hidden">
                        <div className="h-full rounded-full bg-[#F59E0B]" style={{ width: `${getPct(tapentadol, step2Count)}%` }} />
                      </div>
                      <span className="w-14 text-right font-semibold text-foreground">
                        {tapentadol} <span className="text-[9px] text-muted-foreground">({getPct(tapentadol, step2Count)}%)</span>
                      </span>
                    </div>

                    {/* Others */}
                    <div className="flex items-center gap-3 text-[10px] sm:text-xs">
                      {moderateOthers > 0 ? (
                        <Popover>
                          <PopoverTrigger asChild>
                            <span className="w-16 sm:w-20 truncate font-medium text-foreground border-b border-dashed border-muted-foreground/40 hover:text-[#F59E0B] transition-colors cursor-pointer select-none">
                              Others
                            </span>
                          </PopoverTrigger>
                          <PopoverContent className="w-64 rounded-xl border border-border bg-popover p-3 shadow-xl text-left z-50" align="start" side="top" sideOffset={8}>
                            <div className="font-bold text-xs border-b border-border pb-1.5 mb-1.5 text-foreground flex items-center justify-between">
                              <span>Medications in "Others"</span>
                              <span className="text-[10px] font-normal text-amber-500">Step 2</span>
                            </div>
                            <ul className="space-y-1.5 max-h-40 overflow-y-auto pr-1">
                              {Object.entries(othersBreakdown['Moderate (4-6)'] || {})
                                .sort((a, b) => b[1] - a[1])
                                .slice(0, 20)
                                .map(([med, count]) => (
                                  <li key={med} className="flex justify-between items-center text-[10px]">
                                    <span className="capitalize text-muted-foreground truncate max-w-[180px]">{med}</span>
                                    <span className="font-bold text-foreground bg-secondary/80 px-1.5 py-0.5 rounded text-[9px]">{count}</span>
                                  </li>
                                ))
                              }
                              {Object.keys(othersBreakdown['Moderate (4-6)'] || {}).length > 20 && (
                                <li className="text-[9px] text-muted-foreground italic text-center pt-1 border-t border-border/50">
                                  + {Object.keys(othersBreakdown['Moderate (4-6)'] || {}).length - 20} more medications
                                </li>
                              )}
                              {Object.keys(othersBreakdown['Moderate (4-6)'] || {}).length === 0 && (
                                <li className="text-[10px] text-muted-foreground italic">No details available</li>
                              )}
                            </ul>
                          </PopoverContent>
                        </Popover>
                      ) : (
                        <span className="w-16 sm:w-20 truncate font-medium text-foreground">Others</span>
                      )}
                      <div className="flex-1 h-1.5 rounded-full bg-secondary overflow-hidden">
                        <div className="h-full rounded-full bg-[#F59E0B]" style={{ width: `${getPct(moderateOthers, step2Count)}%` }} />
                      </div>
                      <span className="w-14 text-right font-semibold text-foreground">
                        {moderateOthers} <span className="text-[9px] text-muted-foreground">({getPct(moderateOthers, step2Count)}%)</span>
                      </span>
                    </div>

                    <div className="text-[9px] font-semibold text-[#F59E0B]">
                      % of all patients: {moderatePct}%
                    </div>
                  </div>
                  <div className="flex flex-col items-center justify-center p-2 border-t md:border-t-0 md:border-l border-border min-w-[80px] shrink-0 w-full md:w-auto">
                    <span className="text-[8px] text-muted-foreground uppercase font-bold tracking-wider">Total Patients</span>
                    <div className="flex items-center gap-1 mt-0.5">
                      <span className="text-lg font-extrabold text-foreground">{step2Count}</span>
                      <Users className="h-3.5 w-3.5 text-muted-foreground" />
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* STEP 1 - NON-OPIOIDS */}
            <div className="relative z-10 w-[90%] sm:w-[82%] mx-auto my-2">

              
              {/* Step Badge */}
              <div className="absolute -left-4 sm:-left-5 top-1/2 -translate-y-1/2 w-8 h-8 sm:w-10 sm:h-10 rounded-full flex items-center justify-center text-white font-extrabold text-xs sm:text-base shadow-md z-20 bg-[#10B981]">
                1
              </div>

              {/* Card */}
              <div className="relative z-10 rounded-xl border border-emerald-200/60 dark:border-emerald-900/30 bg-card shadow-sm overflow-hidden flex flex-col">
                <div className="pl-6 pr-4 py-2 text-white font-bold text-center text-[10px] sm:text-xs md:text-sm tracking-wide uppercase bg-[#10B981]">
                  STEP 1 – NON-OPIOIDS
                </div>
                <div className="pl-6 pr-4 py-4 flex flex-col md:flex-row gap-4 items-center justify-between">
                  <div className="w-10 h-10 rounded-full flex-shrink-0 flex items-center justify-center bg-emerald-50 dark:bg-emerald-900/20">
                    <Pill className="h-5 w-5 text-[#10B981]" />
                  </div>
                  <div className="flex-1 w-full space-y-2">
                    <div className="text-[10px] font-semibold text-emerald-600 dark:text-emerald-400">
                      Pain Score: 1 – 3
                    </div>
                    
                    {/* Paracetamol */}
                    <div className="flex items-center gap-3 text-[10px] sm:text-xs">
                      <span className="w-16 sm:w-20 truncate font-medium text-foreground">Paracetamol</span>
                      <div className="flex-1 h-1.5 rounded-full bg-secondary overflow-hidden">
                        <div className="h-full rounded-full bg-[#10B981]" style={{ width: `${getPct(paracetamol, step1Count)}%` }} />
                      </div>
                      <span className="w-14 text-right font-semibold text-foreground">
                        {paracetamol} <span className="text-[9px] text-muted-foreground">({getPct(paracetamol, step1Count)}%)</span>
                      </span>
                    </div>

                    {/* Ibuprofen */}
                    <div className="flex items-center gap-3 text-[10px] sm:text-xs">
                      <span className="w-16 sm:w-20 truncate font-medium text-foreground">Ibuprofen</span>
                      <div className="flex-1 h-1.5 rounded-full bg-secondary overflow-hidden">
                        <div className="h-full rounded-full bg-[#10B981]" style={{ width: `${getPct(ibuprofen, step1Count)}%` }} />
                      </div>
                      <span className="w-14 text-right font-semibold text-foreground">
                        {ibuprofen} <span className="text-[9px] text-muted-foreground">({getPct(ibuprofen, step1Count)}%)</span>
                      </span>
                    </div>

                    {/* Diclofenac */}
                    <div className="flex items-center gap-3 text-[10px] sm:text-xs">
                      <span className="w-16 sm:w-20 truncate font-medium text-foreground">Diclofenac</span>
                      <div className="flex-1 h-1.5 rounded-full bg-secondary overflow-hidden">
                        <div className="h-full rounded-full bg-[#10B981]" style={{ width: `${getPct(diclofenac, step1Count)}%` }} />
                      </div>
                      <span className="w-14 text-right font-semibold text-foreground">
                        {diclofenac} <span className="text-[9px] text-muted-foreground">({getPct(diclofenac, step1Count)}%)</span>
                      </span>
                    </div>

                    {/* Others */}
                    <div className="flex items-center gap-3 text-[10px] sm:text-xs">
                      {mildOthers > 0 ? (
                        <Popover>
                          <PopoverTrigger asChild>
                            <span className="w-16 sm:w-20 truncate font-medium text-foreground border-b border-dashed border-muted-foreground/40 hover:text-[#10B981] transition-colors cursor-pointer select-none">
                              Others
                            </span>
                          </PopoverTrigger>
                          <PopoverContent className="w-64 rounded-xl border border-border bg-popover p-3 shadow-xl text-left z-50" align="start" side="top" sideOffset={8}>
                            <div className="font-bold text-xs border-b border-border pb-1.5 mb-1.5 text-foreground flex items-center justify-between">
                              <span>Medications in "Others"</span>
                              <span className="text-[10px] font-normal text-emerald-500">Step 1</span>
                            </div>
                            <ul className="space-y-1.5 max-h-40 overflow-y-auto pr-1">
                              {Object.entries(othersBreakdown['Mild (1-3)'] || {})
                                .sort((a, b) => b[1] - a[1])
                                .slice(0, 20)
                                .map(([med, count]) => (
                                  <li key={med} className="flex justify-between items-center text-[10px]">
                                    <span className="capitalize text-muted-foreground truncate max-w-[180px]">{med}</span>
                                    <span className="font-bold text-foreground bg-secondary/80 px-1.5 py-0.5 rounded text-[9px]">{count}</span>
                                  </li>
                                ))
                              }
                              {Object.keys(othersBreakdown['Mild (1-3)'] || {}).length > 20 && (
                                <li className="text-[9px] text-muted-foreground italic text-center pt-1 border-t border-border/50">
                                  + {Object.keys(othersBreakdown['Mild (1-3)'] || {}).length - 20} more medications
                                </li>
                              )}
                              {Object.keys(othersBreakdown['Mild (1-3)'] || {}).length === 0 && (
                                <li className="text-[10px] text-muted-foreground italic">No details available</li>
                              )}
                            </ul>
                          </PopoverContent>
                        </Popover>
                      ) : (
                        <span className="w-16 sm:w-20 truncate font-medium text-foreground">Others</span>
                      )}
                      <div className="flex-1 h-1.5 rounded-full bg-secondary overflow-hidden">
                        <div className="h-full rounded-full bg-[#10B981]" style={{ width: `${getPct(mildOthers, step1Count)}%` }} />
                      </div>
                      <span className="w-14 text-right font-semibold text-foreground">
                        {mildOthers} <span className="text-[9px] text-muted-foreground">({getPct(mildOthers, step1Count)}%)</span>
                      </span>
                    </div>

                    <div className="text-[9px] font-semibold text-[#10B981]">
                      % of all patients: {mildPct}%
                    </div>
                  </div>
                  <div className="flex flex-col items-center justify-center p-2 border-t md:border-t-0 md:border-l border-border min-w-[80px] shrink-0 w-full md:w-auto">
                    <span className="text-[8px] text-muted-foreground uppercase font-bold tracking-wider">Total Patients</span>
                    <div className="flex items-center gap-1 mt-0.5">
                      <span className="text-lg font-extrabold text-foreground">{step1Count}</span>
                      <Users className="h-3.5 w-3.5 text-muted-foreground" />
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* Bottom block legend */}
            <div className="mt-6 grid grid-cols-3 rounded-lg overflow-hidden border border-border text-center text-[10px] font-bold shadow-sm select-none z-10 bg-background/50 backdrop-blur-sm">
              <div className="bg-emerald-50/50 dark:bg-emerald-950/10 text-emerald-700 dark:text-emerald-400 py-2 sm:py-2.5 border-r border-border">
                MILD PAIN <span className="block sm:inline font-normal text-[8px] sm:text-[9px] opacity-80">(1 – 3)</span>
              </div>
              <div className="bg-amber-50/50 dark:bg-amber-950/10 text-amber-700 dark:text-amber-400 py-2 sm:py-2.5 border-r border-border">
                MODERATE PAIN <span className="block sm:inline font-normal text-[8px] sm:text-[9px] opacity-80">(4 – 6)</span>
              </div>
              <div className="bg-rose-50/50 dark:bg-rose-950/10 text-rose-700 dark:text-rose-400 py-2 sm:py-2.5">
                SEVERE PAIN <span className="block sm:inline font-normal text-[8px] sm:text-[9px] opacity-80">(7 – 10)</span>
              </div>
            </div>

          </div>
        </div>
      )}
    </ChartCard>
  );
}
