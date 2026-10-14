import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import submissionsApi from '../../api/submissions';
import formsApi from '../../api/forms';
import { Search, Filter, Download, Eye, FileText, Calendar, Edit, Trash2, AlertCircle } from 'lucide-react';
import { format } from 'date-fns';
import { useAuth } from '../../context/AuthContext';

export default function SubmissionsList() {
  const { user } = useAuth();
  const [submissions, setSubmissions] = useState([]);
  const [forms, setForms] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedForm, setSelectedForm] = useState('');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [deleteConfirm, setDeleteConfirm] = useState(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState('');

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      const [submissionsData, formsData] = await Promise.all([
        submissionsApi.getAllSubmissions(),
        formsApi.getAllForms(),
      ]);
      setSubmissions(submissionsData.submissions || []);
      setForms(formsData.forms || []);
    } catch (err) {
      console.error('Error loading data:', err);
    } finally {
      setIsLoading(false);
    }
  };

  const handleExport = async () => {
    if (!selectedForm) {
      alert('Please select a form to export');
      return;
    }

    try {
      await submissionsApi.exportSubmissions(selectedForm);
    } catch (err) {
      alert('Failed to export submissions');
      console.error('Error exporting:', err);
    }
  };

  const handleDelete = async (submissionId) => {
    try {
      setIsDeleting(true);
      setDeleteError('');
      await submissionsApi.deleteSubmission(submissionId);

      // Remove from local state
      setSubmissions((prev) => prev.filter((s) => s.id !== submissionId));
      setDeleteConfirm(null);
    } catch (err) {
      console.error('Error deleting submission:', err);
      setDeleteError(err.response?.data?.message || 'Failed to delete submission');
    } finally {
      setIsDeleting(false);
    }
  };

  // Check if user can edit submissions
  const canEdit = (submission) => {
    if (!user) return false;

    // Cannot edit old submissions without form_id
    if (!submission.form_id) return false;

    // Admins can edit all submissions
    if (user.role === 'admin') return true;

    // Data entry users can edit their own submissions
    if (user.role === 'data_entry' && submission.submitted_by === user.id) {
      return true;
    }

    // Check if user has submit_form permission
    return user.role === 'admin' || user.role === 'data_entry';
  };

  // Check if user can delete submissions
  const canDelete = () => {
    return user && user.role === 'admin';
  };

  const filteredSubmissions = submissions.filter((sub) => {
    const matchesSearch =
      !searchTerm ||
      sub.form_name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      sub.submitted_by_name?.toLowerCase().includes(searchTerm.toLowerCase());

    const matchesForm = !selectedForm || sub.form_id === selectedForm;

    const matchesDateRange =
      (!startDate || new Date(sub.created_at) >= new Date(startDate)) &&
      (!endDate || new Date(sub.created_at) <= new Date(endDate));

    return matchesSearch && matchesForm && matchesDateRange;
  });

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-foreground">Submissions</h1>
          <p className="text-muted-foreground mt-1">View and manage form submissions</p>
        </div>
        <button
          onClick={handleExport}
          disabled={!selectedForm}
          className="btn-secondary flex items-center gap-2"
        >
          <Download className="w-4 h-4" />
          Export CSV
        </button>
      </div>

      {/* Filters */}
      <div className="card space-y-4">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          {/* Search */}
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground/70" />
            <input
              type="text"
              placeholder="Search submissions..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="input pl-10"
            />
          </div>

          {/* Form Filter */}
          <select
            value={selectedForm}
            onChange={(e) => setSelectedForm(e.target.value)}
            className="input"
          >
            <option value="">All Forms</option>
            {forms.map((form) => (
              <option key={form.id} value={form.id}>
                {form.name}
              </option>
            ))}
          </select>

          {/* Date Range */}
          <input
            type="date"
            value={startDate}
            onChange={(e) => setStartDate(e.target.value)}
            className="input"
            placeholder="Start Date"
          />
          <input
            type="date"
            value={endDate}
            onChange={(e) => setEndDate(e.target.value)}
            className="input"
            placeholder="End Date"
          />
        </div>

        {/* Active Filters Summary */}
        {(searchTerm || selectedForm || startDate || endDate) && (
          <div className="flex items-center gap-2 text-sm">
            <Filter className="w-4 h-4 text-muted-foreground" />
            <span className="text-muted-foreground">
              Showing {filteredSubmissions.length} of {submissions.length} submissions
            </span>
            <button
              onClick={() => {
                setSearchTerm('');
                setSelectedForm('');
                setStartDate('');
                setEndDate('');
              }}
              className="text-primary-600 hover:text-primary-700 ml-2"
            >
              Clear filters
            </button>
          </div>
        )}
      </div>

      {/* Submissions Table */}
      {isLoading ? (
        <div className="card">
          <div className="space-y-3">
            {Array.from({ length: 5 }).map((_, i) => (
              <div key={i} className="h-16 bg-secondary rounded animate-pulse" />
            ))}
          </div>
        </div>
      ) : filteredSubmissions.length === 0 ? (
        <div className="card text-center py-12">
          <FileText className="w-16 h-16 mx-auto text-muted-foreground/70 mb-4" />
          <h3 className="text-lg font-semibold text-foreground mb-2">
            No submissions found
          </h3>
          <p className="text-muted-foreground">
            {submissions.length === 0
              ? 'No submissions have been made yet'
              : 'Try adjusting your filters'}
          </p>
        </div>
      ) : (
        <div className="card overflow-hidden">
          <div className="overflow-x-auto custom-scrollbar">
            <table className="table">
              <thead>
                <tr>
                  <th>Form Name</th>
                  <th>Submitted By</th>
                  <th>Date</th>
                  <th>Status</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {filteredSubmissions.map((submission) => (
                  <tr key={submission.id}>
                    <td>
                      <div className="flex items-center gap-2">
                        <FileText className="w-4 h-4 text-muted-foreground/70" />
                        <span className="font-medium">{submission.form_name}</span>
                      </div>
                    </td>
                    <td>{submission.submitted_by_name}</td>
                    <td>
                      <div className="flex items-center gap-2 text-muted-foreground">
                        <Calendar className="w-4 h-4" />
                        <span>
                          {submission.created_at
                            ? format(new Date(submission.created_at), 'MMM dd, yyyy')
                            : 'N/A'}
                        </span>
                      </div>
                    </td>
                    <td>
                      <span className="badge-success">{submission.status}</span>
                    </td>
                    <td>
                      <div className="flex items-center gap-2">
                        <Link
                          to={`/submissions/${submission.id}`}
                          className="btn-ghost inline-flex items-center gap-2 text-sm"
                          title="View submission"
                        >
                          <Eye className="w-4 h-4" />
                          View
                        </Link>

                        {canEdit(submission) && (
                          <Link
                            to={`/submissions/${submission.id}/edit`}
                            className="btn-ghost inline-flex items-center gap-2 text-sm text-blue-600 hover:text-blue-700"
                            title="Edit submission"
                          >
                            <Edit className="w-4 h-4" />
                            Edit
                          </Link>
                        )}

                        {canDelete() && (
                          <button
                            onClick={() => setDeleteConfirm(submission)}
                            className="btn-ghost inline-flex items-center gap-2 text-sm text-red-600 hover:text-red-700"
                            title="Delete submission"
                          >
                            <Trash2 className="w-4 h-4" />
                            Delete
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Delete Confirmation Dialog */}
      {deleteConfirm && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-card rounded-lg shadow-xl max-w-md w-full p-6">
            <div className="flex items-start gap-4">
              <div className="flex-shrink-0 w-12 h-12 rounded-full bg-red-100 flex items-center justify-center">
                <AlertCircle className="w-6 h-6 text-red-600" />
              </div>
              <div className="flex-1">
                <h3 className="text-lg font-semibold text-foreground mb-2">
                  Delete Submission
                </h3>
                <p className="text-muted-foreground mb-4">
                  Are you sure you want to delete this submission for "{deleteConfirm.form_name}"?
                  This action cannot be undone.
                </p>

                {deleteError && (
                  <div className="bg-red-50 border border-red-200 rounded-lg p-3 mb-4">
                    <div className="flex items-center gap-2 text-red-800 text-sm">
                      <AlertCircle className="w-4 h-4 flex-shrink-0" />
                      <p>{deleteError}</p>
                    </div>
                  </div>
                )}

                <div className="flex gap-3 justify-end">
                  <button
                    onClick={() => {
                      setDeleteConfirm(null);
                      setDeleteError('');
                    }}
                    disabled={isDeleting}
                    className="btn-secondary"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={() => handleDelete(deleteConfirm.id)}
                    disabled={isDeleting}
                    className="bg-red-600 hover:bg-red-700 text-white px-4 py-2 rounded-lg font-medium disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                  >
                    {isDeleting ? 'Deleting...' : 'Delete'}
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
