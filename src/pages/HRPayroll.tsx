import React, { useState, useEffect } from 'react';
import { 
  Users, 
  UserPlus, 
  Clock, 
  Calendar, 
  DollarSign, 
  FileText, 
  Award, 
  CheckCircle2, 
  XCircle, 
  AlertCircle, 
  Search, 
  Filter, 
  Download, 
  Printer, 
  Plus, 
  Trash2, 
  Edit3, 
  Eye, 
  ArrowUpRight, 
  ArrowDownRight, 
  Check, 
  RefreshCw,
  Building,
  CreditCard,
  Phone,
  Mail,
  ShieldCheck,
  Briefcase
} from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../components/ui/card';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Badge } from '../components/ui/badge';
import { ScrollArea } from '../components/ui/scroll-area';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from '../components/ui/dialog';
import { toast } from 'sonner';
import { hrService } from '../services/hrService';
import { Employee, AttendanceRecord, LeaveRequest, PayrollRun, Payslip, HRPerformanceReview } from '../types/erp';
import { useAuth } from '../hooks/useAuth';
import { useBusinessStore } from '../store';
import { useSubscription } from '../hooks/useSubscription';
import { PremiumLockBanner } from '../components/common/PremiumBadge';

export default function HRPayroll() {
  const { user } = useAuth();
  const { currentBusiness, activeBranch } = useBusinessStore();
  const businessId = currentBusiness?.id || 'default_business';
  const branchId = activeBranch?.id || 'default_branch';
  const businessName = currentBusiness?.name || 'Tareza Enterprise Retail';

  const { isUnlocked } = useSubscription();
  const locked = !isUnlocked('accounting');

  // Active Main Tab
  const [activeTab, setActiveTab] = useState<'employees' | 'attendance' | 'leave' | 'payroll' | 'performance'>('employees');

  // Data States
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [attendance, setAttendance] = useState<AttendanceRecord[]>([]);
  const [leaveRequests, setLeaveRequests] = useState<LeaveRequest[]>([]);
  const [payrollRuns, setPayrollRuns] = useState<PayrollRun[]>([]);
  const [payslips, setPayslips] = useState<Payslip[]>([]);
  const [loading, setLoading] = useState(true);

  // Search and Filter States
  const [empSearch, setEmpSearch] = useState('');
  const [deptFilter, setDeptFilter] = useState('ALL');
  const [selectedDate, setSelectedDate] = useState(new Date().toISOString().split('T')[0]);

  // Modals State
  const [showEmployeeModal, setShowEmployeeModal] = useState(false);
  const [editingEmployee, setEditingEmployee] = useState<Partial<Employee> | null>(null);

  const [showClockModal, setShowClockModal] = useState(false);
  const [clockEmpId, setClockEmpId] = useState('');
  const [clockType, setClockType] = useState<'clock_in' | 'clock_out'>('clock_in');
  const [clockNotes, setClockNotes] = useState('');

  const [showLeaveModal, setShowLeaveModal] = useState(false);
  const [leaveForm, setLeaveForm] = useState<Partial<LeaveRequest>>({
    leave_type: 'annual',
    days_count: 1,
    start_date: new Date().toISOString().split('T')[0],
    end_date: new Date().toISOString().split('T')[0],
    reason: ''
  });

  const [showPayrollModal, setShowPayrollModal] = useState(false);
  const [payrollMonth, setPayrollMonth] = useState('August 2026');
  const [postToGL, setPostToGL] = useState(true);
  const [selectedRunId, setSelectedRunId] = useState<string | null>(null);

  const loadAllHRData = async () => {
    try {
      setLoading(true);
      const [empData, attData, leaveData, runsData, slipsData] = await Promise.all([
        hrService.getEmployees(businessId),
        hrService.getAttendance(businessId),
        hrService.getLeaveRequests(businessId),
        hrService.getPayrollRuns(businessId),
        hrService.getPayslips(businessId)
      ]);

      setEmployees(empData);
      setAttendance(attData);
      setLeaveRequests(leaveData);
      setPayrollRuns(runsData);
      setPayslips(slipsData);
    } catch (e) {
      console.error('HR Data loading error:', e);
      toast.error('Failed to load HR and payroll records.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadAllHRData();
  }, [businessId]);

  // Handlers
  const handleSaveEmployee = async () => {
    if (!editingEmployee?.first_name || !editingEmployee?.last_name) {
      toast.error('First and Last name are required.');
      return;
    }

    try {
      await hrService.saveEmployee(businessId, editingEmployee);
      toast.success('Employee profile saved successfully.');
      setShowEmployeeModal(false);
      setEditingEmployee(null);
      await loadAllHRData();
    } catch (e: any) {
      toast.error(e.message || 'Failed to save employee.');
    }
  };

  const handleDeleteEmployee = async (id: string, name: string) => {
    if (confirm(`Are you sure you want to remove employee ${name}?`)) {
      await hrService.deleteEmployee(businessId, id);
      toast.success(`Employee ${name} removed.`);
      await loadAllHRData();
    }
  };

  const handleClockAction = async () => {
    if (!clockEmpId) {
      toast.error('Please choose an employee.');
      return;
    }

    try {
      await hrService.clockInOrOut(businessId, clockEmpId, clockType, clockNotes);
      toast.success(`Successfully recorded ${clockType === 'clock_in' ? 'Clock In' : 'Clock Out'}.`);
      setShowClockModal(false);
      setClockNotes('');
      await loadAllHRData();
    } catch (e: any) {
      toast.error(e.message || 'Error logging time.');
    }
  };

  const handleSubmitLeave = async () => {
    if (!leaveForm.employee_id || !leaveForm.reason) {
      toast.error('Please select an employee and state a reason.');
      return;
    }

    try {
      await hrService.submitLeaveRequest(businessId, leaveForm);
      toast.success('Leave application submitted for approval.');
      setShowLeaveModal(false);
      setLeaveForm({
        leave_type: 'annual',
        days_count: 1,
        start_date: new Date().toISOString().split('T')[0],
        end_date: new Date().toISOString().split('T')[0],
        reason: ''
      });
      await loadAllHRData();
    } catch (e: any) {
      toast.error('Failed to submit leave.');
    }
  };

  const handleLeaveApproval = async (leaveId: string, status: 'approved' | 'rejected') => {
    const reviewerName = user?.email?.split('@')[0] || 'Manager';
    await hrService.updateLeaveStatus(businessId, leaveId, status, reviewerName);
    toast.success(`Leave request ${status}.`);
    await loadAllHRData();
  };

  const handleRunPayrollBatch = async () => {
    try {
      const result = await hrService.runPayrollBatch(
        businessId,
        branchId,
        user?.id || 'admin',
        payrollMonth,
        '2026-08-01',
        '2026-08-31',
        postToGL
      );

      toast.success(`Payroll processed for ${result.payslips.length} staff! ${result.journalRef ? `Posted to GL as ${result.journalRef}` : ''}`);
      setShowPayrollModal(false);
      await loadAllHRData();
    } catch (e: any) {
      toast.error(e.message || 'Failed to execute payroll run.');
    }
  };

  // Metrics
  const activeStaffCount = employees.filter(e => e.status === 'active').length;
  const totalBasePayroll = employees.filter(e => e.status === 'active').reduce((s, e) => s + Number(e.base_salary || 0), 0);
  const pendingLeaveCount = leaveRequests.filter(l => l.status === 'pending').length;
  const todayAttendanceCount = attendance.filter(a => a.date === selectedDate).length;
  const attendanceRate = activeStaffCount > 0 ? Math.min(100, Math.round((todayAttendanceCount / activeStaffCount) * 100)) : 0;

  // Filtered lists
  const filteredEmployees = employees.filter(e => {
    const matchesSearch = `${e.first_name} ${e.last_name} ${e.employee_code} ${e.job_title}`.toLowerCase().includes(empSearch.toLowerCase());
    const matchesDept = deptFilter === 'ALL' || e.department === deptFilter;
    return matchesSearch && matchesDept;
  });

  const filteredAttendance = attendance.filter(a => a.date === selectedDate);
  const visiblePayslips = selectedRunId ? payslips.filter(p => p.payroll_run_id === selectedRunId) : payslips;

  return (
    <div className="flex flex-col h-full overflow-hidden p-6 gap-6 bg-zinc-50/50">
      {locked && (
        <PremiumLockBanner featureTitle="Human Resources & Payroll Automation" requiredTier="PRO" />
      )}

      {/* Header */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 shrink-0">
        <div>
          <h1 className="text-2xl font-bold font-sans tracking-tight text-zinc-900 flex items-center gap-2">
            <Users className="w-6 h-6 text-indigo-600" /> Human Resources & Payroll Suite
          </h1>
          <p className="text-zinc-500 text-sm mt-0.5">
            Personnel directory, shifts & attendance punches, leave approvals, automated tax payroll runs, and double-entry GL ledger integration.
          </p>
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          <Button onClick={loadAllHRData} variant="outline" size="sm" className="bg-white">
            <RefreshCw className="w-4 h-4 mr-2" /> Sync HR
          </Button>

          <Button 
            size="sm" 
            variant="outline" 
            className="bg-white text-zinc-800"
            onClick={() => {
              setClockEmpId(employees[0]?.id || '');
              setShowClockModal(true);
            }}
          >
            <Clock className="w-4 h-4 mr-1.5 text-blue-600" /> Punch Clock
          </Button>

          <Button 
            size="sm" 
            variant="outline" 
            className="bg-white text-zinc-800"
            onClick={() => {
              setLeaveForm({
                employee_id: employees[0]?.id || '',
                leave_type: 'annual',
                days_count: 1,
                start_date: new Date().toISOString().split('T')[0],
                end_date: new Date().toISOString().split('T')[0],
                reason: ''
              });
              setShowLeaveModal(true);
            }}
          >
            <Calendar className="w-4 h-4 mr-1.5 text-amber-600" /> Request Leave
          </Button>

          <Button 
            size="sm" 
            className="bg-indigo-600 hover:bg-indigo-700 text-white font-semibold"
            onClick={() => setShowPayrollModal(true)}
          >
            <DollarSign className="w-4 h-4 mr-1.5" /> Run Payroll Batch
          </Button>

          <Button 
            size="sm" 
            className="bg-zinc-900 hover:bg-zinc-800 text-white"
            onClick={() => {
              setEditingEmployee({
                department: 'Operations',
                employment_type: 'full_time',
                base_salary: 600,
                currency: 'USD',
                status: 'active',
                hire_date: new Date().toISOString().split('T')[0]
              });
              setShowEmployeeModal(true);
            }}
          >
            <UserPlus className="w-4 h-4 mr-1.5" /> Add Staff Member
          </Button>
        </div>
      </div>

      {/* KPI Overview Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 shrink-0">
        <Card className="border border-zinc-200 shadow-sm bg-white">
          <CardContent className="p-4 flex items-center justify-between">
            <div>
              <p className="text-xs font-semibold text-zinc-500 uppercase tracking-wider">Active Personnel</p>
              <h3 className="text-2xl font-bold font-mono text-zinc-900 mt-1">{activeStaffCount} Employees</h3>
              <p className="text-[11px] text-zinc-400 mt-0.5">Across {new Set(employees.map(e => e.department)).size} departments</p>
            </div>
            <div className="w-10 h-10 rounded-full bg-indigo-50 flex items-center justify-center text-indigo-600">
              <Users className="w-5 h-5" />
            </div>
          </CardContent>
        </Card>

        <Card className="border border-zinc-200 shadow-sm bg-white">
          <CardContent className="p-4 flex items-center justify-between">
            <div>
              <p className="text-xs font-semibold text-zinc-500 uppercase tracking-wider">Monthly Base Payroll</p>
              <h3 className="text-2xl font-bold font-mono text-zinc-900 mt-1">${totalBasePayroll.toLocaleString('en-US', { minimumFractionDigits: 2 })}</h3>
              <p className="text-[11px] text-emerald-600 mt-0.5 font-medium">Automatic GL Double-Entry</p>
            </div>
            <div className="w-10 h-10 rounded-full bg-emerald-50 flex items-center justify-center text-emerald-600">
              <DollarSign className="w-5 h-5" />
            </div>
          </CardContent>
        </Card>

        <Card className="border border-zinc-200 shadow-sm bg-white">
          <CardContent className="p-4 flex items-center justify-between">
            <div>
              <p className="text-xs font-semibold text-zinc-500 uppercase tracking-wider">Today's Attendance</p>
              <h3 className="text-2xl font-bold font-mono text-zinc-900 mt-1">{attendanceRate}%</h3>
              <p className="text-[11px] text-zinc-400 mt-0.5">{todayAttendanceCount} logged shifts today</p>
            </div>
            <div className="w-10 h-10 rounded-full bg-blue-50 flex items-center justify-center text-blue-600">
              <Clock className="w-5 h-5" />
            </div>
          </CardContent>
        </Card>

        <Card className="border border-zinc-200 shadow-sm bg-white">
          <CardContent className="p-4 flex items-center justify-between">
            <div>
              <p className="text-xs font-semibold text-zinc-500 uppercase tracking-wider">Pending Leave Requests</p>
              <h3 className={`text-2xl font-bold font-mono mt-1 ${pendingLeaveCount > 0 ? 'text-amber-600' : 'text-zinc-900'}`}>
                {pendingLeaveCount} Requests
              </h3>
              <p className="text-[11px] text-zinc-400 mt-0.5">Awaiting manager approval</p>
            </div>
            <div className="w-10 h-10 rounded-full bg-amber-50 flex items-center justify-center text-amber-600">
              <Calendar className="w-5 h-5" />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Main HR Tabs Navigation */}
      <div className="flex items-center gap-2 border-b border-zinc-200 pb-2 shrink-0 overflow-x-auto">
        <button
          onClick={() => setActiveTab('employees')}
          className={`flex items-center gap-2 px-4 py-2 text-xs font-semibold rounded-lg transition-all ${
            activeTab === 'employees'
              ? 'bg-zinc-900 text-white shadow-sm'
              : 'text-zinc-600 hover:bg-zinc-100 hover:text-zinc-900'
          }`}
        >
          <Users className="w-4 h-4" /> Personnel Directory ({employees.length})
        </button>

        <button
          onClick={() => setActiveTab('attendance')}
          className={`flex items-center gap-2 px-4 py-2 text-xs font-semibold rounded-lg transition-all ${
            activeTab === 'attendance'
              ? 'bg-zinc-900 text-white shadow-sm'
              : 'text-zinc-600 hover:bg-zinc-100 hover:text-zinc-900'
          }`}
        >
          <Clock className="w-4 h-4" /> Attendance & Timesheets
        </button>

        <button
          onClick={() => setActiveTab('leave')}
          className={`flex items-center gap-2 px-4 py-2 text-xs font-semibold rounded-lg transition-all ${
            activeTab === 'leave'
              ? 'bg-zinc-900 text-white shadow-sm'
              : 'text-zinc-600 hover:bg-zinc-100 hover:text-zinc-900'
          }`}
        >
          <Calendar className="w-4 h-4" /> Leave Management {pendingLeaveCount > 0 && <span className="bg-amber-500 text-white px-1.5 py-0.5 rounded-full text-[10px]">{pendingLeaveCount}</span>}
        </button>

        <button
          onClick={() => setActiveTab('payroll')}
          className={`flex items-center gap-2 px-4 py-2 text-xs font-semibold rounded-lg transition-all ${
            activeTab === 'payroll'
              ? 'bg-zinc-900 text-white shadow-sm'
              : 'text-zinc-600 hover:bg-zinc-100 hover:text-zinc-900'
          }`}
        >
          <DollarSign className="w-4 h-4" /> Payroll & Payslips ({payslips.length})
        </button>
      </div>

      {/* TAB CONTENT CONTAINER */}
      <div className="flex-1 bg-white border border-zinc-200 rounded-xl shadow-sm p-5 flex flex-col overflow-hidden">
        
        {/* ---------------------------------------------------- */}
        {/* TAB 1: EMPLOYEES DIRECTORY */}
        {/* ---------------------------------------------------- */}
        {activeTab === 'employees' && (
          <div className="flex flex-col h-full gap-4">
            {/* Search & Filters */}
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 shrink-0">
              <div className="relative flex-1 max-w-sm w-full">
                <Search className="absolute left-3 top-2.5 h-4 w-4 text-zinc-400" />
                <Input 
                  placeholder="Search staff by name, code, role..." 
                  value={empSearch} 
                  onChange={(e) => setEmpSearch(e.target.value)} 
                  className="pl-9 text-xs"
                />
              </div>

              <div className="flex items-center gap-2">
                <span className="text-xs font-semibold text-zinc-500">Department:</span>
                <select 
                  value={deptFilter} 
                  onChange={(e) => setDeptFilter(e.target.value)}
                  className="text-xs border border-zinc-200 rounded-md p-1.5 bg-white text-zinc-900 font-medium"
                >
                  <option value="ALL">All Departments</option>
                  <option value="Operations">Operations</option>
                  <option value="Sales & POS">Sales & POS</option>
                  <option value="Accounting & Finance">Accounting & Finance</option>
                  <option value="Inventory & Logistics">Inventory & Logistics</option>
                  <option value="Management">Management</option>
                </select>
              </div>
            </div>

            {/* Employee Table */}
            <ScrollArea className="flex-1 border border-zinc-100 rounded-lg">
              <table className="w-full text-xs text-left">
                <thead className="bg-zinc-50/80 sticky top-0 border-b text-[10px] font-bold text-zinc-500 uppercase tracking-wider font-mono">
                  <tr>
                    <th className="py-3 px-4">Staff Member</th>
                    <th className="py-3 px-3">Employee ID</th>
                    <th className="py-3 px-3">Department</th>
                    <th className="py-3 px-3">Designation</th>
                    <th className="py-3 px-3">Employment Type</th>
                    <th className="py-3 px-3">Base Remuneration</th>
                    <th className="py-3 px-3">Status</th>
                    <th className="py-3 px-3 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-zinc-100">
                  {filteredEmployees.map((emp) => (
                    <tr key={emp.id} className="hover:bg-zinc-50/50 transition-colors">
                      <td className="py-3 px-4">
                        <div className="flex items-center gap-3">
                          <div className="w-8 h-8 rounded-full bg-indigo-100 text-indigo-700 flex items-center justify-center font-bold text-xs uppercase">
                            {emp.first_name[0]}{emp.last_name[0]}
                          </div>
                          <div>
                            <div className="font-semibold text-zinc-900">{emp.first_name} {emp.last_name}</div>
                            <div className="text-[11px] text-zinc-400 font-mono">{emp.email || emp.phone}</div>
                          </div>
                        </div>
                      </td>
                      <td className="py-3 px-3 font-mono font-bold text-zinc-700">{emp.employee_code}</td>
                      <td className="py-3 px-3">
                        <Badge variant="outline" className="font-normal text-[10px] bg-zinc-50 text-zinc-700">
                          {emp.department}
                        </Badge>
                      </td>
                      <td className="py-3 px-3 font-medium text-zinc-800">{emp.job_title}</td>
                      <td className="py-3 px-3 capitalize text-zinc-600">{emp.employment_type.replace('_', ' ')}</td>
                      <td className="py-3 px-3 font-mono font-bold text-zinc-900">${Number(emp.base_salary).toFixed(2)}/mo</td>
                      <td className="py-3 px-3">
                        <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold uppercase ${
                          emp.status === 'active' ? 'bg-emerald-100 text-emerald-800' : 'bg-zinc-100 text-zinc-600'
                        }`}>
                          {emp.status}
                        </span>
                      </td>
                      <td className="py-3 px-3 text-right">
                        <div className="flex items-center justify-end gap-1">
                          <Button 
                            variant="ghost" 
                            size="sm" 
                            className="h-7 w-7 p-0 text-zinc-500 hover:text-zinc-900"
                            onClick={() => {
                              setEditingEmployee(emp);
                              setShowEmployeeModal(true);
                            }}
                          >
                            <Edit3 className="w-3.5 h-3.5" />
                          </Button>
                          <Button 
                            variant="ghost" 
                            size="sm" 
                            className="h-7 w-7 p-0 text-zinc-400 hover:text-rose-600"
                            onClick={() => handleDeleteEmployee(emp.id, `${emp.first_name} ${emp.last_name}`)}
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </Button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </ScrollArea>
          </div>
        )}

        {/* ---------------------------------------------------- */}
        {/* TAB 2: ATTENDANCE & TIMESHEETS */}
        {/* ---------------------------------------------------- */}
        {activeTab === 'attendance' && (
          <div className="flex flex-col h-full gap-4">
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 shrink-0">
              <div className="flex items-center gap-3">
                <span className="text-xs font-semibold text-zinc-700">Select Date:</span>
                <Input 
                  type="date" 
                  value={selectedDate} 
                  onChange={(e) => setSelectedDate(e.target.value)} 
                  className="h-8 text-xs w-40"
                />
              </div>

              <div className="flex items-center gap-2">
                <Button 
                  size="sm" 
                  className="bg-zinc-900 text-white text-xs"
                  onClick={() => setShowClockModal(true)}
                >
                  <Clock className="w-3.5 h-3.5 mr-1" /> Log Time Punch
                </Button>
              </div>
            </div>

            <ScrollArea className="flex-1 border border-zinc-100 rounded-lg">
              <table className="w-full text-xs text-left">
                <thead className="bg-zinc-50/80 sticky top-0 border-b text-[10px] font-bold text-zinc-500 uppercase tracking-wider font-mono">
                  <tr>
                    <th className="py-3 px-4">Employee</th>
                    <th className="py-3 px-3">Clock In</th>
                    <th className="py-3 px-3">Clock Out</th>
                    <th className="py-3 px-3">Logged Hours</th>
                    <th className="py-3 px-3">Overtime</th>
                    <th className="py-3 px-3">Status</th>
                    <th className="py-3 px-4">Shift Notes</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-zinc-100 font-mono">
                  {filteredAttendance.length === 0 ? (
                    <tr>
                      <td colSpan={7} className="py-8 text-center text-zinc-400 font-sans">
                        No clock punches recorded for {selectedDate}.
                      </td>
                    </tr>
                  ) : (
                    filteredAttendance.map((att) => (
                      <tr key={att.id} className="hover:bg-zinc-50/50">
                        <td className="py-3 px-4 font-sans font-semibold text-zinc-900">{att.employee_name}</td>
                        <td className="py-3 px-3 text-emerald-700 font-bold">{att.clock_in}</td>
                        <td className="py-3 px-3 text-zinc-700 font-bold">{att.clock_out || '— (In Progress)'}</td>
                        <td className="py-3 px-3 text-zinc-900 font-bold">{att.total_hours.toFixed(1)} hrs</td>
                        <td className="py-3 px-3 text-amber-600 font-bold">{att.overtime_hours > 0 ? `+${att.overtime_hours.toFixed(1)} hrs` : '0.0 hrs'}</td>
                        <td className="py-3 px-3">
                          <span className={`inline-flex items-center px-2 py-0.5 rounded text-[10px] font-bold uppercase font-sans ${
                            att.status === 'present' ? 'bg-emerald-100 text-emerald-800' :
                            att.status === 'late' ? 'bg-amber-100 text-amber-800' : 'bg-rose-100 text-rose-800'
                          }`}>
                            {att.status}
                          </span>
                        </td>
                        <td className="py-3 px-4 font-sans text-zinc-500">{att.notes || '—'}</td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </ScrollArea>
          </div>
        )}

        {/* ---------------------------------------------------- */}
        {/* TAB 3: LEAVE & TIME-OFF */}
        {/* ---------------------------------------------------- */}
        {activeTab === 'leave' && (
          <div className="flex flex-col h-full gap-4">
            <div className="flex justify-between items-center shrink-0">
              <h3 className="text-sm font-bold text-zinc-900">Leave Applications & Holiday Entitlement</h3>
              <Button 
                size="sm" 
                className="bg-zinc-900 text-white text-xs"
                onClick={() => setShowLeaveModal(true)}
              >
                <Plus className="w-3.5 h-3.5 mr-1" /> New Leave Request
              </Button>
            </div>

            <ScrollArea className="flex-1 border border-zinc-100 rounded-lg">
              <table className="w-full text-xs text-left">
                <thead className="bg-zinc-50/80 sticky top-0 border-b text-[10px] font-bold text-zinc-500 uppercase tracking-wider font-mono">
                  <tr>
                    <th className="py-3 px-4">Applicant</th>
                    <th className="py-3 px-3">Leave Type</th>
                    <th className="py-3 px-3">Date Range</th>
                    <th className="py-3 px-3">Duration</th>
                    <th className="py-3 px-4">Reason / Notes</th>
                    <th className="py-3 px-3">Status</th>
                    <th className="py-3 px-4 text-right">Approval Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-zinc-100">
                  {leaveRequests.map((req) => (
                    <tr key={req.id} className="hover:bg-zinc-50/50">
                      <td className="py-3 px-4 font-semibold text-zinc-900">{req.employee_name}</td>
                      <td className="py-3 px-3 capitalize font-medium text-zinc-700">{req.leave_type} Leave</td>
                      <td className="py-3 px-3 font-mono text-zinc-600">{req.start_date} to {req.end_date}</td>
                      <td className="py-3 px-3 font-bold font-mono text-zinc-900">{req.days_count} Days</td>
                      <td className="py-3 px-4 text-zinc-600 max-w-xs truncate">{req.reason}</td>
                      <td className="py-3 px-3">
                        <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold uppercase ${
                          req.status === 'approved' ? 'bg-emerald-100 text-emerald-800' :
                          req.status === 'pending' ? 'bg-amber-100 text-amber-800' : 'bg-rose-100 text-rose-800'
                        }`}>
                          {req.status}
                        </span>
                      </td>
                      <td className="py-3 px-4 text-right">
                        {req.status === 'pending' ? (
                          <div className="flex items-center justify-end gap-1.5">
                            <Button 
                              size="xs" 
                              className="bg-emerald-600 hover:bg-emerald-700 text-white font-semibold"
                              onClick={() => handleLeaveApproval(req.id, 'approved')}
                            >
                              <Check className="w-3.5 h-3.5 mr-1" /> Approve
                            </Button>
                            <Button 
                              size="xs" 
                              variant="outline" 
                              className="text-rose-600 hover:bg-rose-50"
                              onClick={() => handleLeaveApproval(req.id, 'rejected')}
                            >
                              Reject
                            </Button>
                          </div>
                        ) : (
                          <span className="text-[11px] text-zinc-400">
                            {req.approved_by ? `By ${req.approved_by}` : 'Processed'}
                          </span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </ScrollArea>
          </div>
        )}

        {/* ---------------------------------------------------- */}
        {/* TAB 4: PAYROLL & PAYSLIPS */}
        {/* ---------------------------------------------------- */}
        {activeTab === 'payroll' && (
          <div className="flex flex-col h-full gap-4">
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 shrink-0 bg-slate-50 p-3 rounded-lg border border-slate-200">
              <div>
                <h3 className="text-sm font-bold text-zinc-900">Official Staff Remuneration & Payslips</h3>
                <p className="text-xs text-zinc-500">Generate, review, and download official PDF payslips compliant with statutory tax withholding.</p>
              </div>

              <div className="flex items-center gap-2">
                <Button 
                  size="sm" 
                  className="bg-indigo-600 hover:bg-indigo-700 text-white font-semibold"
                  onClick={() => setShowPayrollModal(true)}
                >
                  <DollarSign className="w-4 h-4 mr-1" /> Run Monthly Payroll
                </Button>
              </div>
            </div>

            <ScrollArea className="flex-1 border border-zinc-100 rounded-lg">
              <table className="w-full text-xs text-left">
                <thead className="bg-zinc-50/80 sticky top-0 border-b text-[10px] font-bold text-zinc-500 uppercase tracking-wider font-mono">
                  <tr>
                    <th className="py-3 px-4">Employee</th>
                    <th className="py-3 px-3">Base Salary</th>
                    <th className="py-3 px-3">Allowances</th>
                    <th className="py-3 px-3">Gross Earnings</th>
                    <th className="py-3 px-3">PAYE Tax</th>
                    <th className="py-3 px-3">NSSA Pension</th>
                    <th className="py-3 px-3">Total Deductions</th>
                    <th className="py-3 px-3">Net Take-Home Pay</th>
                    <th className="py-3 px-4 text-right">PDF Payslip</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-zinc-100 font-mono">
                  {visiblePayslips.length === 0 ? (
                    <tr>
                      <td colSpan={9} className="py-8 text-center text-zinc-400 font-sans">
                        No payroll batch executed yet. Click "Run Monthly Payroll" to compute salaries.
                      </td>
                    </tr>
                  ) : (
                    visiblePayslips.map((ps) => (
                      <tr key={ps.id} className="hover:bg-zinc-50/50">
                        <td className="py-3 px-4 font-sans">
                          <div className="font-semibold text-zinc-900">{ps.employee_name}</div>
                          <div className="text-[10px] text-zinc-400 font-mono">{ps.employee_code} • {ps.department}</div>
                        </td>
                        <td className="py-3 px-3 text-zinc-700">${ps.base_salary.toFixed(2)}</td>
                        <td className="py-3 px-3 text-emerald-700">+${(ps.housing_allowance + ps.transport_allowance + ps.overtime_pay).toFixed(2)}</td>
                        <td className="py-3 px-3 font-bold text-zinc-900">${ps.gross_earnings.toFixed(2)}</td>
                        <td className="py-3 px-3 text-rose-600">-${ps.tax_paye.toFixed(2)}</td>
                        <td className="py-3 px-3 text-rose-600">-${ps.pension_nssa.toFixed(2)}</td>
                        <td className="py-3 px-3 text-rose-700 font-bold">-${ps.total_deductions.toFixed(2)}</td>
                        <td className="py-3 px-3 font-black text-emerald-700 text-sm">${ps.net_pay.toFixed(2)}</td>
                        <td className="py-3 px-4 text-right font-sans">
                          <Button 
                            size="xs" 
                            variant="outline" 
                            className="bg-white text-zinc-800 border-zinc-300 hover:bg-zinc-50"
                            onClick={() => hrService.exportPayslipPDF(ps, businessName)}
                          >
                            <Download className="w-3.5 h-3.5 mr-1 text-indigo-600" /> Export PDF
                          </Button>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </ScrollArea>
          </div>
        )}
      </div>

      {/* ---------------------------------------------------- */}
      {/* MODAL: ADD / EDIT EMPLOYEE */}
      {/* ---------------------------------------------------- */}
      <Dialog open={showEmployeeModal} onOpenChange={setShowEmployeeModal}>
        <DialogContent className="sm:max-w-2xl max-h-[90vh] flex flex-col p-0">
          <DialogHeader className="p-6 border-b pb-4">
            <DialogTitle>{editingEmployee?.id ? 'Edit Employee Profile' : 'Add New Staff Member'}</DialogTitle>
            <DialogDescription>Enter full personnel details, job title, remuneration, and statutory tax identifiers.</DialogDescription>
          </DialogHeader>

          <ScrollArea className="flex-1 p-6 space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1">
                <label className="text-xs font-semibold text-zinc-700">First Name *</label>
                <Input 
                  value={editingEmployee?.first_name || ''} 
                  onChange={(e) => setEditingEmployee({ ...editingEmployee, first_name: e.target.value })} 
                />
              </div>
              <div className="space-y-1">
                <label className="text-xs font-semibold text-zinc-700">Last Name *</label>
                <Input 
                  value={editingEmployee?.last_name || ''} 
                  onChange={(e) => setEditingEmployee({ ...editingEmployee, last_name: e.target.value })} 
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4 mt-3">
              <div className="space-y-1">
                <label className="text-xs font-semibold text-zinc-700">Email Address</label>
                <Input 
                  type="email"
                  value={editingEmployee?.email || ''} 
                  onChange={(e) => setEditingEmployee({ ...editingEmployee, email: e.target.value })} 
                />
              </div>
              <div className="space-y-1">
                <label className="text-xs font-semibold text-zinc-700">Phone Contact</label>
                <Input 
                  value={editingEmployee?.phone || ''} 
                  onChange={(e) => setEditingEmployee({ ...editingEmployee, phone: e.target.value })} 
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4 mt-3">
              <div className="space-y-1">
                <label className="text-xs font-semibold text-zinc-700">Department</label>
                <select
                  value={editingEmployee?.department || 'Operations'}
                  onChange={(e) => setEditingEmployee({ ...editingEmployee, department: e.target.value as any })}
                  className="w-full text-xs border border-zinc-200 rounded p-2 bg-white"
                >
                  <option value="Operations">Operations</option>
                  <option value="Sales & POS">Sales & POS</option>
                  <option value="Accounting & Finance">Accounting & Finance</option>
                  <option value="Inventory & Logistics">Inventory & Logistics</option>
                  <option value="Management">Management</option>
                  <option value="Customer Support">Customer Support</option>
                </select>
              </div>
              <div className="space-y-1">
                <label className="text-xs font-semibold text-zinc-700">Job Designation</label>
                <Input 
                  value={editingEmployee?.job_title || ''} 
                  onChange={(e) => setEditingEmployee({ ...editingEmployee, job_title: e.target.value })} 
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4 mt-3">
              <div className="space-y-1">
                <label className="text-xs font-semibold text-zinc-700">Monthly Base Salary (USD) *</label>
                <Input 
                  type="number"
                  step="10"
                  value={editingEmployee?.base_salary || ''} 
                  onChange={(e) => setEditingEmployee({ ...editingEmployee, base_salary: parseFloat(e.target.value) || 0 })} 
                />
              </div>
              <div className="space-y-1">
                <label className="text-xs font-semibold text-zinc-700">National ID / SSN</label>
                <Input 
                  value={editingEmployee?.national_id || ''} 
                  onChange={(e) => setEditingEmployee({ ...editingEmployee, national_id: e.target.value })} 
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4 mt-3">
              <div className="space-y-1">
                <label className="text-xs font-semibold text-zinc-700">Bank Name</label>
                <Input 
                  placeholder="e.g. Standard Chartered / CABS"
                  value={editingEmployee?.bank_name || ''} 
                  onChange={(e) => setEditingEmployee({ ...editingEmployee, bank_name: e.target.value })} 
                />
              </div>
              <div className="space-y-1">
                <label className="text-xs font-semibold text-zinc-700">Bank Account Number</label>
                <Input 
                  value={editingEmployee?.bank_account_number || ''} 
                  onChange={(e) => setEditingEmployee({ ...editingEmployee, bank_account_number: e.target.value })} 
                />
              </div>
            </div>
          </ScrollArea>

          <DialogFooter className="bg-zinc-50 p-4 border-t flex-none">
            <Button variant="outline" size="sm" onClick={() => setShowEmployeeModal(false)}>Cancel</Button>
            <Button size="sm" className="bg-zinc-900 text-white" onClick={handleSaveEmployee}>Save Employee</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ---------------------------------------------------- */}
      {/* MODAL: TIME PUNCH (CLOCK IN / OUT) */}
      {/* ---------------------------------------------------- */}
      <Dialog open={showClockModal} onOpenChange={setShowClockModal}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Staff Time & Attendance Punch</DialogTitle>
            <DialogDescription>Record shift arrival or departure.</DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-2">
            <div className="space-y-1">
              <label className="text-xs font-semibold text-zinc-700">Employee *</label>
              <select
                value={clockEmpId}
                onChange={(e) => setClockEmpId(e.target.value)}
                className="w-full text-xs border border-zinc-200 rounded p-2 bg-white"
              >
                {employees.map(e => (
                  <option key={e.id} value={e.id}>{e.employee_code} - {e.first_name} {e.last_name} ({e.job_title})</option>
                ))}
              </select>
            </div>

            <div className="space-y-1">
              <label className="text-xs font-semibold text-zinc-700">Punch Action</label>
              <div className="grid grid-cols-2 gap-2">
                <Button 
                  type="button" 
                  variant={clockType === 'clock_in' ? 'default' : 'outline'}
                  className={clockType === 'clock_in' ? 'bg-emerald-600 text-white' : ''}
                  onClick={() => setClockType('clock_in')}
                >
                  Clock In (Arrival)
                </Button>
                <Button 
                  type="button" 
                  variant={clockType === 'clock_out' ? 'default' : 'outline'}
                  className={clockType === 'clock_out' ? 'bg-slate-800 text-white' : ''}
                  onClick={() => setClockType('clock_out')}
                >
                  Clock Out (Departure)
                </Button>
              </div>
            </div>

            <div className="space-y-1">
              <label className="text-xs font-semibold text-zinc-700">Notes (Optional)</label>
              <Input 
                placeholder="e.g. Shift start on POS terminal 1"
                value={clockNotes}
                onChange={(e) => setClockNotes(e.target.value)}
              />
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" size="sm" onClick={() => setShowClockModal(false)}>Cancel</Button>
            <Button size="sm" className="bg-zinc-900 text-white" onClick={handleClockAction}>Confirm Punch</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ---------------------------------------------------- */}
      {/* MODAL: SUBMIT LEAVE REQUEST */}
      {/* ---------------------------------------------------- */}
      <Dialog open={showLeaveModal} onOpenChange={setShowLeaveModal}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Request Employee Leave</DialogTitle>
            <DialogDescription>Submit time off for administrative review.</DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-2">
            <div className="space-y-1">
              <label className="text-xs font-semibold text-zinc-700">Employee *</label>
              <select
                value={leaveForm.employee_id}
                onChange={(e) => setLeaveForm({ ...leaveForm, employee_id: e.target.value })}
                className="w-full text-xs border border-zinc-200 rounded p-2 bg-white"
              >
                {employees.map(e => (
                  <option key={e.id} value={e.id}>{e.first_name} {e.last_name} ({e.department})</option>
                ))}
              </select>
            </div>

            <div className="space-y-1">
              <label className="text-xs font-semibold text-zinc-700">Leave Category</label>
              <select
                value={leaveForm.leave_type}
                onChange={(e) => setLeaveForm({ ...leaveForm, leave_type: e.target.value as any })}
                className="w-full text-xs border border-zinc-200 rounded p-2 bg-white"
              >
                <option value="annual">Annual Leave</option>
                <option value="sick">Sick Leave</option>
                <option value="maternity">Maternity / Paternity</option>
                <option value="compassionate">Compassionate Leave</option>
                <option value="unpaid">Unpaid Leave</option>
              </select>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <label className="text-xs font-semibold text-zinc-700">Start Date</label>
                <Input 
                  type="date"
                  value={leaveForm.start_date}
                  onChange={(e) => setLeaveForm({ ...leaveForm, start_date: e.target.value })}
                />
              </div>
              <div className="space-y-1">
                <label className="text-xs font-semibold text-zinc-700">End Date</label>
                <Input 
                  type="date"
                  value={leaveForm.end_date}
                  onChange={(e) => setLeaveForm({ ...leaveForm, end_date: e.target.value })}
                />
              </div>
            </div>

            <div className="space-y-1">
              <label className="text-xs font-semibold text-zinc-700">Days Count</label>
              <Input 
                type="number"
                min="1"
                value={leaveForm.days_count || 1}
                onChange={(e) => setLeaveForm({ ...leaveForm, days_count: parseInt(e.target.value) || 1 })}
              />
            </div>

            <div className="space-y-1">
              <label className="text-xs font-semibold text-zinc-700">Reason / Details *</label>
              <Input 
                placeholder="Provide short explanation..."
                value={leaveForm.reason}
                onChange={(e) => setLeaveForm({ ...leaveForm, reason: e.target.value })}
              />
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" size="sm" onClick={() => setShowLeaveModal(false)}>Cancel</Button>
            <Button size="sm" className="bg-zinc-900 text-white" onClick={handleSubmitLeave}>Submit Request</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ---------------------------------------------------- */}
      {/* MODAL: RUN MONTHLY PAYROLL */}
      {/* ---------------------------------------------------- */}
      <Dialog open={showPayrollModal} onOpenChange={setShowPayrollModal}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Execute Monthly Payroll Batch</DialogTitle>
            <DialogDescription>
              Calculate earnings, PAYE taxes, NSSA social security, and disburse to General Ledger.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-2">
            <div className="space-y-1">
              <label className="text-xs font-semibold text-zinc-700">Payroll Cycle Month / Period</label>
              <Input 
                value={payrollMonth}
                onChange={(e) => setPayrollMonth(e.target.value)}
                placeholder="e.g. August 2026"
              />
            </div>

            <div className="bg-slate-50 p-3 rounded-lg border border-slate-200 text-xs space-y-2">
              <div className="flex justify-between">
                <span className="text-zinc-500">Active Staff to Process:</span>
                <span className="font-bold text-zinc-900">{activeStaffCount} Employees</span>
              </div>
              <div className="flex justify-between">
                <span className="text-zinc-500">Estimated Total Base Pay:</span>
                <span className="font-bold text-zinc-900">${totalBasePayroll.toFixed(2)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-zinc-500">Automatic General Ledger Integration:</span>
                <span className="font-bold text-emerald-600">Dr 6100 Salaries / Cr 1000 Cash Till</span>
              </div>
            </div>

            <div className="flex items-center gap-2 pt-2">
              <input 
                type="checkbox" 
                id="postGL" 
                checked={postToGL} 
                onChange={(e) => setPostToGL(e.target.checked)}
                className="rounded border-zinc-300 text-indigo-600 focus:ring-indigo-500"
              />
              <label htmlFor="postGL" className="text-xs font-medium text-zinc-800 cursor-pointer">
                Automatically post balanced double-entry to General Ledger Bookkeeping
              </label>
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" size="sm" onClick={() => setShowPayrollModal(false)}>Cancel</Button>
            <Button size="sm" className="bg-indigo-600 hover:bg-indigo-700 text-white font-semibold" onClick={handleRunPayrollBatch}>
              Process & Generate Payslips
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

    </div>
  );
}
