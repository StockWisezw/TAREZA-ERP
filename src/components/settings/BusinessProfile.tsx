import React, { useState, useEffect } from "react";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
  CardFooter,
} from "../ui/card";
import { Input } from "../ui/input";
import { Button } from "../ui/button";
import { Label } from "../ui/label";
import { Textarea } from "../ui/textarea";
import { Avatar, AvatarFallback, AvatarImage } from "../ui/avatar";
import { Camera, Building2, Save } from "lucide-react";
import { toast } from "sonner";
import { supabase } from '../../lib/firebaseClient';

export function BusinessProfile() {
  const [isSaving, setIsSaving] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [businessData, setBusinessData] = useState<any>(null);

  const [name, setName] = useState("");
  const [vatNumber, setVatNumber] = useState("");
  const [regNumber, setRegNumber] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [logoUrl, setLogoUrl] = useState("");

  const fileInputRef = React.useRef<HTMLInputElement>(null);

  const handleChoosePicture = () => {
    fileInputRef.current?.click();
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.size > 2 * 1024 * 1024) {
      toast.error("Image file size must be less than 2MB.");
      return;
    }

    const reader = new FileReader();
    reader.onloadend = () => {
      const base64String = reader.result as string;
      setLogoUrl(base64String);
      toast.success("Logo prepared! Click 'Save Profile' to save changes.");
    };
    reader.readAsDataURL(file);
  };

  useEffect(() => {
    async function loadBusiness() {
      try {
        const { data: userData } = await supabase.auth.getUser();
        if (!userData?.user) return;
        
        const { data: buData, error: buError } = await supabase.from('business_users').select('business_id').eq('user_id', userData.user.id).limit(1).maybeSingle();
        if (buError || !buData) {
          console.error("No business_user found", buError);
          return;
        }

        const { data, error } = await supabase
          .from("businesses")
          .select("*")
          .eq('id', buData.business_id)
          .single();

        if (error) {
          console.error("No business found", error);
        } else if (data) {
          setBusinessData(data);
          setName(data.name || "");
          setVatNumber(data.tax_number || "");
          setRegNumber(data.tax_number || "");
          setEmail(data.email || "");
          setPhone(data.phone || "");
          setLogoUrl(data.logo_url || "");
        }
      } catch (err) {
        console.error("Failed to load business profile", err);
      } finally {
        setIsLoading(false);
      }
    }
    loadBusiness();
  }, []);

  const handleSave = async () => {
    setIsSaving(true);
    try {
      if (!businessData) {
        // Create new business profile
        const { data, error } = await supabase
          .from("businesses")
          .insert({
            name: name || "My Business",
            tax_number: regNumber,
            email: email,
            phone: phone,
            logo_url: logoUrl,
          })
          .select()
          .single();

        if (error) throw error;
        setBusinessData(data);
        toast.success("Business profile created successfully");
      } else {
        // Update existing business profile
        const { error } = await supabase
          .from("businesses")
          .update({
            name,
            tax_number: regNumber,
            email: email,
            phone: phone,
            logo_url: logoUrl,
          })
          .eq("id", businessData.id);

        if (error) throw error;
        toast.success("Business profile updated successfully");
        
        // Refresh page so custom logo immediately updates in layout header
        setTimeout(() => {
          window.location.reload();
        }, 1200);
      }
    } catch (err: any) {
      toast.error(`Error saving profile: ${err.message || "Unknown error"}`);
    } finally {
      setIsSaving(false);
    }
  };

  if (isLoading) {
    return (
      <div className="p-8 text-center text-zinc-500">
        Loading business profile...
      </div>
    );
  }

  return (
    <div className="space-y-8 animate-in fade-in duration-500">
      <div className="flex justify-between items-center">
        <div>
          <h3 className="text-xl font-bold text-zinc-900 tracking-tight">
            Business Profile
          </h3>
          <p className="text-sm text-zinc-500 mt-1">
            Update your company details, logo, and registration information.
          </p>
        </div>
        <Button
          onClick={handleSave}
          disabled={isSaving}
          className="bg-primary text-primary-foreground shadow-sm px-6"
        >
          {isSaving ? (
            "Saving..."
          ) : (
            <>
              <Save className="w-4 h-4 mr-2" /> Save Profile
            </>
          )}
        </Button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="md:col-span-1">
          <Card className="border-zinc-200/60 shadow-sm h-full">
            <CardHeader className="pb-4">
              <CardTitle className="text-lg">Company Logo</CardTitle>
              <CardDescription>
                This logo will appear on receipts and the main dashboard.
              </CardDescription>
            </CardHeader>
            <CardContent className="flex flex-col items-center justify-center space-y-4 pt-4">
              <Avatar className="h-32 w-32 border-4 border-white shadow-sm ring-1 ring-zinc-200">
                <AvatarImage src={logoUrl || `https://ui-avatars.com/api/?name=${encodeURIComponent(name || 'Tareza')}&background=0D8ABC&color=fff&size=128`} />
                <AvatarFallback className="bg-zinc-100 text-zinc-400">
                  <Camera className="h-10 w-10" />
                </AvatarFallback>
              </Avatar>
              <div className="flex flex-col items-center space-y-2 text-center w-full">
                <input
                  type="file"
                  ref={fileInputRef}
                  onChange={handleFileChange}
                  accept="image/*"
                  className="hidden"
                />
                <Button variant="outline" size="sm" className="w-full" onClick={handleChoosePicture}>
                  Choose new picture
                </Button>
                {logoUrl && (
                  <Button variant="ghost" size="sm" className="text-red-500 hover:text-red-650 hover:bg-red-50/50 w-full" onClick={() => setLogoUrl("")}>
                    Remove custom picture
                  </Button>
                )}
                <p className="text-xs text-zinc-500">
                  JPG, GIF or PNG. Max size of 2MB.
                </p>
              </div>
            </CardContent>
          </Card>
        </div>

        <div className="md:col-span-2">
          <Card className="border-zinc-200/60 shadow-sm">
            <CardHeader className="pb-4 border-b border-zinc-100">
              <div className="flex items-center gap-2">
                <Building2 className="w-5 h-5 text-zinc-400" />
                <CardTitle className="text-lg">General Information</CardTitle>
              </div>
            </CardHeader>
            <CardContent className="pt-6 space-y-6">
              <div className="space-y-2">
                <Label
                  htmlFor="companyName"
                  className="font-semibold text-zinc-900"
                >
                  Company Name
                </Label>
                <Input
                  id="companyName"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="h-11 bg-zinc-50/50"
                />
              </div>
              <div className="space-y-2">
                <Label
                  htmlFor="regNumber"
                  className="font-semibold text-zinc-900"
                >
                  Company Registration Number
                </Label>
                <Input
                  id="regNumber"
                  value={regNumber}
                  onChange={(e) => {
                    setRegNumber(e.target.value);
                    setVatNumber(e.target.value);
                  }}
                  placeholder="e.g. TZ-123456/2026"
                  className="h-11 font-mono font-medium"
                />
                <p className="text-[11px] text-zinc-400 font-mono">This unique registration ID identifies your workspace.</p>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                <div className="space-y-2">
                  <Label
                    htmlFor="email"
                    className="font-semibold text-zinc-900"
                  >
                    Contact Email
                  </Label>
                  <Input
                    id="email"
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="h-11"
                  />
                </div>
                <div className="space-y-2">
                  <Label
                    htmlFor="phone"
                    className="font-semibold text-zinc-900"
                  >
                    Phone Number
                  </Label>
                  <Input
                    id="phone"
                    type="tel"
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                    className="h-11"
                  />
                </div>
              </div>
              <div className="space-y-2 pt-2 border-t border-zinc-100">
                <Label className="font-semibold text-zinc-900">
                  Invoice & Receipt Footer
                </Label>
                <p className="text-xs text-zinc-500 mb-2">
                  Text to display at the bottom of customer receipts.
                </p>
                <Textarea
                  placeholder="Thank you for your business!"
                  className="min-h-[100px] resize-y"
                />
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
