import { useState } from 'react';
import { Download, FileText, FileSpreadsheet } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';
import { format } from 'date-fns';

export function ExportButton({ data, dateRange, viewType = 'patient', className }) {
  const [isExporting, setIsExporting] = useState(false);

  const exportToPDF = () => {
    setIsExporting(true);
    try {
      const doc = new jsPDF();

      // Title
      doc.setFontSize(20);
      const title = viewType === 'patient' ? 'Patient Analytics Report' : 'Form Analytics Report';
      doc.text(title, 14, 22);

      // Date range
      doc.setFontSize(10);
      doc.setTextColor(100);
      const dateRangeText = dateRange?.from && dateRange?.to
        ? `Period: ${format(dateRange.from, 'MMM d, yyyy')} - ${format(dateRange.to, 'MMM d, yyyy')}`
        : `Generated: ${format(new Date(), 'PPP')}`;
      doc.text(dateRangeText, 14, 30);

      // Summary statistics
      doc.setFontSize(14);
      doc.setTextColor(0);
      doc.text('Summary Statistics', 14, 42);

      if (data?.stats) {
        const statsData = viewType === 'patient' ? [
          ['Total Patients', data.stats.totalPatients || 'N/A'],
          ['New Patients', data.stats.newPatients || 'N/A'],
          ['Active Patients', data.stats.activePatients || 'N/A'],
          ['Total Forms', data.stats.totalForms || 'N/A'],
          ['Form Completion Rate', data.stats.formCompletionRate ? `${data.stats.formCompletionRate}%` : 'N/A'],
          ['Average Response Time', data.stats.avgResponseTime || 'N/A'],
        ] : [
          ['Total Forms', data.stats.totalForms || 'N/A'],
          ['Total Submissions', data.stats.totalSubmissions || 'N/A'],
          ['Avg Completion Rate', data.stats.avgCompletionRate || 'N/A'],
          ['Avg Completion Time', data.stats.avgCompletionTime || 'N/A'],
        ];

        autoTable(doc, {
          startY: 48,
          head: [['Metric', 'Value']],
          body: statsData,
          theme: 'grid',
          headStyles: { fillColor: [14, 165, 233] },
        });
      }

      // Patient-specific data
      if (viewType === 'patient') {
        // Age distribution
        if (data?.ageDistribution && data.ageDistribution.length > 0) {
          const finalY = doc.lastAutoTable.finalY || 48;
          doc.setFontSize(14);
          doc.text('Age Distribution', 14, finalY + 15);

          autoTable(doc, {
            startY: finalY + 20,
            head: [['Age Group', 'Count']],
            body: data.ageDistribution.map(item => [item.ageGroup, item.count]),
            theme: 'grid',
            headStyles: { fillColor: [14, 165, 233] },
          });
        }

        // Gender distribution
        if (data?.genderDistribution && data.genderDistribution.length > 0) {
          const finalY = doc.lastAutoTable.finalY || 100;
          doc.setFontSize(14);
          doc.text('Gender Distribution', 14, finalY + 15);

          autoTable(doc, {
            startY: finalY + 20,
            head: [['Gender', 'Count']],
            body: data.genderDistribution.map(item => [item.name, item.value]),
            theme: 'grid',
            headStyles: { fillColor: [14, 165, 233] },
          });
        }
      }

      // Form-specific data
      if (viewType === 'form') {
        // Status breakdown
        if (data?.statusBreakdown && data.statusBreakdown.length > 0) {
          const finalY = doc.lastAutoTable.finalY || 48;
          doc.setFontSize(14);
          doc.text('Submission Status Breakdown', 14, finalY + 15);

          autoTable(doc, {
            startY: finalY + 20,
            head: [['Status', 'Count', 'Percentage']],
            body: data.statusBreakdown.map(item => [
              item.status.charAt(0).toUpperCase() + item.status.slice(1),
              item.count,
              `${item.percentage}%`
            ]),
            theme: 'grid',
            headStyles: { fillColor: [14, 165, 233] },
          });
        }

        // Top forms
        if (data?.topForms && data.topForms.length > 0) {
          const finalY = doc.lastAutoTable.finalY || 100;
          doc.setFontSize(14);
          doc.text('Top Forms by Usage', 14, finalY + 15);

          autoTable(doc, {
            startY: finalY + 20,
            head: [['Form Name', 'Submissions']],
            body: data.topForms.map(form => [form.form_name, form.submissions]),
            theme: 'grid',
            headStyles: { fillColor: [14, 165, 233] },
          });
        }
      }

      // Save the PDF
      const fileName = `analytics-report-${format(new Date(), 'yyyy-MM-dd')}.pdf`;
      doc.save(fileName);
    } catch (error) {
      console.error('Error generating PDF:', error);
      alert('Failed to generate PDF report');
    } finally {
      setIsExporting(false);
    }
  };

  const exportToCSV = () => {
    setIsExporting(true);
    try {
      let csvContent = "data:text/csv;charset=utf-8,";

      // Add header
      csvContent += "Saranam - Analytics Report\n";
      const dateRangeText = dateRange?.from && dateRange?.to
        ? `Period: ${format(dateRange.from, 'MMM d, yyyy')} - ${format(dateRange.to, 'MMM d, yyyy')}`
        : `Generated: ${format(new Date(), 'PPP')}`;
      csvContent += dateRangeText + "\n\n";

      // Summary statistics
      if (data?.stats) {
        csvContent += "Summary Statistics\n";
        csvContent += "Metric,Value\n";

        if (viewType === 'patient') {
          csvContent += `Total Patients,${data.stats.totalPatients || 'N/A'}\n`;
          csvContent += `New Patients,${data.stats.newPatients || 'N/A'}\n`;
          csvContent += `Active Patients,${data.stats.activePatients || 'N/A'}\n`;
          csvContent += `Total Forms,${data.stats.totalForms || 'N/A'}\n`;
          csvContent += `Form Completion Rate,${data.stats.formCompletionRate ? data.stats.formCompletionRate + '%' : 'N/A'}\n`;
          csvContent += `Average Response Time,${data.stats.avgResponseTime || 'N/A'}\n\n`;
        } else {
          csvContent += `Total Forms,${data.stats.totalForms || 'N/A'}\n`;
          csvContent += `Total Submissions,${data.stats.totalSubmissions || 'N/A'}\n`;
          csvContent += `Avg Completion Rate,${data.stats.avgCompletionRate || 'N/A'}\n`;
          csvContent += `Avg Completion Time,${data.stats.avgCompletionTime || 'N/A'}\n\n`;
        }
      }

      // Patient-specific data
      if (viewType === 'patient') {
        // Age distribution
        if (data?.ageDistribution && data.ageDistribution.length > 0) {
          csvContent += "Age Distribution\n";
          csvContent += "Age Group,Count\n";
          data.ageDistribution.forEach(item => {
            csvContent += `${item.ageGroup},${item.count}\n`;
          });
          csvContent += "\n";
        }

        // Gender distribution
        if (data?.genderDistribution && data.genderDistribution.length > 0) {
          csvContent += "Gender Distribution\n";
          csvContent += "Gender,Count\n";
          data.genderDistribution.forEach(item => {
            csvContent += `${item.name},${item.value}\n`;
          });
        }
      }

      // Form-specific data
      if (viewType === 'form') {
        // Status breakdown
        if (data?.statusBreakdown && data.statusBreakdown.length > 0) {
          csvContent += "Submission Status Breakdown\n";
          csvContent += "Status,Count,Percentage\n";
          data.statusBreakdown.forEach(item => {
            csvContent += `${item.status.charAt(0).toUpperCase() + item.status.slice(1)},${item.count},${item.percentage}%\n`;
          });
          csvContent += "\n";
        }

        // Top forms
        if (data?.topForms && data.topForms.length > 0) {
          csvContent += "Top Forms by Usage\n";
          csvContent += "Form Name,Submissions\n";
          data.topForms.forEach(form => {
            csvContent += `${form.form_name},${form.submissions}\n`;
          });
        }
      }

      // Create download link
      const encodedUri = encodeURI(csvContent);
      const link = document.createElement("a");
      link.setAttribute("href", encodedUri);
      link.setAttribute("download", `analytics-report-${format(new Date(), 'yyyy-MM-dd')}.csv`);
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    } catch (error) {
      console.error('Error generating CSV:', error);
      alert('Failed to generate CSV report');
    } finally {
      setIsExporting(false);
    }
  };

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="outline" className={className} disabled={isExporting}>
          <Download className="h-4 w-4 mr-2" />
          {isExporting ? 'Exporting...' : 'Export'}
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-48">
        <DropdownMenuLabel>Export as</DropdownMenuLabel>
        <DropdownMenuSeparator />
        <DropdownMenuItem onClick={exportToPDF} className="cursor-pointer">
          <FileText className="h-4 w-4 mr-2" />
          PDF Report
        </DropdownMenuItem>
        <DropdownMenuItem onClick={exportToCSV} className="cursor-pointer">
          <FileSpreadsheet className="h-4 w-4 mr-2" />
          CSV Data
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
