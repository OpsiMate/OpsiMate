import { useState, useEffect, useMemo } from "react"
import { useNavigate, useSearchParams } from "react-router-dom"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { cn } from "@/lib/utils"
import { 
  Monitor, 
  X, 
  Server, 
  AlertTriangle, 
  CheckCircle, 
  XCircle, 
  HelpCircle,
  Container,
  Settings,
  Wifi,
  WifiOff,
  Maximize,
  Minimize,
  RotateCcw,
  Play,
  Square,
  MoreVertical,
  Eye,
  Clock,
  RefreshCw
} from "lucide-react"
import { useServices, useAlerts, useStartService, useStopService } from "@/hooks/queries"
import { useToast } from "@/hooks/use-toast"
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu"
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip"
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { Service } from "@/components/ServiceTable"
import { Alert } from "@OpsiMate/shared"
import { getAlertServiceId } from "@/utils/alert.utils";
import { Filters } from "@/components/Dashboard"

interface TVModeProps {
  autoRefresh?: boolean
  refreshInterval?: number
  viewRotation?: boolean
  rotationInterval?: number
}

const TVMode = ({ 
  autoRefresh: propAutoRefresh, 
  refreshInterval: propRefreshInterval,
  viewRotation: propViewRotation,
  rotationInterval: propRotationInterval 
}: TVModeProps) => {
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const [currentTime, setCurrentTime] = useState(new Date())
  const [isFullscreen, setIsFullscreen] = useState(false)
  const [isRefreshing, setIsRefreshing] = useState(false)
  const { toast } = useToast()

  // Service action mutations
  const startServiceMutation = useStartService()
  const stopServiceMutation = useStopService()
  
  // Get settings from URL params or use sensible defaults
  const autoRefresh = searchParams.get('autoRefresh') === 'false' ? false : (propAutoRefresh ?? true)
  const refreshInterval = parseInt(searchParams.get('refreshInterval') || '') || propRefreshInterval || 30000 // 30 seconds
  const viewRotation = searchParams.get('viewRotation') === 'true' ? true : (propViewRotation ?? false) // Off by default
  const rotationInterval = parseInt(searchParams.get('rotationInterval') || '') || propRotationInterval || 120000 // 2 minutes
  const defaultView = (searchParams.get('defaultView') as 'all' | 'running' | 'stopped' | 'error') || 'all'
  const gridColumns = parseInt(searchParams.get('gridColumns') || '') || 6 // Will be overridden by smart grid
  
  // Get saved view state from URL parameters
  const savedSearchTerm = searchParams.get('searchTerm') || ''
  const savedFilters: Filters = (() => {
    try {
      const filtersParam = searchParams.get('filters')
      const filters = filtersParam ? JSON.parse(filtersParam) : {}
      console.log('TV Mode - Received filters:', filters)
      return filters
    } catch (error) {
      console.error('TV Mode - Error parsing filters:', error)
      return {}
    }
  })()



  const savedVisibleColumns: Record<string, boolean> = (() => {
    try {
      const columnsParam = searchParams.get('visibleColumns')
      return columnsParam ? JSON.parse(columnsParam) : {
        name: true,
        serviceIP: true,
        serviceStatus: true,
        provider: true,
        containerDetails: false,
        alerts: true
      }
    } catch {
      return {
        name: true,
        serviceIP: true,
        serviceStatus: true,
        provider: true,
        containerDetails: false,
        alerts: true
      }
    }
  })()
  
  // Multi-state selection for TV Mode
  const [selectedStates, setSelectedStates] = useState<Set<string>>(new Set(['all']))
  const [alertFilter, setAlertFilter] = useState<'all' | 'with-alerts'>('all')
  const [searchTerm, setSearchTerm] = useState(savedSearchTerm)
  
  // Data fetching
  const { data: services = [], isLoading, refetch } = useServices()
  const { data: alerts = [] } = useAlerts()

  // Enhanced alert calculation
  const servicesWithAlerts = useMemo(() => {
  console.log('TV Mode - Total alerts available:', alerts.length)
  return services.map(service => {
    const sid = Number(service.id);


    const serviceAlerts = alerts.filter(alert => {
    const explicitSid = getAlertServiceId(alert);
    return explicitSid !== undefined
      ? explicitSid === sid
      : service.tags?.some(tag => tag.name === alert.tag);
  })


    const uniqueAlerts = serviceAlerts.filter((a, i, self) =>
      i === self.findIndex(b => b.id === a.id)
    );

    const activeAlerts = uniqueAlerts.filter(a => !a.isDismissed)

    if (activeAlerts.length > 0) {
      console.log(`TV Mode - Service ${service.name} has ${activeAlerts.length} alerts:`, activeAlerts)
    }

    return {
      ...service,
      alertsCount: activeAlerts.length,
      serviceAlerts: activeAlerts
    }
  })
}, [services, alerts])

  // Apply saved view filters and search
  const baseFilteredServices = useMemo(() => {
    let filtered = servicesWithAlerts
    console.log('TV Mode - Starting with services:', filtered.length)
    
    // Apply search term
    if (searchTerm) {
      const searchLower = searchTerm.toLowerCase()
      filtered = filtered.filter(service => 
        service.name.toLowerCase().includes(searchLower) ||
        service.provider.name.toLowerCase().includes(searchLower) ||
        (service.serviceIP && service.serviceIP.toLowerCase().includes(searchLower)) ||
        (service.containerDetails?.image && service.containerDetails.image.toLowerCase().includes(searchLower))
      )
      console.log('TV Mode - After search filter:', filtered.length)
    }
    
    // Apply saved filters
    if (savedFilters.serviceStatus && savedFilters.serviceStatus.length > 0) {
      filtered = filtered.filter(service => 
        savedFilters.serviceStatus!.includes(service.serviceStatus)
      )
    }
    
    if (savedFilters.serviceType && savedFilters.serviceType.length > 0) {
      filtered = filtered.filter(service => 
        savedFilters.serviceType!.includes(service.serviceType)
      )
    }
    
    if (savedFilters.providerName && savedFilters.providerName.length > 0) {
      filtered = filtered.filter(service => 
        savedFilters.providerName!.includes(service.provider.name)
      )
    }
    
    if (savedFilters.providerType && savedFilters.providerType.length > 0) {
      filtered = filtered.filter(service => 
        service.provider?.providerType && savedFilters.providerType!.includes(service.provider.providerType)
      )
    }
    
    if (savedFilters.containerNamespace && savedFilters.containerNamespace.length > 0) {
      filtered = filtered.filter(service => 
        service.containerDetails?.namespace && savedFilters.containerNamespace!.includes(service.containerDetails.namespace)
      )
    }
    
    if (savedFilters.tags && savedFilters.tags.length > 0) {
      console.log('TV Mode - Applying tags filter:', savedFilters.tags)
      const beforeCount = filtered.length
      filtered = filtered.filter(service => 
        service.tags && service.tags.some(tag => 
          savedFilters.tags!.includes(tag.name)
        )
      )
      console.log('TV Mode - After tags filter:', filtered.length, '(was', beforeCount, ')')
    }
    
    console.log('TV Mode - Final filtered services:', filtered.length)
    return filtered
  }, [servicesWithAlerts, searchTerm, savedFilters])
  
  // Filter services based on selected states and alert filter
  const filteredServices = useMemo(() => {
    let filtered = baseFilteredServices
    
    // Apply multi-state filter
    if (!selectedStates.has('all')) {
      filtered = filtered.filter(s => selectedStates.has(s.serviceStatus))
    }
    
    // Apply alert filter
    if (alertFilter === 'with-alerts') {
      filtered = filtered.filter(s => s.alertsCount > 0)
    }
    
    return filtered
  }, [baseFilteredServices, selectedStates, alertFilter])
  
  // Smart grid calculation based on service count
  const smartGridConfig = useMemo(() => {
    const serviceCount = filteredServices.length
    
    // Calculate optimal grid layout for different service counts
    let columns: number
    let cardSize: 'xs' | 'sm' | 'md' | 'lg'
    
    if (serviceCount <= 6) {
      columns = Math.min(serviceCount, 3)
      cardSize = 'lg'
    } else if (serviceCount <= 12) {
      columns = 4
      cardSize = 'md'
    } else if (serviceCount <= 24) {
      columns = 6
      cardSize = 'sm'
    } else if (serviceCount <= 48) {
      columns = 8
      cardSize = 'sm'
    } else {
      // For 60-70+ services, use maximum density
      columns = 10
      cardSize = 'xs'
    }
    
    return { columns, cardSize }
  }, [filteredServices.length])

  // Statistics
  const stats = useMemo(() => {
    // Overall stats (all services)
    const totalServices = servicesWithAlerts.length
    const totalRunning = servicesWithAlerts.filter(s => s.serviceStatus === 'running').length
    const totalStopped = servicesWithAlerts.filter(s => s.serviceStatus === 'stopped').length
    const totalError = servicesWithAlerts.filter(s => s.serviceStatus === 'error').length
    const totalUnknown = servicesWithAlerts.filter(s => s.serviceStatus === 'unknown').length
    const totalAlerts = servicesWithAlerts.reduce((sum, s) => sum + (s.alertsCount || 0), 0)
    
    // Filtered stats (currently displayed)
    const filteredTotal = baseFilteredServices.length
    const filteredRunning = baseFilteredServices.filter(s => s.serviceStatus === 'running').length
    const filteredStopped = baseFilteredServices.filter(s => s.serviceStatus === 'stopped').length
    const filteredError = baseFilteredServices.filter(s => s.serviceStatus === 'error').length
    const filteredUnknown = baseFilteredServices.filter(s => s.serviceStatus === 'unknown').length
    
    return { 
      total: totalServices,
      running: totalRunning, 
      stopped: totalStopped, 
      error: totalError, 
      unknown: totalUnknown, 
      totalAlerts,
      filtered: {
        total: filteredTotal,
        running: filteredRunning,
        stopped: filteredStopped,
        error: filteredError,
        unknown: filteredUnknown
      }
    }
  }, [servicesWithAlerts, baseFilteredServices])

  // Auto-refresh
  useEffect(() => {
    if (!autoRefresh) return
    
    const interval = setInterval(() => {
      refetch()
    }, refreshInterval)
    
    return () => clearInterval(interval)
  }, [autoRefresh, refreshInterval, refetch])

  // View rotation - cycles through different state combinations
  useEffect(() => {
    if (!viewRotation) return
    
    const viewCombinations = [
      new Set(['all']),
      new Set(['running']),
      new Set(['stopped']),
      new Set(['error']),
      new Set(['running', 'stopped']),
      new Set(['error', 'stopped'])
    ]
    let currentIndex = 0
    
    const interval = setInterval(() => {
      currentIndex = (currentIndex + 1) % viewCombinations.length
      setSelectedStates(viewCombinations[currentIndex])
    }, rotationInterval)
    
    return () => clearInterval(interval)
  }, [viewRotation, rotationInterval])

  // Clock update
  useEffect(() => {
    const interval = setInterval(() => {
      setCurrentTime(new Date())
    }, 1000)
    
    return () => clearInterval(interval)
  }, [])

  // Manual refresh function with loading state
  const handleManualRefresh = async () => {
    if (isRefreshing) return // Prevent multiple simultaneous refreshes
    
    setIsRefreshing(true)
    try {
      await refetch()
      // Add a small delay to show the animation even if the request is very fast
      await new Promise(resolve => setTimeout(resolve, 500))
    } catch (error) {
      console.error('Error refreshing data:', error)
    } finally {
      setIsRefreshing(false)
    }
  }

  // Service action functions
  const handleStartService = async (service: Service) => {
    try {
      const serviceId = parseInt(service.id)
      await startServiceMutation.mutateAsync(serviceId)
      toast({
        title: "Service Started",
        description: `Successfully started ${service.name}`
      })
    } catch (error) {
      console.error(`Error starting service ${service.name}:`, error)
      toast({
        title: "Failed to Start Service",
        description: `Could not start ${service.name}. ${error instanceof Error ? error.message : 'Unknown error'}`,
        variant: "destructive"
      })
    }
  }

  const handleStopService = async (service: Service) => {
    try {
      const serviceId = parseInt(service.id)
      await stopServiceMutation.mutateAsync(serviceId)
      toast({
        title: "Service Stopped",
        description: `Successfully stopped ${service.name}`
      })
    } catch (error) {
      console.error(`Error stopping service ${service.name}:`, error)
      toast({
        title: "Failed to Stop Service",
        description: `Could not stop ${service.name}. ${error instanceof Error ? error.message : 'Unknown error'}`,
        variant: "destructive"
      })
    }
  }

  const handleRestartService = async (service: Service) => {
    try {
      const serviceId = parseInt(service.id)
      
      toast({
        title: "Restarting Service",
        description: `Restarting ${service.name}...`
      })
      
      // First stop, then start
      await stopServiceMutation.mutateAsync(serviceId)
      await startServiceMutation.mutateAsync(serviceId)
      
      toast({
        title: "Service Restarted",
        description: `Successfully restarted ${service.name}`
      })
    } catch (error) {
      console.error(`Error restarting service ${service.name}:`, error)
      toast({
        title: "Failed to Restart Service",
        description: `Could not restart ${service.name}. ${error instanceof Error ? error.message : 'Unknown error'}`,
        variant: "destructive"
      })
    }
  }

  // Helper function to toggle state selection
  const toggleStateSelection = (state: string) => {
    setSelectedStates(prev => {
      const newStates = new Set(prev)
      if (state === 'all') {
        return new Set(['all'])
      }
      
      // Remove 'all' if selecting specific states
      newStates.delete('all')
      
      if (newStates.has(state)) {
        newStates.delete(state)
        // If no states selected, default to 'all'
        if (newStates.size === 0) {
          newStates.add('all')
        }
      } else {
        newStates.add(state)
      }
      
      return newStates
    })
  }

  // Keyboard shortcuts
  useEffect(() => {
    const handleKeyPress = (event: KeyboardEvent) => {
      switch (event.key) {
        case 'Escape':
          navigate('/')
          break
        case '1':
          setSelectedStates(new Set(['all']))
          break
        case '2':
          toggleStateSelection('running')
          break
        case '3':
          toggleStateSelection('stopped')
          break
        case '4':
          toggleStateSelection('error')
          break
        case 'a':
        case 'A':
          setAlertFilter(alertFilter === 'all' ? 'with-alerts' : 'all')
          break
        case 'r':
        case 'R':
          if (event.ctrlKey || event.metaKey) {
            event.preventDefault()
            handleManualRefresh()
          }
          break
        case 'F11':
          event.preventDefault()
          toggleFullscreen()
          break
      }
    }

    window.addEventListener('keydown', handleKeyPress)
    return () => window.removeEventListener('keydown', handleKeyPress)
  }, [navigate, handleManualRefresh, alertFilter, toggleStateSelection])

  // Fullscreen functionality
  const toggleFullscreen = () => {
    if (!document.fullscreenElement) {
      document.documentElement.requestFullscreen().then(() => {
        setIsFullscreen(true)
      }).catch(err => {
        console.error('Error attempting to enable fullscreen:', err)
      })
    } else {
      document.exitFullscreen().then(() => {
        setIsFullscreen(false)
      }).catch(err => {
        console.error('Error attempting to exit fullscreen:', err)
      })
    }
  }

  // Listen for fullscreen changes
  useEffect(() => {
    const handleFullscreenChange = () => {
      setIsFullscreen(!!document.fullscreenElement)
    }

    document.addEventListener('fullscreenchange', handleFullscreenChange)
    return () => document.removeEventListener('fullscreenchange', handleFullscreenChange)
  }, [])

  // Exit fullscreen when component unmounts (leaving TV Mode)
  useEffect(() => {
    return () => {
      if (document.fullscreenElement) {
        document.exitFullscreen().catch(err => {
          console.error('Error exiting fullscreen on TV Mode exit:', err)
        })
      }
    }
  }, [])

  const getStatusIcon = (status: Service['serviceStatus']) => {
    switch (status.toLowerCase()) {
      case 'running':
        return <CheckCircle className="h-6 w-6 text-green-500" />
      case 'stopped':
        return <XCircle className="h-6 w-6 text-gray-500" />
      case 'error':
        return <AlertTriangle className="h-6 w-6 text-red-500" />
      case 'unknown':
        return <HelpCircle className="h-6 w-6 text-yellow-500" />
      default:
        return <HelpCircle className="h-6 w-6 text-gray-500" />
    }
  }

  const getStatusColor = (status: Service['serviceStatus']) => {
    switch (status.toLowerCase()) {
      case 'running':
        return 'border-green-500 bg-green-50 dark:bg-green-950'
      case 'stopped':
        return 'border-gray-400 bg-gray-50 dark:bg-gray-950'
      case 'error':
        return 'border-red-500 bg-red-50 dark:bg-red-950'
      case 'unknown':
        return 'border-yellow-500 bg-yellow-50 dark:bg-yellow-950'
      default:
        return 'border-gray-400 bg-gray-50 dark:bg-gray-950'
    }
  }

  const getServiceTypeIcon = (serviceType: Service['serviceType']) => {
    switch (serviceType) {
      case 'DOCKER':
        return <Container className="h-4 w-4" />
      case 'SYSTEMD':
        return <Settings className="h-4 w-4" />
      case 'MANUAL':
        return <Server className="h-4 w-4" />
      default:
        return <Server className="h-4 w-4" />
    }
  }

  return (
    <>
      <div className="h-screen overflow-y-auto bg-background text-foreground p-4">
      {/* Header */}
      <div className="space-y-3 mb-6">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-4">
            <Monitor className="h-8 w-8 text-primary" />
            <div>
              <h1 className="text-3xl font-bold">OpsiMate TV Mode</h1>
              <div className="text-muted-foreground space-y-0.5">
                <p>
                  {currentTime.toLocaleString()} • Auto-refresh: {autoRefresh ? 'ON' : 'OFF'}
                  {viewRotation && ' • View Rotation: ON'}
                </p>
                <p>
                  Grid: {smartGridConfig.columns} cols ({smartGridConfig.cardSize})
                  {(isLoading || isRefreshing) && (
                <span className="inline-flex items-center gap-1 ml-2">
                  <RotateCcw className="h-3 w-3 animate-spin" />
                  <span className="text-xs">{isRefreshing ? 'Manual refresh' : 'Auto refresh'}</span>
                </span>
              )}
                  {searchTerm && ` • Search: "${searchTerm}"`}
                  {Object.keys(savedFilters).length > 0 && (
                    <span>
                      {' • Filters: '}
                      {Object.entries(savedFilters)
                        .filter(([_, values]) => values.length > 0)
                        .map(([key, values]) => `${key}(${values.length})`)
                        .join(', ')}
                    </span>
                  )}
                </p>
              </div>
            </div>
          </div>
          
          <div className="flex flex-wrap items-center gap-4">
            {/* Control Buttons */}
            <Button
              variant="outline"
              size="sm"
              onClick={handleManualRefresh}
              disabled={isRefreshing}
              className="flex items-center gap-2 min-w-[120px]"
              title="Manual Refresh (Ctrl+R)"
            >
              <RotateCcw className={cn("h-4 w-4", isRefreshing && "animate-spin")} />
              {isRefreshing ? 'Refreshing...' : 'Refresh'}
            </Button>
            
            <Button
              variant="outline"
              size="sm"
              onClick={toggleFullscreen}
              className="flex items-center gap-2"
              title="Toggle Fullscreen (F11)"
            >
              {isFullscreen ? <Minimize className="h-4 w-4" /> : <Maximize className="h-4 w-4" />}
              {isFullscreen ? 'Exit Fullscreen' : 'Fullscreen'}
            </Button>
            
            {/* Help/Shortcuts Button */}
            <Popover>
              <PopoverTrigger asChild>
                <Button
                  variant="outline"
                  size="sm"
                  className="flex items-center gap-2"
                >
                  <HelpCircle className="h-4 w-4" />
                  Help
                </Button>
              </PopoverTrigger>
              <PopoverContent side="bottom" className="max-w-sm p-4">
                <div className="space-y-3">
                  <p className="font-semibold text-sm">⌨️ Keyboard Shortcuts</p>
                  <div className="space-y-1 text-xs">
                    <div className="flex justify-between gap-4">
                      <span className="text-muted-foreground">Status Views:</span>
                      <span className="font-mono">1-4</span>
                    </div>
                    <div className="flex justify-between gap-4">
                      <span className="text-muted-foreground">Toggle Alerts:</span>
                      <span className="font-mono">A</span>
                    </div>
                    <div className="flex justify-between gap-4">
                      <span className="text-muted-foreground">Manual Refresh:</span>
                      <span className="font-mono">Ctrl+R</span>
                    </div>
                    <div className="flex justify-between gap-4">
                      <span className="text-muted-foreground">Fullscreen:</span>
                      <span className="font-mono">F11</span>
                    </div>
                    <div className="flex justify-between gap-4">
                      <span className="text-muted-foreground">Exit TV Mode:</span>
                      <span className="font-mono">Esc</span>
                    </div>
                  </div>
                  <div className="pt-2 border-t text-xs text-muted-foreground">
                    <p>💡 <strong>Tips:</strong></p>
                    <p>• Click alert badges for detailed information</p>
                    <p>• Use three-dot menu for service actions</p>
                    <p>• Grid automatically adapts to service count</p>
                  </div>
                </div>
              </PopoverContent>
            </Popover>
            
            <Button
              variant="outline"
              size="sm"
              onClick={() => navigate('/')}
              className="flex items-center gap-2"
              title="Exit TV Mode (Escape)"
            >
              <X className="h-4 w-4" />
              Exit TV Mode
            </Button>
          </div>
        </div>
        
        <div className="flex flex-wrap items-center justify-center gap-6">
          {/* Multi-State Filter Buttons */}
          <div className="flex flex-wrap items-center gap-3">
            <span className="text-sm font-medium text-muted-foreground">Status:</span>
            <div className="flex flex-wrap gap-1">
              {(['all', 'running', 'stopped', 'error'] as const).map((state, index) => {
                const isSelected = selectedStates.has(state)
                const isAllSelected = selectedStates.has('all')
                
                return (
                  <Button
                    key={state}
                    variant={isSelected || (state === 'all' && isAllSelected) ? "default" : "outline"}
                    size="sm"
                    onClick={() => {
                      if (state === 'all') {
                        setSelectedStates(new Set(['all']))
                      } else {
                        toggleStateSelection(state)
                      }
                    }}
                    className="capitalize min-w-[85px]"
                    title={`Toggle ${state} view (${index + 1})`}
                  >
                    <span className="inline-block min-w-[50px]">{state}</span>
                    {isSelected && state !== 'all' && !isAllSelected && (
                      <span className="ml-1 text-xs">✓</span>
                    )}
                  </Button>
                )
              })}
            </div>
            {/* <div className="text-xs text-muted-foreground">
              {selectedStates.has('all') ? 'All' : `${Array.from(selectedStates).join(', ')}`}
            </div> */}
          </div>
          
          {/* Alert Filter Toggle */}
          <div className="flex flex-wrap items-center gap-3">
            <span className="text-sm font-medium text-muted-foreground">Show:</span>
            <div className="flex gap-1 bg-muted/50 rounded-md p-1">
              <Button
                variant={alertFilter === 'all' ? "default" : "ghost"}
                size="sm"
                onClick={() => setAlertFilter('all')}
                className="h-7 px-3 text-xs"
                title="Show all services (A)"
              >
                All
              </Button>
              <Button
                variant={alertFilter === 'with-alerts' ? "default" : "ghost"}
                size="sm"
                onClick={() => setAlertFilter('with-alerts')}
                className="h-7 px-3 text-xs flex items-center gap-1"
                title="Show only services with alerts (A)"
              >
                <AlertTriangle className="h-3 w-3" />
                Alerts Only
              </Button>
            </div>
          </div>
        </div>
      </div>

            {/* Compact Statistics Bar */}
      <div className="grid grid-cols-6 gap-2 mb-3">
        <Card className="border border-blue-500 bg-blue-50/50 dark:bg-blue-950/50">
          <CardContent className="p-2 text-center">
            <div className="text-lg font-bold text-blue-700 dark:text-blue-300 leading-none">
              {stats.filtered.total}
              {stats.filtered.total !== stats.total && (
                <span className="text-xs text-blue-500 dark:text-blue-400">/{stats.total}</span>
              )}
            </div>
            <div className="text-xs text-blue-600 dark:text-blue-400 mt-0.5 flex items-center justify-center min-h-[1.25rem]">
              {stats.filtered.total !== stats.total ? 'Filtered/Total' : 'Total'}
            </div>
          </CardContent>
        </Card>
        
        <Card className="border border-green-500 bg-green-50/50 dark:bg-green-950/50">
          <CardContent className="p-2 text-center">
            <div className="text-lg font-bold text-green-700 dark:text-green-300 leading-none">
              {stats.filtered.running}
              {stats.filtered.running !== stats.running && (
                <span className="text-xs text-green-500 dark:text-green-400">/{stats.running}</span>
              )}
            </div>
            <div className="text-xs text-green-600 dark:text-green-400 mt-0.5 flex items-center justify-center min-h-[1.25rem]">Running</div>
          </CardContent>
        </Card>
        
        <Card className="border border-gray-500 bg-gray-50/50 dark:bg-gray-950/50">
          <CardContent className="p-2 text-center">
            <div className="text-lg font-bold text-gray-700 dark:text-gray-300 leading-none">
              {stats.filtered.stopped}
              {stats.filtered.stopped !== stats.stopped && (
                <span className="text-xs text-gray-500 dark:text-gray-400">/{stats.stopped}</span>
              )}
            </div>
            <div className="text-xs text-gray-600 dark:text-gray-400 mt-0.5 flex items-center justify-center min-h-[1.25rem]">Stopped</div>
          </CardContent>
        </Card>
        
        <Card className="border border-red-500 bg-red-50/50 dark:bg-red-950/50">
          <CardContent className="p-2 text-center">
            <div className="text-lg font-bold text-red-700 dark:text-red-300 leading-none">
              {stats.filtered.error}
              {stats.filtered.error !== stats.error && (
                <span className="text-xs text-red-500 dark:text-red-400">/{stats.error}</span>
              )}
            </div>
            <div className="text-xs text-red-600 dark:text-red-400 mt-0.5 flex items-center justify-center min-h-[1.25rem]">Error</div>
          </CardContent>
        </Card>
        
        <Card className="border border-yellow-500 bg-yellow-50/50 dark:bg-yellow-950/50">
          <CardContent className="p-2 text-center">
            <div className="text-lg font-bold text-yellow-700 dark:text-yellow-300 leading-none">
              {stats.filtered.unknown}
              {stats.filtered.unknown !== stats.unknown && (
                <span className="text-xs text-yellow-500 dark:text-yellow-400">/{stats.unknown}</span>
              )}
            </div>
            <div className="text-[10px] sm:text-xs text-yellow-600 dark:text-yellow-400 mt-0.5 flex items-center justify-center min-h-[1.25rem]">Unknown</div>
          </CardContent>
        </Card>
        
        <Card className="border border-orange-500 bg-orange-50/50 dark:bg-orange-950/50">
          <CardContent className="p-2 text-center">
            <div className="text-lg font-bold text-orange-700 dark:text-orange-300 leading-none">
              {stats.totalAlerts}
            </div>
            <div className="text-xs text-orange-600 dark:text-orange-400 mt-0.5 flex items-center justify-center min-h-[1.25rem]">Alerts</div>
          </CardContent>
        </Card>
      </div>

      {/* Services Grid */}
      {isLoading ? (
        <div className="flex items-center justify-center h-64">
          <div className="text-xl text-muted-foreground">Loading services...</div>
        </div>
      ) : filteredServices.length === 0 ? (
        <div className="flex items-center justify-center h-64">
          <div className="text-xl text-muted-foreground">
            {alertFilter === 'with-alerts' 
              ? 'No services with alerts found for current view'
              : 'No services found for current view'
            }
          </div>
        </div>
      ) : (
        <div 
          className={cn("grid gap-2",smartGridConfig.cardSize === 'xs' ? 'gap-1' : smartGridConfig.cardSize === 'sm' ? 'gap-2' : 'gap-4')}
          style={{ gridTemplateColumns: `repeat(${smartGridConfig.columns}, minmax(0, 1fr))` }}
        >
          {filteredServices.map((service) => {
            const isCompact = smartGridConfig.cardSize === 'xs' || smartGridConfig.cardSize === 'sm'
            const isExtraCompact = smartGridConfig.cardSize === 'xs'
            
            return (
              <Card
                key={service.id}
                className={cn(
                  "border-2 transition-[transform,box-shadow,border-color] duration-200 hover:-translate-y-1 relative overflow-hidden",
                  smartGridConfig.cardSize === 'lg' ? "hover:scale-[1.02]" : "hover:scale-105",
                  getStatusColor(service.serviceStatus),
                  // Add static red indicator for services with alerts
                  service.alertsCount > 0 && [
                    "shadow-md shadow-red-500/15",
                    "ring-1 ring-red-500/20",
                    "border-red-400/60",
                    "bg-gradient-to-br from-red-50/30 to-transparent dark:from-red-950/30"
                  ]
                )}
              >
                <CardContent className={cn(
                  isExtraCompact ? "p-2" : isCompact ? "p-3" : "p-4"
                )}>
                  {/* Service Status Icons with Alert Badge and Action Menu */}
                  <div className={cn(
                    "flex items-center justify-between",
                    isExtraCompact ? "mb-1" : "mb-3"
                  )}>
                    {/* Left side: Status and Type Icons */}
                    <div className="flex items-center gap-1">
                      {getStatusIcon(service.serviceStatus)}
                      {!isExtraCompact && getServiceTypeIcon(service.serviceType)}
                    </div>
                    
                    {/* Right side: Alert Badge and Action Menu */}
                    {!isExtraCompact && (
                      <div className="flex items-center gap-1">
                        {/* Alert Badge with Click-to-Open Popover - Only show if alerts exist */}
                        {service.alertsCount > 0 && (
                          <Popover>
                            <PopoverTrigger asChild>
                              <Button
                                variant="ghost"
                                size="sm"
                                className={cn(
                                  "h-5 px-1.5 text-xs bg-red-50 hover:bg-red-100 text-red-700 border border-red-200",
                                  isCompact && "h-4 px-1"
                                )}
                                onClick={(e) => {
                                  e.stopPropagation()
                                }}
                              >
                                <AlertTriangle className="h-2.5 w-2.5 mr-0.5" />
                                {service.alertsCount}
                              </Button>
                            </PopoverTrigger>
                            <PopoverContent side="top" className="max-w-xs p-3">
                              <div className="space-y-2">
                                <p className="font-medium text-[10px] text-red-700 leading-tight">🚨 {service.alertsCount} Alert{service.alertsCount !== 1 ? 's' : ''}</p>
                                {service.serviceAlerts?.slice(0, 3).map((alert, idx) => (
                                  <div key={idx} className="text-xs bg-red-50 border-l-3 border-red-400 p-2 rounded-r">
                                    <p className="font-medium text-red-800">{alert.alertName}</p>
                                    {alert.summary && (
                                      <p className="text-red-600 mt-1">{alert.summary}</p>
                                    )}
                                    <div className="flex items-center gap-2 mt-1 text-xs text-red-500">
                                      <span>Status: {alert.status}</span>
                                      {alert.startsAt && (
                                        <span>Since: {new Date(alert.startsAt).toLocaleTimeString()}</span>
                                      )}
                                    </div>
                                  </div>
                                ))}
                                {service.serviceAlerts && service.serviceAlerts.length > 3 && (
                                  <p className="text-xs text-red-600 font-medium">+{service.serviceAlerts.length - 3} more alerts</p>
                                )}
                                {(!service.serviceAlerts || service.serviceAlerts.length === 0) && (
                                  <p className="text-xs text-muted-foreground italic">No alert details available</p>
                                )}
                              </div>
                            </PopoverContent>
                          </Popover>
                        )}
                        
                        {/* Compact Actions Dropdown */}
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button
                              variant="ghost"
                              size="sm"
                              className={cn(
                                "h-5 w-5 p-0 hover:bg-muted",
                                isCompact && "h-4 w-4"
                              )}
                              onClick={(e) => e.stopPropagation()}
                            >
                              <MoreVertical className="h-2.5 w-2.5" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end" className="w-32">
                            {service.serviceStatus === 'stopped' ? (
                              <DropdownMenuItem
                                onClick={(e) => {
                                  e.stopPropagation()
                                  handleStartService(service)
                                }}
                                disabled={startServiceMutation.isPending}
                                className="text-xs"
                              >
                                <Play className="h-3 w-3 mr-2" />
                                Start
                              </DropdownMenuItem>
                            ) : (
                              <DropdownMenuItem
                                onClick={(e) => {
                                  e.stopPropagation()
                                  handleStopService(service)
                                }}
                                disabled={stopServiceMutation.isPending}
                                className="text-xs"
                              >
                                <Square className="h-3 w-3 mr-2" />
                                Stop
                              </DropdownMenuItem>
                            )}
                            <DropdownMenuItem
                              onClick={(e) => {
                                e.stopPropagation()
                                handleRestartService(service)
                              }}
                              disabled={startServiceMutation.isPending || stopServiceMutation.isPending}
                              className="text-xs"
                            >
                              <RotateCcw className="h-3 w-3 mr-2" />
                              Restart
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </div>
                    )}
                  </div>
                  
                  <div className={cn(
                    "space-y-1",
                    isCompact && "space-y-0.5"
                  )}>
                    <h3 className={cn(
                      "font-semibold truncate",
                      isExtraCompact ? "text-xs" : "text-sm"
                    )} title={service.name}>
                      {service.name}
                    </h3>
                    
                    {!isExtraCompact && (
                      <div className="flex items-center gap-1 text-xs text-muted-foreground">
                        {service.serviceType === 'SYSTEMD' ? (
                          <Wifi className="h-3 w-3" />
                        ) : service.serviceIP ? (
                          <Wifi className="h-3 w-3" />
                        ) : (
                          <WifiOff className="h-3 w-3" />
                        )}
                        <span className="truncate">
                          {service.serviceType === 'SYSTEMD' 
                            ? service.provider.providerIP 
                            : service.serviceIP || 'No IP'}
                        </span>
                      </div>
                    )}
                    
                    {!isCompact && (
                      <div className="text-xs text-muted-foreground truncate">
                        Provider: {service.provider.name}
                      </div>
                    )}
                    
                    {!isCompact && service.serviceType === 'DOCKER' && service.containerDetails?.image && (
                      <div className="text-xs text-muted-foreground truncate">
                        Image: {service.containerDetails.image}
                      </div>
                    )}
                    
                    <Badge 
                      variant="outline" 
                      className={cn(
                        "w-full justify-center",
                        isExtraCompact ? "text-xs px-1 py-0 h-5" : "text-xs",
                        service.serviceStatus === 'running' && "border-green-500 text-green-700",
                        service.serviceStatus === 'stopped' && "border-gray-500 text-gray-700",
                        service.serviceStatus === 'error' && "border-red-500 text-red-700",
                        service.serviceStatus === 'unknown' && "border-yellow-500 text-yellow-700"
                      )}
                    >
                      {isExtraCompact ? service.serviceStatus.charAt(0).toUpperCase() : service.serviceStatus.toUpperCase()}
                    </Badge>

                  </div>
                </CardContent>
              </Card>
            )
          })}
        </div>
      )}
    </div>
  </>
  )
}

export default TVMode
