import { useState } from "react";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import UserManagement from "./user-management";
import { X } from "lucide-react";
import { Button } from "@/components/ui/button";

interface AdminPanelProps {
  open: boolean;
  onClose: () => void;
}

export default function AdminPanel({ open, onClose }: AdminPanelProps) {
  const [activeTab, setActiveTab] = useState("users");

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-4xl p-0 max-h-[90vh] overflow-hidden flex flex-col">
        <div className="flex items-center justify-between p-4 border-b border-border">
          <h2 className="text-xl font-bold">Admin Panel</h2>
          <Button variant="ghost" size="icon" onClick={onClose}>
            <X className="h-5 w-5" />
          </Button>
        </div>
        
        <Tabs 
          value={activeTab} 
          onValueChange={setActiveTab}
          className="flex flex-col flex-1 overflow-hidden"
        >
          <TabsList className="bg-background border-b border-border rounded-none px-2 h-12">
            <TabsTrigger 
              value="users" 
              className="data-[state=active]:bg-primary/10 data-[state=active]:text-primary"
            >
              User Management
            </TabsTrigger>
            <TabsTrigger 
              value="posts" 
              className="data-[state=active]:bg-primary/10 data-[state=active]:text-primary"
            >
              Posts
            </TabsTrigger>
            <TabsTrigger 
              value="settings" 
              className="data-[state=active]:bg-primary/10 data-[state=active]:text-primary"
            >
              Settings
            </TabsTrigger>
          </TabsList>
          
          <div className="flex-1 overflow-y-auto">
            <TabsContent value="users" className="p-0 m-0 h-full">
              <UserManagement />
            </TabsContent>
            
            <TabsContent value="posts" className="p-4 m-0">
              <div className="text-center py-12">
                <h3 className="text-xl font-medium mb-2">Post Management</h3>
                <p className="text-muted-foreground">
                  Manage and moderate posts in your community.
                </p>
              </div>
            </TabsContent>
            

            <TabsContent value="settings" className="p-4 m-0">
              <div className="text-center py-12">
                <h3 className="text-xl font-medium mb-2">Platform Settings</h3>
                <p className="text-muted-foreground">
                  Configure platform settings and preferences.
                </p>
              </div>
            </TabsContent>
          </div>
        </Tabs>
      </DialogContent>
    </Dialog>
  );
}
