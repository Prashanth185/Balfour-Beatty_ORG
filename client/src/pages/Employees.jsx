import { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { UserPlus, Trash2, Edit, Users, Search } from 'lucide-react';
import api from '../api/client';
import { BackButton, PageHeader, EmployeePhoto, LoadingSpinner, EmptyState } from '../components/common';

export default function Employees() {
  const navigate = useNavigate();
  const [employees, setEmployees] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');

  const loadEmployees = () => {
    setLoading(true);
    // Employee Management reads from trad_employees — the same dataset as Dashboard.
    api.tradOrgChart.listEmployees()
      .then(setEmployees)
      .catch(console.error)
      .finally(() => setLoading(false));
  };

  useEffect(() => { loadEmployees(); }, []);

  const filteredEmployees = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    if (!q) return employees;
    return employees.filter((emp) =>
      [emp.name, emp.employee_id, emp.designation, emp.department, emp.place]
        .some((value) => String(value || '').toLowerCase().includes(q))
    );
  }, [employees, searchQuery]);

  const handleDelete = async (id, name) => {
    if (!confirm(`Delete employee "${name}"? This cannot be undone.`)) return;
    try {
      await api.tradOrgChart.deleteEmployee(id);
      setEmployees(prev => prev.filter(e => e.id !== id));
    } catch (err) {
      alert(err.message);
    }
  };

  return (
    <div>
      <BackButton to="/dashboard" label="Back to Dashboard" />
      <PageHeader
        title="Employee Management"
        subtitle={
          searchQuery.trim()
            ? `${filteredEmployees.length} of ${employees.length} employees shown`
            : `${employees.length} employees in the system`
        }
        action={
          <Link to="/employees/add" className="btn-primary flex items-center gap-2">
            <UserPlus className="w-4 h-4" /> Add Employee
          </Link>
        }
      />

      {loading ? (
        <LoadingSpinner />
      ) : employees.length === 0 ? (
        <EmptyState
          icon={Users}
          title="No employees yet"
          description="Import an Excel file via Traditional Org Chart or add employees manually."
          action={<Link to="/traditional-org-chart" className="btn-primary">Go to Traditional Org Chart</Link>}
        />
      ) : (
        <div className="card overflow-hidden p-0">
          <div className="border-b border-gray-100 p-4">
            <div className="relative max-w-md">
              <Search className="w-4 h-4 text-gray-400 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search by name, ID, designation, department, or location"
                className="w-full rounded-lg border border-gray-200 pl-10 pr-3 py-2 text-sm text-gray-700 focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
              />
            </div>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-gray-50">
                <tr className="text-left text-gray-500">
                  <th className="px-6 py-3 font-medium">Employee</th>
                  <th className="px-6 py-3 font-medium">ID</th>
                  <th className="px-6 py-3 font-medium">Designation</th>
                  <th className="px-6 py-3 font-medium">Department</th>
                  <th className="px-6 py-3 font-medium">Location</th>
                  <th className="px-6 py-3 font-medium">Actions</th>
                </tr>
              </thead>
              <tbody>
                {filteredEmployees.length > 0 ? (
                  filteredEmployees.map((emp) => (
                    <tr key={emp.id} className="border-t border-gray-100 hover:bg-gray-50">
                      <td className="px-6 py-3">
                        <button
                          type="button"
                          onClick={() => navigate(`/trad-employee/${emp.id}`)}
                          className="flex items-center gap-3 text-left"
                        >
                          <EmployeePhoto employee={emp} size="sm" />
                          <span className="font-medium text-gray-900 hover:text-primary-600">{emp.name}</span>
                        </button>
                      </td>
                      <td className="px-6 py-3 text-gray-600">{emp.employee_id}</td>
                      <td className="px-6 py-3 text-gray-600">{emp.designation}</td>
                      <td className="px-6 py-3 text-gray-600">{emp.department}</td>
                      <td className="px-6 py-3 text-gray-600">{emp.place || emp.location || '—'}</td>
                      <td className="px-6 py-3">
                        <div className="flex items-center gap-2">
                          <button
                            type="button"
                            onClick={() => navigate(`/trad-employee/${emp.id}`)}
                            className="p-1.5 text-gray-400 hover:text-primary-600 rounded"
                            title="View / Edit"
                          >
                            <Edit className="w-4 h-4" />
                          </button>
                          <button
                            onClick={() => handleDelete(emp.id, emp.name)}
                            className="p-1.5 text-gray-400 hover:text-red-600 rounded"
                            title="Delete"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))
                ) : (
                  <tr className="border-t border-gray-100">
                    <td colSpan="6" className="px-6 py-8 text-center text-sm text-gray-500">
                      No employees match your search.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
