import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { useState } from "react"

interface AddServiceModalProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  onAddService: (serviceData: { name: string; serverId: string; ipAddress: string; os: string; serviceType: string }) => void
}

export function AddServiceModal({ open, onOpenChange, onAddService }: AddServiceModalProps) {
  const [formData, setFormData] = useState({
    name: '',
    serverId: '',
    ipAddress: '',
    os: '',
    port: '',
    sshUser: '',
    sshKey: ''
  })

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    onAddService({
      ...formData,
      id: Date.now().toString(),
      status: 'stopped' as const,
      port: formData.port ? parseInt(formData.port) : undefined
    })
    setFormData({
      name: '',
      serverId: '',
      ipAddress: '',
      os: '',
      port: '',
      sshUser: '',
      sshKey: ''
    })
    onOpenChange(false)
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Add New Service</DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="name">Service Name</Label>
            <Input
              id="name"
              value={formData.name}
              onChange={(e) => setFormData(prev => ({ ...prev, name: e.target.value }))}
              placeholder="e.g., Web Server, Database"
              required
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="serverId">Server ID</Label>
            <Input
              id="serverId"
              value={formData.serverId}
              onChange={(e) => setFormData(prev => ({ ...prev, serverId: e.target.value }))}
              placeholder="e.g., srv-001"
              required
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="ipAddress">IP Address</Label>
            <Input
              id="ipAddress"
              value={formData.ipAddress}
              onChange={(e) => setFormData(prev => ({ ...prev, ipAddress: e.target.value }))}
              placeholder="e.g., 192.168.1.100"
              required
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="os">Operating System</Label>
            <Select value={formData.os} onValueChange={(value) => setFormData(prev => ({ ...prev, os: value }))}>
              <SelectTrigger>
                <SelectValue placeholder="Select OS" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="Ubuntu 22.04">Ubuntu 22.04</SelectItem>
                <SelectItem value="CentOS 7">CentOS 7</SelectItem>
                <SelectItem value="RHEL 8">RHEL 8</SelectItem>
                <SelectItem value="Debian 11">Debian 11</SelectItem>
                <SelectItem value="Windows Server 2019">Windows Server 2019</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label htmlFor="port">Port (Optional)</Label>
            <Input
              id="port"
              type="number"
              value={formData.port}
              onChange={(e) => setFormData(prev => ({ ...prev, port: e.target.value }))}
              placeholder="e.g., 8080"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="sshUser">SSH Username</Label>
            <Input
              id="sshUser"
              value={formData.sshUser}
              onChange={(e) => setFormData(prev => ({ ...prev, sshUser: e.target.value }))}
              placeholder="e.g., root, ubuntu"
              required
            />
          </div>

          <div className="flex justify-end gap-2 pt-4">
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button type="submit">
              Add Service
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  )
}