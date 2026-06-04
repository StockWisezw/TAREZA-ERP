import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from '../ui/card';
import { Button } from '../ui/button';
import { Plus, Users, Shield, Building2, Trash2, Loader2, Eye, EyeOff, Check, UserPlus } from 'lucide-react';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '../ui/table';
import { Avatar, AvatarFallback } from '../ui/avatar';
import { Badge } from '../ui/badge';
import { toast } from 'sonner';
import { supabase, firebaseConfig } from '../../lib/supabaseClient';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from '../ui/dialog';
import { Input } from '../ui/input';
import { Label } from '../ui/label';

export function UserManagement() {
  const [loading, setLoading] = useState(true);
  const [isSubmitActive, setIsSubmitActive] = useState(false);
  const [teamMembers, setTeamMembers] = useState<any[]>([]);
  const [branches, setBranches] = useState<any[]>([]);
  const [roles, setRoles] = useState<any[]>([]);
  
  const [businessId, setBusinessId] = useState<string | null>(null);
  const [maxAllowedUsers, setMaxAllowedUsers] = useState(5);
  const [isDialogOpen, setIsDialogOpen] = useState(false);

  // Form Fields for Manual User Addition
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [selectedBranchId, setSelectedBranchId] = useState('');
  const [selectedRole, setSelectedRole] = useState('Staff');

  const loadTeamData = async () => {
    try {
      setLoading(true);
      const { data: userData } = await supabase.auth.getUser();
      if (!userData.user) return;

      const { data: buData } = await supabase.from('business_users').select('business_id').eq('user_id', userData.user.id).limit(1).maybeSingle();
      if (!buData) return;
      setBusinessId(buData.business_id);

      // Fetch Business Max User Quota based on plan or fallback
      const { data: bData } = await supabase.from('businesses').select('max_users').eq('id', buData.business_id).maybeSingle();
      const { data: subData } = await supabase.from('subscriptions').select('plan_name').eq('business_id', buData.business_id).order('created_at', { ascending: false }).limit(1).maybeSingle();
      
      const planNameRaw = subData?.plan_name || 'free_trial';
      const planMaxUsers = planNameRaw === 'starter' ? 3 : planNameRaw === 'pro' ? 10 : planNameRaw === 'enterprise' ? 100 : (bData?.max_users || 5);
      setMaxAllowedUsers(planMaxUsers);

      // Fetch Branches
      const { data: branchData } = await supabase.from('branches').select('*').eq('business_id', buData.business_id);
      if (branchData) {
        setBranches(branchData);
        if (branchData.length > 0) {
          setSelectedBranchId(branchData[0].id);
        }
      }

      // Fetch Roles
      const { data: roleData } = await supabase.from('roles').select('*').eq('business_id', buData.business_id);
      const currentRoles = roleData || [];
      setRoles(currentRoles);

      // Fetch Business Users
      const { data: teamData } = await supabase.from('business_users').select('*').eq('business_id', buData.business_id);
      
      if (teamData) {
        // Fetch all profiles to map details locally
        const { data: allProfiles } = await supabase.from('profiles').select('*');
        const profileMap: Record<string, any> = {};
        if (allProfiles) {
          allProfiles.forEach((p: any) => {
            profileMap[p.id] = p;
          });
        }

        const roleMap: Record<string, string> = {};
        currentRoles.forEach((r: any) => {
          roleMap[r.id] = r.name;
        });

        const branchMap: Record<string, string> = {};
        if (branchData) {
          branchData.forEach((b: any) => {
            branchMap[b.id] = b.name;
          });
        }

        const mappedTeam = teamData.map((t: any) => {
          const profile = profileMap[t.user_id];
          const firstNameStr = profile?.first_name || 'Staff';
          const lastNameStr = profile?.last_name || 'Member';
          return {
            id: t.id,
            user_id: t.user_id,
            name: `${firstNameStr} ${lastNameStr}`,
            email: profile?.email || t.invited_email || '',
            phone: profile?.phone || '',
            role: t.role_id ? (roleMap[t.role_id] || 'Staff') : 'Staff',
            branch: t.branch_id ? (branchMap[t.branch_id] || 'Primary') : 'Main Branch',
            status: t.is_active !== false ? 'active' : 'inactive',
            avatar: `${firstNameStr.substring(0, 1)}${lastNameStr.substring(0, 1)}`.toUpperCase()
          };
        });

        setTeamMembers(mappedTeam);
      }
    } catch (err) {
      console.error('[UserManagement] loadError:', err);
      toast.error("Failed to load team workspace.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadTeamData();
  }, []);

  const handleAddNewUser = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!businessId) return;

    // Enforce Plan Seat Limits
    if (teamMembers.length >= maxAllowedUsers) {
      toast.error(`User seat limit reached! Your plan permits a maximum of ${maxAllowedUsers} users. Please upgrade your subscription to add more seats.`);
      return;
    }

    if (password.length < 6) {
      toast.error("Password must be at least 6 characters long.");
      return;
    }

    setIsSubmitActive(true);
    let targetRoleId = '';

    try {
      // 1. Resolve selected Role UUID (find or insert custom role names nicely to avoid foreign key violations)
      const sanitizedRoleName = selectedRole.trim();
      const existingRoleObj = roles.find(r => r.name.toLowerCase() === sanitizedRoleName.toLowerCase());
      
      if (existingRoleObj) {
        targetRoleId = existingRoleObj.id;
      } else {
        // Database trigger or manual insert for support settings roles
        const { data: newRole, error: roleError } = await supabase.from('roles').insert({
          business_id: businessId,
          name: sanitizedRoleName,
          description: `${sanitizedRoleName} Role`
        }).select().single();

        if (roleError) throw roleError;
        targetRoleId = (newRole as any).id;
        // update local roles cache
        setRoles(prev => [...prev, newRole]);
      }

      // 2. Initialize isolated temporary Firebase app instance for secure email/pass generation without admin logout!
      const { initializeApp, deleteApp } = await import('firebase/app');
      const { getAuth, createUserWithEmailAndPassword, signOut } = await import('firebase/auth');
      
      const tempApp = initializeApp(firebaseConfig, `TempStaffApp-${Date.now()}`);
      const tempAuth = getAuth(tempApp);

      // 3. Register user credentials into Firebase Auth
      toast.loading("Registering staff credentials...", { id: "user-op" });
      let newUserUid = '';
      try {
        const cred = await createUserWithEmailAndPassword(tempAuth, email, password);
        newUserUid = cred.user.uid;
        await signOut(tempAuth);
      } finally {
        await deleteApp(tempApp);
      }

      if (!newUserUid) throw new Error("Firebase Auth failed to generate user details.");

      // 4. Create internal CRM / user Profile link
      toast.loading("Saving employee profile record...", { id: "user-op" });
      const { error: profileError } = await supabase.from('profiles').insert({
        id: newUserUid,
        first_name: firstName,
        last_name: lastName,
        phone: phone || null,
        email: email
      });
      if (profileError) throw profileError;

      // 5. Create business-branch link relation record
      toast.loading("Mapping permissions & assigned branch...", { id: "user-op" });
      const { error: buError } = await supabase.from('business_users').insert({
        business_id: businessId,
        user_id: newUserUid,
        branch_id: selectedBranchId || null,
        role_id: targetRoleId || null,
        is_active: true
      });
      if (buError) throw buError;

      toast.success(`User "${firstName} ${lastName}" created successfully! They can log in immediately.`, { id: "user-op" });
      
      // Close form setup
      setIsDialogOpen(false);
      setFirstName('');
      setLastName('');
      setEmail('');
      setPhone('');
      setPassword('');

      // Refresh dynamic listings
      await loadTeamData();
    } catch (err: any) {
      console.error('[AddUserException]:', err);
      toast.error(err.message || "Failed to register new manual user account.", { id: "user-op" });
    } finally {
      setIsSubmitActive(false);
    }
  };

  const handleRemoveMember = async (id: string, name: string) => {
    if (!confirm(`Are you sure you want to delete staff account link for "${name}"?\nThis removes their login authorization access to this business profile.`)) {
      return;
    }

    try {
      toast.loading("Revoking team access links...", { id: "member-delete" });
      const { error } = await supabase.from('business_users').delete().eq('id', id);
      if (error) throw error;

      toast.success(`Revoked authorization for "${name}".`, { id: "member-delete" });
      setTeamMembers(prev => prev.filter(t => t.id !== id));
    } catch (err: any) {
      toast.error(err.message || "Failed to delete team member linkage.", { id: "member-delete" });
    }
  };

  if (loading) {
    return (
      <div className="p-12 text-center text-zinc-500 flex flex-col items-center justify-center min-h-[300px]">
        <Loader2 className="animate-spin w-8 h-8 text-primary mb-3" />
        <p className="text-sm font-medium">Synthesizing team details & profile catalogs...</p>
      </div>
    );
  }

  // Calculate stats
  const activeCount = teamMembers.filter(t => t.status === 'active').length;
  const remainingSeats = Math.max(0, maxAllowedUsers - teamMembers.length);

  return (
    <div className="space-y-8 animate-in fade-in duration-300">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h3 className="text-xl font-bold text-zinc-900 tracking-tight">Users & Team Dashboard</h3>
          <p className="text-sm text-zinc-500 mt-1">
            Configure direct local access credentials up to your subscription's permitted seat limit.
          </p>
        </div>
        
        <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
          <DialogTrigger asChild>
            <Button size="sm" className="bg-primary text-primary-foreground shadow-sm">
              <Plus className="mr-2 h-4 w-4" /> Add New User
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-md bg-white border border-zinc-200">
            <DialogHeader>
              <DialogTitle className="text-zinc-900">Create Staff Account</DialogTitle>
              <DialogDescription className="text-zinc-500">
                Register a new member instantly. They will be assigned a username/password and can log in immediately.
              </DialogDescription>
            </DialogHeader>

            <form onSubmit={handleAddNewUser} className="space-y-4 pt-2">
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label className="text-zinc-700">First Name</Label>
                  <Input 
                    value={firstName} 
                    onChange={e => setFirstName(e.target.value)} 
                    required 
                    placeholder="John" 
                    className="h-10 border-zinc-200"
                  />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-zinc-700">Last Name</Label>
                  <Input 
                    value={lastName} 
                    onChange={e => setLastName(e.target.value)} 
                    required 
                    placeholder="Doe" 
                    className="h-10 border-zinc-200"
                  />
                </div>
              </div>

              <div className="space-y-1.5">
                <Label className="text-zinc-700">Email Address (Login Username)</Label>
                <Input 
                  type="email" 
                  value={email} 
                  onChange={e => setEmail(e.target.value)} 
                  required 
                  placeholder="john.doe@tareza.co.zw" 
                  className="h-10 border-zinc-200"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label className="text-zinc-700">Phone Code</Label>
                  <Input 
                    type="tel" 
                    value={phone} 
                    onChange={e => setPhone(e.target.value)} 
                    placeholder="+263777123456" 
                    className="h-10 border-zinc-200"
                  />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-zinc-700">Login Password</Label>
                  <div className="relative">
                    <Input 
                      type={showPassword ? "text" : "password"} 
                      value={password} 
                      onChange={e => setPassword(e.target.value)} 
                      required 
                      minLength={6} 
                      placeholder="••••••••" 
                      className="h-10 border-zinc-200 pr-10"
                    />
                    <button 
                      type="button" 
                      onClick={() => setShowPassword(!showPassword)}
                      className="absolute right-3 top-3 text-zinc-400 hover:text-zinc-600 transition-colors"
                    >
                      {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label className="text-zinc-700">Assigned Branch</Label>
                  <select 
                    value={selectedBranchId} 
                    onChange={e => setSelectedBranchId(e.target.value)} 
                    className="flex h-10 w-full rounded-md border border-zinc-200 bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
                  >
                    {branches.length === 0 ? (
                      <option value="">No Branches Setup</option>
                    ) : (
                      branches.map(b => (
                        <option key={b.id} value={b.id}>{b.name}</option>
                      ))
                    )}
                  </select>
                </div>
                <div className="space-y-1.5">
                  <Label className="text-zinc-700">Authorization Role</Label>
                  <select 
                    value={selectedRole} 
                    onChange={e => setSelectedRole(e.target.value)} 
                    className="flex h-10 w-full rounded-md border border-zinc-200 bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
                  >
                    <option value="Staff">Staff</option>
                    <option value="Cashier">Cashier</option>
                    <option value="Manager">Manager</option>
                    <option value="Admin">Admin</option>
                  </select>
                </div>
              </div>

              <Button type="submit" className="w-full mt-4" disabled={isSubmitActive}>
                {isSubmitActive ? (
                  <>
                    <Loader2 className="animate-spin w-4 h-4 mr-2" />
                    Deploying Credentials...
                  </>
                ) : (
                  <>
                    <UserPlus className="w-4 h-4 mr-2" />
                    Register Account Manual
                  </>
                )}
              </Button>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      {/* Analytics widgets metrics summaries */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <Card className="border-zinc-200/60 shadow-sm p-6 flex items-center gap-4 bg-zinc-50/50">
          <div className="p-3 bg-blue-50 text-blue-600 rounded-xl"><Users className="w-6 h-6" /></div>
          <div>
            <p className="text-sm font-medium text-zinc-500">Active Staff Seats</p>
            <h4 className="text-2xl font-bold text-zinc-900">{teamMembers.length} <span className="text-xs text-zinc-400 font-normal">/ {maxAllowedUsers} max</span></h4>
          </div>
        </Card>
        <Card className="border-zinc-200/60 shadow-sm p-6 flex items-center gap-4 bg-zinc-50/50">
          <div className="p-3 bg-emerald-50 text-emerald-600 rounded-xl"><Shield className="w-6 h-6" /></div>
          <div>
            <p className="text-sm font-medium text-zinc-500">Authenticated OK</p>
            <h4 className="text-2xl font-bold text-zinc-900">{activeCount}</h4>
          </div>
        </Card>
        <Card className="border-zinc-200/60 shadow-sm p-6 flex items-center gap-4 bg-zinc-50/50">
          <div className="p-3 bg-indigo-50 text-indigo-600 rounded-xl"><Plus className="w-6 h-6" /></div>
          <div>
            <p className="text-sm font-medium text-zinc-500">Remaining Plan Seats</p>
            <h4 className="text-2xl font-bold text-zinc-900">{remainingSeats} <span className="text-xs font-normal text-zinc-400">Available</span></h4>
          </div>
        </Card>
      </div>

      {/* Main Grid display table */}
      <Card className="border-zinc-200/60 shadow-sm overflow-hidden bg-white">
        <CardHeader className="pb-4 border-b border-zinc-100 bg-zinc-50/30">
          <div className="flex justify-between items-center">
            <CardTitle className="text-sm font-semibold text-zinc-800">Assigned Team Manifest</CardTitle>
          </div>
        </CardHeader>
        <div className="overflow-x-auto">
          <Table>
            <TableHeader className="bg-zinc-50/50">
              <TableRow className="border-zinc-100 hover:bg-transparent">
                <TableHead className="text-xs font-semibold text-zinc-500 uppercase tracking-wider">User details</TableHead>
                <TableHead className="text-xs font-semibold text-zinc-500 uppercase tracking-wider">Default Branch</TableHead>
                <TableHead className="text-xs font-semibold text-zinc-500 uppercase tracking-wider">Assigned Role</TableHead>
                <TableHead className="text-xs font-semibold text-zinc-500 uppercase tracking-wider">Status</TableHead>
                <TableHead className="text-xs font-semibold text-zinc-500 uppercase tracking-wider text-right">Delete</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {teamMembers.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={5} className="text-center py-12 text-zinc-500">
                    <p className="font-medium text-sm">No team members registered yet.</p>
                    <p className="text-xs text-zinc-400 mt-1">Tap "Add New User" to assign your first corporate workspace account manually.</p>
                  </TableCell>
                </TableRow>
              ) : teamMembers.map((user) => (
                <TableRow key={user.id} className="group hover:bg-zinc-50/50 border-zinc-100 transition-colors">
                  <TableCell className="py-4">
                    <div className="flex items-center gap-3">
                      <Avatar className="h-9 w-9 border border-zinc-200 shadow-sm">
                        <AvatarFallback className="bg-gradient-to-br from-zinc-100 to-zinc-200 text-zinc-600 font-semibold text-xs">
                          {user.avatar}
                        </AvatarFallback>
                      </Avatar>
                      <div className="flex flex-col">
                        <span className="font-semibold text-zinc-900 group-hover:text-primary transition-colors text-sm">{user.name}</span>
                        <span className="text-xs text-zinc-400 font-medium">{user.email}</span>
                      </div>
                    </div>
                  </TableCell>
                  <TableCell className="py-4">
                    <div className="flex items-center gap-1 text-sm text-zinc-600 font-medium">
                      <Building2 className="w-3.5 h-3.5 text-zinc-400" />
                      {user.branch}
                    </div>
                  </TableCell>
                  <TableCell className="py-4">
                    <span className="text-sm font-medium text-zinc-700">{user.role}</span>
                  </TableCell>
                  <TableCell className="py-4">
                    <Badge className="bg-emerald-50 text-emerald-700 border-emerald-200 hover:bg-emerald-50 text-[10px] font-bold tracking-tight uppercase px-2 py-0.5">
                      {user.status}
                    </Badge>
                  </TableCell>
                  <TableCell className="py-4 text-right">
                    <Button 
                      variant="ghost" 
                      size="icon" 
                      onClick={() => handleRemoveMember(user.id, user.name)}
                      className="h-8 w-8 text-zinc-400 hover:text-red-600 hover:bg-red-50/50 rounded-lg transition-colors"
                    >
                      <Trash2 className="w-4 h-4" />
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      </Card>
    </div>
  );
}
