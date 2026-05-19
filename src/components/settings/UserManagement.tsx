import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from '../ui/card';
import { Button } from '../ui/button';
import { Plus, Users, Shield, Building2, MoreHorizontal, Loader2 } from 'lucide-react';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '../ui/table';
import { Avatar, AvatarFallback, AvatarImage } from '../ui/avatar';
import { Badge } from '../ui/badge';
import { toast } from 'sonner';
import { supabase } from '../../lib/supabase';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from '../ui/dialog';
import { Input } from '../ui/input';
import { Label } from '../ui/label';

export function UserManagement() {
  const [isInviting, setIsInviting] = useState(false);
  const [teamMembers, setTeamMembers] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [businessId, setBusinessId] = useState<string | null>(null);

  const [inviteEmail, setInviteEmail] = useState('');
  const [inviteRole, setInviteRole] = useState('Staff');

  useEffect(() => {
    async function loadTeam() {
      try {
        const { data: userData } = await supabase.auth.getUser();
        if (!userData.user) return;

        const { data: buData } = await supabase.from('business_users').select('business_id').eq('user_id', userData.user.id).limit(1).single();
        if (!buData) return;
        setBusinessId(buData.business_id);

        const { data: teamData } = await supabase.from('business_users').select('*').eq('business_id', buData.business_id);
        
        if (teamData) {
            // Also fetch profiles for these users
            const userIds = teamData.map((t: any) => t.user_id).filter(Boolean);
            let profileMap: Record<string, any> = {};
            
            if (userIds.length > 0) {
               // Due to simplified schema wrapper, we'll fetch all profiles and filter locally (not scalable for thousands but fine for demo)
               const { data: allProfiles } = await supabase.from('profiles').select('*');
               if (allProfiles) {
                   allProfiles.forEach((p: any) => {
                       profileMap[p.id] = p;
                   });
               }
            }

            const mappedTeam = teamData.map((t: any) => ({
                id: t.id,
                user_id: t.user_id,
                name: profileMap[t.user_id]?.first_name ? `${profileMap[t.user_id].first_name} ${profileMap[t.user_id].last_name || ''}` : t.invited_email || 'Unknown User',
                email: profileMap[t.user_id]?.email || t.invited_email || '',
                role: 'Staff', // Note: To keep simple, we're not joining roles table yet
                status: t.user_id ? 'active' : 'invited',
                avatar: (profileMap[t.user_id]?.first_name || 'U').substring(0, 2).toUpperCase()
            }));

            setTeamMembers(mappedTeam);
        }
      } catch (err) {
        console.error(err);
      } finally {
        setLoading(false);
      }
    }
    loadTeam();
  }, []);

  const handleInvite = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!businessId || !inviteEmail) return;
    setIsInviting(true);
    try {
        const { error } = await supabase.from('business_users').insert({
            business_id: businessId,
            invited_email: inviteEmail,
            role_id: inviteRole // just storing string role to simple field for now
        });
        if (error) throw error;
        toast.success("User invited successfully");
        setInviteEmail('');
        
        // optimistic update
        setTeamMembers([
            ...teamMembers, 
            { id: Date.now().toString(), name: inviteEmail, email: inviteEmail, role: inviteRole, status: 'invited', avatar: 'IN' }
        ]);
    } catch(err: any) {
        toast.error(err.message || "Failed to invite user");
    } finally {
        setIsInviting(false);
    }
  };

  const activeUsers = teamMembers.filter(t => t.status === 'active').length;
  const invitedUsers = teamMembers.filter(t => t.status === 'invited').length;

  if (loading) {
     return <div className="p-8 text-center text-zinc-500"><Loader2 className="animate-spin w-6 h-6 mx-auto mb-2" /> Loading team members...</div>;
  }

  return (
    <div className="space-y-8 animate-in fade-in duration-500">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
           <h3 className="text-xl font-bold text-zinc-900 tracking-tight">Users & Staff</h3>
          <p className="text-sm text-zinc-500 mt-1">
            Manage your team, invite users, and control their access levels.
          </p>
        </div>
        
        <Dialog>
            <DialogTrigger asChild>
                <Button size="sm" className="bg-primary text-primary-foreground shadow-sm">
                  <Plus className="mr-2 h-4 w-4" /> Invite User
                </Button>
            </DialogTrigger>
            <DialogContent>
               <DialogHeader>
                  <DialogTitle>Invite Team Member</DialogTitle>
                  <DialogDescription>Send an email invitation to join your business account.</DialogDescription>
               </DialogHeader>
               <form onSubmit={handleInvite} className="space-y-4 pt-4">
                  <div className="space-y-2">
                     <Label>Email Address</Label>
                     <Input type="email" value={inviteEmail} onChange={e => setInviteEmail(e.target.value)} required placeholder="colleague@company.com" />
                  </div>
                  <div className="space-y-2">
                     <Label>Role</Label>
                     <select value={inviteRole} onChange={e => setInviteRole(e.target.value)} className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2">
                        <option value="Admin">Admin</option>
                        <option value="Manager">Manager</option>
                        <option value="Cashier">Cashier</option>
                     </select>
                  </div>
                  <Button type="submit" className="w-full" disabled={isInviting}>
                     {isInviting ? 'Sending Invite...' : 'Send Invitation'}
                  </Button>
               </form>
            </DialogContent>
        </Dialog>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <Card className="border-zinc-200/60 shadow-sm p-6 flex items-center gap-4">
          <div className="p-3 bg-blue-50 text-blue-600 rounded-xl"><Users className="w-6 h-6" /></div>
          <div>
            <p className="text-sm font-medium text-zinc-500">Total Users</p>
            <h4 className="text-2xl font-bold">{teamMembers.length}</h4>
          </div>
        </Card>
        <Card className="border-zinc-200/60 shadow-sm p-6 flex items-center gap-4">
          <div className="p-3 bg-emerald-50 text-emerald-600 rounded-xl"><Shield className="w-6 h-6" /></div>
          <div>
            <p className="text-sm font-medium text-zinc-500">Active</p>
            <h4 className="text-2xl font-bold">{activeUsers}</h4>
          </div>
        </Card>
        <Card className="border-zinc-200/60 shadow-sm p-6 flex items-center gap-4">
          <div className="p-3 bg-amber-50 text-amber-600 rounded-xl"><Building2 className="w-6 h-6" /></div>
          <div>
            <p className="text-sm font-medium text-zinc-500">Pending Invites</p>
            <h4 className="text-2xl font-bold">{invitedUsers}</h4>
          </div>
        </Card>
      </div>

      <Card className="border-zinc-200/60 shadow-sm overflow-hidden">
        <CardHeader className="pb-4 border-b border-zinc-100 bg-zinc-50/50">
          <div className="flex justify-between items-center">
            <CardTitle className="text-lg">Team Members</CardTitle>
          </div>
        </CardHeader>
        <div className="overflow-x-auto">
          <Table>
            <TableHeader className="bg-zinc-50/50">
              <TableRow>
                <TableHead className="w-[300px]">User</TableHead>
                <TableHead>Role</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {teamMembers.length === 0 ? (
                 <TableRow>
                    <TableCell colSpan={4} className="text-center py-8 text-zinc-500">No team members found.</TableCell>
                 </TableRow>
              ) : teamMembers.map((user) => (
                <TableRow key={user.id} className="group hover:bg-zinc-50/50 transition-colors">
                  <TableCell>
                    <div className="flex items-center gap-3">
                      <Avatar className="h-10 w-10 border border-zinc-200 shadow-sm">
                        <AvatarFallback className="bg-gradient-to-br from-zinc-100 to-zinc-200 text-zinc-600 font-semibold">{user.avatar}</AvatarFallback>
                      </Avatar>
                      <div className="flex flex-col">
                        <span className="font-semibold text-zinc-900 group-hover:text-primary transition-colors">{user.name}</span>
                        <span className="text-xs text-zinc-500 font-medium">{user.email}</span>
                      </div>
                    </div>
                  </TableCell>
                  <TableCell>
                    <div className="font-medium text-zinc-700 flex items-center gap-1.5">
                      {user.role}
                    </div>
                  </TableCell>
                  <TableCell>
                    {user.status === 'active' ? (
                      <Badge className="bg-emerald-50 text-emerald-700 border-emerald-200 hover:bg-emerald-100">Active</Badge>
                    ) : (
                      <Badge variant="outline" className="bg-amber-50 text-amber-700 border-amber-200">Pending Invite</Badge>
                    )}
                  </TableCell>
                  <TableCell className="text-right">
                     <Button variant="ghost" size="icon" className="h-8 w-8 text-zinc-400 hover:text-zinc-900">
                        <MoreHorizontal className="w-4 h-4" />
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
