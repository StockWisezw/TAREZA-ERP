import React from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from '../ui/card';
import { Input } from '../ui/input';
import { Button } from '../ui/button';
import { Label } from '../ui/label';
import { Textarea } from '../ui/textarea';
import { Avatar, AvatarFallback, AvatarImage } from '../ui/avatar';
import { Camera } from 'lucide-react';

export function BusinessProfile() {
  return (
    <div className="space-y-6">
      <div>
        <h3 className="text-lg font-medium">Business Profile</h3>
        <p className="text-sm text-zinc-500">
          Update your company details, logo, and registration information.
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Company Logo</CardTitle>
          <CardDescription>
            This logo will appear on receipts and the main dashboard.
          </CardDescription>
        </CardHeader>
        <CardContent className="flex items-center gap-6">
          <Avatar className="h-24 w-24 border">
            <AvatarImage src="" />
            <AvatarFallback className="bg-zinc-100 text-zinc-400">
              <Camera className="h-8 w-8" />
            </AvatarFallback>
          </Avatar>
          <div className="space-y-2">
            <Button variant="outline" size="sm">Upload Logo</Button>
            <p className="text-xs text-zinc-500">JPG, GIF or PNG. Max size of 2MB.</p>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>General Information</CardTitle>
          <CardDescription>
            The legal info your business uses.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="companyName">Company Name</Label>
            <Input id="companyName" defaultValue="Tareza Retail" />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="vatNumber">VAT Number</Label>
              <Input id="vatNumber" placeholder="e.g. 123456789" />
            </div>
            <div className="space-y-2">
              <Label htmlFor="regNumber">Company Registration Number</Label>
              <Input id="regNumber" placeholder="e.g. 1234/2023" />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="email">Contact Email</Label>
              <Input id="email" type="email" defaultValue="admin@tareza.hq" />
            </div>
            <div className="space-y-2">
              <Label htmlFor="phone">Phone Number</Label>
              <Input id="phone" type="tel" defaultValue="+263 77 123 4567" />
            </div>
          </div>
          <div className="space-y-2">
            <Label>Invoice & Receipt Footer</Label>
            <Textarea placeholder="Thank you for your business!" className="min-h-[100px]" />
          </div>
        </CardContent>
        <CardFooter className="border-t px-6 py-4">
          <Button>Save changes</Button>
        </CardFooter>
      </Card>
    </div>
  );
}
