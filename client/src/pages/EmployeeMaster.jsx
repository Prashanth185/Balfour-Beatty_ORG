import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Search, Filter, Download, ChevronLeft, ChevronRight, ArrowUpDown } from 'lucide-react';
import * as XLSX from 'xlsx';
import api from '../api/client';
import { PageHeader, LoadingSpinner } from '../components/common';

// ── Shared date formatter — handles Excel serials, ISO dates, DD-MM-YYYY ──────
const MONTHS_SHORT = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
function formatDate(raw) {
  if (!raw) return '—';
  const s = String(raw).trim();
  if (!s || s === '0') return '—';
  // Excel serial number
  const n = Number(s);
  if (!isNaN(n) && n > 1000 && n < 200000) {
    const dt = new Date(new Date(1900, 0, 1).getTime() + (n - 2) * 86400000);
    return `${String(dt.getDate()).padStart(2,'0')}-${MONTHS_SHORT[dt.getMonth()]}-${String(dt.getFullYear()).slice(-2)}`;
  }
  // ISO or standard date string
  const dt = new Date(s);
  if (!isNaN(dt.getTime())) {
    return `${String(dt.getDate()).padStart(2,'0')}-${MONTHS_SHORT[dt.getMonth()]}-${String(dt.getFullYear()).slice(-2)}`;
  }
  // DD-MM-YYYY or DD/MM/YYYY
  const m = s.match(/^(\d{2})[-/](\d{2})[-/](\d{4})$/);
  if (m) {
    const dt2 = new Date(Number(m[3]), Number(m[2]) - 1, Number(m[1]));
    if (!isNaN(dt2.getTime()))
      return `${String(dt2.getDate()).padStart(2,'0')}-${MONTHS_SHORT[dt2.getMonth()]}-${String(dt2.getFullYear()).slice(-2)}`;
  }
  return s;
}

const DATE_KEYS = new Set([
  'dob',
  'date_of_join_previous_company',
  'date_of_join_in_bb',
  'join_date',
  'date_of_exit',
]);

// Normalise short-code gender to display label
function displayGender(g) {
  if (!g) return '-';
  const v = String(g).trim().toUpperCase();
  if (v === 'M' || v === 'MALE') return 'Male';
  if (v === 'F' || v === 'FEMALE') return 'Female';
  return g;
}

// Normalise Excel status values to display label
function displayStatus(s) {
  if (!s) return 'Active';
  const v = String(s).trim();
  if (v === 'Live' || v === 'Active') return 'Active';
  if (v === 'Leaver' || v === 'Exited') return 'Exited';
  return v;
}

function statusBadgeClass(s) {
  const d = displayStatus(s);
  if (d === 'Active') return 'bg-green-100 text-green-800';
  if (d === 'Exited') return 'bg-red-100 text-red-800';
  return 'bg-gray-100 text-gray-800';
}

// All columns required per spec
const COLUMNS = [
  { key: 'employee_id',                          label: 'Employee ID',                        sortable: true  },
  { key: 'name',                                 label: 'Employee Name',                      sortable: true  },
  { key: 'gender',                               label: 'Gender',                             sortable: true  },
  { key: 'designation',                          label: 'Designation',                        sortable: true  },
  { key: 'department',                           label: 'Department',                         sortable: false },
  { key: 'manager_employee_id',                  label: 'Reports To Employee ID',             sortable: false },
  { key: 'place',                                label: 'Place',                              sortable: true  },
  { key: 'date_of_join_previous_company',        label: 'Date of Join (Prev Company)',        sortable: false },
  { key: 'date_of_join_in_bb',                   label: 'Date of Join in BB',                 sortable: false },
  { key: 'join_date',                            label: 'Join Date',                          sortable: false },
  { key: 'date_of_exit',                         label: 'Date of Exit',                       sortable: false },
  { key: 'service_duration',                     label: 'Service Duration',                   sortable: false },
  { key: 'remarks',                              label: 'Remarks',                            sortable: false },
  { key: 'status',                               label: 'Status',                             sortable: true  },
  { key: 'service_in_bb',                        label: 'Service in BB',                      sortable: false },
  { key: 'went_to_company',                      label: 'Went To Company',                    sortable: false },
  { key: 'location_of_went_to_company',          label: 'Location (Went To)',                 sortable: false },
  { key: 'currently_working_company',            label: 'Currently Working Company',          sortable: false },
  { key: 'location_of_currently_working_company',label: 'Location (Current)',                 sortable: false },
  { key: 'education',                            label: 'Education',                          sortable: true  },
  { key: 'dob',                                  label: 'DOB',                                sortable: false },
  { key: 'immediate_previous_company',           label: 'Immediate Previous Company',         sortable: false },
];

export default function EmployeeMaster() {
  const [employees, setEmployees]       = useState([]);
  const [filters,   setFilters]         = useState(null);
  const [loading,   setLoading]         = useState(true);
  const [search,    setSearch]          = useState('');
  const [selectedFilters, setSelectedFilters] = useState({
    department:              'All',
    gender:                  'All',
    status:                  'All',
    place:                   'All',
    education:               'All',
    serviceDuration:         'All',
    serviceInBB:             'All',
    joinDateRange:           'All',
    exitDateRange:           'All',
    currentCompany:          'All',
    immediatePreviousCompany:'All',
  });
  const [pagination, setPagination] = useState({ page: 1, limit: 50, total: 0, totalPages: 0 });
  const [sortBy,     setSortBy]     = useState('name');
  const [sortOrder,  setSortOrder]  = useState('ASC');
  const [showFilters,setShowFilters]= useState(false);

  useEffect(() => { loadFilters(); }, []);
  useEffect(() => { loadEmployees(); }, [search, selectedFilters, pagination.page, sortBy, sortOrder]);

  const loadFilters = async () => {
    try {
      const token = localStorage.getItem('orms_token');
      const res = await fetch('/api/employees/filters?source=trad', {
        headers: { Authorization: `Bearer ${token}` },
      });
      setFilters(await res.json());
    }
    catch (e) { console.error('Failed to load filters:', e); }
  };

  const loadEmployees = async () => {
    setLoading(true);
    try {
      const token = localStorage.getItem('orms_token');
      const params = new URLSearchParams({
        search,
        ...selectedFilters,
        source: 'trad',
        page:      pagination.page,
        limit:     pagination.limit,
        sortBy,
        sortOrder,
      });
      const res  = await fetch(`/api/employees/master?${params}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await res.json();
      setEmployees(data.employees || []);
      setPagination(data.pagination);
    } catch (e) {
      console.error('Failed to load employees:', e);
    } finally {
      setLoading(false);
    }
  };

  const handleFilterChange = (key, value) => {
    setSelectedFilters(prev => ({ ...prev, [key]: value }));
    setPagination(prev => ({ ...prev, page: 1 }));
  };

  const handleSort = (col) => {
    if (!col.sortable) return;
    if (sortBy === col.key) setSortOrder(o => o === 'ASC' ? 'DESC' : 'ASC');
    else { setSortBy(col.key); setSortOrder('ASC'); }
  };

  const handleExport = async (format) => {
    // Fetch ALL matching rows (no pagination) for export
    const token = localStorage.getItem('orms_token');
    const params = new URLSearchParams({
      search,
      ...selectedFilters,
      source: 'trad',
      page: 1,
      limit: 10000,
      sortBy,
      sortOrder,
    });
    let rows = [];
    try {
      const res  = await fetch(`/api/employees/master?${params}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await res.json();
      rows = data.employees || [];
    } catch (e) {
      console.error('Export fetch failed:', e);
      return;
    }

    // Build flat export rows using all 22 columns
    const exportRows = rows.map(emp => ({
      'Employee ID':                             emp.employee_id                           || '',
      'Employee Name':                           emp.name                                  || '',
      'Gender':                                  displayGender(emp.gender),
      'Designation':                             emp.designation                           || '',
      'Department':                              emp.department                            || '',
      'Reports To Employee ID':                  emp.manager_employee_id                   || '',
      'Place':                                   emp.place                                 || '',
      'Date of Join (Previous Company)':         formatDate(emp.date_of_join_previous_company),
      'Date of Join in BB':                      formatDate(emp.date_of_join_in_bb),
      'Join Date':                               formatDate(emp.join_date),
      'Date of Exit':                            formatDate(emp.date_of_exit),
      'Service Duration':                        emp.service_duration                      || '',
      'Remarks':                                 emp.remarks                               || '',
      'Status':                                  displayStatus(emp.status),
      'Service in BB':                           emp.service_in_bb                         || '',
      'Went To Company':                         emp.went_to_company                       || '',
      'Location of Went To Company':             emp.location_of_went_to_company           || '',
      'Currently Working Company':               emp.currently_working_company             || '',
      'Location of Currently Working Company':   emp.location_of_currently_working_company || '',
      'Education':                               emp.education                             || '',
      'DOB':                                     formatDate(emp.dob),
      'Immediate Previous Company':              emp.immediate_previous_company            || '',
    }));

    if (format === 'excel') {
      const ws = XLSX.utils.json_to_sheet(exportRows);
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, 'Employee Master Data');
      XLSX.writeFile(wb, 'employee_master_data.xlsx');
    } else {
      // CSV — manual construction to handle commas/quotes
      if (exportRows.length === 0) return;
      const headers = Object.keys(exportRows[0]);
      const escape  = (v) => `"${String(v).replace(/"/g, '""')}"`;
      const csv     = [
        headers.map(escape).join(','),
        ...exportRows.map(row => headers.map(h => escape(row[h])).join(',')),
      ].join('\n');
      const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
      const url  = URL.createObjectURL(blob);
      const a    = document.createElement('a');
      a.href     = url;
      a.download = 'employee_master_data.csv';
      a.click();
      URL.revokeObjectURL(url);
    }
  };

  // Render a cell value, applying normalisation for special fields
  const renderCell = (emp, col) => {
    const val = emp[col.key];
    if (col.key === 'employee_id') {
      return <Link to={`/trad-employee/${emp.id}`} className="text-primary-600 hover:underline">{val || '-'}</Link>;
    }
    if (col.key === 'gender')  return displayGender(val);
    if (col.key === 'status')  return (
      <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${statusBadgeClass(val)}`}>
        {displayStatus(val)}
      </span>
    );
    if (DATE_KEYS.has(col.key)) return formatDate(val);
    return val || '-';
  };

  if (loading && employees.length === 0) return <LoadingSpinner message="Loading employee master data..." />;

  return (
    <div>
      <PageHeader title="Employee Master Data" subtitle="View and filter all employees" />

      {/* ── Search & Actions ── */}
      <div className="card mb-4">
        <div className="flex flex-col sm:flex-row gap-4 items-center">
          <div className="relative flex-1 w-full">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 w-5 h-5" />
            <input
              type="text"
              placeholder="Search by name, employee ID, designation, department…"
              value={search}
              onChange={e => setSearch(e.target.value)}
              className="w-full pl-10 pr-4 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500"
            />
          </div>
          <button
            onClick={() => setShowFilters(f => !f)}
            className="flex items-center gap-2 px-4 py-2 border border-gray-200 rounded-lg hover:bg-gray-50"
          >
            <Filter className="w-5 h-5" />
            Filters
          </button>
          <div className="flex gap-2">
            <button onClick={() => handleExport('excel')} className="flex items-center gap-2 px-4 py-2 bg-green-500 text-white rounded-lg hover:bg-green-600">
              <Download className="w-5 h-5" /> Excel
            </button>
            <button onClick={() => handleExport('csv')} className="flex items-center gap-2 px-4 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600">
              <Download className="w-5 h-5" /> CSV
            </button>
          </div>
        </div>

        {/* ── Filter Panel ── */}
        {showFilters && filters && (
          <div className="mt-4 pt-4 border-t border-gray-200">
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Department</label>
                <select value={selectedFilters.department} onChange={e => handleFilterChange('department', e.target.value)}
                  className="w-full px-3 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500">
                  <option value="All">All Departments</option>
                  {filters.departments?.map(d => <option key={d} value={d}>{d}</option>)}
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Gender</label>
                <select value={selectedFilters.gender} onChange={e => handleFilterChange('gender', e.target.value)}
                  className="w-full px-3 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500">
                  <option value="All">All</option>
                  <option value="Male">Male</option>
                  <option value="Female">Female</option>
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Status</label>
                <select value={selectedFilters.status} onChange={e => handleFilterChange('status', e.target.value)}
                  className="w-full px-3 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500">
                  <option value="All">All</option>
                  <option value="Active">Active / Live</option>
                  <option value="Exited">Exited / Leaver</option>
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Place</label>
                <select value={selectedFilters.place} onChange={e => handleFilterChange('place', e.target.value)}
                  className="w-full px-3 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500">
                  <option value="All">All Places</option>
                  {filters.places?.map(p => <option key={p} value={p}>{p}</option>)}
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Education</label>
                <select value={selectedFilters.education} onChange={e => handleFilterChange('education', e.target.value)}
                  className="w-full px-3 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500">
                  <option value="All">All</option>
                  {filters.educations?.map(e => <option key={e} value={e}>{e}</option>)}
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Service Duration</label>
                <select value={selectedFilters.serviceDuration} onChange={e => handleFilterChange('serviceDuration', e.target.value)}
                  className="w-full px-3 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500">
                  <option value="All">All</option>
                  <option value="0-2 Years">0–2 Years</option>
                  <option value="2-5 Years">2–5 Years</option>
                  <option value="5-10 Years">5–10 Years</option>
                  <option value="10-15 Years">10–15 Years</option>
                  <option value="15+ Years">15+ Years</option>
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Service in BB</label>
                <select value={selectedFilters.serviceInBB} onChange={e => handleFilterChange('serviceInBB', e.target.value)}
                  className="w-full px-3 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500">
                  <option value="All">All</option>
                  <option value="0-1 Year">0–1 Year</option>
                  <option value="1-3 Years">1–3 Years</option>
                  <option value="3-5 Years">3–5 Years</option>
                  <option value="5-10 Years">5–10 Years</option>
                  <option value="10+ Years">10+ Years</option>
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Join Date</label>
                <select value={selectedFilters.joinDateRange} onChange={e => handleFilterChange('joinDateRange', e.target.value)}
                  className="w-full px-3 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500">
                  <option value="All">All</option>
                  <option value="Last 30 Days">Last 30 Days</option>
                  <option value="Last 6 Months">Last 6 Months</option>
                  <option value="Last 1 Year">Last 1 Year</option>
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Exit Date</label>
                <select value={selectedFilters.exitDateRange} onChange={e => handleFilterChange('exitDateRange', e.target.value)}
                  className="w-full px-3 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500">
                  <option value="All">All</option>
                  <option value="Last 30 Days">Last 30 Days</option>
                  <option value="Last 6 Months">Last 6 Months</option>
                  <option value="Last 1 Year">Last 1 Year</option>
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Current Company</label>
                <select value={selectedFilters.currentCompany} onChange={e => handleFilterChange('currentCompany', e.target.value)}
                  className="w-full px-3 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500">
                  <option value="All">All</option>
                  {filters.currentCompanies?.map(c => <option key={c} value={c}>{c}</option>)}
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Immediate Previous Company</label>
                <select value={selectedFilters.immediatePreviousCompany} onChange={e => handleFilterChange('immediatePreviousCompany', e.target.value)}
                  className="w-full px-3 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500">
                  <option value="All">All</option>
                  {filters.immediatePreviousCompanies?.map(c => <option key={c} value={c}>{c}</option>)}
                </select>
              </div>

            </div>
          </div>
        )}
      </div>

      {/* ── Employee Table (all 22 columns) ── */}
      <div className="card overflow-x-auto">
        <table className="w-full text-sm whitespace-nowrap">
          <thead>
            <tr className="border-b border-gray-200 text-left text-gray-500">
              {COLUMNS.map(col => (
                <th
                  key={col.key}
                  className={`pb-3 pr-4 font-medium ${col.sortable ? 'cursor-pointer hover:text-gray-700' : ''}`}
                  onClick={() => handleSort(col)}
                >
                  <div className="flex items-center gap-1">
                    {col.label}
                    {col.sortable && sortBy === col.key && <ArrowUpDown className="w-3 h-3" />}
                  </div>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {employees.map(emp => (
              <tr key={emp.id} className="border-b border-gray-50 hover:bg-gray-50">
                {COLUMNS.map(col => (
                  <td key={col.key} className="py-2 pr-4 align-top">
                    {renderCell(emp, col)}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>

        {employees.length === 0 && (
          <div className="text-center py-12 text-gray-500">
            No employees found matching your criteria
          </div>
        )}
      </div>

      {/* ── Pagination ── */}
      {pagination.totalPages > 1 && (
        <div className="flex items-center justify-between mt-4">
          <div className="text-sm text-gray-500">
            Showing {((pagination.page - 1) * pagination.limit) + 1}–{Math.min(pagination.page * pagination.limit, pagination.total)} of {pagination.total} employees
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setPagination(p => ({ ...p, page: p.page - 1 }))}
              disabled={pagination.page === 1}
              className="flex items-center gap-1 px-3 py-2 border border-gray-200 rounded-lg hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <ChevronLeft className="w-4 h-4" /> Previous
            </button>
            <span className="px-3 py-2 text-sm">Page {pagination.page} of {pagination.totalPages}</span>
            <button
              onClick={() => setPagination(p => ({ ...p, page: p.page + 1 }))}
              disabled={pagination.page === pagination.totalPages}
              className="flex items-center gap-1 px-3 py-2 border border-gray-200 rounded-lg hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Next <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
