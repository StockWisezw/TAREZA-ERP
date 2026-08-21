import { supabase } from '../lib/firebaseClient';
import { Employee, AttendanceRecord, LeaveRequest, PayrollRun, Payslip, HRPerformanceReview } from '../types/erp';
import { postJournalEntry } from './ledgerService';
import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';
import { toast } from 'sonner';

const STORAGE_KEYS = {
  EMPLOYEES: 'tareza_erp_employees',
  ATTENDANCE: 'tareza_erp_attendance',
  LEAVE: 'tareza_erp_leave_requests',
  PAYROLL_RUNS: 'tareza_erp_payroll_runs',
  PAYSLIPS: 'tareza_erp_payslips',
  REVIEWS: 'tareza_erp_reviews'
};

const DEFAULT_EMPLOYEES: Omit<Employee, 'business_id'>[] = [
  {
    id: 'emp-001',
    employee_code: 'EMP-1001',
    first_name: 'Tendai',
    last_name: 'Moyo',
    email: 'tendai.moyo@tarezaerp.co.zw',
    phone: '+263 77 123 4567',
    national_id: '63-123456-A-42',
    department: 'Management',
    job_title: 'Store Operations Manager',
    employment_type: 'full_time',
    hire_date: '2023-01-15',
    base_salary: 1450.00,
    currency: 'USD',
    bank_name: 'Standard Chartered Bank',
    bank_account_number: '870023419010',
    bank_branch_code: 'SCB-01',
    tax_number: 'TIN-9082341',
    emergency_contact_name: 'Chipo Moyo (Spouse)',
    emergency_contact_phone: '+263 77 222 3344',
    status: 'active',
    created_at: new Date(Date.now() - 90 * 86400000).toISOString(),
    avatar_url: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=150&auto=format&fit=crop&q=80'
  },
  {
    id: 'emp-002',
    employee_code: 'EMP-1002',
    first_name: 'Farai',
    last_name: 'Chidzero',
    email: 'farai.c@tarezaerp.co.zw',
    phone: '+263 71 987 6543',
    national_id: '45-987654-K-19',
    department: 'Sales & POS',
    job_title: 'Senior Cashier & Shift Lead',
    employment_type: 'full_time',
    hire_date: '2023-06-01',
    base_salary: 650.00,
    currency: 'USD',
    bank_name: 'CABS Bank',
    bank_account_number: '1004567890',
    bank_branch_code: 'CABS-HQ',
    tax_number: 'TIN-8891024',
    emergency_contact_name: 'Rudo Chidzero (Sister)',
    emergency_contact_phone: '+263 71 333 4455',
    status: 'active',
    created_at: new Date(Date.now() - 60 * 86400000).toISOString(),
    avatar_url: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=150&auto=format&fit=crop&q=80'
  },
  {
    id: 'emp-003',
    employee_code: 'EMP-1003',
    first_name: 'Nyasha',
    last_name: 'Gumbo',
    email: 'nyasha.g@tarezaerp.co.zw',
    phone: '+263 78 456 7890',
    national_id: '29-543210-P-88',
    department: 'Inventory & Logistics',
    job_title: 'Inventory & Receiving Supervisor',
    employment_type: 'full_time',
    hire_date: '2023-09-10',
    base_salary: 780.00,
    currency: 'USD',
    bank_name: 'Stanbic Bank Zimbabwe',
    bank_account_number: '914000234567',
    bank_branch_code: 'STB-02',
    tax_number: 'TIN-7762319',
    emergency_contact_name: 'Tinashe Gumbo (Brother)',
    emergency_contact_phone: '+263 78 999 8877',
    status: 'active',
    created_at: new Date(Date.now() - 45 * 86400000).toISOString(),
    avatar_url: 'https://images.unsplash.com/photo-1500648767791-00dcc994a43e?w=150&auto=format&fit=crop&q=80'
  },
  {
    id: 'emp-004',
    employee_code: 'EMP-1004',
    first_name: 'Simbarashe',
    last_name: 'Ndlovu',
    email: 'simba.n@tarezaerp.co.zw',
    phone: '+263 73 345 6789',
    national_id: '08-654321-M-33',
    department: 'Accounting & Finance',
    job_title: 'Accounts Clerk & Bookkeeper',
    employment_type: 'full_time',
    hire_date: '2024-02-01',
    base_salary: 920.00,
    currency: 'USD',
    bank_name: 'EcoBank Zimbabwe',
    bank_account_number: '5501239841',
    bank_branch_code: 'ECO-HAR',
    tax_number: 'TIN-4451298',
    emergency_contact_name: 'Blessing Ndlovu (Father)',
    emergency_contact_phone: '+263 73 111 2233',
    status: 'active',
    created_at: new Date(Date.now() - 30 * 86400000).toISOString(),
    avatar_url: 'https://images.unsplash.com/photo-1492562080023-ab3db95bfbce?w=150&auto=format&fit=crop&q=80'
  }
];

export const hrService = {
  // ----------------------------------------------------
  // EMPLOYEES
  // ----------------------------------------------------
  async getEmployees(businessId: string): Promise<Employee[]> {
    try {
      const { data, error } = await supabase
        .from('employees')
        .select('*')
        .eq('business_id', businessId);

      if (!error && data && data.length > 0) {
        return data as Employee[];
      }
    } catch (e) {
      console.warn('Employees cloud fetch fallback to local storage:', e);
    }

    // Local storage fallback
    const key = `${STORAGE_KEYS.EMPLOYEES}_${businessId}`;
    const local = localStorage.getItem(key);
    if (local) {
      try {
        return JSON.parse(local);
      } catch (e) {
        // ignore
      }
    }

    // Initialize defaults
    const defaults = DEFAULT_EMPLOYEES.map(e => ({ ...e, business_id: businessId }));
    localStorage.setItem(key, JSON.stringify(defaults));
    return defaults;
  },

  async saveEmployee(businessId: string, employee: Partial<Employee>): Promise<Employee> {
    const employees = await this.getEmployees(businessId);
    let updated: Employee;

    if (employee.id) {
      const idx = employees.findIndex(e => e.id === employee.id);
      if (idx !== -1) {
        updated = { ...employees[idx], ...employee } as Employee;
        employees[idx] = updated;
      } else {
        updated = employee as Employee;
        employees.push(updated);
      }
    } else {
      const nextCode = `EMP-${1000 + employees.length + 1}`;
      updated = {
        id: `emp-${Date.now()}`,
        business_id: businessId,
        employee_code: employee.employee_code || nextCode,
        first_name: employee.first_name || 'Staff',
        last_name: employee.last_name || 'Member',
        email: employee.email || '',
        phone: employee.phone || '',
        national_id: employee.national_id || '',
        department: employee.department || 'Operations',
        job_title: employee.job_title || 'Store Associate',
        employment_type: employee.employment_type || 'full_time',
        hire_date: employee.hire_date || new Date().toISOString().split('T')[0],
        base_salary: Number(employee.base_salary) || 500,
        currency: employee.currency || 'USD',
        bank_name: employee.bank_name || '',
        bank_account_number: employee.bank_account_number || '',
        bank_branch_code: employee.bank_branch_code || '',
        tax_number: employee.tax_number || '',
        emergency_contact_name: employee.emergency_contact_name || '',
        emergency_contact_phone: employee.emergency_contact_phone || '',
        status: employee.status || 'active',
        created_at: new Date().toISOString()
      };
      employees.push(updated);
    }

    const key = `${STORAGE_KEYS.EMPLOYEES}_${businessId}`;
    localStorage.setItem(key, JSON.stringify(employees));

    try {
      await supabase.from('employees').upsert(updated);
    } catch (e) {
      console.warn('Employee cloud sync error:', e);
    }

    return updated;
  },

  async deleteEmployee(businessId: string, employeeId: string): Promise<boolean> {
    const employees = await this.getEmployees(businessId);
    const filtered = employees.filter(e => e.id !== employeeId);
    const key = `${STORAGE_KEYS.EMPLOYEES}_${businessId}`;
    localStorage.setItem(key, JSON.stringify(filtered));

    try {
      await supabase.from('employees').delete().eq('id', employeeId);
    } catch (e) {
      console.warn('Employee cloud delete error:', e);
    }
    return true;
  },

  // ----------------------------------------------------
  // ATTENDANCE & TIMESHEETS
  // ----------------------------------------------------
  async getAttendance(businessId: string, date?: string): Promise<AttendanceRecord[]> {
    const key = `${STORAGE_KEYS.ATTENDANCE}_${businessId}`;
    let records: AttendanceRecord[] = [];
    const local = localStorage.getItem(key);
    if (local) {
      try {
        records = JSON.parse(local);
      } catch (e) {
        records = [];
      }
    } else {
      // Seed sample attendance for today & yesterday
      const employees = await this.getEmployees(businessId);
      const todayStr = new Date().toISOString().split('T')[0];
      const yesterdayStr = new Date(Date.now() - 86400000).toISOString().split('T')[0];

      records = employees.map((emp, i) => ({
        id: `att-${emp.id}-${todayStr}`,
        business_id: businessId,
        employee_id: emp.id,
        employee_name: `${emp.first_name} ${emp.last_name}`,
        date: todayStr,
        clock_in: i === 1 ? '08:15' : '07:55',
        clock_out: i === 0 ? '17:05' : undefined,
        total_hours: i === 0 ? 9.1 : 8.0,
        overtime_hours: i === 0 ? 1.1 : 0,
        status: i === 1 ? 'late' : 'present',
        notes: i === 1 ? 'Traffic delay on Harare Road' : 'On-time shift arrival',
        created_at: new Date().toISOString()
      }));

      // Add yesterday records
      employees.forEach((emp) => {
        records.push({
          id: `att-${emp.id}-${yesterdayStr}`,
          business_id: businessId,
          employee_id: emp.id,
          employee_name: `${emp.first_name} ${emp.last_name}`,
          date: yesterdayStr,
          clock_in: '08:00',
          clock_out: '17:00',
          total_hours: 9.0,
          overtime_hours: 1.0,
          status: 'present',
          notes: 'Regular shift completed',
          created_at: new Date(Date.now() - 86400000).toISOString()
        });
      });

      localStorage.setItem(key, JSON.stringify(records));
    }

    if (date) {
      return records.filter(r => r.date === date);
    }
    return records.sort((a, b) => b.date.localeCompare(a.date));
  },

  async clockInOrOut(
    businessId: string, 
    employeeId: string, 
    type: 'clock_in' | 'clock_out',
    notes?: string
  ): Promise<AttendanceRecord> {
    const todayStr = new Date().toISOString().split('T')[0];
    const timeStr = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    const employees = await this.getEmployees(businessId);
    const emp = employees.find(e => e.id === employeeId);
    const empName = emp ? `${emp.first_name} ${emp.last_name}` : 'Employee';

    const records = await this.getAttendance(businessId);
    let todayRecord = records.find(r => r.employee_id === employeeId && r.date === todayStr);

    if (type === 'clock_in') {
      if (todayRecord) {
        todayRecord.clock_in = timeStr;
        todayRecord.status = 'present';
        if (notes) todayRecord.notes = notes;
      } else {
        todayRecord = {
          id: `att-${employeeId}-${todayStr}`,
          business_id: businessId,
          employee_id: employeeId,
          employee_name: empName,
          date: todayStr,
          clock_in: timeStr,
          total_hours: 0,
          overtime_hours: 0,
          status: 'present',
          notes: notes || 'Punched in via POS/HR Terminal',
          created_at: new Date().toISOString()
        };
        records.unshift(todayRecord);
      }
    } else {
      // Clock out
      if (!todayRecord) {
        todayRecord = {
          id: `att-${employeeId}-${todayStr}`,
          business_id: businessId,
          employee_id: employeeId,
          employee_name: empName,
          date: todayStr,
          clock_in: '08:00',
          clock_out: timeStr,
          total_hours: 8.0,
          overtime_hours: 0,
          status: 'present',
          notes: notes || 'Punched out',
          created_at: new Date().toISOString()
        };
        records.unshift(todayRecord);
      } else {
        todayRecord.clock_out = timeStr;
        // Simple 8-hour estimation
        todayRecord.total_hours = 8.5;
        todayRecord.overtime_hours = 0.5;
      }
    }

    const key = `${STORAGE_KEYS.ATTENDANCE}_${businessId}`;
    localStorage.setItem(key, JSON.stringify(records));
    return todayRecord;
  },

  // ----------------------------------------------------
  // LEAVE & TIME-OFF REQUESTS
  // ----------------------------------------------------
  async getLeaveRequests(businessId: string): Promise<LeaveRequest[]> {
    const key = `${STORAGE_KEYS.LEAVE}_${businessId}`;
    const local = localStorage.getItem(key);
    if (local) {
      try {
        return JSON.parse(local);
      } catch (e) {
        // ignore
      }
    }

    // Default sample leave requests
    const defaults: LeaveRequest[] = [
      {
        id: 'lv-001',
        business_id: businessId,
        employee_id: 'emp-002',
        employee_name: 'Farai Chidzero',
        leave_type: 'annual',
        start_date: '2026-09-01',
        end_date: '2026-09-05',
        days_count: 5,
        reason: 'Annual family vacation leave',
        status: 'approved',
        approved_by: 'Tendai Moyo (Store Manager)',
        approval_date: '2026-08-18',
        comments: 'Coverage arranged with relief cashier.',
        created_at: '2026-08-15T10:00:00Z'
      },
      {
        id: 'lv-002',
        business_id: businessId,
        employee_id: 'emp-004',
        employee_name: 'Simbarashe Ndlovu',
        leave_type: 'sick',
        start_date: '2026-08-22',
        end_date: '2026-08-23',
        days_count: 2,
        reason: 'Medical dental appointment & rest',
        status: 'pending',
        created_at: new Date().toISOString()
      }
    ];

    localStorage.setItem(key, JSON.stringify(defaults));
    return defaults;
  },

  async submitLeaveRequest(businessId: string, req: Partial<LeaveRequest>): Promise<LeaveRequest> {
    const list = await this.getLeaveRequests(businessId);
    const employees = await this.getEmployees(businessId);
    const emp = employees.find(e => e.id === req.employee_id);

    const newReq: LeaveRequest = {
      id: `lv-${Date.now()}`,
      business_id: businessId,
      employee_id: req.employee_id || '',
      employee_name: emp ? `${emp.first_name} ${emp.last_name}` : 'Staff',
      leave_type: req.leave_type || 'annual',
      start_date: req.start_date || new Date().toISOString().split('T')[0],
      end_date: req.end_date || new Date().toISOString().split('T')[0],
      days_count: req.days_count || 1,
      reason: req.reason || 'Personal leave',
      status: 'pending',
      created_at: new Date().toISOString()
    };

    list.unshift(newReq);
    const key = `${STORAGE_KEYS.LEAVE}_${businessId}`;
    localStorage.setItem(key, JSON.stringify(list));
    return newReq;
  },

  async updateLeaveStatus(
    businessId: string, 
    leaveId: string, 
    status: 'approved' | 'rejected', 
    reviewerName: string,
    comments?: string
  ): Promise<boolean> {
    const list = await this.getLeaveRequests(businessId);
    const item = list.find(l => l.id === leaveId);
    if (!item) return false;

    item.status = status;
    item.approved_by = reviewerName;
    item.approval_date = new Date().toISOString().split('T')[0];
    if (comments) item.comments = comments;

    const key = `${STORAGE_KEYS.LEAVE}_${businessId}`;
    localStorage.setItem(key, JSON.stringify(list));
    return true;
  },

  // ----------------------------------------------------
  // PAYROLL CALCULATION & GENERAL LEDGER POSTING
  // ----------------------------------------------------
  async getPayrollRuns(businessId: string): Promise<PayrollRun[]> {
    const key = `${STORAGE_KEYS.PAYROLL_RUNS}_${businessId}`;
    const local = localStorage.getItem(key);
    if (local) {
      try {
        return JSON.parse(local);
      } catch (e) {
        // ignore
      }
    }
    return [];
  },

  async getPayslips(businessId: string, payrollRunId?: string): Promise<Payslip[]> {
    const key = `${STORAGE_KEYS.PAYSLIPS}_${businessId}`;
    const local = localStorage.getItem(key);
    let all: Payslip[] = [];
    if (local) {
      try {
        all = JSON.parse(local);
      } catch (e) {
        all = [];
      }
    }
    if (payrollRunId) {
      return all.filter(p => p.payroll_run_id === payrollRunId);
    }
    return all;
  },

  calculatePayrollBreakdown(employee: Employee, overtimeHours: number = 0, bonusAmt: number = 0) {
    const baseSalary = Number(employee.base_salary) || 0;
    
    // Standard allowances in retail/corporate
    const housingAllowance = baseSalary >= 1000 ? 150 : 75;
    const transportAllowance = 50;
    const hourlyEquivalent = baseSalary / 173.33; // 40h week / 4.33
    const overtimePay = overtimeHours * hourlyEquivalent * 1.5;

    const grossEarnings = baseSalary + housingAllowance + transportAllowance + overtimePay + bonusAmt;

    // Progressive PAYE Tax Estimation (Zimbabwe/Regional standard brackets)
    // 0 - 300: 0%
    // 300 - 800: 15%
    // 800 - 1500: 20%
    // 1500+: 25%
    let taxPaye = 0;
    if (grossEarnings > 1500) {
      taxPaye = 75 + 140 + (grossEarnings - 1500) * 0.25;
    } else if (grossEarnings > 800) {
      taxPaye = 75 + (grossEarnings - 800) * 0.20;
    } else if (grossEarnings > 300) {
      taxPaye = (grossEarnings - 300) * 0.15;
    }

    // NSSA / Social Security (4.5% capped)
    const pensionNssa = Math.min(grossEarnings * 0.045, 50.00);
    // Medical Aid deduction
    const medicalAid = baseSalary >= 1000 ? 40 : 25;
    const loanDeduction = 0;

    const totalDeductions = taxPaye + pensionNssa + medicalAid + loanDeduction;
    const netPay = grossEarnings - totalDeductions;

    return {
      baseSalary,
      housingAllowance,
      transportAllowance,
      overtimePay,
      bonus: bonusAmt,
      grossEarnings,
      taxPaye,
      pensionNssa,
      medicalAid,
      loanDeduction,
      totalDeductions,
      netPay
    };
  },

  async runPayrollBatch(
    businessId: string,
    branchId: string,
    userId: string,
    monthYear: string,
    periodStart: string,
    periodEnd: string,
    postToGL: boolean = true
  ): Promise<{ run: PayrollRun; payslips: Payslip[]; journalRef?: string }> {
    const employees = (await this.getEmployees(businessId)).filter(e => e.status === 'active');
    
    if (employees.length === 0) {
      throw new Error('No active employees found to generate payroll.');
    }

    const runId = `pr-${Date.now()}`;
    const generatedPayslips: Payslip[] = [];

    let totalGross = 0;
    let totalAllowances = 0;
    let totalTax = 0;
    let totalPension = 0;
    let totalDeductions = 0;
    let totalNet = 0;

    employees.forEach((emp) => {
      const calc = this.calculatePayrollBreakdown(emp, 4, 0);

      const payslip: Payslip = {
        id: `ps-${emp.id}-${Date.now()}`,
        payroll_run_id: runId,
        employee_id: emp.id,
        employee_code: emp.employee_code,
        employee_name: `${emp.first_name} ${emp.last_name}`,
        department: emp.department,
        job_title: emp.job_title,
        bank_name: emp.bank_name,
        bank_account: emp.bank_account_number,
        base_salary: calc.baseSalary,
        housing_allowance: calc.housingAllowance,
        transport_allowance: calc.transportAllowance,
        overtime_pay: calc.overtimePay,
        bonus: calc.bonus,
        gross_earnings: calc.grossEarnings,
        tax_paye: calc.taxPaye,
        pension_nssa: calc.pensionNssa,
        medical_aid: calc.medicalAid,
        loan_deduction: calc.loanDeduction,
        total_deductions: calc.totalDeductions,
        net_pay: calc.netPay,
        payment_method: 'bank_transfer',
        status: 'generated',
        created_at: new Date().toISOString()
      };

      generatedPayslips.push(payslip);

      totalGross += calc.grossEarnings;
      totalAllowances += (calc.housingAllowance + calc.transportAllowance + calc.overtimePay + calc.bonus);
      totalTax += calc.taxPaye;
      totalPension += calc.pensionNssa;
      totalDeductions += calc.totalDeductions;
      totalNet += calc.netPay;
    });

    let journalRefCode: string | undefined = undefined;

    // Post to General Ledger if enabled
    if (postToGL) {
      journalRefCode = `PAYROLL-${monthYear.toUpperCase().replace(/\s+/g, '-')}`;
      const narrative = `Monthly payroll disbursement for ${monthYear} (${employees.length} staff)`;

      const baseSalariesTotal = employees.reduce((s, e) => s + (Number(e.base_salary) || 0), 0);
      const totalDebit = baseSalariesTotal + totalAllowances;
      const totalCredit = totalTax + totalPension + (totalDeductions - totalTax - totalPension) + totalNet;

      // GL Lines:
      // Dr 6100 Salaries & Wages Expense (Base)
      // Dr 6120 Staff Allowances & Benefits (Allowances + Overtime)
      // Cr 2200 Payroll Tax & PAYE Payable
      // Cr 2210 Pension & NSSA Payable
      // Cr 2300 Accrued Benefits / Medical Aid Payable
      // Cr 1000 Cash Till / Operating Bank Account (Net Pay disbursed)
      const glLines = [
        {
          accountCode: '6100', // Salaries Expense
          debit: Number(baseSalariesTotal.toFixed(2)),
          credit: 0,
          description: `Base salaries expense ${monthYear}`
        },
        {
          accountCode: '6120', // Allowances & Overtime
          debit: Number(totalAllowances.toFixed(2)),
          credit: 0,
          description: `Staff housing/transport & overtime ${monthYear}`
        },
        {
          accountCode: '2200', // Payroll Tax PAYE
          debit: 0,
          credit: Number(totalTax.toFixed(2)),
          description: `PAYE withholding tax payable ${monthYear}`
        },
        {
          accountCode: '2210', // Pension NSSA
          debit: 0,
          credit: Number(totalPension.toFixed(2)),
          description: `NSSA social security deductions ${monthYear}`
        },
        {
          accountCode: '2300', // Accrued benefits
          debit: 0,
          credit: Number((totalDeductions - totalTax - totalPension).toFixed(2)),
          description: `Medical aid and payroll withholdings ${monthYear}`
        },
        {
          accountCode: '1000', // Main Cash Till / Operating Bank
          debit: 0,
          credit: Number(totalNet.toFixed(2)),
          description: `Net salary transfers to staff accounts ${monthYear}`
        }
      ];

      // Rebalance precision pennies if rounding created a microscopic offset
      const sumDr = glLines.reduce((s, l) => s + l.debit, 0);
      const sumCr = glLines.reduce((s, l) => s + l.credit, 0);
      const diff = sumDr - sumCr;
      if (Math.abs(diff) > 0 && Math.abs(diff) < 0.05) {
        glLines[glLines.length - 1].credit += diff;
      }

      try {
        await postJournalEntry(
          businessId,
          branchId,
          userId,
          journalRefCode,
          narrative,
          glLines
        );
      } catch (err) {
        console.warn('GL payroll posting fallback warning:', err);
      }
    }

    const payrollRun: PayrollRun = {
      id: runId,
      business_id: businessId,
      branch_id: branchId,
      period_start: periodStart,
      period_end: periodEnd,
      month_year: monthYear,
      total_gross_pay: totalGross,
      total_allowances: totalAllowances,
      total_deductions: totalDeductions,
      total_tax_paye: totalTax,
      total_pension_nssa: totalPension,
      total_net_pay: totalNet,
      status: postToGL ? 'posted_to_gl' : 'processed',
      gl_journal_id: journalRefCode,
      payment_date: new Date().toISOString().split('T')[0],
      created_by: userId,
      created_at: new Date().toISOString(),
      payslips_count: generatedPayslips.length
    };

    // Save Payroll Run
    const runs = await this.getPayrollRuns(businessId);
    runs.unshift(payrollRun);
    localStorage.setItem(`${STORAGE_KEYS.PAYROLL_RUNS}_${businessId}`, JSON.stringify(runs));

    // Save Payslips
    const existingPayslips = await this.getPayslips(businessId);
    const updatedPayslips = [...generatedPayslips, ...existingPayslips];
    localStorage.setItem(`${STORAGE_KEYS.PAYSLIPS}_${businessId}`, JSON.stringify(updatedPayslips));

    return {
      run: payrollRun,
      payslips: generatedPayslips,
      journalRef: journalRefCode
    };
  },

  // ----------------------------------------------------
  // PDF PAYSLIP EXPORT ENGINE
  // ----------------------------------------------------
  exportPayslipPDF(payslip: Payslip, businessName: string = 'TAREZA ENTERPRISE RETAIL (PVT) LTD') {
    try {
      const doc = new jsPDF({
        orientation: 'portrait',
        unit: 'mm',
        format: 'a4'
      });

      const callAutoTable = (options: any) => {
        if (typeof autoTable === 'function') {
          autoTable(doc, options);
        } else if (typeof (doc as any).autoTable === 'function') {
          (doc as any).autoTable(options);
        }
      };

      // Header Banner
      doc.setFillColor(15, 23, 42); // slate-900
      doc.rect(0, 0, 210, 32, 'F');

      doc.setTextColor(255, 255, 255);
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(16);
      doc.text(businessName.toUpperCase(), 14, 13);

      doc.setFontSize(9);
      doc.setFont('helvetica', 'normal');
      doc.setTextColor(203, 213, 225);
      doc.text('OFFICIAL EMPLOYEE SALARY PAYSLIP & REMUNERATION ADVICE', 14, 20);
      doc.text(`DATE ISSUED: ${new Date().toLocaleDateString()} | PAYSLIP REF: ${payslip.id.toUpperCase()}`, 14, 26);

      let y = 38;

      // Employee Information Box
      doc.setFillColor(248, 250, 252);
      doc.setDrawColor(226, 232, 240);
      doc.roundedRect(14, y, 182, 30, 2, 2, 'FD');

      doc.setFontSize(8.5);
      doc.setTextColor(51, 65, 85);

      // Left column
      doc.setFont('helvetica', 'bold');
      doc.text('Employee Name:', 18, y + 7);
      doc.setFont('helvetica', 'normal');
      doc.text(payslip.employee_name, 55, y + 7);

      doc.setFont('helvetica', 'bold');
      doc.text('Employee Code / ID:', 18, y + 14);
      doc.setFont('helvetica', 'normal');
      doc.text(payslip.employee_code, 55, y + 14);

      doc.setFont('helvetica', 'bold');
      doc.text('Department:', 18, y + 21);
      doc.setFont('helvetica', 'normal');
      doc.text(payslip.department, 55, y + 21);

      doc.setFont('helvetica', 'bold');
      doc.text('Job Designation:', 18, y + 27);
      doc.setFont('helvetica', 'normal');
      doc.text(payslip.job_title, 55, y + 27);

      // Right column
      doc.setFont('helvetica', 'bold');
      doc.text('Bank Institution:', 115, y + 7);
      doc.setFont('helvetica', 'normal');
      doc.text(payslip.bank_name || 'Direct Bank Account', 150, y + 7);

      doc.setFont('helvetica', 'bold');
      doc.text('Account Number:', 115, y + 14);
      doc.setFont('helvetica', 'normal');
      doc.text(payslip.bank_account || 'N/A', 150, y + 14);

      doc.setFont('helvetica', 'bold');
      doc.text('Payment Channel:', 115, y + 21);
      doc.setFont('helvetica', 'normal');
      doc.text(payslip.payment_method.toUpperCase(), 150, y + 21);

      doc.setFont('helvetica', 'bold');
      doc.text('Remuneration Status:', 115, y + 27);
      doc.setFont('helvetica', 'normal');
      doc.text('CONFIRMED / PAID', 150, y + 27);

      y += 36;

      // Earnings Table
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(10);
      doc.setTextColor(15, 23, 42);
      doc.text('1. GROSS EARNINGS & REMUNERATION ALLOWANCES', 14, y);
      y += 3;

      const earningsRows = [
        ['Basic Monthly Salary', `$${payslip.base_salary.toFixed(2)}`],
        ['Housing Subsidy Allowance', `$${payslip.housing_allowance.toFixed(2)}`],
        ['Transport / Commuter Allowance', `$${payslip.transport_allowance.toFixed(2)}`],
        ['Overtime Compensation Pay', `$${payslip.overtime_pay.toFixed(2)}`],
        ['Performance Bonus & Commission', `$${payslip.bonus.toFixed(2)}`],
        ['TOTAL GROSS EARNINGS', `$${payslip.gross_earnings.toFixed(2)}`]
      ];

      callAutoTable({
        startY: y,
        margin: { left: 14, right: 14 },
        head: [['Earnings Description', 'Amount (USD)']],
        body: earningsRows,
        theme: 'grid',
        headStyles: {
          fillColor: [30, 41, 59],
          textColor: [255, 255, 255],
          fontSize: 8,
          fontStyle: 'bold'
        },
        styles: {
          fontSize: 8,
          cellPadding: 2,
          textColor: [30, 41, 59]
        },
        columnStyles: {
          0: { cellWidth: 130 },
          1: { cellWidth: 52, halign: 'right', fontStyle: 'bold' }
        },
        didParseCell: (data: any) => {
          if (data.row.index === 5) {
            data.cell.styles.fillColor = [240, 253, 244];
            data.cell.styles.textColor = [22, 101, 52];
            data.cell.styles.fontStyle = 'bold';
          }
        }
      });

      y = (doc as any).lastAutoTable?.finalY + 8;

      // Deductions Table
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(10);
      doc.setTextColor(15, 23, 42);
      doc.text('2. STATUTORY DEDUCTIONS & WITHHOLDINGS', 14, y);
      y += 3;

      const deductionRows = [
        ['PAYE Withholding Income Tax', `-$${payslip.tax_paye.toFixed(2)}`],
        ['NSSA / National Social Security Pension', `-$${payslip.pension_nssa.toFixed(2)}`],
        ['Corporate Medical Aid Plan', `-$${payslip.medical_aid.toFixed(2)}`],
        ['Staff Advance Loan Repayment', `-$${payslip.loan_deduction.toFixed(2)}`],
        ['TOTAL STATUTORY & VOLUNTARY DEDUCTIONS', `-$${payslip.total_deductions.toFixed(2)}`]
      ];

      callAutoTable({
        startY: y,
        margin: { left: 14, right: 14 },
        head: [['Deduction Category', 'Amount (USD)']],
        body: deductionRows,
        theme: 'grid',
        headStyles: {
          fillColor: [51, 65, 85],
          textColor: [255, 255, 255],
          fontSize: 8,
          fontStyle: 'bold'
        },
        styles: {
          fontSize: 8,
          cellPadding: 2,
          textColor: [51, 65, 85]
        },
        columnStyles: {
          0: { cellWidth: 130 },
          1: { cellWidth: 52, halign: 'right', fontStyle: 'bold' }
        },
        didParseCell: (data: any) => {
          if (data.row.index === 4) {
            data.cell.styles.fillColor = [254, 242, 242];
            data.cell.styles.textColor = [153, 27, 27];
            data.cell.styles.fontStyle = 'bold';
          }
        }
      });

      y = (doc as any).lastAutoTable?.finalY + 8;

      // Net Pay Summary Banner
      doc.setFillColor(236, 253, 245);
      doc.setDrawColor(16, 185, 129);
      doc.roundedRect(14, y, 182, 16, 2, 2, 'FD');

      doc.setFont('helvetica', 'bold');
      doc.setFontSize(11);
      doc.setTextColor(6, 95, 70);
      doc.text('NET TAKE-HOME REMUNERATION PAYABLE:', 20, y + 10);
      doc.setFontSize(14);
      doc.text(`$${payslip.net_pay.toFixed(2)} USD`, 190, y + 10.5, { align: 'right' });

      y += 24;

      // Signature section
      doc.setDrawColor(203, 213, 225);
      doc.roundedRect(14, y, 182, 30, 2, 2, 'D');

      doc.setFont('helvetica', 'bold');
      doc.setFontSize(8);
      doc.setTextColor(15, 23, 42);
      doc.text('Authorized Finance Signatory', 20, y + 6);
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(7);
      doc.setTextColor(100, 116, 139);
      doc.text('Tareza ERP Human Resources & Payroll Officer', 20, y + 11);
      doc.line(20, y + 23, 95, y + 23);
      doc.text('Signature & Date Stamp', 20, y + 27);

      doc.setFont('helvetica', 'bold');
      doc.setFontSize(8);
      doc.setTextColor(15, 23, 42);
      doc.text('Employee Acknowledgement', 110, y + 6);
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(7);
      doc.setTextColor(100, 116, 139);
      doc.text('Received in good order and verified.', 110, y + 11);
      doc.line(110, y + 23, 185, y + 23);
      doc.text('Employee Signature & Date', 110, y + 27);

      // Footer
      doc.setFontSize(7);
      doc.setTextColor(148, 163, 184);
      doc.text('Confidential Document • Tareza ERP Enterprise Accounting & Human Resources Management System', 105, 290, { align: 'center' });

      doc.save(`Payslip_${payslip.employee_code}_${payslip.employee_name.replace(/\s+/g, '_')}.pdf`);
      toast.success(`Payslip for ${payslip.employee_name} downloaded successfully!`);
    } catch (e: any) {
      console.error('PDF Payslip export error:', e);
      toast.error('Failed to export PDF payslip.');
    }
  }
};
