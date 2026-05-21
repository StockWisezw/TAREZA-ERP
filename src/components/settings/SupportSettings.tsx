import React from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../ui/card';
import { Button } from '../ui/button';
import { Mail, Phone, LifeBuoy, CreditCard, MessageSquare, ExternalLink } from 'lucide-react';

export function SupportSettings() {
  return (
    <div className="space-y-6 animate-in fade-in duration-500">
      <div>
        <h3 className="text-xl font-bold text-zinc-900 tracking-tight">Help & Support</h3>
        <p className="text-sm text-zinc-500 mt-1">Get assistance, view documentation, and manage your billing payments.</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <Card className="border-zinc-200 shadow-sm relative overflow-hidden bg-gradient-to-br from-primary/5 to-transparent">
          <div className="absolute top-0 right-0 p-4 opacity-10">
            <CreditCard className="w-24 h-24" />
          </div>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <CreditCard className="w-5 h-5 text-primary" />
              Payments & Subscriptions
            </CardTitle>
            <CardDescription>
              Direct contact for account renewals, upgrades, and payment processing.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4 relative z-10">
            <div className="bg-white p-4 rounded-lg border border-zinc-100 shadow-sm space-y-3">
              <p className="text-sm text-zinc-600">
                To process payments, upgrade your plan to Pro/Enterprise, or resolve billing issues, please contact our billing department directly:
              </p>
              
              <div className="flex items-center gap-3 p-3 bg-zinc-50 rounded-md border border-zinc-100">
                <div className="bg-primary/10 p-2 rounded-full">
                  <Mail className="w-4 h-4 text-primary" />
                </div>
                <div>
                  <p className="text-xs font-semibold text-zinc-500 uppercase tracking-wide">Billing Email</p>
                  <a href="mailto:admin@tarezaerp.co.zw" className="text-sm font-bold text-zinc-900 hover:text-primary transition-colors">
                    admin@tarezaerp.33mail.com
                  </a>
                </div>
              </div>

              <div className="text-xs text-zinc-500 mt-2">
                * We generally aim to process manual payments and activate subscriptions within 2-4 hours during business days.
              </div>
            </div>
            
            <Button className="w-full" onClick={() => window.location.href = 'mailto:admin@tarezaerp.33mail.com?subject=Payment Request - Tareza ERP'}>
              Email Billing Team
            </Button>
          </CardContent>
        </Card>

        <Card className="border-zinc-200 shadow-sm relative overflow-hidden bg-gradient-to-br from-indigo-50 to-transparent">
          <div className="absolute top-0 right-0 p-4 opacity-10">
            <LifeBuoy className="w-24 h-24" />
          </div>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <LifeBuoy className="w-5 h-5 text-indigo-600" />
              Technical Support
            </CardTitle>
            <CardDescription>
              Need help using Tareza ERP or found a bug?
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4 relative z-10">
            <div className="bg-white p-4 rounded-lg border border-zinc-100 space-y-3">
              <p className="text-sm text-zinc-600">
                Our support engineers are ready to assist you. Include clear details or screenshots if you're experiencing an issue.
              </p>
              
              <div className="flex flex-col gap-3">
                <div className="flex items-center gap-3 p-3 bg-zinc-50 rounded-md border border-zinc-100">
                  <div className="bg-indigo-100 p-2 rounded-full">
                    <MessageSquare className="w-4 h-4 text-indigo-600" />
                  </div>
                  <div>
                    <p className="text-xs font-semibold text-zinc-500 uppercase tracking-wide">Support Email</p>
                    <a href="mailto:support@tarezaerp.33mail.com" className="text-sm font-bold text-zinc-900 hover:text-indigo-600 transition-colors">
                      support@tarezaerp.33mail.com
                    </a>
                  </div>
                </div>

                <div className="flex items-center gap-3 p-3 bg-zinc-50 rounded-md border border-zinc-100">
                  <div className="bg-indigo-100 p-2 rounded-full">
                    <Phone className="w-4 h-4 text-indigo-600" />
                  </div>
                  <div>
                    <p className="text-xs font-semibold text-zinc-500 uppercase tracking-wide">Phone Support</p>
                    <div className="flex flex-col">
                      <a href="tel:+263784553570" className="text-sm font-bold text-zinc-900 hover:text-indigo-600 transition-colors">
                        +263 784553570
                      </a>
                      <a href="tel:+263776699950" className="text-sm font-bold text-zinc-900 hover:text-indigo-600 transition-colors">
                        +263 776699950
                      </a>
                    </div>
                  </div>
                </div>
              </div>
            </div>
            
            <Button variant="outline" className="w-full border-indigo-200 hover:bg-indigo-50 hover:text-indigo-700" onClick={() => window.location.href = 'mailto:support@tarezaerp.33mail.com?subject=Technical Support - Tareza ERP'}>
              Open Support Ticket
            </Button>
          </CardContent>
        </Card>
      </div>
      
      <Card className="border-zinc-200 shadow-sm">
        <CardHeader>
          <CardTitle className="text-lg">Resources & Documentation</CardTitle>
          <CardDescription>Self-serve help for setting up and running your business.</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
            <a href="#" className="p-4 border border-zinc-200 rounded-lg hover:border-primary/50 hover:shadow-sm transition-all group">
              <h4 className="font-semibold text-zinc-900 group-hover:text-primary flex items-center gap-2">
                Getting Started <ExternalLink className="w-3 h-3 opacity-0 group-hover:opacity-100 transition-opacity" />
              </h4>
              <p className="text-xs text-zinc-500 mt-1">Learn how to set up branches, roles, and load inventory.</p>
            </a>
            <a href="#" className="p-4 border border-zinc-200 rounded-lg hover:border-primary/50 hover:shadow-sm transition-all group">
              <h4 className="font-semibold text-zinc-900 group-hover:text-primary flex items-center gap-2">
                POS Operations <ExternalLink className="w-3 h-3 opacity-0 group-hover:opacity-100 transition-opacity" />
              </h4>
              <p className="text-xs text-zinc-500 mt-1">Cashier guides for the POS, split payments, and refunds.</p>
            </a>
            <a href="#" className="p-4 border border-zinc-200 rounded-lg hover:border-primary/50 hover:shadow-sm transition-all group">
              <h4 className="font-semibold text-zinc-900 group-hover:text-primary flex items-center gap-2">
                ZIMRA Configuration <ExternalLink className="w-3 h-3 opacity-0 group-hover:opacity-100 transition-opacity" />
              </h4>
              <p className="text-xs text-zinc-500 mt-1">Step-by-step fiscalisation and tax device setup.</p>
            </a>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
