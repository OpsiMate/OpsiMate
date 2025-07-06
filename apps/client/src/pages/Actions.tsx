import { useState, useEffect } from "react";
import { DashboardLayout } from "@/components/DashboardLayout";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Plus, Play, Trash2, PlusCircle, Save, Clock, Zap, Terminal, History, Star, Copy, Settings, ChevronRight, Activity, Sparkles, Rocket, Timer, CheckCircle, XCircle, AlertCircle } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Progress } from "@/components/ui/progress";
import { Switch } from "@/components/ui/switch";
import { Separator } from "@/components/ui/separator";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { Alert, AlertDescription } from "@/components/ui/alert";

interface ActionStep {
  id: string;
  command: string;
  provider: string;
  timeout?: number;
  retries?: number;
  condition?: string;
}

interface Action {
  id: string;
  name: string;
  description: string;
  steps: ActionStep[];
  createdAt: Date;
  lastRun?: Date;
  runCount: number;
  status: 'idle' | 'running' | 'success' | 'failed';
  category: string;
  tags: string[];
  isScheduled: boolean;
  schedule?: string;
  isFavorite: boolean;
  estimatedDuration: number;
}

interface ExecutionHistory {
  id: string;
  actionId: string;
  startTime: Date;
  endTime?: Date;
  status: 'running' | 'success' | 'failed';
  output: string;
  duration: number;
}

interface ActionTemplate {
  id: string;
  name: string;
  description: string;
  category: string;
  steps: Omit<ActionStep, 'id'>[];
  icon: string;
}

export default function Actions() {
  const [actions, setActions] = useState<Action[]>([
    {
      id: "1",
      name: "Restart Nginx",
      description: "Restarts the Nginx service on all web servers",
      steps: [
        { id: "step1", command: "sudo systemctl restart nginx", provider: "Web Server", timeout: 30, retries: 2 }
      ],
      createdAt: new Date("2024-06-30"),
      lastRun: new Date("2024-07-05"),
      runCount: 12,
      status: 'success',
      category: 'Infrastructure',
      tags: ['nginx', 'restart', 'web'],
      isScheduled: false,
      isFavorite: true,
      estimatedDuration: 45
    },
    {
      id: "2",
      name: "Clear Redis Cache",
      description: "Flushes all Redis caches",
      steps: [
        { id: "step1", command: "redis-cli flushall", provider: "Cache Server", timeout: 10, retries: 1 }
      ],
      createdAt: new Date("2024-07-01"),
      lastRun: new Date("2024-07-06"),
      runCount: 8,
      status: 'success',
      category: 'Database',
      tags: ['redis', 'cache', 'clear'],
      isScheduled: true,
      schedule: 'Daily at 2:00 AM',
      isFavorite: false,
      estimatedDuration: 15
    },
    {
      id: "3",
      name: "Deploy Application",
      description: "Complete deployment pipeline with health checks",
      steps: [
        { id: "step1", command: "git pull origin main", provider: "Git Server", timeout: 60 },
        { id: "step2", command: "npm run build", provider: "Build Server", timeout: 300 },
        { id: "step3", command: "docker build -t app:latest .", provider: "Docker Registry", timeout: 180 },
        { id: "step4", command: "kubectl apply -f deployment.yaml", provider: "Kubernetes", timeout: 120 }
      ],
      createdAt: new Date("2024-07-02"),
      lastRun: new Date("2024-07-06"),
      runCount: 25,
      status: 'running',
      category: 'Deployment',
      tags: ['deploy', 'kubernetes', 'docker'],
      isScheduled: false,
      isFavorite: true,
      estimatedDuration: 600
    }
  ]);

  const [executionHistory, setExecutionHistory] = useState<ExecutionHistory[]>([
    {
      id: "exec1",
      actionId: "1",
      startTime: new Date("2024-07-06T10:30:00"),
      endTime: new Date("2024-07-06T10:30:45"),
      status: 'success',
      output: "nginx.service restarted successfully",
      duration: 45
    },
    {
      id: "exec2",
      actionId: "2",
      startTime: new Date("2024-07-06T02:00:00"),
      endTime: new Date("2024-07-06T02:00:15"),
      status: 'success',
      output: "OK - All keys flushed",
      duration: 15
    },
    {
      id: "exec3",
      actionId: "3",
      startTime: new Date("2024-07-06T14:45:00"),
      status: 'running',
      output: "Building Docker image...",
      duration: 0
    }
  ]);

  const [actionTemplates] = useState<ActionTemplate[]>([
    {
      id: "template1",
      name: "Database Backup",
      description: "Create a backup of the database",
      category: "Database",
      icon: "💾",
      steps: [
        { command: "pg_dump -h localhost -U postgres mydb > backup.sql", provider: "Database Server", timeout: 300 }
      ]
    },
    {
      id: "template2",
      name: "Log Rotation",
      description: "Rotate and compress old log files",
      category: "Maintenance",
      icon: "📋",
      steps: [
        { command: "logrotate /etc/logrotate.conf", provider: "Log Server", timeout: 60 }
      ]
    },
    {
      id: "template3",
      name: "Health Check",
      description: "Comprehensive system health check",
      category: "Monitoring",
      icon: "🏥",
      steps: [
        { command: "curl -f http://localhost:8080/health", provider: "Web Server", timeout: 30 },
        { command: "systemctl status nginx", provider: "Web Server", timeout: 10 },
        { command: "df -h", provider: "System", timeout: 5 }
      ]
    }
  ]);

  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);
  const [isTemplateDialogOpen, setIsTemplateDialogOpen] = useState(false);
  const [selectedTemplate, setSelectedTemplate] = useState<ActionTemplate | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedCategory, setSelectedCategory] = useState("all");
  const [sortBy, setSortBy] = useState("recent");
  const [runningActions, setRunningActions] = useState<Set<string>>(new Set(["3"]));
  
  const [newAction, setNewAction] = useState<Omit<Action, "id" | "createdAt" | "runCount" | "status">>({
    name: "",
    description: "",
    steps: [],
    lastRun: undefined,
    category: "General",
    tags: [],
    isScheduled: false,
    schedule: undefined,
    isFavorite: false,
    estimatedDuration: 60
  });

  // Mock providers - in a real app, these would come from an API
  const providers = [
    { id: "1", name: "Web Server" },
    { id: "2", name: "Database Server" },
    { id: "3", name: "Cache Server" },
    { id: "4", name: "Load Balancer" }
  ];

  const mockProviders = [
    "Web Server",
    "Database Server", 
    "Cache Server",
    "Git Server",
    "Build Server",
    "Docker Registry",
    "Kubernetes",
    "Load Balancer",
    "File Server",
    "Monitoring Server"
  ];

  const handleAddStep = () => {
    const newStep: ActionStep = {
      id: `step${newAction.steps.length + 1}`,
      command: "",
      provider: ""
    };
    setNewAction({
      ...newAction,
      steps: [...newAction.steps, newStep]
    });
  };

  const handleStepChange = (stepId: string, field: keyof ActionStep, value: string) => {
    setNewAction({
      ...newAction,
      steps: newAction.steps.map(step => 
        step.id === stepId ? { ...step, [field]: value } : step
      )
    });
  };

  const handleRemoveStep = (stepId: string) => {
    setNewAction({
      ...newAction,
      steps: newAction.steps.filter(step => step.id !== stepId)
    });
  };

  const handleSaveAction = () => {
    const newActionWithId: Action = {
      ...newAction,
      id: `action${actions.length + 1}`,
      createdAt: new Date(),
      runCount: 0,
      status: 'idle' as const
    };
    setActions([...actions, newActionWithId]);
    setNewAction({ 
      name: "", 
      description: "", 
      steps: [],
      lastRun: undefined,
      category: "General",
      tags: [],
      isScheduled: false,
      schedule: undefined,
      isFavorite: false,
      estimatedDuration: 60
    });
    setIsCreateDialogOpen(false);
  };

  const handleCreateFromTemplate = (template: ActionTemplate) => {
    const stepsWithIds = template.steps.map((step, index) => ({
      ...step,
      id: `step${index + 1}`
    }));
    
    setNewAction({
      name: template.name,
      description: template.description,
      steps: stepsWithIds,
      category: template.category,
      tags: [],
      isScheduled: false,
      isFavorite: false,
      estimatedDuration: stepsWithIds.length * 60
    });
    setIsTemplateDialogOpen(false);
    setIsCreateDialogOpen(true);
  };

  const handleRunAction = (actionId: string) => {
    setRunningActions(prev => new Set([...prev, actionId]));
    setActions(prev => prev.map(action => 
      action.id === actionId 
        ? { ...action, status: 'running' as const, lastRun: new Date() }
        : action
    ));
    
    // Simulate action completion after random time
    setTimeout(() => {
      setRunningActions(prev => {
        const newSet = new Set(prev);
        newSet.delete(actionId);
        return newSet;
      });
      setActions(prev => prev.map(action => 
        action.id === actionId 
          ? { ...action, status: Math.random() > 0.1 ? 'success' as const : 'failed' as const, runCount: action.runCount + 1 }
          : action
      ));
    }, Math.random() * 5000 + 2000);
  };

  const toggleFavorite = (actionId: string) => {
    setActions(prev => prev.map(action => 
      action.id === actionId 
        ? { ...action, isFavorite: !action.isFavorite }
        : action
    ));
  };

  const getStatusIcon = (status: Action['status']) => {
    switch (status) {
      case 'running': return <Activity className="h-4 w-4 text-blue-500 animate-spin" />;
      case 'success': return <CheckCircle className="h-4 w-4 text-green-500" />;
      case 'failed': return <XCircle className="h-4 w-4 text-red-500" />;
      default: return <AlertCircle className="h-4 w-4 text-gray-400" />;
    }
  };

  const getStatusColor = (status: Action['status']) => {
    switch (status) {
      case 'running': return 'bg-blue-500';
      case 'success': return 'bg-green-500';
      case 'failed': return 'bg-red-500';
      default: return 'bg-gray-400';
    }
  };

  const filteredActions = actions.filter(action => {
    const matchesSearch = action.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
                         action.description.toLowerCase().includes(searchQuery.toLowerCase()) ||
                         action.tags.some(tag => tag.toLowerCase().includes(searchQuery.toLowerCase()));
    const matchesCategory = selectedCategory === 'all' || action.category === selectedCategory;
    return matchesSearch && matchesCategory;
  });

  const sortedActions = [...filteredActions].sort((a, b) => {
    switch (sortBy) {
      case 'name': return a.name.localeCompare(b.name);
      case 'recent': return (b.lastRun?.getTime() || 0) - (a.lastRun?.getTime() || 0);
      case 'runs': return b.runCount - a.runCount;
      case 'created': return b.createdAt.getTime() - a.createdAt.getTime();
      default: return 0;
    }
  });

  const categories = ['all', ...Array.from(new Set(actions.map(action => action.category)))];
  const recentExecutions = executionHistory.slice(0, 5);
  const runningActionsCount = runningActions.size;
  const totalActions = actions.length;
  const successRate = actions.length > 0 ? (actions.filter(a => a.status === 'success').length / actions.length) * 100 : 0;

  // Simulate real-time updates for running actions
  useEffect(() => {
    const interval = setInterval(() => {
      if (runningActions.size > 0) {
        // Update progress or status for running actions
      }
    }, 1000);
    return () => clearInterval(interval);
  }, [runningActions]);

  const formatDate = (date: Date) => {
    return date.toLocaleDateString("en-US", {
      year: "numeric",
      month: "short",
      day: "numeric"
    });
  };

  return (
    <DashboardLayout>
      {/* Header with Stats */}
      <div className="mb-8">
        <div className="flex items-center justify-between mb-6">
          <div>
            <div className="flex items-center gap-3 mb-2">
              <Zap className="h-6 w-6 text-blue-600" />
              <div>
                <h1 className="text-3xl font-bold tracking-tight text-gray-900">
                  Actions
                </h1>
                <p className="text-muted-foreground">
                  Automate your infrastructure with powerful action workflows
                </p>
              </div>
            </div>
          </div>
          <div className="flex gap-2">
            <Dialog open={isTemplateDialogOpen} onOpenChange={setIsTemplateDialogOpen}>
              <DialogTrigger asChild>
                <Button variant="outline">
                  <Sparkles className="mr-2 h-4 w-4" />
                  Templates
                </Button>
              </DialogTrigger>
              <DialogContent className="sm:max-w-[600px]">
                <DialogHeader>
                  <DialogTitle className="flex items-center gap-2">
                    <Sparkles className="h-5 w-5" />
                    Action Templates
                  </DialogTitle>
                  <DialogDescription>
                    Choose from pre-built templates to quickly create common actions
                  </DialogDescription>
                </DialogHeader>
                <div className="grid gap-4 py-4">
                  {actionTemplates.map((template) => (
                    <Card key={template.id} className="cursor-pointer hover:shadow-md transition-shadow" onClick={() => handleCreateFromTemplate(template)}>
                      <CardHeader className="pb-3">
                        <div className="flex items-center gap-3">
                          <div className="text-2xl">{template.icon}</div>
                          <div className="flex-1">
                            <CardTitle className="text-lg">{template.name}</CardTitle>
                            <CardDescription>{template.description}</CardDescription>
                          </div>
                          <Badge variant="secondary">{template.category}</Badge>
                        </div>
                      </CardHeader>
                      <CardContent className="pt-0">
                        <div className="text-sm text-muted-foreground">
                          {template.steps.length} step{template.steps.length !== 1 ? 's' : ''}
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              </DialogContent>
            </Dialog>
            <Dialog open={isCreateDialogOpen} onOpenChange={setIsCreateDialogOpen}>
              <DialogTrigger asChild>
                <Button className="bg-gradient-to-r from-blue-500 to-purple-600 hover:from-blue-600 hover:to-purple-700">
                  <Plus className="mr-2 h-4 w-4" />
                  Create Action
                </Button>
              </DialogTrigger>
            </Dialog>
          </div>
        </div>

        {/* Stats Cards */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
          <Card className="bg-gradient-to-r from-blue-50 to-blue-100 border-blue-200">
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-blue-600">Total Actions</p>
                  <p className="text-2xl font-bold text-blue-900">{totalActions}</p>
                </div>
                <Rocket className="h-8 w-8 text-blue-500" />
              </div>
            </CardContent>
          </Card>
          <Card className="bg-gradient-to-r from-green-50 to-green-100 border-green-200">
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-green-600">Success Rate</p>
                  <p className="text-2xl font-bold text-green-900">{successRate.toFixed(0)}%</p>
                </div>
                <CheckCircle className="h-8 w-8 text-green-500" />
              </div>
            </CardContent>
          </Card>
          <Card className="bg-gradient-to-r from-orange-50 to-orange-100 border-orange-200">
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-orange-600">Running Now</p>
                  <p className="text-2xl font-bold text-orange-900">{runningActionsCount}</p>
                </div>
                <Activity className="h-8 w-8 text-orange-500" />
              </div>
            </CardContent>
          </Card>
          <Card className="bg-gradient-to-r from-purple-50 to-purple-100 border-purple-200">
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-purple-600">Scheduled</p>
                  <p className="text-2xl font-bold text-purple-900">{actions.filter(a => a.isScheduled).length}</p>
                </div>
                <Timer className="h-8 w-8 text-purple-500" />
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Search and Filters */}
        <div className="flex flex-col sm:flex-row gap-4 mb-6">
          <div className="flex-1">
            <Input
              placeholder="Search actions, descriptions, or tags..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full"
            />
          </div>
          <Select value={selectedCategory} onValueChange={setSelectedCategory}>
            <SelectTrigger className="w-full sm:w-[180px]">
              <SelectValue placeholder="Category" />
            </SelectTrigger>
            <SelectContent>
              {categories.map((category) => (
                <SelectItem key={category} value={category}>
                  {category === 'all' ? 'All Categories' : category}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select value={sortBy} onValueChange={setSortBy}>
            <SelectTrigger className="w-full sm:w-[180px]">
              <SelectValue placeholder="Sort by" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="recent">Recent</SelectItem>
              <SelectItem value="name">Name</SelectItem>
              <SelectItem value="runs">Most Runs</SelectItem>
              <SelectItem value="created">Created Date</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* Create Action Dialog */}
      <Dialog open={isCreateDialogOpen} onOpenChange={setIsCreateDialogOpen}>
        <DialogContent className="sm:max-w-[800px] max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Rocket className="h-5 w-5" />
              Create New Action
            </DialogTitle>
            <DialogDescription>
              Define a sequence of commands to run on your providers with advanced options
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-6 py-4">
            {/* Basic Info */}
            <div className="space-y-4">
              <div className="grid grid-cols-4 items-center gap-4">
                <Label htmlFor="name" className="text-right font-medium">
                  Name *
                </Label>
                <Input
                  id="name"
                  value={newAction.name}
                  onChange={(e) => setNewAction({ ...newAction, name: e.target.value })}
                  className="col-span-3"
                  placeholder="Enter action name"
                />
              </div>
              <div className="grid grid-cols-4 items-center gap-4">
                <Label htmlFor="description" className="text-right font-medium">
                  Description
                </Label>
                <Textarea
                  id="description"
                  value={newAction.description}
                  onChange={(e) => setNewAction({ ...newAction, description: e.target.value })}
                  className="col-span-3"
                  rows={3}
                  placeholder="Describe what this action does"
                />
              </div>
              <div className="grid grid-cols-4 items-center gap-4">
                <Label htmlFor="category" className="text-right font-medium">
                  Category
                </Label>
                <Select value={newAction.category} onValueChange={(value) => setNewAction({ ...newAction, category: value })}>
                  <SelectTrigger className="col-span-3">
                    <SelectValue placeholder="Select category" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="General">General</SelectItem>
                    <SelectItem value="Infrastructure">Infrastructure</SelectItem>
                    <SelectItem value="Database">Database</SelectItem>
                    <SelectItem value="Deployment">Deployment</SelectItem>
                    <SelectItem value="Monitoring">Monitoring</SelectItem>
                    <SelectItem value="Maintenance">Maintenance</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="grid grid-cols-4 items-center gap-4">
                <Label htmlFor="duration" className="text-right font-medium">
                  Est. Duration (sec)
                </Label>
                <Input
                  id="duration"
                  type="number"
                  value={newAction.estimatedDuration}
                  onChange={(e) => setNewAction({ ...newAction, estimatedDuration: parseInt(e.target.value) || 60 })}
                  className="col-span-3"
                  min="1"
                />
              </div>
            </div>

            <Separator />

            {/* Steps Section */}
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <Label className="text-base font-semibold flex items-center gap-2">
                  <Terminal className="h-4 w-4" />
                  Command Steps
                </Label>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={handleAddStep}
                  className="bg-gradient-to-r from-green-50 to-green-100 hover:from-green-100 hover:to-green-200 border-green-200"
                >
                  <PlusCircle className="mr-2 h-4 w-4 text-green-600" />
                  Add Step
                </Button>
              </div>

              <ScrollArea className="h-[400px] w-full border rounded-md p-4">
                {newAction.steps.length === 0 ? (
                  <div className="text-center text-muted-foreground py-12">
                    <div className="bg-gradient-to-r from-gray-50 to-gray-100 rounded-full w-20 h-20 flex items-center justify-center mx-auto mb-4">
                      <Terminal className="h-10 w-10 opacity-50" />
                    </div>
                    <p className="text-lg font-medium mb-2">No steps added yet</p>
                    <p className="text-sm">Click "Add Step" to start building your action workflow</p>
                  </div>
                ) : (
                  <div className="space-y-4">
                    {newAction.steps.map((step, index) => (
                      <Card key={step.id} className="border-l-4 border-l-blue-500">
                        <CardHeader className="pb-3">
                          <div className="flex items-center justify-between">
                            <div className="flex items-center gap-2">
                              <div className="bg-blue-100 text-blue-600 rounded-full w-6 h-6 flex items-center justify-center text-sm font-bold">
                                {index + 1}
                              </div>
                              <span className="font-medium">Step {index + 1}</span>
                            </div>
                            <Button
                              type="button"
                              variant="ghost"
                              size="sm"
                              onClick={() => handleRemoveStep(step.id)}
                              className="text-red-500 hover:text-red-700 hover:bg-red-50"
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </div>
                        </CardHeader>
                        <CardContent className="space-y-4">
                          <div className="grid grid-cols-2 gap-4">
                            <div>
                              <Label className="text-sm font-medium">Provider</Label>
                              <Select
                                value={step.provider}
                                onValueChange={(value) => handleStepChange(step.id, "provider", value)}
                              >
                                <SelectTrigger>
                                  <SelectValue placeholder="Select provider" />
                                </SelectTrigger>
                                <SelectContent>
                                  {mockProviders.map((provider) => (
                                    <SelectItem key={provider} value={provider}>
                                      {provider}
                                    </SelectItem>
                                  ))}
                                </SelectContent>
                              </Select>
                            </div>
                            <div>
                              <Label className="text-sm font-medium">Timeout (seconds)</Label>
                              <Input
                                type="number"
                                value={step.timeout || 30}
                                onChange={(e) => handleStepChange(step.id, "timeout", e.target.value)}
                                min="1"
                                max="3600"
                              />
                            </div>
                          </div>
                          <div>
                            <Label className="text-sm font-medium">Command</Label>
                            <Textarea
                              value={step.command}
                              onChange={(e) => handleStepChange(step.id, "command", e.target.value)}
                              placeholder="Enter command to execute..."
                              rows={3}
                              className="font-mono text-sm"
                            />
                          </div>
                          <div className="grid grid-cols-2 gap-4">
                            <div>
                              <Label className="text-sm font-medium">Retries</Label>
                              <Input
                                type="number"
                                value={step.retries || 0}
                                onChange={(e) => handleStepChange(step.id, "retries", e.target.value)}
                                min="0"
                                max="5"
                              />
                            </div>
                            <div>
                              <Label className="text-sm font-medium">Condition (optional)</Label>
                              <Input
                                value={step.condition || ""}
                                onChange={(e) => handleStepChange(step.id, "condition", e.target.value)}
                                placeholder="e.g., exit_code == 0"
                              />
                            </div>
                          </div>
                        </CardContent>
                      </Card>
                    ))}
                  </div>
                )}
              </ScrollArea>
            </div>
          </div>
          <DialogFooter className="flex gap-2">
            <Button type="button" variant="outline" onClick={() => setIsCreateDialogOpen(false)}>
              Cancel
            </Button>
            <Button 
              type="submit" 
              onClick={handleSaveAction}
              disabled={!newAction.name.trim() || newAction.steps.length === 0}
              className="bg-gradient-to-r from-blue-500 to-purple-600 hover:from-blue-600 hover:to-purple-700"
            >
              <Save className="mr-2 h-4 w-4" />
              Save Action
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Stats Summary */}
      <div className="flex flex-wrap gap-6 mb-6">
        <div className="flex items-center gap-2">
          <Rocket className="h-5 w-5 text-blue-600" />
          <div>
            <p className="text-sm text-muted-foreground">Total Actions</p>
            <p className="text-lg font-semibold">{actions.length}</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <CheckCircle className="h-5 w-5 text-green-600" />
          <div>
            <p className="text-sm text-muted-foreground">Success Rate</p>
            <p className="text-lg font-semibold">{successRate.toFixed(0)}%</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Activity className="h-5 w-5 text-orange-600" />
          <div>
            <p className="text-sm text-muted-foreground">Running Now</p>
            <p className="text-lg font-semibold">{runningActionsCount}</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Timer className="h-5 w-5 text-blue-600" />
          <div>
            <p className="text-sm text-muted-foreground">Scheduled</p>
            <p className="text-lg font-semibold">{actions.filter(a => a.isScheduled).length}</p>
          </div>
        </div>
      </div>

      <Tabs defaultValue="all" className="w-full">
        <TabsList>
          <TabsTrigger value="all">
            All Actions
          </TabsTrigger>
          <TabsTrigger value="favorites">
            Favorites
          </TabsTrigger>
          <TabsTrigger value="history">
            History
          </TabsTrigger>
        </TabsList>
        
        <TabsContent value="all" className="space-y-6">
          {sortedActions.length === 0 ? (
            <div className="text-center py-12">
              <Zap className="h-10 w-10 opacity-50 mx-auto mb-4" />
              <p className="text-lg font-medium mb-2">No actions found</p>
              <p className="text-sm text-muted-foreground mb-4">Create your first action to get started</p>
              <Button onClick={() => setIsCreateDialogOpen(true)}>
                <Plus className="mr-2 h-4 w-4" />
                Create Action
              </Button>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {sortedActions.map((action) => (
                <Card key={action.id} className="overflow-hidden hover:shadow-sm transition-shadow">
                  <CardHeader className="pb-2">
                    <div className="flex justify-between items-start">
                      <h3 className="text-base font-medium">{action.name}</h3>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8"
                        onClick={() => toggleFavorite(action.id)}
                      >
                        <Star className="h-4 w-4" fill={action.isFavorite ? "currentColor" : "none"} />
                      </Button>
                    </div>
                    <p className="text-sm text-muted-foreground">{action.description}</p>
                    {action.status === 'running' && (
                      <Progress value={action.status === 'running' ? 50 : 0} className="h-1 mt-2" />
                    )}
                  </CardHeader>
                  <CardContent className="pb-2">
                    <div className="flex items-center justify-between text-sm">
                      <div className="flex items-center gap-3">
                        <Badge variant="outline">{action.category}</Badge>
                        <span className="text-muted-foreground">{action.steps.length} steps</span>
                      </div>
                      <div className="text-muted-foreground text-xs">
                        {action.lastRun && formatDate(action.lastRun)}
                      </div>
                    </div>
                  </CardContent>
                  <CardFooter className="pt-0">
                    <div className="flex justify-between w-full">
                      <Button variant="ghost" size="sm">
                        <Settings className="h-4 w-4 mr-1" />
                        Edit
                      </Button>
                      <Button 
                        size="sm"
                        variant={action.status === 'running' ? "outline" : "default"}
                        disabled={action.status === 'running'}
                        onClick={() => handleRunAction(action.id)}
                      >
                        {action.status === 'running' ? 'Running' : 'Run'}
                      </Button>
                    </div>
                  </CardFooter>
                </Card>
              ))}
            </div>
          )}
        </TabsContent>
        
        <TabsContent value="favorites" className="space-y-6">
          {actions.filter(action => action.isFavorite).length === 0 ? (
            <div className="text-center py-12">
              <Star className="h-10 w-10 opacity-50 mx-auto mb-4" />
              <p className="text-lg font-medium mb-2">No favorite actions</p>
              <p className="text-sm text-muted-foreground mb-4">Star actions to add them to your favorites</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {actions.filter(action => action.isFavorite).map((action) => (
                <Card key={action.id} className="overflow-hidden hover:shadow-sm transition-shadow">
                  <CardHeader className="pb-2">
                    <div className="flex justify-between items-start">
                      <h3 className="text-base font-medium">{action.name}</h3>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8"
                        onClick={() => toggleFavorite(action.id)}
                      >
                        <Star className="h-4 w-4" fill="currentColor" />
                      </Button>
                    </div>
                    <p className="text-sm text-muted-foreground">{action.description}</p>
                    {action.status === 'running' && (
                      <Progress value={action.status === 'running' ? 50 : 0} className="h-1 mt-2" />
                    )}
                  </CardHeader>
                  <CardContent className="pb-2">
                    <div className="flex items-center justify-between text-sm">
                      <div className="flex items-center gap-3">
                        <Badge variant="outline">{action.category}</Badge>
                        <span className="text-muted-foreground">{action.steps.length} steps</span>
                      </div>
                      <div className="text-muted-foreground text-xs">
                        {action.lastRun && formatDate(action.lastRun)}
                      </div>
                    </div>
                  </CardContent>
                  <CardFooter className="pt-0">
                    <div className="flex justify-between w-full">
                      <Button variant="ghost" size="sm">
                        <Settings className="h-4 w-4 mr-1" />
                        Edit
                      </Button>
                      <Button 
                        size="sm"
                        variant={action.status === 'running' ? "outline" : "default"}
                        disabled={action.status === 'running'}
                        onClick={() => handleRunAction(action.id)}
                      >
                        {action.status === 'running' ? 'Running' : 'Run'}
                      </Button>
                    </div>
                  </CardFooter>
                </Card>
              ))}
            </div>
          )}
        </TabsContent>
        
        <TabsContent value="history" className="space-y-6">
          {recentExecutions.length === 0 ? (
            <div className="text-center py-12">
              <History className="h-10 w-10 opacity-50 mx-auto mb-4" />
              <p className="text-lg font-medium mb-2">No execution history</p>
              <p className="text-sm text-muted-foreground mb-4">Run actions to see their execution history</p>
            </div>
          ) : (
            <div className="space-y-4">
              {recentExecutions.map((execution) => {
                const action = actions.find(a => a.id === execution.actionId);
                return (
                  <Card key={execution.id} className="overflow-hidden">
                    <CardHeader className="pb-2">
                      <div className="flex justify-between items-start">
                        <div>
                          <h3 className="text-base font-medium">{action?.name}</h3>
                          <p className="text-xs text-muted-foreground">{execution.startTime.toLocaleString()}</p>
                        </div>
                        <Badge variant={execution.status === 'success' ? 'default' : execution.status === 'failed' ? 'destructive' : 'secondary'}>
                          {execution.status}
                        </Badge>
                      </div>
                    </CardHeader>
                    <CardContent>
                      <div className="bg-muted p-2 rounded text-sm font-mono overflow-auto max-h-24">
                        {execution.output}
                      </div>
                    </CardContent>
                    <CardFooter className="pt-0 text-xs text-muted-foreground justify-end">
                      {execution.endTime && `Duration: ${execution.duration}s`}
                    </CardFooter>
                  </Card>
                );
              })}
            </div>
          )}
        </TabsContent>
      </Tabs>
    </DashboardLayout>
  );
}
